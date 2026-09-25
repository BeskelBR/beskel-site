-- 094_patient_protocol_read_index.sql
-- Acelera leitura de protocolos preventivos por paciente no contrato publicado.
-- Nao altera dados, regras ou payloads.

CREATE INDEX protocolo_paciente_paciente
ON hvb.protocolo_paciente (organizacao_id, unidade_id, paciente_id, id);
