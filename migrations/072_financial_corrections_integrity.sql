SET search_path=hvb,public;
-- Replace only natural-key constraints; typed identity FKs stay intact.
DO $$ DECLARE constraint_record record; BEGIN
 FOR constraint_record IN SELECT c.conrelid::regclass AS tabela,c.conname FROM pg_constraint c
 WHERE c.contype='u' AND (
 (c.conrelid IN ('hvb.deposito_adquirente'::regclass,'hvb.item_extrato'::regclass) AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) AND a.attname='conta_financeira_id')) OR
 (c.conrelid='hvb.alocacao_deposito'::regclass AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) AND a.attname='parcela_id')) OR
 (c.conrelid='hvb.vinculo_conciliacao'::regclass AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) AND a.attname='extrato_id')))
 LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',constraint_record.tabela,constraint_record.conname);END LOOP;
END $$;
CREATE INDEX deposito_referencia_historica ON deposito_adquirente(organizacao_id,unidade_id,conta_financeira_id,adquirente,referencia);
CREATE INDEX extrato_referencia_historica ON item_extrato(organizacao_id,conta_financeira_id,referencia);
CREATE INDEX conciliacao_par_historico ON vinculo_conciliacao(organizacao_id,deposito_id,extrato_id);
CREATE INDEX alocacao_par_historico ON alocacao_deposito(organizacao_id,deposito_id,parcela_id);

CREATE FUNCTION validar_revisao_financeira_origem() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 PERFORM travar_financeiro(NEW.organizacao_id,NEW.unidade_id);
 IF TG_TABLE_NAME='revisao_deposito_adquirente' THEN
 IF EXISTS(SELECT 1 FROM revisao_deposito_adquirente WHERE organizacao_id=NEW.organizacao_id AND deposito_id=NEW.deposito_id) THEN RAISE EXCEPTION 'Deposito ja revisado' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM alocacao_deposito_ativa WHERE organizacao_id=NEW.organizacao_id AND deposito_id=NEW.deposito_id) OR EXISTS(SELECT 1 FROM conciliacao_ativa WHERE organizacao_id=NEW.organizacao_id AND deposito_id=NEW.deposito_id) THEN
 RAISE EXCEPTION 'Reverter alocacoes e conciliacoes antes do deposito' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM deposito_adquirente WHERE organizacao_id=NEW.organizacao_id AND id=NEW.substituta_id) THEN RAISE EXCEPTION 'Sucessora precisa ser nova' USING ERRCODE='23514';END IF;
 ELSE
 IF EXISTS(SELECT 1 FROM revisao_item_extrato WHERE organizacao_id=NEW.organizacao_id AND extrato_id=NEW.extrato_id) THEN RAISE EXCEPTION 'Extrato ja revisado' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM conciliacao_ativa WHERE organizacao_id=NEW.organizacao_id AND extrato_id=NEW.extrato_id) THEN RAISE EXCEPTION 'Reverter conciliacoes antes do extrato' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM item_extrato WHERE organizacao_id=NEW.organizacao_id AND id=NEW.substituta_id) THEN RAISE EXCEPTION 'Sucessora precisa ser nova' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER b_validar BEFORE INSERT ON revisao_deposito_adquirente FOR EACH ROW EXECUTE FUNCTION validar_revisao_financeira_origem();
CREATE TRIGGER b_validar BEFORE INSERT ON revisao_item_extrato FOR EACH ROW EXECUTE FUNCTION validar_revisao_financeira_origem();

-- References remain reserved throughout history. Only descendants in the same
-- correction chain can reuse them; cancelling a row never frees its identity.
CREATE FUNCTION validar_referencia_financeira_corrigida() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE conflito boolean;
BEGIN
 PERFORM travar_financeiro(NEW.organizacao_id,NEW.unidade_id);
 IF TG_TABLE_NAME='deposito_adquirente' THEN
 WITH RECURSIVE anteriores(id) AS (
 SELECT deposito_id FROM revisao_deposito_adquirente WHERE organizacao_id=NEW.organizacao_id AND substituta_id=NEW.id
 UNION ALL SELECT r.deposito_id FROM revisao_deposito_adquirente r JOIN anteriores a ON r.substituta_id=a.id WHERE r.organizacao_id=NEW.organizacao_id)
 SELECT EXISTS(SELECT 1 FROM deposito_adquirente d WHERE d.organizacao_id=NEW.organizacao_id AND d.unidade_id=NEW.unidade_id AND d.conta_financeira_id=NEW.conta_financeira_id AND d.adquirente=NEW.adquirente AND d.referencia=NEW.referencia AND NOT EXISTS(SELECT 1 FROM anteriores a WHERE a.id=d.id)) INTO conflito;
 ELSE
 WITH RECURSIVE anteriores(id) AS (
 SELECT extrato_id FROM revisao_item_extrato WHERE organizacao_id=NEW.organizacao_id AND substituta_id=NEW.id
 UNION ALL SELECT r.extrato_id FROM revisao_item_extrato r JOIN anteriores a ON r.substituta_id=a.id WHERE r.organizacao_id=NEW.organizacao_id)
 SELECT EXISTS(SELECT 1 FROM item_extrato e WHERE e.organizacao_id=NEW.organizacao_id AND e.conta_financeira_id=NEW.conta_financeira_id AND e.referencia=NEW.referencia AND NOT EXISTS(SELECT 1 FROM anteriores a WHERE a.id=e.id)) INTO conflito;
 END IF;
 IF conflito THEN RAISE EXCEPTION 'Referencia pertence a outra linhagem financeira' USING ERRCODE='23514';END IF;
 -- Successors are created by the same author and still-open command as revision.
 IF TG_TABLE_NAME='deposito_adquirente' THEN
 IF EXISTS(SELECT 1 FROM revisao_deposito_adquirente r WHERE r.organizacao_id=NEW.organizacao_id AND r.substituta_id=NEW.id AND (r.comando_id<>NEW.comando_id OR r.autor_id<>NEW.autor_id)) THEN RAISE EXCEPTION 'Comando da sucessora divergente' USING ERRCODE='23514';END IF;
 ELSE
 IF EXISTS(SELECT 1 FROM revisao_item_extrato r WHERE r.organizacao_id=NEW.organizacao_id AND r.substituta_id=NEW.id AND (r.comando_id<>NEW.comando_id OR r.autor_id<>NEW.autor_id)) THEN RAISE EXCEPTION 'Comando da sucessora divergente' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER aa_referencia BEFORE INSERT ON deposito_adquirente FOR EACH ROW EXECUTE FUNCTION validar_referencia_financeira_corrigida();
