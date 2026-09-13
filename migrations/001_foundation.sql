CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA hvb;
REVOKE ALL ON SCHEMA hvb FROM PUBLIC;
SET search_path = hvb, public;

CREATE TABLE organizacao (
 id uuid PRIMARY KEY, nome text NOT NULL CHECK (length(nome) BETWEEN 1 AND 160),
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE unidade_hospitalar (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL REFERENCES organizacao(id),
 nome text NOT NULL, fuso text NOT NULL DEFAULT 'America/Sao_Paulo',
 criado_em timestamptz NOT NULL DEFAULT now(), UNIQUE (organizacao_id,id)
);
CREATE TABLE usuario (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL REFERENCES organizacao(id),
 nome text NOT NULL, login text NOT NULL, ativo boolean NOT NULL DEFAULT true,
 criado_em timestamptz NOT NULL DEFAULT now(), UNIQUE (organizacao_id,id),
 UNIQUE (organizacao_id,login)
);
CREATE TABLE papel (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL REFERENCES organizacao(id),
 nome text NOT NULL, UNIQUE (organizacao_id,id), UNIQUE (organizacao_id,nome)
);
CREATE TABLE permissao (codigo text PRIMARY KEY);
CREATE TABLE papel_permissao (
 organizacao_id uuid NOT NULL, papel_id uuid NOT NULL,
 permissao text NOT NULL REFERENCES permissao(codigo),
 PRIMARY KEY (organizacao_id,papel_id,permissao),
 FOREIGN KEY (organizacao_id,papel_id) REFERENCES papel(organizacao_id,id)
);
CREATE TABLE usuario_papel (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, usuario_id uuid NOT NULL,
 papel_id uuid NOT NULL, unidade_id uuid,
 FOREIGN KEY (organizacao_id,usuario_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY (organizacao_id,papel_id) REFERENCES papel(organizacao_id,id),
 FOREIGN KEY (organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 UNIQUE NULLS NOT DISTINCT (organizacao_id,usuario_id,papel_id,unidade_id)
);
CREATE TABLE dispositivo (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL,
 nome text NOT NULL, ativo boolean NOT NULL DEFAULT true,
 UNIQUE (organizacao_id,id), UNIQUE (organizacao_id,unidade_id,id),
 FOREIGN KEY (organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id)
);
CREATE TABLE credencial (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, usuario_id uuid NOT NULL,
 tipo text NOT NULL CHECK (tipo IN ('api','nfc')), token_hash text NOT NULL UNIQUE,
 criada_em timestamptz NOT NULL DEFAULT now(), expira_em timestamptz NOT NULL,
 revogada_em timestamptz, revogada_por_id uuid, motivo_revogacao text,
 UNIQUE (organizacao_id,id),
 CHECK (expira_em > criada_em), CHECK (length(token_hash)=64),
 CHECK ((revogada_em IS NULL AND revogada_por_id IS NULL AND motivo_revogacao IS NULL)
 OR (revogada_em IS NOT NULL AND revogada_por_id IS NOT NULL AND length(motivo_revogacao)>0)),
 FOREIGN KEY (organizacao_id,usuario_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY (organizacao_id,revogada_por_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE comando (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, autor_id uuid NOT NULL,
 dispositivo_id uuid, chave text NOT NULL CHECK (length(chave) BETWEEN 8 AND 128),
 operacao text NOT NULL, hash_payload text NOT NULL CHECK (length(hash_payload)=64),
 resultado jsonb, recebido_em timestamptz NOT NULL DEFAULT now(), concluido_em timestamptz,
 UNIQUE (organizacao_id,id),
 UNIQUE NULLS NOT DISTINCT (organizacao_id,autor_id,dispositivo_id,chave),
 CHECK ((resultado IS NULL) = (concluido_em IS NULL)),
 FOREIGN KEY (organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY (organizacao_id,dispositivo_id) REFERENCES dispositivo(organizacao_id,id)
);
CREATE TABLE responsavel (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL REFERENCES organizacao(id),
 nome text NOT NULL CHECK (length(nome) BETWEEN 1 AND 160),
 criado_em timestamptz NOT NULL DEFAULT now(), UNIQUE (organizacao_id,id)
);
CREATE TABLE especie (codigo text PRIMARY KEY);
INSERT INTO especie VALUES ('canina'),('felina'),('outra'),('desconhecida');
CREATE TABLE paciente (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL REFERENCES organizacao(id),
 nome text NOT NULL CHECK (length(nome) BETWEEN 1 AND 160),
 especie_codigo text NOT NULL REFERENCES especie(codigo),
 estado_vital text NOT NULL DEFAULT 'desconhecido' CHECK (estado_vital IN ('vivo','obito','desconhecido')),
 criado_em timestamptz NOT NULL DEFAULT now(), UNIQUE (organizacao_id,id)
);
CREATE TABLE paciente_responsavel (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, paciente_id uuid NOT NULL,
 responsavel_id uuid NOT NULL, papel text NOT NULL CHECK (papel IN ('legal','financeiro','contato')),
 inicio timestamptz NOT NULL, fim timestamptz, registrado_em timestamptz NOT NULL DEFAULT now(),
 autor_id uuid NOT NULL, UNIQUE (organizacao_id,id), CHECK (fim IS NULL OR fim > inicio),
 FOREIGN KEY (organizacao_id,paciente_id) REFERENCES paciente(organizacao_id,id),
 FOREIGN KEY (organizacao_id,responsavel_id) REFERENCES responsavel(organizacao_id,id),
 FOREIGN KEY (organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 EXCLUDE USING gist (organizacao_id WITH =, paciente_id WITH =, responsavel_id WITH =,
 papel WITH =, tstzrange(inicio,fim,'[)') WITH &&)
);
CREATE TABLE episodio (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL,
 paciente_id uuid NOT NULL, tipo text NOT NULL CHECK (tipo IN ('atendimento','internacao')),
 admitido_em timestamptz NOT NULL, registrado_em timestamptz NOT NULL DEFAULT now(),
 alta_clinica_em timestamptz, alta_por_id uuid, motivo_alta text,
 encerrado_em timestamptz, encerrado_por_id uuid, motivo_saida text,
 autor_id uuid NOT NULL, versao integer NOT NULL DEFAULT 1 CHECK (versao>0),
 UNIQUE (organizacao_id,id), UNIQUE (organizacao_id,unidade_id,id),
 CHECK (alta_clinica_em IS NULL OR alta_clinica_em >= admitido_em),
 CHECK (encerrado_em IS NULL OR encerrado_em >= admitido_em),
 CHECK ((alta_clinica_em IS NULL AND alta_por_id IS NULL AND motivo_alta IS NULL)
 OR (alta_clinica_em IS NOT NULL AND alta_por_id IS NOT NULL AND length(motivo_alta)>0)),
 CHECK ((encerrado_em IS NULL AND encerrado_por_id IS NULL AND motivo_saida IS NULL)
 OR (encerrado_em IS NOT NULL AND encerrado_por_id IS NOT NULL AND length(motivo_saida)>0)),
 FOREIGN KEY (organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY (organizacao_id,paciente_id) REFERENCES paciente(organizacao_id,id),
 FOREIGN KEY (organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY (organizacao_id,alta_por_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY (organizacao_id,encerrado_por_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE local (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL,
 pai_id uuid, nome text NOT NULL, tipo text NOT NULL CHECK (tipo IN ('setor','box','sala','armario')),
 capacidade integer NOT NULL CHECK (capacidade BETWEEN 0 AND 1000),
 criado_em timestamptz NOT NULL DEFAULT now(), UNIQUE (organizacao_id,id),
 UNIQUE (organizacao_id,unidade_id,id), CHECK (pai_id IS DISTINCT FROM id),
 FOREIGN KEY (organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY (organizacao_id,unidade_id,pai_id) REFERENCES local(organizacao_id,unidade_id,id)
);
CREATE TABLE ocupacao (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL,
 episodio_id uuid NOT NULL, local_id uuid NOT NULL, vaga integer NOT NULL CHECK (vaga>0),
 inicio timestamptz NOT NULL, fim timestamptz, registrado_em timestamptz NOT NULL DEFAULT now(),
 autor_id uuid NOT NULL, encerrada_por_id uuid, motivo_fim text,
 UNIQUE (organizacao_id,id), CHECK (fim IS NULL OR fim>inicio),
 CHECK ((fim IS NULL AND encerrada_por_id IS NULL AND motivo_fim IS NULL)
 OR (fim IS NOT NULL AND encerrada_por_id IS NOT NULL AND length(motivo_fim)>0)),
 FOREIGN KEY (organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id),
 FOREIGN KEY (organizacao_id,unidade_id,local_id) REFERENCES local(organizacao_id,unidade_id,id),
 FOREIGN KEY (organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY (organizacao_id,encerrada_por_id) REFERENCES usuario(organizacao_id,id),
 EXCLUDE USING gist (organizacao_id WITH =, local_id WITH =, vaga WITH =, tstzrange(inicio,fim,'[)') WITH &&),
 EXCLUDE USING gist (organizacao_id WITH =, episodio_id WITH =, tstzrange(inicio,fim,'[)') WITH &&)
);
CREATE FUNCTION validar_ocupacao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE cap integer; adm timestamptz; encerrado timestamptz;
BEGIN
 SELECT admitido_em,encerrado_em INTO adm,encerrado FROM episodio
 WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 SELECT capacidade INTO cap FROM local WHERE organizacao_id=NEW.organizacao_id AND id=NEW.local_id FOR SHARE;
 IF NEW.vaga>cap OR NEW.inicio<adm OR
 (encerrado IS NOT NULL AND (NEW.fim IS NULL OR NEW.fim>encerrado)) THEN
 RAISE EXCEPTION 'Ocupacao incompativel' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ocupacao_integridade BEFORE INSERT OR UPDATE ON ocupacao FOR EACH ROW EXECUTE FUNCTION validar_ocupacao();

CREATE TABLE lote_importacao (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, origem text NOT NULL,
 situacao text NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente','validado','rejeitado')),
 autor_id uuid NOT NULL, criado_em timestamptz NOT NULL DEFAULT now(), UNIQUE (organizacao_id,id),
 UNIQUE (organizacao_id,id,origem),
 FOREIGN KEY (organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE id_externo (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, lote_importacao_id uuid NOT NULL,
 origem text NOT NULL, entidade text NOT NULL CHECK (entidade IN ('paciente','responsavel','episodio')),
 codigo_externo text NOT NULL, paciente_id uuid, responsavel_id uuid, episodio_id uuid,
 qualidade text NOT NULL CHECK (qualidade IN ('pendente','validado')),
 criado_em timestamptz NOT NULL DEFAULT now(), UNIQUE (organizacao_id,id),
 UNIQUE (organizacao_id,origem,entidade,codigo_externo),
 CHECK (num_nonnulls(paciente_id,responsavel_id,episodio_id)=1),
 CHECK ((entidade='paciente')=(paciente_id IS NOT NULL) AND
 (entidade='responsavel')=(responsavel_id IS NOT NULL) AND (entidade='episodio')=(episodio_id IS NOT NULL)),
 FOREIGN KEY (organizacao_id,lote_importacao_id,origem) REFERENCES lote_importacao(organizacao_id,id,origem),
 FOREIGN KEY (organizacao_id,paciente_id) REFERENCES paciente(organizacao_id,id),
 FOREIGN KEY (organizacao_id,responsavel_id) REFERENCES responsavel(organizacao_id,id),
 FOREIGN KEY (organizacao_id,episodio_id) REFERENCES episodio(organizacao_id,id)
);
CREATE TABLE evento_auditoria (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, comando_id uuid NOT NULL,
 autor_id uuid NOT NULL, acao text NOT NULL, entidade_id uuid NOT NULL,
 correlation_id uuid NOT NULL, registrado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organizacao_id,id),
 FOREIGN KEY (organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY (organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE outbox (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, comando_id uuid NOT NULL,
 tipo text NOT NULL, entidade_id uuid NOT NULL, versao integer NOT NULL DEFAULT 1,
 disponivel_em timestamptz NOT NULL DEFAULT now(), tentativas integer NOT NULL DEFAULT 0,
 lease_ate timestamptz, lease_token uuid, concluida_em timestamptz,
 pendente_em timestamptz, ultimo_erro text,
 UNIQUE (organizacao_id,id), CHECK (tentativas BETWEEN 0 AND 5),
 FOREIGN KEY (organizacao_id,comando_id) REFERENCES comando(organizacao_id,id)
);
CREATE TABLE inbox (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, consumidor text NOT NULL,
 evento_id uuid NOT NULL, recebido_em timestamptz NOT NULL DEFAULT now(),
 processado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organizacao_id,consumidor,evento_id),
 FOREIGN KEY (organizacao_id,evento_id) REFERENCES outbox(organizacao_id,id)
);
CREATE FUNCTION impedir_alteracao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Registro imutavel' USING ERRCODE='23514'; END $$;
CREATE TRIGGER auditoria_imutavel BEFORE UPDATE OR DELETE ON evento_auditoria FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TRIGGER inbox_imutavel BEFORE UPDATE OR DELETE ON inbox FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE INDEX paciente_pagina ON paciente(organizacao_id,id);
CREATE INDEX responsavel_pagina ON responsavel(organizacao_id,id);
CREATE INDEX episodio_ativo ON episodio(organizacao_id,unidade_id,id) WHERE encerrado_em IS NULL;
CREATE INDEX episodio_historico ON episodio(organizacao_id,paciente_id,id);
CREATE INDEX auditoria_pagina ON evento_auditoria(organizacao_id,id);
CREATE INDEX outbox_disponivel ON outbox(disponivel_em,id) WHERE concluida_em IS NULL AND pendente_em IS NULL;
CREATE INDEX usuario_acesso ON usuario_papel(organizacao_id,usuario_id);

-- Organization guard is transaction-local. Default is deny, including table owners.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT table_name FROM information_schema.columns WHERE table_schema='hvb'
 AND column_name='organizacao_id' LOOP
 EXECUTE format('ALTER TABLE hvb.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE hvb.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant ON hvb.%I USING (organizacao_id = nullif(current_setting(''hvb.org'',true),'''')::uuid) WITH CHECK (organizacao_id = nullif(current_setting(''hvb.org'',true),'''')::uuid)',t);
 END LOOP;
END $$;
ALTER TABLE organizacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizacao FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON organizacao USING (id=nullif(current_setting('hvb.org',true),'')::uuid);

-- Two narrow privileged entrypoints: authentication and claiming local jobs.
CREATE FUNCTION autenticar(hash text) RETURNS TABLE(organizacao_id uuid,usuario_id uuid,credencial_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=hvb,pg_temp AS $$
 SELECT c.organizacao_id,c.usuario_id,c.id FROM credencial c JOIN usuario u
 ON (u.organizacao_id,u.id)=(c.organizacao_id,c.usuario_id)
 WHERE c.token_hash=hash AND c.tipo='api' AND c.revogada_em IS NULL AND c.expira_em>now() AND u.ativo
$$;
CREATE FUNCTION reservar_outbox(limite integer, token uuid) RETURNS SETOF outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=hvb,pg_temp AS $$
BEGIN
 IF limite<1 OR limite>100 THEN RAISE EXCEPTION 'Limite invalido'; END IF;
 UPDATE outbox SET pendente_em=now(),ultimo_erro='tentativas_esgotadas'
 WHERE concluida_em IS NULL AND pendente_em IS NULL AND tentativas>=5 AND lease_ate<now();
 RETURN QUERY WITH candidatos AS (
 SELECT id FROM outbox WHERE concluida_em IS NULL AND pendente_em IS NULL
 AND disponivel_em<=now() AND (lease_ate IS NULL OR lease_ate<now()) AND tentativas<5
 ORDER BY disponivel_em,id LIMIT limite FOR UPDATE SKIP LOCKED
 ) UPDATE outbox o SET lease_ate=now()+interval '30 seconds',lease_token=token,tentativas=o.tentativas+1
 FROM candidatos c WHERE o.id=c.id RETURNING o.*;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA hvb FROM PUBLIC;
