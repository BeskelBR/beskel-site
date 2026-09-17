(() => {
  "use strict";

  const modules = {
    pacientes: {
      title: "Pacientes",
      eyebrow: "Cadastro e relacionamento",
      description: "Pacientes, responsáveis, vínculos e episódios assistenciais em uma visão única.",
      next: "Evoluir para busca unificada, cadastro assistido e abertura de episódio sem duplicar dados.",
      endpoint: "/v1/pacientes?limit=25",
    },
    agenda: {
      title: "Agenda",
      eyebrow: "Recursos e horários",
      description: "Agendamentos, disponibilidade de recursos, equipes e transições operacionais.",
      next: "Construir mapa diário/semanal por equipe, recurso e ambiente após validar o fluxo final do hospital.",
      endpoint: "/v1/agenda/agendamentos?limit=25",
      unit: true,
    },
    internacao: {
      title: "Internação",
      eyebrow: "Episódios e ocupação",
      description: "Acompanhamento de episódios, ocupações, programações e regras configuráveis de diária.",
      next: "Consolidar mapa de leitos, passagem de plantão e pendências por paciente sem antecipar regras ainda abertas.",
      endpoint: "/v1/episodios?limit=25&ativos=true",
      unit: true,
    },
    prontuario: {
      title: "Prontuário",
      eyebrow: "Linha do tempo clínica",
      description: "Evoluções versionadas, autoria, correções e histórico longitudinal do paciente.",
      next: "Projetar a leitura clínica por contexto e as ações de evolução/retificação conforme permissões de cargo.",
    },
    estoque: {
      title: "Estoque",
      eyebrow: "Rastreabilidade física",
      description: "Posições, lotes, reservas, entradas, transferências, retiradas, devoluções e inventário.",
      next: "Conectar as rotinas administrativas às ações físicas do Terminal HVB e às permissões por cargo.",
      endpoint: "/v1/estoque/posicoes?limit=25",
      unit: true,
    },
    exames: {
      title: "Exames",
      eyebrow: "Solicitações e resultados",
      description: "Solicitações, coletas, avaliação de amostras, resultados estruturados e correções versionadas.",
      next: "Desenhar filas de coleta/liberação e leitura de resultados sem interpretação clínica automática.",
      endpoint: "/v1/exames/resultados?limit=25",
      unit: true,
    },
    financeiro: {
      title: "Financeiro",
      eyebrow: "Recebimentos e conciliação",
      description: "Títulos, recebimentos, liquidações, créditos, caixa e conciliação financeira.",
      next: "Organizar visões de contas, recebimentos, conciliação e indicadores depois da validação operacional.",
      endpoint: "/v1/financeiro/titulos?limit=25",
      unit: true,
    },
    compras: {
      title: "Compras",
      eyebrow: "Fornecedores e aquisição",
      description: "Pedidos, recebimentos, preços negociados, obrigações e custo analítico de aquisição.",
      next: "Fechar o ciclo de compra com documentos fiscais, créditos/devoluções e aprovações internas.",
    },
    documentos: {
      title: "Documentos",
      eyebrow: "Modelos e autorizações",
      description: "Modelos versionados, conteúdo privado, aprovações, declarações e entregas registradas.",
      next: "Definir quais documentos exigem assinatura válida e quais fluxos podem permanecer declaratórios.",
    },
    preventivo: {
      title: "Preventivo",
      eyebrow: "Protocolos e recorrência",
      description: "Protocolos versionados, adesão, recorrência, aplicações internas/externas e revisão de atrasos.",
      next: "Transformar os contratos do backend em jornadas simples de adesão, aplicação e acompanhamento.",
    },
    administracao: {
      title: "Administração",
      eyebrow: "Acesso e governança",
      description: "Usuários, papéis, permissões, unidades, dispositivos e credenciais do ecossistema HVB.",
      next: "Aplicar a matriz de cargos validada com Rafael e liberar somente as funcionalidades correspondentes.",
      endpoint: "/v1/unidades?limit=25",
    },
  };

  const authView = document.querySelector('[data-view="auth"]');
  const appView = document.querySelector('[data-view="app"]');
  const loginForm = document.getElementById("login-form");
  const tokenInput = document.getElementById("access-token");
  const apiInput = document.getElementById("api-base");
  const feedback = document.getElementById("auth-feedback");
  const apiStatus = document.getElementById("api-status");
  const healthCard = document.getElementById("health-card");
  const readyCard = document.getElementById("ready-card");
  const orgName = document.getElementById("org-name");
  const actorId = document.getElementById("actor-id");
  const pageTitle = document.getElementById("page-title");
  const sidebar = document.getElementById("sidebar");
  const menuBtn = document.getElementById("menu-btn");
  const moduleGrid = document.getElementById("module-grid");
  const detailTitle = document.getElementById("detail-title");
  const detailEyebrow = document.getElementById("detail-eyebrow");
  const detailDescription = document.getElementById("detail-description");
  const detailNext = document.getElementById("detail-next");
  const moduleContent = document.getElementById("module-content");
  const refreshModule = document.getElementById("refresh-module");

  const localDefault = ["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://127.0.0.1:3100"
    : location.origin;
  let apiBase = localStorage.getItem("hvb-api-base") || localDefault;
  let token = sessionStorage.getItem("hvb-access-token") || "";
  let actor = null;
  let organization = null;
  let activeUnit = null;
  let activeModule = "dashboard";

  apiInput.value = apiBase;

  function normalizeBase(value) {
    return (value || localDefault).trim().replace(/\/$/, "");
  }

  async function request(path, options = {}, auth = true) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (auth && token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${apiBase}${path}`, { ...options, headers });
    const type = response.headers.get("content-type") || "";
    const body = type.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      const error = new Error(body?.erro || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = body;
      throw error;
    }
    return body;
  }

  function setFeedback(message, kind = "") {
    feedback.textContent = message || "";
    feedback.className = `auth-feedback ${kind}`.trim();
  }

  async function checkInfrastructure() {
    try {
      const health = await request("/health", {}, false);
      const ok = health?.status === "ok";
      apiStatus.textContent = ok ? "API online" : "API instável";
      apiStatus.className = `api-status ${ok ? "ok" : "error"}`;
      healthCard.textContent = ok ? "Online" : "Instável";
    } catch {
      apiStatus.textContent = "API indisponível";
      apiStatus.className = "api-status error";
      healthCard.textContent = "Indisponível";
    }
    try {
      const ready = await request("/ready", {}, false);
      readyCard.textContent = ready?.status === "ready" ? "Pronto" : "Pendente";
    } catch {
      readyCard.textContent = "Pendente";
    }
  }

  async function loadContext() {
    actor = await request("/v1/me");
    try {
      organization = await request("/v1/organizacao");
    } catch {
      organization = { nome: "Hospital Veterinário Brasília" };
    }
    try {
      const units = await request("/v1/unidades?limit=10");
      activeUnit = units?.items?.[0]?.id || null;
    } catch {
      activeUnit = null;
    }
  }

  function showApp() {
    authView.hidden = true;
    appView.hidden = false;
    orgName.textContent = organization?.nome || "HVB";
    actorId.textContent = actor?.usuario_id ? `Usuário ${actor.usuario_id.slice(0, 8)}…` : "Sessão autenticada";
    renderModuleGrid();
    navigate("dashboard");
    checkInfrastructure();
  }

  function showAuth() {
    appView.hidden = true;
    authView.hidden = false;
  }

  async function authenticate(candidate) {
    token = candidate;
    sessionStorage.setItem("hvb-access-token", token);
    await loadContext();
    showApp();
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = loginForm.querySelector('button[type="submit"]');
    const candidate = tokenInput.value.trim().toLowerCase();
    apiBase = normalizeBase(apiInput.value);
    localStorage.setItem("hvb-api-base", apiBase);
    if (!/^[a-f0-9]{64}$/.test(candidate)) {
      setFeedback("A credencial DEV deve conter exatamente 64 caracteres hexadecimais.", "error");
      return;
    }
    submit.disabled = true;
    setFeedback("Validando credencial…");
    try {
      await authenticate(candidate);
      setFeedback("");
    } catch (error) {
      sessionStorage.removeItem("hvb-access-token");
      token = "";
      if (error.status === 401) setFeedback("Credencial inválida, revogada ou expirada.", "error");
      else if (error.status === 403) setFeedback("A credencial é válida, mas não possui acesso a este ambiente.", "error");
      else setFeedback("Não foi possível conectar ao backend configurado. Verifique o endereço da API.", "error");
    } finally {
      submit.disabled = false;
    }
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("hvb-access-token");
    token = "";
    actor = null;
    showAuth();
    tokenInput.value = "";
  });

  menuBtn.addEventListener("click", () => {
    const open = sidebar.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.module));
  });
  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.go));
  });

  function renderModuleGrid() {
    moduleGrid.replaceChildren();
    Object.entries(modules).forEach(([key, item]) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "module-card";
      const title = document.createElement("strong");
      title.textContent = item.title;
      const description = document.createElement("p");
      description.textContent = item.description;
      const state = document.createElement("span");
      state.textContent = "Backend disponível • UI em integração";
      card.append(title, description, state);
      card.addEventListener("click", () => navigate(key));
      moduleGrid.append(card);
    });
  }

  function navigate(module) {
    activeModule = module || "dashboard";
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.module === activeModule);
    });
    const dashboard = document.querySelector('[data-module-view="dashboard"]');
    const detail = document.querySelector('[data-module-view="detail"]');
    if (activeModule === "dashboard") {
      dashboard.hidden = false;
      detail.hidden = true;
      pageTitle.textContent = "Visão geral";
    } else {
      dashboard.hidden = true;
      detail.hidden = false;
      const item = modules[activeModule];
      pageTitle.textContent = item.title;
      detailTitle.textContent = item.title;
      detailEyebrow.textContent = item.eyebrow;
      detailDescription.textContent = item.description;
      detailNext.textContent = item.next;
      loadModule(activeModule);
    }
    sidebar.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
    document.getElementById("main").focus({ preventScroll: true });
  }

  refreshModule.addEventListener("click", () => {
    if (activeModule !== "dashboard") loadModule(activeModule);
  });

  async function loadModule(key) {
    const item = modules[key];
    moduleContent.replaceChildren();
    const loading = document.createElement("div");
    loading.className = "loading";
    loading.textContent = "Carregando dados disponíveis";
    moduleContent.append(loading);

    if (!item.endpoint) {
      renderEmpty("Interface específica em construção", "O contrato funcional deste módulo já existe no backend, mas a tela operacional ainda será desenhada e validada.");
      return;
    }

    let path = item.endpoint;
    if (item.unit) {
      if (!activeUnit) {
        renderEmpty("Unidade não identificada", "A credencial atual não retornou uma unidade disponível para esta consulta.");
        return;
      }
      path += `${path.includes("?") ? "&" : "?"}unidade_id=${encodeURIComponent(activeUnit)}`;
    }

    try {
      const data = await request(path);
      const items = data?.items || [];
      if (!items.length) {
        renderEmpty("Nenhum registro disponível", "A consulta foi concluída, mas não retornou itens para a sessão atual.");
        return;
      }
      renderTable(items);
    } catch (error) {
      if (error.status === 403) renderEmpty("Acesso não liberado", "O perfil autenticado não possui permissão para consultar esta área.");
      else renderEmpty("Consulta ainda não conectada", "O módulo está previsto no backend, mas esta visão do frontend ainda precisa ser ajustada ao contrato de consulta correspondente.");
    }
  }

  function renderEmpty(titleText, detailText) {
    moduleContent.replaceChildren();
    const box = document.createElement("div");
    box.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = titleText;
    const detail = document.createElement("span");
    detail.textContent = detailText;
    box.append(title, detail);
    moduleContent.append(box);
  }

  function humanize(key) {
    return key.replace(/_id$/, "").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatValue(value, key) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    if (typeof value === "object") return "Registro estruturado";
    const text = String(value);
    if ((key === "id" || key.endsWith("_id")) && text.length > 12) return `${text.slice(0, 8)}…`;
    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
      const date = new Date(text);
      if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
    }
    return text.length > 80 ? `${text.slice(0, 77)}…` : text;
  }

  function renderTable(items) {
    moduleContent.replaceChildren();
    const preferred = Object.keys(items[0]).filter((key) => key !== "organizacao_id" && key !== "comando_id");
    const columns = preferred.slice(0, 7);
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    columns.forEach((key) => {
      const th = document.createElement("th");
      th.textContent = humanize(key);
      headRow.append(th);
    });
    thead.append(headRow);
    const tbody = document.createElement("tbody");
    items.forEach((item) => {
      const row = document.createElement("tr");
      columns.forEach((key) => {
        const cell = document.createElement("td");
        cell.textContent = formatValue(item[key], key);
        row.append(cell);
      });
      tbody.append(row);
    });
    table.append(thead, tbody);
    moduleContent.append(table);
  }

  (async function bootstrap() {
    await checkInfrastructure();
    if (!token) {
      showAuth();
      return;
    }
    try {
      await loadContext();
      showApp();
    } catch {
      sessionStorage.removeItem("hvb-access-token");
      token = "";
      showAuth();
      setFeedback("A sessão anterior não é mais válida. Entre novamente.", "error");
    }
  })();
})();