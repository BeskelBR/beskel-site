"use strict";

const CONFIG = window.BESKEL_CONFIG || {};
const WHATSAPP_NUMBER = CONFIG.whatsapp || "5561991668921";
const PHONE_DISPLAY = CONFIG.phoneDisplay || "(61) 99166-8921";
const PHONE_HREF = CONFIG.phoneHref || "tel:61991668921";
const CONTACT_EMAIL = CONFIG.email || "contato@beskel.com.br";
const INSTAGRAM_USER = CONFIG.instagramUser || "beskelbr";
const INSTAGRAM_URL = CONFIG.instagramUrl || "https://instagram.com/beskelbr";
const IS_LIGHT_HOME = document.body.classList.contains("home-light");
const BRAND_SYMBOL = IS_LIGHT_HOME ? "/assets/img/beskel-symbol-master-light.svg" : "/assets/img/beskel-symbol-master-dark.svg";
const BRAND_LOGO = IS_LIGHT_HOME ? "/assets/img/beskel-logo-master-light.svg" : "/assets/img/beskel-logo-master-dark.svg";

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
  if (/processo\.html|produtos\.html|projeto-atlas/i.test(href)) {
    link.remove();
    return;
  }
  if (/servicos\.html|\/servicos\/?$/.test(href)) link.textContent = "Soluções";
  if (/portfolio\.html|\/portfolio\/?$/.test(href)) link.textContent = "Projetos";
});

// Padroniza o rodapé sem reintroduzir páginas ou catálogos descontinuados.
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

// No case HVB, o símbolo BESKEL usa a versão para fundo escuro sem moldura externa.
document.querySelectorAll(".proof-mark").forEach(mark => {
  mark.style.setProperty("background", "transparent", "important");
  mark.style.setProperty("border", "0", "important");
  mark.style.setProperty("box-shadow", "none", "important");
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

// Progressive disclosure da Home: uma única área muda conforme a frente escolhida.
const capabilityTabs = [...document.querySelectorAll("[data-capability]")];
if (capabilityTabs.length) {
  const capabilityPanels = [...document.querySelectorAll(".capability-panel")];
  const activateCapability = tab => {
    const key = tab.dataset.capability;
    capabilityTabs.forEach(item => item.setAttribute("aria-selected", String(item === tab)));
    capabilityPanels.forEach(panel => {
      panel.hidden = panel.id !== `painel-${key}`;
    });
  };
  capabilityTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateCapability(tab));
    tab.addEventListener("keydown", event => {
      if (!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % capabilityTabs.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + capabilityTabs.length) % capabilityTabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = capabilityTabs.length - 1;
      capabilityTabs[nextIndex].focus();
      activateCapability(capabilityTabs[nextIndex]);
    });
  });
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

const WHATSAPP_ICON = `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" style="width:28px;height:28px;display:block;fill:currentColor"><path d="M19.11 17.29c-.29-.15-1.72-.85-1.99-.95-.27-.1-.47-.15-.67.15-.2.29-.77.95-.95 1.14-.17.2-.35.22-.64.07-.29-.15-1.24-.46-2.36-1.47-.87-.78-1.46-1.74-1.63-2.03-.17-.29-.02-.44.13-.59.13-.13.29-.35.44-.52.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.29-1.04 1.02-1.04 2.48s1.07 2.86 1.22 3.06c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.63.71.22 1.36.19 1.87.11.57-.09 1.72-.7 1.96-1.38.24-.68.24-1.27.17-1.38-.07-.12-.27-.2-.57-.35Z"></path><path d="M27.27 4.72A15.86 15.86 0 0 0 16.01 0C7.19 0 .02 7.16.02 15.97c0 2.82.74 5.57 2.14 8L0 32l8.24-2.12a15.9 15.9 0 0 0 7.76 1.99h.01c8.81 0 15.98-7.17 15.99-15.98a15.87 15.87 0 0 0-4.73-11.17Zm-11.26 24.5h-.01a13.2 13.2 0 0 1-6.73-1.84l-.48-.28-4.89 1.26 1.31-4.77-.31-.49a13.16 13.16 0 0 1-2.02-7.08c0-7.29 5.93-13.22 13.23-13.22 3.53 0 6.84 1.37 9.33 3.87a13.1 13.1 0 0 1 3.86 9.35c0 7.29-5.94 13.22-13.29 13.22Z"></path></svg>`;

let shortcut = document.querySelector(".whatsapp-float");
if (!shortcut) {
  shortcut = document.createElement("a");
  shortcut.className = "whatsapp-float";
  document.body.appendChild(shortcut);
}
shortcut.href = `https://wa.me/${WHATSAPP_NUMBER}`;
shortcut.target = "_blank";
shortcut.rel = "noopener noreferrer";
shortcut.setAttribute("aria-label", "Falar com a BESKEL pelo WhatsApp");
shortcut.innerHTML = WHATSAPP_ICON;
[
  ["position","fixed"],["left","auto"],["right","clamp(16px, 2vw, 28px)"],["bottom","clamp(16px, 2vw, 28px)"],
  ["width","clamp(52px, 4vw, 58px)"],["height","clamp(52px, 4vw, 58px)"],["min-width","0"],["padding","0"],
  ["border","0"],["border-radius","999px"],["background","#25D366"],["color","#FFFFFF"],
  ["display","flex"],["align-items","center"],["justify-content","center"],["text-align","center"],
  ["box-shadow","0 12px 30px rgba(0,0,0,.22)"],["z-index","9999"]
].forEach(([property,value]) => shortcut.style.setProperty(property,value,"important"));
