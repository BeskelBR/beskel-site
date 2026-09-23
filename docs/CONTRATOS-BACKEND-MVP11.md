# Contratos do backend para o frontend MVP 11

Delta aditivo de 23/09/2026 sobre `31c931d173095b6e9c82dc9e567f0ba5e3b55742`. Escopo: backend e seus contratos; frontend, BFF `/session`, banco/migrations e Terminal não editados. A API continua DEV/loopback, com Bearer opaco. O [OpenAPI executável](../openapi/hvb-sistema.json) é a definição completa dos schemas.

## Endpoints entregues

| Método e rota | Autorização | Resultado |
|---|---|---|
| GET `/v1/papeis/{id}/permissoes` | `acesso:administrar` global na organização | `{papel_id, nome, permissoes: string[]}` com códigos ordenados |
| POST `/v1/usuarios/onboarding` | `acesso:administrar` global na organização | Usuário e 1–50 atribuições na mesma transação/comando |
| POST `/v1/estoque/entradas-completas` | `estoque:catalogar` global + `estoque:movimentar` na unidade; se compra, também `compras:receber` na unidade | Lote novo, custódia hospitalar resolvida, posição M2 e entrada física na mesma transação/comando |
| GET `/v1/pacientes?q=...&limit=25&cursor=...` | `cadastros:ler` global na organização, como antes | Mesmo `{items, next_cursor}`, com filtro no servidor antes da paginação |

Global significa todas as unidades da **organização autenticada**, nunca todas as organizações. Permissão concedida apenas em unidade não equivale à global. Organização e autor vêm da autenticação, não do corpo.

POSTs exigem os headers Bearer e `Idempotency-Key` já existentes. Uma intenção usa a mesma chave e o mesmo corpo nos retries; mudança de corpo com chave confirmada retorna 409. Sucesso HTTP 200 mantém `{id, comando_id, estado:"confirmado", repetido}`. Falha reverte domínio, comando, auditoria e outbox; não há cadastro intermediário confirmado. Os contratos antigos separados continuam disponíveis.

## Funcionário e atribuições

Corpo mínimo (UUIDs substituídos por placeholders):

```json
{
  "nome": "Funcionário Fictício",
  "login": "funcionario.dev",
  "motivo": "Cadastro sintético aprovado",
  "atribuicoes": [
    {"papel_id": "UUID_PAPEL", "unidade_id": "UUID_UNIDADE"}
  ]
}
```

Omitir `unidade_id` significa atribuição global; não enviar `null`. A UI deve tornar essa escolha explícita. Nome/motivo seguem texto não vazio até 160 caracteres; login segue `^[a-z0-9._-]{3,80}$`. Atribuições repetidas são recusadas. Papéis/unidades de outra organização são recusados pelas restrições existentes, revertendo inclusive o usuário recém-criado.

Resposta acrescenta `usuario_id` (igual a `id`) e `atribuicao_ids`. Não cria papel, credencial, senha ou login humano operacional. Login já cadastrado continua conflito; não vincular a outra pessoa por aproximação de nome. Use GET de permissões para mostrar os códigos do papel, combinado com o escopo escolhido, não como prova de homologação de cargos.

## Entrada de lote novo

```json
{
  "unidade_id": "UUID_UNIDADE",
  "local_id": "UUID_LOCAL_EXISTENTE",
  "lote": {
    "apresentacao_id": "UUID_APRESENTACAO",
    "fabricante": "Fabricante Fictício",
    "codigo": "LOTE-DEV-001",
    "situacao_validade": "conhecida",
    "validade": "2099-12-31",
    "custo_base": "1.25"
  },
  "quantidade_apresentacoes": "20",
  "ocorrido_em": "2026-09-01T12:00:00Z",
  "motivo": "Entrada sintética"
}
```

`apresentacao_id` fica dentro de `lote` para reutilizar exatamente o schema de `POST /estoque/lotes`. Quantidade/custo são strings decimais, nunca números JSON. A quantidade deve ser positiva e a conversão usa o fator da apresentação. Validade conhecida exige data; as regras preexistentes de validade pendente/isenta continuam. Custo omitido continua desconhecido, não zero.

Resposta acrescenta `lote_id`, `custodia_id`, `posicao_id`, `transacao_id` (igual a `id`) e, quando aplicável, `recebimento_id`. A custódia hospitalar existente é reutilizada, ou criada atomicamente se ausente; não há custódia de tutor neste comando. O local deve existir na unidade indicada. Não cria coordenada, ocupação física do C18 ou alocação de Terminal: cria posição de estoque M2.

Este endpoint é para **lote novo**. Lote já existente pela chave natural retorna 409 sem alteração de metadados ou fusão silenciosa. Para posições existentes, permanecem `POST /estoque/entradas` e `POST /compras/recebimentos`; para novo posicionamento de lote existente, permanece o fluxo separado já publicado. Recipiente aberto/fracionamento não pertence a este delta.

Quando a origem for pedido de compra, incluir:

