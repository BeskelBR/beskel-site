import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { dailyScenario } from "./daily-scenario.ts";
import { financialScenario } from "./financial-scenario.ts";
import { medicalScenario } from "./medical-scenario.ts";
import { portalScenario } from "./portal-scenario.ts";

// Composição sintética: reutiliza IDs; cada comando continua explícito e atômico.
export async function coreJourney(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
) {
  const d = await dailyScenario(app, token, unit, prefix);
  const f = await financialScenario(app, token, unit, prefix, d, "pendente");
  const reference = (name: string) => {
    const h = createHash("sha256").update(`${prefix}:${name}`).digest("hex");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };
  async function create(
    name: string,
    path: string,
    body: Record<string, unknown>,
  ) {
    const r = await app.inject({
      method: "POST",
      url: `/v1${path}`,
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": `${prefix}-jornada-${name}`,
      },
      payload: body,
    });
    if (r.statusCode !== 200) throw new Error(`${name}: ${r.body}`);
    return r.json().id as string;
  }
  let custody: string | undefined,
    cursor: string | null = null;
  do {
    const r: {
      statusCode: number;
      body: string;
      json(): {
        items: { tipo: string; id: string }[];
        next_cursor: string | null;
      };
    } = await app.inject({
      url: `/v1/estoque/custodias?limit=100${cursor ? `&cursor=${cursor}` : ""}`,
      headers: { authorization: `Bearer ${token}` },
    });
    if (r.statusCode !== 200) throw new Error(r.body);
    custody = r
      .json()
      .items.find(
        (x: { tipo: string; id: string }) => x.tipo === "hospital",
      )?.id;
    cursor = r.json().next_cursor;
  } while (!custody && cursor);
  custody ??= await create("custodia", "/estoque/custodias", {
    tipo: "hospital",
  });
  const position = await create("posicao", "/estoque/posicoes", {
    local_id: d.local,
    lote_id: d.lot,
    custodia_id: custody,
  });
  await create("entrada", "/estoque/entradas", {
    posicao_id: position,
    quantidade_apresentacoes: "10",
    ocorrido_em: "2026-09-01T11:00:00Z",
    motivo: "Entrada hospitalar fictícia C3",
  });
  const consumptionBody = {
    episodio_id: d.episode,
    execucao_id: f.execution,
    evento_referencia: reference("consumo"),
    ocorrido_em: "2026-09-01T12:00:00Z",
    finalidade: "Jornada sintética",
    motivo: "Consumo fictício C3",
    itens_confirmados: true,
    itens: [{ posicao_id: position, quantidade_base: "2" }],
  };
  const consumption = await create(
    "consumo",
    "/clinica/consumos",
    consumptionBody,
  );
  const coverageEvent = await create("evento", "/diarias/eventos", {
    execucao_id: f.execution,
    motivo: "Cobertura fictícia C3",
  });
  const coverage = await create(
    "cobertura",
    `/diarias/eventos/${coverageEvent}/avaliar`,
    {
      periodo_diaria_id: d.period,
      versao_esperada: 0,
      motivo: "Avaliação fictícia C3",
    },
  );
  const evaluation = await f.fin("avaliacao-coberta", "avaliacoes", {
    evento_id: f.event,
    versao_esperada: 1,
    preco_id: f.price,
    cobertura_id: coverage,
    decisao: "cobertura",
    desconto: "0.00",
  });
  const item = await f.fin("item-coberto", "itens", {
    conta_id: f.account,
    avaliacao_id: evaluation,
    responsabilidades: [],
  });
  const medical = await medicalScenario(app, token, unit, prefix, d);
  const portal = await portalScenario(
    app,
    token,
    unit,
    prefix,
    "responsavel",
    d,
  );
  const message = await portal.portal("mensagem", "mensagens", portal.body);
  return {
    daily: d,
    financial: f,
    medical,
    portal,
    position,
    consumption,
    consumptionBody,
    coverageEvent,
    coverage,
    evaluation,
    item,
    message,
    prefix,
  };
}
