// La barra de arriba y el pie, en un solo sitio.
//
// La web tiene dos mitades: las páginas estáticas las genera `build_site.py`
// y las dinámicas (fichas, explorar, agenda, colecciones) se pintan aquí al
// vuelo. Tenían menús distintos, y eso al navegar se nota: cambias de página
// y te desaparecen botones.
//
// Este fichero manda. Python lee estas mismas listas al construir el sitio
// (`node -e "import('./functions/_lib/chrome.js')…"`), así que si se añade una
// sección aparece en las dos mitades a la vez o no aparece en ninguna.

export const NAV = [
  { es: 'Explorar', en: 'Explore', hrefEs: '/explorar/', hrefEn: '/en/explore/' },
  { es: 'Agenda', en: "What's on", hrefEs: '/agenda/', hrefEn: '/en/whats-on/' },
  { es: 'Cómo funciona', en: 'How it works', hrefEs: '/#como', hrefEn: '/en/#how-it-works' },
  { es: 'Para negocios', en: 'For businesses', hrefEs: '/para-negocios/', hrefEn: '/en/for-business/' },
  { es: 'Preguntas', en: 'FAQ', hrefEs: '/preguntas/', hrefEn: '/en/faq/' },
  { es: 'Soporte', en: 'Support', hrefEs: '/soporte/', hrefEn: '/en/support/' },
  { es: 'Mi Klendar', en: 'My Klendar', hrefEs: '/app/', hrefEn: '/app/?lang=en', cls: 'nav-yo' },
  { es: 'Acceso para negocios', en: 'Business sign in', hrefEs: '/panel/', hrefEn: '/panel/', cls: 'nav-panel' },
];

export const FOOT_PRODUCT = [
  { es: 'Cómo funciona', en: 'How it works', hrefEs: '/#como', hrefEn: '/en/#how-it-works' },
  { es: 'Explorar', en: 'Explore', hrefEs: '/explorar/', hrefEn: '/en/explore/' },
  { es: 'Agenda local', en: "What's on", hrefEs: '/agenda/', hrefEn: '/en/whats-on/' },
  { es: 'Para negocios', en: 'For businesses', hrefEs: '/para-negocios/', hrefEn: '/en/for-business/' },
  { es: 'Precios', en: 'Pricing', hrefEs: '/precios/', hrefEn: '/en/pricing/' },
  { es: 'Mi Klendar', en: 'My Klendar', hrefEs: '/app/', hrefEn: '/app/?lang=en' },
  { es: 'Acceso para negocios', en: 'Business sign in', hrefEs: '/panel/', hrefEn: '/panel/' },
  { es: 'Preguntas frecuentes', en: 'FAQ', hrefEs: '/preguntas/', hrefEn: '/en/faq/' },
  { es: 'Soporte', en: 'Support', hrefEs: '/soporte/', hrefEn: '/en/support/' },
  { es: 'Sobre Klendar', en: 'About', hrefEs: '/sobre/', hrefEn: '/en/about/' },
  { es: 'Prensa', en: 'Press', hrefEs: '/prensa/', hrefEn: '/en/press/' },
  { es: 'English', en: 'Español', hrefEs: '/en/', hrefEn: '/' },
];

export const FOOT_LEGAL = [
  { es: 'Aviso legal', en: 'Legal notice', hrefEs: '/aviso-legal/', hrefEn: '/en/legal-notice/' },
  { es: 'Privacidad', en: 'Privacy policy', hrefEs: '/privacidad/', hrefEn: '/en/privacy/' },
  { es: 'Términos de uso', en: 'Terms of use', hrefEs: '/terminos/', hrefEn: '/en/terms/' },
  { es: 'Condiciones para negocios', en: 'Business terms', hrefEs: '/negocios/', hrefEn: '/en/business-terms/' },
  { es: 'Cookies', en: 'Cookies', hrefEs: '/cookies/', hrefEn: '/en/cookies/' },
  { es: 'Normas de la comunidad', en: 'Community guidelines', hrefEs: '/normas/', hrefEn: '/en/community-guidelines/' },
  { es: 'Eliminar cuenta', en: 'Delete account', hrefEs: '/eliminar-cuenta/', hrefEn: '/en/delete-account/' },
  { es: 'Accesibilidad', en: 'Accessibility', hrefEs: '/accesibilidad/', hrefEn: '/en/accessibility/' },
  { es: 'Estado del servicio', en: 'Service status', hrefEs: '/estado/', hrefEn: '/en/status/' },
];

