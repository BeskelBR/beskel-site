# Relatório C5 — Contrato executável de terminal simulado

Data: 15/09/2026. Versão 0.14.0. Trabalho exclusivamente em SISTEMA/hvb-sistema-dev; Terminal permanece congelado.

## Entrega

Etiquetas fictícias de paciente/posição, revogação, leitura com autoria/dispositivo/contexto explícito, retirada confirmada sobre o mesmo movimento de estoque e consulta do comando por chave. A leitura isolada não movimenta estoque nem cria ato clínico. Retirada mantém transferência física separada de consumo/administração.

Migrations 047–048, quatro tabelas, duas views, três permissões e nove operações. Totais: 156 tabelas, 49 views, 102 permissões e 313 operações em 189 caminhos. Sem dependências novas. A checagem compartilhada de dispositivo trava sua linha durante o comando, fechando a janela de concorrência com desativação.

Seed db:seed:terminal executado no DEV sintético: leitura e retirada explícita de duas unidades, origem 18/destino 2, sem execução clínica. IDs e chave em .local/terminal-demo.json, ignorados pelo Git. Não contém credenciais. Nenhum equipamento NFC ou aplicativo Terminal foi acionado.

## Verificação pontual

**28 testes aprovados:** cinco unitários, quinze de fundação e oito de terminal. Evidência: [checks-c5-focused.json](evidencias/checks-c5-focused.json), comando pnpm check:terminal.

Casos: leitura sem efeito físico/clínico, paciente sem episódio inferido, retirada e mesmo ID físico, retry concorrente, uma retirada por leitura, recuperação da confirmação por chave, rejeição de confirmação implícita/NFC como credencial, revogação entre leitura/confirmação, outro operador/dispositivo, episódio divergente/encerrado, RLS/unidade/saldo, histórico e desativação concorrente aguardada antes do comando.

TypeScript, lint, formatação, migrations nas bases locais existentes e OpenAPI aprovados. Os testes usam Fastify por injeção e PostgreSQL real local; não simulam hardware ou conectividade real. Suíte geral, instalação vazia, benchmark, CI e HTTP por socket separado permanecem posteriores. Evidências anteriores preservadas, e pnpm check inclui os testes novos.

## Continuidade

C5 conclui esse contrato de simulação no servidor, sem cliente visual, driver NFC, offline, autenticação operacional, leitura física ou publicação. Política de sessões, expiração do contexto, identificadores físicos e confirmação no equipamento precisa de validação própria. Resposta perdida continua desconhecida até consulta/retry com a mesma chave; não foi implementada fila offline.

O núcleo ainda possui capacidades parciais na matriz. Próximo recorte: preços negociados e vínculo explícito entre compra e obrigação, sem inferir política fiscal ou custo contábil. Pendências humanas e verificação geral continuam para depois.

Nenhuma alteração em demais pastas/branches, dados reais, SimplesVet/M7, mensagens externas, Vercel/Cloudflare, DNS ou infraestrutura paga. Ver [dicionário](DADOS-C5.md), [ADR](adr/0015-terminal-simulado.md) e [matriz](COBERTURA-NUCLEO.md).
