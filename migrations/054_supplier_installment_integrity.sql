SET search_path=hvb,public;
CREATE VIEW alocacao_parcela_fornecedor_consulta WITH(security_invoker=true) AS SELECT a.*,p.plano_id,pl.obrigacao_id,
 NOT EXISTS(SELECT 1 FROM reversao_alocacao_parcela r WHERE r.organizacao_id=a.organizacao_id AND r.alocacao_id=a.id) AND EXISTS(SELECT 1 FROM liquidacao_fornecedor_ativa l WHERE l.organizacao_id=a.organizacao_id AND l.id=a.liquidacao_id) AS ativo
 FROM alocacao_parcela_fornecedor a JOIN parcela_fornecedor p ON p.organizacao_id=a.organizacao_id AND p.id=a.parcela_id JOIN plano_parcelas_fornecedor pl ON pl.organizacao_id=p.organizacao_id AND pl.id=p.plano_id;
CREATE VIEW plano_parcelas_fornecedor_consulta WITH(security_invoker=true) AS SELECT pl.*,o.fornecedor_id,o.valor AS valor_obrigacao,o.saldo AS saldo_obrigacao,o.revertido AS obrigacao_revertida,
 NOT EXISTS(SELECT 1 FROM plano_parcelas_fornecedor n WHERE n.organizacao_id=pl.organizacao_id AND n.obrigacao_id=pl.obrigacao_id AND n.versao>pl.versao) AS atual,
 (o.valor-o.saldo-coalesce((SELECT sum(a.valor) FROM alocacao_parcela_fornecedor_consulta a WHERE a.organizacao_id=pl.organizacao_id AND a.obrigacao_id=pl.obrigacao_id AND a.ativo),0))::numeric(16,2) AS liquidado_sem_parcela
 FROM plano_parcelas_fornecedor pl JOIN obrigacao_fornecedor_consulta o ON o.organizacao_id=pl.organizacao_id AND o.id=pl.obrigacao_id;
CREATE VIEW parcela_fornecedor_consulta WITH(security_invoker=true) AS SELECT p.*,pl.obrigacao_id,pl.fornecedor_id,pl.atual AND NOT pl.obrigacao_revertida AS vigente,
 coalesce((SELECT sum(a.valor) FROM alocacao_parcela_fornecedor_consulta a WHERE a.organizacao_id=p.organizacao_id AND a.parcela_id=p.id AND a.ativo),0)::numeric(16,2) AS alocado,
 (p.valor-coalesce((SELECT sum(a.valor) FROM alocacao_parcela_fornecedor_consulta a WHERE a.organizacao_id=p.organizacao_id AND a.parcela_id=p.id AND a.ativo),0))::numeric(16,2) AS saldo
 FROM parcela_fornecedor p JOIN plano_parcelas_fornecedor_consulta pl ON pl.organizacao_id=p.organizacao_id AND pl.id=p.plano_id;
CREATE VIEW liquidacao_parcela_consulta WITH(security_invoker=true) AS SELECT l.*,
 NOT EXISTS(SELECT 1 FROM liquidacao_fornecedor_ativa a WHERE a.organizacao_id=l.organizacao_id AND a.id=l.id) AS revertida,
 (l.valor-coalesce((SELECT sum(a.valor) FROM alocacao_parcela_fornecedor_consulta a WHERE a.organizacao_id=l.organizacao_id AND a.liquidacao_id=l.id AND a.ativo),0))::numeric(16,2) AS nao_alocado
 FROM liquidacao_fornecedor l;
