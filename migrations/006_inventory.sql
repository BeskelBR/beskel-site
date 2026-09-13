SET search_path=hvb,public;
CREATE DOMAIN quantidade_exata AS numeric(20,6) CHECK(VALUE NOT IN ('NaN','Infinity','-Infinity'));
CREATE TABLE unidade (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL REFERENCES organizacao(id),
 simbolo text NOT NULL, dimensao text NOT NULL CHECK(dimensao IN ('contagem','massa','volume')),
 fator_referencia quantidade_exata NOT NULL CHECK(fator_referencia>0),
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,simbolo)
);
CREATE TABLE produto (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_base_id uuid NOT NULL,
 nome text NOT NULL, finalidade text NOT NULL,
 UNIQUE(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_base_id) REFERENCES unidade(organizacao_id,id)
);
CREATE TABLE apresentacao (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, produto_id uuid NOT NULL,
 codigo text NOT NULL, versao integer NOT NULL CHECK(versao>0), anterior_id uuid,
 unidade_conteudo_id uuid NOT NULL, quantidade_conteudo quantidade_exata NOT NULL CHECK(quantidade_conteudo>0),
 fator_unidade_base quantidade_exata NOT NULL CHECK(fator_unidade_base>0),
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,produto_id,id), UNIQUE(organizacao_id,produto_id,codigo,versao),
 CHECK((versao=1)=(anterior_id IS NULL)),
 FOREIGN KEY(organizacao_id,produto_id) REFERENCES produto(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_conteudo_id) REFERENCES unidade(organizacao_id,id),
 FOREIGN KEY(organizacao_id,produto_id,anterior_id) REFERENCES apresentacao(organizacao_id,produto_id,id)
);
CREATE FUNCTION validar_apresentacao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE base unidade; conteudo unidade; anterior apresentacao;
BEGIN
 SELECT u.* INTO STRICT base FROM unidade u JOIN produto p ON (p.organizacao_id,p.unidade_base_id)=(u.organizacao_id,u.id)
 WHERE p.organizacao_id=NEW.organizacao_id AND p.id=NEW.produto_id;
 SELECT * INTO STRICT conteudo FROM unidade WHERE organizacao_id=NEW.organizacao_id AND id=NEW.unidade_conteudo_id;
 IF base.dimensao<>conteudo.dimensao OR NEW.fator_unidade_base*base.fator_referencia<>NEW.quantidade_conteudo*conteudo.fator_referencia THEN
 RAISE EXCEPTION 'Conversao dimensional invalida' USING ERRCODE='23514'; END IF;
 IF NEW.anterior_id IS NOT NULL THEN
 SELECT * INTO STRICT anterior FROM apresentacao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.anterior_id;
 IF anterior.codigo<>NEW.codigo OR anterior.versao+1<>NEW.versao THEN RAISE EXCEPTION 'Versao invalida' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER apresentacao_validar BEFORE INSERT ON apresentacao FOR EACH ROW EXECUTE FUNCTION validar_apresentacao();
