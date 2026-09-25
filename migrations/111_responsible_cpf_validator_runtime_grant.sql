-- 111_responsible_cpf_validator_runtime_grant.sql
SET search_path=hvb,public;

GRANT EXECUTE ON FUNCTION hvb.cpf_valido(text) TO hvb_app;
