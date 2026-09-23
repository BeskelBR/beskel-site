// One immutable request per human intent. Ambiguous outcomes retain the same key.
export function createPilotClient({ base, token, fetcher = fetch }) {
  async function request(path, options = {}) {
    const response = await fetcher(`${base}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body) {
      throw Object.assign(new Error(body?.erro || "resposta_indisponivel"), {
        status: response.status,
        uncertain:
          response.status >= 500 || response.ok || response.status === 408,
      });
    }
    return body;
  }
  return {
    read: request,
    prepare(path, body) {
      return Object.freeze({
        path,
        body: JSON.stringify(body),
        key: crypto.randomUUID(),
      });
    },
    async send(intent) {
      const result = await request(intent.path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": intent.key,
        },
        body: intent.body,
      });
      if (result.estado !== "confirmado" || !result.id) {
        throw Object.assign(new Error("confirmacao_indisponivel"), {
          uncertain: true,
        });
      }
      return result;
    },
  };
}

export function pilotError(error) {
  if (error.status === 401)
    return "Sessão inválida ou expirada. Entre novamente.";
  if (error.status === 403)
    return "Sua credencial não permite esta ação neste contexto.";
  if (error.status === 409)
    return `Conflito: ${error.message.replaceAll("_", " ")}. Confira o contexto antes de tentar novamente.`;
  if (error.status === 400 || error.status === 422)
    return `Revise os campos e horários: ${error.message.replaceAll("_", " ")}.`;
  return "Não foi possível confirmar a resposta da API. Verifique a conexão.";
}
