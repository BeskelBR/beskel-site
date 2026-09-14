SET search_path=hvb,public;
CREATE OR REPLACE FUNCTION validar_financeiro() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
#variable_conflict use_column
DECLARE t titulo_consulta;p recebimento_consulta;c credito_consulta;s sessao_caixa_consulta;d deposito_consulta;pa parcela_adquirente_consulta;ex extrato_consulta;v numeric;
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
