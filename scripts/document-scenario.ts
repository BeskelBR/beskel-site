import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { clinicalScenario } from "./clinical-scenario.ts";
export async function documentScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
  audience = "responsavel",
) {
  const s = await clinicalScenario(app, token, unit, prefix),
    common = {
      unidade_id: unit,
      simulacao: true,
      confirmacao_humana: true,
      motivo: "Cenário documental fictício",
    },
    headers = { authorization: `Bearer ${token}` };
  async function create(
    name: string,
    path: string,
    body: Record<string, unknown>,
  ) {
    const r = await app.inject({
      method: "POST",
      url: `/v1${path}`,
      headers: { ...headers, "idempotency-key": `${prefix}-documento-${name}` },
      payload: body,
    });
    if (r.statusCode !== 200) throw new Error(`${name}: ${r.body}`);
    return r.json().id as string;
  }
  const doc = (name: string, path: string, body: Record<string, unknown>) =>
    create(name, `/documentos/${path}`, { ...common, ...body });
  const responsible = await create("responsavel", "/responsaveis", {
    nome: "Responsável Fictício M6C",
  });
  const model = await doc("modelo", "modelos", {
    codigo: prefix,
    nome: "Modelo Fictício DEV",
    tipo: "declaracao",
  });
  const modelBody = {
    modelo_id: model,
    versao: 1,
    titulo: "Documento Fictício — sem validade assistencial",
    texto_base:
      "Paciente: {{paciente}}\nRegistro: {{registro}}\nObservação: {{observacao}}",
    publico: audience,
    campos: [
      { codigo: "paciente", obrigatorio: true },
      { codigo: "registro", obrigatorio: true },
      { codigo: "observacao", obrigatorio: false },
    ],
  };
  const modelVersion = await doc("modelo-versao", "modelos-versoes", modelBody);
  await doc("modelo-aprovacao", "modelos-aprovacoes", {
    modelo_versao_id: modelVersion,
  });
  const hash = createHash("sha256")
      .update(`documentos:${prefix}`)
      .digest("hex"),
    reference = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const requestBody = {
    paciente_id: s.patient,
    episodio_id: s.episode,
    modelo_id: model,
    solicitante_responsavel_id: responsible,
    escopo: "Declaração fictícia para desenvolvimento",
    protocolo: reference,
    recebida_em: "2026-09-01T12:00:00Z",
    prazo_em: "2026-10-01T12:00:00Z",
    evidencia_autorizacao:
      "Solicitação fictícia; autorização de acesso é decisão separada",
  };
  const request = await doc("solicitacao", "solicitacoes", requestBody);
  const fields = {
    paciente: "Paciente Fictício",
    registro: "Somente teste técnico",
    observacao: "",
  };
  return {
    ...s,
    common,
    responsible,
    model,
    modelBody,
    modelVersion,
    request,
    requestBody,
    fields,
    doc,
  };
}
