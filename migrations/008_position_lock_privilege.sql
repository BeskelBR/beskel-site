-- PostgreSQL requires UPDATE on at least one column to SELECT FOR UPDATE.
-- Grant only the version column, and reject every direct UPDATE through a trigger.
GRANT UPDATE(versao) ON hvb.posicao_estoque TO hvb_app;
CREATE FUNCTION hvb.proteger_posicao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF pg_trigger_depth()<2 OR
 (NEW.organizacao_id,NEW.unidade_id,NEW.local_id,NEW.lote_id,NEW.recipiente_id,NEW.custodia_id)
 IS DISTINCT FROM (OLD.organizacao_id,OLD.unidade_id,OLD.local_id,OLD.lote_id,OLD.recipiente_id,OLD.custodia_id) THEN
 RAISE EXCEPTION 'Posicao somente por lancamento ou reserva' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER posicao_proteger BEFORE UPDATE ON hvb.posicao_estoque FOR EACH ROW EXECUTE FUNCTION hvb.proteger_posicao();
REVOKE ALL ON FUNCTION hvb.proteger_posicao() FROM PUBLIC;
