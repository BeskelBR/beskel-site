SET search_path=hvb,public;
CREATE TABLE precificacao_compra(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
pedido_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),anterior_id uuid,frete valor_monetario NOT NULL,acrescimo valor_monetario NOT NULL,desconto valor_monetario NOT NULL,total valor_monetario NOT NULL,CHECK((versao=1)=(anterior_id IS NULL)),UNIQUE(organizacao_id,pedido_id,versao),UNIQUE(organizacao_id,anterior_id),FOREIGN KEY(organizacao_id,unidade_id,pedido_id) REFERENCES pedido_compra(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,anterior_id) REFERENCES precificacao_compra(organizacao_id,unidade_id,id));
CREATE INDEX precificacao_compra_unidade ON precificacao_compra(organizacao_id,unidade_id,id);
ALTER TABLE precificacao_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE precificacao_compra FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON precificacao_compra USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON precificacao_compra TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON precificacao_compra FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON precificacao_compra FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE preco_item_compra(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
precificacao_id uuid NOT NULL,item_pedido_id uuid NOT NULL,preco_apresentacao valor_monetario NOT NULL,subtotal valor_monetario NOT NULL,UNIQUE(organizacao_id,precificacao_id,item_pedido_id),FOREIGN KEY(organizacao_id,unidade_id,precificacao_id) REFERENCES precificacao_compra(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,item_pedido_id) REFERENCES item_pedido_compra(organizacao_id,unidade_id,id));
CREATE INDEX preco_item_compra_unidade ON preco_item_compra(organizacao_id,unidade_id,id);
ALTER TABLE preco_item_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE preco_item_compra FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON preco_item_compra USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON preco_item_compra TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON preco_item_compra FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON preco_item_compra FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE vinculo_valor_compra(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
precificacao_id uuid NOT NULL,obrigacao_id uuid NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),FOREIGN KEY(organizacao_id,unidade_id,precificacao_id) REFERENCES precificacao_compra(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,obrigacao_id) REFERENCES obrigacao_fornecedor(organizacao_id,unidade_id,id));
CREATE INDEX vinculo_valor_compra_unidade ON vinculo_valor_compra(organizacao_id,unidade_id,id);
ALTER TABLE vinculo_valor_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculo_valor_compra FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON vinculo_valor_compra USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON vinculo_valor_compra TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON vinculo_valor_compra FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON vinculo_valor_compra FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE reversao_vinculo_compra(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
vinculo_id uuid NOT NULL,UNIQUE(organizacao_id,vinculo_id),FOREIGN KEY(organizacao_id,unidade_id,vinculo_id) REFERENCES vinculo_valor_compra(organizacao_id,unidade_id,id));
CREATE INDEX reversao_vinculo_compra_unidade ON reversao_vinculo_compra(organizacao_id,unidade_id,id);
ALTER TABLE reversao_vinculo_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE reversao_vinculo_compra FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON reversao_vinculo_compra USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON reversao_vinculo_compra TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON reversao_vinculo_compra FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON reversao_vinculo_compra FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE INDEX vinculo_valor_obrigacao ON vinculo_valor_compra(organizacao_id,obrigacao_id);
CREATE INDEX vinculo_valor_precificacao ON vinculo_valor_compra(organizacao_id,precificacao_id);
INSERT INTO permissao VALUES('compras:precificar'),('compras:conciliar_valores');
