SET search_path=hvb,public;
CREATE VIEW liquidacao_ativa WITH(security_invoker=true) AS SELECT l.* FROM liquidacao l WHERE NOT EXISTS(SELECT 1 FROM reversao_financeira r WHERE r.organizacao_id=l.organizacao_id AND r.liquidacao_id=l.id);
CREATE VIEW credito_ativo WITH(security_invoker=true) AS SELECT c.* FROM credito_cliente c WHERE NOT EXISTS(SELECT 1 FROM reversao_financeira r WHERE r.organizacao_id=c.organizacao_id AND r.credito_id=c.id);
CREATE VIEW aplicacao_credito_ativa WITH(security_invoker=true) AS SELECT a.* FROM aplicacao_credito a WHERE NOT EXISTS(SELECT 1 FROM reversao_financeira r WHERE r.organizacao_id=a.organizacao_id AND r.aplicacao_id=a.id);
CREATE VIEW titulo_consulta WITH(security_invoker=true) AS
 SELECT t.*,EXISTS(SELECT 1 FROM reversao_financeira r WHERE r.organizacao_id=t.organizacao_id AND r.titulo_id=t.id) AS revertido,
 t.valor-coalesce((SELECT sum(l.valor) FROM liquidacao_ativa l WHERE l.organizacao_id=t.organizacao_id AND l.titulo_id=t.id),0)-coalesce((SELECT sum(a.valor) FROM aplicacao_credito_ativa a WHERE a.organizacao_id=t.organizacao_id AND a.titulo_id=t.id),0) AS saldo
 FROM titulo t;
CREATE VIEW recebimento_consulta WITH(security_invoker=true) AS
 SELECT p.*,EXISTS(SELECT 1 FROM reversao_financeira r WHERE r.organizacao_id=p.organizacao_id AND r.recebimento_id=p.id) AS revertido,
 p.valor-coalesce((SELECT sum(l.valor) FROM liquidacao_ativa l WHERE l.organizacao_id=p.organizacao_id AND l.recebimento_id=p.id),0)-coalesce((SELECT sum(c.valor) FROM credito_ativo c WHERE c.organizacao_id=p.organizacao_id AND c.recebimento_id=p.id),0) AS disponivel,
 p.valor-coalesce((SELECT sum(a.bruto) FROM parcela_adquirente a WHERE a.organizacao_id=p.organizacao_id AND a.recebimento_id=p.id),0) AS bruto_nao_programado
 FROM recebimento p;
CREATE VIEW credito_consulta WITH(security_invoker=true) AS
 SELECT c.*,EXISTS(SELECT 1 FROM reversao_financeira r WHERE r.organizacao_id=c.organizacao_id AND r.credito_id=c.id) AS revertido,
 c.valor-coalesce((SELECT sum(a.valor) FROM aplicacao_credito_ativa a WHERE a.organizacao_id=c.organizacao_id AND a.credito_id=c.id),0) AS disponivel FROM credito_cliente c;
CREATE VIEW alocacao_deposito_ativa WITH(security_invoker=true) AS SELECT a.* FROM alocacao_deposito a WHERE NOT EXISTS(SELECT 1 FROM reversao_financeira r WHERE r.organizacao_id=a.organizacao_id AND r.alocacao_deposito_id=a.id);
CREATE VIEW conciliacao_ativa WITH(security_invoker=true) AS SELECT c.* FROM vinculo_conciliacao c WHERE NOT EXISTS(SELECT 1 FROM reversao_financeira r WHERE r.organizacao_id=c.organizacao_id AND r.conciliacao_id=c.id);
CREATE VIEW parcela_adquirente_consulta WITH(security_invoker=true) AS SELECT p.*,p.liquido-coalesce((SELECT sum(a.valor) FROM alocacao_deposito_ativa a WHERE a.organizacao_id=p.organizacao_id AND a.parcela_id=p.id),0) AS saldo FROM parcela_adquirente p;
CREATE VIEW deposito_consulta WITH(security_invoker=true) AS SELECT d.*,
 d.valor-coalesce((SELECT sum(a.valor) FROM alocacao_deposito_ativa a WHERE a.organizacao_id=d.organizacao_id AND a.deposito_id=d.id),0) AS nao_alocado,
 d.valor-coalesce((SELECT sum(c.valor) FROM conciliacao_ativa c WHERE c.organizacao_id=d.organizacao_id AND c.deposito_id=d.id),0) AS nao_conciliado FROM deposito_adquirente d;
