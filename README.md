# HVB Sistema

Fundação de desenvolvimento **M0 + M1** e estoque físico **M2**, em `hvb-sistema-dev`. API modular, PostgreSQL real local e worker. Dados exclusivamente fictícios. Produto: **HVB Sistema**; `Core` designa somente o domínio interno.

Implementado: organização/unidades, contas individuais, papéis/permissões, credenciais opacas e revogação, dispositivos, responsáveis/pacientes/vínculos, episódios, locais/ocupações, comandos idempotentes, auditoria, outbox/inbox e proveniência sintética com FKs tipadas. A organização inicial nasce pelo bootstrap administrativo local.

M2 acrescenta unidades de medida, produtos, apresentações versionadas, lotes, recipientes, custódia hospital/tutor, posições, reservas, entrada, transferência, retirada, devolução, perda, reversão e inventário com ajuste. Retirada transfere para destino identificado; não registra execução clínica, consumo ou cobrança.

Este lote entrega backend e contratos. Não inclui telas, execução clínica M3, regras de diária, cobrança, integração com Terminal, migração real ou produção.

## Executar neste Windows

Requisitos: Node **24**, pnpm **11.19.0**. O wrapper abaixo usa o pnpm disponível ou o runtime já existente no Codex. Não instala nada globalmente.

```powershell
Set-Location 'C:\Users\Admin\OneDrive\BESKEL\PARCEIROS\HVB\SISTEMA'
.\scripts\pnpm.ps1 install --frozen-lockfile --store-dir .local/pnpm-store
.\scripts\pnpm.ps1 db:local
.\scripts\pnpm.ps1 db:migrate
.\scripts\pnpm.ps1 db:seed
.\scripts\pnpm.ps1 db:seed:inventory
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
pnpm check
pnpm dev
```

O gerador não sobrescreve `.env`. Não executar os dois bancos na porta 55432 simultaneamente. O Compose guarda dados em `.local/docker-postgres` e só publica a porta de loopback. A configuração Docker/CI está entregue; Docker e o runner Linux não foram executados neste computador. O caminho validado neste lote é PostgreSQL nativo no Windows.

## Verificação e documentação

`pnpm check` exige a branch autorizada e executa typecheck, lint, formatação, testes unitários, migrations, integração PostgreSQL e OpenAPI. Evidências atuais: [35 testes M1/M2](docs/evidencias/checks-m2.json) e [benchmark e HTTP M2](docs/evidencias/benchmark-m2.json). As evidências históricas de M1 foram preservadas. `pnpm benchmark` usa somente TEST e gera 10 mil pacientes e 2 mil episódios fictícios por execução. `pnpm benchmark:inventory` cria mil posições fictícias em TEST, abastece por comandos, mede consultas/transferências e reconcilia saldos com lançamentos. Ambos preservam execuções anteriores.

O workflow de CI é **manual**, limitado a `hvb-sistema-dev`; não foi disparado. Ações futuras com custos, serviços externos, DNS, produção e dados reais continuam dependendo de autorização.

- [Relatório M0 + M1](docs/RELATORIO-M0-M1.md)
- [Relatório M2](docs/RELATORIO-M2.md)
- [Decisões de stack](docs/adr/0001-stack.md)
- [Integridade e acesso](docs/adr/0002-integridade-acesso.md)
- [Estoque físico e concorrência](docs/adr/0003-estoque-fisico.md)
- [Dicionário M1](docs/DADOS-M1.md) e [dicionário M2](docs/DADOS-M2.md)
- [Pendências](docs/PENDENCIAS-HVB.md)
- [Precedência e proveniência](docs/PRECEDENCIA-E-FONTES.md)

As fontes originais foram preservadas em Downloads e copiadas para `.local/reference`, ignorada pelo Git. Fontes históricas não integram seeds nem o runtime. Toda alteração deste trabalho ficou sob `SISTEMA`; site e Terminal permanecem separados.
