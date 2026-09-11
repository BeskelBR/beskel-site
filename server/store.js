"use strict";

const crypto = require("crypto");

const employees = [
  { employee_id: "emp_001", name: "Rafael Teste", role: "Direção", active: true },
  { employee_id: "emp_002", name: "Marina Teste", role: "Médica Veterinária", active: true },
  { employee_id: "emp_003", name: "Carlos Teste", role: "Enfermagem", active: true }
];

const credentials = [
  { credential_id: "cred_001", token: "hvb_demo_Q7m4xP9nK2", employee_id: "emp_001", status: "active" },
  { credential_id: "cred_002", token: "hvb_demo_T8r2vL6pW5", employee_id: "emp_002", status: "active" },
  { credential_id: "cred_003", token: "hvb_demo_H3n9cM4yR7", employee_id: "emp_003", status: "active" },
  { credential_id: "cred_004", token: "hvb_demo_revoked_K4u8sP2", employee_id: "emp_003", status: "revoked" }
];

const patients = [
  { patient_id: "pat_001", name: "Thor", species: "Cão", tutor: "João Teste" },
  { patient_id: "pat_002", name: "Luna", species: "Gato", tutor: "Maria Teste" },
  { patient_id: "pat_003", name: "Mel", species: "Cão", tutor: "Ana Teste" },
  { patient_id: "pat_004", name: "Nino", species: "Gato", tutor: "Paulo Teste" }
];

const attendances = [
  { attendance_id: "1842", patient_id: "pat_001", status: "active", opened_at: "2026-09-11T10:10:00-03:00" },
  { attendance_id: "1845", patient_id: "pat_002", status: "active", opened_at: "2026-09-11T10:44:00-03:00" },
  { attendance_id: "1851", patient_id: "pat_003", status: "active", opened_at: "2026-09-11T11:28:00-03:00" },
  { attendance_id: "1853", patient_id: "pat_004", status: "active", opened_at: "2026-09-11T12:04:00-03:00" }
];

const items = [
  { item_id: "itm_001", sku: "MAT-CAT22", description: "Cateter 22G", initial_stock: 47, unit: "un.", unit_price: 18.90, category: "Acesso vascular" },
  { item_id: "itm_002", sku: "MAT-SER05", description: "Seringa 5 mL", initial_stock: 120, unit: "un.", unit_price: 3.40, category: "Insumos" },
  { item_id: "itm_003", sku: "MAT-EQP01", description: "Equipo macrogotas", initial_stock: 65, unit: "un.", unit_price: 9.80, category: "Infusão" },
  { item_id: "itm_004", sku: "MAT-GAZ01", description: "Gaze estéril", initial_stock: 210, unit: "pct.", unit_price: 4.25, category: "Curativos" },
  { item_id: "itm_005", sku: "MAT-LUV01", description: "Luva cirúrgica", initial_stock: 84, unit: "par", unit_price: 6.90, category: "Cirúrgico" },
  { item_id: "itm_006", sku: "MAT-SOR500", description: "Soro fisiológico 500 mL", initial_stock: 33, unit: "fr.", unit_price: 12.50, category: "Fluidoterapia" },
  { item_id: "itm_007", sku: "MAT-AGU25", description: "Agulha 25 x 7", initial_stock: 180, unit: "un.", unit_price: 1.35, category: "Insumos" },
  { item_id: "itm_008", sku: "MAT-CUR10", description: "Curativo adesivo 10 cm", initial_stock: 52, unit: "un.", unit_price: 7.60, category: "Curativos" },
  { item_id: "itm_009", sku: "MAT-CAT24", description: "Cateter 24G", initial_stock: 39, unit: "un.", unit_price: 18.90, category: "Acesso vascular" }
];

const transactions = [];
const sessions = new Map();

function findEmployee(id) { return employees.find(e => e.employee_id === id); }
function findCredentialByToken(token) { return credentials.find(c => c.token === token); }
function findPatient(id) { return patients.find(p => p.patient_id === id); }
function findAttendance(id) { return attendances.find(a => a.attendance_id === String(id)); }
function findItem(id) { return items.find(i => i.item_id === id); }

function getStock(itemId) {
  const item = findItem(itemId);
  if (!item) return 0;
  const consumed = transactions
    .filter(t => t.item_id === itemId && t.status === "confirmed")
    .reduce((sum, t) => sum + t.quantity, 0);
  return item.initial_stock - consumed;
}

function createSession(credential) {
  const id = `sess_${crypto.randomBytes(16).toString("hex")}`;
  const expiresAt = Date.now() + 15 * 60 * 1000;
  sessions.set(id, { session_id: id, employee_id: credential.employee_id, credential_id: credential.credential_id, expires_at: expiresAt });
  return sessions.get(id);
}

function getSession(id) {
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return session;
}

function listActiveAttendances() {
  return attendances.filter(a => a.status === "active").map(a => ({
    ...a,
    patient: findPatient(a.patient_id)
  }));
}

function getAttendanceDetail(id) {
  const attendance = findAttendance(id);
  if (!attendance) return null;
  return {
    ...attendance,
    patient: findPatient(attendance.patient_id),
    transactions: transactions.filter(t => t.attendance_id === attendance.attendance_id && t.status === "confirmed")
  };
}

function listItems() {
  return items.map(item => ({ ...item, current_stock: getStock(item.item_id) }));
}

function registerConsumption({ session, attendanceId, itemId, quantity, device }) {
  const attendance = findAttendance(attendanceId);
  const item = findItem(itemId);
  if (!attendance || attendance.status !== "active") throw new Error("ATTENDANCE_NOT_FOUND");
  if (!item) throw new Error("ITEM_NOT_FOUND");
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) throw new Error("INVALID_QUANTITY");
  const previous = getStock(itemId);
  if (qty > previous) throw new Error("INSUFFICIENT_STOCK");

  const transaction = {
    transaction_id: `txn_${crypto.randomBytes(8).toString("hex")}`,
    timestamp: new Date().toISOString(),
    employee_id: session.employee_id,
    credential_id: session.credential_id,
    patient_id: attendance.patient_id,
    attendance_id: attendance.attendance_id,
    item_id: item.item_id,
    quantity: qty,
    unit_price: item.unit_price,
    total: Number((item.unit_price * qty).toFixed(2)),
    previous_stock: previous,
    resulting_stock: previous - qty,
    device_session: device || "web-terminal",
    status: "confirmed"
  };
  transactions.unshift(transaction);
  return transaction;
}

function listAudit() {
  return transactions.map(t => ({
    ...t,
    employee: findEmployee(t.employee_id),
    patient: findPatient(t.patient_id),
    item: findItem(t.item_id)
  }));
}

module.exports = {
  employees,
  credentials,
  patients,
  attendances,
  items,
  transactions,
  findEmployee,
  findCredentialByToken,
  createSession,
  getSession,
  listActiveAttendances,
  getAttendanceDetail,
  listItems,
  findItem,
  registerConsumption,
  listAudit
};
