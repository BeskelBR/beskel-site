import { randomUUID } from "node:crypto";
import type { Action } from "../foundation.ts";
import { authorize } from "../core.ts";
import { object, text, uuid } from "../schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const linksInputs = {
  scheduleEpisode: object({
    ...common,
    agendamento_versao_id: uuid,
    episodio_id: uuid,
    episodio_versao_esperada: {
      type: "integer",
      minimum: 1,
      maximum: 2147483647,
    },
  }),
  revokeScheduleEpisode: object({ ...common, vinculo_id: uuid }),
};
export const linksActions: Action[] = [
  {
    path: "/agenda/vinculos-episodios",
    input: "scheduleEpisode",
    table: "vinculo_agendamento_episodio",
    fields: ["agendamento_versao_id", "episodio_id", "episodio_versao"],
  },
  {
    path: "/agenda/revogacoes-vinculos",
    input: "revokeScheduleEpisode",
    table: "revogacao_vinculo_agendamento",
    fields: ["vinculo_id"],
  },
].map(({ table, fields, ...action }) => ({
  ...action,
  permission: "agenda:vincular_episodio",
  async scope(tx, a, b) {
    await authorize(tx, a, "episodios:ler", b.unidade_id as string);
    return b.unidade_id as string;
  },
  async run(tx, a, b, _id, cmd) {
    const values = { ...b, episodio_versao: b.episodio_versao_esperada },
      id = randomUUID();
    await tx.query(
      `INSERT INTO ${table}(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,${fields.join(",")}) VALUES(${Array.from({ length: 6 + fields.length }, (_, i) => `$${i + 1}`).join(",")})`,
      [
        id,
        a.organizacao_id,
        b.unidade_id,
        a.usuario_id,
        cmd,
        b.motivo,
        ...fields.map((k) => (values as Record<string, unknown>)[k]),
      ],
    );
    return { id };
  },
}));
export const linksLists = [
  {
    path: "/agenda/vinculos-episodios",
    table: "vinculo_agendamento_consulta",
    columns:
      "id,unidade_id,agendamento_id,agendamento_versao_id,episodio_id,episodio_versao,paciente_id,situacao,atual,revogada,vigente,necessita_revisao,autor_id,motivo,criada_em",
  },
  {
    path: "/agenda/revogacoes-vinculos",
    table: "revogacao_vinculo_agendamento",
    columns: "id,unidade_id,vinculo_id,autor_id,motivo,criada_em",
  },
].map((x) => ({ ...x, unit: true, permission: "agenda:vincular_episodio" }));
