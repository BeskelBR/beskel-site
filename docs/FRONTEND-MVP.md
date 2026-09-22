# Frontend MVP — HVB Sistema

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
