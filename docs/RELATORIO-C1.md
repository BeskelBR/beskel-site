# Relatório C1 — Consolidação de compras e estoque

Data: 14/09/2026. Continuidade do núcleo funcional, mantendo a resolução das pendências e a verificação geral para depois, conforme orientação do usuário. Alterações somente em SISTEMA/hvb-sistema-dev.

## Entrega

Fornecedor, pedido com itens, aprovação/cancelamento e recebimento parcial por lote/posição. Receber executa a entrada M2 na mesma transação e vincula cada linha ao mesmo ID físico. Falhas desfazem todo o lote de entradas, e repetição não duplica saldo. Cancelamento preserva histórico; reversão física atualiza a quantidade recebida ativa sem gerar crédito financeiro.

Migrations 039–040, seis tabelas e três views novas; 290 operações HTTP em 176 caminhos. Sem dependências novas. Seed fictício demonstra pedido de cinco caixas de dez unidades e recebimento de duas caixas: vinte unidades na custódia hospitalar, três caixas ainda não recebidas. Referências locais em `.local/purchases-demo.json`, ignoradas pelo Git. Nenhum pedido foi enviado ao fornecedor.

## Verificação pontual

**29 testes aprovados neste recorte**: cinco unitários, quinze de estoque existente e nove de compras. Casos cobrem parcial, fator decimal, retry, concorrência acima do pedido, rollback de múltiplas entradas, apresentação/custódia/pedido divergentes, cancelamento, reversão, RBAC/unidade/RLS e histórico imutável.

TypeScript estrito, lint, formatação, migrations nas bases locais existentes e OpenAPI aprovados. Evidência: [checks-c1-focused.json](evidencias/checks-c1-focused.json). Comando reproduzível: `pnpm check:purchases`.

A suíte geral anterior de 152 testes permanece como evidência histórica do M6E. Não foi repetida neste bloco; não se afirma que a suíte inteira atual foi executada. Instalação em base vazia, benchmark, HTTP real separado, Docker/Linux e CI também ficam para verificação posterior. `pnpm check` inclui os novos testes quando a verificação geral for retomada, sem sobrescrever as evidências anteriores.

## Continuidade

Preços, custos contábeis, alçadas, documento fiscal, contas a pagar e regras comerciais de devolução não foram presumidos. Este recorte fecha o vínculo físico pedido–recebimento–entrada, não todo o ciclo financeiro de aquisição.

Próximo recorte técnico: consolidação do prontuário longitudinal e das relações entre os fatos já persistidos. A conferência global da cobertura do escopo permanece aberta antes de declarar o núcleo concluído. As [pendências cumulativas](PENDENCIAS-HVB.md) continuam para discussão posterior. Ver [roteiro do núcleo](NUCLEO-FUNCIONAL.md) e [ADR](adr/0012-compras-recebimento.md).

Sem dados reais, comunicação externa, SimplesVet, M7, deploy, Vercel/Cloudflare ou infraestrutura paga. As demais branches e pastas do HVB não foram alteradas.
