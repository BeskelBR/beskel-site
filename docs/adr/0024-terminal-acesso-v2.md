# ADR 0024 — Terminal de Acesso V2

Data: 16/09/2026. Estado: aceita para DEV sintético. Substitui a fronteira funcional de C5 conforme solicitação posterior do usuário. A ADR 0015 continua intacta como registro da arquitetura anterior, correta para o requisito daquele momento.

## Decisão

Consultório/Sistema solicita uma Ordem de Retirada; Terminal autentica e registra acesso; Mobile executará picking; API validará fulfillment e escriturará pelo estoque existente. PostgreSQL continua fonte oficial. Autenticação, acesso, retirada, execução clínica e cobrança são fatos distintos.

Neste lote, C14 implementa P0/P1 do delta: ordem com itens, submit/cancelamento, challenge/evidência, AuthSession, AccessSession com múltiplas ordens e eventos de barreira. O episódio fornece a identidade do paciente. Produtos são referências do catálogo existente; criar ordem não reserva nem movimenta saldo.

Ordem e itens são imutáveis; estado é projeção de eventos. Rascunho pode ser cancelado/recriado. Submit produz AGUARDANDO_RETIRADA. DOOR_AUTHORIZED não muda a ordem. Só ENTRY_CONFIRMED produz EM_SEPARACAO, atomicamente para as ordens vinculadas. RETIRADA_CONFIRMADA/ENCERRADA ficam reservadas ao futuro fulfillment; não há endpoint para declarar esses estados sem escrituração válida. Devoluções/acréscimos deverão ser novos fatos com referência à origem, sem editar movimentos antigos.

## Confiança e simulação

O servidor normal não instala adaptador: challenge, autenticação e novos eventos de acesso ficam indisponíveis (503). Scripts/testes instalam explicitamente um adaptador SIMULADO_DEV com chave aleatória em memória. Um envelope HMAC é verificado no servidor; flags avulsas de UI são rejeitadas. A chave e um endpoint de assinatura não são disponibilizados por HTTP. Evidência vincula challenge/nonce, usuário, dispositivo, identidade, face 1:1 e PAD declarados pelo simulador. O banco conserva hash da atestação, engine/versão, captura e expiração; nenhum template/imagem biométrica é armazenado.

Isso prova a fronteira técnica de verificação, não biometria real, DESFire, PAD ou atestação de hardware. O adaptador futuro precisará de confiança provisionada, identidade do dispositivo biométrico separada, chaves/certificados, revogação e retenção. Atualmente terminal e dispositivo biométrico são o mesmo dispositivo sintético. O envelope é opaco no OpenAPI; o tipo VerifiedEvidence descreve o resultado confiável de sua validação.

Challenge e AuthSession duram no máximo dois minutos; evidência só é consumida uma vez. AccessSession dura no máximo 15 minutos e permite um uso da AuthSession. Esses prazos são propostas DEV. Sessões/ações permanecem vinculadas ao mesmo usuário, credencial e terminal; RBAC por unidade e revalidação de credencial/dispositivo seguem a fundação. A criação de sessão sensível e novos eventos dessa sessão exigem terminal:sensivel. Permissões atuais são checadas antes de novos efeitos. Retry exato recupera confirmação histórica; nunca deve ser interpretado pelo futuro controlador como nova autorização física.

Eventos de sensores são explicitamente simulados, com terminal:eventos_dev. O futuro controlador terá credencial e protocolo próprios; nenhuma abertura física é comandada agora. A sequência impede armário antes de entrada e porta fechada. O escopo não pode ser ampliado silenciosamente; step-up ficará explícito em lote futuro. Offline não concede autorização: sensível permanece fail_closed. Os eventos preservam ocorrida_em e criada_em (recebimento pelo servidor).

## Compatibilidade

POST /terminal/retiradas está deprecated: novos comandos recebem 409/terminal_retirada_legada_use_mobile_api. A chamada interna ao estoque foi removida. O mecanismo original de idempotência ainda pode recuperar resultado de comando histórico já confirmado com chave/corpo/autor/dispositivo originais. Novos INSERTs em retirada_terminal são bloqueados por trigger aditivo. GETs, dados e migrations 047/048 não são removidos ou reescritos. Etiquetas/leituras legadas continuam identificação de contexto, sem autenticar usuário.

## Limites preservados

Sem UI Mobile, fulfillment gravável, hardware, WhatsApp ou Edge. Sem efeitos de estoque, custo, execução ou faturamento pelo acesso. A classificação sensível é declarada na solicitação DEV e ainda não representa uma classificação hospitalar autoritativa do catálogo. Não há intertravamento entre salas/dispositivos físicos, detecção de carona, saída de emergência ou recuperação supervisionada de sessão expirada. Expirar autorização não prova saída/fechamento físico; antes de hardware, essas políticas precisam de fatos próprios. Sessões expiradas não recebem novas autorizações; após EXIT é possível registrar ACCESS_CLOSED, inclusive depois do prazo, preservando identidade/permissões. Encerramento após timeout em estados intermediários exige fluxo posterior.

Pedido, picking efetivo e seus efeitos serão validados pela API futura, inclusive episódio atual, versão, quantidades exatas, lote/validade, custódia, saldo, omissões, adicionais, autorização sensível e compensações. O contrato TypeScript de proposta/compensação é preparação, não implementação de fulfillment. Ver PENDENCIAS-HVB.md e DADOS-C14.md.
