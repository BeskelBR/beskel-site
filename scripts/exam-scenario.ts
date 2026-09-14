import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { clinicalScenario } from "./clinical-scenario.ts";
export async function examScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
  requiresSample = false,
) {
  const s = await clinicalScenario(app, token, unit, prefix);
  const common = {
    unidade_id: unit,
    simulacao: true,
    confirmacao_humana: true,
    motivo: "Cenário fictício de exames M6A",
  };
  const headers = { authorization: `Bearer ${token}` };
  async function create(
    name: string,
    path: string,
    body: Record<string, unknown>,
  ) {
    const r = await app.inject({
      method: "POST",
      url: `/v1${path}`,
      headers: { ...headers, "idempotency-key": `${prefix}-${name}` },
      payload: body,
    });
    if (r.statusCode !== 200) throw new Error(`${name}: ${r.body}`);
    return r.json().id as string;
  }
  const exam = (name: string, path: string, body: Record<string, unknown>) =>
    create(name, `/exames/${path}`, { ...common, ...body });
  const clinicalItem = await create("exame-item-clinico", "/clinica/itens", {
    nome: "Exame Fictício M6A",
    tipo: "procedimento",
  });
  const lab = await exam("laboratorio", "laboratorios", {
    nome: "Laboratório Fictício M6A",
    origem: "externo",
    identificacao: "Simulação, sem integração",
  });
  const catalog = await exam("exame-catalogo", "catalogo", {
    item_clinico_id: clinicalItem,
    codigo: prefix,
  });
  const versionBody = {
    exame_id: catalog,
    versao: 1,
    descricao: "Estrutura Fictícia M6A",
    laboratorio_id: lab,
    metodo: "Método fictício sem aplicação clínica",
    exige_coleta: requiresSample,
    material: "material-ficticio",
    atributos: [
      {
        codigo: "numero",
        descricao: "Número fictício",
        tipo: "numero",
        unidade: "u-ficticia",
        obrigatorio: true,
        ordem: 1,
      },
      {
        codigo: "booleano",
        descricao: "Indicador fictício",
        tipo: "booleano",
        unidade: "nao_aplicavel",
        obrigatorio: true,
        ordem: 2,
      },
      {
        codigo: "texto",
        descricao: "Texto fictício",
        tipo: "texto",
        unidade: "nao_aplicavel",
        obrigatorio: false,
        ordem: 3,
      },
    ],
  };
  const examVersion = await exam("exame-versao", "versoes", versionBody);
  await exam("exame-aprovacao", "aprovacoes", { exame_versao_id: examVersion });
  const attributes = await app.inject({
    url: `/v1/exames/atributos?unidade_id=${unit}&exame_versao_id=${examVersion}`,
    headers,
  });
  if (attributes.statusCode !== 200) throw new Error(attributes.body);
  const attrs = Object.fromEntries(
    (attributes.json().items as { id: string; codigo: string }[]).map((a) => [
      a.codigo,
      a.id,
    ]),
  );
  const hash = createHash("sha256").update(`exames:${prefix}`).digest("hex"),
    reference = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const request = await exam("exame-solicitacao", "solicitacoes", {
    episodio_id: s.episode,
    solicitada_em: "2026-09-01T10:00:00Z",
    indicacao: "Somente teste fictício",
    referencia: reference,
    itens: [{ exame_versao_id: examVersion }],
  });
  const items = await app.inject({
    url: `/v1/exames/itens?unidade_id=${unit}&solicitacao_id=${request}`,
    headers,
  });
  if (items.statusCode !== 200) throw new Error(items.body);
  const examItem = items.json().items[0]?.id as string;
  if (!examItem) throw new Error("Item de exame ausente");
  const values = [
    {
      atributo_id: attrs.numero,
      situacao: "informado",
      texto_original: "-1,12345678 — fictício",
      numero: "-1.12345678",
      qualificador: "igual",
      referencia_status: "pendente",
      observacao: "Referência fictícia não informada",
    },
    {
      atributo_id: attrs.booleano,
      situacao: "informado",
      texto_original: "Falso — fictício",
      booleano: false,
      qualificador: "nao_aplicavel",
      referencia_status: "nao_aplicavel",
      observacao: "Dado fictício",
    },
    {
      atributo_id: attrs.texto,
      situacao: "informado",
      texto_original: "Texto livre fictício preservado",
      qualificador: "nao_aplicavel",
      referencia_status: "nao_aplicavel",
      observacao: "Dado fictício",
    },
  ];
  return {
    ...s,
    clinicalItem,
    lab,
    catalog,
    examVersion,
    versionBody,
    attrs,
    request,
    examItem,
    values,
    common,
    exam,
  };
}
