import { createPilotClient, pilotError } from "./pilot-api.js";
import {
  assignmentPayload,
  canUseGlobal,
  canUseUnit,
  operationalFlows,
  resolveUnit,
} from "./system-v10-contract.js";

const detailView = document.querySelector('[data-module-view="detail"]');
const detailHead = detailView?.querySelector(".detail-head");

if (detailView && detailHead) {
  const section = document.createElement("section");
  section.className = "operational-actions";
  section.hidden = true;
  section.setAttribute("aria-live", "polite");
  detailHead.insertAdjacentElement("afterend", section);

  const client = createPilotClient({
    base: location.origin.replace(/\/$/, ""),
    fetcher: (...args) => window.HVBSession.fetch(...args),
  });

  let context = null;
  let contextView = "";
  let renderVersion = 0;

  const currentView = () => sessionStorage.getItem("hvb-session-view") || "";
  const activeModule = () =>
    document.querySelector(".nav-item.active")?.dataset.module || "dashboard";

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

  async function readAllPages(path, limit = 100) {
    const items = [];
    const seen = new Set();
    let cursor = null;
    let pages = 0;
    do {
      const url = new URL(path, location.origin);
      url.searchParams.set("limit", String(limit));
      if (cursor) url.searchParams.set("cursor", cursor);
      else url.searchParams.delete("cursor");
      const response = await client.read(`${url.pathname}${url.search}`);
      for (const item of response.items || []) {
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
      }
      cursor = response.next_cursor || null;
      pages += 1;
      if (pages > 1000)
        throw Object.assign(new Error("paginacao_excedida"), { status: 503 });
    } while (cursor);
    return items;
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

  function heading(eyebrow, title, description, state = "Contrato disponível") {
    const head = el("div", "operational-head");
    const copy = el("div");
    copy.append(
      el("span", "eyebrow", eyebrow),
      el("h3", "", title),
      el("p", "", description),
    );
    head.append(copy, el("span", "operational-state", state));
    return head;
  }

  function note(title, body, warn = false) {
    const box = el("div", `operational-note${warn ? " warn" : ""}`);
    box.append(el("strong", "", title), el("span", "", body));
    return box;
  }

  function feedbackNode() {
    const node = el("div", "operational-feedback");
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    return node;
  }

  function setFeedback(node, message, kind = "") {
    node.textContent = message || "";
    node.className = `operational-feedback ${kind}`.trim();
  }

  function disabledMessage(text) {
    section.replaceChildren(
      heading("Acesso e permissões", "Operação não disponível", text, "Restrito"),
      el(
        "div",
        "operational-disabled",
        "A interface respeita o escopo devolvido por /v1/me/contexto. Nenhuma gravação foi enviada.",
      ),
    );
  }

  function contractDetails(lines) {
    const details = el("details", "operational-contract");
    details.append(el("summary", "", "Contrato técnico integrado"));
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

  function checkbox(name, text) {
    const label = el("label", "operational-check wide");
    const control = document.createElement("input");
    control.type = "checkbox";
    control.name = name;
    const span = el("span", "", text);
    label.append(control, span);
    return { label, control };
  }

  function toInstant(value) {
    const date = new Date(value);
    if (!value || !Number.isFinite(date.getTime()) || date.getTime() > Date.now())
      throw Object.assign(new Error("horario_invalido_ou_futuro"), {
        status: 400,
      });
    return date.toISOString();
  }

  function decimal(value, optional = false) {
    const normalized = String(value || "").trim();
    if (!normalized && optional) return undefined;
    if (!/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$/.test(normalized))
      throw Object.assign(new Error("decimal_invalido"), { status: 400 });
    return normalized;
  }

  function createIntentFlow({
    form,
    fieldset,
    submit,
    retry,
    feedback,
    path,
    buildBody,
    onSuccess,
  }) {
    let pending = null;
    let busy = false;

    function sync() {
      fieldset.disabled = busy || Boolean(pending);
      submit.disabled = busy || Boolean(pending);
      retry.hidden = !pending;
      retry.disabled = busy;
    }

    async function transmit() {
      if (!pending || busy) return;
      busy = true;
      sync();
      setFeedback(feedback, "Enviando…");
      const active = pending;
      try {
        const result = await client.send(active);
        pending = null;
        await onSuccess(result);
      } catch (error) {
        // Falha HTTP definitiva libera nova intenção. Erro sem status (rede/recibo
        // perdido) é ambíguo e mantém exatamente a mesma chave/corpo para retry.
        if (error.status && !error.uncertain) pending = null;
        setFeedback(
          feedback,
          `${pilotError(error)}${pending ? " O resultado pode ter sido gravado; use Repetir com a mesma chave." : ""}`,
          "error",
        );
      } finally {
        busy = false;
        sync();
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (pending || busy || !form.reportValidity()) return;
      try {
        pending = client.prepare(path, buildBody());
      } catch (error) {
        setFeedback(feedback, pilotError(error), "error");
        return;
      }
      sync();
      await transmit();
    });

    retry.addEventListener("click", transmit);
    sync();
  }

  async function renderEmployee(version) {
    section.hidden = false;
    section.replaceChildren(
      heading(
        "Administração",
        "Cadastro de funcionário e autorizações",
        "Cria o usuário e suas atribuições em uma única intenção idempotente. Credencial e login humano continuam fora deste fluxo.",
      ),
    );

    const ctx = await ownContext();
    if (version !== renderVersion || activeModule() !== "administracao") return;
    if (
      !canUseGlobal(ctx, operationalFlows.employee.globalPermissions)
    ) {
      disabledMessage(
        "Seu contexto não possui acesso:administrar em escopo global.",
      );
      return;
    }

    const roles = await readAllPages("/v1/papeis", 100);
    if (version !== renderVersion || activeModule() !== "administracao") return;

    const roleById = new Map(roles.map((item) => [item.id, item]));
    const unitById = new Map((ctx.unidades || []).map((item) => [item.id, item]));
    const permissionsCache = new Map();
    const assignments = [];

    const form = el("form", "operational-form");
    const fieldset = el("fieldset", "operational-fieldset");
    const grid = el("div", "operational-grid");

    const name = input("nome", "Ex.: Funcionário fictício");
    name.required = true;
    name.maxLength = 160;

    const login = input("login", "Ex.: funcionario.dev");
    login.required = true;
    login.minLength = 3;
    login.maxLength = 80;
    login.pattern = "[a-z0-9._-]{3,80}";

    const reason = input("motivo", "Motivo do cadastro");
    reason.required = true;
    reason.maxLength = 160;

    const role = select("papel_id");
    role.required = true;
    option(role, "", "Selecione um papel");
    for (const item of roles) option(role, item.id, item.nome || "Papel sem nome");

    const scope = select("escopo");
    scope.required = true;
    option(scope, "", "Selecione o escopo...");
    option(scope, "unidade", "Somente uma unidade");
    option(scope, "global", "Todas as unidades da organização");

    const unit = select("unidade_id");
    option(unit, "", "Selecione uma unidade");
    for (const item of ctx.unidades || [])
      option(unit, item.id, item.nome || "Unidade sem nome");
    unit.disabled = true;
    unit.required = false;
    const permissionPreview = note(
      "Permissões do papel",
      "Selecione um papel para consultar os códigos efetivos.",
    );

    const assignmentList = el("div", "operational-assignment-list wide");

    function renderAssignments() {
      assignmentList.replaceChildren();
      if (!assignments.length) {
        assignmentList.append(
          el(
            "div",
            "operational-disabled",
            "Nenhuma autorização adicionada. O onboarding exige ao menos uma atribuição.",
          ),
        );
        return;
      }
      assignments.forEach((item, index) => {
        const card = el("div", "operational-assignment");
        const copy = el("div");
        copy.append(
          el(
            "strong",
            "",
            roleById.get(item.papel_id)?.nome || "Papel selecionado",
          ),
          el(
            "span",
            "",
            item.unidade_id
              ? `Unidade: ${unitById.get(item.unidade_id)?.nome || "Unidade não disponível"}`
              : "Escopo: todas as unidades da organização",
          ),
          el(
            "small",
            "",
            item.permissoes.length
              ? item.permissoes.join(" • ")
              : "Papel sem permissões retornadas.",
          ),
        );
        const remove = el("button", "secondary-btn", "Remover");
        remove.type = "button";
        remove.addEventListener("click", () => {
          assignments.splice(index, 1);
          renderAssignments();
        });
        card.append(copy, remove);
        assignmentList.append(card);
      });
    }

    async function loadPermissions(roleId = role.value) {
      if (!roleId) {
        permissionPreview.querySelector("span").textContent =
          "Selecione um papel para consultar os códigos efetivos.";
        return [];
      }
      if (!permissionsCache.has(roleId)) {
        const data = await client.read(
          `/v1/papeis/${encodeURIComponent(roleId)}/permissoes`,
        );
        permissionsCache.set(roleId, data.permissoes || []);
      }
      const permissions = permissionsCache.get(roleId) || [];
      if (role.value === roleId)
        permissionPreview.querySelector("span").textContent =
          permissions.length
            ? permissions.join(" • ")
            : "O backend retornou este papel sem permissões.";
      return permissions;
    }

    role.addEventListener("change", () => {
      loadPermissions().catch(() => {
        permissionPreview.querySelector("span").textContent =
          "Não foi possível consultar as permissões deste papel.";
      });
    });

    scope.addEventListener("change", () => {
      const byUnit = scope.value === "unidade";
      unit.disabled = !byUnit;
      unit.required = byUnit;
      if (!byUnit) unit.value = "";
    });

    const addAssignment = el("button", "secondary-btn", "Adicionar autorização");
    addAssignment.type = "button";
    addAssignment.addEventListener("click", async () => {
      if (!role.value) {
        role.reportValidity();
        return;
      }
      if (!scope.value) {
        scope.reportValidity();
        return;
      }
      if (scope.value === "unidade" && !unit.value) {
        unit.reportValidity();
        return;
      }
      try {
        if (assignments.length >= 50) {
          permissionPreview.querySelector("span").textContent =
            "O onboarding aceita no máximo 50 autorizações.";
          return;
        }
        const selectedRoleId = role.value;
        const permissions = await loadPermissions(selectedRoleId);
        const payload = assignmentPayload(
          selectedRoleId,
          scope.value,
          unit.value,
        );
        const key = `${payload.papel_id}:${payload.unidade_id || "global"}`;
        if (
          assignments.some(
            (item) =>
              `${item.papel_id}:${item.unidade_id || "global"}` === key,
          )
        ) {
          permissionPreview.querySelector("span").textContent =
            "Esta autorização já foi adicionada.";
          return;
        }
        assignments.push({ ...payload, permissoes: permissions });
        renderAssignments();
        scope.value = "";
        unit.value = "";
        unit.disabled = true;
        unit.required = false;
      } catch {
        permissionPreview.querySelector("span").textContent =
          "Não foi possível adicionar a autorização.";
      }
    });

    grid.append(
      field("Nome", name),
      field("Login", login),
      field("Motivo", reason, true),
      field("Papel / perfil", role),
      field("Escopo da autorização", scope),
      field("Unidade", unit),
      permissionPreview,
      addAssignment,
      assignmentList,
    );

    const confirm = checkbox(
      "confirmacao",
      "Conferi os dados e confirmo o cadastro neste ambiente DEV.",
    );
    confirm.control.required = true;

    const submit = el("button", "primary-btn", "Cadastrar funcionário");
    submit.type = "submit";
    const actions = el("div", "operational-actions-row");
    actions.append(
      submit,
      el(
        "small",
        "",
        "O onboarding não cria senha, NFC, credencial API ou identidade humana.",
      ),
    );

    fieldset.append(
      grid,
      confirm.label,
      actions,
      note(
        "Identidade futura",
        "Login humano continua pendente. A proposta servidor-servidor do backend não é um endpoint disponível para esta tela.",
        true,
      ),
    );

    const retry = el("button", "secondary-btn", "Repetir com a mesma chave");
    retry.type = "button";
    retry.hidden = true;
    const feedback = feedbackNode();

    form.append(
      fieldset,
      retry,
      feedback,
      contractDetails([
        "GET /v1/papeis/{id}/permissoes",
        "POST /v1/usuarios/onboarding",
        "GET /v1/me/contexto",
      ]),
    );
    section.append(form);
    renderAssignments();

    createIntentFlow({
      form,
      fieldset,
      submit,
      retry,
      feedback,
      path: "/v1/usuarios/onboarding",
      buildBody: () => {
        if (!assignments.length)
          throw Object.assign(new Error("adicione_uma_autorizacao"), {
            status: 400,
          });
        return {
          nome: name.value.trim(),
          login: login.value.trim(),
          motivo: reason.value.trim(),
          atribuicoes: assignments.map(({ papel_id, unidade_id }) => ({
            papel_id,
            ...(unidade_id ? { unidade_id } : {}),
          })),
        };
      },
      onSuccess: async (result) => {
        const count = result.atribuicao_ids?.length || 0;
        setFeedback(
          feedback,
          `Funcionário cadastrado: ${result.usuario_id || result.id}. ${count} autorização(ões). Nenhuma credencial foi criada.`,
          "success",
        );
        form.reset();
        assignments.splice(0);
        renderAssignments();
        scope.value = "";
        unit.value = "";
        unit.disabled = true;
        unit.required = false;
        permissionPreview.querySelector("span").textContent =
          "Selecione um papel para consultar os códigos efetivos.";
      },
    });
  }

  async function renderStockEntry(version) {
    section.hidden = false;
    section.replaceChildren(
      heading(
        "Estoque",
        "Registrar entrada de lote novo",
        "Cria lote, custódia hospitalar, posição M2 e entrada na mesma intenção. Não cria coordenada do Terminal.",
      ),
    );

    const ctx = await ownContext();
    if (version !== renderVersion || activeModule() !== "estoque") return;
    const flow = operationalFlows.stockEntry;
    const savedUnit = localStorage.getItem("hvb-unit-id");
    const eligibleUnits = (ctx.unidades || []).filter((item) =>
      canUseUnit(ctx, item.id, flow.uiUnitPermissions),
    );
    const unitId = eligibleUnits.some((item) => item.id === savedUnit)
      ? savedUnit
      : eligibleUnits[0]?.id || null;

    const globalOk = canUseGlobal(ctx, flow.globalPermissions);
    if (!unitId || !globalOk) {
      disabledMessage(
        "A entrada completa exige estoque:ler e estoque:catalogar globais. Para selecionar o local, a interface também precisa de estoque:movimentar e locais:ler na unidade.",
      );
      return;
    }

    const [products, presentations, locations] = await Promise.all([
      client.read("/v1/estoque/produtos?limit=100").then((x) => x.items || []),
      client
        .read("/v1/estoque/apresentacoes?limit=100")
        .then((x) => x.items || []),
      client
        .read(
          `/v1/locais?limit=100&unidade_id=${encodeURIComponent(unitId)}`,
        )
        .then((x) => x.items || []),
    ]);
    if (version !== renderVersion || activeModule() !== "estoque") return;

    const productById = new Map(products.map((item) => [item.id, item]));
    const form = el("form", "operational-form");
    const fieldset = el("fieldset", "operational-fieldset");
    const grid = el("div", "operational-grid");

    const unit = select("unidade_id");
    for (const item of eligibleUnits)
      option(unit, item.id, item.nome || item.id);
    unit.value = unitId;
    unit.disabled = eligibleUnits.length < 2;
    unit.addEventListener("change", () => {
      localStorage.setItem("hvb-unit-id", unit.value);
      setTimeout(renderCurrent, 0);
    });

    const presentation = select("apresentacao_id");
    presentation.required = true;
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
    lotCode.required = true;
    lotCode.maxLength = 160;

    const manufacturer = input("fabricante", "Fabricante");
    manufacturer.required = true;
    manufacturer.maxLength = 160;

    const expiryState = select("situacao_validade");
    option(expiryState, "conhecida", "Validade conhecida");
    option(expiryState, "pendente", "Validade pendente");
    option(expiryState, "isenta", "Isenta");

    const expiry = input("validade", "", "date");
    expiry.required = true;

    const location = select("local_id");
    location.required = true;
    option(location, "", "Selecione a localização");
    for (const item of locations)
      option(location, item.id, item.nome || item.id);

    const quantity = input("quantidade_apresentacoes", "Ex.: 20");
    quantity.required = true;
    quantity.inputMode = "decimal";
    quantity.pattern = "(0|[1-9][0-9]{0,13})(\\.[0-9]{1,6})?";

    const cost = input("custo_base", "Opcional • custo base");
    cost.inputMode = "decimal";
    cost.pattern = "(0|[1-9][0-9]{0,13})(\\.[0-9]{1,6})?";

    const occurred = input("ocorrido_em", "", "datetime-local");
    occurred.required = true;

    const reason = input("motivo", "Motivo / referência operacional");
    reason.required = true;
    reason.maxLength = 160;

    const purchaseAuthorized = canUseUnit(
      ctx,
      unitId,
      flow.purchaseUnitPermissions,
    );
    const purchase = checkbox(
      "origem_compra",
      purchaseAuthorized
        ? "Esta entrada corresponde a um item de pedido de compra já aprovado."
        : "Origem por compra indisponível: falta compras:receber nesta unidade.",
    );
    purchase.control.disabled = !purchaseAuthorized;

    const purchaseBox = el("div", "operational-purchase wide");
    purchaseBox.hidden = true;
    const purchaseGrid = el("div", "operational-grid");
    const orderId = input("pedido_id", "UUID do pedido aprovado");
    const itemId = input("item_pedido_id", "UUID do item do pedido");
    const supplierDoc = input(
      "documento_fornecedor",
      "Documento/comprovante do fornecedor",
    );
    supplierDoc.maxLength = 160;
    purchaseGrid.append(
      field("Pedido de compra", orderId),
      field("Item do pedido", itemId),
      field("Documento do fornecedor", supplierDoc, true),
    );
    purchaseBox.append(
      note(
        "Recebimento integrado",
        "Ao confirmar, a UI envia somente /v1/estoque/entradas-completas com o objeto compra. Não existe segundo POST de recebimento.",
      ),
      purchaseGrid,
    );

    purchase.control.addEventListener("change", () => {
      const enabled = purchase.control.checked;
      purchaseBox.hidden = !enabled;
      for (const control of [orderId, itemId, supplierDoc])
        control.required = enabled;
    });

    expiryState.addEventListener("change", () => {
      const known = expiryState.value === "conhecida";
      expiry.required = known;
      expiry.disabled = !known;
      if (!known) expiry.value = "";
    });

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
      field("Motivo", reason, true),
      purchase.label,
      purchaseBox,
    );

    const confirm = checkbox(
      "confirmacao",
      "Conferi lote, quantidade, localização e origem; confirmo esta operação DEV.",
    );
    confirm.control.required = true;

    const submit = el("button", "primary-btn", "Registrar entrada");
    submit.type = "submit";
    const actions = el("div", "operational-actions-row");
    actions.append(
      submit,
      el(
        "small",
        "",
        "Este fluxo é apenas para lote novo. Lote já existente deve usar os contratos específicos já publicados.",
      ),
    );

    fieldset.append(
      grid,
      confirm.label,
      actions,
      note(
        "Escopo preservado",
        "Catálogo continua global na organização. Posição e movimentação permanecem vinculadas à unidade. O Terminal congelado não é acionado.",
      ),
    );

    const retry = el("button", "secondary-btn", "Repetir com a mesma chave");
    retry.type = "button";
    retry.hidden = true;
    const feedback = feedbackNode();

    form.append(
      fieldset,
      retry,
      feedback,
      contractDetails([
        "POST /v1/estoque/entradas-completas",
        "GET /v1/estoque/produtos",
        "GET /v1/estoque/apresentacoes",
        "GET /v1/locais",
      ]),
    );
    section.append(form);

    createIntentFlow({
      form,
      fieldset,
      submit,
      retry,
      feedback,
      path: "/v1/estoque/entradas-completas",
      buildBody: () => {
        if (
          purchase.control.checked &&
          !canUseUnit(ctx, unitId, flow.purchaseUnitPermissions)
        )
          throw Object.assign(new Error("compras_receber_nao_autorizado"), {
            status: 403,
          });

        const quantityValue = decimal(quantity.value);
        if (Number(quantityValue) <= 0)
          throw Object.assign(new Error("quantidade_deve_ser_positiva"), {
            status: 400,
          });

        const lot = {
          apresentacao_id: presentation.value,
          fabricante: manufacturer.value.trim(),
          codigo: lotCode.value.trim(),
          situacao_validade: expiryState.value,
          ...(expiryState.value === "conhecida"
            ? { validade: expiry.value }
            : {}),
        };
        const costValue = decimal(cost.value, true);
        if (costValue !== undefined) lot.custo_base = costValue;

        return {
          unidade_id: unitId,
          local_id: location.value,
          lote: lot,
          quantidade_apresentacoes: quantityValue,
          ocorrido_em: toInstant(occurred.value),
          motivo: reason.value.trim(),
          ...(purchase.control.checked
            ? {
                compra: {
                  pedido_id: orderId.value.trim(),
                  item_pedido_id: itemId.value.trim(),
                  referencia: crypto.randomUUID(),
                  documento_fornecedor: supplierDoc.value.trim(),
                  simulacao: true,
                  confirmacao_humana: true,
                },
              }
            : {}),
        };
      },
      onSuccess: async (result) => {
        setFeedback(
          feedback,
          result.recebimento_id
            ? `Entrada e recebimento confirmados. Lote ${result.lote_id}; recebimento ${result.recebimento_id}. Nenhum segundo recebimento foi enviado.`
            : `Entrada confirmada. Lote ${result.lote_id}; posição ${result.posicao_id}.`,
          "success",
        );
        form.reset();
        unit.value = unitId;
        purchaseBox.hidden = true;
        expiry.disabled = false;
        expiry.required = true;
      },
    });
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
          "Não foi possível carregar o fluxo",
          pilotError(error),
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
