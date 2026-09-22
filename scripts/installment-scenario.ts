import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { payableScenario } from "./payable-scenario.ts";
export async function installmentScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
) {
  const s = await payableScenario(app, token, unit, prefix);
  const planBody = {
    obrigacao_id: s.obligation,
    versao_esperada: 0,
    parcelas: [
      { vencimento: "2026-09-30", valor: "40.00" },
      { vencimento: "2026-10-30", valor: "60.00" },
    ],
  };
  const plan = await s.payable("plano", "planos-parcelas", planBody);
  const r = await app.inject({
    url: `/v1/a-pagar/parcelas?unidade_id=${unit}&plano_id=${plan}`,
    headers: { authorization: `Bearer ${token}` },
  });
  if (r.statusCode !== 200 || r.json().items.length !== 2)
    throw new Error("Parcelas fictícias ausentes");
  const installments = (
    r.json().items as { id: string; numero: number }[]
  ).sort((a, b) => a.numero - b.numero);
  async function settle(name: string, value = "60.00") {
    const payment = await s.payable(`pagamento-${name}`, "pagamentos", {
      fornecedor_id: s.supplier,
      conta_financeira_id: s.account,
      referencia: s.ref(name),
      pago_em: "2026-09-02T12:00:00Z",
      valor: value,
      evidencia: "Pagamento declarado fictício C8",
    });
    const settlement = await s.payable(`liquidacao-${name}`, "liquidacoes", {
      obrigacao_id: s.obligation,
      pagamento_id: payment,
      liquidada_em: "2026-09-02T13:00:00Z",
      valor: value,
    });
    return { payment, settlement };
  }
  return { ...s, planBody, plan, installments, settle };
}
