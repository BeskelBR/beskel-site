"use strict";

const crypto = require("crypto");

const TERMINAL_ID = "HVB-T01";
const employees = [
  { employee_id:"emp_001", name:"Rafael Teste", role:"Direção", active:true, permissions:["stock.access","stock.sensitive.access"] },
  { employee_id:"emp_002", name:"Marina Teste", role:"Médica Veterinária", active:true, permissions:["stock.access","stock.sensitive.access"] },
  { employee_id:"emp_003", name:"Carlos Teste", role:"Enfermagem", active:true, permissions:["stock.access"] }
];
const credentials = [
  { credential_id:"cred_001", token:"demo-rafael", employee_id:"emp_001", status:"active" },
  { credential_id:"cred_002", token:"demo-marina", employee_id:"emp_002", status:"active" },
  { credential_id:"cred_003", token:"demo-carlos", employee_id:"emp_003", status:"active" }
];
const patients = [
  { patient_id:"pat_001", name:"Thor", species:"Cão" },
  { patient_id:"pat_002", name:"Luna", species:"Gato" }
];
const episodes = [
  { episode_id:"ATD-001842", patient_id:"pat_001", status:"active" },
  { episode_id:"ATD-001845", patient_id:"pat_002", status:"active" }
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
    { description:"Luva cirúrgica", quantity:1, sensitive:false }
  ]}
];

const challenges = new Map();
const authSessions = new Map();
const accessSessions = new Map();
const events = [];

const id = prefix => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
const now = () => new Date().toISOString();
const employee = employeeId => employees.find(x => x.employee_id === employeeId) || null;
const order = orderId => withdrawalOrders.find(x => x.order_id === orderId) || null;
const hasPermission = (person, permission) => Boolean(person?.permissions?.includes(permission));
const hasSensitive = value => Boolean(value?.items?.some(item => item.sensitive));

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
    patient,
    requester:publicEmployee(employee(value.requester_employee_id))
  };
}
function log(accessSession, eventType, metadata = {}) {
  const event = {
    event_id:id("evt"), occurred_at:now(), event_type:eventType,
    access_session_id:accessSession?.access_session_id || null,
    auth_session_id:accessSession?.auth_session_id || metadata.auth_session_id || null,
    employee_id:accessSession?.employee_id || metadata.employee_id || null,
    terminal_id:accessSession?.terminal_id || metadata.terminal_id || TERMINAL_ID,
    metadata
  };
  events.unshift(event);
  return event;
}

function identifyCredential(token, terminalId = TERMINAL_ID) {
  const credential = credentials.find(x => x.token === String(token || "") && x.status === "active");
  const person = employee(credential?.employee_id);
  if (!credential || !person?.active) throw new Error("CREDENTIAL_NOT_RECOGNIZED");
  if (!hasPermission(person,"stock.access")) throw new Error("ACCESS_NOT_PERMITTED");
  const challenge = { challenge_id:id("chl"), credential_id:credential.credential_id, employee_id:person.employee_id, terminal_id:terminalId, expires_at:Date.now()+120000, consumed:false };
  challenges.set(challenge.challenge_id, challenge);
  log(null,"CREDENTIAL_IDENTIFIED",{ employee_id:person.employee_id, terminal_id:terminalId, credential_id:credential.credential_id });
  return { credential_id:credential.credential_id, technology:"DESFire EV3 (simulado)", employee:publicEmployee(person), challenge_id:challenge.challenge_id, challenge_expires_at:challenge.expires_at };
}

