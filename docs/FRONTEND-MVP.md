# Frontend MVP — HVB Sistema

## Objetivo

Criar a primeira camada visual do **HVB Sistema** sem antecipar regras operacionais ainda pendentes de validação hospitalar.

O acesso institucional parte da página pública **Área do colaborador** (`/colaborador`) no branch `hvb-site-dev`, que encaminha o colaborador autorizado para o ambiente operacional do sistema em `hvb-sistema-dev.beskel.com.br` durante a implantação.

O endereço `hvb-dev.beskel.com.br` permanece reservado ao **Terminal HVB** e não deve ser usado como destino do sistema interno.

## Escopo entregue — MVP 2

- tela de acesso restrito;
- uso da credencial opaca já existente no backend DEV;
- token mantido apenas em `sessionStorage`;
- dashboard inicial;
- navegação responsiva por módulos;
- status de `/health` e `/ready`;
- contexto de `/v1/me`, organização e unidade disponível;
- configuração manual de unidade apenas como contingência DEV;
- abas de consulta por módulo;
- filtro local de resultados;
- paginação por `next_cursor`;
- estados explícitos de permissão, ausência de registros, sessão inválida e falha de integração;
- primeiras visões conectadas para Pacientes, Agenda, Internação, Prontuário, Estoque, Exames, Financeiro, Compras, Documentos, Preventivo e Administração;
- bloqueio de indexação do ambiente DEV.

A autenticação operacional definitiva ainda **não** foi criada. O formulário atual representa somente a credencial opaca já suportada pelo backend.

## Princípios do frontend

1. Expor somente capacidades que já existam no backend.
2. Não transformar pendências operacionais em regras definitivas de interface.
3. Tratar `403` como ausência de permissão, e não como erro genérico.
4. Manter ações de escrita fora do MVP até que o fluxo e a matriz de cargos sejam validados.
5. Separar claramente o **Sistema HVB** do **Terminal HVB**.
6. Resolver contexto de unidade e permissões no backend antes da produção; o campo manual atual é apenas suporte DEV.

## Executar localmente

Com banco, migrações e seeds preparados conforme o README principal:

Terminal 1 — API:

```powershell
.\scripts\pnpm.ps1 dev
```

Terminal 2 — frontend e proxy local:

```powershell
.\scripts\pnpm.ps1 frontend
```

Abra:

```text
http://127.0.0.1:3200
```

O frontend local usa o próprio `location.origin` como base da API; o servidor de frontend encaminha `/health`, `/ready` e `/v1/*` para `127.0.0.1:3100`, evitando dependência de CORS no ciclo local.

Use somente as credenciais fictícias geradas pelo seed em `.local/dev-access.json`. Não publicar esse arquivo nem inserir dados hospitalares reais.

## Produção / deploy

O frontend está preparado como camada estática, mas o backend atual continua restrito a loopback, PostgreSQL local e ambiente DEV. Portanto, o deploy visual **não equivale a sistema operacional em produção**.

Antes de produção ainda serão necessários, entre outros:

1. autenticação operacional definitiva;
2. hospedagem adequada da API e PostgreSQL;
3. política de sessão/renovação;
4. resolução de unidade no contexto autenticado;
5. matriz de cargos/permissões validada;
6. homologação dos fluxos hospitalares;
7. definição de domínio e reverse proxy/API;
8. testes de segurança, acessibilidade, responsividade e regressão;
9. política de logs, backup, contingência e observabilidade.

## Próxima fase sugerida

A próxima camada deve priorizar **jornadas**, e não apenas novas tabelas:

- localizar paciente e abrir seu contexto;
- visualizar episódio/internação em andamento;
- agenda diária por recurso;
- visão de estoque por produto/local;
- fila operacional de exames;
- títulos e recebimentos do financeiro;
- pedidos e recebimentos de compras.

As ações de criação, alteração, aprovação e baixa devem ser adicionadas somente após a validação da matriz de cargos e dos fluxos executivos com o HVB.
