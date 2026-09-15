# Núcleo funcional — sequência antes das decisões hospitalares

Atualizado em 15/09/2026. O usuário quer concluir o núcleo funcional do backend antes de discutir pendências. Nenhuma proposta técnica abaixo aprova política hospitalar, operação real ou infraestrutura externa.

## Base existente

Recortes M0–M6E: identidade/RBAC, pacientes/responsáveis, episódios/ocupação, estoque físico, prescrição/programação/execução/consumo, diária configurável, comercial/financeiro, exames, protocolos, documentos, agenda e portal/comunicação simulada. A suíte geral M6E teve 152 testes aprovados; C1 acrescentou compras/recebimento com 29 testes pontuais de unidades/estoque/compras. C2 acrescentou prontuário longitudinal com 34 testes pontuais de unidades/clínica/prontuário. A verificação geral atual será retomada posteriormente. Isso não equivale a completude de todas as capacidades do escopo 10.

## Trabalho técnico seguinte

1. Conferir capacidade por capacidade do escopo vigente contra entidades, comandos e testes, registrando faltas de implementação separadamente de decisões humanas.
2. **Entregue em C1:** fornecedor/pedido/recebimento vinculado à mesma entrada física M2. O ciclo de aquisição ainda não inclui preço negociado, contas a pagar, documento fiscal e crédito/devolução comercial; essas capacidades continuam na matriz de cobertura, sem presumir regras hospitalares.
3. **Entregue em C2:** narrativa/evolução versionada, autoria, retificação/invalidação e linha do tempo de metadados com IDs originais e permissões por fonte. Revisão temporal sinalizada para alta/saída retroativa. A visão não inclui todas as transições nem substitui a conferência global dos vínculos e da cobertura.
4. Exercitar jornadas integradas com dados sintéticos, de execução/consumo/cobertura/cobrança a documentos/portal, incluindo falha parcial, retry e correção. Reutilizar contratos existentes e corrigir lacunas antes de declarar o núcleo concluído.

Nesta fase executar somente verificações pontuais necessárias às mudanças; suíte geral, carga e instalação vazia ficam para a etapa posterior. Depois dessa consolidação, revisar em conjunto as [pendências acumuladas](PENDENCIAS-HVB.md). Interface, autenticação operacional, assinatura válida, mensagens reais, homologação, implantação e M7 continuam etapas próprias; nenhuma delas está autorizada por um teste técnico aprovado. O trabalho permanece somente em SISTEMA e hvb-sistema-dev.
