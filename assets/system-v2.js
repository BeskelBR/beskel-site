(() => {
  "use strict";

  const modules = {
    pacientes: { title: "Pacientes", eyebrow: "Cadastro e relacionamento", description: "Pacientes, responsáveis, vínculos e episódios assistenciais em uma visão única.", next: "Evoluir para busca unificada, cadastro assistido e abertura de episódio sem duplicar dados.", views: [
      { key: "pacientes", label: "Pacientes", endpoint: "/v1/pacientes?limit=25" },
      { key: "responsaveis", label: "Responsáveis", endpoint: "/v1/responsaveis?limit=25" },
      { key: "vinculos", label: "Vínculos", endpoint: "/v1/vinculos?limit=25" },
      { key: "episodios", label: "Episódios", endpoint: "/v1/episodios?limit=25&ativos=true", unit: true },
    ]},
    agenda: { title: "Agenda", eyebrow: "Recursos e horários", description: "Agendamentos, disponibilidade de recursos, equipes e transições operacionais.", next: "Construir mapa diário/semanal por equipe, recurso e ambiente após validar o fluxo final do hospital.", views: [
      { key: "agendamentos", label: "Agendamentos", endpoint: "/v1/agenda/agendamentos?limit=25", unit: true },
      { key: "recursos", label: "Recursos", endpoint: "/v1/agenda/recursos?limit=25", unit: true },
      { key: "equipes", label: "Equipes", endpoint: "/v1/agenda/equipes?limit=25", unit: true },
      { key: "disponibilidades", label: "Disponibilidades", endpoint: "/v1/agenda/disponibilidades?limit=25", unit: true },
    ]},
    internacao: { title: "Internação", eyebrow: "Episódios e ocupação", description: "Acompanhamento de episódios, ocupações, classificações e regras configuráveis de diária.", next: "Consolidar mapa de leitos, passagem de plantão e pendências por paciente sem antecipar regras ainda abertas.", views: [
      { key: "episodios", label: "Episódios ativos", endpoint: "/v1/episodios?limit=25&ativos=true", unit: true },
      { key: "ocupacoes", label: "Ocupações", endpoint: "/v1/ocupacoes?limit=25", unit: true },
      { key: "periodos", label: "Períodos de diária", endpoint: "/v1/diarias/periodos?limit=25", unit: true },
      { key: "classificacoes", label: "Classificações", endpoint: "/v1/diarias/classificacoes-episodio?limit=25", unit: true },
    ]},
    prontuario: { title: "Prontuário", eyebrow: "Linha do tempo clínica", description: "Evoluções versionadas, autoria, correções e histórico longitudinal do paciente.", next: "Projetar a leitura clínica por contexto e as ações de evolução/retificação conforme permissões de cargo.", views: [
      { key: "evolucoes", label: "Evoluções", endpoint: "/v1/prontuario/evolucoes?limit=25", unit: true },
      { key: "versoes", label: "Versões", endpoint: "/v1/prontuario/versoes?limit=25", unit: true },
    ]},
    estoque: { title: "Estoque", eyebrow: "Rastreabilidade física", description: "Posições, lotes, reservas, movimentações e inventário conectados à operação física.", next: "Conectar as rotinas administrativas às ações físicas do Terminal HVB e às permissões por cargo.", views: [
      { key: "posicoes", label: "Posições", endpoint: "/v1/estoque/posicoes?limit=25", unit: true },
      { key: "lotes", label: "Lotes", endpoint: "/v1/estoque/lotes?limit=25" },
      { key: "reservas", label: "Reservas", endpoint: "/v1/estoque/reservas?limit=25", unit: true },
      { key: "transacoes", label: "Transações", endpoint: "/v1/estoque/transacoes?limit=25", unit: true },
      { key: "inventarios", label: "Inventários", endpoint: "/v1/estoque/inventarios?limit=25", unit: true },
    ]},
    exames: { title: "Exames", eyebrow: "Solicitações e resultados", description: "Solicitações, coletas, avaliação de amostras, resultados estruturados e correções versionadas.", next: "Desenhar filas de coleta/liberação e leitura de resultados sem interpretação clínica automática.", views: [
      { key: "solicitacoes", label: "Solicitações", endpoint: "/v1/exames/solicitacoes?limit=25", unit: true },
      { key: "coletas", label: "Coletas", endpoint: "/v1/exames/coletas?limit=25", unit: true },
      { key: "resultados", label: "Resultados", endpoint: "/v1/exames/resultados?limit=25", unit: true },
      { key: "liberacoes", label: "Liberações", endpoint: "/v1/exames/liberacoes?limit=25", unit: true },
    ]},
    financeiro: { title: "Financeiro", eyebrow: "Recebimentos e conciliação", description: "Títulos, recebimentos, caixa, créditos e conciliação financeira.", next: "Organizar indicadores e rotinas de exceção depois da validação operacional com a gestão.", views: [
      { key: "titulos", label: "Títulos", endpoint: "/v1/financeiro/titulos?limit=25", unit: true },
      { key: "recebimentos", label: "Recebimentos", endpoint: "/v1/financeiro/recebimentos?limit=25", unit: true },
      { key: "sessoes", label: "Sessões de caixa", endpoint: "/v1/financeiro/sessoes?limit=25", unit: true },
      { key: "creditos", label: "Créditos", endpoint: "/v1/financeiro/creditos?limit=25", unit: true },
      { key: "extrato", label: "Extrato", endpoint: "/v1/financeiro/extrato?limit=25", unit: true },
    ]},
    compras: { title: "Compras", eyebrow: "Fornecedores e aquisição", description: "Pedidos, recebimentos, preços negociados e custo analítico de aquisição.", next: "Fechar o ciclo de compra com documentos fiscais, créditos/devoluções e aprovações internas.", views: [
      { key: "pedidos", label: "Pedidos", endpoint: "/v1/compras/pedidos?limit=25", unit: true },
      { key: "fornecedores", label: "Fornecedores", endpoint: "/v1/compras/fornecedores?limit=25", unit: true },
      { key: "itens", label: "Itens", endpoint: "/v1/compras/itens?limit=25", unit: true },
      { key: "recebimentos", label: "Recebimentos", endpoint: "/v1/compras/recebimentos?limit=25", unit: true },
    ]},
    documentos: { title: "Documentos", eyebrow: "Modelos e autorizações", description: "Solicitações, versões, aprovações, assinaturas e entregas documentais registradas.", next: "Definir quais documentos exigem assinatura válida e quais fluxos podem permanecer declaratórios.", views: [
      { key: "solicitacoes", label: "Solicitações", endpoint: "/v1/documentos/solicitacoes?limit=25", unit: true },
      { key: "versoes", label: "Versões", endpoint: "/v1/documentos/versoes?limit=25", unit: true },
      { key: "assinaturas", label: "Assinaturas", endpoint: "/v1/documentos/assinaturas?limit=25", unit: true },
      { key: "entregas", label: "Entregas", endpoint: "/v1/documentos/entregas?limit=25", unit: true },
    ]},
    preventivo: { title: "Preventivo", eyebrow: "Protocolos e recorrência", description: "Adesões, ocorrências, aplicações e revisões de protocolos preventivos.", next: "Transformar os contratos do backend em jornadas simples de adesão, aplicação e acompanhamento.", views: [
      { key: "adesoes", label: "Adesões", endpoint: "/v1/protocolos/adesoes?limit=25", unit: true },
      { key: "ocorrencias", label: "Ocorrências", endpoint: "/v1/protocolos/ocorrencias?limit=25", unit: true },
      { key: "aplicacoes", label: "Aplicações", endpoint: "/v1/protocolos/aplicacoes?limit=25", unit: true },
      { key: "revisoes", label: "Revisões", endpoint: "/v1/protocolos/revisoes?limit=25", unit: true },
    ]},
    administracao: { title: "Administração", eyebrow: "Acesso e governança", description: "Usuários, papéis, unidades, dispositivos e credenciais do ecossistema HVB.", next: "Aplicar a matriz de cargos validada com Rafael e liberar somente as funcionalidades correspondentes.", views: [
      { key: "unidades", label: "Unidades", endpoint: "/v1/unidades?limit=25" },
      { key: "usuarios", label: "Usuários", endpoint: "/v1/usuarios?limit=25" },
      { key: "papeis", label: "Papéis", endpoint: "/v1/papeis?limit=25" },
      { key: "dispositivos", label: "Dispositivos", endpoint: "/v1/dispositivos?limit=25" },
      { key: "credenciais", label: "Credenciais", endpoint: "/v1/credenciais?limit=25" },
    ]},
  };

  const $ = (selector) => document.querySelector(selector);
  const authView = $('[data-view="auth"]'); const appView = $('[data-view="app"]'); const loginForm = $("#login-form");
  const tokenInput = $("#access-token"); const apiInput = $("#api-base"); const unitInput = $("#unit-id"); const feedback = $("#auth-feedback");
  const apiStatus = $("#api-status"); const healthCard = $("#health-card"); const readyCard = $("#ready-card"); const orgName = $("#org-name");
  const actorId = $("#actor-id"); const unitLabel = $("#unit-label"); const pageTitle = $("#page-title"); const sidebar = $("#sidebar"); const menuBtn = $("#menu-btn");
  const moduleGrid = $("#module-grid"); const detailTitle = $("#detail-title"); const detailEyebrow = $("#detail-eyebrow"); const detailDescription = $("#detail-description");
  const detailNext = $("#detail-next"); const moduleTabs = $("#module-tabs"); const moduleSearch = $("#module-search"); const moduleCount = $("#module-count");
  const moduleContext = $("#module-context"); const moduleContent = $("#module-content"); const refreshModule = $("#refresh-module"); const loadMoreButton = $("#load-more");

  const localDefault = location.origin;
  const apiBase = localDefault;
  let actor = null; let organization = null; let activeUnit = localStorage.getItem("hvb-unit-id") || null;
  let activeModule = "dashboard"; let activeView = null; let currentItems = []; let nextCursor = null; let loading = false;
  apiInput.value = apiBase; apiInput.readOnly = true; unitInput.value = activeUnit || "";

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {}); headers.set("Accept", "application/json");
    // Cookie authentication is handled by the local session server.
    const response = await window.HVBSession.fetch(`${apiBase}${path}`, { ...options, headers });
    const type = response.headers.get("content-type") || ""; const body = type.includes("application/json") ? await response.json() : null;
    if (!response.ok) { const error = new Error(body?.erro || `HTTP ${response.status}`); error.status = response.status; error.payload = body; throw error; }
    return body;
  }
  function setFeedback(message, kind = "") { feedback.textContent = message || ""; feedback.className = `auth-feedback ${kind}`.trim(); }
  function setInfrastructure(status, text) { apiStatus.textContent = text; apiStatus.className = `api-status ${status}`.trim(); }
  async function checkInfrastructure() {
    try { const health = await request("/health", {}, false); const ok = health?.status === "ok"; setInfrastructure(ok ? "ok" : "error", ok ? "API online" : "API instável"); healthCard.textContent = ok ? "Online" : "Instável"; }
    catch { setInfrastructure("error", "API indisponível"); healthCard.textContent = "Indisponível"; }
    try { const ready = await request("/ready", {}, false); readyCard.textContent = ready?.status === "ready" ? "Pronto" : "Pendente"; }
    catch { readyCard.textContent = "Pendente"; }
  }
  async function loadContext() {
    actor = await request("/v1/me/contexto");
    try { organization = await request("/v1/organizacao"); } catch { organization = { nome: "Hospital Veterinário Brasília" }; }
    const units = actor.unidades || [];
    activeUnit = units.some(u => u.id === activeUnit) ? activeUnit : units[0]?.id || null;
    if (activeUnit) localStorage.setItem("hvb-unit-id", activeUnit); else localStorage.removeItem("hvb-unit-id");
  }
  function showApp() {
    authView.hidden = true; appView.hidden = false; orgName.textContent = organization?.nome || "HVB";
    actorId.textContent = actor?.usuario_id ? `Usuário ${actor.usuario_id.slice(0, 8)}…` : "Sessão autenticada";
    unitLabel.textContent = activeUnit ? `Unidade ${activeUnit.slice(0, 8)}…` : "Unidade não definida";
    renderModuleGrid(); navigate("dashboard"); checkInfrastructure();
  }
  function showAuth() { appView.hidden = true; authView.hidden = false; }
  async function authenticate(candidate) { await window.HVBSession.login(candidate); tokenInput.value = ""; await loadContext(); showApp(); }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault(); const submit = loginForm.querySelector('button[type="submit"]'); const candidate = tokenInput.value.trim().toLowerCase();
    activeUnit = null;
    if (activeUnit) localStorage.setItem("hvb-unit-id", activeUnit); else localStorage.removeItem("hvb-unit-id");
    if (!/^[a-f0-9]{64}$/.test(candidate)) { setFeedback("A credencial DEV deve conter exatamente 64 caracteres hexadecimais.", "error"); return; }
    if (activeUnit && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(activeUnit)) { setFeedback("O identificador da unidade deve ser um UUID válido.", "error"); return; }
    submit.disabled = true; setFeedback("Validando credencial…");
    try { await authenticate(candidate); setFeedback(""); }
    catch (error) { sessionStorage.removeItem("hvb-session-view"); if (error.status === 401) setFeedback("Credencial inválida, revogada ou expirada.", "error"); else if (error.status === 403) setFeedback("A credencial é válida, mas não possui acesso a este ambiente.", "error"); else setFeedback("Não foi possível conectar ao backend configurado. Verifique a API e o ambiente DEV.", "error"); }
    finally { tokenInput.value = ""; submit.disabled = false; }
  });

  window.addEventListener("hvb-session-ended", () => { actor = null; organization = null; currentItems = []; nextCursor = null; showAuth(); tokenInput.value = ""; setFeedback("Sessão encerrada ou alterada. Entre novamente.", "error"); });
  $("#logout-btn").addEventListener("click", async () => { try { await window.HVBSession.logout(); setFeedback("Sessão encerrada."); } catch { setFeedback("A saída não foi confirmada. Verifique a conexão e tente novamente.", "error"); alert("A saída não foi confirmada. Tente Encerrar sessão novamente."); } });
  menuBtn.addEventListener("click", () => { const open = sidebar.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", String(open)); });
  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.module)));
  document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.go)));

  function renderModuleGrid() {
    moduleGrid.replaceChildren();
    Object.entries(modules).forEach(([key, item]) => {
      const card = document.createElement("button"); card.type = "button"; card.className = "module-card";
      const title = document.createElement("strong"); title.textContent = item.title; const description = document.createElement("p"); description.textContent = item.description;
      const state = document.createElement("span"); state.textContent = `${item.views.length} visões de consulta`; card.append(title, description, state); card.addEventListener("click", () => navigate(key)); moduleGrid.append(card);
    });
  }
  function navigate(module) {
    activeModule = module || "dashboard"; document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.module === activeModule));
    const dashboard = $('[data-module-view="dashboard"]'); const detail = $('[data-module-view="detail"]');
    if (activeModule === "dashboard") { dashboard.hidden = false; detail.hidden = true; pageTitle.textContent = "Visão geral"; }
    else { dashboard.hidden = true; detail.hidden = false; const item = modules[activeModule]; pageTitle.textContent = item.title; detailTitle.textContent = item.title; detailEyebrow.textContent = item.eyebrow; detailDescription.textContent = item.description; detailNext.textContent = item.next; renderTabs(item); selectView(item.views[0].key); }
    sidebar.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); $("#main").focus({ preventScroll: true });
  }
  function renderTabs(module) {
    moduleTabs.replaceChildren(); module.views.forEach((view) => { const button = document.createElement("button"); button.type = "button"; button.className = "module-tab"; button.dataset.view = view.key; button.setAttribute("role", "tab"); button.textContent = view.label; button.addEventListener("click", () => selectView(view.key)); moduleTabs.append(button); });
  }
  function selectView(key) {
    const module = modules[activeModule]; activeView = module.views.find((view) => view.key === key) || module.views[0];
    moduleTabs.querySelectorAll(".module-tab").forEach((button) => { const active = button.dataset.view === activeView.key; button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active)); });
    moduleSearch.value = ""; currentItems = []; nextCursor = null; loadView(false);
  }
  refreshModule.addEventListener("click", () => { if (activeModule === "dashboard" || !activeView) return; currentItems = []; nextCursor = null; loadView(false); });
  loadMoreButton.addEventListener("click", () => { if (!loading && nextCursor) loadView(true); });
  moduleSearch.addEventListener("input", () => renderCurrentItems());

  function buildPath(view, cursor = null) {
    const url = new URL(view.endpoint, "https://local.invalid"); if (view.unit) { if (!activeUnit) return null; url.searchParams.set("unidade_id", activeUnit); } if (cursor) url.searchParams.set("cursor", cursor); return `${url.pathname}${url.search}`;
  }
  async function loadView(append) {
    if (!activeView || loading) return; const path = buildPath(activeView, append ? nextCursor : null);
    if (!path) { renderEmpty("Unidade não definida", "Informe uma unidade hospitalar válida na configuração DEV para consultar esta visão."); moduleCount.textContent = "0 registros"; moduleContext.textContent = "Unidade necessária"; loadMoreButton.hidden = true; return; }
    loading = true; moduleContext.textContent = `${activeView.label} • consultando`;
    if (!append) { moduleContent.replaceChildren(); const indicator = document.createElement("div"); indicator.className = "loading"; indicator.textContent = "Carregando dados disponíveis"; moduleContent.append(indicator); }
    try { const data = await request(path); const items = data?.items || []; currentItems = append ? currentItems.concat(items) : items; nextCursor = data?.next_cursor || null; moduleContext.textContent = `${activeView.label} • consulta autenticada`; loadMoreButton.hidden = !nextCursor; renderCurrentItems(); }
    catch (error) { loadMoreButton.hidden = true; if (error.status === 403) { renderEmpty("Acesso não liberado", "O perfil autenticado não possui permissão para consultar esta visão.", true); moduleContext.textContent = "Permissão insuficiente"; } else if (error.status === 401) { renderEmpty("Sessão inválida", "A credencial expirou ou foi revogada. Entre novamente no sistema.", true); moduleContext.textContent = "Sessão inválida"; } else { renderEmpty("Consulta indisponível", "A visão está prevista no frontend, mas o backend DEV não respondeu conforme o contrato esperado."); moduleContext.textContent = "Falha de integração DEV"; } moduleCount.textContent = "0 registros"; }
    finally { loading = false; }
  }
  function filteredItems() {
    const term = moduleSearch.value.trim().toLocaleLowerCase("pt-BR"); if (!term) return currentItems;
    return currentItems.filter((item) => Object.values(item).some((value) => { if (value === null || value === undefined) return false; if (typeof value === "object") return JSON.stringify(value).toLocaleLowerCase("pt-BR").includes(term); return String(value).toLocaleLowerCase("pt-BR").includes(term); }));
  }
  function renderCurrentItems() {
    const items = filteredItems(); moduleCount.textContent = `${items.length} ${items.length === 1 ? "registro" : "registros"}${moduleSearch.value.trim() ? ` filtrados de ${currentItems.length}` : ""}`;
    if (!items.length) { renderEmpty(currentItems.length ? "Nenhum resultado no filtro" : "Nenhum registro disponível", currentItems.length ? "Ajuste o termo de busca para ampliar os resultados." : "A consulta foi concluída, mas não retornou itens para esta sessão."); return; }
    renderSummary(items); renderTable(items);
  }
  function renderSummary(items) {
    moduleContent.replaceChildren(); const summary = document.createElement("div"); summary.className = "module-summary";
    summary.append(summaryCard("Registros visíveis", String(items.length)), summaryCard("Campos exibidos", String(Math.min(Object.keys(items[0]).length, 7))), summaryCard("Paginação", nextCursor ? "Há mais dados" : "Página final")); moduleContent.append(summary);
  }
  function summaryCard(label, value) { const card = document.createElement("div"); card.className = "summary-card"; const span = document.createElement("span"); span.textContent = label; const strong = document.createElement("strong"); strong.textContent = value; card.append(span, strong); return card; }
  function renderEmpty(titleText, detailText, permission = false) { moduleContent.replaceChildren(); const box = document.createElement("div"); box.className = "empty-state"; if (permission) box.classList.add("permission-note"); const wrapper = document.createElement("div"); const title = document.createElement("strong"); title.textContent = titleText; const detail = document.createElement("span"); detail.textContent = detailText; wrapper.append(title, detail); box.append(wrapper); moduleContent.append(box); }
  function humanize(key) {
    const labels = { id:"ID", nome:"Nome", login:"Login", tipo:"Tipo", estado:"Estado", situacao:"Situação", referencia:"Referência", criado_em:"Criado em", criada_em:"Criada em", admitido_em:"Admissão", encerrado_em:"Encerramento", recebido_em:"Recebido em", ocorrida_em:"Ocorrida em", produzido_em:"Produzido em", vencimento:"Vencimento", valor:"Valor", saldo:"Saldo", ativo:"Ativo" };
    if (labels[key]) return labels[key]; return key.replace(/_id$/, "").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
  function statusClass(text) { const value = String(text).toLocaleLowerCase("pt-BR"); if (["ativo","aberta","aberto","confirmado","liberado","vigente","concluido","concluído","pago"].some((token) => value.includes(token))) return "good"; if (["pendente","rascunho","revisao","revisão","parcial","programado"].some((token) => value.includes(token))) return "warn"; if (["cancel","revog","encerrado","expirado","revertido","inativo","falha"].some((token) => value.includes(token))) return "bad"; return ""; }
  function formatValue(value, key) { if (value === null || value === undefined || value === "") return "—"; if (typeof value === "boolean") return value ? "Sim" : "Não"; if (typeof value === "object") return "Registro estruturado"; const text = String(value); if ((key === "id" || key.endsWith("_id")) && text.length > 12) return `${text.slice(0, 8)}…`; if (/^\d{4}-\d{2}-\d{2}T/.test(text)) { const date = new Date(text); if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat("pt-BR", { dateStyle:"short", timeStyle:"short" }).format(date); } return text.length > 90 ? `${text.slice(0, 87)}…` : text; }
  function renderTable(items) {
    const preferred = Object.keys(items[0]).filter((key) => key !== "organizacao_id" && key !== "comando_id" && !key.startsWith("hash_")); const priority = ["nome","descricao","tipo","situacao","estado","referencia","valor","saldo","criada_em","criado_em","id"]; const columns = [...priority.filter((key) => preferred.includes(key)), ...preferred.filter((key) => !priority.includes(key))].slice(0,7);
    const wrap = document.createElement("div"); wrap.className = "table-wrap"; const table = document.createElement("table"); const thead = document.createElement("thead"); const headRow = document.createElement("tr");
    columns.forEach((key) => { const th = document.createElement("th"); th.textContent = humanize(key); headRow.append(th); }); thead.append(headRow); const tbody = document.createElement("tbody");
    items.forEach((item) => { const row = document.createElement("tr"); columns.forEach((key) => { const cell = document.createElement("td"); cell.dataset.key = key; const formatted = formatValue(item[key], key); if (key === "id" || key.endsWith("_id")) { cell.classList.add("cell-id"); cell.title = String(item[key] ?? ""); cell.textContent = formatted; } else if (["situacao","estado","resultado"].includes(key) && formatted !== "—") { const pill = document.createElement("span"); pill.className = `status-pill ${statusClass(formatted)}`.trim(); pill.textContent = formatted; cell.append(pill); } else cell.textContent = formatted; row.append(cell); }); tbody.append(row); }); table.append(thead, tbody); wrap.append(table); moduleContent.append(wrap);
  }

  (async function bootstrap() { const submit = loginForm.querySelector('button[type="submit"]'); submit.disabled = true; await checkInfrastructure(); try { await window.HVBSession.restore(); await loadContext(); showApp(); } catch { sessionStorage.removeItem("hvb-session-view"); showAuth(); } finally { submit.disabled = false; } })();
})();
