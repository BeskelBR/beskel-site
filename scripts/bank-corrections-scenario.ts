import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { financialScenario } from "./financial-scenario.ts";
export async function bankCorrectionsScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
) {
  const s = await financialScenario(app, token, unit, prefix);
  const bank = await s.fin("banco", "contas-financeiras", {
    descricao: "Conta fictícia C17",
  });
  const depositBody = {
    conta_financeira_id: bank,
    adquirente: "Adquirente fictícia C17",
    referencia: `${prefix}-deposito`,
    depositado_em: "2026-09-05T12:00:00Z",
    valor: "97.00",
    evidencia: "Depósito fictício",
  };
  const statementBody = {
    conta_financeira_id: bank,
    referencia: `${prefix}-extrato`,
    ocorrido_em: "2026-09-05T12:00:00Z",
    valor: "97.00",
    evidencia: "Extrato fictício",
  };
  const deposit = await s.fin("deposito", "depositos", depositBody);
  const statement = await s.fin("extrato", "extrato", statementBody);
  const hash = createHash("sha256").update(`${prefix}-cartao`).digest("hex");
  const reference = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const payment = await s.fin("cartao", "recebimentos", {
    pagador_id: s.payer,
    meio: "cartao",
    referencia: reference,
    recebido_em: "2026-09-01T12:00:00Z",
    valor: "100.00",
    evidencia: "Recebimento fictício",
  });
  const parcel = await s.fin("parcela", "parcelas", {
    recebimento_id: payment,
    numero: 1,
    adquirente: depositBody.adquirente,
    referencia: `${prefix}-parcela`,
    repasse_previsto: "2026-09-05",
    bruto: "100.00",
    taxa: "3.00",
    liquido: "97.00",
  });
  return {
    ...s,
    bank,
    depositBody,
    statementBody,
    deposit,
    statement,
    payment,
    parcel,
  };
}
