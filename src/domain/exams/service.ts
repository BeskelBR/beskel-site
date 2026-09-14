import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
const unit: Action["scope"] = async (_t, _a, b) => b.unidade_id as string;
async function insert(
  tx: PoolClient,
  a: Actor,
  b: Body,
  cmd: string,
  table: string,
  data: Body,
) {
  const id = randomUUID(),
    record = {
      id,
      organizacao_id: a.organizacao_id,
      unidade_id: b.unidade_id,
      autor_id: a.usuario_id,
      comando_id: cmd,
      motivo: b.motivo,
      ...data,
    },
    keys = Object.keys(record);
  await tx.query(
    `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(record),
  );
  return id;
}
function select(b: Body, fields: string[]) {
  return Object.fromEntries(fields.map((f) => [f, b[f] ?? null]));
}
function simple(
  path: string,
  input: string,
  table: string,
  permission: string,
  fields: string[],
): Action {
  return {
    path: `/exames/${path}`,
    input,
    scope: unit,
    permission: `exames:${permission}`,
    async run(tx, a, b, _id, cmd) {
      return { id: await insert(tx, a, b, cmd, table, select(b, fields)) };
    },
  };
}
export const examActions: Action[] = [
  simple("laboratorios", "examLab", "laboratorio_exame", "configurar", [
    "nome",
    "origem",
    "identificacao",
  ]),
  simple("catalogo", "examCatalog", "exame_catalogo", "configurar", [
    "item_clinico_id",
    "codigo",
  ]),
  simple(
    "aprovacoes",
    "examApprove",
    "aprovacao_exame_versao",
    "aprovar_simulacao",
    ["exame_versao_id"],
  ),
  simple(
    "referencias",
    "examReference",
    "referencia_analito_versao",
    "configurar",
    [
      "atributo_id",
      "versao",
      "codigo",
      "especie_codigo",
      "idade_min_dias",
      "idade_max_dias",
      "inclui_idade_min",
      "inclui_idade_max",
      "limite_inferior",
      "limite_superior",
      "inclui_inferior",
      "inclui_superior",
      "descricao",
    ],
  ),
  simple("cancelamentos", "examCancel", "cancelamento_item_exame", "cancelar", [
    "item_exame_id",
  ]),
  simple("coletas", "examSample", "coleta_exame", "coletar", [
    "item_exame_id",
    "referencia",
    "coletada_em",
    "material",
    "origem",
    "execucao_id",
    "coletor_informado",
    "evidencia",
  ]),
  simple(
    "amostras-decisoes",
    "examSampleDecision",
    "decisao_amostra",
    "avaliar_amostra",
    ["coleta_id", "situacao", "avaliada_em"],
  ),
  {
    path: "/exames/versoes",
    input: "examVersion",
    scope: unit,
    permission: "exames:configurar",
    async run(tx, a, b, _id, cmd) {
      const id = await insert(
        tx,
        a,
        b,
        cmd,
        "exame_versao",
        select(b, [
          "exame_id",
          "versao",
          "descricao",
          "laboratorio_id",
          "metodo",
          "exige_coleta",
          "material",
        ]),
      );
      for (const attr of b.atributos as Body[])
        await insert(tx, a, b, cmd, "atributo_exame_versao", {
          exame_versao_id: id,
          ...select(attr, [
            "codigo",
            "descricao",
            "tipo",
            "unidade",
            "obrigatorio",
            "ordem",
          ]),
        });
      return { id };
    },
  },
  {
    path: "/exames/solicitacoes",
    input: "examRequest",
    scope: unit,
    permission: "exames:solicitar",
    async run(tx, a, b, _id, cmd) {
      const id = await insert(
        tx,
        a,
        b,
        cmd,
        "solicitacao_exame",
        select(b, ["episodio_id", "solicitada_em", "indicacao", "referencia"]),
      );
      for (const item of b.itens as Body[])
        await insert(tx, a, b, cmd, "item_exame", {
          solicitacao_id: id,
          exame_versao_id: item.exame_versao_id,
        });
      return { id };
    },
  },
  {
    path: "/exames/resultados",
    input: "examResult",
    scope: unit,
    permission: "exames:registrar_resultado",
    async run(tx, a, b, _id, cmd) {
      await one(
        tx,
        "SELECT id FROM item_exame WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [a.organizacao_id, b.unidade_id, b.item_exame_id],
      );
      await tx.query("SELECT travar_item_exame($1,$2)", [
        a.organizacao_id,
        b.item_exame_id,
      ]);
      const last = (
        await tx.query(
          "SELECT id,versao FROM resultado_versao WHERE organizacao_id=$1 AND item_exame_id=$2 ORDER BY versao DESC LIMIT 1",
          [a.organizacao_id, b.item_exame_id],
        )
      ).rows[0];
      if ((last?.versao ?? 0) !== b.versao_esperada)
        throw new DomainError(409, "resultado_alterado_recarregue");
      const version = (last?.versao ?? 0) + 1,
        id = await insert(tx, a, b, cmd, "resultado_versao", {
          ...select(b, [
            "item_exame_id",
            "coleta_id",
            "produzido_em",
            "referencia",
            "idade_dias",
            "origem_idade",
            "observacao",
          ]),
          versao: version,
          anterior_id: last?.id ?? null,
        });
      for (const value of b.valores as Body[])
        await insert(tx, a, b, cmd, "valor_resultado", {
          resultado_id: id,
          ...select(value, [
            "atributo_id",
            "situacao",
            "texto_original",
            "numero",
            "booleano",
            "qualificador",
            "referencia_id",
            "referencia_status",
            "observacao",
          ]),
        });
      return { id, versao: version };
    },
  },
  {
    path: "/exames/liberacoes",
    input: "examRelease",
    scope: unit,
    permission: "exames:liberar",
    async run(tx, a, b, _id, cmd) {
      const r = await one(
        tx,
        "SELECT item_exame_id FROM resultado_versao WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [a.organizacao_id, b.unidade_id, b.resultado_id],
      );
      await tx.query("SELECT travar_item_exame($1,$2)", [
        a.organizacao_id,
        r.item_exame_id,
      ]);
      const hash = await one(tx, "SELECT hash_resultado($1,$2) AS hash", [
        a.organizacao_id,
        b.resultado_id,
      ]);
      return {
        id: await insert(tx, a, b, cmd, "liberacao_resultado", {
          resultado_id: b.resultado_id,
          hash_conteudo: hash.hash,
          pendencias_confirmadas: b.pendencias_confirmadas,
        }),
      };
    },
  },
];
export const examLists = [
  {
    path: "/exames/laboratorios",
    table: "laboratorio_exame",
    columns:
      "id,unidade_id,nome,origem,identificacao,autor_id,motivo,criada_em",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/catalogo",
    table: "exame_catalogo",
    columns: "id,unidade_id,item_clinico_id,codigo,autor_id,motivo,criada_em",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/versoes",
    table: "exame_versao",
    columns:
      "id,unidade_id,exame_id,versao,descricao,laboratorio_id,metodo,exige_coleta,material,autor_id,motivo,criada_em",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/atributos",
    table: "atributo_exame_versao",
    columns:
      "id,unidade_id,exame_versao_id,codigo,descricao,tipo,unidade,obrigatorio,ordem,autor_id,motivo,criada_em",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/aprovacoes",
    table: "aprovacao_exame_versao",
    columns: "id,unidade_id,exame_versao_id,autor_id,motivo,criada_em",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/referencias",
    table: "referencia_analito_versao",
    columns:
      "id,unidade_id,atributo_id,versao,codigo,especie_codigo,idade_min_dias,idade_max_dias,inclui_idade_min,inclui_idade_max,limite_inferior,limite_superior,inclui_inferior,inclui_superior,descricao,autor_id,motivo,criada_em",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/solicitacoes",
    table: "solicitacao_exame",
    columns:
      "id,unidade_id,episodio_id,solicitada_em,indicacao,referencia,autor_id,motivo,criada_em",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/itens",
    table: "item_exame",
    columns:
      "id,unidade_id,solicitacao_id,exame_versao_id,autor_id,motivo,criada_em",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/cancelamentos",
    table: "cancelamento_item_exame",
    columns: "id,unidade_id,item_exame_id,autor_id,motivo,criada_em",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/coletas",
    table: "coleta_exame_consulta",
    columns:
      "id,unidade_id,item_exame_id,referencia,coletada_em,material,origem,execucao_id,coletor_informado,evidencia,autor_id,motivo,criada_em,situacao_amostra,origem_ativa",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/amostras-decisoes",
    table: "decisao_amostra",
    columns:
      "id,unidade_id,coleta_id,situacao,avaliada_em,autor_id,motivo,criada_em",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/resultados",
    table: "resultado_exame_consulta",
    columns:
      "id,unidade_id,item_exame_id,versao,anterior_id,coleta_id,produzido_em,referencia,idade_dias,origem_idade,observacao,autor_id,motivo,criada_em,episodio_id,exame_versao_id,liberado,substituido,ha_versao_pendente,faltam_obrigatorios,tem_pendencias,necessita_revisao",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/valores",
    table: "valor_resultado",
    columns:
      "id,unidade_id,resultado_id,atributo_id,situacao,texto_original,numero,booleano,qualificador,referencia_id,referencia_status,observacao,autor_id,motivo,criada_em",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/liberacoes",
    table: "liberacao_resultado",
    columns:
      "id,unidade_id,resultado_id,hash_conteudo,pendencias_confirmadas,autor_id,motivo,criada_em",
    unit: true,
    permission: "exames:ler",
  },
  {
    path: "/exames/documentos",
    table: "documento_resultado_consulta",
    columns:
      "id,unidade_id,resultado_id,hash_conteudo,autor_id,criada_em,pendencias_confirmadas,conteudo_json",
    unit: true,
    permission: "exames:ler",
  },
];
