import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = async () => {
  const [html, ui, session, gateway, openapi, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../assets/system-v2.js", import.meta.url), "utf8"),
    readFile(new URL("../assets/web-session.js", import.meta.url), "utf8"),
    readFile(new URL("../api/gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../openapi/hvb-sistema.json", import.meta.url), "utf8"),
    readFile(new URL("../assets/system.css", import.meta.url), "utf8"),
  ]);
  return { html, ui, session, gateway, openapi: JSON.parse(openapi), css };
};

test("login humano: UI normal usa CPF/senha sem endpoint ficticio", async () => {
  const { html, ui, openapi } = await files();
  assert.match(html, /id="human-login-form"/);
  assert.match(html, /id="human-cpf"/);
  assert.match(html, /autocomplete="username"/);
  assert.match(html, /id="human-password"/);
  assert.match(html, /autocomplete="current-password"/);
  assert.match(html, /<button class="primary-btn" type="submit" disabled aria-disabled="true">Entrar<\/button>/);
  assert.match(html, /aguarda os endpoints HTTP humanos/);

  const start = ui.indexOf('humanLoginForm.addEventListener("submit"');
  const end = ui.indexOf('devLoginForm.addEventListener("submit"', start);
  assert.ok(start >= 0 && end > start);
  const humanHandler = ui.slice(start, end);
  assert.doesNotMatch(humanHandler, /fetch\(|HVBSession\.login|\/v1\//);
  assert.match(humanHandler, /passwordInput\.value = ""/);
  assert.match(humanHandler, /Nenhuma senha foi enviada/);

  assert.equal(openapi.info.version, "0.28.0");
  const paths = Object.keys(openapi.paths || {});
  assert.equal(
    paths.some((path) =>
      /(?:login|senha|password|recuperacao|recuperar|senha-temporaria|human-access)/i.test(
        path,
      ),
    ),
    false,
  );
});

test("login humano: CPF e senha nao sao persistidos no navegador", async () => {
  const { ui, session } = await files();
  assert.match(ui, /function validCpf/);
  assert.match(ui, /Esta validação visual não substitui a validação do servidor/);
  assert.doesNotMatch(
    ui,
    /(?:localStorage|sessionStorage|indexedDB)[^\n]*(?:human-password|passwordInput|human-cpf|cpfInput)/i,
  );
  assert.doesNotMatch(
    ui,
    /(?:human-password|passwordInput|human-cpf|cpfInput)[^\n]*(?:localStorage|sessionStorage|indexedDB)/i,
  );
  assert.match(session, /sessionStorage\.removeItem\("hvb-access-token"\)/);
  assert.match(session, /headers\.delete\("Authorization"\)/);
});

test("login humano: acesso tecnico DEV permanece separado e funcional", async () => {
  const { html, ui, gateway } = await files();
  assert.match(html, /<details class="dev-settings dev-access">/);
  assert.match(html, /<summary>Acesso técnico DEV<\/summary>/);
  assert.match(html, /id="dev-login-form"/);
  assert.match(html, /id="access-token"/);
  assert.match(ui, /devLoginForm\.addEventListener\("submit"/);
  assert.match(ui, /await authenticate\(candidate\)/);
  assert.match(gateway, /JSON\.parse\(payload\.toString\("utf8"\)\)\.token/);
  assert.doesNotMatch(html, /Esqueci minha senha|Recuperar senha/);
});

test("sessao existente: reset, x-hvb-view e logout permanecem preservados", async () => {
  const { session, ui } = await files();
  assert.match(session, /X-HVB-View/);
  assert.match(session, /x-hvb-session-reset/);
  assert.match(session, /window\.dispatchEvent\(new Event\("hvb-session-ended"\)\)/);
  assert.match(session, /async logout\(\)/);
  assert.match(session, /method: "DELETE"/);
  assert.match(ui, /hvb-session-ended/);
  assert.match(ui, /Sessão encerrada ou expirada/);
});

test("login humano: layout preserva responsividade existente", async () => {
  const { css } = await files();
  assert.match(css, /@media\(max-width:860px\)\{\.auth-view\{grid-template-columns:1fr\}/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /\.human-login-form/);
  assert.match(css, /\.dev-access/);
});
