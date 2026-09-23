export const moduleReadPermissions = Object.freeze({
  pacientes: "cadastros:ler",
  agenda: "agenda:ler",
  internacao: "episodios:ler",
  prontuario: "prontuario:ler",
  estoque: "estoque:ler",
  exames: "exames:ler",
  financeiro: "financeiro:ler",
  compras: "compras:ler",
  documentos: "documentos:ler",
  preventivo: "protocolos:ler",
  administracao: "acesso:administrar",
});

export const operationalFlows = Object.freeze({
  employee: Object.freeze({
    module: "administracao",
    requiredPermissions: ["acesso:administrar"],
    existingEndpoints: [
      "POST /v1/usuarios",
      "POST /v1/atribuicoes",
      "POST /v1/credenciais",
      "GET /v1/papeis",
      "GET /v1/unidades",
    ],
    missingContracts: [
      "consulta das permissoes que compoem cada papel",
      "onboarding transacional de usuario + atribuicao",
      "login humano operacional; a credencial DEV nao e login definitivo",
    ],
  }),
  stockEntry: Object.freeze({
    module: "estoque",
    requiredPermissions: [
      "estoque:ler",
      "estoque:catalogar",
      "estoque:movimentar",
    ],
    existingEndpoints: [
      "POST /v1/estoque/lotes",
      "POST /v1/estoque/posicoes",
      "POST /v1/estoque/entradas",
      "GET /v1/estoque/produtos",
      "GET /v1/estoque/apresentacoes",
      "GET /v1/locais",
    ],
    missingContracts: [
      "entrada completa transacional para lote/ocupacao/posicao/quantidade",
      "resolucao explicita da custodia hospitalar no recebimento",
    ],
  }),
});

export function permissionsFor(context, unitId) {
  const permissions = new Set(context?.permissoes_globais || []);
  const unit = (context?.unidades || []).find((item) => item.id === unitId);
  for (const permission of unit?.permissoes || []) permissions.add(permission);
  return permissions;
}

export function canUse(context, unitId, requiredPermissions) {
  const permissions = permissionsFor(context, unitId);
  return requiredPermissions.every((permission) => permissions.has(permission));
}

export function resolveUnit(context, savedUnitId) {
  const units = context?.unidades || [];
  return units.some((unit) => unit.id === savedUnitId)
    ? savedUnitId
    : units[0]?.id || null;
}
