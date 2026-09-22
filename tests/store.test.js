"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const store = require("../server/store");

test.beforeEach(() => store.resetDevState());

function authenticate(token = "demo-rafael") {
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

function startLiveSession(auth, product, quantity = 1, commandId = "access") {
  return store.startAccessSession({
    authSessionId: auth.auth_session_id,
    orderIds: [],
    liveItems: [{
      live_item_id: `live-${commandId}`,
      product_id: product.product_id,
      quantity
    }],
    terminalId: store.TERMINAL_ID,
    commandId
  });
}

function openRoom(access, prefix = "flow") {
  let current = store.registerAccessEvent({
    accessSessionId: access.access_session_id,
    sessionToken: access.session_token,
    eventType: "DOOR_OPENED",
    commandId: `${prefix}-door-open`,
    sourceOccurredAt: "2026-09-22T02:00:00.000Z",
    sourceDeviceId: store.TERMINAL_ID
  });
  current = store.registerAccessEvent({
    accessSessionId: access.access_session_id,
    sessionToken: access.session_token,
    eventType: "PRESENCE_CONFIRMED",
    commandId: `${prefix}-presence`,
    sourceOccurredAt: "2026-09-22T02:00:01.000Z",
    sourceDeviceId: store.TERMINAL_ID
  });
  return { ...current, session_token: access.session_token };
}

function resolveTask(access, task, status = "CONFIRMED", actualQuantity = task.quantity, prefix = "pick") {
  const eventType = status === "CONFIRMED"
    ? "PICKING_ITEM_CONFIRMED"
    : status === "PARTIAL"
      ? "PICKING_PARTIAL"
      : "PICKING_UNAVAILABLE";
  return {
    ...store.registerPickingEvent({
      accessSessionId: access.access_session_id,
      sessionToken: access.session_token,
      eventType,
      commandId: `${prefix}-${task.picking_task_id}`,
      sourceDeviceId: store.PICKING_DISPLAY_ID,
      metadata: {
        group_key: task.picking_task_id,
        actual_quantity: actualQuantity
      }
    }),
    session_token: access.session_token
  };
}

function finishPhysicalFlow(access, prefix = "finish") {
  let current = store.registerAccessEvent({
    accessSessionId: access.access_session_id,
    sessionToken: access.session_token,
    eventType: "PICKING_READY",
    commandId: `${prefix}-ready`,
    sourceOccurredAt: "2026-09-22T02:00:02.000Z",
    sourceDeviceId: store.PICKING_DISPLAY_ID
  });
  current = store.registerAccessEvent({
    accessSessionId: access.access_session_id,
    sessionToken: access.session_token,
    eventType: "PRESENCE_CLEARED",
    commandId: `${prefix}-exit`,
    sourceOccurredAt: "2026-09-22T02:00:03.000Z",
    sourceDeviceId: store.TERMINAL_ID
  });
  current = store.registerAccessEvent({
    accessSessionId: access.access_session_id,
    sessionToken: access.session_token,
    eventType: "DOOR_CLOSED",
    commandId: `${prefix}-door-close`,
    sourceOccurredAt: "2026-09-22T02:00:04.000Z",
    sourceDeviceId: store.TERMINAL_ID
  });
  return { ...current, session_token: access.session_token };
}

test("FEFO splits one demand across lots and product has no fixed coordinate", () => {
  const { auth } = authenticate();
  const product = store.listCatalog(auth.auth_session_id).find(item => !item.sensitive);
  assert.ok(product);
  assert.equal(product.location_code, undefined);

  const access = startLiveSession(auth, product, 5, "fefo");
  const tasks = access.picking_tasks
    .filter(task => task.product_id === product.product_id)
    .sort((a,b)=>a.allocation_rank-b.allocation_rank);

  assert.ok(tasks.length >= 2);
  assert.equal(tasks.reduce((sum,task)=>sum+task.quantity,0),5);
  assert.ok(tasks.every((task,index)=>index===0 || Date.parse(tasks[index-1].expires_at) <= Date.parse(task.expires_at)));
  assert.notEqual(tasks[0].stock_lot_id,tasks[1].stock_lot_id);
  assert.notEqual(tasks[0].location_code,tasks[1].location_code);
});

test("recursive idempotency hash detects nested payload changes", () => {
  const { auth } = authenticate();
  const product = store.listCatalog(auth.auth_session_id).find(item => !item.sensitive);

  const first = startLiveSession(auth, product, 1, "idem-nested");
  assert.ok(first.access_session_id);

  assert.throws(() => store.startAccessSession({
    authSessionId: auth.auth_session_id,
    orderIds: [],
    liveItems: [{ live_item_id:"live-idem-nested", product_id:product.product_id, quantity:9 }],
    terminalId: store.TERMINAL_ID,
    commandId: "idem-nested"
  }), /IDEMPOTENCY_CONFLICT/);
});

test("exact idempotent replay returns same session", () => {
  const { auth } = authenticate();
  const product = store.listCatalog(auth.auth_session_id).find(item => !item.sensitive);
  const payload = {
    authSessionId: auth.auth_session_id,
    orderIds: [],
    liveItems: [{ live_item_id:"live-exact", product_id:product.product_id, quantity:1 }],
    terminalId: store.TERMINAL_ID,
    commandId: "idem-exact"
  };
  const first = store.startAccessSession(payload);
  const second = store.startAccessSession(payload);
  assert.equal(second.access_session_id,first.access_session_id);
});

test("only one active stock-room session is allowed", () => {
  const rafael = authenticate("demo-rafael");
  const marina = authenticate("demo-marina");
  const product = store.listCatalog(rafael.auth.auth_session_id).find(item => !item.sensitive);
  startLiveSession(rafael.auth,product,1,"room-a");

  assert.throws(
    () => startLiveSession(marina.auth,product,1,"room-b"),
    /ROOM_IN_USE/
  );
});

test("session token is required to read or mutate an AccessSession", () => {
  const { auth } = authenticate();
  const product = store.listCatalog(auth.auth_session_id).find(item => !item.sensitive);
  const access = startLiveSession(auth,product,1,"token");

  assert.throws(
    () => store.getAccessSessionDetail(access.access_session_id,""),
    /ACCESS_SESSION_UNAUTHORIZED/
  );
  assert.throws(() => store.registerAccessEvent({
    accessSessionId:access.access_session_id,
    sessionToken:"wrong",
    eventType:"DOOR_OPENED",
    commandId:"wrong-token-event",
    sourceDeviceId:store.TERMINAL_ID
  }), /ACCESS_SESSION_UNAUTHORIZED/);

  const detail = store.getAccessSessionDetail(access.access_session_id,access.session_token);
  assert.equal(detail.access_session_id,access.access_session_id);
  assert.equal(detail.session_token,undefined);
});

test("physical sequence requires picking ready, exit detection and door close in order", () => {
  const { auth } = authenticate();
  const product = store.listCatalog(auth.auth_session_id).find(item => !item.sensitive);
  let access = startLiveSession(auth,product,1,"physical");
  access = openRoom(access,"physical");
  const task = access.picking_tasks[0];

  assert.throws(() => store.registerAccessEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"DOOR_CLOSED",
    commandId:"close-too-early",
    sourceDeviceId:store.TERMINAL_ID
  }), /INVALID_ACCESS_SEQUENCE/);

  access = resolveTask(access,task,"CONFIRMED",task.quantity,"physical");
  access = finishPhysicalFlow(access,"physical");
  assert.equal(access.state,"READY_TO_CONFIRM");

  assert.throws(() => store.registerPickingEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"PICKING_ITEM_UNDONE",
    commandId:"pick-after-close",
    sourceDeviceId:store.PICKING_DISPLAY_ID,
    metadata:{group_key:task.picking_task_id}
  }), /PICKING_NOT_ACTIVE/);
});

