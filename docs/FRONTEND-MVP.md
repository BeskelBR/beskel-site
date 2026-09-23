# Frontend MVP — HVB Sistema

## MVP 10 — sessão web do piloto — 23/09/2026

Entrada por credencial temporária existente, agora trocada por sessão no servidor da interface. Cookie HttpOnly/SameSite Strict, expiração por inatividade e limite absoluto, logout no servidor, controle de origem e contexto de aba. A credencial deixou de ser guardada no navegador. **Ainda não há login operacional com senha/SSO, MFA ou recuperação de conta.**

O contexto próprio `/v1/me/contexto` fornece as unidades autorizadas sem exigir administração. A escolha da unidade no atendimento vem dessa consulta; o UUID manual do MVP 9 e a configuração de API no navegador foram superados. Todas as operações mantêm autorização no backend. [Decisão, fronteiras e evidências](adr/0029-sessao-web-piloto.md).

Para executar localmente, manter os comandos de API e frontend descritos abaixo e acessar `http://127.0.0.1:3200`. O frontend precisa do processo Node, que guarda as sessões em memória; abrir apenas o HTML ou publicar assets estáticos não entrega sessão/proxy. Reinício exige nova entrada. Ambiente externo/TLS não foi configurado.

Antes da nova orientação de verificações, passaram 13 testes direcionados (frontend, sessão e piloto), e o navegador confirmou entrada/unidades/cadastro sintético. A verificação visual restante do MVP 10 foi adiada. Alterações finais de timeout/descarte de respostas de sessão anterior recebem somente análise de integridade nesta etapa, conforme o pedido do usuário. Quando autorizado, executar `node --test tests/frontend-server.test.mjs tests/web-session.test.mjs` e `node --env-file=.env --test tests/pilot.test.mjs`, seguidos de restauração/logout/troca de abas e jornada completa no navegador.

Os registros MVP 8/9 abaixo são históricos e não substituem este estado atual.

## MVP 9 — atendimento de piloto — 22/09/2026

Evolução aditiva do MVP 8, conforme o plano da semana. Na **Visão geral**, a área **Atendimento** permite carregar o contexto, localizar pacientes nas páginas carregadas ou cadastrar um paciente fictício, selecionar/abrir episódio e registrar/ler evolução. Unidade, paciente e episódio ficam explícitos. A listagem de versões mantém autoria, horário, estado e histórico; o conteúdo é buscado separadamente com a permissão `prontuario:conteudo` e exibido como texto.

As três escritas usam rotas existentes, RBAC/RLS e chave de idempotência por intenção. O formulário exige confirmação de simulação; não há execução clínica, consumo, cobrança ou alteração de migrations. Enquanto um envio está em andamento ou tem resultado incerto, os controles ficam bloqueados. **Reconsultar o envio com segurança** repete a mesma intenção/chave. Uma falha de atualização posterior à confirmação não reenvia a gravação. A intenção pendente fica apenas em memória; antes de recarregar/fechar há aviso. Se a sessão for encerrada durante uma incerteza, conferir os registros antes de iniciar novo cadastro.

### Operação local

1. Com PostgreSQL DEV preparado, executar `node --env-file=.env src/api/server.ts` e, em outro terminal, `node scripts/frontend.mjs`.
2. Abrir `http://127.0.0.1:3200` e entrar com a credencial DEV já provisionada. Nenhuma credencial acompanha este documento.
3. Em **Visão geral → Carregar atendimento**, selecionar a unidade e o paciente. O filtro busca apenas nas páginas carregadas; usar **Carregar mais pacientes** quando indicado.
4. Conferir episódios existentes antes de abrir outro. Informar admissão e confirmar os dados fictícios. Selecionar o episódio, informar ocorrência, conteúdo e motivo, confirmar a simulação e registrar.
5. Usar **Ler conteúdo** para verificar o registro; após recarregar, localizar o mesmo paciente/episódio. As versões têm paginação própria.