CREATE FUNCTION validar_parcelas_fornecedor() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE o obrigacao_fornecedor_consulta;pl plano_parcelas_fornecedor;ant plano_parcelas_fornecedor;p parcela_fornecedor_consulta;l liquidacao_parcela_consulta;
BEGIN
 PERFORM travar_contas_pagar(NEW.organizacao_id,NEW.unidade_id);
 CASE TG_TABLE_NAME
 WHEN 'plano_parcelas_fornecedor' THEN
 SELECT * INTO STRICT o FROM obrigacao_fornecedor_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.obrigacao_id;
 SELECT * INTO ant FROM plano_parcelas_fornecedor WHERE organizacao_id=NEW.organizacao_id AND obrigacao_id=NEW.obrigacao_id ORDER BY versao DESC LIMIT 1;
 IF o.revertido OR o.unidade_id<>NEW.unidade_id OR NEW.versao<>coalesce(ant.versao,0)+1 OR NEW.anterior_id IS DISTINCT FROM ant.id OR EXISTS(SELECT 1 FROM alocacao_parcela_fornecedor_consulta a WHERE a.organizacao_id=NEW.organizacao_id AND a.obrigacao_id=NEW.obrigacao_id AND a.ativo) THEN RAISE EXCEPTION 'Plano exige obrigacao vigente, versao esperada e alocacoes anteriores revertidas' USING ERRCODE='23514';END IF;
 WHEN 'parcela_fornecedor' THEN
 SELECT * INTO STRICT pl FROM plano_parcelas_fornecedor WHERE organizacao_id=NEW.organizacao_id AND id=NEW.plano_id;
 IF pl.comando_id<>NEW.comando_id OR pl.unidade_id<>NEW.unidade_id THEN RAISE EXCEPTION 'Parcelas devem integrar mesmo comando do plano' USING ERRCODE='23514';END IF;
 WHEN 'alocacao_parcela_fornecedor' THEN
 SELECT * INTO STRICT p FROM parcela_fornecedor_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.parcela_id;
 SELECT * INTO STRICT l FROM liquidacao_parcela_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.liquidacao_id;
 IF NOT p.vigente OR l.revertida OR p.unidade_id<>NEW.unidade_id OR l.unidade_id<>NEW.unidade_id OR l.obrigacao_id<>p.obrigacao_id OR NEW.valor>p.saldo OR NEW.valor>l.nao_alocado THEN RAISE EXCEPTION 'Alocacao exige parcela e liquidacao da mesma obrigacao, vigentes e com saldo' USING ERRCODE='23514';END IF;
 WHEN 'reversao_alocacao_parcela' THEN NULL;
 END CASE;RETURN NEW;
END $$;
CREATE FUNCTION fechar_plano_parcelas() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE n bigint;maximo integer;s numeric;v numeric;
BEGIN
 SELECT count(*),max(numero),coalesce(sum(valor),0) INTO n,maximo,s FROM parcela_fornecedor WHERE organizacao_id=NEW.organizacao_id AND plano_id=NEW.id;
 SELECT valor INTO STRICT v FROM obrigacao_fornecedor WHERE organizacao_id=NEW.organizacao_id AND id=NEW.obrigacao_id;
 IF n=0 OR n<>maximo OR s<>v OR EXISTS(SELECT 1 FROM parcela_fornecedor p JOIN parcela_fornecedor q ON q.organizacao_id=p.organizacao_id AND q.plano_id=p.plano_id AND q.numero=p.numero+1 WHERE p.organizacao_id=NEW.organizacao_id AND p.plano_id=NEW.id AND p.vencimento>q.vencimento) THEN RAISE EXCEPTION 'Plano deve fechar valor integral, sequencia e vencimentos ordenados' USING ERRCODE='23514';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER plano_parcelas_completo AFTER INSERT ON plano_parcelas_fornecedor DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fechar_plano_parcelas();
CREATE TRIGGER b_validar BEFORE INSERT ON plano_parcelas_fornecedor FOR EACH ROW EXECUTE FUNCTION validar_parcelas_fornecedor();
CREATE TRIGGER b_validar BEFORE INSERT ON parcela_fornecedor FOR EACH ROW EXECUTE FUNCTION validar_parcelas_fornecedor();
CREATE TRIGGER b_validar BEFORE INSERT ON alocacao_parcela_fornecedor FOR EACH ROW EXECUTE FUNCTION validar_parcelas_fornecedor();
CREATE TRIGGER b_validar BEFORE INSERT ON reversao_alocacao_parcela FOR EACH ROW EXECUTE FUNCTION validar_parcelas_fornecedor();
REVOKE ALL ON FUNCTION validar_parcelas_fornecedor(),fechar_plano_parcelas() FROM PUBLIC;
