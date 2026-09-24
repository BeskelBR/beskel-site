# Cadastro administrativo, login humano e NFC

Atualização de 24/09/2026: decisão explícita de CPF em usuario.login, temporária por email e redefinição obrigatória, com 077 canônica incorporada. Essa decisão supera a proposta de ativação/conta corporativa abaixo, preservada como histórico. Estado, bloqueios executáveis e pedido ao banco em [LOGIN-HUMANO-077.md](LOGIN-HUMANO-077.md). NFC permanece como implementado neste documento.

Delta autorizado pelo usuário em 23/09/2026. Base de integração: `354ac8833fa894616048eba4c5c2b23db7601482`. Responsabilidade deste chat: backend/contratos. Frontend/BFF e banco continuam com seus responsáveis. Terminal/C18 e migrations 001–076 preservados.

## Jornada a entregar

Um painel DEV/ADM reúne dados do funcionário, papéis/unidades, ativação do acesso humano e NFC opcional. O administrador não deve precisar de chat, SQL, UUID digitado ou edição de ambiente por funcionário. Dados administrativos e NFC não equivalem a senha ativada. A tela deve mostrar separadamente cadastro salvo, acesso pendente/ativo/bloqueado e cartão vinculado/revogado.

O painel de manutenção de funcionários foi entregue pelo frontend até `354ac88` e incorporado sem edição por este chat. Sua presença no código não comprova homologação integrada. NFC e ativação humana ainda precisam ser integrados à interface.

## Implementado neste delta: NFC no onboarding

POST `/v1/usuarios/onboarding` conserva nome, login, motivo e atribuições; aceita agora o objeto **opcional**:

```json
{"nfc":{"unidade_id":"UUID_UNIDADE","tag":"IDENTIFICADOR_SINTETICO_DO_CARTAO"}}
```

Não é um corpo completo: acrescentar esse objeto ao corpo do onboarding existente. Resposta adiciona `nfc_id` somente quando solicitado. Mesmos Bearer administrativo, Idempotency-Key e envelope anteriores. Usuário, atribuições e NFC são uma única transação; falha não deixa cadastro parcial. Sem `nfc`, comportamento anterior preservado.

O backend compõe o serviço existente de POST `/v1/terminal/v1/employee-nfc`, sem editar seus arquivos, schemas, tabelas ou regras. `employee_id` vem do usuário criado, nunca de entrada arbitrária. O administrador precisa de `acesso:administrar` global, e o funcionário deve receber `terminal:acessar` na unidade do NFC (ou global). Ausência dessa permissão recusa a operação. Não conceder acesso ao Terminal automaticamente ao marcar NFC.

Tag segue exatamente o schema canônico (8–256 caracteres) e a mesma representação da leitura do Terminal: não aplicar caixa, prefixos ou normalização diferentes no frontend. Persistência usa digest; resposta não devolve tag. O frontend não deve salvar tag em localStorage, histórico de intents persistente, telemetria ou logs; retry durante a operação pode manter corpo/chave em memória. Não há leitor físico homologado por este teste.

Cartão já vinculado na organização gera conflito, inclusive se revogado: o histórico canônico não permite reciclar silenciosamente a mesma tag. A unicidade atual também impede vincular a mesma tag a várias unidades. Para funcionário já existente, permanecem POST `/v1/terminal/v1/employee-nfc` e POST `/v1/terminal/v1/employee-nfc/{id}/revoke`, com os schemas canônicos. Não criar duplicata em `credencial(tipo=nfc)`: trata-se de contrato legado diferente.

Nova leitura administrativa: GET `/v1/usuarios/{id}/nfc?limit=25&cursor=UUID`. Exige `acesso:administrar` global e usuário da mesma organização. Retorna `{items:[{id,unidade_id,revogado}],next_cursor}`; limite 1–100, ordenação por UUID, cursor nulo ao terminar. Não retorna tag nem digest, e inclui cartões revogados para histórico. Implementada fora do módulo Terminal, usando suas tabelas existentes apenas para consulta. Usuário de outra organização retorna 404; operador sem autorização global recebe 403.

