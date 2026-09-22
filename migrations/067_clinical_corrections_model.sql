SET search_path=hvb,public;
CREATE TABLE revisao_execucao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,episodio_id uuid NOT NULL,
 execucao_id uuid NOT NULL,substituta_id uuid,tipo text NOT NULL CHECK(tipo IN ('contexto','anulacao')),
 autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((tipo='contexto')=(substituta_id IS NOT NULL)),CHECK(execucao_id IS DISTINCT FROM substituta_id),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),UNIQUE(organizacao_id,execucao_id),UNIQUE(organizacao_id,substituta_id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id,execucao_id) REFERENCES execucao(organizacao_id,unidade_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id,substituta_id) REFERENCES execucao(organizacao_id,unidade_id,episodio_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id)
);
ALTER TABLE revisao_execucao ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisao_execucao FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON revisao_execucao USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON revisao_execucao TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON revisao_execucao FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON revisao_execucao FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
ALTER TABLE resolucao_pendencia_clinica ADD COLUMN anulacao_id uuid;
ALTER TABLE resolucao_pendencia_clinica ADD FOREIGN KEY(organizacao_id,unidade_id,anulacao_id) REFERENCES revisao_execucao(organizacao_id,unidade_id,id);
ALTER TABLE resolucao_pendencia_clinica ADD CHECK(num_nonnulls(consumo_id,execucao_substituta_id,anulacao_id)<=1);
CREATE FUNCTION execucao_vigente(org uuid,alvo uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=hvb,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM execucao e WHERE e.organizacao_id=org AND e.id=alvo
 AND NOT EXISTS(SELECT 1 FROM execucao r WHERE r.organizacao_id=org AND r.correcao_de_id=e.id)
 AND NOT EXISTS(SELECT 1 FROM revisao_execucao r WHERE r.organizacao_id=org AND r.execucao_id=e.id AND r.tipo='anulacao'));
$$;
CREATE OR REPLACE VIEW execucao_consulta WITH(security_invoker=true) AS
 SELECT e.*,r.id AS substituida_por_id,
 CASE WHEN an.id IS NOT NULL THEN 'anulada' WHEN r.id IS NOT NULL THEN 'retificada' WHEN e.situacao_material='nao_utilizado' THEN 'nao_utilizado'
 WHEN EXISTS(SELECT 1 FROM consumo c WHERE c.organizacao_id=e.organizacao_id AND c.execucao_id=e.id AND NOT EXISTS(SELECT 1 FROM estorno_consumo s WHERE s.organizacao_id=c.organizacao_id AND s.consumo_id=c.id)) THEN 'conciliado' ELSE 'pendente' END AS conciliacao_material,
 an.id AS anulacao_id
 FROM execucao e LEFT JOIN execucao r ON r.organizacao_id=e.organizacao_id AND r.correcao_de_id=e.id
 LEFT JOIN revisao_execucao an ON an.organizacao_id=e.organizacao_id AND an.execucao_id=e.id AND an.tipo='anulacao';
CREATE OR REPLACE VIEW programacao_consulta WITH(security_invoker=true) AS
 SELECT p.*,CASE WHEN p.situacao='nao_executada' THEN 'nao_executada'
 WHEN EXISTS(SELECT 1 FROM execucao e WHERE e.organizacao_id=p.organizacao_id AND e.programacao_id=p.id AND e.resultado='integral' AND execucao_vigente(e.organizacao_id,e.id)) THEN 'concluida'
 WHEN EXISTS(SELECT 1 FROM execucao e WHERE e.organizacao_id=p.organizacao_id AND e.programacao_id=p.id AND execucao_vigente(e.organizacao_id,e.id)) THEN 'parcial' ELSE 'prevista' END AS estado_execucao FROM programacao p;
INSERT INTO permissao VALUES('clinica:corrigir_contexto'),('clinica:anular');

-- Existing derived facts retain identity/content; only current-origin projections change.
CREATE OR REPLACE VIEW evento_cobertura_consulta WITH(security_invoker=true) AS
 SELECT ev.*,
 CASE WHEN ev.execucao_id IS NOT NULL THEN execucao_vigente(ev.organizacao_id,ev.execucao_id)
 ELSE NOT EXISTS(SELECT 1 FROM estorno_consumo s WHERE s.organizacao_id=ev.organizacao_id AND s.consumo_id=ci.consumo_id) END AS origem_ativa,
 coalesce(e.resultado='integral',false) AS execucao_integral,coalesce(cu.tipo='tutor',false) AS material_tutor
 FROM evento_cobertura ev LEFT JOIN execucao e ON e.organizacao_id=ev.organizacao_id AND e.id=ev.execucao_id
 LEFT JOIN consumo_item ci ON ci.organizacao_id=ev.organizacao_id AND ci.id=ev.consumo_item_id
 LEFT JOIN posicao_estoque p ON p.organizacao_id=ci.organizacao_id AND p.id=ci.posicao_id LEFT JOIN custodia cu ON cu.organizacao_id=p.organizacao_id AND cu.id=p.custodia_id;
