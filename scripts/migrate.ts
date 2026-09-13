import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { pool } from "../src/persistence/database.ts";

export async function migrate(url: string) {
  const db = pool(url, 1);
  const tx = await db.connect();
  try {
    await tx.query("BEGIN");
    await tx.query("SELECT pg_advisory_xact_lock(734913)");
    await tx.query(
      "CREATE TABLE IF NOT EXISTS public.schema_migration (nome text PRIMARY KEY, hash text NOT NULL, aplicada_em timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of (await readdir("migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(`migrations/${name}`, "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const previous = await tx.query(
        "SELECT hash FROM public.schema_migration WHERE nome=$1",
        [name],
      );
      if (previous.rowCount) {
        if (previous.rows[0].hash !== hash)
          throw new Error(`Migration alterada: ${name}`);
      } else {
        await tx.query(sql);
        await tx.query(
          "INSERT INTO public.schema_migration(nome,hash) VALUES($1,$2)",
          [name, hash],
        );
      }
    }
    await tx.query(`
      GRANT USAGE ON SCHEMA hvb TO hvb_app,hvb_worker;
      GRANT SELECT ON public.schema_migration TO hvb_app;
      GRANT SELECT ON ALL TABLES IN SCHEMA hvb TO hvb_app;
      GRANT INSERT ON hvb.unidade_hospitalar,hvb.usuario,hvb.papel,hvb.papel_permissao,hvb.usuario_papel,
        hvb.dispositivo,hvb.credencial,hvb.comando,hvb.responsavel,hvb.paciente,hvb.paciente_responsavel,
        hvb.episodio,hvb.local,hvb.ocupacao,hvb.lote_importacao,hvb.id_externo,hvb.evento_auditoria,hvb.outbox TO hvb_app;
      GRANT UPDATE(resultado,concluido_em) ON hvb.comando TO hvb_app;
      GRANT UPDATE(revogada_em,revogada_por_id,motivo_revogacao) ON hvb.credencial TO hvb_app;
      GRANT UPDATE(ativo) ON hvb.usuario,hvb.dispositivo TO hvb_app;
      GRANT UPDATE(fim) ON hvb.paciente_responsavel TO hvb_app;
      GRANT UPDATE(alta_clinica_em,alta_por_id,motivo_alta,encerrado_em,encerrado_por_id,motivo_saida,versao) ON hvb.episodio TO hvb_app;
      GRANT UPDATE(fim,encerrada_por_id,motivo_fim) ON hvb.ocupacao TO hvb_app;
      GRANT EXECUTE ON FUNCTION hvb.autenticar(text) TO hvb_app;
      GRANT EXECUTE ON FUNCTION hvb.reservar_outbox(integer,uuid) TO hvb_worker;
      GRANT SELECT ON hvb.outbox,hvb.inbox TO hvb_worker;
      GRANT INSERT ON hvb.inbox TO hvb_worker;
      GRANT UPDATE(concluida_em,lease_ate,lease_token,pendente_em,ultimo_erro,disponivel_em) ON hvb.outbox TO hvb_worker;
    `);
    await tx.query("COMMIT");
  } catch (error) {
    await tx.query("ROLLBACK");
    throw error;
  } finally {
    tx.release();
    await db.end();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await migrate(process.env.MIGRATION_DATABASE_URL ?? "");
  console.log("Migrations DEV verificadas/aplicadas.");
}
