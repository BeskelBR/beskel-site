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

function openRoom(access, prefix) {
  let current = store.registerAccessEvent({
    accessSessionId: access.access_session_id,
    eventType: "DOOR_OPENED",
    commandId: `${prefix}-door`,
    sourceOccurredAt: "2026-09-22T02:00:00.000Z",
    sourceDeviceId: store.TERMINAL_ID
  });
  current = store.registerAccessEvent({
    accessSessionId: access.access_session_id,
    eventType: "PRESENCE_CONFIRMED",
    commandId: `${prefix}-presence`,
    sourceOccurredAt: "2026-09-22T02:00:01.000Z",
    sourceDeviceId: store.TERMINAL_ID
  });
  return current;
}

function confirmTask(accessSessionId, task, prefix) {
  return store.registerPickingEvent({
    accessSessionId,
    eventType: "PICKING_ITEM_CONFIRMED",
    commandId: `${prefix}-${task.picking_task_id}`,
    sourceDeviceId: store.PICKING_DISPLAY_ID,
    metadata: {
      group_key:task.picking_task_id,
      description:task.description,
      expected_quantity:task.quantity,
      location_code:task.location_code,
      stock_lot_id:task.stock_lot_id,
      lot_code:task.lot_code,
      actual_quantity:task.quantity
    }
  });
}

test("pending orders expose logical products, not fixed product coordinates", () => {
  const marina = authenticate("demo-marina");
  const orders = store.listPendingOrders(marina.auth.auth_session_id);
  assert.ok(orders.length >= 10);
  for (const order of orders) {
    assert.ok(order.items.length > 0);
    assert.ok(order.items.every(item => item.product_id && item.description));
    assert.ok(order.items.every(item => item.allocation_strategy === "FEFO"));
    assert.ok(order.items.every(item => item.location_code === undefined));
  }
});

test("each active DEV stock lot occupies its own coordinate", () => {
  const lots = store.listStockLots();
  const active = lots.filter(lot => lot.status === "AVAILABLE" && Number(lot.quantity_available) > 0);
  const coordinates = active.map(lot => lot.location_code);
  assert.equal(new Set(coordinates).size, coordinates.length);
  assert.ok(active.every(lot => lot.stock_lot_id && lot.lot_code && lot.product_id));
  assert.ok(active.every(lot => lot.location_assigned_by === "stock_manager_dev"));
});

test("live withdrawal is allocated by FEFO and may split one product across lots", () => {
  const rafael = authenticate("demo-rafael");
  const catalog = store.listCatalog(rafael.auth.auth_session_id);
  const product = catalog.find(item => !item.sensitive);
  assert.ok(product);
  assert.equal(product.location_code, undefined);

  const access = store.startAccessSession({
    authSessionId: rafael.auth.auth_session_id,
    orderIds: [],
    liveItems: [{
      live_item_id:"live-fefo-split",
      product_id:product.product_id,
      quantity:5
    }],
    terminalId:store.TERMINAL_ID,
    commandId:"test-fefo-split-access"
  });

  const tasks = access.picking_tasks
    .filter(task => task.product_id === product.product_id)
    .sort((a,b)=>a.allocation_rank-b.allocation_rank);

  assert.ok(tasks.length >= 2, "5 units should span the first 3-unit lot and a later lot");
  assert.equal(tasks.reduce((sum,task)=>sum+task.quantity,0),5);
  assert.ok(Date.parse(tasks[0].expires_at) <= Date.parse(tasks[1].expires_at));
  assert.notEqual(tasks[0].stock_lot_id,tasks[1].stock_lot_id);
  assert.notEqual(tasks[0].location_code,tasks[1].location_code);
  assert.ok(tasks.every(task => task.allocation_strategy === "FEFO"));
});

test("multiple ORs consolidate demand while preserving source allocation", () => {
  const marina = authenticate("demo-marina");
  const orders = store.listPendingOrders(marina.auth.auth_session_id);
  const selected = orders.slice(0,3);
  assert.equal(selected.length,3);

  const access = store.startAccessSession({
    authSessionId:marina.auth.auth_session_id,
    orderIds:selected.map(order=>order.order_id),
    terminalId:store.TERMINAL_ID,
    commandId:"test-multi-order-fefo"
  });

  assert.equal(access.orders.length,3);
  assert.ok(access.picking_tasks.length > 0);
  assert.ok(access.picking_tasks.every(task => Array.isArray(task.sources) && task.sources.length > 0));
  assert.ok(access.picking_tasks.flatMap(task=>task.sources).some(source => source.source_type === "ORDER"));
});

test("sensitive access remains denied without permission after lot allocation", () => {
  const carlos = authenticate("demo-carlos");
  const catalog = store.listCatalog(carlos.auth.auth_session_id);
  const sensitiveProduct = catalog.find(item => item.sensitive);
  assert.ok(sensitiveProduct);

  assert.throws(() => store.startAccessSession({
    authSessionId:carlos.auth.auth_session_id,
    orderIds:[],
    liveItems:[{
      live_item_id:"live-sensitive-denied",
      product_id:sensitiveProduct.product_id,
      quantity:1
    }],
    terminalId:store.TERMINAL_ID,
    commandId:"test-sensitive-denied-fefo"
  }), /SENSITIVE_ACCESS_DENIED/);
});

