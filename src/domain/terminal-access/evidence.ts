import { createHmac, timingSafeEqual } from "node:crypto";
import { DomainError } from "../core.ts";

// Boundary for a future attested local biometric adapter. No HTTP/UI flag is trusted.
export type Challenge = {
  id: string;
  nonce: string;
  organizacao_id: string;
  unidade_id: string;
  autor_id: string;
  credencial_id: string;
  dispositivo_id: string;
  criada_em: Date;
  expira_em: Date;
};
export type VerifiedEvidence = {
  desafio_id: string;
  nonce: string;
  usuario_id: string;
  terminal_id: string;
  dispositivo_biometrico_id: string;
  capturada_em: string;
  expira_em: string;
  face_match: true;
  liveness: true;
  identity_claim: true;
  engine: string;
  versao: string;
  modo: "SIMULADO_DEV";
};
export interface TerminalEvidenceAdapter {
  mode: "SIMULADO_DEV";
  verify(envelope: string, challenge: Challenge): Promise<VerifiedEvidence>;
}

// Only scripts/tests install this explicitly; the HTTP server has no signing endpoint.
export function createDevEvidenceAdapter(secret: Buffer) {
  if (secret.length < 32) throw new Error("Chave DEV insuficiente");
  const sign = (claims: VerifiedEvidence) => {
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
  };
  const adapter: TerminalEvidenceAdapter = {
    mode: "SIMULADO_DEV",
    async verify(envelope) {
      const parts = envelope.split(".");
      const payload = parts[0] ?? "",
        signature = parts[1] ?? "";
      const expected = createHmac("sha256", secret).update(payload).digest();
      if (
        parts.length !== 2 ||
        !/^[a-f0-9]{64}$/.test(signature) ||
        !timingSafeEqual(expected, Buffer.from(signature, "hex"))
      )
        throw new DomainError(403, "evidencia_nao_autenticada");
      try {
        return JSON.parse(
          Buffer.from(payload, "base64url").toString(),
        ) as VerifiedEvidence;
      } catch {
        throw new DomainError(400, "evidencia_invalida");
      }
    },
  };
  return { adapter, sign };
}
