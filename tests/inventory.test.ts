import { before, after, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { inventoryLists } from "../src/domain/inventory/service.ts";
let app: FastifyInstance, db: pg.Pool, admin: pg.Pool;
let f: Awaited<ReturnType<typeof seedFixture>>, other: typeof f;
const time = () => new Date(Date.now() - 1000).toISOString();
const movement = {
  motivo: "Operação fictícia de teste",
  ocorrido_em: "2026-01-01T12:00:00Z",
};
async function post(
  path: string,
  body: unknown,
  key = randomUUID(),
  token = f.adminToken,
) {
  return app.inject({
    method: "POST",
    url: `/v1${path}`,
    payload: body as Record<string, unknown>,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
  });
}
async function create(path: string, body: unknown) {
  if (path === "/estoque/contagens") {
    const count = body as { posicao_id: string; versao_esperada?: number };
    if (count.versao_esperada === undefined)
      body = {
        ...count,
        versao_esperada: (await balance(count.posicao_id)).versao,
      };
  }
  const r = await post(path, body);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
async function stock(
  options: {
    factor?: string;
    cost?: string;
    tutor?: boolean;
    validity?: "conhecida" | "pendente" | "isenta";
    date?: string;
    container?: boolean;
  } = {},
) {
  const unit = await create("/estoque/unidades", {
    simbolo: randomUUID(),
    dimensao: "volume",
    fator_referencia: "1",
  });
  const product = await create("/estoque/produtos", {
    nome: "Produto Fictício",
    unidade_base_id: unit,
    finalidade: "Simulação DEV",
  });
  const presentation = await create("/estoque/apresentacoes", {
    produto_id: product,
    codigo: "FRASCO-FICTICIO",
    versao: 1,
    unidade_conteudo_id: unit,
    quantidade_conteudo: options.factor ?? "10",
    fator_unidade_base: options.factor ?? "10",
  });
  const validity = options.validity ?? "conhecida";
  const lot = await create("/estoque/lotes", {
    apresentacao_id: presentation,
    fabricante: "Fabricante Fictício",
    codigo: randomUUID(),
    situacao_validade: validity,
    ...(validity === "conhecida"
      ? { validade: options.date ?? "2099-12-31" }
      : {}),
    ...(options.cost === "pending"
      ? {}
      : { custo_base: options.cost ?? "1.25" }),
  });
  let patient: string | undefined;
  if (options.tutor)
    patient = await create("/pacientes", {
      nome: "Paciente Fictício Tutor",
      especie_codigo: "canina",
      estado_vital: "desconhecido",
    });
  let custody: string;
  if (patient)
    custody = await create("/estoque/custodias", {
      tipo: "tutor",
      paciente_id: patient,
    });
  else {
    const existing = await admin.query(
      "SELECT id FROM hvb.custodia WHERE organizacao_id=$1 AND tipo='hospital'",
      [f.org],
    );
    custody =
      existing.rows[0]?.id ??
      (await create("/estoque/custodias", { tipo: "hospital" }));
  }
  let container: string | undefined;
  if (options.container)
    container = await create("/estoque/recipientes", {
      lote_id: lot,
      identificacao: "Frasco Fictício Aberto",
      aberto_em: "2026-01-01T12:00:00Z",
      regra_informada: "Validade após abertura ainda pendente",
    });
  const local = await create("/locais", {
    nome: "Armário Fictício",
    unidade_id: f.unit,
    tipo: "armario",
    capacidade: 0,
  });
  const destination = await create("/locais", {
    nome: "Bandeja Fictícia",
    unidade_id: f.unit,
    tipo: "armario",
    capacidade: 0,
  });
  const common = {
    lote_id: lot,
    custodia_id: custody,
    ...(container ? { recipiente_id: container } : {}),
  };
  const origin = await create("/estoque/posicoes", {
    ...common,
    local_id: local,
  });
  const target = await create("/estoque/posicoes", {
    ...common,
    local_id: destination,
  });
  return {
    unit,
    product,
    presentation,
    lot,
    custody,
    container,
    origin,
    target,
    local,
    destination,
  };
}
async function entry(pos: string, q = "1", key = randomUUID()) {
  return post(
    "/estoque/entradas",
    { posicao_id: pos, quantidade_apresentacoes: q, ...movement },
    key,
  );
}
async function balance(id: string) {
  return (
    await admin.query(
      "SELECT saldo_base,reservado_base,disponivel_base,versao FROM hvb.posicao_estoque WHERE id=$1",
      [id],
    )
  ).rows[0];
}
before(async () => {
  const url = process.env.TEST_MIGRATION_DATABASE_URL ?? "";
  assert.equal(new URL(url).pathname, "/hvb_sistema_test");
  await migrate(url);
  f = await seedFixture(url);
  other = await seedFixture(url);
  db = pool(process.env.TEST_DATABASE_URL ?? "", 5);
  admin = pool(url, 2);
  app = await buildApp(db);
});
after(async () => {
  await app?.close();
  await db?.end();
  await admin?.end();
});
afterEach(async () => {
  const diff = await admin.query(
    `SELECT p.id FROM hvb.posicao_estoque p LEFT JOIN hvb.lancamento_estoque l ON (l.organizacao_id,l.posicao_id)=(p.organizacao_id,p.id)
    WHERE p.organizacao_id=$1 GROUP BY p.id HAVING p.saldo_base<>coalesce(sum(l.quantidade_assinada),0)`,
    [f.org],
  );
  assert.equal(
    diff.rowCount,
    0,
    "Saldo deve coincidir com razão de lançamentos após cada cenário.",
  );
  const reserved = await admin.query(
    `SELECT p.id FROM hvb.posicao_estoque p LEFT JOIN hvb.reserva r ON (r.organizacao_id,r.posicao_id)=(p.organizacao_id,p.id) AND r.situacao='ativa'
    WHERE p.organizacao_id=$1 GROUP BY p.id HAVING p.reservado_base<>coalesce(sum(r.quantidade_base),0)`,
    [f.org],
  );
  assert.equal(
    reserved.rowCount,
    0,
    "Contador reservado deve coincidir com reservas ativas.",
  );
});
test("apresentações são dimensionais, exatas, versionadas e imutáveis", async () => {
  const st = await stock();
  const mass = await create("/estoque/unidades", {
    simbolo: randomUUID(),
    dimensao: "massa",
    fator_referencia: "1",
  });
  const base = {
    produto_id: st.product,
    codigo: "FRASCO-FICTICIO",
    versao: 2,
    anterior_id: st.presentation,
    unidade_conteudo_id: st.unit,
    quantidade_conteudo: "20",
    fator_unidade_base: "20",
  };
  assert.equal(
    (
      await post("/estoque/apresentacoes", {
        ...base,
        unidade_conteudo_id: mass,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post("/estoque/apresentacoes", {
        ...base,
        fator_unidade_base: "19",
      })
    ).statusCode,
    409,
  );
  await create("/estoque/apresentacoes", base);
  await assert.rejects(
    () =>
      transaction(db, f.org, (tx) =>
        tx.query("UPDATE apresentacao SET fator_unidade_base=2 WHERE id=$1", [
          st.presentation,
        ]),
      ),
    { code: "42501" },
  );
  assert.equal((await entry(st.origin)).statusCode, 200);
  assert.equal(
    (await balance(st.origin)).saldo_base,
    "10.000000",
    "Lote continua na versão original.",
  );
});
test("frações decimais preservam precisão e rejeitam arredondamento silencioso", async () => {
  const st = await stock({ factor: "0.1" });
  assert.equal((await entry(st.origin, "0.1")).statusCode, 200);
  assert.equal((await balance(st.origin)).saldo_base, "0.010000");
  assert.equal((await entry(st.origin, "0.000001")).statusCode, 400);
  for (const q of ["-1", "NaN", "Infinity", "1e2", "0.1234567"])
    assert.equal((await entry(st.origin, q)).statusCode, 400);
  assert.equal((await entry(st.origin, "0")).statusCode, 400);
  assert.equal(
    (
      await post("/estoque/entradas", {
        posicao_id: st.origin,
        quantidade_apresentacoes: 0.1,
        ...movement,
      })
    ).statusCode,
    400,
  );
});
test("repetição concorrente de entrada e timeout simulado geram um único par", async () => {
  const st = await stock(),
    key = randomUUID();
  const responses = await Promise.all(
    Array.from({ length: 6 }, () => entry(st.origin, "1", key)),
  );
  for (const r of responses) assert.equal(r.statusCode, 200, r.body);
  assert.equal(new Set(responses.map((r) => r.json().id)).size, 1);
  const r = await entry(st.origin, "1", key);
  assert.equal(r.json().repetido, true);
  assert.equal((await balance(st.origin)).saldo_base, "10.000000");
  const lines = await admin.query(
    "SELECT count(*)::int AS n,sum(quantidade_assinada)::text AS total FROM hvb.lancamento_estoque WHERE transacao_id=$1",
    [r.json().id],
  );
  assert.equal(lines.rows[0].n, 2);
  assert.equal(lines.rows[0].total, "0.000000");
  assert.equal((await entry(st.origin, "2", key)).statusCode, 409);
});
test("duas retiradas concorrentes não excedem saldo e não registram consumo", async () => {
  const st = await stock();
  await entry(st.origin);
  const body = {
    origem_id: st.origin,
    destino_id: st.target,
    quantidade_base: "7",
    ...movement,
  };
  const races = await Promise.all([
    post("/estoque/retiradas", body),
    post("/estoque/retiradas", body),
  ]);
  assert.deepEqual(races.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal((await balance(st.origin)).saldo_base, "3.000000");
  assert.equal((await balance(st.target)).saldo_base, "7.000000");
  const absent = await admin.query(
    "SELECT (SELECT count(*)::int FROM hvb.consumo WHERE organizacao_id=$1) AS consumo,(SELECT count(*)::int FROM hvb.item_conta WHERE organizacao_id=$1) AS cobranca",
    [f.org],
  );
  assert.equal(absent.rows[0].consumo, 0);
  assert.equal(absent.rows[0].cobranca, 0);
});
test("transferências opostas usam ordem determinística e preservam total", async () => {
  const st = await stock();
  await entry(st.origin);
  await entry(st.target);
  const r = await Promise.all([
    post("/estoque/transferencias", {
      origem_id: st.origin,
      destino_id: st.target,
      quantidade_base: "3",
      ...movement,
    }),
    post("/estoque/transferencias", {
      origem_id: st.target,
      destino_id: st.origin,
      quantidade_base: "2",
      ...movement,
    }),
  ]);
  r.forEach((x) => {
    assert.equal(x.statusCode, 200, x.body);
  });
  assert.equal((await balance(st.origin)).saldo_base, "9.000000");
  assert.equal((await balance(st.target)).saldo_base, "11.000000");
});
test("reserva protege disponibilidade e efetivação transfere uma única vez", async () => {
  const st = await stock();
  await entry(st.origin);
  const reservation = await create("/estoque/reservas", {
    posicao_id: st.origin,
    quantidade_base: "8",
    expira_em: new Date(Date.now() + 600000).toISOString(),
    motivo: "Separação fictícia",
  });
  assert.equal((await balance(st.origin)).disponivel_base, "2.000000");
  assert.equal(
    (
      await post("/estoque/perdas", {
        posicao_id: st.origin,
        quantidade_base: "3",
        ...movement,
      })
    ).statusCode,
    409,
  );
  const r = await post(`/estoque/reservas/${reservation}/efetivar`, {
    destino_id: st.target,
    ...movement,
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await balance(st.origin)).reservado_base, "0.000000");
  assert.equal((await balance(st.target)).saldo_base, "8.000000");
  assert.notEqual(
    (
      await post(`/estoque/reservas/${reservation}/efetivar`, {
        destino_id: st.target,
        ...movement,
      })
    ).statusCode,
    200,
  );
});
test("reservas concorrentes, liberação e expiração não alteram saldo físico", async () => {
  const st = await stock();
  await entry(st.origin);
  const body = {
    posicao_id: st.origin,
    quantidade_base: "6",
    expira_em: new Date(Date.now() + 600000).toISOString(),
    motivo: "Reserva fictícia",
  };
  const races = await Promise.all([
    post("/estoque/reservas", body),
    post("/estoque/reservas", body),
  ]);
  assert.deepEqual(races.map((r) => r.statusCode).sort(), [200, 409]);
  const id = races.find((r) => r.statusCode === 200)?.json().id;
  assert.equal(
    (
      await post(`/estoque/reservas/${id}/expirar`, {
        motivo: "Ainda não expirada",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post(`/estoque/reservas/${id}/liberar`, {
        motivo: "Liberada explicitamente",
      })
    ).statusCode,
    200,
  );
  const exp = await create("/estoque/reservas", {
    ...body,
    expira_em: new Date(Date.now() + 400).toISOString(),
  });
  await setTimeout(450);
  assert.equal(
    (
      await post(`/estoque/reservas/${exp}/efetivar`, {
        destino_id: st.target,
        ...movement,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post(`/estoque/reservas/${exp}/expirar`, {
        motivo: "Expiração explícita",
      })
    ).statusCode,
    200,
  );
  assert.equal((await balance(st.origin)).saldo_base, "10.000000");
  assert.equal((await balance(st.origin)).reservado_base, "0.000000");
});
test("devolução parcial é vinculada, limitada e reversível antes da origem", async () => {
  const st = await stock();
  await entry(st.origin);
  const move = await create("/estoque/retiradas", {
    origem_id: st.origin,
    destino_id: st.target,
    quantidade_base: "8",
    ...movement,
  });
  const ret = await create(`/estoque/transacoes/${move}/devolver`, {
    quantidade_base: "3",
    ...movement,
  });
  assert.equal(
    (
      await post(`/estoque/transacoes/${move}/devolver`, {
        quantidade_base: "6",
        ...movement,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await post(`/estoque/transacoes/${move}/reverter`, movement)).statusCode,
    409,
  );
  assert.equal(
    (await post(`/estoque/transacoes/${ret}/reverter`, movement)).statusCode,
    200,
  );
  assert.equal(
    (await post(`/estoque/transacoes/${move}/reverter`, movement)).statusCode,
    200,
  );
  assert.equal((await balance(st.origin)).saldo_base, "10.000000");
  assert.equal((await balance(st.target)).saldo_base, "0.000000");
  assert.equal(
    (await post(`/estoque/transacoes/${move}/reverter`, movement)).statusCode,
    409,
  );
});
test("perda e reversão preservam razão; reversão de entrada não pode consumir reserva", async () => {
  const st = await stock();
  const inbound = await entry(st.origin);
  const loss = await create("/estoque/perdas", {
    posicao_id: st.origin,
    quantidade_base: "2.5",
    ...movement,
  });
  assert.equal((await balance(st.origin)).saldo_base, "7.500000");
  assert.equal(
    (await post(`/estoque/transacoes/${loss}/reverter`, movement)).statusCode,
    200,
  );
  const r = await create("/estoque/reservas", {
    posicao_id: st.origin,
    quantidade_base: "1",
    expira_em: new Date(Date.now() + 600000).toISOString(),
    motivo: "Fictício",
  });
  assert.equal(
    (await post(`/estoque/transacoes/${inbound.json().id}/reverter`, movement))
      .statusCode,
    409,
  );
  await post(`/estoque/reservas/${r}/liberar`, { motivo: "Fictício" });
  assert.equal(
    (await post(`/estoque/transacoes/${inbound.json().id}/reverter`, movement))
      .statusCode,
    200,
  );
});
test("custódia do tutor e custo desconhecido ficam explícitos sem custo hospitalar inventado", async () => {
  const tutor = await stock({ tutor: true });
  const unknown = await stock({ cost: "pending" });
  const a = await entry(tutor.origin),
    b = await entry(unknown.origin);
  for (const response of [a, b]) {
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(
      (
        await admin.query(
          "SELECT custo_base_snapshot FROM hvb.transacao_estoque WHERE id=$1",
          [response.json().id],
        )
      ).rows[0].custo_base_snapshot,
      null,
    );
  }
  const hospital = await stock();
  assert.equal(
    (
      await post("/estoque/transferencias", {
        origem_id: tutor.origin,
        destino_id: hospital.target,
        quantidade_base: "1",
        ...movement,
      })
    ).statusCode,
    409,
  );
});
test("validade pendente, vencida e recipiente aberto sem regra impedem retirada, preservando entrada", async () => {
  for (const options of [
    { validity: "pendente" as const },
    { date: "2020-01-01" },
    { container: true },
  ]) {
    const st = await stock(options);
    assert.equal((await entry(st.origin)).statusCode, 200);
    assert.equal(
      (
        await post("/estoque/retiradas", {
          origem_id: st.origin,
          destino_id: st.target,
          quantidade_base: "1",
          ...movement,
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await post("/estoque/transferencias", {
          origem_id: st.origin,
          destino_id: st.target,
          quantidade_base: "1",
          ...movement,
        })
      ).statusCode,
      200,
    );
  }
});
test("inventário aplica diferença vinculada e rejeita contagem após movimentação concorrente", async () => {
  const st = await stock();
  await entry(st.origin);
  const session = await create("/estoque/inventarios", {
    local_id: st.local,
    motivo: "Inventário fictício",
  });
  assert.equal(
    (
      await post("/estoque/contagens", {
        sessao_id: session,
        posicao_id: st.origin,
        quantidade_contada: "7",
        contada_em: time(),
        versao_esperada: 1,
      })
    ).statusCode,
    409,
  );
  const count = await create("/estoque/contagens", {
    sessao_id: session,
    posicao_id: st.origin,
    quantidade_contada: "7",
    contada_em: time(),
  });
  const adjustment = await post(
    `/estoque/contagens/${count}/aplicar`,
    movement,
  );
  assert.equal(adjustment.statusCode, 200, adjustment.body);
  assert.equal((await balance(st.origin)).saldo_base, "7.000000");
  assert.equal(
    (
      await post(`/estoque/inventarios/${session}/encerrar`, {
        motivo: "Concluído",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await post(
        `/estoque/transacoes/${adjustment.json().id}/reverter`,
        movement,
      )
    ).statusCode,
    200,
  );
  const s2 = await create("/estoque/inventarios", {
    local_id: st.local,
    motivo: "Concorrência fictícia",
  });
  const c2 = await create("/estoque/contagens", {
    sessao_id: s2,
    posicao_id: st.origin,
    quantidade_contada: "12",
    contada_em: time(),
  });
  await entry(st.origin);
  assert.equal(
    (await post(`/estoque/contagens/${c2}/aplicar`, movement)).statusCode,
    409,
  );
  assert.equal(
    (
      await post(`/estoque/inventarios/${s2}/encerrar`, {
        motivo: "Ainda pendente",
      })
    ).statusCode,
    409,
  );
});
test("inventário sem divergência não inventa movimento e ajuste não passa por cima de reserva", async () => {
  const st = await stock();
  await entry(st.origin);
  const session = await create("/estoque/inventarios", {
    local_id: st.local,
    motivo: "Conferência fictícia",
  });
  const count = await create("/estoque/contagens", {
    sessao_id: session,
    posicao_id: st.origin,
    quantidade_contada: "10",
    contada_em: time(),
  });
  assert.equal(
    (await post(`/estoque/contagens/${count}/aplicar`, movement)).statusCode,
    200,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT id FROM hvb.transacao_estoque WHERE contagem_id=$1",
        [count],
      )
    ).rowCount,
    0,
  );
  await create("/estoque/reservas", {
    posicao_id: st.origin,
    quantidade_base: "9",
    expira_em: new Date(Date.now() + 600000).toISOString(),
    motivo: "Fictício",
  });
  const s2 = await create("/estoque/inventarios", {
    local_id: st.local,
    motivo: "Contagem fictícia",
  });
  const c2 = await create("/estoque/contagens", {
    sessao_id: s2,
    posicao_id: st.origin,
    quantidade_contada: "8",
    contada_em: time(),
  });
  assert.equal(
    (await post(`/estoque/contagens/${c2}/aplicar`, movement)).statusCode,
    409,
  );
});
test("isolamento, permissões e proteção SQL impedem atalhos de saldo e livro incompleto", async () => {
  const st = await stock();
  const inbound = await entry(st.origin);
  assert.equal(
    (
      await post(
        "/estoque/perdas",
        { posicao_id: st.origin, quantidade_base: "1", ...movement },
        randomUUID(),
        f.readerToken,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await post(
        "/estoque/perdas",
        { posicao_id: st.origin, quantidade_base: "1", ...movement },
        randomUUID(),
        other.adminToken,
      )
    ).statusCode,
    404,
  );
  await assert.rejects(
    () =>
      transaction(db, f.org, (tx) =>
        tx.query("UPDATE posicao_estoque SET saldo_base=100 WHERE id=$1", [
          st.origin,
        ]),
      ),
    { code: "42501" },
  );
  await assert.rejects(
    () =>
      transaction(db, f.org, (tx) =>
        tx.query("UPDATE posicao_estoque SET versao=2 WHERE id=$1", [
          st.origin,
        ]),
      ),
    { code: "23514" },
  );
  await assert.rejects(
    () =>
      transaction(db, f.org, (tx) =>
        tx.query("DELETE FROM lancamento_estoque WHERE transacao_id=$1", [
          inbound.json().id,
        ]),
      ),
    { code: "42501" },
  );
  await assert.rejects(
    () =>
      transaction(db, f.org, async (tx) => {
        const id = randomUUID();
        await tx.query(
          `INSERT INTO transacao_estoque(id,organizacao_id,unidade_id,comando_id,tipo,origem_id,contrapartida,quantidade_base,custo_base_snapshot,raiz_id,ocorrido_em,autor_id,motivo)
    VALUES($1,$2,$3,$4,'perda',$5,'perda',1,1.25,$1,now(),$6,'Fictício sem par')`,
          [id, f.org, f.unit, inbound.json().comando_id, st.origin, f.admin],
        );
      }),
    { code: "23514" },
  );
  assert.equal((await balance(st.origin)).saldo_base, "10.000000");
});
test("consultas paginadas de estoque seguem OpenAPI e devolvem decimais como strings", async () => {
  for (const list of inventoryLists) {
    const r = await app.inject({
      url: `/v1${list.path}?limit=2${list.unit ? `&unidade_id=${f.unit}` : ""}`,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, `${list.path}: ${r.body}`);
    assert.ok(r.json().items.length <= 2);
    if (list.table === "posicao_estoque")
      assert.equal(typeof r.json().items[0].saldo_base, "string");
  }
});
