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
- Logos oficiais versionados em `assets/hvb/brand/`
- Não redesenhar, reconstruir ou aproximar a marca quando houver asset oficial disponível.

## Estrutura atual

- `index.html` — Home pública
- `404.html` — página de erro institucional
- `assets/hvb/css/styles.css` — design system e responsividade
- `assets/hvb/css/brand-contact.css` — ajustes de marca, contato e componentes institucionais
- `assets/hvb/js/app.js` — interações da interface
- `config/site.js` — URLs e dados institucionais configuráveis
- `pages/` — páginas internas do HVB em expansão
- `docs/HVB_ASSETS.md` — política de assets do site público

## Home atual

1. TopBar
2. Header
3. Hero
4. Ambulância veterinária
5. Como podemos ajudar
6. O HVB
7. Estrutura
8. Especialidades
9. Corpo clínico
10. Emergência 24h
11. Conteúdo
12. Localização e contato
13. Footer

O HVB Integra permanece como frente em desenvolvimento e não integra a navegação pública atual.

## Fotografias reais

Onde ainda não existe fotografia validada, utilizar o componente visual:

`FOTO REAL — “Alvo da fotografia”`

Não substituir esses espaços por imagens genéricas de banco ou IA.

## Dados institucionais

Os dados utilizados pela interface pública ficam centralizados em `config/site.js`.
Alterações de endereço, telefone, WhatsApp, e-mail, redes sociais ou URLs devem ser feitas nessa fonte após validação institucional.

Ainda dependem de validação antes de publicação definitiva, entre outros:

- números institucionais apresentados como métricas;
- nomes e CRMVs;
- lista final de especialidades;
- textos e regras da futura frente HVB Integra.

## Indexação

O ambiente de desenvolvimento está configurado como `noindex, nofollow` até a migração para o domínio público definitivo.

## Higiene da branch

A branch deve conter apenas arquivos necessários ao site público do HVB e sua documentação técnica. Assets, páginas, estilos e scripts legados do site BESKEL não devem ser mantidos aqui.
