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
  { employee_id:"emp_001", name:"Rafael Teste", role:"Direção", active:true, permissions:["stock.access","stock.sensitive.access"] },
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

const STOCK_ADDRESS_RULES = [
  [/agulha 25 x 7/i,{primary:"A2",alternatives:["A5"]}],
  [/agulha 13 x 4,5/i,{primary:"A3",alternatives:["A6"]}],
  [/agulha/i,{primary:"A4",alternatives:["A7"]}],
  [/gaze/i,{primary:"G4",alternatives:["G6"]}],
  [/compressa/i,{primary:"G3",alternatives:["G7"]}],
  [/atadura/i,{primary:"G2",alternatives:[]}],
  [/algod/i,{primary:"G1",alternatives:[]}],
  [/medicamento x/i,{primary:"E1",alternatives:["E5"],sensitive_area:true}],
  [/medicamento y/i,{primary:"E2",alternatives:["E5"],sensitive_area:true}],
  [/medicamento z/i,{primary:"E3",alternatives:["E6"],sensitive_area:true}],
  [/controlado/i,{primary:"E4",alternatives:["E6"],sensitive_area:true}],
  [/cateter 20/i,{primary:"C1",alternatives:["C5"]}],
  [/cateter 22/i,{primary:"C2",alternatives:["C5"]}],
  [/cateter 24/i,{primary:"C3",alternatives:["C6"]}],
  [/cateter/i,{primary:"C4",alternatives:[]}],
  [/seringa 1/i,{primary:"S1",alternatives:["S7"]}],
  [/seringa 3/i,{primary:"S2",alternatives:["S7"]}],
  [/seringa 5/i,{primary:"S3",alternatives:["S8"]}],
  [/seringa 10/i,{primary:"S4",alternatives:["S8"]}],
  [/seringa 20/i,{primary:"S5",alternatives:["S9"]}],
  [/seringa/i,{primary:"S6",alternatives:[]}],
  [/soro 250/i,{primary:"H1",alternatives:["H5"]}],
  [/soro 500/i,{primary:"H2",alternatives:["H5"]}],
  [/soro 1000/i,{primary:"H3",alternatives:["H6"]}],
  [/soro/i,{primary:"H4",alternatives:[]}],
  [/equipo/i,{primary:"B1",alternatives:["B5"]}],
  [/extensor/i,{primary:"B2",alternatives:[]}],
  [/torneira/i,{primary:"B3",alternatives:[]}],
  [/sonda/i,{primary:"B4",alternatives:[]}],
  [/luva/i,{primary:"L1",alternatives:["L7"]}],
  [/esparadrapo/i,{primary:"L2",alternatives:[]}],
  [/álcool/i,{primary:"L3",alternatives:[]}],
  [/clorexidina/i,{primary:"L4",alternatives:[]}],
  [/lâmina/i,{primary:"L5",alternatives:[]}],
  [/gel/i,{primary:"L6",alternatives:[]}]
];

function stockAddressFor(item) {
  const hit = STOCK_ADDRESS_RULES.find(([re]) => re.test(item?.description || ""));
  const cfg = hit?.[1] || { primary:"Z9", alternatives:[] };
  const sensitiveArea = item?.sensitive === true || cfg.sensitive_area === true;
  return {
    location_code:cfg.primary,
    alternate_locations:(cfg.alternatives || []).map((code,index)=>({
      location_code:code,
      available_units:Math.max(Number(item?.quantity || 1) * (index + 2), 2),
      sensitive_area:sensitiveArea
    }))
  };
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
    item_count:value.items.length,
    total_units:value.items.reduce((sum,item) => sum + Number(item.quantity || 0), 0),
    has_sensitive_items:hasSensitive(value),
    items:value.items.map(item => {
      const address = stockAddressFor(item);
      return {
        description:item.description,
        quantity:item.quantity,
        sensitive:item.sensitive === true,
        location_code:address.location_code,
        alternate_locations:address.alternate_locations
      };
    }),
    patient,
    requester:publicEmployee(employee(value.requester_employee_id))
  };
}

