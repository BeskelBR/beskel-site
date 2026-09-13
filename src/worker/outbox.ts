import { randomUUID } from "node:crypto";
import type pg from "pg";
import { transaction } from "../persistence/database.ts";
export type Job = {
  id: string;
  organizacao_id: string;
  tipo: string;
  entidade_id: string;
  lease_token: string;
  tentativas: number;
};
export async function claim(db: pg.Pool, limit = 25): Promise<Job[]> {
  return (
    await db.query("SELECT * FROM hvb.reservar_outbox($1,$2)", [
      limit,
      randomUUID(),
    ])
  ).rows;
}
export async function deliverLocal(db: pg.Pool, job: Job) {
  return transaction(db, job.organizacao_id, async (tx) => {
    const current = await tx.query(
      "SELECT id FROM outbox WHERE id=$1 AND lease_token=$2 AND lease_ate>now() AND concluida_em IS NULL AND pendente_em IS NULL FOR UPDATE",
      [job.id, job.lease_token],
    );
    if (!current.rowCount) return false;
    await tx.query(
      `INSERT INTO inbox(id,organizacao_id,consumidor,evento_id) VALUES($1,$2,'local-foundation-v1',$3)
      ON CONFLICT (organizacao_id,consumidor,evento_id) DO NOTHING`,
      [randomUUID(), job.organizacao_id, job.id],
    );
    await tx.query(
      "UPDATE outbox SET concluida_em=now(),lease_ate=NULL,lease_token=NULL WHERE id=$1 AND lease_token=$2",
      [job.id, job.lease_token],
    );
    return true;
  });
}
export async function fail(db: pg.Pool, job: Job) {
  await transaction(db, job.organizacao_id, async (tx) => {
    await tx.query(
      `UPDATE outbox SET ultimo_erro='falha_consumidor_local',lease_ate=NULL,lease_token=NULL,
      pendente_em=CASE WHEN tentativas>=5 THEN now() ELSE NULL END,
      disponivel_em=now()+make_interval(secs => $3)
      WHERE id=$1 AND lease_token=$2 AND concluida_em IS NULL`,
      [job.id, job.lease_token, Math.min(300, 2 ** job.tentativas)],
    );
  });
}
export async function runBatch(db: pg.Pool, limit = 25) {
  const jobs = await claim(db, limit);
  for (const job of jobs) {
    try {
      await deliverLocal(db, job);
    } catch {
      await fail(db, job);
    }
  }
  return jobs.length;
}