NFC simples identifica o funcionário; não é senha, Bearer web ou prova biométrica. Cadastro não autentica o funcionário, abre porta ou inicia sessão do Terminal. Biometria/checagens C18 permanecem intactas.

## Login humano: definição proposta, ainda NÃO implementada

Preferência solicitada ao usuário: login/senha com ativação pelo funcionário ou conta corporativa existente. Sem resposta, esta é a proposta de trabalho para login/senha; não constitui escolha de provedor externo nem autorização para habilitar Supabase Auth. Se houver provedor corporativo, substituir o armazenamento de senha por vínculo explícito `(issuer, subject)` mantendo usuário/organização/RBAC e estados abaixo.

1. Administrador cadastra funcionário, papéis e NFC opcional. Na mesma jornada solicita ativação. Usuário sem ativação permanece sem login humano. Não emitir Bearer utilizável apenas por ter sido cadastrado.
2. Emissão de ativação gera segredo aleatório de uso único, vinculado à organização/usuário/finalidade, com expiração proposta de 30 minutos. Administrador entrega por canal privado ao funcionário; envio de email/SMS não está implementado nem contratado. Não colocar segredo em query string, logs, auditoria, comando.resultado ou outbox. Perda/expiração exige reemissão explícita, invalidando a anterior; não recriar funcionário.
3. Funcionário apresenta ativação e escolhe senha, sem a senha definitiva passar pelo administrador. Consumo e gravação são atômicos: duas ativações concorrentes não podem vencer. Não efetuar login automático após definição/recuperação.
4. Login exige organização do ambiente + login + senha. Login é único por organização, não global. Organização não é prova de identidade; vínculo é resolvido no servidor e nunca aceito do navegador como autenticação. Preservar o identificador do usuário ao editar login.
5. BFF autentica no canal privado do backend; somente após prova válida o backend emite Bearer opaco curto, com hash na tabela de credencial existente. Navegador recebe apenas cookie de sessão HttpOnly e o envelope atual de `/session`; nenhum Bearer em HTML, JS ou armazenamento do browser.
6. Logout revoga a credencial da sessão. Bloqueio, recuperação de senha e alteração de fatores invalidam sessões existentes; RBAC continua consultado por requisição. NFC revogado impede uso do cartão no Terminal, não desativa automaticamente a conta inteira. Desativação do funcionário bloqueia ambos.

Implementação de senha deve usar hash adaptativo com salt, formato versionado e custo calibrado (Argon2id preferido; não SHA-256 simples de senha). Ativação guarda somente hash de segredo aleatório. Tratamento de senha respeita limite de tamanho explícito sem truncamento. Login deve ter respostas genéricas, limitação de tentativas persistente/compartilhada por conta e origem, proteção contra enumeração e sessão segura. Não usar NFC simples como segundo fator forte. MFA/step-up para administração e operação sensível continua pendente; não declarar exposição externa pronta.

Referências técnicas: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) e [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html). São critérios de implementação, não evidência de controles executados.

### Fronteira proposta para o BFF (sem rotas HTTP novas publicadas)

| Operação | Entrada mínima | Saída/efeito |
|---|---|---|
| Solicitar ativação (admin) | usuario_id, motivo, idempotência | ativacao_id, expira_em; segredo efêmero por canal protegido, fora da persistência genérica de comandos |
| Ativar acesso | segredo de ativação + nova senha | consome uma vez; ativa conta; nenhum Bearer |
| Autenticar | contexto de organização do ambiente, login, senha | access_token opaco 64 hex + expires_at, exclusivamente servidor-servidor |
| Encerrar sessão | credencial da sessão atual | revoga aquela sessão |
| Recuperar/bloquear (admin autorizado) | usuario_id, motivo | invalida ativação anterior/sessões conforme operação; audita sem segredos |

