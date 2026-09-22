# Núcleo funcional — sequência antes das decisões hospitalares

Atualizado em 16/09/2026. O usuário quer concluir o núcleo funcional do backend antes de discutir pendências. Nenhuma proposta técnica abaixo aprova política hospitalar, operação real ou infraestrutura externa.

## Base existente

Recortes M0–M6E: identidade/RBAC, pacientes/responsáveis, episódios/ocupação, estoque físico, prescrição/programação/execução/consumo, diária configurável, comercial/financeiro, exames, protocolos, documentos, agenda e portal/comunicação simulada. A suíte geral M6E teve 152 testes aprovados; C1 acrescentou compras/recebimento com 29 testes pontuais de unidades/estoque/compras. C2 acrescentou prontuário longitudinal com 34 testes pontuais de unidades/clínica/prontuário. C4 acrescentou contas a pagar com 24 testes pontuais de unidades/compras/fornecedores. C5 acrescentou o fluxo de terminal simulado com 28 testes pontuais. C6 acrescentou preços/conciliação de compras com 23 testes pontuais. C7 acrescentou rateio/custo por recebimento com 32 testes pontuais. C8 acrescentou plano de parcelas com 25 testes pontuais. C9 acrescentou crédito comercial com 37 testes pontuais. C10 acrescentou conciliação de saídas com 26 testes pontuais. C11 acrescentou modelos, anexos, busca e coautoria com 31 testes pontuais. C12 acrescentou vínculo agenda–episódio e auditoria de consultas com 58 testes pontuais. C13 acrescentou revisões cadastrais/acesso com 43 testes pontuais. A verificação geral atual será retomada posteriormente. C3 consolidou uma jornada entre os módulos com nove testes pontuais e matriz de cobertura. Isso não equivale a completude de todas as capacidades do escopo 10.

## Trabalho técnico seguinte

1. **Conferido em C3:** [matriz por capacidade](COBERTURA-NUCLEO.md), com base implementada, evidências e faltas separadas de decisões humanas. Atualizar a matriz a cada fechamento.
2. **Entregue em C1:** fornecedor/pedido/recebimento vinculado à mesma entrada física M2. C4 acrescenta contas a pagar; C6 acrescenta preços negociados e vínculo explícito com obrigação; C7 acrescenta rateio explícito e custo analítico por recebimento; C9 acrescenta crédito comercial declarado; o ciclo ainda não inclui emissão fiscal ou devolução comercial/física real; essas capacidades continuam na matriz de cobertura, sem presumir regras hospitalares.
3. **Entregue em C2:** narrativa/evolução versionada, autoria, retificação/invalidação e linha do tempo de metadados com IDs originais e permissões por fonte. Revisão temporal sinalizada para alta/saída retroativa. A visão não inclui todas as transições nem substitui a conferência global dos vínculos e da cobertura.
4. **Entregue em C3:** jornada sintética com o mesmo paciente/episódio, execução/consumo/cobertura/cobrança/prontuário/documento/portal; falha parcial, retry, correção e revogação pontuais exercitados. Não representa orquestração de produção nem todas as jornadas possíveis.
5. **Entregue em C4:** obrigação identificada, pagamento declarado, liquidação parcial, reversão encadeada e correção documental, em simulação e separados do recebimento físico.
6. **Terminal v1, delta C18:** baselines C5/C14 preservados. Nova API canônica cobre NFC/biometria DEV, dispositivos, contexto, sessão exclusiva, picking/sensível, saída recuperável e fulfillment com transferência M2. Retirada C5 continua bloqueada; não há execução/consumo/cobrança implícitos. Clientes e hardware seguem posteriores, em suas autorizações próprias.
7. **Entregue em C6:** preços negociados e vínculo compra–obrigação com valores explícitos, versões, limites e reversões.
8. **Entregue em C7:** composição/rateio explícito de custo de aquisição por item/recebimento, sem reescrever histórico ou inferir regra fiscal.
9. **Entregue em C8:** plano integral versionado de parcelas e alocação explícita de liquidações, sem duplicar dívida/pagamento.
10. **Entregue em C9:** crédito comercial, aplicação como liquidação original e correção/reversões, integrados às parcelas.
11. **Entregue em C10:** conciliação parcial/agrupada de saídas, com revisão explícita e saldos; base técnica do grupo financeiro de fornecedores consolidada.
12. **Entregue em C11:** modelos versionados, preenchimento na evolução original, anexos privados pequenos, busca textual e coautoria pessoal sobre versão/hash.
13. **Entregue em C12:** relação explícita agenda–episódio, revogação/histórico e auditoria de consultas identificadas internas/portal.
14. **Continuidade:** os grupos planejados têm entregas, mas a conferência encontrou refinamentos funcionais antigos ainda abertos. Seguir o [inventário consolidado](FECHAMENTO-CICLO-BASICO.md), com cadastros/acesso C13, correção clínica C15, diárias C16, financeiro do cliente C17 e delta Terminal v1 C18 entregues nos recortes documentados; não declarar o núcleo integralmente concluído nem promover pendência de software a mera homologação.

