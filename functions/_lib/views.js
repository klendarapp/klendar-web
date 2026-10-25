// Las tres páginas públicas, en los dos idiomas.
//
// Cada una vive en dos URLs (`/o/<id>` y `/en/o/<id>`) que enlazan entre sí
// con hreflang. El idioma lo manda la ruta, no el navegador: así se puede
// mandar el enlace inglés a quien toque y Google indexa las dos.
//
// Se pueden leer enteras sin app y sin cuenta. Lo que necesita cuenta
// (guardar, seguir, pedir el código, opinar, denunciar) lleva a «Tu cuenta»
// (/app/), que hace lo mismo que la app desde el navegador.

import { esc, fmtWhen, html, isUuid, rpc, rpcAll, rows, supabasePublic } from './page.js';
import KZ from '../../assets/zona.js';
import { decodeSeg,
  agendaBase, BASE, benefit, bizPath, breadcrumbLd, cityLinks, citySeg, datosDeNegocios, exploreBase,
  arteFicha, carrusel, esGenerica, firstPhoto, fmtDay, fmtEnd, fmtLong, fmtTime, sameDay, isSlug, isVideo, ldScript, listingLd, miniatura, miniaturas, money, openInApp,
  historiaBoton, priorPrice, publicPage, slugDe, todayBase, zonaDe,
} from './public.js';
import { cuandoCorto, plataformaEntradas, rejilla } from './tarjeta.js';
import { SITIO_PLAN, listaSitio, sitioFicha } from './sitio.js';
import { FUENTE_TIEMPO } from './tiempo.js';
import KR from '../../assets/rrpp-enlace.js';
import KM from '../../assets/marcas.js';
import KMO from '../../assets/momentos.js';
import KE from '../../assets/enlaces.js';
import { fuenteHtml, selloEntidad } from './entidades.js';
import { PARTIDOS_CSS, partidosDelBar } from './partidos.js';
import { GRUPOS_CSS, grupoEnFicha } from './grupos.js';
import { sorteosEncendidos, sorteosEnFicha } from './sorteos.js';
import { ARTISTAS_CSS, actuaEnOferta, performersLd } from './artistas.js';
import KA from '../../assets/artistas.js';

// Iconos de Material (los mismos que la app), en SVG: las páginas públicas
// no cargan la fuente de iconos.
const PATHS = {
  lugar: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
  telefono: 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  web: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  carta: 'M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z',
  correo: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
  redes: 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z',
  cerrado: 'M9.31 17l2.44-2.44L14.19 17l1.06-1.06-2.44-2.44 2.44-2.44L14.19 10l-2.44 2.44L9.31 10l-1.06 1.06 2.44 2.44-2.44 2.44L9.31 17zM19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z',
  negocio: 'M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z',
  candado: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  regalo: 'M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z',
  // «Voy» (check_circle) e «Invitar a un amigo» (group_add), como en la app.
  voy: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  invitar: 'M8 10H5V7H3v3H0v2h3v3h2v-3h3v-2zm10 1c1.66 0 2.99-1.34 2.99-3S19.66 5 18 5c-.32 0-.63.05-.91.14.57.81.9 1.79.9 2.86s-.34 2.04-.9 2.86c.28.09.59.14.91.14zm-5 0c1.66 0 2.99-1.34 2.99-3S14.66 5 13 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm6.62 2.16c.83.73 1.38 1.66 1.38 2.84v2h3v-2c0-1.54-2.37-2.49-4.38-2.84zM13 13c-2 0-6 1-6 3v2h12v-2c0-2-4-3-6-3z',
  // «Forma parte de una serie» (event_repeat).
  serie: 'M21 12V6c0-1.1-.9-2-2-2h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h7v-2H5V10h14v2h2zm-5.36 8c.43 1.45 1.77 2.5 3.36 2.5 1.93 0 3.5-1.57 3.5-3.5s-1.57-3.5-3.5-3.5c-.95 0-1.82.38-2.45 1H18V18h-4v-4h1.5v1.43c.9-.88 2.14-1.43 3.5-1.43 2.76 0 5 2.24 5 5s-2.24 5-5 5c-2.42 0-4.44-1.72-4.9-4h1.54z',
  // ⋮ (more_vert): lo que se usa poco, como en la app.
  mas: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  editar: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  // «Momentos del día» (schedule) y el festivo (event).
  reloj: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  calendario: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
  // «Preguntas» (help_outline).
  pregunta: 'M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z',
  // «Compartir» (ios_share), «Cómo llegar» (directions) y «Contactar» (forum), como la app.
  compartir: 'M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z',
  llegar: 'M21.71 11.29l-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z',
  contactar: 'M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z',
  resena: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 14v-2.47l6.88-6.88c.2-.2.51-.2.71 0l1.77 1.77c.2.2.2.51 0 .71L8.47 14H6zm12 0h-7.5l2-2H18v2z',
};
const icono = (n, size = 18) => `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${PATHS[n]}"/></svg>`;

const pre = (lang) => (lang === 'en' ? '/en' : '');

/** «¿Hay sitio ahora?» lo pinta el navegador (la página va en caché y lo
 * marcado caduca a las 2 h): /assets/sitio-ahora.js. */
export const sitioAhoraScripts = (lang) => {
  const sp = supabasePublic();
  return `<script src="/assets/marcas.js?v=6" defer></script>
<script src="/assets/sitio-ahora.js?v=2" defer data-url="${esc(sp.url)}" data-key="${esc(sp.key)}" data-lang="${lang === 'en' ? 'en' : 'es'}"></script>`;
};

/** El menú ⋮ de las fichas (como la app): lo que se usa poco (añadir al
 * calendario, «¿Por qué ves esto?», Denunciar) sin competir con Guardar o
 * Compartir. Un `<details>`: funciona sin JavaScript; con él, se cierra al
 * tocar fuera o con Escape (`MENU_JS`). `items`: HTML de cada opción. */
export const masMenu = (items, lang, { soloPublico = false } = {}) => `<details class="mas-menu"${soloPublico ? ' data-solo-publico' : ''}>
      <summary aria-label="${lang === 'en' ? 'More options' : 'Más opciones'}" title="${lang === 'en' ? 'More options' : 'Más opciones'}">${icono('mas', 22)}</summary>
      <div class="mas-lista">${items.filter(Boolean).join('')}</div>
    </details>`;
export const MENU_JS = `<script>(function(){var c=function(x){document.querySelectorAll('details.mas-menu[open]').forEach(function(d){if(!x||!d.contains(x))d.open=false;});};
document.addEventListener('click',function(e){c(e.target);});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var d=document.querySelector('details.mas-menu[open]');c(null);if(d)d.querySelector('summary').focus();}});
document.querySelectorAll('.mas-lista a').forEach(function(a){a.addEventListener('click',function(){c(null);});});
function pq(){var d=document.getElementById(location.hash.slice(1));if(d&&d.tagName==='DETAILS'&&d.classList.contains('por-que'))d.open=true;}addEventListener('hashchange',pq);pq();})();</script>`;

