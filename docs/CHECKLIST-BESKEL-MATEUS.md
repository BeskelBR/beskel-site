# Checklist BESKEL — Mateus

Responsável: **Mateus / BESKEL**  
Objetivo: organizar o desenvolvimento, validação técnica e evolução do site público HVB sem misturar pendências institucionais do hospital com responsabilidades de implementação da BESKEL.

## 1. Pendências imediatas da Home

- [x] Corrigir telefone fixo para **(61) 3226-8431**.
- [x] Corrigir WhatsApp para **(61) 99646-8881**.
- [x] Tornar endereço, telefone, WhatsApp e mapa acessíveis diretamente no HTML, sem depender de JavaScript para aparecerem.
- [x] Carregar `brand-contact.css` diretamente no `<head>` para evitar flash/reflow causado por injeção tardia via JavaScript.
- [x] Manter placeholders `[X]` e `FOTO REAL` como marcações explícitas de dados ainda pendentes enquanto a Home estiver em construção.
- [ ] Validar visualmente o deploy após cada alteração estrutural importante.
- [ ] Fazer revisão completa da Home desktop antes do passe responsivo final.

## 2. Conteúdo e dados que dependem do HVB

Não substituir marcadores por estimativas. Aguardar dados do checklist do Rafael.

- [ ] Inserir quantidade real de especialidades.
- [ ] Inserir quantidade real de profissionais.
- [ ] Atualizar lista final de especialidades.
- [ ] Atualizar lista final de serviços.
- [ ] Inserir dados reais do corpo clínico.
- [ ] Inserir dados validados da ambulância.
- [ ] Inserir história e texto institucional aprovado.
- [ ] Substituir todos os placeholders `FOTO REAL` pelos assets reais aprovados.

## 3. Fotografias e assets

Quando os arquivos forem recebidos:

- [ ] Preservar os originais fora das versões otimizadas.
- [ ] Renomear assets de forma semântica e consistente.
- [ ] Incorporar os arquivos ao repositório em `assets/hvb/photos/`.
- [ ] Gerar versões otimizadas para web sem alterar conteúdo ou identidade visual.
- [ ] Preferir WebP/AVIF quando compatível com a estratégia do projeto.
- [ ] Definir `width`/`height` ou proporção para evitar CLS.
- [ ] Inserir `alt` coerente quando a imagem for informativa.
- [ ] Usar `loading="lazy"` fora da área crítica; avaliar preload/priority apenas para o Hero se necessário.
- [ ] Verificar recortes desktop/mobile antes de aprovar cada imagem.

## 4. Ambulância — destaque visual futuro

Manter o diferencial visível sem competir com a marca HVB.

- [ ] Substituir o ícone provisório por fotografia real da ambulância quando o asset estiver disponível.
- [ ] Preservar azul HVB, ciano e branco como base cromática; não criar paleta paralela para ambulância.
- [ ] Usar uma faixa institucional ou bloco editorial limpo, evitando gradientes excessivos ou estética promocional de startup.
- [ ] Dar prioridade a uma foto horizontal da ambulância com identidade HVB claramente visível.
- [ ] Manter CTA direto para WhatsApp/telefone conforme política final aprovada pelo Rafael.
- [ ] Avaliar selo textual discreto como `Ambulância veterinária` ou `Transporte integrado ao atendimento`, sem criar nova submarca.
- [ ] Se a fotografia for forte, reduzir ornamentos e permitir que o veículo seja o elemento de destaque.

## 5. Páginas ainda a desenvolver

Não remover os links provisórios apenas porque as páginas ainda são básicas. Desenvolver e substituir progressivamente os shells atuais.

### Institucional
- [ ] `O HVB` — história, propósito, diferenciais, métricas e fotografia institucional.
- [ ] `Estrutura` — ambientes, tecnologias e fotografias reais.
- [ ] `Equipe` — corpo clínico, CRMVs, especialidades e bios.
- [ ] `Trabalhe conosco` — página/fluxo futuro; link já existente deve ser resolvido antes da produção.

### Atendimento
- [ ] Landing `Serviços`.
- [ ] `Emergência 24h`.
- [ ] `Ambulância` — decidir se terá página própria ou seção aprofundada.
- [ ] `Consultas`.
- [ ] `Exames`.
- [ ] `Cirurgias`.
- [ ] `Internação`.
- [ ] `Hemodiálise`.

### Conteúdo
- [ ] Landing editorial.
- [ ] Estrutura de artigos/orientações.
- [ ] Fluxo de revisão técnica pelo HVB.

### Contato
- [ ] Atualizar a página interna de Contato para os dados oficiais já confirmados.
- [ ] Garantir consistência entre Home, página de contato, schema e demais pontos de exibição.

