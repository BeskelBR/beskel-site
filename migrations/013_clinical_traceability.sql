SET search_path=hvb,public;
-- Preserve any synthetic executions of 011/012 while adding a typed command link.
ALTER TABLE consumo ADD COLUMN comando_id uuid;
ALTER TABLE consumo DISABLE TRIGGER imutavel;
UPDATE consumo c SET comando_id=a.comando_id FROM evento_auditoria a WHERE a.organizacao_id=c.organizacao_id AND a.entidade_id=c.id AND a.acao='/clinica/consumos';
ALTER TABLE consumo ENABLE TRIGGER imutavel;
ALTER TABLE consumo ALTER COLUMN comando_id SET NOT NULL;
ALTER TABLE consumo ADD FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id);
ALTER TABLE consumo ADD UNIQUE(organizacao_id,comando_id);
CREATE FUNCTION validar_comando_material() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE cmd uuid;
BEGIN
 IF TG_TABLE_NAME='consumo_item' THEN
 SELECT comando_id INTO STRICT cmd FROM consumo WHERE organizacao_id=NEW.organizacao_id AND id=NEW.consumo_id;
 IF cmd IS DISTINCT FROM (SELECT comando_id FROM transacao_estoque WHERE organizacao_id=NEW.organizacao_id AND id=NEW.transacao_id) THEN RAISE EXCEPTION 'Item fora do comando de consumo' USING ERRCODE='23514'; END IF;
 ELSE cmd:=NEW.comando_id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM comando WHERE organizacao_id=NEW.organizacao_id AND id=cmd AND concluido_em IS NULL) THEN RAISE EXCEPTION 'Comando material ja finalizado' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER consumo_comando BEFORE INSERT ON consumo FOR EACH ROW EXECUTE FUNCTION validar_comando_material();
CREATE TRIGGER consumo_item_comando BEFORE INSERT ON consumo_item FOR EACH ROW EXECUTE FUNCTION validar_comando_material();
CREATE TRIGGER transacao_comando BEFORE INSERT ON transacao_estoque FOR EACH ROW EXECUTE FUNCTION validar_comando_material();
CREATE FUNCTION validar_pendencia_execucao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF NEW.situacao_material='pendente' AND NOT EXISTS(SELECT 1 FROM pendencia_clinica WHERE organizacao_id=NEW.organizacao_id AND execucao_id=NEW.id AND tipo='material_nao_identificado') THEN
 RAISE EXCEPTION 'Execucao sem conciliacao exige pendencia visivel' USING ERRCODE='23514'; END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER execucao_pendencia AFTER INSERT ON execucao DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validar_pendencia_execucao();
ALTER TABLE pendencia_clinica DROP CONSTRAINT pendencia_clinica_tipo_check;
ALTER TABLE pendencia_clinica ADD CHECK(tipo IN ('material_nao_identificado','revisao_programacao','ordem_sobreposta','validade_material','custo_desconhecido','revisao_temporal'));
ALTER TABLE pendencia_clinica DROP CONSTRAINT pendencia_clinica_check1;
ALTER TABLE pendencia_clinica ADD CHECK((tipo IN ('material_nao_identificado','revisao_temporal'))=(execucao_id IS NOT NULL));
CREATE FUNCTION revisar_clinica_apos_alta() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
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
 AND NOT EXISTS(SELECT 1 FROM execucao c WHERE c.organizacao_id=e.organizacao_id AND c.correcao_de_id=e.id);
 END IF; RETURN NULL;
END $$;
CREATE TRIGGER episodio_revisao_clinica AFTER UPDATE ON episodio FOR EACH ROW EXECUTE FUNCTION revisar_clinica_apos_alta();
CREATE VIEW execucao_consulta WITH(security_invoker=true) AS
 SELECT e.*,r.id AS substituida_por_id,
 CASE WHEN r.id IS NOT NULL THEN 'retificada' WHEN e.situacao_material='nao_utilizado' THEN 'nao_utilizado'
 WHEN EXISTS(SELECT 1 FROM consumo c WHERE c.organizacao_id=e.organizacao_id AND c.execucao_id=e.id AND NOT EXISTS(SELECT 1 FROM estorno_consumo s WHERE s.organizacao_id=c.organizacao_id AND s.consumo_id=c.id)) THEN 'conciliado' ELSE 'pendente' END AS conciliacao_material
 FROM execucao e LEFT JOIN execucao r ON r.organizacao_id=e.organizacao_id AND r.correcao_de_id=e.id;
CREATE VIEW consumo_consulta WITH(security_invoker=true) AS
 SELECT c.*,s.id AS estorno_id,CASE WHEN s.id IS NULL THEN 'conciliado' ELSE 'estornado' END AS situacao
 FROM consumo c LEFT JOIN estorno_consumo s ON s.organizacao_id=c.organizacao_id AND s.consumo_id=c.id;
CREATE INDEX programacao_episodio ON programacao(organizacao_id,episodio_id,prevista_em);
REVOKE ALL ON FUNCTION validar_comando_material(),validar_pendencia_execucao(),revisar_clinica_apos_alta() FROM PUBLIC;
