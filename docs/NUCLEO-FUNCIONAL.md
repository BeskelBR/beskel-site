# Núcleo funcional — sequência antes das decisões hospitalares

Atualizado em 15/09/2026. O usuário quer concluir o núcleo funcional do backend antes de discutir pendências. Nenhuma proposta técnica abaixo aprova política hospitalar, operação real ou infraestrutura externa.

## Base existente

Recortes M0–M6E: identidade/RBAC, pacientes/responsáveis, episódios/ocupação, estoque físico, prescrição/programação/execução/consumo, diária configurável, comercial/financeiro, exames, protocolos, documentos, agenda e portal/comunicação simulada. A suíte geral M6E teve 152 testes aprovados; C1 acrescentou compras/recebimento com 29 testes pontuais de unidades/estoque/compras. C2 acrescentou prontuário longitudinal com 34 testes pontuais de unidades/clínica/prontuário. C4 acrescentou contas a pagar com 24 testes pontuais de unidades/compras/fornecedores. A verificação geral atual será retomada posteriormente. C3 consolidou uma jornada entre os módulos com nove testes pontuais e matriz de cobertura. Isso não equivale a completude de todas as capacidades do escopo 10.

## Trabalho técnico seguinte

1. **Conferido em C3:** [matriz por capacidade](COBERTURA-NUCLEO.md), com base implementada, evidências e faltas separadas de decisões humanas. Atualizar a matriz a cada fechamento.
2. **Entregue em C1:** fornecedor/pedido/recebimento vinculado à mesma entrada física M2. C4 acrescenta contas a pagar; o ciclo de aquisição ainda não inclui preço negociado, documento fiscal e crédito/devolução comercial; essas capacidades continuam na matriz de cobertura, sem presumir regras hospitalares.
3. **Entregue em C2:** narrativa/evolução versionada, autoria, retificação/invalidação e linha do tempo de metadados com IDs originais e permissões por fonte. Revisão temporal sinalizada para alta/saída retroativa. A visão não inclui todas as transições nem substitui a conferência global dos vínculos e da cobertura.
4. **Entregue em C3:** jornada sintética com o mesmo paciente/episódio, execução/consumo/cobertura/cobrança/prontuário/documento/portal; falha parcial, retry, correção e revogação pontuais exercitados. Não representa orquestração de produção nem todas as jornadas possíveis.
5. **Entregue em C4:** obrigação identificada, pagamento declarado, liquidação parcial, reversão encadeada e correção documental, em simulação e separados do recebimento físico.
6. **Próximo C5:** contrato e fluxo de terminal simulado sob SISTEMA, sem editar a pasta Terminal. Depois, fechar as faltas de vínculos indicadas na matriz antes de declarar o núcleo concluído.

Nesta fase executar somente verificações pontuais necessárias às mudanças; suíte geral, carga e instalação vazia ficam para a etapa posterior. Depois dessa consolidação, revisar em conjunto as [pendências acumuladas](PENDENCIAS-HVB.md). Interface, autenticação operacional, assinatura válida, mensagens reais, homologação, implantação e M7 continuam etapas próprias; nenhuma delas está autorizada por um teste técnico aprovado. O trabalho permanece somente em SISTEMA e hvb-sistema-dev.
