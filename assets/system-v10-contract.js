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
  if (scope === "global") return { papel_id: roleId };
  if (scope !== "unidade" || !unitId) throw new Error("unidade_obrigatoria");
  return { papel_id: roleId, unidade_id: unitId };
}

export function buildPatientSearchPath(query, cursor = null, limit = 25) {
  const params = new URLSearchParams({ limit: String(limit) });
  const q = String(query || "").trim();
  if (q) params.set("q", q);
  if (cursor) params.set("cursor", cursor);
  return `/v1/pacientes?${params}`;
}
