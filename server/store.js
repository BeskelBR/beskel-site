"use strict";

const crypto = require("crypto");

const TERMINAL_ID = "HVB-T01";
const BIOMETRIC_DEVICE_ID = "HVB-T01-BIO-DEV";
const PICKING_DISPLAY_ID = "HVB-PICKING-01";

const terminals = [
  {
    terminal_id: TERMINAL_ID,
    active: true,
    trusted_device_ids: [BIOMETRIC_DEVICE_ID],
    mode: "ACCESS_TERMINAL_V4"
  }
];

const employees = [
  { employee_id:"emp_001", name:"Rafael Teste", role:"Direção", active:true, permissions:["stock.access","stock.sensitive.access","terminal.audit"] },
  { employee_id:"emp_002", name:"Marina Teste", role:"Médica Veterinária", active:true, permissions:["stock.access","stock.sensitive.access"] },
  { employee_id:"emp_003", name:"Carlos Teste", role:"Enfermagem", active:true, permissions:["stock.access"] }
];

const credentials = [
  { credential_id:"cred_001", token:"demo-rafael", employee_id:"emp_001", status:"active", technology:"NFC TAG simples (simulado)" },
  { credential_id:"cred_002", token:"demo-marina", employee_id:"emp_002", status:"active", technology:"NFC TAG simples (simulado)" },
  { credential_id:"cred_003", token:"demo-carlos", employee_id:"emp_003", status:"active", technology:"NFC TAG simples (simulado)" }
];

const patients = [
  { patient_id:"pat_001", name:"Thor", species:"Cão" },
  { patient_id:"pat_002", name:"Luna", species:"Gato" },
  { patient_id:"pat_003", name:"Mel", species:"Cão" },
  { patient_id:"pat_004", name:"Bob", species:"Cão" },
  { patient_id:"pat_005", name:"Nina", species:"Gato" },
  { patient_id:"pat_006", name:"Zeus", species:"Cão" },
  { patient_id:"pat_007", name:"Amora", species:"Gato" },
  { patient_id:"pat_008", name:"Fred", species:"Cão" },
  { patient_id:"pat_009", name:"Maya", species:"Gato" },
  { patient_id:"pat_010", name:"Chico", species:"Cão" },
  { patient_id:"pat_011", name:"Bel", species:"Gato" },
  { patient_id:"pat_012", name:"Kira", species:"Cão" }
];

const episodes = [
  { episode_id:"ATD-001842", patient_id:"pat_001", status:"active" },
  { episode_id:"ATD-001845", patient_id:"pat_002", status:"active" },
  { episode_id:"ATD-001848", patient_id:"pat_003", status:"active" },
  { episode_id:"ATD-001850", patient_id:"pat_004", status:"active" },
  { episode_id:"ATD-001853", patient_id:"pat_005", status:"active" },
  { episode_id:"ATD-001855", patient_id:"pat_006", status:"active" },
  { episode_id:"ATD-001858", patient_id:"pat_007", status:"active" },
  { episode_id:"ATD-001860", patient_id:"pat_008", status:"active" },
  { episode_id:"ATD-001862", patient_id:"pat_009", status:"active" },
  { episode_id:"ATD-001865", patient_id:"pat_010", status:"active" },
  { episode_id:"ATD-001868", patient_id:"pat_011", status:"active" },
  { episode_id:"ATD-001871", patient_id:"pat_012", status:"active" }
];

