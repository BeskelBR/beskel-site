import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { authorize, DomainError, occurred, one } from "../core.ts";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
import { record, recordMany } from "../inventory/service.ts";
const s = (b: Body, k: string) => b[k] as string;
async function get(
  tx: PoolClient,
  a: Actor,
  table: string,
  id: string,
  columns: string,
) {
  return one(
    tx,
    `SELECT ${columns} FROM ${table} WHERE organizacao_id=$1 AND id=$2`,
    [a.organizacao_id, id],
  );
}
const scoped =
  (table: string, field?: string): Action["scope"] =>
  async (tx, a, b, id) =>
    (await get(tx, a, table, field ? s(b, field) : id, "unidade_id"))
      .unidade_id;
async function episodeLock(tx: PoolClient, a: Actor, id: string) {
  return one(
    tx,
    "SELECT id,unidade_id,paciente_id FROM episodio WHERE organizacao_id=$1 AND id=$2 FOR UPDATE",
    [a.organizacao_id, id],
  );
}
async function pending(
  tx: PoolClient,
  a: Actor,
  unit: string,
  kind: string,
  field: string,
  id: string,
  detail: string,
) {
  await tx.query(
    `INSERT INTO pendencia_clinica(id,organizacao_id,unidade_id,tipo,${field},descricao) VALUES($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), a.organizacao_id, unit, kind, id, detail],
  );
}
async function resolveMaterial(
  tx: PoolClient,
  a: Actor,
  execution: string,
  consumption: string | null,
  correction: string | null,
  reason: string,
) {
  await tx.query(
    `INSERT INTO resolucao_pendencia_clinica(id,organizacao_id,unidade_id,pendencia_id,consumo_id,execucao_substituta_id,autor_id,motivo)
    SELECT gen_random_uuid(),p.organizacao_id,p.unidade_id,p.id,$3,$4,$5,$6 FROM pendencia_clinica p
    WHERE p.organizacao_id=$1 AND p.execucao_id=$2 AND p.tipo='material_nao_identificado' AND NOT EXISTS(SELECT 1 FROM resolucao_pendencia_clinica r WHERE r.organizacao_id=p.organizacao_id AND r.pendencia_id=p.id)`,
    [
      a.organizacao_id,
      execution,
      consumption,
      correction,
      a.usuario_id,
      reason,
    ],
  );
}
async function addVersion(tx: PoolClient, a: Actor, b: Body, orderId: string) {
  const order = await get(tx, a, "ordem", orderId, "unidade_id,episodio_id");
  await episodeLock(tx, a, order.episodio_id);
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `ordem:${a.organizacao_id}:${orderId}`,
  ]);
  const prior = await tx.query(
    "SELECT versao FROM ordem_versao WHERE organizacao_id=$1 AND ordem_id=$2 ORDER BY versao DESC LIMIT 1",
    [a.organizacao_id, orderId],
  );
  const version = (prior.rows[0]?.versao ?? 0) + 1;
  if (b.versao_esperada !== undefined && b.versao_esperada !== version - 1)
    throw new DomainError(409, "ordem_alterada_recarregue");
  const id = randomUUID();
  await tx.query(
    `INSERT INTO ordem_versao(id,organizacao_id,unidade_id,episodio_id,ordem_id,versao,item_clinico_id,quantidade_prescrita,unidade_medida_id,via,orientacao,vigencia_inicio,vigencia_fim,autor_id,motivo)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      id,
      a.organizacao_id,
      order.unidade_id,
      order.episodio_id,
      orderId,
      version,
      b.item_clinico_id,
      b.quantidade_prescrita,
      b.unidade_medida_id,
      b.via,
      b.orientacao,
      b.vigencia_inicio,
      b.vigencia_fim ?? null,
      a.usuario_id,
      b.motivo,
    ],
  );
  // Existing schedules keep their exact version. Review never claims an execution occurred.
  await tx.query(
    `INSERT INTO pendencia_clinica(id,organizacao_id,unidade_id,programacao_id,tipo,descricao)
    SELECT gen_random_uuid(),p.organizacao_id,p.unidade_id,p.id,'revisao_programacao','Nova versão de ordem; revisar programação anterior'
    FROM programacao p JOIN ordem_versao v ON v.organizacao_id=p.organizacao_id AND v.id=p.ordem_versao_id
    WHERE v.organizacao_id=$1 AND v.ordem_id=$2 AND v.versao<$3 AND p.prevista_em>=$4 AND p.situacao='prevista'
    AND NOT EXISTS(SELECT 1 FROM execucao e WHERE e.organizacao_id=p.organizacao_id AND e.programacao_id=p.id)`,
    [a.organizacao_id, orderId, version, b.vigencia_inicio],
  );
  const overlap = await tx.query(
    `SELECT 1 FROM ordem_versao v WHERE v.organizacao_id=$1 AND v.episodio_id=$2 AND v.item_clinico_id=$3 AND v.ordem_id<>$4
    AND NOT EXISTS(SELECT 1 FROM ordem_versao n WHERE n.organizacao_id=v.organizacao_id AND n.ordem_id=v.ordem_id AND n.versao>v.versao)
    AND tstzrange(v.vigencia_inicio,v.vigencia_fim,'[)') && tstzrange($5::timestamptz,$6::timestamptz,'[)') LIMIT 1`,
    [
      a.organizacao_id,
      order.episodio_id,
      b.item_clinico_id,
      orderId,
      b.vigencia_inicio,
      b.vigencia_fim ?? null,
    ],
  );
  if (overlap.rowCount)
    await pending(
      tx,
      a,
      order.unidade_id,
      "ordem_sobreposta",
      "ordem_versao_id",
      id,
      "Ordens do mesmo item com vigências potencialmente sobrepostas; revisão humana necessária",
    );
  return { id, ordem_id: orderId, versao: version };
}
export async function execution(
  tx: PoolClient,
  a: Actor,
  b: Body,
  original?: string,
  context?: { id: string; executorId: string },
) {
  const old = original
    ? await get(tx, a, "execucao", original, "ordem_versao_id,programacao_id")
    : undefined;
  const versionId = context
    ? s(b, "ordem_versao_id")
    : (old?.ordem_versao_id ?? s(b, "ordem_versao_id"));
  const version = await get(
    tx,
    a,
    "ordem_versao",
    versionId,
    "unidade_id,episodio_id",
  );
  await episodeLock(tx, a, version.episodio_id);
  if (original) await authorize(tx, a, "clinica:executar", version.unidade_id);
  const id = context?.id ?? randomUUID();
  await tx.query(
    `INSERT INTO execucao(id,organizacao_id,unidade_id,episodio_id,ordem_versao_id,programacao_id,evento_referencia,correcao_de_id,executor_id,executada_em,quantidade_aplicada,unidade_medida_id,resultado,situacao_material,confirmacao_humana,motivo)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      id,
      a.organizacao_id,
      version.unidade_id,
      version.episodio_id,
      versionId,
      context
        ? (b.programacao_id ?? null)
        : old
          ? old.programacao_id
          : (b.programacao_id ?? null),
      b.evento_referencia,
      original ?? null,
      context?.executorId ?? a.usuario_id,
      occurred(s(b, "executada_em")),
      b.quantidade_aplicada,
      b.unidade_medida_id,
      b.resultado,
      b.situacao_material,
      b.confirmacao_humana,
      b.motivo,
    ],
  );
  if (original)
    await resolveMaterial(tx, a, original, null, id, s(b, "motivo"));
  if (b.situacao_material === "pendente")
    await pending(
      tx,
      a,
      version.unidade_id,
      "material_nao_identificado",
      "execucao_id",
      id,
      "Execução confirmada; materiais ainda não conciliados com posições identificadas",
    );
  return { id };
}
export const clinicalActions: Action[] = [
  {
    path: "/clinica/itens",
    input: "clinicalItem",
    permission: "clinica:catalogar",
    async run(tx, a, b) {
      const id = randomUUID();
      await tx.query(
        "INSERT INTO item_clinico(id,organizacao_id,nome,tipo) VALUES($1,$2,$3,$4)",
        [id, a.organizacao_id, b.nome, b.tipo],
      );
      return { id };
    },
  },
  {
    path: "/clinica/materiais-previstos",
    input: "plannedMaterial",
    permission: "clinica:catalogar",
    async run(tx, a, b) {
      const id = randomUUID();
      await tx.query(
        "INSERT INTO material_previsto(id,organizacao_id,item_clinico_id,produto_id,versao,quantidade_base,criterio,aprovado_por_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          a.organizacao_id,
          b.item_clinico_id,
          b.produto_id,
          b.versao,
          b.quantidade_base,
          b.criterio,
          a.usuario_id,
        ],
      );
      return { id };
    },
  },
  {
    path: "/clinica/prescricoes",
    input: "prescription",
    permission: "clinica:prescrever",
    scope: scoped("episodio", "episodio_id"),
    async run(tx, a, b) {
      const ep = await episodeLock(tx, a, s(b, "episodio_id")),
        id = randomUUID();
      await tx.query(
        "INSERT INTO prescricao(id,organizacao_id,unidade_id,episodio_id,prescritor_id,assinada_em,motivo) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          a.organizacao_id,
          ep.unidade_id,
          ep.id,
          a.usuario_id,
          occurred(s(b, "assinada_em")),
          b.motivo,
        ],
      );
      return { id };
    },
  },
  {
    path: "/clinica/ordens",
    input: "clinicalOrder",
    permission: "clinica:prescrever",
    scope: scoped("prescricao", "prescricao_id"),
    async run(tx, a, b) {
      const p = await get(
          tx,
          a,
          "prescricao",
          s(b, "prescricao_id"),
          "id,unidade_id,episodio_id",
        ),
        id = randomUUID();
      await tx.query(
        "INSERT INTO ordem(id,organizacao_id,unidade_id,episodio_id,prescricao_id) VALUES($1,$2,$3,$4,$5)",
        [id, a.organizacao_id, p.unidade_id, p.episodio_id, p.id],
      );
      const version = await addVersion(tx, a, b, id);
      return { id, ordem_versao_id: version.id, versao: version.versao };
    },
  },
  {
    path: "/clinica/ordens/:id/versoes",
    input: "clinicalVersion",
    permission: "clinica:prescrever",
    scope: scoped("ordem"),
    run: (tx, a, b, id) => addVersion(tx, a, b, id),
  },
  {
    path: "/clinica/programacoes",
    input: "clinicalSchedule",
    permission: "clinica:programar",
    scope: scoped("ordem_versao", "ordem_versao_id"),
    async run(tx, a, b) {
      const v = await get(
          tx,
          a,
          "ordem_versao",
          s(b, "ordem_versao_id"),
          "id,unidade_id,episodio_id",
        ),
        id = randomUUID();
      await tx.query(
        "INSERT INTO programacao(id,organizacao_id,unidade_id,episodio_id,ordem_versao_id,prevista_em,autor_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          a.organizacao_id,
          v.unidade_id,
          v.episodio_id,
          v.id,
          b.prevista_em,
          a.usuario_id,
        ],
      );
      return { id };
    },
  },
  {
    path: "/clinica/programacoes/:id/nao-executar",
    input: "motivo",
    permission: "clinica:programar",
    scope: scoped("programacao"),
    async run(tx, a, b, id) {
      const p = await get(tx, a, "programacao", id, "episodio_id");
      await episodeLock(tx, a, p.episodio_id);
      await one(
        tx,
        "UPDATE programacao SET situacao='nao_executada',motivo_nao_execucao=$3,encerrada_por_id=$4,encerrada_em=now() WHERE organizacao_id=$1 AND id=$2 AND situacao='prevista' RETURNING id",
        [a.organizacao_id, id, b.motivo, a.usuario_id],
      );
      return { id };
    },
  },
  {
    path: "/clinica/execucoes",
    input: "clinicalExecution",
    permission: "clinica:executar",
    scope: scoped("ordem_versao", "ordem_versao_id"),
    run: (tx, a, b) => execution(tx, a, b),
  },
  {
    path: "/clinica/execucoes/:id/retificar",
    input: "clinicalCorrection",
    permission: "clinica:retificar",
    scope: scoped("execucao"),
    run: (tx, a, b, id) => execution(tx, a, b, id),
  },
  {
    path: "/clinica/consumos",
    input: "clinicalConsumption",
    permission: "clinica:consumir",
    scope: scoped("episodio", "episodio_id"),
    async run(tx, a, b, _id, cmd) {
      const ep = await episodeLock(tx, a, s(b, "episodio_id"));
      await authorize(tx, a, "estoque:movimentar", ep.unidade_id);
      const items = b.itens as {
        posicao_id: string;
        quantidade_base: string;
      }[];
      const positions = items.map((i) => i.posicao_id).sort();
      if (new Set(positions).size !== positions.length)
        throw new DomainError(400, "posicao_repetida_no_consumo");
      const id = randomUUID(),
        when = occurred(s(b, "ocorrido_em"));
      await tx.query(
        "INSERT INTO consumo(id,organizacao_id,unidade_id,episodio_id,execucao_id,evento_referencia,ocorrido_em,autor_id,finalidade,motivo,itens_confirmados,comando_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [
          id,
          a.organizacao_id,
          ep.unidade_id,
          ep.id,
          b.execucao_id ?? null,
          b.evento_referencia,
          when,
          a.usuario_id,
          b.finalidade,
          b.motivo,
          b.itens_confirmados,
          cmd,
        ],
      );
      const movements = (
        await recordMany(
          tx,
          a,
          cmd,
          [...items]
            .sort((x, y) => x.posicao_id.localeCompare(y.posicao_id))
            .map((item) => ({
              tipo: "consumo",
              origem: item.posicao_id,
              quantidade: item.quantidade_base,
              contra: "consumido",
              ocorrido: when,
              motivo: s(b, "motivo"),
            })),
          ep.unidade_id,
        )
      ).map((m) => m.id);
      await tx.query(
        `INSERT INTO consumo_item(id,organizacao_id,unidade_id,consumo_id,lancamento_id,transacao_id,posicao_id,quantidade_base,custo_total_snapshot)
      SELECT gen_random_uuid(),t.organizacao_id,t.unidade_id,$3,l.id,t.id,t.origem_id,t.quantidade_base,t.quantidade_base*t.custo_base_snapshot
      FROM transacao_estoque t JOIN lancamento_estoque l ON l.organizacao_id=t.organizacao_id AND l.transacao_id=t.id AND l.lado=-1 WHERE t.organizacao_id=$1 AND t.id=ANY($2::uuid[])`,
        [a.organizacao_id, movements, id],
      );
      if (b.execucao_id)
        await resolveMaterial(
          tx,
          a,
          s(b, "execucao_id"),
          id,
          null,
          s(b, "motivo"),
        );
      const quality = await tx.query(
        `SELECT bool_or(c.tipo='hospital' AND l.custo_base IS NULL) AS custo_pendente,
      bool_or(l.situacao_validade='pendente' OR l.validade<($3::timestamptz AT TIME ZONE u.fuso)::date OR (p.recipiente_id IS NOT NULL AND (r.validade_apos_abertura IS NULL OR r.validade_apos_abertura<=$3::timestamptz OR r.aberto_em>$3::timestamptz))) AS validade_pendente
      FROM posicao_estoque p JOIN lote l ON l.organizacao_id=p.organizacao_id AND l.id=p.lote_id
      JOIN custodia c ON c.organizacao_id=p.organizacao_id AND c.id=p.custodia_id JOIN unidade_hospitalar u ON u.organizacao_id=p.organizacao_id AND u.id=p.unidade_id
      LEFT JOIN recipiente r ON r.organizacao_id=p.organizacao_id AND r.id=p.recipiente_id WHERE p.organizacao_id=$1 AND p.id=ANY($2::uuid[])`,
        [a.organizacao_id, positions, when],
      );
      if (quality.rows[0].custo_pendente)
        await pending(
          tx,
          a,
          ep.unidade_id,
          "custo_desconhecido",
          "consumo_id",
          id,
          "Consumo físico conciliado com custo hospitalar desconhecido; não interpretar como zero",
        );
      if (quality.rows[0].validade_pendente)
        await pending(
          tx,
          a,
          ep.unidade_id,
          "validade_material",
          "consumo_id",
          id,
          "Uso declarado com validade pendente ou incompatível no instante ocorrido; revisão humana necessária",
        );
      return { id };
    },
  },
  {
    path: "/clinica/consumos/:id/reverter",
    input: "clinicalReversal",
    permission: "clinica:reverter_consumo",
    scope: scoped("consumo"),
    async run(tx, a, b, id, cmd) {
      const c = await get(
        tx,
        a,
        "consumo",
        id,
        "unidade_id,episodio_id,execucao_id",
      );
      await episodeLock(tx, a, c.episodio_id);
      await authorize(tx, a, "estoque:reverter", c.unidade_id);
      await authorize(tx, a, "estoque:movimentar", c.unidade_id);
      const items = await tx.query(
        `SELECT t.id,t.raiz_id,t.origem_id,t.quantidade_base FROM consumo_item i JOIN transacao_estoque t ON t.organizacao_id=i.organizacao_id AND t.id=i.transacao_id WHERE i.organizacao_id=$1 AND i.consumo_id=$2 ORDER BY t.raiz_id`,
        [a.organizacao_id, id],
      );
      for (const t of items.rows)
        await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          `estoque-raiz:${a.organizacao_id}:${t.raiz_id}`,
        ]);
      await tx.query(
        "SELECT id FROM posicao_estoque WHERE organizacao_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE",
        [a.organizacao_id, items.rows.map((t) => t.origem_id)],
      );
      const reversal = randomUUID(),
        when = occurred(s(b, "ocorrido_em"));
      await tx.query(
        "INSERT INTO estorno_consumo(id,organizacao_id,unidade_id,consumo_id,autor_id,ocorrido_em,motivo) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          reversal,
          a.organizacao_id,
          c.unidade_id,
          id,
          a.usuario_id,
          when,
          b.motivo,
        ],
      );
      for (const t of items.rows)
        await record(tx, a, cmd, {
          tipo: "reversao",
          destino: t.origem_id,
          quantidade: t.quantidade_base,
          contra: "consumido",
          raiz: t.raiz_id,
          reversao: t.id,
          ocorrido: when,
          motivo: s(b, "motivo"),
        });
      if (c.execucao_id)
        await pending(
          tx,
          a,
          c.unidade_id,
          "material_nao_identificado",
          "execucao_id",
          c.execucao_id,
          "Consumo estornado; execução preservada e materiais novamente pendentes",
        );
      return { id: reversal };
    },
  },
  {
    path: "/clinica/pendencias/:id/revisar",
    input: "motivo",
    permission: "clinica:revisar",
    scope: scoped("pendencia_clinica"),
    async run(tx, a, b, id) {
      const p = await get(tx, a, "pendencia_clinica", id, "unidade_id,tipo");
      if (p.tipo === "material_nao_identificado")
        throw new DomainError(409, "identifique_consumo_ou_retifique_execucao");
      const resolution = randomUUID();
      await tx.query(
        "INSERT INTO resolucao_pendencia_clinica(id,organizacao_id,unidade_id,pendencia_id,autor_id,motivo) VALUES($1,$2,$3,$4,$5,$6)",
        [
          resolution,
          a.organizacao_id,
          p.unidade_id,
          id,
          a.usuario_id,
          b.motivo,
        ],
      );
      return { id: resolution };
    },
  },
];
export const clinicalLists = [
  { path: "/clinica/itens", table: "item_clinico", columns: "id,nome,tipo" },
  {
    path: "/clinica/materiais-previstos",
    table: "material_previsto",
    columns:
      "id,item_clinico_id,produto_id,versao,quantidade_base,criterio,aprovado_por_id,aprovado_em",
  },
  {
    path: "/clinica/prescricoes",
    table: "prescricao",
    columns:
      "id,unidade_id,episodio_id,prescritor_id,assinada_em,registrada_em,motivo",
    unit: true,
  },
  {
    path: "/clinica/ordens",
    table: "ordem",
    columns: "id,unidade_id,episodio_id,prescricao_id",
    unit: true,
  },
  {
    path: "/clinica/ordem-versoes",
    table: "ordem_versao",
    columns:
      "id,unidade_id,episodio_id,ordem_id,versao,item_clinico_id,quantidade_prescrita,unidade_medida_id,via,orientacao,vigencia_inicio,vigencia_fim,autor_id,registrada_em,motivo",
    unit: true,
  },
  {
    path: "/clinica/programacoes",
    table: "programacao_consulta",
    columns:
      "id,unidade_id,episodio_id,ordem_versao_id,prevista_em,criada_em,autor_id,situacao,estado_execucao,motivo_nao_execucao,encerrada_por_id,encerrada_em",
    unit: true,
  },
  {
    path: "/clinica/execucoes",
    table: "execucao_consulta",
    columns:
      "id,unidade_id,episodio_id,ordem_versao_id,programacao_id,evento_referencia,correcao_de_id,executor_id,executada_em,registrada_em,quantidade_aplicada,unidade_medida_id,resultado,situacao_material,motivo,substituida_por_id,conciliacao_material,anulacao_id",
    unit: true,
  },
  {
    path: "/clinica/consumos",
    table: "consumo_consulta",
    columns:
      "id,unidade_id,episodio_id,execucao_id,evento_referencia,ocorrido_em,registrado_em,autor_id,finalidade,motivo,comando_id,estorno_id,situacao",
    unit: true,
  },
  {
    path: "/clinica/consumo-itens",
    table: "consumo_item",
    columns:
      "id,unidade_id,consumo_id,lancamento_id,transacao_id,posicao_id,quantidade_base,custo_total_snapshot",
    unit: true,
  },
  {
    path: "/clinica/estornos",
    table: "estorno_consumo",
    columns:
      "id,unidade_id,consumo_id,autor_id,ocorrido_em,registrado_em,motivo",
    unit: true,
  },
  {
    path: "/clinica/pendencias",
    table: "pendencia_clinica_consulta",
    columns:
      "id,unidade_id,execucao_id,consumo_id,programacao_id,ordem_versao_id,tipo,descricao,criada_em,situacao,motivo_resolucao,resolvida_por_id,resolvida_em",
    unit: true,
  },
].map((list) => ({ ...list, permission: "clinica:ler" }));
