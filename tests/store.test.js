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

test("Terminal v4 exposes physical coordinates and supports the approved NFC/biometric picking sequence", () => {
  const rafael = authenticate("demo-rafael");
  const pending = store.listPendingOrders(rafael.auth.auth_session_id);
  assert.ok(pending.length > 0);
  assert.ok(pending.some(order => order.items.some(item => item.location_code)));
  assert.ok(pending.every(order => order.items.every(item => Array.isArray(item.alternate_locations))));

  const access = store.startAccessSession({
    authSessionId: rafael.auth.auth_session_id,
    orderIds: [],
    liveItems: [{
      live_item_id: "live-test-v4",
      description: "Material DEV avulso",
      quantity: 2,
      sensitive: false,
      location_code: "T1"
    }],
    terminalId: store.TERMINAL_ID,
    commandId: "test-v4-live-access-001"
  });

  assert.equal(access.state, "DOOR_AUTHORIZED");
  assert.equal(access.live_items.length, 1);

  let current = store.registerAccessEvent({
    accessSessionId: access.access_session_id,
    eventType: "DOOR_OPENED",
    commandId: "test-v4-door-open",
    sourceOccurredAt: "2026-09-20T19:00:00.000Z",
    sourceDeviceId: store.TERMINAL_ID,
    metadata: { source: "node-test" }
  });
  assert.equal(current.state, "DOOR_OPEN");

  current = store.registerAccessEvent({
    accessSessionId: access.access_session_id,
    eventType: "PRESENCE_CONFIRMED",
    commandId: "test-v4-presence",
    sourceOccurredAt: "2026-09-20T19:00:01.000Z",
    sourceDeviceId: store.TERMINAL_ID,
    metadata: { source: "node-test" }
  });
  assert.equal(current.state, "ENTRY_CONFIRMED");

  current = store.registerPickingEvent({
    accessSessionId: access.access_session_id,
    eventType: "STOCK_LOCATION_DISCREPANCY",
    commandId: "test-v4-discrepancy",
    sourceDeviceId: store.PICKING_DISPLAY_ID,
    metadata: { description: "Material DEV avulso", location_code: "T1" }
  });
  assert.equal(current.state, "ENTRY_CONFIRMED");

  current = store.registerAccessEvent({
    accessSessionId: access.access_session_id,
    eventType: "DOOR_CLOSED",
    commandId: "test-v4-door-closed",
    sourceOccurredAt: "2026-09-20T19:00:02.000Z",
    sourceDeviceId: store.TERMINAL_ID,
    metadata: { source: "node-test" }
  });
  assert.equal(current.state, "READY_TO_CONFIRM");

  current = store.confirmWithdrawal({
    accessSessionId: access.access_session_id,
    results: [{
      key: "T1|Material DEV avulso|0",
      description: "Material DEV avulso",
      expected_quantity: 2,
      actual_quantity: 2,
      location_code: "T1",
      status: "CONFIRMED"
    }],
    commandId: "test-v4-confirm",
    sourceDeviceId: store.PICKING_DISPLAY_ID
  });
  assert.equal(current.state, "WITHDRAWAL_CONFIRMED");
  assert.ok(current.withdrawal_confirmation);
  assert.ok(store.listAudit().some(event => event.event_type === "NFC_VALIDATED"));
  assert.ok(store.listAudit().some(event => event.event_type === "BIOMETRIC_VALIDATED"));
  assert.ok(store.listAudit().some(event => event.event_type === "WITHDRAWAL_CONFIRMED"));
  assert.ok(!store.listAudit().some(event => event.event_type === "STOCK_CONSUMED"));
});