CREATE TABLE lote (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, produto_id uuid NOT NULL, apresentacao_id uuid NOT NULL,
 fabricante text NOT NULL, codigo text NOT NULL, validade date,
 situacao_validade text NOT NULL CHECK(situacao_validade IN ('conhecida','pendente','isenta')),
 custo_base quantidade_exata CHECK(custo_base>=0),
 CHECK((situacao_validade='conhecida')=(validade IS NOT NULL)),
 CHECK(validade IS NULL OR isfinite(validade)),
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,produto_id,apresentacao_id,fabricante,codigo),
 FOREIGN KEY(organizacao_id,produto_id,apresentacao_id) REFERENCES apresentacao(organizacao_id,produto_id,id)
);
CREATE TABLE recipiente (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, lote_id uuid NOT NULL,
 identificacao text NOT NULL, aberto_em timestamptz NOT NULL, validade_apos_abertura timestamptz,
 regra_informada text NOT NULL,
 CHECK(isfinite(aberto_em) AND (validade_apos_abertura IS NULL OR (isfinite(validade_apos_abertura) AND validade_apos_abertura>aberto_em))),
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,lote_id,id), UNIQUE(organizacao_id,lote_id,identificacao),
 FOREIGN KEY(organizacao_id,lote_id) REFERENCES lote(organizacao_id,id)
);
ALTER TABLE episodio ADD UNIQUE(organizacao_id,paciente_id,id);
CREATE TABLE custodia (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL REFERENCES organizacao(id),
 tipo text NOT NULL CHECK(tipo IN ('hospital','tutor')), paciente_id uuid, episodio_id uuid,
 CHECK((tipo='tutor')=(paciente_id IS NOT NULL)), CHECK(tipo='tutor' OR episodio_id IS NULL),
 UNIQUE(organizacao_id,id),
 UNIQUE NULLS NOT DISTINCT(organizacao_id,tipo,paciente_id,episodio_id),
 FOREIGN KEY(organizacao_id,paciente_id) REFERENCES paciente(organizacao_id,id),
 FOREIGN KEY(organizacao_id,paciente_id,episodio_id) REFERENCES episodio(organizacao_id,paciente_id,id)
);
CREATE TABLE posicao_estoque (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL,
 local_id uuid NOT NULL, lote_id uuid NOT NULL, recipiente_id uuid, custodia_id uuid NOT NULL,
 saldo_base quantidade_exata NOT NULL DEFAULT 0 CHECK(saldo_base>=0),
 reservado_base quantidade_exata NOT NULL DEFAULT 0 CHECK(reservado_base>=0 AND reservado_base<=saldo_base),
 disponivel_base numeric(20,6) GENERATED ALWAYS AS (saldo_base-reservado_base) STORED,
 versao integer NOT NULL DEFAULT 1 CHECK(versao>0),
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,unidade_id,id),
 UNIQUE NULLS NOT DISTINCT(organizacao_id,local_id,lote_id,recipiente_id,custodia_id),
 FOREIGN KEY(organizacao_id,unidade_id,local_id) REFERENCES local(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,lote_id) REFERENCES lote(organizacao_id,id),
 FOREIGN KEY(organizacao_id,lote_id,recipiente_id) REFERENCES recipiente(organizacao_id,lote_id,id),
 FOREIGN KEY(organizacao_id,custodia_id) REFERENCES custodia(organizacao_id,id)
);
CREATE TABLE reserva (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL, posicao_id uuid NOT NULL,
 quantidade_base quantidade_exata NOT NULL CHECK(quantidade_base>0),
 situacao text NOT NULL DEFAULT 'ativa' CHECK(situacao IN ('ativa','liberada','expirada','efetivada')),
 expira_em timestamptz NOT NULL CHECK(isfinite(expira_em)), criada_em timestamptz NOT NULL DEFAULT now(),
 autor_id uuid NOT NULL, encerrada_por_id uuid, encerrada_em timestamptz, motivo text NOT NULL,
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,unidade_id,id),
 CHECK((situacao='ativa')=(encerrada_em IS NULL)), CHECK((encerrada_em IS NULL)=(encerrada_por_id IS NULL)),
 FOREIGN KEY(organizacao_id,unidade_id,posicao_id) REFERENCES posicao_estoque(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,encerrada_por_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE sessao_inventario (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL, local_id uuid NOT NULL,
 situacao text NOT NULL DEFAULT 'aberta' CHECK(situacao IN ('aberta','encerrada')),
 motivo text NOT NULL, autor_id uuid NOT NULL, criada_em timestamptz NOT NULL DEFAULT now(), encerrada_em timestamptz,
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,unidade_id,id),
 CHECK((situacao='aberta')=(encerrada_em IS NULL)),
 FOREIGN KEY(organizacao_id,unidade_id,local_id) REFERENCES local(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE contagem_posicao (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL,
 sessao_id uuid NOT NULL, posicao_id uuid NOT NULL, quantidade_contada quantidade_exata NOT NULL CHECK(quantidade_contada>=0),
 saldo_snapshot quantidade_exata NOT NULL, versao_snapshot integer NOT NULL,
 situacao text NOT NULL DEFAULT 'pendente' CHECK(situacao IN ('pendente','aplicada','conferida')),
 autor_id uuid NOT NULL, contada_em timestamptz NOT NULL, registrada_em timestamptz NOT NULL DEFAULT now(),
 aplicada_por_id uuid, motivo_aplicacao text,
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,unidade_id,id), UNIQUE(organizacao_id,sessao_id,posicao_id),
 FOREIGN KEY(organizacao_id,unidade_id,sessao_id) REFERENCES sessao_inventario(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,posicao_id) REFERENCES posicao_estoque(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,aplicada_por_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE transacao_estoque (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL, comando_id uuid NOT NULL,
 tipo text NOT NULL CHECK(tipo IN ('entrada','transferencia','retirada','devolucao','perda','ajuste','reversao')),
 origem_id uuid, destino_id uuid, contrapartida text CHECK(contrapartida IN ('externo','perda','ajuste')),
 quantidade_base quantidade_exata NOT NULL CHECK(quantidade_base>0),
 custo_base_snapshot quantidade_exata CHECK(custo_base_snapshot>=0),
 quantidade_apresentacoes quantidade_exata, fator_snapshot quantidade_exata,
 raiz_id uuid NOT NULL, referencia_id uuid, reversao_de_id uuid, reserva_id uuid, contagem_id uuid,
 ocorrido_em timestamptz NOT NULL CHECK(isfinite(ocorrido_em)), registrado_em timestamptz NOT NULL DEFAULT now(),
 autor_id uuid NOT NULL, motivo text NOT NULL,
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,unidade_id,id), UNIQUE(organizacao_id,reversao_de_id), UNIQUE(organizacao_id,reserva_id), UNIQUE(organizacao_id,contagem_id),
 CHECK(num_nonnulls(origem_id,destino_id)>0 AND origem_id IS DISTINCT FROM destino_id),
 CHECK((num_nonnulls(origem_id,destino_id)=1)=(contrapartida IS NOT NULL)),
 CHECK((tipo='reversao')=(reversao_de_id IS NOT NULL)), CHECK((tipo='devolucao')=(referencia_id IS NOT NULL)),
 CHECK((tipo='ajuste')=(contagem_id IS NOT NULL)),
 CHECK((tipo='entrada')=(quantidade_apresentacoes IS NOT NULL AND fator_snapshot IS NOT NULL)),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,origem_id) REFERENCES posicao_estoque(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,destino_id) REFERENCES posicao_estoque(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,raiz_id) REFERENCES transacao_estoque(organizacao_id,id),
 FOREIGN KEY(organizacao_id,referencia_id) REFERENCES transacao_estoque(organizacao_id,id),
 FOREIGN KEY(organizacao_id,reversao_de_id) REFERENCES transacao_estoque(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,reserva_id) REFERENCES reserva(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,contagem_id) REFERENCES contagem_posicao(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE lancamento_estoque (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, transacao_id uuid NOT NULL,
 lado integer NOT NULL CHECK(lado IN (-1,1)), posicao_id uuid, contrapartida text,
 quantidade_assinada quantidade_exata NOT NULL CHECK(quantidade_assinada<>0),
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,transacao_id,lado),
 CHECK(num_nonnulls(posicao_id,contrapartida)=1),
 FOREIGN KEY(organizacao_id,transacao_id) REFERENCES transacao_estoque(organizacao_id,id),
 FOREIGN KEY(organizacao_id,posicao_id) REFERENCES posicao_estoque(organizacao_id,id)
);
-- Only this trigger mutates balances. The application has no UPDATE privilege on positions.
CREATE FUNCTION projetar_lancamento() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=hvb,pg_temp AS $$
DECLARE t transacao_estoque; esperado uuid;
BEGIN
 IF NEW.organizacao_id IS DISTINCT FROM nullif(current_setting('hvb.org',true),'')::uuid THEN RAISE EXCEPTION 'Organizacao invalida' USING ERRCODE='23514'; END IF;
 SELECT * INTO STRICT t FROM transacao_estoque WHERE organizacao_id=NEW.organizacao_id AND id=NEW.transacao_id;
 esperado:=CASE WHEN NEW.lado=-1 THEN t.origem_id ELSE t.destino_id END;
 IF NEW.posicao_id IS DISTINCT FROM esperado OR NEW.quantidade_assinada<>NEW.lado*t.quantidade_base OR
 (esperado IS NULL AND NEW.contrapartida IS DISTINCT FROM t.contrapartida) THEN RAISE EXCEPTION 'Lancamento incompativel' USING ERRCODE='23514'; END IF;
 IF esperado IS NOT NULL THEN UPDATE posicao_estoque SET saldo_base=saldo_base+NEW.quantidade_assinada,versao=versao+1
 WHERE organizacao_id=NEW.organizacao_id AND id=esperado; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lancamento_projetar BEFORE INSERT ON lancamento_estoque FOR EACH ROW EXECUTE FUNCTION projetar_lancamento();
CREATE FUNCTION validar_balanco() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE n integer; total numeric;
BEGIN
 SELECT count(*),sum(quantidade_assinada) INTO n,total FROM lancamento_estoque WHERE organizacao_id=NEW.organizacao_id AND transacao_id=NEW.id;
 IF n<>2 OR total<>0 THEN RAISE EXCEPTION 'Transacao sem par balanceado' USING ERRCODE='23514'; END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER transacao_balanco AFTER INSERT ON transacao_estoque DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validar_balanco();
CREATE FUNCTION projetar_reserva() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=hvb,pg_temp AS $$
BEGIN
 IF NEW.organizacao_id IS DISTINCT FROM nullif(current_setting('hvb.org',true),'')::uuid THEN RAISE EXCEPTION 'Organizacao invalida' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
 IF NEW.situacao<>'ativa' OR NEW.expira_em<=now() THEN RAISE EXCEPTION 'Reserva invalida' USING ERRCODE='23514'; END IF;
 UPDATE posicao_estoque SET reservado_base=reservado_base+NEW.quantidade_base,versao=versao+1 WHERE organizacao_id=NEW.organizacao_id AND id=NEW.posicao_id;
 ELSE
 IF OLD.situacao<>'ativa' OR NEW.situacao='ativa' OR
 (NEW.posicao_id,NEW.quantidade_base,NEW.expira_em) IS DISTINCT FROM (OLD.posicao_id,OLD.quantidade_base,OLD.expira_em) OR
 (NEW.situacao='expirada' AND NEW.expira_em>now()) OR (NEW.situacao='efetivada' AND NEW.expira_em<=now()) THEN RAISE EXCEPTION 'Transicao de reserva invalida' USING ERRCODE='23514'; END IF;
 UPDATE posicao_estoque SET reservado_base=reservado_base-NEW.quantidade_base,versao=versao+1 WHERE organizacao_id=NEW.organizacao_id AND id=NEW.posicao_id;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER reserva_projetar BEFORE INSERT OR UPDATE ON reserva FOR EACH ROW EXECUTE FUNCTION projetar_reserva();
CREATE INDEX posicao_consulta ON posicao_estoque(organizacao_id,unidade_id,id);
CREATE INDEX reserva_ativa ON reserva(organizacao_id,posicao_id,expira_em) WHERE situacao='ativa';
CREATE INDEX transacao_historico ON transacao_estoque(organizacao_id,unidade_id,id);
CREATE INDEX transacao_referencia ON transacao_estoque(organizacao_id,referencia_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['unidade','produto','apresentacao','lote','recipiente','custodia','posicao_estoque','reserva','sessao_inventario','contagem_posicao','transacao_estoque','lancamento_estoque'] LOOP
 EXECUTE format('ALTER TABLE hvb.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE hvb.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant ON hvb.%I USING (organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid) WITH CHECK (organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['unidade','produto','apresentacao','lote','recipiente','custodia','transacao_estoque','lancamento_estoque'] LOOP
 EXECUTE format('CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON hvb.%I FOR EACH ROW EXECUTE FUNCTION hvb.impedir_alteracao()',t);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION validar_apresentacao(),projetar_lancamento(),validar_balanco(),projetar_reserva() FROM PUBLIC;
GRANT INSERT ON unidade,produto,apresentacao,lote,recipiente,custodia,reserva,sessao_inventario,contagem_posicao,transacao_estoque,lancamento_estoque TO hvb_app;
GRANT INSERT(id,organizacao_id,unidade_id,local_id,lote_id,recipiente_id,custodia_id) ON posicao_estoque TO hvb_app;
GRANT UPDATE(situacao,encerrada_em,encerrada_por_id,motivo) ON reserva TO hvb_app;
GRANT UPDATE(situacao,encerrada_em) ON sessao_inventario TO hvb_app;
GRANT UPDATE(situacao,aplicada_por_id,motivo_aplicacao) ON contagem_posicao TO hvb_app;
INSERT INTO permissao VALUES ('estoque:ler'),('estoque:catalogar'),('estoque:movimentar'),('estoque:reservar'),('estoque:inventariar'),('estoque:ajustar'),('estoque:reverter');
