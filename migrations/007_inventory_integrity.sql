SET search_path=hvb,public;
CREATE FUNCTION validar_transacao_estoque() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE p posicao_estoque; base posicao_estoque; l lote; c custodia; ap apresentacao; anterior transacao_estoque; ct contagem_posicao; rs reserva; devolvido numeric;
BEGIN
 IF NEW.raiz_id<>NEW.id THEN
 PERFORM pg_advisory_xact_lock(hashtextextended('estoque-raiz:'||NEW.organizacao_id::text||':'||NEW.raiz_id::text,0)); END IF;
 FOR p IN SELECT * FROM posicao_estoque WHERE organizacao_id=NEW.organizacao_id AND id IN (NEW.origem_id,NEW.destino_id) ORDER BY id FOR UPDATE LOOP
 IF base.id IS NULL THEN base:=p;
 ELSIF (p.unidade_id,p.lote_id,p.recipiente_id,p.custodia_id) IS DISTINCT FROM (base.unidade_id,base.lote_id,base.recipiente_id,base.custodia_id) THEN
 RAISE EXCEPTION 'Posicoes incompativeis' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF base.id IS NULL OR base.unidade_id<>NEW.unidade_id THEN RAISE EXCEPTION 'Posicao invalida' USING ERRCODE='23514'; END IF;
 SELECT * INTO STRICT l FROM lote WHERE organizacao_id=NEW.organizacao_id AND id=base.lote_id;
 SELECT * INTO STRICT c FROM custodia WHERE organizacao_id=NEW.organizacao_id AND id=base.custodia_id;
 IF NEW.custo_base_snapshot IS DISTINCT FROM (CASE WHEN c.tipo='tutor' THEN NULL ELSE l.custo_base END) THEN RAISE EXCEPTION 'Custo invalido' USING ERRCODE='23514'; END IF;
 IF NEW.tipo='entrada' THEN
 SELECT * INTO STRICT ap FROM apresentacao WHERE organizacao_id=NEW.organizacao_id AND id=l.apresentacao_id;
 IF NEW.origem_id IS NOT NULL OR NEW.destino_id IS NULL OR NEW.contrapartida IS DISTINCT FROM 'externo' OR
 NEW.fator_snapshot<>ap.fator_unidade_base OR NEW.quantidade_apresentacoes<=0 OR NEW.quantidade_base<>NEW.quantidade_apresentacoes*NEW.fator_snapshot THEN
 RAISE EXCEPTION 'Entrada invalida' USING ERRCODE='23514'; END IF;
 ELSIF NEW.tipo IN ('transferencia','retirada','devolucao') THEN
 IF NEW.origem_id IS NULL OR NEW.destino_id IS NULL THEN RAISE EXCEPTION 'Destino obrigatorio' USING ERRCODE='23514'; END IF;
 ELSIF NEW.tipo='perda' THEN
 IF NEW.origem_id IS NULL OR NEW.destino_id IS NOT NULL OR NEW.contrapartida IS DISTINCT FROM 'perda' THEN RAISE EXCEPTION 'Perda invalida' USING ERRCODE='23514'; END IF;
 ELSIF NEW.tipo='ajuste' THEN
 SELECT * INTO STRICT ct FROM contagem_posicao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.contagem_id;
 IF NEW.contrapartida IS DISTINCT FROM 'ajuste' OR ct.situacao<>'aplicada' OR ct.posicao_id<>base.id OR ct.versao_snapshot<>base.versao OR
 NEW.quantidade_base<>abs(ct.quantidade_contada-base.saldo_base) OR ((ct.quantidade_contada>base.saldo_base)<>(NEW.destino_id IS NOT NULL)) THEN
 RAISE EXCEPTION 'Ajuste sem contagem compativel' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.reserva_id IS NOT NULL THEN
 SELECT * INTO STRICT rs FROM reserva WHERE organizacao_id=NEW.organizacao_id AND id=NEW.reserva_id;
 IF NEW.tipo<>'retirada' OR rs.situacao<>'efetivada' OR rs.posicao_id IS DISTINCT FROM NEW.origem_id OR rs.quantidade_base<>NEW.quantidade_base THEN
 RAISE EXCEPTION 'Reserva incompativel' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.tipo IN ('devolucao','reversao') THEN
 SELECT * INTO STRICT anterior FROM transacao_estoque WHERE organizacao_id=NEW.organizacao_id AND id=coalesce(NEW.referencia_id,NEW.reversao_de_id);
 IF anterior.raiz_id<>NEW.raiz_id OR anterior.tipo='reversao' OR
 EXISTS(SELECT 1 FROM transacao_estoque WHERE organizacao_id=NEW.organizacao_id AND reversao_de_id=anterior.id) OR
 NEW.origem_id IS DISTINCT FROM anterior.destino_id OR NEW.destino_id IS DISTINCT FROM anterior.origem_id OR NEW.ocorrido_em<anterior.ocorrido_em THEN
 RAISE EXCEPTION 'Correcao incompativel' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(d.quantidade_base),0) INTO devolvido FROM transacao_estoque d
 WHERE d.organizacao_id=NEW.organizacao_id AND d.referencia_id=anterior.id AND NOT EXISTS
 (SELECT 1 FROM transacao_estoque r WHERE r.organizacao_id=d.organizacao_id AND r.reversao_de_id=d.id);
 IF NEW.tipo='devolucao' THEN
 IF anterior.tipo NOT IN ('retirada','transferencia') OR NEW.quantidade_base+devolvido>anterior.quantidade_base THEN RAISE EXCEPTION 'Devolucao excessiva' USING ERRCODE='23514'; END IF;
 ELSE
 IF NEW.quantidade_base<>anterior.quantidade_base OR devolvido>0 OR NEW.contrapartida IS DISTINCT FROM anterior.contrapartida THEN RAISE EXCEPTION 'Reversao incompativel' USING ERRCODE='23514'; END IF;
 END IF;
 ELSIF NEW.raiz_id<>NEW.id THEN RAISE EXCEPTION 'Raiz invalida' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER transacao_validar BEFORE INSERT ON transacao_estoque FOR EACH ROW EXECUTE FUNCTION validar_transacao_estoque();
