# HVB Sistema

Estado em 22/09/2026: C8–C18 e o frontend administrativo MVP 8 publicados em `hvb-sistema-dev` (`bea6df2`, SHA remoto confirmado). Interface integrada ao backend local e consultas verificadas por HTTP; jornada de escrita, autenticação operacional e ambiente de homologação continuam em andamento. A prioridade vigente está no [plano da semana](docs/PLANO-ENTREGA-SEMANA.md). Descrições de lotes abaixo delimitam suas entregas históricas; a interface já existe e será reaproveitada.

Fundação **M0 + M1**, estoque físico **M2**, clínica operacional **M3**, diárias configuráveis **M4**, recorte comercial/financeiro **M5**, exames/resultados **M6A**, protocolos preventivos **M6B** e documentos gerais **M6C**, em `hvb-sistema-dev`. API modular, PostgreSQL real local e worker. Dados exclusivamente fictícios. Produto: **HVB Sistema**; `Core` designa somente o domínio interno.

Implementado: organização/unidades, contas individuais, papéis/permissões, credenciais opacas e revogação, dispositivos, responsáveis/pacientes/vínculos, episódios, locais/ocupações, comandos idempotentes, auditoria, outbox/inbox e proveniência sintética com FKs tipadas. A organização inicial nasce pelo bootstrap administrativo local.

M2 acrescenta unidades de medida, produtos, apresentações versionadas, lotes, recipientes, custódia hospital/tutor, posições, reservas, entrada, transferência, retirada, devolução, perda, reversão e inventário com ajuste. Retirada transfere para destino identificado; não registra execução clínica, consumo ou cobrança.

M3 acrescenta item clínico, prescrição, ordem versionada, programação, confirmação de execução, material previsto, consumo identificado, estorno e pendências clínicas. A execução não baixa estoque automaticamente; material desconhecido permanece pendente.

M4 acrescenta classificação versionada, peso referenciado, pacotes, grupos, regras, períodos explícitos e avaliação de cobertura com reserva, reversão e histórico. **Somente simulação**: as regras reais do hospital permanecem pendentes.

M5 acrescenta catálogo/preço versionados, conta, avaliação comercial, responsabilidade, título, recebimento, liquidação, crédito, caixa, parcelas da adquirente, depósito e conciliação. São comandos **somente de simulação**, sem dinheiro real ou integração externa. Diária ambígua permanece pendente; inclusão documenta valor zero sem inventar devedor. Este lote entrega backend e contratos, sem telas, Terminal, migração real ou produção. O código fica no GitHub; Vercel e Cloudflare serão configurados pelo usuário. O backend atual exige PostgreSQL local e não está adaptado à execução serverless.

M6A acrescenta catálogo técnico, solicitações, coletas, avaliação de amostras, resultados estruturados e correções versionadas. A liberação humana DEV preserva conteúdo e hash verificável, sem interpretação clínica automática. M6B acrescenta protocolos versionados, adesão do paciente, recorrência em dias/calendário, aplicações internas/externas, revisão de atrasos e vínculo com consumo físico. M6C acrescenta modelos e campos versionados, autorização, conteúdo privado com hash, aprovação, declaração de assinatura não verificada e registro de entrega simulado. **M6 está em andamento**; M6D acrescenta agenda com recursos, disponibilidade, conflitos, reprogramação e transições operacionais. M6E acrescenta portal com credenciais próprias, acesso por paciente, preferências e comunicação simulada com documentos/agenda versionados. C1 integra fornecedor/pedido/recebimento à mesma entrada física M2. C2 acrescenta evolução clínica versionada e linha do tempo por paciente, preservando IDs originais e permissões por fonte. A consolidação do núcleo segue antes das decisões hospitalares; a interface permanece futura.

C14 permanece como baseline histórico do **Terminal de Acesso V2**, com ordens, autenticação simulada, sessões e eventos sem fulfillment. C18 evolui essa fronteira para o contrato Terminal v1 abaixo. Novas retiradas pela rota legada /terminal/retiradas continuam bloqueadas. Ver [relatório histórico C14](docs/RELATORIO-C14.md).

C15 entrega **correção clínica**: executor/versão/programação podem ser corrigidos por sucessora no mesmo episódio, e um ato registrado indevidamente pode ser anulado sem inventar outra execução. Exige estorno prévio de consumo ativo e preserva documentos derivados para revisão. Ver [relatório C15](docs/RELATORIO-C15.md).

C16 entrega **correção de diárias**: associação e período podem ser cancelados ou substituídos com histórico. Reservas, cobertura e documentos financeiros exigem compensação explícita prévia; o sistema preserva valores e saldo físico. Ver [relatório C16](docs/RELATORIO-C16.md).

C17 entrega **correções do financeiro do cliente**: depósito/extrato corrigíveis com histórico e reabertura explícita de conciliação/alocação após reversão. Etapa concluída; parada para o delta intermediário do usuário. Ver [relatório C17](docs/RELATORIO-C17.md) e [ponto de parada](docs/PONTO-DE-PARADA-C17.md).

