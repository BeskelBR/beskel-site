import { createPilotClient, pilotError } from "./pilot-api.js";
import {
  appendPage,
  assignmentKey,
  assignmentPayload,
  assignmentRevisionPayload,
  filterEmployees,
  humanizePermission,
  scopeLabel,
  userRevisionPayload,
} from "./system-v11-admin-contract.js";

const detailView = document.querySelector('[data-module-view="detail"]');
const detailHead = detailView?.querySelector(".detail-head");

if (detailView && detailHead) {
  const anchor =
    detailView.querySelector(".operational-actions") || detailHead;
  const section = document.createElement("section");
  section.className = "admin-management";
  section.hidden = true;
  section.setAttribute("aria-live", "polite");
  anchor.insertAdjacentElement("afterend", section);

  const client = createPilotClient({
    base: location.origin.replace(/\/$/, ""),
    fetcher: (...args) => window.HVBSession.fetch(...args),
  });

  let context = null;
  let contextView = "";
  let selectedUserId = null;
  let searchText = "";
  let catalogs = {
    users: [],
    roles: [],
    units: [],
    assignments: [],
  };
  let rolePermissionCache = new Map();
  let pendingMutation = null;
  let renderVersion = 0;

  const currentView = () => sessionStorage.getItem("hvb-session-view") || "";
  const activeModule = () =>
    document.querySelector(".nav-item.active")?.dataset.module || "dashboard";

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

  function input(name, placeholder = "", type = "text") {
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

  function checkbox(name, text) {
    const label = el("label", "operational-check");
    const control = document.createElement("input");
    control.type = "checkbox";
    control.name = name;
    label.append(control, el("span", "", text));
    return { label, control };
  }

  function setStatus(node, text, kind = "") {
    node.textContent = text || "";
    node.className = `admin-status ${kind}`.trim();
  }

  async function ownContext() {
    const view = currentView();
    if (!view)
      throw Object.assign(new Error("sessao_ausente"), { status: 401 });
    if (!context || contextView !== view) {
      context = await client.read("/v1/me/contexto");
      contextView = view;
    }
    return context;
  }

  function hasAdminAccess(ctx) {
    return (ctx?.permissoes_globais || []).includes("acesso:administrar");
  }

  async function readAll(path) {
    const items = [];
    let cursor = null;
    let pages = 0;
    do {
      const response = await client.read(appendPage(path, cursor, 100));
      items.push(...(response.items || []));
      cursor = response.next_cursor || null;
      pages += 1;
      if (pages > 100)
        throw Object.assign(new Error("paginacao_excedida"), { status: 503 });
    } while (cursor);
    return items;
  }

  async function readRevisionHistory(path) {
    let cursor = null;
    let pages = 0;
    let first = null;
    const items = [];
    do {
      const response = await client.read(appendPage(path, cursor, 100));
      if (!first) first = response;
      items.push(...(response.items || []));
      cursor = response.next_cursor || null;
      pages += 1;
      if (pages > 100)
        throw Object.assign(new Error("paginacao_excedida"), { status: 503 });
    } while (cursor);
    return { ...first, items };
  }

  async function loadCatalogs() {
    const [users, roles, units, assignments] = await Promise.all([
      readAll("/v1/usuarios"),
      readAll("/v1/papeis"),
      readAll("/v1/unidades"),
      readAll("/v1/atribuicoes"),
    ]);
    catalogs = { users, roles, units, assignments };
    if (
      selectedUserId &&
      !users.some((user) => user.id === selectedUserId)
    )
      selectedUserId = null;
  }

  async function rolePermissions(roleId) {
    if (!rolePermissionCache.has(roleId)) {
      const result = await client.read(
        `/v1/papeis/${encodeURIComponent(roleId)}/permissoes`,
      );
      rolePermissionCache.set(roleId, result.permissoes || []);
    }
    return rolePermissionCache.get(roleId) || [];
  }

  async function sendPending(statusNode) {
    if (!pendingMutation) return;
    setStatus(statusNode, "Enviando alteração…");
    const active = pendingMutation;
    try {
      const result = await client.send(active.intent);
      pendingMutation = null;
      renderRetry(statusNode);
      setStatus(statusNode, active.successMessage(result), "success");
      await loadCatalogs();
      await renderSelectedUser();
    } catch (error) {
      if (error.status && !error.uncertain) pendingMutation = null;
      setStatus(
        statusNode,
        `${pilotError(error)}${pendingMutation ? " O resultado pode ter sido gravado; repita a mesma operação com segurança." : ""}`,
        "error",
      );
      renderRetry(statusNode);
    }
  }

  function beginMutation(path, body, successMessage, statusNode) {
    if (pendingMutation) {
      setStatus(
        statusNode,
        "Há uma operação com resultado ainda incerto. Resolva o retry antes de iniciar outra alteração.",
        "error",
      );
      renderRetry(statusNode);
      return;
    }
    pendingMutation = {
      intent: client.prepare(path, body),
      successMessage,
    };
    sendPending(statusNode);
  }

  function renderRetry(statusNode) {
    const existing = section.querySelector("[data-admin-retry]");
    if (existing) existing.remove();
    if (!pendingMutation) return;
    const retry = el(
      "button",
      "secondary-btn admin-retry",
      "Repetir operação com a mesma chave",
    );
    retry.type = "button";
    retry.dataset.adminRetry = "true";
    retry.addEventListener("click", () => sendPending(statusNode));
    statusNode.insertAdjacentElement("afterend", retry);
  }

  function roleName(roleId) {
    return (
      catalogs.roles.find((role) => role.id === roleId)?.nome ||
      "Papel não disponível"
    );
  }

  function userName(userId) {
    return (
      catalogs.users.find((user) => user.id === userId)?.nome ||
      "Operador do sistema"
    );
  }

  function formatDate(value) {
    if (!value) return "Data não disponível";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Data não disponível"
      : new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(date);
  }

  async function renderEmployeeList(listNode, detailNode, statusNode) {
    const filtered = filterEmployees(catalogs.users, searchText);
    listNode.replaceChildren();

    const meta = el(
      "div",
      "admin-list-meta",
      `${filtered.length} funcionário(s) encontrado(s)`,
    );
    listNode.append(meta);

    if (!filtered.length) {
      listNode.append(
        el(
          "div",
          "operational-disabled",
          "Nenhum funcionário corresponde à busca atual.",
        ),
      );
      detailNode.replaceChildren(
        el(
          "div",
          "operational-disabled",
          "Selecione outro filtro ou cadastre um novo funcionário no formulário de cadastro.",
        ),
      );
      return;
    }

    for (const user of filtered) {
      const button = el("button", "admin-user-card");
      button.type = "button";
      if (user.id === selectedUserId) button.classList.add("active");
      button.append(
        el("strong", "", user.nome || "Funcionário sem nome"),
        el("span", "", user.login || "Login não informado"),
        el(
          "small",
          user.ativo ? "active" : "inactive",
          user.ativo ? "Ativo" : "Inativo",
        ),
      );
      button.addEventListener("click", async () => {
        selectedUserId = user.id;
        await renderEmployeeList(listNode, detailNode, statusNode);
        await renderSelectedUser();
      });
      listNode.append(button);
    }

    if (!selectedUserId) {
      detailNode.replaceChildren(
        el(
          "div",
          "operational-disabled",
          "Selecione um funcionário para editar dados, administrar autorizações e consultar o histórico.",
        ),
      );
    }
  }

  async function buildHistory(user, userHistory, assignmentHistories) {
    const events = [];

    for (const item of userHistory.items || []) {
      const before = item.antes || {};
      const after = item.depois || {};
      const changes = [];
      if (before.nome !== after.nome)
        changes.push(`Nome: ${before.nome || "—"} → ${after.nome || "—"}`);
      if (before.login !== after.login)
        changes.push(
          `Login: ${before.login || "—"} → ${after.login || "—"}`,
        );
      events.push({
        date: item.criada_em,
        title: "Dados do funcionário",
        detail: changes.join(" • ") || "Revisão cadastral",
        reason: item.motivo,
        author: userName(item.autor_id),
        version: item.versao,
      });
    }

    for (const entry of assignmentHistories) {
      const assignment = entry.assignment;
      for (const item of entry.history.items || []) {
        events.push({
          date: item.criada_em,
          title: `${item.ativo ? "Autorização restaurada" : "Autorização revogada"} — ${roleName(assignment.papel_id)}`,
          detail: scopeLabel(
            assignment,
            new Map(catalogs.units.map((unit) => [unit.id, unit])),
          ),
          reason: item.motivo,
          author: userName(item.autor_id),
          version: item.versao,
        });
      }
    }

    events.sort(
      (a, b) =>
        (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0),
    );

    const block = el("section", "admin-history");
    block.append(el("h4", "", "Histórico de alterações"));
    if (!events.length) {
      block.append(
        el(
          "div",
          "operational-disabled",
          "Ainda não há revisões registradas para este funcionário ou suas atribuições.",
        ),
      );
      return block;
    }

    const list = el("div", "admin-history-list");
    for (const event of events) {
      const card = el("article", "admin-history-item");
      card.append(
        el("strong", "", event.title),
        el("span", "", event.detail),
        el(
          "small",
          "",
          `${formatDate(event.date)} • versão ${event.version} • por ${event.author}`,
        ),
        el("p", "", `Motivo: ${event.reason}`),
      );
      list.append(card);
    }
    block.append(list);
    return block;
  }

  async function renderSelectedUser() {
    const detailNode = section.querySelector("[data-admin-detail]");
    const statusNode = section.querySelector("[data-admin-status]");
    if (!detailNode || !statusNode) return;
    if (!selectedUserId) return;

    const user = catalogs.users.find((item) => item.id === selectedUserId);
    if (!user) return;

    detailNode.replaceChildren(
      el("div", "admin-loading", "Carregando dados e histórico…"),
    );

    try {
      const userAssignments = catalogs.assignments.filter(
        (item) => item.usuario_id === user.id,
      );
      const [userHistory, assignmentHistories] = await Promise.all([
        readRevisionHistory(
          `/v1/usuarios/${encodeURIComponent(user.id)}/revisoes`,
        ),
        Promise.all(
          userAssignments.map(async (assignment) => ({
            assignment,
            history: await readRevisionHistory(
              `/v1/atribuicoes/${encodeURIComponent(assignment.id)}/revisoes`,
            ),
          })),
        ),
      ]);

      const roleIds = [...new Set(userAssignments.map((item) => item.papel_id))];
      await Promise.all(roleIds.map((id) => rolePermissions(id)));

      const unitById = new Map(catalogs.units.map((unit) => [unit.id, unit]));
      const assignmentHistoryById = new Map(
        assignmentHistories.map((entry) => [entry.assignment.id, entry.history]),
      );

      detailNode.replaceChildren();

      const header = el("div", "admin-detail-head");
      const title = el("div");
      title.append(
        el("span", "eyebrow", user.ativo ? "Funcionário ativo" : "Funcionário inativo"),
        el("h3", "", userHistory.atual?.nome || user.nome),
        el("p", "", userHistory.atual?.login || user.login),
      );
      header.append(title);
      detailNode.append(header);

      const edit = el("form", "operational-form admin-edit-form");
      const editGrid = el("div", "operational-grid");
      const editName = input("nome", "Nome do funcionário");
      editName.required = true;
      editName.maxLength = 160;
      editName.value = userHistory.atual?.nome || user.nome || "";
      const editLogin = input("login", "Login do funcionário");
      editLogin.required = true;
      editLogin.minLength = 3;
      editLogin.maxLength = 80;
      editLogin.pattern = "[a-z0-9._-]{3,80}";
      editLogin.value = userHistory.atual?.login || user.login || "";
      const editReason = input("motivo", "Motivo da alteração");
      editReason.required = true;
      editReason.maxLength = 160;
      const editConfirm = checkbox(
        "confirmacao",
        "Conferi nome e login e confirmo esta revisão.",
      );
      editConfirm.control.required = true;
      editGrid.append(
        field("Nome", editName),
        field("Login", editLogin),
        field("Motivo da alteração", editReason, true),
        editConfirm.label,
      );
      const editSubmit = el("button", "primary-btn", "Salvar alteração");
      editSubmit.type = "submit";
      edit.append(
        el("h4", "", "Dados do funcionário"),
        editGrid,
        editSubmit,
      );
      edit.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!edit.reportValidity()) return;
        const body = userRevisionPayload(
          { nome: editName.value, login: editLogin.value },
          userHistory.versao,
          editReason.value,
        );
        beginMutation(
          `/v1/usuarios/${encodeURIComponent(user.id)}/revisoes`,
          body,
          () => "Dados do funcionário atualizados.",
          statusNode,
        );
      });
      detailNode.append(edit);

      const permissionsBlock = el("section", "admin-assignments");
      permissionsBlock.append(el("h4", "", "Papéis, unidades e permissões"));

      if (!userAssignments.length) {
        permissionsBlock.append(
          el(
            "div",
            "operational-disabled",
            "Este funcionário ainda não possui atribuições.",
          ),
        );
      }

      for (const assignment of userAssignments) {
        const history = assignmentHistoryById.get(assignment.id);
        const currentActive =
          typeof history?.ativo === "boolean"
            ? history.ativo
            : Boolean(assignment.ativo);
        const version =
          Number.isInteger(history?.versao) ? history.versao : assignment.versao;
        const card = el("article", "admin-assignment-card");
        const head = el("div", "admin-assignment-head");
        const copy = el("div");
        copy.append(
          el("strong", "", roleName(assignment.papel_id)),
          el("span", "", scopeLabel(assignment, unitById)),
          el(
            "small",
            currentActive ? "active" : "inactive",
            currentActive ? "Autorização ativa" : "Autorização revogada",
          ),
        );
        head.append(copy);
        card.append(head);

        const permissions = rolePermissionCache.get(assignment.papel_id) || [];
        const permissionList = el("div", "admin-permissions");
        if (!permissions.length) {
          permissionList.append(
            el("span", "", "Papel sem permissões retornadas."),
          );
        } else {
          for (const permission of permissions)
            permissionList.append(
              el("span", "admin-permission-chip", humanizePermission(permission)),
            );
        }
        card.append(permissionList);

        const revisionForm = el("form", "admin-assignment-revision");
        const reason = input(
          "motivo",
          currentActive ? "Motivo da revogação" : "Motivo da restauração",
        );
        reason.required = true;
        reason.maxLength = 160;
        const confirm = checkbox(
          "confirmacao",
          currentActive
            ? "Confirmo a revogação desta autorização."
            : "Confirmo a restauração desta autorização.",
        );
        confirm.control.required = true;
        const action = el(
          "button",
          currentActive ? "secondary-btn danger" : "secondary-btn",
          currentActive ? "Revogar autorização" : "Restaurar autorização",
        );
        action.type = "submit";
        revisionForm.append(
          field("Motivo", reason),
          confirm.label,
          action,
        );
        revisionForm.addEventListener("submit", (event) => {
          event.preventDefault();
          if (!revisionForm.reportValidity()) return;
          const body = assignmentRevisionPayload(
            !currentActive,
            version,
            reason.value,
          );
          beginMutation(
            `/v1/atribuicoes/${encodeURIComponent(assignment.id)}/revisoes`,
            body,
            () =>
              currentActive
                ? "Autorização revogada."
                : "Autorização restaurada.",
            statusNode,
          );
        });
        card.append(revisionForm);
        permissionsBlock.append(card);
      }

      const addForm = el("form", "operational-form admin-add-assignment");
      const addGrid = el("div", "operational-grid");
      const role = select("papel_id");
      role.required = true;
      option(role, "", "Selecione um papel");
      for (const item of catalogs.roles)
        option(role, item.id, item.nome || "Papel sem nome");

      const scope = select("escopo");
      scope.required = true;
      option(scope, "", "Escolha explicitamente o escopo");
      option(scope, "unidade", "Uma unidade específica");
      option(scope, "global", "Todas as unidades da organização");

      const unit = select("unidade_id");
      option(unit, "", "Selecione uma unidade");
      for (const item of catalogs.units)
        option(unit, item.id, item.nome || "Unidade sem nome");
      unit.disabled = true;

      const rolePreview = el(
        "div",
        "operational-note wide",
        "Selecione um papel para consultar suas permissões.",
      );

      role.addEventListener("change", async () => {
        if (!role.value) {
          rolePreview.textContent =
            "Selecione um papel para consultar suas permissões.";
          return;
        }
        try {
          const permissions = await rolePermissions(role.value);
          rolePreview.replaceChildren(
            el("strong", "", roleName(role.value)),
            el(
              "span",
              "",
              permissions.length
                ? permissions.map(humanizePermission).join(" • ")
                : "Papel sem permissões retornadas.",
            ),
          );
        } catch {
          rolePreview.textContent =
            "Não foi possível consultar as permissões deste papel.";
        }
      });

      scope.addEventListener("change", () => {
        unit.disabled = scope.value !== "unidade";
        unit.required = scope.value === "unidade";
        if (scope.value !== "unidade") unit.value = "";
      });

      const addConfirm = checkbox(
        "confirmacao",
        "Conferi o papel e o escopo e confirmo a concessão.",
      );
      addConfirm.control.required = true;
      addGrid.append(
        field("Papel", role),
        field("Escopo", scope),
        field("Unidade", unit),
        rolePreview,
        addConfirm.label,
      );

      const addSubmit = el("button", "primary-btn", "Adicionar autorização");
      addSubmit.type = "submit";
      addForm.append(
        el("h4", "", "Adicionar autorização"),
        addGrid,
        el(
          "div",
          "operational-note warn",
          "O contrato atual de criação da atribuição não aceita motivo. Revogações e restaurações exigem motivo e ficam registradas no histórico.",
        ),
        addSubmit,
      );
      addForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!addForm.reportValidity()) return;
        let body;
        try {
          body = assignmentPayload(
            user.id,
            role.value,
            scope.value,
            unit.value,
          );
        } catch (error) {
          setStatus(statusNode, pilotError(error), "error");
          return;
        }
        const duplicate = userAssignments.find(
          (item) => assignmentKey(item) === assignmentKey(body),
        );
        if (duplicate) {
          setStatus(
            statusNode,
            duplicate.ativo
              ? "Esta autorização já está ativa."
              : "Esta autorização já existe revogada. Use Restaurar autorização em vez de criar outra.",
            "error",
          );
          return;
        }
        beginMutation(
          "/v1/atribuicoes",
          body,
          () => "Autorização adicionada.",
          statusNode,
        );
      });

      permissionsBlock.append(addForm);
      detailNode.append(permissionsBlock);
      detailNode.append(
        await buildHistory(user, userHistory, assignmentHistories),
      );
    } catch (error) {
      detailNode.replaceChildren(
        el(
          "div",
          "operational-disabled",
          error.status === 403
            ? "Seu perfil não possui permissão para administrar este funcionário."
            : "Não foi possível carregar os dados administrativos deste funcionário.",
        ),
      );
    }
  }

  async function renderAdmin() {
    renderVersion += 1;
    const version = renderVersion;
    if (!currentView() || activeModule() !== "administracao") {
      section.hidden = true;
      section.replaceChildren();
      return;
    }

    section.hidden = false;
    section.replaceChildren(
      el("div", "admin-loading", "Carregando gestão de funcionários…"),
    );

    try {
      const ctx = await ownContext();
      if (version !== renderVersion || activeModule() !== "administracao")
        return;
      if (!hasAdminAccess(ctx)) {
        section.replaceChildren(
          el(
            "div",
            "operational-disabled",
            "A gestão de funcionários exige acesso:administrar em escopo global.",
          ),
        );
        return;
      }

      await loadCatalogs();
      if (version !== renderVersion || activeModule() !== "administracao")
        return;

      section.replaceChildren();

      const head = el("div", "admin-management-head");
      const title = el("div");
      title.append(
        el("span", "eyebrow", "DEV / Administração"),
        el("h3", "", "Gestão de funcionários e autorizações"),
        el(
          "p",
          "",
          "Localize funcionários, revise dados, consulte permissões e administre atribuições sem UUIDs, SQL ou edição de arquivos.",
        ),
      );
      const refresh = el("button", "secondary-btn", "Atualizar dados");
      refresh.type = "button";
      head.append(title, refresh);

      const status = el("div", "admin-status");
      status.dataset.adminStatus = "true";
      const toolbar = el("div", "admin-toolbar");
      const search = input(
        "busca",
        "Buscar por nome ou login",
        "search",
      );
      search.value = searchText;
      toolbar.append(field("Localizar funcionário", search, true));

      const layout = el("div", "admin-management-layout");
      const listNode = el("aside", "admin-user-list");
      listNode.dataset.adminList = "true";
      const detailNode = el("div", "admin-user-detail");
      detailNode.dataset.adminDetail = "true";
      layout.append(listNode, detailNode);

      section.append(head, status, toolbar, layout);

      refresh.addEventListener("click", async () => {
        setStatus(status, "Atualizando…");
        rolePermissionCache = new Map();
        await loadCatalogs();
        setStatus(status, "Dados atualizados.", "success");
        await renderEmployeeList(listNode, detailNode, status);
        await renderSelectedUser();
      });

      search.addEventListener("input", async () => {
        searchText = search.value;
        await renderEmployeeList(listNode, detailNode, status);
      });

      await renderEmployeeList(listNode, detailNode, status);
      await renderSelectedUser();
      renderRetry(status);
    } catch (error) {
      section.replaceChildren(
        el(
          "div",
          "operational-disabled",
          error.status === 403
            ? "Seu perfil não possui acesso ao painel administrativo."
            : "Não foi possível carregar a gestão de funcionários.",
        ),
      );
    }
  }

  document.querySelectorAll("[data-module], [data-go]").forEach((button) =>
    button.addEventListener("click", () => setTimeout(renderAdmin, 0)),
  );

  window.addEventListener("hvb-session-ended", () => {
    context = null;
    contextView = "";
    selectedUserId = null;
    searchText = "";
    catalogs = { users: [], roles: [], units: [], assignments: [] };
    rolePermissionCache = new Map();
    pendingMutation = null;
    section.hidden = true;
    section.replaceChildren();
  });
}