function canonicalHash(value) {
  const normalized = JSON.stringify(value, Object.keys(value || {}).sort());
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

function listPendingOrders(authSessionId) {
  if (!getAuth(authSessionId)) throw new Error("AUTH_SESSION_EXPIRED");
  return withdrawalOrders.filter(x => x.status === "AGUARDANDO_RETIRADA").map(orderSummary);
}

function startAccessSession({ authSessionId, orderIds, liveItems = [], terminalId = TERMINAL_ID, commandId }) {
  const normalizedLiveItems = (Array.isArray(liveItems) ? liveItems : []).map((item,index)=>({
    live_item_id:String(item?.live_item_id || `live_${index+1}`),
    description:String(item?.description || "").trim(),
    quantity:Number(item?.quantity || 0),
    sensitive:item?.sensitive === true,
    location_code:String(item?.location_code || "MANUAL").trim().toUpperCase(),
    alternate_locations:Array.isArray(item?.alternate_locations) ? item.alternate_locations : []
  }));
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
    if (normalizedLiveItems.some(item => !item.description || !Number.isFinite(item.quantity) || item.quantity <= 0)) throw new Error("LIVE_ITEM_INVALID");
    const orders = ids.map(order);
    if (orders.some(x => !x || x.status !== "AGUARDANDO_RETIRADA")) throw new Error("ORDER_NOT_AVAILABLE");
    const sensitive = orders.some(hasSensitive) || normalizedLiveItems.some(item => item.sensitive);
    const person = employee(auth.employee_id);
    if (sensitive && !hasPermission(person,"stock.sensitive.access")) throw new Error("SENSITIVE_ACCESS_DENIED");

    const access = {
      access_session_id:id("acc"),
      auth_session_id:auth.auth_session_id,
      employee_id:auth.employee_id,
      credential_id:auth.credential_id,
      terminal_id:terminalId,
      order_ids:ids,
      live_items:normalizedLiveItems,
      sensitive_access:sensitive,
      sensitive_access_granted:sensitive,
      state:"DOOR_AUTHORIZED",
      created_at:now(),
      expires_at:Date.now()+1200000
    };
    accessSessions.set(access.access_session_id, access);
    log(access,"ACCESS_SESSION_CREATED",{ order_ids:ids, live_item_count:normalizedLiveItems.length, sensitive_access:sensitive, command_id:commandId });
    log(access,"WITHDRAWAL_CONTEXT_CONFIRMED",{ order_ids:ids, live_items:normalizedLiveItems, command_id:commandId });
    log(access,"ACCESS_GRANTED",{ barrier_id:"STOCK_ROOM_DOOR", sensitive_access:sensitive });
    if (sensitive) log(access,"SENSITIVE_ACCESS_GRANTED",{ barrier_id:"SENSITIVE_STORAGE", permission:"stock.sensitive.access" });

    return {
      value:getAccessSessionDetail(access.access_session_id),
      result:() => getAccessSessionDetail(access.access_session_id)
    };
  });
}

function rawAccess(accessSessionId) {
  const access = accessSessions.get(String(accessSessionId || ""));
  if (access && access.expires_at < Date.now() && !["CLOSED","EXPIRED"].includes(access.state)) {
    access.state = "EXPIRED";
    log(access,"ACCESS_SESSION_EXPIRED");
  }
  return access || null;
}

function getAccessSessionDetail(accessSessionId) {
  const access = rawAccess(accessSessionId);
  if (!access) return null;
  return {
    ...access,
    employee:publicEmployee(employee(access.employee_id)),
    orders:access.order_ids.map(order).filter(Boolean).map(orderSummary),
    events:events.filter(x => x.access_session_id === access.access_session_id).slice().reverse()
  };
}

function registerAccessEvent({ accessSessionId, eventType, metadata = {}, commandId, sourceOccurredAt, sourceDeviceId }) {
  const payload = {
    accessSessionId:String(accessSessionId || ""),
    eventType:String(eventType || ""),
    metadata,
    sourceOccurredAt:String(sourceOccurredAt || ""),
    sourceDeviceId:String(sourceDeviceId || "")
  };

  return idempotent("registerAccessEvent", commandId, payload, () => {
    const access = rawAccess(accessSessionId);
    if (!access) throw new Error("ACCESS_SESSION_NOT_FOUND");
    if (["CLOSED","EXPIRED"].includes(access.state)) throw new Error("ACCESS_SESSION_INACTIVE");
    if (sourceDeviceId && sourceDeviceId !== access.terminal_id && sourceDeviceId !== BIOMETRIC_DEVICE_ID) throw new Error("UNTRUSTED_DEVICE");

    const transitions = {
      DOOR_OPENED:["DOOR_AUTHORIZED","DOOR_OPEN"],
      ENTRY_CONFIRMED:["DOOR_OPEN","ENTRY_CONFIRMED"],
      PRESENCE_CONFIRMED:["DOOR_OPEN","ENTRY_CONFIRMED"],
      DOOR_CLOSED:["ENTRY_CONFIRMED","READY_TO_CONFIRM"],
      ACCESS_CLOSED:["WITHDRAWAL_CONFIRMED","CLOSED"]
    };
    const transition = transitions[eventType];
    if (!transition || access.state !== transition[0]) throw new Error("INVALID_ACCESS_SEQUENCE");

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
      value:getAccessSessionDetail(access.access_session_id),
      result:() => getAccessSessionDetail(access.access_session_id)
    };
  });
}

