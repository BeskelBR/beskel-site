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

function startMixedSession(auth, commonProduct, sensitiveProduct, commandId = "mixed") {
  return store.startAccessSession({
    authSessionId:auth.auth_session_id,
    orderIds:[],
    liveItems:[
      { live_item_id:`live-${commandId}-common`, product_id:commonProduct.product_id, quantity:1 },
      { live_item_id:`live-${commandId}-sensitive`, product_id:sensitiveProduct.product_id, quantity:1 }
    ],
    terminalId:store.TERMINAL_ID,
    commandId
  });
}

function sensitiveEvent(access, eventType, sourceDeviceId, prefix = "sensitive", metadata = {}) {
  return {
    ...store.registerSensitiveEvent({
      accessSessionId:access.access_session_id,
      sessionToken:access.session_token,
      eventType,
      metadata,
      commandId:`${prefix}-${eventType}`,
      sourceOccurredAt:"2026-09-22T02:00:02.000Z",
      sourceDeviceId
    }),
    session_token:access.session_token
  };
}

function openSensitive(access, prefix = "sensitive-open") {
  let current=sensitiveEvent(access,"SENSITIVE_ACCESS_REQUESTED",store.PICKING_DISPLAY_ID,prefix);
  current={...sensitiveEvent({...current,session_token:access.session_token},"SENSITIVE_DOOR_OPENED",store.TERMINAL_ID,prefix),session_token:access.session_token};
  return current;
}

function closeAndLockSensitive(access, prefix = "sensitive-close") {
  let current=sensitiveEvent(access,"SENSITIVE_DOOR_CLOSED",store.TERMINAL_ID,prefix);
  current={...sensitiveEvent({...current,session_token:access.session_token},"SENSITIVE_LOCK_CONFIRMED",store.TERMINAL_ID,prefix),session_token:access.session_token};
  return current;
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

test("sensitive session starts eligible but locked and does not open with the main door", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct = store.listCatalog(auth.auth_session_id).find(item => item.sensitive);
  let access = startLiveSession(auth,sensitiveProduct,1,"sensitive-initial");
  assert.equal(access.sensitive_access,true);
  assert.equal(access.sensitive_access_eligible,true);
  assert.equal(access.sensitive_access_granted,false);
  assert.equal(access.sensitive_state,"LOCKED");
  assert.equal(access.sensitive_open_count,0);
  assert.equal(access.events.some(event=>event.event_type==="SENSITIVE_ACCESS_GRANTED"),false);

  access = store.registerAccessEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"DOOR_OPENED",
    commandId:"sensitive-main-door",
    sourceDeviceId:store.TERMINAL_ID
  });
  assert.equal(access.sensitive_state,"LOCKED");
  assert.equal(access.events.some(event=>event.event_type==="SENSITIVE_DOOR_OPENED"),false);
});

test("sensitive picking is impossible while cabinet is locked", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct = store.listCatalog(auth.auth_session_id).find(item => item.sensitive);
  let access = startLiveSession(auth,sensitiveProduct,1,"sensitive-locked");
  access = openRoom(access,"sensitive-locked");
  const task=access.picking_tasks.find(item=>item.sensitive);
  assert.throws(
    ()=>resolveTask(access,task,"CONFIRMED",task.quantity,"sensitive-locked"),
    /SENSITIVE_STORAGE_LOCKED/
  );
});

test("sensitive access request is allowed only from the internal picking display", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct = store.listCatalog(auth.auth_session_id).find(item => item.sensitive);
  let access = startLiveSession(auth,sensitiveProduct,1,"sensitive-request-device");
  access = openRoom(access,"sensitive-request-device");

  assert.throws(()=>store.registerSensitiveEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"SENSITIVE_ACCESS_REQUESTED",
    commandId:"request-wrong-device",
    sourceDeviceId:store.TERMINAL_ID
  }), /UNTRUSTED_DEVICE/);

  access=sensitiveEvent(access,"SENSITIVE_ACCESS_REQUESTED",store.PICKING_DISPLAY_ID,"request-right-device");
  assert.equal(access.sensitive_state,"UNLOCK_AUTHORIZED");
  assert.equal(access.sensitive_access_granted,true);
  assert.ok(access.sensitive_unlock_expires_at);
});

