import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { installmentScenario } from "./installment-scenario.ts";
export async function supplierCreditScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
) {
  const s = await installmentScenario(app, token, unit, prefix);
  const creditBody = {
    fornecedor_id: s.supplier,
    origem_obrigacao_id: s.obligation,
    origem: "abatimento",
    referencia: s.ref("credito"),
    documento_referencia: `CREDITO-FICTICIO-${prefix}`,
    descricao: "Crédito comercial declarado, sem pagamento bancário",
    ocorrido_em: "2026-09-02T12:00:00Z",
    valor: "60.00",
  };
  const credit = await s.payable("credito", "creditos", creditBody);
  const applicationBody = {
    obrigacao_id: s.obligation,
    credito_id: credit,
    liquidada_em: "2026-09-02T13:00:00Z",
    valor: "40.00",
  };
  return { ...s, creditBody, credit, applicationBody };
}
