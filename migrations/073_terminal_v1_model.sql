-- Delta N1 C18: additive Terminal v1; 001–072 remain immutable.
SET search_path=hvb,public;

CREATE TABLE tv1_room(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),local_id uuid NOT NULL,transit_local_id uuid NOT NULL,unlock_seconds integer NOT NULL CHECK(unlock_seconds BETWEEN 1 AND 60),session_seconds integer NOT NULL CHECK(session_seconds BETWEEN 60 AND 3600),CHECK(local_id<>transit_local_id),UNIQUE(organizacao_id,local_id),FOREIGN KEY(organizacao_id,unidade_id,local_id) REFERENCES local(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,transit_local_id) REFERENCES local(organizacao_id,unidade_id,id));
ALTER TABLE tv1_room ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_room FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_room USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_room TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_room FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_room_unit ON tv1_room(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_room FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_device(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),room_id uuid NOT NULL,device_id uuid NOT NULL,credential_id uuid NOT NULL,role text NOT NULL CHECK(role IN ('ACCESS','BIOMETRIC','PICKING','CONTROLLER')),mode text NOT NULL CHECK(mode='SIMULADO_DEV'),UNIQUE(organizacao_id,device_id),UNIQUE(organizacao_id,credential_id),UNIQUE(organizacao_id,room_id,role),FOREIGN KEY(organizacao_id,unidade_id,room_id) REFERENCES tv1_room(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,device_id) REFERENCES dispositivo(organizacao_id,id),FOREIGN KEY(organizacao_id,credential_id) REFERENCES credencial(organizacao_id,id));
ALTER TABLE tv1_device ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_device FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_device USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_device TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_device FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_device_unit ON tv1_device(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_device FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_nfc(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),employee_id uuid NOT NULL,tag_digest text NOT NULL CHECK(length(tag_digest)=64),UNIQUE(organizacao_id,tag_digest),FOREIGN KEY(organizacao_id,employee_id) REFERENCES usuario(organizacao_id,id));
ALTER TABLE tv1_nfc ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_nfc FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_nfc USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_nfc TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_nfc FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_nfc_unit ON tv1_nfc(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_nfc FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_nfc_revocation(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),nfc_id uuid NOT NULL,UNIQUE(organizacao_id,nfc_id),FOREIGN KEY(organizacao_id,unidade_id,nfc_id) REFERENCES tv1_nfc(organizacao_id,unidade_id,id));
ALTER TABLE tv1_nfc_revocation ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_nfc_revocation FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_nfc_revocation USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_nfc_revocation TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_nfc_revocation FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_nfc_revocation_unit ON tv1_nfc_revocation(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_nfc_revocation FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_product_policy(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),product_id uuid NOT NULL,sensitive boolean NOT NULL,UNIQUE(organizacao_id,product_id),FOREIGN KEY(organizacao_id,product_id) REFERENCES produto(organizacao_id,id));
ALTER TABLE tv1_product_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_product_policy FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_product_policy USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_product_policy TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_product_policy FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_product_policy_unit ON tv1_product_policy(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_product_policy FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_coordinate(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),room_id uuid NOT NULL,local_id uuid NOT NULL,code text NOT NULL CHECK(length(code) BETWEEN 1 AND 80),sensitive boolean NOT NULL,UNIQUE(organizacao_id,room_id,code),UNIQUE(organizacao_id,local_id),FOREIGN KEY(organizacao_id,unidade_id,room_id) REFERENCES tv1_room(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,local_id) REFERENCES local(organizacao_id,unidade_id,id));
ALTER TABLE tv1_coordinate ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_coordinate FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_coordinate USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_coordinate TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_coordinate FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_coordinate_unit ON tv1_coordinate(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_coordinate FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_occupancy(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),coordinate_id uuid NOT NULL,position_id uuid NOT NULL,received_at timestamptz NOT NULL,released_at timestamptz,FOREIGN KEY(organizacao_id,unidade_id,coordinate_id) REFERENCES tv1_coordinate(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,position_id) REFERENCES posicao_estoque(organizacao_id,unidade_id,id));
ALTER TABLE tv1_occupancy ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_occupancy FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_occupancy USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_occupancy TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_occupancy FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_occupancy_unit ON tv1_occupancy(organizacao_id,unidade_id,id);

