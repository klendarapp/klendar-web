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
// en «Tu cuenta» (/cuenta). `id` es lo que marca la pestaña activa.
export const TABS = [
  { id: 'descubre', es: 'Descubre', en: 'Discover', hrefEs: '/descubre', hrefEn: '/en/discover',
    d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5 7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z' },
  { id: 'explorar', es: 'Explorar', en: 'Explore', hrefEs: '/explorar', hrefEn: '/en/explore',
    d: 'M19.3 16.9c.4-.7.7-1.5.7-2.4 0-2.5-2-4.5-4.5-4.5S11 12 11 14.5s2 4.5 4.5 4.5c.9 0 1.7-.3 2.4-.7l3.2 3.2 1.4-1.4-3.2-3.2zm-3.8.1c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5zM12 20v2C6.48 22 2 17.52 2 12S6.48 2 12 2c4.84 0 8.87 3.44 9.8 8h-2.07c-.64-2.46-2.4-4.47-4.73-5.41V5c0 1.1-.9 2-2 2h-2v2c0 .55-.45 1-1 1H8v2h2v3H9l-4.79-4.79C4.08 10.79 4 11.38 4 12c0 4.41 3.59 8 8 8z' },
  { id: 'planes', es: 'Planes', en: 'Plans', hrefEs: '/cuenta/planes', hrefEn: '/cuenta/planes?lang=en',
    d: 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15-5-2.18L7 18V5h10v13z' },
  { id: 'cuenta', es: 'Cuenta', en: 'Account', hrefEs: '/cuenta', hrefEn: '/cuenta?lang=en',
    d: 'M12 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0 9c2.7 0 5.8 1.29 6 2v1H6v-.99c.2-.72 3.3-2.01 6-2.01M12 4C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 9c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z' },
];

// Los precios del plan de los negocios y las fechas del «Gratis de
// lanzamiento» (Iván, 2026-11-11: ocultos hasta que la gestoría le aclare si
// tiene que darse de alta como autónomo). EL INTERRUPTOR DE TODA LA WEB.
// Apagado (false): ni precio, ni cuota, ni IVA, ni prueba de 30 días, ni
// «gratis hasta…» en la portada, Para negocios, Preguntas, Sobre, la guía en
// PDF ni «Tu cuenta»; «Precios» sale del menú, del pie y del sitemap, y
// /precios dice «¿Cuánto cuesta? Te lo explicamos en persona» (noindex).
// «Sin comisión por canje» y «sin permanencia» se quedan: son ciertos y no
// son precio. Lo leen las páginas al vuelo (este fichero), `build_site.py`,
// `build_pages.py`, `ayuda.py` (y con ella el asistente de la app,
// `tool/asistente_corpus.py`) y `tools/build_kit.py`. Los textos legales
// (`build_legal.py`) y el panel de un negocio («Tu plan») no dependen de esto.
// Para encenderlo: true, `python build_site.py && python build_pages.py &&
// python build_legal.py && python tools/build_kit.py`, y en la app
// `python tool/asistente_corpus.py` y desplegar `help-assistant`.
export const PRECIOS = false;

/** Para `build_site.py`, `ayuda.py` y `tools/build_kit.py` (`node -e`). */
export function precios() {
  return PRECIOS;
}

// Lo demás va en el menú «Más» (y en el pie): lo de informarse y lo de los
// negocios, que en la app no es una pestaña.
export const NAV = [
  { es: 'Agenda local', en: "What's on", hrefEs: '/agenda', hrefEn: '/en/whats-on' },
  { es: 'Cómo funciona', en: 'How it works', hrefEs: '/como-funciona', hrefEn: '/en/how-it-works' },
  { es: 'Para negocios', en: 'For businesses', hrefEs: '/para-negocios', hrefEn: '/en/for-business' },
  ...(PRECIOS ? [{ es: 'Precios', en: 'Pricing', hrefEs: '/precios', hrefEn: '/en/pricing' }] : []),
  { es: 'Preguntas', en: 'FAQ', hrefEs: '/preguntas', hrefEn: '/en/faq' },
  { es: 'Soporte', en: 'Support', hrefEs: '/soporte', hrefEn: '/en/support' },
];

export const FOOT_PRODUCT = [
  { es: 'Cómo funciona', en: 'How it works', hrefEs: '/como-funciona', hrefEn: '/en/how-it-works' },
  { es: 'Descubre', en: 'Discover', hrefEs: '/descubre', hrefEn: '/en/discover' },
  { es: 'Explorar', en: 'Explore', hrefEs: '/explorar', hrefEn: '/en/explore' },
  { es: 'Agenda local', en: "What's on", hrefEs: '/agenda', hrefEn: '/en/whats-on' },
  { es: 'Para negocios', en: 'For businesses', hrefEs: '/para-negocios', hrefEn: '/en/for-business' },
  { es: 'Para ayuntamientos y asociaciones', en: 'For councils and associations', hrefEs: '/para-entidades', hrefEn: '/en/for-organisations' },
  ...(PRECIOS ? [{ es: 'Precios', en: 'Pricing', hrefEs: '/precios', hrefEn: '/en/pricing' }] : []),
  { es: 'Tu cuenta', en: 'Your account', hrefEs: '/cuenta', hrefEn: '/cuenta?lang=en' },
  { es: 'Acceso para negocios', en: 'Business login', hrefEs: '/panel', hrefEn: '/panel' },
  { es: 'Preguntas frecuentes', en: 'FAQ', hrefEs: '/preguntas', hrefEn: '/en/faq' },
  { es: 'Soporte', en: 'Support', hrefEs: '/soporte', hrefEn: '/en/support' },
  { es: 'Sobre Klendar', en: 'About', hrefEs: '/sobre', hrefEn: '/en/about' },
  { es: 'Prensa', en: 'Press', hrefEs: '/prensa', hrefEn: '/en/press' },
  { es: 'English', en: 'Español', hrefEs: '/en', hrefEn: '/' },
];

export const FOOT_LEGAL = [
  { es: 'Aviso legal', en: 'Legal notice', hrefEs: '/aviso-legal', hrefEn: '/en/legal-notice' },
  { es: 'Privacidad', en: 'Privacy policy', hrefEs: '/privacidad', hrefEn: '/en/privacy' },
  { es: 'Términos de uso', en: 'Terms of use', hrefEs: '/terminos', hrefEn: '/en/terms' },
  { es: 'Condiciones para negocios', en: 'Business terms', hrefEs: '/negocios', hrefEn: '/en/business-terms' },
  { es: 'Cookies', en: 'Cookies', hrefEs: '/cookies', hrefEn: '/en/cookies' },
  { es: 'Normas de la comunidad', en: 'Community guidelines', hrefEs: '/normas', hrefEn: '/en/community-guidelines' },
  // DSA art. 16: cualquiera, con cuenta o sin ella (formulario en «Tu cuenta»).
  { es: 'Denunciar contenido ilegal', en: 'Report illegal content', hrefEs: '/cuenta/denunciar', hrefEn: '/cuenta/denunciar?lang=en' },
  { es: 'Eliminar cuenta', en: 'Delete account', hrefEs: '/eliminar-cuenta', hrefEn: '/en/delete-account' },
  { es: 'Accesibilidad', en: 'Accessibility', hrefEs: '/accesibilidad', hrefEn: '/en/accessibility' },
  { es: 'Estado del servicio', en: 'Service status', hrefEs: '/estado', hrefEn: '/en/status' },
  { es: 'Fuentes y licencias', en: 'Sources and licences', hrefEs: '/fuentes', hrefEn: '/en/sources' },
];

// Las redes de Klendar (las de la marca, no las de los negocios) que existen
// de verdad, comprobadas el 2026-10-28; `tiktok.com/@klendar` es de otra
// persona. Van en el pie de todas las páginas, en el kit de prensa y en el
// JSON-LD de la portada (`sameAs`). Para añadir otra: una línea aquí, su
// icono en REDES_ICONO y la misma en la app (`klendarSocial`,
// lib/core/config/social_links.dart).
export const REDES = [
  { red: 'instagram', nombre: 'Instagram', usuario: '@klendar.app', url: 'https://www.instagram.com/klendar.app/' },
  { red: 'tiktok', nombre: 'TikTok', usuario: '@klendar.app', url: 'https://www.tiktok.com/@klendar.app' },
  // La página de empresa (comprobada el 2026-10-29): sin @, el nombre accesible
  // es solo «Klendar en LinkedIn».
  { red: 'linkedin', nombre: 'LinkedIn', usuario: '', url: 'https://www.linkedin.com/company/klendar-app/' },
];

// Los mismos iconos que la app (Material, en contorno: camera_alt para
// Instagram, music_note para TikTok y work para LinkedIn), en tinta como el
// resto del pie.
const REDES_ICONO = {
  instagram: 'M14.12 4l1.83 2H20v12H4V6h4.05l1.83-2h4.24M15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2zm-3 7c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3m0-2c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z',
  tiktok: 'M12 3l.01 10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4.01 4S14 19.21 14 17V7h4V3h-6zm-1.99 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
  linkedin: 'M14 6V4h-4v2h4zM4 8v11h16V8H4zm16-2c1.11 0 2 .89 2 2v11c0 1.11-.89 2-2 2H4c-1.11 0-2-.89-2-2l.01-11c0-1.11.88-2 1.99-2h4V4c0-1.11.89-2 2-2h4c1.11 0 2 .89 2 2v2h4z',
  enlace: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
};

/** Para Python (`build_site.py`): la lista tal cual. */
export const redes = () => REDES;

/**
 * Los enlaces a las redes: icono y nombre, con «Klendar en Instagram
 * (@klendar.app)» como nombre accesible. Enlaces normales, sin scripts ni
 * nada incrustado de la red. `cls`/`estilo` para el pie o el kit de prensa.
 */
export function redesHtml(lang, { estilo = '' } = {}) {
  const en = lang === 'en';
  return REDES.map((r) => {
    const nombre = `${en ? 'Klendar on' : 'Klendar en'} ${r.nombre}${r.usuario ? ` (${r.usuario})` : ''}`;
    return `<a class="red" href="${r.url}" rel="me noopener" aria-label="${nombre}" title="${nombre}"${estilo ? ` style="${estilo}"` : ''}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="flex:none"><path fill="currentColor" d="${REDES_ICONO[r.red] || REDES_ICONO.enlace}"/></svg><span>${r.nombre}</span></a>`;
  }).join('');
}

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
    derechos: '© {anio} Klendar. Todos los derechos reservados.',
    hecho: 'Hecho en España',
    redes: 'Klendar en redes sociales',
    buscar: 'Buscar',
    selecciones: 'Selecciones',
    notificaciones: 'Notificaciones',
    notificacionesN: 'Notificaciones, {n} sin leer',
    idioma: 'Idioma',
    notaIdioma: 'Las páginas públicas están en español e inglés; «Tu cuenta» y el panel, en los ocho idiomas.',
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
    derechos: '© {anio} Klendar. All rights reserved.',
    hecho: 'Made in Spain',
    redes: 'Klendar on social media',
    buscar: 'Search',
    selecciones: 'Picks',
    notificaciones: 'Notifications',
    notificacionesN: 'Notifications, {n} unread',
    idioma: 'Language',
    notaIdioma: 'Public pages are in English and Spanish; “Your account” and the business panel, in all eight languages.',
  },
};