test("picking state is server-authoritative and final confirmation is lot-aware", () => {
  const rafael = authenticate("demo-rafael");
  const product = store.listCatalog(rafael.auth.auth_session_id).find(item => !item.sensitive);
  const access = store.startAccessSession({
    authSessionId:rafael.auth.auth_session_id,
    orderIds:[],
    liveItems:[{ live_item_id:"live-confirm", product_id:product.product_id, quantity:2 }],
    terminalId:store.TERMINAL_ID,
    commandId:"test-lot-aware-confirm-access"
  });

  openRoom(access,"test-lot-aware");
  const task = access.picking_tasks[0];
  const afterPick = confirmTask(access.access_session_id,task,"test-confirm-task");

  assert.equal(afterPick.picking_state[task.picking_task_id].status,"CONFIRMED");
  assert.equal(afterPick.picking_state[task.picking_task_id].active_stock_lot_id,task.stock_lot_id);

  const ready = store.registerAccessEvent({
    accessSessionId:access.access_session_id,
    eventType:"DOOR_CLOSED",
    commandId:"test-lot-aware-close",
    sourceOccurredAt:"2026-09-22T02:00:02.000Z",
    sourceDeviceId:store.TERMINAL_ID
  });
  assert.equal(ready.state,"READY_TO_CONFIRM");

  const confirmed = store.confirmWithdrawal({
    accessSessionId:access.access_session_id,
    results:[{
      key:task.picking_task_id,
      description:task.description,
      expected_quantity:task.quantity,
      actual_quantity:task.quantity,
      location_code:task.location_code,
      stock_lot_id:task.stock_lot_id,
      lot_code:task.lot_code,
      status:"CONFIRMED"
    }],
    commandId:"test-lot-aware-final",
    sourceDeviceId:store.PICKING_DISPLAY_ID
  });

  assert.equal(confirmed.state,"WITHDRAWAL_CONFIRMED");
  assert.equal(confirmed.withdrawal_confirmation.results[0].stock_lot_id,task.stock_lot_id);
  assert.ok(!store.listAudit().some(event => event.event_type === "STOCK_CONSUMED"));
});

test("server rejects forged lot or coordinate in final result", () => {
  const rafael = authenticate("demo-rafael");
  const product = store.listCatalog(rafael.auth.auth_session_id).find(item => !item.sensitive);
  const access = store.startAccessSession({
    authSessionId:rafael.auth.auth_session_id,
    orderIds:[],
    liveItems:[{ live_item_id:"live-forge", product_id:product.product_id, quantity:1 }],
    terminalId:store.TERMINAL_ID,
    commandId:"test-forge-access"
  });

  openRoom(access,"test-forge");
  const task = access.picking_tasks[0];
  confirmTask(access.access_session_id,task,"test-forge-task");
  store.registerAccessEvent({
    accessSessionId:access.access_session_id,
    eventType:"DOOR_CLOSED",
    commandId:"test-forge-close",
    sourceOccurredAt:"2026-09-22T02:00:02.000Z",
    sourceDeviceId:store.TERMINAL_ID
  });

  assert.throws(() => store.confirmWithdrawal({
    accessSessionId:access.access_session_id,
    results:[{
      key:task.picking_task_id,
      description:task.description,
      expected_quantity:task.quantity,
      actual_quantity:task.quantity,
      location_code:"Z99",
      stock_lot_id:"lot-forged",
      lot_code:"FORGED",
      status:"CONFIRMED"
    }],
    commandId:"test-forged-result",
    sourceDeviceId:store.PICKING_DISPLAY_ID
  }), /(PICKING_LOCATION_INVALID|WITHDRAWAL_RESULTS_MISMATCH)/);
});

test("missing expected lot can be reallocated only to another eligible lot", () => {
  const rafael = authenticate("demo-rafael");
  const product = store.listCatalog(rafael.auth.auth_session_id).find(item => !item.sensitive);
  const access = store.startAccessSession({
    authSessionId:rafael.auth.auth_session_id,
    orderIds:[],
    liveItems:[{ live_item_id:"live-reallocate", product_id:product.product_id, quantity:1 }],
    terminalId:store.TERMINAL_ID,
    commandId:"test-reallocate-access"
  });

  openRoom(access,"test-reallocate");
  const task = access.picking_tasks[0];
  assert.ok(task.fallback_lots.length > 0);
  const fallback = task.fallback_lots[0];

  store.registerPickingEvent({
    accessSessionId:access.access_session_id,
    eventType:"STOCK_LOCATION_DISCREPANCY",
    commandId:"test-reallocate-discrepancy",
    sourceDeviceId:store.PICKING_DISPLAY_ID,
    metadata:{
      group_key:task.picking_task_id,
      description:task.description,
      expected_quantity:task.quantity,
      location_code:task.location_code,
      stock_lot_id:task.stock_lot_id,
      lot_code:task.lot_code
    }
  });

  const rerouted = store.registerPickingEvent({
    accessSessionId:access.access_session_id,
    eventType:"PICKING_LOT_REALLOCATED",
    commandId:"test-reallocate-lot",
    sourceDeviceId:store.PICKING_DISPLAY_ID,
    metadata:{
      group_key:task.picking_task_id,
      from_location:task.location_code,
      from_stock_lot_id:task.stock_lot_id,
      to_location:fallback.location_code,
      to_stock_lot_id:fallback.stock_lot_id
    }
  });

  const state = rerouted.picking_state[task.picking_task_id];
  assert.equal(state.active_location,fallback.location_code);
  assert.equal(state.active_stock_lot_id,fallback.stock_lot_id);
  assert.equal(state.active_lot_code,fallback.lot_code);
});
