SET search_path=hvb,public;
ALTER TABLE obrigacao_fornecedor ADD COLUMN correcao_de_id uuid;
ALTER TABLE obrigacao_fornecedor ADD FOREIGN KEY(organizacao_id,unidade_id,correcao_de_id) REFERENCES obrigacao_fornecedor(organizacao_id,unidade_id,id);
ALTER TABLE obrigacao_fornecedor ADD UNIQUE(organizacao_id,correcao_de_id);
DO $$ DECLARE constraint_name text;BEGIN
 SELECT c.conname INTO STRICT constraint_name FROM pg_constraint c WHERE c.conrelid='hvb.obrigacao_fornecedor'::regclass AND c.contype='u' AND (SELECT array_agg(a.attname::text ORDER BY u.ord) FROM unnest(c.conkey) WITH ORDINALITY u(attnum,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=u.attnum)=ARRAY['organizacao_id','unidade_id','fornecedor_id','documento_referencia'];
 EXECUTE format('ALTER TABLE obrigacao_fornecedor DROP CONSTRAINT %I',constraint_name);
END $$;
CREATE UNIQUE INDEX obrigacao_documento_original ON obrigacao_fornecedor(organizacao_id,unidade_id,fornecedor_id,documento_referencia) WHERE correcao_de_id IS NULL;
CREATE FUNCTION validar_correcao_obrigacao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE anterior obrigacao_fornecedor_consulta;
BEGIN
 IF NEW.correcao_de_id IS NOT NULL THEN
 PERFORM travar_contas_pagar(NEW.organizacao_id,NEW.unidade_id);
 SELECT * INTO STRICT anterior FROM obrigacao_fornecedor_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.correcao_de_id;
 IF NOT anterior.revertido OR anterior.unidade_id<>NEW.unidade_id OR anterior.fornecedor_id<>NEW.fornecedor_id OR anterior.documento_referencia<>NEW.documento_referencia OR anterior.pedido_id IS DISTINCT FROM NEW.pedido_id OR anterior.origem<>NEW.origem THEN RAISE EXCEPTION 'Correcao exige obrigacao anterior revertida e mesma origem documental' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER c_correcao BEFORE INSERT ON obrigacao_fornecedor FOR EACH ROW EXECUTE FUNCTION validar_correcao_obrigacao();
CREATE OR REPLACE VIEW obrigacao_fornecedor_consulta WITH(security_invoker=true) AS SELECT o.id,o.organizacao_id,o.unidade_id,o.autor_id,o.comando_id,o.motivo,o.criada_em,o.fornecedor_id,o.pedido_id,o.origem,o.referencia,o.documento_referencia,o.descricao,o.ocorrida_em,o.vencimento,o.valor,
 EXISTS(SELECT 1 FROM reversao_fornecedor r WHERE r.organizacao_id=o.organizacao_id AND r.obrigacao_id=o.id) AS revertido,
 (o.valor-coalesce((SELECT sum(l.valor) FROM liquidacao_fornecedor_ativa l WHERE l.organizacao_id=o.organizacao_id AND l.obrigacao_id=o.id),0))::numeric(16,2) AS saldo,
 coalesce((SELECT p.situacao='cancelado' FROM pedido_compra_consulta p WHERE p.organizacao_id=o.organizacao_id AND p.id=o.pedido_id),false) AS necessita_revisao,o.correcao_de_id
 FROM obrigacao_fornecedor o;
REVOKE ALL ON FUNCTION validar_correcao_obrigacao() FROM PUBLIC;