test("sensitive access cannot be requested before physical presence is confirmed", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct = store.listCatalog(auth.auth_session_id).find(item => item.sensitive);
  const access = startLiveSession(auth,sensitiveProduct,1,"sensitive-before-entry");

  assert.throws(()=>store.registerSensitiveEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"SENSITIVE_ACCESS_REQUESTED",
    commandId:"request-before-entry",
    sourceDeviceId:store.PICKING_DISPLAY_ID
  }), /SENSITIVE_ACCESS_NOT_ACTIVE/);
});

test("sensitive cabinet opening requires a prior request and trusted controller source", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct = store.listCatalog(auth.auth_session_id).find(item => item.sensitive);
  let access = startLiveSession(auth,sensitiveProduct,1,"sensitive-open-sequence");
  access = openRoom(access,"sensitive-open-sequence");

  assert.throws(()=>store.registerSensitiveEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"SENSITIVE_DOOR_OPENED",
    commandId:"open-without-request",
    sourceDeviceId:store.TERMINAL_ID
  }), /INVALID_SENSITIVE_SEQUENCE/);

  access=sensitiveEvent(access,"SENSITIVE_ACCESS_REQUESTED",store.PICKING_DISPLAY_ID,"open-sequence");
  assert.throws(()=>store.registerSensitiveEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"SENSITIVE_DOOR_OPENED",
    commandId:"open-wrong-device",
    sourceDeviceId:store.PICKING_DISPLAY_ID
  }), /UNTRUSTED_DEVICE/);

  access={...sensitiveEvent(access,"SENSITIVE_DOOR_OPENED",store.TERMINAL_ID,"open-sequence"),session_token:access.session_token};
  assert.equal(access.sensitive_state,"OPEN");
  assert.equal(access.sensitive_open_count,1);
});

test("no second biometric authentication is generated for sensitive access", () => {
  const login = authenticate("demo-rafael");
  const sensitiveProduct = store.listCatalog(login.auth.auth_session_id).find(item => item.sensitive);
  let access = startLiveSession(login.auth,sensitiveProduct,1,"no-second-auth");
  access = openRoom(access,"no-second-auth");
  const before=store.listAudit(login.auth.auth_session_id).filter(event=>event.event_type==="BIOMETRIC_VALIDATED").length;

  access=sensitiveEvent(access,"SENSITIVE_ACCESS_REQUESTED",store.PICKING_DISPLAY_ID,"no-second-auth");
  access={...sensitiveEvent(access,"SENSITIVE_DOOR_OPENED",store.TERMINAL_ID,"no-second-auth"),session_token:access.session_token};

  const after=store.listAudit(login.auth.auth_session_id).filter(event=>event.event_type==="BIOMETRIC_VALIDATED").length;
  assert.equal(before,1);
  assert.equal(after,1);
});

test("common picking is blocked throughout an active sensitive withdrawal session", () => {
  const { auth } = authenticate("demo-rafael");
  const catalog=store.listCatalog(auth.auth_session_id);
  const common=catalog.find(item=>!item.sensitive);
  const sensitive=catalog.find(item=>item.sensitive);
  let access=startMixedSession(auth,common,sensitive,"sensitive-isolation");
  access=openRoom(access,"sensitive-isolation");
  const commonTask=access.picking_tasks.find(item=>!item.sensitive);

  access=sensitiveEvent(access,"SENSITIVE_ACCESS_REQUESTED",store.PICKING_DISPLAY_ID,"sensitive-isolation");
  assert.throws(()=>resolveTask(access,commonTask,"CONFIRMED",commonTask.quantity,"common-during-unlock"),/SENSITIVE_SESSION_ACTIVE/);

  access={...sensitiveEvent(access,"SENSITIVE_DOOR_OPENED",store.TERMINAL_ID,"sensitive-isolation"),session_token:access.session_token};
  assert.throws(()=>resolveTask(access,commonTask,"CONFIRMED",commonTask.quantity,"common-during-open"),/SENSITIVE_SESSION_ACTIVE/);

  access={...sensitiveEvent(access,"SENSITIVE_DOOR_CLOSED",store.TERMINAL_ID,"sensitive-isolation"),session_token:access.session_token};
  assert.throws(()=>resolveTask(access,commonTask,"CONFIRMED",commonTask.quantity,"common-during-close"),/SENSITIVE_SESSION_ACTIVE/);
});

