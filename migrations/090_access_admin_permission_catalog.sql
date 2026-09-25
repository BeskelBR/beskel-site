-- 090_access_admin_permission_catalog.sql
-- Canonicaliza a permissao exigida pelos contratos de administracao de acesso.
-- Nao cria papeis nem atribuicoes; apenas garante o codigo no catalogo global.

INSERT INTO hvb.permissao(codigo)
VALUES ('acesso:administrar')
ON CONFLICT (codigo) DO NOTHING;
