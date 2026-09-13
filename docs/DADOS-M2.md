# Dicionário físico resumido — M2

Complementa o dicionário histórico M1. As migrations 006–010 acrescentam 12 tabelas ao schema `hvb`: total de 34, além de `public.schema_migration`, e uma view de consulta. DDL completo em `migrations/`.

| Tabela | Finalidade e integridade |
|---|---|
| unidade | Unidade de medida, dimensão contagem/massa/volume e fator de referência declarado; distinta de unidade_hospitalar |
| produto | Identidade de produto, finalidade e unidade base explícita |
| apresentacao | Código e versão imutável; anterior tipada do mesmo produto; conteúdo e conversão dimensional verificados |
| lote | Produto/apresentação tipados, fabricante/código, validade conhecida/pendente/isenta e custo base opcional |
| recipiente | Identificação dentro do lote, instante de abertura, regra informada e validade após abertura opcional |
| custodia | Hospital ou tutor; tutor exige paciente, episódio opcional compatível; não transfere propriedade por inferência |
| posicao_estoque | Unidade hospitalar/local/lote/recipiente/custódia únicos, inclusive recipiente nulo; saldo, reserva, disponível e versão |
| reserva | Quantidade positiva, expiração, autor, situação e encerramento; projeção na posição sem alterar saldo físico |
| sessao_inventario | Sessão por local, autor, motivo e estado aberta/encerrada |
| contagem_posicao | Quantidade contada, saldo e versão observados, autor/data; estado pendente/aplicada/conferida e autoria de aplicação |
| transacao_estoque | Comando e autor, tipo físico, origem/destino, quantidade/custo/conversão preservados, raiz/devolução/reversão/reserva/contagem tipadas |
| lancamento_estoque | Dois lados imutáveis por transação, quantidade assinada e posição ou contrapartida virtual explícita |

`lancamento_estoque_consulta` junta lançamentos ao cabeçalho para expor unidade, tipo, custo, autoria e data. Usa `security_invoker=true`, mantendo RLS dos dados de origem e filtro de unidade na API.

Quantidades e fatores usam `numeric(20,6)` finito, com sinal permitido somente onde necessário. A API aceita strings decimais com até 14 dígitos inteiros e seis casas; cálculos de conversão usam BigInt escalado e rejeitam arredondamento. Custo desconhecido é nulo; zero é um custo explicitamente informado. Custo do material sob custódia do tutor é nulo no movimento hospitalar.

Saldos são projeções de lançamentos; disponível é gerado como saldo menos reservado. Constraints impedem saldo negativo e reserva superior ao físico. Triggers atualizam projeções e verificam, no commit, o par balanceado e vínculos obrigatórios de reserva efetivada/contagem aplicada. O papel da API não pode editar saldo nem inserir um movimento incompleto confirmado.

Os novos índices atendem posições por unidade/lote, lotes por produto e vínculos de movimentos. As unicidades organizacionais também atendem paginação por UUID; índices duplicados foram removidos na migration 010. Plano de execução e reconciliação real estão em `docs/evidencias/benchmark-m2.json`.

Catálogo, lote e recipiente são imutáveis neste recorte. Abertura/fracionamento de estoque existente, retificação, mudança de custódia, interunidades e recontagem com cancelamento permanecem em `PENDENCIAS-HVB.md`.
