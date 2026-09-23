# MVP 11 — contratos operacionais integrados — 23/09/2026

Integração do contrato publicado pelo backend em `8ba6c2d2a18121f721e54c51d3e3d7caac9536ef`. Backend, banco/migrations e Terminal não foram alterados por esta etapa. A interface ativa passou de `assets/system-v9.js` para `assets/system-v10.js`; o MVP 10 de sessão/BFF permanece a base.

## Entregue

- **Papéis e permissões:** a seleção de papel consulta `GET /v1/papeis/{id}/permissoes` e mostra os códigos efetivos. Escopo global e por unidade são escolhas explícitas.
- **Funcionários:** `POST /v1/usuarios/onboarding` está habilitado com nome, login, motivo e 1–50 atribuições. O corpo omite `unidade_id` quando o escopo é global. O fluxo não cria credencial, senha, NFC ou identidade humana.
- **Entrada de estoque:** `POST /v1/estoque/entradas-completas` está habilitado para lote novo. `apresentacao_id` é enviado dentro de `lote`; quantidade/custo permanecem strings decimais.
- **Origem por compra:** quando marcada, a mesma intenção inclui o objeto `compra` com referência, simulação e confirmação humana. A UI não envia `POST /v1/compras/recebimentos` depois.
- **Retry:** cada intenção é preparada uma vez; erro 5xx, perda de recibo ou falha de rede ambígua preserva a mesma `Idempotency-Key` e o mesmo corpo. Falha HTTP definitiva libera uma nova intenção.
- **Pacientes:** a busca rápida agora usa `GET /v1/pacientes?q=...` no servidor, mantém o mesmo `q` na paginação por cursor e limpa o cursor ao mudar a busca. A cópia visual foi corrigida para o contrato real: nome ou UUID completo.
- **Identidade:** nenhuma rota de login humano foi inventada. A proposta de adaptador privado descrita pelo backend continua apenas como proposta do BFF.

## Escopos de acesso da interface

O catálogo de estoque continua global na organização, conforme a decisão do backend: a UI exige `estoque:ler` e `estoque:catalogar` globais. A movimentação continua por unidade.

Há uma dependência concreta adicional da interface: para o operador escolher o local, o formulário consulta `GET /v1/locais`, que exige `locais:ler` na unidade. Assim, o POST de entrada completa pode ser autorizado pelo backend com `estoque:movimentar`, mas a interface não é operável naquela unidade sem `locais:ler`. A UI agora filtra unidades elegíveis por `estoque:movimentar + locais:ler`. Resta decidir se os papéis de estoque receberão `locais:ler` ou se haverá outro contrato de leitura de locais para esse fluxo.

Quando a origem é compra, `compras:receber` também é exigido na unidade. Sem essa permissão, a opção de compra fica desabilitada.

## Destino e sessão

Sem mudança de arquitetura: DEV lógico em `https://hvb-sistema-dev.beskel.com.br`, futuro `https://sistema.hvb.com.br`, com interface e `/session` na mesma origem HTTPS. O servidor atual continua restrito a HTTP loopback; assets estáticos isolados não entregam a sessão. Hospedagem TLS/cookie Secure e login humano operacional permanecem pendentes.

## Evidência

- 36/36 verificações executáveis sobre os blobs exatos publicados na branch: sintaxe, escopos, endpoints, corpo, ausência de segundo recebimento, busca/paginação, isolamento de Terminal/Bearer e retry.
- 3/3 testes Node executados com `node --test tests/frontend-operational-contract.test.mjs`: escopos/atribuição global; busca `q + cursor`; retry com a mesma chave e corpo.
- Os hashes locais dos três artefatos executados coincidiram com os blobs GitHub correspondentes.
- Evidência estruturada: [frontend-mvp11-integracao.json](evidencias/frontend-mvp11-integracao.json).

Não houve navegador real nem API/PostgreSQL integrados nesta etapa. A evidência do backend para seus contratos permanece separada.

---

# MVP 11 — cadastros operacionais preparados — 23/09/2026