const TEXTOS = {
  es: {
    menu: 'Menú',
    lema: 'Ofertas flash con cuenta atrás y eventos de los negocios de tu barrio, '
      + 'ordenados por cercanía. Guarda tus sitios, recibe avisos y canjea con un QR.',
    producto: 'Producto',
    legal: 'Legal',
    derechos: `© ${new Date().getFullYear()} Klendar. Todos los derechos reservados.`,
    hecho: 'Hecho en España',
  },
  en: {
    menu: 'Menu',
    lema: 'Flash offers with a countdown and events from the businesses around you, '
      + 'sorted by how close they are. Save your places, get alerts and redeem with a QR.',
    producto: 'Product',
    legal: 'Legal',
    derechos: `© ${new Date().getFullYear()} Klendar. All rights reserved.`,
    hecho: 'Made in Spain',
  },
};

const item = (n, en) => ({ label: en ? n.en : n.es, href: en ? n.hrefEn : n.hrefEs, cls: n.cls });

/**
 * La barra de arriba.
 *
 * `esPath` y `enPath` son la misma página en cada idioma (para el selector).
 * Si se piden como plantilla (`{{ES}}` y `{{EN}}`), Python los sustituye al
 * construir las páginas estáticas.
 */
export function siteHeader(lang, esPath = '/', enPath = '/en/') {
  const en = lang === 'en';
  const T = TEXTOS[en ? 'en' : 'es'];
  const enlaces = NAV.map((n) => item(n, en))
    .map((n) => `\n    <a href="${n.href}"${n.cls ? ` class="${n.cls}"` : ''}>${n.label}</a>`)
    .join('');
  return `<header class="top"><div class="wrap">
  <a class="brand" href="/${en ? 'en/' : ''}"><img src="/assets/symbol.png" alt="" width="30" height="30"> Klendar</a>
  <input type="checkbox" id="menu" aria-hidden="true">
  <label class="menu-toggle" for="menu" aria-label="${T.menu}"><span></span><span></span><span></span></label>
  <nav class="main">${enlaces}
    <span class="lang" aria-label="Idioma / Language">
      <a href="${esPath}" class="${en ? '' : 'on'}" data-lang="es" hreflang="es">ES</a>
      <a href="${enPath}" class="${en ? 'on' : ''}" data-lang="en" hreflang="en">EN</a>
    </span>
  </nav>
</div></header>`;
}

/** El pie, con las mismas columnas en todas las páginas. */
export function siteFooter(lang) {
  const en = lang === 'en';
  const T = TEXTOS[en ? 'en' : 'es'];
  const col = (lista) => lista.map((n) => item(n, en))
    .map((n) => `<a href="${n.href}">${n.label}</a>`).join('');
  return `<footer><div class="wrap">
  <div class="cols">
    <div><a class="brand" href="/${en ? 'en/' : ''}"><img src="/assets/symbol.png" alt="" width="30" height="30"> Klendar</a>
      <p style="margin:12px 0 0;max-width:340px">${T.lema}</p></div>
    <div><h4>${T.producto}</h4>${col(FOOT_PRODUCT)}</div>
    <div><h4>${T.legal}</h4>${col(FOOT_LEGAL)}</div>
  </div>
  <div class="bottom">
    <span>${T.derechos}</span>
    <span><a href="mailto:info@klendar.app">info@klendar.app</a> · ${T.hecho}</span>
  </div>
</div></footer>`;
}
