import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  authorize,
  canonical,
  digest,
  DomainError,
  occurred,
  one,
} from "../core.ts";
import type { Actor } from "../core.ts";
import type { Body } from "../foundation.ts";
export type Env = { tx: PoolClient; a: Actor; b: Body; cmd: string };
export const fail = (code: string, status = 409): never => {
  throw new DomainError(status, `tv1_${code}`);
};
export async function insert(e: Env, table: string, extra: Body) {
  const row = {
    id: randomUUID(),
    organizacao_id: e.a.organizacao_id,
    unidade_id: e.b.unidade_id,
    autor_id: e.a.usuario_id,
    comando_id: e.cmd,
    motivo: e.b.motivo,
    ...extra,
  };
  const keys = Object.keys(row);
  await e.tx.query(
    `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(row),
  );
  return row.id;
}
export const get = (e: Env, table: string, id: unknown, lock = false) =>
  one(
    e.tx,
    `SELECT * FROM ${table} WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3${lock ? " FOR UPDATE" : ""}`,
    [e.a.organizacao_id, e.b.unidade_id, id],
  );
export async function bind(
  tx: PoolClient,
  a: Actor,
  unit: string,
  room: string,
  role: string,
  device: string,
) {
  const found = await tx.query(
    `SELECT v.* FROM tv1_device v JOIN dispositivo d ON (d.organizacao_id,d.id)=(v.organizacao_id,v.device_id)
    JOIN credencial c ON (c.organizacao_id,c.id)=(v.organizacao_id,v.credential_id)
    WHERE v.organizacao_id=$1 AND v.unidade_id=$2 AND v.room_id=$3 AND v.role=$4 AND v.device_id=$5 AND v.credential_id=$6
    AND d.ativo AND c.usuario_id=$7 AND c.tipo='api' AND c.revogada_em IS NULL AND c.expira_em>clock_timestamp() FOR SHARE OF v,d,c`,
    [a.organizacao_id, unit, room, role, device, a.credencial_id, a.usuario_id],
  );
  if (!found.rowCount) fail("identidade_dispositivo_nao_provisionada", 403);
  return found.rows[0];
}
export async function device(e: Env, room: string, role: string) {
  const c = await one(
    e.tx,
    "SELECT dispositivo_id FROM comando WHERE organizacao_id=$1 AND id=$2",
    [e.a.organizacao_id, e.cmd],
  );
  return bind(
    e.tx,
    e.a,
    e.b.unidade_id as string,
    room,
    role,
    c.dispositivo_id,
  );
}
export async function employee(
  e: Env,
  id: string,
  permission = "terminal:acessar",
) {
  const u = await one(
    e.tx,
    "SELECT ativo FROM usuario WHERE organizacao_id=$1 AND id=$2 FOR SHARE",
    [e.a.organizacao_id, id],
  );
  if (!u.ativo) fail("funcionario_inativo", 403);
  const a = { ...e.a, usuario_id: id };
  await authorize(e.tx, a, permission, e.b.unidade_id as string);
  return a;
}
export async function nfcActive(e: Env, id: string) {
  const n = await get(e, "tv1_nfc", id);
  await e.tx.query(
    "SELECT pg_advisory_xact_lock_shared(hashtextextended('tv1:nfc:'||$1::text,0))",
    [id],
  );
  if (
    (
      await e.tx.query(
        "SELECT 1 FROM tv1_nfc_revocation WHERE organizacao_id=$1 AND nfc_id=$2",
        [e.a.organizacao_id, id],
      )
    ).rowCount
  )
    fail("nfc_revogado", 403);
  await employee(e, n.employee_id);
  return n;
}
export async function event(
  e: Env,
  type: string,
  refs: Body,
  automatic = true,
  external?: Body,
) {
  const c = await one(
    e.tx,
    "SELECT dispositivo_id,chave FROM comando WHERE organizacao_id=$1 AND id=$2",
    [e.a.organizacao_id, e.cmd],
  );
  return insert(e, "tv1_event", {
    ...refs,
    type,
    automatic,
    source_device_id: c.dispositivo_id,
    event_id: external?.event_id ?? randomUUID(),
    idempotency_key: c.chave,
    occurred_at: external
      ? occurred(external.occurred_at as string)
      : new Date().toISOString(),
    payload_digest: digest(canonical(external ?? { type, ...refs })),
  });
}
export async function replayEvent(e: Env, session: string) {
  const r = await e.tx.query(
    "SELECT access_session_id,payload_digest,source_device_id FROM tv1_event WHERE organizacao_id=$1 AND event_id=$2",
    [e.a.organizacao_id, e.b.event_id],
  );
  if (!r.rowCount) return false;
  const c = await one(
    e.tx,
    "SELECT dispositivo_id FROM comando WHERE organizacao_id=$1 AND id=$2",
    [e.a.organizacao_id, e.cmd],
  );
  if (
    r.rows[0].access_session_id !== session ||
    r.rows[0].source_device_id !== c.dispositivo_id ||
    r.rows[0].payload_digest !== digest(canonical(e.b))
  )
    fail("evento_reutilizado_com_outro_conteudo");
  return true;
}
export async function projection(e: Env) {
  await e.tx.query("SELECT set_config('hvb.tv1_command',$1,true)", [e.cmd]);
}
export async function session(e: Env, id: string, role: string) {
  // Room lock first: creation, expiration, controller and kiosk use the same lock order.
  const previous = await get(e, "tv1_session", id);
  await get(e, "tv1_room", previous.room_id, true);
  const s = await get(e, "tv1_session", id, true);
  await device(e, s.room_id, role);
  await projection(e);
  return s;
}
