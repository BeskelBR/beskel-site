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

test("Terminal v2 enforces sensitive permission and preserves access invariants", () => {
  const carlos = authenticate("demo-carlos");
  assert.throws(() => store.startAccessSession({
    authSessionId: carlos.auth.auth_session_id,
    orderIds: ["OR-2026-001842-01"],
    terminalId: store.TERMINAL_ID,
    commandId: "test-sensitive-denied"
  }), /SENSITIVE_ACCESS_DENIED/);

  const marina = authenticate("demo-marina");
  assert.equal(marina.identity.employee.employee_id, "emp_002");
  assert.equal(marina.auth.auth_level, "STANDARD");
  assert.ok(marina.auth.factors.includes("DESFIRE"));
  assert.ok(marina.auth.factors.includes("FACE_1_TO_1"));
  assert.ok(marina.auth.factors.includes("PAD_LIVENESS"));

  const orders = store.listPendingOrders(marina.auth.auth_session_id);
  const sensitive = orders.find(x => x.order_id === "OR-2026-001842-01");
  assert.ok(sensitive?.has_sensitive_items);

  const accessCommand = "test-access-session-001";
  const first = store.startAccessSession({
    authSessionId: marina.auth.auth_session_id,
    orderIds: [sensitive.order_id],
    terminalId: store.TERMINAL_ID,
    commandId: accessCommand
  });
  const repeated = store.startAccessSession({
    authSessionId: marina.auth.auth_session_id,
    orderIds: [sensitive.order_id],
    terminalId: store.TERMINAL_ID,
    commandId: accessCommand
  });
  assert.equal(repeated.access_session_id, first.access_session_id, "idempotent retry must reuse result");
  assert.equal(first.state, "DOOR_AUTHORIZED");
  assert.equal(first.sensitive_access, true);

  let current = first;
  const sequence = [
    "DOOR_OPENED",
    "ENTRY_CONFIRMED",
    "DOOR_CLOSED",
    "SENSITIVE_CABINET_OPENED",
    "SENSITIVE_CABINET_CLOSED",
    "ACCESS_CLOSED"
  ];

  sequence.forEach((eventType, index) => {
    const envelope = {
      accessSessionId: first.access_session_id,
      eventType,
      commandId: `test-event-${index}`,
      sourceOccurredAt: `2026-09-16T08:0${index}:00.000Z`,
      sourceDeviceId: store.TERMINAL_ID,
      metadata: { source: "node-test" }
    };
    current = store.registerAccessEvent(envelope);
    const retried = store.registerAccessEvent(envelope);
    assert.equal(retried.access_session_id, first.access_session_id);
    assert.equal(retried.state, current.state, "exact retry must be idempotent");
  });

  assert.equal(current.state, "CLOSED");
  assert.equal(current.orders[0].status, "EM_SEPARACAO", "entry changes order state; terminal does not confirm picking");

  const audit = store.listAudit();
  assert.ok(audit.some(e => e.event_type === "BIOMETRIC_EVIDENCE_CREATED"));
  assert.ok(audit.some(e => e.event_type === "ENTRY_CONFIRMED"));
  assert.ok(!audit.some(e => e.event_type === "STOCK_CONSUMED"), "terminal must not write stock consumption");
});