CREATE TABLE tv1_challenge(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),room_id uuid NOT NULL,nfc_id uuid NOT NULL,employee_id uuid NOT NULL,access_terminal_device_id uuid NOT NULL,nonce uuid NOT NULL UNIQUE,expires_at timestamptz NOT NULL,FOREIGN KEY(organizacao_id,unidade_id,room_id) REFERENCES tv1_room(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,nfc_id) REFERENCES tv1_nfc(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,employee_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,access_terminal_device_id) REFERENCES dispositivo(organizacao_id,id));
ALTER TABLE tv1_challenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_challenge FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_challenge USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_challenge TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_challenge FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_challenge_unit ON tv1_challenge(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_challenge FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_auth(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),challenge_id uuid NOT NULL,employee_id uuid NOT NULL,room_id uuid NOT NULL,access_terminal_device_id uuid NOT NULL,biometric_device_id uuid NOT NULL,evidence_digest text NOT NULL CHECK(length(evidence_digest)=64),captured_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,UNIQUE(organizacao_id,challenge_id),UNIQUE(organizacao_id,evidence_digest),CHECK(access_terminal_device_id<>biometric_device_id),FOREIGN KEY(organizacao_id,unidade_id,challenge_id) REFERENCES tv1_challenge(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,employee_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,unidade_id,room_id) REFERENCES tv1_room(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,access_terminal_device_id) REFERENCES dispositivo(organizacao_id,id),FOREIGN KEY(organizacao_id,biometric_device_id) REFERENCES dispositivo(organizacao_id,id));
ALTER TABLE tv1_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_auth FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_auth USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_auth TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_auth FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_auth_unit ON tv1_auth(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_auth FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_order(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),episode_id uuid NOT NULL,FOREIGN KEY(organizacao_id,unidade_id,episode_id) REFERENCES episodio(organizacao_id,unidade_id,id));
ALTER TABLE tv1_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_order FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_order USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_order TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_order FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_order_unit ON tv1_order(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_order FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_order_item(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),order_id uuid NOT NULL,product_id uuid NOT NULL,quantity quantidade_exata NOT NULL CHECK(quantity>0),clinical_order_version_id uuid,program_id uuid,FOREIGN KEY(organizacao_id,unidade_id,order_id) REFERENCES tv1_order(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,product_id) REFERENCES produto(organizacao_id,id),FOREIGN KEY(organizacao_id,unidade_id,clinical_order_version_id) REFERENCES ordem_versao(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,program_id) REFERENCES programacao(organizacao_id,unidade_id,id));
ALTER TABLE tv1_order_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_order_item FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_order_item USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_order_item TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_order_item FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_order_item_unit ON tv1_order_item(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_order_item FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_context(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),auth_session_id uuid NOT NULL,room_id uuid NOT NULL,employee_id uuid NOT NULL,UNIQUE(organizacao_id,auth_session_id),FOREIGN KEY(organizacao_id,unidade_id,auth_session_id) REFERENCES tv1_auth(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,room_id) REFERENCES tv1_room(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,employee_id) REFERENCES usuario(organizacao_id,id));
ALTER TABLE tv1_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_context FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_context USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_context TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_context FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_context_unit ON tv1_context(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_context FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_context_order(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),context_id uuid NOT NULL,order_id uuid NOT NULL,UNIQUE(organizacao_id,context_id,order_id),FOREIGN KEY(organizacao_id,unidade_id,context_id) REFERENCES tv1_context(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,order_id) REFERENCES tv1_order(organizacao_id,unidade_id,id));
ALTER TABLE tv1_context_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_context_order FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_context_order USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_context_order TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_context_order FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_context_order_unit ON tv1_context_order(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_context_order FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_demand(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),context_id uuid NOT NULL,order_item_id uuid,product_id uuid NOT NULL,quantity quantidade_exata NOT NULL CHECK(quantity>0),source_rank integer NOT NULL CHECK(source_rank>0),UNIQUE(organizacao_id,context_id,source_rank),FOREIGN KEY(organizacao_id,unidade_id,context_id) REFERENCES tv1_context(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,order_item_id) REFERENCES tv1_order_item(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,product_id) REFERENCES produto(organizacao_id,id));
ALTER TABLE tv1_demand ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_demand FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_demand USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_demand TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_demand FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_demand_unit ON tv1_demand(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_demand FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_session(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),context_id uuid NOT NULL,auth_session_id uuid NOT NULL,room_id uuid NOT NULL,employee_id uuid NOT NULL,access_terminal_device_id uuid NOT NULL,picking_display_device_id uuid NOT NULL,expires_at timestamptz NOT NULL,state text NOT NULL CHECK(state IN ('DOOR_AUTHORIZED','DOOR_OPEN','ENTRY_CONFIRMED','PICKING_READY','EXIT_CONFIRMED','READY_TO_CONFIRM','CLOSED','EXPIRED')),sensitive_access_eligible boolean NOT NULL,sensitive_state text NOT NULL CHECK(sensitive_state IN ('LOCKED','GRANTED','OPEN','DOOR_CLOSED','COMPLETED')),unlock_until timestamptz,timeout_alerted_at timestamptz,entered_at timestamptz,presence_cleared_at timestamptz,door_closed_at timestamptz,closed_at timestamptz,UNIQUE(organizacao_id,context_id),UNIQUE(organizacao_id,auth_session_id),CHECK((state IN ('CLOSED','EXPIRED'))=(closed_at IS NOT NULL)),CHECK(access_terminal_device_id<>picking_display_device_id),FOREIGN KEY(organizacao_id,unidade_id,context_id) REFERENCES tv1_context(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,auth_session_id) REFERENCES tv1_auth(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,room_id) REFERENCES tv1_room(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,employee_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,access_terminal_device_id) REFERENCES dispositivo(organizacao_id,id),FOREIGN KEY(organizacao_id,picking_display_device_id) REFERENCES dispositivo(organizacao_id,id));
ALTER TABLE tv1_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_session FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_session USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_session TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_session FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_session_unit ON tv1_session(organizacao_id,unidade_id,id);

