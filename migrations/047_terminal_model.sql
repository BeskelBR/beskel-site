SET search_path=hvb,public;
CREATE TABLE etiqueta_terminal(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
codigo uuid NOT NULL,paciente_id uuid,posicao_id uuid,CHECK(num_nonnulls(paciente_id,posicao_id)=1),UNIQUE(organizacao_id,unidade_id,codigo),FOREIGN KEY(organizacao_id,paciente_id) REFERENCES paciente(organizacao_id,id),FOREIGN KEY(organizacao_id,unidade_id,posicao_id) REFERENCES posicao_estoque(organizacao_id,unidade_id,id));
CREATE INDEX etiqueta_terminal_unidade ON etiqueta_terminal(organizacao_id,unidade_id,id);
ALTER TABLE etiqueta_terminal ENABLE ROW LEVEL SECURITY;
ALTER TABLE etiqueta_terminal FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON etiqueta_terminal USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON etiqueta_terminal TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON etiqueta_terminal FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON etiqueta_terminal FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE revogacao_etiqueta_terminal(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
etiqueta_id uuid NOT NULL,UNIQUE(organizacao_id,etiqueta_id),FOREIGN KEY(organizacao_id,unidade_id,etiqueta_id) REFERENCES etiqueta_terminal(organizacao_id,unidade_id,id));
CREATE INDEX revogacao_etiqueta_terminal_unidade ON revogacao_etiqueta_terminal(organizacao_id,unidade_id,id);
ALTER TABLE revogacao_etiqueta_terminal ENABLE ROW LEVEL SECURITY;
ALTER TABLE revogacao_etiqueta_terminal FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON revogacao_etiqueta_terminal USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON revogacao_etiqueta_terminal TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON revogacao_etiqueta_terminal FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON revogacao_etiqueta_terminal FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE leitura_terminal(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
etiqueta_id uuid NOT NULL,dispositivo_id uuid NOT NULL,episodio_id uuid,referencia uuid NOT NULL,ocorrida_em timestamptz NOT NULL CHECK(isfinite(ocorrida_em)),UNIQUE(organizacao_id,dispositivo_id,referencia),FOREIGN KEY(organizacao_id,unidade_id,etiqueta_id) REFERENCES etiqueta_terminal(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,dispositivo_id) REFERENCES dispositivo(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id));
CREATE INDEX leitura_terminal_unidade ON leitura_terminal(organizacao_id,unidade_id,id);
ALTER TABLE leitura_terminal ENABLE ROW LEVEL SECURITY;
ALTER TABLE leitura_terminal FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON leitura_terminal USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON leitura_terminal TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON leitura_terminal FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON leitura_terminal FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE retirada_terminal(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
leitura_id uuid NOT NULL,UNIQUE(organizacao_id,leitura_id),FOREIGN KEY(organizacao_id,unidade_id,leitura_id) REFERENCES leitura_terminal(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,id) REFERENCES transacao_estoque(organizacao_id,unidade_id,id));
CREATE INDEX retirada_terminal_unidade ON retirada_terminal(organizacao_id,unidade_id,id);
ALTER TABLE retirada_terminal ENABLE ROW LEVEL SECURITY;
ALTER TABLE retirada_terminal FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON retirada_terminal USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON retirada_terminal TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON retirada_terminal FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON retirada_terminal FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
INSERT INTO permissao VALUES('terminal:ler'),('terminal:configurar'),('terminal:usar');
