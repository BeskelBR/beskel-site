# Dicionário M5 — Comercial e financeiro

Migrations 017–023 acrescentam 24 tabelas e 15 views ao schema `hvb`: total de 86 tabelas de domínio e 24 views. Organização, unidade hospitalar, autor, comando e motivo acompanham todas as tabelas novas. FKs compostas e RLS forçada mantêm contexto. Tabelas são imutáveis, com eventos próprios de reversão/fechamento.

`valor_monetario` é decimal não negativo menor que 100 trilhões e com até duas casas, sem coerção de escala. A API aceita strings; não usa ponto flutuante. BRL é a moeda única implícita do recorte. Quantidade comercial usa seis casas; conversão para centavos exige resultado exato. Campos monetários nulos em avaliação pendente representam informação não fechada.

| Tabela | Responsabilidade |
|---|---|
| `pagador` | Responsável cadastrado, identificado por unidade; sem devedor hospitalar fictício |
| `item_comercial_versao` | Código/versão, descrição, tipo e unidade; produto físico explicitamente referenciado quando aplicável |
| `preco_versao` | Versão consecutiva do preço e vigência [início, fim), sem sobreposição |
| `conta` | Documento por episódio; múltiplas contas permitidas |
| `evento_cobravel` | Uma origem entre execução, item de consumo ou período de diária; item comercial, quantidade e competência |
| `avaliacao_cobranca` | Versão/anterior, preço e cobertura referenciados; bruto, desconto, benefício e valor final separados; justificativa |
| `item_conta` | Avaliação única documentada, descrição e valor preservados; inclusive zero |
| `responsabilidade` | Pagador e valor positivo por item; rateio integral confirmado junto com item |
| `titulo` | Pagador, vencimento e valor devido; não é recebimento |
| `titulo_item` | Parcela da responsabilidade distribuída ao título; limita soma ativa e fecha cabeçalho |
| `caixa` | Ponto de caixa identificado, separado de usuário |
| `sessao_caixa` | Abertura, autor e valor informado; uma sessão aberta por caixa |
| `fechamento_caixa` | Horário, contado, esperado e diferença preservados; sem ajuste fictício para zerar diferença |
| `recebimento` | Pagador, meio, referência do fato, valor, horário e evidência; dinheiro exige sessão aberta |
| `liquidacao` | Alocação de recebimento a título do mesmo pagador, limitada nos dois lados |
| `credito_cliente` | Saldo de recebimento convertido em crédito do mesmo pagador; não duplica entrada |
| `aplicacao_credito` | Crédito aplicado a título sob a mesma transação, sem novo recebimento |
| `parcela_adquirente` | Recebimento de cartão, número, adquirente/referência, bruto, taxa, líquido e data prevista |
| `conta_financeira` | Destino bancário fictício identificado; sem credenciais bancárias |
| `deposito_adquirente` | Depósito manual identificado, valor/data/evidência; separado do recebimento do tutor |
| `alocacao_deposito` | Valor do depósito associado à parcela; admite depósito agregado e saldo parcial |
| `item_extrato` | Entrada manual fictícia do extrato, conta, referência, data e evidência |
| `vinculo_conciliacao` | Conferência humana entre depósito e extrato, limitada aos valores disponíveis |
| `reversao_financeira` | Exatamente uma FK tipada: item, título, recebimento, liquidação, crédito, aplicação, alocação de depósito ou conciliação |

Views de consulta calculam saldos e flags: `titulo_consulta`, `recebimento_consulta`, `credito_consulta`, `sessao_caixa_consulta`, `parcela_adquirente_consulta`, `deposito_consulta`, `extrato_consulta`, `evento_cobravel_consulta`, `avaliacao_cobranca_consulta`, `item_conta_consulta`. Cinco views internas selecionam liquidações, créditos, aplicações, alocações e conciliações ativas.

Não somar documento revertido como dívida vigente. `valor` é o original; `revertido`, saldos e `necessita_revisao` têm significado distinto. Extrato e depósito ainda não conciliados mantêm o valor pendente explícito, sem conclusão por similaridade de texto.

O banco trava o contexto financeiro por organização/unidade com `pg_advisory_xact_lock`, incluindo inserção SQL direta. Não amplia permissão de alteração de `unidade_hospitalar`. Eventos/avaliações/itens também travam o episódio ao conferir origem clínica. Rateios de item e título são constraints diferidas, e nenhum registro pode ser anexado a comando já concluído.

`antecedente_comercial_ativo` acompanha execução retificada e consumo substituto vinculado à mesma execução para impedir cobrança substituta enquanto existir item anterior ativo. Identidades novas de consumo avulso não podem ser reconhecidas como substitutas por nome ou proximidade temporal.

Permissões: `financeiro:ler`, `configurar`, `avaliar`, `emitir`, `receber`, `alocar`, `credito`, `caixa`, `conciliar`, `reverter` (todas com prefixo `financeiro:`). Os endpoints exigem confirmação de simulação. Papéis reais, fluxo fiscal e operação bancária seguem pendentes.

Referências: [OpenAPI](../openapi/hvb-sistema.json), [ADR 0006](adr/0006-comercial-financeiro.md), [relatório M5](RELATORIO-M5.md) e [pendências](PENDENCIAS-HVB.md).
