import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { documentScenario } from "./document-scenario.ts";
export async function portalScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
  audience = "responsavel",
) {
  const s = await documentScenario(app, token, unit, prefix, audience);
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
        "idempotency-key": `${prefix}-portal-${name}`,
      },
      payload: body,
    });
    if (r.statusCode !== 200) throw new Error(`${name}: ${r.body}`);
    return r.json().id as string;
  }
  const common = { ...s.common, motivo: "Portal fictício DEV" };
  const portal = (name: string, path: string, body: Record<string, unknown>) =>
    create(name, `/comunicacao/${path}`, { ...common, ...body });
  const relation = await create("vinculo", "/vinculos", {
    paciente_id: s.patient,
    responsavel_id: s.responsible,
    papel: "legal",
    inicio: "2026-09-01T00:00:00Z",
  });
  const account = await portal("conta", "contas", {
    responsavel_id: s.responsible,
  });
  const grant = await portal("concessao", "concessoes", {
    conta_portal_id: account,
    paciente_id: s.patient,
    vinculo_id: relation,
    valida_ate: "2099-12-31T23:59:59Z",
    evidencia: "Decisão explícita fictícia, poderes reais pendentes",
  });
  for (const purpose of ["aviso", "documento", "agenda"])
    await portal(`preferencia-${purpose}`, "preferencias", {
      conta_portal_id: account,
      finalidade: purpose,
      versao_esperada: 0,
      permitida: true,
      evidencia: "Preferência fictícia por finalidade",
    });
  const authorization = await s.doc("autorizacao", "autorizacoes", {
    solicitacao_id: s.request,
    decisao: "permitida",
    valida_ate: "2099-12-31T23:59:59Z",
    evidencia: "Autorização fictícia",
  });
  const document = await s.doc("versao", "versoes", {
    solicitacao_id: s.request,
    modelo_versao_id: s.modelVersion,
    versao_esperada: 0,
    campos: s.fields,
  });
  await s.doc("aprovacao", "aprovacoes", { documento_versao_id: document });
  const body = {
    concessao_id: grant,
    finalidade: "documento",
    canal: "portal_dev",
    origem: "registro_manual_dev",
    referencia: s.requestBody.protocolo,
    titulo: "Documento fictício disponível",
    texto: "Conteúdo somente para teste técnico",
    documentos: [document],
  };
  return {
    ...s,
    common,
    relation,
    account,
    grant,
    authorization,
    document,
    body,
    portal,
  };
}
