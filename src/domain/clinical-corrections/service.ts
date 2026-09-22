import { randomUUID } from "node:crypto";
import type { Action } from "../foundation.ts";
import { DomainError, one } from "../core.ts";
import { clinicalInputs } from "../clinical/schemas.ts";
import { execution } from "../clinical/service.ts";
import { object, text, uuid } from "../schemas.ts";
const confirm = { type: "boolean", const: true };
export const clinicalCorrectionInputs = {
  executionContext: object({
    ...clinicalInputs.clinicalCorrection.properties,
    ordem_versao_id: uuid,
    programacao_id: { ...uuid, nullable: true },
    executor_id: uuid,
    simulacao: confirm,
  }),
  executionAnnul: object({
    motivo: text,
    confirmacao_humana: confirm,
    simulacao: confirm,
  }),
};
const scope: Action["scope"] = async (tx, a, _b, id) =>
  (
    await one(
      tx,
      "SELECT unidade_id FROM execucao WHERE organizacao_id=$1 AND id=$2",
      [a.organizacao_id, id],
    )
  ).unidade_id;
export const clinicalCorrectionActions: Action[] = ["contexto", "anulacao"].map(
  (kind) => ({
    path: `/clinica/execucoes/:id/${kind === "contexto" ? "corrigir-contexto" : "anular"}`,
    input: kind === "contexto" ? "executionContext" : "executionAnnul",
    permission:
      kind === "contexto" ? "clinica:corrigir_contexto" : "clinica:anular",
    scope,
    async run(tx, a, b, id, cmd) {
      const original = await one(
        tx,
        "SELECT unidade_id,episodio_id FROM execucao WHERE organizacao_id=$1 AND id=$2",
        [a.organizacao_id, id],
      );
      await tx.query(
        "SELECT id FROM episodio WHERE organizacao_id=$1 AND id=$2 FOR UPDATE",
        [a.organizacao_id, original.episodio_id],
      );
      const revision = randomUUID(),
        successor = kind === "contexto" ? randomUUID() : null;
      if (successor) {
        const target = await one(
          tx,
          "SELECT episodio_id FROM ordem_versao WHERE organizacao_id=$1 AND id=$2",
          [a.organizacao_id, b.ordem_versao_id],
        );
        if (target.episodio_id !== original.episodio_id)
          throw new DomainError(409, "correcao_exige_mesmo_episodio");
        const executor = await one(
          tx,
          "SELECT ativo FROM usuario WHERE organizacao_id=$1 AND id=$2 FOR SHARE",
          [a.organizacao_id, b.executor_id],
        );
        if (!executor.ativo)
          throw new DomainError(409, "executor_declarado_inativo");
      }
      await tx.query(
        "INSERT INTO revisao_execucao(id,organizacao_id,unidade_id,episodio_id,execucao_id,substituta_id,tipo,autor_id,comando_id,motivo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          revision,
          a.organizacao_id,
          original.unidade_id,
          original.episodio_id,
          id,
          successor,
          kind,
          a.usuario_id,
          cmd,
          b.motivo,
        ],
      );
      if (successor)
        return execution(tx, a, b, id, {
          id: successor,
          executorId: b.executor_id as string,
        });
      await tx.query(
        `INSERT INTO resolucao_pendencia_clinica(id,organizacao_id,unidade_id,pendencia_id,anulacao_id,autor_id,motivo)
      SELECT gen_random_uuid(),p.organizacao_id,p.unidade_id,p.id,$3,$4,$5 FROM pendencia_clinica p WHERE p.organizacao_id=$1 AND p.execucao_id=$2 AND p.tipo IN ('material_nao_identificado','revisao_temporal') AND NOT EXISTS(SELECT 1 FROM resolucao_pendencia_clinica r WHERE r.organizacao_id=p.organizacao_id AND r.pendencia_id=p.id)`,
        [a.organizacao_id, id, revision, a.usuario_id, b.motivo],
      );
      return { id: revision };
    },
  }),
);
export const clinicalCorrectionLists = [
  {
    path: "/clinica/revisoes-execucao",
    table: "revisao_execucao",
    columns:
      "id,unidade_id,episodio_id,execucao_id,substituta_id,tipo,autor_id,comando_id,motivo,criada_em",
    permission: "clinica:ler",
    unit: true,
  },
];
