SET search_path=hvb,public;
CREATE TABLE revisao_pacote_episodio(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,episodio_id uuid NOT NULL,
 pacote_episodio_id uuid NOT NULL,substituta_id uuid,tipo text NOT NULL CHECK(tipo IN ('correcao','cancelamento')),
 autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((tipo='correcao')=(substituta_id IS NOT NULL)),CHECK(pacote_episodio_id IS DISTINCT FROM substituta_id),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,pacote_episodio_id),UNIQUE(organizacao_id,substituta_id),
 FOREIGN KEY(organizacao_id,episodio_id,pacote_episodio_id) REFERENCES pacote_episodio(organizacao_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,pacote_episodio_id) REFERENCES pacote_episodio(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,episodio_id,substituta_id) REFERENCES pacote_episodio(organizacao_id,episodio_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(organizacao_id,unidade_id,substituta_id) REFERENCES pacote_episodio(organizacao_id,unidade_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id)
);
ALTER TABLE revisao_pacote_episodio ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisao_pacote_episodio FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON revisao_pacote_episodio USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON revisao_pacote_episodio TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON revisao_pacote_episodio FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON revisao_pacote_episodio FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE revisao_periodo_diaria(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,episodio_id uuid NOT NULL,
 periodo_diaria_id uuid NOT NULL,substituta_id uuid,tipo text NOT NULL CHECK(tipo IN ('correcao','cancelamento')),
 autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((tipo='correcao')=(substituta_id IS NOT NULL)),CHECK(periodo_diaria_id IS DISTINCT FROM substituta_id),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,periodo_diaria_id),UNIQUE(organizacao_id,substituta_id),
 FOREIGN KEY(organizacao_id,episodio_id,periodo_diaria_id) REFERENCES periodo_diaria(organizacao_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,periodo_diaria_id) REFERENCES periodo_diaria(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,episodio_id,substituta_id) REFERENCES periodo_diaria(organizacao_id,episodio_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(organizacao_id,unidade_id,substituta_id) REFERENCES periodo_diaria(organizacao_id,unidade_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id)
);
ALTER TABLE revisao_periodo_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisao_periodo_diaria FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON revisao_periodo_diaria USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON revisao_periodo_diaria TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON revisao_periodo_diaria FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON revisao_periodo_diaria FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE FUNCTION pacote_episodio_vigente(org uuid,alvo uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=hvb,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM pacote_episodio p WHERE p.organizacao_id=org AND p.id=alvo AND NOT EXISTS(SELECT 1 FROM revisao_pacote_episodio r WHERE r.organizacao_id=org AND r.pacote_episodio_id=alvo));
$$;
CREATE FUNCTION periodo_diaria_vigente(org uuid,alvo uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=hvb,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM periodo_diaria p WHERE p.organizacao_id=org AND p.id=alvo AND pacote_episodio_vigente(org,p.pacote_episodio_id) AND NOT EXISTS(SELECT 1 FROM revisao_periodo_diaria r WHERE r.organizacao_id=org AND r.periodo_diaria_id=alvo));
$$;
CREATE VIEW pacote_episodio_consulta WITH(security_invoker=true) AS
 SELECT p.*,r.id AS revisao_id,r.substituta_id,coalesce(r.tipo,'vigente') AS situacao FROM pacote_episodio p LEFT JOIN revisao_pacote_episodio r ON r.organizacao_id=p.organizacao_id AND r.pacote_episodio_id=p.id;
CREATE OR REPLACE VIEW periodo_diaria_consulta WITH(security_invoker=true) AS
 SELECT p.*,pe.pacote_versao_id,
 NOT periodo_diaria_vigente(p.organizacao_id,p.id) OR coalesce((pv.limite_encerramento='alta_clinica' AND p.fim>e.alta_clinica_em) OR (pv.limite_encerramento='saida_fisica' AND p.fim>e.encerrado_em) OR
 (ce.id IS NOT NULL AND (ce.inicio>p.inicio OR ce.fim<p.fim)) OR (ce.avaliacao_clinica_id IS NOT NULL AND NOT execucao_vigente(ce.organizacao_id,ce.avaliacao_clinica_id)),false) AS necessita_revisao,r.id AS revisao_id,r.substituta_id,coalesce(r.tipo,'vigente') AS situacao
 FROM periodo_diaria p JOIN pacote_episodio pe ON pe.organizacao_id=p.organizacao_id AND pe.id=p.pacote_episodio_id
 JOIN pacote_versao pv ON pv.organizacao_id=pe.organizacao_id AND pv.id=pe.pacote_versao_id JOIN episodio e ON e.organizacao_id=p.organizacao_id AND e.id=p.episodio_id
 LEFT JOIN classificacao_episodio ce ON ce.organizacao_id=p.organizacao_id AND ce.id=p.classificacao_episodio_id
 LEFT JOIN revisao_periodo_diaria r ON r.organizacao_id=p.organizacao_id AND r.periodo_diaria_id=p.id;
INSERT INTO permissao VALUES('diarias:corrigir');
