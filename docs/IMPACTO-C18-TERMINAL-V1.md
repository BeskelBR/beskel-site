# Delta N1 C18 — Terminal v1

Autorização: esclarecimento explícito de governança do usuário em 22/09/2026. C5, C14 e C17 permanecem baselines históricos. A branch `hvb-sistema-dev` admite evolução aditiva; as migrations 001–072 não serão alteradas.

Fonte: `PROMPT_CODEX_HVB_SISTEMA_CONTRATO_TERMINAL_V1.txt`, fornecido pelo usuário. Este documento descreve o impacto; não altera a precedência dos artefatos congelados.

| Aspecto | Baseline preservado | Evolução C18 |
|---|---|---|
| Identificação | C5 etiqueta de paciente/posição | NFC revogável de funcionário; sem transportar permissões |
| Autenticação | C14 atestação DEV e terminal integrado | NFC inicia desafio biométrico 1:1/PAD; dispositivos provisionados distintos |
| Ordem | C14 solicitação com flags informadas | OR logística própria com origem clínica tipada; sensibilidade do catálogo |
| Sessão | C14 trilha de acesso sem fulfillment | Exclusividade por sala, checklist, armário sensível e saída automática |
| Estoque | M2 posições/reservas/razão | Coordenadas independentes, ocupação por lote, FEFO/FIFO e transferência M2 |
| Encerramento | C14 acesso encerrado | Fulfillment por origem; confirmação recuperável após fechamento físico |

Invariantes: prescrever, programar, executar, retirar, consumir, cobrar, receber e conciliar continuam operações distintas. Não haverá execução clínica nem consumo gerados pela retirada.

O adaptador biométrico desta entrega é apenas um simulador local autenticado. O servidor sem adaptador falha fechado. Provisionamento real, hardware, política offline e infraestrutura externa permanecem decisões futuras.
