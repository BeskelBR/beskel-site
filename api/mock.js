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

function normalizeDemoToken(token) {
  if (token === "hvb_demo_Q7m4xP9nK2") return "demo-rafael";
  return token;
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
      if (action === "terminal") return send(res, 200, { ok:true, data:adapter.getTerminalDescriptor(String(req.query?.terminal_id || store.TERMINAL_ID)) });
      return send(res, 400, { ok:false, error:"INVALID_ACTION" });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const action = String(body.action || "");

      if (action === "identifyCredential") {
        const token = normalizeDemoToken(String(body.token || ""));
        return send(res, 200, { ok:true, data:adapter.identifyCredential(token, String(body.terminal_id || store.TERMINAL_ID)) });
      }

      if (action === "createBiometricEvidence") {
        return send(res, 200, { ok:true, data:adapter.createBiometricEvidence({
          challengeId:String(body.challenge_id || ""),
          faceMatch:body.face_match === true,
          liveness:body.liveness === true,
          terminalId:String(body.terminal_id || store.TERMINAL_ID),
          deviceId:String(body.device_id || store.BIOMETRIC_DEVICE_ID)
        }) });
      }

      if (action === "verifyIdentity") {
        return send(res, 200, { ok:true, data:adapter.verifyIdentity({
          challengeId:String(body.challenge_id || ""),
          evidenceId:String(body.evidence_id || ""),
          terminalId:String(body.terminal_id || store.TERMINAL_ID)
        }) });
      }

      if (action === "startAccessSession") {
        return send(res, 200, { ok:true, data:adapter.startAccessSession({
          authSessionId:String(body.auth_session_id || ""),
          orderIds:Array.isArray(body.order_ids) ? body.order_ids : [],
          liveItems:Array.isArray(body.live_items) ? body.live_items : [],
          terminalId:String(body.terminal_id || store.TERMINAL_ID),
          commandId:String(body.command_id || "")
        }) });
      }

      if (action === "registerAccessEvent") {
        return send(res, 200, { ok:true, data:adapter.registerAccessEvent({
          accessSessionId:String(body.access_session_id || ""),
          eventType:String(body.event_type || ""),
          metadata:body.metadata && typeof body.metadata === "object" ? body.metadata : {},
          commandId:String(body.command_id || ""),
          sourceOccurredAt:String(body.source_occurred_at || ""),
          sourceDeviceId:String(body.source_device_id || "")
        }) });
      }

      if (action === "registerPickingEvent") {
        return send(res, 200, { ok:true, data:adapter.registerPickingEvent({
          accessSessionId:String(body.access_session_id || ""),
          eventType:String(body.event_type || ""),
          metadata:body.metadata && typeof body.metadata === "object" ? body.metadata : {},
          commandId:String(body.command_id || ""),
          sourceDeviceId:String(body.source_device_id || store.PICKING_DISPLAY_ID)
        }) });
      }

      if (action === "confirmWithdrawal") {
        return send(res, 200, { ok:true, data:adapter.confirmWithdrawal({
          accessSessionId:String(body.access_session_id || ""),
          results:Array.isArray(body.results) ? body.results : [],
          commandId:String(body.command_id || ""),
          sourceDeviceId:String(body.source_device_id || store.PICKING_DISPLAY_ID)
        }) });
      }

      return send(res, 400, { ok:false, error:"INVALID_ACTION" });
    }

    return send(res, 405, { ok:false, error:"METHOD_NOT_ALLOWED" });
  } catch (error) {
    const known = [
      "CREDENTIAL_NOT_RECOGNIZED","ACCESS_NOT_PERMITTED","AUTH_CHALLENGE_EXPIRED",
      "AUTH_EVIDENCE_EXPIRED","AUTH_EVIDENCE_MISMATCH","AUTH_EVIDENCE_UNTRUSTED",
      "BIOMETRIC_VERIFICATION_FAILED","AUTH_SESSION_EXPIRED","TERMINAL_MISMATCH",
      "UNTRUSTED_TERMINAL","UNTRUSTED_DEVICE","COMMAND_ID_REQUIRED","IDEMPOTENCY_CONFLICT",
      "ORDER_REQUIRED","ORDER_NOT_AVAILABLE","LIVE_ITEM_INVALID","SENSITIVE_ACCESS_DENIED",
      "ACCESS_SESSION_NOT_FOUND","ACCESS_SESSION_INACTIVE","INVALID_ACCESS_SEQUENCE",
      "INVALID_PICKING_EVENT","PICKING_NOT_ACTIVE","PICKING_GROUP_INVALID","PICKING_LOCATION_INVALID","PICKING_QUANTITY_INVALID",
      "WITHDRAWAL_NOT_READY","WITHDRAWAL_RESULTS_INCOMPLETE","WITHDRAWAL_RESULTS_MISMATCH"
    ];
    if (known.includes(error.message)) return send(res, 400, { ok:false, error:error.message });
    console.error(error);
    return send(res, 500, { ok:false, error:"INTERNAL_ERROR" });
  }
};
