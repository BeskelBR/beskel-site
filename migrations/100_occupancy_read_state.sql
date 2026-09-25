
CREATE OR REPLACE VIEW hvb.ocupacao_consulta
WITH (security_invoker=true)
AS
SELECT
  o.id,
  o.organizacao_id,
  o.unidade_id,
  o.episodio_id,
  e.paciente_id,
  p.nome AS paciente_nome,
  e.tipo AS episodio_tipo,
  CASE
    WHEN e.encerrado_em IS NOT NULL THEN 'encerrado'
    WHEN e.alta_clinica_em IS NOT NULL THEN 'alta_clinica'
    ELSE 'ativo'
  END AS episodio_estado,
  o.local_id,
  l.nome AS local_nome,
  l.tipo AS local_tipo,
  o.vaga,
  o.inicio,
  o.fim,
  CASE
    WHEN o.fim IS NULL OR o.fim > clock_timestamp() THEN 'ativa'
    ELSE 'encerrada'
  END AS estado,
  o.autor_id,
  o.encerrada_por_id,
  o.motivo_fim,
  o.registrado_em
FROM hvb.ocupacao o
JOIN hvb.episodio e
  ON e.organizacao_id=o.organizacao_id
 AND e.unidade_id=o.unidade_id
 AND e.id=o.episodio_id
JOIN hvb.paciente p
  ON p.organizacao_id=e.organizacao_id
 AND p.id=e.paciente_id
JOIN hvb.local l
  ON l.organizacao_id=o.organizacao_id
 AND l.unidade_id=o.unidade_id
 AND l.id=o.local_id;

GRANT SELECT ON hvb.ocupacao_consulta TO hvb_app;
