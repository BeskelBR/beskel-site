import test from "node:test";
import assert from "node:assert/strict";
import {
  appendPage,
  assignmentKey,
  assignmentPayload,
  assignmentRevisionPayload,
  filterEmployees,
  humanizePermission,
  scopeLabel,
  userRevisionPayload,
} from "../assets/system-v11-admin-contract.js";

test("ADM: busca de funcionarios usa nome/login e pagina sem UUID manual", () => {
  const users = [
    { id: "1", nome: "Ana Souza", login: "ana.souza" },
    { id: "2", nome: "Bruno Lima", login: "blima" },
  ];
  assert.deepEqual(filterEmployees(users, "ana"), [users[0]]);
  assert.deepEqual(filterEmployees(users, "BLIMA"), [users[1]]);
  assert.match(appendPage("/v1/usuarios", "abc", 100), /limit=100/);
  assert.match(appendPage("/v1/usuarios", "abc", 100), /cursor=abc/);
});

test("ADM: atribuicao global exige escolha explicita e omite unidade", () => {
  assert.throws(
    () => assignmentPayload("u", "p", "", ""),
    /escopo_obrigatorio/,
  );
  assert.deepEqual(assignmentPayload("u", "p", "global", "x"), {
    usuario_id: "u",
    papel_id: "p",
  });
  assert.deepEqual(assignmentPayload("u", "p", "unidade", "unit"), {
    usuario_id: "u",
    papel_id: "p",
    unidade_id: "unit",
  });
  assert.equal(
    assignmentKey({ papel_id: "p", unidade_id: null }),
    "p:global",
  );
});

test("ADM: revisoes preservam versao, motivo e confirmacao humana", () => {
  assert.deepEqual(
    userRevisionPayload(
      { nome: "Ana Souza", login: "ana.souza" },
      3,
      "Correcao cadastral",
    ),
    {
      motivo: "Correcao cadastral",
      versao_esperada: 3,
      simulacao: true,
      confirmacao_humana: true,
      dados: { nome: "Ana Souza", login: "ana.souza" },
    },
  );
  assert.deepEqual(
    assignmentRevisionPayload(false, 2, "Mudanca de funcao"),
    {
      motivo: "Mudanca de funcao",
      versao_esperada: 2,
      simulacao: true,
      confirmacao_humana: true,
      ativo: false,
    },
  );
});

test("ADM: labels administrativos sao compreensiveis", () => {
  assert.equal(humanizePermission("estoque:movimentar"), "Estoque · Movimentar");
  const units = new Map([["unit", { nome: "HVB Principal" }]]);
  assert.equal(scopeLabel({ unidade_id: "unit" }, units), "HVB Principal");
  assert.equal(scopeLabel({ unidade_id: null }, units), "Todas as unidades");
});
