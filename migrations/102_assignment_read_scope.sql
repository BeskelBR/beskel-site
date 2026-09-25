
CREATE OR REPLACE VIEW hvb.atribuicao_consulta
WITH (security_invoker=true)
AS
SELECT
  up.id,
  up.organizacao_id,
  up.usuario_id,
  up.papel_id,
  up.unidade_id,
  COALESCE(r.ativo,true) AS ativo,
  COALESCE(r.versao,0) AS versao,
  u.nome AS usuario_nome,
  p.nome AS papel_nome,
  CASE WHEN up.unidade_id IS NULL THEN 'global' ELSE 'unidade' END AS escopo,
  uh.nome AS unidade_nome
FROM hvb.usuario_papel up
JOIN hvb.usuario u
  ON u.organizacao_id=up.organizacao_id AND u.id=up.usuario_id
JOIN hvb.papel p
  ON p.organizacao_id=up.organizacao_id AND p.id=up.papel_id
LEFT JOIN hvb.unidade_hospitalar uh
  ON uh.organizacao_id=up.organizacao_id AND uh.id=up.unidade_id
LEFT JOIN LATERAL (
  SELECT ra.ativo,ra.versao
  FROM hvb.revisao_atribuicao ra
  WHERE ra.organizacao_id=up.organizacao_id
    AND ra.atribuicao_id=up.id
  ORDER BY ra.versao DESC
  LIMIT 1
) r ON true;

GRANT SELECT ON hvb.atribuicao_consulta TO hvb_app;
