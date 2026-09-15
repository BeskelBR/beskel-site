SET search_path=hvb,public;
CREATE TABLE evolucao_clinica(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 paciente_id uuid NOT NULL,episodio_id uuid NOT NULL,tipo text NOT NULL CHECK(tipo IN ('anamnese','evolucao','observacao')),referencia uuid NOT NULL,UNIQUE(organizacao_id,unidade_id,referencia),FOREIGN KEY(organizacao_id,paciente_id) REFERENCES paciente(organizacao_id,id),FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id)
);
CREATE INDEX evolucao_clinica_unidade ON evolucao_clinica(organizacao_id,unidade_id,id);
CREATE TABLE evolucao_clinica_versao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 evolucao_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),anterior_id uuid,estado text NOT NULL CHECK(estado IN ('registrada','invalidada')),ocorrida_em timestamptz NOT NULL CHECK(isfinite(ocorrida_em)),conteudo text NOT NULL CHECK(length(btrim(conteudo)) BETWEEN 1 AND 8000),hash_conteudo text NOT NULL,CHECK((versao=1)=(anterior_id IS NULL)),CHECK(versao>1 OR estado='registrada'),UNIQUE(organizacao_id,evolucao_id,versao),UNIQUE(organizacao_id,anterior_id),FOREIGN KEY(organizacao_id,unidade_id,evolucao_id) REFERENCES evolucao_clinica(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,anterior_id) REFERENCES evolucao_clinica_versao(organizacao_id,unidade_id,id)
);
CREATE INDEX evolucao_clinica_versao_unidade ON evolucao_clinica_versao(organizacao_id,unidade_id,id);
CREATE INDEX evolucao_paciente ON evolucao_clinica(organizacao_id,unidade_id,paciente_id,id);
CREATE INDEX evolucao_registro ON evolucao_clinica_versao(organizacao_id,unidade_id,criada_em,id);
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['evolucao_clinica','evolucao_clinica_versao'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant ON %I USING(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid) WITH CHECK(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid)',t);
 EXECUTE format('GRANT INSERT ON %I TO hvb_app',t);
 EXECUTE format('CREATE TRIGGER a_comando BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame()',t);
 EXECUTE format('CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION impedir_alteracao()',t);
 END LOOP;END $$;
INSERT INTO permissao VALUES('prontuario:ler'),('prontuario:conteudo'),('prontuario:escrever'),('prontuario:retificar');
