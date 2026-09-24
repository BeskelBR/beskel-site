import { DomainError } from "../core.ts";
import { hashPassword, temporaryPassword } from "./password.ts";

export type TemporaryIssue = { id: string; email: string; expiresAt: Date };
export type TemporaryPasswordMailer = {
  // Provider adapter must not log, persist or enqueue the secret in HVB.
  send(
    input: TemporaryIssue & { password: string },
  ): Promise<{ accepted: boolean }>;
};
export type TemporaryPasswordPersistence = {
  // Must commit the 077 issue operation before resolving. PHC only.
  issue(phc: string): Promise<TemporaryIssue>;
  // Called only after explicit acceptance by the configured email provider.
  confirmSent(id: string): Promise<void>;
};

// Internal orchestration boundary, not an HTTP endpoint or generic outbox job.
// SQL binding remains blocked by the canonical 077 conformance findings.
export async function deliverTemporaryPassword(
  persistence: TemporaryPasswordPersistence,
  mailer?: TemporaryPasswordMailer,
): Promise<{ id: string; sent: true }> {
  if (!mailer) throw new DomainError(503, "email_humano_nao_configurado");
  let password = temporaryPassword();
  try {
    const issued = await persistence.issue(await hashPassword(password));
    const delivery = await mailer.send({ ...issued, password });
    if (!delivery.accepted) throw new Error("not accepted");
    await persistence.confirmSent(issued.id);
    return { id: issued.id, sent: true };
  } catch {
    // Includes ambiguous provider/DB outcomes: never mark sent or blindly retry.
    throw new DomainError(503, "envio_senha_nao_confirmado");
  } finally {
    password = ""; // JS strings cannot be reliably wiped; never retain the value.
  }
}
