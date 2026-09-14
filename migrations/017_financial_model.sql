SET search_path=hvb,public;
CREATE DOMAIN valor_monetario AS numeric CHECK(VALUE>=0 AND VALUE<100000000000000 AND scale(VALUE)<=2);
CREATE TABLE pagador(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 responsavel_id uuid NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,responsavel_id) REFERENCES responsavel(organizacao_id,id),
 UNIQUE(organizacao_id,unidade_id,responsavel_id)
);
CREATE INDEX pagador_unidade ON pagador(organizacao_id,unidade_id,id);
CREATE TABLE item_comercial_versao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 codigo text NOT NULL,versao integer NOT NULL CHECK(versao>0),descricao text NOT NULL,tipo text NOT NULL CHECK(tipo IN ('servico','produto')),produto_id uuid,unidade_medida_id uuid NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,produto_id) REFERENCES produto(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_medida_id) REFERENCES unidade(organizacao_id,id),
 UNIQUE(organizacao_id,unidade_id,codigo,versao),CHECK((tipo='produto')=(produto_id IS NOT NULL))
);
CREATE INDEX item_comercial_versao_unidade ON item_comercial_versao(organizacao_id,unidade_id,id);
CREATE TABLE preco_versao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 item_comercial_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),inicio timestamptz NOT NULL,fim timestamptz NOT NULL,valor valor_monetario NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,item_comercial_id) REFERENCES item_comercial_versao(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,unidade_id,item_comercial_id,versao),CHECK(isfinite(inicio) AND isfinite(fim) AND inicio<fim),EXCLUDE USING gist(organizacao_id WITH =,unidade_id WITH =,item_comercial_id WITH =,tstzrange(inicio,fim,'[)') WITH &&)
);
CREATE INDEX preco_versao_unidade ON preco_versao(organizacao_id,unidade_id,id);
CREATE TABLE conta(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 episodio_id uuid NOT NULL,descricao text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id)
);
CREATE INDEX conta_unidade ON conta(organizacao_id,unidade_id,id);
CREATE TABLE evento_cobravel(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 episodio_id uuid NOT NULL,item_comercial_id uuid NOT NULL,execucao_id uuid,consumo_item_id uuid,periodo_diaria_id uuid,quantidade quantidade_exata NOT NULL CHECK(quantidade>0),competencia timestamptz NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,episodio_id) REFERENCES episodio(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,item_comercial_id) REFERENCES item_comercial_versao(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,execucao_id) REFERENCES execucao(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,consumo_item_id) REFERENCES consumo_item(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,periodo_diaria_id) REFERENCES periodo_diaria(organizacao_id,unidade_id,id),
 CHECK(num_nonnulls(execucao_id,consumo_item_id,periodo_diaria_id)=1),UNIQUE(organizacao_id,execucao_id),UNIQUE(organizacao_id,consumo_item_id),UNIQUE(organizacao_id,periodo_diaria_id)
);
CREATE INDEX evento_cobravel_unidade ON evento_cobravel(organizacao_id,unidade_id,id);
CREATE TABLE avaliacao_cobranca(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 evento_id uuid NOT NULL,versao integer NOT NULL CHECK(versao>0),anterior_id uuid,preco_id uuid,cobertura_id uuid,resultado text NOT NULL CHECK(resultado IN ('pendente','cobravel','incluido','isento')),bruto valor_monetario,desconto valor_monetario NOT NULL,beneficio valor_monetario NOT NULL,valor valor_monetario,justificativa text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,evento_id) REFERENCES evento_cobravel(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,anterior_id) REFERENCES avaliacao_cobranca(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,preco_id) REFERENCES preco_versao(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,cobertura_id) REFERENCES avaliacao_cobertura(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,unidade_id,evento_id,versao),UNIQUE(organizacao_id,anterior_id),CHECK((versao=1)=(anterior_id IS NULL)),CHECK((resultado='pendente')=(valor IS NULL)),CHECK(valor IS NULL OR valor=bruto-desconto-beneficio),CHECK((resultado='cobravel')=(coalesce(valor,0)>0))
);
CREATE INDEX avaliacao_cobranca_unidade ON avaliacao_cobranca(organizacao_id,unidade_id,id);
CREATE TABLE item_conta(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 conta_id uuid NOT NULL,avaliacao_id uuid NOT NULL,descricao text NOT NULL,valor valor_monetario NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,conta_id) REFERENCES conta(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,avaliacao_id) REFERENCES avaliacao_cobranca(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,avaliacao_id)
);
CREATE INDEX item_conta_unidade ON item_conta(organizacao_id,unidade_id,id);
CREATE TABLE responsabilidade(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 item_conta_id uuid NOT NULL,pagador_id uuid NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,item_conta_id) REFERENCES item_conta(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,pagador_id) REFERENCES pagador(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,item_conta_id,pagador_id)
);
CREATE INDEX responsabilidade_unidade ON responsabilidade(organizacao_id,unidade_id,id);
CREATE TABLE titulo(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 pagador_id uuid NOT NULL,vencimento date NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,pagador_id) REFERENCES pagador(organizacao_id,unidade_id,id),
 CHECK(isfinite(vencimento))
);
CREATE INDEX titulo_unidade ON titulo(organizacao_id,unidade_id,id);
CREATE TABLE titulo_item(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 titulo_id uuid NOT NULL,responsabilidade_id uuid NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,titulo_id) REFERENCES titulo(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,responsabilidade_id) REFERENCES responsabilidade(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,titulo_id,responsabilidade_id)
);
CREATE INDEX titulo_item_unidade ON titulo_item(organizacao_id,unidade_id,id);
CREATE TABLE caixa(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 descricao text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id)
);
CREATE INDEX caixa_unidade ON caixa(organizacao_id,unidade_id,id);
CREATE TABLE sessao_caixa(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 caixa_id uuid NOT NULL,aberta_em timestamptz NOT NULL,abertura valor_monetario NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,caixa_id) REFERENCES caixa(organizacao_id,unidade_id,id),
 CHECK(isfinite(aberta_em))
);
CREATE INDEX sessao_caixa_unidade ON sessao_caixa(organizacao_id,unidade_id,id);
CREATE TABLE fechamento_caixa(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 sessao_id uuid NOT NULL,fechada_em timestamptz NOT NULL,contado valor_monetario NOT NULL,esperado valor_monetario NOT NULL,diferenca numeric NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,sessao_id) REFERENCES sessao_caixa(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,sessao_id),CHECK(diferenca=contado-esperado)
);
CREATE INDEX fechamento_caixa_unidade ON fechamento_caixa(organizacao_id,unidade_id,id);
CREATE TABLE recebimento(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 pagador_id uuid NOT NULL,meio text NOT NULL CHECK(meio IN ('dinheiro','transferencia','cartao')),sessao_id uuid,referencia uuid NOT NULL,recebido_em timestamptz NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),evidencia text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,pagador_id) REFERENCES pagador(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,sessao_id) REFERENCES sessao_caixa(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,unidade_id,referencia),CHECK((meio='dinheiro')=(sessao_id IS NOT NULL)),CHECK(isfinite(recebido_em))
);
CREATE INDEX recebimento_unidade ON recebimento(organizacao_id,unidade_id,id);
CREATE TABLE liquidacao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 titulo_id uuid NOT NULL,recebimento_id uuid NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,titulo_id) REFERENCES titulo(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,recebimento_id) REFERENCES recebimento(organizacao_id,unidade_id,id)
);
CREATE INDEX liquidacao_unidade ON liquidacao(organizacao_id,unidade_id,id);
CREATE TABLE credito_cliente(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 pagador_id uuid NOT NULL,recebimento_id uuid NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,pagador_id) REFERENCES pagador(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,recebimento_id) REFERENCES recebimento(organizacao_id,unidade_id,id)
);
CREATE INDEX credito_cliente_unidade ON credito_cliente(organizacao_id,unidade_id,id);
CREATE TABLE aplicacao_credito(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 credito_id uuid NOT NULL,titulo_id uuid NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,credito_id) REFERENCES credito_cliente(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,titulo_id) REFERENCES titulo(organizacao_id,unidade_id,id)
);
CREATE INDEX aplicacao_credito_unidade ON aplicacao_credito(organizacao_id,unidade_id,id);
CREATE TABLE parcela_adquirente(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 recebimento_id uuid NOT NULL,numero integer NOT NULL CHECK(numero>0),adquirente text NOT NULL,referencia text NOT NULL,repasse_previsto date NOT NULL,bruto valor_monetario NOT NULL CHECK(bruto>0),taxa valor_monetario NOT NULL,liquido valor_monetario NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,recebimento_id) REFERENCES recebimento(organizacao_id,unidade_id,id),
 CHECK(bruto=taxa+liquido),UNIQUE(organizacao_id,recebimento_id,numero),UNIQUE(organizacao_id,unidade_id,adquirente,referencia)
);
CREATE INDEX parcela_adquirente_unidade ON parcela_adquirente(organizacao_id,unidade_id,id);
CREATE TABLE conta_financeira(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 descricao text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id)
);
CREATE INDEX conta_financeira_unidade ON conta_financeira(organizacao_id,unidade_id,id);
CREATE TABLE deposito_adquirente(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 conta_financeira_id uuid NOT NULL,adquirente text NOT NULL,referencia text NOT NULL,depositado_em timestamptz NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),evidencia text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,conta_financeira_id) REFERENCES conta_financeira(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,unidade_id,conta_financeira_id,adquirente,referencia)
);
CREATE INDEX deposito_adquirente_unidade ON deposito_adquirente(organizacao_id,unidade_id,id);
CREATE TABLE alocacao_deposito(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 deposito_id uuid NOT NULL,parcela_id uuid NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,deposito_id) REFERENCES deposito_adquirente(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,parcela_id) REFERENCES parcela_adquirente(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,deposito_id,parcela_id)
);
CREATE INDEX alocacao_deposito_unidade ON alocacao_deposito(organizacao_id,unidade_id,id);
CREATE TABLE item_extrato(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 conta_financeira_id uuid NOT NULL,referencia text NOT NULL,ocorrido_em timestamptz NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),evidencia text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,conta_financeira_id) REFERENCES conta_financeira(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,conta_financeira_id,referencia)
);
CREATE INDEX item_extrato_unidade ON item_extrato(organizacao_id,unidade_id,id);
CREATE TABLE vinculo_conciliacao(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 deposito_id uuid NOT NULL,extrato_id uuid NOT NULL,valor valor_monetario NOT NULL CHECK(valor>0),evidencia text NOT NULL,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,deposito_id) REFERENCES deposito_adquirente(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,extrato_id) REFERENCES item_extrato(organizacao_id,unidade_id,id),
 UNIQUE(organizacao_id,deposito_id,extrato_id)
);
CREATE INDEX vinculo_conciliacao_unidade ON vinculo_conciliacao(organizacao_id,unidade_id,id);
CREATE TABLE reversao_financeira(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL,criada_em timestamptz NOT NULL DEFAULT now(),
 item_conta_id uuid,titulo_id uuid,recebimento_id uuid,liquidacao_id uuid,credito_id uuid,aplicacao_id uuid,alocacao_deposito_id uuid,conciliacao_id uuid,
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),
 FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,item_conta_id) REFERENCES item_conta(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,titulo_id) REFERENCES titulo(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,recebimento_id) REFERENCES recebimento(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,liquidacao_id) REFERENCES liquidacao(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,credito_id) REFERENCES credito_cliente(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,aplicacao_id) REFERENCES aplicacao_credito(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,alocacao_deposito_id) REFERENCES alocacao_deposito(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,conciliacao_id) REFERENCES vinculo_conciliacao(organizacao_id,unidade_id,id),
 CHECK(num_nonnulls(item_conta_id,titulo_id,recebimento_id,liquidacao_id,credito_id,aplicacao_id,alocacao_deposito_id,conciliacao_id)=1)
);
CREATE INDEX reversao_financeira_unidade ON reversao_financeira(organizacao_id,unidade_id,id);
CREATE UNIQUE INDEX reversao_financeira_item_conta_id ON reversao_financeira(organizacao_id,item_conta_id) WHERE item_conta_id IS NOT NULL;
CREATE UNIQUE INDEX reversao_financeira_titulo_id ON reversao_financeira(organizacao_id,titulo_id) WHERE titulo_id IS NOT NULL;
CREATE UNIQUE INDEX reversao_financeira_recebimento_id ON reversao_financeira(organizacao_id,recebimento_id) WHERE recebimento_id IS NOT NULL;
CREATE UNIQUE INDEX reversao_financeira_liquidacao_id ON reversao_financeira(organizacao_id,liquidacao_id) WHERE liquidacao_id IS NOT NULL;
CREATE UNIQUE INDEX reversao_financeira_credito_id ON reversao_financeira(organizacao_id,credito_id) WHERE credito_id IS NOT NULL;
CREATE UNIQUE INDEX reversao_financeira_aplicacao_id ON reversao_financeira(organizacao_id,aplicacao_id) WHERE aplicacao_id IS NOT NULL;
CREATE UNIQUE INDEX reversao_financeira_alocacao_deposito_id ON reversao_financeira(organizacao_id,alocacao_deposito_id) WHERE alocacao_deposito_id IS NOT NULL;
CREATE UNIQUE INDEX reversao_financeira_conciliacao_id ON reversao_financeira(organizacao_id,conciliacao_id) WHERE conciliacao_id IS NOT NULL;
CREATE FUNCTION proteger_financeiro() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 PERFORM 1 FROM unidade_hospitalar WHERE organizacao_id=NEW.organizacao_id AND id=NEW.unidade_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM comando WHERE organizacao_id=NEW.organizacao_id AND id=NEW.comando_id AND autor_id=NEW.autor_id AND concluido_em IS NULL) THEN RAISE EXCEPTION 'Comando financeiro ausente ou concluido' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION proteger_financeiro() FROM PUBLIC;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['pagador','item_comercial_versao','preco_versao','conta','evento_cobravel','avaliacao_cobranca','item_conta','responsabilidade','titulo','titulo_item','caixa','sessao_caixa','fechamento_caixa','recebimento','liquidacao','credito_cliente','aplicacao_credito','parcela_adquirente','conta_financeira','deposito_adquirente','alocacao_deposito','item_extrato','vinculo_conciliacao','reversao_financeira'] LOOP
 EXECUTE format('ALTER TABLE hvb.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE hvb.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant ON hvb.%I USING(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid) WITH CHECK(organizacao_id=nullif(current_setting(''hvb.org'',true),'''')::uuid)',t);
 EXECUTE format('GRANT INSERT ON hvb.%I TO hvb_app',t);
 EXECUTE format('CREATE TRIGGER a_proteger BEFORE INSERT ON hvb.%I FOR EACH ROW EXECUTE FUNCTION proteger_financeiro()',t);
 EXECUTE format('CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON hvb.%I FOR EACH ROW EXECUTE FUNCTION impedir_alteracao()',t);
 END LOOP;END $$;
INSERT INTO permissao VALUES('financeiro:ler'),('financeiro:configurar'),('financeiro:avaliar'),('financeiro:emitir'),('financeiro:receber'),('financeiro:alocar'),('financeiro:credito'),('financeiro:caixa'),('financeiro:conciliar'),('financeiro:reverter');
