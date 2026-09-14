SET search_path=hvb,public;
CREATE DOMAIN dia_preventivo AS text CHECK(VALUE ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND VALUE::date BETWEEN DATE '2020-01-01' AND DATE '2100-12-31');
CREATE TABLE protocolo_catalogo(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 codigo text NOT NULL,nome text NOT NULL,UNIQUE(organizacao_id,unidade_id,codigo)
);
CREATE INDEX protocolo_catalogo_unidade ON protocolo_catalogo(organizacao_id,unidade_id,id);
CREATE TABLE protocolo_versao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 protocolo_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),descricao text NOT NULL,especie_codigo text NOT NULL REFERENCES especie(codigo),UNIQUE(organizacao_id,protocolo_id,versao),FOREIGN KEY(organizacao_id,unidade_id,protocolo_id) REFERENCES protocolo_catalogo(organizacao_id,unidade_id,id)
);
CREATE INDEX protocolo_versao_unidade ON protocolo_versao(organizacao_id,unidade_id,id);
CREATE TABLE etapa_protocolo(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 protocolo_versao_id uuid NOT NULL,codigo text NOT NULL,item_clinico_id uuid NOT NULL,ordem integer NOT NULL CHECK(ordem>0),deslocamento_dias integer NOT NULL CHECK(deslocamento_dias BETWEEN 0 AND 36600),recorrencia text NOT NULL CHECK(recorrencia IN ('unica','dias','meses_calendario')),intervalo integer NOT NULL CHECK(intervalo BETWEEN 0 AND 36600),orientacao text NOT NULL,CHECK((recorrencia='unica')=(intervalo=0)),UNIQUE(organizacao_id,protocolo_versao_id,codigo),UNIQUE(organizacao_id,protocolo_versao_id,ordem),FOREIGN KEY(organizacao_id,unidade_id,protocolo_versao_id) REFERENCES protocolo_versao(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,item_clinico_id) REFERENCES item_clinico(organizacao_id,id)
);
CREATE INDEX etapa_protocolo_unidade ON etapa_protocolo(organizacao_id,unidade_id,id);
CREATE TABLE aprovacao_protocolo(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 protocolo_versao_id uuid NOT NULL,UNIQUE(organizacao_id,protocolo_versao_id),FOREIGN KEY(organizacao_id,unidade_id,protocolo_versao_id) REFERENCES protocolo_versao(organizacao_id,unidade_id,id)
);
CREATE INDEX aprovacao_protocolo_unidade ON aprovacao_protocolo(organizacao_id,unidade_id,id);
CREATE TABLE protocolo_paciente(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 paciente_id uuid NOT NULL,protocolo_versao_id uuid NOT NULL,inicio_data dia_preventivo NOT NULL,referencia uuid NOT NULL,UNIQUE(organizacao_id,unidade_id,referencia),FOREIGN KEY(organizacao_id,paciente_id) REFERENCES paciente(organizacao_id,id),FOREIGN KEY(organizacao_id,unidade_id,protocolo_versao_id) REFERENCES protocolo_versao(organizacao_id,unidade_id,id)
);
CREATE INDEX protocolo_paciente_unidade ON protocolo_paciente(organizacao_id,unidade_id,id);
CREATE TABLE encerramento_protocolo(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 protocolo_paciente_id uuid NOT NULL,sucessor_id uuid,encerrado_em timestamptz NOT NULL CHECK(isfinite(encerrado_em)),UNIQUE(organizacao_id,protocolo_paciente_id),CHECK(protocolo_paciente_id IS DISTINCT FROM sucessor_id),FOREIGN KEY(organizacao_id,unidade_id,protocolo_paciente_id) REFERENCES protocolo_paciente(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,sucessor_id) REFERENCES protocolo_paciente(organizacao_id,unidade_id,id)
);
CREATE INDEX encerramento_protocolo_unidade ON encerramento_protocolo(organizacao_id,unidade_id,id);
CREATE TABLE ocorrencia_preventiva(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 protocolo_paciente_id uuid NOT NULL,etapa_id uuid NOT NULL,sequencia integer NOT NULL CHECK(sequencia BETWEEN 1 AND 1000),prevista_data dia_preventivo NOT NULL,UNIQUE(organizacao_id,protocolo_paciente_id,etapa_id,sequencia),FOREIGN KEY(organizacao_id,unidade_id,protocolo_paciente_id) REFERENCES protocolo_paciente(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,etapa_id) REFERENCES etapa_protocolo(organizacao_id,unidade_id,id)
);
CREATE INDEX ocorrencia_preventiva_unidade ON ocorrencia_preventiva(organizacao_id,unidade_id,id);
CREATE TABLE aplicacao_preventiva(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 ocorrencia_id uuid NOT NULL,origem text NOT NULL CHECK(origem IN ('interna','externa')),execucao_id uuid,profissional_informado text,ocorrida_em timestamptz NOT NULL CHECK(isfinite(ocorrida_em)),referencia uuid NOT NULL,lote_declarado text NOT NULL,fabricante_declarado text NOT NULL,evidencia text NOT NULL,correcao_de_id uuid,UNIQUE(organizacao_id,execucao_id),UNIQUE(organizacao_id,unidade_id,referencia),UNIQUE(organizacao_id,correcao_de_id),CHECK(id IS DISTINCT FROM correcao_de_id),CHECK((origem='interna')=(execucao_id IS NOT NULL)),CHECK((origem='externa')=(profissional_informado IS NOT NULL)),CHECK(origem<>'interna' OR id=execucao_id),FOREIGN KEY(organizacao_id,unidade_id,ocorrencia_id) REFERENCES ocorrencia_preventiva(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,execucao_id) REFERENCES execucao(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,correcao_de_id) REFERENCES aplicacao_preventiva(organizacao_id,unidade_id,id)
);
CREATE INDEX aplicacao_preventiva_unidade ON aplicacao_preventiva(organizacao_id,unidade_id,id);
CREATE TABLE vinculo_consumo_preventivo(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 aplicacao_id uuid NOT NULL,consumo_item_id uuid NOT NULL,UNIQUE(organizacao_id,consumo_item_id),FOREIGN KEY(organizacao_id,unidade_id,aplicacao_id) REFERENCES aplicacao_preventiva(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,consumo_item_id) REFERENCES consumo_item(organizacao_id,id)
);
CREATE INDEX vinculo_consumo_preventivo_unidade ON vinculo_consumo_preventivo(organizacao_id,unidade_id,id);
CREATE TABLE revisao_preventiva(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 ocorrencia_id uuid NOT NULL,observada_em timestamptz NOT NULL CHECK(isfinite(observada_em)),descricao text NOT NULL,UNIQUE(organizacao_id,ocorrencia_id),FOREIGN KEY(organizacao_id,unidade_id,ocorrencia_id) REFERENCES ocorrencia_preventiva(organizacao_id,unidade_id,id)
);
CREATE INDEX revisao_preventiva_unidade ON revisao_preventiva(organizacao_id,unidade_id,id);
CREATE TABLE resolucao_revisao_preventiva(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 revisao_id uuid NOT NULL,orientacao text NOT NULL,UNIQUE(organizacao_id,revisao_id),FOREIGN KEY(organizacao_id,unidade_id,revisao_id) REFERENCES revisao_preventiva(organizacao_id,unidade_id,id)
);
CREATE INDEX resolucao_revisao_preventiva_unidade ON resolucao_revisao_preventiva(organizacao_id,unidade_id,id);
CREATE UNIQUE INDEX aplicacao_primeira ON aplicacao_preventiva(organizacao_id,ocorrencia_id) WHERE correcao_de_id IS NULL;
CREATE INDEX aplicacao_ocorrencia ON aplicacao_preventiva(organizacao_id,ocorrencia_id,id);
CREATE INDEX protocolo_paciente_busca ON protocolo_paciente(organizacao_id,unidade_id,paciente_id,id);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['protocolo_catalogo','protocolo_versao','etapa_protocolo','aprovacao_protocolo','protocolo_paciente','encerramento_protocolo','ocorrencia_preventiva','aplicacao_preventiva','vinculo_consumo_preventivo','revisao_preventiva','resolucao_revisao_preventiva'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant ON %I USING(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid) WITH CHECK(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid)',t);
 EXECUTE format('GRANT INSERT ON %I TO hvb_app',t);
 EXECUTE format('CREATE TRIGGER a_comando BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame()',t);
 EXECUTE format('CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION impedir_alteracao()',t);
 END LOOP;END $$;
INSERT INTO permissao VALUES('protocolos:ler'),('protocolos:configurar'),('protocolos:aprovar_simulacao'),('protocolos:aderir'),('protocolos:programar'),('protocolos:registrar_aplicacao'),('protocolos:conciliar'),('protocolos:revisar'),('protocolos:encerrar');
