SET search_path=hvb,public;
CREATE TABLE revisao_deposito_adquirente(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,deposito_id uuid NOT NULL,substituta_id uuid,
 tipo text NOT NULL CHECK(tipo IN ('correcao','cancelamento')),autor_id uuid NOT NULL,comando_id uuid NOT NULL,
 motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((tipo='correcao')=(substituta_id IS NOT NULL)),CHECK(deposito_id IS DISTINCT FROM substituta_id),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,deposito_id),UNIQUE(organizacao_id,substituta_id),
 FOREIGN KEY(organizacao_id,unidade_id,deposito_id) REFERENCES deposito_adquirente(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,substituta_id) REFERENCES deposito_adquirente(organizacao_id,unidade_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id)
);
ALTER TABLE revisao_deposito_adquirente ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisao_deposito_adquirente FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON revisao_deposito_adquirente USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON revisao_deposito_adquirente TO hvb_app;
CREATE TRIGGER a_proteger BEFORE INSERT ON revisao_deposito_adquirente FOR EACH ROW EXECUTE FUNCTION proteger_financeiro();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON revisao_deposito_adquirente FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
CREATE TABLE revisao_item_extrato(
 id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,extrato_id uuid NOT NULL,substituta_id uuid,
 tipo text NOT NULL CHECK(tipo IN ('correcao','cancelamento')),autor_id uuid NOT NULL,comando_id uuid NOT NULL,
 motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((tipo='correcao')=(substituta_id IS NOT NULL)),CHECK(extrato_id IS DISTINCT FROM substituta_id),
 UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,extrato_id),UNIQUE(organizacao_id,substituta_id),
 FOREIGN KEY(organizacao_id,unidade_id,extrato_id) REFERENCES item_extrato(organizacao_id,unidade_id,id),
 FOREIGN KEY(organizacao_id,unidade_id,substituta_id) REFERENCES item_extrato(organizacao_id,unidade_id,id) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id)
);
ALTER TABLE revisao_item_extrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisao_item_extrato FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON revisao_item_extrato USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON revisao_item_extrato TO hvb_app;
CREATE TRIGGER a_proteger BEFORE INSERT ON revisao_item_extrato FOR EACH ROW EXECUTE FUNCTION proteger_financeiro();
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON revisao_item_extrato FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
ALTER TABLE alocacao_deposito ADD COLUMN anterior_id uuid;
ALTER TABLE alocacao_deposito ADD FOREIGN KEY(organizacao_id,unidade_id,anterior_id) REFERENCES alocacao_deposito(organizacao_id,unidade_id,id);
ALTER TABLE alocacao_deposito ADD UNIQUE(organizacao_id,anterior_id);
ALTER TABLE alocacao_deposito ADD CHECK(anterior_id IS DISTINCT FROM id);
ALTER TABLE vinculo_conciliacao ADD COLUMN anterior_id uuid;
ALTER TABLE vinculo_conciliacao ADD FOREIGN KEY(organizacao_id,unidade_id,anterior_id) REFERENCES vinculo_conciliacao(organizacao_id,unidade_id,id);
ALTER TABLE vinculo_conciliacao ADD UNIQUE(organizacao_id,anterior_id);
ALTER TABLE vinculo_conciliacao ADD CHECK(anterior_id IS DISTINCT FROM id);
CREATE OR REPLACE VIEW deposito_consulta WITH(security_invoker=true) AS SELECT d.*,
 CASE WHEN r.id IS NOT NULL THEN 0.00::numeric ELSE d.valor-coalesce((SELECT sum(a.valor) FROM alocacao_deposito_ativa a WHERE a.organizacao_id=d.organizacao_id AND a.deposito_id=d.id),0) END AS nao_alocado,
 CASE WHEN r.id IS NOT NULL THEN 0.00::numeric ELSE d.valor-coalesce((SELECT sum(c.valor) FROM conciliacao_ativa c WHERE c.organizacao_id=d.organizacao_id AND c.deposito_id=d.id),0) END AS nao_conciliado,
 r.id AS revisao_id,r.substituta_id,coalesce(r.tipo,'vigente') AS situacao
 FROM deposito_adquirente d LEFT JOIN revisao_deposito_adquirente r ON r.organizacao_id=d.organizacao_id AND r.deposito_id=d.id;
CREATE OR REPLACE VIEW extrato_consulta WITH(security_invoker=true) AS SELECT e.*,
 CASE WHEN r.id IS NOT NULL THEN 0.00::numeric ELSE e.valor-coalesce((SELECT sum(c.valor) FROM conciliacao_ativa c WHERE c.organizacao_id=e.organizacao_id AND c.extrato_id=e.id),0) END AS nao_conciliado,
 r.id AS revisao_id,r.substituta_id,coalesce(r.tipo,'vigente') AS situacao
 FROM item_extrato e LEFT JOIN revisao_item_extrato r ON r.organizacao_id=e.organizacao_id AND r.extrato_id=e.id;
CREATE VIEW alocacao_deposito_consulta WITH(security_invoker=true) AS SELECT a.*,EXISTS(SELECT 1 FROM reversao_financeira r WHERE r.organizacao_id=a.organizacao_id AND r.alocacao_deposito_id=a.id) AS revertido FROM alocacao_deposito a;
CREATE VIEW vinculo_conciliacao_consulta WITH(security_invoker=true) AS SELECT c.*,EXISTS(SELECT 1 FROM reversao_financeira r WHERE r.organizacao_id=c.organizacao_id AND r.conciliacao_id=c.id) AS revertido FROM vinculo_conciliacao c;
