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

const hoverMenuQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

document.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
  const summary = dropdown.querySelector('summary');
  if (!summary) return;

  dropdown.addEventListener('mouseenter', () => {
    if (hoverMenuQuery.matches) dropdown.open = true;
  });

  dropdown.addEventListener('mouseleave', () => {
    if (hoverMenuQuery.matches) dropdown.open = false;
  });

  summary.addEventListener('click', (event) => {
    if (hoverMenuQuery.matches) event.preventDefault();
  });
});

const yearNode = document.querySelector('[data-current-year]');
if (yearNode) yearNode.textContent = String(new Date().getFullYear());

const config = window.HVB_SITE_CONFIG;
if (config?.contact) {
  const c = config.contact;
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
