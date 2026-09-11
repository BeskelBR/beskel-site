# HVB Terminal — MVP de desenvolvimento

Protótipo isolado do terminal de controle de materiais do Hospital Veterinário Brasília.

## Ambiente

Planejado para `hvb-dev.beskel.com.br` após validação do preview e autorização da configuração de domínio.

O site institucional da BESKEL permanece na branch `main` e não é alterado por este MVP.

## Rotas do protótipo

- `/` — repouso/NFC
- `/auth/[token]` — autenticação por credencial
- `/atendimentos` — seleção de PET/atendimento
- `/atendimento/[id]` — atendimento selecionado
- `/materiais` — catálogo de materiais
- `/retirada` — quantidade e revisão
- `/sucesso` — operação concluída
- `/admin/auditoria` — auditoria somente leitura

## Credencial de demonstração

`hvb_demo_Q7m4xP9nK2`

Exemplo:

`/auth/hvb_demo_Q7m4xP9nK2`

Todas as credenciais, funcionários, tutores, PETs, atendimentos, materiais e valores desta branch são fictícios.

## Arquitetura

A UI conversa apenas com a camada de API. A API utiliza `IntegrationAdapter` e `MockAdapter` para manter o frontend desacoplado de qualquer integração futura.

```text
UI
↓
API /api/mock
↓
IntegrationAdapter
↓
MockAdapter
↓
store mock em memória
```

Nenhuma integração com SimplesVet existe nesta versão.

## Persistência

O MVP usa armazenamento em memória no backend serverless. O objetivo é demonstrar o fluxo operacional. O estado pode reiniciar após cold start/deploy. A interface não depende desse detalhe e poderá receber armazenamento persistente posteriormente.

O saldo é calculado como consequência das transações confirmadas durante a vida do store em memória, e a auditoria é append-only no protótipo.

## Segurança do MVP

- `noindex`, `nofollow`, `noarchive` no HTML e nos headers Vercel;
- tokens não sequenciais e sem dados pessoais;
- sessão temporária de 15 minutos;
- nenhum segredo no repositório;
- nenhum banco real exposto ao frontend;
- nenhum acesso a sistemas do HVB;
- dados 100% fictícios.

## Identidade visual

A implementação utiliza os assets oficiais fornecidos pelo projeto HVB, além dos tokens institucionais:

- Azul HVB: `#0A3983`
- Ciano HVB: `#25B0E6`
- Branco: `#FFFFFF`
- Tipografia operacional: Nunito

As cores de sucesso/alerta/erro são tratadas somente como cores funcionais da interface.

## Migração futura

O app foi estruturado para migrar integralmente para um domínio/projeto próprio do HVB. A BESKEL é apenas o ambiente de desenvolvimento/demonstração e não faz parte da arquitetura funcional definitiva.
