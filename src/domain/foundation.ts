import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { authorize, digest, DomainError, occurred, one } from "./core.ts";
import type { Actor } from "./core.ts";

export type Body = Record<string, unknown>;
export type Action = {
  path: string;
  input: string;
  permission: string;
  scope?: (
    tx: PoolClient,
    actor: Actor,
    body: Body,
    id: string,
  ) => Promise<string>;
  run: (
    tx: PoolClient,
    actor: Actor,
    body: Body,
    id: string,
    commandId: string,
  ) => Promise<{ id: string; [key: string]: unknown }>;
};
const val = (b: Body, k: string) => b[k] as string;
const byUnit = async (_tx: PoolClient, _a: Actor, b: Body) =>
  val(b, "unidade_id");
const episodeUnit = async (tx: PoolClient, a: Actor, _b: Body, id: string) =>
  (
    await one(
      tx,
      "SELECT unidade_id FROM episodio WHERE organizacao_id=$1 AND id=$2",
      [a.organizacao_id, id],
    )
  ).unidade_id;

function create(
  path: string,
  input: string,
  permission: string,
  table: string,
  fields: string[],
  scope?: Action["scope"],
): Action {
  return {
    path,
    input,
    permission,
    scope,
    async run(tx, a, b) {
      const id = randomUUID();
      // table/columns come exclusively from this static registry, never the request.
      await tx.query(
        `INSERT INTO ${table}(id,organizacao_id,${fields.join(",")}) VALUES(${Array.from({ length: fields.length + 2 }, (_, i) => `$${i + 1}`).join(",")})`,
        [id, a.organizacao_id, ...fields.map((f) => b[f] ?? null)],
      );
      return { id };
    },
  };
}
export const actions: Action[] = [
  create("/unidades", "unidade", "acesso:administrar", "unidade_hospitalar", [
    "nome",
    "fuso",
  ]),
  create("/usuarios", "usuario", "acesso:administrar", "usuario", [
    "nome",
    "login",
  ]),
  create("/dispositivos", "dispositivo", "acesso:administrar", "dispositivo", [
    "nome",
    "unidade_id",
  ]),
  create("/responsaveis", "responsavel", "cadastros:escrever", "responsavel", [
    "nome",
  ]),
  create("/pacientes", "paciente", "cadastros:escrever", "paciente", [
    "nome",
    "especie_codigo",
    "estado_vital",
  ]),
  create(
    "/locais",
    "local",
    "locais:escrever",
    "local",
    ["nome", "unidade_id", "pai_id", "tipo", "capacidade"],
    byUnit,
  ),
  {
    path: "/papeis",
    input: "papel",
    permission: "acesso:administrar",
    async run(tx, a, b) {
      const id = randomUUID();
      await tx.query(
        "INSERT INTO papel(id,organizacao_id,nome) VALUES($1,$2,$3)",
        [id, a.organizacao_id, b.nome],
      );
      await tx.query(
        "INSERT INTO papel_permissao(organizacao_id,papel_id,permissao) SELECT $1,$2,unnest($3::text[])",
        [a.organizacao_id, id, b.permissoes],
      );
      return { id };
    },
  },
  create("/atribuicoes", "atribuicao", "acesso:administrar", "usuario_papel", [
    "usuario_id",
    "papel_id",
    "unidade_id",
  ]),
  {
    path: "/credenciais",
    input: "credencial",
    permission: "acesso:administrar",
    async run(tx, a, b) {
      const expires = Date.parse(val(b, "expira_em"));
      if (expires <= Date.now() || expires > Date.now() + 90 * 86400000)
        throw new DomainError(400, "validade_maxima_90_dias");
      const id = randomUUID();
      await tx.query(
        "INSERT INTO credencial(id,organizacao_id,usuario_id,tipo,token_hash,expira_em) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id,
          a.organizacao_id,
          b.usuario_id,
          b.tipo,
          digest(val(b, "token")),
          b.expira_em,
        ],
      );
      return { id };
    },
  },
  {
    path: "/credenciais/:id/revogar",
    input: "motivo",
    permission: "acesso:administrar",
    async run(tx, a, b, id) {
      await one(
        tx,
        `UPDATE credencial SET revogada_em=now(),revogada_por_id=$3,motivo_revogacao=$4
      WHERE organizacao_id=$1 AND id=$2 AND revogada_em IS NULL RETURNING id`,
        [a.organizacao_id, id, a.usuario_id, b.motivo],
      );
      return { id };
    },
  },
  ...["usuarios", "dispositivos"].map(
    (resource): Action => ({
      path: `/${resource}/:id/desativar`,
      input: "motivo",
      permission: "acesso:administrar",
      async run(tx, a, _b, id) {
        await one(
          tx,
          `UPDATE ${resource === "usuarios" ? "usuario" : "dispositivo"} SET ativo=false WHERE organizacao_id=$1 AND id=$2 AND ativo RETURNING id`,
          [a.organizacao_id, id],
        );
        return { id };
      },
    }),
  ),
  {
    path: "/vinculos",
    input: "vinculo",
    permission: "cadastros:escrever",
    async run(tx, a, b) {
      const id = randomUUID();
      await tx.query(
        `INSERT INTO paciente_responsavel(id,organizacao_id,paciente_id,responsavel_id,papel,inicio,autor_id)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          a.organizacao_id,
          b.paciente_id,
          b.responsavel_id,
          b.papel,
          occurred(val(b, "inicio")),
          a.usuario_id,
        ],
      );
      return { id };
    },
  },
  {
    path: "/vinculos/:id/encerrar",
    input: "fimVinculo",
    permission: "cadastros:escrever",
    async run(tx, a, b, id) {
      await one(
        tx,
        "UPDATE paciente_responsavel SET fim=$3 WHERE organizacao_id=$1 AND id=$2 AND fim IS NULL RETURNING id",
        [a.organizacao_id, id, occurred(val(b, "fim"))],
      );
      return { id };
    },
  },
  {
    path: "/episodios",
    input: "episodio",
    permission: "episodios:escrever",
    scope: byUnit,
    async run(tx, a, b) {
      const id = randomUUID();
      await tx.query(
        `INSERT INTO episodio(id,organizacao_id,unidade_id,paciente_id,tipo,admitido_em,autor_id)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          a.organizacao_id,
          b.unidade_id,
          b.paciente_id,
          b.tipo,
          occurred(val(b, "admitido_em")),
          a.usuario_id,
        ],
      );
      return { id, versao: 1 };
    },
  },
  ...["alta", "encerrar"].map(
    (step): Action => ({
      path: `/episodios/:id/${step}`,
      input: "transicao",
      permission: "episodios:escrever",
      scope: episodeUnit,
      async run(tx, a, b, id) {
        const ep = await one(
          tx,
          "SELECT versao,alta_clinica_em,encerrado_em FROM episodio WHERE organizacao_id=$1 AND id=$2 FOR UPDATE",
          [a.organizacao_id, id],
        );
        if (ep.versao !== b.versao_esperada)
          throw new DomainError(409, "versao_desatualizada");
        if (ep.encerrado_em || (step === "alta" && ep.alta_clinica_em))
          throw new DomainError(409, "transicao_invalida");
        const time = occurred(val(b, "ocorrido_em"));
        if (step === "encerrar") {
          const active = await tx.query(
            "SELECT 1 FROM ocupacao WHERE organizacao_id=$1 AND episodio_id=$2 AND (fim IS NULL OR fim>$3)",
            [a.organizacao_id, id, time],
          );
          if (active.rowCount)
            throw new DomainError(409, "encerre_ocupacao_antes_da_saida");
        }
        const columns =
          step === "alta"
            ? "alta_clinica_em=$3,alta_por_id=$4,motivo_alta=$5"
            : "encerrado_em=$3,encerrado_por_id=$4,motivo_saida=$5";
        await tx.query(
          `UPDATE episodio SET ${columns},versao=versao+1 WHERE organizacao_id=$1 AND id=$2`,
          [a.organizacao_id, id, time, a.usuario_id, b.motivo],
        );
        return { id, versao: ep.versao + 1 };
      },
    }),
  ),
  {
    path: "/ocupacoes",
    input: "ocupacao",
    permission: "episodios:escrever",
    scope: async (tx, a, b) => episodeUnit(tx, a, b, val(b, "episodio_id")),
    async run(tx, a, b) {
      const ep = await one(
        tx,
        "SELECT unidade_id,encerrado_em FROM episodio WHERE organizacao_id=$1 AND id=$2 FOR UPDATE",
        [a.organizacao_id, b.episodio_id],
      );
      if (ep.encerrado_em) throw new DomainError(409, "episodio_encerrado");
      await authorize(tx, a, "locais:ler", ep.unidade_id);
      const id = randomUUID();
      await tx.query(
        `INSERT INTO ocupacao(id,organizacao_id,unidade_id,episodio_id,local_id,vaga,inicio,autor_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id,
          a.organizacao_id,
          ep.unidade_id,
          b.episodio_id,
          b.local_id,
          b.vaga,
          occurred(val(b, "inicio")),
          a.usuario_id,
        ],
      );
      return { id };
    },
  },
  {
    path: "/ocupacoes/:id/encerrar",
    input: "fimOcupacao",
    permission: "episodios:escrever",
    scope: async (tx, a, _b, id) =>
      (
        await one(
          tx,
          "SELECT unidade_id FROM ocupacao WHERE organizacao_id=$1 AND id=$2",
          [a.organizacao_id, id],
        )
      ).unidade_id,
    async run(tx, a, b, id) {
      const oc = await one(
        tx,
        "SELECT episodio_id FROM ocupacao WHERE organizacao_id=$1 AND id=$2",
        [a.organizacao_id, id],
      );
      await tx.query(
        "SELECT id FROM episodio WHERE organizacao_id=$1 AND id=$2 FOR UPDATE",
        [a.organizacao_id, oc.episodio_id],
      );
      await one(
        tx,
        `UPDATE ocupacao SET fim=$3,encerrada_por_id=$4,motivo_fim=$5
        WHERE organizacao_id=$1 AND id=$2 AND fim IS NULL RETURNING id`,
        [a.organizacao_id, id, occurred(val(b, "fim")), a.usuario_id, b.motivo],
      );
      return { id };
    },
  },
  {
    path: "/lotes-importacao",
    input: "lote",
    permission: "proveniencia:administrar",
    async run(tx, a, b) {
      const id = randomUUID();
      await tx.query(
        "INSERT INTO lote_importacao(id,organizacao_id,origem,autor_id) VALUES($1,$2,$3,$4)",
        [id, a.organizacao_id, b.origem, a.usuario_id],
      );
      return { id };
    },
  },
  {
    path: "/ids-externos",
    input: "externo",
    permission: "proveniencia:administrar",
    async run(tx, a, b) {
      const id = randomUUID();
      const batch = await one(
        tx,
        "SELECT origem FROM lote_importacao WHERE organizacao_id=$1 AND id=$2",
        [a.organizacao_id, b.lote_importacao_id],
      );
      if (batch.origem !== "sintetico-dev")
        throw new DomainError(403, "migracao_real_nao_autorizada");
      await tx.query(
        `INSERT INTO id_externo(id,organizacao_id,lote_importacao_id,origem,entidade,codigo_externo,qualidade,paciente_id,responsavel_id,episodio_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          id,
          a.organizacao_id,
          b.lote_importacao_id,
          batch.origem,
          b.entidade,
          b.codigo_externo,
          b.qualidade,
          b.entidade === "paciente" ? b.entidade_id : null,
          b.entidade === "responsavel" ? b.entidade_id : null,
          b.entidade === "episodio" ? b.entidade_id : null,
        ],
      );
      return { id };
    },
  },
];

