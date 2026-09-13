import { before, after, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import {
  clinicalScenario,
  clinicalTime,
} from "../scripts/clinical-scenario.ts";
import { clinicalLists } from "../src/domain/clinical/service.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  other: typeof f;
type Scenario = Awaited<ReturnType<typeof clinicalScenario>>;
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
  const r = await post(path, body);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
const scenario = () => clinicalScenario(app, f.adminToken, f.unit);
const executionBody = (s: Scenario) => ({
  ordem_versao_id: s.version,
  programacao_id: s.schedule,
  evento_referencia: randomUUID(),
  executada_em: clinicalTime,
  quantidade_aplicada: "1",
  unidade_medida_id: s.measure,
  resultado: "integral",
  situacao_material: "pendente",
  confirmacao_humana: true,
  motivo: "Confirmação sintética DEV",
});
const consumptionBody = (s: Scenario, e?: string) => ({
  episodio_id: s.episode,
  ...(e ? { execucao_id: e } : {}),
  evento_referencia: randomUUID(),
  ocorrido_em: clinicalTime,
  finalidade: "Material fictício utilizado",
  motivo: "Conciliação sintética DEV",
  itens_confirmados: true,
  itens: [{ posicao_id: s.position, quantidade_base: "1" }],
});
async function balance(id: string) {
  return (
    await admin.query(
      "SELECT saldo_base::text FROM hvb.posicao_estoque WHERE id=$1",
      [id],
    )
  ).rows[0].saldo_base;
}
async function pendings(e: string) {
  return (
    await admin.query(
      "SELECT id,situacao FROM hvb.pendencia_clinica_consulta WHERE execucao_id=$1 ORDER BY criada_em,id",
      [e],
    )
  ).rows;
}
before(async () => {
  const url = process.env.TEST_MIGRATION_DATABASE_URL ?? "";
  await migrate(url);
  f = await seedFixture(url);
  other = await seedFixture(url);
  db = pool(process.env.TEST_DATABASE_URL ?? "", 5);
  admin = pool(url, 1);
  app = await buildApp(db);
});
after(async () => {
  await app?.close();
  await db?.end();
  await admin?.end();
});
afterEach(async () => {
  const r = await admin.query(
    `SELECT count(*)::int AS n FROM hvb.posicao_estoque p WHERE p.organizacao_id=$1 AND p.saldo_base<>coalesce((SELECT sum(l.quantidade_assinada) FROM hvb.lancamento_estoque l WHERE l.organizacao_id=p.organizacao_id AND l.posicao_id=p.id),0)`,
    [f.org],
  );
  assert.equal(r.rows[0].n, 0);
});

test("execução confirmada sem lote preserva saldo e abre pendência; confirmação não é inferida", async () => {
  const s = await scenario(),
    body = executionBody(s);
  for (const value of [false, "true", 1])
    assert.equal(
      (await post("/clinica/execucoes", { ...body, confirmacao_humana: value }))
        .statusCode,
      400,
    );
  const id = await create("/clinica/execucoes", body);
  assert.equal(await balance(s.position), "20.000000");
  const p = await pendings(id);
  assert.equal(p.length, 1);
  assert.equal(p[0].situacao, "aberta");
  assert.equal(
    (
      await post(`/clinica/pendencias/${p[0].id}/revisar`, {
        motivo: "Tentar encerrar sem material",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM hvb.consumo WHERE execucao_id=$1",
        [id],
      )
    ).rows[0].n,
    0,
  );
});
test("programação só conclui uma vez sob concorrência e evento real deduplica chaves diferentes", async () => {
  const s = await scenario(),
    body = executionBody(s),
    key = randomUUID();
  const r = await Promise.all(
    Array.from({ length: 6 }, () => post("/clinica/execucoes", body, key)),
  );
  assert.ok(r.every((x) => x.statusCode === 200));
  assert.equal(new Set(r.map((x) => x.json().id)).size, 1);
  assert.equal((await post("/clinica/execucoes", body)).statusCode, 409);
  assert.equal(
    (await post("/clinica/execucoes", executionBody(s))).statusCode,
    409,
  );
  const t = await scenario();
  const race = await Promise.all([
    post("/clinica/execucoes", executionBody(t)),
    post("/clinica/execucoes", executionBody(t)),
  ]);
  assert.deepEqual(race.map((x) => x.statusCode).sort(), [200, 409]);
});
test("parciais e conclusão ficam distintas; retificação preserva o original", async () => {
  const s = await scenario();
  const b = executionBody(s);
  await create("/clinica/execucoes", {
    ...b,
    resultado: "parcial",
    quantidade_aplicada: "0.25",
  });
  const e = await create("/clinica/execucoes", {
    ...executionBody(s),
    quantidade_aplicada: "0.75",
  });
  const {
    ordem_versao_id: _,
    programacao_id: __,
    ...correction
  } = executionBody(s);
  const fixed = await create(`/clinica/execucoes/${e}/retificar`, {
    ...correction,
    quantidade_aplicada: "0.5",
    motivo: "Retificação fictícia com histórico",
  });
  assert.equal(
    (
      await admin.query("SELECT correcao_de_id FROM hvb.execucao WHERE id=$1", [
        fixed,
      ])
    ).rows[0].correcao_de_id,
    e,
  );
  assert.equal((await pendings(e))[0].situacao, "resolvida");
  assert.equal((await pendings(fixed))[0].situacao, "aberta");
  assert.equal(
    (
      await post(`/clinica/execucoes/${e}/retificar`, {
        ...correction,
        evento_referencia: randomUUID(),
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post(`/clinica/programacoes/${s.schedule}/nao-executar`, {
        motivo: "Não apagar fato",
      })
    ).statusCode,
    409,
  );
});
test("ordem versionada exige versão esperada e mantém programação anterior para revisão", async () => {
  const s = await scenario();
  const body = {
    ...s.versionBody,
    versao_esperada: 1,
    quantidade_prescrita: "2",
    vigencia_inicio: "2026-09-01T11:00:00Z",
  };
  const r = await Promise.all([
    post(`/clinica/ordens/${s.order}/versoes`, body),
    post(`/clinica/ordens/${s.order}/versoes`, body),
  ]);
  assert.deepEqual(r.map((x) => x.statusCode).sort(), [200, 409]);
  assert.equal(
    (await post("/clinica/execucoes", executionBody(s))).statusCode,
    409,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM hvb.pendencia_clinica WHERE programacao_id=$1 AND tipo='revisao_programacao'",
        [s.schedule],
      )
    ).rows[0].n,
    1,
  );
  const early = await create("/clinica/execucoes", {
    ...executionBody(s),
    executada_em: "2026-09-01T10:30:00Z",
  });
  assert.ok(early);
  assert.equal(
    (
      await post(`/clinica/ordens/${s.order}/versoes`, {
        ...body,
        versao_esperada: 2,
        vigencia_inicio: "2026-09-01T10:15:00Z",
      })
    ).statusCode,
    409,
  );
});
test("sobreposição gera revisão e não exclui ordem; material previsto não cria execução nem consumo", async () => {
  const s = await scenario();
  await create("/clinica/ordens", {
    prescricao_id: s.prescription,
    ...s.versionBody,
  });
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM hvb.pendencia_clinica p JOIN hvb.ordem_versao v ON v.id=p.ordem_versao_id WHERE v.episodio_id=$1 AND p.tipo='ordem_sobreposta'",
        [s.episode],
      )
    ).rows[0].n,
    1,
  );
  await create("/clinica/materiais-previstos", {
    item_clinico_id: s.item,
    produto_id: s.product,
    versao: 1,
    quantidade_base: "2",
    criterio: "Associação fictícia aprovada",
    confirmacao_humana: true,
  });
  assert.equal(await balance(s.position), "20.000000");
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM hvb.execucao WHERE episodio_id=$1",
        [s.episode],
      )
    ).rows[0].n,
    0,
  );
});
test("consumo identificado baixa uma vez, preserva custódia do tutor e resolve a pendência", async () => {
  const s = await scenario(),
    e = await create("/clinica/execucoes", executionBody(s)),
    body = consumptionBody(s, e),
    key = randomUUID();
  const r = await Promise.all(
    Array.from({ length: 4 }, () => post("/clinica/consumos", body, key)),
  );
  assert.ok(
    r.every((x) => x.statusCode === 200),
    r.map((x) => x.body).join("\n"),
  );
  const id = r[0]?.json().id;
  assert.equal(await balance(s.position), "19.000000");
  assert.equal((await pendings(e))[0].situacao, "resolvida");
  const i = (
    await admin.query(
      "SELECT custo_total_snapshot FROM hvb.consumo_item WHERE consumo_id=$1",
      [id],
    )
  ).rows;
  assert.equal(i.length, 1);
  assert.equal(i[0].custo_total_snapshot, null);
  assert.equal(
    (await post("/clinica/consumos", consumptionBody(s, e))).statusCode,
    409,
  );
  assert.equal((await post("/clinica/consumos", body)).statusCode, 409);
});
test("falha em um item desfaz o lote inteiro sem apagar execução; decimais aninhados são exatos", async () => {
  const s = await scenario(),
    e = await create("/clinica/execucoes", executionBody(s));
  assert.equal(
    (
      await post("/clinica/consumos", {
        ...consumptionBody(s, e),
        itens: [{ posicao_id: s.position, quantidade_base: 1 }],
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await post("/clinica/consumos", {
        ...consumptionBody(s, e),
        itens: [
          { posicao_id: s.position, quantidade_base: "1" },
          { posicao_id: s.position, quantidade_base: "1" },
        ],
      })
    ).statusCode,
    400,
  );
  const local = await create("/locais", {
    nome: "Bandeja vazia fictícia",
    unidade_id: f.unit,
    tipo: "armario",
    capacidade: 0,
  });
  const empty = await create("/estoque/posicoes", {
    local_id: local,
    lote_id: s.lot,
    custodia_id: s.custody,
  });
  const r = await post("/clinica/consumos", {
    ...consumptionBody(s, e),
    itens: [
      { posicao_id: s.position, quantidade_base: "1" },
      { posicao_id: empty, quantidade_base: "1" },
    ],
  });
  assert.equal(r.statusCode, 409, r.body);
  assert.equal(await balance(s.position), "20.000000");
  assert.equal((await pendings(e))[0].situacao, "aberta");
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM hvb.consumo WHERE execucao_id=$1",
        [e],
      )
    ).rows[0].n,
    0,
  );
});
test("consumos concorrentes e reserva não excedem saldo disponível", async () => {
  const s = await scenario();
  await create("/estoque/reservas", {
    posicao_id: s.position,
    quantidade_base: "19",
    expira_em: new Date(Date.now() + 60000).toISOString(),
    motivo: "Reserva fictícia",
  });
  const r = await Promise.all([
    post("/clinica/consumos", consumptionBody(s)),
    post("/clinica/consumos", consumptionBody(s)),
  ]);
  assert.deepEqual(r.map((x) => x.statusCode).sort(), [200, 409]);
  assert.equal(await balance(s.position), "19.000000");
});
test("material de outro tutor, episódio ou unidade não pode ser alocado ao paciente", async () => {
  const s = await scenario(),
    t = await scenario();
  assert.equal(
    (
      await post("/clinica/consumos", {
        ...consumptionBody(s),
        itens: [{ posicao_id: t.position, quantidade_base: "1" }],
      })
    ).statusCode,
    409,
  );
  const foreign = await clinicalScenario(app, other.adminToken, other.unit);
  assert.equal(
    (
      await post("/clinica/consumos", {
        ...consumptionBody(s),
        itens: [{ posicao_id: foreign.position, quantidade_base: "1" }],
      })
    ).statusCode,
    404,
  );
  const ownOther = await clinicalScenario(app, f.adminToken, f.otherUnit);
  assert.equal(
    (
      await post("/clinica/consumos", {
        ...consumptionBody(s),
        itens: [{ posicao_id: ownOther.position, quantidade_base: "1" }],
      })
    ).statusCode,
    409,
  );
  assert.equal(await balance(t.position), "20.000000");
});
test("estorno agregado reabre pendência, compensa todos os itens e permite retificar", async () => {
  const s = await scenario(),
    e = await create("/clinica/execucoes", executionBody(s)),
    c = await create("/clinica/consumos", consumptionBody(s, e));
  const {
    ordem_versao_id: _,
    programacao_id: __,
    ...correction
  } = executionBody(s);
  assert.equal(
    (await post(`/clinica/execucoes/${e}/retificar`, correction)).statusCode,
    409,
  );
  const t = (
    await admin.query(
      "SELECT transacao_id FROM hvb.consumo_item WHERE consumo_id=$1",
      [c],
    )
  ).rows[0].transacao_id;
  assert.equal(
    (
      await post(`/estoque/transacoes/${t}/reverter`, {
        ocorrido_em: clinicalTime,
        motivo: "Atalho não permitido",
      })
    ).statusCode,
    409,
  );
  const key = randomUUID(),
    body = { ocorrido_em: clinicalTime, motivo: "Estorno fictício integral" };
  const r = await Promise.all([
    post(`/clinica/consumos/${c}/reverter`, body, key),
    post(`/clinica/consumos/${c}/reverter`, body, key),
  ]);
  assert.ok(
    r.every((x) => x.statusCode === 200),
    r.map((x) => x.body).join("\n"),
  );
  assert.equal(await balance(s.position), "20.000000");
  assert.equal(
    (await pendings(e)).filter((p) => p.situacao === "aberta").length,
    1,
  );
  assert.equal(
    (await post(`/clinica/consumos/${c}/reverter`, body)).statusCode,
    409,
  );
  const fixed = await create(`/clinica/execucoes/${e}/retificar`, correction);
  await create("/clinica/consumos", consumptionBody(s, fixed));
  assert.equal(await balance(s.position), "19.000000");
});
test("registro tardio compara horário ocorrido com alta; programação não executada não vira fato", async () => {
  const s = await scenario();
  await create(`/episodios/${s.episode}/alta`, {
    ocorrido_em: "2026-09-01T13:00:00Z",
    versao_esperada: 1,
    motivo: "Alta fictícia",
  });
  await create("/clinica/execucoes", executionBody(s));
  const t = await scenario();
  await create(`/clinica/programacoes/${t.schedule}/nao-executar`, {
    motivo: "Programação fictícia não realizada",
  });
  assert.equal(
    (await post("/clinica/execucoes", executionBody(t))).statusCode,
    409,
  );
  assert.equal(
    (
      await post("/clinica/execucoes", {
        ...executionBody(s),
        programacao_id: undefined,
        executada_em: "2026-09-01T14:00:00Z",
      })
    ).statusCode,
    409,
  );
});
test("permissões clínicas, contexto de unidade e SQL imutável não admitem atalhos", async () => {
  const s = await scenario();
  assert.equal(
    (
      await post(
        "/clinica/execucoes",
        executionBody(s),
        randomUUID(),
        f.readerToken,
      )
    ).statusCode,
    403,
  );
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) VALUES($1,$2,'clinica:executar') ON CONFLICT DO NOTHING",
    [f.org, f.nurseRole],
  );
  const otherUnit = await clinicalScenario(app, f.adminToken, f.otherUnit);
  assert.equal(
    (
      await post(
        "/clinica/execucoes",
        executionBody(otherUnit),
        randomUUID(),
        f.nurseToken,
      )
    ).statusCode,
    403,
  );
  const e = await create("/clinica/execucoes", executionBody(s));
  await assert.rejects(
    transaction(db, f.org, (tx) =>
      tx.query("UPDATE execucao SET quantidade_aplicada=5 WHERE id=$1", [e]),
    ),
    { code: "42501" },
  );
  await assert.rejects(
    transaction(admin, f.org, (tx) =>
      tx.query("UPDATE execucao SET quantidade_aplicada=5 WHERE id=$1", [e]),
    ),
    { code: "23514" },
  );
});
test("consumo em dois lotes preserva custo exato e estorno integral; validade e custo desconhecido ficam pendentes", async () => {
  const s = await scenario();
  const existing = await admin.query(
    "SELECT id FROM hvb.custodia WHERE organizacao_id=$1 AND tipo='hospital'",
    [f.org],
  );
  const custody =
    existing.rows[0]?.id ??
    (await create("/estoque/custodias", { tipo: "hospital" }));
  async function position(cost?: string) {
    const lot = await create("/estoque/lotes", {
      apresentacao_id: s.presentation,
      fabricante: "Fictício",
      codigo: randomUUID(),
      situacao_validade: "pendente",
      ...(cost ? { custo_base: cost } : {}),
    });
    const p = await create("/estoque/posicoes", {
      local_id: s.local,
      lote_id: lot,
      custodia_id: custody,
    });
    await create("/estoque/entradas", {
      posicao_id: p,
      quantidade_apresentacoes: "10",
      ocorrido_em: "2026-09-01T11:00:00Z",
      motivo: "Entrada fictícia hospitalar",
    });
    return p;
  }
  const p1 = await position("0.123456"),
    p2 = await position();
  const e = await create("/clinica/execucoes", executionBody(s));
  const c = await create("/clinica/consumos", {
    ...consumptionBody(s, e),
    itens: [
      { posicao_id: p1, quantidade_base: "0.123456" },
      { posicao_id: p2, quantidade_base: "1" },
    ],
  });
  const items = (
    await admin.query(
      "SELECT posicao_id,custo_total_snapshot FROM hvb.consumo_item WHERE consumo_id=$1",
      [c],
    )
  ).rows;
  assert.equal(items.length, 2);
  assert.equal(
    items.find((i) => i.posicao_id === p1).custo_total_snapshot,
    "0.015241383936",
  );
  assert.equal(
    items.find((i) => i.posicao_id === p2).custo_total_snapshot,
    null,
  );
  const pending = (
    await admin.query(
      "SELECT tipo FROM hvb.pendencia_clinica WHERE consumo_id=$1",
      [c],
    )
  ).rows
    .map((x) => x.tipo)
    .sort();
  assert.deepEqual(pending, ["custo_desconhecido", "validade_material"]);
  await create(`/clinica/consumos/${c}/reverter`, {
    ocorrido_em: clinicalTime,
    motivo: "Estorno de todos os lotes",
  });
  assert.equal(await balance(p1), "10.000000");
  assert.equal(await balance(p2), "10.000000");
});
test("retirada transfere e o consumo debita somente o destino identificado", async () => {
  const s = await scenario();
  const local = await create("/locais", {
    nome: "Destino fictício de preparo",
    unidade_id: f.unit,
    tipo: "armario",
    capacidade: 0,
  });
  const destination = await create("/estoque/posicoes", {
    local_id: local,
    lote_id: s.lot,
    custodia_id: s.custody,
  });
  await create("/estoque/retiradas", {
    origem_id: s.position,
    destino_id: destination,
    quantidade_base: "2",
    ocorrido_em: clinicalTime,
    motivo: "Retirada fictícia para preparo",
  });
  const e = await create("/clinica/execucoes", executionBody(s));
  assert.equal(await balance(s.position), "18.000000");
  assert.equal(await balance(destination), "2.000000");
  await create("/clinica/consumos", {
    ...consumptionBody(s, e),
    itens: [{ posicao_id: destination, quantidade_base: "1" }],
  });
  assert.equal(await balance(s.position), "18.000000");
  assert.equal(await balance(destination), "1.000000");
});
test("alta preserva programações futuras e fatos anteriores com pendência de revisão", async () => {
  const s = await scenario();
  await create("/clinica/programacoes", {
    ordem_versao_id: s.version,
    prevista_em: "2026-09-01T16:00:00Z",
  });
  await create("/clinica/execucoes", executionBody(s));
  await create(`/episodios/${s.episode}/alta`, {
    ocorrido_em: "2026-09-01T11:30:00Z",
    versao_esperada: 1,
    motivo: "Alta retroativa fictícia para revisão",
  });
  const ps = (
    await admin.query(
      "SELECT tipo FROM hvb.pendencia_clinica WHERE execucao_id IN(SELECT id FROM hvb.execucao WHERE episodio_id=$1) OR programacao_id IN(SELECT id FROM hvb.programacao WHERE episodio_id=$1)",
      [s.episode],
    )
  ).rows.map((x) => x.tipo);
  assert.ok(ps.includes("revisao_temporal"));
  assert.ok(ps.includes("revisao_programacao"));
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM hvb.execucao WHERE episodio_id=$1",
        [s.episode],
      )
    ).rows[0].n,
    1,
  );
});
test("SQL não pode adicionar lançamento usando comando já confirmado", async () => {
  const s = await scenario();
  const r = await post("/clinica/consumos", consumptionBody(s));
  assert.equal(r.statusCode, 200, r.body);
  const t = (
    await admin.query(
      "SELECT transacao_id FROM hvb.consumo_item WHERE consumo_id=$1",
      [r.json().id],
    )
  ).rows[0].transacao_id;
  await assert.rejects(
    transaction(db, f.org, (tx) =>
      tx.query(
        `INSERT INTO transacao_estoque(id,organizacao_id,unidade_id,comando_id,tipo,origem_id,contrapartida,quantidade_base,custo_base_snapshot,raiz_id,ocorrido_em,autor_id,motivo)
 SELECT $2,organizacao_id,unidade_id,comando_id,'consumo',origem_id,'consumido',1,custo_base_snapshot,$2,ocorrido_em,autor_id,'Tentativa fictícia' FROM transacao_estoque WHERE id=$1`,
        [t, randomUUID()],
      ),
    ),
    { code: "23514" },
  );
});
test("listas clínicas paginadas respeitam filtros e mapa exige período limitado", async () => {
  const s = await scenario();
  await create("/clinica/execucoes", executionBody(s));
  for (const list of clinicalLists) {
    const q = new URLSearchParams({ limit: "2" });
    if (list.unit) q.set("unidade_id", f.unit);
    if (list.table === "programacao_consulta") {
      q.set("inicio", "2026-09-01T00:00:00Z");
      q.set("fim", "2026-09-02T00:00:00Z");
    }
    if (list.columns.includes("episodio_id")) q.set("episodio_id", s.episode);
    const r = await app.inject({
      url: `/v1${list.path}?${q}`,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, `${list.path}: ${r.body}`);
    assert.ok(r.json().items.length <= 2);
    if (list.columns.includes("episodio_id"))
      assert.ok(
        r
          .json()
          .items.every(
            (i: { episodio_id: string }) => i.episodio_id === s.episode,
          ),
      );
  }
  const r = await app.inject({
    url: `/v1/clinica/programacoes?unidade_id=${f.unit}&inicio=2026-09-01T00:00:00Z&fim=2026-10-01T00:00:00Z`,
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(r.statusCode, 400);
});
