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

  const catalog = store.listCatalog(rafael.auth.auth_session_id);
  assert.ok(catalog.length > 0);
  const catalogProduct = catalog[0];

  const access = store.startAccessSession({
    authSessionId: rafael.auth.auth_session_id,
    orderIds: [],
    liveItems: [{
      live_item_id: "live-test-v4",
      product_id: catalogProduct.product_id,
      quantity: 2
    }],
    terminalId: store.TERMINAL_ID,
    commandId: "test-v4-live-access-001"
  });

  assert.equal(access.state, "DOOR_AUTHORIZED");
  assert.equal(access.live_items.length, 1);
  assert.equal(access.live_items[0].product_id, catalogProduct.product_id);
  assert.equal(access.live_items[0].sensitive, catalogProduct.sensitive);
  assert.equal(access.live_items[0].location_code, catalogProduct.location_code);

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
    metadata: {
      group_key:`${catalogProduct.location_code}|${catalogProduct.description}|${catalogProduct.sensitive?1:0}`,
      description:catalogProduct.description,
      location_code:catalogProduct.location_code
    }
  });
  assert.equal(current.state, "ENTRY_CONFIRMED");

  current = store.registerPickingEvent({
    accessSessionId: access.access_session_id,
    eventType: "PICKING_ITEM_CONFIRMED",
    commandId: "test-v4-live-item-confirmed",
    sourceDeviceId: store.PICKING_DISPLAY_ID,
    metadata: {
      group_key:`${catalogProduct.location_code}|${catalogProduct.description}|${catalogProduct.sensitive?1:0}`,
      description:catalogProduct.description,
      expected_quantity:2,
      location_code:catalogProduct.location_code,
      actual_quantity:2
    }
  });
  assert.equal(current.picking_state[`${catalogProduct.location_code}|${catalogProduct.description}|${catalogProduct.sensitive?1:0}`].status, "CONFIRMED");

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
      key: `${catalogProduct.location_code}|${catalogProduct.description}|${catalogProduct.sensitive?1:0}`,
      description: catalogProduct.description,
      expected_quantity: 2,
      actual_quantity: 2,
      location_code: catalogProduct.location_code,
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


test("Terminal v4 keeps picking state on the server and rejects forged final results", () => {
  const marina = authenticate("demo-marina");
  const orders = store.listPendingOrders(marina.auth.auth_session_id);
  const target = orders.find(order => !order.has_sensitive_items) || orders[0];

  const access = store.startAccessSession({
    authSessionId: marina.auth.auth_session_id,
    orderIds: [target.order_id],
    terminalId: store.TERMINAL_ID,
    commandId: "test-v4-server-picking-access"
  });

  store.registerAccessEvent({
    accessSessionId: access.access_session_id,
    eventType: "DOOR_OPENED",
    commandId: "test-v4-server-picking-door",
    sourceOccurredAt: "2026-09-22T02:00:00.000Z",
    sourceDeviceId: store.TERMINAL_ID
  });
  store.registerAccessEvent({
    accessSessionId: access.access_session_id,
    eventType: "PRESENCE_CONFIRMED",
    commandId: "test-v4-server-picking-presence",
    sourceOccurredAt: "2026-09-22T02:00:01.000Z",
    sourceDeviceId: store.TERMINAL_ID
  });

  const detail = store.getAccessSessionDetail(access.access_session_id);
  const firstItem = detail.orders[0].items[0];
  const key = `${firstItem.location_code}|${firstItem.description}|${firstItem.sensitive?1:0}`;

  const afterPick = store.registerPickingEvent({
    accessSessionId: access.access_session_id,
    eventType: "PICKING_ITEM_CONFIRMED",
    commandId: "test-v4-server-picking-confirm-item",
    sourceDeviceId: store.PICKING_DISPLAY_ID,
    metadata: {
      group_key:key,
      description:firstItem.description,
      expected_quantity:firstItem.quantity,
      location_code:firstItem.location_code,
      actual_quantity:firstItem.quantity
    }
  });

  assert.equal(afterPick.picking_state[key].status, "CONFIRMED");
  assert.equal(store.getAccessSessionDetail(access.access_session_id).picking_state[key].status, "CONFIRMED");

  store.registerAccessEvent({
    accessSessionId: access.access_session_id,
    eventType: "DOOR_CLOSED",
    commandId: "test-v4-server-picking-close",
    sourceOccurredAt: "2026-09-22T02:00:02.000Z",
    sourceDeviceId: store.TERMINAL_ID
  });

  assert.throws(() => store.confirmWithdrawal({
    accessSessionId: access.access_session_id,
    results: [{
      key,
      description:firstItem.description,
      expected_quantity:firstItem.quantity + 99,
      actual_quantity:firstItem.quantity + 99,
      location_code:firstItem.location_code,
      status:"CONFIRMED"
    }],
    commandId:"test-v4-forged-result",
    sourceDeviceId:store.PICKING_DISPLAY_ID
  }), /WITHDRAWAL_RESULTS_/);
});
