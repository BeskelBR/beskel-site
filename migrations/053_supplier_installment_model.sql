SET search_path=hvb,public;
CREATE TABLE plano_parcelas_fornecedor(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
obrigacao_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),anterior_id uuid,CHECK((versao=1)=(anterior_id IS NULL)),UNIQUE(organizacao_id,obrigacao_id,versao),UNIQUE(organizacao_id,anterior_id),FOREIGN KEY(organizacao_id,unidade_id,obrigacao_id) REFERENCES obrigacao_fornecedor(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,anterior_id) REFERENCES plano_parcelas_fornecedor(organizacao_id,unidade_id,id));
CREATE INDEX plano_parcelas_fornecedor_unidade ON plano_parcelas_fornecedor(organizacao_id,unidade_id,id);
ALTER TABLE plano_parcelas_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE plano_parcelas_fornecedor FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON plano_parcelas_fornecedor USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON plano_parcelas_fornecedor TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON plano_parcelas_fornecedor FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON plano_parcelas_fornecedor FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE parcela_fornecedor(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
plano_id uuid NOT NULL,numero integer NOT NULL CHECK(numero BETWEEN 1 AND 120),vencimento date NOT NULL CHECK(isfinite(vencimento)),valor valor_monetario NOT NULL CHECK(valor>0),UNIQUE(organizacao_id,plano_id,numero),FOREIGN KEY(organizacao_id,unidade_id,plano_id) REFERENCES plano_parcelas_fornecedor(organizacao_id,unidade_id,id));
CREATE INDEX parcela_fornecedor_unidade ON parcela_fornecedor(organizacao_id,unidade_id,id);
ALTER TABLE parcela_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcela_fornecedor FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON parcela_fornecedor USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON parcela_fornecedor TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON parcela_fornecedor FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON parcela_fornecedor FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE alocacao_parcela_fornecedor(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
parcela_id uuid NOT NULL,liquidacao_id uuid NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),FOREIGN KEY(organizacao_id,unidade_id,parcela_id) REFERENCES parcela_fornecedor(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,liquidacao_id) REFERENCES liquidacao_fornecedor(organizacao_id,unidade_id,id));
CREATE INDEX alocacao_parcela_fornecedor_unidade ON alocacao_parcela_fornecedor(organizacao_id,unidade_id,id);
ALTER TABLE alocacao_parcela_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE alocacao_parcela_fornecedor FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON alocacao_parcela_fornecedor USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON alocacao_parcela_fornecedor TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON alocacao_parcela_fornecedor FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON alocacao_parcela_fornecedor FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE reversao_alocacao_parcela(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
alocacao_id uuid NOT NULL,UNIQUE(organizacao_id,alocacao_id),FOREIGN KEY(organizacao_id,unidade_id,alocacao_id) REFERENCES alocacao_parcela_fornecedor(organizacao_id,unidade_id,id));
CREATE INDEX reversao_alocacao_parcela_unidade ON reversao_alocacao_parcela(organizacao_id,unidade_id,id);
ALTER TABLE reversao_alocacao_parcela ENABLE ROW LEVEL SECURITY;
ALTER TABLE reversao_alocacao_parcela FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON reversao_alocacao_parcela USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON reversao_alocacao_parcela TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON reversao_alocacao_parcela FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON reversao_alocacao_parcela FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE INDEX alocacao_parcela_alvo ON alocacao_parcela_fornecedor(organizacao_id,parcela_id);
CREATE INDEX alocacao_parcela_liquidacao ON alocacao_parcela_fornecedor(organizacao_id,liquidacao_id);
INSERT INTO permissao VALUES('pagar:parcelar'),('pagar:alocar_parcela');
