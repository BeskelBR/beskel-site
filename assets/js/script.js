"use strict";

const CONFIG = window.BESKEL_CONFIG || {};
const WHATSAPP_NUMBER = CONFIG.whatsapp || "5561991668921";
const PHONE_DISPLAY = CONFIG.phoneDisplay || "(61) 99166-8921";
const PHONE_HREF = CONFIG.phoneHref || "tel:61991668921";
const CONTACT_EMAIL = CONFIG.email || "contato@beskel.com.br";
const INSTAGRAM_USER = CONFIG.instagramUser || "beskelbr";
const INSTAGRAM_URL = CONFIG.instagramUrl || "https://instagram.com/beskelbr";
const BRAND_SYMBOL = "/assets/img/beskel-symbol-master-dark.svg";
const BRAND_LOGO = "/assets/img/beskel-logo-master-dark.svg";

let favicon = document.querySelector('link[rel="icon"]');
if (!favicon) {
  favicon = document.createElement("link");
  favicon.rel = "icon";
  document.head.appendChild(favicon);
}
favicon.type = "image/svg+xml";
favicon.href = BRAND_SYMBOL;

document.querySelectorAll(".brand img").forEach(image => {
  image.src = BRAND_SYMBOL;
  image.alt = "";
  image.width = 493;
  image.height = 552;
});

// Mantém a navegação alinhada ao posicionamento atual da BESKEL.
document.querySelectorAll(".main-nav a").forEach(link => {
  const href = link.getAttribute("href") || "";
  if (/processo\.html|produtos\.html/.test(href)) {
    link.remove();
    return;
  }
  if (/servicos\.html|\/servicos\/?$/.test(href)) link.textContent = "Soluções";
  if (/portfolio\.html|\/portfolio\/?$/.test(href)) link.textContent = "Projetos";
});

// Padroniza o rodapé das páginas legadas sem reintroduzir o antigo catálogo de produtos.
document.querySelectorAll(".site-footer .footer-grid").forEach(footer => {
  footer.innerHTML = `
    <div>
      <div class="footer-brand footer-brand-master"><img src="${BRAND_LOGO}" alt="BESKEL" width="770" height="728" loading="lazy"></div>
      <p>Conhecimento Transformado em Criação.</p>
      <span>Soluções físicas, digitais e híbridas para situações reais.</span>
    </div>
    <div>
      <b>Navegação</b>
      <a href="/servicos/">Soluções</a>
      <a href="/portfolio/">Projetos</a>
      <a href="/projeto-atlas/">Projeto Atlas</a>
      <a href="/sobre/">Sobre</a>
    </div>
    <div>
      <b>Contato</b>
      <span>Brasília • Distrito Federal</span>
      <a href="${PHONE_HREF}" data-beskel-phone>${PHONE_DISPLAY}</a>
      <a href="https://wa.me/${WHATSAPP_NUMBER}" data-beskel-whatsapp target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a href="${INSTAGRAM_URL}" data-beskel-instagram target="_blank" rel="noopener noreferrer">Instagram @${INSTAGRAM_USER}</a>
      <a href="mailto:${CONTACT_EMAIL}" data-beskel-email>${CONTACT_EMAIL}</a>
      <a href="/privacidade/">Política de Privacidade</a>
    </div>`;
});

const menuButton = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");
function closeMenu(){
  if (!menuButton || !mainNav) return;
  mainNav.classList.remove("open");
  menuButton.setAttribute("aria-expanded","false");
  menuButton.setAttribute("aria-label","Abrir menu");
}
if (menuButton && mainNav) {
  menuButton.addEventListener("click", () => {
    const open = mainNav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  });
  mainNav.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });
}

document.querySelectorAll("#year").forEach(el => el.textContent = new Date().getFullYear());

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const reveals = document.querySelectorAll(".reveal");
if (reduceMotion || !("IntersectionObserver" in window)) {
  reveals.forEach(el => el.classList.add("visible"));
} else {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .08, rootMargin: "0px 0px -24px" });
  reveals.forEach(el => observer.observe(el));
}

function onlyDigits(value){ return String(value || "").replace(/\D/g, ""); }
function formatPhone(value){
  const d = onlyDigits(value).slice(0,11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}
document.querySelectorAll('input[name="telefone"]').forEach(input => {
  input.inputMode = "tel";
  input.autocomplete = "tel";
  input.addEventListener("input", () => input.value = formatPhone(input.value));
});
document.querySelectorAll('input[name="nome"]').forEach(input => input.autocomplete = "name");

function buildQuoteMessage(form){
  const data = new FormData(form);
  const lines = [
    "Olá, BESKEL! Gostaria de conversar sobre uma necessidade/projeto.",
    "",
    data.get("nome") ? `Nome: ${data.get("nome")}` : "",
    data.get("telefone") ? `Telefone: ${data.get("telefone")}` : "",
    data.get("descricao") ? `Descrição: ${data.get("descricao")}` : ""
  ].filter(Boolean);
  return lines.join("\n");
}

document.querySelectorAll("#quoteForm").forEach(form => {
  let status = form.querySelector(".form-status");
  if (!status) {
    status = document.createElement("p");
    status.className = "form-status full";
    status.setAttribute("role","status");
    status.setAttribute("aria-live","polite");
    form.appendChild(status);
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    status.textContent = "Abrindo o WhatsApp...";
    status.className = "form-status full success";
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildQuoteMessage(form))}`, "_blank", "noopener,noreferrer");
  });
});

document.querySelectorAll("[data-beskel-phone]").forEach(link => { link.href = PHONE_HREF; link.textContent = PHONE_DISPLAY; });
document.querySelectorAll("[data-beskel-whatsapp]").forEach(link => link.href = `https://wa.me/${WHATSAPP_NUMBER}`);
document.querySelectorAll("[data-beskel-instagram]").forEach(link => { link.href = INSTAGRAM_URL; if (!link.querySelector("span")) link.textContent = `Instagram @${INSTAGRAM_USER}`; });
document.querySelectorAll("[data-beskel-email]").forEach(link => { link.href = `mailto:${CONTACT_EMAIL}`; if (!link.querySelector("span")) link.textContent = CONTACT_EMAIL; });

if (!document.querySelector(".whatsapp-float")) {
  const shortcut = document.createElement("a");
  shortcut.className = "whatsapp-float";
  shortcut.href = `https://wa.me/${WHATSAPP_NUMBER}`;
  shortcut.target = "_blank";
  shortcut.rel = "noopener noreferrer";
  shortcut.setAttribute("aria-label", "Falar com a BESKEL pelo WhatsApp");
  shortcut.textContent = "Falar sobre meu projeto";
  document.body.appendChild(shortcut);
}