function verifyIdentity({ challengeId, faceMatch, liveness, terminalId = TERMINAL_ID }) {
  const challenge = challenges.get(String(challengeId || ""));
  if (!challenge || challenge.consumed || challenge.expires_at < Date.now()) throw new Error("AUTH_CHALLENGE_EXPIRED");
  if (challenge.terminal_id !== terminalId) throw new Error("TERMINAL_MISMATCH");
  if (faceMatch !== true || liveness !== true) throw new Error("BIOMETRIC_VERIFICATION_FAILED");
  challenge.consumed = true;
  const person = employee(challenge.employee_id);
  const auth = { auth_session_id:id("auth"), employee_id:person.employee_id, credential_id:challenge.credential_id, terminal_id:terminalId, auth_level:"STANDARD", factors:["DESFIRE","FACE_1_TO_1","PAD_LIVENESS"], expires_at:Date.now()+300000 };
  authSessions.set(auth.auth_session_id, auth);
  log(null,"IDENTITY_VERIFIED",{ auth_session_id:auth.auth_session_id, employee_id:person.employee_id, terminal_id:terminalId, factors:auth.factors });
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
function startAccessSession({ authSessionId, orderIds, terminalId = TERMINAL_ID }) {
  const auth = getAuth(authSessionId);
  if (!auth) throw new Error("AUTH_SESSION_EXPIRED");
  if (auth.terminal_id !== terminalId) throw new Error("TERMINAL_MISMATCH");
  const ids = [...new Set((orderIds || []).map(String).filter(Boolean))];
  if (!ids.length) throw new Error("ORDER_REQUIRED");
  const orders = ids.map(order);
  if (orders.some(x => !x || x.status !== "AGUARDANDO_RETIRADA")) throw new Error("ORDER_NOT_AVAILABLE");
  const sensitive = orders.some(hasSensitive);
  const person = employee(auth.employee_id);
  if (sensitive && !hasPermission(person,"stock.sensitive.access")) throw new Error("SENSITIVE_ACCESS_DENIED");
  const access = { access_session_id:id("acc"), auth_session_id:auth.auth_session_id, employee_id:auth.employee_id, credential_id:auth.credential_id, terminal_id:terminalId, order_ids:ids, sensitive_access:sensitive, state:"DOOR_AUTHORIZED", expires_at:Date.now()+1200000 };
  accessSessions.set(access.access_session_id, access);
  log(access,"ACCESS_SESSION_CREATED",{ order_ids:ids, sensitive_access:sensitive });
  log(access,"DOOR_AUTHORIZED",{ barrier_id:"STOCK_ROOM_DOOR" });
  return getAccessSessionDetail(access.access_session_id);
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
  return { ...access, employee:publicEmployee(employee(access.employee_id)), orders:access.order_ids.map(order).filter(Boolean).map(orderSummary), events:events.filter(x => x.access_session_id === access.access_session_id).slice().reverse() };
}
function registerAccessEvent({ accessSessionId, eventType, metadata = {} }) {
  const access = rawAccess(accessSessionId);
  if (!access) throw new Error("ACCESS_SESSION_NOT_FOUND");
  if (["CLOSED","EXPIRED"].includes(access.state)) throw new Error("ACCESS_SESSION_INACTIVE");
  const transitions = {
    DOOR_OPENED:["DOOR_AUTHORIZED","DOOR_OPEN"],
    ENTRY_CONFIRMED:["DOOR_OPEN","ENTRY_CONFIRMED"],
    DOOR_CLOSED:["ENTRY_CONFIRMED",access.sensitive_access?"SENSITIVE_CABINET_AUTHORIZED":"ACCESS_ACTIVE"],
    SENSITIVE_CABINET_OPENED:["SENSITIVE_CABINET_AUTHORIZED","SENSITIVE_CABINET_OPEN"],
    SENSITIVE_CABINET_CLOSED:["SENSITIVE_CABINET_OPEN","ACCESS_ACTIVE"],
    ACCESS_CLOSED:["ACCESS_ACTIVE","CLOSED"]
  };
  const transition = transitions[eventType];
  if (!transition || access.state !== transition[0]) throw new Error("INVALID_ACCESS_SEQUENCE");
  access.state = transition[1];
  if (eventType === "ENTRY_CONFIRMED") access.order_ids.map(order).filter(Boolean).forEach(x => { if (x.status === "AGUARDANDO_RETIRADA") x.status = "EM_SEPARACAO"; });
  if (eventType === "ACCESS_CLOSED") access.closed_at = now();
  log(access,eventType,metadata);
  return getAccessSessionDetail(access.access_session_id);
}
function listAudit() {
  return events.map(x => ({ ...x, employee:publicEmployee(employee(x.employee_id)) }));
}

module.exports = { TERMINAL_ID, identifyCredential, verifyIdentity, listPendingOrders, startAccessSession, registerAccessEvent, getAccessSessionDetail, listAudit };
