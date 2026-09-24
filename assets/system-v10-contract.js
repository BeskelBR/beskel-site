export const operationalFlows = Object.freeze({
  employee: Object.freeze({
    module: "administracao",
    globalPermissions: ["acesso:administrar"],
    endpoints: Object.freeze({
      rolePermissions: "/v1/papeis/:id/permissoes",
      onboarding: "/v1/usuarios/onboarding",
    }),
  }),
  stockEntry: Object.freeze({
    module: "estoque",
    globalPermissions: ["estoque:ler", "estoque:catalogar"],
    commandUnitPermissions: ["estoque:movimentar"],
    uiUnitPermissions: ["estoque:movimentar", "locais:ler"],
    purchaseUnitPermissions: ["compras:receber"],
    endpoints: Object.freeze({
      complete: "/v1/estoque/entradas-completas",
    }),
  }),
});

export function globalPermissions(context) {
  return new Set(context?.permissoes_globais || []);
}

export function permissionsFor(context, unitId) {
  const permissions = globalPermissions(context);
  const unit = (context?.unidades || []).find((item) => item.id === unitId);
  for (const permission of unit?.permissoes || []) permissions.add(permission);
  return permissions;
}

export function canUseGlobal(context, requiredPermissions) {
  const permissions = globalPermissions(context);
  return requiredPermissions.every((permission) => permissions.has(permission));
}

export function canUseUnit(context, unitId, requiredPermissions) {
  const permissions = permissionsFor(context, unitId);
  return requiredPermissions.every((permission) => permissions.has(permission));
}

export function resolveUnit(context, savedUnitId) {
  const units = context?.unidades || [];
  return units.some((unit) => unit.id === savedUnitId)
    ? savedUnitId
    : units[0]?.id || null;
}

export function assignmentPayload(roleId, scope, unitId) {
  if (!roleId) throw new Error("papel_obrigatorio");
  if (!scope) throw new Error("escopo_obrigatorio");
  if (scope === "global") return { papel_id: roleId };
  if (scope !== "unidade") throw new Error("escopo_invalido");
  if (!unitId) throw new Error("unidade_obrigatoria");
  return { papel_id: roleId, unidade_id: unitId };
}

export function hasTerminalAccess(assignments, unitId) {
  return assignments.some(
    (item) =>
      item.permissoes?.includes("terminal:acessar") &&
      (!item.unidade_id || item.unidade_id === unitId),
  );
}

export function onboardingNfc(enabled, unitId, tag, assignments) {
  if (!enabled) return undefined;
  if (!unitId) throw new Error("unidade_nfc_obrigatoria");
  if (typeof tag !== "string" || tag.length < 8 || tag.length > 256)
    throw new Error("tag_nfc_invalida");
  if (!hasTerminalAccess(assignments, unitId))
    throw new Error("terminal_acessar_ausente");
  return { unidade_id: unitId, tag };
}

export async function readAllPages(read, path, limit = 100) {
  const items = [];
  const seen = new Set();
  let cursor = null;
  let pages = 0;
  do {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    const response = await read(`${path}?${params}`);
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

export function buildPatientSearchPath(query, cursor = null, limit = 25) {
  const params = new URLSearchParams({ limit: String(limit) });
  const q = String(query || "").trim();
  if (q) params.set("q", q);
  if (cursor) params.set("cursor", cursor);
  return `/v1/pacientes?${params}`;
}
