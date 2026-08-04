"use strict";

const CONFIG = window.BESKEL_CONFIG || {};
const WHATSAPP_NUMBER = CONFIG.whatsapp || "5561995555411";
const CONTACT_EMAIL = CONFIG.email || "contato@beskel.com.br";
const INSTAGRAM_USER = CONFIG.instagramUser || "beskelbr";
const INSTAGRAM_URL = CONFIG.instagramUrl || "https://instagram.com/beskelbr";

const menuButton = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");

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
      const show = filter === "all" || card.dataset.category.split(" ").includes(filter);
      card.classList.toggle("is-hidden", !show);
      card.setAttribute("aria-hidden", String(!show));
    });
  });
});

function onlyDigits(value) { return value.replace(/\D/g, ""); }
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
  input.addEventListener("input", () => { input.value = formatPhone(input.value); });
});
document.querySelectorAll('input[name="nome"]').forEach(input => input.setAttribute("autocomplete", "name"));

function buildQuoteMessage(form) {
  const data = new FormData(form);
  return [
    "Olá, BESKEL! Gostaria de solicitar uma avaliação técnica.",
    "",
    `Nome: ${data.get("nome") || "Não informado"}`,
    `Telefone: ${data.get("telefone") || "Não informado"}`,
    `Tipo de projeto: ${data.get("tipo") || "Não informado"}`,
    `Quantidade: ${data.get("quantidade") || "Não informada"}`,
    `Prazo desejado: ${data.get("prazo") || "Não informado"}`,
    `Medidas aproximadas: ${data.get("medidas") || "Não informadas"}`,
    `Ambiente de uso: ${data.get("ambiente") || "Não informado"}`,
    `Material: ${data.get("material") || "Desejo orientação"}`,
    "",
    `Descrição: ${data.get("descricao") || "Não informada"}`,
    "",
    "Tenho fotos, desenhos ou arquivos para enviar: " + (data.get("referencias") ? "Sim" : "Não")
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
    status.textContent = "Abrindo o WhatsApp com a sua solicitação...";
    status.className = "form-status success";
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildQuoteMessage(form))}`, "_blank", "noopener,noreferrer");
  });
});

// Unifica contatos antigos e novos em todas as páginas.
document.querySelectorAll('a[href*="instagram.com"], [data-beskel-instagram]').forEach(link => {
  link.href = INSTAGRAM_URL;
  const full = link.dataset.label === "full" || /Instagram/i.test(link.textContent);
  link.textContent = full ? `Instagram @${INSTAGRAM_USER}` : `@${INSTAGRAM_USER}`;
});
document.querySelectorAll("[data-beskel-email]").forEach(link => {
  link.textContent = CONTACT_EMAIL;
  link.href = `mailto:${CONTACT_EMAIL}`;
});
document.querySelectorAll("[data-beskel-whatsapp]").forEach(link => {
  link.href = `https://wa.me/${WHATSAPP_NUMBER}`;
});

// Corrige textos de configuração remanescentes na página de contato.
document.querySelectorAll(".contact-list div").forEach(row => {
  if (/WhatsApp/i.test(row.textContent)) {
    row.innerHTML = `<b>WhatsApp</b><span><a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener noreferrer">Falar com a BESKEL</a></span>`;
  }
});
document.querySelectorAll(".form-note").forEach(note => {
  if (/configur/i.test(note.textContent)) note.textContent = "Arquivos e referências podem ser anexados após a abertura da conversa no WhatsApp.";
});

// Insere atalho flutuante nas páginas que ainda não o possuem.
if (!document.querySelector(".whatsapp-float")) {
  const shortcut = document.createElement("a");
  shortcut.className = "whatsapp-float";
  shortcut.href = `https://wa.me/${WHATSAPP_NUMBER}`;
  shortcut.target = "_blank";
  shortcut.rel = "noopener noreferrer";
  shortcut.setAttribute("aria-label", "Falar com a BESKEL pelo WhatsApp");
  shortcut.innerHTML = "<span>WhatsApp</span>";
  document.body.appendChild(shortcut);
}
