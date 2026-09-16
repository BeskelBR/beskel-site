"use strict";

const { MockAdapter } = require("../server/integration");
const store = require("../server/store");
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
      if (action === "pendingOrders") return send(res, 200, { ok:true, data:adapter.getPendingOrders(String(req.query?.auth_session_id || "")) });
      if (action === "accessSession") return send(res, 200, { ok:true, data:adapter.getAccessSession(String(req.query?.id || "")) });
      if (action === "audit") return send(res, 200, { ok:true, data:adapter.listAudit() });
      if (action === "terminal") return send(res, 200, { ok:true, data:{ terminal_id:store.TERMINAL_ID, mode:"ACCESS_TERMINAL_V2", simulated_hardware:true } });
      return send(res, 400, { ok:false, error:"INVALID_ACTION" });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const action = String(body.action || "");

      if (action === "identifyCredential") {
        return send(res, 200, { ok:true, data:adapter.identifyCredential(String(body.token || ""), String(body.terminal_id || store.TERMINAL_ID)) });
      }
      if (action === "verifyIdentity") {
        return send(res, 200, { ok:true, data:adapter.verifyIdentity({
          challengeId:String(body.challenge_id || ""),
          faceMatch:body.face_match === true,
          liveness:body.liveness === true,
          terminalId:String(body.terminal_id || store.TERMINAL_ID)
        }) });
      }
      if (action === "startAccessSession") {
        return send(res, 200, { ok:true, data:adapter.startAccessSession({
          authSessionId:String(body.auth_session_id || ""),
          orderIds:Array.isArray(body.order_ids) ? body.order_ids : [],
          terminalId:String(body.terminal_id || store.TERMINAL_ID)
        }) });
      }
      if (action === "registerAccessEvent") {
        return send(res, 200, { ok:true, data:adapter.registerAccessEvent({
          accessSessionId:String(body.access_session_id || ""),
          eventType:String(body.event_type || ""),
          metadata:body.metadata && typeof body.metadata === "object" ? body.metadata : {}
        }) });
      }
      return send(res, 400, { ok:false, error:"INVALID_ACTION" });
    }

    return send(res, 405, { ok:false, error:"METHOD_NOT_ALLOWED" });
  } catch (error) {
    const known = [
      "CREDENTIAL_NOT_RECOGNIZED","ACCESS_NOT_PERMITTED","AUTH_CHALLENGE_EXPIRED",
      "BIOMETRIC_VERIFICATION_FAILED","AUTH_SESSION_EXPIRED","TERMINAL_MISMATCH",
      "ORDER_REQUIRED","ORDER_NOT_AVAILABLE","SENSITIVE_ACCESS_DENIED",
      "ACCESS_SESSION_NOT_FOUND","ACCESS_SESSION_INACTIVE","INVALID_ACCESS_SEQUENCE"
    ];
    if (known.includes(error.message)) return send(res, 400, { ok:false, error:error.message });
    console.error(error);
    return send(res, 500, { ok:false, error:"INTERNAL_ERROR" });
  }
};