const item = (n, en) => ({ label: en ? n.en : n.es, href: en ? n.hrefEn : n.hrefEs, cls: n.cls });

// Los ocho idiomas de Klendar, cada uno con su nombre en su idioma (los de
// assets/i18n.js). Las páginas públicas solo están en español e inglés:
// catalán, gallego y euskera llevan a la española; francés, alemán e
// italiano, a la inglesa (`esOEn`). «Tu cuenta» y el panel, en los ocho.
export const IDIOMAS = [
  ['es', 'Español'], ['en', 'English'], ['ca', 'Català'], ['gl', 'Galego'],
  ['eu', 'Euskara'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'],
];
const ladoPublico = (l) => (/^(en|fr|de|it)$/.test(l) ? 'en' : 'es');

// Iconos de Material (con contorno) de la cabecera: auto_awesome, search,
// notifications_none y language.
const ICONO = {
  selecciones: 'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm0 6l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25zm-7.5-5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zm-1.51 3.49L9 15.17l-.99-2.18L5.83 12l2.18-.99L9 8.83l.99 2.18 2.18.99-2.18.99z',
  buscar: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  campana: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z',
  idioma: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z',
};
const icono = (n, s = 24) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${ICONO[n]}"/></svg>`;

/**
 * La barra de arriba.
 *
 * `esPath` y `enPath` son la misma página en cada idioma (para el selector).
 * Si se piden como plantilla (`{{ES}}` y `{{EN}}`), Python los sustituye al
 * construir las páginas estáticas.
 */
// La misma cabecera en todas las páginas (Iván, 2026-11-02: «la barra no es
// constante»): el logo · las cuatro pestañas · ✨ Selecciones · la lupa · la
// campana (con sesión) · «Para negocios» · el idioma · Entrar o tu inicial ·
// ☰. En el móvil, las pestañas abajo y el idioma dentro de ☰. Lo que hace
// cada botón según la página lo pone cabecera.js (la lupa abre «Buscar» en
// Descubre y lleva al buscador desde las demás).
export function siteHeader(lang, esPath = '/', enPath = '/en', actual = '') {
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
  const cuenta = en ? '/cuenta?lang=en' : '/cuenta';
  const enCuenta = (ruta) => (en ? `/cuenta/${ruta}?lang=en` : `/cuenta/${ruta}`);
  // El idioma: el mismo selector en todas las páginas (antes, «ES | EN» en
  // las públicas y un desplegable con los ocho en «Tu cuenta» y el panel).
  // Cada idioma con su nombre en su idioma; los que no tienen páginas
  // públicas propias van a la versión que les toca (y cabecera.js lo
  // recuerda y, con sesión, lo guarda en tu cuenta, como la app).
  const opciones = IDIOMAS.map(([l, nombre]) => `<a href="${ladoPublico(l) === 'en' ? enPath : esPath}" lang="${l}" hreflang="${ladoPublico(l)}" data-lang="${l}" translate="no"${l === (en ? 'en' : 'es') ? ' aria-current="true"' : ''}>${nombre}</a>`).join('');
  const nombreAhora = en ? 'English' : 'Español';
  const selector = `<details class="idioma" data-idioma>
      <summary class="idioma-b" aria-label="${T.idioma}: ${nombreAhora}" title="${T.idioma}">${icono('idioma', 20)}<span class="idioma-cod" data-idioma-cod>${en ? 'EN' : 'ES'}</span></summary>
      <div class="idioma-menu" role="group" aria-label="${T.idioma}">${opciones}<p class="idioma-nota">${T.notaIdioma}</p></div>
    </details>`;
  const selectorMovil = `<div class="idioma-lista" data-idioma role="group" aria-label="${T.idioma}"><p class="idioma-t">${T.idioma}</p><div>${opciones}</div><p class="idioma-nota">${T.notaIdioma}</p></div>`;
  const descubre = en ? TABS[0].hrefEn : TABS[0].hrefEs;
  const explorar = en ? TABS[1].hrefEn : TABS[1].hrefEs;
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
  // `data-precios`: con el interruptor encendido (PRECIOS), para lo que se
  // pinta en el navegador («Tu cuenta», `assets/cuenta/app.js`).
  return `<a class="saltar" href="#contenido">${T.saltar}</a>
<header class="top"${PRECIOS ? ' data-precios' : ''}><div class="wrap">
  <a class="brand" href="${en ? '/en' : '/'}"><svg class="simbolo" viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><path class="simbolo-anillo" pathLength="1" d="M32 6.8A25.2 25.2 0 1 1 8.03 24.21" fill="none" stroke="#FF4D6D" stroke-width="8.4" stroke-linecap="round"/><g class="simbolo-aguja"><path d="M32 32V19.4" stroke="currentColor" stroke-width="5.6" stroke-linecap="round"/></g><circle cx="32" cy="32" r="5.6" fill="currentColor"/></svg> Klendar</a>
  <nav class="pestanas" aria-label="${T.secciones}">${pestanas('pestana')}</nav>
  <input type="checkbox" id="menu" aria-label="${T.mas}">
  <nav class="main" aria-label="${T.mas}">${enlaces}
    <div class="solo-movil">${selectorMovil}</div>
  </nav>
  <div class="top-acciones">
    <span class="top-iconos">
      <a class="top-icono" href="${descubre}#selecciones" data-abre-hoja="selecciones" aria-label="${T.selecciones}" title="${T.selecciones}">${icono('selecciones')}</a>
      <a class="top-icono" href="${explorar}?${en ? 'search' : 'buscar'}=1" data-abre-hoja="buscar" aria-label="${T.buscar}" title="${T.buscar}">${icono('buscar')}</a>
      <a class="top-icono top-campana" href="${enCuenta('notificaciones')}" data-campana data-n="${T.notificacionesN}" aria-label="${T.notificaciones}" title="${T.notificaciones}" hidden>${icono('campana')}<span class="top-n" aria-hidden="true" hidden></span></a>
    </span>
    <a class="top-negocios" href="${negocios.href}">${negocios.label}</a>
    ${selector}
    <a class="pill top-entrar" href="${enCuenta('entrar')}" data-cuenta="${cuenta}" data-cuenta-txt="${T.cuenta}">${T.entrar}</a>
    <label class="menu-toggle" for="menu" aria-hidden="true" title="${T.mas}"><span></span><span></span><span></span></label>
  </div>
</div></header>
<script src="/assets/cabecera-yo.js?v=20261111vuelta"></script>
<nav class="tabbar" aria-label="${T.secciones}">${pestanas('tab')}</nav>
<script src="/assets/cabecera.js?v=20261111sinbarra" defer></script>`;
}

/**
 * El año del pie, calculado en cada petición: en Cloudflare Workers el reloj
 * está parado en 1970 fuera de una petición, así que no puede ir en `TEXTOS`
 * (que se evalúa al cargar el módulo). En hora de Madrid.
 */
export function anioActual(ahora = new Date()) {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', year: 'numeric' }).format(ahora);
  } catch {
    return String(ahora.getUTCFullYear());
  }
}