test("sensitive picking is enabled only while cabinet door is physically open", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct=store.listCatalog(auth.auth_session_id).find(item=>item.sensitive);
  let access=startLiveSession(auth,sensitiveProduct,1,"sensitive-pick-window");
  access=openRoom(access,"sensitive-pick-window");
  const task=access.picking_tasks.find(item=>item.sensitive);

  access=sensitiveEvent(access,"SENSITIVE_ACCESS_REQUESTED",store.PICKING_DISPLAY_ID,"sensitive-pick-window");
  assert.throws(()=>resolveTask(access,task,"CONFIRMED",task.quantity,"pick-before-open"),/SENSITIVE_STORAGE_LOCKED/);

  access={...sensitiveEvent(access,"SENSITIVE_DOOR_OPENED",store.TERMINAL_ID,"sensitive-pick-window"),session_token:access.session_token};
  access=resolveTask(access,task,"CONFIRMED",task.quantity,"pick-while-open");
  assert.equal(access.picking_state[task.picking_task_id].status,"CONFIRMED");

  access={...sensitiveEvent(access,"SENSITIVE_DOOR_CLOSED",store.TERMINAL_ID,"sensitive-pick-window"),session_token:access.session_token};
  assert.throws(()=>resolveTask(access,task,"CONFIRMED",task.quantity,"pick-after-close"),/SENSITIVE_STORAGE_LOCKED/);
});

test("resolved sensitive session becomes completed only after door close and lock confirmation", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct=store.listCatalog(auth.auth_session_id).find(item=>item.sensitive);
  let access=startLiveSession(auth,sensitiveProduct,1,"sensitive-complete");
  access=openRoom(access,"sensitive-complete");
  const task=access.picking_tasks[0];
  access=openSensitive(access,"sensitive-complete");
  access=resolveTask(access,task,"CONFIRMED",task.quantity,"sensitive-complete");

  assert.equal(access.sensitive_state,"OPEN");
  access={...sensitiveEvent(access,"SENSITIVE_DOOR_CLOSED",store.TERMINAL_ID,"sensitive-complete"),session_token:access.session_token};
  assert.equal(access.sensitive_state,"CLOSED");
  access={...sensitiveEvent(access,"SENSITIVE_LOCK_CONFIRMED",store.TERMINAL_ID,"sensitive-complete"),session_token:access.session_token};
  assert.equal(access.sensitive_state,"COMPLETED");
  assert.equal(access.sensitive_access_granted,false);
});

test("closing cabinet with pending sensitive items returns to locked and allows another opening", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct=store.listCatalog(auth.auth_session_id).find(item=>item.sensitive);
  let access=startLiveSession(auth,sensitiveProduct,2,"sensitive-reopen");
  access=openRoom(access,"sensitive-reopen");
  const tasks=access.picking_tasks.filter(item=>item.sensitive);
  assert.ok(tasks.length>=2);

  access=openSensitive(access,"sensitive-reopen-1");
  access=resolveTask(access,tasks[0],"CONFIRMED",tasks[0].quantity,"sensitive-reopen-1");
  access=closeAndLockSensitive(access,"sensitive-reopen-1");
  assert.equal(access.sensitive_state,"LOCKED");

  access=sensitiveEvent(access,"SENSITIVE_ACCESS_REQUESTED",store.PICKING_DISPLAY_ID,"sensitive-reopen-2");
  assert.equal(access.sensitive_state,"UNLOCK_AUTHORIZED");
  access={...sensitiveEvent(access,"SENSITIVE_DOOR_OPENED",store.TERMINAL_ID,"sensitive-reopen-2"),session_token:access.session_token};
  assert.equal(access.sensitive_open_count,2);
});

test("PICKING_READY is blocked until sensitive cabinet is locked after resolved picking", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct=store.listCatalog(auth.auth_session_id).find(item=>item.sensitive);
  let access=startLiveSession(auth,sensitiveProduct,1,"sensitive-ready-guard");
  access=openRoom(access,"sensitive-ready-guard");
  const task=access.picking_tasks[0];
  access=openSensitive(access,"sensitive-ready-guard");
  access=resolveTask(access,task,"CONFIRMED",task.quantity,"sensitive-ready-guard");

  assert.throws(()=>store.registerAccessEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"PICKING_READY",
    commandId:"sensitive-ready-too-soon",
    sourceDeviceId:store.PICKING_DISPLAY_ID
  }), /SENSITIVE_STORAGE_NOT_SECURED/);

  access=closeAndLockSensitive(access,"sensitive-ready-guard");
  access=finishPhysicalFlow(access,"sensitive-ready-guard");
  assert.equal(access.state,"READY_TO_CONFIRM");
});

