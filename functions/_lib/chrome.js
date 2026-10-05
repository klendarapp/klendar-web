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

// Las cuatro pestañas de la app, en el mismo orden y con los mismos iconos
// (Material: explore, travel_explore, bookmark, person). En el escritorio van
// arriba; en el móvil, en una barra abajo, como la app. Planes y Cuenta viven
// en «Tu cuenta» (/app/). `id` es lo que marca la pestaña activa.
export const TABS = [
  { id: 'descubre', es: 'Descubre', en: 'Discover', hrefEs: '/descubre/', hrefEn: '/en/discover/',
    d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5 7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z' },
  { id: 'explorar', es: 'Explorar', en: 'Explore', hrefEs: '/explorar/', hrefEn: '/en/explore/',
    d: 'M19.3 16.9c.4-.7.7-1.5.7-2.4 0-2.5-2-4.5-4.5-4.5S11 12 11 14.5s2 4.5 4.5 4.5c.9 0 1.7-.3 2.4-.7l3.2 3.2 1.4-1.4-3.2-3.2zm-3.8.1c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5zM12 20v2C6.48 22 2 17.52 2 12S6.48 2 12 2c4.84 0 8.87 3.44 9.8 8h-2.07c-.64-2.46-2.4-4.47-4.73-5.41V5c0 1.1-.9 2-2 2h-2v2c0 .55-.45 1-1 1H8v2h2v3H9l-4.79-4.79C4.08 10.79 4 11.38 4 12c0 4.41 3.59 8 8 8z' },
  { id: 'planes', es: 'Planes', en: 'Plans', hrefEs: '/app/#/planes', hrefEn: '/app/?lang=en#/planes',
    d: 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15-5-2.18L7 18V5h10v13z' },
  { id: 'cuenta', es: 'Cuenta', en: 'Account', hrefEs: '/app/', hrefEn: '/app/?lang=en',
    d: 'M12 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0 9c2.7 0 5.8 1.29 6 2v1H6v-.99c.2-.72 3.3-2.01 6-2.01M12 4C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 9c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z' },
];

// Lo demás va en el menú «Más» (y en el pie): lo de informarse y lo de los
// negocios, que en la app no es una pestaña.
export const NAV = [
  { es: 'Agenda local', en: "What's on", hrefEs: '/agenda/', hrefEn: '/en/whats-on/' },
  { es: 'Cómo funciona', en: 'How it works', hrefEs: '/como-funciona/', hrefEn: '/en/how-it-works/' },
  { es: 'Para negocios', en: 'For businesses', hrefEs: '/para-negocios/', hrefEn: '/en/for-business/' },
  { es: 'Precios', en: 'Pricing', hrefEs: '/precios/', hrefEn: '/en/pricing/' },
  { es: 'Preguntas', en: 'FAQ', hrefEs: '/preguntas/', hrefEn: '/en/faq/' },
  { es: 'Soporte', en: 'Support', hrefEs: '/soporte/', hrefEn: '/en/support/' },
];

export const FOOT_PRODUCT = [
  { es: 'Cómo funciona', en: 'How it works', hrefEs: '/como-funciona/', hrefEn: '/en/how-it-works/' },
  { es: 'Descubre', en: 'Discover', hrefEs: '/descubre/', hrefEn: '/en/discover/' },
  { es: 'Explorar', en: 'Explore', hrefEs: '/explorar/', hrefEn: '/en/explore/' },
  { es: 'Agenda local', en: "What's on", hrefEs: '/agenda/', hrefEn: '/en/whats-on/' },
  { es: 'Para negocios', en: 'For businesses', hrefEs: '/para-negocios/', hrefEn: '/en/for-business/' },
  { es: 'Precios', en: 'Pricing', hrefEs: '/precios/', hrefEn: '/en/pricing/' },
  { es: 'Tu cuenta', en: 'Your account', hrefEs: '/app/', hrefEn: '/app/?lang=en' },
  { es: 'Acceso para negocios', en: 'Business login', hrefEs: '/panel/', hrefEn: '/panel/' },
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
  // DSA art. 16: cualquiera, con cuenta o sin ella (formulario en «Tu cuenta»).
  { es: 'Denunciar contenido ilegal', en: 'Report illegal content', hrefEs: '/app/#/denunciar', hrefEn: '/app/?lang=en#/denunciar' },
  { es: 'Eliminar cuenta', en: 'Delete account', hrefEs: '/eliminar-cuenta/', hrefEn: '/en/delete-account/' },
  { es: 'Accesibilidad', en: 'Accessibility', hrefEs: '/accesibilidad/', hrefEn: '/en/accessibility/' },
  { es: 'Estado del servicio', en: 'Service status', hrefEs: '/estado/', hrefEn: '/en/status/' },
];

const TEXTOS = {
  es: {
    menu: 'Menú',
    mas: 'Más',
    secciones: 'Secciones',
    saltar: 'Saltar al contenido',
    entrar: 'Entrar',
    cuenta: 'Tu cuenta',
    lema: 'Ofertas flash con cuenta atrás y eventos de los negocios de tu barrio, '
      + 'ordenados por cercanía. Marca tus favoritos, recibe avisos y canjea con un QR.',
    producto: 'Producto',
    legal: 'Legal',
    derechos: `© ${new Date().getFullYear()} Klendar. Todos los derechos reservados.`,
    hecho: 'Hecho en España',
  },
  en: {
    menu: 'Menu',
    mas: 'More',
    secciones: 'Sections',
    saltar: 'Skip to content',
    entrar: 'Log in',
    cuenta: 'Your account',
    lema: 'Flash offers with a countdown and events from the businesses around you, '
      + 'sorted by distance. Add businesses to your favourites, get alerts and redeem with a QR code.',
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
export function siteHeader(lang, esPath = '/', enPath = '/en/', actual = '') {
  const en = lang === 'en';
  const T = TEXTOS[en ? 'en' : 'es'];
  const enlaces = NAV.map((n) => item(n, en))
    .map((n) => `\n    <a href="${n.href}"${n.cls ? ` class="${n.cls}"` : ''}>${n.label}</a>`)
    .join('');
  // Las pestañas: arriba en el escritorio (`.pestanas`) y abajo en el móvil
  // (`.tabbar`), la misma lista. La activa la marca la página (`actual`) o,
  // en las estáticas y en «Tu cuenta», cabecera.js según la dirección.
  const pestanas = (cls) => TABS.map((n) => {
    const on = n.id === actual;
    return `<a class="${cls}" data-tab="${n.id}" href="${en ? n.hrefEn : n.hrefEs}"${on ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="${n.d}"/></svg><span>${en ? n.en : n.es}</span></a>`;
  }).join('');
  const cuenta = en ? '/app/?lang=en' : '/app/';
  const selector = `<span class="lang" aria-label="Idioma / Language">
      <a href="${esPath}" class="${en ? '' : 'on'}" data-lang="es" hreflang="es">ES</a>
      <a href="${enPath}" class="${en ? 'on' : ''}" data-lang="en" hreflang="en">EN</a>
    </span>`;
  // «Entrar» siempre a la vista, también en el móvil (fuera del menú). Si ya
  // hay sesión, cabecera.js lo cambia por tu inicial o tu foto. Es el único
  // acceso: quien lleva un negocio va a su panel desde «Tu cuenta» o desde
  // «Para negocios» (hay una sola cuenta y una sola forma de entrar).
  // «Saltar al contenido»: solo se ve al llegar con el tabulador (WCAG 2.4.1).
  // Apunta a <main id="contenido">; cabecera.js lo arregla si el <main> de
  // la página se llama de otra forma.
  // El menú del móvil es una casilla: se puede tabular y se lee «Menú»; va
  // encima del icono (invisible) para que el toque y el lector de pantalla
  // den con ella.
  // «Para negocios» a la vista en el escritorio (es la otra mitad de la web);
  // lo demás, en «Más».
  const negocios = item(NAV[2], en);
  return `<a class="saltar" href="#contenido">${T.saltar}</a>
<header class="top"><div class="wrap">
  <a class="brand" href="/${en ? 'en/' : ''}"><img src="/assets/symbol-96.png" alt="" width="30" height="30"> Klendar</a>
  <nav class="pestanas" aria-label="${T.secciones}">${pestanas('pestana')}</nav>
  <input type="checkbox" id="menu" aria-label="${T.mas}">
  <nav class="main" aria-label="${T.mas}">${enlaces}
    <span class="solo-movil">${selector}</span>
  </nav>
  <div class="top-acciones">
    <a class="top-negocios" href="${negocios.href}">${negocios.label}</a>
    ${selector}
    <a class="pill top-entrar" href="${cuenta}#/entrar" data-cuenta="${cuenta}" data-cuenta-txt="${T.cuenta}">${T.entrar}</a>
    <label class="menu-toggle" for="menu" aria-hidden="true" title="${T.mas}"><span></span><span></span><span></span></label>
  </div>
</div></header>
<nav class="tabbar" aria-label="${T.secciones}">${pestanas('tab')}</nav>
<script src="/assets/cabecera.js?v=8" defer></script>`;
}

/** El pie, con las mismas columnas en todas las páginas. */
export function siteFooter(lang) {
  const en = lang === 'en';
  const T = TEXTOS[en ? 'en' : 'es'];
  const col = (lista) => lista.map((n) => item(n, en))
    .map((n) => `<a href="${n.href}">${n.label}</a>`).join('');
  return `<footer><div class="wrap">
  <div class="cols">
    <div><a class="brand" href="/${en ? 'en/' : ''}"><img src="/assets/symbol-96.png" alt="" width="30" height="30" loading="lazy" decoding="async"> Klendar</a>
      <p style="margin:12px 0 0;max-width:340px">${T.lema}</p></div>
    <div><h2 class="pie-h">${T.producto}</h2>${col(FOOT_PRODUCT)}</div>
    <div><h2 class="pie-h">${T.legal}</h2>${col(FOOT_LEGAL)}</div>
  </div>
  <div class="bottom">
    <span>${T.derechos}</span>
    <span><!--email_off--><a href="mailto:info@klendar.app">info@klendar.app</a><!--/email_off--> · ${T.hecho}</span>
  </div>
</div></footer>`;
}
