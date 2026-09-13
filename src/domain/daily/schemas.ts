import { choice, integer, object, text, time, uuid } from "../schemas.ts";
import { amount } from "../inventory/schemas.ts";
const confirmation = { type: "boolean", const: true };
const version = { codigo: text, versao: integer, descricao: text };
const expected = { type: "integer", minimum: 0, maximum: 2147483647 };
export const dailyInputs = {
  dailyVersion: object(version),
  weight: object({
    episodio_id: uuid,
    quantidade: amount,
    unidade_medida_id: uuid,
    medida_em: time,
    motivo: text,
  }),
  episodeClass: object(
    {
      episodio_id: uuid,
      classificacao_versao_id: uuid,
      inicio: time,
      medicao_peso_id: uuid,
      avaliacao_clinica_id: uuid,
      suporte_ventilatorio: choice(
        "informado_sim",
        "informado_nao",
        "nao_informado",
      ),
      motivo: text,
    },
    [
      "episodio_id",
      "classificacao_versao_id",
      "inicio",
      "suporte_ventilatorio",
      "motivo",
    ],
  ),
  endClass: object({ fim: time, motivo: text }),
  groupMember: object({ grupo_versao_id: uuid, item_clinico_id: uuid }),
  dailyPackage: object(
    {
      ...version,
      classificacao_versao_id: uuid,
      base_temporal: choice("pendente", "periodo_explicito"),
      limite_encerramento: choice(
        "pendente",
        "alta_clinica",
        "saida_fisica",
        "intervalo_informado",
      ),
      politica_tolerancia: choice("pendente", "sem_tolerancia"),
      mudanca_classe: choice("pendente", "exige_novo_periodo"),
      simulacao: confirmation,
    },
    [
      ...Object.keys(version),
      "base_temporal",
      "limite_encerramento",
      "politica_tolerancia",
      "mudanca_classe",
      "simulacao",
    ],
  ),
  dailyRule: object(
    {
      pacote_versao_id: uuid,
      item_clinico_id: uuid,
      grupo_versao_id: uuid,
      produto_id: uuid,
      dimensao: choice(
        "pendente",
        "quantidade_fisica",
        "administracoes",
        "itens_distintos",
      ),
      janela: choice("pendente", "periodo", "episodio"),
      prioridade: integer,
      tratamento: choice(
        "pendente",
        "incluido_limitado",
        "incluido_sem_limite",
        "excluido",
      ),
      limite_quantidade: amount,
      unidade_limite_id: uuid,
      tratamento_excedente: choice("pendente", "revisao_comercial"),
    },
    [
      "pacote_versao_id",
      "dimensao",
      "janela",
      "prioridade",
      "tratamento",
      "tratamento_excedente",
    ],
  ),
  approveDaily: object({
    simulacao: confirmation,
    confirmacao_humana: confirmation,
    motivo: text,
  }),
  episodePackage: object({
    episodio_id: uuid,
    pacote_versao_id: uuid,
    inicio: time,
    fim: time,
    motivo: text,
    simulacao: confirmation,
  }),
  dailyPeriod: object(
    {
      pacote_episodio_id: uuid,
      classificacao_episodio_id: uuid,
      inicio: time,
      fim: time,
      motivo: text,
    },
    ["pacote_episodio_id", "inicio", "fim", "motivo"],
  ),
  coverageEvent: object(
    { execucao_id: uuid, consumo_item_id: uuid, motivo: text },
    ["motivo"],
  ),
  coverageEvaluation: object(
    { periodo_diaria_id: uuid, versao_esperada: expected, motivo: text },
    ["versao_esperada", "motivo"],
  ),
  coverageReserve: object({
    evento_id: uuid,
    periodo_diaria_id: uuid,
    expira_em: time,
    motivo: text,
  }),
  coverageFulfill: object({ versao_esperada: expected, motivo: text }),
};
export const dailyPermissions = [
  "diarias:ler",
  "diarias:configurar",
  "diarias:aprovar_simulacao",
  "diarias:classificar",
  "diarias:associar",
  "diarias:avaliar",
  "diarias:reservar",
  "diarias:reverter",
];
