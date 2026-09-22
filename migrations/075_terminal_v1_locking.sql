-- Locks require an UPDATE privilege, even on immutable rows. The immutable
-- triggers still reject mutations. No privileges on historical tables change.
SET search_path=hvb,public;
GRANT UPDATE(id) ON tv1_room,tv1_coordinate,tv1_challenge,tv1_order,tv1_device TO hvb_app;

-- An order can have several expired contexts but exactly one final fulfillment
-- per original item. Count original items, not abandoned context joins.
CREATE OR REPLACE VIEW tv1_order_status WITH(security_invoker=true) AS
SELECT o.*,CASE WHEN stats.fulfilled=stats.items THEN
  CASE WHEN stats.complete THEN 'RETIRADA_CONFIRMADA' WHEN stats.quantity>0 THEN 'RETIRADA_PARCIAL' ELSE 'RETIRADA_NAO_ATENDIDA' END
  WHEN EXISTS(SELECT 1 FROM tv1_context_order co JOIN tv1_session s ON (s.organizacao_id,s.context_id)=(co.organizacao_id,co.context_id)
    WHERE co.organizacao_id=o.organizacao_id AND co.order_id=o.id AND s.state<>'EXPIRED') THEN 'EM_SEPARACAO' ELSE 'AGUARDANDO_RETIRADA' END AS state
FROM tv1_order o JOIN LATERAL(
  SELECT count(i.id) items,count(f.id) fulfilled,bool_and(f.status='COMPLETE') complete,sum(f.confirmed_quantity) quantity
  FROM tv1_order_item i LEFT JOIN LATERAL(
    SELECT f0.id,f0.status,f0.confirmed_quantity FROM tv1_demand d JOIN tv1_fulfillment f0 ON (f0.organizacao_id,f0.demand_id)=(d.organizacao_id,d.id)
    WHERE d.organizacao_id=i.organizacao_id AND d.order_item_id=i.id
  ) f ON true WHERE i.organizacao_id=o.organizacao_id AND i.order_id=o.id
) stats ON true;
