import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Vercel gateway keeps session and API same-origin", async () => {
  const [gateway, config] = await Promise.all([
    readFile(new URL("../api/gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);
  const vercel = JSON.parse(config);
  assert.ok(
    vercel.rewrites.some(
      (item) =>
        item.source === "/session" &&
        item.destination === "/api/gateway?hvb_path=/session",
    ),
  );
  assert.ok(
    vercel.rewrites.some(
      (item) =>
        item.source === "/v1/:path*" &&
        item.destination === "/api/gateway?hvb_path=/v1/:path*",
    ),
  );
  assert.equal(
    vercel.functions?.["api/gateway.ts"]?.includeFiles,
    "{src/**,scripts/hosted-session.ts}",
  );
  assert.match(gateway, /hvb-sistema-dev\.beskel\.com\.br/);
  assert.match(gateway, /Secure/);
  assert.match(gateway, /SameSite=Strict/);
  assert.match(gateway, /HttpOnly/);
  assert.match(gateway, /headers\.authorization = `Bearer \$\{token\}`/);
  assert.doesNotMatch(gateway, /localStorage|sessionStorage|indexedDB/);
});

test("Vercel gateway preserves DEV-only database constraints", async () => {
  const gateway = await readFile(
    new URL("../api/gateway.ts", import.meta.url),
    "utf8",
  );
  assert.match(gateway, /HVB_DATABASE_MODE: "remote-dev"/);
  assert.match(gateway, /HVB_DATABASE_TLS: "verify-full"/);
  assert.match(gateway, /HVB_DATABASE_CONNECTION:/);
  assert.match(gateway, /process\.env\.DATABASE_URL/);
  assert.doesNotMatch(gateway, /rejectUnauthorized\s*:\s*false/);
  assert.doesNotMatch(gateway, /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*"0"/);
});

test("hosted gateway does not create browser bearer or human login", async () => {
  const gateway = await readFile(
    new URL("../api/gateway.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(gateway, /\/v1\/login|\/auth\/exchange|Supabase Auth/i);
  assert.match(gateway, /clearHostedCookie/);
  assert.match(gateway, /X-HVB-Session-Reset/);
});