test("PICKING_READY is rejected while checklist has unresolved tasks", () => {
  const { auth } = authenticate();
  const product = store.listCatalog(auth.auth_session_id).find(item => !item.sensitive);
  let access = startLiveSession(auth,product,1,"not-ready");
  access = openRoom(access,"not-ready");

  assert.throws(() => store.registerAccessEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"PICKING_READY",
    commandId:"not-ready-event",
    sourceDeviceId:store.PICKING_DISPLAY_ID
  }), /PICKING_NOT_READY/);
});

test("expired clock never destroys an occupied session", () => {
  const originalNow = Date.now;
  let fakeNow = Date.parse("2026-09-22T12:00:00.000Z");
  Date.now = () => fakeNow;
  try {
    const { auth } = authenticate();
    const product = store.listCatalog(auth.auth_session_id).find(item => !item.sensitive);
    let access = startLiveSession(auth,product,1,"timeout");
    access = openRoom(access,"timeout");

    fakeNow += 21*60*1000;
    const detail = store.getAccessSessionDetail(access.access_session_id,access.session_token);
    assert.equal(detail.state,"ENTRY_CONFIRMED");
    assert.ok(detail.timeout_alerted_at);

    const task = detail.picking_tasks[0];
    access = resolveTask(access,task,"CONFIRMED",task.quantity,"timeout");
    access = finishPhysicalFlow(access,"timeout");
    assert.equal(access.state,"READY_TO_CONFIRM");
  } finally {
    Date.now = originalNow;
  }
});

