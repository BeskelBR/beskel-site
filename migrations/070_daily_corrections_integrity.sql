SET search_path=hvb,public;
-- Exclusion over historical rows prevented additive replacements. Serialize on
-- the episode and check only current intervals, for API and direct SQL alike.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conrelid::regclass AS tabela,conname FROM pg_constraint WHERE contype='x' AND conrelid IN ('hvb.pacote_episodio'::regclass,'hvb.periodo_diaria'::regclass) LOOP
 EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',c.tabela,c.conname);
 END LOOP;
END $$;
CREATE FUNCTION validar_intervalo_diaria_vigente() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 PERFORM 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 IF TG_TABLE_NAME='pacote_episodio' THEN
 IF EXISTS(SELECT 1 FROM pacote_episodio p WHERE p.organizacao_id=NEW.organizacao_id AND p.episodio_id=NEW.episodio_id AND pacote_episodio_vigente(p.organizacao_id,p.id) AND tstzrange(p.inicio,p.fim,'[)') && tstzrange(NEW.inicio,NEW.fim,'[)')) THEN
 RAISE EXCEPTION 'Associacao vigente sobreposta' USING ERRCODE='23514';END IF;
 ELSE
 IF NOT pacote_episodio_vigente(NEW.organizacao_id,NEW.pacote_episodio_id) THEN RAISE EXCEPTION 'Associacao revisada' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM periodo_diaria p WHERE p.organizacao_id=NEW.organizacao_id AND p.episodio_id=NEW.episodio_id AND periodo_diaria_vigente(p.organizacao_id,p.id) AND tstzrange(p.inicio,p.fim,'[)') && tstzrange(NEW.inicio,NEW.fim,'[)')) THEN
 RAISE EXCEPTION 'Periodo vigente sobreposto' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER a_intervalo_vigente BEFORE INSERT ON pacote_episodio FOR EACH ROW EXECUTE FUNCTION validar_intervalo_diaria_vigente();
CREATE TRIGGER a_intervalo_vigente BEFORE INSERT ON periodo_diaria FOR EACH ROW EXECUTE FUNCTION validar_intervalo_diaria_vigente();

CREATE FUNCTION validar_revisao_diaria() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE alvo uuid;existe boolean;
BEGIN
 PERFORM 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 IF TG_TABLE_NAME='revisao_pacote_episodio' THEN
 alvo:=NEW.pacote_episodio_id;
 IF NOT pacote_episodio_vigente(NEW.organizacao_id,alvo) THEN RAISE EXCEPTION 'Associacao ja revisada' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM periodo_diaria p WHERE p.organizacao_id=NEW.organizacao_id AND p.pacote_episodio_id=alvo AND periodo_diaria_vigente(p.organizacao_id,p.id)) THEN
 RAISE EXCEPTION 'Tratar periodos vigentes antes da associacao' USING ERRCODE='23514';END IF;
 SELECT EXISTS(SELECT 1 FROM pacote_episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.substituta_id) INTO existe;
 ELSE
 alvo:=NEW.periodo_diaria_id;
 IF NOT periodo_diaria_vigente(NEW.organizacao_id,alvo) THEN RAISE EXCEPTION 'Periodo ja revisado' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM reserva_cobertura WHERE organizacao_id=NEW.organizacao_id AND periodo_diaria_id=alvo AND situacao='ativa') THEN
 RAISE EXCEPTION 'Liberar ou expirar reserva explicitamente' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM avaliacao_cobertura a WHERE a.organizacao_id=NEW.organizacao_id AND a.periodo_diaria_id=alvo AND NOT EXISTS(SELECT 1 FROM reversao_cobertura r WHERE r.organizacao_id=a.organizacao_id AND r.avaliacao_id=a.id)) THEN
 RAISE EXCEPTION 'Reverter avaliacao de cobertura explicitamente' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM item_conta i JOIN avaliacao_cobranca a ON a.organizacao_id=i.organizacao_id AND a.id=i.avaliacao_id JOIN evento_cobravel e ON e.organizacao_id=a.organizacao_id AND e.id=a.evento_id
 LEFT JOIN avaliacao_cobertura c ON c.organizacao_id=a.organizacao_id AND c.id=a.cobertura_id
 WHERE i.organizacao_id=NEW.organizacao_id AND (e.periodo_diaria_id=alvo OR c.periodo_diaria_id=alvo) AND NOT EXISTS(SELECT 1 FROM reversao_financeira r WHERE r.organizacao_id=i.organizacao_id AND r.item_conta_id=i.id)) THEN
 RAISE EXCEPTION 'Reverter documento financeiro explicitamente' USING ERRCODE='23514';END IF;
 SELECT EXISTS(SELECT 1 FROM periodo_diaria WHERE organizacao_id=NEW.organizacao_id AND id=NEW.substituta_id) INTO existe;
 END IF;
 IF existe THEN RAISE EXCEPTION 'Sucessora deve ser criada no comando de correcao' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b_validar BEFORE INSERT ON revisao_pacote_episodio FOR EACH ROW EXECUTE FUNCTION validar_revisao_diaria();
CREATE TRIGGER b_validar BEFORE INSERT ON revisao_periodo_diaria FOR EACH ROW EXECUTE FUNCTION validar_revisao_diaria();

-- Old periods may still be queried, but cannot acquire new effective uses.
CREATE FUNCTION validar_uso_diaria_vigente() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 PERFORM 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 IF NOT pacote_episodio_vigente(NEW.organizacao_id,NEW.pacote_episodio_id) OR
 (NEW.periodo_diaria_id IS NOT NULL AND NOT periodo_diaria_vigente(NEW.organizacao_id,NEW.periodo_diaria_id)) THEN
 RAISE EXCEPTION 'Uso exige contexto vigente' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE TRIGGER a_vigente BEFORE INSERT ON uso_cobertura FOR EACH ROW EXECUTE FUNCTION validar_uso_diaria_vigente();
REVOKE ALL ON FUNCTION validar_intervalo_diaria_vigente(),validar_revisao_diaria(),validar_uso_diaria_vigente() FROM PUBLIC;
