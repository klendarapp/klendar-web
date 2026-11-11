// Explorar › Sitios en la web (`/explorar?que=sitios`, `/en/explore?what=places`),
// como la app (tanda D, migración 20261236100000): los negocios con local,
// tengan o no planes, por cercanía; también con la ficha a medias (sin foto o
// sin horario, después de los completos: migración 20261274500000). Aquí, lo
// que pinta cada fila, el mapa y sus estilos; la página la arma `explore.js`.

import { esc, supabasePublic } from './page.js';
import { bizPath } from './public.js';
import KZ from '../../assets/zona.js';
import KS from '../../assets/sitios.js';
import KM from '../../assets/marcas.js';

// (`KZ` se importa para que `KlendarZona` esté puesto cuando `KS` lo use.)
void KZ;

/** Los textos de Sitios (los demás de Explorar están en `explore.js`). */
export const TS = (en) => (en
  ? {
      plans: 'Plans', places: 'Places', what: 'What are you looking for?',
      lead: 'Places near you, whether or not they have plans on. No account needed to browse.',
      count: (n) => `${n} ${n === 1 ? 'place' : 'places'}`,
      plansToday: (n) => (n === 1 ? '1 plan today' : `${n} plans today`),
      plansTodayTpl: { uno: '1 plan today', varios: '{n} plans today' },
      highlight: (x) => `What to order here: ${x}`,
      dailyMenu: 'Daily menu',
      emptyTitle: 'No places around here yet', emptyTitleFiltered: 'No places with those filters',
      emptyBody: (d) => `Places ${d} show up here, with or without plans. Widen the distance or clear filters to see more.`,
      emptyBodyNoZone: 'Places show up here, with or without plans. Choose where to look or clear filters to see more.',
      end: (d) => `You’ve seen every place ${d}`,
      onlyPlaces: 'Places only', removeOnlyPlaces: 'Remove “Places only”',
      seePlace: 'See the place', mapNo: "The map can't load right now. The list shows the same places.",
      onMap: 'Places on the map',
    }
  : {
      plans: 'Planes', places: 'Sitios', what: '¿Qué buscas?',
      lead: 'Los sitios de tu zona, tengan o no planes. Para mirar no hace falta cuenta.',
      count: (n) => `${n} ${n === 1 ? 'sitio' : 'sitios'}`,
      plansToday: (n) => (n === 1 ? '1 plan hoy' : `${n} planes hoy`),
      plansTodayTpl: { uno: '1 plan hoy', varios: '{n} planes hoy' },
      highlight: (x) => `Qué pedir aquí: ${x}`,
      dailyMenu: 'Menú del día',
      emptyTitle: 'Aún no hay sitios por aquí', emptyTitleFiltered: 'No hay sitios con esos filtros',
      emptyBody: (d) => `Aquí salen los sitios ${d}, tengan o no planes. Amplía la distancia o quita filtros para ver más.`,
      emptyBodyNoZone: 'Aquí salen los sitios, tengan o no planes. Elige dónde mirar o quita filtros para ver más.',
      end: (d) => `Has visto todos los sitios ${d}`,
      onlyPlaces: 'Solo sitios', removeOnlyPlaces: 'Quitar «Solo sitios»',
      seePlace: 'Ver el sitio', mapNo: 'El mapa no se puede cargar ahora mismo. En la lista están los mismos sitios.',
      onMap: 'Sitios en el mapa',
    });

/** «350 m», «1,2 km» (como la app). */
export function distancia(m, en) {
  if (!Number.isFinite(m)) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  const s = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return `${en ? s : s.replace('.', ',')} km`;
}


const IC = {
  menu: 'M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z',
  estrella: 'M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z',
  der: 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z',
};
const ic = (n, s = 16) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${IC[n]}"/></svg>`;

/**
 * Una fila: foto (la portada; si no, el logo; sin ninguno, las iniciales sobre
 * un fondo neutro), nombre, categoría y distancia; el horario de ahora (lo
 * vuelve a escribir /assets/sitios.js con la hora del navegador); su menú
 * del día o «Qué pedir aquí»; y «2 planes hoy» con el estilo de la etiqueta
 * de oferta. Toda la fila lleva a la ficha. [conDistancia]: solo con «Cerca
 * de ti» (desde el centro de una ciudad no dice nada).
 */
export function filaSitio(p, lang, { conDistancia = true } = {}) {
  const en = lang === 'en';
  const cat = (en ? p.names?.en : p.names?.es) || p.names?.es || '';
  const meta = [cat, p.distance_txt || (conDistancia ? distancia(p.distance_m, en) : '')].filter(Boolean).join(' · ');
  const precioLocal = KM.simbolo(Number(p.price_level));
  return `<a class="sitio-fila" href="${esc(bizPath(lang, p.slug || p.id))}">
    ${p.photo || p.logo ? `<img src="${esc(p.photo || p.logo)}" alt="" width="76" height="76" loading="lazy" decoding="async">` : `<span class="ph iniciales" aria-hidden="true">${esc(KS.iniciales(p.name))}</span>`}
    <span class="sitio-cuerpo">
      <b>${esc(p.name)}</b>
      ${meta || precioLocal ? `<span class="muted">${esc(meta)}${precioLocal ? `${meta ? ' · ' : ''}<span aria-label="${esc(KM.t(lang).priceA11y + KM.significado(Number(p.price_level), lang))}">${precioLocal}</span>` : ''}</span>` : ''}
      ${KS.detallesHtml(p, en ? 'en' : 'es')}
    </span>
    <span class="ncard-ir" aria-hidden="true">${ic('der', 20)}</span>
  </a>`;
}