CREATE OR REPLACE VIEW periodo_diaria_consulta WITH(security_invoker=true) AS
 SELECT p.*,pe.pacote_versao_id,
 coalesce((pv.limite_encerramento='alta_clinica' AND p.fim>e.alta_clinica_em) OR (pv.limite_encerramento='saida_fisica' AND p.fim>e.encerrado_em) OR
 (ce.id IS NOT NULL AND (ce.inicio>p.inicio OR ce.fim<p.fim)) OR (ce.avaliacao_clinica_id IS NOT NULL AND NOT execucao_vigente(ce.organizacao_id,ce.avaliacao_clinica_id)),false) AS necessita_revisao
 FROM periodo_diaria p JOIN pacote_episodio pe ON pe.organizacao_id=p.organizacao_id AND pe.id=p.pacote_episodio_id
 JOIN pacote_versao pv ON pv.organizacao_id=pe.organizacao_id AND pv.id=pe.pacote_versao_id JOIN episodio e ON e.organizacao_id=p.organizacao_id AND e.id=p.episodio_id
 LEFT JOIN classificacao_episodio ce ON ce.organizacao_id=p.organizacao_id AND ce.id=p.classificacao_episodio_id;
CREATE OR REPLACE VIEW evento_cobravel_consulta WITH(security_invoker=true) AS SELECT e.*,
 CASE WHEN e.execucao_id IS NOT NULL THEN execucao_vigente(e.organizacao_id,e.execucao_id)
 WHEN e.consumo_item_id IS NOT NULL THEN NOT EXISTS(SELECT 1 FROM estorno_consumo s WHERE s.organizacao_id=e.organizacao_id AND s.consumo_id=ci.consumo_id)
 ELSE NOT coalesce(p.necessita_revisao,true) END AS origem_ativa,
 (e.execucao_id IS NOT NULL AND EXISTS(SELECT 1 FROM execucao x WHERE x.organizacao_id=e.organizacao_id AND x.id=e.execucao_id AND x.resultado<>'integral')) OR
 (e.consumo_item_id IS NOT NULL AND EXISTS(SELECT 1 FROM posicao_estoque pos JOIN custodia cu ON cu.organizacao_id=pos.organizacao_id AND cu.id=pos.custodia_id WHERE pos.organizacao_id=ci.organizacao_id AND pos.id=ci.posicao_id AND cu.tipo='tutor')) AS semantica_pendente,
 e.periodo_diaria_id IS NULL AND (EXISTS(SELECT 1 FROM pacote_episodio pe WHERE pe.organizacao_id=e.organizacao_id AND pe.episodio_id=e.episodio_id AND pe.inicio<=e.competencia AND pe.fim>e.competencia) OR EXISTS(SELECT 1 FROM evento_cobertura ce WHERE ce.organizacao_id=e.organizacao_id AND (ce.execucao_id=e.execucao_id OR ce.consumo_item_id=e.consumo_item_id))) AS contexto_diaria
 FROM evento_cobravel e LEFT JOIN consumo_item ci ON ci.organizacao_id=e.organizacao_id AND ci.id=e.consumo_item_id LEFT JOIN periodo_diaria_consulta p ON p.organizacao_id=e.organizacao_id AND p.id=e.periodo_diaria_id;
CREATE OR REPLACE VIEW coleta_exame_consulta WITH(security_invoker=true) AS SELECT c.*,d.situacao AS situacao_amostra,
 c.origem='externa' OR execucao_vigente(c.organizacao_id,c.execucao_id) AS origem_ativa
 FROM coleta_exame c LEFT JOIN decisao_amostra d ON d.organizacao_id=c.organizacao_id AND d.coleta_id=c.id;
CREATE OR REPLACE VIEW aplicacao_preventiva_consulta WITH(security_invoker=true) AS
 SELECT a.*,p.paciente_id,o.protocolo_paciente_id,
 NOT EXISTS(SELECT 1 FROM aplicacao_preventiva n WHERE n.organizacao_id=a.organizacao_id AND n.correcao_de_id=a.id) AND (a.origem='externa' OR execucao_vigente(a.organizacao_id,a.execucao_id)) AS ativa,
 EXISTS(SELECT 1 FROM vinculo_consumo_preventivo v JOIN consumo_item ci ON ci.organizacao_id=v.organizacao_id AND ci.id=v.consumo_item_id JOIN estorno_consumo es ON es.organizacao_id=ci.organizacao_id AND es.consumo_id=ci.consumo_id WHERE v.organizacao_id=a.organizacao_id AND v.aplicacao_id=a.id) AS material_revisao
 FROM aplicacao_preventiva a JOIN ocorrencia_preventiva o ON o.organizacao_id=a.organizacao_id AND o.id=a.ocorrencia_id JOIN protocolo_paciente p ON p.organizacao_id=o.organizacao_id AND p.id=o.protocolo_paciente_id;