CREATE TABLE tv1_task(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),access_session_id uuid NOT NULL,product_id uuid NOT NULL,quantity quantidade_exata NOT NULL CHECK(quantity>0),allocation_rank integer NOT NULL CHECK(allocation_rank>0),allocation_strategy text NOT NULL DEFAULT 'FEFO_FIFO' CHECK(allocation_strategy='FEFO_FIFO'),sensitive boolean NOT NULL,status text NOT NULL CHECK(status IN ('PENDING','EXCEPTION','CONFIRMED','PARTIAL','UNAVAILABLE')),confirmed_quantity quantidade_exata NOT NULL DEFAULT 0 CHECK(confirmed_quantity>=0 AND confirmed_quantity<=quantity),UNIQUE(organizacao_id,access_session_id,allocation_rank),CHECK((status='CONFIRMED' AND confirmed_quantity=quantity) OR (status='PARTIAL' AND confirmed_quantity>0 AND confirmed_quantity<quantity) OR (status IN ('PENDING','EXCEPTION','UNAVAILABLE') AND confirmed_quantity=0)),FOREIGN KEY(organizacao_id,unidade_id,access_session_id) REFERENCES tv1_session(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,product_id) REFERENCES produto(organizacao_id,id));
ALTER TABLE tv1_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_task FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_task USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_task TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_task FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_task_unit ON tv1_task(organizacao_id,unidade_id,id);