CREATE VIEW extrato_consulta WITH(security_invoker=true) AS SELECT e.*,e.valor-coalesce((SELECT sum(c.valor) FROM conciliacao_ativa c WHERE c.organizacao_id=e.organizacao_id AND c.extrato_id=e.id),0) AS nao_conciliado FROM item_extrato e;
CREATE VIEW sessao_caixa_consulta WITH(security_invoker=true) AS SELECT s.*,
 EXISTS(SELECT 1 FROM fechamento_caixa f WHERE f.organizacao_id=s.organizacao_id AND f.sessao_id=s.id) AS fechada,
 s.abertura+coalesce((SELECT sum(p.valor) FROM recebimento_consulta p WHERE p.organizacao_id=s.organizacao_id AND p.sessao_id=s.id AND NOT p.revertido),0) AS esperado FROM sessao_caixa s;
CREATE VIEW evento_cobravel_consulta WITH(security_invoker=true) AS SELECT e.*,
 CASE WHEN e.execucao_id IS NOT NULL THEN NOT EXISTS(SELECT 1 FROM execucao r WHERE r.organizacao_id=e.organizacao_id AND r.correcao_de_id=e.execucao_id)
 WHEN e.consumo_item_id IS NOT NULL THEN NOT EXISTS(SELECT 1 FROM estorno_consumo s WHERE s.organizacao_id=e.organizacao_id AND s.consumo_id=ci.consumo_id)
 ELSE NOT coalesce(p.necessita_revisao,true) END AS origem_ativa
 FROM evento_cobravel e LEFT JOIN consumo_item ci ON ci.organizacao_id=e.organizacao_id AND ci.id=e.consumo_item_id LEFT JOIN periodo_diaria_consulta p ON p.organizacao_id=e.organizacao_id AND p.id=e.periodo_diaria_id;
CREATE VIEW avaliacao_cobranca_consulta WITH(security_invoker=true) AS SELECT a.*,e.episodio_id,
 NOT e.origem_ativa OR (a.cobertura_id IS NOT NULL AND coalesce(c.situacao_atual,'pendente') NOT IN ('incluido')) AS necessita_revisao
 FROM avaliacao_cobranca a JOIN evento_cobravel_consulta e ON e.organizacao_id=a.organizacao_id AND e.id=a.evento_id LEFT JOIN avaliacao_cobertura_consulta c ON c.organizacao_id=a.organizacao_id AND c.id=a.cobertura_id;
CREATE VIEW item_conta_consulta WITH(security_invoker=true) AS SELECT i.*,a.necessita_revisao,
 EXISTS(SELECT 1 FROM reversao_financeira r WHERE r.organizacao_id=i.organizacao_id AND r.item_conta_id=i.id) AS revertido FROM item_conta i JOIN avaliacao_cobranca_consulta a ON a.organizacao_id=i.organizacao_id AND a.id=i.avaliacao_id;

