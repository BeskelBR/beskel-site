-- Typed composition and deferred conservation of the canonical session.
SET search_path=hvb,public;
CREATE FUNCTION tv1_composition() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME='tv1_auth' THEN
    IF NOT EXISTS(SELECT 1 FROM tv1_challenge c JOIN tv1_device d ON d.organizacao_id=c.organizacao_id AND d.room_id=c.room_id AND d.role='BIOMETRIC'
      WHERE c.organizacao_id=NEW.organizacao_id AND c.id=NEW.challenge_id AND c.employee_id=NEW.employee_id AND c.room_id=NEW.room_id
      AND c.access_terminal_device_id=NEW.access_terminal_device_id AND d.device_id=NEW.biometric_device_id) THEN RAISE EXCEPTION 'tv1_auth_composition' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='tv1_context' THEN
    IF NOT EXISTS(SELECT 1 FROM tv1_auth WHERE organizacao_id=NEW.organizacao_id AND id=NEW.auth_session_id AND employee_id=NEW.employee_id AND room_id=NEW.room_id) THEN RAISE EXCEPTION 'tv1_context_composition' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='tv1_session' THEN
    IF NOT EXISTS(SELECT 1 FROM tv1_context c JOIN tv1_auth a ON (a.organizacao_id,a.id)=(c.organizacao_id,c.auth_session_id)
      JOIN tv1_device d ON d.organizacao_id=c.organizacao_id AND d.room_id=c.room_id AND d.role='PICKING'
      WHERE c.organizacao_id=NEW.organizacao_id AND c.id=NEW.context_id AND c.auth_session_id=NEW.auth_session_id AND c.employee_id=NEW.employee_id AND c.room_id=NEW.room_id
      AND a.access_terminal_device_id=NEW.access_terminal_device_id AND d.device_id=NEW.picking_display_device_id)
      OR NEW.state<>'DOOR_AUTHORIZED' OR NEW.entered_at IS NOT NULL OR NEW.presence_cleared_at IS NOT NULL OR NEW.door_closed_at IS NOT NULL OR NEW.closed_at IS NOT NULL THEN RAISE EXCEPTION 'tv1_session_composition' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='tv1_occupancy' THEN
    IF NOT EXISTS(SELECT 1 FROM tv1_coordinate c JOIN posicao_estoque p ON (p.organizacao_id,p.local_id)=(c.organizacao_id,c.local_id)
      JOIN lote l ON (l.organizacao_id,l.id)=(p.organizacao_id,p.lote_id) JOIN tv1_product_policy policy ON (policy.organizacao_id,policy.product_id)=(l.organizacao_id,l.produto_id)
      JOIN custodia k ON (k.organizacao_id,k.id)=(p.organizacao_id,p.custodia_id)
      WHERE c.organizacao_id=NEW.organizacao_id AND c.id=NEW.coordinate_id AND p.id=NEW.position_id AND c.sensitive=policy.sensitive AND k.tipo='hospital') THEN RAISE EXCEPTION 'tv1_occupancy_composition' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='tv1_demand' THEN
    IF NEW.order_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tv1_order_item i JOIN tv1_context_order co ON (co.organizacao_id,co.order_id)=(i.organizacao_id,i.order_id)
      WHERE i.organizacao_id=NEW.organizacao_id AND i.id=NEW.order_item_id AND co.context_id=NEW.context_id AND i.product_id=NEW.product_id AND i.quantity=NEW.quantity) THEN RAISE EXCEPTION 'tv1_demand_composition' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='tv1_order_item' THEN
    IF NEW.program_id IS NOT NULL AND (NEW.clinical_order_version_id IS NULL OR NOT EXISTS(SELECT 1 FROM programacao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.program_id AND ordem_versao_id=NEW.clinical_order_version_id)) THEN RAISE EXCEPTION 'tv1_program_composition' USING ERRCODE='23514'; END IF;
    IF NEW.clinical_order_version_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ordem_versao v JOIN tv1_order o ON (o.organizacao_id,o.episode_id)=(v.organizacao_id,v.episodio_id)
      WHERE v.organizacao_id=NEW.organizacao_id AND v.id=NEW.clinical_order_version_id AND o.id=NEW.order_id) THEN RAISE EXCEPTION 'tv1_clinical_origin_composition' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='tv1_fulfillment' THEN
    IF NOT EXISTS(SELECT 1 FROM tv1_demand d JOIN tv1_session s ON (s.organizacao_id,s.context_id)=(d.organizacao_id,d.context_id)
      WHERE d.organizacao_id=NEW.organizacao_id AND d.id=NEW.demand_id AND s.id=NEW.access_session_id AND d.quantity=NEW.requested_quantity AND s.state='READY_TO_CONFIRM') THEN RAISE EXCEPTION 'tv1_fulfillment_composition' USING ERRCODE='23514'; END IF;
    IF EXISTS(SELECT 1 FROM tv1_demand d JOIN tv1_demand other ON (other.organizacao_id,other.order_item_id)=(d.organizacao_id,d.order_item_id)
      JOIN tv1_fulfillment f ON (f.organizacao_id,f.demand_id)=(other.organizacao_id,other.id)
      WHERE d.organizacao_id=NEW.organizacao_id AND d.id=NEW.demand_id) THEN RAISE EXCEPTION 'tv1_original_item_already_fulfilled' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['tv1_auth','tv1_context','tv1_session','tv1_occupancy','tv1_demand','tv1_order_item','tv1_fulfillment'] LOOP
  EXECUTE format('CREATE TRIGGER tv1_composition BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION tv1_composition()',t);
