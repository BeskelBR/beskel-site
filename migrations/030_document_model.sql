SET search_path=hvb,public;
CREATE TABLE modelo_documento(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 codigo text NOT NULL,nome text NOT NULL,tipo text NOT NULL CHECK(tipo IN ('termo','declaracao','orientacao','boletim','outro')),UNIQUE(organizacao_id,unidade_id,codigo)
);
CREATE INDEX modelo_documento_unidade ON modelo_documento(organizacao_id,unidade_id,id);
CREATE TABLE modelo_documento_versao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 modelo_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),titulo text NOT NULL,texto_base text NOT NULL CHECK(length(texto_base) BETWEEN 1 AND 20000),publico text NOT NULL CHECK(publico IN ('interno','responsavel')),UNIQUE(organizacao_id,modelo_id,versao),FOREIGN KEY(organizacao_id,unidade_id,modelo_id) REFERENCES modelo_documento(organizacao_id,unidade_id,id)
);
CREATE INDEX modelo_documento_versao_unidade ON modelo_documento_versao(organizacao_id,unidade_id,id);
CREATE TABLE campo_modelo_documento(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 modelo_versao_id uuid NOT NULL,codigo text NOT NULL CHECK(codigo~'^[a-z][a-z0-9_]{0,39}$'),obrigatorio boolean NOT NULL,UNIQUE(organizacao_id,modelo_versao_id,codigo),FOREIGN KEY(organizacao_id,unidade_id,modelo_versao_id) REFERENCES modelo_documento_versao(organizacao_id,unidade_id,id)
);
CREATE INDEX campo_modelo_documento_unidade ON campo_modelo_documento(organizacao_id,unidade_id,id);
CREATE TABLE aprovacao_modelo_documento(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 modelo_versao_id uuid NOT NULL,UNIQUE(organizacao_id,modelo_versao_id),FOREIGN KEY(organizacao_id,unidade_id,modelo_versao_id) REFERENCES modelo_documento_versao(organizacao_id,unidade_id,id)
);
CREATE INDEX aprovacao_modelo_documento_unidade ON aprovacao_modelo_documento(organizacao_id,unidade_id,id);
CREATE TABLE solicitacao_documento(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 paciente_id uuid NOT NULL,episodio_id uuid,modelo_id uuid NOT NULL,solicitante_responsavel_id uuid,solicitante_usuario_id uuid,escopo text NOT NULL,protocolo uuid NOT NULL,recebida_em timestamptz NOT NULL CHECK(isfinite(recebida_em)),prazo_em timestamptz NOT NULL CHECK(isfinite(prazo_em) AND prazo_em>=recebida_em),evidencia_autorizacao text NOT NULL,CHECK((solicitante_responsavel_id IS NULL)<>(solicitante_usuario_id IS NULL)),UNIQUE(organizacao_id,unidade_id,protocolo),FOREIGN KEY(organizacao_id,paciente_id) REFERENCES paciente(organizacao_id,id),FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,modelo_id) REFERENCES modelo_documento(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,solicitante_responsavel_id) REFERENCES responsavel(organizacao_id,id),FOREIGN KEY(organizacao_id,solicitante_usuario_id) REFERENCES usuario(organizacao_id,id)
);
CREATE INDEX solicitacao_documento_unidade ON solicitacao_documento(organizacao_id,unidade_id,id);
CREATE TABLE autorizacao_documento(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 solicitacao_id uuid NOT NULL,decisao text NOT NULL CHECK(decisao IN ('permitida','negada')),valida_ate timestamptz NOT NULL CHECK(isfinite(valida_ate)),evidencia text NOT NULL,UNIQUE(organizacao_id,solicitacao_id),FOREIGN KEY(organizacao_id,unidade_id,solicitacao_id) REFERENCES solicitacao_documento(organizacao_id,unidade_id,id)
);
CREATE INDEX autorizacao_documento_unidade ON autorizacao_documento(organizacao_id,unidade_id,id);
CREATE TABLE revogacao_autorizacao_documento(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 autorizacao_id uuid NOT NULL,UNIQUE(organizacao_id,autorizacao_id),FOREIGN KEY(organizacao_id,unidade_id,autorizacao_id) REFERENCES autorizacao_documento(organizacao_id,unidade_id,id)
);
CREATE INDEX revogacao_autorizacao_documento_unidade ON revogacao_autorizacao_documento(organizacao_id,unidade_id,id);
CREATE TABLE documento_versao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 solicitacao_id uuid NOT NULL,modelo_versao_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),anterior_id uuid,campos jsonb NOT NULL CHECK(jsonb_typeof(campos)='object'),conteudo text NOT NULL CHECK(length(conteudo) BETWEEN 1 AND 120000),hash_conteudo text NOT NULL CHECK(hash_conteudo~'^[a-f0-9]{64}$'),UNIQUE(organizacao_id,solicitacao_id,versao),UNIQUE(organizacao_id,anterior_id),CHECK((versao=1)=(anterior_id IS NULL)),FOREIGN KEY(organizacao_id,unidade_id,solicitacao_id) REFERENCES solicitacao_documento(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,modelo_versao_id) REFERENCES modelo_documento_versao(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,anterior_id) REFERENCES documento_versao(organizacao_id,unidade_id,id)
);
CREATE INDEX documento_versao_unidade ON documento_versao(organizacao_id,unidade_id,id);
CREATE TABLE aprovacao_documento(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 documento_versao_id uuid NOT NULL,UNIQUE(organizacao_id,documento_versao_id),FOREIGN KEY(organizacao_id,unidade_id,documento_versao_id) REFERENCES documento_versao(organizacao_id,unidade_id,id)
);
CREATE INDEX aprovacao_documento_unidade ON aprovacao_documento(organizacao_id,unidade_id,id);
CREATE TABLE assinatura_documento(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 documento_versao_id uuid NOT NULL,signatario_usuario_id uuid,signatario_responsavel_id uuid,mecanismo text NOT NULL CHECK(mecanismo='declaracao_dev'),estado text NOT NULL CHECK(estado='declarada_nao_verificada'),hash_conteudo text NOT NULL CHECK(hash_conteudo~'^[a-f0-9]{64}$'),declarada_em timestamptz NOT NULL CHECK(isfinite(declarada_em)),evidencia text NOT NULL,referencia uuid NOT NULL,CHECK((signatario_usuario_id IS NULL)<>(signatario_responsavel_id IS NULL)),UNIQUE(organizacao_id,unidade_id,referencia),FOREIGN KEY(organizacao_id,unidade_id,documento_versao_id) REFERENCES documento_versao(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,signatario_usuario_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,signatario_responsavel_id) REFERENCES responsavel(organizacao_id,id)
);
CREATE INDEX assinatura_documento_unidade ON assinatura_documento(organizacao_id,unidade_id,id);
CREATE TABLE entrega_documento(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 documento_versao_id uuid NOT NULL,destinatario_id uuid NOT NULL,entregue_em timestamptz NOT NULL CHECK(isfinite(entregue_em)),canal text NOT NULL CHECK(canal='registro_manual_dev'),evidencia text NOT NULL,referencia uuid NOT NULL,UNIQUE(organizacao_id,unidade_id,referencia),FOREIGN KEY(organizacao_id,unidade_id,documento_versao_id) REFERENCES documento_versao(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,destinatario_id) REFERENCES responsavel(organizacao_id,id)
);
CREATE INDEX entrega_documento_unidade ON entrega_documento(organizacao_id,unidade_id,id);
CREATE INDEX documento_solicitacao ON documento_versao(organizacao_id,solicitacao_id,versao DESC);
CREATE INDEX solicitacao_documento_paciente ON solicitacao_documento(organizacao_id,unidade_id,paciente_id,id);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['modelo_documento','modelo_documento_versao','campo_modelo_documento','aprovacao_modelo_documento','solicitacao_documento','autorizacao_documento','revogacao_autorizacao_documento','documento_versao','aprovacao_documento','assinatura_documento','entrega_documento'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant ON %I USING(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid) WITH CHECK(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid)',t);
 EXECUTE format('GRANT INSERT ON %I TO hvb_app',t);
 EXECUTE format('CREATE TRIGGER a_comando BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame()',t);
 EXECUTE format('CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION impedir_alteracao()',t);
 END LOOP;END $$;
INSERT INTO permissao VALUES('documentos:ler'),('documentos:conteudo'),('documentos:configurar'),('documentos:aprovar_modelo'),('documentos:solicitar'),('documentos:autorizar'),('documentos:redigir'),('documentos:aprovar'),('documentos:registrar_assinatura'),('documentos:registrar_entrega');
