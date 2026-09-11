"use strict";

const store = require("../server/store");
const { MockAdapter } = require("../server/integration");
const adapter = new MockAdapter();

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.end();
  }

  try {
    if (req.method === "GET") {
      const action = String(req.query?.action || "");
      if (action === "attendances") return send(res, 200, { ok: true, data: adapter.getActiveAttendances() });
      if (action === "attendance") return send(res, 200, { ok: true, data: adapter.getAttendance(req.query?.id) });
      if (action === "items") return send(res, 200, { ok: true, data: adapter.getProducts() });
      if (action === "item") return send(res, 200, { ok: true, data: adapter.getProduct(req.query?.id) });
      if (action === "audit") return send(res, 200, { ok: true, data: store.listAudit() });
      return send(res, 400, { ok: false, error: "INVALID_ACTION" });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const action = String(body.action || "");

      if (action === "auth") {
        const token = String(body.token || "");
        const credential = store.findCredentialByToken(token);
        if (!credential || credential.status !== "active") {
          return send(res, 401, { ok: false, error: "CREDENTIAL_NOT_RECOGNIZED" });
        }
        const employee = store.findEmployee(credential.employee_id);
        if (!employee || !employee.active) {
          return send(res, 401, { ok: false, error: "CREDENTIAL_NOT_RECOGNIZED" });
        }
        const session = store.createSession(credential);
        return send(res, 200, {
          ok: true,
          data: {
            session_id: session.session_id,
            expires_at: session.expires_at,
            credential_id: credential.credential_id,
            employee
          }
        });
      }

      if (action === "registerConsumption") {
        const session = store.getSession(String(body.session_id || ""));
        if (!session) return send(res, 401, { ok: false, error: "SESSION_EXPIRED" });
        const transaction = adapter.registerConsumption({
          session,
          attendanceId: body.attendance_id,
          itemId: body.item_id,
          quantity: Number(body.quantity),
          device: String(body.device || "iphone-demo")
        });
        return send(res, 200, { ok: true, data: transaction });
      }

      return send(res, 400, { ok: false, error: "INVALID_ACTION" });
    }

    return send(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    const known = ["ATTENDANCE_NOT_FOUND", "ITEM_NOT_FOUND", "INVALID_QUANTITY", "INSUFFICIENT_STOCK"];
    if (known.includes(error.message)) return send(res, 400, { ok: false, error: error.message });
    console.error(error);
    return send(res, 500, { ok: false, error: "INTERNAL_ERROR" });
  }
};