test("sensitive unlock authorization expires quickly but the same authenticated session may request again", () => {
  const originalNow=Date.now;
  let fakeNow=Date.parse("2026-09-22T12:00:00.000Z");
  Date.now=()=>fakeNow;
  try{
    const login=authenticate("demo-rafael");
    const sensitiveProduct=store.listCatalog(login.auth.auth_session_id).find(item=>item.sensitive);
    let access=startLiveSession(login.auth,sensitiveProduct,1,"sensitive-expiry");
    access=openRoom(access,"sensitive-expiry");
    access=sensitiveEvent(access,"SENSITIVE_ACCESS_REQUESTED",store.PICKING_DISPLAY_ID,"sensitive-expiry-1");
    fakeNow+=16000;

    assert.throws(()=>store.registerSensitiveEvent({
      accessSessionId:access.access_session_id,
      sessionToken:access.session_token,
      eventType:"SENSITIVE_DOOR_OPENED",
      commandId:"sensitive-expired-open",
      sourceDeviceId:store.TERMINAL_ID
    }), /SENSITIVE_UNLOCK_EXPIRED/);

    const detail=store.getAccessSessionDetail(access.access_session_id,access.session_token);
    assert.equal(detail.sensitive_state,"LOCKED");
    access={...detail,session_token:access.session_token};
    access=sensitiveEvent(access,"SENSITIVE_ACCESS_REQUESTED",store.PICKING_DISPLAY_ID,"sensitive-expiry-2");
    assert.equal(access.sensitive_state,"UNLOCK_AUTHORIZED");

    const biometricEvents=store.listAudit(login.auth.auth_session_id).filter(event=>event.event_type==="BIOMETRIC_VALIDATED");
    assert.equal(biometricEvents.length,1);
  }finally{
    Date.now=originalNow;
  }
});

test("sensitive unlock expiry is audited once", () => {
  const originalNow=Date.now;
  let fakeNow=Date.parse("2026-09-22T12:00:00.000Z");
  Date.now=()=>fakeNow;
  try{
    const login=authenticate("demo-rafael");
    const sensitiveProduct=store.listCatalog(login.auth.auth_session_id).find(item=>item.sensitive);
    let access=startLiveSession(login.auth,sensitiveProduct,1,"sensitive-expiry-audit");
    access=openRoom(access,"sensitive-expiry-audit");
    access=sensitiveEvent(access,"SENSITIVE_ACCESS_REQUESTED",store.PICKING_DISPLAY_ID,"sensitive-expiry-audit");
    fakeNow+=16000;
    store.getAccessSessionDetail(access.access_session_id,access.session_token);
    store.getAccessSessionDetail(access.access_session_id,access.session_token);
    const expired=store.listAudit(login.auth.auth_session_id).filter(event=>event.event_type==="SENSITIVE_UNLOCK_EXPIRED");
    assert.equal(expired.length,1);
  }finally{
    Date.now=originalNow;
  }
});

test("duplicate sensitive request while unlock is already authorized is rejected", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct=store.listCatalog(auth.auth_session_id).find(item=>item.sensitive);
  let access=startLiveSession(auth,sensitiveProduct,1,"sensitive-double-request");
  access=openRoom(access,"sensitive-double-request");
  access=sensitiveEvent(access,"SENSITIVE_ACCESS_REQUESTED",store.PICKING_DISPLAY_ID,"sensitive-double-request-1");

  assert.throws(()=>store.registerSensitiveEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"SENSITIVE_ACCESS_REQUESTED",
    commandId:"sensitive-double-request-2",
    sourceDeviceId:store.PICKING_DISPLAY_ID
  }), /INVALID_SENSITIVE_SEQUENCE/);
});

test("invalid sensitive close and lock transitions are rejected", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct=store.listCatalog(auth.auth_session_id).find(item=>item.sensitive);
  let access=startLiveSession(auth,sensitiveProduct,1,"sensitive-invalid-transition");
  access=openRoom(access,"sensitive-invalid-transition");

  assert.throws(()=>store.registerSensitiveEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"SENSITIVE_DOOR_CLOSED",
    commandId:"sensitive-close-locked",
    sourceDeviceId:store.TERMINAL_ID
  }), /INVALID_SENSITIVE_SEQUENCE/);

  assert.throws(()=>store.registerSensitiveEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"SENSITIVE_LOCK_CONFIRMED",
    commandId:"sensitive-lock-without-close",
    sourceDeviceId:store.TERMINAL_ID
  }), /INVALID_SENSITIVE_SEQUENCE/);
});

