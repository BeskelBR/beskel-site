# Frontend MVP — HVB Sistema

## Objetivo

Criar a camada visual do **HVB Sistema** sem antecipar regras operacionais ainda pendentes de validação hospitalar.

O acesso institucional parte da página pública **Área do colaborador** (`/colaborador`) no branch `hvb-site-dev`, que encaminha o colaborador autorizado para o ambiente operacional do sistema em `hvb-sistema-dev.beskel.com.br` durante a implantação.

O endereço `hvb-dev.beskel.com.br` permanece reservado ao **Terminal HVB** e não deve ser usado como destino do sistema interno.

## Escopo entregue — MVP 4

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

O MVP 3 iniciou a transição de uma interface orientada por tabelas para uma interface orientada por **jornadas de trabalho**.

A Visão geral permite:

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

### Painel operacional

O MVP 4 adiciona ao dashboard uma leitura consolidada do que já exige atenção na unidade ativa, sem criar regras clínicas novas.

A Visão geral passa a consultar e apresentar:

- **agenda do dia**, por meio de `/v1/agenda/mapa`, limitada ao intervalo do dia corrente;
- **episódios ativos**, por meio de `/v1/episodios?ativos=true`;
- **pendências clínicas abertas**, por meio de `/v1/clinica/pendencias?situacao=aberta`.

O painel mostra contagens e uma prévia dos registros mais relevantes. Quando a consulta retorna `next_cursor`, a contagem é apresentada como limite mínimo (por exemplo, `100+`) para não sugerir totalização que o backend não forneceu.

As três leituras continuam condicionadas às permissões do perfil autenticado. Ausência de autorização aparece como restrição do perfil, e não como erro do sistema.

### Jornada de Agenda

O módulo **Agenda** agora possui uma camada contextual acima da consulta tabular.

A jornada reúne:

- mapa do dia corrente;
- horários de início e término;
- tipo e situação do agendamento;
- paciente associado por identificador;
- alocações de recursos já registradas;
- nomes dos recursos quando a credencial possui acesso à consulta correspondente;
- sinalização de registros que já chegam do backend com `necessita_revisao`.

A interface cruza `/v1/agenda/mapa`, `/v1/agenda/alocacoes` e `/v1/agenda/recursos` apenas para composição visual. Nenhuma regra de agenda é inferida no cliente e nenhum estado é alterado.

### Jornada de Internação

O módulo **Internação** passa a consolidar contexto operacional da unidade ativa.

A jornada reúne:

- episódios ativos;
- ocupações ainda abertas;
- local físico e vaga quando disponíveis;
- programações clínicas relacionadas ao episódio;
- pendências clínicas vinculadas ao episódio quando essa referência estiver disponível na resposta do backend.

A composição utiliza `/v1/episodios`, `/v1/ocupacoes`, `/v1/locais`, `/v1/clinica/programacoes` e `/v1/clinica/pendencias`.

A ausência de vínculo entre uma pendência e um episódio não é preenchida por inferência. O frontend só apresenta relações explicitamente existentes nos dados retornados.

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
9. Não apresentar métricas agregadas como totais globais quando o contrato da API fornecer apenas páginas de resultados.
10. Não criar relações, estados clínicos ou decisões no frontend por inferência quando o backend não os fornecer explicitamente.

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

A próxima camada deve aprofundar as demais jornadas:

- fila operacional de exames;
- estoque por produto/local com contexto do Terminal HVB;
- financeiro orientado a títulos, recebimentos e conciliação;
- compras orientadas a pedido, decisão e recebimento;
- filtros contextuais por paciente/episódio dentro dos módulos;
- passagem de plantão e demais rotinas de internação somente após validação do fluxo real do hospital;
- ações de escrita condicionadas à matriz de cargos validada.

As ações de criação, alteração, aprovação, baixa e reversão devem ser adicionadas somente após a validação da matriz de cargos e dos fluxos executivos com o HVB.
