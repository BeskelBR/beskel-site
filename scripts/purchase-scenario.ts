import { randomUUID, createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { clinicalScenario } from "./clinical-scenario.ts";
export async function purchaseScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
) {
  const s = await clinicalScenario(app, token, unit, prefix);
  async function create(
    name: string,
    path: string,
    body: Record<string, unknown>,
  ) {
    const r = await app.inject({
      method: "POST",
      url: `/v1${path}`,
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": `${prefix}-compra-${name}`,
      },
      payload: body,
    });
    if (r.statusCode !== 200) throw new Error(`${name}: ${r.body}`);
    return r.json().id as string;
  }
  const common = {
    unidade_id: unit,
    motivo: "Compra fictícia DEV",
    simulacao: true,
    confirmacao_humana: true,
  };
  const purchase = (
    name: string,
    path: string,
    body: Record<string, unknown>,
  ) => create(name, `/compras/${path}`, { ...common, ...body });
  function ref(suffix: string) {
    const h = createHash("sha256").update(`${prefix}:${suffix}`).digest("hex");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  }
  const supplier = await purchase("fornecedor", "fornecedores", {
    nome: "Fornecedor Fictício DEV",
    referencia: ref("fornecedor"),
  });
  const presentation = await create("apresentacao", "/estoque/apresentacoes", {
    produto_id: s.product,
    codigo: "CAIXA-COMPRA-FICTICIA",
    versao: 1,
    unidade_conteudo_id: s.measure,
    quantidade_conteudo: "10",
    fator_unidade_base: "10",
  });
  const lot = await create("lote", "/estoque/lotes", {
    apresentacao_id: presentation,
    fabricante: "Fabricante Fictício",
    codigo: `compra-${prefix}`,
    situacao_validade: "conhecida",
    validade: "2099-12-31",
    custo_base: "1.25",
  });
  let custody: string | undefined,
    cursor: string | null = null;
  do {
    const response: {
      statusCode: number;
      body: string;
      json(): {
        items: { tipo: string; id: string }[];
        next_cursor: string | null;
      };
    } = await app.inject({
      url: `/v1/estoque/custodias?limit=100${cursor ? `&cursor=${cursor}` : ""}`,
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.statusCode !== 200) throw new Error(response.body);
    custody = response
      .json()
      .items.find(
        (r: { tipo: string; id: string }) => r.tipo === "hospital",
      )?.id;
    cursor = response.json().next_cursor;
  } while (!custody && cursor);
  custody ??= await create("custodia", "/estoque/custodias", {
    tipo: "hospital",
  });
  const position = await create("posicao", "/estoque/posicoes", {
    local_id: s.local,
    lote_id: lot,
    custodia_id: custody,
  });
  const body = {
    fornecedor_id: supplier,
    referencia: ref("pedido"),
    observacao: "Pedido fictício, sem envio ao fornecedor",
    itens: [{ apresentacao_id: presentation, quantidade_apresentacoes: "5" }],
  };
  const order = await purchase("pedido", "pedidos", body);
  const response = await app.inject({
    url: `/v1/compras/itens?unidade_id=${unit}&pedido_id=${order}`,
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.statusCode !== 200) throw new Error(response.body);
  return {
    ...s,
    common,
    supplier,
    purchasePresentation: presentation,
    purchaseLot: lot,
    hospitalCustody: custody,
    purchasePosition: position,
    purchaseOrder: order,
    purchaseItem: response.json().items[0].id as string,
    body,
    purchase,
    ref,
  };
}
