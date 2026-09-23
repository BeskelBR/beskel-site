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
    return location.origin.replace(/\/$/, "");
  }

  function token() {
    return sessionStorage.getItem("hvb-session-view") || "";
  }

  function unit() {
    return localStorage.getItem("hvb-unit-id") || "";
  }

  async function request(path) {
    const currentToken = token();
    if (!currentToken) throw Object.assign(new Error("sessao_ausente"), { status: 401 });
    const response = await window.HVBSession.fetch(`${apiBase()}${path}`, {
      headers: { Accept: "application/json" },
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

(() => {
  "use strict";

  const detailView = document.querySelector('[data-module-view="detail"]');
  const detailLayout = detailView?.querySelector('.detail-layout');
  const pageTitle = document.querySelector('#page-title');
  if (!detailView || !detailLayout || !pageTitle) return;

  const panel = document.createElement('section');
  panel.id = 'module-journey-panel';
  panel.className = 'module-journey-panel';
  panel.hidden = true;
  detailLayout.before(panel);

  let renderSequence = 0;

  const apiBase = () => location.origin.replace(/\/$/, '');
  const token = () => sessionStorage.getItem('hvb-session-view') || '';
  const unit = () => localStorage.getItem('hvb-unit-id') || '';
  const shortId = (value) => value ? `${String(value).slice(0, 8)}…` : '—';
  const timeOnly = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
  };
  const dateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  };

  async function request(path) {
    const response = await window.HVBSession.fetch(`${apiBase()}${path}`, {
      headers: { Accept: 'application/json' },
    });
    const type = response.headers.get('content-type') || '';
    const body = type.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw Object.assign(new Error(body?.erro || `HTTP ${response.status}`), { status: response.status });
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

  function dayRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  function shell(eyebrow, title, description) {
    panel.replaceChildren();
    const head = document.createElement('div');
    head.className = 'journey-head';
    const copy = document.createElement('div');
    const e = document.createElement('span'); e.className = 'eyebrow'; e.textContent = eyebrow;
    const h = document.createElement('h3'); h.textContent = title;
    const p = document.createElement('p'); p.textContent = description;
    copy.append(e, h, p);
    const refresh = document.createElement('button');
    refresh.type = 'button'; refresh.className = 'secondary-btn journey-refresh'; refresh.textContent = 'Atualizar jornada';
    head.append(copy, refresh);
    const body = document.createElement('div'); body.className = 'journey-body';
    panel.append(head, body);
    return { body, refresh };
  }

  function message(body, text, kind = '') {
    body.replaceChildren();
    const box = document.createElement('div');
    box.className = `journey-message ${kind}`.trim();
    box.textContent = text;
    body.append(box);
  }

  function metric(label, value, note) {
    const box = document.createElement('article'); box.className = 'journey-metric';
    const l = document.createElement('span'); l.textContent = label;
    const v = document.createElement('strong'); v.textContent = value;
    const n = document.createElement('small'); n.textContent = note;
    box.append(l, v, n); return box;
  }

  function card(title, lines = []) {
    const box = document.createElement('article'); box.className = 'journey-card';
    const h = document.createElement('strong'); h.textContent = title; box.append(h);
    lines.filter(Boolean).forEach((text) => { const p = document.createElement('span'); p.textContent = text; box.append(p); });
    return box;
  }

  function currentModule() {
    const active = document.querySelector('.nav-item.active');
    return active?.dataset.module || '';
  }

  async function renderAgendaJourney(forceSequence) {
    const currentUnit = unit();
    const view = shell('Jornada de agenda', 'Mapa diário por recurso', 'Consolidação de horários, recursos e alocações já registradas no backend. Nenhum estado é alterado nesta visão.');
    view.refresh.addEventListener('click', () => renderForModule('agenda'));
    if (!token()) return message(view.body, 'Entre no sistema para carregar a jornada da agenda.');
    if (!currentUnit) return message(view.body, 'Defina a unidade hospitalar DEV para consultar a agenda.', 'warn');
    message(view.body, 'Carregando agenda do dia…');
    const range = dayRange();
    const qUnit = encodeURIComponent(currentUnit);
    const [map, allocations, resources] = await Promise.all([
      safe(`/v1/agenda/mapa?limit=100&unidade_id=${qUnit}&inicio=${encodeURIComponent(range.start)}&fim=${encodeURIComponent(range.end)}`),
      safe(`/v1/agenda/alocacoes?limit=100&unidade_id=${qUnit}`),
      safe(`/v1/agenda/recursos?limit=100&unidade_id=${qUnit}`),
    ]);
    if (forceSequence !== renderSequence || currentModule() !== 'agenda') return;
    if (!map.ok) return message(view.body, map.status === 403 ? 'Seu perfil não possui permissão para visualizar a agenda.' : 'Não foi possível carregar o mapa da agenda.', 'error');

    const resourceNames = new Map(resources.items.map((r) => [r.id, r.nome || r.tipo || shortId(r.id)]));
    const byVersion = new Map();
    allocations.items.forEach((a) => {
      if (!byVersion.has(a.agendamento_versao_id)) byVersion.set(a.agendamento_versao_id, []);
      byVersion.get(a.agendamento_versao_id).push(resourceNames.get(a.recurso_id) || shortId(a.recurso_id));
    });

    view.body.replaceChildren();
    const metrics = document.createElement('div'); metrics.className = 'journey-metrics';
    const scheduled = map.items.length;
    const inReview = map.items.filter((x) => x.necessita_revisao).length;
    const resourcesUsed = new Set(allocations.items.filter((a) => map.items.some((m) => m.id === a.agendamento_versao_id)).map((a) => a.recurso_id)).size;
    metrics.append(
      metric('Agendamentos hoje', map.next ? `${scheduled}+` : String(scheduled), 'Mapa da unidade ativa'),
      metric('Recursos envolvidos', String(resourcesUsed), resources.ok ? 'Alocações identificadas' : 'Leitura parcial'),
      metric('Revisão necessária', String(inReview), inReview ? 'Há itens que exigem atenção' : 'Sem sinalização no período'),
    );
    view.body.append(metrics);

    const timeline = document.createElement('div'); timeline.className = 'journey-timeline';
    if (!map.items.length) {
      const empty = document.createElement('div'); empty.className = 'journey-message'; empty.textContent = 'Nenhum agendamento encontrado para hoje.'; timeline.append(empty);
    } else {
      [...map.items].sort((a,b) => String(a.inicio || '').localeCompare(String(b.inicio || ''))).forEach((entry) => {
        const resourcesForEntry = byVersion.get(entry.id) || [];
        timeline.append(card(
          `${timeOnly(entry.inicio)}–${timeOnly(entry.fim)} • ${entry.tipo || 'Atendimento'}`,
          [
            entry.situacao || entry.referencia || 'Agendamento',
            `Paciente ${shortId(entry.paciente_id)}`,
            resourcesForEntry.length ? `Recursos: ${resourcesForEntry.join(', ')}` : 'Sem recurso identificado nesta leitura',
          ],
        ));
      });
    }
    view.body.append(timeline);
  }

  async function renderInternmentJourney(forceSequence) {
    const currentUnit = unit();
    const view = shell('Jornada de internação', 'Ocupação e atenção clínica', 'Visão contextual dos episódios ativos, ocupações físicas e pendências abertas da unidade.');
    view.refresh.addEventListener('click', () => renderForModule('internacao'));
    if (!token()) return message(view.body, 'Entre no sistema para carregar a jornada de internação.');
    if (!currentUnit) return message(view.body, 'Defina a unidade hospitalar DEV para consultar a internação.', 'warn');
    message(view.body, 'Carregando internação…');
    const qUnit = encodeURIComponent(currentUnit);
    const [episodes, occupations, places, pending, programming] = await Promise.all([
      safe(`/v1/episodios?limit=100&unidade_id=${qUnit}&ativos=true`),
      safe(`/v1/ocupacoes?limit=100&unidade_id=${qUnit}`),
      safe(`/v1/locais?limit=100&unidade_id=${qUnit}`),
      safe(`/v1/clinica/pendencias?limit=100&unidade_id=${qUnit}&situacao=aberta`),
      safe(`/v1/clinica/programacoes?limit=100&unidade_id=${qUnit}`),
    ]);
    if (forceSequence !== renderSequence || currentModule() !== 'internacao') return;
    if (!episodes.ok) return message(view.body, episodes.status === 403 ? 'Seu perfil não possui permissão para visualizar episódios ativos.' : 'Não foi possível carregar os episódios ativos.', 'error');

    const placeNames = new Map(places.items.map((p) => [p.id, p.nome || p.tipo || shortId(p.id)]));
    const activeOccupations = occupations.items.filter((o) => !o.fim);
    const occupancyByEpisode = new Map(activeOccupations.map((o) => [o.episodio_id, o]));
    const pendingByEpisode = new Map();
    pending.items.forEach((p) => {
      const episodeId = p.episodio_id;
      if (!episodeId) return;
      pendingByEpisode.set(episodeId, (pendingByEpisode.get(episodeId) || 0) + 1);
    });
    const programmingByEpisode = new Map();
    programming.items.forEach((p) => {
      if (!p.episodio_id) return;
      programmingByEpisode.set(p.episodio_id, (programmingByEpisode.get(p.episodio_id) || 0) + 1);
    });

    view.body.replaceChildren();
    const metrics = document.createElement('div'); metrics.className = 'journey-metrics';
    metrics.append(
      metric('Episódios ativos', episodes.next ? `${episodes.items.length}+` : String(episodes.items.length), 'Na unidade ativa'),
      metric('Ocupações abertas', occupations.ok ? String(activeOccupations.length) : '—', occupations.ok ? 'Posições físicas identificadas' : 'Sem acesso à ocupação'),
      metric('Pendências abertas', pending.ok ? (pending.next ? `${pending.items.length}+` : String(pending.items.length)) : '—', pending.ok ? 'Leitura clínica consolidada' : 'Sem acesso às pendências'),
    );
    view.body.append(metrics);

    const grid = document.createElement('div'); grid.className = 'journey-internment-grid';
    if (!episodes.items.length) {
      const empty = document.createElement('div'); empty.className = 'journey-message'; empty.textContent = 'Nenhum episódio ativo encontrado.'; grid.append(empty);
    } else {
      [...episodes.items].sort((a,b) => String(b.admitido_em || '').localeCompare(String(a.admitido_em || ''))).forEach((episode) => {
        const occupation = occupancyByEpisode.get(episode.id);
        const location = occupation ? (placeNames.get(occupation.local_id) || shortId(occupation.local_id)) : 'Sem ocupação aberta identificada';
        const pendingCount = pendingByEpisode.get(episode.id) || 0;
        const programmingCount = programmingByEpisode.get(episode.id) || 0;
        grid.append(card(
          episode.tipo || 'Episódio assistencial',
          [
            `Paciente ${shortId(episode.paciente_id)} • admissão ${dateTime(episode.admitido_em)}`,
            `Local: ${location}${occupation?.vaga ? ` • vaga ${occupation.vaga}` : ''}`,
            `${programmingCount} programações • ${pendingCount} pendências vinculadas`,
          ],
        ));
      });
    }
    view.body.append(grid);
  }

  function renderForModule(module = currentModule()) {
    renderSequence += 1;
    const sequence = renderSequence;
    if (module !== 'agenda' && module !== 'internacao') {
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }
    panel.hidden = false;
    if (module === 'agenda') renderAgendaJourney(sequence);
    else renderInternmentJourney(sequence);
  }

  const titleObserver = new MutationObserver(() => renderForModule());
  titleObserver.observe(pageTitle, { childList: true, characterData: true, subtree: true });
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-module],[data-go]');
    if (!target) return;
    const module = target.dataset.module || target.dataset.go;
    setTimeout(() => renderForModule(module), 0);
  });

  setTimeout(() => renderForModule(), 350);
})();