# Jornada backend de estoque — schema 111

25/09/2026. Branch `hvb-sistema-dev`, implementação testada no HEAD `ea90341870639b8e5d2826cb7ce2871872794bb5`. **Bloco de estoque do backend: VERIFICADO para a jornada deste delta.** Não houve necessidade de alterar handlers, domínio, schema ou contratos.

## Contratos encontrados antes da execução

Todas as rotas abaixo já constavam do OpenAPI publicado. O verificador recusa rotas/métodos ausentes no arquivo. Nenhum endpoint paralelo foi criado.

| Finalidade | Rotas existentes |
|---|---|
| Catálogo | POST/GET `/v1/estoque/unidades`, `/produtos`, `/apresentacoes`, `/lotes` |
| Custódia e posição | POST/GET `/v1/estoque/custodias`, `/posicoes`; `/posicoes` expõe saldo_base, reservado_base e disponivel_base GENERATED |
| Entrada | POST `/v1/estoque/entradas`; também existe `/v1/estoque/entradas-completas`, não necessário neste teste |
| Movimento físico | POST `/v1/estoque/transferencias`, `/retiradas`, `/perdas`; GET `/v1/estoque/transacoes` e `/lancamentos` |
| Reserva | POST/GET `/v1/estoque/reservas`; POST `/{id}/liberar`, `/expirar`, `/efetivar` |
| Consumo clínico | POST/GET `/v1/clinica/consumos`; GET `/v1/clinica/consumo-itens` |
| Estorno clínico integral | POST `/v1/clinica/consumos/{id}/reverter`; GET `/v1/clinica/estornos` |
| Reversão/devolução de movimento | POST `/v1/estoque/transacoes/{id}/reverter` e `/devolver`; não substituem o estorno clínico na jornada escolhida |

A jornada usou cadastro de responsável/paciente/episódio e local sintéticos pelas rotas existentes. Em estoque, criou unidade de medida, produto, apresentação, lote, custódia hospitalar se ausente e posição vazia. Duas apresentações com fator 10 deram entrada de 20 unidades base. O POST consumo criou baixa física e item conciliado; o POST estorno clínico gerou a reversão física integral.

Permissões utilizadas: `estoque:ler`, `estoque:catalogar`, `estoque:movimentar`, `estoque:reservar`, `estoque:reverter`, `clinica:ler`, `clinica:consumir`, `clinica:reverter_consumo`; preparação com `cadastros:escrever`, `episodios:escrever`, `locais:escrever`; `acesso:administrar` para leitura/revisão temporária da própria atribuição sintética. Todas já existiam na fixture; não houve ampliação.

## Evidência HTTP e saldo

**73 PASS / 0 FAIL / 0 BLOCKED**. Execução automatizada por `fetch` contra servidor Fastify real em porta efêmera de loopback, conectado ao Supabase DEV por Node/pg com TLS verify-full. Não foi usado app.inject nem navegador neste roteiro. Identidade de todas as requisições: `admin.remote.dev.a`, conferida por Bearer e login canônico. O [JSON de evidência](evidencias/estoque-111.json) contém os métodos, endpoints, status esperados/observados e SQLSTATE de cada chamada.

| Etapa / operação | HTTP | Saldo base | Reservado | Disponível / situação |
|---|---|---|---|---|
| GET posição inicial | 200 | 0.000000 | 0.000000 | 0.000000 |
| POST entrada; GET posição | 200 | 20.000000 | 0.000000 | 20.000000 |
| POST consumo de 21; POST reserva de 21 | 409 / 409 | 20.000000 | 0.000000 | Sem alteração |
| POST consumo de 3; GET posição | 200 | 17.000000 | 0.000000 | 17.000000 |
| GET consumo e itens | 200 | 17.000000 | 0.000000 | conciliado; um item de 3.000000 |
| POST consumo com mesma chave/corpo | 200 | 17.000000 | 0.000000 | Mesmo ID, nenhuma segunda baixa |
| POST estorno; GET posição/consumo | 200 | 20.000000 | 0.000000 | 20.000000; estornado |
| POST estorno com mesma chave/corpo | 200 | 20.000000 | 0.000000 | Mesmo ID, uma reversão física |
| POST segundo estorno com outra chave | 409 | 20.000000 | 0.000000 | SQLSTATE 23505; saldo preservado |

O excesso de consumo foi recusado pelo backend (409, sem SQLSTATE); excesso de reserva foi recusado pela constraint (409/23514). As leituras de transações e lançamentos confirmaram pares **-3/+3**, tanto no consumo quanto na reversão. O saldo disponível foi lido da API, sem segunda projeção ou cálculo persistido.

Consulta da fixture A com unidade da tenant B devolveu HTTP 200 com lista vazia. A conferência SQL suplementar sob RLS de B não enxergou a posição de A. Nenhuma credencial B foi utilizada, nenhum usuário/papel criado e nenhum privilégio concedido.

Para os negativos de autorização, a única atribuição ativa de A foi revogada pela rota existente `/v1/atribuicoes/{id}/revisoes`, dentro de savepoint exclusivo. GET produtos e POST entrada retornaram **403**. O rollback desse savepoint restaurou a atribuição; nova leitura confirmou saldo 20.000000. Não houve mudança persistente de RBAC ou de autenticação.

## Integridade, escopo e limitações

- Migrations 001–111 conferidas por SHA-256 contra o ledger remoto; `/ready` retornou 200 e migration 111. `hvb.autenticar` manteve a mesma definição antes/depois.
- Lint do novo verificador: PASS. Typecheck do backend: PASS (`tsc --noEmit -p .local/tsconfig.backend.json`).
- Typecheck global: FAIL, os quatro erros conhecidos do frontend `api/gateway.ts` nas linhas 180/186/187/191; arquivo não alterado.
- Build separado: NÃO APLICÁVEL ao backend atual (Node 24 executa TypeScript nativamente, sem script build no pacote). Carregamento e inicialização do servidor real: PASS. Não foi produzido bundle nem efetuado deploy.
- Teste automatizado afetado: `node scripts/verify-stock-111.ts <env-privado>`. Na execução local foi acrescentado o hook privado já existente que carrega o app publicado, excluindo da memória o WIP de login humano. Nenhum arquivo desse WIP foi editado ou publicado.
- Suítes históricas gerais de estoque/clínica: NÃO EXECUTADAS nesta rodada. Seus bootstraps chamam o runner legado de migrations, cuja incompatibilidade de grants com a 109 já está pendente; a jornada HTTP dedicada evita esse bootstrap. Não apresentar 73 verificações como cobertura de todo o estoque/worker.
- As requisições usam savepoints dentro de uma transação externa; constraints diferidas são forçadas com `SET CONSTRAINTS ALL IMMEDIATE` antes de confirmar cada requisição. Rollback final confirmado. Portanto transporte HTTP, handlers, SQL, estados e recusas foram testados; commits independentes, concorrência entre processos, navegador e produção não foram homologados.
- A primeira tentativa teve falha **C — fixture temporal**: instantes gerados depois do BEGIN externo eram posteriores ao now() transacional. O roteiro foi corrigido para usar instante sintético anterior obtido do próprio banco. A execução final passou; nenhuma constraint foi contornada. Não se tratava de falha do banco ou do backend.

**Gaps de API na jornada: nenhum.** Permanecem fora deste delta worker/outbox, login humano, integração frontend e homologação com commits independentes. Banco/schema 111, migrations históricas, Terminal/C18/NFC, Bearer/BFF/session e contratos congelados permaneceram intactos; todos os dados e a revisão temporária de atribuição foram revertidos.
