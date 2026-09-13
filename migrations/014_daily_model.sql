SET search_path=hvb,public;
CREATE TABLE medicao_peso (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,episodio_id uuid NOT NULL,
 quantidade quantidade_exata NOT NULL CHECK(quantidade>0),unidade_medida_id uuid NOT NULL,medida_em timestamptz NOT NULL CHECK(isfinite(medida_em)),
 autor_id uuid NOT NULL,registrada_em timestamptz NOT NULL DEFAULT now(),motivo text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),UNIQUE(organizacao_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_medida_id) REFERENCES unidade(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE classificacao_versao (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL REFERENCES organizacao(id),codigo text NOT NULL,versao integer NOT NULL CHECK(versao>0),descricao text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,codigo,versao)
);
CREATE TABLE classificacao_episodio (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,episodio_id uuid NOT NULL,classificacao_versao_id uuid NOT NULL,
 inicio timestamptz NOT NULL,fim timestamptz,medicao_peso_id uuid,avaliacao_clinica_id uuid,
 suporte_ventilatorio text NOT NULL CHECK(suporte_ventilatorio IN ('informado_sim','informado_nao','nao_informado')),
 autor_id uuid NOT NULL,motivo text NOT NULL,registrada_em timestamptz NOT NULL DEFAULT now(),encerrada_por_id uuid,motivo_fim text,
 CHECK(isfinite(inicio) AND (fim IS NULL OR (isfinite(fim) AND fim>inicio))),
 CHECK((fim IS NULL)=(encerrada_por_id IS NULL)),CHECK((fim IS NULL)=(motivo_fim IS NULL)),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),UNIQUE(organizacao_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,classificacao_versao_id) REFERENCES classificacao_versao(organizacao_id,id),
 FOREIGN KEY(organizacao_id,episodio_id,medicao_peso_id) REFERENCES medicao_peso(organizacao_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id,avaliacao_clinica_id) REFERENCES execucao(organizacao_id,unidade_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,encerrada_por_id) REFERENCES usuario(organizacao_id,id),
 EXCLUDE USING gist(organizacao_id WITH =,episodio_id WITH =,tstzrange(inicio,fim,'[)') WITH &&)
);
CREATE TABLE grupo_cobertura_versao (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL REFERENCES organizacao(id),codigo text NOT NULL,versao integer NOT NULL CHECK(versao>0),descricao text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,codigo,versao)
);
CREATE TABLE membro_grupo_cobertura (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,grupo_versao_id uuid NOT NULL,item_clinico_id uuid NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,grupo_versao_id,item_clinico_id),
 FOREIGN KEY(organizacao_id,grupo_versao_id) REFERENCES grupo_cobertura_versao(organizacao_id,id),FOREIGN KEY(organizacao_id,item_clinico_id) REFERENCES item_clinico(organizacao_id,id)
);
CREATE TABLE pacote_versao (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL REFERENCES organizacao(id),codigo text NOT NULL,versao integer NOT NULL CHECK(versao>0),descricao text NOT NULL,
 classificacao_versao_id uuid,base_temporal text NOT NULL CHECK(base_temporal IN ('pendente','periodo_explicito')),
 limite_encerramento text NOT NULL CHECK(limite_encerramento IN ('pendente','alta_clinica','saida_fisica','intervalo_informado')),
 politica_tolerancia text NOT NULL CHECK(politica_tolerancia IN ('pendente','sem_tolerancia')),
 mudanca_classe text NOT NULL CHECK(mudanca_classe IN ('pendente','exige_novo_periodo')),
 simulacao boolean NOT NULL CHECK(simulacao),autor_id uuid NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,codigo,versao),
 FOREIGN KEY(organizacao_id,classificacao_versao_id) REFERENCES classificacao_versao(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE regra_pacote (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,pacote_versao_id uuid NOT NULL,item_clinico_id uuid,grupo_versao_id uuid,produto_id uuid,
 dimensao text NOT NULL CHECK(dimensao IN ('pendente','quantidade_fisica','administracoes','itens_distintos')),
 janela text NOT NULL CHECK(janela IN ('pendente','periodo','episodio')),prioridade integer NOT NULL CHECK(prioridade>0),
 tratamento text NOT NULL CHECK(tratamento IN ('pendente','incluido_limitado','incluido_sem_limite','excluido')),
 limite_quantidade quantidade_exata CHECK(limite_quantidade>=0),unidade_limite_id uuid,
 tratamento_excedente text NOT NULL CHECK(tratamento_excedente IN ('pendente','revisao_comercial')),
 CHECK(num_nonnulls(item_clinico_id,grupo_versao_id,produto_id)=1),
 CHECK((tratamento='incluido_limitado')=(limite_quantidade IS NOT NULL)),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,pacote_versao_id,id),
 FOREIGN KEY(organizacao_id,pacote_versao_id) REFERENCES pacote_versao(organizacao_id,id),
 FOREIGN KEY(organizacao_id,item_clinico_id) REFERENCES item_clinico(organizacao_id,id),FOREIGN KEY(organizacao_id,grupo_versao_id) REFERENCES grupo_cobertura_versao(organizacao_id,id),
 FOREIGN KEY(organizacao_id,produto_id) REFERENCES produto(organizacao_id,id),FOREIGN KEY(organizacao_id,unidade_limite_id) REFERENCES unidade(organizacao_id,id)
);
CREATE TABLE aprovacao_pacote (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,pacote_versao_id uuid NOT NULL,autor_id uuid NOT NULL,
 aprovada_em timestamptz NOT NULL DEFAULT now(),motivo text NOT NULL,simulacao boolean NOT NULL CHECK(simulacao),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,pacote_versao_id),
 FOREIGN KEY(organizacao_id,pacote_versao_id) REFERENCES pacote_versao(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE pacote_episodio (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,episodio_id uuid NOT NULL,pacote_versao_id uuid NOT NULL,
 inicio timestamptz NOT NULL,fim timestamptz NOT NULL,autor_id uuid NOT NULL,motivo text NOT NULL,
 CHECK(isfinite(inicio) AND isfinite(fim) AND fim>inicio),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),UNIQUE(organizacao_id,episodio_id,id),UNIQUE(organizacao_id,pacote_versao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,pacote_versao_id) REFERENCES aprovacao_pacote(organizacao_id,pacote_versao_id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 EXCLUDE USING gist(organizacao_id WITH =,episodio_id WITH =,tstzrange(inicio,fim,'[)') WITH &&)
);
CREATE TABLE periodo_diaria (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,episodio_id uuid NOT NULL,pacote_episodio_id uuid NOT NULL,
 classificacao_episodio_id uuid,inicio timestamptz NOT NULL,fim timestamptz NOT NULL,fuso text NOT NULL,
 autor_id uuid NOT NULL,motivo text NOT NULL,registrado_em timestamptz NOT NULL DEFAULT now(),
 CHECK(isfinite(inicio) AND isfinite(fim) AND fim>inicio),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),UNIQUE(organizacao_id,episodio_id,id),UNIQUE(organizacao_id,pacote_episodio_id,id),
 FOREIGN KEY(organizacao_id,episodio_id,pacote_episodio_id) REFERENCES pacote_episodio(organizacao_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,episodio_id,classificacao_episodio_id) REFERENCES classificacao_episodio(organizacao_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 EXCLUDE USING gist(organizacao_id WITH =,episodio_id WITH =,tstzrange(inicio,fim,'[)') WITH &&)
);
CREATE TABLE evento_cobertura (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,episodio_id uuid NOT NULL,execucao_id uuid,consumo_item_id uuid,
 ocorrido_em timestamptz NOT NULL,item_clinico_id uuid,produto_id uuid,quantidade_fisica quantidade_exata,unidade_medida_id uuid,
 autor_id uuid NOT NULL,registrado_em timestamptz NOT NULL DEFAULT now(),motivo text NOT NULL,
 CHECK(num_nonnulls(execucao_id,consumo_item_id)=1),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),UNIQUE(organizacao_id,episodio_id,id),UNIQUE(organizacao_id,execucao_id),UNIQUE(organizacao_id,consumo_item_id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id,execucao_id) REFERENCES execucao(organizacao_id,unidade_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,consumo_item_id) REFERENCES consumo_item(organizacao_id,id),FOREIGN KEY(organizacao_id,item_clinico_id) REFERENCES item_clinico(organizacao_id,id),
 FOREIGN KEY(organizacao_id,produto_id) REFERENCES produto(organizacao_id,id),FOREIGN KEY(organizacao_id,unidade_medida_id) REFERENCES unidade(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE uso_cobertura (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,episodio_id uuid NOT NULL,
 pacote_episodio_id uuid NOT NULL,regra_id uuid NOT NULL,periodo_diaria_id uuid,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 UNIQUE NULLS NOT DISTINCT(organizacao_id,pacote_episodio_id,regra_id,periodo_diaria_id),
 FOREIGN KEY(organizacao_id,episodio_id,pacote_episodio_id) REFERENCES pacote_episodio(organizacao_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,regra_id) REFERENCES regra_pacote(organizacao_id,id),
 FOREIGN KEY(organizacao_id,pacote_episodio_id,periodo_diaria_id) REFERENCES periodo_diaria(organizacao_id,pacote_episodio_id,id)
);
CREATE TABLE reserva_cobertura (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,evento_id uuid NOT NULL,uso_id uuid NOT NULL,periodo_diaria_id uuid NOT NULL,
 quantidade quantidade_exata NOT NULL CHECK(quantidade>0),expira_em timestamptz NOT NULL CHECK(isfinite(expira_em)),
 situacao text NOT NULL DEFAULT 'ativa' CHECK(situacao IN ('ativa','liberada','expirada','efetivada')),
 autor_id uuid NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),motivo text NOT NULL,encerrada_por_id uuid,encerrada_em timestamptz,motivo_fim text,
 CHECK((situacao='ativa')=(encerrada_em IS NULL)),CHECK((situacao='ativa')=(encerrada_por_id IS NULL)),CHECK((situacao='ativa')=(motivo_fim IS NULL)),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,evento_id) REFERENCES evento_cobertura(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,uso_id) REFERENCES uso_cobertura(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,periodo_diaria_id) REFERENCES periodo_diaria(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,encerrada_por_id) REFERENCES usuario(organizacao_id,id)
);
CREATE UNIQUE INDEX reserva_cobertura_evento_ativo ON reserva_cobertura(organizacao_id,evento_id) WHERE situacao='ativa';
CREATE TABLE avaliacao_cobertura (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,evento_id uuid NOT NULL,periodo_diaria_id uuid,uso_id uuid,
 versao integer NOT NULL CHECK(versao>0),anterior_id uuid,reserva_id uuid,
 resultado text NOT NULL CHECK(resultado IN ('incluido','parcial','excedente','excluido','pendente')),
 justificativa text NOT NULL,autor_id uuid NOT NULL,avaliada_em timestamptz NOT NULL DEFAULT now(),motivo text NOT NULL,comando_id uuid NOT NULL,
 CHECK((versao=1)=(anterior_id IS NULL)),CHECK((resultado='pendente')=(uso_id IS NULL)),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),UNIQUE(organizacao_id,evento_id,id),UNIQUE(organizacao_id,evento_id,versao),UNIQUE(organizacao_id,anterior_id),UNIQUE(organizacao_id,reserva_id),
 FOREIGN KEY(organizacao_id,unidade_id,evento_id) REFERENCES evento_cobertura(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,periodo_diaria_id) REFERENCES periodo_diaria(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,uso_id) REFERENCES uso_cobertura(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,evento_id,anterior_id) REFERENCES avaliacao_cobertura(organizacao_id,evento_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,reserva_id) REFERENCES reserva_cobertura(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id)
);
CREATE TABLE reversao_cobertura (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,avaliacao_id uuid NOT NULL,autor_id uuid NOT NULL,
 motivo text NOT NULL,revertida_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,avaliacao_id),
 FOREIGN KEY(organizacao_id,unidade_id,avaliacao_id) REFERENCES avaliacao_cobertura(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE alocacao_cobertura (
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,avaliacao_id uuid NOT NULL,uso_id uuid NOT NULL,
 quantidade quantidade_exata NOT NULL CHECK(quantidade>0),incluida quantidade_exata NOT NULL CHECK(incluida>=0),excedente quantidade_exata NOT NULL CHECK(excedente>=0),
 CHECK(quantidade=incluida+excedente),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,avaliacao_id),
 FOREIGN KEY(organizacao_id,unidade_id,avaliacao_id) REFERENCES avaliacao_cobertura(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,uso_id) REFERENCES uso_cobertura(organizacao_id,unidade_id,id)
);
CREATE INDEX regra_pacote_candidatas ON regra_pacote(organizacao_id,pacote_versao_id,prioridade DESC);
CREATE INDEX avaliacao_cobertura_evento ON avaliacao_cobertura(organizacao_id,evento_id,versao DESC);
CREATE INDEX alocacao_cobertura_uso ON alocacao_cobertura(organizacao_id,uso_id);
CREATE INDEX reserva_cobertura_uso ON reserva_cobertura(organizacao_id,uso_id) WHERE situacao='ativa';
CREATE INDEX evento_cobertura_episodio ON evento_cobertura(organizacao_id,unidade_id,episodio_id,id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['medicao_peso','classificacao_versao','classificacao_episodio','grupo_cobertura_versao','membro_grupo_cobertura','pacote_versao','regra_pacote','aprovacao_pacote','pacote_episodio','periodo_diaria','evento_cobertura','uso_cobertura','reserva_cobertura','avaliacao_cobertura','reversao_cobertura','alocacao_cobertura'] LOOP
 EXECUTE format('ALTER TABLE hvb.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE hvb.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant ON hvb.%I USING (organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid) WITH CHECK(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid)',t);
 EXECUTE format('GRANT INSERT ON hvb.%I TO hvb_app',t);
 IF t NOT IN ('reserva_cobertura','classificacao_episodio') THEN EXECUTE format('CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON hvb.%I FOR EACH ROW EXECUTE FUNCTION hvb.impedir_alteracao()',t); END IF;
 END LOOP;
END $$;
GRANT UPDATE(fim,encerrada_por_id,motivo_fim) ON classificacao_episodio TO hvb_app;
GRANT UPDATE(situacao,encerrada_por_id,encerrada_em,motivo_fim) ON reserva_cobertura TO hvb_app;
INSERT INTO permissao VALUES('diarias:ler'),('diarias:configurar'),('diarias:aprovar_simulacao'),('diarias:classificar'),('diarias:associar'),('diarias:avaliar'),('diarias:reservar'),('diarias:reverter');
