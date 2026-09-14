# ADR 0008 — Protocolos preventivos

Data: 14/09/2026. M6B em simulação, seguindo o modelo de dados do pacote e a continuidade autorizada. Alterações somente em SISTEMA e hvb-sistema-dev; GitHub, sem publicação ou serviços externos.

Protocolo tem catálogo, versão técnica e etapas atômicas imutáveis. Adesão referencia paciente e versão aprovada para simulação, com espécie compatível. Nenhum intervalo, produto, dose ou equivalência clínica real foi presumido.

Planejamento tem data civil, sem horário de aplicação implícito. A âncora é a data inicial da adesão acrescida do deslocamento da etapa. Recorrência única, em dias e em meses de calendário são distintas. Meses usam a âncora original e o último dia válido do mês quando necessário: 31/01 → 28/02 → 31/03, sem deslocamento acumulado para o dia 28. Essa é uma semântica DEV explícita, sujeita à aprovação hospitalar. Datas ficam entre 2020 e 2100; até 1.000 sequências por etapa. O comando informa etapa, sequência e data; o banco calcula a data esperada e rejeita divergência. Não há geração ilimitada ou aplicação automática.

Ocorrência vencida pode abrir revisão humana por comando idempotente. Atraso é derivado no fuso da unidade; revisão e resolução são fatos persistentes. Resolver uma revisão não confirma aplicação nem altera a data planejada. A rotina automática de varredura e a comunicação permanecem futuras.

Aplicação interna estende a execução clínica existente usando o mesmo ID e FK única. Confere paciente, item clínico exato, horário, resultado integral e execução ativa. Aplicação externa guarda profissional, lote e fabricante declarados, sem criar usuário, execução ou consumo hospitalar. Texto de lote não é identidade física. Vínculo de consumo aponta item efetivamente consumido da mesma execução; o lote vem da posição física, sem segunda baixa. Estorno posterior sinaliza revisão do material.

Correção externa cria sucessor da aplicação original; correção interna segue também a linhagem da execução retificada. Um sucessor por aplicação e uma primeira aplicação por ocorrência impedem duplicação concorrente. Encerramento pode apontar uma adesão sucessora ativa do mesmo paciente, com motivo explícito; não transfere ocorrências ou presume equivalência. Encerramento anterior a aplicação já registrada é recusado neste recorte.

Escritas preventivas usam trava por paciente. Integrações com execução/consumo travam primeiro o episódio, alinhadas à clínica. RLS, FKs compostas, comandos abertos, autoria, auditoria e outbox preservam integridade. A função de proteção de comando já existente é reutilizada; não cria mecanismo paralelo de autenticação.

Próximos recortes M6: documentos gerais, agenda, portal/comunicação e interface. Papéis profissionais, vacinação real, assinatura, doses, produtos e políticas operacionais permanecem pendentes.