test("completed sensitive session cannot be reopened when no sensitive item is pending", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct=store.listCatalog(auth.auth_session_id).find(item=>item.sensitive);
  let access=startLiveSession(auth,sensitiveProduct,1,"sensitive-no-reopen");
  access=openRoom(access,"sensitive-no-reopen");
  const task=access.picking_tasks[0];
  access=openSensitive(access,"sensitive-no-reopen");
  access=resolveTask(access,task,"CONFIRMED",task.quantity,"sensitive-no-reopen");
  access=closeAndLockSensitive(access,"sensitive-no-reopen");
  assert.equal(access.sensitive_state,"COMPLETED");

  assert.throws(()=>store.registerSensitiveEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"SENSITIVE_ACCESS_REQUESTED",
    commandId:"sensitive-reopen-complete",
    sourceDeviceId:store.PICKING_DISPLAY_ID
  }), /SENSITIVE_ITEMS_ALREADY_RESOLVED/);
});

test("normal session cannot request sensitive storage", () => {
  const { auth } = authenticate("demo-rafael");
  const commonProduct=store.listCatalog(auth.auth_session_id).find(item=>!item.sensitive);
  let access=startLiveSession(auth,commonProduct,1,"normal-sensitive-request");
  access=openRoom(access,"normal-sensitive-request");

  assert.throws(()=>store.registerSensitiveEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"SENSITIVE_ACCESS_REQUESTED",
    commandId:"normal-sensitive-request-event",
    sourceDeviceId:store.PICKING_DISPLAY_ID
  }), /SENSITIVE_ACCESS_DENIED/);
});

test("sensitive event requires the AccessSession token", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct=store.listCatalog(auth.auth_session_id).find(item=>item.sensitive);
  let access=startLiveSession(auth,sensitiveProduct,1,"sensitive-token");
  access=openRoom(access,"sensitive-token");

  assert.throws(()=>store.registerSensitiveEvent({
    accessSessionId:access.access_session_id,
    sessionToken:"wrong",
    eventType:"SENSITIVE_ACCESS_REQUESTED",
    commandId:"sensitive-token-wrong",
    sourceDeviceId:store.PICKING_DISPLAY_ID
  }), /ACCESS_SESSION_UNAUTHORIZED/);
});

test("sensitive event idempotent replay does not increment cabinet opening twice", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct=store.listCatalog(auth.auth_session_id).find(item=>item.sensitive);
  let access=startLiveSession(auth,sensitiveProduct,1,"sensitive-idempotent");
  access=openRoom(access,"sensitive-idempotent");
  access=sensitiveEvent(access,"SENSITIVE_ACCESS_REQUESTED",store.PICKING_DISPLAY_ID,"sensitive-idempotent");

  const payload={
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"SENSITIVE_DOOR_OPENED",
    commandId:"sensitive-open-same-command",
    sourceOccurredAt:"2026-09-22T02:00:03.000Z",
    sourceDeviceId:store.TERMINAL_ID
  };
  const first=store.registerSensitiveEvent(payload);
  const second=store.registerSensitiveEvent(payload);
  assert.equal(first.sensitive_open_count,1);
  assert.equal(second.sensitive_open_count,1);
});

test("sensitive idempotency detects changed nested metadata", () => {
  const { auth } = authenticate("demo-rafael");
  const sensitiveProduct=store.listCatalog(auth.auth_session_id).find(item=>item.sensitive);
  let access=startLiveSession(auth,sensitiveProduct,1,"sensitive-idem-conflict");
  access=openRoom(access,"sensitive-idem-conflict");

  store.registerSensitiveEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"SENSITIVE_ACCESS_REQUESTED",
    metadata:{reason:{kind:"medication",count:1}},
    commandId:"sensitive-idem-command",
    sourceDeviceId:store.PICKING_DISPLAY_ID
  });

  assert.throws(()=>store.registerSensitiveEvent({
    accessSessionId:access.access_session_id,
    sessionToken:access.session_token,
    eventType:"SENSITIVE_ACCESS_REQUESTED",
    metadata:{reason:{kind:"medication",count:2}},
    commandId:"sensitive-idem-command",
    sourceDeviceId:store.PICKING_DISPLAY_ID
  }), /IDEMPOTENCY_CONFLICT/);
});

