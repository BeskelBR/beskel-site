# Núcleo funcional — sequência antes das decisões hospitalares

Atualizado em 14/09/2026. O usuário quer concluir o núcleo funcional do backend antes de discutir pendências. Nenhuma proposta técnica abaixo aprova política hospitalar, operação real ou infraestrutura externa.

## Base existente

Recortes M0–M6E: identidade/RBAC, pacientes/responsáveis, episódios/ocupação, estoque físico, prescrição/programação/execução/consumo, diária configurável, comercial/financeiro, exames, protocolos, documentos, agenda e portal/comunicação simulada. 152 testes verificam os comportamentos já implementados. Isso não equivale a completude de todas as capacidades do escopo 10.

## Trabalho técnico seguinte

1. Conferir capacidade por capacidade do escopo vigente contra entidades, comandos e testes, registrando faltas de implementação separadamente de decisões humanas.
2. Completar compras/recebimento vinculado a fornecedor e pedido: o escopo 10 inclui esse fluxo; M2 entrega entrada e movimentos físicos, sem pedido de compra/fornecedor persistente. Compra não pode duplicar a entrada física existente.
3. Consolidar o prontuário longitudinal e os vínculos internos: fatos clínicos existem, mas narrativa/evolução e visão integrada precisam de recorte explícito. Preservar versão, autor, episódio e retificação, sem inferir diagnóstico ou atendimento.
4. Exercitar jornadas integradas com dados sintéticos, de execução/consumo/cobertura/cobrança a documentos/portal, incluindo falha parcial, retry e correção. Reutilizar contratos existentes e corrigir lacunas antes de declarar o núcleo concluído.

Depois dessa consolidação, revisar em conjunto as [pendências acumuladas](PENDENCIAS-HVB.md). Interface, autenticação operacional, assinatura válida, mensagens reais, homologação, implantação e M7 continuam etapas próprias; nenhuma delas está autorizada por um teste técnico aprovado. O trabalho permanece somente em SISTEMA e hvb-sistema-dev.
