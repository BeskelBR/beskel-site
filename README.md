# HVB Sistema

Fundação **M0 + M1**, estoque físico **M2**, clínica operacional **M3**, diárias configuráveis **M4**, recorte comercial/financeiro **M5**, exames/resultados **M6A**, protocolos preventivos **M6B** e documentos gerais **M6C**, em `hvb-sistema-dev`. API modular, PostgreSQL real local e worker. Dados exclusivamente fictícios. Produto: **HVB Sistema**; `Core` designa somente o domínio interno.

Implementado: organização/unidades, contas individuais, papéis/permissões, credenciais opacas e revogação, dispositivos, responsáveis/pacientes/vínculos, episódios, locais/ocupações, comandos idempotentes, auditoria, outbox/inbox e proveniência sintética com FKs tipadas. A organização inicial nasce pelo bootstrap administrativo local.

M2 acrescenta unidades de medida, produtos, apresentações versionadas, lotes, recipientes, custódia hospital/tutor, posições, reservas, entrada, transferência, retirada, devolução, perda, reversão e inventário com ajuste. Retirada transfere para destino identificado; não registra execução clínica, consumo ou cobrança.

M3 acrescenta item clínico, prescrição, ordem versionada, programação, confirmação de execução, material previsto, consumo identificado, estorno e pendências clínicas. A execução não baixa estoque automaticamente; material desconhecido permanece pendente.

M4 acrescenta classificação versionada, peso referenciado, pacotes, grupos, regras, períodos explícitos e avaliação de cobertura com reserva, reversão e histórico. **Somente simulação**: as regras reais do hospital permanecem pendentes.

M5 acrescenta catálogo/preço versionados, conta, avaliação comercial, responsabilidade, título, recebimento, liquidação, crédito, caixa, parcelas da adquirente, depósito e conciliação. São comandos **somente de simulação**, sem dinheiro real ou integração externa. Diária ambígua permanece pendente; inclusão documenta valor zero sem inventar devedor. Este lote entrega backend e contratos, sem telas, Terminal, migração real ou produção. O código fica no GitHub; Vercel e Cloudflare serão configurados pelo usuário. O backend atual exige PostgreSQL local e não está adaptado à execução serverless.

M6A acrescenta catálogo técnico, solicitações, coletas, avaliação de amostras, resultados estruturados e correções versionadas. A liberação humana DEV preserva conteúdo e hash verificável, sem interpretação clínica automática. M6B acrescenta protocolos versionados, adesão do paciente, recorrência em dias/calendário, aplicações internas/externas, revisão de atrasos e vínculo com consumo físico. M6C acrescenta modelos e campos versionados, autorização, conteúdo privado com hash, aprovação, declaração de assinatura não verificada e registro de entrega simulado. **M6 está em andamento**; agenda, portal/comunicação e interface são próximos recortes.

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

Todas as listas usam `limit` (padrão 25, máximo 100) e `cursor` UUID. Episódios, locais e ocupações exigem `unidade_id`; episódios aceitam `paciente_id` e `ativos`. A paginação usa ordem por UUID imutável; não promete ordenação cronológica. Os dados de um registro recém-inserido com UUID anterior ao cursor aparecem ao reiniciar a consulta.

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

`pnpm check` exige a branch autorizada e executa typecheck, lint, formatação, testes unitários, migrations, integração PostgreSQL e OpenAPI. Evidências atuais: [126 testes M1–M6C](docs/evidencias/checks-m6c.json) e [benchmark e HTTP M6C](docs/evidencias/benchmark-m6c.json). As evidências históricas foram preservadas. `pnpm benchmark` usa somente TEST e gera 10 mil pacientes e 2 mil episódios fictícios por execução. `pnpm benchmark:inventory` cria mil posições fictícias, abastece por comandos e mede consultas/transferências. `pnpm benchmark:clinical` cria mil programações por comandos, mede mapa/execução/consumo e reconcilia saldos. `pnpm benchmark:daily` prepara mil avaliações e mede lista, avaliação e reavaliação, verificando limites e saldo preservado. `pnpm benchmark:financial` prepara mil recebimentos e mede consulta, avaliação, recebimento e liquidação com reconciliação dos saldos. `pnpm benchmark:exams` prepara mil resultados com três valores e mede lista, gravação e liberação, com hash conferido por HTTP. `pnpm benchmark:preventive` prepara mil ocorrências e mede lista, programação e aplicação externa sem alterar estoque. `pnpm benchmark:documents` prepara mil documentos e mede metadados, preenchimento e aprovação, com hash e entrega idempotente por HTTP local. Os benchmarks preservam execuções anteriores.

O workflow de CI é **manual**, limitado a `hvb-sistema-dev`; não foi disparado. Ações futuras com custos, serviços externos, DNS, produção e dados reais continuam dependendo de autorização.

- [Relatório M0 + M1](docs/RELATORIO-M0-M1.md)
- [Relatório M2](docs/RELATORIO-M2.md)
- [Relatório M3](docs/RELATORIO-M3.md)
- [Relatório M4](docs/RELATORIO-M4.md)
- [Relatório M5](docs/RELATORIO-M5.md)
- [Relatório M6A](docs/RELATORIO-M6A.md)
- [Relatório M6B](docs/RELATORIO-M6B.md)
- [Relatório M6C](docs/RELATORIO-M6C.md)
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
