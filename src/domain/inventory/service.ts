import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { authorize, DomainError, occurred, one } from "../core.ts";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
import { decimal, exact, multiply } from "./decimal.ts";
const s = (b: Body, k: string) => b[k] as string;
type Position = {
  id: string;
  unidade_id: string;
  local_id: string;
  lote_id: string;
  recipiente_id: string | null;
  custodia_id: string;
  saldo_base: string;
  reservado_base: string;
  versao: number;
};
async function get(tx: PoolClient, a: Actor, table: string, id: string) {
  return one(tx, `SELECT * FROM ${table} WHERE organizacao_id=$1 AND id=$2`, [
    a.organizacao_id,
    id,
  ]);
}
async function lockPositions(tx: PoolClient, a: Actor, ids: string[]) {
  const unique = [...new Set(ids)].sort();
  const rows = (
    await tx.query(
      "SELECT id,unidade_id,local_id,lote_id,recipiente_id,custodia_id,saldo_base,reservado_base,versao FROM posicao_estoque WHERE organizacao_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE",
      [a.organizacao_id, unique],
    )
  ).rows as Position[];
  if (rows.length !== unique.length)
    throw new DomainError(404, "posicao_nao_encontrada");
  return rows;
}
async function scope(tx: PoolClient, a: Actor, table: string, id: string) {
  return (await get(tx, a, table, id)).unidade_id as string;
}
const positionScope =
  (field: string): Action["scope"] =>
  (tx, a, b) =>
    scope(tx, a, "posicao_estoque", s(b, field));
const idScope =
  (table: string): Action["scope"] =>
  (tx, a, _b, id) =>
    scope(tx, a, table, id);
const localScope: Action["scope"] = (tx, a, b) =>
  scope(tx, a, "local", s(b, "local_id"));