const withdrawalOrders = [
  { order_id:"OR-2026-001842-01", episode_id:"ATD-001842", requester_employee_id:"emp_002", status:"AGUARDANDO_RETIRADA", items:[
    { description:"Cateter 22G", quantity:1, sensitive:false },
    { description:"Soro 500 mL", quantity:1, sensitive:false },
    { description:"Equipo", quantity:1, sensitive:false },
    { description:"Seringa 5 mL", quantity:2, sensitive:false },
    { description:"Medicamento X", quantity:1, sensitive:true }
  ]},
  { order_id:"OR-2026-001845-01", episode_id:"ATD-001845", requester_employee_id:"emp_002", status:"AGUARDANDO_RETIRADA", items:[
    { description:"Gaze estéril", quantity:2, sensitive:false },
    { description:"Luva cirúrgica", quantity:1, sensitive:false },
    { description:"Seringa 10 mL", quantity:2, sensitive:false }
  ]},
  { order_id:"OR-2026-001848-01", episode_id:"ATD-001848", requester_employee_id:"emp_002", status:"AGUARDANDO_RETIRADA", items:[
    { description:"Cateter 24G", quantity:1, sensitive:false },
    { description:"Esparadrapo", quantity:1, sensitive:false },
    { description:"Soro 250 mL", quantity:1, sensitive:false }
  ]},
  { order_id:"OR-2026-001850-01", episode_id:"ATD-001850", requester_employee_id:"emp_002", status:"AGUARDANDO_RETIRADA", items:[
    { description:"Agulha 25 x 7", quantity:3, sensitive:false },
    { description:"Seringa 3 mL", quantity:3, sensitive:false },
    { description:"Algodão", quantity:1, sensitive:false }
  ]},
  { order_id:"OR-2026-001853-01", episode_id:"ATD-001853", requester_employee_id:"emp_002", status:"AGUARDANDO_RETIRADA", items:[
    { description:"Cateter 22G", quantity:1, sensitive:false },
    { description:"Medicamento Y", quantity:2, sensitive:true },
    { description:"Seringa 5 mL", quantity:2, sensitive:false },
    { description:"Álcool 70%", quantity:1, sensitive:false }
  ]},
  { order_id:"OR-2026-001855-01", episode_id:"ATD-001855", requester_employee_id:"emp_002", status:"AGUARDANDO_RETIRADA", items:[
    { description:"Equipo macrogotas", quantity:1, sensitive:false },
    { description:"Soro 1000 mL", quantity:1, sensitive:false },
    { description:"Extensor", quantity:1, sensitive:false }
  ]},
  { order_id:"OR-2026-001858-01", episode_id:"ATD-001858", requester_employee_id:"emp_002", status:"AGUARDANDO_RETIRADA", items:[
    { description:"Gaze estéril", quantity:4, sensitive:false },
    { description:"Atadura 10 cm", quantity:2, sensitive:false },
    { description:"Luva procedimento", quantity:2, sensitive:false }
  ]},
  { order_id:"OR-2026-001860-01", episode_id:"ATD-001860", requester_employee_id:"emp_002", status:"AGUARDANDO_RETIRADA", items:[
    { description:"Medicamento Z", quantity:1, sensitive:true },
    { description:"Seringa 1 mL", quantity:2, sensitive:false },
    { description:"Agulha 13 x 4,5", quantity:2, sensitive:false }
  ]},
  { order_id:"OR-2026-001862-01", episode_id:"ATD-001862", requester_employee_id:"emp_002", status:"AGUARDANDO_RETIRADA", items:[
    { description:"Cateter 20G", quantity:1, sensitive:false },
    { description:"Soro 500 mL", quantity:2, sensitive:false },
    { description:"Equipo", quantity:2, sensitive:false },
    { description:"Torneira 3 vias", quantity:1, sensitive:false }
  ]},
  { order_id:"OR-2026-001865-01", episode_id:"ATD-001865", requester_employee_id:"emp_002", status:"AGUARDANDO_RETIRADA", items:[
    { description:"Compressa estéril", quantity:2, sensitive:false },
    { description:"Clorexidina", quantity:1, sensitive:false },
    { description:"Lâmina de bisturi", quantity:1, sensitive:false }
  ]},
  { order_id:"OR-2026-001868-01", episode_id:"ATD-001868", requester_employee_id:"emp_002", status:"AGUARDANDO_RETIRADA", items:[
    { description:"Seringa 20 mL", quantity:1, sensitive:false },
    { description:"Sonda", quantity:1, sensitive:false },
    { description:"Gel lubrificante", quantity:1, sensitive:false }
  ]},
  { order_id:"OR-2026-001871-01", episode_id:"ATD-001871", requester_employee_id:"emp_002", status:"AGUARDANDO_RETIRADA", items:[
    { description:"Medicamento Controlado A", quantity:1, sensitive:true },
    { description:"Seringa 3 mL", quantity:1, sensitive:false },
    { description:"Agulha 25 x 7", quantity:1, sensitive:false },
    { description:"Gaze estéril", quantity:2, sensitive:false }
  ]}
];

const challenges = new Map();
const biometricEvidence = new Map();
const authSessions = new Map();
const accessSessions = new Map();
const idempotency = new Map();
const events = [];

const id = prefix => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
const now = () => new Date().toISOString();
const employee = employeeId => employees.find(x => x.employee_id === employeeId) || null;
const order = orderId => withdrawalOrders.find(x => x.order_id === orderId) || null;
const terminal = terminalId => terminals.find(x => x.terminal_id === terminalId && x.active) || null;
const hasPermission = (person, permission) => Boolean(person?.permissions?.includes(permission));
const hasSensitive = value => Boolean(value?.items?.some(item => item.sensitive));

function catalogItems() {
  const byDescription = new Map();
  withdrawalOrders.forEach(orderValue => {
    (orderValue.items || []).forEach(item => {
      const description = String(item.description || "").trim();
      if (!description || byDescription.has(description)) return;
      byDescription.set(description,{
        description,
        sensitive:item.sensitive === true,
        allocation_strategy:"FEFO",
        tracks_expiration:true
      });
    });
  });
  return [...byDescription.values()]
    .sort((a,b)=>a.description.localeCompare(b.description,"pt-BR"))
    .map((item,index)=>({ product_id:`prod_${String(index+1).padStart(3,"0")}`, ...item }));
}

function productForDescription(description) {
  return catalogItems().find(item => item.description === String(description || "").trim()) || null;
}

// DEV: a coordenada pertence à ocupação física do lote, nunca ao produto.
// Os códigos abaixo apenas simulam posições que o responsável do estoque teria
// atribuído ao receber cada lote. Não existe mapa produto → coordenada.
function buildStockLots() {
  const products = catalogItems();
  let normalIndex = 1;
  let sensitiveIndex = 1;
  const lots = [];

  products.forEach((product,index) => {
    const lotCount = index % 6 === 0 ? 3 : 2;
    for (let rank=0; rank<lotCount; rank++) {
      const locationCode = product.sensitive
        ? `E${String(sensitiveIndex++).padStart(2,"0")}`
        : `A${String(normalIndex++).padStart(2,"0")}`;
      const month = rank === 0 ? 11 : rank === 1 ? 3 : 7;
      const year = rank === 0 ? 2026 : 2027;
      const day = 10 + (index % 15);
      const quantity = rank === 0 ? (product.sensitive ? 1 : 3) : rank === 1 ? 20 : 12;

      lots.push({
        stock_lot_id:`lot_${product.product_id}_${rank+1}`,
        product_id:product.product_id,
        lot_code:`HVB-${String(index+1).padStart(3,"0")}-L${rank+1}`,
        expires_at:`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}T23:59:59.000Z`,
        received_at:rank === 0 ? "2026-08-15T12:00:00.000Z" : rank === 1 ? "2026-09-10T12:00:00.000Z" : "2026-09-18T12:00:00.000Z",
        quantity_available:quantity,
        location_code:locationCode,
        sensitive_area:product.sensitive === true,
        status:"AVAILABLE",
        quarantine:false,
        blocked:false,
        location_assigned_by:"stock_manager_dev"
      });
    }
  });

  return lots;
}

