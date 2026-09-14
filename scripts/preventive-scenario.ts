import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { clinicalScenario } from "./clinical-scenario.ts";
export async function preventiveScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
) {
  const s = await clinicalScenario(app, token, unit, prefix);
  const common = {
    unidade_id: unit,
    simulacao: true,
    confirmacao_humana: true,
    motivo: "Cenário fictício M6B",
  };
  const headers = { authorization: `Bearer ${token}` };
  async function preventive(
    name: string,
    path: string,
    body: Record<string, unknown>,
  ) {
    const r = await app.inject({
      method: "POST",
      url: `/v1/protocolos/${path}`,
      payload: { ...common, ...body },
      headers: {
        ...headers,
        "idempotency-key": `${prefix}-preventivo-${name}`,
      },
    });
    if (r.statusCode !== 200) throw new Error(`${name}: ${r.body}`);
    return r.json().id as string;
  }
  const catalog = await preventive("catalogo", "catalogo", {
    codigo: prefix,
    nome: "Protocolo Fictício, sem orientação clínica",
  });
  const versionBody = {
    protocolo_id: catalog,
    versao: 1,
    descricao: "Somente simulação técnica",
    especie_codigo: "canina",
    etapas: [
      {
        codigo: "unica",
        item_clinico_id: s.item,
        ordem: 1,
        deslocamento_dias: 0,
        recorrencia: "unica",
        intervalo: 0,
        orientacao: "Etapa fictícia",
      },
      {
        codigo: "dias",
        item_clinico_id: s.item,
        ordem: 2,
        deslocamento_dias: 0,
        recorrencia: "dias",
        intervalo: 30,
        orientacao: "Intervalo fictício, não clínico",
      },
      {
        codigo: "meses",
        item_clinico_id: s.item,
        ordem: 3,
        deslocamento_dias: 0,
        recorrencia: "meses_calendario",
        intervalo: 1,
        orientacao: "Calendário fictício, não clínico",
      },
    ],
  };
  const version = await preventive("versao", "versoes", versionBody);
  await preventive("aprovacao", "aprovacoes", { protocolo_versao_id: version });
  const r = await app.inject({
    url: `/v1/protocolos/etapas?unidade_id=${unit}&protocolo_versao_id=${version}`,
    headers,
  });
  if (r.statusCode !== 200) throw new Error(r.body);
  const stages = Object.fromEntries(
    (r.json().items as { id: string; codigo: string }[]).map((x) => [
      x.codigo,
      x.id,
    ]),
  );
  const hash = createHash("sha256")
    .update(`preventivo:${prefix}`)
    .digest("hex");
  const reference = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const enrollment = await preventive("adesao", "adesoes", {
    paciente_id: s.patient,
    protocolo_versao_id: version,
    inicio_data: "2026-01-31",
    referencia: reference,
  });
  const occurrence = await preventive("ocorrencia", "ocorrencias", {
    protocolo_paciente_id: enrollment,
    etapa_id: stages.unica,
    sequencia: 1,
    prevista_data: "2026-01-31",
  });
  return {
    ...s,
    clinicalVersion: s.version,
    common,
    catalog,
    version,
    versionBody,
    stages,
    enrollment,
    occurrence,
    preventive,
  };
}