C18 incorpora o delta N1 **Terminal v1 canônico**: NFC revogável + biometria DEV, dispositivos separados, contexto de ORs/ajustes, sessão exclusiva da sala, FEFO/FIFO com reservas M2, checklist, sensível sob demanda e confirmação automática recuperável após saída. Fulfillment preserva origem e não gera consumo, execução clínica ou cobrança. Rotas novas em `/v1/terminal/v1`; baselines C5/C14 preservados. [Relatório C18](docs/RELATORIO-C18.md), [modelo e matriz API](docs/DADOS-C18.md), [contrato de eventos](docs/CONTRATO-EVENTOS-TERMINAL-V1.md). O servidor normal falha fechado sem adaptador biométrico; não há hardware ou cliente real instalado.

## Executar neste Windows

Requisitos: Node **24**, pnpm **11.19.0**. O wrapper abaixo usa o pnpm disponível ou o runtime já existente no Codex. Não instala nada globalmente.

```powershell
Set-Location 'C:\Users\Admin\OneDrive\BESKEL\PARCEIROS\HVB\SISTEMA'
.\scripts\pnpm.ps1 install --frozen-lockfile --store-dir .local/pnpm-store
.\scripts\pnpm.ps1 db:local
.\scripts\pnpm.ps1 db:migrate
.\scripts\pnpm.ps1 db:seed
.\scripts\pnpm.ps1 db:seed:inventory
.\scripts\pnpm.ps1 db:seed:clinical
.\scripts\pnpm.ps1 db:seed:daily
.\scripts\pnpm.ps1 db:seed:financial
.\scripts\pnpm.ps1 db:seed:exams
.\scripts\pnpm.ps1 db:seed:preventive
.\scripts\pnpm.ps1 db:seed:documents
.\scripts\pnpm.ps1 db:seed:schedule
.\scripts\pnpm.ps1 db:seed:portal
.\scripts\pnpm.ps1 db:seed:purchases
.\scripts\pnpm.ps1 db:seed:medical
.\scripts\pnpm.ps1 db:seed:core
.\scripts\pnpm.ps1 db:seed:payables
.\scripts\pnpm.ps1 db:seed:terminal
.\scripts\pnpm.ps1 db:seed:pricing
.\scripts\pnpm.ps1 db:seed:acquisition
.\scripts\pnpm.ps1 db:seed:installments
.\scripts\pnpm.ps1 db:seed:supplier-credit
.\scripts\pnpm.ps1 db:seed:supplier-outflow
.\scripts\pnpm.ps1 db:seed:medical-complements
.\scripts\pnpm.ps1 db:seed:links-audit
.\scripts\pnpm.ps1 db:seed:registry
.\scripts\pnpm.ps1 db:seed:terminal-access
.\scripts\pnpm.ps1 db:seed:clinical-corrections
.\scripts\pnpm.ps1 db:seed:daily-corrections
.\scripts\pnpm.ps1 check
.\scripts\pnpm.ps1 dev
```

API: `http://127.0.0.1:3100`. `GET /health` verifica o processo; `GET /ready` verifica conexão, versão mínima do schema e papel da API. Execute o worker em outro terminal:

```powershell
.\scripts\pnpm.ps1 worker
# Ou um único lote:
node --env-file=.env src/worker/main.ts --once
```

O PostgreSQL portátil usa `127.0.0.1:55432`, cluster em `.local/postgres`, bancos separados `hvb_sistema_dev` e `hvb_sistema_test`, senhas aleatórias em `.env`. `.local/dev-access.json` contém credenciais **somente fictícias** do seed; não publicar nem enviar esses arquivos. O seed repetido preserva contas existentes. Credenciais expiram em sete dias; renovação exige outra credencial administrativa válida ou bootstrap administrativo explícito. Nenhum reset destrutivo é automático.

Parar API/worker: `Ctrl+C` no respectivo terminal. Parar o banco preservando dados: `.\scripts\pnpm.ps1 db:stop`. O cluster é local ao projeto e não é instalado como serviço do Windows. O PostgreSQL portátil não precisa do postinstall de symlinks bloqueado pelo pnpm nesta plataforma; os executáveis foram testados diretamente.

## Exercitar a API

```powershell
$hvbDev = Get-Content .local/dev-access.json -Raw | ConvertFrom-Json
$hvbHeaders = @{ Authorization = "Bearer $($hvbDev.adminToken)" }
Invoke-RestMethod http://127.0.0.1:3100/v1/me -Headers $hvbHeaders
$hvbHeaders['Idempotency-Key'] = [guid]::NewGuid().ToString()
$hvbBody = @{ nome = 'Paciente Fictício Exemplo'; especie_codigo = 'canina'; estado_vital = 'desconhecido' } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3100/v1/pacientes -Method Post -Headers $hvbHeaders -ContentType 'application/json' -Body $hvbBody
```

