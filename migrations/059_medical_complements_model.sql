SET search_path=hvb,public;
CREATE TABLE modelo_evolucao_versao(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
codigo text NOT NULL CHECK(codigo ~ '^[a-z][a-z0-9_]{0,31}$'),nome text NOT NULL CHECK(length(btrim(nome)) BETWEEN 1 AND 160),tipo text NOT NULL CHECK(tipo IN ('anamnese','evolucao','observacao')),versao integer NOT NULL CHECK(versao>0),anterior_id uuid,campos jsonb NOT NULL,CHECK((versao=1)=(anterior_id IS NULL)),UNIQUE(organizacao_id,unidade_id,codigo,versao),UNIQUE(organizacao_id,anterior_id),FOREIGN KEY(organizacao_id,unidade_id,anterior_id) REFERENCES modelo_evolucao_versao(organizacao_id,unidade_id,id)
);
CREATE INDEX modelo_evolucao_versao_unidade ON modelo_evolucao_versao(organizacao_id,unidade_id,id);
ALTER TABLE modelo_evolucao_versao ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelo_evolucao_versao FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON modelo_evolucao_versao USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON modelo_evolucao_versao TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON modelo_evolucao_versao FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON modelo_evolucao_versao FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE preenchimento_modelo_evolucao(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
evolucao_versao_id uuid NOT NULL,FOREIGN KEY(organizacao_id,unidade_id,evolucao_versao_id) REFERENCES evolucao_clinica_versao(organizacao_id,unidade_id,id),modelo_versao_id uuid NOT NULL,respostas jsonb NOT NULL,UNIQUE(organizacao_id,evolucao_versao_id),FOREIGN KEY(organizacao_id,unidade_id,modelo_versao_id) REFERENCES modelo_evolucao_versao(organizacao_id,unidade_id,id)
);
CREATE INDEX preenchimento_modelo_evolucao_unidade ON preenchimento_modelo_evolucao(organizacao_id,unidade_id,id);
ALTER TABLE preenchimento_modelo_evolucao ENABLE ROW LEVEL SECURITY;
ALTER TABLE preenchimento_modelo_evolucao FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON preenchimento_modelo_evolucao USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON preenchimento_modelo_evolucao TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON preenchimento_modelo_evolucao FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON preenchimento_modelo_evolucao FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE anexo_evolucao(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
evolucao_versao_id uuid NOT NULL,FOREIGN KEY(organizacao_id,unidade_id,evolucao_versao_id) REFERENCES evolucao_clinica_versao(organizacao_id,unidade_id,id),hash_evolucao text NOT NULL,nome text NOT NULL CHECK(nome ~ '^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}$'),mime text NOT NULL CHECK(mime IN ('application/pdf','image/png','image/jpeg')),conteudo bytea NOT NULL CHECK(octet_length(conteudo) BETWEEN 1 AND 262144),hash_conteudo text NOT NULL,tamanho integer NOT NULL
);
CREATE INDEX anexo_evolucao_unidade ON anexo_evolucao(organizacao_id,unidade_id,id);
ALTER TABLE anexo_evolucao ENABLE ROW LEVEL SECURITY;
ALTER TABLE anexo_evolucao FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON anexo_evolucao USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON anexo_evolucao TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON anexo_evolucao FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON anexo_evolucao FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE revogacao_anexo_evolucao(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
anexo_id uuid NOT NULL,UNIQUE(organizacao_id,anexo_id),FOREIGN KEY(organizacao_id,unidade_id,anexo_id) REFERENCES anexo_evolucao(organizacao_id,unidade_id,id)
);
CREATE INDEX revogacao_anexo_evolucao_unidade ON revogacao_anexo_evolucao(organizacao_id,unidade_id,id);
ALTER TABLE revogacao_anexo_evolucao ENABLE ROW LEVEL SECURITY;
ALTER TABLE revogacao_anexo_evolucao FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON revogacao_anexo_evolucao USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON revogacao_anexo_evolucao TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON revogacao_anexo_evolucao FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON revogacao_anexo_evolucao FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE coautoria_evolucao(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
evolucao_versao_id uuid NOT NULL,FOREIGN KEY(organizacao_id,unidade_id,evolucao_versao_id) REFERENCES evolucao_clinica_versao(organizacao_id,unidade_id,id),hash_evolucao text NOT NULL,UNIQUE(organizacao_id,evolucao_versao_id,autor_id)
);
CREATE INDEX coautoria_evolucao_unidade ON coautoria_evolucao(organizacao_id,unidade_id,id);
ALTER TABLE coautoria_evolucao ENABLE ROW LEVEL SECURITY;
ALTER TABLE coautoria_evolucao FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON coautoria_evolucao USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON coautoria_evolucao TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON coautoria_evolucao FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON coautoria_evolucao FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE revogacao_coautoria_evolucao(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
coautoria_id uuid NOT NULL,UNIQUE(organizacao_id,coautoria_id),FOREIGN KEY(organizacao_id,unidade_id,coautoria_id) REFERENCES coautoria_evolucao(organizacao_id,unidade_id,id)
);
CREATE INDEX revogacao_coautoria_evolucao_unidade ON revogacao_coautoria_evolucao(organizacao_id,unidade_id,id);
ALTER TABLE revogacao_coautoria_evolucao ENABLE ROW LEVEL SECURITY;
ALTER TABLE revogacao_coautoria_evolucao FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON revogacao_coautoria_evolucao USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON revogacao_coautoria_evolucao TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON revogacao_coautoria_evolucao FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON revogacao_coautoria_evolucao FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE INDEX evolucao_busca ON evolucao_clinica_versao USING gin(to_tsvector('portuguese',conteudo));
INSERT INTO permissao VALUES('prontuario:modelar'),('prontuario:anexar'),('prontuario:coautoria');
