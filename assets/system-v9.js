import {
  canUse,
  canUseGlobal,
  operationalFlows,
  permissionsFor,
  resolveUnit,
} from "./system-v9-contract.js";

const detailView = document.querySelector('[data-module-view="detail"]');
const detailHead = detailView?.querySelector(".detail-head");

if (detailView && detailHead) {
  const section = document.createElement("section");
  section.className = "operational-actions";
  section.hidden = true;
  section.setAttribute("aria-live", "polite");
  detailHead.insertAdjacentElement("afterend", section);

  let context = null;
  let contextView = "";
  let renderVersion = 0;

  const currentView = () => sessionStorage.getItem("hvb-session-view") || "";
  const activeModule = () =>
    document.querySelector(".nav-item.active")?.dataset.module || "dashboard";

  async function request(path) {
    const response = await window.HVBSession.fetch(
      new URL(path, location.origin).toString(),
      { headers: { Accept: "application/json" } },
    );
    const type = response.headers.get("content-type") || "";
    const body = type.includes("application/json") ? await response.json() : null;
    if (!response.ok)
      throw Object.assign(new Error(body?.erro || `HTTP ${response.status}`), {
        status: response.status,
      });
    return body;
  }

  async function ownContext() {
    const view = currentView();
    if (!view) throw Object.assign(new Error("sessao_ausente"), { status: 401 });
    if (!context || contextView !== view) {
      context = await request("/v1/me/contexto");
      contextView = view;
    }
    return context;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function option(select, value, label) {
    const node = document.createElement("option");
    node.value = value;
    node.textContent = label;
    select.append(node);
  }

  function field(labelText, control, wide = false) {
    const label = el("label", wide ? "wide" : "");
    label.append(el("span", "", labelText), control);
    return label;
  }

  function input(name, placeholder, type = "text") {
    const node = document.createElement("input");
    node.name = name;
    node.type = type;
    node.placeholder = placeholder;
    node.autocomplete = "off";
    return node;
  }

  function select(name) {
    const node = document.createElement("select");
    node.name = name;
    return node;
  }

  function heading(eyebrow, title, description, state = "Contrato em preparação") {
    const head = el("div", "operational-head");
    const copy = el("div");
    copy.append(
      el("span", "eyebrow", eyebrow),
      el("h3", "", title),
      el("p", "", description),
    );
    head.append(copy, el("span", "operational-state warn", state));
    return head;
  }

  function note(title, body, warn = false) {
    const box = el("div", `operational-note${warn ? " warn" : ""}`);
    box.append(el("strong", "", title), el("span", "", body));
    return box;
  }

  function disabledMessage(text) {
    section.replaceChildren(
      heading("Acesso e permissões", "Operação não disponível", text, "Restrito"),
      el(
        "div",
        "operational-disabled",
        "A interface respeita as permissões devolvidas por /v1/me/contexto. Nenhuma tentativa de gravação foi enviada.",
      ),
    );
  }

  function contractDetails(lines) {
    const details = el("details", "operational-contract");
    details.append(el("summary", "", "Contrato técnico atual"));
    const list = document.createElement("ul");
    for (const line of lines) {
      const item = document.createElement("li");
      const code = document.createElement("code");
      code.textContent = line;
      item.append(code);
      list.append(item);
    }
    details.append(list);
    return details;
  }

  async function renderEmployee(version) {
    section.hidden = false;
    section.replaceChildren(
      heading(
        "Administração",
        "Cadastro de funcionário e autorizações",
        "Preparação da jornada de acesso usando usuário, papel e escopo de unidade já existentes no backend.",
      ),
    );
    const ctx = await ownContext();
    if (version !== renderVersion || activeModule() !== "administracao") return;
    const unitId = resolveUnit(ctx, localStorage.getItem("hvb-unit-id"));
    if (!canUseGlobal(ctx, operationalFlows.employee.requiredPermissions)) {
      disabledMessage(
        "Seu contexto atual não possui a permissão global acesso:administrar exigida pelos contratos de usuários, papéis e atribuições.",
      );
      return;
    }

    let roles = [];
    try {
      roles = (await request("/v1/papeis?limit=100")).items || [];
    } catch {
      section.append(
        note(
          "Papéis indisponíveis",
          "O cadastro visual foi preservado, mas a lista de papéis não pôde ser carregada.",
          true,
        ),
      );
    }
    if (version !== renderVersion || activeModule() !== "administracao") return;

    const form = el("form", "operational-form");
    form.addEventListener("submit", (event) => event.preventDefault());
    const grid = el("div", "operational-grid");
    const name = input("nome", "Ex.: Funcionário fictício");
    const login = input("login", "Ex.: funcionario.dev");
    const role = select("papel_id");
    option(role, "", "Selecione um papel");
    for (const item of roles) option(role, item.id, item.nome || item.id);
    const unit = select("unidade_id");
    option(unit, "", "Selecione uma unidade");
    for (const item of ctx.unidades || [])
      option(unit, item.id, item.nome || item.id);
    if (unitId) unit.value = unitId;

    grid.append(
      field("Nome", name),
      field("Login", login),
      field("Papel / perfil de autorização", role),
      field("Unidade de atuação", unit),
    );

    const actions = el("div", "operational-actions-row");
    const submit = el(
      "button",
      "primary-btn",
      "Aguardando contrato de cadastro completo",
    );
    submit.type = "submit";
    submit.disabled = true;
    actions.append(
      submit,
      el(
        "small",
        "",
        "Nenhum funcionário é criado por esta tela enquanto o backend exigir etapas independentes que possam deixar um cadastro parcial.",
      ),
    );
    form.append(
      grid,
      note(
        "Autorizações por papel",
        "O backend já permite atribuir um papel ao usuário por unidade, mas a API atual lista o papel sem devolver as permissões que o compõem. A interface não inventa essa matriz.",
        true,
      ),
      actions,
      contractDetails([
        "POST /v1/usuarios",
        "POST /v1/atribuicoes",
        "POST /v1/credenciais",
        "GET /v1/papeis",
        "GET /v1/me/contexto",
      ]),
    );
    section.append(form);
  }

  async function renderStockEntry(version) {
    section.hidden = false;
    section.replaceChildren(
      heading(
        "Estoque",
        "Registrar entrada de estoque",
        "Fluxo visual para recebimento com apresentação, lote, validade, localização e quantidade sem transferir regra de estoque para o navegador.",
      ),
    );
    const ctx = await ownContext();
    if (version !== renderVersion || activeModule() !== "estoque") return;
    const unitId = resolveUnit(ctx, localStorage.getItem("hvb-unit-id"));
    const required = operationalFlows.stockEntry.requiredPermissions;
    const present = permissionsFor(ctx, unitId);
    const missing = required.filter((permission) => !present.has(permission));
    const catalogReadable = canUseGlobal(ctx, ["estoque:ler"]);
    if (!unitId || missing.length || !catalogReadable) {
      const details = [
        ...missing,
        ...(!catalogReadable ? ["estoque:ler (global, exigido hoje pelas listas de catálogo)"] : []),
      ];
      disabledMessage(
        `O contexto atual não satisfaz o contrato necessário para preparar uma entrada completa: ${details.join(", ") || "unidade não identificada"}.`,
      );
      return;
    }

    let products = [],
      presentations = [],
      locations = [];
    try {
      [products, presentations, locations] = await Promise.all([
        request("/v1/estoque/produtos?limit=100").then((x) => x.items || []),
        request("/v1/estoque/apresentacoes?limit=100").then(
          (x) => x.items || [],
        ),
        request(
          `/v1/locais?limit=100&unidade_id=${encodeURIComponent(unitId)}`,
        ).then((x) => x.items || []),
      ]);
    } catch {
      section.append(
        note(
          "Catálogo incompleto",
          "Uma ou mais consultas de produto, apresentação ou localização não responderam. A tela continua sem enviar gravações.",
          true,
        ),
      );
    }
    if (version !== renderVersion || activeModule() !== "estoque") return;

    const productById = new Map(products.map((item) => [item.id, item]));
    const form = el("form", "operational-form");
    form.addEventListener("submit", (event) => event.preventDefault());
    const grid = el("div", "operational-grid");

    const unit = select("unidade_id");
    for (const item of ctx.unidades || [])
      option(unit, item.id, item.nome || item.id);
    unit.value = unitId;
    unit.disabled = true;

    const presentation = select("apresentacao_id");
    option(presentation, "", "Selecione uma apresentação");
    for (const item of presentations) {
      const product = productById.get(item.produto_id);
      option(
        presentation,
        item.id,
        `${product?.nome || "Produto"} • ${item.codigo || "apresentação"}`,
      );
    }

    const lotCode = input("codigo_lote", "Ex.: LOTE-DEV-001");
    const manufacturer = input("fabricante", "Ex.: Fabricante fictício");
    const expiryState = select("situacao_validade");
    option(expiryState, "conhecida", "Validade conhecida");
    option(expiryState, "pendente", "Validade pendente");
    option(expiryState, "isenta", "Isenta");
    const expiry = input("validade", "", "date");
    const location = select("local_id");
    option(location, "", "Selecione a localização");
    for (const item of locations)
      option(location, item.id, item.nome || item.id);
    const quantity = input("quantidade_apresentacoes", "Ex.: 20", "text");
    quantity.inputMode = "decimal";
    const cost = input("custo_base", "Opcional • valor base", "text");
    cost.inputMode = "decimal";
    const occurred = input("ocorrido_em", "", "datetime-local");
    const reason = input("motivo", "Ex.: Recebimento fictício para validação");

    grid.append(
      field("Unidade", unit),
      field("Produto / apresentação", presentation),
      field("Código do lote", lotCode),
      field("Fabricante", manufacturer),
      field("Situação da validade", expiryState),
      field("Validade", expiry),
      field("Localização física", location),
      field("Quantidade recebida", quantity),
      field("Custo base", cost),
      field("Data e hora do recebimento", occurred),
      field("Motivo / referência operacional", reason, true),
    );

    const actions = el("div", "operational-actions-row");
    const submit = el(
      "button",
      "primary-btn",
      "Aguardando entrada transacional do backend",
    );
    submit.type = "submit";
    submit.disabled = true;
    actions.append(
      submit,
      el(
        "small",
        "",
        "O endpoint atual /v1/estoque/entradas movimenta quantidade para uma posição já existente. Ele não recebe, em uma única transação, lote novo + ocupação/posição + entrada.",
      ),
    );

    form.append(
      grid,
      note(
        "Modelo preservado",
        "A tela mantém a invariante produto → lote → ocupação física → coordenada. Nenhuma coordenada fixa é atribuída ao produto e o Terminal congelado não é chamado.",
      ),
      actions,
      contractDetails([
        "POST /v1/estoque/lotes",
        "POST /v1/estoque/posicoes",
        "POST /v1/estoque/entradas",
        "GET /v1/estoque/apresentacoes",
        "GET /v1/locais",
      ]),
    );
    section.append(form);
  }

  async function renderCurrent() {
    const module = activeModule();
    renderVersion += 1;
    const version = renderVersion;
    if (!currentView() || !["administracao", "estoque"].includes(module)) {
      section.hidden = true;
      section.replaceChildren();
      return;
    }
    try {
      if (module === "administracao") await renderEmployee(version);
      if (module === "estoque") await renderStockEntry(version);
    } catch (error) {
      if (version !== renderVersion) return;
      section.hidden = false;
      section.replaceChildren(
        heading(
          "Interface operacional",
          "Não foi possível carregar o contexto",
          error?.status === 401
            ? "A sessão expirou. Entre novamente."
            : "A API não respondeu ao contexto necessário para esta tela.",
          "Indisponível",
        ),
      );
    }
  }

  document.querySelectorAll("[data-module], [data-go]").forEach((button) =>
    button.addEventListener("click", () => setTimeout(renderCurrent, 0)),
  );
  window.addEventListener("hvb-session-ended", () => {
    context = null;
    contextView = "";
    section.hidden = true;
    section.replaceChildren();
  });
}
