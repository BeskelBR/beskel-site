SET search_path=hvb,public;
CREATE DOMAIN decimal_resultado AS numeric CHECK(VALUE NOT IN ('NaN','Infinity','-Infinity') AND abs(VALUE)<10000000000000000 AND scale(VALUE)<=8);
CREATE TABLE laboratorio_exame(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 nome text NOT NULL,origem text NOT NULL CHECK(origem IN ('interno','externo')),identificacao text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id)
);
CREATE INDEX laboratorio_exame_unidade ON laboratorio_exame(organizacao_id,unidade_id,id);
CREATE TABLE exame_catalogo(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 item_clinico_id uuid NOT NULL,codigo text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,item_clinico_id) REFERENCES item_clinico(organizacao_id,id),
 UNIQUE(organizacao_id,item_clinico_id),UNIQUE(organizacao_id,unidade_id,codigo)
);
CREATE INDEX exame_catalogo_unidade ON exame_catalogo(organizacao_id,unidade_id,id);
CREATE TABLE exame_versao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 exame_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),descricao text NOT NULL,laboratorio_id uuid NOT NULL,metodo text NOT NULL,exige_coleta boolean NOT NULL,material text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,exame_id) REFERENCES exame_catalogo(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,laboratorio_id) REFERENCES laboratorio_exame(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,exame_id,versao)
);
CREATE INDEX exame_versao_unidade ON exame_versao(organizacao_id,unidade_id,id);
CREATE TABLE atributo_exame_versao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 exame_versao_id uuid NOT NULL,codigo text NOT NULL,descricao text NOT NULL,tipo text NOT NULL CHECK(tipo IN ('numero','texto','booleano')),unidade text NOT NULL,obrigatorio boolean NOT NULL,ordem integer NOT NULL CHECK(ordem>0),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,exame_versao_id) REFERENCES exame_versao(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,exame_versao_id,codigo),UNIQUE(organizacao_id,exame_versao_id,ordem)
);
CREATE INDEX atributo_exame_versao_unidade ON atributo_exame_versao(organizacao_id,unidade_id,id);
CREATE TABLE aprovacao_exame_versao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 exame_versao_id uuid NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,exame_versao_id) REFERENCES exame_versao(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,exame_versao_id)
);
CREATE INDEX aprovacao_exame_versao_unidade ON aprovacao_exame_versao(organizacao_id,unidade_id,id);
CREATE TABLE referencia_analito_versao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 atributo_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),codigo text NOT NULL,especie_codigo text NOT NULL REFERENCES especie(codigo),idade_min_dias integer,idade_max_dias integer,inclui_idade_min boolean NOT NULL,inclui_idade_max boolean NOT NULL,limite_inferior decimal_resultado,limite_superior decimal_resultado,inclui_inferior boolean NOT NULL,inclui_superior boolean NOT NULL,descricao text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,atributo_id) REFERENCES atributo_exame_versao(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,atributo_id,codigo,versao),CHECK((idade_min_dias IS NULL)=(idade_max_dias IS NULL)),CHECK(idade_min_dias>=0 AND idade_max_dias>=idade_min_dias),CHECK(limite_inferior IS NULL OR limite_superior IS NULL OR limite_inferior<=limite_superior)
);
CREATE INDEX referencia_analito_versao_unidade ON referencia_analito_versao(organizacao_id,unidade_id,id);
CREATE TABLE solicitacao_exame(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 episodio_id uuid NOT NULL,solicitada_em timestamptz NOT NULL,indicacao text NOT NULL,referencia uuid NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,unidade_id,referencia),CHECK(isfinite(solicitada_em))
);
CREATE INDEX solicitacao_exame_unidade ON solicitacao_exame(organizacao_id,unidade_id,id);
CREATE TABLE item_exame(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 solicitacao_id uuid NOT NULL,exame_versao_id uuid NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,solicitacao_id) REFERENCES solicitacao_exame(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,exame_versao_id) REFERENCES exame_versao(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,solicitacao_id,exame_versao_id)
);
CREATE INDEX item_exame_unidade ON item_exame(organizacao_id,unidade_id,id);
CREATE TABLE cancelamento_item_exame(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 item_exame_id uuid NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,item_exame_id) REFERENCES item_exame(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,item_exame_id)
);
CREATE INDEX cancelamento_item_exame_unidade ON cancelamento_item_exame(organizacao_id,unidade_id,id);
CREATE TABLE coleta_exame(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 item_exame_id uuid NOT NULL,referencia uuid NOT NULL,coletada_em timestamptz NOT NULL,material text NOT NULL,origem text NOT NULL CHECK(origem IN ('interna','externa')),execucao_id uuid,coletor_informado text,evidencia text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,item_exame_id) REFERENCES item_exame(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,execucao_id) REFERENCES execucao(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,unidade_id,referencia),CHECK((origem='interna')=(execucao_id IS NOT NULL)),CHECK((origem='externa')=(coletor_informado IS NOT NULL)),CHECK(isfinite(coletada_em))
);
CREATE INDEX coleta_exame_unidade ON coleta_exame(organizacao_id,unidade_id,id);
CREATE TABLE decisao_amostra(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 coleta_id uuid NOT NULL,situacao text NOT NULL CHECK(situacao IN ('aceita','rejeitada')),avaliada_em timestamptz NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,coleta_id) REFERENCES coleta_exame(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,coleta_id),CHECK(isfinite(avaliada_em))
);
CREATE INDEX decisao_amostra_unidade ON decisao_amostra(organizacao_id,unidade_id,id);
CREATE TABLE resultado_versao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 item_exame_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),anterior_id uuid,coleta_id uuid,produzido_em timestamptz NOT NULL,referencia uuid NOT NULL,idade_dias integer,origem_idade text NOT NULL CHECK(origem_idade IN ('desconhecida','informada','estimada')),observacao text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,item_exame_id) REFERENCES item_exame(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,anterior_id) REFERENCES resultado_versao(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,coleta_id) REFERENCES coleta_exame(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,item_exame_id,versao),UNIQUE(organizacao_id,anterior_id),UNIQUE(organizacao_id,unidade_id,referencia),CHECK((versao=1)=(anterior_id IS NULL)),CHECK((origem_idade='desconhecida')=(idade_dias IS NULL)),CHECK(idade_dias>=0),CHECK(isfinite(produzido_em))
);
CREATE INDEX resultado_versao_unidade ON resultado_versao(organizacao_id,unidade_id,id);
CREATE TABLE valor_resultado(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 resultado_id uuid NOT NULL,atributo_id uuid NOT NULL,situacao text NOT NULL CHECK(situacao IN ('informado','nao_obtido')),texto_original text NOT NULL,numero decimal_resultado,booleano boolean,qualificador text NOT NULL CHECK(qualificador IN ('igual','menor','menor_igual','maior','maior_igual','nao_aplicavel')),referencia_id uuid,referencia_status text NOT NULL CHECK(referencia_status IN ('informada','pendente','nao_aplicavel')),observacao text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,resultado_id) REFERENCES resultado_versao(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,atributo_id) REFERENCES atributo_exame_versao(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,referencia_id) REFERENCES referencia_analito_versao(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,resultado_id,atributo_id),CHECK((referencia_status='informada')=(referencia_id IS NOT NULL)),CHECK(situacao<>'nao_obtido' OR (numero IS NULL AND booleano IS NULL AND qualificador='nao_aplicavel' AND referencia_id IS NULL))
);
CREATE INDEX valor_resultado_unidade ON valor_resultado(organizacao_id,unidade_id,id);
CREATE TABLE liberacao_resultado(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 resultado_id uuid NOT NULL,hash_conteudo text NOT NULL CHECK(hash_conteudo~'^[a-f0-9]{64}$'),pendencias_confirmadas boolean NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,resultado_id) REFERENCES resultado_versao(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,resultado_id)
);
CREATE INDEX liberacao_resultado_unidade ON liberacao_resultado(organizacao_id,unidade_id,id);
CREATE FUNCTION proteger_registro_exame() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM comando WHERE organizacao_id=NEW.organizacao_id AND id=NEW.comando_id AND autor_id=NEW.autor_id AND concluido_em IS NULL) THEN RAISE EXCEPTION 'Comando de exame ausente ou concluido' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['laboratorio_exame','exame_catalogo','exame_versao','atributo_exame_versao','aprovacao_exame_versao','referencia_analito_versao','solicitacao_exame','item_exame','cancelamento_item_exame','coleta_exame','decisao_amostra','resultado_versao','valor_resultado','liberacao_resultado'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant ON %I USING(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid) WITH CHECK(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid)',t);
 EXECUTE format('GRANT INSERT ON %I TO hvb_app',t);
 EXECUTE format('CREATE TRIGGER a_comando BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame()',t);
 EXECUTE format('CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION impedir_alteracao()',t);
 END LOOP;END $$;
REVOKE ALL ON FUNCTION proteger_registro_exame() FROM PUBLIC;
INSERT INTO permissao VALUES('exames:ler'),('exames:configurar'),('exames:aprovar_simulacao'),('exames:solicitar'),('exames:coletar'),('exames:avaliar_amostra'),('exames:registrar_resultado'),('exames:liberar'),('exames:cancelar');
