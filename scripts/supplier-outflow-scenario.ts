import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { payableScenario } from "./payable-scenario.ts";
export async function supplierOutflowScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
) {
  const s = await payableScenario(app, token, unit, prefix);
  const paymentBody = {
    fornecedor_id: s.supplier,
    conta_financeira_id: s.account,
    referencia: s.ref("pagamento-saida"),
    pago_em: "2026-09-02T12:00:00Z",
    valor: "60.00",
    evidencia: "Pagamento declarado fictício C10",
  };
  const payment = await s.payable("pagamento-saida", "pagamentos", paymentBody);
  const outflowBody = {
    conta_financeira_id: s.account,
    referencia: s.ref("saida"),
    referencia_externa: `SAIDA-FICTICIA-${prefix}`,
    ocorrido_em: "2026-09-03T12:00:00Z",
    valor: "100.00",
    evidencia: "Linha de extrato fictícia, sem banco externo",
  };
  const outflow = await s.payable("saida", "saidas-extrato", outflowBody);
  const reconciliationBody = {
    pagamento_id: payment,
    saida_id: outflow,
    valor: "60.00",
    evidencia: "Conferência explícita fictícia",
  };
  return {
    ...s,
    payment,
    paymentBody,
    outflow,
    outflowBody,
    reconciliationBody,
  };
}
