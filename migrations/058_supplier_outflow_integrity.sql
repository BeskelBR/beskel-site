SET search_path=hvb,public;
CREATE VIEW conciliacao_saida_fornecedor_consulta WITH(security_invoker=true) AS SELECT c.*,p.fornecedor_id,p.conta_financeira_id,
 NOT p.revertido AND NOT EXISTS(SELECT 1 FROM reversao_saida_fornecedor r WHERE r.organizacao_id=c.organizacao_id AND (r.conciliacao_id=c.id OR r.saida_id=c.saida_id)) AS ativo
 FROM conciliacao_saida_fornecedor c JOIN pagamento_fornecedor_consulta p ON p.organizacao_id=c.organizacao_id AND p.id=c.pagamento_id;
CREATE VIEW saida_extrato_fornecedor_consulta WITH(security_invoker=true) AS SELECT s.*,
 EXISTS(SELECT 1 FROM reversao_saida_fornecedor r WHERE r.organizacao_id=s.organizacao_id AND r.saida_id=s.id) AS revertido,
 (s.valor-coalesce((SELECT sum(c.valor) FROM conciliacao_saida_fornecedor_consulta c WHERE c.organizacao_id=s.organizacao_id AND c.saida_id=s.id AND c.ativo),0))::numeric(16,2) AS nao_conciliado FROM saida_extrato_fornecedor s;
CREATE VIEW pagamento_conciliacao_consulta WITH(security_invoker=true) AS SELECT p.*,
 (p.valor-coalesce((SELECT sum(c.valor) FROM conciliacao_saida_fornecedor_consulta c WHERE c.organizacao_id=p.organizacao_id AND c.pagamento_id=p.id AND c.ativo),0))::numeric(16,2) AS nao_conciliado FROM pagamento_fornecedor_consulta p;
CREATE FUNCTION validar_conciliacao_saida() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE p pagamento_conciliacao_consulta;s saida_extrato_fornecedor_consulta;
BEGIN
 PERFORM travar_contas_pagar(NEW.organizacao_id,NEW.unidade_id);
 CASE TG_TABLE_NAME
 WHEN 'saida_extrato_fornecedor' THEN
 IF NEW.ocorrido_em>now() THEN RAISE EXCEPTION 'Saida de extrato futura' USING ERRCODE='23514';END IF;
 IF NEW.correcao_de_id IS NOT NULL THEN
 SELECT * INTO STRICT s FROM saida_extrato_fornecedor_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.correcao_de_id;
 IF NOT s.revertido OR s.unidade_id<>NEW.unidade_id OR s.conta_financeira_id<>NEW.conta_financeira_id OR s.referencia_externa<>NEW.referencia_externa THEN RAISE EXCEPTION 'Correcao exige saida revertida e mesma origem de extrato' USING ERRCODE='23514';END IF;
 END IF;
 WHEN 'conciliacao_saida_fornecedor' THEN
 SELECT * INTO STRICT p FROM pagamento_conciliacao_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.pagamento_id;
 SELECT * INTO STRICT s FROM saida_extrato_fornecedor_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.saida_id;
 IF p.revertido OR s.revertido OR p.unidade_id<>NEW.unidade_id OR s.unidade_id<>NEW.unidade_id OR p.conta_financeira_id<>s.conta_financeira_id OR NEW.valor>p.nao_conciliado OR NEW.valor>s.nao_conciliado THEN RAISE EXCEPTION 'Conciliacao exige pagamento e saida vigentes da mesma conta com saldo' USING ERRCODE='23514';END IF;
 WHEN 'reversao_saida_fornecedor' THEN
 IF NEW.saida_id IS NOT NULL AND EXISTS(SELECT 1 FROM conciliacao_saida_fornecedor_consulta c WHERE c.organizacao_id=NEW.organizacao_id AND c.saida_id=NEW.saida_id AND c.ativo) THEN RAISE EXCEPTION 'Reverter conciliacoes antes da saida' USING ERRCODE='23514';END IF;
 END CASE;RETURN NEW;
END $$;
CREATE TRIGGER b_validar BEFORE INSERT ON saida_extrato_fornecedor FOR EACH ROW EXECUTE FUNCTION validar_conciliacao_saida();
CREATE TRIGGER b_validar BEFORE INSERT ON conciliacao_saida_fornecedor FOR EACH ROW EXECUTE FUNCTION validar_conciliacao_saida();
CREATE TRIGGER b_validar BEFORE INSERT ON reversao_saida_fornecedor FOR EACH ROW EXECUTE FUNCTION validar_conciliacao_saida();
REVOKE ALL ON FUNCTION validar_conciliacao_saida() FROM PUBLIC;
