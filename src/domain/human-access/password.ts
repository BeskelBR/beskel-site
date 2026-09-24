import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import { DomainError } from "../core.ts";

// PHC v19, KiB. No configurable downgrade and no SHA-256 password fallback.
export const argonPolicy = Object.freeze({
  memory: 19456,
  passes: 2,
  parallelism: 1,
  tagLength: 32,
  saltLength: 16,
});
const prefix = "$argon2id$v=19$m=19456,t=2,p=1$";

export function validatePassword(value: string) {
  const size = [...value].length;
  if (size < 15 || size > 128 || Buffer.byteLength(value, "utf8") > 512)
    throw new DomainError(400, "politica_senha_invalida");
}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  const message = Buffer.from(password, "utf8");
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      argon2(
        "argon2id",
        {
          message,
          nonce: salt,
          memory: argonPolicy.memory,
          passes: argonPolicy.passes,
          parallelism: argonPolicy.parallelism,
          tagLength: argonPolicy.tagLength,
        },
        (error, result) => {
          // Never propagate library exceptions that might carry input material.
          if (error) reject(new DomainError(503, "hash_senha_indisponivel"));
          else resolve(result);
        },
      );
    });
  } catch {
    throw new DomainError(503, "hash_senha_indisponivel");
  } finally {
    message.fill(0);
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(argonPolicy.saltLength);
  const result = await derive(password, salt);
  try {
    return `${prefix}${salt.toString("base64").replace(/=+$/, "")}$${result.toString("base64").replace(/=+$/, "")}`;
  } finally {
    result.fill(0);
  }
}

export async function verifyPassword(
  password: string,
  phc: string,
): Promise<boolean> {
  // Bound costs/format before calling native crypto; only this policy is enabled.
  if (Buffer.byteLength(password, "utf8") > 512 || [...password].length > 128)
    return false;
  if (!phc.startsWith(prefix)) return false;
  const match = phc
    .slice(prefix.length)
    .match(/^([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/);
  if (!match?.[1] || !match[2]) return false;
  const salt = Buffer.from(match[1], "base64"),
    expected = Buffer.from(match[2], "base64");
  if (
    salt.toString("base64").replace(/=+$/, "") !== match[1] ||
    expected.toString("base64").replace(/=+$/, "") !== match[2]
  )
    return false;
  const actual = await derive(password, salt);
  try {
    return timingSafeEqual(actual, expected);
  } finally {
    actual.fill(0);
    expected.fill(0);
  }
}

export function temporaryPassword(): string {
  const bytes = randomBytes(24); // 192 bits; not a CPF, NFC tag or API credential.
  try {
    return bytes.toString("base64url");
  } finally {
    bytes.fill(0);
  }
}
