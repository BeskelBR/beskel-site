SET search_path=hvb,public;
CREATE FUNCTION validar_revisao_execucao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE e execucao; BEGIN
 SELECT * INTO STRICT e FROM execucao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.execucao_id;
 PERFORM 1 FROM episodio WHERE organizacao_id=e.organizacao_id AND id=e.episodio_id FOR UPDATE;
 IF NOT execucao_vigente(e.organizacao_id,e.id) OR EXISTS(SELECT 1 FROM consumo c WHERE c.organizacao_id=e.organizacao_id AND c.execucao_id=e.id AND NOT EXISTS(SELECT 1 FROM estorno_consumo s WHERE s.organizacao_id=c.organizacao_id AND s.consumo_id=c.id)) THEN
 RAISE EXCEPTION 'Revisao exige execucao vigente sem consumo ativo' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validar BEFORE INSERT ON revisao_execucao FOR EACH ROW EXECUTE FUNCTION validar_revisao_execucao();
CREATE FUNCTION verificar_sucessora_execucao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF NEW.tipo='contexto' AND NOT EXISTS(SELECT 1 FROM execucao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.substituta_id AND correcao_de_id=NEW.execucao_id) THEN RAISE EXCEPTION 'Revisao sem sucessora vinculada' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER sucessora AFTER INSERT ON revisao_execucao DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verificar_sucessora_execucao();
CREATE FUNCTION proteger_origem_clinica_vigente() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE ep uuid; BEGIN
 IF NEW.execucao_id IS NOT NULL THEN
  SELECT episodio_id INTO STRICT ep FROM execucao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.execucao_id;
  PERFORM 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=ep FOR UPDATE;
  IF NOT execucao_vigente(NEW.organizacao_id,NEW.execucao_id) THEN RAISE EXCEPTION 'Origem clinica anulada ou substituida' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER z_origem_vigente BEFORE INSERT ON consumo FOR EACH ROW EXECUTE FUNCTION proteger_origem_clinica_vigente();
CREATE TRIGGER z_origem_vigente BEFORE INSERT ON coleta_exame FOR EACH ROW EXECUTE FUNCTION proteger_origem_clinica_vigente();
CREATE TRIGGER z_origem_vigente BEFORE INSERT ON aplicacao_preventiva FOR EACH ROW EXECUTE FUNCTION proteger_origem_clinica_vigente();
CREATE OR REPLACE FUNCTION validar_execucao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE v ordem_versao; ep episodio; prog programacao; antiga execucao;
BEGIN
 SELECT * INTO STRICT ep FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 SELECT * INTO STRICT v FROM ordem_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.ordem_versao_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('ordem:'||NEW.organizacao_id::text||':'||v.ordem_id::text,0));
 IF NEW.executada_em>now() OR NEW.executada_em<v.vigencia_inicio OR NEW.executada_em>=v.vigencia_fim OR
 NEW.executada_em<ep.admitido_em OR NEW.executada_em>=least(ep.alta_clinica_em,ep.encerrado_em) OR NEW.unidade_medida_id<>v.unidade_medida_id OR EXISTS(
 SELECT 1 FROM ordem_versao WHERE organizacao_id=NEW.organizacao_id AND ordem_id=v.ordem_id AND versao>v.versao AND vigencia_inicio<=NEW.executada_em) THEN
 RAISE EXCEPTION 'Execucao fora da versao ou episodio informado' USING ERRCODE='23514'; END IF;
 IF NEW.correcao_de_id IS NOT NULL THEN
 SELECT * INTO STRICT antiga FROM execucao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.correcao_de_id;
 IF NOT execucao_vigente(NEW.organizacao_id,antiga.id) OR
 EXISTS(SELECT 1 FROM revisao_execucao r WHERE r.organizacao_id=NEW.organizacao_id AND r.execucao_id=antiga.id AND (r.tipo<>'contexto' OR r.substituta_id IS DISTINCT FROM NEW.id)) OR
 ((antiga.ordem_versao_id<>NEW.ordem_versao_id OR antiga.programacao_id IS DISTINCT FROM NEW.programacao_id) AND NOT EXISTS(SELECT 1 FROM revisao_execucao r WHERE r.organizacao_id=NEW.organizacao_id AND r.execucao_id=antiga.id AND r.tipo='contexto' AND r.substituta_id=NEW.id)) OR EXISTS(
 SELECT 1 FROM consumo c WHERE c.organizacao_id=NEW.organizacao_id AND c.execucao_id=antiga.id AND NOT EXISTS(SELECT 1 FROM estorno_consumo s WHERE s.organizacao_id=c.organizacao_id AND s.consumo_id=c.id)) THEN
 RAISE EXCEPTION 'Retificacao exige origem vigente, revisao explicita para mudar contexto e estorno de consumo ativo' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.programacao_id IS NOT NULL THEN
 SELECT * INTO STRICT prog FROM programacao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.programacao_id FOR UPDATE;
 IF prog.situacao<>'prevista' OR EXISTS(SELECT 1 FROM execucao e WHERE e.organizacao_id=NEW.organizacao_id AND e.programacao_id=NEW.programacao_id
 AND e.id IS DISTINCT FROM NEW.correcao_de_id AND e.resultado='integral' AND execucao_vigente(e.organizacao_id,e.id)) THEN
 RAISE EXCEPTION 'Programacao ja concluida ou nao executada' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION validar_programacao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE v ordem_versao; ep episodio;
