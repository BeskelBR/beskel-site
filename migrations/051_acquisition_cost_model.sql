SET search_path=hvb,public;
CREATE TABLE rateio_aquisicao(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
pedido_id uuid NOT NULL,precificacao_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),anterior_id uuid,criterio text NOT NULL CHECK(length(trim(criterio))>0),CHECK((versao=1)=(anterior_id IS NULL)),UNIQUE(organizacao_id,pedido_id,versao),UNIQUE(organizacao_id,anterior_id),FOREIGN KEY(organizacao_id,unidade_id,pedido_id) REFERENCES pedido_compra(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,precificacao_id) REFERENCES precificacao_compra(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,anterior_id) REFERENCES rateio_aquisicao(organizacao_id,unidade_id,id));
CREATE INDEX rateio_aquisicao_unidade ON rateio_aquisicao(organizacao_id,unidade_id,id);
ALTER TABLE rateio_aquisicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE rateio_aquisicao FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON rateio_aquisicao USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON rateio_aquisicao TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON rateio_aquisicao FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON rateio_aquisicao FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE item_rateio_aquisicao(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
rateio_id uuid NOT NULL,item_pedido_id uuid NOT NULL,subtotal valor_monetario NOT NULL,frete valor_monetario NOT NULL,acrescimo valor_monetario NOT NULL,desconto valor_monetario NOT NULL,total valor_monetario NOT NULL,CHECK(total=subtotal+frete+acrescimo-desconto),UNIQUE(organizacao_id,rateio_id,item_pedido_id),FOREIGN KEY(organizacao_id,unidade_id,rateio_id) REFERENCES rateio_aquisicao(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,item_pedido_id) REFERENCES item_pedido_compra(organizacao_id,unidade_id,id));
CREATE INDEX item_rateio_aquisicao_unidade ON item_rateio_aquisicao(organizacao_id,unidade_id,id);
ALTER TABLE item_rateio_aquisicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_rateio_aquisicao FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON item_rateio_aquisicao USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON item_rateio_aquisicao TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON item_rateio_aquisicao FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON item_rateio_aquisicao FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE custo_recebimento(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
item_rateio_id uuid NOT NULL,recebimento_item_id uuid NOT NULL,valor valor_monetario NOT NULL,FOREIGN KEY(organizacao_id,unidade_id,item_rateio_id) REFERENCES item_rateio_aquisicao(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,recebimento_item_id) REFERENCES recebimento_compra_item(organizacao_id,unidade_id,id));
CREATE INDEX custo_recebimento_unidade ON custo_recebimento(organizacao_id,unidade_id,id);
ALTER TABLE custo_recebimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE custo_recebimento FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON custo_recebimento USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON custo_recebimento TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON custo_recebimento FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON custo_recebimento FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE reversao_custo_recebimento(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
custo_recebimento_id uuid NOT NULL,UNIQUE(organizacao_id,custo_recebimento_id),FOREIGN KEY(organizacao_id,unidade_id,custo_recebimento_id) REFERENCES custo_recebimento(organizacao_id,unidade_id,id));
CREATE INDEX reversao_custo_recebimento_unidade ON reversao_custo_recebimento(organizacao_id,unidade_id,id);
ALTER TABLE reversao_custo_recebimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE reversao_custo_recebimento FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON reversao_custo_recebimento USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON reversao_custo_recebimento TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON reversao_custo_recebimento FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON reversao_custo_recebimento FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE INDEX custo_recebimento_item ON custo_recebimento(organizacao_id,recebimento_item_id);
CREATE INDEX custo_recebimento_rateio ON custo_recebimento(organizacao_id,item_rateio_id);
INSERT INTO permissao VALUES('compras:ratear_custo'),('compras:avaliar_custo');