Nesta fase executar somente verificações pontuais necessárias às mudanças; suíte geral, carga e instalação vazia ficam para a etapa posterior. Depois dessa consolidação, revisar em conjunto as [pendências acumuladas](PENDENCIAS-HVB.md). Interface, autenticação operacional, assinatura válida, mensagens reais, homologação, implantação e M7 continuam etapas próprias; nenhuma delas está autorizada por um teste técnico aprovado. O trabalho permanece somente em SISTEMA e hvb-sistema-dev.


## Fechamento do ciclo com uso contido de cota

1. Usar o inventário de refinamentos após C12, preservando o escopo existente e reunindo mudanças relacionadas. Não recriar a estimativa por grupos a cada turno.
2. Executar um recorte de testes por entrega; repetir apenas por falha, alteração ou risco concreto novo. Guardar evidências e evitar suíte geral/benchmarks a cada passo.
3. Acumular decisões humanas, integrações e operação em PENDENCIAS-HVB.md; não interromper o núcleo por questões que podem esperar.
4. Manter C8–C18 e próximos lotes locais em hvb-sistema-dev. Não repetir tentativas do Git enquanto o bloqueio da revisão automática estiver adiado pelo usuário.
5. Após o ciclo básico: conferir a matriz, resolver publicação e pendências por dependência, executar verificação geral uma vez sobre a versão consolidada e corrigir pontualmente o que ela revelar. Interfaces/homologação/implantação continuam etapas próprias.

C14 foi o parêntese arquitetural solicitado antes da correção clínica. Implementação P0/P1 do delta concluída em DEV, com 41 testes pontuais. P2/P3 e fulfillment não são declarados prontos; estão nas pendências. Três registros resolvidos/substituídos foram arquivados fora da lista ativa, conforme a instrução mais recente.

C15 encerra a falta técnica de correção de executor/versão/programação no mesmo episódio e anulação sem sucessora. Pendência resolvida arquivada separadamente; limites adicionais continuam no inventário. Não há efeito automático no estoque nem reversão financeira implícita. Próxima frente: correções de diárias.


C16 entrega cancelamento/correção de associação e período por fatos sucessores, com compensações prévias explícitas de cobertura/financeiro, sem reescrever origem ou mudar valores. 68 testes pontuais e seed repetido aprovados. Classificação, migração em lote, restauração e regularização comercial posterior ao cancelamento permanecem específicas. Próxima frente: correções de depósito/extrato e reabertura de conciliação do financeiro do cliente. [Relatório C16](RELATORIO-C16.md).


C17 conclui correção/cancelamento de depósito/extrato e reabertura explícita de conciliação/alocação com histórico e saldos protegidos. 56 testes e seed repetido aprovados. Por orientação de 22/09, não iniciar módulo seguinte: receber e auditar o delta intermediário. [Ponto de parada](PONTO-DE-PARADA-C17.md).

## Delta N1 C18 — continuidade atual

O delta intermediário recebido foi o contrato Terminal v1, explicitamente autorizado como evolução aditiva pelo usuário. C18 conclui o backend canônico de acesso, picking e fulfillment com transferência M2, sem ato clínico ou cobrança implícitos. Supersede a falta técnica de fulfillment descrita no baseline C14, preservando seus artefatos. 78 testes pontuais aprovados; pendências afetadas resolvidas arquivadas e restantes atualizadas. Não houve implementação de cliente/hardware nem publicação. A continuidade retorna ao inventário restante do sistema, conforme [PONTO-DE-PARADA-C18.md](PONTO-DE-PARADA-C18.md).
