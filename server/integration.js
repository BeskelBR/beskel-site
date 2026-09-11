"use strict";

const store = require("./store");

class IntegrationAdapter {
  getPatients() { throw new Error("NOT_IMPLEMENTED"); }
  getActiveAttendances() { throw new Error("NOT_IMPLEMENTED"); }
  getAttendance(id) { throw new Error("NOT_IMPLEMENTED"); }
  getProducts() { throw new Error("NOT_IMPLEMENTED"); }
  getProduct(id) { throw new Error("NOT_IMPLEMENTED"); }
  registerConsumption(payload) { throw new Error("NOT_IMPLEMENTED"); }
}

class MockAdapter extends IntegrationAdapter {
  getPatients() { return store.patients; }
  getActiveAttendances() { return store.listActiveAttendances(); }
  getAttendance(id) { return store.getAttendanceDetail(id); }
  getProducts() { return store.listItems(); }
  getProduct(id) { return store.listItems().find(item => item.item_id === id) || null; }
  registerConsumption(payload) { return store.registerConsumption(payload); }
}

module.exports = { IntegrationAdapter, MockAdapter };
