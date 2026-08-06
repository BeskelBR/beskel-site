"use strict";

const CONFIG = window.BESKEL_CONFIG || {};
const WHATSAPP_NUMBER = CONFIG.whatsapp || "5561995555411";
const CONTACT_EMAIL = CONFIG.email || "contato@beskel.com.br";
const INSTAGRAM_USER = CONFIG.instagramUser || "beskelbr";
const INSTAGRAM_URL = CONFIG.instagramUrl || "https://instagram.com/beskelbr";

// Garante que todas as páginas usem a camada editorial mais recente.
const currentScript = document.currentScript;
if (currentScript && !document.querySelector('link[href*="site-polish.css"]')) {
  const polish = document.createElement("link");
  polish.rel = "stylesheet";
  polish.href = new URL("../css/site-polish.css", currentScript.src).href;
  document.head.appendChild(polish);
}

const menuButton = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");

// Mantém a arquitetura de navegação objetiva em todas as páginas antigas e novas.
document.querySelectorAll(".main-nav a").forEach(link => {
  const href = link.getAttribute("href") || "";
  if (/processo\.html/.test(href)) {
    link.remove();
    return;
  }
  if (/servicos\.html/.test(href)) link.textContent = "Soluções";
});
document.querySelectorAll(".site-footer a").forEach(link => {
  const href = link.getAttribute("href") || "";
  if (/servicos\.html/.test(href)) link.textContent = "Soluções";
});

function closeMenu({ returnFocus = false } = {}) {
  if (!menuButton || !mainNav) return;
  mainNav.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Abrir menu");
  if (returnFocus) menuButton.focus();
}

if (menuButton && mainNav) {
  menuButton.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
  });
  mainNav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => closeMenu()));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && mainNav.classList.contains("open")) closeMenu({ returnFocus: true });
  });
  document.addEventListener("click", event => {
    if (mainNav.classList.contains("open") && !mainNav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
  });
}

document.querySelectorAll("#year").forEach(el => {
  el.textContent = new Date().getFullYear();
});

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
  }, { threshold: 0.1, rootMargin: "0px 0px -35px" });
  reveals.forEach(el => observer.observe(el));
}

const filterButtons = document.querySelectorAll(".filter-btn");
const portfolioCards = document.querySelectorAll("[data-category]");
filterButtons.forEach(button => {
  button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    filterButtons.forEach(item => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    portfolioCards.forEach(card => {
      const categories = (card.dataset.category || "").split(" ");
      const show = filter === "all" || categories.includes(filter);
      card.classList.toggle("is-hidden", !show);
      card.setAttribute("aria-hidden", String(!show));
    });
  });
});

function onlyDigits(value) {
  return value.replace(/\D/g, "");
}

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

document.querySelectorAll('input[name="telefone"]').forEach(input => {
  input.setAttribute("inputmode", "tel");
  input.setAttribute("autocomplete", "tel");
  input.addEventListener("input", () => {
    input.value = formatPhone(input.value);
  });
});
document.querySelectorAll('input[name="nome"]').forEach(input => input.setAttribute("autocomplete", "name"));

// Pré-seleciona o tipo de projeto quando o cliente chega por um CTA de Soluções.
const intent = new URLSearchParams(window.location.search).get("tipo");
const intentMap = {
  producao: "Impressão 3D",
  desenvolvimento: "Modelagem 3D",
  validacao: "Protótipo",
  personalizacao: "Produto personalizado"
};
if (intent && intentMap[intent]) {
  document.querySelectorAll('select[name="tipo"]').forEach(select => {
    const option = Array.from(select.options).find(item => item.textContent.trim() === intentMap[intent]);
    if (option) select.value = option.value;
  });
}

function buildQuoteMessage(form) {
  const data = new FormData(form);
  const fields = [
    ["Nome", data.get("nome")],
    ["Telefone", data.get("telefone")],
    ["Tipo de projeto", data.get("tipo")],
    ["Quantidade", data.get("quantidade")],
    ["Descrição", data.get("descricao")]
  ];

  const details = fields
    .filter(([, value]) => String(value || "").trim())
    .map(([label, value]) => `${label}: ${String(value).trim()}`);

  return [
    "Olá, BESKEL! Gostaria de solicitar um orçamento.",
    "",
    ...details
  ].join("\n");
}