Reenviar o mesmo corpo e chave retorna o mesmo ID, `estado: confirmado` e `repetido: true`. Conteúdo ou operação diferente com a mesma chave resulta em `409`. Uma nova intenção usa uma nova chave. Credenciais fornecidas em `/v1/credenciais` devem ter 32 bytes criptograficamente aleatórios, representados em 64 caracteres hexadecimais; o banco guarda somente SHA-256. NFC não serve como autenticação Bearer nem confirma ato clínico.

As listas gerais usam `limit` (padrão 25, máximo 100) e `cursor` UUID. Episódios, locais e ocupações exigem `unidade_id`; episódios aceitam `paciente_id` e `ativos`. A paginação usa ordem por UUID imutável; não promete ordenação cronológica. Os dados de um registro recém-inserido com UUID anterior ao cursor aparecem ao reiniciar a consulta.

Contrato completo: [OpenAPI](openapi/hvb-sistema.json). Schemas de entrada e saída são os mesmos usados pela API; `pnpm openapi` regenera o artefato.

### Exercitar o estoque fictício

O seed M2 usa comandos idempotentes: repetir não duplica a entrada de 20 unidades. As referências ficam em `.local/inventory-demo.json`; as credenciais continuam em `.local/dev-access.json`.

```powershell
$hvbStock = Get-Content .local/inventory-demo.json -Raw | ConvertFrom-Json
Invoke-RestMethod "http://127.0.0.1:3100/v1/estoque/posicoes?unidade_id=$($hvbStock.unit_id)&produto_id=$($hvbStock.product)" -Headers $hvbHeaders
$hvbHeaders['Idempotency-Key'] = [guid]::NewGuid().ToString()
$hvbMovement = @{ origem_id = $hvbStock.origin; destino_id = $hvbStock.destination; quantidade_base = '1'; ocorrido_em = [DateTimeOffset]::UtcNow.ToString('o'); motivo = 'Retirada fictícia de demonstração' } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3100/v1/estoque/retiradas -Method Post -Headers $hvbHeaders -ContentType 'application/json' -Body $hvbMovement
```

Quantidades, fatores e custos são strings decimais exatas, com até seis casas; números JSON são rejeitados. Estoque disponível é saldo físico menos reservas ativas. A expiração exige comando explícito e mantém a reserva protegida até ser processada. A contagem de inventário exige `versao_esperada` obtida na consulta da posição; movimentação ou reserva posterior impede aplicar uma contagem obsoleta. Transferências deste recorte são dentro da mesma unidade hospitalar, lote, recipiente e custódia. Veja os demais limites no [relatório M2](docs/RELATORIO-M2.md).

### Exercitar a clínica fictícia

`db:seed:clinical` cria uma prescrição e uma execução **simuladas**, com material pendente, sem representar ato assistencial real. Repetir o seed preserva as identidades e não duplica o fato. Referências em `.local/clinical-demo.json`.

```powershell
$hvbClinical = Get-Content .local/clinical-demo.json -Raw | ConvertFrom-Json
Invoke-RestMethod "http://127.0.0.1:3100/v1/clinica/execucoes?unidade_id=$($hvbDev.unit)&episodio_id=$($hvbClinical.episode)" -Headers $hvbHeaders
Invoke-RestMethod "http://127.0.0.1:3100/v1/clinica/pendencias?unidade_id=$($hvbDev.unit)&execucao_id=$($hvbClinical.execution)&situacao=aberta" -Headers $hvbHeaders
$hvbHeaders['Idempotency-Key'] = [guid]::NewGuid().ToString()
$hvbConsumption = @{ episodio_id = $hvbClinical.episode; execucao_id = $hvbClinical.execution; evento_referencia = [guid]::NewGuid().ToString(); ocorrido_em = '2026-09-01T12:00:00.000Z'; finalidade = 'Material fictício usado'; motivo = 'Conciliação de exemplo DEV'; itens_confirmados = $true; itens = @(@{ posicao_id = $hvbClinical.position; quantidade_base = '1' }) } | ConvertTo-Json -Depth 4
Invoke-RestMethod http://127.0.0.1:3100/v1/clinica/consumos -Method Post -Headers $hvbHeaders -ContentType 'application/json' -Body $hvbConsumption
```

O exemplo debita uma unidade da posição indicada e resolve a pendência de material dessa execução simulada. Para repetir uma requisição após timeout, reutilize **o mesmo corpo e a mesma chave**. `evento_referencia` identifica o fato no cliente e também deve ser preservado; nova chave para o mesmo evento retorna conflito, evitando um segundo registro. Consumo sem execução é permitido quando ligado ao episódio com finalidade e motivo explícitos.

