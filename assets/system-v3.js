(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const patientHub = $("#patient-hub-results");
  const patientSearch = $("#patient-hub-search");
  const patientCount = $("#patient-hub-count");
  const refreshPatients = $("#refresh-patient-hub");
  const drawer = $("#clinical-drawer");
  const backdrop = $("#clinical-backdrop");
  const closeDrawer = $("#clinical-drawer-close");
  const patientName = $("#clinical-patient-name");
  const patientMeta = $("#clinical-patient-meta");
  const summary = $("#clinical-summary");
  const episodesNode = $("#clinical-episodes");
  const recordsNode = $("#clinical-records");
  const supportNode = $("#clinical-support");
  const episodeCount = $("#clinical-episode-count");
  const recordCount = $("#clinical-record-count");
  const episodeContext = $("#episode-context");
  const episodeContextTitle = $("#episode-context-title");
  const episodeContextBody = $("#episode-context-body");
  const episodeContextClose = $("#episode-context-close");

  if (!patientHub || !drawer) return;

  let patients = [];
  let loadedForToken = null;
  let selectedPatient = null;
  let patientCursor = null;
  let patientQuery = "";
  let patientSearchTimer = null;
  let patientRequestVersion = 0;

  const patientMore = document.createElement("button");
  patientMore.type = "button";
  patientMore.className = "secondary-btn";
  patientMore.textContent = "Carregar mais pacientes";
  patientMore.hidden = true;
  patientHub.insertAdjacentElement("afterend", patientMore);

  function apiBase() {
    return location.origin.replace(/\/$/, "");
  }

  function token() {
    return sessionStorage.getItem("hvb-session-view") || "";
  }

  function activeUnit() {
    return localStorage.getItem("hvb-unit-id") || "";
  }

  async function request(path) {
    const currentToken = token();
    if (!currentToken) throw Object.assign(new Error("sessao_ausente"), { status: 401 });
    const response = await window.HVBSession.fetch(`${apiBase()}${path}`, {
      headers: { Accept: "application/json" },
    });
    const body = (response.headers.get("content-type") || "").includes("application/json") ? await response.json() : null;
    if (!response.ok) throw Object.assign(new Error(body?.erro || `HTTP ${response.status}`), { status: response.status, payload: body });
    return body;
  }

  function empty(node, text) {
    node.replaceChildren();
    const box = document.createElement("div");
    box.className = "clinical-empty";
    box.textContent = text;
    node.append(box);
  }

  function loading(node, text = "Carregando contexto") {
    node.replaceChildren();
    const box = document.createElement("div");
    box.className = "clinical-loading";
    box.textContent = text;
    node.append(box);
  }

  function error(node, text) {
    node.replaceChildren();
    const box = document.createElement("div");
    box.className = "clinical-error";
    box.textContent = text;
    node.append(box);
  }

  function shortId(value) {
    return value ? `${String(value).slice(0, 8)}…` : "—";
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function metric(label, value) {
    const card = document.createElement("div");
    card.className = "clinical-summary-card";
    const name = document.createElement("span");
    name.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value ?? "—";
    card.append(name, strong);
    return card;
  }

  function renderPatients() {
    patientHub.replaceChildren();
    const suffix = patientCursor ? "+" : "";
    patientCount.textContent = patientQuery
      ? `${patients.length}${suffix} resultado(s) para “${patientQuery}”`
      : `${patients.length}${suffix} pacientes carregados`;
    patientMore.hidden = !patientCursor;

    if (!patients.length) {
      const box = document.createElement("div");
      box.className = "patient-hub-empty";
      box.textContent = patientQuery
        ? "Nenhum paciente corresponde à busca atual."
        : "Nenhum paciente disponível para esta credencial.";
      patientHub.append(box);
      return;
    }

    patients.forEach((patient) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "patient-card";
      const head = document.createElement("div");
      head.className = "patient-card-head";
      const identity = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = patient.nome || "Paciente sem nome";
      const species = document.createElement("small");
      species.textContent = [
        patient.especie_codigo || "Espécie não informada",
        patient.estado_vital || "Estado não informado",
      ].join(" • ");
      identity.append(name, species);
      const id = document.createElement("span");
      id.className = "patient-card-id";
      id.textContent = shortId(patient.id);
      head.append(identity);
      button.append(head, id);
      button.addEventListener("click", () => openPatient(patient));
      patientHub.append(button);
    });
  }

  async function loadPatients(force = false, more = false) {
    const currentToken = token();
    const query = (patientSearch.value || "").trim();

    if (!currentToken) {
      loadedForToken = null;
      patients = [];
      patientCursor = null;
      patientQuery = "";
      patientMore.hidden = true;
      patientCount.textContent = "Aguardando sessão";
      empty(
        patientHub,
        "Entre no sistema para consultar pacientes disponíveis à sua credencial.",
      );
      return;
    }

    if (
      !force &&
      !more &&
      loadedForToken === currentToken &&
      query === patientQuery &&
      patients.length
    )
      return;

    const version = ++patientRequestVersion;
    if (!more) {
      loading(
        patientHub,
        query ? "Buscando pacientes" : "Carregando pacientes disponíveis",
      );
      patientCount.textContent = "Consultando";
      patientMore.hidden = true;
    }

    const params = new URLSearchParams({ limit: "25" });
    if (query) params.set("q", query);
    if (more && patientCursor) params.set("cursor", patientCursor);

    try {
      const data = await request(`/v1/pacientes?${params}`);
      if (version !== patientRequestVersion || currentToken !== token()) return;
      const items = data?.items || [];
      patients = more
        ? [
            ...new Map(
              [...patients, ...items].map((patient) => [patient.id, patient]),
            ).values(),
          ]
        : items;
      patientCursor = data?.next_cursor || null;
      patientQuery = query;
      loadedForToken = currentToken;
      renderPatients();
    } catch (err) {
      if (version !== patientRequestVersion) return;
      if (!more) patients = [];
      patientCursor = null;
      loadedForToken = null;
      patientMore.hidden = true;
      patientCount.textContent = "Consulta indisponível";
      error(
        patientHub,
        err.status === 403
          ? "Seu perfil não possui acesso à lista de pacientes."
          : "Não foi possível carregar os pacientes neste momento.",
      );
    }
  }

  function openDrawer() {
    backdrop.hidden = false;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeClinicalDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    document.body.style.overflow = "";
    selectedPatient = null;
    episodeContext.hidden = true;
  }

  async function safeList(path) {
    try {
      const data = await request(path);
      return { ok: true, items: data?.items || [] };
    } catch (err) {
      return { ok: false, status: err.status, items: [] };
    }
  }

  async function openPatient(patient) {
    selectedPatient = patient;
    openDrawer();
    episodeContext.hidden = true;
    patientName.textContent = patient.nome || "Paciente";
    patientMeta.textContent = `${patient.especie_codigo || "Espécie não informada"} • ID ${shortId(patient.id)}`;
    summary.replaceChildren(metric("Estado", patient.estado_vital || "Não informado"), metric("Cadastro", formatDate(patient.criado_em)), metric("Identificador", shortId(patient.id)));
    loading(episodesNode, "Carregando episódios");
    loading(recordsNode, "Carregando prontuário");
    loading(supportNode, "Carregando vínculos clínicos");
    episodeCount.textContent = "…";
    recordCount.textContent = "…";

    const unit = activeUnit();
    if (!unit) {
      error(episodesNode, "Defina a unidade hospitalar DEV para consultar episódios e contexto clínico.");
      error(recordsNode, "Unidade hospitalar não definida.");
      empty(supportNode, "O contexto longitudinal depende da unidade hospitalar ativa.");
      return;
    }

    const qUnit = encodeURIComponent(unit);
    const qPatient = encodeURIComponent(patient.id);
    const [episodes, records, preventive, documents] = await Promise.all([
      safeList(`/v1/episodios?limit=100&unidade_id=${qUnit}&paciente_id=${qPatient}`),
      safeList(`/v1/prontuario/evolucoes?limit=100&unidade_id=${qUnit}&paciente_id=${qPatient}`),
      safeList(`/v1/protocolos/adesoes?limit=100&unidade_id=${qUnit}&paciente_id=${qPatient}`),
      safeList(`/v1/documentos/solicitacoes?limit=100&unidade_id=${qUnit}&paciente_id=${qPatient}`),
    ]);

    renderEpisodes(episodes);
    renderRecords(records);
    renderSupport(preventive, documents);
  }

  function renderEpisodes(result) {
    episodeCount.textContent = String(result.items.length);
    if (!result.ok) {
      error(episodesNode, result.status === 403 ? "Seu perfil não possui acesso aos episódios deste paciente." : "Não foi possível consultar episódios.");
      return;
    }
    if (!result.items.length) {
      empty(episodesNode, "Nenhum episódio encontrado para este paciente na unidade ativa.");
      return;
    }
    episodesNode.replaceChildren();
    result.items.forEach((episode) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "clinical-item clinical-item-button";
      const head = document.createElement("div");
      head.className = "clinical-item-head";
      const strong = document.createElement("strong");
      strong.textContent = episode.tipo || "Episódio assistencial";
      const state = document.createElement("small");
      state.textContent = episode.encerrado_em ? "Encerrado" : episode.alta_clinica_em ? "Alta clínica" : "Ativo";
      head.append(strong, state);
      const info = document.createElement("p");
      info.textContent = `Admissão ${formatDate(episode.admitido_em)} • ${shortId(episode.id)}`;
      button.append(head, info);
      button.addEventListener("click", () => openEpisode(episode));
      episodesNode.append(button);
    });
  }

  function renderRecords(result) {
    recordCount.textContent = String(result.items.length);
    if (!result.ok) {
      error(recordsNode, result.status === 403 ? "Prontuário não liberado para este perfil." : "Não foi possível consultar o prontuário.");
      return;
    }
    if (!result.items.length) {
      empty(recordsNode, "Nenhuma evolução registrada para este paciente.");
      return;
    }
    recordsNode.replaceChildren();
    result.items.slice(0, 12).forEach((record) => {
      const item = document.createElement("div");
      item.className = "clinical-item";
      const head = document.createElement("div");
      head.className = "clinical-item-head";
      const strong = document.createElement("strong");
      strong.textContent = record.tipo || "Evolução clínica";
      const date = document.createElement("small");
      date.textContent = formatDate(record.criada_em || record.ocorrida_em);
      head.append(strong, date);
      const info = document.createElement("p");
      info.textContent = record.referencia || `Evolução ${shortId(record.id)}`;
      item.append(head, info);
      recordsNode.append(item);
    });
  }

  function renderSupport(preventive, documents) {
    supportNode.replaceChildren();
    const p = document.createElement("div");
    p.className = "support-metric";
    const pLabel = document.createElement("span");
    pLabel.textContent = preventive.ok ? "Adesões preventivas" : "Preventivo sem acesso";
    const pValue = document.createElement("strong");
    pValue.textContent = preventive.ok ? String(preventive.items.length) : "—";
    p.append(pLabel, pValue);
    const d = document.createElement("div");
    d.className = "support-metric";
    const dLabel = document.createElement("span");
    dLabel.textContent = documents.ok ? "Solicitações documentais" : "Documentos sem acesso";
    const dValue = document.createElement("strong");
    dValue.textContent = documents.ok ? String(documents.items.length) : "—";
    d.append(dLabel, dValue);
    supportNode.append(p, d);
  }

  async function openEpisode(episode) {
    episodeContext.hidden = false;
    episodeContextTitle.textContent = `${episode.tipo || "Episódio"} • ${shortId(episode.id)}`;
    loading(episodeContextBody, "Carregando contexto operacional do episódio");
    const unit = activeUnit();
    if (!unit) {
      error(episodeContextBody, "Unidade hospitalar não definida.");
      return;
    }
    const qUnit = encodeURIComponent(unit);
    const qEpisode = encodeURIComponent(episode.id);
    const [programming, executions, exams, billing] = await Promise.all([
      safeList(`/v1/clinica/programacoes?limit=25&unidade_id=${qUnit}&episodio_id=${qEpisode}`),
      safeList(`/v1/clinica/execucoes?limit=25&unidade_id=${qUnit}&episodio_id=${qEpisode}`),
      safeList(`/v1/exames/solicitacoes?limit=25&unidade_id=${qUnit}&episodio_id=${qEpisode}`),
      safeList(`/v1/financeiro/contas?limit=25&unidade_id=${qUnit}&episodio_id=${qEpisode}`),
    ]);
    episodeContextBody.replaceChildren();
    episodeContextBody.append(
      episodeBlock("Programações", programming, (x) => `${formatDate(x.prevista_em)} • ${x.situacao || x.estado_execucao || shortId(x.id)}`),
      episodeBlock("Execuções", executions, (x) => `${formatDate(x.executada_em)} • ${x.resultado || x.situacao_material || shortId(x.id)}`),
      episodeBlock("Exames solicitados", exams, (x) => `${formatDate(x.solicitada_em)} • ${x.referencia || shortId(x.id)}`),
      episodeBlock("Contas do episódio", billing, (x) => `${x.descricao || "Conta"} • ${shortId(x.id)}`),
    );
    episodeContext.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function episodeBlock(title, result, formatter) {
    const block = document.createElement("div");
    block.className = "episode-block";
    const heading = document.createElement("h4");
    heading.textContent = title;
    block.append(heading);
    if (!result.ok) {
      const note = document.createElement("div");
      note.className = "clinical-empty";
      note.textContent = result.status === 403 ? "Sem permissão para esta visão." : "Consulta indisponível.";
      block.append(note);
      return block;
    }
    if (!result.items.length) {
      const note = document.createElement("div");
      note.className = "clinical-empty";
      note.textContent = "Sem registros.";
      block.append(note);
      return block;
    }
    const list = document.createElement("ul");
    result.items.slice(0, 8).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = formatter(item);
      list.append(li);
    });
    block.append(list);
    return block;
  }

  patientSearch.addEventListener("input", () => {
    patientMore.hidden = true;
    clearTimeout(patientSearchTimer);
    patientSearchTimer = setTimeout(() => loadPatients(true, false), 250);
  });
  refreshPatients.addEventListener("click", () => loadPatients(true, false));
  patientMore.addEventListener("click", () => loadPatients(true, true));
  closeDrawer.addEventListener("click", closeClinicalDrawer);
  backdrop.addEventListener("click", closeClinicalDrawer);
  episodeContextClose.addEventListener("click", () => { episodeContext.hidden = true; });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && drawer.classList.contains("open")) closeClinicalDrawer(); });

  const app = document.querySelector('[data-view="app"]');
  const observer = new MutationObserver(() => {
    if (!app.hidden && token()) loadPatients(false);
    if (app.hidden) closeClinicalDrawer();
  });
  observer.observe(app, { attributes: true, attributeFilter: ["hidden"] });
  if (!app.hidden && token()) loadPatients(false);
})();