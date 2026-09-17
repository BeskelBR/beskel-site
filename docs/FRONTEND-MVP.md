# Frontend MVP — HVB Sistema

## Objetivo

Criar a primeira camada visual do **HVB Sistema** sem antecipar regras operacionais ainda pendentes de validação hospitalar.

O acesso institucional parte da página pública **Área do colaborador** (`/colaborador`) no branch `hvb-site-dev`, que encaminha o colaborador autorizado para o ambiente operacional do sistema.

## Escopo entregue

- tela de acesso restrito;
- uso da credencial opaca já existente no backend DEV;
- token mantido apenas em `sessionStorage`;
- dashboard inicial;
- navegação responsiva por módulos;
- status de `/health` e `/ready`;
- contexto de `/v1/me`, organização e unidade disponível;
- primeiras consultas genéricas para Pacientes, Agenda, Internação, Estoque, Exames, Financeiro e Administração;
- estados explícitos de permissão, ausência de registros ou interface ainda não conectada;
- bloqueio de indexação do ambiente DEV.

A autenticação operacional definitiva ainda **não** foi criada. O formulário atual representa somente a credencial opaca já suportada pelo backend.

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

Como o frontend DEV ainda usa `http://127.0.0.1:3100` como padrão local, expanda **Configuração técnica** na tela de login e defina temporariamente:

```text
http://127.0.0.1:3200
```

Assim, as chamadas passam pelo proxy local e chegam à API em `127.0.0.1:3100` sem depender de CORS.

Use somente as credenciais fictícias geradas pelo seed em `.local/dev-access.json`. Não publicar esse arquivo nem inserir dados hospitalares reais.

## Produção / deploy

O frontend está preparado como camada estática, mas o backend atual continua restrito a loopback, PostgreSQL local e ambiente DEV. Portanto, o deploy visual **não equivale a sistema operacional em produção**.

Antes de produção ainda serão necessários, entre outros:

1. autenticação operacional definitiva;
2. hospedagem adequada da API e PostgreSQL;
3. política de sessão/renovação;
4. matriz de cargos/permissões validada;
5. homologação dos fluxos hospitalares;
6. definição de domínio e reverse proxy/API;
7. testes de segurança, acessibilidade, responsividade e regressão;
8. política de logs, backup, contingência e observabilidade.

## Princípio de interface

O frontend deve expor somente capacidades suportadas pelo backend e regras já validadas. Não transformar placeholders, simulações ou pendências em comportamento hospitalar definitivo.