test("common picking resumes only after cabinet lock is confirmed", () => {
  const { auth } = authenticate("demo-rafael");
  const catalog=store.listCatalog(auth.auth_session_id);
  const common=catalog.find(item=>!item.sensitive);
  const sensitive=catalog.find(item=>item.sensitive);
  let access=startMixedSession(auth,common,sensitive,"sensitive-common-resume");
  access=openRoom(access,"sensitive-common-resume");
  const commonTask=access.picking_tasks.find(item=>!item.sensitive);
  const sensitiveTask=access.picking_tasks.find(item=>item.sensitive);

  access=openSensitive(access,"sensitive-common-resume");
  access=resolveTask(access,sensitiveTask,"CONFIRMED",sensitiveTask.quantity,"sensitive-common-resume");
  access={...sensitiveEvent(access,"SENSITIVE_DOOR_CLOSED",store.TERMINAL_ID,"sensitive-common-resume"),session_token:access.session_token};
  assert.throws(()=>resolveTask(access,commonTask,"CONFIRMED",commonTask.quantity,"common-before-lock"),/SENSITIVE_SESSION_ACTIVE/);

  access={...sensitiveEvent(access,"SENSITIVE_LOCK_CONFIRMED",store.TERMINAL_ID,"sensitive-common-resume"),session_token:access.session_token};
  access=resolveTask(access,commonTask,"CONFIRMED",commonTask.quantity,"common-after-lock");
  assert.equal(access.picking_state[commonTask.picking_task_id].status,"CONFIRMED");
});

test("sensitive cabinet remains closable and lockable after AccessSession timeout alert", () => {
  const originalNow=Date.now;
  let fakeNow=Date.parse("2026-09-22T12:00:00.000Z");
  Date.now=()=>fakeNow;
  try{
    const { auth }=authenticate("demo-rafael");
    const sensitiveProduct=store.listCatalog(auth.auth_session_id).find(item=>item.sensitive);
    let access=startLiveSession(auth,sensitiveProduct,1,"sensitive-timeout-open");
    access=openRoom(access,"sensitive-timeout-open");
    const task=access.picking_tasks[0];
    access=openSensitive(access,"sensitive-timeout-open");
    access=resolveTask(access,task,"CONFIRMED",task.quantity,"sensitive-timeout-open");

    fakeNow+=21*60*1000;
    const detail=store.getAccessSessionDetail(access.access_session_id,access.session_token);
    assert.equal(detail.state,"ENTRY_CONFIRMED");
    assert.equal(detail.sensitive_state,"OPEN");
    assert.ok(detail.timeout_alerted_at);

    access={...detail,session_token:access.session_token};
    access=closeAndLockSensitive(access,"sensitive-timeout-open");
    assert.equal(access.sensitive_state,"COMPLETED");
  }finally{
    Date.now=originalNow;
  }
});

test("sensitive access audit preserves request grant open close lock and completion sequence", () => {
  const login=authenticate("demo-rafael");
  const sensitiveProduct=store.listCatalog(login.auth.auth_session_id).find(item=>item.sensitive);
  let access=startLiveSession(login.auth,sensitiveProduct,1,"sensitive-audit-sequence");
  access=openRoom(access,"sensitive-audit-sequence");
  const task=access.picking_tasks[0];
  access=openSensitive(access,"sensitive-audit-sequence");
  access=resolveTask(access,task,"CONFIRMED",task.quantity,"sensitive-audit-sequence");
  access=closeAndLockSensitive(access,"sensitive-audit-sequence");

  const types=store.listAudit(login.auth.auth_session_id)
    .filter(event=>event.access_session_id===access.access_session_id)
    .map(event=>event.event_type);
  for(const expected of [
    "SENSITIVE_ACCESS_ELIGIBLE",
    "SENSITIVE_ACCESS_REQUESTED",
    "SENSITIVE_ACCESS_GRANTED",
    "SENSITIVE_DOOR_OPENED",
    "SENSITIVE_DOOR_CLOSED",
    "SENSITIVE_LOCK_CONFIRMED",
    "SENSITIVE_ACCESS_COMPLETED"
  ]) assert.ok(types.includes(expected),expected);
});

