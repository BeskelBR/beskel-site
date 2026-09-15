import { randomUUID, createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { clinicalScenario } from "./clinical-scenario.ts";
export async function terminalScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
) {
  const s = await clinicalScenario(app, token, unit, prefix);
  const common = {
    unidade_id: unit,
    motivo: "Terminal fictício C5",
    simulacao: true,
    confirmacao_humana: true,
  };
  const ref = (name: string) => {
    const h = createHash("sha256").update(`${prefix}:${name}`).digest("hex");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };
  async function create(
    name: string,
    path: string,
    body: Record<string, unknown>,
    device?: string,
  ) {
    const r = await app.inject({
      method: "POST",
      url: `/v1${path}`,
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": `${prefix}-terminal-${name}`,
        ...(device ? { "x-device-id": device } : {}),
      },
      payload: body,
    });
    if (r.statusCode !== 200) throw new Error(`${name}: ${r.body}`);
    return r.json().id as string;
  }
  const device = await create("device", "/dispositivos", {
    nome: "Terminal fictício local",
    unidade_id: unit,
  });
  const local = await create("destino", "/locais", {
    nome: "Destino fictício C5",
    unidade_id: unit,
    tipo: "armario",
    capacidade: 0,
  });
  const destination = await create("posicao", "/estoque/posicoes", {
    local_id: local,
    lote_id: s.lot,
    custodia_id: s.custody,
  });
  const code = ref("etiqueta"),
    label = await create("etiqueta", "/terminal/etiquetas", {
      ...common,
      codigo: code,
      posicao_id: s.position,
    });
  const scanBody = {
    ...common,
    codigo: code,
    referencia: ref("leitura"),
    ocorrida_em: "2026-09-01T12:00:00Z",
    episodio_id: s.episode,
  };
  const scan = await create("leitura", "/terminal/leituras", scanBody, device);
  const withdrawalBody = {
    ...common,
    leitura_id: scan,
    origem_id: s.position,
    destino_id: destination,
    quantidade_base: "2",
    ocorrido_em: "2026-09-01T12:01:00Z",
  };
  return {
    ...s,
    common,
    device,
    destination,
    code,
    label,
    scan,
    scanBody,
    withdrawalBody,
    ref,
    create,
    prefix,
  };
}