A programação referencia uma versão exata. `POST /v1/clinica/ordens` retorna `id` da ordem e `ordem_versao_id`; novas versões exigem `versao_esperada`. O mapa `GET /v1/clinica/programacoes` exige `unidade_id`, `inicio` e `fim` com fuso e intervalo máximo de sete dias. Alta e nova versão geram revisão de programações afetadas. Retificação clínica e estorno físico são comandos separados, com histórico preservado. Os limites operacionais estão no [relatório M3](docs/RELATORIO-M3.md).

### Exercitar a diária fictícia

`db:seed:daily` cria uma internação, classe e pacote fictícios, um período explícito e uma avaliação incluída na simulação. Repetir preserva as identidades. Isso não aprova regra hospitalar nem gera valor a receber.

```powershell
$hvbDaily = Get-Content .local/daily-demo.json -Raw | ConvertFrom-Json
Invoke-RestMethod "http://127.0.0.1:3100/v1/diarias/avaliacoes?unidade_id=$($hvbDev.unit)&evento_id=$($hvbDaily.event)" -Headers $hvbHeaders
```

Configurações incompletas não podem ser aprovadas, e `/aprovar-simulacao` exige confirmação literal. Cada evento referencia uma execução ou item de consumo; avaliação e reserva exigem contexto explícito. Reavaliação usa `versao_esperada` e preserva a avaliação anterior por compensação. A consulta distingue resultado original e `situacao_atual`, incluindo revisão após retificação, estorno ou mudança do período. Reservas vencidas mantêm capacidade comprometida até expiração explícita. Veja o [relatório M4](docs/RELATORIO-M4.md).

### Exercitar o financeiro fictício

`db:seed:financial` cria um título de R$ 100, recebimento **simulado** de R$ 120, liquidação de R$ 100 e crédito de R$ 20. Repetir não duplica documentos ou valores. Nenhum dinheiro foi transferido. Referências em `.local/financial-demo.json`.

```powershell
$hvbFinancial = Get-Content .local/financial-demo.json -Raw | ConvertFrom-Json
Invoke-RestMethod "http://127.0.0.1:3100/v1/financeiro/titulos?unidade_id=$($hvbDev.unit)&pagador_id=$($hvbFinancial.payer)" -Headers $hvbHeaders
Invoke-RestMethod "http://127.0.0.1:3100/v1/financeiro/creditos?unidade_id=$($hvbDev.unit)&pagador_id=$($hvbFinancial.payer)" -Headers $hvbHeaders
```

Todos os comandos financeiros exigem `unidade_id`, `motivo`, `simulacao: true` e `confirmacao_humana: true`. Valores são strings em BRL com até duas casas; quantidade/preço que exigiria arredondamento é rejeitada. `versao_esperada` protege reavaliações; rateios são informados no mesmo comando do item/título. Receber, liquidar, transformar saldo disponível em crédito e conciliar repasse são ações distintas. Consulte os limites e exemplos no [relatório M5](docs/RELATORIO-M5.md).

### Exercitar exames fictícios

`db:seed:exams` cria estrutura com três atributos, solicitação e resultado fictício liberado com referência pendente reconhecida. Repetir preserva os registros. Referências em `.local/exams-demo.json`.

```powershell
$hvbExams = Get-Content .local/exams-demo.json -Raw | ConvertFrom-Json
Invoke-RestMethod "http://127.0.0.1:3100/v1/exames/resultados?unidade_id=$($hvbDev.unit)&item_exame_id=$($hvbExams.examItem)" -Headers $hvbHeaders
Invoke-RestMethod "http://127.0.0.1:3100/v1/exames/documentos?unidade_id=$($hvbDev.unit)&resultado_id=$($hvbExams.result)" -Headers $hvbHeaders
```

Comandos exigem simulação e confirmação humana literais. Números de resultados são strings exatas, com sinal e até oito casas; texto original e `false` são preservados. Nova versão exige `versao_esperada`. O documento é JSON técnico: confira SHA-256 sobre a string `conteudo_json` exata, sem reserializá-la. Não é laudo final nem assinatura profissional validada. Consulte o [relatório M6A](docs/RELATORIO-M6A.md).

### Exercitar protocolos preventivos fictícios

`db:seed:preventive` cria protocolo, ocorrência, revisão de atraso e aplicação externa declarada, sem registrar execução ou consumo hospitalar. Repetir não duplica fatos.

```powershell
$hvbPreventive = Get-Content .local/preventive-demo.json -Raw | ConvertFrom-Json
Invoke-RestMethod "http://127.0.0.1:3100/v1/protocolos/ocorrencias?unidade_id=$($hvbDev.unit)&paciente_id=$($hvbPreventive.patient)" -Headers $hvbHeaders
Invoke-RestMethod "http://127.0.0.1:3100/v1/protocolos/revisoes?unidade_id=$($hvbDev.unit)&paciente_id=$($hvbPreventive.patient)" -Headers $hvbHeaders
```

A recorrência em meses usa a âncora original com ajuste ao último dia válido; dias e meses são regras distintas. Ocorrências exigem data compatível com etapa/sequência. Aplicação interna estende a mesma execução clínica; vínculo com consumo não baixa estoque novamente. Regras reais e poderes profissionais continuam pendentes. Consulte o [relatório M6B](docs/RELATORIO-M6B.md).

