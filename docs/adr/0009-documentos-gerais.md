# ADR 0009 — Documentos gerais

Data: 14/09/2026. M6C em simulação, conforme o modelo de dados do pacote e os pedidos de continuidade. Somente SISTEMA e hvb-sistema-dev, com pendências cumulativas e código no GitHub.

Modelo, versão do modelo, solicitação, autorização de acesso, versão preenchida, aprovação, declaração de assinatura e registro de entrega são fatos distintos. Um título de termo não comprova consentimento ou assinatura. O solicitante é um responsável cadastrado ou usuário interno; a autorização humana tem decisão, evidência, validade e revogação próprias. O vínculo cadastral com paciente não concede acesso automaticamente.

Modelos usam texto simples e marcadores `{{codigo}}`, com até 50 campos declarados atomicamente na mesma versão. Preenchimento substitui somente marcadores do modelo original; valores inseridos não são reinterpretados como modelo, HTML ou código. Campo obrigatório vazio e campo desconhecido são recusados. O banco preserva campos, conteúdo renderizado e SHA-256 dos bytes UTF-8 exatos. Não há consulta dinâmica a prontuário ou preenchimento clínico inferido.

Correção cria versão consecutiva com expectativa de versão e anterior explícito. Aprovação requer autorização vigente e versão mais recente. Um rascunho posterior preserva a aprovação antiga, mas bloqueia novos registros de assinatura/entrega da versão anterior até revisão. Publicação da correção marca a anterior como substituída sem apagar seu conteúdo ou evidências.

Declaração de assinatura fica sempre `declarada_nao_verificada`, vinculada à versão/hash e signatário informado. Não há criptografia de assinatura, certificado ou validação profissional neste recorte. Registro de entrega é exclusivamente manual DEV, exige aprovação, público responsável, destinatário igual ao solicitante e autorização vigente; não envia mensagem ou arquivo. Documento interno não admite entrega ao responsável nesse fluxo.

Conteúdo permanece como texto privado no PostgreSQL, protegido por RLS, unidade e permissão específica `documentos:conteudo`. A consulta exige uma versão identificada; permissão de metadados não concede conteúdo. Não foi implementado download público, PDF/DOCX, anexo ou integração com provedor. Autorizações do solicitante controlam aprovação/assinatura/entrega; o acesso de operadores internos segue RBAC/ABAC e é uma decisão distinta.

Todas as mutações da mesma solicitação usam trava transacional compartilhada, inclusive revogação. Escritas são imutáveis e vinculadas a comando aberto, autor, auditoria e outbox. Migrations aplicadas permanecem preservadas, com correções em novas migrations. Papéis agora admitem até 128 permissões para comportar as 72 capacidades cadastradas, sem concessão implícita de permissões.

Documentos gerais ainda dependem de homologação de modelos, poderes, assinatura, consentimentos e entrega real. Agenda é o próximo recorte; portal/comunicação e interface continuam futuros.
