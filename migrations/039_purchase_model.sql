SET search_path=hvb,public;
CREATE TABLE fornecedor_compra(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 nome text NOT NULL CHECK(length(btrim(nome)) BETWEEN 1 AND 160),referencia uuid NOT NULL,UNIQUE(organizacao_id,unidade_id,referencia)
);
CREATE INDEX fornecedor_compra_unidade ON fornecedor_compra(organizacao_id,unidade_id,id);
CREATE TABLE pedido_compra(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 fornecedor_id uuid NOT NULL,referencia uuid NOT NULL,observacao text NOT NULL,UNIQUE(organizacao_id,unidade_id,referencia),FOREIGN KEY(organizacao_id,unidade_id,fornecedor_id) REFERENCES fornecedor_compra(organizacao_id,unidade_id,id)
);
CREATE INDEX pedido_compra_unidade ON pedido_compra(organizacao_id,unidade_id,id);
CREATE TABLE item_pedido_compra(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 pedido_id uuid NOT NULL,apresentacao_id uuid NOT NULL,quantidade_apresentacoes quantidade_exata NOT NULL CHECK(quantidade_apresentacoes>0),UNIQUE(organizacao_id,pedido_id,apresentacao_id),FOREIGN KEY(organizacao_id,unidade_id,pedido_id) REFERENCES pedido_compra(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,apresentacao_id) REFERENCES apresentacao(organizacao_id,id)
);
CREATE INDEX item_pedido_compra_unidade ON item_pedido_compra(organizacao_id,unidade_id,id);
CREATE TABLE decisao_pedido_compra(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 pedido_id uuid NOT NULL,sequencia integer NOT NULL CHECK(sequencia BETWEEN 1 AND 2),estado text NOT NULL CHECK(estado IN ('aprovado','cancelado')),UNIQUE(organizacao_id,pedido_id,sequencia),FOREIGN KEY(organizacao_id,unidade_id,pedido_id) REFERENCES pedido_compra(organizacao_id,unidade_id,id)
);
CREATE INDEX decisao_pedido_compra_unidade ON decisao_pedido_compra(organizacao_id,unidade_id,id);
CREATE TABLE recebimento_compra(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 pedido_id uuid NOT NULL,referencia uuid NOT NULL,documento_fornecedor text NOT NULL,ocorrido_em timestamptz NOT NULL CHECK(isfinite(ocorrido_em)),UNIQUE(organizacao_id,unidade_id,referencia),FOREIGN KEY(organizacao_id,unidade_id,pedido_id) REFERENCES pedido_compra(organizacao_id,unidade_id,id)
);
CREATE INDEX recebimento_compra_unidade ON recebimento_compra(organizacao_id,unidade_id,id);
CREATE TABLE recebimento_compra_item(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 recebimento_id uuid NOT NULL,item_pedido_id uuid NOT NULL,FOREIGN KEY(organizacao_id,unidade_id,recebimento_id) REFERENCES recebimento_compra(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,item_pedido_id) REFERENCES item_pedido_compra(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,id) REFERENCES transacao_estoque(organizacao_id,unidade_id,id)
);
CREATE INDEX recebimento_compra_item_unidade ON recebimento_compra_item(organizacao_id,unidade_id,id);
CREATE INDEX recebimento_compra_item_pedido ON recebimento_compra_item(organizacao_id,item_pedido_id,id);
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['fornecedor_compra','pedido_compra','item_pedido_compra','decisao_pedido_compra','recebimento_compra','recebimento_compra_item'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant ON %I USING(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid) WITH CHECK(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid)',t);
 EXECUTE format('GRANT INSERT ON %I TO hvb_app',t);
 EXECUTE format('CREATE TRIGGER a_comando BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame()',t);
 EXECUTE format('CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION impedir_alteracao()',t);
 END LOOP;END $$;
INSERT INTO permissao VALUES('compras:ler'),('compras:configurar'),('compras:solicitar'),('compras:decidir'),('compras:receber');
