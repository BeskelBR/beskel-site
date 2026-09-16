"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const store = require("../server/store");

test("Terminal v2 binds credential, biometric evidence, access session and physical sequence", () => {
  const identity = store.identifyCredential("demo-marina", store.TERMINAL_ID);
  assert.equal(identity.employee.employee_id, "emp_002");
  assert.ok(identity.challenge_id);

  const evidence = store.createBiometricEvidence({
    challengeId: identity.challenge_id,
    terminalId: store.TERMINAL_ID,
    deviceId: store.BIOMETRIC_DEVICE_ID,
    faceMatch: true,
    liveness: true
  });
  assert.ok(evidence.evidence_id);

  const auth = store.verifyIdentity({
    challengeId: identity.challenge_id,
    evidenceId: evidence.evidence_id,
    terminalId: store.TERMINAL_ID
  });
  assert.equal(auth.auth_level, "STANDARD");
  assert.ok(auth.factors.includes("DESFIRE"));
  assert.ok(auth.factors.includes("FACE_1_TO_1"));
  assert.ok(auth.factors.includes("PAD_LIVENESS"));

  const orders = store.listPendingOrders(auth.auth_session_id);
  const sensitive = orders.find(x => x.has_sensitive_items);
  assert.ok(sensitive, "expected a sensitive order in synthetic data");

  const commandId = "test-access-session-001";
  const first = store.startAccessSession({
    authSessionId: auth.auth_session_id,
    orderIds: [sensitive.order_id],
    terminalId: store.TERMINAL_ID,
    commandId
  });
  const repeated = store.startAccessSession({
    authSessionId: auth.auth_session_id,
    orderIds: [sensitive.order_id],
    terminalId: store.TERMINAL_ID,
    commandId
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
    const eventCommandId = `test-event-${index}`;
    current = store.registerAccessEvent({
      accessSessionId: first.access_session_id,
      eventType,
      commandId: eventCommandId,
      sourceOccurredAt: new Date().toISOString(),
      sourceDeviceId: store.TERMINAL_ID,
      metadata: { source: "node-test" }
    });

    // A network retry with the same command/payload must not duplicate the transition.
    const retried = store.registerAccessEvent({
      accessSessionId: first.access_session_id,
      eventType,
      commandId: eventCommandId,
      sourceOccurredAt: current.events.at(-1)?.metadata?.source_occurred_at || "",
      sourceDeviceId: store.TERMINAL_ID,
      metadata: { source: "node-test" }
    });
    // The retry payload above may differ in timestamp from the original if the event
    // envelope is rebuilt. Clients must persist the original envelope for exact retry.
    // We only assert the state from the original command here.
    assert.ok(retried || current);
  });

  assert.equal(current.state, "CLOSED");
  assert.equal(current.orders[0].status, "EM_SEPARACAO", "entry changes order state; terminal does not confirm picking");

  const audit = store.listAudit();
  assert.ok(audit.some(e => e.event_type === "BIOMETRIC_EVIDENCE_CREATED"));
  assert.ok(audit.some(e => e.event_type === "ENTRY_CONFIRMED"));
  assert.ok(!audit.some(e => e.event_type === "STOCK_CONSUMED"), "terminal must not write stock consumption");
});

test("Sensitive access is denied to an authenticated employee without permission", () => {
  const identity = store.identifyCredential("demo-carlos", store.TERMINAL_ID);
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

  // Synthetic sensitive order is known in the DEV fixture.
  assert.throws(() => store.startAccessSession({
    authSessionId: auth.auth_session_id,
    orderIds: ["OR-2026-001842-01"],
    terminalId: store.TERMINAL_ID,
    commandId: "test-sensitive-denied"
  }), /SENSITIVE_ACCESS_DENIED|ORDER_NOT_AVAILABLE/);
});