CREATE TRIGGER aa_referencia BEFORE INSERT ON item_extrato FOR EACH ROW EXECUTE FUNCTION validar_referencia_financeira_corrigida();

CREATE FUNCTION validar_reabertura_financeira() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE anterior record;
BEGIN
 PERFORM travar_financeiro(NEW.organizacao_id,NEW.unidade_id);
 IF EXISTS(SELECT 1 FROM revisao_deposito_adquirente WHERE organizacao_id=NEW.organizacao_id AND deposito_id=NEW.deposito_id) THEN RAISE EXCEPTION 'Deposito revisado indisponivel' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='vinculo_conciliacao' THEN
 IF EXISTS(SELECT 1 FROM revisao_item_extrato WHERE organizacao_id=NEW.organizacao_id AND extrato_id=NEW.extrato_id) THEN RAISE EXCEPTION 'Extrato revisado indisponivel' USING ERRCODE='23514';END IF;
 IF NEW.anterior_id IS NULL THEN
 IF EXISTS(SELECT 1 FROM vinculo_conciliacao WHERE organizacao_id=NEW.organizacao_id AND deposito_id=NEW.deposito_id AND extrato_id=NEW.extrato_id) THEN RAISE EXCEPTION 'Par historico exige refazer com origem explicita' USING ERRCODE='23514';END IF;
 ELSE
 SELECT * INTO STRICT anterior FROM vinculo_conciliacao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.anterior_id;
 IF anterior.deposito_id<>NEW.deposito_id OR anterior.extrato_id<>NEW.extrato_id OR NOT EXISTS(SELECT 1 FROM reversao_financeira WHERE organizacao_id=NEW.organizacao_id AND conciliacao_id=anterior.id) OR EXISTS(SELECT 1 FROM vinculo_conciliacao WHERE organizacao_id=NEW.organizacao_id AND anterior_id=NEW.anterior_id) THEN
 RAISE EXCEPTION 'Refazer exige ultima conciliacao revertida do mesmo par' USING ERRCODE='23514';END IF;
 END IF;
 ELSE
 IF NEW.anterior_id IS NULL THEN
 IF EXISTS(SELECT 1 FROM alocacao_deposito WHERE organizacao_id=NEW.organizacao_id AND deposito_id=NEW.deposito_id AND parcela_id=NEW.parcela_id) THEN RAISE EXCEPTION 'Par historico exige refazer com origem explicita' USING ERRCODE='23514';END IF;
 ELSE
 SELECT * INTO STRICT anterior FROM alocacao_deposito WHERE organizacao_id=NEW.organizacao_id AND id=NEW.anterior_id;
 IF anterior.deposito_id<>NEW.deposito_id OR anterior.parcela_id<>NEW.parcela_id OR NOT EXISTS(SELECT 1 FROM reversao_financeira WHERE organizacao_id=NEW.organizacao_id AND alocacao_deposito_id=anterior.id) OR EXISTS(SELECT 1 FROM alocacao_deposito WHERE organizacao_id=NEW.organizacao_id AND anterior_id=NEW.anterior_id) THEN
 RAISE EXCEPTION 'Refazer exige ultima alocacao revertida do mesmo par' USING ERRCODE='23514';END IF;
 END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER aa_reabertura BEFORE INSERT ON vinculo_conciliacao FOR EACH ROW EXECUTE FUNCTION validar_reabertura_financeira();
CREATE TRIGGER aa_reabertura BEFORE INSERT ON alocacao_deposito FOR EACH ROW EXECUTE FUNCTION validar_reabertura_financeira();
REVOKE ALL ON FUNCTION validar_revisao_financeira_origem(),validar_referencia_financeira_corrigida(),validar_reabertura_financeira() FROM PUBLIC;