## 6. HVB Integra

- [x] Manter `pages/hvb-integra/` versionado na branch para desenvolvimento futuro.
- [x] Excluir `pages/hvb-integra/**` do deploy Vercel enquanto o produto não estiver aprovado.
- [ ] Revisar modelo jurídico/regulatório antes de exposição pública.
- [ ] Desenvolver conteúdo, identidade de aplicação e arquitetura à medida que o produto for consolidado.
- [ ] Remover a exclusão do deploy apenas após autorização expressa.

## 7. Links provisórios

- [ ] Manter os links estruturais já previstos durante o desenvolvimento.
- [ ] Substituir `href="#"` de `Trabalhe conosco` por destino real antes da produção.
- [ ] Atualizar links do footer para as páginas específicas quando estas estiverem concluídas.
- [ ] Revisar links internos após cada nova página publicada.
- [ ] Fazer varredura de links quebrados antes da migração final.

## 8. Responsividade

Estratégia atual: concluir primeiro a referência desktop e depois realizar um passe responsivo coordenado.

- [ ] Fechar composição desktop da Home.
- [ ] Passar por notebook.
- [ ] Passar por tablet.
- [ ] Passar por mobile padrão.
- [ ] Passar por mobile pequeno.
- [ ] Validar header/menu móvel.
- [ ] Validar logos e shells.
- [ ] Validar grids, cards, botões e CTAs.
- [ ] Verificar overflow horizontal e quebras de texto.
- [ ] Ajustar alvos de toque e espaçamentos.
- [ ] Evitar breakpoints usados apenas para mascarar problemas estruturais.

## 9. Acessibilidade e qualidade técnica

- [ ] Validar hierarquia de headings.
- [ ] Validar foco visível e navegação por teclado.
- [ ] Validar `alt` das imagens reais.
- [ ] Validar contraste dos estados normais/hover/focus.
- [ ] Verificar semântica de links e botões.
- [ ] Verificar comportamento com JavaScript desabilitado para informações essenciais.
- [ ] Revisar `prefers-reduced-motion` caso animações sejam adicionadas.

## 10. Performance

- [ ] Otimizar imagens reais antes da publicação.
- [ ] Controlar LCP do Hero.
- [ ] Controlar CLS de imagens, logo e fontes.
- [ ] Evitar bibliotecas adicionais sem necessidade concreta.
- [ ] Revisar carregamento das fontes.
- [ ] Fazer auditoria de assets não utilizados ao final de cada grande etapa.

## 11. SEO e edição final antes da migração para o domínio público

Executar como **etapa final obrigatória antes de migrar para `hvb.com.br`**.

- [ ] Remover `noindex/nofollow` somente quando o site estiver pronto para indexação.
- [ ] Configurar `canonical` definitivo.
- [ ] Criar/validar `<title>` e meta description de cada página.
- [ ] Configurar Open Graph.
- [ ] Configurar card social e imagem institucional HVB.
- [ ] Criar favicon oficial do HVB a partir de asset aprovado.
- [ ] Criar/atualizar `site.webmanifest` específico do HVB.
- [ ] Criar `sitemap.xml` apenas com URLs HVB definitivas.
- [ ] Atualizar `robots.txt` para produção.
- [ ] Revisar Schema.org/JSON-LD do hospital.
- [ ] Revisar URLs públicas e redirects necessários.
- [ ] Validar 404.
- [ ] Validar compartilhamento WhatsApp/redes sociais.
- [ ] Validar Vercel, Cloudflare, HTTPS e cache/CDN.
- [ ] Validar domínio principal e `www` conforme arquitetura definida.
- [ ] Confirmar que rotas internas/sistema permanecem separadas do site público.

## 12. Integrações futuras

Após auditoria do SimplesVET e definição da camada de dados:

- [ ] Planejar banco de dados institucional.
- [ ] Mapear quais módulos públicos podem consumir dados sem expor informações internas.
- [ ] Separar completamente frontend público, sistema interno e permissões.
- [ ] Definir integrações somente leitura quando apropriado.
- [ ] Planejar formulários/contatos com validação, proteção contra spam e tratamento de dados.

## 13. QA antes de considerar cada etapa concluída

- [ ] Comparar resultado real com o esperado no navegador.
- [ ] Verificar console e imports quebrados.
- [ ] Verificar assets e caminhos com case sensitivity.
- [ ] Verificar desktop e mobile quando a etapa já estiver na fase responsiva.
- [ ] Verificar componentes compartilhados após alterações em header/footer/tokens.
- [ ] Confirmar status de deploy.
- [ ] Não declarar conclusão sem evidência visual e técnica suficiente.