### Exercitar documentos fictícios

`db:seed:documents` cria solicitação, autorização, documento aprovado e registro fictício de entrega. O conteúdo permanece privado; nenhum envio ou assinatura profissional foi realizado.

```powershell
$hvbDocuments = Get-Content .local/documents-demo.json -Raw | ConvertFrom-Json
Invoke-RestMethod "http://127.0.0.1:3100/v1/documentos/versoes?unidade_id=$($hvbDev.unit)&solicitacao_id=$($hvbDocuments.request)" -Headers $hvbHeaders
Invoke-RestMethod "http://127.0.0.1:3100/v1/documentos/conteudos?unidade_id=$($hvbDev.unit)&documento_versao_id=$($hvbDocuments.document)" -Headers $hvbHeaders
```

Modelos usam marcadores `{{codigo}}` e campos textuais explícitos. Correção exige `versao_esperada`. Conteúdo exige permissão própria e versão identificada; seu hash é SHA-256 da string UTF-8 exata. Autorização vigente, aprovação e registro de entrega são ações distintas. Declaração de assinatura permanece não verificada. Consulte o [relatório M6C](docs/RELATORIO-M6C.md).

## Docker, Linux e macOS

Alternativa ao banco portátil, usando Docker já instalado:

```sh
pnpm install --frozen-lockfile
node scripts/configure-env.mjs
docker compose up -d --wait
node --env-file=.env scripts/bootstrap.ts
pnpm db:migrate
pnpm db:seed
pnpm db:seed:inventory
pnpm db:seed:clinical
pnpm db:seed:daily
pnpm db:seed:financial
pnpm db:seed:exams
pnpm db:seed:preventive
pnpm db:seed:documents
pnpm check
pnpm dev
```

O gerador não sobrescreve `.env`. Não executar os dois bancos na porta 55432 simultaneamente. O Compose guarda dados em `.local/docker-postgres` e só publica a porta de loopback. A configuração Docker/CI está entregue; Docker e o runner Linux não foram executados neste computador. O caminho validado neste lote é PostgreSQL nativo no Windows.

## Verificação e documentação

`pnpm check` exige a branch autorizada e executa typecheck, lint, formatação, testes unitários, migrations, integração PostgreSQL e OpenAPI. Verificação pontual atual: [29 testes de compras/estoque](docs/evidencias/checks-c1-focused.json), via `pnpm check:purchases`. A última suíte geral é a evidência histórica de [152 testes M1–M6E](docs/evidencias/checks-m6e.json), com [benchmark e HTTP M6E](docs/evidencias/benchmark-m6e.json). A suíte geral não foi repetida em C1, conforme a orientação de consolidar primeiro. As evidências históricas foram preservadas. `pnpm benchmark` usa somente TEST e gera 10 mil pacientes e 2 mil episódios fictícios por execução. `pnpm benchmark:inventory` cria mil posições fictícias, abastece por comandos e mede consultas/transferências. `pnpm benchmark:clinical` cria mil programações por comandos, mede mapa/execução/consumo e reconcilia saldos. `pnpm benchmark:daily` prepara mil avaliações e mede lista, avaliação e reavaliação, verificando limites e saldo preservado. `pnpm benchmark:financial` prepara mil recebimentos e mede consulta, avaliação, recebimento e liquidação com reconciliação dos saldos. `pnpm benchmark:exams` prepara mil resultados com três valores e mede lista, gravação e liberação, com hash conferido por HTTP. `pnpm benchmark:preventive` prepara mil ocorrências e mede lista, programação e aplicação externa sem alterar estoque. `pnpm benchmark:documents` prepara mil documentos e mede metadados, preenchimento e aprovação, com hash e entrega idempotente por HTTP local. `pnpm benchmark:schedule` prepara mil agendamentos, mede mapa/criação/reprogramação e verifica retry por HTTP sem efeitos clínicos ou financeiros. `pnpm benchmark:portal` prepara mil mensagens, mede caixa/preparação/tentativa e verifica conteúdo documental por HTTP com credencial de portal. Os benchmarks preservam execuções anteriores.

O workflow de CI é **manual**, limitado a `hvb-sistema-dev`; não foi disparado. Ações futuras com custos, serviços externos, DNS, produção e dados reais continuam dependendo de autorização.

