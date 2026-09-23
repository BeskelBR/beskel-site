import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { authorize, DomainError, one } from "./core.ts";
import type { Actor } from "./core.ts";
import { actions } from "./foundation.ts";
import type { Action, Body } from "./foundation.ts";
import { inputs, object, text, time, uuid } from "./schemas.ts";
import { inventoryInputs, amount } from "./inventory/schemas.ts";
import { inventoryActions } from "./inventory/service.ts";
import { purchaseActions } from "./purchases/service.ts";

export const operationalInputs = {
  userOnboarding: object({
    ...inputs.usuario.properties,
    atribuicoes: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      uniqueItems: true,
      items: object({ papel_id: uuid, unidade_id: uuid }, ["papel_id"]),
    },
    motivo: text,
  }),
  completeStockEntry: object(
    {
      unidade_id: uuid,
      local_id: uuid,
      lote: inventoryInputs.stockLot,
      quantidade_apresentacoes: amount,
      ocorrido_em: time,
      motivo: text,
      compra: object({
        pedido_id: uuid,
        item_pedido_id: uuid,
        referencia: uuid,
        documento_fornecedor: text,
        simulacao: { type: "boolean", const: true },
        confirmacao_humana: { type: "boolean", const: true },
      }),
    },
    [
      "unidade_id",
      "local_id",
      "lote",
      "quantidade_apresentacoes",
      "ocorrido_em",
      "motivo",
    ],
  ),
};

// Add response fields only to new routes, preserving historical contracts.
export const operationalResponses: Record<string, Record<string, unknown>> = {
  "/usuarios/onboarding": {
    usuario_id: uuid,
    atribuicao_ids: { type: "array", items: uuid },
  },
  "/estoque/entradas-completas": {
    lote_id: uuid,
    custodia_id: uuid,
    posicao_id: uuid,
    transacao_id: uuid,
    recebimento_id: uuid,
  },
};

function action(registry: Action[], path: string): Action {
  const found = registry.find((entry) => entry.path === path);
  if (!found) throw new Error("Contrato interno de cadastro ausente");
  return found;
}

export const operationalActions: Action[] = [
  {
    path: "/usuarios/onboarding",
    input: "userOnboarding",
    permission: "acesso:administrar",
    async run(tx, actor, body, id, commandId) {
      const assignments = body.atribuicoes as Body[];
      const pairs = assignments.map(
        (item) => `${item.papel_id}:${item.unidade_id ?? "global"}`,
      );
      if (new Set(pairs).size !== pairs.length)
        throw new DomainError(400, "atribuicao_duplicada");
      const user = await action(actions, "/usuarios").run(
        tx,
        actor,
        body,
        id,
        commandId,
      );
      const ids: string[] = [];
      for (const item of assignments) {
        const result = await action(actions, "/atribuicoes").run(
          tx,
          actor,
          { ...item, usuario_id: user.id },
          id,
          commandId,
        );
        ids.push(result.id);
      }
      return { id: user.id, usuario_id: user.id, atribuicao_ids: ids };
    },
  },
  {
    path: "/estoque/entradas-completas",
    input: "completeStockEntry",
    permission: "estoque:movimentar",
    scope: async (_tx, _actor, body) => body.unidade_id as string,
    async run(tx, actor, body, id, commandId) {
      // Catalog writes remain organizational, not granted by a unit assignment.
      await authorize(tx, actor, "estoque:catalogar");
      const purchase = body.compra as Body | undefined;
      if (purchase)
        await authorize(
          tx,
          actor,
          "compras:receber",
          body.unidade_id as string,
        );
      await one(
        tx,
        "SELECT id FROM local WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [actor.organizacao_id, body.unidade_id, body.local_id],
      );
      const lot = await action(inventoryActions, "/estoque/lotes").run(
        tx,
        actor,
        body.lote as Body,
        id,
        commandId,
      );
      await tx.query(
        "INSERT INTO custodia(id,organizacao_id,tipo) VALUES($1,$2,'hospital') ON CONFLICT DO NOTHING",
        [randomUUID(), actor.organizacao_id],
      );
      const custody = await one(
        tx,
        "SELECT id FROM custodia WHERE organizacao_id=$1 AND tipo='hospital'",
        [actor.organizacao_id],
      );
      const position = await action(inventoryActions, "/estoque/posicoes").run(
        tx,
        actor,
        {
          local_id: body.local_id,
          lote_id: lot.id,
          custodia_id: custody.id,
        },
        id,
        commandId,
      );
      let movementId: string;
      let receiptId: string | undefined;
      if (purchase) {
        const receipt = await action(
          purchaseActions,
          "/compras/recebimentos",
        ).run(
          tx,
          actor,
          {
            ...purchase,
            unidade_id: body.unidade_id,
            ocorrido_em: body.ocorrido_em,
            motivo: body.motivo,
            itens: [
              {
                item_pedido_id: purchase.item_pedido_id,
                posicao_id: position.id,
                quantidade_apresentacoes: body.quantidade_apresentacoes,
              },
            ],
          },
          id,
          commandId,
        );
        receiptId = receipt.id;
        const item = await one(
          tx,
          "SELECT id FROM recebimento_compra_item WHERE organizacao_id=$1 AND recebimento_id=$2",
          [actor.organizacao_id, receiptId],
        );
        movementId = item.id;
      } else {
        const movement = await action(
          inventoryActions,
          "/estoque/entradas",
        ).run(
          tx,
          actor,
          {
            posicao_id: position.id,
            quantidade_apresentacoes: body.quantidade_apresentacoes,
            ocorrido_em: body.ocorrido_em,
            motivo: body.motivo,
          },
          id,
          commandId,
        );
        movementId = movement.id;
      }
      return {
        id: movementId,
        lote_id: lot.id,
        custodia_id: custody.id,
        posicao_id: position.id,
        transacao_id: movementId,
        ...(receiptId ? { recebimento_id: receiptId } : {}),
      };
    },
  },
];

type Authenticated = <T>(
  req: FastifyRequest,
  work: (tx: PoolClient, actor: Actor) => Promise<T>,
) => Promise<T>;
export function registerOperationalReads(
  app: FastifyInstance,
  authenticated: Authenticated,
  errors: Record<string, unknown>,
) {
  app.get(
    "/v1/papeis/:id/permissoes",
    {
      schema: {
        operationId: "permissoes_do_papel",
        security: [{ bearer: [] }],
        params: object({ id: uuid }),
        response: {
          200: object({
            papel_id: uuid,
            nome: text,
            permissoes: { type: "array", items: text },
          }),
          ...errors,
        },
      },
    },
    (req) =>
      authenticated(req, async (tx, actor) => {
        await authorize(tx, actor, "acesso:administrar");
        const { id } = req.params as { id: string };
        const role = await one(
          tx,
          "SELECT id,nome FROM papel WHERE organizacao_id=$1 AND id=$2",
          [actor.organizacao_id, id],
        );
        const permissions = await tx.query(
          "SELECT permissao FROM papel_permissao WHERE organizacao_id=$1 AND papel_id=$2 ORDER BY permissao",
          [actor.organizacao_id, id],
        );
        return {
          papel_id: role.id,
          nome: role.nome,
          permissoes: permissions.rows.map((row) => row.permissao),
        };
      }),
  );
}
