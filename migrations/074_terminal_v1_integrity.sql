-- Additive guards: protect physical reservations and new Terminal v1 projections.
SET search_path=hvb,public;
CREATE FUNCTION tv1_open_command() RETURNS void LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM comando WHERE organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid
    AND id=nullif(current_setting('hvb.tv1_command',true),'')::uuid AND concluido_em IS NULL AND operacao LIKE '/terminal/v1/%') THEN
    RAISE EXCEPTION 'tv1_projection_requires_command' USING ERRCODE='23514';
  END IF;
END $$;
CREATE FUNCTION tv1_guard_projection() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE allowed text[];
BEGIN
  PERFORM tv1_open_command();
  IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'tv1_delete_forbidden' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='tv1_session' THEN
    allowed:=ARRAY['state','sensitive_state','unlock_until','timeout_alerted_at','entered_at','presence_cleared_at','door_closed_at','closed_at'];
    IF OLD.closed_at IS NOT NULL OR (OLD.entered_at IS NOT NULL AND NEW.entered_at IS DISTINCT FROM OLD.entered_at)
      OR (OLD.presence_cleared_at IS NOT NULL AND NEW.presence_cleared_at IS DISTINCT FROM OLD.presence_cleared_at)
      OR (OLD.door_closed_at IS NOT NULL AND NEW.door_closed_at IS DISTINCT FROM OLD.door_closed_at)
      OR (OLD.timeout_alerted_at IS NOT NULL AND NEW.timeout_alerted_at IS DISTINCT FROM OLD.timeout_alerted_at) THEN
      RAISE EXCEPTION 'tv1_physical_fact_immutable' USING ERRCODE='23514';
    END IF;
    IF NEW.state<>OLD.state AND NOT(
      (OLD.state='DOOR_AUTHORIZED' AND NEW.state IN ('DOOR_OPEN','EXPIRED')) OR
      (OLD.state='DOOR_OPEN' AND NEW.state IN ('ENTRY_CONFIRMED','EXPIRED')) OR
      (OLD.state='ENTRY_CONFIRMED' AND NEW.state='PICKING_READY') OR
      (OLD.state='PICKING_READY' AND NEW.state IN ('ENTRY_CONFIRMED','EXIT_CONFIRMED')) OR
      (OLD.state='EXIT_CONFIRMED' AND NEW.state='READY_TO_CONFIRM') OR
      (OLD.state='READY_TO_CONFIRM' AND NEW.state='CLOSED')) THEN
      RAISE EXCEPTION 'tv1_invalid_state_transition' USING ERRCODE='23514';
    END IF;
    IF NEW.state='EXPIRED' AND (OLD.entered_at IS NOT NULL OR OLD.expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'tv1_presence_must_not_expire' USING ERRCODE='23514'; END IF;
    IF NEW.state IN ('PICKING_READY','EXIT_CONFIRMED','READY_TO_CONFIRM','CLOSED') AND (NEW.sensitive_state<>'COMPLETED' OR EXISTS(SELECT 1 FROM tv1_task WHERE organizacao_id=NEW.organizacao_id AND access_session_id=NEW.id AND status IN ('PENDING','EXCEPTION'))) THEN RAISE EXCEPTION 'tv1_unresolved_picking' USING ERRCODE='23514'; END IF;
    IF NEW.state IN ('EXIT_CONFIRMED','READY_TO_CONFIRM','CLOSED') AND NEW.presence_cleared_at IS NULL THEN RAISE EXCEPTION 'tv1_presence_evidence_missing' USING ERRCODE='23514'; END IF;
    IF NEW.state IN ('READY_TO_CONFIRM','CLOSED') AND NEW.door_closed_at IS NULL THEN RAISE EXCEPTION 'tv1_door_evidence_missing' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='tv1_task' THEN
    allowed:=ARRAY['status','confirmed_quantity'];
    IF EXISTS(SELECT 1 FROM tv1_session WHERE organizacao_id=OLD.organizacao_id AND id=OLD.access_session_id AND (presence_cleared_at IS NOT NULL OR closed_at IS NOT NULL)) THEN RAISE EXCEPTION 'tv1_picking_frozen_after_exit' USING ERRCODE='23514'; END IF;
  ELSE
    allowed:=ARRAY['released_at'];
    IF OLD.released_at IS NOT NULL OR NEW.released_at IS NULL OR EXISTS(SELECT 1 FROM posicao_estoque WHERE organizacao_id=OLD.organizacao_id AND id=OLD.position_id AND (saldo_base<>0 OR reservado_base<>0)) THEN RAISE EXCEPTION 'tv1_occupied_coordinate' USING ERRCODE='23514'; END IF;
  END IF;
  IF (to_jsonb(NEW)-allowed) IS DISTINCT FROM (to_jsonb(OLD)-allowed) THEN RAISE EXCEPTION 'tv1_identity_immutable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tv1_projection BEFORE UPDATE OR DELETE ON tv1_session FOR EACH ROW EXECUTE FUNCTION tv1_guard_projection();
CREATE TRIGGER tv1_projection BEFORE UPDATE OR DELETE ON tv1_task FOR EACH ROW EXECUTE FUNCTION tv1_guard_projection();
CREATE TRIGGER tv1_projection BEFORE UPDATE OR DELETE ON tv1_occupancy FOR EACH ROW EXECUTE FUNCTION tv1_guard_projection();

CREATE FUNCTION tv1_protect_reservation() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM tv1_attempt a JOIN tv1_task t ON (t.organizacao_id,t.id)=(a.organizacao_id,a.task_id)
    JOIN tv1_session s ON (s.organizacao_id,s.id)=(t.organizacao_id,t.access_session_id)
    WHERE a.organizacao_id=OLD.organizacao_id AND a.reservation_id=OLD.id AND s.closed_at IS NULL) THEN
    PERFORM tv1_open_command();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_tv1_protect_reservation BEFORE UPDATE ON reserva FOR EACH ROW EXECUTE FUNCTION tv1_protect_reservation();

