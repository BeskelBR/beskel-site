
CREATE OR REPLACE VIEW hvb.episodio_consulta
WITH (security_invoker=true)
AS
SELECT
  e.id,
  e.organizacao_id,
  e.unidade_id,
  e.paciente_id,
  p.nome AS paciente_nome,
  e.tipo,
  e.admitido_em,
  e.alta_clinica_em,
  e.encerrado_em,
  CASE
    WHEN e.encerrado_em IS NOT NULL THEN 'encerrado'
    WHEN e.alta_clinica_em IS NOT NULL THEN 'alta_clinica'
    ELSE 'ativo'
  END AS estado,
  e.versao,
  e.autor_id,
  e.registrado_em
FROM hvb.episodio e
JOIN hvb.paciente p
  ON p.organizacao_id=e.organizacao_id
 AND p.id=e.paciente_id;

GRANT SELECT ON hvb.episodio_consulta TO hvb_app;
