// Canonical 096–098 fields. PostgreSQL owns normalization and constraints.
const optionalText = (maxLength: number) => ({
  type: "string",
  maxLength,
  nullable: true,
});
const birth = { type: "string", format: "date", nullable: true };
export const responsibleExtraFields = {
  cpf: optionalText(32),
  telefone_whatsapp: optionalText(40),
  email: optionalText(254),
  data_nascimento: birth,
  cep: optionalText(20),
  logradouro: optionalText(200),
  numero: optionalText(30),
  complemento: optionalText(120),
  bairro: optionalText(120),
  cidade: optionalText(120),
  uf: optionalText(8),
};
export const patientExtraFields = {
  data_nascimento: birth,
  sexo: optionalText(30),
  raca: optionalText(120),
  microchip: optionalText(64),
  pelagem: optionalText(120),
  castrado: { type: "boolean", nullable: true },
  observacoes: optionalText(4000),
  contato_emergencia_nome: optionalText(160),
  contato_emergencia_telefone: optionalText(40),
  contato_emergencia_vinculo: optionalText(80),
};
