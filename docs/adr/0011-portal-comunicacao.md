# ADR 0011 — Portal e comunicação em simulação

Data: 14/09/2026. Estado: proposta técnica implementada em DEV; políticas reais pendentes.

O pacote exige separar o portal do responsável das permissões da equipe, preservar a versão documental e distinguir tentativa, envio, entrega e leitura. Nenhuma integração externa foi autorizada.

## Decisão

- Conta de portal vinculada ao responsável e à unidade, com revogação imutável. Credenciais opacas próprias, armazenadas por hash e com expiração; não são credenciais de funcionário. Provisionamento somente administrativo local, sem endpoint público de cadastro ou convite.
- Acesso depende de concessão explícita por paciente, relação cadastral vigente, evidência e validade. Relação cadastral isolada não concede acesso. Revogar conta, concessão ou encerrar vínculo suspende leituras posteriores, preservando fatos anteriores.
- Preferência versionada por conta/finalidade, com evidência. A API exige expectativa de versão. A preferência autoriza apenas o canal fictício `portal_dev`, sem equivalência a consentimento assistencial, imagem ou outra finalidade.
- Mensagem tem destinatário pela concessão, finalidade, canal, origem manual DEV, referência UUID e texto explícito. Mensagem documental incorpora de uma a cinco versões exatas na mesma transação. Agenda aponta para uma versão exata do compromisso. Não há cópia automática de prontuário, observações da agenda ou mudança de público.
- Documento precisa ser público para responsável, aprovado, sem versão posterior, com autorização vigente, paciente/unidade/destinatário compatíveis. A mesma verificação ocorre novamente ao tentar publicar e ao consultar pelo portal. Uma correção posterior oculta a mensagem antiga no portal, sem apagar o histórico interno.
- Tentativa é um fato separado. Sem resultado, ou com resultado incerto, não há repetição. Só falha declarada permite nova tentativa, até cinco. Retornos têm sequência, instante e evidência; permitem conciliação progressiva de incerto para falha/enviado/entregue/lido, enviado para entregue/lido e entregue para lido. Esses estados são declarações simuladas, sem provedor real.
- A caixa só apresenta mensagens em entregue/lido ainda autorizadas. Consultar conteúdo não muda estado para lido. Retorno tardio permanece registrável após revogação, mas não restaura acesso.
- Rotas próprias `/v1/portal/caixa` e `/v1/portal/mensagens/:id` extraem a conta da credencial; não recebem conta, organização ou responsável como seletor do cliente. Caixa paginada sem texto/documentos; conteúdo exato sob demanda e com hash. Respostas sem cache e logs sem token, corpo ou contato.
- Trava por conta serializa preferências, preparação, tentativas e revogações do portal. Preparação documental trava solicitações em ordem determinística. Leituras reavaliam os acessos no snapshot da consulta; não recolhem conteúdo já obtido por cliente autorizado anteriormente.

## Desempenho e consequências

O ensaio de mil mensagens expôs custo excessivo nos predicados SQL executados por mensagem. A migration 038 preserva as condições e usa PL/pgSQL para reutilizar planos internos. Não eleva o timeout da aplicação nem altera configurações globais. Planos e medições estão nas evidências do M6E.

Não há entrega pelo worker, e-mail, SMS, WhatsApp, callback externo, contato real, campanha, autoatendimento de preferências, MFA, recuperação de senha, revogação individual de token ou reconciliação com provedor. A revogação de conta bloqueia todas as suas credenciais; reativação/reemissão exige fluxo posterior. As tabelas têm RLS por organização; a separação entre contas de portal é feita pelos filtros obrigatórios das rotas específicas. Não há conexão de banco entregue a responsáveis.

Preferência negativa impede preparação/tentativa nova, sem apagar mensagens já disponibilizadas; para remover acesso usa-se revogação da concessão/conta. Uma autorização documental revogada também bloqueia o conteúdo. Entrega simulada não cria `entrega_documento`, assinatura, cobrança, execução clínica ou consentimento real.

Referências: modelo 12, seções Portal/comunicação e Documentos; requisitos 05; arquitetura 13; [pendências](../PENDENCIAS-HVB.md).
