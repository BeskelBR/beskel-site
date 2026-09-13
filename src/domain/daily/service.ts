import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { authorize, DomainError, occurred, one } from "../core.ts";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
import { exact, decimal } from "../inventory/decimal.ts";
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
async function epLock(tx: PoolClient, a: Actor, id: string) {
  return one(
    tx,
    "SELECT id,unidade_id FROM episodio WHERE organizacao_id=$1 AND id=$2 FOR UPDATE",
    [a.organizacao_id, id],
  );
}
function catalog(
  path: string,
  input: string,
  table: string,
  fields: string[],
  author = false,
): Action {
  return {
    path: `/diarias/${path}`,
    input,
    permission: "diarias:configurar",
    async run(tx, a, b) {
      const id = randomUUID(),
        columns = [
          "id",
          "organizacao_id",
          ...fields,
          ...(author ? ["autor_id"] : []),
        ],
        values = [
          id,
          a.organizacao_id,
          ...fields.map((f) => b[f] ?? null),
          ...(author ? [a.usuario_id] : []),
        ];
      await tx.query(
        `INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map((_, i) => `$${i + 1}`).join(",")})`,
        values,
      );
      return { id };
    },
  };
}
type Event = {
  id: string;
  unidade_id: string;
  episodio_id: string;
  item_clinico_id: string | null;
  produto_id: string | null;
  quantidade_fisica: string | null;
  ocorrido_em: Date;
  origem_ativa: boolean;
  execucao_integral: boolean;
  material_tutor: boolean;
  execucao_id: string | null;
};
async function eventLock(tx: PoolClient, a: Actor, id: string) {
  return (await one(
    tx,
    `SELECT e.id,e.unidade_id,e.episodio_id,e.item_clinico_id,e.produto_id,e.quantidade_fisica,e.ocorrido_em,e.origem_ativa,e.execucao_integral,e.material_tutor,e.execucao_id
 FROM evento_cobertura_consulta e JOIN episodio ep ON ep.organizacao_id=e.organizacao_id AND ep.id=e.episodio_id WHERE e.organizacao_id=$1 AND e.id=$2 FOR UPDATE OF ep`,
    [a.organizacao_id, id],
  )) as Event;
}
type Rule = {
  id: string;
  dimensao: string;
  janela: string;
  tratamento: string;
  limite_quantidade: string | null;
  prioridade: number;
  tratamento_excedente: string;
};
type Context = {
  reason: string;
  rule?: Rule;
  use?: string;
  quantity?: bigint;
  included?: bigint;
  excess?: bigint;
};
async function context(
  tx: PoolClient,
  a: Actor,
  e: Event,
  period?: string,
): Promise<Context> {
  if (!e.origem_ativa) return { reason: "origem_retificada_ou_estornada" };
  if (e.material_tutor)
    return { reason: "politica_de_material_do_tutor_pendente" };
  if (e.execucao_id && !e.execucao_integral)
    return { reason: "semantica_de_execucao_parcial_pendente" };
  if (!period) return { reason: "periodo_diaria_nao_informado" };
  const p = await get(
    tx,
    a,
    "periodo_diaria_consulta",
    period,
    "episodio_id,pacote_episodio_id,inicio,fim,necessita_revisao",
  );
  if (p.episodio_id !== e.episodio_id)
    throw new DomainError(409, "periodo_de_outro_episodio");
  if (p.necessita_revisao)
    return { reason: "periodo_exige_revisao_de_classificacao_ou_encerramento" };
  if (e.ocorrido_em < p.inicio || e.ocorrido_em >= p.fim)
    return { reason: "evento_fora_do_periodo_explicito" };
  const candidates = await tx.query(
    "SELECT id,dimensao,janela,tratamento,limite_quantidade,prioridade,tratamento_excedente FROM regras_cobertura($1,$2) ORDER BY prioridade DESC,id LIMIT 2",
    [e.id, period],
  );
  const r = candidates.rows[0] as Rule | undefined;
  if (!r) return { reason: "regra_elegivel_nao_encontrada" };
  if (candidates.rows[1]?.prioridade === r.prioridade)
    return { reason: "conflito_de_prioridade_entre_regras" };
  const use = await one(
    tx,
    `WITH nova AS(INSERT INTO uso_cobertura(id,organizacao_id,unidade_id,episodio_id,pacote_episodio_id,regra_id,periodo_diaria_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id)
 SELECT id FROM nova UNION ALL SELECT id FROM uso_cobertura WHERE organizacao_id=$2 AND pacote_episodio_id=$5 AND regra_id=$6 AND periodo_diaria_id IS NOT DISTINCT FROM $7::uuid LIMIT 1`,
    [
      randomUUID(),
      a.organizacao_id,
      e.unidade_id,
      e.episodio_id,
      p.pacote_episodio_id,
      r.id,
      r.janela === "periodo" ? period : null,
    ],
  );
  const qty =
    r.dimensao === "quantidade_fisica"
      ? exact(e.quantidade_fisica ?? "0")
      : 1000000n;
  const used = await one(
    tx,
    "SELECT least(total,99999999999999.999999)::text AS total,item_existente FROM compromisso_cobertura($1,$2)",
    [use.id, e.item_clinico_id],
  );
  let included = qty;
  if (r.tratamento === "excluido") included = 0n;
  else if (
    r.limite_quantidade !== null &&
    !(r.dimensao === "itens_distintos" && used.item_existente)
  ) {
    const remaining = exact(r.limite_quantidade) - exact(used.total);
    included = remaining < 0n ? 0n : remaining < qty ? remaining : qty;
  }
  return {
    reason:
      r.tratamento === "excluido"
        ? "exclusao_explicita_sem_constituir_cobranca"
        : r.tratamento_excedente === "pendente"
          ? "regra_simulada_excedente_permanece_pendente"
          : "regra_simulada_excedente_exige_revisao_comercial",
    rule: r,
    use: use.id,
    quantity: qty,
    included,
    excess: qty - included,
  };
}
async function evaluate(
  tx: PoolClient,
  a: Actor,
  b: Body,
  event: string,
  cmd: string,
  reservation?: string,
) {
  const e = await eventLock(tx, a, event);
  const latest = (
    await tx.query(
      "SELECT a.id,a.versao,EXISTS(SELECT 1 FROM reversao_cobertura r WHERE r.organizacao_id=a.organizacao_id AND r.avaliacao_id=a.id) AS revertida FROM avaliacao_cobertura a WHERE organizacao_id=$1 AND evento_id=$2 ORDER BY versao DESC LIMIT 1",
      [a.organizacao_id, event],
    )
  ).rows[0];
  if ((latest?.versao ?? 0) !== b.versao_esperada)
    throw new DomainError(409, "avaliacao_alterada_recarregue");
  if (latest && !latest.revertida) {
    await authorize(tx, a, "diarias:reverter", e.unidade_id);
    await tx.query(
      "INSERT INTO reversao_cobertura(id,organizacao_id,unidade_id,avaliacao_id,autor_id,motivo) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        a.organizacao_id,
        e.unidade_id,
        latest.id,
        a.usuario_id,
        b.motivo,
      ],
    );
  }
  if (reservation)
    await one(
      tx,
      "UPDATE reserva_cobertura SET situacao='efetivada',encerrada_por_id=$3,encerrada_em=now(),motivo_fim=$4 WHERE organizacao_id=$1 AND id=$2 AND situacao='ativa' RETURNING id",
      [a.organizacao_id, reservation, a.usuario_id, b.motivo],
    );
  const c = await context(tx, a, e, b.periodo_diaria_id as string | undefined);
  const result = !c.rule
    ? "pendente"
    : c.rule.tratamento === "excluido"
      ? "excluido"
      : c.excess === 0n
        ? "incluido"
        : c.included === 0n
          ? "excedente"
          : "parcial";
  const id = randomUUID(),
    version = (latest?.versao ?? 0) + 1;
  await tx.query(
    "INSERT INTO avaliacao_cobertura(id,organizacao_id,unidade_id,evento_id,periodo_diaria_id,uso_id,versao,anterior_id,reserva_id,resultado,justificativa,autor_id,motivo,comando_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
    [
      id,
      a.organizacao_id,
      e.unidade_id,
      event,
      b.periodo_diaria_id ?? null,
      c.use ?? null,
      version,
      latest?.id ?? null,
      reservation ?? null,
      result,
      c.reason,
      a.usuario_id,
      b.motivo,
      cmd,
    ],
  );
  if (c.rule)
    await tx.query(
      "INSERT INTO alocacao_cobertura(id,organizacao_id,unidade_id,avaliacao_id,uso_id,quantidade,incluida,excedente) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        randomUUID(),
        a.organizacao_id,
        e.unidade_id,
        id,
        c.use,
        decimal(c.quantity ?? 0n),
        decimal(c.included ?? 0n),
        decimal(c.excess ?? 0n),
      ],
    );
  return { id, versao: version, resultado: result };
}
export const dailyActions: Action[] = [
  catalog("classificacoes", "dailyVersion", "classificacao_versao", [
    "codigo",
    "versao",
    "descricao",
  ]),
  catalog("grupos", "dailyVersion", "grupo_cobertura_versao", [
    "codigo",
    "versao",
    "descricao",
  ]),
  catalog("membros-grupo", "groupMember", "membro_grupo_cobertura", [
    "grupo_versao_id",
    "item_clinico_id",
  ]),
  catalog(
    "pacotes",
    "dailyPackage",
    "pacote_versao",
    [
      "codigo",
      "versao",
      "descricao",
      "classificacao_versao_id",
      "base_temporal",
      "limite_encerramento",
      "politica_tolerancia",
      "mudanca_classe",
      "simulacao",
    ],
    true,
  ),
  catalog("regras", "dailyRule", "regra_pacote", [
    "pacote_versao_id",
    "item_clinico_id",
    "grupo_versao_id",
    "produto_id",
    "dimensao",
    "janela",
    "prioridade",
    "tratamento",
    "limite_quantidade",
    "unidade_limite_id",
    "tratamento_excedente",
  ]),
  {
    path: "/diarias/pacotes/:id/aprovar-simulacao",
    input: "approveDaily",
    permission: "diarias:aprovar_simulacao",
    async run(tx, a, b, id) {
      const approval = randomUUID();
      await tx.query(
        "INSERT INTO aprovacao_pacote(id,organizacao_id,pacote_versao_id,autor_id,motivo,simulacao) VALUES($1,$2,$3,$4,$5,$6)",
        [approval, a.organizacao_id, id, a.usuario_id, b.motivo, b.simulacao],
      );
      return { id: approval };
    },
  },
  {
    path: "/diarias/pesos",
    input: "weight",
    permission: "diarias:classificar",
    scope: scoped("episodio", "episodio_id"),
    async run(tx, a, b) {
      const ep = await epLock(tx, a, s(b, "episodio_id")),
        id = randomUUID();
      await tx.query(
        "INSERT INTO medicao_peso(id,organizacao_id,unidade_id,episodio_id,quantidade,unidade_medida_id,medida_em,autor_id,motivo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          id,
          a.organizacao_id,
          ep.unidade_id,
          ep.id,
          b.quantidade,
          b.unidade_medida_id,
          occurred(s(b, "medida_em")),
          a.usuario_id,
          b.motivo,
        ],
      );
      return { id };
    },
  },
  {
    path: "/diarias/classificacoes-episodio",
    input: "episodeClass",
    permission: "diarias:classificar",
    scope: scoped("episodio", "episodio_id"),
    async run(tx, a, b) {
      const ep = await epLock(tx, a, s(b, "episodio_id")),
        id = randomUUID();
      await tx.query(
        "INSERT INTO classificacao_episodio(id,organizacao_id,unidade_id,episodio_id,classificacao_versao_id,inicio,medicao_peso_id,avaliacao_clinica_id,suporte_ventilatorio,autor_id,motivo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          id,
          a.organizacao_id,
          ep.unidade_id,
          ep.id,
          b.classificacao_versao_id,
          occurred(s(b, "inicio")),
          b.medicao_peso_id ?? null,
          b.avaliacao_clinica_id ?? null,
          b.suporte_ventilatorio,
          a.usuario_id,
          b.motivo,
        ],
      );
      return { id };
    },
  },
  {
    path: "/diarias/classificacoes-episodio/:id/encerrar",
    input: "endClass",
    permission: "diarias:classificar",
    scope: scoped("classificacao_episodio"),
    async run(tx, a, b, id) {
      const c = await get(tx, a, "classificacao_episodio", id, "episodio_id");
      await epLock(tx, a, c.episodio_id);
      await one(
        tx,
        "UPDATE classificacao_episodio SET fim=$3,encerrada_por_id=$4,motivo_fim=$5 WHERE organizacao_id=$1 AND id=$2 AND fim IS NULL RETURNING id",
        [a.organizacao_id, id, occurred(s(b, "fim")), a.usuario_id, b.motivo],
      );
      return { id };
    },
  },
  {
    path: "/diarias/pacotes-episodio",
    input: "episodePackage",
    permission: "diarias:associar",
    scope: scoped("episodio", "episodio_id"),
    async run(tx, a, b) {
      const ep = await epLock(tx, a, s(b, "episodio_id")),
        id = randomUUID();
      await tx.query(
        "INSERT INTO pacote_episodio(id,organizacao_id,unidade_id,episodio_id,pacote_versao_id,inicio,fim,autor_id,motivo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          id,
          a.organizacao_id,
          ep.unidade_id,
          ep.id,
          b.pacote_versao_id,
          b.inicio,
          b.fim,
          a.usuario_id,
          b.motivo,
        ],
      );
      return { id };
    },
  },
  {
    path: "/diarias/periodos",
    input: "dailyPeriod",
    permission: "diarias:associar",
    scope: scoped("pacote_episodio", "pacote_episodio_id"),
    async run(tx, a, b) {
      const pe = await get(
          tx,
          a,
          "pacote_episodio",
          s(b, "pacote_episodio_id"),
          "episodio_id,unidade_id",
        ),
        id = randomUUID();
      await epLock(tx, a, pe.episodio_id);
      const u = await get(tx, a, "unidade_hospitalar", pe.unidade_id, "fuso");
      await tx.query(
        "INSERT INTO periodo_diaria(id,organizacao_id,unidade_id,episodio_id,pacote_episodio_id,classificacao_episodio_id,inicio,fim,fuso,autor_id,motivo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          id,
          a.organizacao_id,
          pe.unidade_id,
          pe.episodio_id,
          b.pacote_episodio_id,
          b.classificacao_episodio_id ?? null,
          b.inicio,
          b.fim,
          u.fuso,
          a.usuario_id,
          b.motivo,
        ],
      );
      return { id };
    },
  },
  {
    path: "/diarias/eventos",
    input: "coverageEvent",
    permission: "diarias:avaliar",
    scope: async (tx, a, b) => {
      if (Number(!!b.execucao_id) + Number(!!b.consumo_item_id) !== 1)
        throw new DomainError(400, "informe_uma_origem_de_cobertura");
      return (
        await get(
          tx,
          a,
          b.execucao_id ? "execucao" : "consumo_item",
          s(b, b.execucao_id ? "execucao_id" : "consumo_item_id"),
          "unidade_id",
        )
      ).unidade_id;
    },
    async run(tx, a, b) {
      const source = b.execucao_id
        ? await one(
            tx,
            "SELECT e.episodio_id,e.unidade_id,e.executada_em AS ocorrido_em,v.item_clinico_id,NULL::uuid AS produto_id,NULL::numeric AS quantidade_fisica,NULL::uuid AS unidade_medida_id FROM execucao e JOIN ordem_versao v ON v.organizacao_id=e.organizacao_id AND v.id=e.ordem_versao_id WHERE e.organizacao_id=$1 AND e.id=$2",
            [a.organizacao_id, b.execucao_id],
          )
        : await one(
            tx,
            "SELECT c.episodio_id,c.unidade_id,c.ocorrido_em,NULL::uuid AS item_clinico_id,l.produto_id,i.quantidade_base AS quantidade_fisica,pr.unidade_base_id AS unidade_medida_id FROM consumo_item i JOIN consumo c ON c.organizacao_id=i.organizacao_id AND c.id=i.consumo_id JOIN posicao_estoque p ON p.organizacao_id=i.organizacao_id AND p.id=i.posicao_id JOIN lote l ON l.organizacao_id=p.organizacao_id AND l.id=p.lote_id JOIN produto pr ON pr.organizacao_id=l.organizacao_id AND pr.id=l.produto_id WHERE i.organizacao_id=$1 AND i.id=$2",
            [a.organizacao_id, b.consumo_item_id],
          );
      await epLock(tx, a, source.episodio_id);
      const id = randomUUID();
      await tx.query(
        "INSERT INTO evento_cobertura(id,organizacao_id,unidade_id,episodio_id,execucao_id,consumo_item_id,ocorrido_em,item_clinico_id,produto_id,quantidade_fisica,unidade_medida_id,autor_id,motivo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        [
          id,
          a.organizacao_id,
          source.unidade_id,
          source.episodio_id,
          b.execucao_id ?? null,
          b.consumo_item_id ?? null,
          source.ocorrido_em,
          source.item_clinico_id,
          source.produto_id,
          source.quantidade_fisica,
          source.unidade_medida_id,
          a.usuario_id,
          b.motivo,
        ],
      );
      return { id };
    },
  },
  {
    path: "/diarias/eventos/:id/avaliar",
    input: "coverageEvaluation",
    permission: "diarias:avaliar",
    scope: scoped("evento_cobertura"),
    run: (tx, a, b, id, cmd) => evaluate(tx, a, b, id, cmd),
  },
  {
    path: "/diarias/avaliacoes/:id/reverter",
    input: "motivo",
    permission: "diarias:reverter",
    scope: scoped("avaliacao_cobertura"),
    async run(tx, a, b, id) {
      const av = await get(
        tx,
        a,
        "avaliacao_cobertura",
        id,
        "evento_id,unidade_id",
      );
      await eventLock(tx, a, av.evento_id);
      const reversal = randomUUID();
      await tx.query(
        "INSERT INTO reversao_cobertura(id,organizacao_id,unidade_id,avaliacao_id,autor_id,motivo) VALUES($1,$2,$3,$4,$5,$6)",
        [reversal, a.organizacao_id, av.unidade_id, id, a.usuario_id, b.motivo],
      );
      return { id: reversal };
    },
  },
  {
    path: "/diarias/reservas",
    input: "coverageReserve",
    permission: "diarias:reservar",
    scope: scoped("evento_cobertura", "evento_id"),
    async run(tx, a, b) {
      const e = await eventLock(tx, a, s(b, "evento_id")),
        c = await context(tx, a, e, s(b, "periodo_diaria_id"));
      if (!c.rule || c.rule.tratamento === "excluido" || c.excess !== 0n)
        throw new DomainError(
          409,
          "cobertura_integral_indisponivel_para_reserva",
        );
      const expiry = Date.parse(s(b, "expira_em"));
      if (expiry <= Date.now() || expiry > Date.now() + 86400000)
        throw new DomainError(400, "reserva_exige_validade_de_ate_24h");
      const id = randomUUID();
      await tx.query(
        "INSERT INTO reserva_cobertura(id,organizacao_id,unidade_id,evento_id,uso_id,periodo_diaria_id,quantidade,expira_em,autor_id,motivo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          id,
          a.organizacao_id,
          e.unidade_id,
          e.id,
          c.use,
          b.periodo_diaria_id,
          decimal(c.quantity ?? 0n),
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
      path: `/diarias/reservas/:id/${step}`,
      input: step === "efetivar" ? "coverageFulfill" : "motivo",
      permission: "diarias:reservar",
      scope: scoped("reserva_cobertura"),
      async run(tx, a, b, id, cmd) {
        const r = await get(
          tx,
          a,
          "reserva_cobertura",
          id,
          "evento_id,periodo_diaria_id,unidade_id",
        );
        if (step === "efetivar") {
          await authorize(tx, a, "diarias:avaliar", r.unidade_id);
          return evaluate(
            tx,
            a,
            { ...b, periodo_diaria_id: r.periodo_diaria_id },
            r.evento_id,
            cmd,
            id,
          );
        }
        await eventLock(tx, a, r.evento_id);
        await one(
          tx,
          "UPDATE reserva_cobertura SET situacao=$3,encerrada_por_id=$4,encerrada_em=now(),motivo_fim=$5 WHERE organizacao_id=$1 AND id=$2 AND situacao='ativa' RETURNING id",
          [
            a.organizacao_id,
            id,
            step === "liberar" ? "liberada" : "expirada",
            a.usuario_id,
            b.motivo,
          ],
        );
        return { id };
      },
    }),
  ),
];
export const dailyLists = [
  {
    path: "/diarias/classificacoes",
    table: "classificacao_versao",
    columns: "id,codigo,versao,descricao",
  },
  {
    path: "/diarias/grupos",
    table: "grupo_cobertura_versao",
    columns: "id,codigo,versao,descricao",
  },
  {
    path: "/diarias/membros-grupo",
    table: "membro_grupo_cobertura",
    columns: "id,grupo_versao_id,item_clinico_id",
  },
  {
    path: "/diarias/pacotes",
    table: "pacote_versao",
    columns:
      "id,codigo,versao,descricao,classificacao_versao_id,base_temporal,limite_encerramento,politica_tolerancia,mudanca_classe,simulacao,autor_id,criada_em",
  },
  {
    path: "/diarias/regras",
    table: "regra_pacote",
    columns:
      "id,pacote_versao_id,item_clinico_id,grupo_versao_id,produto_id,dimensao,janela,prioridade,tratamento,limite_quantidade,unidade_limite_id,tratamento_excedente",
  },
  {
    path: "/diarias/aprovacoes",
    table: "aprovacao_pacote",
    columns: "id,pacote_versao_id,autor_id,aprovada_em,motivo,simulacao",
  },
  {
    path: "/diarias/pesos",
    table: "medicao_peso",
    columns:
      "id,unidade_id,episodio_id,quantidade,unidade_medida_id,medida_em,autor_id,registrada_em,motivo",
    unit: true,
  },
  {
    path: "/diarias/classificacoes-episodio",
    table: "classificacao_episodio",
    columns:
      "id,unidade_id,episodio_id,classificacao_versao_id,inicio,fim,medicao_peso_id,avaliacao_clinica_id,suporte_ventilatorio,autor_id,motivo,encerrada_por_id,motivo_fim",
    unit: true,
  },
  {
    path: "/diarias/pacotes-episodio",
    table: "pacote_episodio",
    columns:
      "id,unidade_id,episodio_id,pacote_versao_id,inicio,fim,autor_id,motivo",
    unit: true,
  },
  {
    path: "/diarias/periodos",
    table: "periodo_diaria_consulta",
    columns:
      "id,unidade_id,episodio_id,pacote_episodio_id,pacote_versao_id,classificacao_episodio_id,inicio,fim,fuso,autor_id,motivo,necessita_revisao",
    unit: true,
  },
  {
    path: "/diarias/eventos",
    table: "evento_cobertura_consulta",
    columns:
      "id,unidade_id,episodio_id,execucao_id,consumo_item_id,ocorrido_em,item_clinico_id,produto_id,quantidade_fisica,unidade_medida_id,origem_ativa,execucao_integral,material_tutor,autor_id,motivo",
    unit: true,
  },
  {
    path: "/diarias/usos",
    table: "uso_cobertura",
    columns:
      "id,unidade_id,episodio_id,pacote_episodio_id,regra_id,periodo_diaria_id",
    unit: true,
  },
  {
    path: "/diarias/reservas",
    table: "reserva_cobertura",
    columns:
      "id,unidade_id,evento_id,uso_id,periodo_diaria_id,quantidade,expira_em,situacao,autor_id,motivo,encerrada_por_id,encerrada_em,motivo_fim",
    unit: true,
  },
  {
    path: "/diarias/avaliacoes",
    table: "avaliacao_cobertura_consulta",
    columns:
      "id,unidade_id,episodio_id,evento_id,periodo_diaria_id,uso_id,regra_id,versao,anterior_id,reserva_id,resultado,justificativa,autor_id,avaliada_em,motivo,quantidade,incluida,excedente,situacao_atual",
    unit: true,
  },
  {
    path: "/diarias/reversoes",
    table: "reversao_cobertura",
    columns: "id,unidade_id,avaliacao_id,autor_id,motivo,revertida_em",
    unit: true,
  },
].map((list) => ({ ...list, permission: "diarias:ler" }));
