import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
const scope: Action["scope"] = async (_t, _a, b) => b.unidade_id as string;
async function insert(
  tx: PoolClient,
  a: Actor,
  b: Body,
  cmd: string,
  table: string,
  fields: string[],
  extra: Body = {},
) {
  const id = randomUUID(),
    record = {
      id,
      organizacao_id: a.organizacao_id,
      unidade_id: b.unidade_id,
      autor_id: a.usuario_id,
      comando_id: cmd,
      motivo: b.motivo,
      ...Object.fromEntries(fields.map((f) => [f, b[f] ?? null])),
      ...extra,
    },
    keys = Object.keys(record);
  await tx.query(
    `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(record),
  );
  return id;
}
async function lock(tx: PoolClient, a: Actor, b: Body) {
  await tx.query("SELECT travar_agenda($1,$2)", [
    a.organizacao_id,
    b.unidade_id,
  ]);
}
async function version(
  tx: PoolClient,
  a: Actor,
  b: Body,
  cmd: string,
  appointment: string,
  number: number,
  previous: string | null,
) {
  const id = await insert(
    tx,
    a,
    b,
    cmd,
    "agendamento_versao",
    ["inicio", "fim", "observacao"],
    { agendamento_id: appointment, versao: number, anterior_id: previous },
  );
  for (const resource of b.recursos as string[])
    await insert(tx, a, b, cmd, "agendamento_recurso", [], {
      agendamento_versao_id: id,
      recurso_id: resource,
    });
  return id;
}
const definitions: [string, string, string, string, string[]][] = [
  ["equipes", "scheduleTeam", "equipe_agenda", "configurar", ["nome"]],
  [
    "recursos",
    "scheduleResource",
    "recurso_agenda",
    "configurar",
    ["nome", "tipo", "usuario_id", "equipe_id", "local_id"],
  ],
  [
    "disponibilidades",
    "scheduleAvailability",
    "disponibilidade_agenda",
    "disponibilidade",
    ["recurso_id", "tipo", "inicio", "fim"],
  ],
  [
    "revogacoes",
    "scheduleRevoke",
    "revogacao_disponibilidade_agenda",
    "disponibilidade",
    ["disponibilidade_id"],
  ],
];
export const scheduleActions: Action[] = definitions.map(
  ([path, input, table, permission, fields]) => ({
    path: `/agenda/${path}`,
    input,
    permission: `agenda:${permission}`,
    scope,
    async run(tx, a, b, _id, cmd) {
      return { id: await insert(tx, a, b, cmd, table, fields) };
    },
  }),
);
scheduleActions.push({
  path: "/agenda/agendamentos",
  input: "scheduleCreate",
  permission: "agenda:agendar",
  scope,
  async run(tx, a, b, _id, cmd) {
    await lock(tx, a, b);
    const id = await insert(tx, a, b, cmd, "agendamento", [
      "paciente_id",
      "responsavel_id",
      "tipo",
      "referencia",
    ]);
    return {
      id,
      agendamento_versao_id: await version(tx, a, b, cmd, id, 1, null),
    };
  },
});
scheduleActions.push({
  path: "/agenda/versoes",
  input: "scheduleVersion",
  permission: "agenda:reprogramar",
  scope,
  async run(tx, a, b, _id, cmd) {
    await one(
      tx,
      "SELECT id FROM agendamento WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
      [a.organizacao_id, b.unidade_id, b.agendamento_id],
    );
    await lock(tx, a, b);
    const last = await one(
      tx,
      "SELECT id,versao FROM agendamento_versao WHERE organizacao_id=$1 AND agendamento_id=$2 ORDER BY versao DESC LIMIT 1",
      [a.organizacao_id, b.agendamento_id],
    );
    if (last.versao !== b.versao_esperada)
      throw new DomainError(409, "agenda_alterada_recarregue");
    return {
      id: await version(
        tx,
        a,
        b,
        cmd,
        b.agendamento_id as string,
        last.versao + 1,
        last.id,
      ),
      versao: last.versao + 1,
    };
  },
});
scheduleActions.push({
  path: "/agenda/transicoes",
  input: "scheduleTransition",
  permission: "agenda:transicionar",
  scope,
  async run(tx, a, b, _id, cmd) {
    await one(
      tx,
      "SELECT id FROM agendamento_versao WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
      [a.organizacao_id, b.unidade_id, b.agendamento_versao_id],
    );
    await lock(tx, a, b);
    const last = (
      await tx.query(
        "SELECT sequencia,estado FROM transicao_agendamento WHERE organizacao_id=$1 AND agendamento_versao_id=$2 ORDER BY sequencia DESC LIMIT 1",
        [a.organizacao_id, b.agendamento_versao_id],
      )
    ).rows[0];
    if ((last?.estado ?? "planejado") !== b.estado_esperado)
      throw new DomainError(409, "estado_agenda_alterado_recarregue");
    return {
      id: await insert(
        tx,
        a,
        b,
        cmd,
        "transicao_agendamento",
        ["agendamento_versao_id", "estado", "ocorrida_em"],
        {
          sequencia: (last?.sequencia ?? 0) + 1,
          anterior_estado: b.estado_esperado,
        },
      ),
    };
  },
});
const versionColumns =
  "agendamento_id,versao,anterior_id,inicio,fim,observacao,paciente_id,responsavel_id,tipo,situacao,atual,necessita_revisao";
const lists: [string, string, string][] = [
  ["equipes", "equipe_agenda", "nome"],
  ["recursos", "recurso_agenda", "nome,tipo,usuario_id,equipe_id,local_id"],
  [
    "disponibilidades",
    "disponibilidade_agenda_consulta",
    "recurso_id,tipo,inicio,fim,revogada",
  ],
  ["revogacoes", "revogacao_disponibilidade_agenda", "disponibilidade_id"],
  ["agendamentos", "agendamento", "paciente_id,responsavel_id,tipo,referencia"],
  ["versoes", "agendamento_versao_consulta", versionColumns],
  ["alocacoes", "agendamento_recurso", "agendamento_versao_id,recurso_id"],
  [
    "transicoes",
    "transicao_agendamento",
    "agendamento_versao_id,sequencia,anterior_estado,estado,ocorrida_em",
  ],
  ["mapa", "agenda_mapa_consulta", versionColumns],
];
export const scheduleLists = lists.map(([path, table, columns]) => ({
  path: `/agenda/${path}`,
  table,
  columns: `id,unidade_id,${columns},autor_id,motivo,criada_em`,
  unit: true,
  permission: "agenda:ler",
}));
