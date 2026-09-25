import { terminalV1Actions } from "../domain/terminal-v1/service.ts";
import {
  patientExtraFields,
  responsibleExtraFields,
} from "../domain/registration-fields.ts";
import { registerWebContext } from "../domain/web-context.ts";
import {
  operationalInputs,
  operationalActions,
  operationalResponses,
  registerOperationalReads,
} from "../domain/operational-registration.ts";
import { terminalV1Inputs } from "../domain/terminal-v1/schemas.ts";
import { registerTerminalV1 } from "../domain/terminal-v1/routes.ts";
import type { V1EvidenceAdapter } from "../domain/terminal-v1/evidence.ts";
import {
  financialCorrectionInputs,
  financialCorrectionActions,
  financialCorrectionLists,
} from "../domain/financial-corrections/service.ts";
import {
  dailyCorrectionInputs,
  dailyCorrectionActions,
  dailyCorrectionLists,
} from "../domain/daily-corrections/service.ts";
import {
  clinicalCorrectionInputs,
  clinicalCorrectionActions,
  clinicalCorrectionLists,
} from "../domain/clinical-corrections/service.ts";
import { terminalAccessActions } from "../domain/terminal-access/service.ts";
import { accessInputs } from "../domain/terminal-access/schemas.ts";
import { registerTerminalAccess } from "../domain/terminal-access/routes.ts";
import type { TerminalEvidenceAdapter } from "../domain/terminal-access/evidence.ts";
import {
  registryInputs,
  registryActions,
} from "../domain/registry-corrections/service.ts";
import { registerRegistryCorrections } from "../domain/registry-corrections/routes.ts";
import {
  linksInputs,
  linksActions,
  linksLists,
} from "../domain/links-audit/service.ts";
import { registerReadAudit } from "../domain/links-audit/routes.ts";
import { auditedTransaction } from "../domain/links-audit/read-audit.ts";
import {
  medicalComplementActions,
  medicalComplementLists,
} from "../domain/medical-complements/service.ts";
import { medicalComplementInputs } from "../domain/medical-complements/schemas.ts";
import { registerMedicalComplements } from "../domain/medical-complements/routes.ts";
import {
  supplierOutflowActions,
  supplierOutflowLists,
} from "../domain/supplier-outflow/service.ts";
import { supplierOutflowInputs } from "../domain/supplier-outflow/schemas.ts";
import {
  supplierCreditActions,
  supplierCreditLists,
} from "../domain/supplier-credit/service.ts";
import { supplierCreditInputs } from "../domain/supplier-credit/schemas.ts";
import {
  installmentActions,
  installmentLists,
} from "../domain/supplier-installments/service.ts";
import { installmentInputs } from "../domain/supplier-installments/schemas.ts";
import {
  acquisitionActions,
  acquisitionLists,
} from "../domain/acquisition-cost/service.ts";
import { acquisitionInputs } from "../domain/acquisition-cost/schemas.ts";
import {
  pricingActions,
  pricingLists,
} from "../domain/purchase-pricing/service.ts";
import { pricingInputs } from "../domain/purchase-pricing/schemas.ts";
import { registerTerminal } from "../domain/terminal/routes.ts";
import { terminalActions, terminalLists } from "../domain/terminal/service.ts";
import { terminalInputs } from "../domain/terminal/schemas.ts";
import { payableActions, payableLists } from "../domain/payables/service.ts";
import { payableInputs } from "../domain/payables/schemas.ts";
import {
  medicalActions,
  medicalLists,
} from "../domain/medical-record/service.ts";
import {
  medicalInputs,
  medicalContent,
} from "../domain/medical-record/schemas.ts";
import { registerMedicalRecord } from "../domain/medical-record/routes.ts";
import { purchaseActions, purchaseLists } from "../domain/purchases/service.ts";
import { purchaseInputs } from "../domain/purchases/schemas.ts";
import { portalActions, portalLists } from "../domain/portal/service.ts";
import { portalInputs } from "../domain/portal/schemas.ts";
import { registerPortal } from "../domain/portal/routes.ts";
import { scheduleActions, scheduleLists } from "../domain/schedule/service.ts";
import { scheduleInputs } from "../domain/schedule/schemas.ts";
import { documentActions, documentLists } from "../domain/documents/service.ts";
import { documentInputs, documentFields } from "../domain/documents/schemas.ts";
import {
  preventiveActions,
  preventiveLists,
} from "../domain/preventive/service.ts";
import { preventiveInputs } from "../domain/preventive/schemas.ts";
import { randomUUID } from "node:crypto";
import Fastify, { LogController } from "fastify";
import swagger from "@fastify/swagger";
import type { FastifyRequest } from "fastify";
import type pg from "pg";
import { authorize, command, digest, DomainError } from "../domain/core.ts";
import type { Actor } from "../domain/core.ts";
import { actions, lists } from "../domain/foundation.ts";
import type { Body } from "../domain/foundation.ts";
import { inputs, object, uuid, text } from "../domain/schemas.ts";

