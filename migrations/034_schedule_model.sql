SET search_path=hvb,public;
CREATE TABLE equipe_agenda(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 nome text NOT NULL
);
CREATE INDEX equipe_agenda_unidade ON equipe_agenda(organizacao_id,unidade_id,id);
CREATE TABLE recurso_agenda(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 nome text NOT NULL,tipo text NOT NULL CHECK(tipo IN ('profissional','equipe','sala','institucional')),usuario_id uuid,equipe_id uuid,local_id uuid,CHECK((tipo='profissional')=(usuario_id IS NOT NULL)),CHECK((tipo='equipe')=(equipe_id IS NOT NULL)),CHECK((tipo='sala')=(local_id IS NOT NULL)),UNIQUE(organizacao_id,unidade_id,usuario_id),UNIQUE(organizacao_id,unidade_id,local_id),UNIQUE(organizacao_id,unidade_id,equipe_id),FOREIGN KEY(organizacao_id,usuario_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,unidade_id,equipe_id) REFERENCES equipe_agenda(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,local_id) REFERENCES local(organizacao_id,unidade_id,id)
);
CREATE INDEX recurso_agenda_unidade ON recurso_agenda(organizacao_id,unidade_id,id);
CREATE TABLE disponibilidade_agenda(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 recurso_id uuid NOT NULL,tipo text NOT NULL CHECK(tipo IN ('disponivel','bloqueio')),inicio timestamptz NOT NULL,fim timestamptz NOT NULL,CHECK(isfinite(inicio) AND isfinite(fim) AND fim>inicio AND fim-inicio<=interval '366 days'),FOREIGN KEY(organizacao_id,unidade_id,recurso_id) REFERENCES recurso_agenda(organizacao_id,unidade_id,id)
);
CREATE INDEX disponibilidade_agenda_unidade ON disponibilidade_agenda(organizacao_id,unidade_id,id);
CREATE TABLE revogacao_disponibilidade_agenda(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 disponibilidade_id uuid NOT NULL,UNIQUE(organizacao_id,disponibilidade_id),FOREIGN KEY(organizacao_id,unidade_id,disponibilidade_id) REFERENCES disponibilidade_agenda(organizacao_id,unidade_id,id)
);
CREATE INDEX revogacao_disponibilidade_agenda_unidade ON revogacao_disponibilidade_agenda(organizacao_id,unidade_id,id);
CREATE TABLE agendamento(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 paciente_id uuid NOT NULL,responsavel_id uuid NOT NULL,tipo text NOT NULL CHECK(tipo IN ('consulta','exame','procedimento','retorno','outro')),referencia uuid NOT NULL,UNIQUE(organizacao_id,unidade_id,referencia),FOREIGN KEY(organizacao_id,paciente_id) REFERENCES paciente(organizacao_id,id),FOREIGN KEY(organizacao_id,responsavel_id) REFERENCES responsavel(organizacao_id,id)
);
CREATE INDEX agendamento_unidade ON agendamento(organizacao_id,unidade_id,id);
CREATE TABLE agendamento_versao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 agendamento_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),anterior_id uuid,inicio timestamptz NOT NULL,fim timestamptz NOT NULL,observacao text NOT NULL,CHECK(isfinite(inicio) AND isfinite(fim) AND fim>inicio AND fim-inicio<=interval '24 hours'),UNIQUE(organizacao_id,agendamento_id,versao),UNIQUE(organizacao_id,anterior_id),CHECK((versao=1)=(anterior_id IS NULL)),FOREIGN KEY(organizacao_id,unidade_id,agendamento_id) REFERENCES agendamento(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,anterior_id) REFERENCES agendamento_versao(organizacao_id,unidade_id,id)
);
CREATE INDEX agendamento_versao_unidade ON agendamento_versao(organizacao_id,unidade_id,id);
CREATE TABLE agendamento_recurso(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 agendamento_versao_id uuid NOT NULL,recurso_id uuid NOT NULL,UNIQUE(organizacao_id,agendamento_versao_id,recurso_id),FOREIGN KEY(organizacao_id,unidade_id,agendamento_versao_id) REFERENCES agendamento_versao(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,recurso_id) REFERENCES recurso_agenda(organizacao_id,unidade_id,id)
);
CREATE INDEX agendamento_recurso_unidade ON agendamento_recurso(organizacao_id,unidade_id,id);
CREATE TABLE transicao_agendamento(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 agendamento_versao_id uuid NOT NULL,sequencia integer NOT NULL CHECK(sequencia>0),anterior_estado text NOT NULL,estado text NOT NULL CHECK(estado IN ('confirmado','chegou','cancelado','nao_compareceu','concluido')),ocorrida_em timestamptz NOT NULL CHECK(isfinite(ocorrida_em)),UNIQUE(organizacao_id,agendamento_versao_id,sequencia),FOREIGN KEY(organizacao_id,unidade_id,agendamento_versao_id) REFERENCES agendamento_versao(organizacao_id,unidade_id,id)
);
CREATE INDEX transicao_agendamento_unidade ON transicao_agendamento(organizacao_id,unidade_id,id);
CREATE INDEX agenda_recurso_busca ON agendamento_recurso(organizacao_id,recurso_id,agendamento_versao_id);
CREATE INDEX agenda_intervalo ON agendamento_versao(organizacao_id,unidade_id,inicio,fim);
CREATE INDEX disponibilidade_recurso ON disponibilidade_agenda(organizacao_id,recurso_id,inicio,fim);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['equipe_agenda','recurso_agenda','disponibilidade_agenda','revogacao_disponibilidade_agenda','agendamento','agendamento_versao','agendamento_recurso','transicao_agendamento'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant ON %I USING(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid) WITH CHECK(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid)',t);
 EXECUTE format('GRANT INSERT ON %I TO hvb_app',t);
 EXECUTE format('CREATE TRIGGER a_comando BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame()',t);
 EXECUTE format('CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION impedir_alteracao()',t);
 END LOOP;END $$;
INSERT INTO permissao VALUES('agenda:ler'),('agenda:configurar'),('agenda:disponibilidade'),('agenda:agendar'),('agenda:reprogramar'),('agenda:transicionar');