test("pre-entry session still expires fail-closed", () => {
  const originalNow = Date.now;
  let fakeNow = Date.parse("2026-09-22T12:00:00.000Z");
  Date.now = () => fakeNow;
  try {
    const { auth } = authenticate();
    const product = store.listCatalog(auth.auth_session_id).find(item => !item.sensitive);
    const access = startLiveSession(auth,product,1,"pre-expire");
    fakeNow += 21*60*1000;
    const detail = store.getAccessSessionDetail(access.access_session_id,access.session_token);
    assert.equal(detail.state,"EXPIRED");
  } finally {
    Date.now = originalNow;
  }
});

test("lot reallocation rejects a fallback that cannot satisfy the task", () => {
  const { auth } = authenticate();
  const product = store.listCatalog(auth.auth_session_id).find(item => !item.sensitive);
  let access = startLiveSession(auth,product,24,"capacity");
  access = openRoom(access,"capacity");

  const task = access.picking_tasks.find(item =>
    item.fallback_lots.some(lot => lot.available_units < item.quantity)
  );
  assert.ok(task);
  const fallback = task.fallback_lots.find(lot => lot.available_units < task.quantity);
  assert.ok(fallback);

  store.registerPickingEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"STOCK_LOCATION_DISCREPANCY",
    commandId:"capacity-discrepancy",
    sourceDeviceId:store.PICKING_DISPLAY_ID,
    metadata:{group_key:task.picking_task_id}
  });

  assert.throws(() => store.registerPickingEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"PICKING_LOT_REALLOCATED",
    commandId:"capacity-reallocate",
    sourceDeviceId:store.PICKING_DISPLAY_ID,
    metadata:{
      group_key:task.picking_task_id,
      to_location:fallback.location_code,
      to_stock_lot_id:fallback.stock_lot_id
    }
  }), /PICKING_REALLOCATION_INSUFFICIENT/);
});