CREATE FUNCTION validar_comercial() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE ev evento_cobravel_consulta;pv preco_versao;av avaliacao_cobranca_consulta;it item_comercial_versao;c record;n integer;ep uuid;prod uuid;ts timestamptz;qty numeric;v numeric;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'item_comercial_versao' THEN
 SELECT coalesce(max(versao),0)+1 INTO n FROM item_comercial_versao WHERE organizacao_id=NEW.organizacao_id AND unidade_id=NEW.unidade_id AND codigo=NEW.codigo;
 IF NEW.versao<>n THEN RAISE EXCEPTION 'Versao comercial nao consecutiva' USING ERRCODE='23514';END IF;
 IF NEW.produto_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM produto WHERE organizacao_id=NEW.organizacao_id AND id=NEW.produto_id AND unidade_base_id=NEW.unidade_medida_id) THEN RAISE EXCEPTION 'Unidade comercial fisica incompativel' USING ERRCODE='23514';END IF;
 WHEN 'preco_versao' THEN
 SELECT coalesce(max(versao),0)+1 INTO n FROM preco_versao WHERE organizacao_id=NEW.organizacao_id AND item_comercial_id=NEW.item_comercial_id;
 IF NEW.versao<>n THEN RAISE EXCEPTION 'Versao de preco nao consecutiva' USING ERRCODE='23514';END IF;
 WHEN 'evento_cobravel' THEN
 SELECT * INTO STRICT it FROM item_comercial_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.item_comercial_id;
 IF NEW.execucao_id IS NOT NULL THEN
 SELECT episodio_id,executada_em INTO STRICT ep,ts FROM execucao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.execucao_id;
 IF it.tipo<>'servico' THEN RAISE EXCEPTION 'Execucao exige item de servico explicito' USING ERRCODE='23514';END IF;
 ELSIF NEW.consumo_item_id IS NOT NULL THEN
 SELECT co.episodio_id,co.ocorrido_em,ci.quantidade_base,p.produto_id INTO STRICT ep,ts,qty,prod FROM consumo_item ci JOIN consumo co ON co.organizacao_id=ci.organizacao_id AND co.id=ci.consumo_id JOIN posicao_estoque p ON p.organizacao_id=ci.organizacao_id AND p.id=ci.posicao_id WHERE ci.organizacao_id=NEW.organizacao_id AND ci.id=NEW.consumo_item_id;
 IF it.tipo<>'produto' OR it.produto_id IS DISTINCT FROM prod OR NEW.quantidade<>qty THEN RAISE EXCEPTION 'Consumo comercial incompativel' USING ERRCODE='23514';END IF;
 ELSE SELECT episodio_id,inicio INTO STRICT ep,ts FROM periodo_diaria WHERE organizacao_id=NEW.organizacao_id AND id=NEW.periodo_diaria_id;
 IF it.tipo<>'servico' OR NEW.quantidade<>1 THEN RAISE EXCEPTION 'Periodo exige uma unidade de servico' USING ERRCODE='23514';END IF;END IF;
 IF ep<>NEW.episodio_id OR ts<>NEW.competencia THEN RAISE EXCEPTION 'Origem comercial divergente' USING ERRCODE='23514';END IF;
 WHEN 'avaliacao_cobranca' THEN
 SELECT * INTO STRICT ev FROM evento_cobravel_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.evento_id;
 SELECT coalesce(max(versao),0)+1 INTO n FROM avaliacao_cobranca WHERE organizacao_id=NEW.organizacao_id AND evento_id=NEW.evento_id;
 IF NEW.versao<>n OR (n>1 AND NOT EXISTS(SELECT 1 FROM avaliacao_cobranca WHERE organizacao_id=NEW.organizacao_id AND evento_id=NEW.evento_id AND id=NEW.anterior_id AND versao=n-1)) THEN RAISE EXCEPTION 'Versao de avaliacao incompativel' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM item_conta_consulta i JOIN avaliacao_cobranca a ON a.organizacao_id=i.organizacao_id AND a.id=i.avaliacao_id WHERE a.organizacao_id=NEW.organizacao_id AND a.evento_id=NEW.evento_id AND NOT i.revertido) THEN RAISE EXCEPTION 'Reverter item antes de reavaliar' USING ERRCODE='23514';END IF;
 IF NEW.preco_id IS NOT NULL THEN SELECT * INTO STRICT pv FROM preco_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.preco_id;
 IF pv.item_comercial_id<>ev.item_comercial_id OR ev.competencia<pv.inicio OR ev.competencia>=pv.fim THEN RAISE EXCEPTION 'Preco fora da origem ou vigencia' USING ERRCODE='23514';END IF;
 v:=ev.quantidade*pv.valor;
 IF NEW.bruto IS DISTINCT FROM v THEN RAISE EXCEPTION 'Bruto diverge de quantidade e preco' USING ERRCODE='23514';END IF;END IF;
 IF NEW.resultado<>'pendente' AND (NOT ev.origem_ativa OR NEW.preco_id IS NULL OR NEW.bruto IS NULL) THEN RAISE EXCEPTION 'Origem ou preco pendente' USING ERRCODE='23514';END IF;
 IF NEW.cobertura_id IS NOT NULL THEN
 SELECT a.*,e.execucao_id,e.consumo_item_id INTO STRICT c FROM avaliacao_cobertura_consulta a JOIN evento_cobertura e ON e.organizacao_id=a.organizacao_id AND e.id=a.evento_id WHERE a.organizacao_id=NEW.organizacao_id AND a.id=NEW.cobertura_id;
 IF c.execucao_id IS DISTINCT FROM ev.execucao_id OR c.consumo_item_id IS DISTINCT FROM ev.consumo_item_id OR ev.periodo_diaria_id IS NOT NULL THEN RAISE EXCEPTION 'Cobertura de outra origem' USING ERRCODE='23514';END IF;
 IF NEW.resultado<>'pendente' AND (c.situacao_atual<>'incluido' OR NEW.resultado<>'incluido' OR NEW.beneficio<>NEW.bruto OR NEW.desconto<>0) THEN RAISE EXCEPTION 'Cobertura ambigua permanece pendente' USING ERRCODE='23514';END IF;
 ELSIF NEW.resultado='incluido' OR NEW.beneficio<>0 THEN RAISE EXCEPTION 'Beneficio exige cobertura tipada' USING ERRCODE='23514';END IF;
 IF NEW.resultado='isento' AND NEW.desconto<>NEW.bruto THEN RAISE EXCEPTION 'Isencao exige desconto motivado integral' USING ERRCODE='23514';END IF;
 WHEN 'item_conta' THEN
 SELECT * INTO STRICT av FROM avaliacao_cobranca_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.avaliacao_id;
 SELECT episodio_id INTO STRICT ep FROM conta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.conta_id;
 IF ep<>av.episodio_id OR av.valor IS NULL OR av.necessita_revisao OR NEW.valor<>av.valor OR EXISTS(SELECT 1 FROM avaliacao_cobranca WHERE organizacao_id=NEW.organizacao_id AND evento_id=av.evento_id AND versao>av.versao) THEN RAISE EXCEPTION 'Avaliacao nao pode ser documentada' USING ERRCODE='23514';END IF;
 SELECT ic.* INTO STRICT it FROM item_comercial_versao ic JOIN evento_cobravel e ON e.organizacao_id=ic.organizacao_id AND e.item_comercial_id=ic.id WHERE e.organizacao_id=NEW.organizacao_id AND e.id=av.evento_id;
 IF NEW.descricao<>it.descricao THEN RAISE EXCEPTION 'Descricao comercial deve preservar versao' USING ERRCODE='23514';END IF;
 WHEN 'responsabilidade' THEN
 SELECT * INTO STRICT c FROM item_conta_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.item_conta_id;
 IF c.comando_id<>NEW.comando_id OR c.revertido OR (SELECT coalesce(sum(valor),0) FROM responsabilidade WHERE organizacao_id=NEW.organizacao_id AND item_conta_id=NEW.item_conta_id)+NEW.valor>c.valor THEN RAISE EXCEPTION 'Responsabilidade excede item ou comando' USING ERRCODE='23514';END IF;
 WHEN 'titulo_item' THEN
 SELECT t.pagador_id,t.comando_id,r.pagador_id AS devedor,r.valor,r.item_conta_id INTO STRICT c FROM titulo t JOIN responsabilidade r ON r.organizacao_id=t.organizacao_id WHERE t.organizacao_id=NEW.organizacao_id AND t.id=NEW.titulo_id AND r.id=NEW.responsabilidade_id;
 IF c.pagador_id<>c.devedor OR c.comando_id<>NEW.comando_id OR NOT EXISTS(SELECT 1 FROM item_conta_consulta WHERE organizacao_id=NEW.organizacao_id AND id=c.item_conta_id AND NOT revertido AND NOT necessita_revisao) THEN RAISE EXCEPTION 'Titulo diverge da responsabilidade' USING ERRCODE='23514';END IF;
 SELECT coalesce(sum(ti.valor),0) INTO v FROM titulo_item ti JOIN titulo_consulta t ON t.organizacao_id=ti.organizacao_id AND t.id=ti.titulo_id WHERE ti.organizacao_id=NEW.organizacao_id AND ti.responsabilidade_id=NEW.responsabilidade_id AND NOT t.revertido;
 IF v+NEW.valor>c.valor THEN RAISE EXCEPTION 'Titulo duplica valor devido' USING ERRCODE='23514';END IF;
 ELSE NULL;END CASE;
 RETURN NEW;
