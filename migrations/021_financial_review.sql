SET search_path=hvb,public;
CREATE OR REPLACE VIEW evento_cobravel_consulta WITH(security_invoker=true) AS SELECT e.*,
 CASE WHEN e.execucao_id IS NOT NULL THEN NOT EXISTS(SELECT 1 FROM execucao r WHERE r.organizacao_id=e.organizacao_id AND r.correcao_de_id=e.execucao_id)
 WHEN e.consumo_item_id IS NOT NULL THEN NOT EXISTS(SELECT 1 FROM estorno_consumo s WHERE s.organizacao_id=e.organizacao_id AND s.consumo_id=ci.consumo_id)
 ELSE NOT coalesce(p.necessita_revisao,true) END AS origem_ativa,
 (e.execucao_id IS NOT NULL AND EXISTS(SELECT 1 FROM execucao x WHERE x.organizacao_id=e.organizacao_id AND x.id=e.execucao_id AND x.resultado<>'integral')) OR
 (e.consumo_item_id IS NOT NULL AND EXISTS(SELECT 1 FROM posicao_estoque pos JOIN custodia cu ON cu.organizacao_id=pos.organizacao_id AND cu.id=pos.custodia_id WHERE pos.organizacao_id=ci.organizacao_id AND pos.id=ci.posicao_id AND cu.tipo='tutor')) AS semantica_pendente,
 e.periodo_diaria_id IS NULL AND (EXISTS(SELECT 1 FROM pacote_episodio pe WHERE pe.organizacao_id=e.organizacao_id AND pe.episodio_id=e.episodio_id AND pe.inicio<=e.competencia AND pe.fim>e.competencia) OR EXISTS(SELECT 1 FROM evento_cobertura ce WHERE ce.organizacao_id=e.organizacao_id AND (ce.execucao_id=e.execucao_id OR ce.consumo_item_id=e.consumo_item_id))) AS contexto_diaria
 FROM evento_cobravel e LEFT JOIN consumo_item ci ON ci.organizacao_id=e.organizacao_id AND ci.id=e.consumo_item_id LEFT JOIN periodo_diaria_consulta p ON p.organizacao_id=e.organizacao_id AND p.id=e.periodo_diaria_id;
CREATE OR REPLACE VIEW avaliacao_cobranca_consulta WITH(security_invoker=true) AS SELECT a.*,e.episodio_id,
 NOT e.origem_ativa OR e.semantica_pendente OR (a.cobertura_id IS NULL AND e.contexto_diaria) OR (a.cobertura_id IS NOT NULL AND coalesce(c.situacao_atual,'pendente')<>'incluido') AS necessita_revisao
 FROM avaliacao_cobranca a JOIN evento_cobravel_consulta e ON e.organizacao_id=a.organizacao_id AND e.id=a.evento_id LEFT JOIN avaliacao_cobertura_consulta c ON c.organizacao_id=a.organizacao_id AND c.id=a.cobertura_id;