Listar unidades exige `acesso:administrar` no contrato atual. Para perfis sem essa permissão, o piloto reutiliza a unidade informada na configuração técnica DEV do acesso; isso não concede acesso e todas as operações continuam autorizadas pela API. Cadastro exige `cadastros:ler/escrever`; episódio exige `episodios:ler/escrever`; prontuário exige `prontuario:ler/escrever/conteudo`, conforme a operação. Papéis hospitalares definitivos e seleção operacional de unidade continuam pendentes.

### Verificação e limites

`node --env-file=.env --test tests/pilot.test.mjs`: três testes com proxy/API/PostgreSQL TEST reais; percurso completo, perda de resposta após commit seguida de retry sem duplicação, sessão inválida, recusa RBAC/unidade e recibo inválido. Os três testes do servidor frontend continuam aprovados; TypeScript e lint pontual passaram. Evidência: [piloto MVP 9](evidencias/piloto-mvp9.json).

No navegador foram conferidos cadastro, abertura, evolução, conteúdo literal, releitura após reload, recusa de gravação para perfil de consulta, logout e largura móvel sem rolagem horizontal. A correção global de `[hidden]` impede que regras CSS de layout exibam telas ocultas. A validação usa somente fixtures TEST e não constitui homologação hospitalar. Logotipo remoto não carregou no navegador de teste; revisar disponibilidade do asset no ambiente final, sem alterar a pasta do Site.

Permanecem pendentes autenticação operacional, ambiente hospedado, responsáveis/vínculos na jornada de escrita, retificações na interface e validação dos demais módulos. O escopo MVP 8 abaixo permanece como histórico.

## Integração com C18 — 22/09/2026

Frontend MVP 8 remoto preservado e integrado ao backend C8–C18. A estratégia atual está em [PLANO-ENTREGA-SEMANA.md](PLANO-ENTREGA-SEMANA.md): reaproveitar as telas existentes e priorizar uma jornada de piloto; isso não homologa cargos nem autoriza dados reais.

O servidor local agora serve apenas index/robots e assets públicos, bloqueando .env, .local, fontes do servidor e caminhos arbitrários. O proxy preserva autorização/status da API, limita o corpo e usa timeout. Três testes de regressão passam com `node --test tests/frontend-server.test.mjs`. A [verificação HTTP integrada](evidencias/integracao-piloto-http.json) confirmou assets, identidade DEV, consultas da jornada e rotas Terminal v1 com API/PostgreSQL reais locais. Não substitui validação visual no navegador nem aprovação da jornada de escrita.

## Objetivo

Construir a camada visual do **HVB Sistema** sem antecipar regras operacionais ainda pendentes de validação hospitalar.

O acesso institucional parte da página pública **Área do colaborador** (`/colaborador`) no branch `hvb-site-dev`, que encaminha o colaborador autorizado para o Sistema HVB em `hvb-sistema-dev.beskel.com.br` durante a implantação.

O endereço `hvb-dev.beskel.com.br` permanece reservado ao **Terminal HVB** e não deve ser usado como destino do sistema interno.

## Escopo entregue — MVP 8

### Base do sistema

- acesso restrito com credencial opaca DEV já suportada pelo backend;
- token somente em `sessionStorage`;
- contexto de organização, unidade e ator autenticado;
- status de `/health` e `/ready`;
- navegação responsiva por módulos;
- bloqueio de indexação;
- configuração manual de unidade apenas como contingência DEV;
- estados explícitos de sessão, permissão, ausência de registros e indisponibilidade.

### Consulta modular

Todos os módulos continuam com uma camada de consulta genérica, com abas, filtro local, paginação por `next_cursor` e tratamento de `403` como restrição de perfil.

### Dashboard operacional

A Visão geral consolida:

- agenda do dia;
- episódios ativos;
- pendências clínicas abertas;
- localização rápida de paciente;
- abertura de contexto longitudinal;
- seleção de episódio com programações, execuções, exames e contas relacionadas.

Nenhuma métrica paginada é apresentada como total global quando a API não fornece totalização.

## Jornadas especializadas

### Pacientes

- pacientes e estado cadastral;
- responsáveis;
- vínculos ativos/encerrados;
- episódios associados à unidade ativa.

### Agenda

- mapa diário;
- recursos e alocações;
- horários e situação registrada;
- sinalização de registros marcados pelo backend como necessitando revisão.

### Internação