/** Redes: el negocio puede guardar el @ o el enlace entero. */
const redUrl = (red, v) => {
  const val = String(v || '').trim();
  if (/^https?:\/\//.test(val)) return val;
  const h = val.replace(/^@/, '');
  return { instagram: `https://instagram.com/${h}`, tiktok: `https://tiktok.com/@${h}`,
    facebook: `https://facebook.com/${h}`, x: `https://x.com/${h}`, twitter: `https://x.com/${h}`,
    youtube: `https://youtube.com/@${h}` }[red] || `https://${val}`;
};
const redNombre = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', x: 'X', twitter: 'X', youtube: 'YouTube' };

/** «Cómo llegar» (la ruta hasta el sitio en Google Maps), como el botón de la app. */
const comoLlegarHref = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${Number(lat)},${Number(lng)}`;

/** «Cómo llegar · Contactar · Redes sociales» (las hojas de la app): un
 * `<details>` por cada una, que abre su lista como el menú ⋮. `c`: phone,
 * email, website, social. */
export function toquesContacto(c, lang, { lat = null, lng = null } = {}) {
  const en = lang === 'en';
  const web = seguro(c.website);
  const tel = String(c.phone || '').trim();
  const wa = tel ? tel.replace(/[^0-9+]/g, '').replace(/^\+/, '').replace(/^(\d{9})$/, '34$1') : '';
  const redes = Object.entries(c.social || {})
    .filter(([k, v]) => k !== 'web' && typeof v === 'string' && v.trim());
  const menu = (ico, titulo, items) => `<details class="mas-menu toque"><summary class="pill">${icono(ico, 16)} <span>${esc(titulo)}</span></summary>
      <div class="mas-lista">${items.join('')}</div></details>`;
  const fuera = 'rel="nofollow noopener" target="_blank"';
  const contacto = [
    tel ? `<a href="tel:${esc(tel)}">${en ? 'Call' : 'Llamar'} · ${esc(tel)}</a>` : '',
    wa ? `<a href="https://wa.me/${esc(wa)}" ${fuera}>WhatsApp</a>` : '',
    c.email ? `<a href="mailto:${esc(c.email)}">${en ? 'Email' : 'Correo'} · ${esc(c.email)}</a>` : '',
    web ? `<a href="${esc(web)}" ${fuera}>${en ? 'Website' : 'Web'} · ${esc(web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>` : '',
  ].filter(Boolean);
  const partes = [
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat != null
      ? `<a class="pill" href="${esc(comoLlegarHref(lat, lng))}" ${fuera}>${icono('llegar', 16)} <span>${en ? 'Directions' : 'Cómo llegar'}</span></a>` : '',
    contacto.length ? menu('contactar', en ? 'Contact' : 'Contactar', contacto) : '',
    redes.length ? menu('redes', en ? 'Social media' : 'Redes sociales',
      redes.map(([k, v]) => `<a href="${esc(redUrl(k, v))}" ${fuera}>${esc(redNombre[k] || k)}</a>`)) : '',
  ].filter(Boolean);
  return partes.length ? `<div class="acciones toques">${partes.join('')}</div>` : '';
}

/** «Compartir»: el menú de compartir del móvil o, sin él, copiar el enlace
 * (como la hoja de la app: enlace y copiar; las historias van al lado). */
export const compartirBoton = (lang, url, titulo) => `<button type="button" class="pill" data-compartir="${esc(url)}" data-titulo="${esc(titulo || '')}" data-copiado="${lang === 'en' ? 'Link copied' : 'Enlace copiado'}">${icono('compartir', 16)} <span>${lang === 'en' ? 'Share' : 'Compartir'}</span></button>`;
export const COMPARTIR_JS = `<script>(function(){document.querySelectorAll('[data-compartir]').forEach(function(b){b.addEventListener('click',function(){var u=b.getAttribute('data-compartir'),t=b.getAttribute('data-titulo')||document.title;
if(navigator.share){navigator.share({title:t,url:u}).catch(function(){});return;}
var ok=function(){var s=b.querySelector('span'),antes=s.textContent;s.textContent=b.getAttribute('data-copiado');setTimeout(function(){s.textContent=antes;},2500);};
if(navigator.clipboard)navigator.clipboard.writeText(u).then(ok,function(){prompt('',u);});else prompt('',u);});});})();</script>`;

/** Un .ics para «Añadir al calendario» (sin servidor: un enlace `data:`). */
function icsHref(o, lugar, url) {
  const t = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const txt = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/[;,]/g, (m) => `\\${m}`).replace(/\r?\n/g, '\\n');
  const ini = o.event_at;
  const fin = o.event_end_at || new Date(new Date(ini).getTime() + 2 * 3600e3).toISOString();
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Klendar//Klendar//ES', 'BEGIN:VEVENT',
    `UID:${o.id}@klendar.app`, `DTSTAMP:${t(ini)}`, `DTSTART:${t(ini)}`, `DTEND:${t(fin)}`,
    `SUMMARY:${txt(o.title)}`, lugar ? `LOCATION:${txt(lugar)}` : '', `URL:${url}`,
    `DESCRIPTION:${txt([o.description || '', url].filter(Boolean).join('\n\n'))}`,
    'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

/** «Tu cuenta» en el idioma de la ficha (la cabecera ya lo hace así). */
const cuenta = (lang) => (lang === 'en' ? '/app/?lang=en' : '/app/');
/** Solo enlaces web: lo que escribe un negocio no puede ser un javascript:. */
// «4,0» en español y «4.0» en inglés, como la app.
const nota = (r, lang) => Number(r).toLocaleString(lang === 'en' ? 'en-GB' : 'es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const seguro = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
/** Una publicación que ya acabó o se borró, o un negocio que ya no está: con
 * la cabecera y el pie de siempre y algo que hacer, no una página suelta.
 * Centrada, como toda pantalla vacía o de error (`.vacio`). */
export const notFound = (lang, path, kind) => {
  const en = lang === 'en';
  const S = en
    ? {
        o: ['This publication is no longer here', 'It may have ended or been removed by the business. There is probably something else on nearby.'],
        b: ["This business isn't on Klendar", 'The link may be wrong or the business may no longer be here.'],
        c: ["We couldn't find that city", 'Have a look at the list of cities with something on.'],
        a: ['This link no longer works', 'They may have changed it. Ask them for the new one.'],
        exp: "See what's on now", agenda: "What's on",
      }
    : {
        o: ['Esta publicación ya no está', 'Puede que haya terminado o que el negocio la haya quitado. Seguro que hay otra cosa cerca.'],
        b: ['Este negocio no está en Klendar', 'Puede que el enlace esté mal o que el negocio ya no esté.'],
        c: ['No encontramos esa ciudad', 'Mira la lista de ciudades con algo publicado.'],
        a: ['Este enlace ya no vale', 'Puede que lo haya cambiado. Pídele el nuevo.'],
        exp: 'Ver qué hay ahora', agenda: 'Agenda local',
      };
  const [titulo, texto] = S[kind] || S.o;
  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a></p>
  <section class="vacio">
    <h1>${esc(titulo)}</h1>
    <p>${esc(texto)}</p>
    <div class="vacio-botones"><a class="pill accent" href="${exploreBase(lang)}/">${esc(S.exp)}</a>
      <a class="pill" href="${agendaBase(lang)}/">${esc(S.agenda)}</a></div>
  </section>`;
  return html(publicPage({
    lang, path, body, title: titulo, description: texto, head: '<meta name="robots" content="noindex">',
  }), 404, 'no-store');
};

/** Un negocio que administración ha marcado como cerrado de verdad
 * (`business_closure_state`, por id o por cualquiera de sus direcciones con
 * nombre): «Este negocio ha cerrado», con 410 para que los buscadores lo
 * quiten. null si no es eso (y la ficha sigue con su «no está»). */
async function cerradoPage(lang, ref, path) {
  let c = null;
  try { c = await rpc('business_closure_state', { p_ref: ref }); } catch { c = null; }
  if (!c || !c.name) return null;
  const en = lang === 'en';
  const titulo = en ? 'This business has closed' : 'Este negocio ha cerrado';
  const texto = en
    ? `We've been told that ${c.name} has closed, so it's no longer on Klendar.`
    : `Nos han confirmado que ${c.name} ha cerrado, así que ya no está en Klendar.`;
  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a></p>
  <section class="vacio">
    <h1>${esc(titulo)}</h1>
    <p>${esc(texto)}</p>
    <div class="vacio-botones"><a class="pill accent" href="${exploreBase(lang)}/">${esc(en ? "See what's on now" : 'Ver qué hay ahora')}</a>
      <a class="pill" href="${agendaBase(lang)}/">${esc(en ? "What's on" : 'Agenda local')}</a></div>
  </section>`;
  return html(publicPage({
    lang, path, body, title: titulo, description: texto, head: '<meta name="robots" content="noindex">',
  }), 410, 'public, max-age=300');
}

// ── Publicación ────────────────────────────────────────────────────────────
/**
 * Traducción automática para quien la tiene encendida («Tu cuenta» →
 * Ajustes): `/assets/traducir.js` no hace nada (ni pide nada) si no. Se le
 * dice qué pedir (`offer:<id>`, `business:<id>`, `menu:<id>`); el texto lo
 * saca el servidor. Lo traducible lleva `data-tr` y el aviso «Traducido
 * automáticamente · Ver original», `data-tr-nota`.
 */
function traducir(lang, ...pedir) {
  const sp = supabasePublic();
  return `<script src="/assets/traducir.js?v=1" defer data-url="${esc(sp.url)}" data-key="${esc(sp.key)}" data-lang="${lang === 'en' ? 'en' : 'es'}" data-pedir="${esc(pedir.filter(Boolean).join(' '))}"></script>`;
}

export async function offerPage(id, lang, rpRaw = '') {
  const path = `${pre(lang)}/o/${id}`;
  const en = lang === 'en';
  if (!isUuid(id)) return notFound(lang, path, 'o');
  // Abierta desde el enlace de un RRPP (`?rp=<código>`): la base dice de
  // quién es la lista (`promoter`). Una oferta de RRPP sin un enlace que la
  // tenga no existe (el 404 de siempre).
  const rp = KR.codigoValido(rpRaw);
  const o = await rpc('offer_detail', { p_id: id, p_rp: rp || null });
  if (!o) return notFound(lang, path, 'o');
  const prom = rp && o.promoter && o.promoter.code ? o.promoter : null;
  // Con el enlace (o siendo de RRPP), la página no es para los buscadores:
  // sin canonical ni hreflang y sin caché compartida. «Compartir en
  // historias» lleva el `?rp=` del enlace (como la app); una de RRPP sin él
  // no lo ofrece: su imagen llevaría a un enlace que no la abre.
  const deRrpp = o.audience === 'promoters';
  const privada = Boolean(prom) || deRrpp;
  const rpQ = prom ? `?rp=${encodeURIComponent(prom.code)}` : '';
  // Cómo es el sitio según la publicación o su local (sin deducir nada por
  // la categoría): se pide ya, a la vez que la dirección del negocio.
  const rasgosP = rpcAll('offer_place_traits', { p_offer: id }).catch(() => []);
  // Solo, solidario, edades, carné y «Escúchalo antes» (sin ellas, la ficha
  // sale igual).
  const marcasP = rpc('offer_marks', { p_offer: id }).catch(() => null);
  // Evento importado de datos abiertos: su fuente y licencia (atribución).
  const fuenteP = rpc('offer_source', { p_offer: id }).catch(() => null);
  // «Quién actúa» («Actúa: DJ Nano ›»), cada uno a su página. Sin la función
  // (o sin red), la ficha sale igual.
  const actuaP = actuaEnOferta(id, lang).catch(() => ({ html: '', lista: [] }));
  // Entradas nominativas (solo eventos con reserva y no de RRPP): se dice
  // antes de reservar. Sin la columna (o sin red), la ficha sale igual.
  const nominativaP = o.kind === 'future_event' && o.reservations_enabled && o.audience !== 'promoters'
    ? rows('offers', `select=named_tickets&id=eq.${id}`).then((r) => r[0]?.named_tickets === true).catch(() => false)
    : Promise.resolve(false);
  // La ficha del negocio, por su dirección con nombre, y si es una entidad.
  const datosNeg = await datosDeNegocios([o.business_id]);
  const bHref = bizPath(lang, datosNeg.slugs.get(o.business_id) || o.business_id);
  const entidad = datosNeg.entidades.get(o.business_id) || null;
  if (entidad) o.entity_kind = entidad;
  // Exclusiva para favoritos o clientes: la web pública va siempre sin
  // sesión, así que aquí siempre llega bloqueada (sin título, beneficio ni
  // fotos). Se dice qué es, de quién y cómo conseguirla.
  if (o.locked) return lockedOfferPage(o, lang, path, bHref, rpQ);
  // La serie de la que forma parte («Seguir la serie»), si tiene. Sin la
  // función (o sin red), la ficha sale igual.
  const serie = await rpc('offer_series_info', { p_offer: id }).catch(() => null);

  const flash = o.kind === 'flash_offer';
  // «Antes de cerrar» (la bolsa sorpresa): su sello y «Quedan N bolsas».
  const antesDeCerrar = flash && o.style?.badge === 'before_closing';
  const soldOut = o.status === 'sold_out' || (o.seats_left != null && o.seats_left <= 0);
  // Un evento sin hora de fin sigue abierto hasta el cierre del local (o 6 h
  // si ese día no tiene horario): lo mismo que dura su código, la cuenta de la
  // base (`event_default_end`).
  const finAuto = !o.redeem_end_at && !o.event_end_at && o.event_at
    ? await rpc('event_default_end', { p_business: o.business_id, p_at: o.event_at, p_elsewhere: !!o.venue_address }).catch(() => null)
    : null;
  const fin = o.redeem_end_at || o.event_end_at || finAuto?.ends_at
    || (o.event_at ? new Date(new Date(o.event_at).getTime() + 6 * 3600e3).toISOString() : 0);
  const over = new Date(fin || 0) < new Date();
  const noEmpezada = flash && o.redeem_start_at && new Date(o.redeem_start_at) > new Date();
  const availability = soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock';
  const tag = benefit(o.discount, o.price_cents, o.currency, lang);
  const prior = priorPrice(o.discount, lang);
  // La vista previa de un enlace: la foto o, sin ella, la genérica de la
  // agenda pública (en la página, el fondo del color de su categoría).
  const cover = firstPhoto(o.images) || (o.images || []).find(esGenerica) || null;
  const pieces = (o.images || []).filter((u) => !esGenerica(u)).slice(0, 8);
  const arte = pieces.length ? '' : arteFicha(o);
  // En otro sitio (una sala, un parque), su nombre y su dirección, como la
  // app; si no, la del local.
  const where = o.venue_address
    ? [o.venue_name, o.venue_address].filter(Boolean).join(', ')
    : [o.business_address, o.business_city].filter(Boolean).join(', ');
  // Las horas, las del sitio: en Canarias, una menos que en la península.
  const tz = zonaDe(o);

  const S = en
    ? {
        when: 'When', redeem: 'Redemption window', where: 'Where', seats: 'Places left',
        terms: 'Conditions', about: 'About', biz: 'The business',
        open: 'Open in the app', report: 'Report this publication', reportShort: 'Report', why: 'Why am I seeing this?',
        whyText: 'Klendar doesn’t use your messages or data from other sites to decide what to show you. Paid featured publications come first and always carry the “Featured” label; after that comes the order you pick in “Sort by”. If you’ve picked your interests in “Your account”, those categories weigh more in that order, without hiding anything else.',
        whyWeather: 'With “Based on the weather” (on by default, in the sort menu), if it rains today where you’re looking, today’s indoor plans come first; if it’s nice out, terraces and outdoor plans. Weather data:',
        boosted: 'The business paid to feature this publication.', edit: 'Edit in the dashboard',
        code: 'Get the code', notYet: 'Not available yet', reserve: 'Reserve a place', wait: 'Join the waiting list', save: 'Save to Plans',
        going: "I'm going", invite: 'Invite a friend',
        byCode: 'Getting the code counts as going.', byReservation: 'Reserving a place counts as going.',
        later: 'Not sure yet? Save it to Plans.',
        note: 'From here or from the app, with the same account. The code is single-use and the business validates it on the spot.',
        noteNoCode: 'From here or from the app, with the same account.',
        noteEntity: 'From here or from the app, with the same account. The code is single-use and they validate it on the spot.',
        org: 'Who organises it',
        soldOut: 'Sold out', over: 'Ended', more: 'Everything from', hot: 'Trending',
        prior: 'Lowest price in the last 30 days', canary: 'Canary Islands time',
        boostedBadge: 'Featured', beforeClosing: 'Before closing', was: (p) => `was ${p}`,
        organised: (n) => `Organised by ${n}`,
        bags: (n) => (n === 1 ? '1 bag left' : `${n} bags left`),
        takenBy: (n) => (n === 1 ? '1 person has taken it' : `${n} people have taken it`),
        perUser: (n) => `Up to ${n} per person`,
        waitHint: "No commitment: we'll only notify you if someone lets their code expire.",
        waitCount: (n) => (n === 1 ? '1 person waiting' : `${n} people waiting`),
      }
    : {
        when: 'Cuándo', redeem: 'Se canjea', where: 'Dónde', seats: 'Plazas libres',
        terms: 'Condiciones', about: 'Descripción', biz: 'El negocio',
        open: 'Abrir en la app', report: 'Denunciar esta publicación', reportShort: 'Denunciar', why: '¿Por qué ves esto?',
        whyText: 'Klendar no usa tus mensajes ni datos de otras webs para decidir qué enseñarte. Lo destacado de pago sale primero y siempre con la etiqueta «Destacado»; después va el orden que eliges en «Ordenar por». Si has elegido tus gustos en «Tu cuenta», lo de esas categorías pesa más en ese orden, sin esconder lo demás.',
        whyWeather: 'Con «Según el tiempo» (encendido de serie, en el menú de orden), si hoy llueve donde miras, lo de hoy bajo techo va antes; si hace bueno, las terrazas y el aire libre. Datos del tiempo:',
        boosted: 'El negocio ha pagado por destacar esta publicación.', edit: 'Editar en el panel',
        code: 'Conseguir el código', notYet: 'Aún no disponible', reserve: 'Reservar plaza', wait: 'Apuntarme a la lista de espera', save: 'Guardar en Planes',
        going: 'Voy', invite: 'Invitar a un amigo',
        byCode: 'Conseguir el código ya cuenta como que vas.', byReservation: 'Reservar plaza ya cuenta como que vas.',
        later: 'Si aún no lo tienes claro, guárdalo en Planes.',
        note: 'Desde aquí o desde la app, con la misma cuenta. El código es de un solo uso y lo valida el negocio en el momento.',
        noteNoCode: 'Desde aquí o desde la app, con la misma cuenta.',
        noteEntity: 'Desde aquí o desde la app, con la misma cuenta. El código es de un solo uso y lo validan en el momento.',
        org: 'Quién lo organiza',
        soldOut: 'Agotado', over: 'Terminada', more: 'Todo lo de', hot: 'Tendencia',
        prior: 'Precio más bajo de los últimos 30 días', canary: 'hora de Canarias',
        boostedBadge: 'Destacado', beforeClosing: 'Antes de cerrar', was: (p) => `antes ${p}`,
        organised: (n) => `Organiza: ${n}`,
        bags: (n) => (n === 1 ? 'Queda 1 bolsa' : `Quedan ${n} bolsas`),
        takenBy: (n) => (n === 1 ? '1 persona ya lo ha cogido' : `${n} personas ya lo han cogido`),
        perUser: (n) => `Hasta ${n} por persona`,
        waitHint: 'Sin compromiso: solo te avisamos si alguien deja caducar su código.',
        waitCount: (n) => (n === 1 ? '1 persona esperando' : `${n} personas esperando`),
      };

  // Sin hora, el día entero (de 00:00 a 23:59, como llega la agenda
  // pública): solo los días, como la app.
  const diaEntero = !flash && o.event_at && o.event_end_at
    && /^0?0[:.]00$/.test(fmtTime(o.event_at, lang, tz)) && /^23[:.]59$/.test(fmtTime(o.event_end_at, lang, tz));
  // Si un rango cruza de año («28 dic – 3 ene»), cada fecha con su año: si
  // no, parecía que acababa antes de empezar (agenda pública, 2026-10-22).
  const anoDe = (iso) => (iso ? KZ.fmt(iso, tz, en ? 'en-GB' : 'es-ES', { year: 'numeric' }) : '');
  const finRango = flash ? o.redeem_end_at : o.event_end_at;
  const iniRango = flash ? o.redeem_start_at : o.event_at;
  const cruzaAno = !!(iniRango && finRango && anoDe(iniRango) !== anoDe(finRango));
  const conAno = (txt, iso) => (cruzaAno ? `${txt} ${anoDe(iso)}` : txt);
  const when = flash
    ? `${conAno(fmtLong(o.redeem_start_at, lang, tz), o.redeem_start_at)} – ${conAno(fmtEnd(o.redeem_start_at, o.redeem_end_at, lang, tz), o.redeem_end_at)}`
    : diaEntero
      ? conAno(fmtDay(o.event_at, lang, tz), o.event_at) + (sameDay(o.event_at, o.event_end_at, tz) ? '' : ` – ${conAno(fmtDay(o.event_end_at, lang, tz), o.event_end_at)}`)
      : conAno(fmtLong(o.event_at, lang, tz), o.event_at) + (o.event_end_at ? ` – ${conAno(fmtEnd(o.event_at, o.event_end_at, lang, tz), o.event_end_at)}` : '');

  // El beneficio sale en su píldora (coral), junto a cuándo: aquí, el estado.
  const badges = [
    over ? `<span class="badge off">${S.over}</span>` : '',
    !over && soldOut ? `<span class="badge off">${S.soldOut}</span>` : '',
    // Lo destacado de pago siempre con su etiqueta («¿Por qué ves esto?»).
    o.is_boosted ? `<span class="badge">${S.boostedBadge}</span>` : '',
    antesDeCerrar ? `<span class="badge">${S.beforeClosing}</span>` : '',
    o.is_trending ? `<span class="badge">${S.hot}</span>` : '',
    o.adults_only ? '<span class="badge">+18</span>' : '',
    deRrpp ? `<span class="badge">${en ? 'Promoter offer' : 'Oferta de RRPP'}</span>` : '',
    selloEntidad(entidad, lang),
  ].filter(Boolean).join('');
  const fuente = await fuenteP;
  const actua = await actuaP;
  const nominativa = await nominativaP;
  // Las marcas de la publicación (las mismas que la app).
  const M = KM.t(lang);
  const marcas = (await marcasP) || {};
  const sellosMarca = [
    marcas.charity ? `<span class="badge" title="${esc(M.charityHint)}">${esc(M.charity)}</span>` : '',
    marcas.solo ? `<span class="badge">${esc(M.solo)}</span>` : '',
  ].join('');
  const carnes = KM.carnes(marcas.card_requirements);
  const notaCarne = carnes.length
    ? `<p class="nota-marca"><b>${esc(carnes.map((c) => M.card[c]).join(' · '))}</b><span class="muted">${esc(M.cardChecked)}</span></p>` : '';
  const edadesTxt = KM.edadesTexto(marcas.kid_ages, lang);
  const escucha = KM.servicio(marcas.listen_url);
  // «Te apuntas a la lista de…» (siempre a la vista, junto al botón) y, en
  // una de RRPP, cuántas plazas quedan en su lista y hasta cuándo vale.
  const nombreRrpp = prom ? KR.nombreDe(prom, lang) : '';
  const rrppHtml = prom ? `${KR.aviso(nombreRrpp, prom.business_name || o.business_name, lang)}
      ${prom.in_offer ? KR.lineas(prom, nombreRrpp, lang).map((l) => `<p class="note">${esc(l)}</p>`).join('') : ''}` : '';

  // La misma jerarquía que la ficha de la app: la foto o el vídeo en grande;
  // el tipo, el título y el negocio; el precio o el descuento y cuándo; quién
  // va; el botón; y luego qué es, las condiciones y dónde.
  const precioTxt = tag || (o.price_cents != null ? money(o.price_cents, o.currency, lang) : '');
  const logo = o.business_logo && /^https:\/\//.test(o.business_logo)
    ? `<img src="${esc(o.business_logo)}" alt="" width="44" height="44" loading="lazy" decoding="async">`
    : `<span class="fn-ph" aria-hidden="true">${esc((o.business_name || '·').charAt(0).toUpperCase())}</span>`;
  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${esc(bHref)}">${esc(o.business_name)}</a></p>
  <div class="detail ficha${pieces.length || arte ? '' : ' sin-media'}" data-equipo-biz="${esc(o.business_id)}">
    ${arte || carrusel(pieces, { titulo: o.title, lang })}
    <div class="d-head">
      <div class="d-top"><div class="badges"><span class="badge">${esc(flash && o.style?.badge === 'daily_menu'
        ? `${en ? 'Daily menu' : 'Menú del día'}${{ lunch: en ? ' · Lunch' : ' · Comida', dinner: en ? ' · Dinner' : ' · Cena', both: en ? ' · Lunch and dinner' : ' · Comida y cena' }[o.style?.meal] || ''}`
        : flash ? (en ? 'Flash offer' : 'Oferta flash') : (en ? 'Event' : 'Evento'))}</span>${badges}${sellosMarca}</div>
      ${masMenu([
    !flash && o.event_at && !over ? `<a href="${esc(icsHref(o, o.venue_address || where, `${BASE}${path}`))}" download="${esc((o.title || 'evento').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 60))}.ics">${en ? 'Add to calendar' : 'Añadir al calendario'}</a>` : '',
    `<a href="#por-que">${S.why}</a>`,
    `<a class="mas-peligro" data-solo-publico href="${cuenta(lang)}#/denunciar/offer/${encodeURIComponent(o.id)}" rel="nofollow">${S.reportShort}</a>`,
  ], lang)}</div>
      <h1 data-tr="offer:${esc(o.id)}:title">${esc(o.title)}</h1>
      <p data-tr-nota="offer:" hidden></p>
      <a class="ficha-negocio" href="${esc(bHref)}"${Number.isFinite(o.lat) && Number.isFinite(o.lng) ? ` data-lat="${Number(o.lat).toFixed(5)}" data-lng="${Number(o.lng).toFixed(5)}"` : ''}>${logo}
        <span><b>${esc(o.venue_address ? S.organised(o.business_name) : o.business_name)}</b><span class="muted">${o.business_rating && o.business_ratings ? `<span class="stars-mini" aria-hidden="true">★</span> ${nota(o.business_rating, lang)} (${o.business_ratings})` : esc(o.business_city || '')}<span class="tj-dist" hidden></span></span></span>
        <svg class="ic" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg></a>
      ${actua.html}
      <p class="ficha-datos">
        ${precioTxt ? `<span class="precio-pill">${esc(precioTxt)}</span>` : ''}
        ${prior ? `<s class="muted">${esc(S.was(prior))}</s>` : ''}
        <span class="dato-chip${flash ? ' oferta' : ''}"><svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="${flash ? 'M7 2v11h3v9l7-12h-4l4-8z' : 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10Zm0-12H5V6h14v2Z'}"/></svg>${esc(cuandoCorto(o, lang, tz))}</span>
        ${o.seats_left != null && !soldOut && !over ? `<span class="dato-chip">${esc(antesDeCerrar ? S.bags(o.seats_left) : en ? (o.seats_left === 1 ? '1 place left' : `${o.seats_left} places left`) : (o.seats_left === 1 ? 'Queda 1 plaza' : `Quedan ${o.seats_left} plazas`))}</span>` : ''}
        ${Number(o.redemptions_count) >= 3 ? `<span class="dato-chip">${esc(S.takenBy(Number(o.redemptions_count)))}</span>` : ''}
        ${flash && Number(o.max_per_user) > 1 ? `<span class="dato-chip" id="por-persona" data-max="${Number(o.max_per_user)}">${esc(S.perUser(Number(o.max_per_user)))}</span>` : ''}
        ${o.style?.first_visit === true ? `<span class="dato-chip">${esc(en ? 'First visit' : 'Primera visita')}</span>` : ''}
      </p>
      ${o.style?.first_visit === true ? `<p class="rule">${esc(en ? `Only for people who have never redeemed anything at ${o.business_name || ''}.` : `Solo para quien no ha canjeado nunca nada en ${o.business_name || ''}.`)}</p>` : ''}
      ${prior ? `<p class="rule">${S.prior}</p>` : ''}
      ${notaCarne}
      ${listaSitio((await rasgosP).filter((t) => SITIO_PLAN.includes(t)), lang, { cls: 'sitio-linea' })}
      ${edadesTxt ? `<p class="note edades">${esc(M.kidAgesLine(edadesTxt))}</p>` : ''}
      ${over ? '' : '<p class="quien-va" id="quien-va" hidden></p>'}
    </div>
    <aside class="side">
      ${over ? '' : '<div class="invita" id="invita" hidden></div>'}
      <dl>
        <div><dt>${flash ? S.redeem : S.when}</dt><dd>${esc(when)}${tz === KZ.CANARIAS ? ` <small class="muted">(${S.canary})</small>` : ''}</dd>
          ${flash && !over && !soldOut && o.redeem_end_at ? `<dd id="cuenta" hidden style="color:var(--accent-text);font-weight:800" data-ini="${esc(o.redeem_start_at || '')}" data-fin="${esc(o.redeem_end_at)}"></dd>` : ''}</div>
        ${where ? `<div><dt>${S.where}</dt><dd>${esc(where)}</dd></div>` : ''}
        ${o.seats_left != null && !soldOut ? `<div><dt>${S.seats}</dt><dd>${o.seats_left}${o.holds_seats === false ? ` · ${en ? 'first come, first served' : 'por orden de llegada'}` : ''}</dd></div>` : ''}
      </dl>
      ${over ? '' : (() => {
        // Lo mismo que el botón grande de la app, pero sin salir de la web.
        const id = encodeURIComponent(o.id);
        // Un solo botón de acción. Con código o reserva, conseguirlo ya
        // cuenta como «vas» (no hay «Voy» aparte). Sin código: con entradas
        // fuera, conseguirlas manda y «Voy» queda discreto junto a «Invitar a
        // un amigo»; sin ellas, «Voy» es el botón principal.
        const conCodigo = flash || !!o.reservations_enabled;
        const entradas = !conCodigo && seguro(o.external_url);
        const voy = (clase) => `<a class="${clase}" id="voy" href="${cuenta(lang)}#/voy/${id}" rel="nofollow">${icono('voy', 16)} <span>${S.going}</span></a>`;
        // Fuera del horario de su lista, la oferta de RRPP no se puede
        // conseguir: «Esta lista abre…» y el botón apagado, como la app.
        const listaCerrada = prom && prom.closed && prom.counts;
        const apagado = (txt) => `<span class="pill accent big" aria-disabled="true" style="opacity:.55">${txt}</span>`;
        // `data-principal`: si ya tienes el código vivo, /assets/amigos.js lo
        // cambia por «Ver mi código»; en la lista de espera, por «Salir…».
        // La lista de espera, solo en lo que tiene código o reserva (un
        // evento sin código, agotado, sigue con sus entradas o «Voy»).
        const principal = soldOut && conCodigo ? `<a class="pill accent big" data-principal="espera" href="${cuenta(lang)}#/espera/${id}">${S.wait}</a>
          <p class="note" id="espera-nota" data-n="${Number(o.waitlist_count) || 0}">${esc(Number(o.waitlist_count) > 0 ? S.waitCount(Number(o.waitlist_count)) : S.waitHint)}</p>`
          : noEmpezada ? apagado(S.notYet)
          : listaCerrada && conCodigo ? apagado(flash ? S.code : S.reserve)
          // Si deja coger varias plazas, «¿Para cuántos?» antes (`#/reservar`,
          // que con una sola va directa al código), como la app.
          : flash ? `<a class="pill accent big" data-principal="codigo" href="${cuenta(lang)}#/${(o.max_seats || 1) > 1 ? 'reservar' : 'codigo'}/${id}${rpQ}">${S.code}</a>`
            : o.reservations_enabled ? `<a class="pill accent big" data-principal="codigo" href="${cuenta(lang)}#/reservar/${id}${rpQ}">${S.reserve}</a>`
              : entradas ? (() => {
                // Como la app: «Entradas en DICE» si es una plataforma conocida;
                // si no, «Conseguir entradas» con el dominio debajo.
                const pl = plataformaEntradas(o.external_url);
                const txt = pl?.plataforma ? (en ? `Tickets on ${pl.plataforma}` : `Entradas en ${pl.plataforma}`) : (en ? 'Get tickets' : 'Conseguir entradas');
                const sub = !pl?.plataforma && pl?.dominio ? `<small style="display:block;font-weight:500;opacity:.8">${esc(pl.dominio)}</small>` : '';
                return `<a class="pill accent big" href="${esc(entradas)}" rel="nofollow noopener" target="_blank" aria-label="${esc(txt)}${en ? ' (opens outside Klendar)' : ' (se abre fuera de Klendar)'}">${esc(txt)}${sub}</a>`;
              })()
                : voy('pill accent big');
        // «Voy» e «Invitar a un amigo»: la página va en caché y no sabe quién
        // la mira; si ya vas, lo pinta el navegador (/assets/amigos.js).
        // Una de RRPP solo se abre con el enlace: ni invitar a un amigo, ni
        // guardarla en Planes (luego no se abriría), ni compartirla.
        const cerradaHtml = listaCerrada
          ? `<p class="note"><b>${esc(KR.abre(prom.opens_at, lang, tz))}</b> ${esc(KR.T[en ? 'en' : 'es'].closedBody)}</p>` : '';
        const nominativaHtml = nominativa ? `<p class="note">${esc(en
          ? "Named ticket: only for the person who books. It can't be passed on to anyone else."
          : 'Entrada nominativa: solo para quien reserva. No se puede pasar a otra persona.')}</p>` : '';
        return `${rrppHtml}${cerradaHtml}${principal}${nominativaHtml}
          <p class="acciones amigos-acc" id="amigos-ficha" data-offer="${esc(o.id)}"${conCodigo ? ` data-codigo="${flash ? 'codigo' : 'reservar'}"` : ''}>
            ${entradas ? voy('pill') : ''}
            ${deRrpp ? '' : `<a class="pill" href="${cuenta(lang)}#/invitar/${id}" rel="nofollow">${icono('invitar', 16)} ${S.invite}</a>`}</p>
          <p class="note" id="voy-auto" hidden></p>
          ${conCodigo ? `<p class="note" id="voy-pista">${flash ? S.byCode : S.byReservation}${deRrpp ? '' : ` ${S.later}`}</p>` : ''}
          <p class="acciones"><a class="pill" data-solo-equipo hidden href="/panel/#/publicaciones/${id}?biz=${encodeURIComponent(o.business_id)}">${icono('editar', 16)} ${S.edit}</a>
            ${deRrpp ? '' : `<a class="pill" data-solo-publico data-plan="${id}" href="${cuenta(lang)}#/guardar/${id}"><svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg> <span>${S.save}</span></a>`}
            ${openInApp(path + rpQ, S.open, 'pill ghost')}</p>
          ${deRrpp && !prom ? '' : `<p class="acciones">${compartirBoton(lang, `${BASE}${path}${rpQ}`, o.title)}${historiaBoton(lang, 'o', o.id, rpQ)}</p>`}`;
      })()}
      ${serieFicha(serie, o.id, lang)}
      <p class="note">${!(flash || o.reservations_enabled) ? S.noteNoCode : entidad ? S.noteEntity : S.note}</p>
    </aside>
    <div class="d-body">
      ${o.description ? `<h2>${S.about}</h2><p data-tr="offer:${esc(o.id)}:description">${esc(o.description).replace(/\n/g, '<br>')}</p>` : ''}
      ${escucha ? `<h2>${esc(M.listenTitle)}</h2>
      <p class="acciones"><a class="pill escucha" href="${esc(marcas.listen_url)}" rel="nofollow noopener" target="_blank" aria-label="${esc(`${M.listenOn(escucha.nombre)} (${M.opensOutside})`)}">${KM.icono(escucha, 18)} <span>${esc(M.listenOn(escucha.nombre))}</span></a></p>` : ''}
      ${o.terms ? `<h2>${S.terms}</h2><p class="muted" data-tr="offer:${esc(o.id)}:terms">${esc(o.terms).replace(/\n/g, '<br>')}</p>` : ''}
      ${where ? `<h2>${S.where}</h2>
      <p class="info-linea">${icono('lugar')}<span>${o.lat ? `<a href="${esc(`https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}`)}" rel="nofollow noopener" target="_blank">${esc(where)}</a>` : esc(where)}</span></p>
      ${toquesContacto({ phone: o.business_phone, email: o.business_email, website: o.business_website, social: o.business_social }, lang, { lat: o.lat, lng: o.lng })}` : ''}
      ${fuenteHtml(fuente, lang)}
      <h2>${entidad ? S.org : S.biz}</h2>
      <p>${esc(o.business_name)}${o.business_rating && o.business_ratings ? ` · ★ ${nota(o.business_rating, lang)} (${o.business_ratings})` : ''}</p>
      <p><a href="${esc(bHref)}">${S.more} ${esc(o.business_name)} →</a></p>
      <details class="por-que" id="por-que"><summary>${S.why}</summary>
        <p class="muted">${o.is_boosted ? `${S.boosted} ` : ''}${S.whyText}</p>
        <p class="muted">${S.whyWeather} <a href="${FUENTE_TIEMPO.url}" rel="noopener" target="_blank">${FUENTE_TIEMPO.nombre}</a></p></details>
    </div>
  </div>`;

  const description = [tag, flash ? when : fmtLong(o.event_at, lang, tz), o.business_name, o.business_city]
    .filter(Boolean).join(' · ').slice(0, 200);

  const jsonLd = flash
    ? {
        '@context': 'https://schema.org', '@type': 'Offer', name: o.title, description: o.description || undefined,
        url: `${BASE}${path}`, image: cover || undefined, validFrom: o.redeem_start_at, validThrough: o.redeem_end_at,
        offeredBy: { '@type': 'LocalBusiness', name: o.business_name, url: `${BASE}${bHref}`, address: where || undefined },
        price: o.price_cents != null ? (o.price_cents / 100).toFixed(2) : undefined,
        priceCurrency: o.price_cents != null ? (o.currency || 'EUR') : undefined,
        availability,
      }
    : {
        '@context': 'https://schema.org', '@type': 'Event', name: o.title, description: o.description || undefined,
        url: `${BASE}${path}`, image: cover || undefined, startDate: o.event_at, endDate: o.event_end_at || undefined,
        eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: o.venue_name || o.business_name, url: `${BASE}${bHref}`, address: where || undefined },
        organizer: { '@type': 'Organization', name: o.business_name, url: `${BASE}${bHref}` },
        performer: performersLd(actua.lista, lang),
        offers: o.reservations_enabled
          ? {
              '@type': 'Offer', url: `${BASE}${path}`, availability,
              price: o.price_cents != null ? (o.price_cents / 100).toFixed(2) : '0',
              priceCurrency: o.currency || 'EUR',
            }
          : undefined,
      };

  // La vista cuenta para el negocio (panel e informe), como en la app. Solo
  // desde un navegador de verdad y una vez por sesión: los robots de Google o
  // de WhatsApp no ejecutan esto.
  // La cuenta atrás, como en la app («Quedan 1 h 31 min»). Se calcula en el
  // navegador: la página va en caché y una hora escrita aquí saldría vieja.
  const cuentaAtras = `<script>(function(){var el=document.getElementById('cuenta');if(!el)return;
var ini=Date.parse(el.dataset.ini)||0,fin=Date.parse(el.dataset.fin);
function dur(ms){var m=Math.floor(ms/60000);if(m>=1440)return Math.floor(m/1440)+' d';if(m>=60)return Math.floor(m/60)+' h'+(m%60?' '+(m%60)+' min':'');return Math.max(1,m)+' min';}
function tic(){var n=Date.now();if(n>=fin){el.textContent=${JSON.stringify(S.over)};return;}
el.textContent=n<ini?${JSON.stringify(en ? 'Starts in ' : 'Empieza en ')}+dur(ini-n):${en ? "dur(fin-n)+' left'" : "'Quedan '+dur(fin-n)"};el.hidden=false;setTimeout(tic,30000);}tic();})();</script>`;
  const sp = supabasePublic();
  // Cuenta la visita para las estadísticas del negocio. Sin guardar nada en el
  // navegador (ni cookies ni sessionStorage): la base ya no cuenta dos veces a
  // la misma persona en 30 minutos (`offer_views_dedupe`).
  const vista = `<script>(function(){try{if(navigator.webdriver)return;fetch(${JSON.stringify(sp.url + '/rest/v1/offer_views')},{method:'POST',keepalive:true,headers:{apikey:${JSON.stringify(sp.key)},Authorization:'Bearer '+${JSON.stringify(sp.key)},'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({offer_id:'${o.id}'})});}catch(e){}})();</script>`;

  if (privada) {
    const res = html(publicPage({
      lang, path, image: cover, body: body + cuentaAtras + vista + MENU_JS + COMPARTIR_JS,
      title: `${o.title} · ${o.business_name}`,
      description, privada: true, consulta: rpQ, contador: false,
      head: `${traducir(lang, `offer:${o.id}`)}${actua.html ? `
${ARTISTAS_CSS}` : ''}
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">`,
    }), 200, 'private, no-store');
    res.headers.set('x-robots-tag', 'noindex, nofollow');
    return res;
  }
  return html(publicPage({
    lang, path, image: cover, body: body + cuentaAtras + vista + MENU_JS + COMPARTIR_JS,
    title: `${o.title} · ${o.business_name}`,
    description,
    head: `${traducir(lang, `offer:${o.id}`)}${actua.html ? `
${ARTISTAS_CSS}` : ''}
<meta name="robots" content="${o.adults_only || fuente ? 'noindex' : 'index, follow'}">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  }));
}

/** Días de una regla (0 = domingo), lunes primero: «jueves», «lunes, miércoles». */
function diasSerie(dias, en) {
  const s = new Set(dias || []);
  if (s.size === 7) return en ? 'every day' : 'todos los días';
  if (s.size === 5 && [1, 2, 3, 4, 5].every((d) => s.has(d))) return en ? 'Monday to Friday' : 'de lunes a viernes';
  if (s.size === 2 && s.has(0) && s.has(6)) return en ? 'weekends' : 'los fines de semana';
  const fmt = new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', { weekday: 'long', timeZone: 'UTC' });
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => s.has(d)).map((d) => fmt.format(Date.UTC(2024, 0, 7 + d))).join(', ');
}

/**
 * «Forma parte de una serie»: el nombre, cuándo se repite (si sale de una
 * regla), cuántas fechas más hay y «Seguir la serie», que lleva a «Tu
 * cuenta» (la página va en caché y no sabe quién mira: allí se ve si ya la
 * sigues y lo de «Añadir cada fecha a mis planes»). Como la app.
 */
function serieFicha(s, offerId, lang) {
  if (!s || !s.series_id || !s.name) return '';
  const en = lang === 'en';
  const n = Number(s.upcoming) || 0;
  const detalle = [
    s.weekdays?.length && s.start_time && s.rule_active !== false
      ? (en ? `Repeats: ${diasSerie(s.weekdays, en)} at ${s.start_time}` : `Se repite: ${diasSerie(s.weekdays, en)} a las ${s.start_time}`)
      : '',
    en ? (n === 0 ? 'No more dates posted yet' : n === 1 ? '1 more date posted' : `${n} more dates posted`)
      : (n === 0 ? 'Por ahora no hay más fechas publicadas' : n === 1 ? '1 fecha más publicada' : `${n} fechas más publicadas`),
  ].filter(Boolean).join(' · ');
  return `<div class="serie-ficha">
        <p class="info-linea">${icono('serie')}<span><small class="muted">${en ? 'Part of a series' : 'Forma parte de una serie'}</small><br><b>${esc(s.name)}</b><br><small class="muted">${esc(detalle)}</small></span></p>
        <p class="acciones"><a class="pill" href="${cuenta(lang)}#/serie/${encodeURIComponent(offerId)}" rel="nofollow">${en ? 'Follow the series' : 'Seguir la serie'}</a></p>
        <p class="note">${en ? "We'll let you know when the next date is posted." : 'Te avisamos cuando se publique la siguiente fecha.'}</p>
      </div>`;
}

/**
 * La ficha de una exclusiva que quien mira no puede ver: el tipo y cuándo,
 * de qué negocio y cómo conseguirla (favoritos → añadir a favoritos desde
 * «Tu cuenta»; clientes → la ficha del negocio). Sin beneficio, sin fotos de
 * la oferta, sin JSON-LD y fuera de Google: no hay nada que indexar.
 */
function lockedOfferPage(o, lang, path, bHref, rpQ = '') {
  const en = lang === 'en';
  const fav = o.audience !== 'customers';
  const n = o.business_name || '';
  const tz = zonaDe(o);
  const flash = o.kind === 'flash_offer';
  const S = en
    ? {
        page: `Exclusive publication · ${n}`,
        kind: flash ? 'Flash offer' : 'Event', redeem: 'Redemption window', when: 'When',
        title: fav ? `Exclusive for people who have ${n} in their favourites` : `Exclusive for ${n}'s customers`,
        text: fav ? `Add ${n} to your favourites to see it and get it.`
          : "It's for people with stamps on one of their cards. Get your first one by redeeming one of their offers or with the venue QR code.",
        btn: fav ? 'Add to favourites' : 'See the business',
        note: fav ? "If it's already in your favourites, open it in the app or log in."
          : 'If you already have stamps, open it in the app or log in.',
        open: 'Open in the app', code: 'Get the code', reserve: 'Reserve a place', canary: 'Canary Islands time',
      }
    : {
        page: `Publicación exclusiva · ${n}`,
        kind: flash ? 'Oferta flash' : 'Evento', redeem: 'Se canjea', when: 'Cuándo',
        title: fav ? `Exclusiva para quien tiene ${n} en favoritos` : `Exclusiva para clientes de ${n}`,
        text: fav ? `Añade ${n} a favoritos para verla y conseguirla.`
          : 'Es para quien tiene sellos en alguna de sus tarjetas. Consigue el primero canjeando una de sus ofertas o con el QR del local.',
        btn: fav ? 'Añadir a favoritos' : 'Ver el negocio',
        note: fav ? 'Si ya lo tienes en favoritos, ábrela en la app o entra con tu cuenta.'
          : 'Si ya tienes sellos, ábrela en la app o entra con tu cuenta.',
        open: 'Abrir en la app', code: 'Conseguir el código', reserve: 'Reservar plaza', canary: 'hora de Canarias',
      };
  const when = flash
    ? `${fmtLong(o.redeem_start_at, lang, tz)} – ${fmtEnd(o.redeem_start_at, o.redeem_end_at, lang, tz)}`
    : fmtLong(o.event_at, lang, tz) + (o.event_end_at ? ` – ${fmtEnd(o.event_at, o.event_end_at, lang, tz)}` : '');
  const where = [o.business_address, o.business_city].filter(Boolean).join(', ');
  // «…o entra con tu cuenta»: el mismo botón que una ficha normal, en
  // «Tu cuenta». Pide entrar si hace falta y allí la base ya sabe quién mira:
  // a quien le toca le da el código; a quien no, le dice por qué.
  const accion = flash ? [`#/${(o.max_seats || 1) > 1 ? 'reservar' : 'codigo'}/${encodeURIComponent(o.id)}${rpQ}`, S.code]
    : o.reservations_enabled ? [`#/reservar/${encodeURIComponent(o.id)}${rpQ}`, S.reserve] : null;
  const boton = fav
    ? `<a class="pill accent big" href="${cuenta(lang)}#/seguir/${encodeURIComponent(o.business_id)}"><svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.2 0 3.6 1.2 5.2 3 1.6-1.8 3-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z"/></svg> ${esc(S.btn)}</a>`
    : `<a class="pill accent big" href="${esc(bHref)}">${icono('negocio', 16)} ${esc(S.btn)}</a>`;
  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${esc(bHref)}">${esc(n)}</a></p>
  <div class="detail ficha${o.business_cover ? '' : ' sin-media'}">
    ${o.business_cover ? carrusel([o.business_cover], { titulo: n, forma: 'negocio', lang }) : ''}
    <div class="d-head">
      <div class="badges"><span class="badge">${esc(S.kind)}</span>${o.adults_only ? '<span class="badge">+18</span>' : ''}</div>
      <h1>${esc(S.title)}</h1>
      <p class="muted">${esc(n)}${where ? ` · ${esc(where)}` : ''}</p>
      <p>${esc(S.text)}</p>
    </div>
    <aside class="side">
      <dl>
        <div><dt>${flash ? S.redeem : S.when}</dt><dd>${esc(when)}${tz === KZ.CANARIAS ? ` <small class="muted">(${S.canary})</small>` : ''}</dd></div>
      </dl>
      ${boton}
      <p class="acciones">${accion ? `<a class="pill" href="${cuenta(lang)}${accion[0]}" rel="nofollow">${esc(accion[1])}</a>` : ''}
        ${openInApp(path, S.open, 'pill ghost')}</p>
      <p class="note">${esc(S.note)}</p>
    </aside>
  </div>`;
  // Con el enlace de un RRPP: como las demás abiertas con él, privada.
  const res = html(publicPage({
    lang, path, body, image: o.business_cover || o.business_logo,
    title: S.page, description: `${S.title}. ${S.text}`.slice(0, 200),
    head: '<meta name="robots" content="noindex">',
    ...(rpQ ? { privada: true, consulta: rpQ, contador: false } : {}),
  }), 200, rpQ ? 'private, no-store' : undefined);
  if (rpQ) res.headers.set('x-robots-tag', 'noindex, nofollow');
  return res;
}

// ── Negocio ────────────────────────────────────────────────────────────────
/** Redirección permanente dentro de la web (relativa: vale igual en local). */
const movida = (to) => new Response(null, {
  status: 301, headers: { location: to, 'cache-control': 'public, max-age=3600, s-maxage=3600' },
});

/** Qué da sello en una tarjeta: las mismas palabras que la app y «Tu cuenta». */
function queSellaFicha(c, S, en) {
  if (c.applies_to === 'flash_offer') return S.stampsFlash;
  if (c.applies_to === 'future_event') return S.stampsEvents;
  if (c.applies_to === 'categories' || c.applies_to === 'offers') {
    const nombres = c.applies_to === 'categories'
      ? (c.category_names || []).map((n) => (en ? n.en : n.es) || n.es || '').filter(Boolean)
      : (c.offer_titles || []);
    if (!nombres.length) return c.applies_to === 'categories' ? S.stampsSomeCats : S.stampsSomeOffers;
    const lista = nombres.slice(0, 3).join(', ');
    return S.stampsOnly(nombres.length > 3 ? S.stampsMore(lista, nombres.length - 3) : lista);
  }
  return S.stampsAll;
}
/** Las fotos y vídeos de una reseña (`media`, hasta 6, en su orden;
 * klendar/docs/RESENAS_MEDIOS.md): miniaturas que abren el visor (con
 * carrusel y sonido), como en la app. Lo que está en revisión no sale (la
 * ficha va sin sesión). Sin `media` (antes de 20261104100000), la foto única. */
function resenaMedios(r, lang) {
  const urls = Array.isArray(r.media)
    ? r.media.filter((m) => m && !m.in_review).map((m) => ({
        url: m.url, kind: m.kind, poster_url: m.poster_url, duration_ms: m.duration_ms,
        // En el visor, «Denunciar» esa foto o ese vídeo solo.
        denuncia: isUuid(m.id) ? `${cuenta(lang)}#/denunciar/review_media/${m.id}` : null,
      }))
    : (r.photo_url ? [r.photo_url] : []);
  return miniaturas(urls, { grupo: `resena-${r.id}`, lang, clase: 'miniaturas resena-medios' });
}

/** Lo de arriba y, si la tarjeta también sella por visita, dicho. */
// Los catorce alérgenos, con la clave que guarda la carta y su nombre en cada
// idioma (los mismos que el panel y la app); una clave desconocida sale tal cual.
const ALERGENOS = {
  gluten: ['Gluten', 'Gluten'], crustaceos: ['Crustáceos', 'Crustaceans'], huevos: ['Huevos', 'Eggs'],
  pescado: ['Pescado', 'Fish'], cacahuetes: ['Cacahuetes', 'Peanuts'], soja: ['Soja', 'Soy'],
  lacteos: ['Lácteos', 'Milk'], frutos_cascara: ['Frutos de cáscara', 'Tree nuts'], apio: ['Apio', 'Celery'],
  mostaza: ['Mostaza', 'Mustard'], sesamo: ['Sésamo', 'Sesame'], sulfitos: ['Sulfitos', 'Sulphites'],
  altramuces: ['Altramuces', 'Lupin'], moluscos: ['Moluscos', 'Molluscs'],
};
const nombreAlergeno = (k, en) => (ALERGENOS[k] ? ALERGENOS[k][en ? 1 : 0] : String(k).replace(/_/g, ' '));
const queSellaTarjeta = (c, S, en) => (c.by_visit ? `${queSellaFicha(c, S, en)} · ${S.stampsByVisit}` : queSellaFicha(c, S, en));

/**
 * La ficha de un negocio: `/b/cafe-central-madrid`.
 *
 * `/b/<id>` (los enlaces de antes, los QR impresos, la app) lleva a la de la
 * dirección con nombre con un 301, y una dirección vieja (el negocio cambió
 * de nombre) a la actual: una sola URL por negocio para Google.
 */
/** Publicaciones por página de la ficha (`?p=`) y filas por página de sus
 * listas enteras (`?ver=novedades|resenas`). */
const POR_PAGINA_FICHA = 24;
const POR_PAGINA_LISTA = 24;

/** «Preguntas» de la ficha (`/b/` y `?ver=preguntas`). */
const PREGUNTAS_CSS = `<style>
.preguntas{display:grid;gap:12px;margin:8px 0 12px}
.pregunta{border:1px solid var(--line,rgba(127,127,127,.25));border-radius:18px;padding:14px}
.pregunta-t{display:flex;gap:8px;align-items:flex-start;margin:0}
.pregunta-t .ic{flex:none;margin-top:2px;opacity:.7}
.pregunta-t span{display:grid;gap:2px}
.pregunta .respuesta{margin-top:10px}
.pregunta-pie{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin:10px 0 0}
.pregunta-pie .sirve[aria-pressed="true"]{font-weight:700}
.pregunta-estado{display:inline-block;margin:4px 0 0}
</style>`;

export async function businessPage(param, lang, search = '') {
  const en = lang === 'en';
  const raw = String(param || '');
  let id = raw;
  let slug = null;
  if (isUuid(raw)) {
    slug = await slugDe(raw);
    if (slug) return movida(bizPath(lang, slug) + search);
  } else {
    const limpio = raw.toLowerCase();
    if (!isSlug(limpio)) return notFound(lang, bizPath(lang, raw), 'b');
    const r = await rpc('resolve_business_slug', { p_slug: limpio });
    if (!r?.id) return (await cerradoPage(lang, limpio, bizPath(lang, limpio))) || notFound(lang, bizPath(lang, limpio), 'b');
    if (r.slug !== raw) return movida(bizPath(lang, r.slug) + search);
    id = r.id;
    slug = r.slug;
  }
  const path = bizPath(lang, slug || id);
  if (!isUuid(id)) return notFound(lang, path, 'b');
  const b = await rpc('business_profile', { p_id: id });
  if (!b || !b.name) return (await cerradoPage(lang, id, path)) || notFound(lang, path, 'b');
  // «Clientes verificados»: solo las reseñas de quien ha canjeado algo aquí
  // (`?resenas=verificadas`, el mismo filtro que la app).
  const soloVerificadas = new URLSearchParams(search).get('resenas') === 'verificadas';
  // Por partes (docs/RUNBOOK.md §3g): las publicaciones de POR_PAGINA_FICHA en
  // POR_PAGINA_FICHA con `?p=` (como Explorar), y «Ver todas (N)» de las
  // novedades y las reseñas abre su lista entera, también por páginas
  // (`?ver=novedades`, `?ver=resenas`). Antes salían hasta 200 tarjetas de
  // golpe (la agenda pública de Madrid pesaba ~500 KB).
  const qs = new URLSearchParams(search);
  const ver = ['novedades', 'resenas', 'preguntas', 'carta'].includes(qs.get('ver')) ? qs.get('ver') : '';
  const pagina = Math.max(1, Math.min(100, parseInt(qs.get('p') || '1', 10) || 1));
  const desde = (pagina - 1) * (ver ? POR_PAGINA_LISTA : POR_PAGINA_FICHA);
  const [offers, cuentas, sellos, carta, opiniones, novedades, cierres, nVerificadas, local, partidosBar, grupoInfo, sorteos, organizador, enlacesNeg, fichaInfo, preguntasRes, preguntasLista] = await Promise.all([
    ver ? [] : rpcAll('business_offers_page', { p_id: id, p_limit: POR_PAGINA_FICHA, p_offset: desde }),
    ver ? null : rpc('business_offer_counts', { p_id: id }).catch(() => null),
    rpcAll('stamp_cards_of', { p_business: id }).catch(() => []), // opcional: sin ella, la ficha sale igual
    rpcAll('business_menu', { p_business: id }),
    ver === 'novedades' || ver === 'preguntas' || ver === 'carta' ? []
      : rpcAll('business_reviews', { p_id: id, p_limit: ver ? POR_PAGINA_LISTA : 3, p_offset: ver ? desde : 0, ...(soloVerificadas ? { p_verified_only: true } : {}) }),
    ver === 'resenas' || ver === 'preguntas' || ver === 'carta' ? []
      : rows('business_posts', `select=id,body,image_url,created_at&business_id=eq.${id}&order=created_at.desc,id.desc&limit=${ver ? POR_PAGINA_LISTA : 3}&offset=${ver ? desde : 0}`),
    rpcAll('business_closures', { p_business: id }),
    rpc('business_verified_review_count', { p_id: id }).then((n) => Number(n) || 0).catch(() => 0),
    // «El sitio»: lo que marca el negocio (terraza, apto para niños…).
    rows('businesses', `select=amenities,price_level,crowd_enabled,entity_kind,kitchen_hours&id=eq.${id}`).then((r) => r[0] || {}).catch(() => ({})),
    // «Pone el partido»: lo que pone los próximos 7 días (opcional).
    partidosDelBar(id, lang, zonaDe(b)).catch(() => ''),
    // «Acepta grupos» y sus sorteos abiertos (tanda C; opcionales).
    rpc('business_group_info', { p_business: id }).catch(() => null),
    // Con los sorteos apagados (app_config.giveaways), ni se piden.
    sorteosEncendidos().then((on) => (on ? rpcAll('business_public_giveaways', { p_business: id }) : [])).catch(() => []),
    // Organizador sin local fijo (fiestas, promotoras): su punto es la zona
    // donde organiza, no un sitio al que ir. Sin la función, como siempre.
    rpc('business_is_organizer', { p_business: id }).then((x) => x === true).catch(() => false),
    // «Reservar», «Pedir…» y los archivos de la carta (fotos y PDF; migración
    // 20261210100000). Opcional: sin ella, las fotos de `menu_images`.
    rpc('business_links', { p_id: id }).catch(() => null),
    // «Qué pedir aquí», momentos del día, días con otro horario y el
    // festivo de esta semana (migraciones 20261233100000–02). Opcional.
    rpc('business_ficha_info', { p_business: id }).catch(() => null),
    // «Pregúntale al local» (migración 20261237100000): las 3 contestadas más
    // útiles, cuántas hay y si el negocio recibe preguntas. Opcional.
    rpc('business_questions_summary', { p_business: id }).catch(() => null),
    ver === 'preguntas'
      ? rpcAll('business_questions_page', { p_business: id, p_limit: POR_PAGINA_LISTA, p_offset: desde }).catch(() => [])
      : [],
  ]);
  // Bloqueado (sin pagar) o en pausa por cierre (`unavailable`, migración
  // 20261222100000): la ficha lo dice («No disponible ahora mismo» o
  // «Cerrado temporalmente hasta el día X») y no enseña publicaciones,
  // partidos, sorteos, grupos ni novedades. Va con `noindex`. Como la app.
  const parado = b.unavailable === 'blocked' || b.unavailable === 'paused';
  // Cerrado hasta nuevo aviso (sin estar parado por el cobro): ni el horario
  // de siempre, ni «Abierto ahora», ni «Estaba cerrado», ni «¿Hay sitio
  // ahora?»; solo «Cerrado hasta nuevo aviso» (Iván, 2026-10-22).
  const sinFecha = Boolean(b.closed_indefinitely) && !parado;
  if (parado) { offers.length = 0; novedades.length = 0; sorteos.length = 0; }
  const partidos = parado ? '' : partidosBar;
  const grupoHtml = parado ? '' : grupoEnFicha(grupoInfo, id, lang);
  const sorteosHtml = sorteosEnFicha(sorteos, lang);
  // «El sitio», el rango de precio («€€») y si dice «¿Hay sitio ahora?».
  const sitio = Array.isArray(local.amenities) ? local.amenities : [];
  // «¿Hay sitio ahora?» y «Avísame cuando haya sitio»: con local fijo y sin
  // estar parado (bloqueado o en pausa), como la app (revisión 2026-10-21).
  const crowdOn = Boolean(local.crowd_enabled) && !organizador && !parado && !sinFecha;
  const precio = KM.simbolo(Number(local.price_level));
  const precioHtml = precio ? `<span class="precio-local" aria-label="${esc(KM.t(lang).priceA11y + KM.significado(Number(local.price_level), lang))}">${precio}</span>` : '';

  const S = en
    ? {
        now: 'Offers', soon: 'Events',
        none: 'Nothing published right now. It changes often — take a look in the app.',
        open: 'Add to favourites', note: "From here or from the app, with the same account. We'll let you know when this business posts something.",
        verified: 'Verified by Klendar', since: 'On Klendar since', redeemed: (n) => (n === 1 ? '1 redemption so far' : `${n} redemptions so far`),
        noRatings: 'No ratings yet',
        about: 'About', menu: 'Menu', place: 'The place',
        stamps: 'Stamp card', allergens: 'Allergens',
        menuNote: 'Allergens are the ones the business declares. If you have an allergy, ask at the venue.',
        stampsMany: 'Stamp cards',
        stampsBody: (n, r) => `${n} stamps: “${r}”`,
        stampsNote: 'Each redemption that counts earns a stamp (at most one a day per card), and the app keeps count.',
        stampsAll: 'Every publication counts', stampsFlash: 'Only flash offers count', stampsEvents: 'Only events count',
        stampsSomeCats: 'Only some categories count', stampsSomeOffers: 'Only some publications count',
        stampsOnly: (l) => `Only these count: ${l}`, stampsMore: (l, n) => `${l} and ${n} more`,
        stampsByVisit: 'Also per visit with the venue QR code',
        stampsNoteVisit: 'Each redemption that counts earns a stamp, and so does scanning the venue QR code when the card says so: at most one a day per card. The app keeps count.',
        hours: 'Opening hours', kitchen: 'Kitchen', closed: 'Closed', today: 'today',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        news: 'News', reviews: 'Reviews', write: 'Write a review', noReviews: 'No reviews yet. Been here? Be the first.',
        user: 'Klendar user', report: 'Report', reportShort: 'Report', editBiz: 'Edit page', myBiz: 'Go to the dashboard', block: 'Block', reportBiz: 'Report this business', menuPhotos: 'Photos of the menu',
        verifiedCustomer: 'Verified customer',
        verifiedWhat: "They've redeemed something at this business with Klendar: an offer, an event, a stamp reward, a birthday gift or something the business gave them with “Give on the spot”. We check it against what the business itself validated or gave at the venue.",
        howReviews: 'How reviews work', allReviews: 'All',
        verifiedReviews: (n) => `Verified customers (${n})`, noVerified: 'No reviews from verified customers yet.',
        claim: 'Is this your business?', contact: 'Contact',
        replyFrom: (n) => `Reply from ${n}`,
        closedToday: 'Closed today', closedUntil: (d) => `Closed until ${d}`,
        closedTemp: 'Temporarily closed', closedIndef: 'Closed until further notice', closedTempBody: "This business has closed for a while and isn't posting anything right now.",
        closedTempUntil: (d) => `Temporarily closed until ${d}`,
        unavailable: 'Not available right now', unavailableBody: "This business isn't posting anything right now.",
        keptCodes: 'If you have one of its codes or passes, it is still valid.',
        closingDay: (d) => `Closing on ${d}`, closing: (a, b) => `Closing from ${a} to ${b}`,
        moreIn: (c) => `More in ${c}:`, cityToday: 'things to do today', cityWeek: 'this week',
        hiddenFav: (n) => (n === 1 ? "There's 1 exclusive publication for people who have it in their favourites."
          : `There are ${n} exclusive publications for people who have it in their favourites.`),
        hiddenCust: (n) => (n === 1 ? "There's 1 exclusive publication for their customers with stamps."
          : `There are ${n} exclusive publications for their customers with stamps.`),
        birthday: 'Birthday gift for people who have it in their favourites',
        matches: 'Matches',
        highlights: 'What to order here',
        holidayOpens: (d, h) => `Open on the ${d} holiday (${h})`, holidayClosed: (d) => `Closed on the ${d} holiday`,
        holidayUnknown: (d) => `${d} holiday: hours not confirmed`,
        questions: 'Questions', ask: 'Ask a question', reportQuestion: 'Report the question', reportAnswer: 'Report the reply',
        noQuestions: 'No questions yet. Got a question? Ask the venue.', noQuestionsYet: 'No questions yet.', helpful: 'Helpful to me too',
        helpfulN: (n) => (n === 1 ? 'Helpful to 1 person' : `Helpful to ${n} people`), edited: 'edited',
        noAsk: "This business isn't taking questions right now.",
        askSoon: 'You’ll soon be able to ask this venue questions.',
        menuAll: 'See the whole menu',
        seeAll: (n) => `See all (${n})`, back: 'Back to the page', prev: '← Previous', next: 'Next →', page: 'Page',
        allAgenda: (c) => `See everything on in ${c}`,
      }
    : {
        now: 'Ofertas', soon: 'Eventos',
        none: 'Ahora mismo no hay nada publicado. Suele cambiar: échale un ojo en la app.',
        open: 'Añadir a favoritos', note: 'Desde aquí o desde la app, con la misma cuenta. Te avisamos cuando este negocio publique algo.',
        verified: 'Comprobado por Klendar', since: 'En Klendar desde', redeemed: (n) => (n === 1 ? '1 canje hasta ahora' : `${n} canjes hasta ahora`),
        noRatings: 'Sin valoraciones todavía',
        about: 'Sobre el negocio', menu: 'Carta', place: 'El sitio',
        stamps: 'Tarjeta de sellos', allergens: 'Alérgenos',
        menuNote: 'Los alérgenos son los que declara el negocio. Si tienes alergia, pregúntalo en el sitio.',
        stampsMany: 'Tarjetas de sellos',
        stampsBody: (n, r) => `${n} sellos: «${r}»`,
        stampsNote: 'Cada canje que cuenta deja un sello, como mucho uno al día por tarjeta, y la app lleva la cuenta.',
        stampsAll: 'Cuentan todas las publicaciones', stampsFlash: 'Solo cuentan las ofertas flash', stampsEvents: 'Solo cuentan los eventos',
        stampsSomeCats: 'Solo cuentan algunas categorías', stampsSomeOffers: 'Solo cuentan algunas publicaciones',
        stampsOnly: (l) => `Solo cuentan: ${l}`, stampsMore: (l, n) => `${l} y ${n} más`,
        stampsByVisit: 'También por visita con el QR del local',
        stampsNoteVisit: 'Cada canje que cuenta deja un sello, y también escanear el QR del local si la tarjeta lo dice: como mucho uno al día por tarjeta. La app lleva la cuenta.',
        hours: 'Horario', kitchen: 'Cocina', closed: 'Cerrado', today: 'hoy',
        days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
        news: 'Novedades', reviews: 'Reseñas', write: 'Escribir una reseña', noReviews: 'Todavía no hay reseñas. ¿Has estado? Sé la primera persona.',
        user: 'Usuario de Klendar', report: 'Denunciar', reportShort: 'Denunciar', editBiz: 'Editar ficha', myBiz: 'Ir al panel', block: 'Bloquear', reportBiz: 'Denunciar este negocio', menuPhotos: 'Fotos de la carta',
        verifiedCustomer: 'Cliente verificado',
        verifiedWhat: 'Ha canjeado algo en este negocio con Klendar: una oferta, un evento, un premio de sellos, un regalo de cumpleaños o algo que el negocio le dio con «Dar en el momento». Lo comprobamos con lo que el propio negocio ha validado o dado en el local.',
        howReviews: 'Cómo funcionan las reseñas', allReviews: 'Todas',
        verifiedReviews: (n) => `Clientes verificados (${n})`, noVerified: 'Aún no hay reseñas de clientes verificados.',
        claim: '¿Es tu negocio?', contact: 'Contacto',
        replyFrom: (n) => `Respuesta de ${n}`,
        closedToday: 'Cerrado hoy', closedUntil: (d) => `Cerrado hasta el ${d}`,
        closedTemp: 'Cerrado temporalmente', closedIndef: 'Cerrado hasta nuevo aviso', closedTempBody: 'Este negocio ha cerrado por un tiempo y ahora no publica nada.',
        closedTempUntil: (d) => `Cerrado temporalmente hasta el ${d}`,
        unavailable: 'No disponible ahora mismo', unavailableBody: 'Este negocio ahora no publica nada.',
        keptCodes: 'Si tienes un código o un bono suyo, sigue valiendo.',
        closingDay: (d) => `Cerrará el ${d}`, closing: (a, b) => `Cerrará del ${a} al ${b}`,
        moreIn: (c) => `Más en ${c}:`, cityToday: 'qué hacer hoy', cityWeek: 'esta semana',
        hiddenFav: (n) => (n === 1 ? 'Hay 1 publicación exclusiva para quien lo tiene en favoritos.'
          : `Hay ${n} publicaciones exclusivas para quien lo tiene en favoritos.`),
        hiddenCust: (n) => (n === 1 ? 'Hay 1 publicación exclusiva para sus clientes con sellos.'
          : `Hay ${n} publicaciones exclusivas para sus clientes con sellos.`),
        birthday: 'Regalo de cumpleaños para quien lo tiene en favoritos',
        matches: 'Partidos',
        highlights: 'Qué pedir aquí',
        holidayOpens: (d, h) => `Abre el festivo del ${d} (${h})`, holidayClosed: (d) => `Cerrado el festivo del ${d}`,
        holidayUnknown: (d) => `Festivo del ${d}: horario sin confirmar`,
        questions: 'Preguntas', ask: 'Preguntar', reportQuestion: 'Denunciar la pregunta', reportAnswer: 'Denunciar la respuesta',
        noQuestions: 'Aún no hay preguntas. ¿Tienes una duda? Pregúntale al local.', noQuestionsYet: 'Aún no hay preguntas.', helpful: 'A mí también me sirve',
        helpfulN: (n) => (n === 1 ? 'A 1 persona le sirve' : `A ${n} personas les sirve`), edited: 'editada',
        noAsk: 'Este negocio no recibe preguntas ahora mismo.',
        askSoon: 'Pronto podrás preguntar a este local.',
        menuAll: 'Ver toda la carta',
        seeAll: (n) => `Ver todas (${n})`, back: 'Volver a la ficha', prev: '← Anterior', next: 'Siguiente →', page: 'Página',
        allAgenda: (c) => `Ver toda la agenda de ${c}`,
      };

  const flash = offers.filter((o) => o.kind === 'flash_offer');
  const events = offers.filter((o) => o.kind !== 'flash_offer');
  // Cuántas hay de verdad (no las de esta página): los chips, la descripción
  // y las páginas.
  const nFlash = parado ? 0 : Number(cuentas?.flash ?? flash.length) || 0;
  const nEvents = parado ? 0 : Number(cuentas?.events ?? events.length) || 0;
  const paginas = Math.max(1, Math.ceil((nFlash + nEvents) / POR_PAGINA_FICHA));
  const enlacePagina = (n) => (n > 1 ? `${path}?p=${n}` : path);
  const paginador = (actual, total, enlace) => (total > 1 ? `<nav class="pager" aria-label="${esc(S.page)}">
    ${actual > 1 ? `<a class="pill" href="${esc(enlace(actual - 1))}" rel="prev">${esc(S.prev)}</a>` : ''}
    <span class="muted">${esc(S.page)} ${actual}/${total}</span>
    ${actual < total ? `<a class="pill" href="${esc(enlace(actual + 1))}" rel="next">${esc(S.next)}</a>` : ''}
  </nav>` : '');
  // De una entidad: su fecha sin hora sale como «todo el día» (la tarjeta).
  if (local.entity_kind) for (const o of offers) o.entity_kind = local.entity_kind;
  // Lo que la ficha no enseña a quien mira sin sesión: las exclusivas para
  // favoritos o clientes (solo cuántas hay) y el regalo de cumpleaños. Es la
  // razón para añadirlo a favoritos, así que se dice.
  const nFav = Number(b.hidden_for_favorites) || 0;
  const nCli = Number(b.hidden_for_customers) || 0;
  const exclusivas = parado ? '' : [
    nFav > 0 ? `<p class="exclusiva">${icono('candado')}<span>${esc(S.hiddenFav(nFav))}</span></p>` : '',
    nCli > 0 ? `<p class="exclusiva">${icono('candado')}<span>${esc(S.hiddenCust(nCli))}</span></p>` : '',
    b.birthday_gift ? `<p class="exclusiva">${icono('regalo')}<span>${esc(S.birthday)}</span></p>` : '',
  ].join('');
  // Un organizador no tiene dirección (ni mapa, horario, «Abierto ahora»,
  // «¿Hay sitio ahora?», «Cómo llegar» ni distancia): cada evento lleva su
  // sitio. Su sello «Organiza en distintos sitios»; sus fechas, en
  // «Próximamente» justo debajo (la lista «Próximas fechas» se quitó el
  // 2026-10-22: repetía lo mismo) y en los datos estructurados.
  const where = organizador ? '' : [b.address, b.city].filter(Boolean).join(', ');
  // Todo lo de la ficha, en la hora del negocio (Canarias, una menos).
  const tz = zonaDe(b);
  const SA = KA.t(lang);
  const fechasOrg = organizador ? events
    .map((o) => ({ offer_id: o.id, title: o.title, starts_at: o.event_at || o.redeem_start_at, time_zone: tz,
      venue_name: o.venue_name, venue_address: o.venue_address, business_name: b.name, city: b.city }))
    .filter((d) => d.starts_at && isUuid(d.offer_id))
    .sort((x, y) => new Date(x.starts_at) - new Date(y.starts_at)) : [];

  // Días cerrados (vacaciones, festivos): el que está en curso o, si cae en
  // el próximo mes, el siguiente. Igual que en la app. Fechas de calendario,
  // sin hora: se comparan como texto AAAA-MM-DD con el hoy del negocio.
  const cierre = (() => {
    const dia = (iso) => new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })
      .format(new Date(`${iso}T00:00:00Z`));
    // Bloqueado o en pausa por cierre: manda sobre todo lo demás.
    if (b.unavailable === 'paused') {
      const vuelta = /^\d{4}-\d{2}-\d{2}/.test(String(b.reopens_on || '')) ? String(b.reopens_on).slice(0, 10) : '';
      return `<p class="cierre ahora">${icono('cerrado', 18)}<span><b>${esc(vuelta ? S.closedTempUntil(dia(vuelta)) : S.closedTemp)}</b> · ${esc(S.closedTempBody)} ${esc(S.keptCodes)}</span></p>`;
    }
    if (b.unavailable === 'blocked') {
      return `<p class="cierre ahora">${icono('cerrado', 18)}<span><b>${esc(S.unavailable)}</b> · ${esc(S.unavailableBody)} ${esc(S.keptCodes)}</span></p>`;
    }
    // Cerrado hasta nuevo aviso (desde «Dar de baja el negocio»): manda sobre
    // los días cerrados.
    if (b.closed_indefinitely) {
      return `<p class="cierre ahora">${icono('cerrado', 18)}<span><b>${esc(S.closedIndef)}</b> · ${esc(S.closedTempBody)}</span></p>`;
    }
    const c = cierres[0];
    if (!c) return '';
    const hoyIso = KZ.hoy(tz);
    const ahora = c.starts_on <= hoyIso && hoyIso <= c.ends_on;
    const dias = (new Date(`${c.starts_on}T00:00:00Z`) - new Date(`${hoyIso}T00:00:00Z`)) / 864e5;
    if (!ahora && dias > 30) return '';
    const txt = ahora
      ? (c.ends_on === hoyIso ? S.closedToday : S.closedUntil(dia(c.ends_on)))
      : (c.starts_on === c.ends_on ? S.closingDay(dia(c.starts_on))
        // «Del 12 al 13 de octubre» si es el mismo mes.
        : S.closing(c.starts_on.slice(0, 7) === c.ends_on.slice(0, 7) ? String(Number(c.starts_on.slice(8, 10))) : dia(c.starts_on), dia(c.ends_on)));
    return `<p class="cierre${ahora ? ' ahora' : ''}">${icono('cerrado', 18)}<span><b>${esc(txt)}</b>${c.reason ? ` · ${esc(c.reason)}` : ''}</span></p>`;
  })();

  // «Qué pedir aquí», momentos y el festivo (`business_ficha_info`).
  const info = fichaInfo && typeof fichaInfo === 'object' ? fichaInfo : {};
  const cosas = (Array.isArray(info.highlights) ? info.highlights : []).filter((h) => h && h.title);
  const momentos = (Array.isArray(info.moments) ? info.moments : []).map((m) => KMO.nombre(m, lang)).filter(Boolean);
  const quePedir = cosas.length && !parado ? `<h2 id="que-pedir">${esc(S.highlights)}</h2>
      <p data-tr-nota="highlight:" hidden></p>
      <ul class="que-pedir">${cosas.map((h) => `<li>
        ${seguro(h.image_url) ? miniatura(seguro(h.image_url), { grupo: `que-pedir-${esc(h.id || '')}`, clase: 'dish', etiqueta: h.title, lang, ancho: 64, alto: 64 }) : `<span class="que-pedir-ic" aria-hidden="true">${icono('carta', 20)}</span>`}
        <span><b${isUuid(h.id) ? ` data-tr="highlight:${h.id}:title"` : ''}>${esc(h.title)}</b>${h.note ? `<small${isUuid(h.id) ? ` data-tr="highlight:${h.id}:note"` : ''}>${esc(h.note)}</small>` : ''}</span>
      </li>`).join('')}</ul>` : '';
  const momentosHtml = momentos.length ? `<p class="momentos">${icono('reloj', 18)}<span>${esc(momentos.join(' · '))}</span></p>` : '';
  // Días con otro horario: {"2026-11-09": [["10:00","14:00"]]} para
  // /assets/horario.js.
  const diasOtro = Object.fromEntries((Array.isArray(info.special_days) ? info.special_days : [])
    .filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(String(d.day)) && Array.isArray(d.hours))
    .map((d) => [String(d.day), d.hours]));
  // «Abre el festivo del 1 de noviembre (10:00–14:00)»…
  const festivo = (() => {
    const h = info.holiday;
    if (!h || !/^\d{4}-\d{2}-\d{2}$/.test(String(h.day)) || organizador || parado || sinFecha) return '';
    const dia = new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })
      .format(new Date(`${h.day}T00:00:00Z`));
    const tramos = (Array.isArray(h.hours) ? h.hours : []).filter((t) => Array.isArray(t)).map((t) => `${t[0]}–${t[1]}`).join(', ');
    const txt = h.state === 'unknown' ? S.holidayUnknown(dia)
      : h.state === 'closed' || !tramos ? S.holidayClosed(dia) : S.holidayOpens(dia, tramos);
    return `<p class="festivo${h.state === 'unknown' ? ' sin-confirmar' : ''}">${icono('calendario', 18)}<span>${esc(txt)}</span></p>`;
  })();

  // Horario: {"1": [["09:00","14:00"], …], …, "7": []} (1 = lunes). Hoy, en
  // la hora del negocio, va marcado.
  // Parado (bloqueado o en pausa), sin horario: ni «Abierto · cierra a las…»
  // ni «Estaba cerrado» al lado de «No disponible» / «Cerrado temporalmente»,
  // como la app (revisión 2026-10-21).
  const horas = !organizador && !parado && !sinFecha && b.opening_hours && typeof b.opening_hours === 'object' ? b.opening_hours : null;
  const hoy = KZ.diaSemana(tz);
  const horario = horas && Object.keys(horas).length
    ? `<table class="horario">${[1, 2, 3, 4, 5, 6, 7].map((d) => {
        const tramos = Array.isArray(horas[d]) ? horas[d] : (Array.isArray(horas[String(d)]) ? horas[String(d)] : []);
        const txt = tramos.length ? tramos.map((t) => `${esc(t[0])}–${esc(t[1])}`).join(', ') : S.closed;
        return `<tr${d === hoy ? ' class="hoy"' : ''}><th>${S.days[d - 1]}${d === hoy ? ` <small>(${S.today})</small>` : ''}</th><td>${txt}</td></tr>`;
      }).join('')}</table>`
    : '';
  // Horario de cocina (opcional): su semana debajo y «Cocina: hasta las 23:00»
  // con el local abierto (`assets/horario.js`).
  const cocina = horas && local.kitchen_hours && typeof local.kitchen_hours === 'object' && Object.keys(local.kitchen_hours).length
    ? local.kitchen_hours : null;
  const horarioCocina = cocina
    ? `<h3 class="side-h">${S.kitchen}</h3><table class="horario">${[1, 2, 3, 4, 5, 6, 7].map((d) => {
        const tramos = Array.isArray(cocina[d]) ? cocina[d] : (Array.isArray(cocina[String(d)]) ? cocina[String(d)] : []);
        const txt = tramos.length ? tramos.map((t) => `${esc(t[0])}–${esc(t[1])}`).join(', ') : S.closed;
        return `<tr${d === hoy ? ' class="hoy"' : ''}><th>${S.days[d - 1]}</th><td>${txt}</td></tr>`;
      }).join('')}</table>`
    : '';

  const redes = Object.entries(b.social || {})
    .filter(([k, v]) => k !== 'web' && typeof v === 'string' && v.trim())
    .map(([k, v]) => `<a href="${esc(redUrl(k, v))}" rel="nofollow noopener" target="_blank">${esc(redNombre[k] || k)}</a>`);

  // Los archivos de la carta, en su orden: las fotos (galería con zoom) y
  // cada PDF como una fila que lo abre fuera. Lo que espera la moderación no
  // sale (la ficha va sin sesión).
  const archivos = enlacesNeg && Array.isArray(enlacesNeg.menu_files)
    ? enlacesNeg.menu_files.filter((f) => f && !f.pending && /^https:\/\//.test(String(f.url || '')) && ['image', 'pdf'].includes(f.kind))
    : (b.menu_images || []).filter((u) => typeof u === 'string' && seguro(u)).map((url) => ({ kind: /\.pdf($|\?)/i.test(url) ? 'pdf' : 'image', url }));
  const fotosCarta = archivos.filter((f) => f.kind === 'image').map((f) => f.url);
  const pdfsCarta = archivos.filter((f) => f.kind === 'pdf');
  const enlaceCarta = seguro(b.menu_url);
  const hayCarta = carta.length > 0 || fotosCarta.length > 0 || pdfsCarta.length > 0 || !!enlaceCarta;
  // «Reservar», «Pedir a domicilio»…: botones iguales y neutros (sin coral).
  // Parado (bloqueado o en pausa), sin «Reservar» ni «Pedir…», como la app.
  const enlacesHtml = parado ? '' : KE.botones(enlacesNeg?.links, lang);
  const cuentaToques = !!(enlacesHtml || pdfsCarta.length || enlaceCarta);
  const galeria = (b.gallery || []).filter((u) => typeof u === 'string' && u);
  const estrellas = (n) => `<span class="stars" aria-label="${n}/5">${'★'.repeat(n)}<span>${'★'.repeat(5 - n)}</span></span>`;
  const since = KZ.fmt(b.member_since, tz, en ? 'en-GB' : 'es-ES', { month: 'long', year: 'numeric' });
  const maps = b.lat && !organizador ? `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}` : null;
  const city = b.city ? `${agendaBase(lang)}/${citySeg(b.city)}/` : null;
  const cityToday = b.city ? `${todayBase(lang)}/${citySeg(b.city)}/` : null;

  // Una novedad y una reseña (la ficha y sus listas enteras, `?ver=`).
  const novedadHtml = (p) => `<article${isUuid(p.id) ? ` id="novedad-${p.id}"` : ''}>
          <p class="muted">${esc(fmtWhen(p.created_at, lang, tz))}</p>
          ${p.body ? `<p${isUuid(p.id) ? ` data-tr="post:${p.id}:body"` : ''}>${esc(p.body).replace(/\n/g, '<br>')}</p>` : ''}
          ${p.image_url ? miniatura(p.image_url, { grupo: `novedad-${p.id}`, clase: 'nov-media', etiqueta: S.news, lang, ancho: 900, alto: 600 }) : ''}
          <a class="denuncia" href="${cuenta(lang)}#/denunciar/post/${encodeURIComponent(p.id)}" rel="nofollow">${S.report}</a>
        </article>`;
  const resenaHtml = (r) => `<article${isUuid(r.id) ? ` id="resena-${r.id}"` : ''}${isUuid(r.user_id) ? ` data-autor="${r.user_id}"` : ''}>
          <header>${r.avatar_url ? `<img class="av" src="${esc(r.avatar_url)}" alt="" loading="lazy">` : `<span class="av">${esc((r.display_name || S.user).trim().charAt(0).toUpperCase())}</span>`}
            <span><b>${esc(r.display_name || S.user)}</b><small class="muted">${esc(fmtWhen(r.created_at, lang, tz))}</small></span>
            ${estrellas(Math.max(0, Math.min(5, r.rating | 0)))}</header>
          ${r.verified ? `<details class="verificado"><summary>${icono('voy', 15)}<span>${S.verifiedCustomer}</span></summary>
            <p>${esc(S.verifiedWhat)} <a href="${en ? '/en/community-guidelines/' : '/normas/'}#resenas">${S.howReviews}</a></p></details>` : ''}
          ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
          ${resenaMedios(r, lang)}
          ${r.reply ? `<div class="respuesta"><header>${icono('negocio', 16)}<b>${esc(S.replyFrom(b.name))}</b>${r.reply_at ? `<small class="muted">${esc(fmtWhen(r.reply_at, lang, tz))}</small>` : ''}</header>
            <p>${esc(r.reply).replace(/\n/g, '<br>')}</p></div>` : ''}
          <a class="denuncia" href="${cuenta(lang)}#/denunciar/review/${encodeURIComponent(r.id)}" rel="nofollow">${S.report}</a>${isUuid(r.user_id) ? ` · <a class="denuncia" href="${cuenta(lang)}#/bloquear/${r.user_id}" rel="nofollow">${S.block}</a>` : ''}
        </article>`;
  // «Preguntas»: una contestada (nunca quién preguntó). «A mí también me
  // sirve» lo enseña /assets/preguntas.js con la sesión; sin JavaScript, el
  // número.
  const pq = preguntasRes && preguntasRes.ok ? preguntasRes : null;
  const nPreguntas = Number(pq?.total) || 0;
  // Hasta el 4-11-2026 nadie pregunta (`not_yet`, migración 20261237100001 de
  // la app): sin nada que enseñar, la sección no sale (en prod no habrá nada);
  // con contestadas (solo en dev), sin «Preguntar» y con «Pronto podrás…».
  const pronto = Boolean(pq) && pq.ask_block === 'not_yet';
  const recibe = Boolean(pq) && !['unavailable', 'no_team', 'not_yet'].includes(pq.ask_block);
  const conPreguntas = Boolean(pq) && (nPreguntas > 0 || recibe);
  const preguntaHtml = (q) => `<article class="pregunta"${isUuid(q.id) ? ` id="pregunta-${q.id}"` : ''}>
          <p class="pregunta-t">${icono('pregunta', 18)}<span><b>${esc(q.question)}</b><small class="muted">${esc(fmtWhen(q.asked_at, lang, tz))}</small></span></p>
          ${q.answer ? `<div class="respuesta"><header>${icono('negocio', 16)}<b>${esc(S.replyFrom(b.name))}</b>${q.answered_at ? `<small class="muted">${esc(fmtWhen(q.answered_at, lang, tz))}${q.edited ? ` · ${esc(S.edited)}` : ''}</small>` : ''}</header>
            <p>${esc(q.answer).replace(/\n/g, '<br>')}</p></div>` : ''}
          <p class="pregunta-pie">${isUuid(q.id) ? `<button type="button" class="pill sirve" data-sirve="${q.id}" data-n="${Number(q.helpful) || 0}" aria-pressed="false" hidden>${esc(S.helpful)}${Number(q.helpful) > 0 ? ` · ${Number(q.helpful)}` : ''}</button>` : ''}
            ${Number(q.helpful) > 0 ? `<span class="muted sirve-n">${esc(S.helpfulN(Number(q.helpful)))}</span>` : ''}
            ${isUuid(q.id) ? `<a class="denuncia" href="${cuenta(lang)}#/denunciar/question/${q.id}" rel="nofollow">${S.reportQuestion}</a> · <a class="denuncia" href="${cuenta(lang)}#/denunciar/question_answer/${q.id}" rel="nofollow">${S.reportAnswer}</a>` : ''}</p>
        </article>`;
  const preguntarHtml = recibe ? `<p data-preguntar><a class="pill" href="${cuenta(lang)}#/preguntar/${encodeURIComponent(b.id)}">${icono('pregunta', 16)} ${esc(S.ask)}</a></p>`
    : pronto ? `<p class="muted pregunta-pronto">${esc(S.askSoon)}</p>` : '';
  const preguntasScript = pq ? `<script src="/assets/preguntas.js?v=1" defer data-biz="${esc(b.id)}" data-lang="${en ? 'en' : 'es'}" data-url="${esc(supabasePublic().url)}" data-key="${esc(supabasePublic().key)}" data-cuenta="${esc(cuenta(lang))}" data-nombre="${esc(b.name)}"></script>` : '';
  const nResenas = soloVerificadas ? nVerificadas : Number(b.ratings) || 0;
  // ── La carta: los platos (los [max] primeros, con su sección), las fotos,
  // los PDF y el enlace a su web. En la ficha, 5 platos y «Ver toda la
  // carta» (`?ver=carta`, la carta entera), como la app.
  const nPlatos = carta.reduce((n, sec) => n + (sec.items || []).length, 0);
  const platosHtml = (max = Infinity) => {
    let quedan = max;
    const secciones = [];
    carta.forEach((sec, si) => {
      if (quedan <= 0) return;
      const items = (sec.items || []).slice(0, quedan);
      quedan -= items.length;
      if (items.length) secciones.push([sec, si, items]);
    });
    return secciones.length ? `<p data-tr-nota="menu_" hidden></p>
        <div class="menu">${secciones.map(([sec, si, items]) => `<section>
          <h3${isUuid(sec.id) ? ` data-tr="menu_section:${sec.id}:name"` : ''}>${esc(sec.name)}</h3>
          <ul>${items.map((it, ii) => `<li>
            ${seguro(it.image_url) ? miniatura(seguro(it.image_url), { grupo: `plato-${si}-${ii}`, clase: 'dish', etiqueta: it.name, lang, ancho: 56, alto: 56 }) : ''}
            <span class="plato"><b${isUuid(it.id) ? ` data-tr="menu_item:${it.id}:name"` : ''}>${esc(it.name)}</b>${it.description ? `<small${isUuid(it.id) ? ` data-tr="menu_item:${it.id}:description"` : ''}>${esc(it.description)}</small>` : ''}
            ${(it.allergens || []).length ? `<small class="alg">${S.allergens}: ${it.allergens.map((a) => esc(nombreAlergeno(a, en))).join(', ')}</small>` : ''}</span>
            <span class="price">${it.price_cents == null ? '' : esc(money(it.price_cents, 'EUR', lang))}</span>
          </li>`).join('')}</ul>
        </section>`).join('')}</div>
        <p class="note">${esc(S.menuNote)}</p>` : '';
  };
  const archivosCartaHtml = `${fotosCarta.length ? `<div class="carta-fotos">${fotosCarta.map((u, i) => miniatura(u, { grupo: 'carta', i, n: fotosCarta.length, clase: 'carta-foto', etiqueta: S.menuPhotos, lang, ancho: 300, alto: 400 })).join('')}</div>` : ''}
        ${pdfsCarta.length || enlaceCarta ? `<div class="carta-archivos">${pdfsCarta.map((f) => KE.filaCarta(f.url, lang, { pdf: true, nombre: f.name, bytes: f.bytes })).join('')}${enlaceCarta ? KE.filaCarta(enlaceCarta, lang) : ''}</div>` : ''}`;
  const hayArchivosCarta = fotosCarta.length > 0 || pdfsCarta.length > 0;
  const cartaFicha = parado ? ''
    : carta.length || hayArchivosCarta
      ? `<h2 id="carta">${S.menu}</h2>${platosHtml(5)}
        ${nPlatos > 5 || hayArchivosCarta || enlaceCarta ? `<p><a class="pill" href="${path}?ver=carta">${icono('carta', 16)} ${esc(S.menuAll)}</a></p>` : ''}`
      // Solo el enlace a su web: su fila, que lo abre.
      : enlaceCarta ? `<h2 id="carta">${S.menu}</h2><div class="carta-archivos">${KE.filaCarta(enlaceCarta, lang)}</div>` : '';
  // «Ver todas (N)» de las novedades o de las reseñas: solo esa lista, por
  // páginas, sin indexar (la ficha es la buena).
  if (ver === 'carta') {
    const cuerpo = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a>${city ? ` · <a href="${city}">${esc(b.city)}</a>` : ''} · <a href="${path}">${esc(b.name)}</a></p>
  <div class="detail negocio sin-media lista-entera">
    <h1>${esc(S.menu)} · ${esc(b.name)}</h1>
    ${parado ? '' : `${platosHtml()}${archivosCartaHtml}`}
    <p><a class="pill" href="${path}">${esc(S.back)}</a></p>
  </div>`;
    return html(publicPage({
      lang, path, body: cuerpo + MENU_JS, title: `${S.menu} · ${b.name}`, description: `${S.menu} · ${b.name}`, image: b.cover || b.logo,
      consulta: '?ver=carta',
      head: `<meta name="robots" content="noindex, follow">
${traducir(lang, `business:${b.id}`, carta.length ? `menu:${b.id}` : '')}${cuentaToques ? `
<script src="/assets/enlaces.js?v=3" defer data-url="${esc(supabasePublic().url)}" data-key="${esc(supabasePublic().key)}" data-biz="${esc(b.id)}"></script>` : ''}`,
    }));
  }
  if (ver) {
    const total = ver === 'novedades' ? (parado ? 0 : Number(b.posts) || 0) : ver === 'preguntas' ? nPreguntas : nResenas;
    const lista = ver === 'novedades' ? (parado ? [] : novedades) : ver === 'preguntas' ? (Array.isArray(preguntasLista) ? preguntasLista : []) : opiniones;
    const pags = Math.max(1, Math.ceil(total / POR_PAGINA_LISTA));
    const filtro = soloVerificadas ? '&resenas=verificadas' : '';
    const enlace = (n) => `${path}?ver=${ver}${filtro}${n > 1 ? `&p=${n}` : ''}`;
    const titulo = ver === 'novedades' ? S.news : ver === 'preguntas' ? S.questions : S.reviews;
    const cuerpo = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a>${city ? ` · <a href="${city}">${esc(b.city)}</a>` : ''} · <a href="${path}">${esc(b.name)}</a></p>
  <div class="detail negocio sin-media lista-entera">
    <h1>${esc(titulo)} · ${esc(b.name)}</h1>
    ${ver === 'resenas' ? `<p><a class="pill" data-opinar="${esc(b.id)}" href="${cuenta(lang)}#/opinar/${encodeURIComponent(b.id)}">${icono('resena', 16)} <span>${S.write}</span></a></p>` : ''}
    ${ver === 'preguntas' ? `<div data-preguntas-mias hidden></div>${preguntarHtml}` : ''}
    ${ver === 'resenas' && (nVerificadas > 0 || soloVerificadas) ? `<nav class="filtro-resenas" aria-label="${esc(S.reviews)}">
      <a class="pill${soloVerificadas ? '' : ' on'}" href="${path}?ver=resenas"${soloVerificadas ? '' : ' aria-current="true"'}>${S.allReviews}</a>
      <a class="pill${soloVerificadas ? ' on' : ''}" href="${path}?ver=resenas&amp;resenas=verificadas" rel="nofollow"${soloVerificadas ? ' aria-current="true"' : ''}>${esc(S.verifiedReviews(nVerificadas))}</a>
    </nav>` : ''}
    ${lista.length
      ? (ver === 'novedades' ? `<p data-tr-nota="post:" hidden></p><div class="novedades">${lista.map(novedadHtml).join('')}</div>`
        : ver === 'preguntas' ? `<div class="preguntas">${lista.map(preguntaHtml).join('')}</div>`
          : `<div class="resenas">${lista.map(resenaHtml).join('')}</div>`)
      : `<p class="empty">${ver === 'novedades' ? '' : ver === 'preguntas' ? esc(recibe ? S.noQuestions : pronto ? S.noQuestionsYet : S.noAsk) : soloVerificadas ? S.noVerified : S.noReviews}</p>`}
    ${paginador(pagina, pags, enlace)}
    <p><a class="pill" href="${path}">${esc(S.back)}</a></p>
  </div>`;
    return html(publicPage({
      lang, path, body: cuerpo + MENU_JS, title: `${titulo} · ${b.name}`, description: `${titulo} · ${b.name}`, image: b.cover || b.logo,
      consulta: `?ver=${ver}${filtro}${pagina > 1 ? `&p=${pagina}` : ''}`,
      head: `<meta name="robots" content="noindex, follow">
${traducir(lang, `business:${b.id}`, '')}${ver === 'preguntas' ? `\n${PREGUNTAS_CSS}\n${preguntasScript}` : ''}`,
    }));
  }

  // ── La ficha ordenada (Iván, 2026-10-22; igual en la app) ──────────────
  // 1. Nombre e insignias. 2. Una sola línea de estado que se despliega
  // («Abierto · cierra 23:00 · Casi lleno»): dentro, el horario entero, la
  // cocina, el festivo y «Avísame cuando haya sitio»; lo que hay que avisar
  // (cerrado, en pausa, festivo sin confirmar, «Horario sin confirmar»), a la
  // vista. 3. Lo publicado. 4. Qué pedir aquí. 5. El sitio. 6. Carta (y
  // «Reservar», «Pedir…»). 7. Grupos, partidos y sorteos. 8. Sellos (y lo
  // exclusivo para favoritos). 9. Novedades. 10. Reseñas. 11. Preguntas: 1 y
  // «Ver todas (N)». 12. Contacto, redes y «Cómo llegar» (en el escritorio, a
  // la derecha; en el móvil, al final).
  const festivoAviso = festivo.includes('sin-confirmar') ? festivo : '';
  const flecha = '<svg class="ic flecha" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>';
  const estadoHtml = horario
    ? `<details class="estado-neg">
        <summary><span class="estado-hoy" hidden data-horario="${esc(JSON.stringify(horas))}" data-cierres="${esc(JSON.stringify(cierres.map((c) => ({ starts_on: c.starts_on, ends_on: c.ends_on }))))}" data-tz="${esc(tz)}" data-lang="${en ? 'en' : 'es'}"${cocina ? ` data-cocina="${esc(JSON.stringify(cocina))}"` : ''}${Object.keys(diasOtro).length ? ` data-dias="${esc(JSON.stringify(diasOtro))}"` : ''}></span>${crowdOn ? `<span class="sitio-ahora" data-sitio-ahora="${esc(b.id)}" hidden></span>` : ''}<span class="estado-fb">${S.hours}</span>${flecha}</summary>
        <div class="estado-dentro">
          <h3 class="side-h">${S.hours}</h3>${horario}${horarioCocina}
          ${festivoAviso ? '' : festivo}
          ${crowdOn ? `<div data-hay-sitio="${esc(b.id)}" data-solo-publico hidden></div>` : ''}
        </div>
      </details>
      ${festivoAviso}${cierre}
      <div class="horario-check" hidden data-solo-publico data-cerrado="${esc(b.id)}" data-lang="${en ? 'en' : 'es'}" data-url="${esc(supabasePublic().url)}" data-key="${esc(supabasePublic().key)}"></div>`
    // Sin horario (un organizador, o no lo ha puesto): «¿Hay sitio ahora?» en
    // su línea y lo que haya que avisar.
    : `${crowdOn ? `<p class="sitio-ahora" data-sitio-ahora="${esc(b.id)}" hidden></p>
      <div data-hay-sitio="${esc(b.id)}" data-solo-publico hidden></div>` : ''}${cierre}`;
  // «El sitio»: cómo es (la descripción), lo que marca el negocio (terraza,
  // wifi…) y sus momentos. Sin nada de eso, «Sobre el negocio».
  const marcasSitio = parado ? '' : `${sitioFicha(sitio, lang)}${momentosHtml}`;
  const descripcion = b.description ? `<p data-tr="business:${esc(b.id)}:description">${esc(b.description).replace(/\n/g, '<br>')}</p>
      <p data-tr-nota="business:" hidden></p>` : '';
  const elSitio = marcasSitio || descripcion ? `<h2 id="el-sitio">${marcasSitio ? S.place : S.about}</h2>${descripcion}${marcasSitio}` : '';
  // «Preguntas»: la más útil y «Ver todas (N)».
  const preguntasTop = (pq?.top || []).slice(0, 1);
  const preguntasHtml = conPreguntas ? `<h2 id="preguntas">${esc(S.questions)}${nPreguntas ? ` <small class="muted">(${nPreguntas})</small>` : ''}</h2>
      <div data-preguntas-mias hidden></div>
      ${preguntasTop.length ? `<div class="preguntas">${preguntasTop.map(preguntaHtml).join('')}</div>
        ${nPreguntas > preguntasTop.length ? `<p><a class="pill" href="${path}?ver=preguntas">${esc(S.seeAll(nPreguntas))}</a></p>` : ''}` : `<p class="empty">${esc(recibe ? S.noQuestions : S.noAsk)}</p>`}
      ${preguntarHtml}` : '';
  // La tarjeta de sellos que se llama como el negocio no repite el nombre.
  const planoSello = (t) => String(t || '').normalize('NFD').replace(/[^a-zA-Z0-9]+/g, ' ').toLowerCase().trim();
  const mismoNombre = (n) => !n || planoSello(n) === planoSello(b.name);

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a>${city ? ` · <a href="${city}">${esc(b.city)}</a>` : ''}</p>
  <div class="detail negocio ordenada${b.cover || galeria.length ? '' : ' sin-media'}" data-equipo-biz="${esc(b.id)}">
    ${carrusel([b.cover, ...galeria].filter(Boolean), { titulo: b.name, forma: 'negocio', lang })}
    <div class="d-head">
      <div class="neg-id d-top">
        ${b.logo && /^https:\/\//.test(b.logo) ? `<img class="neg-logo" src="${esc(b.logo)}" alt="" width="88" height="88">` : `<span class="neg-logo" aria-hidden="true">${esc((b.name || '·').charAt(0).toUpperCase())}</span>`}
        <div><h1>${esc(b.name)}</h1>
          <p class="muted"${b.lat && !organizador ? ` data-lat="${Number(b.lat).toFixed(5)}" data-lng="${Number(b.lng).toFixed(5)}"` : ''}>${esc(b.city || '')}<span class="tj-dist" hidden></span></p></div>
        <div class="neg-botones">
        <a class="fav-ic" data-solo-publico data-fav="${esc(b.id)}" href="${cuenta(lang)}#/seguir/${encodeURIComponent(b.id)}"><svg class="ic cor-vacio" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg><svg class="ic cor-lleno" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg><span class="sr">${S.open}</span></a>
        ${masMenu([`<a class="mas-peligro" data-solo-publico href="${cuenta(lang)}#/denunciar/business/${encodeURIComponent(b.id)}" rel="nofollow">${S.reportShort}</a>`], lang, { soloPublico: true })}
        </div>
      </div>
      <p class="acciones equipo-acc"><a class="pill" data-solo-equipo="gestion" hidden href="/panel/#/ficha?biz=${encodeURIComponent(b.id)}">${icono('editar', 16)} <span>${S.editBiz}</span></a><a class="pill" data-solo-equipo="empleado" hidden href="/panel/?biz=${encodeURIComponent(b.id)}">${icono('negocio', 16)} <span>${S.myBiz}</span></a></p>
      ${where ? `<a class="neg-dir" href="${esc(maps || '#')}" rel="nofollow noopener" target="_blank">${icono('lugar')}<span>${esc(b.address || where)}</span><svg class="ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg></a>` : ''}
      ${b.rating && b.ratings ? `<p class="neg-nota"><a href="#resenas"><span class="stars-mini" aria-hidden="true">★</span> ${nota(b.rating, lang)} · ${esc(en ? (b.ratings === 1 ? '1 review' : `${b.ratings} reviews`) : (b.ratings === 1 ? '1 reseña' : `${b.ratings} reseñas`))}</a>${precioHtml ? ` <span aria-hidden="true">·</span> ${precioHtml}` : ''}</p>`
    : `<p class="neg-nota"><span class="muted">★ ${S.noRatings}</span>${precioHtml ? ` <span aria-hidden="true">·</span> ${precioHtml}` : ''}</p>`}
      <div class="badges">
        ${selloEntidad(local.entity_kind, lang)}
        ${organizador && !local.entity_kind ? `<span class="badge organiza">${esc(SA.organises)}</span>` : ''}
        ${b.is_verified ? `<span class="badge ok">✓ ${S.verified}</span>` : ''}
        ${since ? `<span class="badge">${S.since} ${esc(since)}</span>` : ''}
        ${b.redemptions_total ? `<span class="badge">${esc(S.redeemed(Number(b.redemptions_total)))}</span>` : ''}
      </div>
      ${estadoHtml}
      <nav class="neg-secciones" aria-label="${esc(b.name)}">
        ${nFlash ? `<a class="chip" href="#ahora">${esc(S.now)} <span class="muted">${nFlash}</span></a>` : ''}
        ${nEvents ? `<a class="chip" href="#proximamente">${esc(S.soon)} <span class="muted">${nEvents}</span></a>` : ''}
        ${partidos ? `<a class="chip" href="#partidos">${esc(S.matches)}</a>` : ''}
        ${novedades.length ? `<a class="chip" href="#novedades">${esc(S.news)}</a>` : ''}
        ${hayCarta ? `<a class="chip" href="#carta">${esc(S.menu)}</a>` : ''}
        <a class="chip" href="#resenas">${esc(S.reviews)}</a>
        ${conPreguntas ? `<a class="chip" href="#preguntas">${esc(S.questions)}${nPreguntas ? ` <span class="muted">${nPreguntas}</span>` : ''}</a>` : ''}
      </nav>
    </div>
    <div class="d-body">
      ${flash.length ? `<h2 id="ahora">${S.now}</h2>${rejilla(flash, lang, { tz, sinNegocio: true, galeria: true })}` : ''}
      ${events.length ? `<h2 id="proximamente">${S.soon}</h2>${rejilla(events, lang, { tz, sinNegocio: true, galeria: true })}` : ''}
      ${paginador(pagina, paginas, enlacePagina)}
      ${local.entity_kind === 'public_agenda' && b.city && nFlash + nEvents > POR_PAGINA_FICHA ? `<p><a class="pill" href="${city}">${esc(S.allAgenda(b.city))}</a></p>` : ''}
      ${offers.length || nFlash + nEvents || parado ? '' : `<p class="empty">${S.none}</p>`}
      ${quePedir}
      ${elSitio}
      ${cartaFicha}
      ${enlacesHtml ? `<div class="acciones neg-enlaces">${enlacesHtml}</div>` : ''}
      ${grupoHtml}
      ${partidos}
      ${sorteosHtml}
      ${sellos.length ? `<h2>${sellos.length > 1 ? S.stampsMany : S.stamps}</h2>
        ${sellos.map((c) => `<p class="callout"${isUuid(c.id) ? ` data-tarjeta="${c.id}"` : ''}>${mismoNombre(c.name) ? '' : `<b>${esc(c.name)}</b> · `}${esc(S.stampsBody(c.goal, c.reward))}<br><small>${esc(queSellaTarjeta(c, S, en))}</small></p>`).join('')}
        <p class="muted">${esc(sellos.some((c) => c.by_visit) ? S.stampsNoteVisit : S.stampsNote)}</p>` : ''}
      ${exclusivas}
      ${novedades.length ? `<h2 id="novedades">${S.news}</h2>
        <p data-tr-nota="post:" hidden></p>
        <div class="novedades">${novedades.map(novedadHtml).join('')}</div>
        ${Number(b.posts) > novedades.length ? `<p><a class="pill" href="${path}?ver=novedades">${esc(S.seeAll(Number(b.posts)))}</a></p>` : ''}` : ''}
      <h2 id="resenas">${S.reviews}${b.rating && b.ratings ? ` <small class="muted">★ ${nota(b.rating, lang)} (${b.ratings})</small>` : ''}</h2>
      <p><a class="pill" data-opinar="${esc(b.id)}" href="${cuenta(lang)}#/opinar/${encodeURIComponent(b.id)}">${icono('resena', 16)} <span>${S.write}</span></a></p>
      ${opiniones.length ? `<div class="resenas">${opiniones.map(resenaHtml).join('')}</div>
        ${nResenas > opiniones.length ? `<p><a class="pill" href="${path}?ver=resenas${soloVerificadas ? '&amp;resenas=verificadas' : ''}">${esc(S.seeAll(nResenas))}</a></p>` : ''}` : `<p class="empty">${soloVerificadas ? S.noVerified : S.noReviews}</p>`}
      ${preguntasHtml}
      ${b.city ? `<p class="muted">${esc(S.moreIn(b.city))} <a href="${cityToday}">${esc(S.cityToday)}</a> · <a href="${city}">${esc(S.cityWeek)}</a></p>` : ''}
      ${local.entity_kind === 'public_agenda' ? '' : `<p class="denuncia-pie" data-solo-publico><a href="${cuenta(lang)}#/reclamar/${encodeURIComponent(b.id)}" rel="nofollow">${S.claim}</a></p>`}
    </div>
    <aside class="side">
      <h2 class="side-h contacto-h">${S.contact}</h2>
      ${maps && !parado ? toquesContacto({}, lang, { lat: b.lat, lng: b.lng }) : ''}
      <div class="info">
        ${where ? `<div><span>${icono('lugar')}</span><span>${maps ? `<a href="${esc(maps)}" rel="nofollow noopener" target="_blank">${esc(where)}</a>` : esc(where)}</span></div>` : ''}
        ${b.phone ? `<div><span>${icono('telefono')}</span><span><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></span></div>` : ''}
        ${seguro(b.website) ? `<div><span>${icono('web')}</span><span><a href="${esc(seguro(b.website))}" rel="nofollow noopener" target="_blank">${esc(String(b.website).replace(/^https?:\/\//, ''))}</a></span></div>` : ''}
        ${enlaceCarta ? `<div><span>${icono('carta')}</span><span><a href="#carta">${S.menu}</a></span></div>` : ''}
        ${b.contact_email ? `<div><span>${icono('correo')}</span><span><a href="mailto:${esc(b.contact_email)}">${esc(b.contact_email)}</a></span></div>` : ''}
        ${redes.length ? `<div><span>${icono('redes')}</span><span>${redes.join(' · ')}</span></div>` : ''}
      </div>
      <p class="acciones" style="margin:12px 0 0">${compartirBoton(lang, `${BASE}${path}`, b.name)}${historiaBoton(lang, 'b', slug || b.id)}</p>
    </aside>
  </div>`;

  const bits = [];
  if (b.rating && b.ratings) bits.push(`★ ${nota(b.rating, lang)} (${b.ratings})`);
  const uno = (n, es1, esN, en1, enN) => `${n} ${n === 1 ? (en ? en1 : es1) : (en ? enN : esN)}`;
  if (nFlash) bits.push(`${uno(nFlash, 'oferta flash', 'ofertas flash', 'flash offer', 'flash offers')} ${en ? 'now' : 'ahora'}`);
  if (nEvents) bits.push(uno(nEvents, 'evento', 'eventos', 'event', 'events'));
  if (where) bits.push(where);
  else if (organizador && b.city) bits.push(b.city);
  const description = `${bits.join(' · ')}${b.description ? ` — ${b.description}` : ''}`.slice(0, 200);

  // Un organizador, como `Organization`: sin dirección ni coordenadas (su
  // punto es una zona), con sus próximas fechas.
  const negocioLd = organizador ? {
    '@type': 'Organization', '@id': `${BASE}/b/${slug || id}#negocio`, name: b.name, description: b.description || undefined,
    url: `${BASE}${path}`, logo: b.logo || undefined, image: b.cover || b.logo || undefined, telephone: b.phone || undefined,
    areaServed: b.city ? { '@type': 'City', name: b.city } : undefined,
    aggregateRating: b.rating && b.ratings
      ? { '@type': 'AggregateRating', ratingValue: Number(b.rating).toFixed(1), reviewCount: b.ratings }
      : undefined,
    sameAs: seguro(b.website) ? [b.website] : undefined,
    event: fechasOrg.length ? fechasOrg.slice(0, 20).map((d) => {
      const w = KA.donde(d);
      return { '@type': 'Event', name: d.title, startDate: d.starts_at, url: `${BASE}${pre(lang)}/o/${d.offer_id}`,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: w.sitio || b.name, address: d.venue_address || b.city || undefined } };
    }) : undefined,
  } : {
    '@type': 'LocalBusiness', '@id': `${BASE}/b/${slug || id}#negocio`, name: b.name, description: b.description || undefined,
    url: `${BASE}${path}`, image: b.cover || b.logo || undefined, telephone: b.phone || undefined,
    address: where
      ? { '@type': 'PostalAddress', streetAddress: b.address || undefined, addressLocality: b.city || undefined, addressCountry: 'ES' }
      : undefined,
    geo: b.lat ? { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng } : undefined,
    aggregateRating: b.rating && b.ratings
      ? { '@type': 'AggregateRating', ratingValue: Number(b.rating).toFixed(1), reviewCount: b.ratings }
      : undefined,
    sameAs: seguro(b.website) ? [b.website] : undefined,
    hasMenu: enlaceCarta || (pdfsCarta[0] && pdfsCarta[0].url) || (carta.length ? `${BASE}${path}#carta` : undefined),
  };
  const migas = [['Klendar', en ? '/en/' : '/']];
  if (city) migas.push([b.city, city]);
  migas.push([b.name, path]);
  const jsonLd = { '@context': 'https://schema.org', '@graph': [negocioLd, breadcrumbLd(migas)] };

  // En el título, la ciudad: «Café Central · Madrid» es lo que se busca (si
  // el nombre ya la lleva, «FitBox Madrid», no se repite).
  const plano = (t) => String(t || '').normalize('NFD').replace(/[^a-zA-Z0-9]+/g, ' ').toLowerCase().trim();
  const conCiudad = b.city && !` ${plano(b.name)} `.includes(` ${plano(b.city)} `);
  // Abierta desde el QR del local (`/v/<código>` trae `?visita=`): si el
  // local da sellos por visita, el sello de hoy y un aviso encima de la
  // ficha. Lo hace el navegador, con la sesión de «Tu cuenta».
  const visita = new URLSearchParams(search).get('visita') || '';
  const conVisita = /^[A-Za-z0-9_-]{16}$/.test(visita)
    ? `<script src="/assets/vendor/supabase-js-2.117.2.js" integrity="sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok" crossorigin="anonymous" defer></script>
<script src="/config.js?v=3" defer></script>
<script src="/assets/visita.js?v=3" defer data-token="${esc(visita)}" data-lang="${en ? 'en' : 'es'}"></script>`
    : '';
  return html(publicPage({
    lang, path, body: body + MENU_JS + COMPARTIR_JS, title: conCiudad ? `${b.name} · ${b.city}` : b.name, description, image: b.cover || b.logo,
    consulta: pagina > 1 ? `?p=${pagina}` : '',
    head: `<meta name="robots" content="${b.adults_only || conVisita || b.closed_indefinitely || parado ? 'noindex' : pagina > 1 ? 'noindex, follow' : 'index, follow'}">
${ldScript(jsonLd)}${cuentaToques ? `
<script src="/assets/enlaces.js?v=3" defer data-url="${esc(supabasePublic().url)}" data-key="${esc(supabasePublic().key)}" data-biz="${esc(b.id)}"></script>` : ''}${horario ? '\n<script src="/assets/zona.js?v=2" defer></script>\n<script src="/assets/horario.js?v=4" defer></script>\n<script src="/assets/cerrado.js?v=1" defer></script>' : ''}${conVisita ? `\n${conVisita}` : ''}${crowdOn ? `\n${sitioAhoraScripts(lang)}` : ''}
${traducir(lang, `business:${b.id}`, carta.length ? `menu:${b.id}` : '')}${conPreguntas ? `
${PREGUNTAS_CSS}
${preguntasScript}` : ''}${partidos ? `
${PARTIDOS_CSS}` : ''}${grupoHtml || sorteosHtml ? `
${GRUPOS_CSS}` : ''}`,
  }), 200, conVisita ? 'no-store' : undefined);
}