const stockLots = buildStockLots();

function eligibleLots(productId) {
  const nowMs = Date.now();
  return stockLots
    .filter(lot =>
      lot.product_id === productId &&
      lot.status === "AVAILABLE" &&
      lot.blocked !== true &&
      lot.quarantine !== true &&
      Number(lot.quantity_available || 0) > 0 &&
      (!lot.expires_at || Date.parse(lot.expires_at) >= nowMs)
    )
    .sort((a,b) => {
      const aExpiry = a.expires_at ? Date.parse(a.expires_at) : Number.MAX_SAFE_INTEGER;
      const bExpiry = b.expires_at ? Date.parse(b.expires_at) : Number.MAX_SAFE_INTEGER;
      if (aExpiry !== bExpiry) return aExpiry - bExpiry; // FEFO
      const aReceived = Date.parse(a.received_at || 0);
      const bReceived = Date.parse(b.received_at || 0);
      if (aReceived !== bReceived) return aReceived - bReceived; // FIFO desempate
      return a.stock_lot_id.localeCompare(b.stock_lot_id);
    });
}

function buildPickingTasks(orders, liveItems) {
  const demands = [];

  orders.forEach(orderValue => {
    (orderValue.items || []).forEach((item,index) => {
      const product = productForDescription(item.description);
      if (!product) throw new Error("PRODUCT_NOT_FOUND");
      demands.push({
        product_id:product.product_id,
        description:product.description,
        sensitive:product.sensitive,
        quantity:Number(item.quantity || 0),
        source_type:"ORDER",
        source_id:orderValue.order_id,
        source_item_id:`${orderValue.order_id}:${index}`
      });
    });
  });

  (liveItems || []).forEach(item => {
    demands.push({
      product_id:item.product_id,
      description:item.description,
      sensitive:item.sensitive === true,
      quantity:Number(item.quantity || 0),
      source_type:"LIVE",
      source_id:item.live_item_id,
      source_item_id:item.live_item_id
    });
  });

  const byProduct = new Map();
  demands.forEach(demand => {
    if (!byProduct.has(demand.product_id)) byProduct.set(demand.product_id,[]);
    byProduct.get(demand.product_id).push({...demand,remaining:demand.quantity});
  });

  const reservations = new Map();
  const tasks = [];

  for (const [productId,sourceQueue] of byProduct.entries()) {
    const product = catalogItems().find(item => item.product_id === productId);
    const totalDemand = sourceQueue.reduce((sum,item)=>sum+item.quantity,0);
    let remaining = totalDemand;
    let allocationRank = 1;

    for (const lot of eligibleLots(productId)) {
      const alreadyReserved = Number(reservations.get(lot.stock_lot_id) || 0);
      const globallyReserved = reservedQuantityForLot(lot.stock_lot_id);
      const available = Math.max(Number(lot.quantity_available || 0) - globallyReserved - alreadyReserved,0);
      if (available <= 0) continue;
      const take = Math.min(available,remaining);
      if (take <= 0) break;

      let toDistribute = take;
      const sources = [];
      for (const source of sourceQueue) {
        if (toDistribute <= 0) break;
        if (source.remaining <= 0) continue;
        const sourceTake = Math.min(source.remaining,toDistribute);
        sources.push({
          source_type:source.source_type,
          source_id:source.source_id,
          source_item_id:source.source_item_id,
          quantity:sourceTake
        });
        source.remaining -= sourceTake;
        toDistribute -= sourceTake;
      }

      reservations.set(lot.stock_lot_id,alreadyReserved+take);
      tasks.push({
        picking_task_id:id("pick"),
        product_id:productId,
        description:product.description,
        sensitive:product.sensitive === true,
        quantity:take,
        stock_lot_id:lot.stock_lot_id,
        lot_code:lot.lot_code,
        expires_at:lot.expires_at,
        received_at:lot.received_at,
        location_code:lot.location_code,
        sensitive_area:lot.sensitive_area === true,
        allocation_strategy:"FEFO",
        allocation_rank:allocationRank++,
        sources
      });
      remaining -= take;
      if (remaining <= 0) break;
    }

    if (remaining > 0) throw new Error("STOCK_INSUFFICIENT");
  }

  // Fallbacks representam OUTROS LOTES elegíveis com saldo não reservado.
  // A contingência nunca presume que o mesmo lote esteja em outra coordenada.
  tasks.forEach(task => {
    task.fallback_lots = eligibleLots(task.product_id)
      .filter(lot => lot.stock_lot_id !== task.stock_lot_id)
      .map(lot => {
        const reserved = Number(reservations.get(lot.stock_lot_id) || 0);
        const globallyReserved = reservedQuantityForLot(lot.stock_lot_id);
        return {
          stock_lot_id:lot.stock_lot_id,
          lot_code:lot.lot_code,
          location_code:lot.location_code,
          available_units:Math.max(Number(lot.quantity_available || 0)-globallyReserved-reserved,0),
          expires_at:lot.expires_at,
          received_at:lot.received_at,
          sensitive_area:lot.sensitive_area === true
        };
      })
      .filter(lot => lot.available_units > 0);
  });

  return tasks.sort((a,b) =>
    a.location_code.localeCompare(b.location_code,"pt-BR",{numeric:true}) ||
    a.allocation_rank-b.allocation_rank
  );
}

function publicEmployee(value) {
  return value ? { employee_id:value.employee_id, name:value.name, role:value.role } : null;
}