export const lists = [
  {
    path: "/unidades",
    table: "unidade_hospitalar",
    permission: "acesso:administrar",
    columns: "id,nome,fuso",
  },
  {
    path: "/usuarios",
    table: "usuario",
    permission: "acesso:administrar",
    columns: "id,nome,login,ativo",
  },
  {
    path: "/papeis",
    table: "papel",
    permission: "acesso:administrar",
    columns: "id,nome",
  },
  {
    path: "/atribuicoes",
    table: "usuario_papel",
    permission: "acesso:administrar",
    columns: "id,usuario_id,papel_id,unidade_id",
  },
  {
    path: "/credenciais",
    table: "credencial",
    permission: "acesso:administrar",
    columns: "id,usuario_id,tipo,expira_em,revogada_em",
  },
  {
    path: "/dispositivos",
    table: "dispositivo",
    permission: "acesso:administrar",
    columns: "id,nome,unidade_id,ativo",
  },
  {
    path: "/responsaveis",
    table: "responsavel",
    permission: "cadastros:ler",
    columns: "id,nome,criado_em",
  },
  {
    path: "/pacientes",
    table: "paciente",
    permission: "cadastros:ler",
    columns: "id,nome,especie_codigo,estado_vital,criado_em",
  },
  {
    path: "/vinculos",
    table: "paciente_responsavel",
    permission: "cadastros:ler",
    columns: "id,paciente_id,responsavel_id,papel,inicio,fim",
  },
  {
    path: "/episodios",
    table: "episodio",
    permission: "episodios:ler",
    columns:
      "id,unidade_id,paciente_id,tipo,admitido_em,alta_clinica_em,encerrado_em,versao",
    unit: true,
  },
  {
    path: "/locais",
    table: "local",
    permission: "locais:ler",
    columns: "id,unidade_id,pai_id,nome,tipo,capacidade",
    unit: true,
  },
  {
    path: "/ocupacoes",
    table: "ocupacao",
    permission: "episodios:ler",
    columns: "id,unidade_id,episodio_id,local_id,vaga,inicio,fim",
    unit: true,
  },
  {
    path: "/auditoria",
    table: "evento_auditoria",
    permission: "auditoria:ler",
    columns:
      "id,comando_id,autor_id,acao,entidade_id,correlation_id,registrado_em,motivo",
  },
  {
    path: "/outbox",
    table: "outbox",
    permission: "auditoria:ler",
    columns:
      "id,tipo,entidade_id,tentativas,concluida_em,pendente_em,ultimo_erro",
  },
  {
    path: "/lotes-importacao",
    table: "lote_importacao",
    permission: "proveniencia:administrar",
    columns: "id,origem,situacao,criado_em",
  },
  {
    path: "/ids-externos",
    table: "id_externo",
    permission: "proveniencia:administrar",
    columns:
      "id,origem,entidade,codigo_externo,qualidade,paciente_id,responsavel_id,episodio_id",
  },
];
