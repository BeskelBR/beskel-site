"use strict";

const store = require("./store");

class IntegrationAdapter {
  identifyCredential() { throw new Error("NOT_IMPLEMENTED"); }
  verifyIdentity() { throw new Error("NOT_IMPLEMENTED"); }
  getPendingOrders() { throw new Error("NOT_IMPLEMENTED"); }
  startAccessSession() { throw new Error("NOT_IMPLEMENTED"); }
  registerAccessEvent() { throw new Error("NOT_IMPLEMENTED"); }
  getAccessSession() { throw new Error("NOT_IMPLEMENTED"); }
  listAudit() { throw new Error("NOT_IMPLEMENTED"); }
}

class MockAdapter extends IntegrationAdapter {
  identifyCredential(token, terminalId) {
    return store.identifyCredential(token, terminalId);
  }

  verifyIdentity(payload) {
    return store.verifyIdentity(payload);
  }

  getPendingOrders(authSessionId) {
    return store.listPendingOrders(authSessionId);
  }

  startAccessSession(payload) {
    return store.startAccessSession(payload);
  }

  registerAccessEvent(payload) {
    return store.registerAccessEvent(payload);
  }

  getAccessSession(accessSessionId) {
    return store.getAccessSessionDetail(accessSessionId);
  }

  listAudit() {
    return store.listAudit();
  }
}

module.exports = { IntegrationAdapter, MockAdapter };
