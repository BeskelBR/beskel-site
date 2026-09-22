SET search_path=hvb,public;
CREATE TABLE vinculo_agendamento_episodio(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),agendamento_versao_id uuid NOT NULL,episodio_id uuid NOT NULL,episodio_versao integer NOT NULL CHECK(episodio_versao>0),FOREIGN KEY(organizacao_id,unidade_id,agendamento_versao_id) REFERENCES agendamento_versao(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id));
CREATE INDEX vinculo_agendamento_episodio_unidade ON vinculo_agendamento_episodio(organizacao_id,unidade_id,id);
ALTER TABLE vinculo_agendamento_episodio ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculo_agendamento_episodio FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON vinculo_agendamento_episodio USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON vinculo_agendamento_episodio TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON vinculo_agendamento_episodio FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON vinculo_agendamento_episodio FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE revogacao_vinculo_agendamento(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),vinculo_id uuid NOT NULL,UNIQUE(organizacao_id,vinculo_id),FOREIGN KEY(organizacao_id,unidade_id,vinculo_id) REFERENCES vinculo_agendamento_episodio(organizacao_id,unidade_id,id));
CREATE INDEX revogacao_vinculo_agendamento_unidade ON revogacao_vinculo_agendamento(organizacao_id,unidade_id,id);
ALTER TABLE revogacao_vinculo_agendamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE revogacao_vinculo_agendamento FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON revogacao_vinculo_agendamento USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON revogacao_vinculo_agendamento TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON revogacao_vinculo_agendamento FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON revogacao_vinculo_agendamento FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
ALTER TABLE credencial_portal ADD CONSTRAINT credencial_portal_org_id UNIQUE(organizacao_id,id);
CREATE TABLE leitura_auditada(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid,usuario_id uuid,conta_portal_id uuid,credencial_id uuid,credencial_portal_id uuid,correlation_id uuid NOT NULL UNIQUE,rota text NOT NULL CHECK(rota ~ '^/v1/' AND length(rota)<=160),metodo text NOT NULL CHECK(metodo IN ('GET','HEAD')),status_consulta integer NOT NULL CHECK(status_consulta BETWEEN 200 AND 499),parametros jsonb NOT NULL,criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((usuario_id IS NOT NULL AND credencial_id IS NOT NULL AND conta_portal_id IS NULL AND credencial_portal_id IS NULL) OR (usuario_id IS NULL AND credencial_id IS NULL AND conta_portal_id IS NOT NULL AND credencial_portal_id IS NOT NULL)),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,usuario_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,conta_portal_id) REFERENCES conta_portal(organizacao_id,id),FOREIGN KEY(organizacao_id,credencial_id) REFERENCES credencial(organizacao_id,id),FOREIGN KEY(organizacao_id,credencial_portal_id) REFERENCES credencial_portal(organizacao_id,id)
);
CREATE INDEX leitura_auditada_periodo ON leitura_auditada(organizacao_id,criada_em,id);
ALTER TABLE leitura_auditada ENABLE ROW LEVEL SECURITY;
ALTER TABLE leitura_auditada FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON leitura_auditada USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON leitura_auditada TO hvb_app;
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON leitura_auditada FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
INSERT INTO permissao VALUES('agenda:vincular_episodio'),('auditoria:leituras');
