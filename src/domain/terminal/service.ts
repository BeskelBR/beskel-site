import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { authorize, DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
const scope: Action["scope"] = async (_t, _a, b) => b.unidade_id as string;
async function insert(
  tx: PoolClient,
  a: Actor,
  b: Body,
  cmd: string,
  table: string,
  extra: Body,
) {
  const record = {
      id: randomUUID(),
      organizacao_id: a.organizacao_id,
      unidade_id: b.unidade_id,
      autor_id: a.usuario_id,
      comando_id: cmd,
      motivo: b.motivo,
      ...extra,
    },
    keys = Object.keys(record);
  await tx.query(
    `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(record),
  );
  return record.id as string;
}
async function sourcePermissions(
  tx: PoolClient,
  a: Actor,
  b: Body,
  label: Body,
) {
  await authorize(
    tx,
    a,
    label.posicao_id ? "estoque:ler" : "cadastros:ler",
    b.unidade_id as string,
  );
  if (b.episodio_id)
    await authorize(tx, a, "episodios:ler", b.unidade_id as string);
}
export const terminalActions: Action[] = [
  {
    path: "/terminal/etiquetas",
    input: "terminalLabel",
    permission: "terminal:configurar",
    scope,
    async run(tx, a, b, _id, cmd) {
      if (Number(!!b.paciente_id) + Number(!!b.posicao_id) !== 1)
        throw new DomainError(400, "etiqueta_exige_um_alvo");
      return {
        id: await insert(tx, a, b, cmd, "etiqueta_terminal", {
          codigo: b.codigo,
          paciente_id: b.paciente_id ?? null,
          posicao_id: b.posicao_id ?? null,
        }),
      };
    },
  },
  {
    path: "/terminal/revogacoes",
    input: "terminalRevoke",
    permission: "terminal:configurar",
    scope,
    async run(tx, a, b, _id, cmd) {
      return {
        id: await insert(tx, a, b, cmd, "revogacao_etiqueta_terminal", {
          etiqueta_id: b.etiqueta_id,
        }),
      };
    },
  },
  {
    path: "/terminal/leituras",
    input: "terminalScan",
    permission: "terminal:usar",
    scope,
    deviceRequired: true,
    async run(tx, a, b, _id, cmd) {
      const label = await one(
        tx,
        "SELECT id,paciente_id,posicao_id FROM etiqueta_terminal WHERE organizacao_id=$1 AND unidade_id=$2 AND codigo=$3",
        [a.organizacao_id, b.unidade_id, b.codigo],
      );
      await sourcePermissions(tx, a, b, label);
      const device = await one(
        tx,
        "SELECT dispositivo_id FROM comando WHERE organizacao_id=$1 AND id=$2",
        [a.organizacao_id, cmd],
      );
      return {
        id: await insert(tx, a, b, cmd, "leitura_terminal", {
          etiqueta_id: label.id,
          dispositivo_id: device.dispositivo_id,
          referencia: b.referencia,
          ocorrida_em: b.ocorrida_em,
          episodio_id: b.episodio_id ?? null,
        }),
      };
    },
  },
  {
    path: "/terminal/retiradas",
    input: "terminalWithdrawal",
    permission: "terminal:usar",
    scope,
    deviceRequired: true,
    async run() {
      throw new DomainError(409, "terminal_retirada_legada_use_mobile_api");
    },
  },
];
export const terminalLists = [
  {
    path: "/terminal/etiquetas",
    table: "etiqueta_terminal_consulta",
    columns:
      "id,unidade_id,codigo,paciente_id,posicao_id,ativa,autor_id,motivo,criada_em",
    permission: "terminal:configurar",
  },
  {
    path: "/terminal/revogacoes",
    table: "revogacao_etiqueta_terminal",
    columns: "id,unidade_id,etiqueta_id,autor_id,motivo,criada_em",
    permission: "terminal:configurar",
  },
  {
    path: "/terminal/leituras",
    table: "leitura_terminal_consulta",
    columns:
      "id,unidade_id,etiqueta_id,dispositivo_id,episodio_id,referencia,ocorrida_em,paciente_id,posicao_id,etiqueta_ativa,utilizada,autor_id,motivo,criada_em",
    permission: "terminal:ler",
  },
  {
    path: "/terminal/retiradas",
    table: "retirada_terminal",
    columns: "id,unidade_id,leitura_id,autor_id,motivo,criada_em",
    permission: "terminal:ler",
  },
].map((x) => ({ ...x, unit: true }));
