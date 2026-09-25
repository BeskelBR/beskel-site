-- 086_restrict_rls_auto_enable_execute.sql
-- Remove exposicao RPC desnecessaria da funcao de event trigger de RLS.
-- Preserva o event trigger ensure_rls e seu comportamento automatico.

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
FROM PUBLIC, anon, authenticated, service_role;
