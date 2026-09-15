import { randomUUID, createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { clinicalScenario } from "./clinical-scenario.ts";
export async function medicalScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
  supplied?: Awaited<ReturnType<typeof clinicalScenario>>,
) {
  const s = supplied ?? (await clinicalScenario(app, token, unit, prefix)),
    common = {
      unidade_id: unit,
      motivo: "Evolução fictícia DEV",
      simulacao: true,
      confirmacao_humana: true,
    };
  const h = createHash("sha256").update(`evolucao:${prefix}`).digest("hex"),
    reference = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  const body = {
    ...common,
    paciente_id: s.patient,
    episodio_id: s.episode,
    tipo: "evolucao",
    referencia: reference,
    ocorrida_em: "2026-09-01T12:00:00Z",
    conteudo:
      "Registro fictício para validar o prontuário. Não representa atendimento real.",
  };
  const r = await app.inject({
    method: "POST",
    url: "/v1/prontuario/evolucoes",
    headers: {
      authorization: `Bearer ${token}`,
      "idempotency-key": `${prefix}-evolucao`,
    },
    payload: body,
  });
  if (r.statusCode !== 200) throw new Error(r.body);
  return {
    ...s,
    common,
    body,
    evolution: r.json().id as string,
    evolutionVersion: r.json().evolucao_versao_id as string,
  };
}