- episódios ativos;
- ocupações e local/vaga quando vinculados;
- programações clínicas;
- pendências abertas.

### Prontuário

- evoluções recentes;
- histórico de versões;
- associação com paciente e episódio quando o backend fornece os vínculos.

### Exames

- solicitações;
- coletas e situação de amostra;
- resultados ainda não liberados;
- resultados com pendências/revisão sinalizadas pelo backend;
- liberações recentes.

O frontend não interpreta resultados clínicos.

### Estoque

- posições físicas;
- saldo disponível e reservado;
- reservas ativas;
- inventários;
- lotes e validade registrada.

As movimentações físicas continuam conceitualmente separadas no **Terminal HVB**. O Sistema oferece visão administrativa e rastreabilidade.

### Financeiro

- títulos com saldo;
- recebimentos;
- sessões de caixa;
- créditos disponíveis;
- depósitos e itens de extrato ainda não conciliados.

O frontend não executa baixa, conciliação, reversão ou fechamento nesta fase.

### Compras

- pedidos;
- itens solicitados/recebidos;
- decisões já registradas;
- recebimentos;
- vínculo do recebimento com entrada de estoque.

### Documentos

- solicitações e prazo;
- versões;
- aprovações;
- assinaturas declaradas;
- entregas.

O frontend preserva o estado declarado pelo backend e não transforma assinatura declarada em assinatura verificada.

### Preventivo

- adesões;
- ocorrências programadas;
- aplicações;
- necessidade de revisão de material quando registrada;
- revisões preventivas.

### Administração

- usuários;
- papéis;
- atribuições carregadas;
- credenciais e validade/revogação;
- dispositivos;
- unidades.

A Administração permanece somente leitura até que a matriz de cargos seja homologada.

## Princípios obrigatórios

1. Expor somente capacidades existentes no backend.
2. Não inventar regra hospitalar no frontend.
3. Tratar `403` como ausência de permissão.
4. Manter ações de escrita bloqueadas até validação de fluxo e cargo.
5. Separar Sistema HVB e Terminal HVB.
6. Manter paciente e episódio como contexto quando aplicável.
7. Não inferir totais globais de páginas parciais.
8. Não fazer interpretação clínica automática.
9. Não transformar estado declarado em estado verificado.
10. Preferir jornadas operacionais a simples exposição de tabelas.

## Executar localmente

Com banco, migrações e seeds preparados conforme o README principal:

```powershell
.\scripts\pnpm.ps1 dev
```

Em outro terminal:

```powershell
.\scripts\pnpm.ps1 frontend
```

Abrir:

```text
http://127.0.0.1:3200
```

O frontend local usa `location.origin` como base e o servidor de frontend encaminha `/health`, `/ready` e `/v1/*` para a API local.

Utilizar somente dados fictícios DEV. Não inserir dados hospitalares reais nesta etapa.

## Limite atual e intervenção necessária

A camada de **consulta e composição de jornadas** chegou a um ponto em que o próximo avanço relevante deixa de ser apenas visual.

Para liberar ações como criar, editar, prescrever, executar, aprovar, movimentar, receber, liquidar, assinar, encerrar, reverter ou administrar acessos, é necessário validar com o HVB:

1. matriz de cargos e permissões;
2. quais ações cada cargo pode iniciar, aprovar, corrigir e reverter;
3. fluxos executivos reais de recepção, clínica, internação, exames, estoque, compras, financeiro e administração;
4. regras que exigem dupla validação ou justificativa;
5. quais ações pertencem ao Sistema e quais permanecem exclusivas do Terminal;
6. política definitiva de autenticação e sessão.

Até essa validação, novas ações de escrita no frontend devem permanecer bloqueadas.

## Antes de produção

Ainda serão necessários, entre outros:

- autenticação operacional definitiva;
- hospedagem adequada da API e PostgreSQL;
- política de sessão/renovação;
- resolução definitiva de unidade no contexto autenticado;
- matriz de cargos homologada;
- homologação dos fluxos hospitalares;
- domínio/reverse proxy/API;
- testes de segurança, acessibilidade, responsividade e regressão;
- logs, backup, contingência e observabilidade;
- validação visual em navegadores e dispositivos reais.
