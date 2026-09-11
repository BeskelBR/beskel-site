# HVB — Site Público Institucional

Branch dedicada exclusivamente ao site público do Hospital Veterinário Brasília.

## Branch

`hvb-site-dev`

## Ambientes congelados

- Site público DEV: `https://hvb-site-dev.beskel.com.br`
- Sistema/terminal DEV: `https://hvb-dev.beskel.com.br`
- Site público futuro: `https://www.hvb.com.br`
- Sistema futuro: `https://sistema.hvb.com.br`

## Regra de separação

Esta branch não pertence ao site da BESKEL e não deve alterar a branch `main`.
Também não deve misturar frontend, autenticação ou regras de negócio da branch `hvb-terminal-dev`.

Compartilhar apenas identidade institucional e decisões arquiteturais explicitamente aprovadas.

## Identidade HVB

- Azul HVB: `#0A3983`
- Ciano HVB: `#25B0E6`
- Branco: `#FFFFFF`
- Tipografia operacional: Nunito
- Logo: usar exclusivamente o arquivo oficial do Brand Book v5. Enquanto o asset oficial não estiver incorporado, o site exibe um placeholder explícito `LOGO OFICIAL HVB`.

## Estrutura inicial

- `index.html` — Home pública
- `assets/hvb/css/styles.css` — design system e responsividade
- `assets/hvb/js/app.js` — interações da interface
- `config/site.js` — URLs e dados institucionais configuráveis
- `pages/` — páginas internas em expansão

## Home v1

1. TopBar
2. Header
3. Hero
4. Como podemos ajudar
5. O HVB
6. Estrutura
7. Especialidades
8. Corpo clínico
9. Emergência 24h
10. HVB Integra
11. Conteúdo
12. Localização e contato
13. Footer

## Fotografias reais

Onde ainda não existe fotografia validada, utilizar o componente visual:

`FOTO REAL — “Alvo da fotografia”`

Não substituir esses espaços por imagens genéricas de banco ou IA.

## Dados ainda não validados

Não publicar como definitivos até validação:

- endereço
- telefones
- WhatsApp
- e-mail
- números institucionais
- nomes/CRMVs
- lista final de especialidades
- textos finais do HVB Integra

## Indexação

O ambiente de desenvolvimento está configurado como `noindex, nofollow` até a migração para o domínio público definitivo.