CREATE FUNCTION tv1_single_coordinate_lot() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE p posicao_estoque; coordinate uuid;
BEGIN
  IF TG_TABLE_NAME='posicao_estoque' THEN p:=NEW;
  ELSE
    IF NEW.destino_id IS NULL THEN RETURN NEW; END IF;
    SELECT * INTO p FROM posicao_estoque WHERE organizacao_id=NEW.organizacao_id AND id=NEW.destino_id;
  END IF;
  SELECT id INTO coordinate FROM tv1_coordinate WHERE organizacao_id=p.organizacao_id AND local_id=p.local_id FOR UPDATE;
  IF coordinate IS NOT NULL AND (
    EXISTS(SELECT 1 FROM tv1_occupancy WHERE organizacao_id=p.organizacao_id AND coordinate_id=coordinate AND released_at IS NULL AND position_id<>p.id)
    OR EXISTS(SELECT 1 FROM posicao_estoque WHERE organizacao_id=p.organizacao_id AND local_id=p.local_id AND id<>p.id AND (saldo_base>0 OR reservado_base>0))) THEN
    RAISE EXCEPTION 'tv1_coordinate_has_another_position' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tv1_coordinate_position BEFORE INSERT ON posicao_estoque FOR EACH ROW EXECUTE FUNCTION tv1_single_coordinate_lot();
CREATE TRIGGER tv1_coordinate_receipt BEFORE INSERT ON transacao_estoque FOR EACH ROW EXECUTE FUNCTION tv1_single_coordinate_lot();

CREATE FUNCTION tv1_typed_links() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE t tv1_task; d tv1_demand; a tv1_attempt; p posicao_estoque; r reserva; m transacao_estoque;
BEGIN
  IF TG_TABLE_NAME='tv1_source' THEN
    SELECT * INTO t FROM tv1_task WHERE organizacao_id=NEW.organizacao_id AND id=NEW.task_id;
    SELECT * INTO d FROM tv1_demand WHERE organizacao_id=NEW.organizacao_id AND id=NEW.demand_id;
    IF t.product_id<>d.product_id OR NOT EXISTS(SELECT 1 FROM tv1_session WHERE organizacao_id=t.organizacao_id AND id=t.access_session_id AND context_id=d.context_id) THEN RAISE EXCEPTION 'tv1_source_mismatch' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='tv1_attempt' THEN
    SELECT * INTO t FROM tv1_task WHERE organizacao_id=NEW.organizacao_id AND id=NEW.task_id;
    SELECT * INTO r FROM reserva WHERE organizacao_id=NEW.organizacao_id AND id=NEW.reservation_id;
    SELECT p0.* INTO p FROM tv1_occupancy o JOIN posicao_estoque p0 ON (p0.organizacao_id,p0.id)=(o.organizacao_id,o.position_id) WHERE o.organizacao_id=NEW.organizacao_id AND o.id=NEW.occupancy_id AND o.released_at IS NULL;
    IF p.id IS NULL OR p.id<>r.posicao_id OR r.situacao<>'ativa' OR NEW.quantity<>r.quantidade_base OR NEW.quantity>t.quantity OR NOT EXISTS(SELECT 1 FROM lote WHERE organizacao_id=p.organizacao_id AND id=p.lote_id AND produto_id=t.product_id) THEN RAISE EXCEPTION 'tv1_attempt_mismatch' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='tv1_discrepancy' THEN
    IF NOT EXISTS(SELECT 1 FROM tv1_attempt WHERE organizacao_id=NEW.organizacao_id AND id=NEW.attempt_id AND task_id=NEW.task_id) THEN RAISE EXCEPTION 'tv1_discrepancy_mismatch' USING ERRCODE='23514'; END IF;
  ELSE
    SELECT * INTO t FROM tv1_task WHERE organizacao_id=NEW.organizacao_id AND id=NEW.task_id;
    SELECT * INTO a FROM tv1_attempt WHERE organizacao_id=NEW.organizacao_id AND id=NEW.attempt_id;
    SELECT * INTO m FROM transacao_estoque WHERE organizacao_id=NEW.organizacao_id AND id=NEW.transaction_id;
    IF a.task_id<>t.id OR m.tipo<>'retirada' OR m.quantidade_base<>t.confirmed_quantity OR NOT EXISTS(SELECT 1 FROM tv1_occupancy WHERE organizacao_id=a.organizacao_id AND id=a.occupancy_id AND position_id=m.origem_id) THEN RAISE EXCEPTION 'tv1_movement_mismatch' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tv1_links BEFORE INSERT ON tv1_source FOR EACH ROW EXECUTE FUNCTION tv1_typed_links();
CREATE TRIGGER tv1_links BEFORE INSERT ON tv1_attempt FOR EACH ROW EXECUTE FUNCTION tv1_typed_links();
CREATE TRIGGER tv1_links BEFORE INSERT ON tv1_discrepancy FOR EACH ROW EXECUTE FUNCTION tv1_typed_links();
CREATE TRIGGER tv1_links BEFORE INSERT ON tv1_movement FOR EACH ROW EXECUTE FUNCTION tv1_typed_links();
REVOKE ALL ON FUNCTION tv1_open_command(),tv1_guard_projection(),tv1_protect_reservation(),tv1_single_coordinate_lot(),tv1_typed_links() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tv1_open_command() TO hvb_app;
