SET search_path=hvb,public;
CREATE TABLE item_clinico (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL REFERENCES organizacao(id), nome text NOT NULL,
 tipo text NOT NULL CHECK(tipo IN ('medicamento','procedimento','cuidado','outro')),
 UNIQUE(organizacao_id,id)
);
CREATE TABLE prescricao (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL, episodio_id uuid NOT NULL,
 prescritor_id uuid NOT NULL, assinada_em timestamptz NOT NULL CHECK(isfinite(assinada_em)),
 registrada_em timestamptz NOT NULL DEFAULT now(), motivo text NOT NULL,
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,unidade_id,id), UNIQUE(organizacao_id,unidade_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,prescritor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE ordem (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL, episodio_id uuid NOT NULL, prescricao_id uuid NOT NULL,
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,unidade_id,id), UNIQUE(organizacao_id,unidade_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id,prescricao_id) REFERENCES prescricao(organizacao_id,unidade_id,episodio_id,id)
);
CREATE TABLE ordem_versao (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL, episodio_id uuid NOT NULL, ordem_id uuid NOT NULL,
 versao integer NOT NULL CHECK(versao>0), item_clinico_id uuid NOT NULL,
 quantidade_prescrita quantidade_exata NOT NULL CHECK(quantidade_prescrita>0), unidade_medida_id uuid NOT NULL,
 via text NOT NULL, orientacao text NOT NULL, vigencia_inicio timestamptz NOT NULL, vigencia_fim timestamptz,
 autor_id uuid NOT NULL, registrada_em timestamptz NOT NULL DEFAULT now(), motivo text NOT NULL,
 CHECK(isfinite(vigencia_inicio) AND (vigencia_fim IS NULL OR (isfinite(vigencia_fim) AND vigencia_fim>vigencia_inicio))),
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,unidade_id,id), UNIQUE(organizacao_id,unidade_id,episodio_id,id),
 UNIQUE(organizacao_id,ordem_id,versao),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id,ordem_id) REFERENCES ordem(organizacao_id,unidade_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,item_clinico_id) REFERENCES item_clinico(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_medida_id) REFERENCES unidade(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE programacao (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL, episodio_id uuid NOT NULL, ordem_versao_id uuid NOT NULL,
 prevista_em timestamptz NOT NULL CHECK(isfinite(prevista_em)), criada_em timestamptz NOT NULL DEFAULT now(), autor_id uuid NOT NULL,
 situacao text NOT NULL DEFAULT 'prevista' CHECK(situacao IN ('prevista','nao_executada')),
 motivo_nao_execucao text, encerrada_por_id uuid, encerrada_em timestamptz,
 CHECK((situacao='prevista')=(motivo_nao_execucao IS NULL)), CHECK((situacao='prevista')=(encerrada_por_id IS NULL)), CHECK((situacao='prevista')=(encerrada_em IS NULL)),
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,unidade_id,id), UNIQUE(organizacao_id,ordem_versao_id,id),
 UNIQUE(organizacao_id,ordem_versao_id,prevista_em),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id,ordem_versao_id) REFERENCES ordem_versao(organizacao_id,unidade_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,encerrada_por_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE execucao (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL, episodio_id uuid NOT NULL, ordem_versao_id uuid NOT NULL,
 programacao_id uuid, evento_referencia uuid NOT NULL, correcao_de_id uuid,
 executor_id uuid NOT NULL, executada_em timestamptz NOT NULL CHECK(isfinite(executada_em)), registrada_em timestamptz NOT NULL DEFAULT now(),
 quantidade_aplicada quantidade_exata NOT NULL CHECK(quantidade_aplicada>0), unidade_medida_id uuid NOT NULL,
 resultado text NOT NULL CHECK(resultado IN ('integral','parcial')), situacao_material text NOT NULL CHECK(situacao_material IN ('pendente','nao_utilizado')),
 confirmacao_humana boolean NOT NULL CHECK(confirmacao_humana), motivo text NOT NULL,
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,unidade_id,id), UNIQUE(organizacao_id,unidade_id,episodio_id,id),
 UNIQUE(organizacao_id,evento_referencia), UNIQUE(organizacao_id,correcao_de_id), CHECK(id IS DISTINCT FROM correcao_de_id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id,ordem_versao_id) REFERENCES ordem_versao(organizacao_id,unidade_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,ordem_versao_id,programacao_id) REFERENCES programacao(organizacao_id,ordem_versao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id,correcao_de_id) REFERENCES execucao(organizacao_id,unidade_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,unidade_medida_id) REFERENCES unidade(organizacao_id,id),
 FOREIGN KEY(organizacao_id,executor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE material_previsto (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, item_clinico_id uuid NOT NULL, produto_id uuid NOT NULL,
 versao integer NOT NULL CHECK(versao>0), quantidade_base quantidade_exata NOT NULL CHECK(quantidade_base>0),
 criterio text NOT NULL, aprovado_por_id uuid NOT NULL, aprovado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,item_clinico_id,produto_id,versao),
 FOREIGN KEY(organizacao_id,item_clinico_id) REFERENCES item_clinico(organizacao_id,id),
 FOREIGN KEY(organizacao_id,produto_id) REFERENCES produto(organizacao_id,id),
 FOREIGN KEY(organizacao_id,aprovado_por_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE consumo (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL, episodio_id uuid NOT NULL, execucao_id uuid,
 evento_referencia uuid NOT NULL, ocorrido_em timestamptz NOT NULL CHECK(isfinite(ocorrido_em)), registrado_em timestamptz NOT NULL DEFAULT now(),
 autor_id uuid NOT NULL, finalidade text NOT NULL, motivo text NOT NULL, itens_confirmados boolean NOT NULL CHECK(itens_confirmados),
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,unidade_id,id), UNIQUE(organizacao_id,evento_referencia),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id,execucao_id) REFERENCES execucao(organizacao_id,unidade_id,episodio_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE consumo_item (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL, consumo_id uuid NOT NULL,
 lancamento_id uuid NOT NULL, transacao_id uuid NOT NULL, posicao_id uuid NOT NULL,
 quantidade_base quantidade_exata NOT NULL CHECK(quantidade_base>0), custo_total_snapshot numeric(40,12),
 CHECK(custo_total_snapshot IS NULL OR (custo_total_snapshot>=0 AND custo_total_snapshot NOT IN ('NaN','Infinity','-Infinity'))),
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,lancamento_id), UNIQUE(organizacao_id,transacao_id), UNIQUE(organizacao_id,consumo_id,posicao_id),
 FOREIGN KEY(organizacao_id,unidade_id,consumo_id) REFERENCES consumo(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,lancamento_id) REFERENCES lancamento_estoque(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,transacao_id) REFERENCES transacao_estoque(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,posicao_id) REFERENCES posicao_estoque(organizacao_id,unidade_id,id)
);
CREATE TABLE estorno_consumo (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL, consumo_id uuid NOT NULL,
 autor_id uuid NOT NULL, ocorrido_em timestamptz NOT NULL CHECK(isfinite(ocorrido_em)), registrado_em timestamptz NOT NULL DEFAULT now(), motivo text NOT NULL,
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,consumo_id),
 FOREIGN KEY(organizacao_id,unidade_id,consumo_id) REFERENCES consumo(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE TABLE pendencia_clinica (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL,
 execucao_id uuid, consumo_id uuid, programacao_id uuid, ordem_versao_id uuid,
 tipo text NOT NULL CHECK(tipo IN ('material_nao_identificado','revisao_programacao','ordem_sobreposta','validade_material','custo_desconhecido')),
 descricao text NOT NULL, criada_em timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(execucao_id,consumo_id,programacao_id,ordem_versao_id)=1),
 CHECK((tipo='material_nao_identificado')=(execucao_id IS NOT NULL)),
 CHECK((tipo='revisao_programacao')=(programacao_id IS NOT NULL)),
 CHECK((tipo='ordem_sobreposta')=(ordem_versao_id IS NOT NULL)),
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,execucao_id) REFERENCES execucao(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,consumo_id) REFERENCES consumo(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,programacao_id) REFERENCES programacao(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,ordem_versao_id) REFERENCES ordem_versao(organizacao_id,unidade_id,id)
);
CREATE TABLE resolucao_pendencia_clinica (
 id uuid PRIMARY KEY, organizacao_id uuid NOT NULL, unidade_id uuid NOT NULL, pendencia_id uuid NOT NULL,
 consumo_id uuid, execucao_substituta_id uuid, autor_id uuid NOT NULL, motivo text NOT NULL, resolvida_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organizacao_id,id), UNIQUE(organizacao_id,pendencia_id),
 CHECK(num_nonnulls(consumo_id,execucao_substituta_id)<=1),
 FOREIGN KEY(organizacao_id,unidade_id,pendencia_id) REFERENCES pendencia_clinica(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,consumo_id) REFERENCES consumo(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,execucao_substituta_id) REFERENCES execucao(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id)
);
CREATE VIEW pendencia_clinica_consulta WITH(security_invoker=true) AS
 SELECT p.*, CASE WHEN r.id IS NULL THEN 'aberta' ELSE 'resolvida' END AS situacao, r.motivo AS motivo_resolucao,r.autor_id AS resolvida_por_id,r.resolvida_em
 FROM pendencia_clinica p LEFT JOIN resolucao_pendencia_clinica r ON r.organizacao_id=p.organizacao_id AND r.pendencia_id=p.id;
