import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  argonPolicy,
  hashPassword,
  temporaryPassword,
  validatePassword,
  verifyPassword,
} from "../src/domain/human-access/password.ts";
import { deliverTemporaryPassword } from "../src/domain/human-access/delivery.ts";

test("Argon2id PHC tem custos explícitos, salt aleatório e verificação sensível ao conteúdo", async () => {
  const password = temporaryPassword();
  const a = await hashPassword(password),
    b = await hashPassword(password);
  assert.equal(a !== b, true, "salt deve ser diferente");
  assert.equal(a.startsWith("$argon2id$v=19$m=19456,t=2,p=1$"), true);
  assert.deepEqual(argonPolicy, {
    memory: 19456,
    passes: 2,
    parallelism: 1,
    tagLength: 32,
    saltLength: 16,
  });
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword(`${password}x`, a), false);
  assert.equal(
    await verifyPassword(password, a.replace("m=19456", "m=999999999")),
    false,
  );
  assert.equal(
    await verifyPassword(password, a.replace("argon2id", "argon2i")),
    false,
  );
  assert.equal(await verifyPassword(password, "invalid"), false);
});

test("política não trunca nem normaliza; temporária tem 192 bits aleatórios", async () => {
  assert.throws(() => validatePassword("short"), {
    code: "politica_senha_invalida",
  });
  assert.throws(() => validatePassword("x".repeat(129)), {
    code: "politica_senha_invalida",
  });
  validatePassword("😀".repeat(128));
  const password = `  ${randomUUID()}  `;
  const phc = await hashPassword(password);
  assert.equal(await verifyPassword(password, phc), true);
  assert.equal(await verifyPassword(password.trim(), phc), false);
  const samples = Array.from({ length: 32 }, temporaryPassword);
  assert.equal(new Set(samples).size, samples.length);
  assert.equal(
    samples.every((s) => /^[A-Za-z0-9_-]{32}$/.test(s)),
    true,
  );
});

test("e-mail ausente recusa antes de gerar/persistir; falha não confirma envio", async () => {
  let issued = 0,
    confirmed = 0;
  const id = randomUUID();
  const persistence = {
    issue: async (_phc: string) => {
      issued++;
      return {
        id,
        email: "test@example.invalid",
        expiresAt: new Date(Date.now() + 60000),
      };
    },
    confirmSent: async () => {
      confirmed++;
    },
  };
  await assert.rejects(deliverTemporaryPassword(persistence), {
    code: "email_humano_nao_configurado",
  });
  assert.equal(issued, 0);
  await assert.rejects(
    deliverTemporaryPassword(persistence, {
      send: async () => ({ accepted: false }),
    }),
    { code: "envio_senha_nao_confirmado" },
  );
  assert.equal(issued, 1);
  assert.equal(confirmed, 0);
});

test("persistência recebe apenas PHC; confirmação sucede envio; resposta não devolve segredo", async () => {
  const order: string[] = [],
    id = randomUUID();
  let stored = "",
    validProof = false;
  const result = await deliverTemporaryPassword(
    {
      issue: async (phc) => {
        stored = phc;
        order.push("persisted");
        return {
          id,
          email: "test@example.invalid",
          expiresAt: new Date(Date.now() + 60000),
        };
      },
      confirmSent: async (returnedId) => {
        assert.equal(returnedId, id);
        order.push("confirmed");
      },
    },
    {
      send: async (input) => {
        validProof = await verifyPassword(input.password, stored);
        order.push("sent");
        return { accepted: true };
      },
    },
  );
  assert.equal(validProof, true);
  assert.deepEqual(order, ["persisted", "sent", "confirmed"]);
  assert.deepEqual(result, { id, sent: true });
});

test("exceções do provedor/banco são substituídas sem propagar segredos", async () => {
  let sentinel = "",
    confirmed = false;
  const id = randomUUID();
  try {
    await deliverTemporaryPassword(
      {
        issue: async () => ({
          id,
          email: "test@example.invalid",
          expiresAt: new Date(),
        }),
        confirmSent: async () => {
          confirmed = true;
        },
      },
      {
        send: async (input) => {
          sentinel = input.password;
          throw new Error(input.password);
        },
      },
    );
    assert.fail("deveria recusar");
  } catch (error) {
    assert.equal(
      (error as { code: string }).code,
      "envio_senha_nao_confirmado",
    );
    assert.equal(String(error).includes(sentinel), false);
  }
  assert.equal(confirmed, false);
});
