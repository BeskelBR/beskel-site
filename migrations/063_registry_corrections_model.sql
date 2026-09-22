SET search_path=hvb,public;
ALTER TABLE usuario_papel ADD CONSTRAINT usuario_papel_org_id UNIQUE(organizacao_id,id);
CREATE TABLE revisao_cadastro(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 tipo text NOT NULL CHECK(tipo IN ('paciente','responsavel','usuario','unidade','dispositivo','local')),alvo_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),anterior_id uuid,antes jsonb NOT NULL,depois jsonb NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,tipo,alvo_id,versao),UNIQUE(organizacao_id,anterior_id),CHECK((versao=1)=(anterior_id IS NULL)),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),FOREIGN KEY(organizacao_id,anterior_id) REFERENCES revisao_cadastro(organizacao_id,id),
paciente_id uuid,FOREIGN KEY(organizacao_id,paciente_id) REFERENCES paciente(organizacao_id,id),CHECK((tipo='paciente')=(paciente_id IS NOT NULL)),
responsavel_id uuid,FOREIGN KEY(organizacao_id,responsavel_id) REFERENCES responsavel(organizacao_id,id),CHECK((tipo='responsavel')=(responsavel_id IS NOT NULL)),
usuario_id uuid,FOREIGN KEY(organizacao_id,usuario_id) REFERENCES usuario(organizacao_id,id),CHECK((tipo='usuario')=(usuario_id IS NOT NULL)),
cadastro_unidade_id uuid,FOREIGN KEY(organizacao_id,cadastro_unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),CHECK((tipo='unidade')=(cadastro_unidade_id IS NOT NULL)),
dispositivo_id uuid,FOREIGN KEY(organizacao_id,dispositivo_id) REFERENCES dispositivo(organizacao_id,id),CHECK((tipo='dispositivo')=(dispositivo_id IS NOT NULL)),
local_id uuid,FOREIGN KEY(organizacao_id,local_id) REFERENCES local(organizacao_id,id),CHECK((tipo='local')=(local_id IS NOT NULL)),CHECK(alvo_id=coalesce(paciente_id,responsavel_id,usuario_id,cadastro_unidade_id,dispositivo_id,local_id)));
CREATE TABLE revisao_atribuicao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),atribuicao_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),anterior_id uuid,ativo boolean NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,atribuicao_id,versao),UNIQUE(organizacao_id,anterior_id),CHECK((versao=1)=(anterior_id IS NULL)),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),FOREIGN KEY(organizacao_id,atribuicao_id) REFERENCES usuario_papel(organizacao_id,id),FOREIGN KEY(organizacao_id,anterior_id) REFERENCES revisao_atribuicao(organizacao_id,id)
);
ALTER TABLE revisao_cadastro ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisao_cadastro FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON revisao_cadastro USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON revisao_cadastro TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON revisao_cadastro FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON revisao_cadastro FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
ALTER TABLE revisao_atribuicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisao_atribuicao FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON revisao_atribuicao USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON revisao_atribuicao TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON revisao_atribuicao FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON revisao_atribuicao FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE VIEW atribuicao_consulta WITH(security_invoker=true) AS SELECT up.*,coalesce(r.ativo,true) ativo,coalesce(r.versao,0) versao FROM usuario_papel up LEFT JOIN LATERAL(SELECT ativo,versao FROM revisao_atribuicao WHERE organizacao_id=up.organizacao_id AND atribuicao_id=up.id ORDER BY versao DESC LIMIT 1) r ON true;
INSERT INTO permissao VALUES('cadastros:retificar'),('locais:retificar');
