import { randomUUID } from "node:crypto";
import { authorize, DomainError, occurred, one } from "../core.ts";
import type { Body } from "../foundation.ts";
import { exact, decimal } from "../inventory/decimal.ts";
import { record } from "../inventory/service.ts";
import { currentAttempt, notFound, release, reserve } from "./allocation.ts";
import {
  employee,
  event,
  fail,
  get,
  insert,
  replayEvent,
  session,
} from "./shared.ts";
import type { Env } from "./shared.ts";
export async function expire(e: Env, s: Body) {
  if (s.closed_at || (s.expires_at as Date) > new Date())
    return s.state === "EXPIRED";
  if (s.entered_at) {
    if (!s.timeout_alerted_at) {
      await e.tx.query(
        "UPDATE tv1_session SET timeout_alerted_at=clock_timestamp() WHERE organizacao_id=$1 AND id=$2",
        [e.a.organizacao_id, s.id],
      );
      await event(e, "ACCESS_TIMEOUT_ALERTED", { access_session_id: s.id });
    }
    return false;
  }
  const attempts = (
    await e.tx.query(
      `SELECT a.reservation_id FROM tv1_attempt a JOIN tv1_task t ON (t.organizacao_id,t.id)=(a.organizacao_id,a.task_id)
    JOIN reserva r ON (r.organizacao_id,r.id)=(a.organizacao_id,a.reservation_id) WHERE a.organizacao_id=$1 AND t.access_session_id=$2 AND r.situacao='ativa' ORDER BY r.posicao_id`,
      [e.a.organizacao_id, s.id],
    )
  ).rows;
  for (const a of attempts) await release(e, a.reservation_id);
  await e.tx.query(
    "UPDATE tv1_session SET state='EXPIRED',closed_at=clock_timestamp() WHERE organizacao_id=$1 AND id=$2",
    [e.a.organizacao_id, s.id],
  );
  await event(e, "EXPIRED", { access_session_id: s.id });
  return true;
}
async function ready(e: Env, id: string) {
  const s = await get(e, "tv1_session", id);
  if (s.state !== "ENTRY_CONFIRMED" || s.sensitive_state !== "COMPLETED")
    return;
  const pending = await e.tx.query(
    "SELECT 1 FROM tv1_task WHERE organizacao_id=$1 AND access_session_id=$2 AND status IN ('PENDING','EXCEPTION') LIMIT 1",
    [e.a.organizacao_id, id],
  );
  if (!pending.rowCount) {
    await e.tx.query(
      "UPDATE tv1_session SET state='PICKING_READY' WHERE organizacao_id=$1 AND id=$2",
      [e.a.organizacao_id, id],
    );
    await event(e, "PICKING_READY", { access_session_id: id });
  }
}
function eventTime(e: Env, s: Body) {
  const when = occurred(e.b.occurred_at as string);
  if (Date.parse(when) < (s.criada_em as Date).getTime())
    fail("evento_anterior_a_sessao", 400);
  return when;
}
async function orderedEvent(e: Env, id: string, when: string) {
  const newer = await e.tx.query(
    "SELECT 1 FROM tv1_event WHERE organizacao_id=$1 AND access_session_id=$2 AND NOT automatic AND occurred_at>$3 LIMIT 1",
    [e.a.organizacao_id, id, when],
  );
  if (newer.rowCount) fail("evento_fora_de_ordem");
}
export async function picking(e: Env, id: string) {
  const s = await session(e, id, "PICKING");
  if (await replayEvent(e, id)) return id;
  const when = eventTime(e, s);
  await orderedEvent(e, id, when);
  if (await expire(e, s)) return id;
  if (
    s.presence_cleared_at ||
    !["ENTRY_CONFIRMED", "PICKING_READY"].includes(s.state)
  )
    fail("checklist_bloqueado");
  await employee(e, s.employee_id);
  const task = await get(e, "tv1_task", e.b.task_id, true);
  if (task.access_session_id !== id) fail("tarefa_de_outra_sessao");
  const type = e.b.type as string;
  // Undo is a logical correction before exit; it never unlocks a cabinet.
  if (type !== "UNDO") {
    if (task.sensitive) {
      await employee(e, s.employee_id, "terminal:sensivel");
      if (s.sensitive_state !== "OPEN") fail("armario_sensivel_fechado");
    } else if (["GRANTED", "OPEN", "DOOR_CLOSED"].includes(s.sensitive_state))
      fail("separacao_comum_suspensa");
  }
  if (type === "UNDO") {
    if (!["CONFIRMED", "PARTIAL", "UNAVAILABLE"].includes(task.status))
      fail("tarefa_nao_resolvida");
    const a = await currentAttempt(e, task.id);
    await e.tx.query(
      "UPDATE tv1_task SET status=$3,confirmed_quantity=0 WHERE organizacao_id=$1 AND id=$2",
      [
        e.a.organizacao_id,
        task.id,
        a && exact(a.quantity) === exact(task.quantity)
          ? "PENDING"
          : "EXCEPTION",
      ],
    );
    await event(
      e,
      "PICKING_ITEM_UNDONE",
      { access_session_id: id, task_id: task.id },
      false,
      e.b,
    );
    await event(e, "PICKING_REOPENED", { access_session_id: id });
    await e.tx.query(
      "UPDATE tv1_session SET state='ENTRY_CONFIRMED',sensitive_state=CASE WHEN $3 AND sensitive_state='COMPLETED' THEN 'LOCKED' ELSE sensitive_state END WHERE organizacao_id=$1 AND id=$2",
      [e.a.organizacao_id, id, task.sensitive],
    );
    await event(e, "ENTRY_CONFIRMED", { access_session_id: id });
    return id;
  }
  if (!["PENDING", "EXCEPTION"].includes(task.status))
    fail("tarefa_ja_resolvida");
  if (type === "NOT_FOUND") await notFound(e, s, task);
  else {
    const a = await currentAttempt(e, task.id);
    let quantity = "0";
    if (type !== "UNAVAILABLE") {
      if (!a) fail("tarefa_sem_reserva");
      quantity = a.quantity;
      if (type === "CONFIRM" && exact(quantity) !== exact(task.quantity))
        fail("quantidade_exige_parcial");
      if (type === "PARTIAL" && exact(quantity) >= exact(task.quantity))
        fail("tarefa_nao_parcial");
    }
    await e.tx.query(
      "UPDATE tv1_task SET status=$3,confirmed_quantity=$4 WHERE organizacao_id=$1 AND id=$2",
      [
        e.a.organizacao_id,
        task.id,
        type === "CONFIRM" ? "CONFIRMED" : type,
        quantity,
      ],
    );
  }
  await event(
    e,
    `PICKING_ITEM_${type}`,
    { access_session_id: id, task_id: task.id },
    false,
    e.b,
  );
  await ready(e, id);
  return id;
}
export async function sensitive(e: Env, id: string) {
  const s = await session(e, id, "PICKING");
  if (await expire(e, s)) return id;
  if (
    s.state !== "ENTRY_CONFIRMED" ||
    s.presence_cleared_at ||
    s.sensitive_state !== "LOCKED" ||
    !s.sensitive_access_eligible
  )
    fail("solicitacao_sensivel_invalida");
  await employee(e, s.employee_id, "terminal:sensivel");
  const r = await get(e, "tv1_room", s.room_id);
  await event(
    e,
    "SENSITIVE_ACCESS_REQUESTED",
    { access_session_id: id },
    false,
  );
  await e.tx.query(
    "UPDATE tv1_session SET sensitive_state='GRANTED',unlock_until=clock_timestamp()+make_interval(secs=>$3) WHERE organizacao_id=$1 AND id=$2",
    [e.a.organizacao_id, id, r.unlock_seconds],
  );
  await event(e, "SENSITIVE_ACCESS_GRANTED", { access_session_id: id });
  return id;
}
export async function physical(e: Env, id: string) {
  const s = await session(e, id, "CONTROLLER");
  if (await replayEvent(e, id)) return id;
  const when = eventTime(e, s);
  await orderedEvent(e, id, when);
  if (await expire(e, s)) return id;
  if (s.closed_at) fail("sessao_encerrada");
  const type = e.b.type as string;
  if (type === "DOOR_OPEN") {
    if (!["DOOR_AUTHORIZED", "PICKING_READY"].includes(s.state))
      fail("abertura_fora_de_sequencia");
    if (s.state === "DOOR_AUTHORIZED")
      await e.tx.query(
        "UPDATE tv1_session SET state='DOOR_OPEN' WHERE organizacao_id=$1 AND id=$2",
        [e.a.organizacao_id, id],
      );
  } else if (type === "ENTRY_CONFIRMED") {
    if (s.state !== "DOOR_OPEN") fail("entrada_fora_de_sequencia");
    await e.tx.query(
      "UPDATE tv1_session SET state='ENTRY_CONFIRMED',entered_at=$3 WHERE organizacao_id=$1 AND id=$2",
      [e.a.organizacao_id, id, when],
    );
  } else if (type === "PRESENCE_CLEARED") {
    if (s.state !== "PICKING_READY" || s.sensitive_state !== "COMPLETED")
      fail("saida_antes_de_separacao");
    await e.tx.query(
      "UPDATE tv1_session SET state='EXIT_CONFIRMED',presence_cleared_at=$3 WHERE organizacao_id=$1 AND id=$2",
      [e.a.organizacao_id, id, when],
    );
    await event(e, "EXIT_CONFIRMED", { access_session_id: id });
  } else if (type === "DOOR_CLOSED") {
    if (s.state === "EXIT_CONFIRMED" || s.state === "READY_TO_CONFIRM") {
      await e.tx.query(
        "UPDATE tv1_session SET state='READY_TO_CONFIRM',door_closed_at=coalesce(door_closed_at,$3) WHERE organizacao_id=$1 AND id=$2",
        [e.a.organizacao_id, id, when],
      );
    } else if (!["ENTRY_CONFIRMED", "PICKING_READY"].includes(s.state))
      fail("fechamento_fora_de_sequencia");
  } else {
    if (s.state !== "ENTRY_CONFIRMED" || s.presence_cleared_at)
      fail("evento_sensivel_fora_de_sequencia");
    if (type === "SENSITIVE_DOOR_OPENED") {
      if (
        s.sensitive_state !== "GRANTED" ||
        s.unlock_until <= new Date() ||
        Date.parse(when) > s.unlock_until.getTime()
      )
        fail("janela_de_desbloqueio_expirada");
      await e.tx.query(
        "UPDATE tv1_session SET sensitive_state='OPEN' WHERE organizacao_id=$1 AND id=$2",
        [e.a.organizacao_id, id],
      );
    } else if (type === "SENSITIVE_DOOR_CLOSED") {
      if (
        s.sensitive_state !== "OPEN" &&
        !(s.sensitive_state === "GRANTED" && s.unlock_until <= new Date())
      )
        fail("armario_nao_aberto");
      await e.tx.query(
        "UPDATE tv1_session SET sensitive_state='DOOR_CLOSED' WHERE organizacao_id=$1 AND id=$2",
        [e.a.organizacao_id, id],
      );
    } else if (type === "SENSITIVE_LOCK_CONFIRMED") {
      if (s.sensitive_state !== "DOOR_CLOSED")
        fail("fechamento_fisico_ausente");
      const unfinished = await e.tx.query(
        "SELECT 1 FROM tv1_task WHERE organizacao_id=$1 AND access_session_id=$2 AND sensitive AND status IN ('PENDING','EXCEPTION') LIMIT 1",
        [e.a.organizacao_id, id],
      );
      await e.tx.query(
        "UPDATE tv1_session SET sensitive_state=$3,unlock_until=NULL WHERE organizacao_id=$1 AND id=$2",
        [e.a.organizacao_id, id, unfinished.rowCount ? "LOCKED" : "COMPLETED"],
      );
      if (!unfinished.rowCount)
        await event(e, "SENSITIVE_ACCESS_COMPLETED", { access_session_id: id });
    }
  }
  await event(e, type, { access_session_id: id }, false, e.b);
  await ready(e, id);
  if (type === "DOOR_CLOSED" && s.presence_cleared_at) await confirm(e, id);
  return id;
}
async function settle(e: Env, id: string) {
  const s = await get(e, "tv1_session", id);
  if (s.state === "CLOSED") return;
  if (
    s.state !== "READY_TO_CONFIRM" ||
    !s.door_closed_at ||
    !s.presence_cleared_at ||
    s.sensitive_state !== "COMPLETED"
  )
    fail("saida_fisica_incompleta");
  await authorize(e.tx, e.a, "estoque:movimentar", e.b.unidade_id as string);
  const tasks = (
    await e.tx.query(
      "SELECT * FROM tv1_task WHERE organizacao_id=$1 AND access_session_id=$2 ORDER BY allocation_rank",
      [e.a.organizacao_id, id],
    )
  ).rows;
  if (tasks.some((t) => ["PENDING", "EXCEPTION"].includes(t.status)))
    fail("checklist_incompleto");
  const room = await get(e, "tv1_room", s.room_id);
  const moves: {
    task: string;
    attempt: string;
    origin: string;
    destination: string;
    reservation: string;
    quantity: string;
  }[] = [];
  for (const t of tasks) {
    const a = await currentAttempt(e, t.id);
    if (exact(t.confirmed_quantity) > 0n) {
      if (!a || exact(a.quantity) !== exact(t.confirmed_quantity))
        fail("reserva_divergente_da_separacao");
      const p = await get(e, "posicao_estoque", a.position_id);
      await e.tx.query(
        `INSERT INTO posicao_estoque(id,organizacao_id,unidade_id,local_id,lote_id,recipiente_id,custodia_id)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(organizacao_id,local_id,lote_id,recipiente_id,custodia_id) DO NOTHING`,
        [
          randomUUID(),
          e.a.organizacao_id,
          e.b.unidade_id,
          room.transit_local_id,
          p.lote_id,
          p.recipiente_id,
          p.custodia_id,
        ],
      );
      const d = await one(
        e.tx,
        "SELECT id FROM posicao_estoque WHERE organizacao_id=$1 AND local_id=$2 AND lote_id=$3 AND recipiente_id IS NOT DISTINCT FROM $4::uuid AND custodia_id=$5",
        [
          e.a.organizacao_id,
          room.transit_local_id,
          p.lote_id,
          p.recipiente_id,
          p.custodia_id,
        ],
      );
      moves.push({
        task: t.id,
        attempt: a.id,
        origin: p.id,
        destination: d.id,
        reservation: a.reservation_id,
        quantity: t.confirmed_quantity,
      });
    }
  }
  const attempts = (
    await e.tx.query(
      `SELECT a.reservation_id,r.posicao_id FROM tv1_attempt a JOIN tv1_task t ON (t.organizacao_id,t.id)=(a.organizacao_id,a.task_id)
    JOIN reserva r ON (r.organizacao_id,r.id)=(a.organizacao_id,a.reservation_id) WHERE a.organizacao_id=$1 AND t.access_session_id=$2 AND r.situacao='ativa' ORDER BY r.posicao_id`,
      [e.a.organizacao_id, id],
    )
  ).rows;
  const positions = [
    ...new Set([
      ...attempts.map((a) => a.posicao_id),
      ...moves.flatMap((m) => [m.origin, m.destination]),
    ]),
  ].sort();
  await e.tx.query(
    "SELECT id FROM posicao_estoque WHERE organizacao_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE",
    [e.a.organizacao_id, positions],
  );
  for (const a of attempts) await release(e, a.reservation_id);
  // Original reservations are facts. After a long physical presence their leases
  // may be past due: replace under the same position locks; never rewrite expiry.
  for (const m of moves) {
    const reservation = await reserve(e, m.origin, m.quantity);
    await e.tx.query(
      "UPDATE reserva SET situacao='efetivada',encerrada_em=clock_timestamp(),encerrada_por_id=$3,motivo=$4 WHERE organizacao_id=$1 AND id=$2",
      [e.a.organizacao_id, reservation, e.a.usuario_id, e.b.motivo],
    );
    const result = await record(e.tx, e.a, e.cmd, {
      tipo: "retirada",
      origem: m.origin,
      destino: m.destination,
      quantidade: m.quantity,
      ocorrido: s.door_closed_at.toISOString(),
      motivo: e.b.motivo as string,
      reserva: reservation,
    });
    await insert(e, "tv1_movement", {
      task_id: m.task,
      attempt_id: m.attempt,
      transaction_id: result.id,
    });
  }
  const totals = new Map<string, bigint>();
  for (const t of tasks) {
    let remaining = exact(t.confirmed_quantity);
    const sources = (
      await e.tx.query(
        "SELECT * FROM tv1_source WHERE organizacao_id=$1 AND task_id=$2 ORDER BY source_rank,id",
        [e.a.organizacao_id, t.id],
      )
    ).rows;
    for (const source of sources) {
      const qty =
        remaining < exact(source.quantity) ? remaining : exact(source.quantity);
      totals.set(source.demand_id, (totals.get(source.demand_id) ?? 0n) + qty);
      remaining -= qty;
    }
    if (remaining) fail("distribuicao_de_origens_invalida");
  }
  const demands = (
    await e.tx.query(
      "SELECT * FROM tv1_demand WHERE organizacao_id=$1 AND context_id=$2 ORDER BY source_rank",
      [e.a.organizacao_id, s.context_id],
    )
  ).rows;
  for (const d of demands) {
    const qty = totals.get(d.id) ?? 0n;
    await insert(e, "tv1_fulfillment", {
      access_session_id: id,
      demand_id: d.id,
      requested_quantity: d.quantity,
      confirmed_quantity: decimal(qty),
      status:
        qty === exact(d.quantity)
          ? "COMPLETE"
          : qty
            ? "PARTIAL"
            : "UNAVAILABLE",
    });
  }
  await event(e, "WITHDRAWAL_CONFIRMED", { access_session_id: id });
  await e.tx.query(
    "UPDATE tv1_session SET state='CLOSED',closed_at=clock_timestamp() WHERE organizacao_id=$1 AND id=$2",
    [e.a.organizacao_id, id],
  );
  await event(e, "CLOSED", { access_session_id: id });
}
async function confirm(e: Env, id: string) {
  await e.tx.query("SAVEPOINT tv1_confirmation");
  try {
    await settle(e, id);
    // Include deferred ledger checks in the recoverable section.
    await e.tx.query("SET CONSTRAINTS ALL IMMEDIATE");
    await e.tx.query("SET CONSTRAINTS ALL DEFERRED");
    await e.tx.query("RELEASE SAVEPOINT tv1_confirmation");
  } catch (error) {
    await e.tx.query("ROLLBACK TO SAVEPOINT tv1_confirmation");
    await e.tx.query("RELEASE SAVEPOINT tv1_confirmation");
    const code =
      error instanceof DomainError ? error.code : "falha_tecnica_confirmacao";
    await event(e, "WITHDRAWAL_CONFIRMATION_FAILED", {
      access_session_id: id,
      error_code: code,
    });
  }
}
export async function recover(e: Env, id: string) {
  const s = await session(e, id, "CONTROLLER");
  if (await expire(e, s)) return id;
  if (s.state === "READY_TO_CONFIRM") await confirm(e, id);
  else if (s.sensitive_state === "GRANTED" && s.unlock_until <= new Date()) {
    // Elapsed time is not physical lock evidence. Keep ordinary picking
    // suspended until the controller supplies closed + lock confirmed.
    const logged = await e.tx.query(
      "SELECT 1 FROM tv1_event WHERE organizacao_id=$1 AND access_session_id=$2 AND type='SENSITIVE_UNLOCK_WINDOW_EXPIRED' AND occurred_at>=$3",
      [e.a.organizacao_id, id, s.unlock_until],
    );
    if (!logged.rowCount)
      await event(e, "SENSITIVE_UNLOCK_WINDOW_EXPIRED", {
        access_session_id: id,
      });
  }
  return id;
}
