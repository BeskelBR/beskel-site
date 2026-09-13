SET search_path=hvb,public;
CREATE VIEW lancamento_estoque_consulta WITH(security_invoker=true) AS
 SELECT l.id,l.organizacao_id,t.unidade_id,l.transacao_id,l.posicao_id,l.contrapartida,l.quantidade_assinada,
 t.custo_base_snapshot,t.tipo,t.ocorrido_em,t.autor_id
 FROM lancamento_estoque l JOIN transacao_estoque t ON (t.organizacao_id,t.id)=(l.organizacao_id,l.transacao_id);
CREATE INDEX posicao_lote ON posicao_estoque(organizacao_id,unidade_id,lote_id,id);
CREATE INDEX lote_produto ON lote(organizacao_id,produto_id,id);
CREATE FUNCTION validar_conferencia_atual() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE s sessao_inventario; p posicao_estoque;
BEGIN
 SELECT * INTO STRICT s FROM sessao_inventario WHERE organizacao_id=NEW.organizacao_id AND id=NEW.sessao_id FOR UPDATE;
 SELECT * INTO STRICT p FROM posicao_estoque WHERE organizacao_id=NEW.organizacao_id AND id=NEW.posicao_id FOR UPDATE;
 IF s.situacao<>'aberta' OR p.versao<>NEW.versao_snapshot OR p.saldo_base<>NEW.saldo_snapshot THEN
 RAISE EXCEPTION 'Contagem desatualizada' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER contagem_conferencia BEFORE UPDATE ON contagem_posicao FOR EACH ROW EXECUTE FUNCTION validar_conferencia_atual();
REVOKE ALL ON FUNCTION validar_conferencia_atual() FROM PUBLIC;