CREATE FUNCTION validar_efetivacao_reserva() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF NEW.situacao='efetivada' AND NOT EXISTS(SELECT 1 FROM transacao_estoque WHERE organizacao_id=NEW.organizacao_id AND reserva_id=NEW.id) THEN
 RAISE EXCEPTION 'Reserva efetivada sem transferencia' USING ERRCODE='23514'; END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER reserva_efetivada AFTER UPDATE ON reserva DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validar_efetivacao_reserva();
CREATE FUNCTION validar_contagem() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE p posicao_estoque; s sessao_inventario;
BEGIN
 IF TG_OP='INSERT' THEN
 SELECT * INTO STRICT s FROM sessao_inventario WHERE organizacao_id=NEW.organizacao_id AND id=NEW.sessao_id FOR UPDATE;
 SELECT * INTO STRICT p FROM posicao_estoque WHERE organizacao_id=NEW.organizacao_id AND id=NEW.posicao_id FOR UPDATE;
 IF s.situacao<>'aberta' OR s.local_id<>p.local_id OR p.versao<>NEW.versao_snapshot OR p.saldo_base<>NEW.saldo_snapshot OR NEW.situacao<>'pendente' THEN
 RAISE EXCEPTION 'Snapshot de contagem invalido' USING ERRCODE='23514'; END IF;
 ELSE
 IF OLD.situacao<>'pendente' OR NEW.situacao='pendente' OR NEW.aplicada_por_id IS NULL OR NEW.motivo_aplicacao IS NULL THEN
 RAISE EXCEPTION 'Contagem imutavel apos aplicar' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER contagem_validar BEFORE INSERT OR UPDATE ON contagem_posicao FOR EACH ROW EXECUTE FUNCTION validar_contagem();
CREATE FUNCTION validar_aplicacao_contagem() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF NEW.situacao='aplicada' AND NOT EXISTS(SELECT 1 FROM transacao_estoque WHERE organizacao_id=NEW.organizacao_id AND contagem_id=NEW.id) THEN
 RAISE EXCEPTION 'Contagem aplicada sem ajuste' USING ERRCODE='23514'; END IF;
 IF NEW.situacao='conferida' AND NEW.quantidade_contada<>NEW.saldo_snapshot THEN RAISE EXCEPTION 'Divergencia nao conferida' USING ERRCODE='23514'; END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER contagem_aplicada AFTER UPDATE ON contagem_posicao DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validar_aplicacao_contagem();
REVOKE ALL ON FUNCTION validar_transacao_estoque(),validar_efetivacao_reserva(),validar_contagem(),validar_aplicacao_contagem() FROM PUBLIC;