END $$;

CREATE FUNCTION validar_financeiro() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE t titulo_consulta;p recebimento_consulta;c credito_consulta;s sessao_caixa_consulta;d deposito_consulta;pa parcela_adquirente_consulta;ex extrato_consulta;v numeric;r record;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'sessao_caixa' THEN
 IF NEW.aberta_em>now() OR EXISTS(SELECT 1 FROM sessao_caixa_consulta WHERE organizacao_id=NEW.organizacao_id AND caixa_id=NEW.caixa_id AND NOT fechada) THEN RAISE EXCEPTION 'Caixa ja aberto ou horario futuro' USING ERRCODE='23514';END IF;
 WHEN 'fechamento_caixa' THEN
 SELECT * INTO STRICT s FROM sessao_caixa_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.sessao_id;
 IF s.fechada OR NEW.fechada_em<s.aberta_em OR NEW.fechada_em>now() OR NEW.esperado<>s.esperado OR EXISTS(SELECT 1 FROM recebimento WHERE organizacao_id=NEW.organizacao_id AND sessao_id=NEW.sessao_id AND recebido_em>NEW.fechada_em) THEN RAISE EXCEPTION 'Fechamento divergente da sessao' USING ERRCODE='23514';END IF;
 WHEN 'recebimento' THEN
 IF NEW.recebido_em>now() THEN RAISE EXCEPTION 'Recebimento futuro' USING ERRCODE='23514';END IF;
 IF NEW.sessao_id IS NOT NULL THEN SELECT * INTO STRICT s FROM sessao_caixa_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.sessao_id;
 IF s.fechada OR NEW.recebido_em<s.aberta_em THEN RAISE EXCEPTION 'Sessao indisponivel' USING ERRCODE='23514';END IF;END IF;
 WHEN 'liquidacao' THEN
 SELECT * INTO STRICT t FROM titulo_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.titulo_id;
 SELECT * INTO STRICT p FROM recebimento_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.recebimento_id;
 IF t.revertido OR p.revertido OR t.pagador_id<>p.pagador_id OR NEW.valor>t.saldo OR NEW.valor>p.disponivel THEN RAISE EXCEPTION 'Liquidacao excede saldo ou contexto' USING ERRCODE='23514';END IF;
 WHEN 'credito_cliente' THEN
 SELECT * INTO STRICT p FROM recebimento_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.recebimento_id;
 IF p.revertido OR p.pagador_id<>NEW.pagador_id OR NEW.valor>p.disponivel THEN RAISE EXCEPTION 'Credito excede recebimento disponivel' USING ERRCODE='23514';END IF;
 WHEN 'aplicacao_credito' THEN
 SELECT * INTO STRICT t FROM titulo_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.titulo_id;
 SELECT * INTO STRICT c FROM credito_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.credito_id;
 IF t.revertido OR c.revertido OR t.pagador_id<>c.pagador_id OR NEW.valor>t.saldo OR NEW.valor>c.disponivel THEN RAISE EXCEPTION 'Credito insuficiente ou de outro pagador' USING ERRCODE='23514';END IF;
 WHEN 'parcela_adquirente' THEN
 SELECT * INTO STRICT p FROM recebimento_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.recebimento_id;
 IF p.revertido OR p.meio<>'cartao' OR NEW.bruto>p.bruto_nao_programado THEN RAISE EXCEPTION 'Parcela excede cartao recebido' USING ERRCODE='23514';END IF;
 WHEN 'deposito_adquirente' THEN IF NEW.depositado_em>now() THEN RAISE EXCEPTION 'Deposito futuro' USING ERRCODE='23514';END IF;
 WHEN 'item_extrato' THEN IF NEW.ocorrido_em>now() THEN RAISE EXCEPTION 'Extrato futuro' USING ERRCODE='23514';END IF;
 WHEN 'alocacao_deposito' THEN
 SELECT * INTO STRICT d FROM deposito_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.deposito_id;
 SELECT * INTO STRICT pa FROM parcela_adquirente_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.parcela_id;
 SELECT * INTO STRICT p FROM recebimento_consulta WHERE organizacao_id=NEW.organizacao_id AND id=pa.recebimento_id;
 IF p.revertido OR d.adquirente<>pa.adquirente OR NEW.valor>d.nao_alocado OR NEW.valor>pa.saldo THEN RAISE EXCEPTION 'Repasse excede deposito ou parcela' USING ERRCODE='23514';END IF;
 WHEN 'vinculo_conciliacao' THEN
 SELECT * INTO STRICT d FROM deposito_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.deposito_id;
 SELECT * INTO STRICT ex FROM extrato_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.extrato_id;
 IF d.conta_financeira_id<>ex.conta_financeira_id OR NEW.valor>d.nao_conciliado OR NEW.valor>ex.nao_conciliado THEN RAISE EXCEPTION 'Conciliacao excede saldo ou conta' USING ERRCODE='23514';END IF;
 WHEN 'reversao_financeira' THEN
 IF NEW.item_conta_id IS NOT NULL AND EXISTS(SELECT 1 FROM responsabilidade r JOIN titulo_item ti ON ti.organizacao_id=r.organizacao_id AND ti.responsabilidade_id=r.id JOIN titulo_consulta t ON t.organizacao_id=ti.organizacao_id AND t.id=ti.titulo_id WHERE r.organizacao_id=NEW.organizacao_id AND r.item_conta_id=NEW.item_conta_id AND NOT t.revertido) THEN RAISE EXCEPTION 'Reverter titulos antes do item' USING ERRCODE='23514';END IF;
 IF NEW.titulo_id IS NOT NULL THEN SELECT * INTO STRICT t FROM titulo_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.titulo_id;
 IF t.saldo<>t.valor THEN RAISE EXCEPTION 'Reverter liquidacoes antes do titulo' USING ERRCODE='23514';END IF;END IF;
 IF NEW.credito_id IS NOT NULL THEN SELECT * INTO STRICT c FROM credito_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.credito_id;
 IF c.disponivel<>c.valor THEN RAISE EXCEPTION 'Reverter aplicacoes antes do credito' USING ERRCODE='23514';END IF;END IF;
 IF NEW.recebimento_id IS NOT NULL THEN SELECT * INTO STRICT p FROM recebimento_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.recebimento_id;
 IF p.disponivel<>p.valor OR EXISTS(SELECT 1 FROM parcela_adquirente WHERE organizacao_id=NEW.organizacao_id AND recebimento_id=p.id) THEN RAISE EXCEPTION 'Recebimento possui dependencias; estorno adquirente pendente' USING ERRCODE='23514';END IF;
 IF p.sessao_id IS NOT NULL AND EXISTS(SELECT 1 FROM fechamento_caixa WHERE organizacao_id=NEW.organizacao_id AND sessao_id=p.sessao_id) THEN RAISE EXCEPTION 'Caixa fechado exige ajuste futuro' USING ERRCODE='23514';END IF;END IF;
 ELSE NULL;END CASE;
 RETURN NEW;
