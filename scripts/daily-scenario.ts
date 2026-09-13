import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { clinicalScenario } from "./clinical-scenario.ts";
export async function dailyScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
  limit = "1",
) {
  const s = await clinicalScenario(app, token, unit, prefix, "internacao");
  async function create(name: string, path: string, body: unknown) {
    const r = await app.inject({
      method: "POST",
      url: `/v1${path}`,
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": `${prefix}-${name}`,
      },
      payload: body as Record<string, unknown>,
    });
    if (r.statusCode !== 200) throw new Error(`${name}: ${r.body}`);
    return r.json().id as string;
  }
  const classification = await create("classe", "/diarias/classificacoes", {
    codigo: `${prefix}-classe`,
    versao: 1,
    descricao: "Classe Fictícia M4, sem equivalência hospitalar presumida",
  });
  const assignment = await create(
    "classe-episodio",
    "/diarias/classificacoes-episodio",
    {
      episodio_id: s.episode,
      classificacao_versao_id: classification,
      inicio: "2026-09-01T09:00:00Z",
      suporte_ventilatorio: "nao_informado",
      motivo: "Classificação simulada, sem decisão clínica real",
    },
  );
  const pkg = await create("pacote", "/diarias/pacotes", {
    codigo: `${prefix}-pacote`,
    versao: 1,
    descricao: "Pacote Fictício M4 — somente simulação",
    classificacao_versao_id: classification,
    base_temporal: "periodo_explicito",
    limite_encerramento: "alta_clinica",
    politica_tolerancia: "sem_tolerancia",
    mudanca_classe: "exige_novo_periodo",
    simulacao: true,
  });
  const rule = await create("regra", "/diarias/regras", {
    pacote_versao_id: pkg,
    item_clinico_id: s.item,
    dimensao: "administracoes",
    janela: "periodo",
    prioridade: 10,
    tratamento: "incluido_limitado",
    limite_quantidade: limit,
    tratamento_excedente: "pendente",
  });
  await create("aprovacao", `/diarias/pacotes/${pkg}/aprovar-simulacao`, {
    simulacao: true,
    confirmacao_humana: true,
    motivo: "Simulação técnica; não aprova regra real do HVB",
  });
  const association = await create("associacao", "/diarias/pacotes-episodio", {
    episodio_id: s.episode,
    pacote_versao_id: pkg,
    inicio: "2026-09-01T08:00:00Z",
    fim: "2026-09-03T08:00:00Z",
    motivo: "Associação fictícia de demonstração",
    simulacao: true,
  });
  const period = await create("periodo", "/diarias/periodos", {
    pacote_episodio_id: association,
    classificacao_episodio_id: assignment,
    inicio: "2026-09-01T10:00:00Z",
    fim: "2026-09-01T18:00:00Z",
    motivo: "Intervalo fictício explícito, sem preço ou faturamento",
  });
  return { ...s, classification, assignment, pkg, rule, association, period };
}
