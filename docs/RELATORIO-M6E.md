# Relatório M6E — Portal e comunicação

Data: 14/09/2026. O usuário determinou concluir o núcleo funcional antes de discutir pendências. Este bloco mantém essa ordem, exclusivamente em SISTEMA/hvb-sistema-dev, com dados fictícios e código no GitHub.

## Entrega

Backend de contas e credenciais próprias do portal, concessões por paciente, revogações, preferências versionadas e caixa de mensagens. Mensagens documentais preservam versão exata e autorização; mensagens de agenda apontam para a versão do compromisso. Tentativas, retornos e conciliação de resultado incerto são fatos separados, apenas simulados.

Migrations 036–038: dez tabelas e três views novas. Total: 140 tabelas, 40 views, 85 permissões e 280 operações HTTP em 170 caminhos. Sem dependências novas. Seed executado duas vezes sem duplicação; credencial fictícia local com validade de sete dias, em arquivo privado ignorado pelo Git.

## Verificação

**152 testes aprovados**: cinco unitários e 147 integrações PostgreSQL, incluindo 14 cenários de portal e os 138 testes anteriores. Verificados isolamento entre contas/organizações, separação de tokens da equipe, documentos internos/obsoletos, hash exato, revogações, encerramento de vínculo, preferências, retry, teto de tentativas, origem de agenda e retornos tardios.

TypeScript estrito, lint, formatação e OpenAPI aprovados. Migrations 001–038 e suíte completa verificadas em TEST vazio no cluster adicional, preservando a base anterior por renomeação. Node 24.19.0 e PostgreSQL 17.10 no Windows; Docker/Linux e workflow manual não executados.

HTTP real local confirmou criação/retry com mesmo ID e conteúdo consultado por credencial de portal, com SHA-256 reproduzido. Mil mensagens fictícias preservaram estoque em 20 unidades, sem execução clínica, cobrança ou registro automático de entrega documental M6C. Nenhum provedor, contato ou envio externo foi usado.

| Operação | p50 | p95 | Statements totais |
|---|---:|---:|---:|
| Caixa com até 50 mensagens | 13,31 ms | 15,80 ms | 7 |
| Preparar mensagem com um documento | 5,97 ms | 9,88 ms | 15 |
| Registrar tentativa simulada | 6,18 ms | 9,50 ms | 12 |

Mil mensagens preparadas por comandos e disponibilizadas em simulação, um responsável e um documento por mensagem. Dez aquecimentos e cem medições por operação. Preparação da mensagem para tentativa fora da janela medida. Statements incluem transação/contexto, sem SQL interno de triggers/funções. Não são SLA; carga distribuída e histórico extenso exigem ensaios posteriores.

O primeiro ensaio da caixa atingiu o timeout de cinco segundos. O diagnóstico separado, com limite ampliado apenas naquela sessão, mediu cerca de 15,5 segundos e identificou trabalho repetido nos predicados por mensagem. Migration 038 reaproveita planos internos sem modificar regras ou timeout da aplicação. Diagnóstico após correção: 338 ms; ensaio aquecido completo conforme tabela. Evidências e planos: [checks](evidencias/checks-m6e.json), [benchmark](evidencias/benchmark-m6e.json), [comparação diagnóstica](evidencias/portal-plan-comparison-m6e.json).

## Limites e próximo passo

Portal é API local, sem interface, convite, login humano, recuperação, MFA, envio externo ou retorno autenticado de provedor. Preferências e poderes reais permanecem pendentes. Registros enviado/entregue/lido são declarações DEV; abrir o conteúdo não registra leitura nem aceite. Não há assinatura ou consentimento presumido.

Mensagens antigas ficam ocultas se documento ou agenda tiver versão posterior; histórico permanece interno. Preferência negativa impede novas tentativas, enquanto revogação de acesso impede novas leituras. Conteúdo já consultado não pode ser recolhido do cliente.

O próximo trabalho é consolidar a cobertura do núcleo contra o escopo vigente e seus fluxos integrados, antes de solicitar decisões hospitalares. Os recortes implementados do backlog não significam produto completo. Ver [núcleo funcional](NUCLEO-FUNCIONAL.md), [ADR](adr/0011-portal-comunicacao.md) e [pendências](PENDENCIAS-HVB.md). M7, SimplesVet e produção não iniciados.