- [Relatório M0 + M1](docs/RELATORIO-M0-M1.md)
- [Relatório M2](docs/RELATORIO-M2.md)
- [Relatório M3](docs/RELATORIO-M3.md)
- [Relatório M4](docs/RELATORIO-M4.md)
- [Relatório M5](docs/RELATORIO-M5.md)
- [Relatório M6A](docs/RELATORIO-M6A.md)
- [Relatório M6B](docs/RELATORIO-M6B.md)
- [Relatório M6C](docs/RELATORIO-M6C.md)
- [Relatório M6D](docs/RELATORIO-M6D.md)
- [Relatório M6E](docs/RELATORIO-M6E.md)
- [Relatório C1 — compras](docs/RELATORIO-C1.md)
- [Compras e recebimento](docs/adr/0012-compras-recebimento.md)
- [Dicionário C1](docs/DADOS-C1.md)
- [Portal e comunicação](docs/adr/0011-portal-comunicacao.md)
- [Dicionário M6E](docs/DADOS-M6E.md)
- [Próximos passos do núcleo funcional](docs/NUCLEO-FUNCIONAL.md)
- [Agenda e recursos](docs/adr/0010-agenda.md)
- [Dicionário M6D](docs/DADOS-M6D.md)
- [Discussões no chat e testes locais](docs/ROTEIRO-CHAT-E-TESTES.md)
- [Decisões de stack](docs/adr/0001-stack.md)
- [Integridade e acesso](docs/adr/0002-integridade-acesso.md)
- [Estoque físico e concorrência](docs/adr/0003-estoque-fisico.md)
- [Execução e consumo identificado](docs/adr/0004-clinica-consumo.md)
- [Diária configurável](docs/adr/0005-diaria-configuravel.md)
- [Comercial e financeiro](docs/adr/0006-comercial-financeiro.md)
- [Exames e resultados](docs/adr/0007-exames-resultados.md)
- [Protocolos preventivos](docs/adr/0008-protocolos-preventivos.md)
- [Documentos gerais](docs/adr/0009-documentos-gerais.md)
- [Dicionário M1](docs/DADOS-M1.md), [M2](docs/DADOS-M2.md), [M3](docs/DADOS-M3.md), [M4](docs/DADOS-M4.md), [M5](docs/DADOS-M5.md), [M6A](docs/DADOS-M6A.md), [M6B](docs/DADOS-M6B.md) e [M6C](docs/DADOS-M6C.md)
- [Pendências](docs/PENDENCIAS-HVB.md)
- [Precedência e proveniência](docs/PRECEDENCIA-E-FONTES.md)

As fontes originais foram preservadas em Downloads e copiadas para `.local/reference`, ignorada pelo Git. Fontes históricas não integram seeds nem o runtime. Toda alteração deste trabalho ficou sob `SISTEMA`; site e Terminal permanecem separados.

### Prontuário longitudinal C2

Evoluções com versões preservadas e linha do tempo de metadados, sem duplicar execução/consumo ou interpretar conteúdo clínico. O seed db:seed:medical cria narrativa e retificação fictícias; referências locais em .local/medical-record-demo.json. Detalhes e parâmetros em [DADOS-C2](docs/DADOS-C2.md), decisões em [ADR 0013](docs/adr/0013-prontuario-longitudinal.md).

Verificação pontual: pnpm check:medical, com 34 testes aprovados. A linha do tempo exige paciente/unidade e intervalo de registro; usa cursor composto em vez do cursor UUID das listas gerais. Texto integral exige permissão própria. Alta/saída retroativa preserva o relato e sinaliza divergência temporal. Ver [relatório C2](docs/RELATORIO-C2.md).

A consolidação segue pelo [roteiro do núcleo](docs/NUCLEO-FUNCIONAL.md). Revisão geral e pendências hospitalares ficam para depois, conforme orientação atual.

### Jornada integrada C3

pnpm db:seed:core compõe um cenário fictício com o mesmo paciente/episódio: execução, consumo hospitalar com custo, cobertura da execução, item comercial zero, evolução, documento e mensagem apenas preparada. Referências em .local/core-journey-demo.json. Repetir preserva os IDs; cada comando é atômico, e a jornada inteira não é uma única transação.

pnpm check:journeys executa a verificação pontual (nove testes aprovados). Consulte o [relatório C3](docs/RELATORIO-C3.md) e a [matriz de cobertura do núcleo](docs/COBERTURA-NUCLEO.md). Ainda faltam capacidades funcionais; assinatura, operação real, pendências humanas e verificação geral continuam etapas próprias.

### Contas a pagar C4

Obrigações de fornecedores e despesas com valores explícitos, pagamentos declarados, liquidações parciais, reversões e correção documental com histórico. Receber estoque não comprova dívida ou pagamento. Rotas sob /v1/a-pagar com permissões próprias e confirmação humana em simulação.

pnpm db:seed:payables demonstra obrigação 100, pagamento declarado 60 e saldo 40; referências locais em .local/payables-demo.json. Não executa pagamento real. pnpm check:payables verifica o recorte (24 testes aprovados). Ver [relatório C4](docs/RELATORIO-C4.md), [dicionário](docs/DADOS-C4.md) e [ADR 0014](docs/adr/0014-contas-pagar.md).

### Contrato legado de terminal C5