document.querySelectorAll("#quoteForm").forEach(form => {
  let status = form.querySelector(".form-status");
  if (!status) {
    status = document.createElement("p");
    status.className = "form-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    form.appendChild(status);
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) {
      status.textContent = "Revise os campos obrigatórios antes de continuar.";
      status.className = "form-status error";
      return;
    }

    status.textContent = "Abrindo o WhatsApp...";
    status.className = "form-status success";
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildQuoteMessage(form))}`, "_blank", "noopener,noreferrer");
  });
});

// Padroniza contatos em páginas antigas e novas sem destruir a estrutura dos cards.
document.querySelectorAll('a[href*="instagram.com"], [data-beskel-instagram]').forEach(link => {
  link.href = INSTAGRAM_URL;
  const value = link.querySelector("span");
  if (value) {
    value.textContent = `@${INSTAGRAM_USER}`;
  } else {
    const full = link.dataset.label === "full" || /Instagram/i.test(link.textContent);
    link.textContent = full ? `Instagram @${INSTAGRAM_USER}` : `@${INSTAGRAM_USER}`;
  }
});

document.querySelectorAll("[data-beskel-email]").forEach(link => {
  link.href = `mailto:${CONTACT_EMAIL}`;
  const value = link.querySelector("span");
  if (value) value.textContent = CONTACT_EMAIL;
  else link.textContent = CONTACT_EMAIL;
});

document.querySelectorAll("[data-beskel-whatsapp]").forEach(link => {
  link.href = `https://wa.me/${WHATSAPP_NUMBER}`;
});

document.querySelectorAll(".contact-list div").forEach(row => {
  if (/WhatsApp/i.test(row.textContent)) {
    row.innerHTML = `<b>WhatsApp</b><span><a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener noreferrer">Falar com a BESKEL</a></span>`;
  }
});

document.querySelectorAll(".form-note").forEach(note => {
  if (/configur/i.test(note.textContent)) {
    note.textContent = "Você será direcionado ao WhatsApp para continuar o atendimento.";
  }
});

// Ampliação das imagens do portfólio em modal de tela cheia.
const portfolioImages = document.querySelectorAll(".portfolio-products .portfolio-card > img");
if (portfolioImages.length) {
  const lightbox = document.createElement("div");
  lightbox.className = "portfolio-lightbox";
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.innerHTML = `
    <figure class="portfolio-lightbox__dialog" role="dialog" aria-modal="true" aria-label="Imagem ampliada do portfólio">
      <button class="portfolio-lightbox__close" type="button" aria-label="Fechar imagem ampliada">×</button>
      <img class="portfolio-lightbox__image" alt="">
      <figcaption class="portfolio-lightbox__caption"></figcaption>
    </figure>`;
  document.body.appendChild(lightbox);

  const lightboxImage = lightbox.querySelector(".portfolio-lightbox__image");
  const lightboxCaption = lightbox.querySelector(".portfolio-lightbox__caption");
  const closeButton = lightbox.querySelector(".portfolio-lightbox__close");
  let lastTrigger = null;

  function getPortfolioTitle(image) {
    return image.closest(".portfolio-card")?.querySelector("figcaption b")?.textContent.trim() || image.alt;
  }

  function openLightbox(image) {
    lastTrigger = image;
    const title = getPortfolioTitle(image);
    lightboxImage.src = image.currentSrc || image.src;
    lightboxImage.alt = image.alt;
    lightboxCaption.textContent = title;
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    requestAnimationFrame(() => closeButton.focus());
  }

  function closeLightbox() {
    if (!lightbox.classList.contains("is-open")) return;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    lightboxImage.removeAttribute("src");
    if (lastTrigger) lastTrigger.focus();
  }

  portfolioImages.forEach(image => {
    const title = getPortfolioTitle(image);
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.setAttribute("aria-haspopup", "dialog");
    image.setAttribute("aria-label", `Ampliar imagem: ${title}`);
    image.addEventListener("click", () => openLightbox(image));
    image.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLightbox(image);
      }
    });
  });

  closeButton.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", event => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && lightbox.classList.contains("is-open")) closeLightbox();
  });
}

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