CREATE VIEW programacao_consulta WITH(security_invoker=true) AS
 SELECT p.*, CASE WHEN p.situacao='nao_executada' THEN 'nao_executada'
 WHEN EXISTS(SELECT 1 FROM execucao e WHERE e.organizacao_id=p.organizacao_id AND e.programacao_id=p.id AND e.resultado='integral' AND NOT EXISTS(SELECT 1 FROM execucao c WHERE c.organizacao_id=e.organizacao_id AND c.correcao_de_id=e.id)) THEN 'concluida'
 WHEN EXISTS(SELECT 1 FROM execucao e WHERE e.organizacao_id=p.organizacao_id AND e.programacao_id=p.id) THEN 'parcial' ELSE 'prevista' END AS estado_execucao
 FROM programacao p;
CREATE INDEX ordem_versao_vigencia ON ordem_versao(organizacao_id,ordem_id,vigencia_inicio);
CREATE INDEX ordem_versao_episodio ON ordem_versao(organizacao_id,episodio_id,item_clinico_id);
CREATE INDEX programacao_mapa ON programacao(organizacao_id,unidade_id,prevista_em,id);
CREATE INDEX execucao_programacao ON execucao(organizacao_id,programacao_id);
CREATE INDEX execucao_episodio ON execucao(organizacao_id,unidade_id,episodio_id,id);
CREATE INDEX consumo_execucao ON consumo(organizacao_id,execucao_id);
CREATE INDEX consumo_item_cabecalho ON consumo_item(organizacao_id,consumo_id);
CREATE INDEX pendencia_execucao ON pendencia_clinica(organizacao_id,execucao_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['item_clinico','prescricao','ordem','ordem_versao','programacao','execucao','material_previsto','consumo','consumo_item','estorno_consumo','pendencia_clinica','resolucao_pendencia_clinica'] LOOP
 EXECUTE format('ALTER TABLE hvb.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE hvb.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant ON hvb.%I USING (organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid) WITH CHECK (organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid)',t);
 EXECUTE format('GRANT INSERT ON hvb.%I TO hvb_app',t);
 IF t<>'programacao' THEN EXECUTE format('CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON hvb.%I FOR EACH ROW EXECUTE FUNCTION hvb.impedir_alteracao()',t); END IF;
 END LOOP;
END $$;
GRANT UPDATE(situacao,motivo_nao_execucao,encerrada_por_id,encerrada_em) ON programacao TO hvb_app;
INSERT INTO permissao VALUES ('clinica:ler'),('clinica:catalogar'),('clinica:prescrever'),('clinica:programar'),('clinica:executar'),('clinica:retificar'),('clinica:consumir'),('clinica:reverter_consumo'),('clinica:revisar');
