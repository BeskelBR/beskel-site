import { randomUUID } from "node:crypto";
import { authorize, DomainError, one } from "../core.ts";
import type { Action } from "../foundation.ts";
import { financialInputs, money } from "../financial/schemas.ts";
import { object, text, uuid } from "../schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const financialCorrectionInputs = {
  financialSourceCancel: object(common),
  financialDepositCorrection: financialInputs.deposito_adquirente,
  financialStatementCorrection: financialInputs.item_extrato,
  financialReconcileAgain: object({ ...common, valor: money, evidencia: text }),
  financialAllocateAgain: object({ ...common, valor: money }),
};
const sources = [
  {
    path: "depositos",
    table: "deposito_adquirente",
    field: "deposito_id",
    input: "financialDepositCorrection",
    fields: [
      "conta_financeira_id",
      "adquirente",
      "referencia",
      "depositado_em",
      "valor",
      "evidencia",
    ],
  },
  {
    path: "extrato",
    table: "item_extrato",
    field: "extrato_id",
    input: "financialStatementCorrection",
    fields: [
      "conta_financeira_id",
      "referencia",
      "ocorrido_em",
      "valor",
      "evidencia",
    ],
  },
];
const scope =
  (table: string): Action["scope"] =>
  async (tx, a, _b, id) =>
    (
      await one(
        tx,
        `SELECT unidade_id FROM ${table} WHERE organizacao_id=$1 AND id=$2`,
        [a.organizacao_id, id],
      )
    ).unidade_id;
export const financialCorrectionActions: Action[] = [
  ...sources.flatMap((t) =>
    [false, true].map(
      (correct): Action => ({
        path: `/financeiro/${t.path}/:id/${correct ? "corrigir" : "cancelar"}`,
        input: correct ? t.input : "financialSourceCancel",
        permission: "financeiro:reverter",
        scope: scope(t.table),
        async run(tx, a, b, id, cmd) {
          const old = await one(
            tx,
            `SELECT unidade_id FROM ${t.table} WHERE organizacao_id=$1 AND id=$2`,
            [a.organizacao_id, id],
          );
          if (old.unidade_id !== b.unidade_id)
            throw new DomainError(409, "correcao_exige_mesma_unidade");
          if (correct)
            await authorize(tx, a, "financeiro:conciliar", old.unidade_id);
          await tx.query("SELECT travar_financeiro($1,$2)", [
            a.organizacao_id,
            old.unidade_id,
          ]);
          const revision = randomUUID(),
            successor = correct ? randomUUID() : null;
          await tx.query(
            `INSERT INTO revisao_${t.table}(id,organizacao_id,unidade_id,${t.field},substituta_id,tipo,autor_id,comando_id,motivo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              revision,
              a.organizacao_id,
              old.unidade_id,
              id,
              successor,
              correct ? "correcao" : "cancelamento",
              a.usuario_id,
              cmd,
              b.motivo,
            ],
          );
          if (successor) {
            const record = {
              id: successor,
              organizacao_id: a.organizacao_id,
              unidade_id: old.unidade_id,
              autor_id: a.usuario_id,
              comando_id: cmd,
              motivo: b.motivo,
              ...Object.fromEntries(t.fields.map((f) => [f, b[f]])),
            };
            await tx.query(
              `INSERT INTO ${t.table}(${Object.keys(record).join(",")}) VALUES(${Object.keys(
                record,
              )
                .map((_, i) => `$${i + 1}`)
                .join(",")})`,
              Object.values(record),
            );
          }
          return { id: successor ?? revision };
        },
      }),
    ),
  ),
  ...[
    {
      path: "conciliacoes",
      table: "vinculo_conciliacao",
      input: "financialReconcileAgain",
      other: "extrato_id",
    },
    {
      path: "alocacoes-deposito",
      table: "alocacao_deposito",
      input: "financialAllocateAgain",
      other: "parcela_id",
    },
  ].map(
    (t): Action => ({
      path: `/financeiro/${t.path}/:id/refazer`,
      input: t.input,
      permission: "financeiro:conciliar",
      scope: scope(t.table),
      async run(tx, a, b, id, cmd) {
        const old = await one(
          tx,
          `SELECT unidade_id,deposito_id,${t.other} FROM ${t.table} WHERE organizacao_id=$1 AND id=$2`,
          [a.organizacao_id, id],
        );
        if (old.unidade_id !== b.unidade_id)
          throw new DomainError(409, "reabertura_exige_mesma_unidade");
        await tx.query("SELECT travar_financeiro($1,$2)", [
          a.organizacao_id,
          old.unidade_id,
        ]);
        const record = {
          id: randomUUID(),
          organizacao_id: a.organizacao_id,
          unidade_id: old.unidade_id,
          autor_id: a.usuario_id,
          comando_id: cmd,
          motivo: b.motivo,
          deposito_id: old.deposito_id,
          [t.other]: old[t.other],
          anterior_id: id,
          valor: b.valor,
          ...(t.table === "vinculo_conciliacao"
            ? { evidencia: b.evidencia }
            : {}),
        };
        await tx.query(
          `INSERT INTO ${t.table}(${Object.keys(record).join(",")}) VALUES(${Object.keys(
            record,
          )
            .map((_, i) => `$${i + 1}`)
            .join(",")})`,
          Object.values(record),
        );
        return { id: record.id };
      },
    }),
  ),
];
export const financialCorrectionLists = sources.map((t) => ({
  path: `/financeiro/revisoes-${t.path}`,
  table: `revisao_${t.table}`,
  columns: `id,unidade_id,${t.field},substituta_id,tipo,autor_id,comando_id,motivo,criada_em`,
  permission: "financeiro:ler",
  unit: true,
}));