END $$;
CREATE FUNCTION fechar_documento_financeiro() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE v numeric;
BEGIN
 IF TG_TABLE_NAME='item_conta' THEN SELECT coalesce(sum(valor),0) INTO v FROM responsabilidade WHERE organizacao_id=NEW.organizacao_id AND item_conta_id=NEW.id;
 ELSE SELECT coalesce(sum(valor),0) INTO v FROM titulo_item WHERE organizacao_id=NEW.organizacao_id AND titulo_id=NEW.id;END IF;
 IF v<>NEW.valor THEN RAISE EXCEPTION 'Rateio nao fecha valor do documento' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['item_comercial_versao','preco_versao','evento_cobravel','avaliacao_cobranca','item_conta','responsabilidade','titulo_item'] LOOP EXECUTE format('CREATE TRIGGER b_validar BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION validar_comercial()',t);END LOOP;
 FOREACH t IN ARRAY ARRAY['sessao_caixa','fechamento_caixa','recebimento','liquidacao','credito_cliente','aplicacao_credito','parcela_adquirente','deposito_adquirente','item_extrato','alocacao_deposito','vinculo_conciliacao','reversao_financeira'] LOOP EXECUTE format('CREATE TRIGGER b_validar BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION validar_financeiro()',t);END LOOP;
