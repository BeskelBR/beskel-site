# C18 — Incorporação do contrato Terminal v1

O delta N1 foi implementado de forma aditiva em SISTEMA, branch `hvb-sistema-dev`. Versão 0.27.0. Baselines e fatos C5/C14 foram preservados; não houve edição de outras branches/pastas, conexão ao Supabase, deploy, hardware, recursos pagos ou dados reais.

## Resultado

O backend passou a governar o ciclo NFC → biometria DEV verificada → AuthSession → contexto de ORs/ajustes → AccessSession exclusiva → picking FEFO/FIFO → saída → fulfillment e transferência de estoque. Autenticação biométrica não é instalada por padrão no servidor. O simulador é utilizado somente por injeção explícita nos testes locais.

Cliente não informa sensibilidade, lote, posição ou quantidade final na confirmação. Coordenadas são independentes do produto, e a ocupação aponta para uma posição/lote M2. Tentativas e divergências preservam os locais falhos; realocação não retorna a lotes já excluídos. Sem alternativa integral individual, mantém exceção com oferta parcial explícita de um único lote ou indisponibilidade.

Checklist pode reabrir antes da saída; torna-se imutável após PRESENCE_CLEARED. Armário sensível só abre sob demanda, exige evidências separadas de fechamento e trava, e não exige segunda biometria. Timeout com presença não libera a sala nem o saldo. Uma falha técnica após DOOR_CLOSED deixa confirmação recuperável, sem repetir a retirada física.

Escrituração usa reserva, posição, transação e razão M2. Há exatamente uma associação de movimento por tarefa confirmada. Não há criação automática de execução clínica, consumo ou cobrança. Quantidades finais preservam OR/ajuste; OR parcial nunca recebe estado de atendimento completo.

## Artefatos entregues

- [Diferenças C5/C14 → v1](IMPACTO-C18-TERMINAL-V1.md).
- [ADR 0028 e supersessão explícita](adr/0028-terminal-v1-canonico.md), preservando ADRs 0015/0024.
- [Modelo e matriz Terminal → tabela/API](DADOS-C18.md).
- Migrations 073–076; domínio `src/domain/terminal-v1`; integração aditiva no app.
- [Contrato de eventos e integração](CONTRATO-EVENTOS-TERMINAL-V1.md) e [OpenAPI](../openapi/hvb-sistema.json).
- [Pendências resolvidas](PENDENCIAS-RESOLVIDAS-C18.md) e [pendências restantes](PENDENCIAS-HVB.md).

## Verificação

`node scripts/check.mjs --terminal-v1`: **78 testes aprovados**, sendo 5 unitários e 73 de integração nos recortes Terminal v1, estoque, clínica, C5 e C14. O arquivo novo contém 20 testes de jornadas e falhas, cobrindo a lista obrigatória do contrato. TypeScript, lint, formato, migrations DEV e geração de OpenAPI passaram. Permanece somente o aviso informativo preexistente de estilo no teste C11; não é erro nem foi modificado neste delta.

Os testes incluem NFC revogada, credencial de dispositivo revogada, evidência repetida, dispositivo não provisionado, contexto concorrente, reserva M2 concorrente, FEFO/FIFO/split, múltiplas ORs/ajustes, acesso sensível negado, duas divergências sucessivas, parcial/indisponível, reabertura, imutabilidade após saída, falha técnica e recuperação, replay concorrente de porta fechada, RLS e proteção SQL. Timeouts usam envelhecimento controlado de fatos sintéticos exclusivamente no banco TEST. A falha de confirmação usa um trigger temporário restrito à tarefa sintética, removido em `finally`; não há bypass de produção.

Auditoria DEV/TEST: 76 migrations com hashes correspondentes; **220 tabelas, 77 views, 128 permissões**. As 22 tabelas novas possuem RLS forçada. Zero divergências entre projeções de saldo/reserva e razão. OpenAPI: **451 operações em 288 caminhos**, 35 operações novas, nenhuma das 416 anteriores removida ou modificada.

Uma primeira verificação identificou que SELECT FOR UPDATE/SHARE exige privilégio de UPDATE também em tabelas imutáveis. A correção foi adicionada na migration 075; os triggers continuam bloqueando mutação. A mesma migration corrigiu o agregado de ORs com contextos expirados. A migration 076 acrescentou guardas de composição/conservação. Nenhuma migration já aplicada foi reescrita.

O wrapper `pnpm` do ambiente tentou resolver sua própria instalação e abortou sem alterar dependências. A verificação final usou diretamente Node e ferramentas já instaladas, como o runner do projeto. Nenhuma instalação externa foi necessária.

Evidências: [checks-c18-focused.json](evidencias/checks-c18-focused.json) e [c18-integridade.json](evidencias/c18-integridade.json). Não foram repetidos instalação vazia, suíte geral, carga de produção ou testes de hardware, que permanecem na fase de homologação organizada.

## Estado de continuidade

C18 conclui este delta backend. Isso não declara concluído todo o inventário do núcleo. As partes resolvidas das pendências do Terminal saíram da lista ativa; os limites restantes foram descritos de forma específica.

C8–C18 permanecem locais. Último commit publicado registrado: C7 `789ee1f26241be9e636ea0ad328d03a1cea6f04b`. Não se repetiu escrita Git enquanto o bloqueio de publicação continua adiado. A sequência seguinte deve retomar o inventário do sistema a partir do [ponto de parada C18](PONTO-DE-PARADA-C18.md), sem reabrir este delta nem mudar baselines silenciosamente.