// ── Agenda de una ciudad ───────────────────────────────────────────────────
const PRETTY = (s) => String(s || '').replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('es'));

export async function agendaPage(rawCity, lang) {
  const en = lang === 'en';
  // Mal codificada: «esa ciudad no está» (404), no un 500.
  const dec = decodeSeg(rawCity);
  if (dec == null) return notFound(lang, `${agendaBase(lang)}/`, 'c');
  const raw = dec.replace(/[/]+$/, '');
  const path = `${agendaBase(lang)}/${citySeg(raw)}/`;
  if (!raw || raw.length > 60) return notFound(lang, path, 'c');

  const [offers, negocios, cats] = await Promise.all([
    rpcAll('public_city_agenda', { p_city: raw, p_limit: 60 }),
    rpc('public_businesses', { p_city: raw, p_limit: 12 }),
    rpcAll('public_categories', { p_city: raw }),
  ]);
  const city = PRETTY(offers[0]?.city || negocios?.items?.[0]?.city || raw);
  // La agenda no trae coordenadas: la zona de cada negocio se lee aparte.
  // Cada tarjeta va en la hora de su negocio; los días, en la de la ciudad
  // (la de la mayoría de sus negocios).
  const { zonas } = await datosDeNegocios(offers.map((o) => o.business_id));
  const tzDe = (o) => zonas.get(o.business_id) || zonaDe(o);
  const tzCiudad = KZ.comun(offers.map(tzDe));

  const S = en
    ? {
        h1: `Things to do in ${city} this week`,
        title: `Things to do in ${city} this week: events and deals`,
        desc: (n) => `${n} events and deals in ${city} over the next few days: flash offers with a countdown and local events. No account needed to browse.`,
        lead: 'Flash offers and local events for the next few days. No account needed to browse; to get a code, log in here on the website or in the app.',
        none: `Nothing published in ${city} yet. If you run a business here, you can be the first.`,
        biz: 'List your business', all: 'Other cities', app: 'Create a free account', agenda: "What's on",
        days: 'Days', places: 'Places in this city', explore: 'Explore everything',
        note: "Updated as businesses publish. Times are each business's local time.",
      }
    : {
        h1: `Qué hacer en ${city} esta semana`,
        title: `Qué hacer en ${city} esta semana: planes y ofertas`,
        desc: (n) => `${n} planes y ofertas en ${city} para los próximos días: ofertas flash con cuenta atrás y eventos de los negocios de la ciudad. Sin cuenta para mirar.`,
        lead: 'Ofertas flash y planes de los próximos días. Para mirar no hace falta cuenta; para conseguir el código, entra aquí en la web o en la app.',
        none: `Todavía no hay nada publicado en ${city}. Si tienes un negocio aquí, puedes ser el primero.`,
        biz: 'Publicar mi negocio', all: 'Otras ciudades', app: 'Crear cuenta gratis', agenda: 'Agenda',
        days: 'Días', places: 'Negocios de esta ciudad', explore: 'Explorar todo',
        note: 'Se actualiza según van publicando los negocios. Horas locales de cada negocio.',
      };

  // Agrupado por día: una agenda se lee por días, no por relevancia. Lo que
  // empezó antes y sigue en marcha (una oferta flash de anoche que dura
  // hasta hoy) va en «Hoy», no bajo un día que ya pasó.
  const hoy = KZ.hoy(tzCiudad);
  const manana = KZ.hoy(tzCiudad, 1);
  const days = new Map();
  for (const o of offers) {
    const dia = KZ.dia(o.starts_at, tzCiudad);
    const key = dia < hoy ? hoy : dia;
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(o);
  }
  const orden = [...days.keys()].sort();
  const rel = (iso) => (iso === hoy ? (en ? 'Today' : 'Hoy') : iso === manana ? (en ? 'Tomorrow' : 'Mañana') : '');
  // `iso` es un día sin hora («2026-10-03»): se escribe tal cual, en UTC.
  const dayTitle = (iso) => {
    const d = KZ.fmt(`${iso}T12:00:00Z`, 'UTC', en ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return rel(iso) ? `${rel(iso)} · ${d}` : d;
  };
  // Para los botones de arriba: «vie 26», que caben varios en una línea.
  const shortDay = (iso) => rel(iso) || KZ.fmt(`${iso}T12:00:00Z`, 'UTC', en ? 'en-GB' : 'es-ES', {
    weekday: 'short', day: 'numeric',
  });

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${agendaBase(lang)}/">${S.agenda}</a></p>
  <h1>${esc(S.h1)}</h1>
  <p class="muted" style="max-width:620px">${esc(S.lead)}</p>
  ${cityLinks(lang, raw, city, cats, 'semana')}
  ${days.size > 1 ? `<div class="filters"><div class="frow"><span class="flabel">${esc(S.days)}</span>
    ${orden.map((iso) => `<a class="chip" href="#d${iso}">${esc(shortDay(iso))}</a>`).join('')}
  </div></div>` : ''}
  ${offers.length
    ? orden.map((iso) => [iso, days.get(iso)]).map(([iso, list]) => `<section class="daygroup" id="d${iso}">
        <h2>${esc(dayTitle(iso))}</h2>
        ${rejilla(list, lang, { tzDe, primera: iso === orden[0] })}
      </section>`).join('')
    : `<p class="empty">${esc(S.none)}</p>`}
  ${placesBlock(negocios, lang, S.places)}
  <p class="muted" style="font-size:13px">${esc(S.note)}</p>
  <p><a class="pill accent" href="${exploreBase(lang)}/?${en ? 'city' : 'ciudad'}=${encodeURIComponent(city)}">${S.explore}</a>
     <a class="pill" href="${cuenta(lang)}#/registro" data-sin-sesion>${S.app}</a>
     <a class="pill" href="${en ? '/en/for-business/' : '/para-negocios/'}">${S.biz}</a></p>
  <p><a href="${agendaBase(lang)}/">${S.all} →</a></p>`;

  const description = offers.length ? S.desc(offers.length) : S.none;
  const jsonLd = offers.length
    ? listingLd({
        lang, path, name: S.h1, description, city, items: offers,
        migas: [['Klendar', en ? '/en/' : '/'], [S.agenda, `${agendaBase(lang)}/`], [city, path]],
      })
    : null;

  return html(publicPage({
    lang, actual: 'explorar', path, body,
    title: S.title,
    description,
    image: offers.map((o) => firstPhoto(o.images)).find(Boolean),
    head: jsonLd ? ldScript(jsonLd) : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=300, s-maxage=900');
}

/** «Negocios de esta ciudad»: enlaces a sus fichas, por su dirección con nombre. */
function placesBlock(negocios, lang, titulo) {
  const items = negocios?.items || [];
  if (!items.length) return '';
  return `<section class="daygroup">
    <h2>${esc(titulo)}</h2>
    <div class="cities">${items.map((b) => `<a href="${esc(bizPath(lang, b.slug || b.id))}">${esc(b.name)}${b.live ? ` <span class="muted">${b.live}</span>` : ''}</a>`).join('')}</div>
  </section>`;
}

// ── Hoy en una ciudad ──────────────────────────────────────────────────────
/**
 * «Qué hacer hoy en Madrid»: lo que se busca con el móvil en la mano. Lo que
 * está en marcha ahora mismo, lo que empieza más tarde y, para que la página
 * nunca se quede en blanco, un adelanto de mañana. Enlaza con la semana y
 * con cada categoría de la ciudad.
 */
export async function todayPage(rawCity, lang) {
  const en = lang === 'en';
  const dec = decodeSeg(rawCity);
  if (dec == null) return notFound(lang, `${todayBase(lang)}/`, 'c');
  const raw = dec.replace(/[/]+$/, '');
  const path = `${todayBase(lang)}/${citySeg(raw)}/`;
  if (!raw || raw.length > 60) return notFound(lang, path, 'c');

  const [hoyRes, mananaRes, cats, negocios] = await Promise.all([
    rpc('public_explore', { p_city: raw, p_filters: { when: 'today' }, p_limit: 60 }),
    rpc('public_explore', { p_city: raw, p_filters: { when: 'tomorrow' }, p_limit: 6 }),
    rpcAll('public_categories', { p_city: raw }),
    rpc('public_businesses', { p_city: raw, p_limit: 12 }),
  ]);
  const hoyItems = hoyRes?.items || [];
  const mananaItems = mananaRes?.items || [];
  const lugares = negocios?.items || [];
  // Una ciudad sin nada de nada (mal escrita, o donde aún no hay negocios).
  if (!hoyItems.length && !mananaItems.length && !lugares.length) return notFound(lang, path, 'c');

  const city = PRETTY(hoyItems[0]?.city || mananaItems[0]?.city || lugares[0]?.city || raw);
  const tzCiudad = KZ.comun([...hoyItems, ...mananaItems].map((o) => zonaDe(o)));
  const fecha = KZ.fmt(`${KZ.hoy(tzCiudad)}T12:00:00Z`, 'UTC', en ? 'en-GB' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const ya = Date.now();
  const empezado = (o) => new Date(o.starts_at || 0).getTime() <= ya;
  const ahora = hoyItems.filter(empezado);
  const luego = hoyItems.filter((o) => !empezado(o));

  const S = en
    ? {
        h1: `Things to do in ${city} today`,
        title: `Things to do in ${city} today: events and deals`,
        desc: (n) => `${n} ${n === 1 ? 'plan' : 'plans'} for today in ${city}: flash offers with a countdown and local events, live right now or later today. No account needed to browse.`,
        descNone: `Nothing more for today in ${city}. Here's what's coming up tomorrow and the places in the city.`,
        lead: (f) => `Today is ${f}. What's on right now and later today at local businesses. Times are local.`,
        now: 'On right now', later: 'Later today', tomorrow: 'Tomorrow',
        none: 'Nothing more published for today. Have a look at tomorrow or the rest of the week.',
        places: 'Places in this city', week: `The whole week in ${city}`, agenda: "What's on", today: 'Today',
        explore: 'Explore with filters', biz: 'List your business',
      }
    : {
        h1: `Qué hacer hoy en ${city}`,
        title: `Qué hacer hoy en ${city}: planes y ofertas de hoy`,
        desc: (n) => `${n} ${n === 1 ? 'plan' : 'planes'} para hoy en ${city}: ofertas flash con cuenta atrás y eventos de los negocios de la ciudad, ahora mismo o más tarde. Sin cuenta para mirar.`,
        descNone: `Hoy ya no queda nada más en ${city}. Aquí tienes lo de mañana y los negocios de la ciudad.`,
        lead: (f) => `Hoy es ${f}. Lo que hay ahora mismo y lo que empieza más tarde en los negocios de la ciudad. Horas locales.`,
        now: 'Ahora mismo', later: 'Más tarde, hoy', tomorrow: 'Mañana',
        none: 'Para hoy ya no hay nada más publicado. Mira lo de mañana o el resto de la semana.',
        places: 'Negocios de esta ciudad', week: `Toda la semana en ${city}`, agenda: 'Agenda', today: 'Hoy',
        explore: 'Explorar con filtros', biz: 'Publicar mi negocio',
      };

  const bloque = (titulo, items) => (items.length
    ? `<section class="daygroup"><h2>${esc(titulo)}</h2>
        ${rejilla(items, lang)}</section>`
    : '');

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${agendaBase(lang)}/">${S.agenda}</a> · <a href="${agendaBase(lang)}/${citySeg(raw)}/">${esc(city)}</a></p>
  <h1>${esc(S.h1)}</h1>
  <p class="muted" style="max-width:620px">${esc(S.lead(fecha))}</p>
  ${cityLinks(lang, raw, city, cats, 'hoy')}
  ${bloque(S.now, ahora)}
  ${bloque(S.later, luego)}
  ${hoyItems.length ? '' : `<p class="empty">${esc(S.none)}</p>`}
  ${bloque(S.tomorrow, mananaItems)}
  ${placesBlock(negocios, lang, S.places)}
  <p><a class="pill accent" href="${agendaBase(lang)}/${citySeg(raw)}/">${esc(S.week)}</a>
     <a class="pill" href="${exploreBase(lang)}/?${en ? 'city' : 'ciudad'}=${encodeURIComponent(city)}&amp;${en ? 'when=today' : 'cuando=hoy'}">${esc(S.explore)}</a>
     <a class="pill" href="${en ? '/en/for-business/' : '/para-negocios/'}">${esc(S.biz)}</a></p>`;

  const description = hoyItems.length ? S.desc(hoyItems.length) : S.descNone;
  const jsonLd = listingLd({
    lang, path, name: S.h1, description, city, items: hoyItems,
    migas: [['Klendar', en ? '/en/' : '/'], [S.agenda, `${agendaBase(lang)}/`], [city, `${agendaBase(lang)}/${citySeg(raw)}/`], [S.today, path]],
  });

  return html(publicPage({
    lang, actual: 'explorar', path, body,
    title: S.title,
    description,
    image: [...hoyItems, ...mananaItems].map((o) => firstPhoto(o.images)).find(Boolean),
    // Un día sin nada no se desindexa: mañana vuelve a haber, y la página
    // sigue teniendo lo de mañana y los negocios de la ciudad.
    head: ldScript(jsonLd),
  }), 200, 'public, max-age=300, s-maxage=600');
}

// ── Índice de ciudades ─────────────────────────────────────────────────────
export async function citiesPage(lang) {
  const en = lang === 'en';
  const cities = (await rpcAll('public_cities', {})).filter((c) => c.city);

  const S = en
    ? {
        h1: "What's on near you",
        lead: 'Flash offers and plans for the next few days, city by city. No account needed.',
        none: 'No city has anything published yet.', biz: 'List your business',
        today: 'Things to do today', todayIn: (c) => `Today in ${c}`,
      }
    : {
        h1: 'Agenda local',
        lead: 'Lo que hay en cada ciudad: ofertas flash y planes de los próximos días. No hace falta cuenta.',
        none: 'Todavía no hay ninguna ciudad con publicaciones.', biz: 'Publicar mi negocio',
        today: 'Qué hacer hoy', todayIn: (c) => `Hoy en ${c}`,
      };

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a></p>
  <h1>${S.h1}</h1>
  <p class="muted" style="max-width:620px">${S.lead}</p>
  ${cities.length
    ? `<div class="cities">${cities.map((c) => `<a href="${agendaBase(lang)}/${citySeg(c.city)}/">${esc(c.city)} <span class="muted">${c.n}</span></a>`).join('')}</div>
    <h2>${S.today}</h2>
    <div class="cities">${cities.map((c) => `<a href="${todayBase(lang)}/${citySeg(c.city)}/">${esc(S.todayIn(c.city))}</a>`).join('')}</div>`
    : `<p class="empty">${S.none}</p>`}
  <p><a class="pill" href="${en ? '/en/for-business/' : '/para-negocios/'}">${S.biz}</a></p>`;

  return html(publicPage({
    lang, actual: 'explorar', path: `${agendaBase(lang)}/`, body, title: S.h1, description: S.lead,
  }), 200, 'public, max-age=600, s-maxage=1800');
}

