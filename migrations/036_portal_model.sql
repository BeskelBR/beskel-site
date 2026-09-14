SET search_path=hvb,public;
CREATE TABLE conta_portal(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 responsavel_id uuid NOT NULL,UNIQUE(organizacao_id,unidade_id,responsavel_id),FOREIGN KEY(organizacao_id,responsavel_id) REFERENCES responsavel(organizacao_id,id)
);
CREATE INDEX conta_portal_unidade ON conta_portal(organizacao_id,unidade_id,id);
CREATE TABLE revogacao_conta_portal(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 conta_portal_id uuid NOT NULL,UNIQUE(organizacao_id,conta_portal_id),FOREIGN KEY(organizacao_id,unidade_id,conta_portal_id) REFERENCES conta_portal(organizacao_id,unidade_id,id)
);
CREATE INDEX revogacao_conta_portal_unidade ON revogacao_conta_portal(organizacao_id,unidade_id,id);
CREATE TABLE concessao_portal(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 conta_portal_id uuid NOT NULL,paciente_id uuid NOT NULL,vinculo_id uuid NOT NULL,valida_ate timestamptz NOT NULL CHECK(isfinite(valida_ate)),evidencia text NOT NULL,FOREIGN KEY(organizacao_id,unidade_id,conta_portal_id) REFERENCES conta_portal(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,paciente_id) REFERENCES paciente(organizacao_id,id),FOREIGN KEY(organizacao_id,vinculo_id) REFERENCES paciente_responsavel(organizacao_id,id)
);
CREATE INDEX concessao_portal_unidade ON concessao_portal(organizacao_id,unidade_id,id);
CREATE TABLE revogacao_concessao_portal(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 concessao_id uuid NOT NULL,UNIQUE(organizacao_id,concessao_id),FOREIGN KEY(organizacao_id,unidade_id,concessao_id) REFERENCES concessao_portal(organizacao_id,unidade_id,id)
);
CREATE INDEX revogacao_concessao_portal_unidade ON revogacao_concessao_portal(organizacao_id,unidade_id,id);
CREATE TABLE preferencia_comunicacao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 conta_portal_id uuid NOT NULL,finalidade text NOT NULL CHECK(finalidade IN ('aviso','documento','agenda')),canal text NOT NULL DEFAULT 'portal_dev' CHECK(canal='portal_dev'),versao integer NOT NULL CHECK(versao>0),permitida boolean NOT NULL,evidencia text NOT NULL,UNIQUE(organizacao_id,conta_portal_id,finalidade,versao),FOREIGN KEY(organizacao_id,unidade_id,conta_portal_id) REFERENCES conta_portal(organizacao_id,unidade_id,id)
);
CREATE INDEX preferencia_comunicacao_unidade ON preferencia_comunicacao(organizacao_id,unidade_id,id);
CREATE TABLE mensagem_portal(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 concessao_id uuid NOT NULL,finalidade text NOT NULL CHECK(finalidade IN ('aviso','documento','agenda')),canal text NOT NULL CHECK(canal='portal_dev'),origem text NOT NULL CHECK(origem='registro_manual_dev'),referencia uuid NOT NULL,titulo text NOT NULL CHECK(length(titulo) BETWEEN 1 AND 160),texto text NOT NULL CHECK(length(texto) BETWEEN 1 AND 4000),agendamento_versao_id uuid,UNIQUE(organizacao_id,unidade_id,referencia),CHECK((finalidade='agenda')=(agendamento_versao_id IS NOT NULL)),FOREIGN KEY(organizacao_id,unidade_id,concessao_id) REFERENCES concessao_portal(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,agendamento_versao_id) REFERENCES agendamento_versao(organizacao_id,unidade_id,id)
);
CREATE INDEX mensagem_portal_unidade ON mensagem_portal(organizacao_id,unidade_id,id);
CREATE TABLE mensagem_documento(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 mensagem_id uuid NOT NULL,documento_versao_id uuid NOT NULL,UNIQUE(organizacao_id,mensagem_id,documento_versao_id),FOREIGN KEY(organizacao_id,unidade_id,mensagem_id) REFERENCES mensagem_portal(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,documento_versao_id) REFERENCES documento_versao(organizacao_id,unidade_id,id)
);
CREATE INDEX mensagem_documento_unidade ON mensagem_documento(organizacao_id,unidade_id,id);
CREATE TABLE tentativa_comunicacao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 mensagem_id uuid NOT NULL,sequencia integer NOT NULL CHECK(sequencia BETWEEN 1 AND 5),UNIQUE(organizacao_id,mensagem_id,sequencia),FOREIGN KEY(organizacao_id,unidade_id,mensagem_id) REFERENCES mensagem_portal(organizacao_id,unidade_id,id)
);
CREATE INDEX tentativa_comunicacao_unidade ON tentativa_comunicacao(organizacao_id,unidade_id,id);
CREATE TABLE retorno_comunicacao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 tentativa_id uuid NOT NULL,sequencia integer NOT NULL CHECK(sequencia>0),estado text NOT NULL CHECK(estado IN ('incerto','falha','enviado','entregue','lido')),ocorrido_em timestamptz NOT NULL CHECK(isfinite(ocorrido_em)),evidencia text NOT NULL,referencia uuid NOT NULL,UNIQUE(organizacao_id,tentativa_id,sequencia),UNIQUE(organizacao_id,referencia),FOREIGN KEY(organizacao_id,unidade_id,tentativa_id) REFERENCES tentativa_comunicacao(organizacao_id,unidade_id,id)
);
CREATE INDEX retorno_comunicacao_unidade ON retorno_comunicacao(organizacao_id,unidade_id,id);
CREATE TABLE credencial_portal(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,conta_portal_id uuid NOT NULL,token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),expira_em timestamptz NOT NULL CHECK(isfinite(expira_em)),criada_em timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(organizacao_id,conta_portal_id) REFERENCES conta_portal(organizacao_id,id));
CREATE INDEX concessao_portal_conta ON concessao_portal(organizacao_id,conta_portal_id,id);
CREATE INDEX mensagem_portal_concessao ON mensagem_portal(organizacao_id,concessao_id,id);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['conta_portal','revogacao_conta_portal','concessao_portal','revogacao_concessao_portal','preferencia_comunicacao','mensagem_portal','mensagem_documento','tentativa_comunicacao','retorno_comunicacao','credencial_portal'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant ON %I USING(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid) WITH CHECK(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid)',t);
 EXECUTE format('CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION impedir_alteracao()',t);
 IF t<>'credencial_portal' THEN
 EXECUTE format('GRANT INSERT ON %I TO hvb_app',t);
 EXECUTE format('CREATE TRIGGER a_comando BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame()',t);END IF;
 END LOOP;END $$;
INSERT INTO permissao VALUES('portal:administrar'),('portal:ler'),('portal:autorizar'),('comunicacao:preferencias'),('comunicacao:preparar'),('comunicacao:simular'),('comunicacao:ler');