test("partial or unavailable picking does not mark the OR complete", () => {
  const { auth } = authenticate("demo-marina");
  const order = store.listPendingOrders(auth.auth_session_id).find(item => !item.has_sensitive_items);
  let access = store.startAccessSession({
    authSessionId:auth.auth_session_id,
    orderIds:[order.order_id],
    liveItems:[],
    terminalId:store.TERMINAL_ID,
    commandId:"partial-order"
  });
  access = openRoom(access,"partial-order");

  access.picking_tasks.forEach((task,index)=>{
    access = resolveTask(
      access,
      task,
      index===0 ? "UNAVAILABLE" : "CONFIRMED",
      index===0 ? 0 : task.quantity,
      "partial-order"
    );
  });

  access = finishPhysicalFlow(access,"partial-order");
  access = store.confirmWithdrawal({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    commandId:"partial-order-confirm",
    sourceDeviceId:store.TERMINAL_ID
  });

  const fulfillment = access.withdrawal_confirmation.order_fulfillment.find(item => item.order_id===order.order_id);
  assert.notEqual(fulfillment.fulfillment_status,"COMPLETE");
  const updatedOrder = access.orders.find(item => item.order_id===order.order_id);
  assert.notEqual(updatedOrder.status,"RETIRADA_CONFIRMADA");
  assert.ok(["RETIRADA_PARCIAL","RETIRADA_NAO_ATENDIDA"].includes(updatedOrder.status));
});

test("final confirmation is generated from server picking state, not client results", () => {
  const { auth } = authenticate();
  const product = store.listCatalog(auth.auth_session_id).find(item => !item.sensitive);
  let access = startLiveSession(auth,product,1,"server-final");
  access = openRoom(access,"server-final");
  const task = access.picking_tasks[0];
  access = resolveTask(access,task,"CONFIRMED",task.quantity,"server-final");
  access = finishPhysicalFlow(access,"server-final");

  access = store.confirmWithdrawal({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    commandId:"server-final-confirm",
    sourceDeviceId:store.TERMINAL_ID,
    results:[{
      key:"forged",
      description:"forged",
      expected_quantity:999,
      actual_quantity:999,
      location_code:"Z99",
      stock_lot_id:"forged",
      lot_code:"forged",
      status:"CONFIRMED"
    }]
  });

  assert.equal(access.state,"WITHDRAWAL_CONFIRMED");
  assert.equal(access.withdrawal_confirmation.results[0].key,task.picking_task_id);
  assert.equal(access.withdrawal_confirmation.results[0].stock_lot_id,task.stock_lot_id);
});

test("sensitive stock still requires explicit permission", () => {
  const { auth } = authenticate("demo-carlos");
  const product = store.listCatalog(auth.auth_session_id).find(item => item.sensitive);
  assert.ok(product);

  assert.throws(
    () => startLiveSession(auth,product,1,"sensitive-denied"),
    /SENSITIVE_ACCESS_DENIED/
  );
});

test("audit requires an authenticated user with audit permission", () => {
  const rafael = authenticate("demo-rafael");
  assert.ok(Array.isArray(store.listAudit(rafael.auth.auth_session_id)));

  store.resetDevState();
  const carlos = authenticate("demo-carlos");
  assert.throws(
    () => store.listAudit(carlos.auth.auth_session_id),
    /AUDIT_ACCESS_DENIED/
  );
});

test("biometric evidence and challenge cannot be replayed", () => {
  const identity = store.identifyCredential("demo-rafael",store.TERMINAL_ID);
  const evidence = store.createBiometricEvidence({
    challengeId:identity.challenge_id,
    terminalId:store.TERMINAL_ID,
    deviceId:store.BIOMETRIC_DEVICE_ID,
    faceMatch:true,
    liveness:true
  });
  store.verifyIdentity({
    challengeId:identity.challenge_id,
    evidenceId:evidence.evidence_id,
    terminalId:store.TERMINAL_ID
  });

  assert.throws(() => store.verifyIdentity({
    challengeId:identity.challenge_id,
    evidenceId:evidence.evidence_id,
    terminalId:store.TERMINAL_ID
  }), /AUTH_CHALLENGE_EXPIRED/);
});

test("wrong device cannot emit physical events", () => {
  const { auth } = authenticate();
  const product = store.listCatalog(auth.auth_session_id).find(item => !item.sensitive);
  const access = startLiveSession(auth,product,1,"wrong-device");

  assert.throws(() => store.registerAccessEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"DOOR_OPENED",
    commandId:"wrong-device-event",
    sourceDeviceId:"EVIL-DEVICE"
  }), /UNTRUSTED_DEVICE/);
});
