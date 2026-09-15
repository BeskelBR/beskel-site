import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { clinicalScenario, clinicalTime } from "./clinical-scenario.ts";
export async function financialScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
  supplied?: Awaited<ReturnType<typeof clinicalScenario>>,
  material: "pendente" | "nao_utilizado" = "nao_utilizado",
) {
  const clinical =
    supplied ?? (await clinicalScenario(app, token, unit, prefix));
  const common = {
    unidade_id: unit,
    simulacao: true,
    confirmacao_humana: true,
    motivo: "Simulação financeira fictícia M5",
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
        "idempotency-key": `${prefix}-${name}`,
      },
      payload: body,
    });
    if (r.statusCode !== 200) throw new Error(`${name}: ${r.body}`);
    return r.json().id as string;
  }
  const fin = (name: string, path: string, body: Record<string, unknown>) =>
    create(name, `/financeiro/${path}`, { ...common, ...body });
  const responsible = await create("responsavel", "/responsaveis", {
    nome: "Pagador Fictício M5",
  });
  const payer = await fin("pagador", "pagadores", {
    responsavel_id: responsible,
  });
  const catalog = await fin("catalogo", "catalogo", {
    codigo: prefix,
    versao: 1,
    descricao: "Serviço Fictício M5",
    tipo: "servico",
    unidade_medida_id: clinical.measure,
  });
  const price = await fin("preco", "precos", {
    item_comercial_id: catalog,
    versao: 1,
    inicio: "2026-09-01T00:00:00Z",
    fim: "2026-10-01T00:00:00Z",
    valor: "100.00",
  });
  const account = await fin("conta", "contas", {
    episodio_id: clinical.episode,
    descricao: "Conta Fictícia M5",
  });
  const hash = createHash("sha256").update(prefix).digest("hex");
  const reference = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const execution = await create("execucao", "/clinica/execucoes", {
    ordem_versao_id: clinical.version,
    evento_referencia: reference,
    executada_em: clinicalTime,
    quantidade_aplicada: "1",
    unidade_medida_id: clinical.measure,
    resultado: "integral",
    situacao_material: material,
    confirmacao_humana: true,
    motivo: "Execução fictícia para teste comercial",
  });
  const event = await fin("evento", "eventos", {
    item_comercial_id: catalog,
    execucao_id: execution,
    quantidade: "1",
  });
  const evaluation = await fin("avaliacao", "avaliacoes", {
    evento_id: event,
    versao_esperada: 0,
    preco_id: price,
    decisao: "cobravel",
    desconto: "0.00",
  });
  return {
    ...clinical,
    responsible,
    payer,
    catalog,
    price,
    account,
    execution,
    event,
    evaluation,
    common,
    fin,
  };
}
