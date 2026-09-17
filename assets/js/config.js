"use strict";

window.BESKEL_CONFIG = Object.freeze({
  businessName: "BESKEL",
  domain: "https://beskel.com.br",
  whatsapp: "5561991668921",
  phoneDisplay: "(61) 99166-8921",
  phoneHref: "tel:61991668921",
  email: "contato@beskel.com.br",
  instagramUser: "beskelbr",
  instagramUrl: "https://instagram.com/beskelbr",
  city: "Brasília",
  state: "DF"
});

if (!document.querySelector('link[href*="master-v52.css"]')) {
  const masterStyles = document.createElement("link");
  masterStyles.rel = "stylesheet";
  masterStyles.href = "/assets/css/master-v52.css?v=1";
  document.head.appendChild(masterStyles);
}
