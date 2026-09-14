# Roteiro para reduzir retrabalho e uso de cota

Atualizado em 14/09/2026, a pedido do usuário. Orientação de trabalho; não é promessa de quantidade de mensagens, créditos ou economia percentual.

## Separar discussão de execução

No chat comum, discutir processos do hospital, esclarecer pendências, revisar textos e construir exemplos de aceitação. Levar apenas a seção pertinente de `PENDENCIAS-HVB.md` e o resumo do módulo, sem reenviar todo o pacote histórico a cada discussão. Não incluir dados reais de pacientes ou credenciais.

Para cada decisão, registrar: problema, regra aprovada, exceções, exemplos de entrada/resultado esperado e quem confirmou. Trazer esse resumo ao Codex para implementar no repositório. Uma simulação textual de casos não comprova funcionamento da API ou do banco.

O Codex executa e verifica arquivos, migrations, API, PostgreSQL e Git. Não há transferência automática deste trabalho para uma conversa comum nem garantia de cota zero no chat. A documentação oficial informa que **ChatGPT Work e Codex compartilham uso, créditos e limites**. Ela também informa que modelo, contexto, raciocínio, ferramentas e complexidade influenciam o consumo; número de mensagens sozinho não prevê o custo. [Preços e limites oficiais](https://learn.chatgpt.com/docs/pricing).

## Reduzir trabalho desnecessário

- Definir um recorte com critérios de conclusão por vez e manter as demais decisões no arquivo de pendências.
- Reaproveitar testes, cenários, contratos e evidências existentes; repetir verificações quando mudanças, falhas ou riscos concretos justificarem.
- Usar testes específicos durante o ajuste e a suíte completa na conclusão. Instalação em banco vazio verifica migrations de ponta a ponta e tem finalidade distinta dos testes em base existente.
- Manter relatórios curtos de entrega e contexto de continuidade no repositório.
- Considerar modelo menor para documentação e ajustes rotineiros. Troca de modelo é uma escolha do usuário; nenhum modelo foi alterado por este roteiro. A documentação oficial recomenda essa opção para ampliar os limites. [Orientações oficiais de economia](https://learn.chatgpt.com/docs/pricing).

## Rodar testes sem uma sessão de IA

Os comandos abaixo usam Node/PostgreSQL locais; não chamam modelo ou API de IA. Executá-los diretamente no PowerShell não requer uma resposta do Codex. Se o Codex conduzir a execução, interpretar resultados ou corrigir falhas, essa assistência continua usando seus limites.

Com dependências e ambiente DEV já preparados:

```powershell
Set-Location 'C:\Users\Admin\OneDrive\BESKEL\PARCEIROS\HVB\SISTEMA'
.\scripts\pnpm.ps1 db:local
# Somente os testes de protocolos preventivos:
node --env-file=.env --test tests/preventive.test.ts
# Verificação completa, incluindo migrations e geração do OpenAPI:
.\scripts\pnpm.ps1 check
```

`check` exige `hvb-sistema-dev`, verifica/aplica migrations no DEV e roda integrações no TEST. Os testes criam dados sintéticos e preservam execuções anteriores. Esse comando atualiza a evidência do módulo em `docs/evidencias/` e regenera o contrato; não faz commit, push, deploy ou configuração externa. Os testes não substituem homologação hospitalar.

## Texto curto para começar uma discussão no chat

> Estamos construindo o HVB Sistema. O backend local já tem fundação, estoque, clínica, diárias configuráveis, financeiro simulado, exames e protocolos preventivos. Não há regras clínicas reais aprovadas, migração de dados reais ou produção. Quero discutir apenas a pendência abaixo. Ajude a formular decisões e exemplos de aceitação, distinguindo proposta de regra aprovada. Não presuma doses, preços, assinaturas ou permissões profissionais. Ao final, gere um resumo curto para implementação no Codex.

Cole em seguida somente a pendência pertinente. Os limites e recursos do chat escolhido dependem do plano e do modo; não presumir que ChatGPT Work seja uma alternativa com cota independente.