Rotas legadas sob /v1/terminal preservam configuração de etiquetas fictícias, leituras e consulta de comando. Desde C14, novas retiradas por esse caminho são bloqueadas. Leitura não é autenticação nem ato clínico. O contrato vigente está na [ADR 0028](docs/adr/0028-terminal-v1-canonico.md), que supersede funcionalmente ADRs 0015/0024 para o Terminal v1 e preserva o histórico.

pnpm db:seed:terminal demonstra apenas identificação, sem nova retirada. Referências em .local/terminal-demo.json, sem credenciais. O recorte legado preserva leituras e agora verifica bloqueio de novas retiradas; integra check:terminal-access. O código permanece dentro de SISTEMA; nenhuma edição ou execução do projeto Terminal.

Em resposta perdida, consultar/repetir a mesma chave e corpo; não criar uma nova intenção automaticamente. Ver [contrato e limites](docs/adr/0015-terminal-simulado.md), [dicionário](docs/DADOS-C5.md) e [relatório C5](docs/RELATORIO-C5.md).


### Preços e conciliação de compras C6

Preços por apresentação versionados, componentes explícitos e conciliação parcial com obrigações de fornecedor. O vínculo respeita o orçamento do pedido entre versões e o valor da obrigação; não cria pagamento nem altera custo físico. Reversões preservam o histórico.

pnpm db:seed:pricing demonstra preço 105, obrigação 100 e vínculo 100, com saldo comercial 5. pnpm check:pricing executa o recorte de 23 testes. Ver [relatório C6](docs/RELATORIO-C6.md), [dicionário](docs/DADOS-C6.md) e [decisões/limites](docs/adr/0016-precos-conciliacao-compras.md). C7 acrescenta o rateio de aquisição abaixo; pendências e verificação geral serão tratadas depois.


### Custo de aquisição C7

Rateio explícito de frete/acréscimo/desconto entre os itens do pedido e custo atribuído a cada entrada recebida. Componentes fecham contra a precificação; recebimentos parciais respeitam orçamento e quantidade. Revisão e reversão preservam histórico; preço posterior fica sinalizado. Custos analíticos de aquisição não reescrevem o custo físico do lote ou de consumos anteriores.

pnpm db:seed:acquisition demonstra rateio 105, entradas de duas e três caixas, custos 42 e 63. pnpm check:acquisition executa o recorte de 32 testes. Ver [relatório C7](docs/RELATORIO-C7.md), [dicionário](docs/DADOS-C7.md) e [decisões/limites](docs/adr/0017-custo-aquisicao.md). C8 acrescenta o plano de parcelas abaixo.


### Parcelas de fornecedores C8

Plano integral com versões, datas e valores explícitos. Liquidações existentes podem ser distribuídas entre parcelas sem criar nova dívida ou pagamento. Reprogramação e reversões preservam histórico; valores liquidados ainda sem parcela ficam visíveis. Nenhum débito é agendado automaticamente.

pnpm db:seed:installments demonstra obrigação 100, parcelas 40/60, liquidação 60 e saldos 0/40. pnpm check:installments executa o recorte de 25 testes. Ver [relatório C8](docs/RELATORIO-C8.md), [dicionário](docs/DADOS-C8.md) e [decisões/limites](docs/adr/0018-parcelas-fornecedores.md). C9 acrescenta o crédito comercial abaixo.


### Crédito comercial de fornecedores C9

Crédito com origem/documento explícitos, aplicação parcial à obrigação e saldo próprio. A aplicação usa a liquidação original e pode quitar parcelas sem criar pagamento bancário. Reversões e correções preservam histórico; não há devolução física automática.

pnpm db:seed:supplier-credit demonstra crédito 60, aplicação 40, crédito disponível 20 e dívida 60. pnpm check:supplier-credit executa 37 testes pontuais. Ver [relatório C9](docs/RELATORIO-C9.md), [dicionário](docs/DADOS-C9.md) e [mudanças de contrato](docs/adr/0019-credito-fornecedor.md). C10 acrescenta conciliação de saídas abaixo. C8–C13 permanecem locais; publicação e pendências serão tratadas após o ciclo básico.


### Conciliação de saídas C10

Pagamentos declarados podem ser conciliados parcialmente com saídas de extrato da mesma conta, com vínculos explícitos, saldos e histórico. Conciliação não liquida dívida nem cria operação bancária; crédito comercial permanece separado.

pnpm db:seed:supplier-outflow demonstra pagamento 60, extrato 100, conciliação 60 e residual 40. pnpm check:supplier-outflow executa 26 testes pontuais. Ver [relatório C10](docs/RELATORIO-C10.md), [dicionário](docs/DADOS-C10.md) e [decisões](docs/adr/0020-conciliacao-saidas.md). C11 acrescenta os complementos do prontuário abaixo.


### Complementos do prontuário C11

Modelos versionados organizam texto informado na evolução original. Anexos privados de até 256 KiB e declarações pessoais de coautoria apontam para a versão exata; retificações preservam o histórico. Busca textual exige paciente/unidade e permissão de conteúdo clínico. Coautoria não equivale a assinatura válida.

