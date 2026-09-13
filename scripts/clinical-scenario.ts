import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
export const clinicalTime = "2026-09-01T12:00:00.000Z";
export async function clinicalScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
) {
  async function create(name: string, path: string, body: unknown) {
    const r = await app.inject({
      method: "POST",
      url: `/v1${path}`,
      payload: body as Record<string, unknown>,
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": `${prefix}-${name}`,
      },
    });
    if (r.statusCode !== 200) throw new Error(`${name}: ${r.body}`);
    return r.json() as { id: string; ordem_versao_id?: string };
  }
  const patient = (
    await create("paciente", "/pacientes", {
      nome: "Paciente Fictício M3",
      especie_codigo: "canina",
      estado_vital: "desconhecido",
    })
  ).id;
  const episode = (
    await create("episodio", "/episodios", {
      paciente_id: patient,
      unidade_id: unit,
      tipo: "atendimento",
      admitido_em: "2026-09-01T08:00:00Z",
    })
  ).id;
  const measure = (
    await create("medida", "/estoque/unidades", {
      simbolo: `un-${prefix}`,
      dimensao: "contagem",
      fator_referencia: "1",
    })
  ).id;
  const item = (
    await create("item", "/clinica/itens", {
      nome: "Cuidado Fictício M3",
      tipo: "cuidado",
    })
  ).id;
  const prescription = (
    await create("prescricao", "/clinica/prescricoes", {
      episodio_id: episode,
      assinada_em: "2026-09-01T09:00:00Z",
      motivo: "Prescrição sintética DEV",
      confirmacao_humana: true,
    })
  ).id;
  const versionBody = {
    item_clinico_id: item,
    quantidade_prescrita: "1",
    unidade_medida_id: measure,
    via: "Via fictícia informada",
    orientacao: "Exemplo técnico sem orientação assistencial",
    vigencia_inicio: "2026-09-01T10:00:00Z",
    motivo: "Ordem fictícia DEV",
  };
  const order = await create("ordem", "/clinica/ordens", {
    prescricao_id: prescription,
    ...versionBody,
  });
  if (!order.ordem_versao_id) throw new Error("Versão ausente no contrato");
  const schedule = (
    await create("programacao", "/clinica/programacoes", {
      ordem_versao_id: order.ordem_versao_id,
      prevista_em: clinicalTime,
    })
  ).id;
  const product = (
    await create("produto", "/estoque/produtos", {
      nome: "Material Fictício M3",
      unidade_base_id: measure,
      finalidade: "Simulação de conciliação",
    })
  ).id;
  const presentation = (
    await create("apresentacao", "/estoque/apresentacoes", {
      produto_id: product,
      codigo: "UN-FICTICIA",
      versao: 1,
      unidade_conteudo_id: measure,
      quantidade_conteudo: "1",
      fator_unidade_base: "1",
    })
  ).id;
  const lot = (
    await create("lote", "/estoque/lotes", {
      apresentacao_id: presentation,
      fabricante: "Fabricante Fictício",
      codigo: prefix,
      situacao_validade: "conhecida",
      validade: "2099-12-31",
      custo_base: "1.25",
    })
  ).id;
  const custody = (
    await create("custodia", "/estoque/custodias", {
      tipo: "tutor",
      paciente_id: patient,
      episodio_id: episode,
    })
  ).id;
  const local = (
    await create("local", "/locais", {
      nome: "Bandeja Fictícia M3",
      unidade_id: unit,
      tipo: "armario",
      capacidade: 0,
    })
  ).id;
  const position = (
    await create("posicao", "/estoque/posicoes", {
      local_id: local,
      lote_id: lot,
      custodia_id: custody,
    })
  ).id;
  await create("entrada", "/estoque/entradas", {
    posicao_id: position,
    quantidade_apresentacoes: "20",
    ocorrido_em: "2026-09-01T11:00:00Z",
    motivo: "Entrada fictícia M3",
  });
  return {
    patient,
    episode,
    measure,
    item,
    prescription,
    order: order.id,
    version: order.ordem_versao_id,
    versionBody,
    schedule,
    product,
    presentation,
    lot,
    custody,
    local,
    position,
  };
}
