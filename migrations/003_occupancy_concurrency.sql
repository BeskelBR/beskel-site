SET search_path=hvb,public;
CREATE OR REPLACE FUNCTION validar_ocupacao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE cap integer; adm timestamptz; encerrado timestamptz;
BEGIN
 -- One episode, then one physical slot. Hash collision only serializes unrelated slots.
 SELECT admitido_em,encerrado_em INTO adm,encerrado FROM episodio
 WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organizacao_id::text||':'||NEW.local_id::text||':'||NEW.vaga::text,0));
 SELECT capacidade INTO cap FROM local WHERE organizacao_id=NEW.organizacao_id AND id=NEW.local_id;
 IF NEW.vaga>cap OR NEW.inicio<adm OR
 (encerrado IS NOT NULL AND (NEW.fim IS NULL OR NEW.fim>encerrado)) THEN
 RAISE EXCEPTION 'Ocupacao incompativel' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (OLD.fim IS NOT NULL OR
 (NEW.organizacao_id,NEW.unidade_id,NEW.episodio_id,NEW.local_id,NEW.vaga,NEW.inicio)
 IS DISTINCT FROM (OLD.organizacao_id,OLD.unidade_id,OLD.episodio_id,OLD.local_id,OLD.vaga,OLD.inicio)) THEN
 RAISE EXCEPTION 'Preserve historico de ocupacao' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION preservar_vinculo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.fim IS NOT NULL THEN RAISE EXCEPTION 'Vigencia ja encerrada' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER vinculo_historico BEFORE UPDATE ON paciente_responsavel FOR EACH ROW EXECUTE FUNCTION preservar_vinculo();
REVOKE ALL ON FUNCTION preservar_vinculo() FROM PUBLIC;
