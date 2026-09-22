import { createHmac, timingSafeEqual } from "node:crypto";
import { canonical, DomainError } from "../core.ts";
export type V1Claims = {
  challenge_id: string;
  nonce: string;
  employee_id: string;
  access_terminal_device_id: string;
  biometric_device_id: string;
  captured_at: string;
  expires_at: string;
  face_match: true;
  liveness: true;
  mode: "SIMULADO_DEV";
};
export type V1EvidenceAdapter = {
  mode: "SIMULADO_DEV";
  verify(envelope: string): V1Claims;
};
// Deliberately not installed by server.ts. Tests/local demonstrations inject it explicitly.
export function createV1DevAdapter(secret: Buffer) {
  if (secret.length < 32) throw new Error("segredo_simulador_insuficiente");
  const mac = (payload: string) =>
    createHmac("sha256", secret).update(payload).digest();
  return {
    sign(claims: V1Claims) {
      const payload = Buffer.from(canonical(claims)).toString("base64url");
      return `${payload}.${mac(payload).toString("base64url")}`;
    },
    adapter: {
      mode: "SIMULADO_DEV" as const,
      verify(envelope: string): V1Claims {
        try {
          const [payload, signature, extra] = envelope.split(".");
          if (!payload || !signature || extra) throw new Error();
          const supplied = Buffer.from(signature, "base64url"),
            expected = mac(payload);
          if (
            supplied.length !== expected.length ||
            !timingSafeEqual(supplied, expected)
          )
            throw new Error();
          const c = JSON.parse(
            Buffer.from(payload, "base64url").toString("utf8"),
          );
          if (
            c.mode !== "SIMULADO_DEV" ||
            c.face_match !== true ||
            c.liveness !== true
          )
            throw new Error();
          return c;
        } catch {
          throw new DomainError(403, "tv1_evidencia_invalida");
        }
      },
    } satisfies V1EvidenceAdapter,
  };
}
