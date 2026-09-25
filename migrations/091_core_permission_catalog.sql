-- 091_core_permission_catalog.sql
-- Canonicaliza permissoes core ja exigidas pelo backend publicado.
-- Nao cria papeis nem atribuicoes e nao amplia acesso por si so.

INSERT INTO hvb.permissao(codigo)
VALUES
  ('auditoria:ler'),
  ('cadastros:escrever'),
  ('cadastros:ler'),
  ('episodios:escrever'),
  ('episodios:ler'),
  ('locais:escrever'),
  ('locais:ler'),
  ('proveniencia:administrar')
ON CONFLICT (codigo) DO NOTHING;
