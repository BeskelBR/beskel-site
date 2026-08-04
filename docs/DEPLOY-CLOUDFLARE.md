# Publicação na Cloudflare Pages

## 1. Preparar o projeto
1. Abra `assets/js/config.js`.
2. Substitua o WhatsApp provisório pelo número oficial com DDI 55 e DDD, sem espaços.
3. Confirme e-mail, Instagram e domínio.
4. Teste `index.html` com o Live Server.

## 2. Enviar ao GitHub
Crie um repositório privado ou público chamado `beskel-site` e envie todo o conteúdo desta pasta. O arquivo `index.html` deve ficar na raiz do repositório.

## 3. Criar o projeto Pages
No painel Cloudflare: `Workers & Pages` → `Create` → `Pages` → conectar ao GitHub.

Configuração:
- Production branch: `main`
- Framework preset: `None`
- Build command: vazio
- Build output directory: `/`

Cada novo push na branch `main` gera uma publicação automática.

## 4. Conectar o domínio
No projeto Pages: `Custom domains` → `Set up a domain`. Adicione primeiro `beskel.com.br` e depois `www.beskel.com.br`.

## 5. Ativar métricas
No projeto Pages: `Metrics` → habilite `Web Analytics`. A Cloudflare injeta o recurso no próximo deploy.

## 6. Conferência final
- testar menu e formulário no celular;
- verificar `https://beskel.com.br/robots.txt`;
- verificar `https://beskel.com.br/sitemap.xml`;
- conferir cadeado HTTPS;
- testar a página 404;
- validar o compartilhamento da Home no WhatsApp.