function catalog(
  path: string,
  input: string,
  table: string,
  fields: string[],
): Action {
  return {
    path: `/estoque/${path}`,
    input,
    permission: "estoque:catalogar",
    async run(tx, a, b) {
      const id = randomUUID();
      await tx.query(
        `INSERT INTO ${table}(id,organizacao_id,${fields.join(",")}) VALUES(${Array.from({ length: fields.length + 2 }, (_, i) => `$${i + 1}`).join(",")})`,
        [id, a.organizacao_id, ...fields.map((f) => b[f] ?? null)],
      );
      return { id };
    },
  };
}
type Move = {
  tipo: string;
  origem?: string;
  destino?: string;
  quantidade: string;
  ocorrido: string;
  motivo: string;
  contra?: string;
  raiz?: string;
  referencia?: string;
  reversao?: string;
  reserva?: string;
  contagem?: string;
  apresentacoes?: string;
  fator?: string;
};
async function recordLocked(
  tx: PoolClient,
  a: Actor,
  cmd: string,
  m: Move,
  locked?: Position[],
) {
  if (exact(m.quantidade) <= 0n)
    throw new DomainError(400, "quantidade_deve_ser_positiva");
  const rows =
    locked ??
    (await lockPositions(
      tx,
      a,
      [m.origem, m.destino].filter((v): v is string => !!v),
    ));
  const first = rows[0];
  if (!first) throw new DomainError(404, "posicao_nao_encontrada");
  for (const p of rows) {
    if (
      p.unidade_id !== first.unidade_id ||
      p.lote_id !== first.lote_id ||
      p.recipiente_id !== first.recipiente_id ||
      p.custodia_id !== first.custodia_id
    )
      throw new DomainError(409, "posicoes_incompativeis");
  }
  // Other movements have already been authorized by their action on this immutable unit.
  // Reserve fulfillment, adjustment and reversal require the additional movement permission.
  if (m.reserva || m.tipo === "ajuste" || m.tipo === "reversao")
    await authorize(tx, a, "estoque:movimentar", first.unidade_id);
  if (m.origem === m.destino)
    throw new DomainError(400, "destino_deve_ser_distinto");
  const origin = rows.find((p) => p.id === m.origem);
  if (
    origin &&
    exact(origin.saldo_base) - exact(origin.reservado_base) <
      exact(m.quantidade)
  )
    throw new DomainError(409, "saldo_disponivel_insuficiente");
  const lot = await one(
    tx,
    `SELECT l.situacao_validade,l.validade::text,l.custo_base,c.tipo AS custodia_tipo,u.fuso
    FROM lote l JOIN custodia c ON c.organizacao_id=l.organizacao_id AND c.id=$3
    JOIN unidade_hospitalar u ON u.organizacao_id=l.organizacao_id AND u.id=$4
    WHERE l.organizacao_id=$1 AND l.id=$2`,
    [a.organizacao_id, first.lote_id, first.custodia_id, first.unidade_id],
  );
  if (m.tipo === "retirada") {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: lot.fuso,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (
      lot.situacao_validade === "pendente" ||
      (lot.validade && lot.validade < date)
    )
      throw new DomainError(409, "validade_pendente_ou_vencida");
    if (first.recipiente_id) {
      const c = await get(tx, a, "recipiente", first.recipiente_id);
      if (!c.validade_apos_abertura || c.validade_apos_abertura <= new Date())
        throw new DomainError(409, "validade_recipiente_pendente_ou_vencida");
    }
  }
  const cost = lot.custodia_tipo === "tutor" ? null : lot.custo_base;
  const id = randomUUID();
  await tx.query(
    `INSERT INTO transacao_estoque(id,organizacao_id,unidade_id,comando_id,tipo,origem_id,destino_id,contrapartida,quantidade_base,custo_base_snapshot,quantidade_apresentacoes,fator_snapshot,raiz_id,referencia_id,reversao_de_id,reserva_id,contagem_id,ocorrido_em,autor_id,motivo)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [
      id,
      a.organizacao_id,
      first.unidade_id,
      cmd,
      m.tipo,
      m.origem ?? null,
      m.destino ?? null,
      m.contra ?? null,
      m.quantidade,
      cost,
      m.apresentacoes ?? null,
      m.fator ?? null,
      m.raiz ?? id,
      m.referencia ?? null,
      m.reversao ?? null,
      m.reserva ?? null,
      m.contagem ?? null,
      occurred(m.ocorrido),
      a.usuario_id,
      m.motivo,
    ],
  );
  await tx.query(
    `INSERT INTO lancamento_estoque(id,organizacao_id,transacao_id,lado,posicao_id,contrapartida,quantidade_assinada) VALUES
    ($1,$3,$4,-1,$5,$6,-$9::numeric),($2,$3,$4,1,$7,$8,$9::numeric)`,
    [
      randomUUID(),
      randomUUID(),
      a.organizacao_id,
      id,
      m.origem ?? null,
      m.origem ? null : m.contra,
      m.destino ?? null,
      m.destino ? null : m.contra,
      m.quantidade,
    ],
  );
  return { id };
}
export async function record(tx: PoolClient, a: Actor, cmd: string, m: Move) {
  return recordLocked(tx, a, cmd, m);
}
// One ordered lock acquisition for a bounded batch; each movement keeps the same ledger checks.
export async function recordMany(
  tx: PoolClient,
  a: Actor,
  cmd: string,
  moves: Move[],
  expectedUnit: string,
) {
  if (
    moves.some((m) => m.tipo !== "consumo" || !m.origem || m.destino) ||
    new Set(moves.map((m) => m.origem)).size !== moves.length
  )
    throw new DomainError(400, "lote_exige_consumos_de_posicoes_distintas");
  const rows = await lockPositions(
    tx,
    a,
    moves.flatMap((m) =>
      [m.origem, m.destino].filter((id): id is string => !!id),
    ),
  );
  if (rows.some((p) => p.unidade_id !== expectedUnit))
    throw new DomainError(409, "material_fora_da_unidade_do_episodio");
  const results = [];
  for (const m of moves)
    results.push(
      await recordLocked(
        tx,
        a,
        cmd,
        m,
        rows.filter((p) => p.id === m.origem || p.id === m.destino),
      ),
    );
  return results;
}
export const inventoryActions: Action[] = [
  catalog("unidades", "stockUnit", "unidade", [
    "simbolo",
    "dimensao",
    "fator_referencia",
  ]),
  catalog("produtos", "product", "produto", [
    "nome",
    "unidade_base_id",
    "finalidade",
  ]),
  catalog("apresentacoes", "presentation", "apresentacao", [
    "produto_id",
    "codigo",
    "versao",
    "anterior_id",
    "unidade_conteudo_id",
    "quantidade_conteudo",
    "fator_unidade_base",
  ]),
  {
    path: "/estoque/lotes",
    input: "stockLot",
    permission: "estoque:catalogar",
    async run(tx, a, b) {
      const p = await get(tx, a, "apresentacao", s(b, "apresentacao_id"));
      const id = randomUUID();
      await tx.query(
        "INSERT INTO lote(id,organizacao_id,produto_id,apresentacao_id,fabricante,codigo,validade,situacao_validade,custo_base) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          id,
          a.organizacao_id,
          p.produto_id,
          p.id,
          b.fabricante,
          b.codigo,
          b.validade ?? null,
          b.situacao_validade,
          b.custo_base ?? null,
        ],
      );
      return { id };
    },
  },
  {
    path: "/estoque/recipientes",
    input: "container",
    permission: "estoque:catalogar",
    async run(tx, a, b) {
      const id = randomUUID();
      await tx.query(
        "INSERT INTO recipiente(id,organizacao_id,lote_id,identificacao,aberto_em,validade_apos_abertura,regra_informada) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          a.organizacao_id,
          b.lote_id,
          b.identificacao,
          occurred(s(b, "aberto_em")),
          b.validade_apos_abertura ?? null,
          b.regra_informada,
        ],
      );
      return { id };
    },
  },
  catalog("custodias", "custody", "custodia", [
    "tipo",
    "paciente_id",
    "episodio_id",
  ]),
  {
    path: "/estoque/posicoes",
    input: "position",
    permission: "estoque:catalogar",
    scope: localScope,
    async run(tx, a, b) {
      const unit = await scope(tx, a, "local", s(b, "local_id"));
      const id = randomUUID();
      await tx.query(
        "INSERT INTO posicao_estoque(id,organizacao_id,unidade_id,local_id,lote_id,recipiente_id,custodia_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          a.organizacao_id,
          unit,
          b.local_id,
          b.lote_id,
          b.recipiente_id ?? null,
          b.custodia_id,
        ],
      );
      return { id };
    },
  },
  {
    path: "/estoque/entradas",
    input: "entry",
    permission: "estoque:movimentar",
    scope: positionScope("posicao_id"),
    async run(tx, a, b, _id, cmd) {
      const pos = await get(tx, a, "posicao_estoque", s(b, "posicao_id"));
      const lot = await get(tx, a, "lote", pos.lote_id);
      const p = await get(tx, a, "apresentacao", lot.apresentacao_id);
      const quantity = multiply(
        s(b, "quantidade_apresentacoes"),
        p.fator_unidade_base,
      );
      return record(tx, a, cmd, {
        tipo: "entrada",
        destino: pos.id,
        quantidade: quantity,
        apresentacoes: s(b, "quantidade_apresentacoes"),
        fator: p.fator_unidade_base,
        contra: "externo",
        ocorrido: s(b, "ocorrido_em"),
        motivo: s(b, "motivo"),
      });
    },
  },
  ...["transferencia", "retirada"].map(
    (tipo): Action => ({
      path: `/estoque/${tipo === "transferencia" ? "transferencias" : "retiradas"}`,
      input: "movement",
      permission: "estoque:movimentar",
      scope: positionScope("origem_id"),
      async run(tx, a, b, _id, cmd) {
        return record(tx, a, cmd, {
          tipo,
          origem: s(b, "origem_id"),
          destino: s(b, "destino_id"),
          quantidade: s(b, "quantidade_base"),
          ocorrido: s(b, "ocorrido_em"),
          motivo: s(b, "motivo"),
        });
      },
    }),
  ),
  {
    path: "/estoque/perdas",
    input: "loss",
    permission: "estoque:movimentar",
    scope: positionScope("posicao_id"),
    async run(tx, a, b, _id, cmd) {
      return record(tx, a, cmd, {
        tipo: "perda",
        origem: s(b, "posicao_id"),
        quantidade: s(b, "quantidade_base"),
        contra: "perda",
        ocorrido: s(b, "ocorrido_em"),
        motivo: s(b, "motivo"),
      });
    },
  },
  {
    path: "/estoque/reservas",
    input: "reserve",
    permission: "estoque:reservar",
    scope: positionScope("posicao_id"),
    async run(tx, a, b) {
      const [pos] = await lockPositions(tx, a, [s(b, "posicao_id")]);
      if (!pos) throw new DomainError(404, "posicao_nao_encontrada");
      const expiry = Date.parse(s(b, "expira_em"));
      if (expiry <= Date.now() || expiry > Date.now() + 86400000)
        throw new DomainError(400, "reserva_exige_validade_de_ate_24h");
      const id = randomUUID();
      await tx.query(
        "INSERT INTO reserva(id,organizacao_id,unidade_id,posicao_id,quantidade_base,expira_em,autor_id,motivo) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          a.organizacao_id,
          pos.unidade_id,
          pos.id,
          b.quantidade_base,
          b.expira_em,
          a.usuario_id,
          b.motivo,
        ],
      );
      return { id };
    },
  },
  ...["liberar", "expirar", "efetivar"].map(
    (step): Action => ({
      path: `/estoque/reservas/:id/${step}`,
      input: step === "efetivar" ? "fulfill" : "motivo",
      permission: "estoque:reservar",
      scope: idScope("reserva"),
      async run(tx, a, b, id, cmd) {
        const r = await get(tx, a, "reserva", id);
        await lockPositions(tx, a, [
          r.posicao_id,
          ...(step === "efetivar" ? [s(b, "destino_id")] : []),
        ]);
        const state =
          step === "liberar"
            ? "liberada"
            : step === "expirar"
              ? "expirada"
              : "efetivada";
        await one(
          tx,
          "UPDATE reserva SET situacao=$3,encerrada_em=now(),encerrada_por_id=$4,motivo=$5 WHERE organizacao_id=$1 AND id=$2 AND situacao='ativa' RETURNING id",
          [a.organizacao_id, id, state, a.usuario_id, b.motivo],
        );
        if (step !== "efetivar") return { id };
        return record(tx, a, cmd, {
          tipo: "retirada",
          origem: r.posicao_id,
          destino: s(b, "destino_id"),
          quantidade: r.quantidade_base,
          reserva: id,
          ocorrido: s(b, "ocorrido_em"),
          motivo: s(b, "motivo"),
        });
      },
    }),
  ),
  ...["devolver", "reverter"].map(
    (step): Action => ({
      path: `/estoque/transacoes/:id/${step}`,
      input: step === "devolver" ? "return" : "reversal",
      permission:
        step === "devolver" ? "estoque:movimentar" : "estoque:reverter",
      scope: idScope("transacao_estoque"),
      async run(tx, a, b, id, cmd) {
        const t = await get(tx, a, "transacao_estoque", id);
        await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          `estoque-raiz:${a.organizacao_id}:${t.raiz_id}`,
        ]);
        const reversed = await tx.query(
          "SELECT 1 FROM transacao_estoque WHERE organizacao_id=$1 AND reversao_de_id=$2",
          [a.organizacao_id, id],
        );
        if (reversed.rowCount || t.tipo === "reversao")
          throw new DomainError(409, "transacao_ja_revertida_ou_reversao");
        const returned = await tx.query(
          `SELECT coalesce(sum(d.quantidade_base),0)::text AS total FROM transacao_estoque d WHERE d.organizacao_id=$1 AND d.referencia_id=$2 AND NOT EXISTS(SELECT 1 FROM transacao_estoque r WHERE r.organizacao_id=d.organizacao_id AND r.reversao_de_id=d.id)`,
          [a.organizacao_id, id],
        );
        if (step === "devolver") {
          if (!["transferencia", "retirada"].includes(t.tipo))
            throw new DomainError(
              409,
              "somente_transferencia_ou_retirada_admite_devolucao",
            );
          if (
            exact(returned.rows[0].total) + exact(s(b, "quantidade_base")) >
            exact(t.quantidade_base)
          )
            throw new DomainError(409, "devolucao_excede_quantidade_original");
        } else if (exact(returned.rows[0].total) > 0n)
          throw new DomainError(409, "reverta_devolucoes_antes_da_origem");
        return record(tx, a, cmd, {
          tipo: step === "devolver" ? "devolucao" : "reversao",
          origem: t.destino_id ?? undefined,
          destino: t.origem_id ?? undefined,
          contra: t.contrapartida ?? undefined,
          quantidade:
            step === "devolver" ? s(b, "quantidade_base") : t.quantidade_base,
          raiz: t.raiz_id,
          ...(step === "devolver" ? { referencia: id } : { reversao: id }),
          ocorrido: s(b, "ocorrido_em"),
          motivo: s(b, "motivo"),
        });
      },
    }),
  ),
  {
    path: "/estoque/inventarios",
    input: "inventory",
    permission: "estoque:inventariar",
    scope: localScope,
    async run(tx, a, b) {
      const unit = await scope(tx, a, "local", s(b, "local_id")),
        id = randomUUID();
      await tx.query(
        "INSERT INTO sessao_inventario(id,organizacao_id,unidade_id,local_id,motivo,autor_id) VALUES($1,$2,$3,$4,$5,$6)",
        [id, a.organizacao_id, unit, b.local_id, b.motivo, a.usuario_id],
      );
      return { id };
    },
  },
  {
    path: "/estoque/contagens",
    input: "count",
    permission: "estoque:inventariar",
    scope: positionScope("posicao_id"),
    async run(tx, a, b) {
      const session = await one(
        tx,
        "SELECT id,unidade_id,local_id,situacao FROM sessao_inventario WHERE organizacao_id=$1 AND id=$2 FOR UPDATE",
        [a.organizacao_id, b.sessao_id],
      );
      const [pos] = await lockPositions(tx, a, [s(b, "posicao_id")]);
      if (
        !pos ||
        session.local_id !== pos.local_id ||
        session.situacao !== "aberta"
      )
        throw new DomainError(409, "inventario_incompativel_ou_encerrado");
      if (pos.versao !== b.versao_esperada)
        throw new DomainError(
          409,
          "saldo_mudou_desde_a_leitura_refaca_contagem",
        );
      const id = randomUUID();
      await tx.query(
        "INSERT INTO contagem_posicao(id,organizacao_id,unidade_id,sessao_id,posicao_id,quantidade_contada,saldo_snapshot,versao_snapshot,autor_id,contada_em) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          id,
          a.organizacao_id,
          pos.unidade_id,
          session.id,
          pos.id,
          b.quantidade_contada,
          pos.saldo_base,
          pos.versao,
          a.usuario_id,
          occurred(s(b, "contada_em")),
        ],
      );
      return { id };
    },
  },
  {
    path: "/estoque/contagens/:id/aplicar",
    input: "applyCount",
    permission: "estoque:ajustar",
    scope: idScope("contagem_posicao"),
    async run(tx, a, b, id, cmd) {
      const count = await get(tx, a, "contagem_posicao", id);
      const session = await one(
        tx,
        "SELECT situacao FROM sessao_inventario WHERE organizacao_id=$1 AND id=$2 FOR UPDATE",
        [a.organizacao_id, count.sessao_id],
      );
      const [pos] = await lockPositions(tx, a, [count.posicao_id]);
      if (
        session.situacao !== "aberta" ||
        !pos ||
        pos.versao !== count.versao_snapshot
      )
        throw new DomainError(409, "contagem_desatualizada_refaca_inventario");
      const delta = exact(count.quantidade_contada) - exact(pos.saldo_base);
      await one(
        tx,
        "UPDATE contagem_posicao SET situacao=$3,aplicada_por_id=$4,motivo_aplicacao=$5 WHERE organizacao_id=$1 AND id=$2 AND situacao='pendente' RETURNING id",
        [
          a.organizacao_id,
          id,
          delta === 0n ? "conferida" : "aplicada",
          a.usuario_id,
          b.motivo,
        ],
      );
      if (delta === 0n) return { id };
      return record(tx, a, cmd, {
        tipo: "ajuste",
        ...(delta < 0n ? { origem: pos.id } : { destino: pos.id }),
        quantidade: decimal(delta < 0n ? -delta : delta),
        contra: "ajuste",
        contagem: id,
        ocorrido: s(b, "ocorrido_em"),
        motivo: s(b, "motivo"),
      });
    },
  },
  {
    path: "/estoque/inventarios/:id/encerrar",
    input: "motivo",
    permission: "estoque:inventariar",
    scope: idScope("sessao_inventario"),
    async run(tx, a, _b, id) {
      await one(
        tx,
        "SELECT id FROM sessao_inventario WHERE organizacao_id=$1 AND id=$2 AND situacao='aberta' FOR UPDATE",
        [a.organizacao_id, id],
      );
      const pending = await tx.query(
        "SELECT 1 FROM contagem_posicao WHERE organizacao_id=$1 AND sessao_id=$2 AND situacao='pendente' LIMIT 1",
        [a.organizacao_id, id],
      );
      if (pending.rowCount)
        throw new DomainError(409, "inventario_com_contagens_pendentes");
      await tx.query(
        "UPDATE sessao_inventario SET situacao='encerrada',encerrada_em=now() WHERE organizacao_id=$1 AND id=$2",
        [a.organizacao_id, id],
      );
      return { id };
    },
  },
];
export const inventoryLists = [
  {
    path: "/estoque/lancamentos",
    table: "lancamento_estoque_consulta",
    columns:
      "id,unidade_id,transacao_id,posicao_id,contrapartida,quantidade_assinada,custo_base_snapshot,tipo,ocorrido_em,autor_id",
    unit: true,
  },
  {
    path: "/estoque/unidades",
    table: "unidade",
    columns: "id,simbolo,dimensao,fator_referencia",
  },
  {
    path: "/estoque/produtos",
    table: "produto",
    columns: "id,nome,unidade_base_id,finalidade",
  },
  {
    path: "/estoque/apresentacoes",
    table: "apresentacao",
    columns:
      "id,produto_id,codigo,versao,anterior_id,unidade_conteudo_id,quantidade_conteudo,fator_unidade_base",
  },
  {
    path: "/estoque/lotes",
    table: "lote",
    columns:
      "id,produto_id,apresentacao_id,fabricante,codigo,validade,situacao_validade,custo_base",
  },
  {
    path: "/estoque/recipientes",
    table: "recipiente",
    columns:
      "id,lote_id,identificacao,aberto_em,validade_apos_abertura,regra_informada",
  },
  {
    path: "/estoque/custodias",
    table: "custodia",
    columns: "id,tipo,paciente_id,episodio_id",
  },
  {
    path: "/estoque/posicoes",
    table: "posicao_estoque",
    columns:
      "id,unidade_id,local_id,lote_id,recipiente_id,custodia_id,saldo_base,reservado_base,disponivel_base,versao",
    unit: true,
  },
  {
    path: "/estoque/reservas",
    table: "reserva",
    columns:
      "id,unidade_id,posicao_id,quantidade_base,situacao,expira_em,autor_id,motivo",
    unit: true,
  },
  {
    path: "/estoque/transacoes",
    table: "transacao_estoque",
    columns:
      "id,unidade_id,comando_id,tipo,origem_id,destino_id,contrapartida,quantidade_base,custo_base_snapshot,raiz_id,referencia_id,reversao_de_id,reserva_id,contagem_id,ocorrido_em,autor_id,motivo",
    unit: true,
  },
  {
    path: "/estoque/inventarios",
    table: "sessao_inventario",
    columns:
      "id,unidade_id,local_id,situacao,motivo,autor_id,criada_em,encerrada_em",
    unit: true,
  },
  {
    path: "/estoque/contagens",
    table: "contagem_posicao",
    columns:
      "id,unidade_id,sessao_id,posicao_id,quantidade_contada,saldo_snapshot,versao_snapshot,situacao,autor_id,contada_em",
    unit: true,
  },
].map((list) => ({ ...list, permission: "estoque:ler" }));