function registerPickingEvent({ accessSessionId, eventType, metadata = {}, commandId, sourceDeviceId = PICKING_DISPLAY_ID }) {
  const allowed = new Set([
    "PICKING_ITEM_CONFIRMED","PICKING_ITEM_UNDONE","STOCK_LOCATION_DISCREPANCY",
    "PICKING_LOCATION_REROUTED","PICKING_PARTIAL","PICKING_UNAVAILABLE"
  ]);
  if (!allowed.has(String(eventType || ""))) throw new Error("INVALID_PICKING_EVENT");
  const payload = { accessSessionId:String(accessSessionId || ""), eventType:String(eventType || ""), metadata, sourceDeviceId:String(sourceDeviceId || "") };
  return idempotent("registerPickingEvent", commandId, payload, () => {
    const access = rawAccess(accessSessionId);
    if (!access) throw new Error("ACCESS_SESSION_NOT_FOUND");
    if (!["ENTRY_CONFIRMED","READY_TO_CONFIRM"].includes(access.state)) throw new Error("PICKING_NOT_ACTIVE");
    if (sourceDeviceId !== PICKING_DISPLAY_ID) throw new Error("UNTRUSTED_DEVICE");
    log(access,eventType,{ ...metadata, command_id:commandId, source_device_id:sourceDeviceId });
    return {
      value:getAccessSessionDetail(access.access_session_id),
      result:() => getAccessSessionDetail(access.access_session_id)
    };
  });
}

function confirmWithdrawal({ accessSessionId, results = [], commandId, sourceDeviceId = PICKING_DISPLAY_ID }) {
  const normalized = (Array.isArray(results) ? results : []).map(item=>({
    key:String(item?.key || ""),
    description:String(item?.description || ""),
    expected_quantity:Number(item?.expected_quantity || 0),
    actual_quantity:Number(item?.actual_quantity ?? 0),
    location_code:String(item?.location_code || ""),
    status:String(item?.status || "")
  }));
  const payload = { accessSessionId:String(accessSessionId || ""), results:normalized, sourceDeviceId:String(sourceDeviceId || "") };
  return idempotent("confirmWithdrawal", commandId, payload, () => {
    const access = rawAccess(accessSessionId);
    if (!access) throw new Error("ACCESS_SESSION_NOT_FOUND");
    if (access.state !== "READY_TO_CONFIRM") throw new Error("WITHDRAWAL_NOT_READY");
    if (sourceDeviceId !== PICKING_DISPLAY_ID) throw new Error("UNTRUSTED_DEVICE");
    if (!normalized.length || normalized.some(item => !["CONFIRMED","PARTIAL","UNAVAILABLE"].includes(item.status))) throw new Error("WITHDRAWAL_RESULTS_INCOMPLETE");

    const confirmedAt = now();
    access.withdrawal_confirmation = { confirmed_at:confirmedAt, results:normalized };
    access.state = "WITHDRAWAL_CONFIRMED";
    access.order_ids.map(order).filter(Boolean).forEach(x => {
      if (x.status === "EM_SEPARACAO") x.status = "RETIRADA_CONFIRMADA";
    });
    log(access,"WITHDRAWAL_CONFIRMED",{
      results:normalized,
      command_id:commandId,
      source_device_id:sourceDeviceId,
      dev_no_stock_movement:true
    });

    return {
      value:getAccessSessionDetail(access.access_session_id),
      result:() => getAccessSessionDetail(access.access_session_id)
    };
  });
}

function listAudit() {
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
  startAccessSession,
  registerAccessEvent,
  registerPickingEvent,
  confirmWithdrawal,
  getAccessSessionDetail,
  listAudit,
  terminalDescriptor
};