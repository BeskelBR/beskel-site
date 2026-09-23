# ADR 0029 — Sessão web local e contexto próprio do piloto

Data: 23/09/2026. Evolução aditiva autorizada pelo plano de entrega da semana. Versão 0.28.0; frontend MVP 10. Nenhuma migration nova ou alteração do Terminal v1.

## Decisão

O servidor de interface troca a credencial temporária existente por sessão aleatória de 256 bits, mantida em memória. O navegador recebe cookie `HttpOnly`, `SameSite=Strict`, `Path=/`, sem Domain. A credencial API não é devolvida e deixou de ser mantida em sessionStorage; registros antigos são removidos ao carregar a interface. O identificador público `view_id` guardado na aba não autentica sozinho: vincula as requisições ao contexto da entrada atual e impede que uma aba antiga grave silenciosamente com o usuário de uma entrada posterior.

O recorte é exclusivamente HTTP loopback. Por isso o cookie local não utiliza Secure; **não é configuração para hospedagem externa**. Host local e Origin exato são exigidos nas mutações; Fetch Metadata cross-site é recusado. Não há CORS permissivo. Login recebe apenas JSON limitado a 1 KiB. O proxy aceita somente sessão válida e substitui Authorization no servidor, sem transmitir cookies à API. A API direta mantém Bearer e as credenciais do Terminal, sem alteração.

Sessões expiram após 15 minutos sem requisições autenticadas ou uma hora absoluta. Reiniciar o processo invalida todas. Há limite de 100 sessões e dez tentativas de entrada em 15 minutos por endereço local; entrada válida reinicia o contador. Logout remove a sessão no servidor; nova entrada rotaciona o cookie. Resposta 401 do backend encerra a sessão web; revogação e inativação continuam conferidas pela autenticação original em cada operação. `/session` fornece POST de entrada, GET de restauração e DELETE de saída; essas rotas são do servidor frontend, não do contrato Terminal/OpenAPI da API.

`GET /v1/me/contexto` acrescenta nome, unidades e permissões do próprio usuário. Usa a transação autenticada/auditada e a mesma trava de atribuições do RBAC. Atribuições revogadas são excluídas; permissões globais e por unidade continuam distintas. Atribuição global com permissões permite listar unidades da organização; atribuições apenas por unidade expõem somente as unidades correspondentes. Isso não concede permissões adicionais a nenhuma operação. Não há parâmetro para consultar outro usuário/organização. Migrations/RLS vigentes permanecem intactas.

## Supersessão e limites

Substitui funcionalmente o armazenamento Bearer no navegador do MVP 8/9 e a seleção manual de UUID como contingência de unidades. Os documentos desses lotes ficam como histórico. A interface atual depende do servidor Node de sessão/proxy na mesma origem; hospedar apenas os assets estáticos não oferece esse fluxo.

Login com senha/SSO, MFA, recuperação/renovação operacional, contas reais, trilha persistente de entradas anônimas, limitação distribuída, TLS/Secure, armazenamento compartilhado de sessões e ambiente hospedado **continuam por implementar/configurar**. Não chamar essa entrega de autenticação operacional definitiva ou homologação concluída. Não provisionar infraestrutura a partir desta ADR.

Referências de critérios: [OWASP — Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) e [OWASP — CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). O uso dessas referências não constitui certificação de segurança.

## Evidência e continuidade

Antes da orientação de economia de cota de 23/09, passaram três testes do servidor frontend, cinco da sessão web e cinco do piloto/API/PostgreSQL, incluindo revogação e isolamento. No navegador desta etapa foram conferidos entrada, carregamento das unidades e cadastro sintético; o restante da verificação visual foi adiado por pedido do usuário. Evidências do MVP 9 não são reclassificadas como verificação completa do MVP 10.

A partir dessa orientação, a verificação por desenvolvimento limita-se à integridade do código. Testes e verificação visual ficam preservados para execução posterior explicitamente solicitada.