Continuidade aditiva do MVP 10. Backend, migrations/banco e Terminal permanecem congelados nesta etapa. A interface passa a explicitar dois fluxos solicitados pelo HVB: **cadastro de funcionário com autorizações** e **entrada de estoque**, usando o contexto de identidade/unidades/permissões já fornecido por `GET /v1/me/contexto`. Nenhuma gravação nova foi improvisada no navegador quando o contrato atual exige múltiplas operações independentes.

## Destino da interface e da sessão

- Hoje, validado somente em loopback: `http://127.0.0.1:3200`, com API em `http://127.0.0.1:3100`.
- Destino DEV proposto: `https://hvb-sistema-dev.beskel.com.br`.
- Destino futuro: `https://sistema.hvb.com.br`.
- Em ambos, a interface e `/session` devem permanecer na **mesma origem HTTPS**. O navegador fala com o servidor Node da interface; o Bearer da API fica no servidor e não é devolvido ao browser.
- A API pode permanecer privada atrás desse servidor/BFF. Hospedar somente os assets estáticos não satisfaz o contrato do MVP 10.
- O código atual continua deliberadamente restrito a HTTP/loopback. TLS, cookie `Secure`, host externo e armazenamento compartilhado de sessão ainda não foram habilitados nem implantados.

## Estratégia de login

O contrato do navegador continua sendo `POST/GET/DELETE /session` no servidor da interface. No DEV local, `POST /session` ainda recebe a credencial opaca temporária de 64 caracteres uma única vez; o servidor valida a identidade na API e cria cookie HttpOnly/SameSite. Isso é transição de desenvolvimento, não login humano definitivo.

Para ambiente hospedado, a interface deve conservar o mesmo padrão BFF: credencial humana é entregue ao servidor de interface por HTTPS, o servidor negocia/recebe uma credencial curta da API ou do provedor de identidade aprovado e mantém o segredo fora do navegador. Não implementar senha, recuperação, MFA ou provedor de identidade no frontend por inferência.

## Novo recorte visual

`assets/system-v9.js` adiciona, sem substituir os módulos existentes:

1. **Administração → Cadastro de funcionário e autorizações**
   - nome;
   - login;
   - papel/perfil;
   - unidade;
   - autorização derivada do papel e do escopo devolvido pela API.
   - A gravação permanece bloqueada até existir contrato seguro para onboarding completo.

2. **Estoque → Registrar entrada de estoque**
   - unidade;
   - produto/apresentação;
   - fabricante e código do lote;
   - situação/data de validade;
   - localização física;
   - quantidade em apresentações;
   - custo base opcional;
   - data/hora e motivo.
   - Preserva `produto → lote → ocupação física → coordenada`; não cria coordenada fixa por produto e não chama o Terminal.

Os controles consultam o próprio contexto e não expõem ações quando faltam permissões relevantes.

## Gaps confirmados do backend

### Funcionário / autorizações

Existem separadamente `POST /v1/usuarios`, `POST /v1/atribuicoes`, `POST /v1/credenciais` e `GET /v1/papeis`. O backend também preserva revisão/revogação de atribuições. Porém:

- os contratos de usuários/papéis/atribuições exigem `acesso:administrar` em escopo global; a interface agora respeita esse escopo e não trata uma permissão apenas de unidade como equivalente;
- a listagem de papéis não devolve as permissões que compõem o papel, impedindo a interface de mostrar exatamente o que será autorizado;
- não existe um comando transacional de onboarding que crie usuário + uma ou mais atribuições como uma única intenção;
- não existe login humano operacional; a credencial DEV não deve virar senha do colaborador.

Exemplo sintético de contrato desejado, com nome de rota a decidir pelo backend:

```json
{
  "nome": "Funcionário Fictício",
  "login": "funcionario.dev",
  "atribuicoes": [
    {
      "papel_id": "11111111-1111-4111-8111-111111111111",
      "unidade_id": "22222222-2222-4222-8222-222222222222"
    }
  ]
}
```

Resposta mínima esperada:

```json
{
  "usuario_id": "33333333-3333-4333-8333-333333333333",
  "atribuicao_ids": ["44444444-4444-4444-8444-444444444444"],
  "estado": "confirmado",
  "repetido": false
}
```

### Entrada de estoque

