import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { clinicalScenario } from "./clinical-scenario.ts";
export async function scheduleScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
) {
  const s = await clinicalScenario(app, token, unit, prefix);
  const common = {
    unidade_id: unit,
    motivo: "Agenda fictícia DEV",
    simulacao: true,
    confirmacao_humana: true,
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
        "idempotency-key": `${prefix}-agenda-${name}`,
      },
      payload: body,
    });
    if (r.statusCode !== 200) throw new Error(`${name}: ${r.body}`);
    return r.json() as { id: string; agendamento_versao_id?: string };
  }
  const agenda = (name: string, path: string, body: Record<string, unknown>) =>
    create(name, `/agenda/${path}`, { ...common, ...body });
  const responsible = (
    await create("responsavel", "/responsaveis", {
      nome: "Responsável Fictício M6D",
    })
  ).id;
  const resource = (
    await agenda("recurso", "recursos", {
      nome: "Agenda institucional fictícia",
      tipo: "institucional",
    })
  ).id;
  const availability = (
    await agenda("disponibilidade", "disponibilidades", {
      recurso_id: resource,
      tipo: "disponivel",
      inicio: "2026-09-01T08:00:00Z",
      fim: "2026-09-01T18:00:00Z",
    })
  ).id;
  const h = createHash("sha256").update(`agenda:${prefix}`).digest("hex");
  const body = {
    paciente_id: s.patient,
    responsavel_id: responsible,
    tipo: "consulta",
    referencia: `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`,
    inicio: "2026-09-01T10:00:00Z",
    fim: "2026-09-01T11:00:00Z",
    observacao: "Planejamento fictício, sem atendimento comprovado",
    recursos: [resource],
  };
  const appointment = await agenda("agendamento", "agendamentos", body);
  return {
    ...s,
    common,
    responsible,
    resource,
    availability,
    body,
    appointment: appointment.id,
    appointmentVersion: appointment.agendamento_versao_id as string,
    agenda,
  };
}
