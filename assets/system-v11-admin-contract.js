export function appendPage(path, cursor = null, limit = 100) {
  const url = new URL(path, "http://hvb.local");
  url.searchParams.set("limit", String(limit));
  if (cursor) url.searchParams.set("cursor", cursor);
  else url.searchParams.delete("cursor");
  return `${url.pathname}${url.search}`;
}

export function filterEmployees(users, query) {
  const q = String(query || "").trim().toLocaleLowerCase("pt-BR");
  if (!q) return users;
  return users.filter((user) =>
    [user.nome, user.login]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(q)),
  );
}

export function assignmentPayload(userId, roleId, scope, unitId) {
  if (!userId) throw new Error("funcionario_obrigatorio");
  if (!roleId) throw new Error("papel_obrigatorio");
  if (scope === "global") return { usuario_id: userId, papel_id: roleId };
  if (scope !== "unidade") throw new Error("escopo_obrigatorio");
  if (!unitId) throw new Error("unidade_obrigatoria");
  return { usuario_id: userId, papel_id: roleId, unidade_id: unitId };
}

export function assignmentKey({ papel_id, unidade_id }) {
  return `${papel_id}:${unidade_id || "global"}`;
}

export function userRevisionPayload({ nome, login }, version, reason) {
  const motivo = String(reason || "").trim();
  if (!motivo) throw new Error("motivo_obrigatorio");
  if (!Number.isInteger(version) || version < 0)
    throw new Error("versao_invalida");
  return {
    motivo,
    versao_esperada: version,
    simulacao: true,
    confirmacao_humana: true,
    dados: {
      nome: String(nome || "").trim(),
      login: String(login || "").trim(),
    },
  };
}

export function assignmentRevisionPayload(active, version, reason) {
  const motivo = String(reason || "").trim();
  if (!motivo) throw new Error("motivo_obrigatorio");
  if (!Number.isInteger(version) || version < 0)
    throw new Error("versao_invalida");
  return {
    motivo,
    versao_esperada: version,
    simulacao: true,
    confirmacao_humana: true,
    ativo: Boolean(active),
  };
}

export function humanizePermission(code) {
  const [resource = "", action = ""] = String(code || "").split(":");
  const words = (value) =>
    value
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  return [words(resource), words(action)].filter(Boolean).join(" · ");
}

export function scopeLabel(assignment, unitsById) {
  if (!assignment.unidade_id) return "Todas as unidades";
  return unitsById.get(assignment.unidade_id)?.nome || "Unidade não disponível";
}
