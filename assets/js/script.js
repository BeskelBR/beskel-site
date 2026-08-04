"use strict";

const CONFIG = window.BESKEL_CONFIG || {};
const WHATSAPP_NUMBER = CONFIG.whatsapp || "5561995555411";
const CONTACT_EMAIL = CONFIG.email || "contato@beskel.com.br";
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

document.querySelectorAll("#year").forEach(el => { el.textContent = new Date().getFullYear(); });

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
  }, { threshold: 0.12, rootMargin: "0px 0px -40px" });
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
      const show = filter === "all" || card.dataset.category === filter;
      card.classList.toggle("is-hidden", !show);
      card.setAttribute("aria-hidden", String(!show));
    });
  });
});

function onlyDigits(value) { return value.replace(/\D/g, ""); }
function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

document.querySelectorAll('input[name="telefone"]').forEach(input => {
  input.setAttribute("inputmode", "tel");
  input.setAttribute("autocomplete", "tel");
  input.addEventListener("input", () => { input.value = formatPhone(input.value); });
});
document.querySelectorAll('input[name="nome"]').forEach(input => input.setAttribute("autocomplete", "name"));

const forms = document.querySelectorAll("#quoteForm");
forms.forEach(form => {
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
    if (WHATSAPP_NUMBER === "5561999999999") {
      status.textContent = "O WhatsApp ainda não foi configurado. Abrindo seu aplicativo de e-mail como alternativa.";
      status.className = "form-status error";
      const data = new FormData(form);
      const subject = "Solicitação de orçamento — BESKEL";
      const body = [
        "Olá, BESKEL! Gostaria de solicitar um orçamento.",
        `Nome: ${data.get("nome") || "Não informado"}`,
        `Telefone: ${data.get("telefone") || "Não informado"}`,
        `Projeto: ${data.get("tipo") || "Não informado"}`,
        `Quantidade: ${data.get("quantidade") || "Não informada"}`,
        `Descrição: ${data.get("descricao") || "Não informada"}`
      ].join("\n");
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      return;
    }
    const data = new FormData(form);
    const message = [
      "Olá, BESKEL! Gostaria de solicitar um orçamento.",
      `Nome: ${data.get("nome") || "Não informado"}`,
      `Telefone: ${data.get("telefone") || "Não informado"}`,
      `Projeto: ${data.get("tipo") || "Não informado"}`,
      `Quantidade: ${data.get("quantidade") || "Não informada"}`,
      `Descrição: ${data.get("descricao") || "Não informada"}`
    ].join("\n");
    status.textContent = "Abrindo o WhatsApp com sua solicitação...";
    status.className = "form-status success";
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  });
});


// Atualiza contatos a partir do arquivo config.js.
document.querySelectorAll("[data-beskel-email]").forEach(link => {
  link.textContent = CONTACT_EMAIL;
  link.href = `mailto:${CONTACT_EMAIL}`;
});
document.querySelectorAll("[data-beskel-instagram]").forEach(link => {
  link.href = INSTAGRAM_URL;
});
document.querySelectorAll("[data-beskel-whatsapp]").forEach(link => {
  if (WHATSAPP_NUMBER !== "5561999999999") {
    link.href = `https://wa.me/${WHATSAPP_NUMBER}`;
    link.removeAttribute("aria-disabled");
  } else {
    link.href = "#orcamento";
    link.setAttribute("aria-disabled", "true");
  }
});