END LOOP; END $$;

CREATE FUNCTION tv1_conservation() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE s tv1_session;
BEGIN
  SELECT * INTO s FROM tv1_session WHERE organizacao_id=NEW.organizacao_id AND id=NEW.id;
  IF NOT EXISTS(SELECT 1 FROM tv1_task WHERE organizacao_id=s.organizacao_id AND access_session_id=s.id)
    OR EXISTS(SELECT 1 FROM tv1_task t WHERE t.organizacao_id=s.organizacao_id AND t.access_session_id=s.id AND t.quantity<>(SELECT coalesce(sum(quantity),0) FROM tv1_source WHERE organizacao_id=t.organizacao_id AND task_id=t.id))
    OR EXISTS(SELECT 1 FROM tv1_demand d WHERE d.organizacao_id=s.organizacao_id AND d.context_id=s.context_id AND d.quantity<>(SELECT coalesce(sum(src.quantity),0) FROM tv1_source src JOIN tv1_task t ON (t.organizacao_id,t.id)=(src.organizacao_id,src.task_id) WHERE src.organizacao_id=d.organizacao_id AND src.demand_id=d.id AND t.access_session_id=s.id)) THEN
    RAISE EXCEPTION 'tv1_sources_must_conserve_demands' USING ERRCODE='23514';
  END IF;
  IF s.state='CLOSED' AND (
    EXISTS(SELECT 1 FROM tv1_task t WHERE t.organizacao_id=s.organizacao_id AND t.access_session_id=s.id AND ((t.confirmed_quantity>0)<>EXISTS(SELECT 1 FROM tv1_movement WHERE organizacao_id=t.organizacao_id AND task_id=t.id)))
    OR EXISTS(SELECT 1 FROM tv1_demand d WHERE d.organizacao_id=s.organizacao_id AND d.context_id=s.context_id AND NOT EXISTS(SELECT 1 FROM tv1_fulfillment WHERE organizacao_id=d.organizacao_id AND demand_id=d.id))
    OR (SELECT coalesce(sum(confirmed_quantity),0) FROM tv1_task WHERE organizacao_id=s.organizacao_id AND access_session_id=s.id)<>(SELECT coalesce(sum(confirmed_quantity),0) FROM tv1_fulfillment WHERE organizacao_id=s.organizacao_id AND access_session_id=s.id)
    OR EXISTS(SELECT 1 FROM tv1_attempt a JOIN tv1_task t ON (t.organizacao_id,t.id)=(a.organizacao_id,a.task_id) JOIN reserva r ON (r.organizacao_id,r.id)=(a.organizacao_id,a.reservation_id) WHERE t.organizacao_id=s.organizacao_id AND t.access_session_id=s.id AND r.situacao='ativa')
  ) THEN RAISE EXCEPTION 'tv1_confirmation_must_conserve_stock_and_origins' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER tv1_conservation AFTER INSERT OR UPDATE ON tv1_session DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tv1_conservation();
CREATE VIEW tv1_order_fulfillment WITH(security_invoker=true) AS SELECT o.*,
  CASE o.state WHEN 'RETIRADA_CONFIRMADA' THEN 'COMPLETE' WHEN 'RETIRADA_PARCIAL' THEN 'PARTIAL' WHEN 'RETIRADA_NAO_ATENDIDA' THEN 'UNAVAILABLE' END fulfillment_status FROM tv1_order_status o;
CREATE INDEX tv1_order_items_order ON tv1_order_item(organizacao_id,order_id,id);
CREATE INDEX tv1_demands_original ON tv1_demand(organizacao_id,order_item_id) WHERE order_item_id IS NOT NULL;
CREATE INDEX tv1_occupancy_coordinate_history ON tv1_occupancy(organizacao_id,coordinate_id,id);
CREATE INDEX tv1_fulfillment_session ON tv1_fulfillment(organizacao_id,access_session_id,id);
CREATE INDEX tv1_coordinate_room ON tv1_coordinate(organizacao_id,room_id,id);
REVOKE ALL ON FUNCTION tv1_composition(),tv1_conservation() FROM PUBLIC;
