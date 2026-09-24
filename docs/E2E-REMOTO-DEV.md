# Primeiro E2E remoto — execução parcial

**Atualização em 24/09/2026:** confiança TLS resolvida. Node/pg realizou handshake real em TLS 1.3, validando certificado e hostname; `pg_stat_ssl` confirmou TLS. A CA pública da URL referenciada pelo dashboard oficial foi configurada exclusivamente no ambiente privado como `HVB_DATABASE_CA_PEM`. Nenhum relaxamento de TLS ou certificado versionado. Este recorte foi somente conexão/consulta de transporte: não prova login humano, `/ready` ou jornada autenticada. O pedido histórico de CA abaixo está superado; os demais testes continuam pendentes. Ver [LOGIN-HUMANO-077.md](LOGIN-HUMANO-077.md) e [evidência](evidencias/preparacao-077-tls.json).

23/09/2026. Backend avaliado: `8ba6c2d2a18121f721e54c51d3e3d7caac9536ef`, branch `hvb-sistema-dev`, working tree inicialmente limpo. Conexão e verificação expressamente autorizadas pelo usuário após retorno do responsável pelo banco.

Na publicação, commits concorrentes do frontend até `56cd405adda2a226945fe8a181ecccea2c351c2e` foram integrados sem conflitos ou edições próprias nesses arquivos. A evidência do responsável registra integração MVP 11 e testes isolados, não E2E com API/PostgreSQL. Backend executado e blocos congelados permaneceram iguais.

## Resultado constatado

O arquivo privado indicado pelo usuário foi encontrado e carregado exclusivamente em memória. Opt-in remoto DEV e TLS verify-full: PASS. A conexão PostgreSQL foi interrompida na validação da cadeia TLS, com `SELF_SIGNED_CERT_IN_CHAIN`, antes da autenticação PostgreSQL e de qualquer consulta SQL.

Uma segunda tentativa usou `node --use-system-ca`, preservando validação de certificado/hostname; o mesmo erro ocorreu. Não houve nova tentativa idêntica, relaxamento de TLS ou instalação de certificados. A configuração não contém `HVB_DATABASE_CA_PEM`; falta fornecer ao Node uma cadeia de confiança verificada para o endpoint. Isso não contradiz a evidência de TLS fornecida pelo outro chat, mas impede confirmar a conexão a partir deste cliente.

Também não há `HVB_E2E_API_TOKEN` no ambiente privado. A identidade PostgreSQL provisionada autentica a conexão do banco; ela não substitui a credencial opaca de um usuário HVB sintético para a etapa autenticada da API.

| Verificação | Resultado |
|---|---|
| Leitura do arquivo privado e opt-in DEV/TLS | PASS |
| Conexão com confiança padrão Node | FAIL — SELF_SIGNED_CERT_IN_CHAIN |
| Conexão com confiança do Windows (`--use-system-ca`) | FAIL — mesmo erro |
| Consultas de capacidades, transação e rollback no remoto | NÃO EXECUTADO — bloqueadas por TLS |
| HTTP `/health`, `/ready` e autenticação neste E2E | NÃO EXECUTADO — a verificação interrompe antes de iniciar a API |
| Etapa com identidade HVB válida | BLOQUEADO POR CONFIGURAÇÃO EXTERNA — TLS e credencial HVB sintética |
| Tipos, lint e formato do verificador | PASS |

As capacidades, grants, LOGIN/NOLOGIN e migrations informados pelo chat do banco permanecem evidência atribuída ao responsável; não foram novamente comprovados por este cliente. E2E remoto não está concluído, nem há homologação ou deploy.

## Retomada reproduzível

O verificador [scripts/verify-remote-dev.ts](../scripts/verify-remote-dev.ts) recebe obrigatoriamente um caminho privado fora do workspace. Não carrega `.env` do projeto por fallback. A saída contém somente checks/status e códigos permitidos; nunca URLs, host do projeto remoto, valores de ambiente, corpos de resposta, IDs humanos, tokens ou certificados.

```powershell
node scripts/verify-remote-dev.ts "C:/Users/Admin/OneDrive/HVB_RUNTIME_PRIVATE/.env.remote-dev"
```

O caminho acima é o fornecido pelo usuário, não um arquivo para versionar. O arquivo homônimo neutralizado na pasta SISTEMA não foi utilizado. Nenhum segredo foi copiado para SISTEMA ou Git.

Após o TLS ser resolvido, o script verifica certificado/hostname e versão TLS, capacidades da identidade de runtime e presença da migration 076, contexto transacional com restauração após COMMIT/ROLLBACK e HTTP real em loopback com banco remoto. Não executa seed, migration ou escrita de dados de domínio. GETs autenticados preservam a auditoria normal da API e, portanto, podem registrar eventos de leitura; isso não é uma execução SQL inteiramente read-only quando a credencial sintética for fornecida.

Somente se `HVB_E2E_API_TOKEN` estiver no ambiente privado, verifica `/v1/me` e `/v1/me/contexto` sem imprimir as respostas. Este recorte não substitui a jornada clínica de escrita nem testes visuais do frontend.

## Pedido único ao chat do banco

```text
O primeiro E2E pelo backend foi iniciado, mas o cliente Node recusou a cadeia TLS com SELF_SIGNED_CERT_IN_CHAIN. O mesmo ocorreu usando as CAs do Windows; verify-full/rejectUnauthorized=true foram preservados. Nenhuma consulta SQL foi executada. A configuração privada atual não contém HVB_DATABASE_CA_PEM.

Obtenha e verifique a CA/cadeia oficial correspondente ao endpoint direct configurado, por fonte autenticada/confiável. Disponibilize o PEM em HVB_DATABASE_CA_PEM no mesmo arquivo privado OneDrive/HVB_RUNTIME_PRIVATE/.env.remote-dev. Não confie automaticamente no certificado apresentado por uma conexão não validada; não use rejectUnauthorized=false ou sslmode sem verificação. Preserve identidade, endpoint, migrations e C18, salvo necessidade comprovada sob sua responsabilidade.

Para concluir a etapa autenticada no mesmo ciclo, disponibilize também uma credencial opaca válida de usuário HVB sintético em HVB_E2E_API_TOKEN no ambiente privado. Se a fixture sintética ainda não existe, prepare o mínimo necessário pelo fluxo autorizado do seu bloco; não usar dados reais, executar seed completo por inferência ou criar migration. Informe somente que a configuração segura está pronta e quais etapas foram verificadas, nunca os valores.

O backend retomará com node scripts/verify-remote-dev.ts seguido do caminho privado já informado. Não use o arquivo neutralizado em SISTEMA e não envie tokens/certificados no chat ou Git.
```

Frontend, sessão/proxy e Terminal: sem alterações. Banco remoto: nenhuma alteração por este chat. Evidência sanitizada em [e2e-remoto-dev.json](evidencias/e2e-remoto-dev.json).
