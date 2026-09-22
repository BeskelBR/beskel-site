import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { authorize, digest, DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
import type { Challenge, TerminalEvidenceAdapter } from "./evidence.ts";
const scope: Action["scope"] = async (_tx, _a, b) => b.unidade_id as string;
async function insert(
  tx: PoolClient,
  a: Actor,
  b: Body,
  cmd: string,
  table: string,
  extra: Body,
) {
  const row = {
    id: randomUUID(),
    organizacao_id: a.organizacao_id,
    unidade_id: b.unidade_id,
    autor_id: a.usuario_id,
    comando_id: cmd,
    motivo: b.motivo,
    ...extra,
  };
  const keys = Object.keys(row);
  await tx.query(
    `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(row),
  );
  return row.id as string;
}
async function device(tx: PoolClient, a: Actor, cmd: string) {
  return (
    await one(
      tx,
      "SELECT dispositivo_id FROM comando WHERE organizacao_id=$1 AND id=$2",
      [a.organizacao_id, cmd],
    )
  ).dispositivo_id as string;
}
async function order(tx: PoolClient, a: Actor, b: Body, id: string) {
  await tx.query("SELECT bloquear_ordem_retirada($1,$2)", [
    a.organizacao_id,
    id,
  ]);
  return one(
    tx,
    "SELECT * FROM ordem_retirada_consulta WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
    [a.organizacao_id, b.unidade_id, id],
  );
}
function requireAdapter(adapter?: TerminalEvidenceAdapter) {
  if (adapter?.mode !== "SIMULADO_DEV")
    throw new DomainError(503, "adaptador_de_evidencia_indisponivel");
  return adapter;
}
export function terminalAccessActions(
  adapter?: TerminalEvidenceAdapter,
): Action[] {
  return [
    {
      path: "/retiradas/ordens",
      input: "withdrawalOrder",
      permission: "retiradas:solicitar",
      scope,
      async run(tx, a, b, _id, cmd) {
        await authorize(tx, a, "episodios:ler", b.unidade_id as string);
        await authorize(tx, a, "estoque:ler", b.unidade_id as string);
        const id = await insert(tx, a, b, cmd, "ordem_retirada", {
          episodio_id: b.episodio_id,
          observacao: b.observacao,
        });
        for (const item of b.itens as Body[])
          await insert(tx, a, b, cmd, "item_ordem_retirada", {
            ...item,
            ordem_id: id,
          });
        await insert(tx, a, b, cmd, "evento_ordem_retirada", {
          ordem_id: id,
          versao: 1,
          estado: "RASCUNHO",
        });
        return { id };
      },
    },
    ...(["submit", "cancelar"] as const).map(
      (transition): Action => ({
        path: `/retiradas/ordens/:id/${transition}`,
        input: "withdrawalTransition",
        permission: "retiradas:solicitar",
        scope,
        async run(tx, a, b, id, cmd) {
          const o = await order(tx, a, b, id);
          return {
            id: await insert(tx, a, b, cmd, "evento_ordem_retirada", {
              ordem_id: id,
              versao: Number(o.versao) + 1,
              estado:
                transition === "submit" ? "AGUARDANDO_RETIRADA" : "CANCELADA",
            }),
          };
        },
      }),
    ),
    {
      path: "/terminal/acesso/desafios",
      input: "accessChallenge",
      permission: "terminal:autenticar",
      scope,
      deviceRequired: true,
      async run(tx, a, b, _id, cmd) {
        requireAdapter(adapter);
        const clock = await one(tx, "SELECT clock_timestamp() agora", []);
        const created = clock.agora as Date;
        return {
          id: await insert(tx, a, b, cmd, "desafio_acesso", {
            credencial_id: a.credencial_id,
            dispositivo_id: await device(tx, a, cmd),
            nonce: randomUUID(),
            criada_em: created,
            expira_em: new Date(created.getTime() + 120000),
          }),
        };
      },
    },
    {
      path: "/terminal/acesso/autenticacoes",
      input: "accessAuthentication",
      permission: "terminal:autenticar",
      scope,
      deviceRequired: true,
      async run(tx, a, b, _id, cmd) {
        const verifier = requireAdapter(adapter);
        const d = (await one(
          tx,
          "SELECT * FROM desafio_acesso WHERE organizacao_id=$1 AND unidade_id=$2 AND autor_id=$3 AND credencial_id=$4 AND id=$5",
          [
            a.organizacao_id,
            b.unidade_id,
            a.usuario_id,
            a.credencial_id,
            b.desafio_id,
          ],
        )) as Challenge;
        if (d.dispositivo_id !== (await device(tx, a, cmd)))
          throw new DomainError(403, "desafio_de_outro_dispositivo");
        const e = await verifier.verify(b.evidencia as string, d);
        if (!e || typeof e !== "object")
          throw new DomainError(400, "evidencia_invalida");
        const now = (await one(tx, "SELECT clock_timestamp() agora", []))
          .agora as Date;
        const captured = Date.parse(e.capturada_em),
          expiry = Date.parse(e.expira_em);
        if (
          e.modo !== "SIMULADO_DEV" ||
          e.desafio_id !== d.id ||
          e.nonce !== d.nonce ||
          e.usuario_id !== a.usuario_id ||
          e.terminal_id !== d.dispositivo_id ||
          e.dispositivo_biometrico_id !== d.dispositivo_id ||
          e.face_match !== true ||
          e.liveness !== true ||
          e.identity_claim !== true ||
          !Number.isFinite(captured) ||
          !Number.isFinite(expiry) ||
          captured < d.criada_em.getTime() ||
          captured > now.getTime() ||
          expiry <= now.getTime() ||
          expiry > d.expira_em.getTime() ||
          typeof e.engine !== "string" ||
          typeof e.versao !== "string"
        )
          throw new DomainError(403, "evidencia_incompativel_com_desafio");
        const evidenceId = await insert(tx, a, b, cmd, "evidencia_acesso", {
          desafio_id: d.id,
          dispositivo_biometrico_id: e.dispositivo_biometrico_id,
          hash_atestacao: digest(b.evidencia as string),
          engine: e.engine,
          versao: e.versao,
          capturada_em: e.capturada_em,
          expira_em: e.expira_em,
          face_match: true,
          liveness: true,
          identity_claim: true,
          modo: "SIMULADO_DEV",
        });
        return {
          id: await insert(tx, a, b, cmd, "autenticacao_acesso", {
            evidencia_id: evidenceId,
            credencial_id: a.credencial_id,
            dispositivo_id: d.dispositivo_id,
            nivel: "SIMULADO_DEV",
            fatores: ["identity_claim_dev", "face_1_1_dev", "pad_dev"],
            expira_em: e.expira_em,
          }),
        };
      },
    },
    {
      path: "/terminal/acesso/sessoes",
      input: "accessSession",
      permission: "terminal:acessar",
      scope,
      deviceRequired: true,
      async run(tx, a, b, _id, cmd) {
        requireAdapter(adapter);
        if (b.sensivel)
          await authorize(tx, a, "terminal:sensivel", b.unidade_id as string);
        await authorize(tx, a, "retiradas:ler", b.unidade_id as string);
        const auth = await one(
          tx,
          "SELECT * FROM autenticacao_acesso WHERE organizacao_id=$1 AND unidade_id=$2 AND autor_id=$3 AND credencial_id=$4 AND id=$5",
          [
            a.organizacao_id,
            b.unidade_id,
            a.usuario_id,
            a.credencial_id,
            b.autenticacao_id,
          ],
        );
        const dev = await device(tx, a, cmd);
        if (auth.dispositivo_id !== dev)
          throw new DomainError(403, "autenticacao_de_outro_dispositivo");
        const ids = [...(b.ordens as string[])].sort();
        await tx.query(
          "SELECT bloquear_ordem_retirada($1,id) FROM (SELECT unnest($2::uuid[]) id ORDER BY id) locked",
          [a.organizacao_id, ids],
        );
        const orders = await tx.query(
          "SELECT id FROM ordem_retirada_consulta WHERE organizacao_id=$1 AND unidade_id=$2 AND id=ANY($3::uuid[])",
          [a.organizacao_id, b.unidade_id, ids],
        );
        if (orders.rowCount !== ids.length)
          throw new DomainError(404, "ordem_nao_encontrada");
        const now = (await one(tx, "SELECT clock_timestamp() agora", []))
          .agora as Date;
        const id = await insert(tx, a, b, cmd, "sessao_acesso", {
          autenticacao_id: b.autenticacao_id,
          dispositivo_id: dev,
          sensivel: b.sensivel,
          criada_em: now,
          expira_em: new Date(now.getTime() + 900000),
        });
        for (const orderId of ids)
          await insert(tx, a, b, cmd, "sessao_ordem_retirada", {
            sessao_id: id,
            ordem_id: orderId,
          });
        await insert(tx, a, b, cmd, "evento_acesso", {
          sessao_id: id,
          dispositivo_id: dev,
          versao: 1,
          tipo: "AUTHENTICATED",
          referencia: randomUUID(),
          ocorrida_em: now,
          origem: "SIMULADO_DEV",
        });
        return { id };
      },
    },
    {
      path: "/terminal/acesso/sessoes/:id/eventos",
      input: "accessEvent",
      permission: "terminal:eventos_dev",
      scope,
      deviceRequired: true,
      async run(tx, a, b, id, cmd) {
        requireAdapter(adapter);
        await authorize(tx, a, "terminal:acessar", b.unidade_id as string);
        await tx.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('sessao-acesso:'||$1::text||':'||$2::text,0))",
          [a.organizacao_id, id],
        );
        const s = await one(
          tx,
          "SELECT s.*,au.credencial_id FROM sessao_acesso_consulta s JOIN autenticacao_acesso au ON au.organizacao_id=s.organizacao_id AND au.id=s.autenticacao_id WHERE s.organizacao_id=$1 AND s.unidade_id=$2 AND s.autor_id=$3 AND s.id=$4",
          [a.organizacao_id, b.unidade_id, a.usuario_id, id],
        );
        if (s.credencial_id !== a.credencial_id)
          throw new DomainError(403, "sessao_de_outra_credencial");
        if (s.sensivel)
          await authorize(tx, a, "terminal:sensivel", b.unidade_id as string);
        return {
          id: await insert(tx, a, b, cmd, "evento_acesso", {
            sessao_id: id,
            dispositivo_id: await device(tx, a, cmd),
            versao: Number(s.versao) + 1,
            tipo: b.tipo,
            referencia: b.referencia,
            ocorrida_em: b.ocorrida_em,
            origem: "SIMULADO_DEV",
          }),
        };
      },
    },
  ];
}
