import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
async function insert(
  tx: PoolClient,
  a: Actor,
  b: Body,
  cmd: string,
  table: string,
  fields: string[],
  extra: Body = {},
) {
  const id =
    table === "aplicacao_preventiva" && b.origem === "interna"
      ? (b.execucao_id as string)
      : randomUUID();
  const record = {
    id,
    organizacao_id: a.organizacao_id,
    unidade_id: b.unidade_id,
    autor_id: a.usuario_id,
    comando_id: cmd,
    motivo: b.motivo,
    ...Object.fromEntries(fields.map((f) => [f, b[f] ?? null])),
    ...extra,
  };
  const keys = Object.keys(record);
  await tx.query(
    `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(record),
  );
  return id;
}
const scope: Action["scope"] = async (_t, _a, b) => b.unidade_id as string;
const definitions: [string, string, string, string, string[]][] = [
  [
    "catalogo",
    "preventiveCatalog",
    "protocolo_catalogo",
    "configurar",
    ["codigo", "nome"],
  ],
  [
    "aprovacoes",
    "preventiveApprove",
    "aprovacao_protocolo",
    "aprovar_simulacao",
    ["protocolo_versao_id"],
  ],
  [
    "adesoes",
    "preventiveEnroll",
    "protocolo_paciente",
    "aderir",
    ["paciente_id", "protocolo_versao_id", "inicio_data", "referencia"],
  ],
  [
    "encerramentos",
    "preventiveEnd",
    "encerramento_protocolo",
    "encerrar",
    ["protocolo_paciente_id", "sucessor_id", "encerrado_em"],
  ],
  [
    "ocorrencias",
    "preventiveOccurrence",
    "ocorrencia_preventiva",
    "programar",
    ["protocolo_paciente_id", "etapa_id", "sequencia", "prevista_data"],
  ],
  [
    "aplicacoes",
    "preventiveApplication",
    "aplicacao_preventiva",
    "registrar_aplicacao",
    [
      "ocorrencia_id",
      "origem",
      "execucao_id",
      "profissional_informado",
      "ocorrida_em",
      "referencia",
      "lote_declarado",
      "fabricante_declarado",
      "evidencia",
      "correcao_de_id",
    ],
  ],
  [
    "consumos",
    "preventiveConsumption",
    "vinculo_consumo_preventivo",
    "conciliar",
    ["aplicacao_id", "consumo_item_id"],
  ],
  [
    "revisoes",
    "preventiveReview",
    "revisao_preventiva",
    "revisar",
    ["ocorrencia_id", "observada_em", "descricao"],
  ],
  [
    "resolucoes",
    "preventiveResolution",
    "resolucao_revisao_preventiva",
    "revisar",
    ["revisao_id", "orientacao"],
  ],
];
export const preventiveActions: Action[] = definitions.map(
  ([path, input, table, permission, fields]) => ({
    path: `/protocolos/${path}`,
    input,
    permission: `protocolos:${permission}`,
    scope,
    async run(tx, a, b, _id, cmd) {
      return { id: await insert(tx, a, b, cmd, table, fields) };
    },
  }),
);
preventiveActions.push({
  path: "/protocolos/versoes",
  input: "preventiveVersion",
  permission: "protocolos:configurar",
  scope,
  async run(tx, a, b, _id, cmd) {
    const id = await insert(tx, a, b, cmd, "protocolo_versao", [
      "protocolo_id",
      "versao",
      "descricao",
      "especie_codigo",
    ]);
    for (const stage of b.etapas as Body[])
      await insert(
        tx,
        a,
        { ...b, ...stage },
        cmd,
        "etapa_protocolo",
        [
          "codigo",
          "item_clinico_id",
          "ordem",
          "deslocamento_dias",
          "recorrencia",
          "intervalo",
          "orientacao",
        ],
        { protocolo_versao_id: id },
      );
    return { id };
  },
});
const metadata = "autor_id,motivo,criada_em";
const lists: [string, string, string][] = [
  ["catalogo", "protocolo_catalogo", "codigo,nome"],
  [
    "versoes",
    "protocolo_versao",
    "protocolo_id,versao,descricao,especie_codigo",
  ],
  [
    "etapas",
    "etapa_protocolo",
    "protocolo_versao_id,codigo,item_clinico_id,ordem,deslocamento_dias,recorrencia,intervalo,orientacao",
  ],
  ["aprovacoes", "aprovacao_protocolo", "protocolo_versao_id"],
  [
    "adesoes",
    "protocolo_paciente",
    "paciente_id,protocolo_versao_id,inicio_data,referencia",
  ],
  [
    "encerramentos",
    "encerramento_protocolo",
    "protocolo_paciente_id,sucessor_id,encerrado_em",
  ],
  [
    "ocorrencias",
    "ocorrencia_preventiva_consulta",
    "protocolo_paciente_id,etapa_id,sequencia,prevista_data,paciente_id,item_clinico_id,situacao",
  ],
  [
    "aplicacoes",
    "aplicacao_preventiva_consulta",
    "ocorrencia_id,origem,execucao_id,profissional_informado,ocorrida_em,referencia,lote_declarado,fabricante_declarado,evidencia,correcao_de_id,paciente_id,protocolo_paciente_id,ativa,material_revisao",
  ],
  [
    "consumos",
    "consumo_preventivo_consulta",
    "aplicacao_id,consumo_item_id,consumo_id,posicao_id,lote_id,quantidade_base,lote_fisico_codigo,fabricante_fisico,estornado",
  ],
  [
    "revisoes",
    "revisao_preventiva_consulta",
    "ocorrencia_id,observada_em,descricao,paciente_id,protocolo_paciente_id,situacao_ocorrencia,situacao",
  ],
  ["resolucoes", "resolucao_revisao_preventiva", "revisao_id,orientacao"],
];
export const preventiveLists = lists.map(([path, table, columns]) => ({
  path: `/protocolos/${path}`,
  table,
  columns: `id,unidade_id,${columns},${metadata}`,
  unit: true,
  permission: "protocolos:ler",
}));
