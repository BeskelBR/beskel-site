# ADR 0015 — Fronteira do terminal e leitura simulada

Data: 15/09/2026. Implementação DEV dentro de SISTEMA. O documento 06-CONTRATO-TERMINAL.md mantém hvb-terminal-dev congelado; nenhum código ou arquivo dessa branch/pasta foi alterado.

## Decisões

- Etiqueta fictícia identifica exatamente um paciente ou posição de estoque por UUID. Não é uma credencial e não prova presença, identidade profissional ou execução. Código permanece único por organização/unidade; revogação preserva a etiqueta e não permite reassociar o código a outro alvo.
- Leitura registra etiqueta, operador autenticado, dispositivo, referência, instante ocorrido e episódio opcional escolhido explicitamente. Não cria episódio, execução, consumo, cobertura ou cobrança. Contexto de paciente exige cadastros:ler; posição exige estoque:ler; episódio escolhido exige episodios:ler.
- As rotas de leitura/retirada exigem X-Device-Id, terminal:usar, unidade, simulação e confirmação literal. A API valida o dispositivo ativo, sua unidade e dispositivos:usar. Identificação NFC continua inelegível como Bearer. Nenhum login operacional por NFC foi introduzido.
- Episódio escolhido deve pertencer ao alvo/contexto e permanecer sem saída física. Posição de custódia do tutor exige paciente/episódio compatíveis. Alta clínica não é confundida com saída; regras próprias da execução clínica permanecem no módulo clínico.
- Retirada informa leitura, origem, destino, quantidade e instante. Origem deve coincidir com a posição lida, e a leitura deve pertencer ao mesmo operador/dispositivo. Exige também estoque:movimentar e revalida contexto/etiqueta antes do movimento. Instante da retirada não pode anteceder a leitura.
- Retirada reutiliza a ação interna de estoque. O vínculo terminal tem exatamente o ID da transação física e o mesmo comando. Se o vínculo falha, o movimento inteiro é desfeito. Uma leitura admite somente uma retirada confirmada; nova intenção exige nova leitura. Retry da mesma chave/corpo recupera o resultado original.
- Etiqueta/revogação são serializadas por trava da etiqueta. Episódio e dispositivo usam travas compatíveis com seus encerramentos/desativações. A checagem compartilhada de dispositivo em comandos ganhou FOR SHARE para revalidar desativação concorrente antes de efetuar a ação.
- Consulta de comando por chave é restrita à organização, operador, dispositivo ativo e unidade atuais, com terminal:ler e dispositivos:usar. Retorna identidade do comando/entidade, operação, estado e datas, sem corpo original, segredo ou permissão embutida.

## Estados e recuperação

Confirmado exige resposta do servidor ou consulta que localize o comando confirmado. Timeout ou perda de conexão significa resultado desconhecido para o cliente; não significa rejeição. Consultar com a mesma chave e repetir o mesmo corpo/dispositivo/operador resolve pela idempotência. Um 404 na consulta não comprova ausência definitiva de efeito: outra transação pode estar em andamento. Não gerar chave nova para uma intenção de resultado desconhecido.

Rejeição é apresentada pelo erro HTTP e código de domínio; transação falha não deixa comando ou efeito parcial. O contrato de consulta admite pendente para comando ainda sem conclusão visível, mas C5 não implementa fila offline nem promessa de execução posterior. O fluxo atual é síncrono; não existe uma tela de confirmação ou fila de cliente nesta entrega.

## Limites

Metadados de leitura não liberam prontuário, conteúdo documental ou saldo sem as permissões correspondentes. As APIs originais de estoque continuam disponíveis a operadores autorizados; C5 é uma entrada vinculada à leitura, não uma exigência universal de NFC para movimentação.

Código de etiqueta pode ser copiado; não tem valor de autenticação. Não há hardware, gravação/leitura física NFC, cache/offline, segredo persistido no terminal, driver, cliente instalado ou conexão direta do terminal ao PostgreSQL. O cenário demonstrativo usa credenciais sintéticas apenas no processo local de teste. Dados de paciente/dispositivo e chaves dos exemplos também são fictícios.

Leituras aceitam instante passado explícito na simulação; política real de retrospectividade, duração da seleção, sessões de operador, troca de usuário, renovação de etiqueta, auditoria de leitura e acesso a comandos de dispositivo desativado continuam pendentes. Reversão do movimento é feita pelo contrato existente de estoque e não libera a leitura para uma segunda retirada.
