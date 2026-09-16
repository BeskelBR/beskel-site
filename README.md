# HVB Terminal — Terminal de Acesso

Protótipo de desenvolvimento do Terminal físico do Hospital Veterinário Brasília.

> **Arquitetura funcional vigente:** o Terminal não é mais concebido como estação completa de picking/estoque. Seu papel aprovado é **identidade, autenticação, autorização e controle de acesso físico**. O picking será realizado pelo **HVB Mobile** e a escrituração será responsabilidade da **API do HVB Sistema**.

A implementação atual ainda representa o protótipo anterior de controle de materiais e permanece preservada, sem reescrita, até que os contratos mínimos do HVB Sistema estejam estáveis.

## Documentação vigente

- `docs/TERMINAL-ARQUITETURA-V2.md` — protocolo funcional aprovado do Terminal de Acesso;
- `docs/DELTA-IMPLEMENTACAO-V2.md` — impacto sobre a implementação atual e plano de migração.

Em caso de divergência funcional entre este README, o código legado do MVP e a documentação v2, **a arquitetura v2 prevalece como direção de projeto**, embora ainda não esteja implementada.

## Separação de responsabilidades

```text
HVB SISTEMA / CONSULTÓRIO
→ cria Ordem de Retirada

TERMINAL DE ACESSO HVB
→ identifica/autentica
→ autoriza sessão
→ participa do controle físico

HVB MOBILE
→ guia picking
→ captura exceções
→ confirma resultado

API HVB
→ valida regras
→ escritura estoque/custo/auditoria

POSTGRESQL
→ fonte oficial dos dados
```

Princípio operacional:

```text
CONSULTÓRIO SOLICITA
→ TERMINAL AUTENTICA
→ SALA LIBERA
→ MOBILE GUIA
→ API ESCRITURA
```

## Autenticação prevista

Fluxo alvo:

```text
DESFire EV3
→ reconhecimento facial 1:1
→ PAD/liveness
→ validação da API
→ AccessSession
```

O processamento biométrico deve preferencialmente ocorrer localmente. A API não deve confiar em uma simples flag enviada pelo cliente; evidências precisam ser vinculadas ao terminal/dispositivo e protegidas contra replay.

## Estoque sensível

O controle físico deve liberar barreiras em sequência apropriada:

```text
autenticação
→ porta autorizada
→ entrada confirmada
→ porta fechada
→ armário sensível autorizado [se necessário]
→ armário fechado
→ saída
→ sessão encerrada
```

Não liberar porta e armário simultaneamente sem necessidade.

Offline + estoque sensível deve permanecer `FAIL_CLOSED` por padrão, salvo procedimento formal de contingência posteriormente aprovado pelo HVB.

## Estado atual do código

O código desta branch ainda implementa o **MVP anterior**, criado para validar o fluxo operacional de materiais com dados fictícios.

### Rotas legadas atuais

- `/` — repouso/NFC;
- `/auth/[token]` — autenticação de demonstração;
- `/atendimentos` — seleção de PET/atendimento;
- `/atendimento/[id]` — atendimento selecionado;
- `/materiais` — catálogo de materiais;
- `/retirada` — quantidade e revisão;
- `/sucesso` — retirada simulada concluída;
- `/admin/auditoria` — auditoria somente leitura.

As rotas de atendimento/material/retirada estão **depreciadas conceitualmente** para a arquitetura v2, mas ainda não foram removidas.

## Arquitetura técnica atual do protótipo

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

Esse desacoplamento continua válido e deve ser preservado. O contrato do adapter é que será migrado futuramente de operações de picking/consumo para operações de identidade, ordens pendentes, AccessSession e eventos de acesso.

Nenhuma integração com SimplesVet existe nesta versão.

## Persistência atual

O MVP usa armazenamento em memória no backend serverless. O objetivo é apenas demonstração.

O estado pode reiniciar após cold start/deploy. O `store` atual **não deve evoluir para banco definitivo** nem ser considerado fonte oficial de estoque.

A persistência real pertence ao HVB Sistema/PostgreSQL, acessada somente pela API.

## Segurança do MVP

- `noindex`, `nofollow`, `noarchive` no ambiente DEV;
- tokens de demonstração não sequenciais e sem dados pessoais reais;
- sessão temporária;
- nenhum segredo real no repositório;
- nenhum banco real exposto ao frontend;
- nenhum acesso a sistemas do HVB;
- dados 100% fictícios.

## Identidade visual

A implementação utiliza os assets oficiais fornecidos pelo projeto HVB e os tokens institucionais:

- Azul HVB: `#0A3983`;
- Ciano HVB: `#25B0E6`;
- Branco: `#FFFFFF`;
- Tipografia operacional: Nunito.

Cores de sucesso/alerta/erro permanecem funcionais. Legibilidade e segurança operacional prevalecem sobre ornamentação.

## Ambiente

Planejado para `hvb-dev.beskel.com.br` após validação do preview e autorização específica de configuração de domínio.

O site institucional da BESKEL na branch `main` não deve ser alterado por este projeto.

## Regra de congelamento da implementação

O Terminal permanece **congelado para reescrita funcional** até que o HVB Sistema entregue contratos suficientemente estáveis para:

- identidade/credencial/dispositivo;
- Ordens de Retirada pendentes;
- autenticação/evidências;
- `AccessSession`;
- autorização/eventos de acesso;
- auditoria;
- regras mínimas de contingência.

Até então, preservar o protótipo atual e evoluir apenas documentação/contratos quando necessário.

## Migração futura

Quando os contratos do HVB Sistema estiverem estáveis, o frontend será migrado para o papel de Terminal de Acesso sem reutilizar o mock atual como fonte de verdade.

A BESKEL é o ambiente de desenvolvimento/demonstração; a arquitetura funcional definitiva deve poder migrar integralmente para infraestrutura própria do HVB.