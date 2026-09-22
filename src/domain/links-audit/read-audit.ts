import { randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type pg from "pg";
import { transaction } from "../../persistence/database.ts";
import { DomainError } from "../core.ts";
type Identity = {
  organizacao_id: string;
  credencial_id: string;
  usuario_id?: string;
  conta_portal_id?: string;
};
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Keep only typed identifiers. Never retain raw URL, token, search text or payload.
export async function auditedTransaction<T>(
  db: pg.Pool,
  req: FastifyRequest,
  identity: Identity,
  work: (tx: pg.PoolClient) => Promise<T>,
): Promise<T> {
  if (!["GET", "HEAD"].includes(req.method))
    return transaction(db, identity.organizacao_id, work);
  const params: Record<string, string> = {};
  for (const source of [req.query, req.params])
    if (source && typeof source === "object") {
      for (const [key, value] of Object.entries(source))
        if (
          /^(id|[a-z_]+_id)$/.test(key) &&
          typeof value === "string" &&
          uuidPattern.test(value)
        )
          params[key] = value;
    }
  const outcome = await transaction(db, identity.organizacao_id, async (tx) => {
    await tx.query("SAVEPOINT leitura");
    let value: T | undefined, error: DomainError | undefined;
    try {
      value = await work(tx);
    } catch (e) {
      if (
        !(e instanceof DomainError) ||
        e.statusCode < 400 ||
        e.statusCode >= 500
      )
        throw e;
      await tx.query("ROLLBACK TO SAVEPOINT leitura");
      error = e;
    }
    await tx.query("RELEASE SAVEPOINT leitura");
    const unit = params.unidade_id
      ? (
          await tx.query(
            "SELECT id FROM unidade_hospitalar WHERE organizacao_id=$1 AND id=$2",
            [identity.organizacao_id, params.unidade_id],
          )
        ).rows[0]?.id
      : null;
    // Failure to persist this record aborts the transaction and withholds the result.
    try {
      await tx.query(
        "INSERT INTO leitura_auditada(id,organizacao_id,unidade_id,usuario_id,conta_portal_id,credencial_id,credencial_portal_id,correlation_id,rota,metodo,status_consulta,parametros) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [
          randomUUID(),
          identity.organizacao_id,
          unit ?? null,
          identity.usuario_id ?? null,
          identity.conta_portal_id ?? null,
          identity.usuario_id ? identity.credencial_id : null,
          identity.conta_portal_id ? identity.credencial_id : null,
          req.id,
          req.routeOptions.url,
          req.method,
          error?.statusCode ?? 200,
          JSON.stringify(params),
        ],
      );
    } catch (e) {
      if (["40P01", "40001"].includes((e as { code?: string }).code ?? ""))
        throw e;
      throw new DomainError(503, "auditoria_indisponivel");
    }
    return { value, error };
  });
  if (outcome.error) throw outcome.error;
  return outcome.value as T;
}