BEGIN
 SELECT * INTO STRICT ep FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 SELECT * INTO STRICT v FROM ordem_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.ordem_versao_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('ordem:'||NEW.organizacao_id::text||':'||v.ordem_id::text,0));
 IF TG_OP='INSERT' THEN
 IF NEW.situacao<>'prevista' OR NEW.prevista_em<v.vigencia_inicio OR NEW.prevista_em>=v.vigencia_fim OR NEW.prevista_em>=least(ep.alta_clinica_em,ep.encerrado_em) OR EXISTS(
 SELECT 1 FROM ordem_versao WHERE organizacao_id=NEW.organizacao_id AND ordem_id=v.ordem_id AND versao>v.versao AND vigencia_inicio<=NEW.prevista_em) THEN
 RAISE EXCEPTION 'Programacao fora da vigencia' USING ERRCODE='23514'; END IF;
 ELSE
 IF OLD.situacao<>'prevista' OR NEW.situacao<>'nao_executada' OR (NEW.id,NEW.organizacao_id,NEW.unidade_id,NEW.episodio_id,NEW.ordem_versao_id,NEW.prevista_em,NEW.autor_id) IS DISTINCT FROM
 (OLD.id,OLD.organizacao_id,OLD.unidade_id,OLD.episodio_id,OLD.ordem_versao_id,OLD.prevista_em,OLD.autor_id) OR EXISTS(SELECT 1 FROM execucao WHERE organizacao_id=NEW.organizacao_id AND programacao_id=NEW.id AND execucao_vigente(organizacao_id,id)) THEN
 RAISE EXCEPTION 'Programacao com fato ou encerrada nao pode ser cancelada' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION validar_resolucao_clinica() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE p pendencia_clinica;
BEGIN
 SELECT * INTO STRICT p FROM pendencia_clinica WHERE organizacao_id=NEW.organizacao_id AND id=NEW.pendencia_id;
 IF NEW.anulacao_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM revisao_execucao r WHERE r.organizacao_id=NEW.organizacao_id AND r.id=NEW.anulacao_id AND r.tipo='anulacao' AND r.execucao_id=p.execucao_id) THEN RAISE EXCEPTION 'Anulacao de outra origem' USING ERRCODE='23514'; END IF;
 IF p.tipo='material_nao_identificado' AND NEW.anulacao_id IS NULL AND NOT EXISTS(SELECT 1 FROM consumo c WHERE c.organizacao_id=NEW.organizacao_id AND c.id=NEW.consumo_id AND c.execucao_id=p.execucao_id
 AND NOT EXISTS(SELECT 1 FROM estorno_consumo s WHERE s.organizacao_id=c.organizacao_id AND s.consumo_id=c.id)) AND NOT EXISTS(
 SELECT 1 FROM execucao e WHERE e.organizacao_id=NEW.organizacao_id AND e.id=NEW.execucao_substituta_id AND e.correcao_de_id=p.execucao_id) THEN
 RAISE EXCEPTION 'Pendencia de material exige conciliacao ou retificacao' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION revisar_clinica_apos_alta() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE limite timestamptz;
BEGIN
 limite:=least(NEW.alta_clinica_em,NEW.encerrado_em);
 IF limite IS NOT NULL AND limite IS DISTINCT FROM least(OLD.alta_clinica_em,OLD.encerrado_em) THEN
 INSERT INTO pendencia_clinica(id,organizacao_id,unidade_id,programacao_id,tipo,descricao)
 SELECT gen_random_uuid(),p.organizacao_id,p.unidade_id,p.id,'revisao_programacao','Alta/saída registrada; revisar destino da programação, sem inferir execução'
 FROM programacao_consulta p WHERE p.organizacao_id=NEW.organizacao_id AND p.episodio_id=NEW.id AND p.prevista_em>=limite AND p.estado_execucao IN ('prevista','parcial')
 AND NOT EXISTS(SELECT 1 FROM pendencia_clinica_consulta d WHERE d.organizacao_id=p.organizacao_id AND d.programacao_id=p.id AND d.situacao='aberta');
 INSERT INTO pendencia_clinica(id,organizacao_id,unidade_id,execucao_id,tipo,descricao)
 SELECT gen_random_uuid(),e.organizacao_id,e.unidade_id,e.id,'revisao_temporal','Alta/saída retroativa conflita com horário de fato já registrado; preservar ambos e revisar'
 FROM execucao e WHERE e.organizacao_id=NEW.organizacao_id AND e.episodio_id=NEW.id AND e.executada_em>=limite
 AND execucao_vigente(e.organizacao_id,e.id);
 END IF; RETURN NULL;
END $$;
