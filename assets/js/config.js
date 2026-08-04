"use strict";

window.BESKEL_CONFIG = Object.freeze({
  businessName: "BESKEL",
  domain: "https://beskel.com.br",
  whatsapp: "5561995555411",
  email: "contato@beskel.com.br",
  instagramUser: "beskelbr",
  instagramUrl: "https://instagram.com/beskelbr",
  city: "Brasília",
  state: "DF"
});

// Carrega a camada visual do Brand Book também nas páginas legadas.
if (!document.querySelector('link[href*="brand-book.css"]')) {
  const brandStyles = document.createElement("link");
  brandStyles.rel = "stylesheet";
  brandStyles.href = document.currentScript?.src.includes("/pages/")
    ? "../assets/css/brand-book.css"
    : "assets/css/brand-book.css";
  document.head.appendChild(brandStyles);
}
