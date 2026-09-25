import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { resolve, relative, isAbsolute, sep, dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import type { TLSSocket } from "node:tls";
import { pool } from "../src/persistence/database.ts";
import { buildApp } from "../src/api/app.ts";

// Runtime API probe held inside one outer rollback. API transactions map to
// savepoints; this tests handlers/SQL, not independent network transactions.
const results: {
  check: string;
  status: string;
  detail?: string;
  method?: string;
  endpoint?: string;
  expected_http?: number;
  observed_http?: number;
  sqlstate?: string | null;
}[] = [];
let balanceEvidence: unknown[] = [];
let sqlstate: string | null = null;
let db: pg.Pool | undefined,
  c: pg.PoolClient | undefined,
  begun = false,
  rollback = false;
const record = (check: string, ok: boolean, detail?: string) =>
  results.push({
    check,
    status: ok ? "PASS" : "FAIL",
    ...(detail ? { detail } : {}),
  });
try {
  if (!process.argv[2]) throw Error("private config required");
  const file = resolve(process.argv[2]),
    rel = relative(process.cwd(), file);
  if (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`))
    throw Error("private config outside workspace required");
  const env = parseEnv(await readFile(file, "utf8"));
  if (
    env.HVB_DATABASE_MODE !== "remote-dev" ||
    env.HVB_DATABASE_TLS !== "verify-full" ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" ||
    process.env.PGOPTIONS
  )
    throw Error("unsafe configuration");
  const fixture = JSON.parse(
    await readFile(join(dirname(file), "e2e-fixture.json"), "utf8"),
  );
  db = pool(env.DATABASE_URL ?? "", 1, env);
  db.on("error", () => record("pool_background_error", false));
  c = await db.connect();
  const client = c;
  const query = async (sql: string, values?: unknown[]) => {
    try {
      return await client.query(sql, values);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code && /^[A-Z0-9]{5}$/.test(code)) sqlstate = code;
      throw error;
    }
  };
  const socket = (client as unknown as { connection: { stream: TLSSocket } })
    .connection.stream;
  record("tls_verify_full", socket.encrypted && socket.authorized);
  const ledger = (
    await client.query(
      "SELECT nome,hash FROM public.schema_migration ORDER BY nome",
    )
  ).rows;
  record("canonical_count_111", ledger.length === 111);
  const bad: string[] = [];
  for (const row of ledger) {
    if (!/^\d{3}_[a-z0-9_]+\.sql$/.test(row.nome))
      throw Error("invalid filename");
    if (
      createHash("sha256")
        .update(await readFile(`migrations/${row.nome}`))
        .digest("hex") !== row.hash
    )
      bad.push(row.nome);
  }
  record("all_111_hashes", bad.length === 0);
  const authBefore = (
    await client.query(
      "SELECT md5(pg_get_functiondef('hvb.autenticar(text)'::regprocedure)) AS hash",
    )
  ).rows[0].hash;
  const views = (
    await client.query(
      "SELECT c.relname,c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='hvb' AND c.relname=ANY($1::text[])",
      [
        [
          "paciente_responsavel_consulta",
          "episodio_consulta",
          "ocupacao_consulta",
          "atribuicao_consulta",
        ],
      ],
    )
  ).rows;
  record(
    "four_security_invoker_views",
    views.length === 4 &&
      views.every((v) => v.reloptions?.includes("security_invoker=true")),
  );
  record(
    "runtime_execute_cpf_valido",
    (
      await client.query(
        "SELECT has_function_privilege(current_user,'hvb.cpf_valido(text)','EXECUTE') AS ok",
      )
    ).rows[0].ok === true,
  );
  await client.query("BEGIN");
  begun = true;
  const guardedPool = {
    query,
    connect: async () => ({
      release() {},
      async query(sql: string, values?: unknown[]) {
        if (sql === "BEGIN") return client.query("SAVEPOINT api_transaction");
        if (sql === "COMMIT") {
          // Force deferred constraints before reporting request success.
          await query("SET CONSTRAINTS ALL IMMEDIATE");
          await query("SET CONSTRAINTS ALL DEFERRED");
          return client.query("RELEASE SAVEPOINT api_transaction");
        }
        if (sql === "ROLLBACK") {
          await client.query("ROLLBACK TO SAVEPOINT api_transaction");
          return client.query("RELEASE SAVEPOINT api_transaction");
        }
        return query(sql, values);
      },
    }),
  } as unknown as pg.Pool;
  const app = await buildApp(guardedPool);
  try {
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const contract = JSON.parse(
      await readFile("openapi/hvb-sistema.json", "utf8"),
    );
    const balances: {
      stage: string;
      saldo: string;
      reservado: string;
      disponivel: string;
    }[] = [];
    balanceEvidence = balances;
    async function request(
      check: string,
      method: "GET" | "POST",
      endpoint: string,
      expected: number,
      payload?: object,
      key = randomUUID(),
    ) {
      const route = (endpoint.split("?")[0] ?? "").replace(
        /[0-9a-f]{8}-[0-9a-f-]{27}/gi,
        "{id}",
      );
      if (!contract.paths[route]?.[method.toLowerCase()])
        throw Error("noncanonical route");
      sqlstate = null;
      const response = await fetch(`${address}${endpoint}`, {
        method,
        headers: {
          authorization: `Bearer ${fixture.tenant_a.adminToken}`,
          ...(method === "POST"
            ? { "content-type": "application/json", "idempotency-key": key }
            : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(15000),
      });
      const body = (await response.json()) as Record<string, unknown>;
      results.push({
        check,
        method,
        endpoint: endpoint.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "{uuid}"),
        expected_http: expected,
        observed_http: response.status,
        sqlstate,
        status: response.status === expected ? "PASS" : "FAIL",
        ...(response.status !== expected
          ? {
              detail:
                typeof body.erro === "string" && /^[a-z_]+$/.test(body.erro)
                  ? body.erro
                  : "unexpected_response",
            }
          : {}),
      });
      return { status: response.status, body };
    }
    async function create(path: string, payload: object) {
      const r = await request(
        `create_${path}`,
        "POST",
        `/v1${path}`,
        200,
        payload,
      );
      if (r.status !== 200) throw Error("prerequisite failed");
      return r.body.id as string;
    }
    async function list(path: string) {
      const items: Record<string, unknown>[] = [];
      let cursor: string | undefined;
      do {
        const url = `/v1${path}${path.includes("?") ? "&" : "?"}limit=100${cursor ? `&cursor=${cursor}` : ""}`;
        const r = await request(`list_${path.split("?")[0]}`, "GET", url, 200);
        if (r.status !== 200) throw Error("read prerequisite");
        if (!Array.isArray(r.body.items)) throw Error("invalid list envelope");
        items.push(...(r.body.items as Record<string, unknown>[]));
        cursor =
          typeof r.body.next_cursor === "string"
            ? r.body.next_cursor
            : undefined;
      } while (cursor);
      return items;
    }
    const ready = await request("ready_111", "GET", "/ready", 200);
    record("ready_reports_111", ready.body.migration === 111);
    const me = await request("fixture_authentication", "GET", "/v1/me", 200);
    record(
      "fixture_a",
      me.body.usuario_id === fixture.tenant_a.admin &&
        me.body.organizacao_id === fixture.tenant_a.org,
    );
    await client.query("SELECT set_config('hvb.org',$1,true)", [
      fixture.tenant_a.org,
    ]);
    record(
      "fixture_natural_key",
      (
        await client.query("SELECT login FROM hvb.usuario WHERE id=$1", [
          fixture.tenant_a.admin,
        ])
      ).rows[0]?.login === "admin.remote.dev.a",
    );
    // PostgreSQL now() is fixed at outer BEGIN. Use an explicit synthetic instant
    // within that transaction's past, shared by admission and clinical events.
    const instant = (
      await client.query(
        "SELECT transaction_timestamp() - interval '1 second' AS t",
      )
    ).rows[0].t.toISOString() as string;
    const marker = `SINTETICO-ESTOQUE-${randomUUID()}`,
      now = () => instant;
    const owner = await create("/responsaveis", { nome: marker, cpf: null });
    const patient = await create("/pacientes", {
      nome: marker,
      especie_codigo: "canina",
      estado_vital: "vivo",
      responsavel_id: owner,
      papel_responsavel: "legal",
    });
    const episode = await create("/episodios", {
      paciente_id: patient,
      unidade_id: fixture.tenant_a.unit,
      tipo: "internacao",
      admitido_em: now(),
    });
    const unit = await create("/estoque/unidades", {
      simbolo: marker,
      dimensao: "contagem",
      fator_referencia: "1",
    });
    const product = await create("/estoque/produtos", {
      nome: marker,
      unidade_base_id: unit,
      finalidade: "Verificacao sintetica",
    });
    const presentation = await create("/estoque/apresentacoes", {
      produto_id: product,
      codigo: marker,
      versao: 1,
      unidade_conteudo_id: unit,
      quantidade_conteudo: "10",
      fator_unidade_base: "10",
    });
    const lot = await create("/estoque/lotes", {
      apresentacao_id: presentation,
      fabricante: "Sintetico",
      codigo: marker,
      situacao_validade: "conhecida",
      validade: "2099-12-31",
      custo_base: "1.25",
    });
    record(
      "catalog_product_found",
      (await list("/estoque/produtos")).some((p) => p.id === product),
    );
    record(
      "catalog_presentation_found",
      (await list("/estoque/apresentacoes")).some((p) => p.id === presentation),
    );
    record(
      "catalog_lot_found",
      (await list("/estoque/lotes")).some(
        (p) => p.id === lot && p.produto_id === product,
      ),
    );
    const custodias = await list("/estoque/custodias");
    const custody =
      custodias.find((c) => c.tipo === "hospital")?.id ??
      (await create("/estoque/custodias", { tipo: "hospital" }));
    const local = await create("/locais", {
      nome: marker,
      unidade_id: fixture.tenant_a.unit,
      tipo: "armario",
      capacidade: 0,
    });
    const position = await create("/estoque/posicoes", {
      local_id: local,
      lote_id: lot,
      custodia_id: custody,
    });
    async function balance(stage: string, expected: string) {
      const positions = await list(
        `/estoque/posicoes?unidade_id=${fixture.tenant_a.unit}&produto_id=${product}`,
      );
      const p = positions.find((p) => p.id === position);
      record(
        `balance_${stage}`,
        !!p &&
          p.saldo_base === expected &&
          p.disponivel_base === expected &&
          p.reservado_base === "0.000000",
      );
      if (
        p &&
        typeof p.saldo_base === "string" &&
        typeof p.reservado_base === "string" &&
        typeof p.disponivel_base === "string"
      )
        balances.push({
          stage,
          saldo: p.saldo_base,
          reservado: p.reservado_base,
          disponivel: p.disponivel_base,
        });
    }
    await balance("initial", "0.000000");
    await create("/estoque/entradas", {
      posicao_id: position,
      quantidade_apresentacoes: "2",
      ocorrido_em: now(),
      motivo: "Entrada sintetica",
    });
    await balance("entry", "20.000000");
    const consume = (amount: string) => ({
      episodio_id: episode,
      evento_referencia: randomUUID(),
      ocorrido_em: now(),
      finalidade: "Uso sintetico",
      motivo: "Teste de conciliacao",
      itens_confirmados: true,
      itens: [{ posicao_id: position, quantidade_base: amount }],
    });
    await request(
      "consumption_over_balance",
      "POST",
      "/v1/clinica/consumos",
      409,
      consume("21"),
    );
    await request(
      "reservation_over_available",
      "POST",
      "/v1/estoque/reservas",
      409,
      {
        posicao_id: position,
        quantidade_base: "21",
        expira_em: new Date(Date.now() + 3600000).toISOString(),
        motivo: "Reserva negativa sintetica",
      },
    );
    await balance("after_rejections", "20.000000");
    const key = randomUUID(),
      body = consume("3");
    const consumption = await request(
      "consumption",
      "POST",
      "/v1/clinica/consumos",
      200,
      body,
      key,
    );
    if (consumption.status !== 200) throw Error("consumption prerequisite");
    const id = consumption.body.id as string;
    const replay = await request(
      "consumption_idempotency",
      "POST",
      "/v1/clinica/consumos",
      200,
      body,
      key,
    );
    record("same_consumption_id", replay.body.id === id);
    await balance("consumption", "17.000000");
    const consumed = await list(
      `/clinica/consumos?unidade_id=${fixture.tenant_a.unit}&episodio_id=${episode}`,
    );
    record(
      "consumption_conciliado",
      consumed.length === 1 &&
        consumed[0]?.id === id &&
        consumed[0]?.situacao === "conciliado",
    );
    const items = await list(
      `/clinica/consumo-itens?unidade_id=${fixture.tenant_a.unit}&consumo_id=${id}`,
    );
    record(
      "consumption_item_reconciled",
      items.length === 1 &&
        items[0]?.posicao_id === position &&
        items[0]?.quantidade_base === "3.000000",
    );
    if (items.length !== 1) throw Error("item prerequisite");
    const txId = items[0]?.transacao_id;
    const txs = await list(
      `/estoque/transacoes?unidade_id=${fixture.tenant_a.unit}`,
    );
    record(
      "physical_consumption_found",
      txs.some(
        (t) =>
          t.id === txId &&
          t.tipo === "consumo" &&
          t.quantidade_base === "3.000000",
      ),
    );
    const ledger = await list(
      `/estoque/lancamentos?unidade_id=${fixture.tenant_a.unit}&transacao_id=${txId}`,
    );
    record(
      "balanced_consumption_ledger",
      ledger.length === 2 &&
        ledger.some((l) => l.quantidade_assinada === "-3.000000") &&
        ledger.some((l) => l.quantidade_assinada === "3.000000"),
    );
    const reverseKey = randomUUID(),
      reverseBody = {
        ocorrido_em: now(),
        motivo: "Estorno sintetico integral",
      };
    const reversal = await request(
      "consumption_reversal",
      "POST",
      `/v1/clinica/consumos/${id}/reverter`,
      200,
      reverseBody,
      reverseKey,
    );
    const reverseReplay = await request(
      "reversal_idempotency",
      "POST",
      `/v1/clinica/consumos/${id}/reverter`,
      200,
      reverseBody,
      reverseKey,
    );
    record(
      "same_reversal_id",
      reversal.status === 200 && reverseReplay.body.id === reversal.body.id,
    );
    await balance("reversal", "20.000000");
    const reversed = await list(
      `/clinica/consumos?unidade_id=${fixture.tenant_a.unit}&episodio_id=${episode}`,
    );
    record(
      "consumption_estornado",
      reversed.length === 1 &&
        reversed[0]?.id === id &&
        reversed[0]?.situacao === "estornado" &&
        reversed[0]?.estorno_id === reversal.body.id,
    );
    const rtxs = await list(
      `/estoque/transacoes?unidade_id=${fixture.tenant_a.unit}`,
    );
    const physical = rtxs.filter((t) => t.reversao_de_id === txId);
    record(
      "single_physical_reversal",
      physical.length === 1 &&
        physical[0]?.quantidade_base === "3.000000" &&
        physical[0]?.destino_id === position,
    );
    if (physical.length === 1) {
      const l = await list(
        `/estoque/lancamentos?unidade_id=${fixture.tenant_a.unit}&transacao_id=${physical[0]?.id}`,
      );
      record(
        "balanced_reversal_ledger",
        l.length === 2 &&
          l.some((x) => x.quantidade_assinada === "-3.000000") &&
          l.some((x) => x.quantidade_assinada === "3.000000"),
      );
    }
    await request(
      "second_reversal_different_key",
      "POST",
      `/v1/clinica/consumos/${id}/reverter`,
      409,
      reverseBody,
    );
    await balance("after_duplicate_rejection", "20.000000");
    const cross = await request(
      "foreign_unit_read",
      "GET",
      `/v1/estoque/posicoes?unidade_id=${fixture.tenant_b.unit}`,
      200,
    );
    record(
      "foreign_unit_no_data",
      cross.status === 200 &&
        Array.isArray(cross.body.items) &&
        cross.body.items.length === 0,
    );
    await client.query("SELECT set_config('hvb.org',$1,true)", [
      fixture.tenant_b.org,
    ]);
    record(
      "rls_b_cannot_read_a_position",
      (
        await client.query("SELECT id FROM hvb.posicao_estoque WHERE id=$1", [
          position,
        ])
      ).rowCount === 0,
    );
    await client.query("SELECT set_config('hvb.org',$1,true)", [
      fixture.tenant_a.org,
    ]);
    const assignments = (await list("/atribuicoes")).filter(
      (a) => a.usuario_id === fixture.tenant_a.admin && a.ativo,
    );
    if (assignments.length === 1) {
      await client.query("SAVEPOINT denied_permission_fixture");
      try {
        const a = assignments[0];
        if (!a) throw Error("assignment prerequisite");
        await request(
          "temporary_assignment_revocation",
          "POST",
          `/v1/atribuicoes/${a.id}/revisoes`,
          200,
          {
            ativo: false,
            versao_esperada: a.versao,
            motivo: "Teste sintetico com rollback",
            simulacao: true,
            confirmacao_humana: true,
          },
        );
        await request(
          "no_stock_read_permission",
          "GET",
          "/v1/estoque/produtos",
          403,
        );
        await request(
          "no_stock_write_permission",
          "POST",
          "/v1/estoque/entradas",
          403,
          {
            posicao_id: position,
            quantidade_apresentacoes: "1",
            ocorrido_em: now(),
            motivo: "Teste negativo sem permissao",
          },
        );
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT denied_permission_fixture");
        await client.query("RELEASE SAVEPOINT denied_permission_fixture");
      }
      await balance("after_rbac_rollback", "20.000000");
    } else
      results.push({
        check: "negative_permission_fixture",
        status: "BLOCKED",
        detail: "fixture_requires_exactly_one_active_assignment",
      });
    balanceEvidence = balances;
  } finally {
    await app.close();
  }
  record(
    "autenticar_preserved",
    (
      await client.query(
        "SELECT md5(pg_get_functiondef('hvb.autenticar(text)'::regprocedure)) AS hash",
      )
    ).rows[0].hash === authBefore,
  );
} catch (e) {
  const code = (e as { code?: string }).code;
  results.push({
    check: "execution",
    status: "FAIL",
    detail: code && /^[A-Z0-9]{5}$/.test(code) ? code : "REDACTED",
  });
} finally {
  try {
    if (c && begun) {
      await c.query("ROLLBACK");
      rollback = true;
    }
  } catch {
    record("rollback", false);
  }
  c?.release();
  try {
    await db?.end();
  } catch {
    record("pool_cleanup", false);
  }
}
console.log(
  JSON.stringify(
    {
      environment:
        "Supabase DEV Node/pg, real HTTP loopback + Supabase TLS, rollback savepoints",
      rollback,
      balances: balanceEvidence,
      passed: results.filter((r) => r.status === "PASS").length,
      failed: results.filter((r) => r.status === "FAIL").length,
      blocked: results.filter((r) => r.status === "BLOCKED").length,
      results,
    },
    null,
    2,
  ),
);
if (!rollback || results.some((r) => r.status !== "PASS")) process.exitCode = 1;