/** El pie, con las mismas columnas en todas las páginas. */
export function siteFooter(lang) {
  const en = lang === 'en';
  const T = TEXTOS[en ? 'en' : 'es'];
  const col = (lista) => lista.map((n) => item(n, en))
    .map((n) => `<a href="${n.href}">${n.label}</a>`).join('');
  return `<footer><div class="wrap">
  <div class="cols">
    <div><a class="brand" href="${en ? '/en' : '/'}"><svg class="simbolo" viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><path class="simbolo-anillo" pathLength="1" d="M32 6.8A25.2 25.2 0 1 1 8.03 24.21" fill="none" stroke="#FF4D6D" stroke-width="8.4" stroke-linecap="round"/><g class="simbolo-aguja"><path d="M32 32V19.4" stroke="currentColor" stroke-width="5.6" stroke-linecap="round"/></g><circle cx="32" cy="32" r="5.6" fill="currentColor"/></svg> Klendar</a>
      <p style="margin:12px 0 0;max-width:340px">${T.lema}</p>
      ${REDES.length ? `<nav class="pie-redes" aria-label="${T.redes}" style="display:flex;flex-wrap:wrap;gap:4px 18px;margin-top:14px">${redesHtml(lang, { estilo: 'display:inline-flex;align-items:center;gap:6px;color:var(--ink);min-height:44px' })}</nav>` : ''}</div>
    <div><h2 class="pie-h">${T.producto}</h2>${col(FOOT_PRODUCT)}</div>
    <div><h2 class="pie-h">${T.legal}</h2>${col(FOOT_LEGAL)}</div>
  </div>
  <div class="bottom">
    <span>${T.derechos.replace('{anio}', anioActual())}</span>
    <span><!--email_off--><a href="mailto:info@klendar.app">info@klendar.app</a><!--/email_off--> · ${T.hecho}</span>
  </div>
</div></footer>`;
}
