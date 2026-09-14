SET search_path=hvb,public;
ALTER TABLE deposito_adquirente ADD CHECK(isfinite(depositado_em));
ALTER TABLE item_extrato ADD CHECK(isfinite(ocorrido_em));
ALTER TABLE fechamento_caixa ADD CHECK(isfinite(fechada_em));
ALTER TABLE parcela_adquirente ADD CHECK(isfinite(repasse_previsto));
CREATE FUNCTION antecedente_comercial_ativo(p_evento uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=hvb,pg_temp AS $$
 WITH RECURSIVE atual AS(SELECT * FROM evento_cobravel WHERE id=p_evento),ancestrais(id) AS(
 SELECT x.correcao_de_id FROM execucao x JOIN atual a ON a.organizacao_id=x.organizacao_id AND a.execucao_id=x.id WHERE x.correcao_de_id IS NOT NULL
 UNION ALL SELECT x.correcao_de_id FROM execucao x JOIN ancestrais an ON x.id=an.id WHERE x.correcao_de_id IS NOT NULL
 ),consumo_atual AS(SELECT c.* FROM consumo c JOIN consumo_item ci ON ci.organizacao_id=c.organizacao_id AND ci.consumo_id=c.id JOIN atual a ON a.organizacao_id=ci.organizacao_id AND a.consumo_item_id=ci.id)
 SELECT EXISTS(SELECT 1 FROM atual a JOIN evento_cobravel anterior ON anterior.organizacao_id=a.organizacao_id AND anterior.id<>a.id
 JOIN avaliacao_cobranca av ON av.organizacao_id=anterior.organizacao_id AND av.evento_id=anterior.id
 JOIN item_conta i ON i.organizacao_id=av.organizacao_id AND i.avaliacao_id=av.id
 WHERE NOT EXISTS(SELECT 1 FROM reversao_financeira r WHERE r.organizacao_id=i.organizacao_id AND r.item_conta_id=i.id)
 AND (anterior.execucao_id IN(SELECT id FROM ancestrais) OR
 (a.consumo_item_id IS NOT NULL AND EXISTS(SELECT 1 FROM consumo_item ci JOIN consumo c ON c.organizacao_id=ci.organizacao_id AND c.id=ci.consumo_id JOIN consumo_atual ca ON ca.organizacao_id=c.organizacao_id AND ca.execucao_id=c.execucao_id AND ca.id<>c.id WHERE ci.organizacao_id=anterior.organizacao_id AND ci.id=anterior.consumo_item_id))));
$$;
CREATE FUNCTION validar_antecedente_comercial() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF NEW.resultado<>'pendente' AND antecedente_comercial_ativo(NEW.evento_id) THEN RAISE EXCEPTION 'Reverter documento da origem anterior antes de cobrar substituto' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ab_antecedente BEFORE INSERT ON avaliacao_cobranca FOR EACH ROW EXECUTE FUNCTION validar_antecedente_comercial();
REVOKE ALL ON FUNCTION validar_antecedente_comercial() FROM PUBLIC;
