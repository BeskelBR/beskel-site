import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
import { clinicalScenario } from "./clinical-scenario.ts";
import { createDevEvidenceAdapter } from "../src/domain/terminal-access/evidence.ts";
const f = JSON.parse(await readFile(".local/dev-access.json", "utf8")) as {
  org: string;
  unit: string;
  adminRole: string;
  adminToken: string;
  admin: string;
};
const simulator = createDevEvidenceAdapter(randomBytes(32));
const admin = pool(process.env.MIGRATION_DATABASE_URL ?? "", 1),
  db = pool(process.env.DATABASE_URL ?? "", 5),
  app = await buildApp(db, false, simulator.adapter);
const file = ".local/terminal-access-demo.json";
try {
  assert.equal(
    (await admin.query("SELECT nome FROM hvb.organizacao WHERE id=$1", [f.org]))
      .rows[0]?.nome,
    "Hospital Fictício DEV — sem dados reais",
  );
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",
    [f.org, f.adminRole, permissions],
  );
  let demo:
    | { org: string; order: string; session: string; position: string }
    | undefined;
  try {
    demo = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!demo) {
    // A completed manifest makes subsequent runs read-only. Interrupted attempts retain history.
    const prefix = `seed-c14-${randomUUID()}`;
    const s = await clinicalScenario(app, f.adminToken, f.unit, prefix);
    const common = { unidade_id: f.unit, motivo: "Demonstração fictícia C14" };
    const create = async (
      name: string,
      path: string,
      payload: Record<string, unknown>,
      device?: string,
    ) => {
      const r = await app.inject({
        method: "POST",
        url: `/v1${path}`,
        headers: {
          authorization: `Bearer ${f.adminToken}`,
          "idempotency-key": `${prefix}-${name}`,
          ...(device ? { "x-device-id": device } : {}),
        },
        payload,
      });
      assert.equal(r.statusCode, 200, r.body);
      return r.json().id as string;
    };
    const device = await create("device", "/dispositivos", {
      unidade_id: f.unit,
      nome: "Terminal V2 sintético C14",
    });
    const order = await create("order", "/retiradas/ordens", {
      ...common,
      episodio_id: s.episode,
      observacao: "Pedido fictício sensível",
      itens: [
        {
          produto_id: s.product,
          quantidade_solicitada: "2",
          sensivel: true,
          exige_lote: true,
          observacao: "Picking permanece no Mobile futuro",
        },
      ],
    });
    await create("submit", `/retiradas/ordens/${order}/submit`, common);
    const challenge = await create(
      "challenge",
      "/terminal/acesso/desafios",
      common,
      device,
    );
    const d = (
      await admin.query(
        "SELECT * FROM hvb.desafio_acesso WHERE organizacao_id=$1 AND id=$2",
        [f.org, challenge],
      )
    ).rows[0];
    const auth = await create(
      "auth",
      "/terminal/acesso/autenticacoes",
      {
        ...common,
        desafio_id: challenge,
        evidencia: simulator.sign({
          desafio_id: challenge,
          nonce: d.nonce,
          usuario_id: d.autor_id,
          terminal_id: device,
          dispositivo_biometrico_id: device,
          capturada_em: new Date().toISOString(),
          expira_em: d.expira_em.toISOString(),
          face_match: true,
          liveness: true,
          identity_claim: true,
          engine: "DEV-HMAC",
          versao: "1",
          modo: "SIMULADO_DEV",
        }),
      },
      device,
    );
    const session = await create(
      "session",
      "/terminal/acesso/sessoes",
      { ...common, autenticacao_id: auth, sensivel: true, ordens: [order] },
      device,
    );
    for (const tipo of [
      "DOOR_AUTHORIZED",
      "DOOR_OPEN",
      "ENTRY_CONFIRMED",
      "DOOR_CLOSED",
      "SENSITIVE_CABINET_AUTHORIZED",
      "SENSITIVE_CABINET_OPEN",
      "SENSITIVE_CABINET_CLOSED",
      "ACCESS_ACTIVE",
      "EXIT",
      "ACCESS_CLOSED",
    ])
      await create(
        tipo,
        `/terminal/acesso/sessoes/${session}/eventos`,
        {
          ...common,
          tipo,
          ocorrida_em: new Date().toISOString(),
          referencia: randomUUID(),
        },
        device,
      );
    demo = { org: f.org, order, session, position: s.position };
    await writeFile(file, `${JSON.stringify(demo, null, 2)}\n`, {
      mode: 0o600,
    });
  }
  assert.equal(demo.org, f.org);
  assert.equal(
    (
      await admin.query(
        "SELECT estado FROM hvb.ordem_retirada_consulta WHERE organizacao_id=$1 AND id=$2",
        [f.org, demo.order],
      )
    ).rows[0]?.estado,
    "EM_SEPARACAO",
  );
  assert.equal(
    (
      await admin.query(
        "SELECT estado FROM hvb.sessao_acesso_consulta WHERE organizacao_id=$1 AND id=$2",
        [f.org, demo.session],
      )
    ).rows[0]?.estado,
    "ACCESS_CLOSED",
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.evento_acesso WHERE organizacao_id=$1 AND sessao_id=$2",
        [f.org, demo.session],
      )
    ).rows[0]?.n,
    11,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT saldo_base FROM hvb.posicao_estoque WHERE organizacao_id=$1 AND id=$2",
        [f.org, demo.position],
      )
    ).rows[0]?.saldo_base,
    "20.000000",
  );
  console.log(
    "C14 DEV: ordem em separação, acesso sensível encerrado, 11 eventos, saldo preservado. Manifesto concluído reutilizado nas repetições; sem hardware ou picking.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