```json
{
  "compra": {
    "pedido_id": "UUID_PEDIDO",
    "item_pedido_id": "UUID_ITEM",
    "referencia": "UUID_REFERENCIA_RECEBIMENTO",
    "documento_fornecedor": "Comprovante sintético",
    "simulacao": true,
    "confirmacao_humana": true
  }
}
```

Esse objeto é acrescentado ao corpo da entrada, não enviado sozinho. O backend chama o **mesmo serviço de `/compras/recebimentos`**, na mesma transação; não cria uma segunda entrada. Pedido aprovado, item/apresentação/custódia compatíveis, limite de quantidade, confirmação e simulação são preservados. Recebimento deste comando cobre um item/lote; o endpoint antigo continua aceitando múltiplos itens em posições já existentes. Não enviar novo POST de recebimento depois do sucesso da entrada completa.

## Catálogo e busca

Decisão deste delta: **preservar o escopo organizacional global do catálogo**. Leituras de unidades de medida, produtos, apresentações, lotes, recipientes e custódias continuam exigindo `estoque:ler` global; catalogação global continua exigindo `estoque:catalogar` global. As posições e movimentações preservam o escopo de unidade. Este delta não concede permissões novas nem homologa papéis hospitalares. Um catálogo para operadores exclusivamente de unidade exigirá decisão/delta próprio.

Busca de pacientes: `q` é opcional, texto não vazio até 160 caracteres; espaços externos são removidos. Busca substring literal no nome sem diferenciar maiúsculas/minúsculas ou UUID completo. `%`, `_` e aspas não viram operadores SQL. Não promete remoção de acentos nem busca por identificação legada/tutor. Ordenação por UUID e cursor continuam iguais; manter o mesmo `q` ao paginar e limpar o cursor ao mudar a busca. Sem `q`, comportamento anterior. Não há total global inventado. Volume real/performance ainda exige avaliação; nenhum índice/migration foi criado por hipótese.

## Identidade futura — proposta de interface, NÃO implementada

O contrato executável continua: navegador → POST/GET/DELETE `/session` no BFF → Bearer opaco mantido no servidor → API `/v1/me` e `/v1/me/contexto`. Não há novo endpoint HTTP de senha, JWT ou troca de identidade neste delta.

Proposta de fronteira futura para um adaptador privado de identidade do BFF:

```text
authenticate(prova específica do provedor aprovado)
  → { access_token: opaco de 64 hex, token_type: "Bearer", expires_at: data/hora }
```

Essa resposta é **exclusivamente servidor-servidor**. O adaptador deve obter identidade humana verificada, vinculá-la explicitamente ao usuário/organização HVB e emitir credencial curta/revogável pelo backend, antes de permitir sessão. Não aceitar UUID de usuário/organização fornecido pelo browser como prova. O BFF confirma contexto na API e devolve apenas os metadados de sessão já usados pelo MVP 10 (`autenticado`, `expira_em`, `view_id`), com cookie HttpOnly; nunca devolve `access_token` ao browser. O adaptador futuro deve preservar esse envelope e alinhar renovação/expiração com o responsável pelo BFF.

Pendências reais: provedor/verificação da prova humana, vínculo de identidade, emissão/renovação/revogação e TTL, autenticação do canal privado do BFF, recuperação/MFA conforme política e sessão hospedada. Esses pontos não foram implementados por inferência; eventual DDL será solicitado ao chat do banco. A proposta não é uma rota disponível para a UI chamar e não altera `/session`.

## Verificação e encaminhamento

PASS: 46 testes locais pertinentes (7 novos, 15 fundação, 15 estoque, 9 compras); tipos e lint dos arquivos afetados; comparação de 289 paths anteriores. Apenas GET de pacientes recebeu `q`; três paths novos; Bearer e rotas Terminal idênticos. Uma expectativa inicial do teste de quantidade zero foi corrigida de 409 para o 400 já praticado pelo serviço; execução final sem falhas. Não foram executados navegador, Supabase ou testes do frontend.

Evidência: [backend MVP 11](evidencias/backend-mvp11.json). Banco/migrations e Terminal congelado: sem alteração. Nenhum pedido de DDL ao banco.

Pedido copiável ao frontend:

```text
Integre os contratos publicados em hvb-sistema-dev e descritos em docs/CONTRATOS-BACKEND-MVP11.md, preservando backend/banco/Terminal. Use GET /v1/papeis/{id}/permissoes; POST /v1/usuarios/onboarding (inclui motivo); POST /v1/estoque/entradas-completas (apresentacao_id dentro de lote); GET /v1/pacientes?q=... mantendo items/next_cursor. Mantenha Idempotency-Key/corpo estáveis no retry e não envie recebimento separado após entrada com compra. Catálogo segue global na organização; permissões apenas de unidade não o liberam. Login humano continua pendente: o contrato futuro é proposta privada para o BFF, não endpoint disponível. Execute seus testes autorizados e devolva incompatibilidades concretas/evidências, sem alterar os outros blocos.
```