function orderSummary(value) {
  const episode = episodes.find(x => x.episode_id === value.episode_id);
  const patient = patients.find(x => x.patient_id === episode?.patient_id) || null;
  return {
    order_id:value.order_id,
    episode_id:value.episode_id,
    status:value.status,
    fulfillment_status:value.fulfillment_status || null,
    item_count:value.items.length,
    total_units:value.items.reduce((sum,item) => sum + Number(item.quantity || 0), 0),
    has_sensitive_items:hasSensitive(value),
    items:value.items.map(item => {
      const product = productForDescription(item.description);
      return {
        product_id:product?.product_id || null,
        description:item.description,
        quantity:item.quantity,
        sensitive:item.sensitive === true,
        allocation_strategy:product?.allocation_strategy || "FEFO"
      };
    }),
    patient,
    requester:publicEmployee(employee(value.requester_employee_id))
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out,key)=>{
      out[key]=canonicalize(value[key]);
      return out;
    },{});
  }
  return value;
}

function canonicalHash(value) {
  const normalized = JSON.stringify(canonicalize(value));
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function idempotent(scope, commandId, payload, execute) {
  const cid = String(commandId || "").trim();
  if (!cid) throw new Error("COMMAND_ID_REQUIRED");
  const key = `${scope}:${cid}`;
  const requestHash = canonicalHash(payload);
  const prior = idempotency.get(key);
  if (prior) {
    if (prior.request_hash !== requestHash) throw new Error("IDEMPOTENCY_CONFLICT");
    return prior.result();
  }
  const created = execute();
  idempotency.set(key, { request_hash:requestHash, result:created.result });
  return created.value;
}

const ACTIVE_ACCESS_STATES = new Set([
  "DOOR_AUTHORIZED","DOOR_OPEN","ENTRY_CONFIRMED","PICKING_READY","EXIT_CONFIRMED","READY_TO_CONFIRM"
]);

function activeAccessSessions() {
  return [...accessSessions.values()].filter(access => ACTIVE_ACCESS_STATES.has(access.state));
}

function reservedQuantityForLot(stockLotId) {
  return activeAccessSessions().reduce((sum,access)=>
    sum + (access.picking_tasks || [])
      .filter(task => task.stock_lot_id === stockLotId && task.superseded !== true)
      .reduce((subtotal,task)=>subtotal+Number(task.quantity || 0),0)
  ,0);
}

function ensureRoomAndOrdersAvailable(orderIds, terminalId) {
  const active = activeAccessSessions();
  if (active.some(access => access.terminal_id === terminalId)) throw new Error("ROOM_IN_USE");
  const requested = new Set((orderIds || []).map(String));
  if (active.some(access => (access.order_ids || []).some(orderId => requested.has(orderId)))) {
    throw new Error("ORDER_ALREADY_RESERVED");
  }
}

function log(accessSession, eventType, metadata = {}) {
  const event = {
    event_id:id("evt"),
    occurred_at:now(),
    event_type:eventType,
    access_session_id:accessSession?.access_session_id || null,
    auth_session_id:accessSession?.auth_session_id || metadata.auth_session_id || null,
    employee_id:accessSession?.employee_id || metadata.employee_id || null,
    terminal_id:accessSession?.terminal_id || metadata.terminal_id || TERMINAL_ID,
    metadata
  };
  events.unshift(event);
  return event;
}

function requireTrustedTerminal(terminalId) {
  const value = terminal(String(terminalId || ""));
  if (!value) throw new Error("UNTRUSTED_TERMINAL");
  return value;
}

function identifyCredential(token, terminalId = TERMINAL_ID) {
  requireTrustedTerminal(terminalId);
  const credential = credentials.find(x => x.token === String(token || "") && x.status === "active");
  const person = employee(credential?.employee_id);
  if (!credential || !person?.active) throw new Error("CREDENTIAL_NOT_RECOGNIZED");
  if (!hasPermission(person,"stock.access")) throw new Error("ACCESS_NOT_PERMITTED");

  const challenge = {
    challenge_id:id("chl"),
    credential_id:credential.credential_id,
    employee_id:person.employee_id,
    terminal_id:terminalId,
    expires_at:Date.now()+120000,
    consumed:false
  };
  challenges.set(challenge.challenge_id, challenge);
  log(null,"NFC_VALIDATED",{
    employee_id:person.employee_id,
    terminal_id:terminalId,
    credential_id:credential.credential_id
  });

  return {
    credential_id:credential.credential_id,
    technology:credential.technology,
    employee:publicEmployee(person),
    challenge_id:challenge.challenge_id,
    challenge_expires_at:challenge.expires_at
  };
}

function createBiometricEvidence({ challengeId, terminalId = TERMINAL_ID, deviceId = BIOMETRIC_DEVICE_ID, faceMatch, liveness }) {
  const trustedTerminal = requireTrustedTerminal(terminalId);
  if (!trustedTerminal.trusted_device_ids.includes(deviceId)) throw new Error("UNTRUSTED_DEVICE");

  const challenge = challenges.get(String(challengeId || ""));
  if (!challenge || challenge.consumed || challenge.expires_at < Date.now()) throw new Error("AUTH_CHALLENGE_EXPIRED");
  if (challenge.terminal_id !== terminalId) throw new Error("TERMINAL_MISMATCH");

  const evidence = {
    evidence_id:id("bio"),
    challenge_id:challenge.challenge_id,
    employee_id:challenge.employee_id,
    terminal_id:terminalId,
    device_id:deviceId,
    face_match:faceMatch === true,
    liveness:liveness === true,
    engine:"DEV_BIOMETRIC_SIMULATOR",
    engine_version:"1",
    nonce:id("nonce"),
    captured_at:now(),
    expires_at:Date.now()+60000,
    consumed:false,
    attestation:"DEV_TRUSTED_COMPONENT_SIMULATION"
  };
  biometricEvidence.set(evidence.evidence_id, evidence);
  log(null,"BIOMETRIC_EVIDENCE_CREATED",{
    auth_session_id:null,
    employee_id:challenge.employee_id,
    terminal_id:terminalId,
    device_id:deviceId,
    evidence_id:evidence.evidence_id,
    engine:evidence.engine
  });
  return {
    evidence_id:evidence.evidence_id,
    challenge_id:evidence.challenge_id,
    terminal_id:evidence.terminal_id,
    device_id:evidence.device_id,
    engine:evidence.engine,
    engine_version:evidence.engine_version,
    captured_at:evidence.captured_at,
    expires_at:evidence.expires_at
  };
}

function verifyIdentity({ challengeId, evidenceId, terminalId = TERMINAL_ID }) {
  requireTrustedTerminal(terminalId);
  const challenge = challenges.get(String(challengeId || ""));
  if (!challenge || challenge.consumed || challenge.expires_at < Date.now()) throw new Error("AUTH_CHALLENGE_EXPIRED");
  if (challenge.terminal_id !== terminalId) throw new Error("TERMINAL_MISMATCH");

  const evidence = biometricEvidence.get(String(evidenceId || ""));
  if (!evidence || evidence.consumed || evidence.expires_at < Date.now()) throw new Error("AUTH_EVIDENCE_EXPIRED");
  if (evidence.challenge_id !== challenge.challenge_id) throw new Error("AUTH_EVIDENCE_MISMATCH");
  if (evidence.terminal_id !== terminalId) throw new Error("TERMINAL_MISMATCH");
  if (evidence.employee_id !== challenge.employee_id) throw new Error("AUTH_EVIDENCE_MISMATCH");
  if (evidence.attestation !== "DEV_TRUSTED_COMPONENT_SIMULATION") throw new Error("AUTH_EVIDENCE_UNTRUSTED");
  if (evidence.face_match !== true || evidence.liveness !== true) throw new Error("BIOMETRIC_VERIFICATION_FAILED");

  const trustedTerminal = requireTrustedTerminal(terminalId);
  if (!trustedTerminal.trusted_device_ids.includes(evidence.device_id)) throw new Error("UNTRUSTED_DEVICE");

  challenge.consumed = true;
  evidence.consumed = true;
  const person = employee(challenge.employee_id);
  const auth = {
    auth_session_id:id("auth"),
    employee_id:person.employee_id,
    credential_id:challenge.credential_id,
    terminal_id:terminalId,
    evidence_id:evidence.evidence_id,
    auth_level:"STANDARD",
    factors:["NFC_BASIC","FACE_1_TO_1","PAD_LIVENESS","DEVICE_ATTESTATION_SIMULATED"],
    expires_at:Date.now()+300000
  };
  authSessions.set(auth.auth_session_id, auth);
  log(null,"BIOMETRIC_VALIDATED",{
    auth_session_id:auth.auth_session_id,
    employee_id:person.employee_id,
    terminal_id:terminalId,
    evidence_id:evidence.evidence_id,
    device_id:evidence.device_id,
    factors:auth.factors
  });
  return { ...auth, employee:publicEmployee(person) };
}

function getAuth(authSessionId) {
  const auth = authSessions.get(String(authSessionId || ""));
  return auth && auth.expires_at >= Date.now() ? auth : null;
}

function listCatalog(authSessionId, query = "") {
  if (!getAuth(authSessionId)) throw new Error("AUTH_SESSION_EXPIRED");
  const needle = String(query || "").trim().toLocaleLowerCase("pt-BR");
  return catalogItems().filter(item => !needle || item.description.toLocaleLowerCase("pt-BR").includes(needle));
}

function listPendingOrders(authSessionId) {
  if (!getAuth(authSessionId)) throw new Error("AUTH_SESSION_EXPIRED");
  return withdrawalOrders.filter(x => x.status === "AGUARDANDO_RETIRADA").map(orderSummary);
}

function startAccessSession({ authSessionId, orderIds, liveItems = [], terminalId = TERMINAL_ID, commandId }) {
  const catalog = catalogItems();
  const normalizedLiveItems = (Array.isArray(liveItems) ? liveItems : []).map((item,index)=>{
    const product = catalog.find(x => x.product_id === String(item?.product_id || ""));
    if (!product) return null;
    return {
      live_item_id:String(item?.live_item_id || `live_${index+1}`),
      product_id:product.product_id,
      description:product.description,
      quantity:Number(item?.quantity || 0),
      sensitive:product.sensitive === true,
      allocation_strategy:product.allocation_strategy
    };
  });
  const payload = {
    authSessionId:String(authSessionId || ""),
    orderIds:[...(orderIds || [])].map(String).sort(),
    liveItems:normalizedLiveItems,
    terminalId:String(terminalId || "")
  };
  return idempotent("startAccessSession", commandId, payload, () => {
    const auth = getAuth(authSessionId);
    if (!auth) throw new Error("AUTH_SESSION_EXPIRED");
    if (auth.terminal_id !== terminalId) throw new Error("TERMINAL_MISMATCH");
    const ids = [...new Set((orderIds || []).map(String).filter(Boolean))];
    if (!ids.length && !normalizedLiveItems.length) throw new Error("ORDER_REQUIRED");
    if (normalizedLiveItems.some(item => !item || !item.description || !Number.isFinite(item.quantity) || item.quantity <= 0)) throw new Error("LIVE_ITEM_INVALID");
    const orders = ids.map(order);
    if (orders.some(x => !x || x.status !== "AGUARDANDO_RETIRADA")) throw new Error("ORDER_NOT_AVAILABLE");
    ensureRoomAndOrdersAvailable(ids,terminalId);
    const pickingTasks = buildPickingTasks(orders,normalizedLiveItems);
    const sensitive = pickingTasks.some(task => task.sensitive);
    const person = employee(auth.employee_id);
    if (sensitive && !hasPermission(person,"stock.sensitive.access")) throw new Error("SENSITIVE_ACCESS_DENIED");

    const access = {
      access_session_id:id("acc"),
      auth_session_id:auth.auth_session_id,
      employee_id:auth.employee_id,
      credential_id:auth.credential_id,
      terminal_id:terminalId,
      session_token:id("ast"),
      order_ids:ids,
      live_items:normalizedLiveItems,
      picking_tasks:pickingTasks,
      sensitive_access:sensitive,
      sensitive_access_granted:sensitive,
      state:"DOOR_AUTHORIZED",
      created_at:now(),
      expires_at:Date.now()+1200000,
      picking_state:{}
    };
    accessSessions.set(access.access_session_id, access);
    log(access,"ACCESS_SESSION_CREATED",{ order_ids:ids, live_item_count:normalizedLiveItems.length, sensitive_access:sensitive, command_id:commandId });
    log(access,"WITHDRAWAL_CONTEXT_CONFIRMED",{ order_ids:ids, live_items:normalizedLiveItems, command_id:commandId });
    log(access,"STOCK_ALLOCATION_CREATED",{
      strategy:"FEFO",
      fifo_tiebreak:true,
      tasks:pickingTasks.map(task=>({
        picking_task_id:task.picking_task_id,
        product_id:task.product_id,
        stock_lot_id:task.stock_lot_id,
        lot_code:task.lot_code,
        location_code:task.location_code,
        quantity:task.quantity,
        expires_at:task.expires_at
      }))
    });
    log(access,"ACCESS_GRANTED",{ barrier_id:"STOCK_ROOM_DOOR", sensitive_access:sensitive });
    if (sensitive) log(access,"SENSITIVE_ACCESS_GRANTED",{ barrier_id:"SENSITIVE_STORAGE", permission:"stock.sensitive.access" });

    return {
      value:accessDetail(access,true),
      result:() => accessDetail(access,true)
    };
  });
}

function expectedPickingGroups(access) {
  return (access.picking_tasks || []).map(task => ({
    key:task.picking_task_id,
    picking_task_id:task.picking_task_id,
    product_id:task.product_id,
    description:task.description,
    sensitive:task.sensitive === true,
    quantity:Number(task.quantity || 0),
    primary_location:task.location_code,
    stock_lot_id:task.stock_lot_id,
    lot_code:task.lot_code,
    expires_at:task.expires_at,
    sources:task.sources || [],
    fallback_lots:task.fallback_lots || []
  }));
}

function rawAccess(accessSessionId) {
  const access = accessSessions.get(String(accessSessionId || ""));
  if (!access) return null;

  if (access.expires_at < Date.now() && !["CLOSED","EXPIRED","WITHDRAWAL_CONFIRMED"].includes(access.state)) {
    if (access.state === "DOOR_AUTHORIZED") {
      access.state = "EXPIRED";
      access.expired_at = now();
      log(access,"ACCESS_SESSION_EXPIRED");
    } else if (!access.timeout_alerted_at) {
      access.timeout_alerted_at = now();
      log(access,"ACCESS_SESSION_TIMEOUT_ALERT",{ state:access.state });
    }
  }
  return access;
}

function accessDetail(access, includeToken = false) {
  if (!access) return null;
  const { session_token, ...safe } = access;
  return {
    ...safe,
    ...(includeToken ? { session_token } : {}),
    employee:publicEmployee(employee(access.employee_id)),
    orders:access.order_ids.map(order).filter(Boolean).map(orderSummary),
    events:events.filter(x => x.access_session_id === access.access_session_id).slice().reverse()
  };
}

function requireSessionToken(access, sessionToken) {
  if (!access || !sessionToken || access.session_token !== String(sessionToken)) {
    throw new Error("ACCESS_SESSION_UNAUTHORIZED");
  }
}

function getAccessSessionDetail(accessSessionId, sessionToken) {
  const access = rawAccess(accessSessionId);
  if (!access) return null;
  requireSessionToken(access,sessionToken);
  return accessDetail(access,false);
}

function registerAccessEvent({ accessSessionId, sessionToken, eventType, metadata = {}, commandId, sourceOccurredAt, sourceDeviceId }) {
  const payload = {
    accessSessionId:String(accessSessionId || ""),
    eventType:String(eventType || ""),
    metadata,
    sourceOccurredAt:String(sourceOccurredAt || ""),
    sourceDeviceId:String(sourceDeviceId || ""),
    sessionToken:String(sessionToken || "")
  };

  return idempotent("registerAccessEvent", commandId, payload, () => {
    const access = rawAccess(accessSessionId);
    if (!access) throw new Error("ACCESS_SESSION_NOT_FOUND");
    requireSessionToken(access,sessionToken);
    if (["CLOSED","EXPIRED"].includes(access.state)) throw new Error("ACCESS_SESSION_INACTIVE");

    if (eventType === "PICKING_READY") {
      if (sourceDeviceId !== PICKING_DISPLAY_ID) throw new Error("UNTRUSTED_DEVICE");
    } else if (sourceDeviceId !== access.terminal_id) {
      throw new Error("UNTRUSTED_DEVICE");
    }

    const transitions = {
      DOOR_OPENED:["DOOR_AUTHORIZED","DOOR_OPEN"],
      ENTRY_CONFIRMED:["DOOR_OPEN","ENTRY_CONFIRMED"],
      PRESENCE_CONFIRMED:["DOOR_OPEN","ENTRY_CONFIRMED"],
      PICKING_READY:["ENTRY_CONFIRMED","PICKING_READY"],
      PRESENCE_CLEARED:["PICKING_READY","EXIT_CONFIRMED"],
      DOOR_CLOSED:["EXIT_CONFIRMED","READY_TO_CONFIRM"],
      ACCESS_CLOSED:["WITHDRAWAL_CONFIRMED","CLOSED"]
    };
    const transition = transitions[eventType];
    if (!transition || access.state !== transition[0]) throw new Error("INVALID_ACCESS_SEQUENCE");

    if (eventType === "PICKING_READY") {
      const expected = expectedPickingGroups(access);
      const unresolved = expected.some(group => !["CONFIRMED","PARTIAL","UNAVAILABLE"].includes(access.picking_state[group.key]?.status));
      const openException = expected.some(group => access.picking_state[group.key]?.status === "EXCEPTION");
      if (unresolved || openException) throw new Error("PICKING_NOT_READY");
      access.picking_ready_at = now();
    }

    access.state = transition[1];
    if (eventType === "DOOR_OPENED" && access.sensitive_access_granted) {
      log(access,"SENSITIVE_DOOR_OPENED",{ barrier_id:"SENSITIVE_STORAGE", simulated:true });
    }
    if (eventType === "ENTRY_CONFIRMED" || eventType === "PRESENCE_CONFIRMED") {
      access.order_ids.map(order).filter(Boolean).forEach(x => {
        if (x.status === "AGUARDANDO_RETIRADA") x.status = "EM_SEPARACAO";
      });
    }
    if (eventType === "DOOR_CLOSED") access.door_closed_at = now();
    if (eventType === "ACCESS_CLOSED") access.closed_at = now();

    log(access,eventType,{
      ...metadata,
      command_id:commandId,
      source_occurred_at:sourceOccurredAt || null,
      source_device_id:sourceDeviceId || null
    });

    return {
      value:accessDetail(access,false),
      result:() => accessDetail(access,false)
    };
  });
}

function registerPickingEvent({ accessSessionId, sessionToken, eventType, metadata = {}, commandId, sourceDeviceId }) {
  const allowed = new Set([
    "PICKING_ITEM_CONFIRMED","PICKING_ITEM_UNDONE","STOCK_LOCATION_DISCREPANCY",
    "PICKING_LOCATION_REROUTED","PICKING_LOT_REALLOCATED","PICKING_PARTIAL","PICKING_UNAVAILABLE"
  ]);
  if (!allowed.has(String(eventType || ""))) throw new Error("INVALID_PICKING_EVENT");
  const payload = { accessSessionId:String(accessSessionId || ""), eventType:String(eventType || ""), metadata, sourceDeviceId:String(sourceDeviceId || ""), sessionToken:String(sessionToken || "") };
  return idempotent("registerPickingEvent", commandId, payload, () => {
    const access = rawAccess(accessSessionId);
    if (!access) throw new Error("ACCESS_SESSION_NOT_FOUND");
    requireSessionToken(access,sessionToken);
    if (access.state !== "ENTRY_CONFIRMED") throw new Error("PICKING_NOT_ACTIVE");
    if (sourceDeviceId !== PICKING_DISPLAY_ID) throw new Error("UNTRUSTED_DEVICE");

    const expected = expectedPickingGroups(access);
    const groupKey = String(metadata?.group_key || "");
    const group = expected.find(x => x.key === groupKey);
    if (!group) throw new Error("PICKING_GROUP_INVALID");

    const current = access.picking_state[group.key] || {
      status:"PENDING",
      active_location:group.primary_location,
      active_stock_lot_id:group.stock_lot_id,
      active_lot_code:group.lot_code,
      actual_quantity:null
    };
    const next = { ...current, updated_at:now() };

    if (eventType === "PICKING_ITEM_CONFIRMED") {
      next.status = "CONFIRMED";
      next.actual_quantity = group.quantity;
    } else if (eventType === "PICKING_ITEM_UNDONE") {
      next.status = "PENDING";
      next.actual_quantity = null;
    } else if (eventType === "STOCK_LOCATION_DISCREPANCY") {
      next.status = "EXCEPTION";
      next.discrepancy_location = current.active_location || group.primary_location;
      next.actual_quantity = null;
    } else if (eventType === "PICKING_LOCATION_REROUTED" || eventType === "PICKING_LOT_REALLOCATED") {
      const to = String(metadata?.to_location || "").trim().toUpperCase();
      const targetLotId = String(metadata?.to_stock_lot_id || "");
      const fallback = group.fallback_lots.find(lot =>
        lot.location_code === to &&
        (!targetLotId || lot.stock_lot_id === targetLotId)
      );
      if (!fallback) throw new Error("PICKING_LOCATION_INVALID");
      if (group.sensitive && fallback.sensitive_area !== true) throw new Error("PICKING_LOCATION_INVALID");
      if (Number(fallback.available_units || 0) < Number(group.quantity || 0)) throw new Error("PICKING_REALLOCATION_INSUFFICIENT");
      next.status = "PENDING";
      next.active_location = fallback.location_code;
      next.active_stock_lot_id = fallback.stock_lot_id;
      next.active_lot_code = fallback.lot_code;
      next.reallocated_from_stock_lot_id = current.active_stock_lot_id || group.stock_lot_id;
      next.actual_quantity = null;
    } else if (eventType === "PICKING_PARTIAL") {
      const actual = Number(metadata?.actual_quantity);
      if (!Number.isFinite(actual) || actual <= 0 || actual >= group.quantity) throw new Error("PICKING_QUANTITY_INVALID");
      next.status = "PARTIAL";
      next.actual_quantity = actual;
    } else if (eventType === "PICKING_UNAVAILABLE") {
      next.status = "UNAVAILABLE";
      next.actual_quantity = 0;
    }

    access.picking_state[group.key] = next;
    log(access,eventType,{ ...metadata, group_key:group.key, command_id:commandId, source_device_id:sourceDeviceId });

    return {
      value:accessDetail(access,false),
      result:() => accessDetail(access,false)
    };
  });
}

function computeOrderFulfillment(access,results) {
  const requested = new Map();
  const actual = new Map();

  (access.picking_tasks || []).forEach(task => {
    (task.sources || []).filter(source => source.source_type === "ORDER").forEach(source => {
      requested.set(source.source_id,(requested.get(source.source_id)||0)+Number(source.quantity||0));
    });

    const result = results.find(item => item.key === task.picking_task_id);
    let remainingActual = Number(result?.actual_quantity || 0);
    (task.sources || []).filter(source => source.source_type === "ORDER").forEach(source => {
      const allocated = Math.min(Number(source.quantity||0),remainingActual);
      actual.set(source.source_id,(actual.get(source.source_id)||0)+allocated);
      remainingActual -= allocated;
    });
  });

  return access.order_ids.map(orderId => {
    const expected = Number(requested.get(orderId)||0);
    const delivered = Number(actual.get(orderId)||0);
    const fulfillment_status = delivered >= expected && expected > 0
      ? "COMPLETE"
      : delivered > 0
        ? "PARTIAL"
        : "UNAVAILABLE";
    return { order_id:orderId, expected_quantity:expected, actual_quantity:delivered, fulfillment_status };
  });
}

function confirmWithdrawal({ accessSessionId, sessionToken, commandId, sourceDeviceId }) {
  const payload = {
    accessSessionId:String(accessSessionId || ""),
    sourceDeviceId:String(sourceDeviceId || ""),
    sessionToken:String(sessionToken || "")
  };

  return idempotent("confirmWithdrawal", commandId, payload, () => {
    const access = rawAccess(accessSessionId);
    if (!access) throw new Error("ACCESS_SESSION_NOT_FOUND");
    requireSessionToken(access,sessionToken);
    if (access.state !== "READY_TO_CONFIRM") throw new Error("WITHDRAWAL_NOT_READY");
    if (sourceDeviceId !== access.terminal_id) throw new Error("UNTRUSTED_DEVICE");

    const expected = expectedPickingGroups(access);
    if (!expected.length) throw new Error("WITHDRAWAL_RESULTS_INCOMPLETE");

    const normalized = expected.map(group => {
      const state = access.picking_state[group.key];
      if (!state || !["CONFIRMED","PARTIAL","UNAVAILABLE"].includes(state.status)) throw new Error("WITHDRAWAL_RESULTS_INCOMPLETE");

      const location_code = String(state.active_location || group.primary_location).toUpperCase();
      const stock_lot_id = String(state.active_stock_lot_id || group.stock_lot_id);
      const lot_code = String(state.active_lot_code || group.lot_code);
      const allowedPairs = [
        { stock_lot_id:group.stock_lot_id, lot_code:group.lot_code, location_code:group.primary_location },
        ...(group.fallback_lots || [])
      ];
      if (!allowedPairs.some(x =>
        x.stock_lot_id === stock_lot_id &&
        x.location_code === location_code &&
        x.lot_code === lot_code
      )) throw new Error("PICKING_LOCATION_INVALID");

      const actual_quantity = state.status === "CONFIRMED"
        ? group.quantity
        : state.status === "PARTIAL"
          ? Number(state.actual_quantity || 0)
          : 0;

      if (state.status === "PARTIAL" && !(actual_quantity > 0 && actual_quantity < group.quantity)) throw new Error("PICKING_QUANTITY_INVALID");

      return {
        key:group.key,
        description:group.description,
        expected_quantity:group.quantity,
        actual_quantity,
        location_code,
        stock_lot_id,
        lot_code,
        status:state.status
      };
    });

    const fulfillment = computeOrderFulfillment(access,normalized);
    fulfillment.forEach(item => {
      const target = order(item.order_id);
      if (!target) return;
      target.fulfillment_status = item.fulfillment_status;
      target.status = item.fulfillment_status === "COMPLETE"
        ? "RETIRADA_CONFIRMADA"
        : item.fulfillment_status === "PARTIAL"
          ? "RETIRADA_PARCIAL"
          : "RETIRADA_NAO_ATENDIDA";
    });

    const confirmedAt = now();
    access.withdrawal_confirmation = { confirmed_at:confirmedAt, results:normalized, order_fulfillment:fulfillment };
    access.state = "WITHDRAWAL_CONFIRMED";

    log(access,"WITHDRAWAL_CONFIRMED",{
      results:normalized,
      order_fulfillment:fulfillment,
      command_id:commandId,
      source_device_id:sourceDeviceId,
      dev_no_stock_movement:true
    });

    return {
      value:accessDetail(access,false),
      result:() => accessDetail(access,false)
    };
  });
}

function listAudit(authSessionId) {
  const auth = getAuth(authSessionId);
  if (!auth) throw new Error("AUTH_SESSION_EXPIRED");
  const person = employee(auth.employee_id);
  if (!hasPermission(person,"terminal.audit")) throw new Error("AUDIT_ACCESS_DENIED");
  return events.map(x => ({ ...x, employee:publicEmployee(employee(x.employee_id)) }));
}

function terminalDescriptor(terminalId = TERMINAL_ID) {
  const value = requireTrustedTerminal(terminalId);
  return {
    terminal_id:value.terminal_id,
    mode:value.mode,
    simulated_hardware:true,
    biometric_device_id:BIOMETRIC_DEVICE_ID,
    picking_display_id:PICKING_DISPLAY_ID,
    auth_contract_version:"4",
    access_contract_version:"4"
  };
}

module.exports = {
  TERMINAL_ID,
  BIOMETRIC_DEVICE_ID,
  PICKING_DISPLAY_ID,
  identifyCredential,
  createBiometricEvidence,
  verifyIdentity,
  listPendingOrders,
  listCatalog,
  listStockLots:() => stockLots.map(lot=>({...lot})),
  startAccessSession,
  registerAccessEvent,
  registerPickingEvent,
  confirmWithdrawal,
  getAccessSessionDetail,
  listAudit,
  terminalDescriptor
};