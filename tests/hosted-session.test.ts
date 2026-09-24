import test from "node:test";
import assert from "node:assert/strict";
import {
  clearHostedCookie,
  createHostedSession,
  deriveHostedSessionKey,
  hostedCookie,
  openHostedSession,
  readHostedCookie,
} from "../scripts/hosted-session.ts";

test("hosted session keeps bearer encrypted and HttpOnly/Secure", () => {
  const token = "a".repeat(64);
  const key = deriveHostedSessionKey(
    "postgresql://runtime:synthetic-secret@db.example.invalid/hvb",
  );
  const session = createHostedSession(token, 1_000);
  const cookie = hostedCookie(session, key, 1_000);
  assert.match(cookie, /^hvb_pilot_session=v1\./);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.doesNotMatch(cookie, new RegExp(token));

  const value = readHostedCookie(cookie);
  const opened = openHostedSession(value, key, 1_001);
  assert.equal(opened?.token, token);
  assert.equal(opened?.view, session.view);
});

test("hosted session rejects tamper, idle expiry and absolute expiry", () => {
  const key = deriveHostedSessionKey("synthetic-material-for-session-tests");
  const session = createHostedSession("b".repeat(64), 10_000);
  const cookie = hostedCookie(session, key, 10_000);
  const value = readHostedCookie(cookie);
  assert.ok(value);
  assert.equal(openHostedSession(`${value}x`, key, 10_001), null);
  assert.equal(openHostedSession(value, key, session.last + 15 * 60_000 + 1), null);
  assert.equal(openHostedSession(value, key, session.expires + 1), null);
});

test("hosted session clear cookie preserves secure attributes", () => {
  const cookie = clearHostedCookie();
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
});
