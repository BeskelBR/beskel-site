# Frontend MVP — HVB Sistema

## Objetivo

Criar a camada visual do **HVB Sistema** sem antecipar regras operacionais ainda pendentes de validação hospitalar.

O acesso institucional parte da página pública **Área do colaborador** (`/colaborador`) no branch `hvb-site-dev`, que encaminha o colaborador autorizado para o ambiente operacional do sistema em `hvb-sistema-dev.beskel.com.br` durante a implantação.

O endereço `hvb-dev.beskel.com.br` permanece reservado ao **Terminal HVB** e não deve ser usado como destino do sistema interno.

## Escopo entregue — MVP 3

### Base do sistema

- tela de acesso restrito;
- uso da credencial opaca já existente no backend DEV;
- token mantido apenas em `sessionStorage`;
- dashboard inicial;
- navegação responsiva por módulos;
- status de `/health` e `/ready`;
- contexto de `/v1/me`, organização e unidade disponível;
- configuração manual de unidade apenas como contingência DEV;
- bloqueio de indexação do ambiente DEV.

### Consultas por módulo

- abas de consulta por módulo;
- filtro local de resultados;
- paginação por `next_cursor`;
- estados explícitos de permissão, ausência de registros, sessão inválida e falha de integração;
- primeiras visões conectadas para Pacientes, Agenda, Internação, Prontuário, Estoque, Exames, Financeiro, Compras, Documentos, Preventivo e Administração.

### Jornada clínica contextual

O MVP 3 inicia a transição de uma interface orientada por tabelas para uma interface orientada por **jornadas de trabalho**.

A Visão geral agora permite:

- localizar paciente por nome, espécie ou identificador;
- abrir um contexto longitudinal sem abandonar o dashboard;
- visualizar dados básicos e estado do paciente;
- consultar episódios da unidade ativa;
- consultar evoluções de prontuário disponíveis à credencial;
- resumir adesões preventivas e solicitações documentais;
- selecionar um episódio e consultar, no mesmo contexto:
  - programações clínicas;
  - execuções clínicas;
  - solicitações de exames;
  - contas associadas ao episódio.

O painel clínico respeita as permissões do backend. Um `403` é apresentado como área não liberada, sem transformar ausência de permissão em falha genérica.

A autenticação operacional definitiva ainda **não** foi criada. O formulário atual representa somente a credencial opaca já suportada pelo backend.

## Princípios do frontend

1. Expor somente capacidades que já existam no backend.
2. Não transformar pendências operacionais em regras definitivas de interface.
3. Tratar `403` como ausência de permissão, e não como erro genérico.
4. Manter ações de escrita fora do MVP até que o fluxo e a matriz de cargos sejam validados.
5. Separar claramente o **Sistema HVB** do **Terminal HVB**.
6. Resolver contexto de unidade e permissões no backend antes da produção; o campo manual atual é apenas suporte DEV.
7. Priorizar jornadas operacionais sobre simples exposição de tabelas.
8. Manter o paciente e o episódio como contexto quando uma rotina depender deles.

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

A próxima camada deve aprofundar as jornadas já iniciadas:

- agenda diária por recurso e profissional;
- contexto de internação com ocupação e passagem de plantão;
- fila operacional de exames;
- estoque por produto/local com contexto do Terminal HVB;
- financeiro orientado a títulos, recebimentos e conciliação;
- compras orientadas a pedido, decisão e recebimento;
- filtros contextuais por paciente/episódio dentro dos módulos;
- ações de escrita condicionadas à matriz de cargos validada.

As ações de criação, alteração, aprovação, baixa e reversão devem ser adicionadas somente após a validação da matriz de cargos e dos fluxos executivos com o HVB.
