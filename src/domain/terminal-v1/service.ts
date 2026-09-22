import { randomUUID } from "node:crypto";
import { authorize, digest, DomainError, one } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
import {
  device,
  employee,
  event,
  fail,
  get,
  insert,
  nfcActive,
  projection,
} from "./shared.ts";
import type { Env } from "./shared.ts";
import type { V1EvidenceAdapter } from "./evidence.ts";
import { allocate } from "./allocation.ts";
import { expire, physical, picking, recover, sensitive } from "./sessions.ts";
const scope: Action["scope"] = async (_tx, _a, b) => b.unidade_id as string;
function action(
  path: string,
  input: string,
  permission: string,
  work: (e: Env, id: string) => Promise<string>,
  deviceRequired = false,
): Action {
  return {
    path: `/terminal/v1${path}`,
    input,
    permission,
    scope,
    deviceRequired,
    async run(tx, a, b, id, cmd) {
      return { id: await work({ tx, a, b, cmd }, id) };
    },
  };
}
async function validAuth(e: Env, id: string) {
  const auth = await get(e, "tv1_auth", id);
  if (auth.expires_at <= new Date()) fail("autenticacao_expirada", 403);
  const challenge = await get(e, "tv1_challenge", auth.challenge_id);
  await nfcActive(e, challenge.nfc_id);
  await device(e, auth.room_id, "ACCESS");
  return auth;
}
export function terminalV1Actions(adapter?: V1EvidenceAdapter): Action[] {
  return [
    action("/rooms", "tv1Room", "acesso:administrar", async (e) => {
      const l = await one(
        e.tx,
        "SELECT tipo FROM local WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [e.a.organizacao_id, e.b.unidade_id, e.b.local_id],
      );
      if (l.tipo !== "sala") fail("local_deve_ser_sala");
      const destination = await e.tx.query(
        "SELECT 1 FROM tv1_coordinate WHERE organizacao_id=$1 AND local_id=$2 UNION ALL SELECT 1 FROM tv1_room WHERE organizacao_id=$1 AND local_id=$2",
        [e.a.organizacao_id, e.b.transit_local_id],
      );
      if (destination.rowCount) fail("destino_controlado_invalido");
      return insert(e, "tv1_room", {
        local_id: e.b.local_id,
        transit_local_id: e.b.transit_local_id,
        unlock_seconds: e.b.unlock_seconds,
        session_seconds: e.b.session_seconds,
      });
    }),
    action("/devices", "tv1Device", "acesso:administrar", async (e) => {
      if (!adapter) return fail("adaptador_indisponivel", 503);
      await one(
        e.tx,
        "SELECT id FROM dispositivo WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3 AND ativo",
        [e.a.organizacao_id, e.b.unidade_id, e.b.device_id],
      );
      await one(
        e.tx,
        "SELECT id FROM credencial WHERE organizacao_id=$1 AND id=$2 AND tipo='api' AND revogada_em IS NULL AND expira_em>clock_timestamp()",
        [e.a.organizacao_id, e.b.credential_id],
      );
      return insert(e, "tv1_device", {
        room_id: e.b.room_id,
        device_id: e.b.device_id,
        credential_id: e.b.credential_id,
        role: e.b.role,
        mode: e.b.mode,
      });
    }),
    action("/employee-nfc", "tv1Nfc", "acesso:administrar", async (e) => {
      await employee(e, e.b.employee_id as string);
      return insert(e, "tv1_nfc", {
        employee_id: e.b.employee_id,
        tag_digest: digest(e.b.tag as string),
      });
    }),
    action(
      "/employee-nfc/:id/revoke",
      "tv1Common",
      "acesso:administrar",
      async (e, id) => {
        await get(e, "tv1_nfc", id);
        await e.tx.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('tv1:nfc:'||$1::text,0))",
          [id],
        );
        return insert(e, "tv1_nfc_revocation", { nfc_id: id });
      },
    ),
    action("/product-policies", "tv1Policy", "estoque:catalogar", (e) =>
      insert(e, "tv1_product_policy", {
        product_id: e.b.product_id,
        sensitive: e.b.sensitive,
      }),
    ),
    action("/coordinates", "tv1Coordinate", "estoque:catalogar", async (e) => {
      await authorize(e.tx, e.a, "locais:escrever", e.b.unidade_id as string);
      const room = await get(e, "tv1_room", e.b.room_id);
      const local = randomUUID();
      await e.tx.query(
        "INSERT INTO local(id,organizacao_id,unidade_id,pai_id,nome,tipo,capacidade) VALUES($1,$2,$3,$4,$5,'armario',0)",
        [local, e.a.organizacao_id, e.b.unidade_id, room.local_id, e.b.code],
      );
      return insert(e, "tv1_coordinate", {
        room_id: room.id,
        local_id: local,
        code: e.b.code,
        sensitive: e.b.sensitive,
      });
    }),
    action("/occupancies", "tv1Occupancy", "estoque:movimentar", async (e) => {
      const c = await get(e, "tv1_coordinate", e.b.coordinate_id, true);
      const p = await one(
        e.tx,
        `SELECT p.*,l.produto_id,k.tipo FROM posicao_estoque p JOIN lote l ON (l.organizacao_id,l.id)=(p.organizacao_id,p.lote_id)
        JOIN custodia k ON (k.organizacao_id,k.id)=(p.organizacao_id,p.custodia_id) WHERE p.organizacao_id=$1 AND p.unidade_id=$2 AND p.id=$3 FOR UPDATE OF p`,
        [e.a.organizacao_id, e.b.unidade_id, e.b.position_id],
      );
      const policy = await one(
        e.tx,
        "SELECT sensitive FROM tv1_product_policy WHERE organizacao_id=$1 AND product_id=$2",
        [e.a.organizacao_id, p.produto_id],
      );
      if (
        c.local_id !== p.local_id ||
        c.sensitive !== policy.sensitive ||
        p.tipo !== "hospital"
      )
        fail("ocupacao_incompativel");
      const receipt = await one(
        e.tx,
        `SELECT min(t.ocorrido_em) received_at FROM transacao_estoque t JOIN posicao_estoque p ON (p.organizacao_id,p.id)=(t.organizacao_id,t.destino_id)
        WHERE t.organizacao_id=$1 AND t.unidade_id=$2 AND p.lote_id=$3 AND t.tipo='entrada' HAVING count(*)>0`,
        [e.a.organizacao_id, e.b.unidade_id, p.lote_id],
      );
      return insert(e, "tv1_occupancy", {
        coordinate_id: c.id,
        position_id: p.id,
        received_at: receipt.received_at,
      });
    }),
    action(
      "/occupancies/:id/release",
      "tv1Common",
      "estoque:movimentar",
      async (e, id) => {
        await projection(e);
        const o = await get(e, "tv1_occupancy", id, true);
        await one(
          e.tx,
          "SELECT id FROM posicao_estoque WHERE organizacao_id=$1 AND id=$2 AND saldo_base=0 AND reservado_base=0 FOR UPDATE",
          [e.a.organizacao_id, o.position_id],
        );
        await e.tx.query(
          "UPDATE tv1_occupancy SET released_at=clock_timestamp() WHERE organizacao_id=$1 AND id=$2 AND released_at IS NULL",
          [e.a.organizacao_id, id],
        );
        return id;
      },
    ),
    action(
      "/nfc",
      "tv1ReadNfc",
      "terminal:autenticar",
      async (e) => {
        if (!adapter) return fail("adaptador_indisponivel", 503);
        const d = await device(e, e.b.room_id as string, "ACCESS");
        const n = await one(
          e.tx,
          "SELECT id FROM tv1_nfc WHERE organizacao_id=$1 AND unidade_id=$2 AND tag_digest=$3",
          [e.a.organizacao_id, e.b.unidade_id, digest(e.b.tag as string)],
        );
        const nfc = await nfcActive(e, n.id);
        const id = await insert(e, "tv1_challenge", {
          room_id: e.b.room_id,
          nfc_id: n.id,
          employee_id: nfc.employee_id,
          access_terminal_device_id: d.device_id,
          nonce: randomUUID(),
          expires_at: new Date(Date.now() + 120000),
        });
        await event(e, "NFC_VALIDATED", { challenge_id: id });
        await event(e, "BIOMETRIC_REQUESTED", { challenge_id: id });
        return id;
      },
      true,
    ),
    action(
      "/biometric",
      "tv1Biometric",
      "terminal:autenticar",
      async (e) => {
        if (!adapter) return fail("adaptador_indisponivel", 503);
        const c = await get(e, "tv1_challenge", e.b.challenge_id, true);
        const d = await device(e, c.room_id, "BIOMETRIC");
        await nfcActive(e, c.nfc_id);
        const v = adapter.verify(e.b.evidence as string);
        const now = Date.now(),
          captured = Date.parse(v.captured_at),
          expires = Date.parse(v.expires_at);
        if (
          c.expires_at <= new Date() ||
          v.challenge_id !== c.id ||
          v.nonce !== c.nonce ||
          v.employee_id !== c.employee_id ||
          v.access_terminal_device_id !== c.access_terminal_device_id ||
          v.biometric_device_id !== d.device_id ||
          !Number.isFinite(captured) ||
          !Number.isFinite(expires) ||
          captured < c.criada_em.getTime() ||
          captured > now ||
          expires <= now ||
          expires > c.expires_at.getTime()
        )
          fail("biometria_fora_do_desafio", 403);
        const id = await insert(e, "tv1_auth", {
          challenge_id: c.id,
          employee_id: c.employee_id,
          room_id: c.room_id,
          access_terminal_device_id: c.access_terminal_device_id,
          biometric_device_id: d.device_id,
          evidence_digest: digest(e.b.evidence as string),
          captured_at: v.captured_at,
          expires_at: new Date(now + 120000),
        });
        await event(e, "BIOMETRIC_VALIDATED", { auth_session_id: id });
        await event(e, "AUTH_SESSION_CREATED", { auth_session_id: id });
        return id;
      },
      true,
    ),
    action(
      "/withdrawal-orders",
      "tv1Order",
      "retiradas:solicitar",
      async (e) => {
        await authorize(e.tx, e.a, "episodios:ler", e.b.unidade_id as string);
        const id = await insert(e, "tv1_order", { episode_id: e.b.episode_id });
        for (const item of e.b.items as Body[]) {
          await one(
            e.tx,
            "SELECT id FROM tv1_product_policy WHERE organizacao_id=$1 AND product_id=$2",
            [e.a.organizacao_id, item.product_id],
          );
          if (item.program_id && !item.clinical_order_version_id)
            fail("programacao_exige_origem_clinica");
          if (item.clinical_order_version_id)
            await one(
              e.tx,
              `SELECT v.id FROM ordem_versao v JOIN ordem o ON (o.organizacao_id,o.id)=(v.organizacao_id,v.ordem_id)
          WHERE v.organizacao_id=$1 AND v.unidade_id=$2 AND v.id=$3 AND o.episodio_id=$4`,
              [
                e.a.organizacao_id,
                e.b.unidade_id,
                item.clinical_order_version_id,
                e.b.episode_id,
              ],
            );
          if (item.program_id)
            await one(
              e.tx,
              "SELECT id FROM programacao WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3 AND ordem_versao_id=$4",
              [
                e.a.organizacao_id,
                e.b.unidade_id,
                item.program_id,
                item.clinical_order_version_id,
              ],
            );
          await insert(e, "tv1_order_item", { ...item, order_id: id });
        }
        return id;
      },
    ),
    action(
      "/withdrawal-contexts",
      "tv1Context",
      "terminal:acessar",
      async (e) => {
        const auth = await validAuth(e, e.b.auth_session_id as string);
        const orders = e.b.orders as string[],
          adjustments = e.b.adjustments as Body[];
        if (!orders.length && !adjustments.length) fail("contexto_vazio", 400);
        const id = await insert(e, "tv1_context", {
          auth_session_id: auth.id,
          room_id: auth.room_id,
          employee_id: auth.employee_id,
        });
        let rank = 0;
        for (const order of orders) {
          const o = await get(e, "tv1_order_status", order);
          if (o.state !== "AGUARDANDO_RETIRADA") fail("ordem_indisponivel");
          await insert(e, "tv1_context_order", {
            context_id: id,
            order_id: order,
          });
          const items = (
            await e.tx.query(
              "SELECT * FROM tv1_order_item WHERE organizacao_id=$1 AND order_id=$2 ORDER BY criada_em,id",
              [e.a.organizacao_id, order],
            )
          ).rows;
          for (const item of items)
            await insert(e, "tv1_demand", {
              context_id: id,
              order_item_id: item.id,
              product_id: item.product_id,
              quantity: item.quantity,
              source_rank: ++rank,
            });
        }
        for (const item of adjustments) {
          await one(
            e.tx,
            "SELECT id FROM tv1_product_policy WHERE organizacao_id=$1 AND product_id=$2",
            [e.a.organizacao_id, item.product_id],
          );
          await insert(e, "tv1_demand", {
            context_id: id,
            ...item,
            source_rank: ++rank,
          });
        }
        await event(e, "WITHDRAWAL_CONTEXT_CONFIRMED", { context_id: id });
        return id;
      },
      true,
    ),
    action(
      "/access-sessions",
      "tv1Session",
      "terminal:acessar",
      async (e) => {
        const context = await get(e, "tv1_context", e.b.context_id);
        const auth = await validAuth(e, context.auth_session_id);
        const room = await get(e, "tv1_room", context.room_id, true);
        await projection(e);
        const previous = (
          await e.tx.query(
            "SELECT * FROM tv1_session WHERE organizacao_id=$1 AND room_id=$2 AND closed_at IS NULL FOR UPDATE",
            [e.a.organizacao_id, room.id],
          )
        ).rows[0];
        if (previous) {
          await expire(e, previous);
          if (previous.entered_at || previous.expires_at > new Date())
            fail("sala_ocupada");
        }
        const orders = (
          await e.tx.query(
            `SELECT o.id FROM tv1_order o JOIN tv1_context_order c ON (c.organizacao_id,c.order_id)=(o.organizacao_id,o.id)
        WHERE o.organizacao_id=$1 AND c.context_id=$2 ORDER BY o.id FOR UPDATE OF o`,
            [e.a.organizacao_id, context.id],
          )
        ).rows;
        for (const o of orders)
          if (
            (await get(e, "tv1_order_status", o.id)).state !==
            "AGUARDANDO_RETIRADA"
          )
            fail("ordem_ja_em_separacao");
        const needs = (
          await one(
            e.tx,
            `SELECT bool_or(p.sensitive) needed FROM tv1_demand d JOIN tv1_product_policy p ON (p.organizacao_id,p.product_id)=(d.organizacao_id,d.product_id) WHERE d.organizacao_id=$1 AND d.context_id=$2`,
            [e.a.organizacao_id, context.id],
          )
        ).needed;
        let eligible = false;
        try {
          await employee(e, auth.employee_id, "terminal:sensivel");
          eligible = true;
        } catch (error) {
          if (!(error instanceof DomainError) || error.statusCode !== 403)
            throw error;
          if (needs) throw error;
        }
        const display = await one(
          e.tx,
          "SELECT device_id FROM tv1_device WHERE organizacao_id=$1 AND room_id=$2 AND role='PICKING'",
          [e.a.organizacao_id, room.id],
        );
        const id = await insert(e, "tv1_session", {
          context_id: context.id,
          auth_session_id: auth.id,
          room_id: room.id,
          employee_id: auth.employee_id,
          access_terminal_device_id: auth.access_terminal_device_id,
          picking_display_device_id: display.device_id,
          expires_at: new Date(Date.now() + room.session_seconds * 1000),
          state: "DOOR_AUTHORIZED",
          sensitive_access_eligible: eligible,
          sensitive_state: needs ? "LOCKED" : "COMPLETED",
        });
        await allocate(e, id, context.id, room.id);
        if (needs)
          await event(e, "SENSITIVE_ACCESS_ELIGIBLE", {
            access_session_id: id,
          });
        await event(e, "DOOR_AUTHORIZED", { access_session_id: id });
        return id;
      },
      true,
    ),
    action(
      "/access-sessions/:id/physical-events",
      "tv1Physical",
      "terminal:eventos_dev",
      physical,
      true,
    ),
    action(
      "/access-sessions/:id/picking-events",
      "tv1Picking",
      "terminal:eventos_dev",
      picking,
      true,
    ),
    action(
      "/access-sessions/:id/sensitive-access",
      "tv1Common",
      "terminal:eventos_dev",
      sensitive,
      true,
    ),
    action(
      "/access-sessions/:id/recover",
      "tv1Common",
      "terminal:eventos_dev",
      recover,
      true,
    ),
  ];
}