// ── Enlace de amigo ────────────────────────────────────────────────────────
/**
 * klendar.app/amigo/<código> (y /en/friend/<código>): el enlace de amigo que
 * alguien comparte. Con la app instalada lo abre la app; si no, llega aquí.
 * La página es pública, así que no dice de quién es: eso se ve al entrar en
 * «Tu cuenta» (`#/amigo/<código>`), que pregunta a la base con tu sesión y
 * deja aceptar. Ni se indexa ni se guarda en caché.
 */
export function friendLinkPage(code, lang) {
  const en = lang === 'en';
  const path = en ? `/en/friend/${code}` : `/amigo/${code}`;
  if (!/^[A-Za-z0-9_-]{16}$/.test(code || '')) return notFound(lang, path, 'a');
  const S = en
    ? {
        title: "You've been invited to be friends on Klendar",
        text: 'Someone has sent you their friend link. Log in with your account to see who it is and accept.',
        web: 'Continue on the web', app: 'Open in the app',
      }
    : {
        title: 'Te han invitado a ser amigos en Klendar',
        text: 'Alguien te ha mandado su enlace de amigo. Entra con tu cuenta para ver quién es y aceptar.',
        web: 'Seguir en la web', app: 'Abrir en la app',
      };
  const body = `
  <div class="amigo-pub">
    <p class="amigo-pub-ic" aria-hidden="true">${icono('invitar', 34)}</p>
    <h1>${esc(S.title)}</h1>
    <p class="muted">${esc(S.text)}</p>
    <p class="acciones">
      <a class="pill accent big" href="${cuenta(lang)}#/amigo/${esc(code)}" rel="nofollow">${esc(S.web)}</a>
      ${openInApp(`/amigo/${code}`, S.app, 'pill big')}
    </p>
  </div>`;
  const res = html(publicPage({
    contador: false,
    lang, path, body, title: S.title, description: S.text,
    head: '<meta name="robots" content="noindex, nofollow">\n<meta name="referrer" content="no-referrer">',
  }), 200, 'no-store');
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  return res;
}