CREATE TABLE tv1_source(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),task_id uuid NOT NULL,demand_id uuid NOT NULL,quantity quantidade_exata NOT NULL CHECK(quantity>0),source_rank integer NOT NULL CHECK(source_rank>0),UNIQUE(organizacao_id,task_id,demand_id),FOREIGN KEY(organizacao_id,unidade_id,task_id) REFERENCES tv1_task(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,demand_id) REFERENCES tv1_demand(organizacao_id,unidade_id,id));
ALTER TABLE tv1_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_source FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_source USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_source TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_source FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_source_unit ON tv1_source(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_source FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_attempt(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),task_id uuid NOT NULL,occupancy_id uuid NOT NULL,reservation_id uuid NOT NULL,quantity quantidade_exata NOT NULL CHECK(quantity>0),attempt_rank integer NOT NULL CHECK(attempt_rank>0),UNIQUE(organizacao_id,task_id,attempt_rank),UNIQUE(organizacao_id,reservation_id),FOREIGN KEY(organizacao_id,unidade_id,task_id) REFERENCES tv1_task(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,occupancy_id) REFERENCES tv1_occupancy(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,reservation_id) REFERENCES reserva(organizacao_id,unidade_id,id));
ALTER TABLE tv1_attempt ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_attempt FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_attempt USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_attempt TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_attempt FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_attempt_unit ON tv1_attempt(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_attempt FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_discrepancy(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),task_id uuid NOT NULL,attempt_id uuid NOT NULL,UNIQUE(organizacao_id,attempt_id),FOREIGN KEY(organizacao_id,unidade_id,task_id) REFERENCES tv1_task(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,attempt_id) REFERENCES tv1_attempt(organizacao_id,unidade_id,id));
ALTER TABLE tv1_discrepancy ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_discrepancy FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_discrepancy USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_discrepancy TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_discrepancy FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_discrepancy_unit ON tv1_discrepancy(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_discrepancy FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_event(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),access_session_id uuid,challenge_id uuid,auth_session_id uuid,context_id uuid,task_id uuid,type text NOT NULL CHECK(length(type) BETWEEN 1 AND 80),source_device_id uuid,event_id uuid NOT NULL,idempotency_key text NOT NULL,occurred_at timestamptz NOT NULL,payload_digest text NOT NULL CHECK(length(payload_digest)=64),automatic boolean NOT NULL,error_code text,CHECK(num_nonnulls(access_session_id,challenge_id,auth_session_id,context_id)>=1),UNIQUE(organizacao_id,event_id),FOREIGN KEY(organizacao_id,unidade_id,access_session_id) REFERENCES tv1_session(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,challenge_id) REFERENCES tv1_challenge(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,auth_session_id) REFERENCES tv1_auth(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,context_id) REFERENCES tv1_context(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,task_id) REFERENCES tv1_task(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,source_device_id) REFERENCES dispositivo(organizacao_id,id));
ALTER TABLE tv1_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_event FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_event USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_event TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_event FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_event_unit ON tv1_event(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_event FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_movement(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),task_id uuid NOT NULL,attempt_id uuid NOT NULL,transaction_id uuid NOT NULL,UNIQUE(organizacao_id,task_id),UNIQUE(organizacao_id,transaction_id),FOREIGN KEY(organizacao_id,unidade_id,task_id) REFERENCES tv1_task(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,attempt_id) REFERENCES tv1_attempt(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,transaction_id) REFERENCES transacao_estoque(organizacao_id,unidade_id,id));
ALTER TABLE tv1_movement ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_movement FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_movement USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_movement TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_movement FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_movement_unit ON tv1_movement(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_movement FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TABLE tv1_fulfillment(id uuid PRIMARY KEY,organizacao_id uuid NOT NULL,unidade_id uuid NOT NULL,autor_id uuid NOT NULL,comando_id uuid NOT NULL,motivo text NOT NULL CHECK(length(motivo) BETWEEN 1 AND 160),criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(organizacao_id,id),UNIQUE(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id) REFERENCES unidade_hospitalar(organizacao_id,id),FOREIGN KEY(organizacao_id,autor_id) REFERENCES usuario(organizacao_id,id),FOREIGN KEY(organizacao_id,comando_id) REFERENCES comando(organizacao_id,id),access_session_id uuid NOT NULL,demand_id uuid NOT NULL,requested_quantity quantidade_exata NOT NULL CHECK(requested_quantity>0),confirmed_quantity quantidade_exata NOT NULL CHECK(confirmed_quantity>=0 AND confirmed_quantity<=requested_quantity),status text NOT NULL CHECK(status IN ('COMPLETE','PARTIAL','UNAVAILABLE')),UNIQUE(organizacao_id,demand_id),CHECK((status='COMPLETE' AND confirmed_quantity=requested_quantity) OR (status='PARTIAL' AND confirmed_quantity>0 AND confirmed_quantity<requested_quantity) OR (status='UNAVAILABLE' AND confirmed_quantity=0)),FOREIGN KEY(organizacao_id,unidade_id,access_session_id) REFERENCES tv1_session(organizacao_id,unidade_id,id),FOREIGN KEY(organizacao_id,unidade_id,demand_id) REFERENCES tv1_demand(organizacao_id,unidade_id,id));
ALTER TABLE tv1_fulfillment ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv1_fulfillment FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON tv1_fulfillment USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid) WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
GRANT INSERT ON tv1_fulfillment TO hvb_app;
CREATE TRIGGER a_comando BEFORE INSERT ON tv1_fulfillment FOR EACH ROW EXECUTE FUNCTION proteger_registro_exame();
CREATE INDEX tv1_fulfillment_unit ON tv1_fulfillment(organizacao_id,unidade_id,id);
CREATE TRIGGER imutavel BEFORE UPDATE OR DELETE ON tv1_fulfillment FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE UNIQUE INDEX tv1_room_active ON tv1_session(organizacao_id,room_id) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX tv1_coordinate_active ON tv1_occupancy(organizacao_id,coordinate_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX tv1_position_active ON tv1_occupancy(organizacao_id,position_id) WHERE released_at IS NULL;
CREATE INDEX tv1_events_session ON tv1_event(organizacao_id,access_session_id,criada_em,id);
CREATE INDEX tv1_demands_context ON tv1_demand(organizacao_id,context_id,source_rank);
CREATE INDEX tv1_sources_demand ON tv1_source(organizacao_id,demand_id);
CREATE INDEX tv1_context_order_order ON tv1_context_order(organizacao_id,order_id);
GRANT UPDATE(state,sensitive_state,unlock_until,timeout_alerted_at,entered_at,presence_cleared_at,door_closed_at,closed_at) ON tv1_session TO hvb_app;
GRANT UPDATE(status,confirmed_quantity) ON tv1_task TO hvb_app;
GRANT UPDATE(released_at) ON tv1_occupancy TO hvb_app;
CREATE VIEW tv1_order_status WITH(security_invoker=true) AS
SELECT o.*,CASE WHEN count(f.id)=count(i.id) THEN CASE WHEN bool_and(f.status='COMPLETE') THEN 'RETIRADA_CONFIRMADA' WHEN sum(f.confirmed_quantity)>0 THEN 'RETIRADA_PARCIAL' ELSE 'RETIRADA_NAO_ATENDIDA' END
WHEN EXISTS(SELECT 1 FROM tv1_context_order co JOIN tv1_session s ON (s.organizacao_id,s.context_id)=(co.organizacao_id,co.context_id) WHERE co.organizacao_id=o.organizacao_id AND co.order_id=o.id AND s.state<>'EXPIRED') THEN 'EM_SEPARACAO' ELSE 'AGUARDANDO_RETIRADA' END AS state
FROM tv1_order o JOIN tv1_order_item i ON (i.organizacao_id,i.order_id)=(o.organizacao_id,o.id)
LEFT JOIN tv1_demand d ON (d.organizacao_id,d.order_item_id)=(i.organizacao_id,i.id)
LEFT JOIN tv1_fulfillment f ON (f.organizacao_id,f.demand_id)=(d.organizacao_id,d.id)
GROUP BY o.id;