Nomes/URLs finais, autenticação do canal privado, TTL de sessão, política de senha/MFA e adaptação do BFF serão fechados com os contratos do banco. Não inserir essas rotas como funcionais no OpenAPI antes da implementação. Cadastro + ativação externa não pode ser chamado de transação única se usar outro provedor: a UI deve permitir retomar ativação sem repetir usuário/NFC. Para armazenamento local no banco, intenção de ativação pode entrar na transação do cadastro; a entrega do segredo exige tratamento próprio, pois o comando genérico persiste resultado para replay.

## Pedido ao chat do banco

```text
HVB — preparar contrato de persistência para login humano integrado ao cadastro administrativo, conforme docs/CADASTRO-LOGIN-NFC.md. Preservar migrations 001–076, C18/tv1_*, Bearer opaco e hvb.autenticar; não habilitar Supabase Auth nem alterar frontend/Terminal por inferência.

Há necessidade real de persistência que usuario/credencial atuais não atendem: estado de ativação humana, hash adaptativo versionado de senha (se confirmado login/senha), ativação/recuperação com segredo hasheado, finalidade, expiração, consumo único e invalidação; controle compartilhado de tentativas e vínculo de sessões humanas com credenciais API para revogação segura. Fornecer proposta de tabelas/funções/grants com tenant/RLS, locks/concorrência e auditoria sem segredos. Não reutilizar token_hash de credencial como hash de senha nem guardar segredo em comando.resultado/outbox. Evitar dar ao runtime acesso irrestrito aos hashes de todas as organizações na etapa anterior à autenticação.

Devolver contrato SQL concreto e testes sintéticos previstos, distinguindo proposto/aplicado. Migration futura pertence ao seu bloco e segue suas autorizações; não aplicar em remoto nem provisionar serviço pago por inferência deste pedido. Não enviar credenciais. A configuração de CA e fixture do E2E remoto permanece pedido separado; cadastro humano não a resolve automaticamente.
```

## Pedido ao chat do frontend

```text
HVB — integrar no painel DEV/ADM o NFC opcional de POST /v1/usuarios/onboarding conforme docs/CADASTRO-LOGIN-NFC.md e OpenAPI. Reaproveitar gestão administrativa já entregue até 354ac88. Mostrar papéis/unidade, verificar terminal:acessar sem concedê-lo automaticamente e enviar nfc:{unidade_id,tag}; nfc_id é retornado no sucesso. Sem NFC, fluxo anterior. Consultar cartões por GET /v1/usuarios/{id}/nfc (items/next_cursor); incluir vínculo/revogação pelos comandos canônicos já existentes. Não salvar tag em intents persistentes/localStorage/logs. Preservar chave/corpo de retry em memória e mostrar falha sem falso cadastro parcial.

Preparar a jornada visual única de cadastro + ativação humana + NFC, com estados reais e retomada. Login/senha/ativação ainda não são endpoints disponíveis: aguardar contrato implementado antes de habilitar envio. Não simular conta ativa. NFC simples não substitui prova de login, biometria ou sessão C18. Informar modo/leitor disponível para captura e lacunas de consulta/gestão do cartão, sem prometer hardware validado.

Preservar backend, banco e módulos Terminal congelados; executar testes do seu bloco e devolver evidência. Nada de Bearer persistente no navegador.
```

## Evidência e limites

Ver [evidência backend](evidencias/cadastro-nfc.json). Testes locais sintéticos cobrem onboarding anterior, replay concorrente, NFC com digest, conflito/rollback, permissão de Terminal, isolamento entre organizações e contratos operacionais existentes. Supabase, login humano, interface NFC e leitor físico não foram testados. Login permanece implementação pendente de contrato do banco e BFF; não há senha de funcionário criada neste delta.