pnpm db:seed:medical-complements demonstra modelo, preenchimento, anexo e busca com dados fictícios. pnpm check:medical-complements executa 31 testes pontuais. Ver [relatório C11](docs/RELATORIO-C11.md), [dicionário](docs/DADOS-C11.md) e [decisões/limites](docs/adr/0021-complementos-prontuario.md). C12 acrescenta vínculos/auditoria abaixo. Pendências e publicação seguem para depois da consolidação.


### Vínculos e auditoria C12

Agenda e episódio podem ser relacionados explicitamente para o mesmo paciente/unidade, com revogação e histórico. Consultas identificadas internas e do portal geram trilha persistente; falha de gravação retém o resultado. Tokens, narrativa e termos de busca não são copiados para a auditoria.

pnpm db:seed:links-audit demonstra um vínculo e a trilha de consulta, sem inferir execução clínica. pnpm check:links-audit executa 58 testes pontuais. Ver [relatório C12](docs/RELATORIO-C12.md), [dicionário](docs/DADOS-C12.md) e [limites](docs/adr/0022-vinculos-auditoria.md). Os grupos C1–C12 têm entregas DEV; [refinamentos funcionais ainda pendentes](docs/FECHAMENTO-CICLO-BASICO.md) impedem declarar completude integral do núcleo.


### Revisões cadastrais e acesso C13

Correções de dados básicos preservam IDs e histórico antes/depois. Nome/capacidade dos locais têm revisão concorrente segura com ocupações. Atribuições de papel podem ser revogadas/restauradas; a autorização usa o estado vigente. GET /atribuicoes inclui ativo e versao.

pnpm db:seed:registry demonstra revisão de paciente/capacidade e revogação/restauração de uma atribuição própria. pnpm check:registry executa 43 testes pontuais. Ver [relatório C13](docs/RELATORIO-C13.md), [dicionário](docs/DADOS-C13.md) e [decisões](docs/adr/0023-revisoes-cadastros-acesso.md). Etapa concluída em DEV; continuidade avançou em C15/C16, com financeiro do cliente como próxima frente.

### Verificação Terminal V2

Recorte: `pnpm check:terminal-access` (41 testes). Demonstração local: `pnpm db:seed:terminal-access`; repetições verificam o mesmo manifesto concluído, sem duplicar o cenário. Migrations 065–066; versão 0.23.0; 399 operações/242 caminhos. Auditoria, ADR 0024 e pendências atualizadas em docs. C8–C14 continuam locais, com publicação adiada conforme o bloqueio já registrado. Correções de diárias entregues no recorte C16; próxima frente: financeiro do cliente.

### Correção clínica C15

`pnpm check:clinical-corrections` verifica clínica e dependências atingidas (109 testes). `pnpm db:seed:clinical-corrections` demonstra correção e anulação pelos mesmos comandos nas repetições. Versão 0.24.0, migrations 067–068, 402 operações em 245 caminhos. C8–C15 permanecem locais; publicação e verificação geral seguem adiadas. Contrato/limites: [DADOS-C15](docs/DADOS-C15.md) e [ADR 0025](docs/adr/0025-correcao-clinica.md).


## C16 — Correção de diárias

`pnpm check:daily-corrections` executa 68 testes pontuais. `pnpm db:seed:daily-corrections` demonstra correção e cancelamento de período/associação, repetíveis pelos mesmos comandos. Versão 0.25.0, migrations 069–070, 408 operações em 251 caminhos. C8–C16 permanecem locais; publicação e verificação geral seguem adiadas. Contrato/limites: [DADOS-C16](docs/DADOS-C16.md) e [ADR 0026](docs/adr/0026-correcao-diarias.md).


## C17 — Correções financeiras

`pnpm check:financial-corrections`: 56 testes pontuais aprovados. `pnpm db:seed:financial-corrections`: demonstração repetível com referências em .local/financial-corrections-demo.json. Versão 0.26.0, migrations 071–072, 416 operações em 259 caminhos. C8–C17 continuam locais, com publicação e verificação geral adiadas. [Contratos C17](docs/DADOS-C17.md). Próxima ação: receber e avaliar o delta intermediário, sem iniciar o módulo seguinte.

## C18 — Contrato Terminal v1

`node scripts/check.mjs --terminal-v1` (ou `pnpm check:terminal-v1`): 78 testes pontuais aprovados, incluindo 20 jornadas/falhas novas. Migrations 073–076, versão 0.27.0, 451 operações/288 caminhos, 220 tabelas/77 views. As 416 operações anteriores foram preservadas integralmente. Migrations aplicadas e auditadas DEV/TEST; sem novo seed operacional DEV. Os cenários de teste usam dados sintéticos e injetam o simulador explicitamente. C8–C18 permanecem locais. [Ponto atual de continuidade](docs/PONTO-DE-PARADA-C18.md).
