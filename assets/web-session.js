(() => {
  // Purge the old bearer storage. Only a public context version may remain.
  sessionStorage.removeItem("hvb-access-token");
  localStorage.removeItem("hvb-api-base");
  sessionStorage.removeItem("hvb-session-view");
  window.HVBSession = {
    async fetch(input, options = {}) {
      const url = new URL(input, location.origin);
      if (url.origin !== location.origin)
        throw new Error("origem_da_sessao_invalida");
      const headers = new Headers(options.headers);
      headers.delete("Authorization");
      const view = sessionStorage.getItem("hvb-session-view");
      if (view) headers.set("X-HVB-View", view);
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: "same-origin",
        redirect: "error",
        signal: options.signal || AbortSignal.timeout(15000),
      });
      if (
        url.pathname.startsWith("/v1/") &&
        view !== sessionStorage.getItem("hvb-session-view")
      )
        throw new Error("resposta_de_sessao_anterior_descartada");
      if (
        url.pathname.startsWith("/v1/") &&
        (response.status === 401 ||
          response.headers.get("x-hvb-session-reset") === "1")
      ) {
        sessionStorage.removeItem("hvb-session-view");
        window.dispatchEvent(new Event("hvb-session-ended"));
      }
      return response;
    },
    async restore() {
      const response = await this.fetch("/session");
      if (!response.ok)
        throw Object.assign(new Error("sessao_expirada"), {
          status: response.status,
        });
      const body = await response.json();
      sessionStorage.setItem("hvb-session-view", body.view_id);
      return body;
    },
    async login(token) {
      const response = await this.fetch("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok)
        throw Object.assign(new Error("entrada_recusada"), {
          status: response.status,
        });
      const body = await response.json();
      sessionStorage.setItem("hvb-session-view", body.view_id);
    },
    async logout() {
      const response = await this.fetch("/session", { method: "DELETE" });
      if (!response.ok) throw new Error("saida_nao_confirmada");
      sessionStorage.removeItem("hvb-session-view");
      window.dispatchEvent(new Event("hvb-session-ended"));
    },
  };
})();
