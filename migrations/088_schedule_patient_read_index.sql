-- 088_schedule_patient_read_index.sql
-- Acelera mapa/listagem de agenda filtrados por paciente no contrato publicado.
-- Nao altera dados, regras ou payloads.

CREATE INDEX agendamento_paciente
ON hvb.agendamento (organizacao_id, unidade_id, paciente_id, id);