import {
  inventoryActions,
  inventoryLists,
} from "../domain/inventory/service.ts";
import { inventoryInputs, amount } from "../domain/inventory/schemas.ts";
import { clinicalActions, clinicalLists } from "../domain/clinical/service.ts";
import { clinicalInputs } from "../domain/clinical/schemas.ts";
import { dailyActions, dailyLists } from "../domain/daily/service.ts";
import { dailyInputs } from "../domain/daily/schemas.ts";
import {
  financialActions,
  financialLists,
} from "../domain/financial/service.ts";
import { financialInputs, money } from "../domain/financial/schemas.ts";
import { examActions, examLists } from "../domain/exams/service.ts";
import {
  examInputs,
  examNumber,
  examBoolean,
} from "../domain/exams/schemas.ts";

function strictValues(schema: unknown, value: unknown): void {
  if (value === undefined) return;
  if (
    schema === patientExtraFields.castrado &&
    value !== null &&
    typeof value !== "boolean"
  )
    throw new DomainError(400, "booleanos_devem_ser_explicitos");
  if (schema === medicalContent && typeof value !== "string")
    throw new DomainError(400, "evolucao_exige_texto_explicito");
  if (
    schema === documentFields &&
    value &&
    typeof value === "object" &&
    Object.values(value).some((v) => typeof v !== "string")
  )
    throw new DomainError(400, "campos_documentais_devem_ser_texto");
  const field = schema as {
    properties?: Record<string, unknown>;
    items?: unknown;
    const?: unknown;
  };
  if (
    (schema === amount || schema === money || schema === examNumber) &&
    typeof value !== "string"
  )
    throw new DomainError(400, "decimais_devem_ser_strings");
  if (schema === examBoolean && typeof value !== "boolean")
    throw new DomainError(400, "booleanos_devem_ser_explicitos");
  if (field.const === true && value !== true)
    throw new DomainError(400, "confirmacao_humana_explicita_obrigatoria");
  if (field.items && Array.isArray(value))
    for (const item of value) strictValues(field.items, item);
  if (
    field.properties &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    for (const [key, child] of Object.entries(field.properties))
      strictValues(child, (value as Record<string, unknown>)[key]);
}

const errorSchema = object({ erro: text, correlation_id: uuid });
const errors = Object.fromEntries(
  [400, 401, 403, 404, 409, 413, 415, 503, 500].map((code) => [
    code,
    errorSchema,
  ]),
);
const headers = object(
  {
    authorization: { type: "string", pattern: "^Bearer [a-f0-9]{64}$" },
    "idempotency-key": { type: "string", pattern: "^[A-Za-z0-9._:-]{8,128}$" },
    "x-device-id": uuid,
  },
  ["authorization", "idempotency-key"],
);
headers.additionalProperties = true;
export async function buildApp(
  db: pg.Pool,
  logging = false,
  terminalEvidence?: TerminalEvidenceAdapter,
  terminalV1Evidence?: V1EvidenceAdapter,
) {
  const app = Fastify({
    bodyLimit: 32768,
    logger: logging,
    logController: new LogController({ disableRequestLogging: true }),
    genReqId: () => randomUUID(),
    requestTimeout: 10000,
    connectionTimeout: 10000,
    ajv: { customOptions: { removeAdditional: false } },
    forceCloseConnections: true,
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "HVB Sistema — Clínica, Financeiro e Exames",
        version: "0.28.0",
      },
      servers: [{ url: "http://127.0.0.1:3100" }],
      components: {
        securitySchemes: {
          portalBearer: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "opaque-portal-dev",
          },
          bearer: { type: "http", scheme: "bearer", bearerFormat: "opaque" },
        },
      },
    },
  });
  app.addHook("onRequest", async (req, reply) => {
    reply.header("x-correlation-id", req.id);
    reply.header("cache-control", "no-store");
    reply.header("x-content-type-options", "nosniff");
  });
  app.addHook("onResponse", async (req, reply) => {
    app.log.info(
      {
        correlation_id: req.id,
        route: req.routeOptions.url,
        method: req.method,
        status: reply.statusCode,
        duration_ms: reply.elapsedTime,
      },
      "http",
    );
  });
  app.setErrorHandler((error, req, reply) => {
    const e = error as {
      code?: string;
      statusCode?: number;
      validation?: unknown;
    };
    let status = 500;
    let code = "erro_interno";
    if (error instanceof DomainError) {
      status = error.statusCode;
      code = error.code;
    } else if (
      e.validation ||
      ["FST_ERR_CTP_INVALID_JSON_BODY", "FST_ERR_CTP_EMPTY_JSON_BODY"].includes(
        e.code ?? "",
      )
    ) {
      status = 400;
      code = "requisicao_invalida";
    } else if (
      ["23503", "23505", "23514", "23P01", "P0002"].includes(e.code ?? "")
    ) {
      status = 409;
      code = "conflito_de_integridade";
    } else if (e.code === "22003") {
      status = 400;
      code = "quantidade_fora_do_limite";
    } else if (
      ["55P03", "57014", "40P01", "40001", "ECONNREFUSED", "57P01"].includes(
        e.code ?? "",
      )
    ) {
      status = 503;
      code = "temporariamente_indisponivel_repita_mesma_chave";
    } else if (e.statusCode === 413 || e.statusCode === 415) {
      status = e.statusCode;
      code = "corpo_invalido";
    }
    if (status === 500)
      app.log.error(
        { correlation_id: req.id, code: e.code ?? "unknown" },
        "request_failed",
      );
    reply.code(status).send({ erro: code, correlation_id: req.id });
  });
  app.setNotFoundHandler((req, reply) =>
    reply
      .code(404)
      .send({ erro: "rota_nao_encontrada", correlation_id: req.id }),
  );
  async function authenticated<T>(
    req: FastifyRequest,
    work: (tx: pg.PoolClient, a: Actor) => Promise<T>,
  ) {
    const token = req.headers.authorization?.match(
      /^Bearer ([a-f0-9]{64})$/,
    )?.[1];
    if (!token) throw new DomainError(401, "credencial_invalida");
    const identity = await db.query("SELECT * FROM hvb.autenticar($1)", [
      digest(token),
    ]);
    const actor = identity.rows[0] as Actor | undefined;
    if (!actor) throw new DomainError(401, "credencial_invalida");
    return auditedTransaction(db, req, actor, async (tx) => {
      // Serialize revocation/deactivation against already authorized mutations.
      const valid = await tx.query(
        `SELECT c.id FROM credencial c JOIN usuario u
        ON (u.organizacao_id,u.id)=(c.organizacao_id,c.usuario_id)
        WHERE c.id=$1 AND c.revogada_em IS NULL AND c.expira_em>now() AND u.ativo FOR SHARE OF c,u`,
        [actor.credencial_id],
      );
      if (!valid.rowCount) throw new DomainError(401, "credencial_invalida");
      return work(tx, actor);
    });
  }
  registerWebContext(app, authenticated, errors);
  registerOperationalReads(app, authenticated, errors);
  registerPortal(app, db, errors);
  registerMedicalRecord(app, authenticated, errors);
  registerMedicalComplements(app, authenticated, errors);
  registerReadAudit(app, authenticated, errors);
  registerRegistryCorrections(app, authenticated, errors);
  app.get(
    "/health",
    {
      schema: {
        response: { 200: object({ status: { const: "ok", type: "string" } }) },
      },
    },
    async () => ({ status: "ok" }),
  );
  app.get(
    "/ready",
    {
      schema: {
        response: {
          200: object({ status: { const: "ready", type: "string" } }),
          ...errors,
        },
      },
    },
    async () => {
      try {
        const r = await db.query(
          `SELECT EXISTS(SELECT 1 FROM public.schema_migration
              WHERE nome='102_assignment_read_scope.sql' AND hash='f4a5488800ce4be81458ab878390bca833bc46a4c2efb6d78495e66d4752987b')
            AND (SELECT count(DISTINCT substring(nome,1,3)) FROM public.schema_migration
              WHERE nome ~ '^[0-9]{3}_' AND substring(nome,1,3)::integer BETWEEN 1 AND 102)=102
            AND pg_has_role(current_user,'hvb_app','USAGE')
            AND has_schema_privilege(current_user,'hvb','USAGE')
            AND has_function_privilege(current_user,'hvb.autenticar(text)','EXECUTE')
            AND has_table_privilege(current_user,'hvb.credencial','SELECT')
            AND has_table_privilege(current_user,'hvb.usuario','SELECT')
            AND NOT (SELECT rolsuper OR rolbypassrls FROM pg_roles
              WHERE rolname=current_user) AS ready`,
        );
        if (!r.rows[0].ready) throw new Error("not ready");
        return { status: "ready" };
      } catch {
        throw new DomainError(503, "banco_ou_schema_indisponivel");
      }
    },
  );
  app.get(
    "/v1/me",
    {
      schema: {
        security: [{ bearer: [] }],
        response: {
          200: object({
            organizacao_id: uuid,
            usuario_id: uuid,
            credencial_id: uuid,
          }),
          ...errors,
        },
      },
    },
    (req) => authenticated(req, async (_tx, a) => a),
  );
  app.get(
    "/v1/organizacao",
    {
      schema: {
        security: [{ bearer: [] }],
        response: { 200: object({ id: uuid, nome: text }), ...errors },
      },
    },
    (req) =>
      authenticated(req, async (tx, a) => {
        await authorize(tx, a, "cadastros:ler");
        return (
          await tx.query("SELECT id,nome FROM organizacao WHERE id=$1", [
            a.organizacao_id,
          ])
        ).rows[0];
      }),
  );
  const allInputs: Record<string, unknown> = {
    ...inputs,
    ...inventoryInputs,
    ...clinicalInputs,
    ...clinicalCorrectionInputs,
    ...dailyCorrectionInputs,
    ...financialCorrectionInputs,
    ...dailyInputs,
    ...financialInputs,
    ...examInputs,
    ...preventiveInputs,
    ...documentInputs,
    ...scheduleInputs,
    ...portalInputs,
    ...purchaseInputs,
    ...payableInputs,
    ...terminalInputs,
    ...accessInputs,
    ...terminalV1Inputs,
    ...pricingInputs,
    ...acquisitionInputs,
    ...installmentInputs,
    ...supplierCreditInputs,
    ...supplierOutflowInputs,
    ...medicalInputs,
    ...medicalComplementInputs,
    ...linksInputs,
    ...registryInputs,
    ...operationalInputs,
  };
  for (const action of [
    ...actions,
    ...inventoryActions,
    ...clinicalActions,
    ...clinicalCorrectionActions,
    ...dailyCorrectionActions,
    ...financialCorrectionActions,
    ...dailyActions,
    ...financialActions,
    ...examActions,
    ...preventiveActions,
    ...documentActions,
    ...scheduleActions,
    ...portalActions,
    ...purchaseActions,
    ...payableActions,
    ...terminalActions,
    ...terminalAccessActions(terminalEvidence),
    ...terminalV1Actions(terminalV1Evidence),
    ...pricingActions,
    ...acquisitionActions,
    ...installmentActions,
    ...supplierCreditActions,
    ...supplierOutflowActions,
    ...medicalActions,
    ...medicalComplementActions,
    ...linksActions,
    ...registryActions,
    ...operationalActions,
  ]) {
    app.post(
      `/v1${action.path}`,
      {
        ...(action.input === "medicalAttachment" ? { bodyLimit: 360000 } : {}),
        preValidation: async (req) => {
          strictValues(allInputs[action.input], req.body);
        },
        schema: {
          operationId: `post_${action.path.replace(/[^a-z]/g, "_")}`,
          ...(action.path === "/terminal/retiradas"
            ? {
                deprecated: true,
                description:
                  "Legado C5: novos comandos bloqueados (409). Retry de comando histórico confirmado recupera o resultado original. Use Terminal de Acesso V2.",
              }
            : {}),
          security: [{ bearer: [] }],
          headers: action.deviceRequired
            ? { ...headers, required: [...headers.required, "x-device-id"] }
            : headers,
          body: allInputs[action.input],
          ...(action.path.includes(":id")
            ? { params: object({ id: uuid }) }
            : {}),
          response: {
            200: object(
              {
                id: uuid,
                comando_id: uuid,
                estado: { type: "string", const: "confirmado" },
                repetido: { type: "boolean" },
                versao: { type: "integer" },
                ordem_id: uuid,
                ordem_versao_id: uuid,
                agendamento_versao_id: uuid,
                ...operationalResponses[action.path],
                evolucao_versao_id: uuid,
                resultado: {
                  type: "string",
                  enum: [
                    "incluido",
                    "parcial",
                    "excedente",
                    "excluido",
                    "pendente",
                  ],
                },
              },
              ["id", "comando_id", "estado", "repetido"],
            ),
            ...errors,
          },
        },
      },
      (req) =>
        authenticated(req, async (tx, a) => {
          const body = req.body as Body;
          const id = (req.params as { id?: string }).id ?? "";
          const unit = action.scope
            ? await action.scope(tx, a, body, id)
            : undefined;
          await authorize(tx, a, action.permission, unit);
          const device = req.headers["x-device-id"] as string | undefined;
          if (device && unit) {
            const d = await tx.query(
              "SELECT 1 FROM dispositivo WHERE organizacao_id=$1 AND id=$2 AND unidade_id=$3",
              [a.organizacao_id, device, unit],
            );
            if (!d.rowCount)
              throw new DomainError(403, "dispositivo_fora_da_unidade");
          }
          return command(
            tx,
            a,
            req.headers["idempotency-key"] as string,
            action.path,
            { id, body },
            device,
            req.id,
            (commandId) => action.run(tx, a, body, id, commandId),
          );
        }),
    );
  }
  for (const list of [
    ...lists,
    ...inventoryLists,
    ...clinicalLists,
    ...clinicalCorrectionLists,
    ...dailyCorrectionLists,
    ...financialCorrectionLists,
    ...dailyLists,
    ...financialLists,
    ...examLists,
    ...preventiveLists,
    ...documentLists,
    ...scheduleLists,
    ...portalLists,
    ...purchaseLists,
    ...payableLists,
    ...terminalLists,
    ...pricingLists,
    ...acquisitionLists,
    ...installmentLists,
    ...supplierCreditLists,
    ...supplierOutflowLists,
    ...medicalLists,
    ...medicalComplementLists,
    ...linksLists,
  ]) {
    const stockPosition = list.table === "posicao_estoque";
    const stockLedger = list.table === "lancamento_estoque_consulta";
    const clinical =
      list.path.startsWith("/clinica/") ||
      list.path.startsWith("/diarias/") ||
      list.path.startsWith("/financeiro/") ||
      list.path.startsWith("/exames/") ||
      list.path.startsWith("/protocolos/") ||
      list.path.startsWith("/documentos/") ||
      list.path.startsWith("/agenda/") ||
      list.path.startsWith("/comunicacao/") ||
      list.path.startsWith("/compras/") ||
      list.path.startsWith("/a-pagar/") ||
      list.path.startsWith("/terminal/") ||
      list.path.startsWith("/prontuario/");
    const agendaMap = list.table === "agenda_mapa_consulta";
    const schedule = list.table === "programacao_consulta" || agendaMap;
    const clinicalFilters = clinical
      ? [
          "episodio_id",
          "ordem_id",
          "ordem_versao_id",
          "programacao_id",
          "execucao_id",
          "consumo_id",
          "produto_id",
          "item_clinico_id",
          "grupo_versao_id",
          "pacote_versao_id",
          "pacote_episodio_id",
          "periodo_diaria_id",
          "evento_id",
          "uso_id",
          "regra_id",
          "conta_id",
          "pagador_id",
          "titulo_id",
          "recebimento_id",
          "credito_id",
          "sessao_id",
          "caixa_id",
          "item_conta_id",
          "avaliacao_id",
          "responsabilidade_id",
          "deposito_id",
          ...(list.path.startsWith("/financeiro/")
            ? ["extrato_id", "anterior_id"]
            : []),
          "parcela_id",
          "conta_financeira_id",
          "item_comercial_id",
          "resultado_id",
          "item_exame_id",
          "solicitacao_id",
          "exame_id",
          "exame_versao_id",
          "atributo_id",
          "laboratorio_id",
          "coleta_id",
          "protocolo_id",
          "protocolo_versao_id",
          "protocolo_paciente_id",
          "etapa_id",
          "ocorrencia_id",
          "aplicacao_id",
          "revisao_id",
          "modelo_id",
          "modelo_versao_id",
          "documento_versao_id",
          "autorizacao_id",
          "agendamento_id",
          "agendamento_versao_id",
          "recurso_id",
          "disponibilidade_id",
          "conta_portal_id",
          "concessao_id",
          "mensagem_id",
          "tentativa_id",
          "pedido_id",
          "fornecedor_id",
          ...(list.path.startsWith("/a-pagar/")
            ? [
                "obrigacao_id",
                "correcao_de_id",
                "origem_obrigacao_id",
                "saida_id",
                "conciliacao_id",
                "plano_id",
                "alocacao_id",
                "pagamento_id",
                "liquidacao_id",
              ]
            : []),
          "apresentacao_id",
          "item_pedido_id",
          ...(list.path.startsWith("/compras/")
            ? [
                "precificacao_id",
                "vinculo_id",
                "obrigacao_id",
                "rateio_id",
                "item_rateio_id",
                "recebimento_item_id",
                "custo_recebimento_id",
              ]
            : []),
          ...(list.path.startsWith("/agenda/") ? ["vinculo_id"] : []),
          "evolucao_id",
          ...(list.path.startsWith("/prontuario/")
            ? ["evolucao_versao_id", "anexo_id", "coautoria_id"]
            : []),
          ...(list.path.startsWith("/terminal/")
            ? ["etiqueta_id", "leitura_id", "dispositivo_id"]
            : []),
          "posicao_id",
        ].filter((f) => list.columns.split(",").includes(f))
      : [];
    const query = object(
      {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
        cursor: uuid,
        ...(["paciente", "responsavel"].includes(list.table)
          ? { q: text }
          : {}),
        ...(list.table === "paciente_responsavel_consulta"
          ? { paciente_id: uuid, responsavel_id: uuid }
          : {}),
        ...(list.table === "ocupacao_consulta"
          ? { episodio_id: uuid, paciente_id: uuid }
          : {}),
        ...(list.unit ? { unidade_id: uuid } : {}),
        ...(stockPosition
          ? {
              produto_id: uuid,
              lote_id: uuid,
              local_id: uuid,
              custodia_id: uuid,
              disponiveis: { type: "boolean" },
            }
          : {}),
        ...(stockLedger ? { transacao_id: uuid } : {}),
        ...Object.fromEntries(clinicalFilters.map((f) => [f, uuid])),
        ...(agendaMap ? { recurso_id: uuid } : {}),
        ...(schedule
          ? {
              inicio: { type: "string", format: "date-time" },
              fim: { type: "string", format: "date-time" },
            }
          : {}),
        ...(list.table === "pendencia_clinica_consulta"
          ? { situacao: { type: "string", enum: ["aberta", "resolvida"] } }
          : {}),
        ...((list.path.startsWith("/protocolos/") ||
          list.path.startsWith("/documentos/") ||
          list.path.startsWith("/agenda/") ||
          list.path.startsWith("/comunicacao/") ||
          list.path.startsWith("/prontuario/")) &&
        list.columns.split(",").includes("paciente_id")
          ? { paciente_id: uuid }
          : {}),
        ...(list.table === "episodio_consulta"
          ? { paciente_id: uuid, ativos: { type: "boolean" } }
          : {}),
      },
      list.unit
        ? [
            "unidade_id",
            ...(schedule ? ["inicio", "fim"] : []),
            ...(list.table === "documento_conteudo_consulta"
              ? ["documento_versao_id"]
              : []),
            ...(list.table === "documento_resultado_consulta"
              ? ["resultado_id"]
              : []),
          ]
        : [],
    );
    const properties = Object.fromEntries(
      list.columns.split(",").map((column) => [
        column,
        list.table === "responsavel" && column in responsibleExtraFields
          ? responsibleExtraFields[
              column as keyof typeof responsibleExtraFields
            ]
          : list.table === "paciente" && column in patientExtraFields
            ? patientExtraFields[column as keyof typeof patientExtraFields]
            : column === "id" || column.endsWith("_id")
              ? {
                  ...uuid,
                  nullable: column !== "id",
                }
              : column === "numero" && list.table === "valor_resultado"
                ? { type: "string", nullable: true }
                : [
                      "ativo",
                      "simulacao",
                      "origem_ativa",
                      "execucao_integral",
                      "material_tutor",
                      "necessita_revisao",
                      "etiqueta_ativa",
                      "utilizada",
                      "revisao_temporal",
                      "revertido",
                      "revertida",
                      "obrigacao_revertida",
                      "preco_atual",
                      "recebimento_revertido",
                      "fechada",
                      "exige_coleta",
                      "obrigatorio",
                      "inclui_idade_min",
                      "inclui_idade_max",
                      "inclui_inferior",
                      "inclui_superior",
                      "booleano",
                      "pendencias_confirmadas",
                      "liberado",
                      "substituido",
                      "ha_versao_pendente",
                      "faltam_obrigatorios",
                      "tem_pendencias",
                      "ativa",
                      "material_revisao",
                      "estornado",
                      "acesso_vigente",
                      "prazo_vencido",
                      "aprovado",
                      "ha_versao_posterior",
                      "atual",
                      "revogada",
                      "vigente",
                      "permitida",
                    ].includes(column)
                  ? { type: "boolean", nullable: column === "booleano" }
                  : [
                        ...(list.table === "anexo_evolucao_consulta"
                          ? ["tamanho"]
                          : []),
                        ...(list.table === "vinculo_agendamento_consulta"
                          ? ["episodio_versao"]
                          : []),
                        "capacidade",
                        "vaga",
                        "versao",
                        "tentativas",
                        "versao_snapshot",
                        "prioridade",
                        "numero",
                        "idade_dias",
                        "idade_min_dias",
                        "idade_max_dias",
                        "ordem",
                        "sequencia",
                        "deslocamento_dias",
                        "intervalo",
                      ].includes(column)
                    ? {
                        type: "integer",
                        nullable: [
                          "idade_dias",
                          "idade_min_dias",
                          "idade_max_dias",
                        ].includes(column),
                      }
                    : { type: "string", nullable: true },
      ]),
    );
    app.get(
      `/v1${list.path}`,
      {
        schema: {
          security: [{ bearer: [] }],
          querystring: query,
          response: {
            200: object({
              items: { type: "array", items: object(properties) },
              next_cursor: { ...uuid, nullable: true },
            }),
            ...errors,
          },
        },
      },
      (req) =>
        authenticated(req, async (tx, a) => {
          const q = req.query as {
            [key: string]: unknown;
            limit: number;
            cursor?: string;
            unidade_id?: string;
            paciente_id?: string;
            ativos?: boolean;
            produto_id?: string;
            lote_id?: string;
            local_id?: string;
            custodia_id?: string;
            transacao_id?: string;
            disponiveis?: boolean;
          };
          await authorize(tx, a, list.permission, q.unidade_id);
          const values: unknown[] = [
            a.organizacao_id,
            q.cursor ?? null,
            q.limit + 1,
          ];
          const where = ["organizacao_id=$1", "($2::uuid IS NULL OR id>$2)"];
          if (list.table === "paciente" && typeof q.q === "string") {
            values.push(q.q.trim());
            where.push(
              `(strpos(lower(nome),lower($${values.length}))>0 OR id::text=lower($${values.length}) OR microchip=upper(regexp_replace($${values.length},'[[:space:]]+','','g')))`,
            );
          }
          if (list.table === "responsavel" && typeof q.q === "string") {
            values.push(q.q.trim());
            const index = values.length;
            where.push(
              `(strpos(lower(nome),lower($${index}))>0 OR id::text=lower($${index}) OR email=lower($${index}) OR (regexp_replace($${index},'[^0-9]','','g')<>'' AND (cpf=regexp_replace($${index},'[^0-9]','','g') OR telefone_whatsapp=regexp_replace($${index},'[^0-9]','','g'))))`,
            );
          }
          if (list.unit) {
            values.push(q.unidade_id);
            where.push(`unidade_id=$${values.length}`);
          }
          if (q.paciente_id) {
            values.push(q.paciente_id);
            where.push(`paciente_id=$${values.length}`);
          }
          for (const field of ["responsavel_id", "episodio_id"] as const) {
            if (
              q[field] &&
              ["paciente_responsavel_consulta", "ocupacao_consulta"].includes(
                list.table,
              )
            ) {
              values.push(q[field]);
              where.push(`${field}=$${values.length}`);
            }
          }
          if (q.ativos !== undefined)
            where.push(`encerrado_em IS ${q.ativos ? "" : "NOT "}NULL`);
          for (const field of [
            "lote_id",
            "local_id",
            "custodia_id",
            "transacao_id",
          ] as const) {
            if (q[field]) {
              values.push(q[field]);
              where.push(`${field}=$${values.length}`);
            }
          }
          if (stockPosition && q.produto_id) {
            values.push(q.produto_id);
            where.push(
              `lote_id IN (SELECT id FROM lote WHERE organizacao_id=$1 AND produto_id=$${values.length})`,
            );
          }
          if (stockPosition && q.disponiveis !== undefined)
            where.push(`disponivel_base ${q.disponiveis ? ">" : "="} 0`);
          for (const field of clinicalFilters)
            if (q[field]) {
              values.push(q[field]);
              where.push(`${field}=$${values.length}`);
            }
          if (schedule) {
            const start = Date.parse(q.inicio as string),
              end = Date.parse(q.fim as string);
            if (
              !Number.isFinite(start) ||
              !Number.isFinite(end) ||
              end <= start ||
              end - start > 7 * 86400000
            )
              throw new DomainError(400, "mapa_exige_periodo_de_ate_sete_dias");
            values.push(q.inicio, q.fim);
            where.push(
              agendaMap
                ? `inicio<$${values.length} AND fim>$${values.length - 1}`
                : `prevista_em>=$${values.length - 1} AND prevista_em<$${values.length}`,
            );
          }
          if (agendaMap && q.recurso_id) {
            values.push(q.recurso_id);
            where.push(
              `EXISTS(SELECT 1 FROM agendamento_recurso ar WHERE ar.organizacao_id=$1 AND ar.agendamento_versao_id=agenda_mapa_consulta.id AND ar.recurso_id=$${values.length})`,
            );
          }
          if (list.table === "pendencia_clinica_consulta" && q.situacao) {
            values.push(q.situacao);
            where.push(`situacao=$${values.length}`);
          }
          const source =
            list.table === "paciente_responsavel_consulta"
              ? "(SELECT vinculo_id AS id,v.* FROM paciente_responsavel_consulta v) vinculos"
              : list.table;
          const columns = list.columns
            .split(",")
            .map((c) =>
              c === "data_nascimento"
                ? "data_nascimento::text AS data_nascimento"
                : c,
            )
            .join(",");
          const r = await tx.query(
            `SELECT ${columns} FROM ${source} WHERE ${where.join(" AND ")} ORDER BY id LIMIT $3`,
            values,
          );
          const items = r.rows.slice(0, q.limit);
          return {
            items,
            next_cursor: r.rows.length > q.limit ? items.at(-1)?.id : null,
          };
        }),
    );
  }
  registerTerminal(app, authenticated, errors);
  registerTerminalAccess(app, authenticated, errors);
  registerTerminalV1(app, authenticated, errors);
  await app.ready();
  return app;
}
