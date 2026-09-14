import { readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { digest } from "../src/domain/core.ts";
import { portalPermissions } from "../src/domain/portal/schemas.ts";
import { portalScenario } from "./portal-scenario.ts";
const f = JSON.parse(await readFile(".local/dev-access.json", "utf8")) as {
  org: string;
  unit: string;
  adminRole: string;
  adminToken: string;
};
const admin = pool(process.env.MIGRATION_DATABASE_URL ?? "", 1),
  db = pool(process.env.DATABASE_URL ?? "", 5),
  app = await buildApp(db);
try {
  const org = await admin.query(
    "SELECT nome FROM hvb.organizacao WHERE id=$1",
    [f.org],
  );
  if (org.rows[0]?.nome !== "Hospital Fictício DEV — sem dados reais")
    throw new Error("Seed restrito à organização sintética original");
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",
    [f.org, f.adminRole, portalPermissions],
  );
  const s = await portalScenario(app, f.adminToken, f.unit, "seed-m6e");
  const message = await s.portal("mensagem", "mensagens", s.body),
    attempt = await s.portal("tentativa", "tentativas", {
      mensagem_id: message,
      sequencia_esperada: 0,
    });
  const instant = (
    await admin.query(
      "SELECT criada_em::text instante FROM hvb.tentativa_comunicacao WHERE id=$1",
      [attempt],
    )
  ).rows[0].instante;
  await s.portal("retorno", "retornos", {
    tentativa_id: attempt,
    sequencia_esperada: 0,
    estado: "entregue",
    ocorrido_em: instant,
    evidencia: "Simulação local, nenhum envio externo",
    referencia: "9998a902-7ee8-487b-99ab-8d8c6caa0163",
  });
  const saved = await readFile(".local/portal-access.json", "utf8").then(
    (t) => JSON.parse(t) as { account: string; token: string },
    (e) => {
      if (e.code === "ENOENT") return undefined;
      throw e;
    },
  );
  if (saved && saved.account !== s.account)
    throw new Error(
      "Credencial local pertence a outra conta; preserve e revise",
    );
  const token = saved?.token ?? randomBytes(32).toString("hex");
  await admin.query(
    "INSERT INTO hvb.credencial_portal(id,organizacao_id,conta_portal_id,token_hash,expira_em) VALUES($1,$2,$3,$4,now()+interval '7 days') ON CONFLICT(token_hash) DO NOTHING",
    [randomUUID(), f.org, s.account, digest(token)],
  );
  await writeFile(
    ".local/portal-access.json",
    `${JSON.stringify({ account: s.account, token }, null, 2)}\n`,
    { mode: 0o600 },
  );
  const { portal: _, doc: __, ...references } = s;
  await writeFile(
    ".local/portal-demo.json",
    `${JSON.stringify({ ...references, message, attempt }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed M6E fictício e idempotente: conta, acesso explícito, preferência, mensagem documental e entrega simulada; credencial privada local com validade de sete dias.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
