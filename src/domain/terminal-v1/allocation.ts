import { randomUUID } from "node:crypto";
import { exact, decimal } from "../inventory/decimal.ts";
import { one } from "../core.ts";
import { event, fail, insert } from "./shared.ts";
import type { Env } from "./shared.ts";
import type { Body } from "../foundation.ts";
export async function candidates(
  e: Env,
  room: string,
  product: string,
  excluded: string[] = [],
) {
  // Lock positions in UUID order before sorting by business priority. No SKIP LOCKED:
  // transient contention must not silently select a later-expiring lot.
  await e.tx.query(
    `SELECT p.id FROM posicao_estoque p JOIN tv1_occupancy o ON (o.organizacao_id,o.position_id)=(p.organizacao_id,p.id)
    JOIN tv1_coordinate c ON (c.organizacao_id,c.id)=(o.organizacao_id,o.coordinate_id)
    JOIN lote l ON (l.organizacao_id,l.id)=(p.organizacao_id,p.lote_id)
    WHERE p.organizacao_id=$1 AND c.room_id=$2 AND l.produto_id=$3 AND o.released_at IS NULL ORDER BY p.id FOR UPDATE OF p`,
    [e.a.organizacao_id, room, product],
  );
  return (
    await e.tx.query(
      `SELECT o.id occupancy_id,p.id position_id,p.lote_id lot_id,p.disponivel_base quantity,l.validade,l.codigo lot_code,o.received_at,c.id location_id,c.code location_code
    FROM tv1_occupancy o JOIN tv1_coordinate c ON (c.organizacao_id,c.id)=(o.organizacao_id,o.coordinate_id)
    JOIN posicao_estoque p ON (p.organizacao_id,p.id)=(o.organizacao_id,o.position_id)
    JOIN lote l ON (l.organizacao_id,l.id)=(p.organizacao_id,p.lote_id)
    JOIN custodia k ON (k.organizacao_id,k.id)=(p.organizacao_id,p.custodia_id)
    JOIN tv1_product_policy policy ON (policy.organizacao_id,policy.product_id)=(l.organizacao_id,l.produto_id)
    JOIN unidade_hospitalar u ON (u.organizacao_id,u.id)=(o.organizacao_id,o.unidade_id)
    LEFT JOIN recipiente r ON (r.organizacao_id,r.id)=(p.organizacao_id,p.recipiente_id)
    WHERE o.organizacao_id=$1 AND c.room_id=$2 AND l.produto_id=$3 AND o.released_at IS NULL
    AND policy.sensitive=c.sensitive AND k.tipo='hospital' AND p.disponivel_base>0 AND NOT(l.id=ANY($4::uuid[]))
    AND l.situacao_validade<>'pendente' AND (l.validade IS NULL OR l.validade>=(clock_timestamp() AT TIME ZONE u.fuso)::date)
    AND (p.recipiente_id IS NULL OR r.validade_apos_abertura>clock_timestamp())
    ORDER BY l.validade ASC NULLS LAST,o.received_at,l.id,p.id`,
      [e.a.organizacao_id, room, product, excluded],
    )
  ).rows;
}
export async function reserve(e: Env, position: string, quantity: string) {
  const id = randomUUID();
  await e.tx.query(
    `INSERT INTO reserva(id,organizacao_id,unidade_id,posicao_id,quantidade_base,expira_em,autor_id,motivo)
    VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '24 hours',$6,$7)`,
    [
      id,
      e.a.organizacao_id,
      e.b.unidade_id,
      position,
      quantity,
      e.a.usuario_id,
      e.b.motivo,
    ],
  );
  return id;
}
export async function release(e: Env, reservation: string) {
  await e.tx.query(
    `UPDATE reserva SET situacao='liberada',encerrada_em=clock_timestamp(),encerrada_por_id=$3,motivo=$4 WHERE organizacao_id=$1 AND id=$2 AND situacao='ativa'`,
    [e.a.organizacao_id, reservation, e.a.usuario_id, e.b.motivo],
  );
}
export async function attempt(
  e: Env,
  taskId: string,
  occupancy: string,
  position: string,
  quantity: string,
) {
  const rank = (
    await one(
      e.tx,
      "SELECT coalesce(max(attempt_rank),0)+1 n FROM tv1_attempt WHERE organizacao_id=$1 AND task_id=$2",
      [e.a.organizacao_id, taskId],
    )
  ).n;
  return insert(e, "tv1_attempt", {
    task_id: taskId,
    occupancy_id: occupancy,
    reservation_id: await reserve(e, position, quantity),
    quantity,
    attempt_rank: rank,
  });
}
export async function currentAttempt(e: Env, taskId: string) {
  return (
    await e.tx.query(
      `SELECT a.*,o.position_id,o.coordinate_id,p.lote_id lot_id FROM tv1_attempt a
    JOIN tv1_occupancy o ON (o.organizacao_id,o.id)=(a.organizacao_id,a.occupancy_id)
    JOIN posicao_estoque p ON (p.organizacao_id,p.id)=(o.organizacao_id,o.position_id)
    WHERE a.organizacao_id=$1 AND a.task_id=$2 AND NOT EXISTS(SELECT 1 FROM tv1_discrepancy d WHERE d.organizacao_id=a.organizacao_id AND d.attempt_id=a.id)
    ORDER BY a.attempt_rank DESC LIMIT 1`,
      [e.a.organizacao_id, taskId],
    )
  ).rows[0];
}
export async function allocate(
  e: Env,
  sessionId: string,
  context: string,
  room: string,
) {
  const demands = (
    await e.tx.query(
      `SELECT d.*,p.sensitive FROM tv1_demand d JOIN tv1_product_policy p ON (p.organizacao_id,p.product_id)=(d.organizacao_id,d.product_id)
    WHERE d.organizacao_id=$1 AND d.context_id=$2 ORDER BY d.source_rank`,
      [e.a.organizacao_id, context],
    )
  ).rows;
  let rank = 0;
  const products = [
    ...new Set(demands.map((d) => d.product_id as string)),
  ].sort();
  for (const product of products) {
    const sources = demands
      .filter((d) => d.product_id === product)
      .map((d) => ({ ...d, remaining: exact(d.quantity) }));
    let remaining = sources.reduce((n, d) => n + d.remaining, 0n);
    const choices = await candidates(e, room, product);
    const parts: { qty: bigint; candidate?: (typeof choices)[number] }[] = [];
    for (const c of choices) {
      const qty = remaining < exact(c.quantity) ? remaining : exact(c.quantity);
      if (qty <= 0n) break;
      parts.push({ qty, candidate: c });
      remaining -= qty;
    }
    if (remaining) parts.push({ qty: remaining });
    for (const p of parts) {
      const task = await insert(e, "tv1_task", {
        access_session_id: sessionId,
        product_id: product,
        quantity: decimal(p.qty),
        allocation_rank: ++rank,
        sensitive: sources[0].sensitive,
        status: p.candidate ? "PENDING" : "EXCEPTION",
      });
      if (p.candidate)
        await attempt(
          e,
          task,
          p.candidate.occupancy_id,
          p.candidate.position_id,
          decimal(p.qty),
        );
      let needed = p.qty;
      for (const d of sources) {
        const qty = needed < d.remaining ? needed : d.remaining;
        if (qty > 0n)
          await insert(e, "tv1_source", {
            task_id: task,
            demand_id: d.id,
            quantity: decimal(qty),
            source_rank: d.source_rank,
          });
        needed -= qty;
        d.remaining -= qty;
        if (!needed) break;
      }
    }
  }
}
export async function notFound(e: Env, s: Body, task: Body) {
  const old = await currentAttempt(e, task.id as string);
  if (!old) fail("tarefa_sem_lote_para_divergencia");
  await insert(e, "tv1_discrepancy", { task_id: task.id, attempt_id: old.id });
  await event(e, "STOCK_LOCATION_DISCREPANCY", {
    access_session_id: s.id,
    task_id: task.id,
  });
  await release(e, old.reservation_id);
  const failed = (
    await e.tx.query(
      `SELECT DISTINCT p.lote_id FROM tv1_discrepancy d JOIN tv1_attempt a ON (a.organizacao_id,a.id)=(d.organizacao_id,d.attempt_id)
    JOIN tv1_occupancy o ON (o.organizacao_id,o.id)=(a.organizacao_id,a.occupancy_id)
    JOIN posicao_estoque p ON (p.organizacao_id,p.id)=(o.organizacao_id,o.position_id) WHERE d.organizacao_id=$1 AND d.task_id=$2`,
      [e.a.organizacao_id, task.id],
    )
  ).rows.map((r) => r.lote_id);
  const available = await candidates(
    e,
    s.room_id as string,
    task.product_id as string,
    failed,
  );
  const full = available.find(
    (c) => exact(c.quantity) >= exact(task.quantity as string),
  );
  // No second fragmentation. A smaller single-lot offer is explicit EXCEPTION,
  // and only a subsequent PARTIAL acceptance can fulfill that server-derived amount.
  const candidate = full ?? available[0];
  if (candidate) {
    await attempt(
      e,
      task.id as string,
      candidate.occupancy_id,
      candidate.position_id,
      full ? (task.quantity as string) : candidate.quantity,
    );
    await event(
      e,
      full ? "PICKING_LOT_REALLOCATED" : "PICKING_PARTIAL_OFFERED",
      { access_session_id: s.id, task_id: task.id },
    );
  }
  await e.tx.query(
    "UPDATE tv1_task SET status=$3,confirmed_quantity=0 WHERE organizacao_id=$1 AND id=$2",
    [e.a.organizacao_id, task.id, full ? "PENDING" : "EXCEPTION"],
  );
}
