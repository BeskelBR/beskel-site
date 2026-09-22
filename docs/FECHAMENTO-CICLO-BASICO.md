# Fechamento da sequência básica — atualização C18

Conferência documental e de rotas em 17/09/2026. C1–C12 foram implementados em DEV com evidências pontuais; C8–C17 permanecem locais. Esse marco fecha os grupos planejados, sem declarar que todo o produto ou todos os fluxos de correção estão concluídos. A verificação geral continua posterior, conforme o usuário.

## Refinamentos funcionais preservados

As seguintes faltas já estavam em PENDENCIAS-HVB.md. São capacidades de software, não problemas que serão resolvidos apenas configurando Vercel/Cloudflare ou respondendo questões hospitalares. Não devem desaparecer sob o rótulo genérico de homologação.

| Frente | Falta conhecida | Base atual / sequência sugerida |
|---|---|---|
| Cadastros e acesso | Entregue C13: dados básicos, revogação/restauração de atribuições e nome/capacidade com histórico | Restam refinamentos separados: deduplicação/fusão, transferência entre IDs, hierarquia/unidade do local, permissões do papel e recuperação administrativa operacional |
| Terminal v1 / clientes | C18 entrega backend canônico de acesso, reservas, picking, sensível, saída recuperável, fulfillment e transferência M2; C5/C14 preservados como baselines | Restam clientes, compensações após saída, custódia do tutor na sala, configurações versionadas e hardware/políticas reais. Pendências específicas em PENDENCIAS-HVB.md |
| Correção clínica | Entregue C15: executor/versão/programação no mesmo episódio por sucessora; anulação sem substituta; projeções derivadas e prontuário atualizados | Restam transferência entre pacientes/episódios, executor inativo, restauração, assinatura/alçadas e revisão explícita de efeitos derivados; consumo ativo continua exigindo estorno |
| Diárias | Entregue C16: cancelamento/correção de associação e período com sucessora, histórico e compensações prévias explícitas | Restam correção da classificação original, restauração, migração/reavaliação em lote e regularização comercial após cancelamento |
| Financeiro do cliente | Entregue C17: correção/cancelamento de depósito/extrato e refazer conciliação/alocação após reversão, com predecessor explícito | Restam integração/importação bancária, alçadas, restauração, transferência entre unidades e estornos/parcelas/chargeback reais |
| Exames e protocolos | Correção de decisão de amostra e invalidação de aplicação externa sem sucessora | Versões/resultados/correções já existem; casos adicionais continuam explicitamente pendentes |
| Agenda e relações | Correção de transições terminais e vínculos diretos com exame/protocolo/executor | C12 entrega somente agenda–episódio; não inferir outros vínculos ou execuções |

Este quadro é um inventário de faltas conhecidas, não aprovação de novas regras clínicas nem promessa de um número de execuções. Antes de declarar o núcleo integralmente concluído, conferir quais desses casos compõem o critério de aceite e implementar os que puderem avançar com as regras já autorizadas. A continuidade deve usar este quadro, em vez de recriar indefinidamente a estimativa por grupos.

## Trabalho que permanece posterior

1. Manter refinamentos técnicos reunidos por dependência, com um recorte de testes por mudança e evidências reaproveitáveis. C13 encerrou cadastros/acesso, C14 ajustou o Terminal de Acesso e C15 entregou o recorte de correção clínica. C16 entregou correção de associação/período de diárias no recorte documentado. C17 entregou esse recorte do financeiro do cliente. Por pedido de 22/09, parar após C17 para receber o delta intermediário; exames/protocolos continuam no inventário posterior, sem início nesta etapa.
2. Preservar pendências humanas de clínica, diárias, custo/fiscal, alçadas financeiras, formulários, acesso, assinatura e retenção. Não inventar decisões para antecipar uso real.
3. Resolver o bloqueio de publicação dos lotes locais na etapa autorizada pelo usuário, sem tentativas repetidas durante a consolidação. Git não foi novamente acionado para escrita em C12.
4. Executar uma verificação geral da versão consolidada, instalação vazia e carga; corrigir apenas o que os resultados justificarem. Interfaces, autenticação operacional, canais reais e homologação continuam entregas próprias.

Auditoria C12 cobre consultas GET/HEAD identificadas e recusas de domínio após identificação. Não prova recebimento/leitura humana, não substitui monitoramento de tentativas anônimas, retenção, exportação ou operação de suporte. Anexos C11 permanecem pequenos e sem antivírus. As limitações continuam detalhadas nas ADRs e nas pendências acumuladas.


## Parada solicitada após C17 — 22/09/2026

C17 finalizada e verificada. Receber o delta intermediário antes de retomar refinamentos. Evidências, versão e limites em [PONTO-DE-PARADA-C17.md](PONTO-DE-PARADA-C17.md). A data inicial desta conferência permanece histórica; esta seção registra a orientação mais recente.

## Delta intermediário C18 concluído — 22/09/2026

O delta recebido incorpora o contrato N1 Terminal v1 no backend: acesso, sessão física exclusiva, alocação/picking, sensível, saída recuperável, fulfillment e razão M2. A antiga falta de backend de fulfillment está resolvida no recorte, com limites e decisões remanescentes separados em PENDENCIAS-HVB.md. Baselines C5/C14 preservados; [ADR 0028](adr/0028-terminal-v1-canonico.md) documenta a supersessão. 78 testes pontuais aprovados. Retomar a sequência de refinamentos restantes deste inventário, sem tratar todo o núcleo como concluído. [Ponto de parada C18](PONTO-DE-PARADA-C18.md).