/** El mapa de Sitios: lo pinta /assets/sitios.js con `map_places`. */
export function mapaSitios({ lang, centro, zoom, filtros, desde = null }) {
  const en = lang === 'en';
  const S = TS(en);
  const sp = supabasePublic();
  const datos = {
    url: sp.url, key: sp.key, centro, zoom, filtros, desde,
    no: S.mapNo, ver: S.seePlace, base: en ? '/en/b/' : '/b/', lang: en ? 'en' : 'es',
  };
  return `<div id="mapa-sitios" class="mapa-explorar" role="region" aria-label="${esc(S.onMap)}" data-sitios="${esc(JSON.stringify(datos))}"></div>`;
}

/** Los scripts de la página de Sitios (la hora de cada fila y el mapa). */
export const SITIOS_SCRIPTS = `<script src="/assets/zona.js?v=2" defer></script>
<script src="/assets/iconos-mapa.js?v=2" defer></script>
<script src="/assets/mapa.js?v=7" defer></script>
<script src="/assets/sitios.js?v=10" defer></script>`;

export const SITIOS_CSS = `<style>
/* Sin saltos al cambiar entre Planes y Sitios: la barra de desplazamiento
   reserva su sitio en toda la web (site.css). */
/* La fila de arriba de Explorar, como la de la app (\`ExploreTopRow\`):
   «Planes | Sitios» a la izquierda y, a la derecha, los botones redondos
   (la lista de la web, buscar y el de la vista). Con la letra grande o en
   320 px, «Planes | Sitios» se encoge antes de que nada se salga. */
.que-fila { display: flex; align-items: center; gap: 8px; margin: 4px 0 10px; }
.que { display: inline-flex; min-width: 0; padding: 4px; gap: 2px; border-radius: 999px; background: var(--soft); border: 1px solid var(--glass-border); }
.exp-acciones { display: flex; align-items: center; gap: 8px; flex: none; margin-left: auto; }
.pub .exp-boton { width: 48px; height: 48px; display: grid; place-items: center; flex: none; border-radius: 50%;
  background: var(--glass); border: 1px solid var(--glass-border); color: var(--ink); text-decoration: none; }
.pub .exp-boton:hover { border-color: var(--ink-2); text-decoration: none; }
.exp-boton:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.pub .que a { display: inline-flex; align-items: center; padding: 8px 18px; min-height: 40px; border-radius: 999px; font-weight: 700; color: var(--ink); text-decoration: none; }
.pub .que a.on { background: var(--ink); color: var(--surface); }
@media (max-width: 560px) {
  .pub .que a { padding: 8px 14px; }
  .exp-acciones { gap: 6px; }
  .pub .exp-boton { width: 44px; height: 44px; }
}
@media (max-width: 340px) { .pub .que a { padding: 8px 10px; } }
.sitios-lista { display: grid; gap: 10px; margin: 8px 0 18px; }
.pub .sitio-fila { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 22px; background: var(--elevated);
  border: 1px solid var(--glass-border); color: var(--ink); text-decoration: none; }
.sitio-fila:hover { text-decoration: none; border-color: var(--ink-2); }
.sitio-fila img, .sitio-fila .ph { width: 76px; height: 76px; border-radius: 16px; object-fit: cover; flex: none; background: var(--soft);
  display: inline-flex; align-items: center; justify-content: center; color: var(--ink-2); }
.sitio-cuerpo { display: grid; gap: 3px; min-width: 0; flex: 1; }
.sitio-cuerpo b { font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sitio-cuerpo .muted { font-size: 13px; }
.sitio-hora { font-size: 13px; font-weight: 600; color: var(--ink-2); }
.sitio-hora.abierto { color: var(--ink); }
/* Sin foto ni logo (ficha a medias): las iniciales, en gris sobre el neutro. */
.sitio-fila .ph.iniciales { font-weight: 800; font-size: 24px; letter-spacing: .02em; line-height: 1; }
/* El marcador de un sitio sin logo ni portada (\`marcaEl\` con \`iniciales\`). */
#mapa-sitios .marca .mc-cara.mc-iniciales { font-weight: 800; font-size: 13px; line-height: 1; letter-spacing: .01em; }
.sitio-festivo { font-size: 13px; font-weight: 600; color: var(--ink-2); }
.sitio-festivo.sin-confirmar { color: var(--ink); }
.pop-sitio { display: grid; gap: 3px; max-width: 260px; }
.pop-sitio .pop-ver { font-weight: 700; margin-top: 4px; }
.sitio-extra { display: flex; align-items: center; gap: 4px; font-size: 13px; min-width: 0; }
.sitio-extra span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sitio-extra .ic { flex: none; color: var(--ink-2); }
.tag-planes { justify-self: start; padding: 3px 9px; border-radius: 999px; background: var(--ink); color: var(--surface); font-weight: 800; font-size: 12px; margin-top: 3px; }
.pop .tag-planes, .pop span.tag-planes { display: inline-block; margin: 4px 0; color: var(--surface); font-size: 12px; }
.sitios-fin { text-align: center; margin: 18px 0 8px; }
.sitios-fin h2 { font-size: 17px; margin: 0 0 12px; }
.chip-solo { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 8px; }
</style>`;
