SET search_path=hvb,public;
CREATE TABLE obrigacao_fornecedor(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
fornecedor_id uuid NOT NULL,pedido_id uuid,origem text NOT NULL CHECK(origem IN ('compra','despesa')),referencia uuid NOT NULL,documento_referencia text NOT NULL CHECK(length(btrim(documento_referencia)) BETWEEN 1 AND 160),descricao text NOT NULL,ocorrida_em timestamptz NOT NULL CHECK(isfinite(ocorrida_em)),vencimento date NOT NULL CHECK(isfinite(vencimento)),valor valor_monetario NOT NULL CHECK(valor>0),CHECK((origem='compra')=(pedido_id IS NOT NULL)),UNIQUE(organizacao_id,unidade_id,referencia),UNIQUE(organizacao_id,unidade_id,fornecedor_id,documento_referencia),FOREIGN KEY(organizacao_id,unidade_id,fornecedor_id) REFERENCES fornecedor_compra(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,pedido_id) REFERENCES pedido_compra(organizacao_id,unidade_id,id));
CREATE INDEX obrigacao_fornecedor_unidade ON obrigacao_fornecedor(organizacao_id,unidade_id,id);
ALTER TABLE obrigacao_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE obrigacao_fornecedor FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON obrigacao_fornecedor USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON obrigacao_fornecedor TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON obrigacao_fornecedor FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON obrigacao_fornecedor FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE pagamento_fornecedor(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
fornecedor_id uuid NOT NULL,conta_financeira_id uuid NOT NULL,referencia uuid NOT NULL,pago_em timestamptz NOT NULL CHECK(isfinite(pago_em)),valor valor_monetario NOT NULL CHECK(valor>0),evidencia text NOT NULL,UNIQUE(organizacao_id,unidade_id,referencia),FOREIGN KEY(organizacao_id,unidade_id,fornecedor_id) REFERENCES fornecedor_compra(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,conta_financeira_id) REFERENCES conta_financeira(organizacao_id,unidade_id,id));
CREATE INDEX pagamento_fornecedor_unidade ON pagamento_fornecedor(organizacao_id,unidade_id,id);
ALTER TABLE pagamento_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamento_fornecedor FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON pagamento_fornecedor USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON pagamento_fornecedor TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON pagamento_fornecedor FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON pagamento_fornecedor FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE liquidacao_fornecedor(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
obrigacao_id uuid NOT NULL,pagamento_id uuid NOT NULL,liquidada_em timestamptz NOT NULL CHECK(isfinite(liquidada_em)),valor valor_monetario NOT NULL CHECK(valor>0),FOREIGN KEY(organizacao_id,unidade_id,obrigacao_id) REFERENCES obrigacao_fornecedor(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,pagamento_id) REFERENCES pagamento_fornecedor(organizacao_id,unidade_id,id));
CREATE INDEX liquidacao_fornecedor_unidade ON liquidacao_fornecedor(organizacao_id,unidade_id,id);
ALTER TABLE liquidacao_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidacao_fornecedor FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON liquidacao_fornecedor USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON liquidacao_fornecedor TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON liquidacao_fornecedor FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON liquidacao_fornecedor FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE reversao_fornecedor(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
obrigacao_id uuid,pagamento_id uuid,liquidacao_id uuid,CHECK(num_nonnulls(obrigacao_id,pagamento_id,liquidacao_id)=1),UNIQUE(organizacao_id,obrigacao_id),UNIQUE(organizacao_id,pagamento_id),UNIQUE(organizacao_id,liquidacao_id),FOREIGN KEY(organizacao_id,unidade_id,obrigacao_id) REFERENCES obrigacao_fornecedor(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,pagamento_id) REFERENCES pagamento_fornecedor(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,liquidacao_id) REFERENCES liquidacao_fornecedor(organizacao_id,unidade_id,id));
CREATE INDEX reversao_fornecedor_unidade ON reversao_fornecedor(organizacao_id,unidade_id,id);
ALTER TABLE reversao_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE reversao_fornecedor FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON reversao_fornecedor USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON reversao_fornecedor TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON reversao_fornecedor FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON reversao_fornecedor FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE INDEX liquidacao_fornecedor_obrigacao ON liquidacao_fornecedor(organizacao_id,obrigacao_id);
CREATE INDEX liquidacao_fornecedor_pagamento ON liquidacao_fornecedor(organizacao_id,pagamento_id);
INSERT INTO permissao VALUES('pagar:ler'),('pagar:registrar'),('pagar:pagar'),('pagar:liquidar'),('pagar:reverter');
