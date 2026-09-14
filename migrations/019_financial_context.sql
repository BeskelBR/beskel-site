SET search_path=hvb,public;
CREATE FUNCTION travar_financeiro(p_org uuid,p_unidade uuid) RETURNS void LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM unidade_hospitalar WHERE organizacao_id=p_org AND id=p_unidade) THEN RAISE EXCEPTION 'Unidade financeira ausente' USING ERRCODE='23514';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('financeiro:'||p_org::text||':'||p_unidade::text,0));
END $$;
CREATE OR REPLACE FUNCTION proteger_financeiro() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 PERFORM travar_financeiro(NEW.organizacao_id,NEW.unidade_id);
 IF NOT EXISTS(SELECT 1 FROM comando WHERE organizacao_id=NEW.organizacao_id AND id=NEW.comando_id AND autor_id=NEW.autor_id AND concluido_em IS NULL) THEN RAISE EXCEPTION 'Comando financeiro ausente ou concluido' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION validar_origem_financeira() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE ep uuid;ev evento_cobravel;ativo boolean;integral boolean;do_tutor boolean;
BEGIN
 IF TG_TABLE_NAME='evento_cobravel' THEN ep:=NEW.episodio_id;
 ELSIF TG_TABLE_NAME='avaliacao_cobranca' THEN SELECT * INTO STRICT ev FROM evento_cobravel WHERE organizacao_id=NEW.organizacao_id AND id=NEW.evento_id;ep:=ev.episodio_id;
 ELSE SELECT e.* INTO STRICT ev FROM evento_cobravel e JOIN avaliacao_cobranca a ON a.organizacao_id=e.organizacao_id AND a.evento_id=e.id WHERE a.organizacao_id=NEW.organizacao_id AND a.id=NEW.avaliacao_id;ep:=ev.episodio_id;END IF;
 PERFORM 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=ep FOR UPDATE;
 IF TG_TABLE_NAME='avaliacao_cobranca' THEN
 IF NEW.resultado<>'pendente' THEN
 IF ev.execucao_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM execucao WHERE organizacao_id=NEW.organizacao_id AND id=ev.execucao_id AND resultado='integral') THEN RAISE EXCEPTION 'Execucao parcial permanece pendente' USING ERRCODE='23514';END IF;
 IF ev.consumo_item_id IS NOT NULL AND EXISTS(SELECT 1 FROM consumo_item ci JOIN posicao_estoque p ON p.organizacao_id=ci.organizacao_id AND p.id=ci.posicao_id JOIN custodia cu ON cu.organizacao_id=p.organizacao_id AND cu.id=p.custodia_id WHERE ci.organizacao_id=NEW.organizacao_id AND ci.id=ev.consumo_item_id AND cu.tipo='tutor') THEN RAISE EXCEPTION 'Material do tutor permanece pendente' USING ERRCODE='23514';END IF;
 IF ev.periodo_diaria_id IS NULL AND NEW.cobertura_id IS NULL AND (EXISTS(SELECT 1 FROM pacote_episodio WHERE organizacao_id=NEW.organizacao_id AND episodio_id=ep AND inicio<=ev.competencia AND fim>ev.competencia) OR EXISTS(SELECT 1 FROM evento_cobertura WHERE organizacao_id=NEW.organizacao_id AND (execucao_id=ev.execucao_id OR consumo_item_id=ev.consumo_item_id))) THEN RAISE EXCEPTION 'Cobertura nao pode ser omitida' USING ERRCODE='23514';END IF;
 END IF;END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aa_origem BEFORE INSERT ON evento_cobravel FOR EACH ROW EXECUTE FUNCTION validar_origem_financeira();
CREATE TRIGGER aa_origem BEFORE INSERT ON avaliacao_cobranca FOR EACH ROW EXECUTE FUNCTION validar_origem_financeira();
CREATE TRIGGER aa_origem BEFORE INSERT ON item_conta FOR EACH ROW EXECUTE FUNCTION validar_origem_financeira();
REVOKE ALL ON FUNCTION validar_origem_financeira() FROM PUBLIC;