END $$;
CREATE CONSTRAINT TRIGGER rateio_completo AFTER INSERT ON item_conta DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fechar_documento_financeiro();
CREATE CONSTRAINT TRIGGER rateio_completo AFTER INSERT ON titulo DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fechar_documento_financeiro();
REVOKE ALL ON FUNCTION validar_comercial(),validar_financeiro(),fechar_documento_financeiro() FROM PUBLIC;
CREATE INDEX responsabilidade_item ON responsabilidade(organizacao_id,item_conta_id);
CREATE INDEX titulo_item_responsabilidade ON titulo_item(organizacao_id,responsabilidade_id);
CREATE INDEX titulo_item_titulo ON titulo_item(organizacao_id,titulo_id);
CREATE INDEX liquidacao_titulo ON liquidacao(organizacao_id,titulo_id);
CREATE INDEX liquidacao_recebimento ON liquidacao(organizacao_id,recebimento_id);
CREATE INDEX credito_recebimento ON credito_cliente(organizacao_id,recebimento_id);
CREATE INDEX aplicacao_titulo ON aplicacao_credito(organizacao_id,titulo_id);
CREATE INDEX aplicacao_credito_origem ON aplicacao_credito(organizacao_id,credito_id);
CREATE INDEX recebimento_sessao ON recebimento(organizacao_id,sessao_id);
CREATE INDEX parcela_recebimento ON parcela_adquirente(organizacao_id,recebimento_id);
CREATE INDEX alocacao_deposito_origem ON alocacao_deposito(organizacao_id,deposito_id);
CREATE INDEX alocacao_deposito_parcela ON alocacao_deposito(organizacao_id,parcela_id);
CREATE INDEX conciliacao_deposito ON vinculo_conciliacao(organizacao_id,deposito_id);
CREATE INDEX conciliacao_extrato ON vinculo_conciliacao(organizacao_id,extrato_id);
