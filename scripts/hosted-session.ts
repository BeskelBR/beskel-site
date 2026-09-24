import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

export const hostedCookieName = "hvb_pilot_session";
export const hostedIdleMs = 15 * 60_000;
export const hostedLifetimeMs = 60 * 60_000;

export type HostedSession = {
  token: string;
  view: string;
  expires: number;
  last: number;
};

function b64url(value: Buffer): string {
  return value.toString("base64url");
}

function fromB64url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function deriveHostedSessionKey(material: string): Buffer {
  if (!material || material.length < 16)
    throw new Error("material_de_sessao_dev_ausente");
  return createHash("sha256")
    .update("hvb-web-session-dev-v1\0", "utf8")
    .update(material, "utf8")
    .digest();
}

export function createHostedSession(
  token: string,
  now = Date.now(),
): HostedSession {
  return {
    token,
    view: randomUUID(),
    expires: now + hostedLifetimeMs,
    last: now,
  };
}

export function sealHostedSession(
  session: HostedSession,
  key: Buffer,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("hvb_pilot_session:v1", "utf8"));
  const plaintext = Buffer.from(JSON.stringify(session), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", b64url(iv), b64url(encrypted), b64url(tag)].join(".");
}

export function openHostedSession(
  value: string | undefined,
  key: Buffer,
  now = Date.now(),
): HostedSession | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const iv = fromB64url(parts[1] ?? "");
    const encrypted = fromB64url(parts[2] ?? "");
    const tag = fromB64url(parts[3] ?? "");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from("hvb_pilot_session:v1", "utf8"));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as Partial<HostedSession>;
    if (
      typeof parsed.token !== "string" ||
      !/^[a-f0-9]{64}$/.test(parsed.token) ||
      typeof parsed.view !== "string" ||
      typeof parsed.expires !== "number" ||
      typeof parsed.last !== "number" ||
      parsed.expires <= now ||
      parsed.last + hostedIdleMs <= now
    )
      return null;
    return parsed as HostedSession;
  } catch {
    return null;
  }
}

export function readHostedCookie(
  cookieHeader: string | undefined,
): string | undefined {
  return cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${hostedCookieName}=`))
    ?.slice(hostedCookieName.length + 1);
}

export function hostedCookie(
  session: HostedSession,
  key: Buffer,
  now = Date.now(),
): string {
  const remaining = Math.max(0, Math.ceil((session.expires - now) / 1000));
  return `${hostedCookieName}=${sealHostedSession(session, key)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${remaining}`;
}

export function clearHostedCookie(): string {
  return `${hostedCookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
