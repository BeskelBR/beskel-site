# Dicionário C13 — Revisões cadastrais e de acesso

Versão 0.22.0, migrations 063–064. Duas tabelas, uma view, duas permissões e 14 operações novas. Totais: 184 tabelas, 70 views, 119 permissões e 384 operações em 231 caminhos.

| Entidade | Conteúdo e invariantes |
|---|---|
| revisao_cadastro | Tipo e alvo com FK específica, unidade quando aplicável, versão, anterior, antes/depois, autor, motivo, comando e criação; atualização do cadastro e história na mesma transação |
| revisao_atribuicao | Atribuição original, versão, anterior e ativo; alternância entre revogação e restauração, sem apagar concessão original |
| atribuicao_consulta | Atribuição original e estado atual; ativo=true/versao=0 antes da primeira revisão |

As tabelas de revisões têm RLS e são imutáveis. Antes da primeira correção, versão cadastral é zero. A primeira revisão captura os valores anteriores diretamente do banco; o cliente não fornece o estado anterior. IDs e referências originais permanecem estáveis.

## Contratos sob /v1

Cada caminho abaixo recebe POST para revisar e GET para consultar estado atual e histórico paginado.

| Caminho | Campos revisáveis / estado | Escrever / ler |
|---|---|---|
| /pacientes/:id/revisoes | nome, especie_codigo, estado_vital | cadastros:retificar / cadastros:ler |
| /responsaveis/:id/revisoes | nome | cadastros:retificar / cadastros:ler |
| /usuarios/:id/revisoes | nome, login | acesso:administrar |
| /unidades/:id/revisoes | nome | acesso:administrar |
| /dispositivos/:id/revisoes | nome | acesso:administrar |
| /locais/:id/revisoes | nome, capacidade | locais:retificar / locais:ler, na unidade |
| /atribuicoes/:id/revisoes | ativo booleano explícito | acesso:administrar global |

POST recebe motivo, versao_esperada (zero na primeira revisão), simulacao=true, confirmacao_humana=true e chave idempotente. Cadastros recebem dados com todos os campos revisáveis do tipo; atribuições recebem ativo. Locais exigem também unidade_id. Resultado contém ID da revisão, versão e metadados do comando. Revisão sem mudança, versão desatualizada ou transição de acesso repetida é recusada.

GET recebe limit de 1–100 e cursor UUID; locais exigem unidade_id. Retorna ID original, versão atual e histórico com autor, comando, motivo e instante. Cadastros acrescentam atual e antes/depois; atribuições incluem usuário, papel, unidade e ativo. Respostas seguem auditoria de consulta C12.

**Mudança no contrato existente:** GET /atribuicoes acrescenta ativo e versao. A lista conserva atribuições revogadas para histórico; consumidores devem verificar ativo. Os demais contratos anteriores permanecem iguais. Leituras cadastrais existentes passam a mostrar os valores atuais corrigidos, mantendo os mesmos IDs.

Ver [OpenAPI](../openapi/hvb-sistema.json), [ADR](adr/0023-revisoes-cadastros-acesso.md) e [relatório](RELATORIO-C13.md).
