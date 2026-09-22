SET search_path=hvb,public;
CREATE TABLE saida_extrato_fornecedor(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
conta_financeira_id uuid NOT NULL,referencia uuid NOT NULL,referencia_externa text NOT NULL CHECK(length(btrim(referencia_externa)) BETWEEN 1 AND 160),correcao_de_id uuid,ocorrido_em timestamptz NOT NULL CHECK(isfinite(ocorrido_em)),valor valor_monetario NOT NULL CHECK(valor>0),evidencia text NOT NULL,UNIQUE(organizacao_id,unidade_id,referencia),UNIQUE(organizacao_id,correcao_de_id),FOREIGN KEY(organizacao_id,unidade_id,conta_financeira_id) REFERENCES conta_financeira(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,correcao_de_id) REFERENCES saida_extrato_fornecedor(organizacao_id,unidade_id,id));
CREATE INDEX saida_extrato_fornecedor_unidade ON saida_extrato_fornecedor(organizacao_id,unidade_id,id);
ALTER TABLE saida_extrato_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE saida_extrato_fornecedor FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON saida_extrato_fornecedor USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON saida_extrato_fornecedor TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON saida_extrato_fornecedor FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON saida_extrato_fornecedor FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE conciliacao_saida_fornecedor(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
pagamento_id uuid NOT NULL,saida_id uuid NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),evidencia text NOT NULL,FOREIGN KEY(organizacao_id,unidade_id,pagamento_id) REFERENCES pagamento_fornecedor(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,saida_id) REFERENCES saida_extrato_fornecedor(organizacao_id,unidade_id,id));
CREATE INDEX conciliacao_saida_fornecedor_unidade ON conciliacao_saida_fornecedor(organizacao_id,unidade_id,id);
ALTER TABLE conciliacao_saida_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE conciliacao_saida_fornecedor FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON conciliacao_saida_fornecedor USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON conciliacao_saida_fornecedor TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON conciliacao_saida_fornecedor FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON conciliacao_saida_fornecedor FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE reversao_saida_fornecedor(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
saida_id uuid,conciliacao_id uuid,CHECK(num_nonnulls(saida_id,conciliacao_id)=1),UNIQUE(organizacao_id,saida_id),UNIQUE(organizacao_id,conciliacao_id),FOREIGN KEY(organizacao_id,unidade_id,saida_id) REFERENCES saida_extrato_fornecedor(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,conciliacao_id) REFERENCES conciliacao_saida_fornecedor(organizacao_id,unidade_id,id));
CREATE INDEX reversao_saida_fornecedor_unidade ON reversao_saida_fornecedor(organizacao_id,unidade_id,id);
ALTER TABLE reversao_saida_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE reversao_saida_fornecedor FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON reversao_saida_fornecedor USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON reversao_saida_fornecedor TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON reversao_saida_fornecedor FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON reversao_saida_fornecedor FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE UNIQUE INDEX saida_extrato_original ON saida_extrato_fornecedor(organizacao_id,conta_financeira_id,referencia_externa) WHERE correcao_de_id IS NULL;
CREATE INDEX conciliacao_saida_pagamento ON conciliacao_saida_fornecedor(organizacao_id,pagamento_id);
CREATE INDEX conciliacao_saida_extrato ON conciliacao_saida_fornecedor(organizacao_id,saida_id);
INSERT INTO permissao VALUES('pagar:extrato_saida'),('pagar:conciliar_saida');
