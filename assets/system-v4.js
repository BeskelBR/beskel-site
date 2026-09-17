(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const refresh = $("#refresh-operations");
  const agendaCount = $("#ops-agenda-count");
  const agendaState = $("#ops-agenda-state");
  const agendaList = $("#ops-agenda-list");
  const episodeCount = $("#ops-episode-count");
  const episodeState = $("#ops-episode-state");
  const episodeList = $("#ops-episode-list");
  const pendingCount = $("#ops-pending-count");
  const pendingState = $("#ops-pending-state");
  const pendingList = $("#ops-pending-list");

  if (!refresh || !agendaList || !episodeList || !pendingList) return;

  let lastToken = "";
  let lastUnit = "";
  let loading = false;

  function apiBase() {
    return (localStorage.getItem("hvb-api-base") || location.origin).replace(/\/$/, "");
  }

  function token() {
    return sessionStorage.getItem("hvb-access-token") || "";
  }

  function unit() {
    return localStorage.getItem("hvb-unit-id") || "";
  }

  async function request(path) {
    const currentToken = token();
    if (!currentToken) throw Object.assign(new Error("sessao_ausente"), { status: 401 });
    const response = await fetch(`${apiBase()}${path}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${currentToken}` },
    });
    const type = response.headers.get("content-type") || "";
    const body = type.includes("application/json") ? await response.json() : null;
    if (!response.ok) throw Object.assign(new Error(body?.erro || `HTTP ${response.status}`), { status: response.status, payload: body });
    return body;
  }

  async function safe(path) {
    try {
      const data = await request(path);
      return { ok: true, items: data?.items || [], next: data?.next_cursor || null };
    } catch (error) {
      return { ok: false, status: error.status || 0, items: [], next: null };
    }
  }

  function localDayRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  function shortId(value) {
    return value ? `${String(value).slice(0, 8)}…` : "—";
  }

  function dateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function timeOnly(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function clearState(node) {
    node.classList.remove("ops-state-good", "ops-state-warn", "ops-state-bad");
  }

  function setMetric(countNode, stateNode, result, successText, emptyText) {
    clearState(stateNode);
    if (!result.ok) {
      countNode.textContent = "—";
      if (result.status === 403) {
        stateNode.textContent = "Sem permissão para esta leitura";
      } else if (result.status === 401) {
        stateNode.textContent = "Sessão necessária";
      } else {
        stateNode.textContent = "Consulta indisponível";
      }
      stateNode.classList.add("ops-state-bad");
      return;
    }
    countNode.textContent = result.next ? `${result.items.length}+` : String(result.items.length);
    stateNode.textContent = result.items.length ? successText : emptyText;
    stateNode.classList.add(result.items.length ? "ops-state-good" : "ops-state-warn");
  }

  function renderError(node, result, fallback) {
    node.replaceChildren();
    const box = document.createElement("div");
    box.className = result.status === 403 ? "ops-empty" : "ops-error";
    box.textContent = result.status === 403 ? "Esta visão não está liberada para o perfil atual." : fallback;
    node.append(box);
  }

  function renderEmpty(node, text) {
    node.replaceChildren();
    const box = document.createElement("div");
    box.className = "ops-empty";
    box.textContent = text;
    node.append(box);
  }

  function item(title, line, meta) {
    const box = document.createElement("div");
    box.className = "ops-item";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const span = document.createElement("span");
    span.textContent = line;
    const small = document.createElement("small");
    small.textContent = meta;
    box.append(strong, span, small);
    return box;
  }

  function renderAgenda(result) {
    if (!result.ok) return renderError(agendaList, result, "Não foi possível carregar a agenda de hoje.");
    if (!result.items.length) return renderEmpty(agendaList, "Nenhum agendamento encontrado para hoje.");
    agendaList.replaceChildren();
    [...result.items]
      .sort((a, b) => String(a.inicio || "").localeCompare(String(b.inicio || "")))
      .slice(0, 6)
      .forEach((entry) => {
        agendaList.append(item(
          `${timeOnly(entry.inicio)} — ${entry.tipo || "Atendimento"}`,
          entry.situacao || entry.referencia || "Agendamento",
          `Paciente ${shortId(entry.paciente_id)} • até ${timeOnly(entry.fim)}`,
        ));
      });
  }

  function renderEpisodes(result) {
    if (!result.ok) return renderError(episodeList, result, "Não foi possível carregar os episódios ativos.");
    if (!result.items.length) return renderEmpty(episodeList, "Nenhum episódio ativo encontrado.");
    episodeList.replaceChildren();
    [...result.items]
      .sort((a, b) => String(b.admitido_em || "").localeCompare(String(a.admitido_em || "")))
      .slice(0, 6)
      .forEach((entry) => {
        episodeList.append(item(
          entry.tipo || "Episódio assistencial",
          `Paciente ${shortId(entry.paciente_id)}`,
          `Admitido em ${dateTime(entry.admitido_em)} • ${shortId(entry.id)}`,
        ));
      });
  }

  function renderPending(result) {
    if (!result.ok) return renderError(pendingList, result, "Não foi possível carregar as pendências clínicas.");
    if (!result.items.length) return renderEmpty(pendingList, "Nenhuma pendência clínica aberta encontrada.");
    pendingList.replaceChildren();
    [...result.items]
      .sort((a, b) => String(b.criada_em || "").localeCompare(String(a.criada_em || "")))
      .slice(0, 6)
      .forEach((entry) => {
        pendingList.append(item(
          entry.tipo ? entry.tipo.replaceAll("_", " ") : "Pendência clínica",
          entry.descricao || "Revisão clínica necessária",
          `${dateTime(entry.criada_em)} • ${shortId(entry.id)}`,
        ));
      });
  }

  function waiting() {
    agendaCount.textContent = episodeCount.textContent = pendingCount.textContent = "—";
    agendaState.textContent = episodeState.textContent = pendingState.textContent = "Aguardando sessão";
    clearState(agendaState); clearState(episodeState); clearState(pendingState);
    renderEmpty(agendaList, "Entre no sistema para consultar a agenda.");
    renderEmpty(episodeList, "Entre no sistema para consultar internações.");
    renderEmpty(pendingList, "Entre no sistema para consultar pendências.");
  }

  async function load(force = false) {
    if (loading) return;
    const currentToken = token();
    const currentUnit = unit();
    if (!currentToken) {
      lastToken = "";
      lastUnit = "";
      waiting();
      return;
    }
    if (!currentUnit) {
      agendaCount.textContent = episodeCount.textContent = pendingCount.textContent = "—";
      agendaState.textContent = episodeState.textContent = pendingState.textContent = "Unidade DEV não definida";
      renderEmpty(agendaList, "Defina a unidade hospitalar na configuração DEV.");
      renderEmpty(episodeList, "Defina a unidade hospitalar na configuração DEV.");
      renderEmpty(pendingList, "Defina a unidade hospitalar na configuração DEV.");
      return;
    }
    if (!force && currentToken === lastToken && currentUnit === lastUnit) return;

    loading = true;
    refresh.disabled = true;
    refresh.textContent = "Atualizando…";
    const range = localDayRange();
    const qUnit = encodeURIComponent(currentUnit);
    try {
      const [agenda, episodes, pending] = await Promise.all([
        safe(`/v1/agenda/mapa?limit=100&unidade_id=${qUnit}&inicio=${encodeURIComponent(range.start)}&fim=${encodeURIComponent(range.end)}`),
        safe(`/v1/episodios?limit=100&unidade_id=${qUnit}&ativos=true`),
        safe(`/v1/clinica/pendencias?limit=100&unidade_id=${qUnit}&situacao=aberta`),
      ]);
      setMetric(agendaCount, agendaState, agenda, "Agendamentos carregados", "Sem agenda no período");
      setMetric(episodeCount, episodeState, episodes, "Episódios em andamento", "Sem episódios ativos");
      setMetric(pendingCount, pendingState, pending, "Pendências abertas", "Sem pendências abertas");
      renderAgenda(agenda);
      renderEpisodes(episodes);
      renderPending(pending);
      lastToken = currentToken;
      lastUnit = currentUnit;
    } finally {
      loading = false;
      refresh.disabled = false;
      refresh.textContent = "Atualizar painel";
    }
  }

  refresh.addEventListener("click", () => load(true));
  window.addEventListener("focus", () => load(false));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(false); });

  const observer = new MutationObserver(() => {
    const app = document.querySelector('[data-view="app"]');
    if (app && !app.hidden) load(false);
  });
  const app = document.querySelector('[data-view="app"]');
  if (app) observer.observe(app, { attributes: true, attributeFilter: ["hidden"] });

  setTimeout(() => load(false), 250);
})();
