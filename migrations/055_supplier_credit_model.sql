SET search_path=hvb,public;
CREATE TABLE credito_fornecedor(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
fornecedor_id uuid NOT NULL,origem_obrigacao_id uuid,correcao_de_id uuid,origem text NOT NULL CHECK(origem IN ('devolucao','abatimento','outro')),referencia uuid NOT NULL,documento_referencia text NOT NULL CHECK(length(btrim(documento_referencia)) BETWEEN 1 AND 160),descricao text NOT NULL,ocorrido_em timestamptz NOT NULL CHECK(isfinite(ocorrido_em)),valor valor_monetario NOT NULL CHECK(valor>0),UNIQUE(organizacao_id,unidade_id,referencia),UNIQUE(organizacao_id,correcao_de_id),FOREIGN KEY(organizacao_id,unidade_id,fornecedor_id) REFERENCES fornecedor_compra(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,origem_obrigacao_id) REFERENCES obrigacao_fornecedor(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,correcao_de_id) REFERENCES credito_fornecedor(organizacao_id,unidade_id,id));
CREATE INDEX credito_fornecedor_unidade ON credito_fornecedor(organizacao_id,unidade_id,id);
ALTER TABLE credito_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE credito_fornecedor FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON credito_fornecedor USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON credito_fornecedor TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON credito_fornecedor FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON credito_fornecedor FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE reversao_credito_fornecedor(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
credito_id uuid NOT NULL,UNIQUE(organizacao_id,credito_id),FOREIGN KEY(organizacao_id,unidade_id,credito_id) REFERENCES credito_fornecedor(organizacao_id,unidade_id,id));
CREATE INDEX reversao_credito_fornecedor_unidade ON reversao_credito_fornecedor(organizacao_id,unidade_id,id);
ALTER TABLE reversao_credito_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE reversao_credito_fornecedor FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON reversao_credito_fornecedor USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON reversao_credito_fornecedor TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON reversao_credito_fornecedor FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON reversao_credito_fornecedor FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE UNIQUE INDEX credito_fornecedor_documento_original ON credito_fornecedor(organizacao_id,unidade_id,fornecedor_id,documento_referencia) WHERE correcao_de_id IS NULL;
ALTER TABLE liquidacao_fornecedor ALTER COLUMN pagamento_id DROP NOT NULL;
ALTER TABLE liquidacao_fornecedor ADD COLUMN credito_id uuid;
ALTER TABLE liquidacao_fornecedor ADD CONSTRAINT liquidacao_fonte_unica CHECK(num_nonnulls(pagamento_id,credito_id)=1);
ALTER TABLE liquidacao_fornecedor ADD FOREIGN KEY(organizacao_id,unidade_id,credito_id) REFERENCES credito_fornecedor(organizacao_id,unidade_id,id);
CREATE INDEX liquidacao_fornecedor_credito ON liquidacao_fornecedor(organizacao_id,credito_id);
INSERT INTO permissao VALUES('pagar:creditar'),('pagar:aplicar_credito');
