-- 095_portal_patient_read_index.sql
-- Acelera concessoes e mensagens da area do cliente filtradas por paciente.
-- Nao altera dados, regras ou payloads.

CREATE INDEX concessao_portal_paciente
ON hvb.concessao_portal (organizacao_id, unidade_id, paciente_id, id);
