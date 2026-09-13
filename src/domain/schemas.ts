export const uuid = { type: "string", format: "uuid" } as const;
export const text = {
  type: "string",
  minLength: 1,
  maxLength: 160,
  pattern: "\\S",
} as const;
export const time = { type: "string", format: "date-time" } as const;
export const integer = {
  type: "integer",
  minimum: 1,
  maximum: 2147483647,
} as const;
export function choice(...values: string[]) {
  return { type: "string", enum: values };
}
export function object(
  properties: Record<string, unknown>,
  required = Object.keys(properties),
) {
  return { type: "object", properties, required, additionalProperties: false };
}
export const inputs = {
  unidade: object({ nome: text, fuso: choice("America/Sao_Paulo") }),
  usuario: object({
    nome: text,
    login: { ...text, pattern: "^[a-z0-9._-]{3,80}$" },
  }),
  papel: object({
    nome: text,
    permissoes: {
      type: "array",
      items: text,
      minItems: 1,
      maxItems: 30,
      uniqueItems: true,
    },
  }),
  atribuicao: object({ usuario_id: uuid, papel_id: uuid, unidade_id: uuid }, [
    "usuario_id",
    "papel_id",
  ]),
  credencial: object({
    usuario_id: uuid,
    tipo: choice("api", "nfc"),
    token: { type: "string", pattern: "^[a-f0-9]{64}$" },
    expira_em: time,
  }),
  motivo: object({ motivo: text }),
  dispositivo: object({ nome: text, unidade_id: uuid }),
  responsavel: object({ nome: text }),
  paciente: object({
    nome: text,
    especie_codigo: choice("canina", "felina", "outra", "desconhecida"),
    estado_vital: choice("vivo", "obito", "desconhecido"),
  }),
  vinculo: object({
    paciente_id: uuid,
    responsavel_id: uuid,
    papel: choice("legal", "financeiro", "contato"),
    inicio: time,
  }),
  fimVinculo: object({ fim: time, motivo: text }),
  episodio: object({
    paciente_id: uuid,
    unidade_id: uuid,
    tipo: choice("atendimento", "internacao"),
    admitido_em: time,
  }),
  transicao: object({
    ocorrido_em: time,
    motivo: text,
    versao_esperada: integer,
  }),
  local: object(
    {
      nome: text,
      unidade_id: uuid,
      pai_id: uuid,
      tipo: choice("setor", "box", "sala", "armario"),
      capacidade: { type: "integer", minimum: 0, maximum: 1000 },
    },
    ["nome", "unidade_id", "tipo", "capacidade"],
  ),
  ocupacao: object({
    episodio_id: uuid,
    local_id: uuid,
    vaga: integer,
    inicio: time,
  }),
  fimOcupacao: object({ fim: time, motivo: text }),
  lote: object({ origem: choice("sintetico-dev") }),
  externo: object({
    lote_importacao_id: uuid,
    entidade: choice("paciente", "responsavel", "episodio"),
    entidade_id: uuid,
    codigo_externo: text,
    qualidade: choice("pendente", "validado"),
  }),
};
export const permissions = [
  "cadastros:ler",
  "cadastros:escrever",
  "episodios:ler",
  "episodios:escrever",
  "locais:ler",
  "locais:escrever",
  "acesso:administrar",
  "auditoria:ler",
  "dispositivos:usar",
  "proveniencia:administrar",
  "estoque:ler",
  "estoque:catalogar",
  "estoque:movimentar",
  "estoque:reservar",
  "estoque:inventariar",
  "estoque:ajustar",
  "estoque:reverter",
];
