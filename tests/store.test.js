"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const store = require("../server/store");

function authenticate(token) {
  const identity = store.identifyCredential(token, store.TERMINAL_ID);
  const evidence = store.createBiometricEvidence({
    challengeId: identity.challenge_id,
    terminalId: store.TERMINAL_ID,
    deviceId: store.BIOMETRIC_DEVICE_ID,
    faceMatch: true,
    liveness: true
  });
  const auth = store.verifyIdentity({
    challengeId: identity.challenge_id,
    evidenceId: evidence.evidence_id,
    terminalId: store.TERMINAL_ID
  });
  return { identity, evidence, auth };
}

test("Terminal v2 exposes at least ten synthetic orders with material details", () => {
  const marina = authenticate("demo-marina");
  const orders = store.listPendingOrders(marina.auth.auth_session_id);
  assert.ok(orders.length >= 10, `expected at least 10 pending orders, got ${orders.length}`);
  for (const order of orders) {
    assert.ok(Array.isArray(order.items));
    assert.equal(order.items.length, order.item_count);
    assert.ok(order.items.every(item => item.description && Number(item.quantity) > 0));
  }
  assert.ok(orders.some(order => order.has_sensitive_items));
  assert.ok(orders.some(order => !order.has_sensitive_items));
});

test("Terminal v2 supports one access session bound to multiple withdrawal orders", () => {
  const marina = authenticate("demo-marina");
  const orders = store.listPendingOrders(marina.auth.auth_session_id);
  const selected = [orders[0], orders[1], orders[2]].filter(Boolean);
  assert.equal(selected.length, 3);

  const accessCommand = "test-multi-access-session-001";
  const first = store.startAccessSession({
    authSessionId: marina.auth.auth_session_id,
    orderIds: selected.map(order => order.order_id),
    terminalId: store.TERMINAL_ID,
    commandId: accessCommand
  });
  const repeated = store.startAccessSession({
    authSessionId: marina.auth.auth_session_id,
    orderIds: selected.map(order => order.order_id),
    terminalId: store.TERMINAL_ID,
    commandId: accessCommand
  });

  assert.equal(repeated.access_session_id, first.access_session_id);
  assert.equal(first.orders.length, 3);
  assert.deepEqual(
    new Set(first.orders.map(order => order.order_id)),
    new Set(selected.map(order => order.order_id))
  );
  assert.ok(first.orders.every(order => Array.isArray(order.items) && order.items.length > 0));
  assert.equal(first.state, "DOOR_AUTHORIZED");

  let current = first;
  const sequence = ["DOOR_OPENED", "ENTRY_CONFIRMED"];
  sequence.forEach((eventType, index) => {
    const envelope = {
      accessSessionId: first.access_session_id,
      eventType,
      commandId: `test-multi-event-${index}`,
      sourceOccurredAt: `2026-09-16T09:0${index}:00.000Z`,
      sourceDeviceId: store.TERMINAL_ID,
      metadata: { source: "node-test" }
    };
    current = store.registerAccessEvent(envelope);
    const retried = store.registerAccessEvent(envelope);
    assert.equal(retried.state, current.state);
  });

  assert.equal(current.state, "ENTRY_CONFIRMED");
  assert.ok(current.orders.every(order => order.status === "EM_SEPARACAO"));
  assert.ok(!store.listAudit().some(event => event.event_type === "STOCK_CONSUMED"));
});

test("Sensitive access remains denied to an authenticated employee without permission", () => {
  const carlos = authenticate("demo-carlos");
  const orders = store.listPendingOrders(carlos.auth.auth_session_id);
  const sensitive = orders.find(order => order.has_sensitive_items);
  assert.ok(sensitive);
  assert.throws(() => store.startAccessSession({
    authSessionId: carlos.auth.auth_session_id,
    orderIds: [sensitive.order_id],
    terminalId: store.TERMINAL_ID,
    commandId: "test-sensitive-denied-v2"
  }), /SENSITIVE_ACCESS_DENIED/);
});