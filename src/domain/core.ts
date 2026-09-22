import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

export class DomainError extends Error {
  statusCode: number;
  code: string;
  constructor(statusCode: number, code: string) {
    super(code);
    this.statusCode = statusCode;
    this.code = code;
  }
}
export type Actor = {
  organizacao_id: string;
  usuario_id: string;
  credencial_id: string;
};
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
export function occurred(value: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms > Date.now())
    throw new DomainError(400, "horario_ocorrido_invalido");
  return new Date(ms).toISOString();
}
export async function authorize(
  tx: PoolClient,
  actor: Actor,
  permission: string,
  unit?: string,
) {
  await tx.query(
    "SELECT pg_advisory_xact_lock_shared(hashtextextended('acesso:'||$1::text||':'||$2::text,0))",
    [actor.organizacao_id, actor.usuario_id],
  );
  const result = await tx.query(
    `SELECT 1 FROM atribuicao_consulta up JOIN papel_permissao pp
    ON (up.organizacao_id,up.papel_id)=(pp.organizacao_id,pp.papel_id)
    WHERE up.organizacao_id=$1 AND up.usuario_id=$2 AND up.ativo AND pp.permissao=$3
    AND (up.unidade_id IS NULL OR up.unidade_id=$4::uuid) LIMIT 1`,
    [actor.organizacao_id, actor.usuario_id, permission, unit ?? null],
  );
  if (!result.rowCount) throw new DomainError(403, "acao_nao_permitida");
}
export async function one(tx: PoolClient, sql: string, values: unknown[]) {
  const result = await tx.query(sql, values);
  if (!result.rowCount) throw new DomainError(404, "registro_nao_encontrado");
  return result.rows[0];
}
export async function command(
  tx: PoolClient,
  actor: Actor,
  key: string,
  operation: string,
  payload: unknown,
  device: string | undefined,
  correlation: string,
  work: (commandId: string) => Promise<{ id: string; [key: string]: unknown }>,
) {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key))
    throw new DomainError(400, "chave_idempotencia_invalida");
  if (device) {
    const d = await one(
      tx,
      "SELECT unidade_id,ativo FROM dispositivo WHERE organizacao_id=$1 AND id=$2 FOR SHARE",
      [actor.organizacao_id, device],
    );
    if (!d.ativo) throw new DomainError(403, "dispositivo_inativo");
    await authorize(tx, actor, "dispositivos:usar", d.unidade_id);
  }
  const hash = digest(canonical({ operation, payload }));
  const id = randomUUID();
  const insert = await tx.query(
    `INSERT INTO comando(id,organizacao_id,autor_id,dispositivo_id,chave,operacao,hash_payload)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id`,
    [
      id,
      actor.organizacao_id,
      actor.usuario_id,
      device ?? null,
      key,
      operation,
      hash,
    ],
  );
  if (!insert.rowCount) {
    const existing = await one(
      tx,
      `SELECT hash_payload,resultado FROM comando
      WHERE organizacao_id=$1 AND autor_id=$2 AND dispositivo_id IS NOT DISTINCT FROM $3::uuid AND chave=$4`,
      [actor.organizacao_id, actor.usuario_id, device ?? null, key],
    );
    if (existing.hash_payload !== hash)
      throw new DomainError(409, "chave_reutilizada_com_outro_conteudo");
    if (!existing.resultado) throw new DomainError(409, "comando_pendente");
    return { ...existing.resultado, repetido: true };
  }
  const result = {
    ...(await work(id)),
    comando_id: id,
    estado: "confirmado",
    repetido: false,
  };
  const reason =
    (payload as { body?: { motivo?: string } }).body?.motivo ?? null;
  await tx.query(
    `WITH audit AS (
      INSERT INTO evento_auditoria(id,organizacao_id,comando_id,autor_id,acao,entidade_id,correlation_id,motivo)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    ), event AS (
      INSERT INTO outbox(id,organizacao_id,comando_id,tipo,entidade_id) VALUES($9,$2,$3,$5,$6)
    ) UPDATE comando SET resultado=$10,concluido_em=now() WHERE organizacao_id=$2 AND id=$3`,
    [
      randomUUID(),
      actor.organizacao_id,
      id,
      actor.usuario_id,
      operation,
      result.id,
      correlation,
      reason,
      randomUUID(),
      result,
    ],
  );
  return result;
}
