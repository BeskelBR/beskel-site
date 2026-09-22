import { randomUUID } from "node:crypto";
import type { Action } from "../foundation.ts";
import { authorize, DomainError, one } from "../core.ts";
import { object, text, time, uuid } from "../schemas.ts";
const confirm = { type: "boolean", const: true };
const common = {
  motivo: text,
  confirmacao_humana: confirm,
  simulacao: confirm,
};
export const dailyCorrectionInputs = {
  dailyCancel: object(common),
  dailyAssociationCorrection: object({
    ...common,
    pacote_versao_id: uuid,
    inicio: time,
    fim: time,
  }),
  dailyPeriodCorrection: object({
    ...common,
    pacote_episodio_id: uuid,
    classificacao_episodio_id: { ...uuid, nullable: true },
    inicio: time,
    fim: time,
  }),
};
const targets = [
  {
    path: "pacotes-episodio",
    table: "pacote_episodio",
    field: "pacote_episodio_id",
    input: "dailyAssociationCorrection",
  },
  {
    path: "periodos",
    table: "periodo_diaria",
    field: "periodo_diaria_id",
    input: "dailyPeriodCorrection",
  },
];
export const dailyCorrectionActions: Action[] = targets.flatMap((t) =>
  [false, true].map((correct) => ({
    path: `/diarias/${t.path}/:id/${correct ? "corrigir" : "cancelar"}`,
    input: correct ? t.input : "dailyCancel",
    permission: "diarias:corrigir",
    scope: async (tx, a, _b, id) =>
      (
        await one(
          tx,
          `SELECT unidade_id FROM ${t.table} WHERE organizacao_id=$1 AND id=$2`,
          [a.organizacao_id, id],
        )
      ).unidade_id,
    async run(tx, a, b, id, cmd) {
      const old = await one(
        tx,
        `SELECT unidade_id,episodio_id FROM ${t.table} WHERE organizacao_id=$1 AND id=$2`,
        [a.organizacao_id, id],
      );
      await tx.query(
        "SELECT id FROM episodio WHERE organizacao_id=$1 AND id=$2 FOR UPDATE",
        [a.organizacao_id, old.episodio_id],
      );
      if (correct) await authorize(tx, a, "diarias:associar", old.unidade_id);
      const revision = randomUUID(),
        successor = correct ? randomUUID() : null;
      if (correct && t.table === "periodo_diaria") {
        const target = await one(
          tx,
          "SELECT episodio_id FROM pacote_episodio WHERE organizacao_id=$1 AND id=$2",
          [a.organizacao_id, b.pacote_episodio_id],
        );
        if (target.episodio_id !== old.episodio_id)
          throw new DomainError(409, "correcao_exige_mesmo_episodio");
      }
      await tx.query(
        `INSERT INTO revisao_${t.table}(id,organizacao_id,unidade_id,episodio_id,${t.field},substituta_id,tipo,autor_id,comando_id,motivo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          revision,
          a.organizacao_id,
          old.unidade_id,
          old.episodio_id,
          id,
          successor,
          correct ? "correcao" : "cancelamento",
          a.usuario_id,
          cmd,
          b.motivo,
        ],
      );
      if (successor) {
        const extra =
          t.table === "pacote_episodio"
            ? { pacote_versao_id: b.pacote_versao_id }
            : {
                pacote_episodio_id: b.pacote_episodio_id,
                classificacao_episodio_id: b.classificacao_episodio_id,
                fuso: (
                  await one(
                    tx,
                    "SELECT fuso FROM unidade_hospitalar WHERE organizacao_id=$1 AND id=$2",
                    [a.organizacao_id, old.unidade_id],
                  )
                ).fuso,
              };
        const fields = {
          id: successor,
          organizacao_id: a.organizacao_id,
          unidade_id: old.unidade_id,
          episodio_id: old.episodio_id,
          ...extra,
          inicio: b.inicio,
          fim: b.fim,
          autor_id: a.usuario_id,
          motivo: b.motivo,
        };
        await tx.query(
          `INSERT INTO ${t.table}(${Object.keys(fields).join(",")}) VALUES(${Object.keys(
            fields,
          )
            .map((_, i) => `$${i + 1}`)
            .join(",")})`,
          Object.values(fields),
        );
      }
      return { id: successor ?? revision };
    },
  })),
);
export const dailyCorrectionLists = targets.map((t) => ({
  path: `/diarias/revisoes-${t.path}`,
  table: `revisao_${t.table}`,
  columns: `id,unidade_id,episodio_id,${t.field},substituta_id,tipo,autor_id,comando_id,motivo,criada_em`,
  permission: "diarias:ler",
  unit: true,
}));
