const brandContactCss = document.createElement('link');
brandContactCss.rel = 'stylesheet';
brandContactCss.href = 'assets/hvb/css/brand-contact.css';
document.head.appendChild(brandContactCss);

const menuButton = document.querySelector('[data-menu-toggle]');
const mainNav = document.querySelector('[data-main-nav]');

if (menuButton && mainNav) {
  menuButton.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
  });

  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Abrir menu');
    });
  });
}

const yearNode = document.querySelector('[data-current-year]');
if (yearNode) yearNode.textContent = String(new Date().getFullYear());

const config = window.HVB_SITE_CONFIG;
if (config?.contact) {
  const c = config.contact;

  document.querySelectorAll('a[href="#contato"]').forEach((link) => {
    const label = link.textContent.trim().toLowerCase();
    if (label.includes('whatsapp') || label.includes('falar com o hvb')) {
      link.href = c.whatsappHref;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  });

  const emergencyCopy = document.querySelector('#emergencia .lead');
  if (emergencyCopy) emergencyCopy.textContent = 'O HVB funciona 24 horas. Fale diretamente com a equipe ou abra a rota até o hospital.';

  const emergency = document.querySelector('#emergencia .cta-row');
  if (emergency) {
    emergency.innerHTML = `
      <a class="btn btn-light" href="${c.whatsappHref}" target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>
      <a class="btn btn-cyan" href="${c.phoneHref}">Ligar agora</a>
      <a class="btn btn-light" href="${c.maps}" target="_blank" rel="noopener noreferrer">Como chegar</a>`;
  }

  const locationLead = document.querySelector('#localizacao .section-heading .lead');
  if (locationLead) locationLead.textContent = 'Na Asa Sul, com atendimento 24 horas e acesso direto pelos canais oficiais do hospital.';

  const contactItems = document.querySelectorAll('#contato .contact-item');
  contactItems.forEach((item) => {
    const key = item.querySelector('strong')?.textContent.trim().toLowerCase();
    const value = item.querySelector('span');
    if (!value) return;
    if (key === 'endereço') value.textContent = c.address;
    if (key === 'telefone') value.innerHTML = `<a href="${c.phoneHref}">${c.phoneDisplay}</a>`;
    if (key === 'whatsapp') value.innerHTML = `<a href="${c.whatsappHref}" target="_blank" rel="noopener noreferrer">${c.whatsappDisplay}</a>`;
  });

  const contactActions = document.querySelector('#contato .cta-row');
  if (contactActions) {
    contactActions.innerHTML = `
      <a class="btn" href="${c.maps}" target="_blank" rel="noopener noreferrer">Como chegar</a>
      <a class="btn btn-ghost" href="${c.whatsappHref}" target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>`;
  }

  const mapBox = document.querySelector('.map-placeholder');
  if (mapBox && config.map?.embed) {
    mapBox.classList.add('map-live');
    mapBox.innerHTML = `
      <iframe
        title="Localização do Hospital Veterinário Brasília HVB"
        src="${config.map.embed}"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        allowfullscreen></iframe>`;
  }

  const footerContact = [...document.querySelectorAll('.footer-grid > div')].find((col) => col.querySelector('h3')?.textContent.trim() === 'Contato');
  if (footerContact) {
    footerContact.innerHTML = `
      <h3>Contato</h3>
      <a href="${c.maps}" target="_blank" rel="noopener noreferrer">Endereço</a>
      <a href="${c.phoneHref}">${c.phoneDisplay}</a>
      <a href="${c.whatsappHref}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a href="mailto:${c.email}">E-mail</a>
      <a href="${c.instagram}" target="_blank" rel="noopener noreferrer">Instagram</a>
      <a href="https://hvb-dev.beskel.com.br" rel="nofollow">Área do colaborador ↗</a>`;
  }

  const footerBrand = document.querySelector('.footer-grid > div:first-child');
  if (footerBrand && !footerBrand.querySelector('.social-links')) {
    const social = document.createElement('div');
    social.className = 'social-links';
    social.innerHTML = `
      <a href="${c.instagram}" target="_blank" rel="noopener noreferrer">Instagram @hospitalveterinariobrasiliahvb</a>
      <a href="${c.linktree}" target="_blank" rel="noopener noreferrer">Linktree oficial</a>`;
    footerBrand.appendChild(social);
  }

  const structuredData = document.createElement('script');
  structuredData.type = 'application/ld+json';
  structuredData.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VeterinaryCare',
    name: 'Hospital Veterinário Brasília HVB',
    telephone: c.phoneDisplay,
    email: c.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'SHCS CRS 504 Bloco C, Loja 14',
      addressLocality: 'Brasília',
      addressRegion: 'DF',
      postalCode: '70331-535',
      addressCountry: 'BR'
    },
    openingHours: 'Mo-Su 00:00-23:59',
    sameAs: [c.instagram, c.linktree, c.maps]
  });
  document.head.appendChild(structuredData);
}