`POST /v1/estoque/entradas` é compatível somente quando a posição já existe: recebe `posicao_id`, quantidade, instante e motivo. Lote e posição são criados por comandos separados. `POST /v1/compras/recebimentos` já integra recebimento de pedido ao ledger de estoque, mas também exige posições previamente existentes. As listas organizacionais de produto/apresentação/lote hoje chamam `authorize(..., estoque:ler)` sem `unidade_id`, portanto exigem `estoque:ler` global; a interface não amplia silenciosamente uma permissão de unidade para consultar esse catálogo.

Para o formulário operacional de recebimento de um lote novo, falta um comando transacional que resolva/reutilize lote, custódia hospitalar e ocupação/posição e registre a entrada na mesma intenção idempotente. Quando houver pedido de compra, o contrato deve reaproveitar o recebimento existente em vez de duplicá-lo.

Exemplo sintético mínimo:

```json
{
  "unidade_id": "22222222-2222-4222-8222-222222222222",
  "apresentacao_id": "55555555-5555-4555-8555-555555555555",
  "lote": {
    "fabricante": "Fabricante Fictício",
    "codigo": "LOTE-DEV-001",
    "situacao_validade": "conhecida",
    "validade": "2028-10-31"
  },
  "local_id": "66666666-6666-4666-8666-666666666666",
  "quantidade_apresentacoes": "20",
  "ocorrido_em": "2026-09-23T15:00:00-03:00",
  "motivo": "Recebimento sintético"
}
```

Resposta mínima esperada:

```json
{
  "lote_id": "77777777-7777-4777-8777-777777777777",
  "posicao_id": "88888888-8888-4888-8888-888888888888",
  "transacao_id": "99999999-9999-4999-8999-999999999999",
  "estado": "confirmado",
  "repetido": false
}
```

### Busca de pacientes

A busca rápida existente filtra apenas os pacientes já carregados pela paginação. Para operação real, falta busca server-side por nome/identificador, preservando RBAC e paginação.

Exemplo compatível desejado:

```text
GET /v1/pacientes?q=luna&limit=25
```

Resposta: o mesmo envelope paginado já usado por `GET /v1/pacientes`, sem novo formato paralelo.

## Pedidos objetivos ao backend

1. Expor leitura das permissões efetivas de um papel existente, sem conceder novas permissões, preservando que `acesso:administrar` é global no contrato atual.
2. Definir um comando idempotente/transacional para onboarding de usuário + atribuições, ou declarar explicitamente que a UI deve trabalhar em etapas e fornecer um estado recuperável de onboarding incompleto.
3. Definir o contrato de login humano consumido pelo BFF `/session`; não expor Bearer persistente ao navegador.
4. Definir entrada transacional de lote novo/posição/quantidade, preservando o ledger atual e reaproveitando `/compras/recebimentos` quando a origem for um pedido. Confirmar também se a leitura do catálogo de estoque permanecerá global ou se haverá um contrato de catálogo legível por operadores com escopo de unidade.
5. Acrescentar busca server-side a `GET /v1/pacientes` (`q` ou critério equivalente), preservando o envelope paginado e RBAC; a UI não deve precisar carregar todas as páginas para localizar um paciente.
6. Não alterar o contrato congelado do Terminal para resolver nenhum desses itens.

## Evidência desta etapa

A regressão local isolada executou 5/5 cenários de sessão web e 3/3 cenários do servidor/proxy. O contrato novo teve 4/4 verificações locais; adicionalmente, a versão efetivamente publicada na branch foi relida e passou verificações de sintaxe e invariantes: usa `/v1/me/contexto`, não envia `Authorization`, não executa POST provisório, não chama Terminal e está carregada depois de `web-session.js`.

O harness disponível neste ambiente usa Node 22.16.0, enquanto o projeto declara Node 24; portanto esses resultados são evidência dirigida da interface/sessão, não substituem o CI canônico nem os testes PostgreSQL. `pilot.test.mjs` não foi repetido porque este delta não alterou o piloto nem o backend e o ambiente completo PostgreSQL não está materializado aqui. Evidência estruturada: [frontend-mvp11.json](evidencias/frontend-mvp11.json).

---

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
