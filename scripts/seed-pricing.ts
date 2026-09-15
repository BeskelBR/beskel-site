import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
import { pricingScenario } from "./pricing-scenario.ts";
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
    [f.org, f.adminRole, permissions],
  );
  const s = await pricingScenario(app, f.adminToken, f.unit, "seed-c6");
  const r = await app.inject({
    method: "POST",
    url: "/v1/compras/vinculos-valores",
    headers: {
      authorization: `Bearer ${f.adminToken}`,
      "idempotency-key": "seed-c6-vinculo",
    },
    payload: {
      ...s.common,
      precificacao_id: s.pricing,
      obrigacao_id: s.obligation,
      valor: "100.00",
    },
  });
  if (r.statusCode !== 200) throw new Error(r.body);
  await writeFile(
    ".local/pricing-demo.json",
    `${JSON.stringify(
      {
        supplier: s.supplier,
        purchaseOrder: s.purchaseOrder,
        pricing: s.pricing,
        obligation: s.obligation,
        link: r.json().id,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed C6 fictício: pedido precificado em 105, obrigação de 100 e vínculo explícito de 100; saldo comercial para vincular 5. Sem pagamento real ou alteração de custo pelo vínculo.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
