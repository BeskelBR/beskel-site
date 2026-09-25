-- 079_clinical_patient_episode_integrity.sql
-- Garante que referencias redundantes de paciente/episodio pertencam ao mesmo contexto clinico.
-- Aditiva: preserva constraints e contratos existentes.

SET search_path=hvb,public;

ALTER TABLE hvb.episodio
  ADD CONSTRAINT episodio_organizacao_id_unidade_id_paciente_id_id_key
  UNIQUE (organizacao_id, unidade_id, paciente_id, id);

ALTER TABLE hvb.evolucao_clinica
  ADD CONSTRAINT evolucao_clinica_organizacao_id_unidade_id_paciente_id_episodio_id_fkey
  FOREIGN KEY (organizacao_id, unidade_id, paciente_id, episodio_id)
  REFERENCES hvb.episodio(organizacao_id, unidade_id, paciente_id, id);

ALTER TABLE hvb.solicitacao_documento
  ADD CONSTRAINT solicitacao_documento_organizacao_id_unidade_id_paciente_id_episodio_id_fkey
  FOREIGN KEY (organizacao_id, unidade_id, paciente_id, episodio_id)
  REFERENCES hvb.episodio(organizacao_id, unidade_id, paciente_id, id);
