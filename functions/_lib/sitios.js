// Explorar › Sitios en la web (`/explorar/?que=sitios`, `/en/explore/?what=places`),
// como la app (tanda D, migración 20261236100000): los negocios con la ficha
// completa (foto y horario), tengan o no planes, por cercanía. Aquí, lo que
// pinta cada fila, el mapa y sus estilos; la página la arma `explore.js`.

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
      emptyBody: (d) => `Places ${d} with a complete profile show up here, with or without plans. Widen the distance or clear filters to see more.`,
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
      emptyBody: (d) => `Aquí salen los sitios ${d} con la ficha completa, tengan o no planes. Amplía la distancia o quita filtros para ver más.`,
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

/** «12,50 €» / «€12.50». */
const precio = (c, en) => (Number.isFinite(c) ? (en ? `€${(c / 100).toFixed(2)}` : `${(c / 100).toFixed(2).replace('.', ',')} €`) : '');

const IC = {
  menu: 'M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z',
  estrella: 'M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z',
  der: 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z',
  tienda: 'M21.9 8.89l-1.05-4.37c-.22-.9-1-1.52-1.91-1.52H5.05c-.9 0-1.69.63-1.9 1.52L2.1 8.89c-.24 1.02-.02 2.06.62 2.88.08.11.19.19.28.29V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-6.94c.09-.09.2-.18.28-.28.64-.82.87-1.87.62-2.89zM5 19v-6.03c.08.01.15.03.23.03.87 0 1.66-.36 2.24-.95.6.6 1.4.95 2.31.95.87 0 1.65-.36 2.23-.93.59.57 1.39.93 2.29.93.84 0 1.64-.35 2.24-.95.58.59 1.37.95 2.24.95.08 0 .15-.02.23-.03V19H5z',
};
const ic = (n, s = 16) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${IC[n]}"/></svg>`;

/**
 * Una fila: foto, nombre, categoría y distancia; el horario de ahora (lo
 * vuelve a escribir /assets/sitios.js con la hora del navegador); su menú
 * del día o «Qué pedir aquí»; y «2 planes hoy» con el estilo de la etiqueta
 * de oferta. Toda la fila lleva a la ficha. [conDistancia]: solo con «Cerca
 * de ti» (desde el centro de una ciudad no dice nada).
 */
export function filaSitio(p, lang, { conDistancia = true } = {}) {
  const en = lang === 'en';
  const S = TS(en);
  const cat = (en ? p.names?.en : p.names?.es) || p.names?.es || '';
  const meta = [cat, conDistancia ? distancia(p.distance_m, en) : ''].filter(Boolean).join(' · ');
  const tz = KZ.zona(p.time_zone);
  const hora = KS.horaTexto(p.hours, tz, en ? 'en' : 'es');
  const menu = p.daily_menu;
  const extra = menu
    ? `${ic('menu', 14)}<span>${esc([S.dailyMenu, precio(Number(menu.price_cents), en)].filter(Boolean).join(' · '))}</span>`
    : p.highlight?.title ? `${ic('estrella', 14)}<span>${esc(S.highlight(p.highlight.title))}</span>` : '';
  const planes = Number(p.plans_today) || 0;
  const precioLocal = KM.simbolo(Number(p.price_level));
  return `<a class="sitio-fila" href="${esc(bizPath(lang, p.slug || p.id))}">
    ${p.photo ? `<img src="${esc(p.photo)}" alt="" width="76" height="76" loading="lazy" decoding="async">` : `<span class="ph" aria-hidden="true">${ic('tienda', 28)}</span>`}
    <span class="sitio-cuerpo">
      <b>${esc(p.name)}</b>
      ${meta || precioLocal ? `<span class="muted">${esc(meta)}${precioLocal ? `${meta ? ' · ' : ''}<span aria-label="${esc(KM.t(lang).priceA11y + KM.significado(Number(p.price_level), lang))}">${precioLocal}</span>` : ''}</span>` : ''}
      ${hora.texto ? `<span class="sitio-hora${hora.abierto ? ' abierto' : ''}" data-sitio-hora="${esc(JSON.stringify(p.hours))}" data-tz="${esc(tz)}" data-lang="${en ? 'en' : 'es'}">${esc(hora.texto)}</span>` : ''}
      ${extra ? `<span class="sitio-extra">${extra}</span>` : ''}
      ${planes ? `<span class="tag-oferta">${esc(S.plansToday(planes))}</span>` : ''}
    </span>
    <span class="ncard-ir" aria-hidden="true">${ic('der', 20)}</span>
  </a>`;
}

/** El mapa de Sitios: lo pinta /assets/sitios.js con `map_places`. */
export function mapaSitios({ lang, centro, zoom, filtros }) {
  const en = lang === 'en';
  const S = TS(en);
  const sp = supabasePublic();
  const datos = {
    url: sp.url, key: sp.key, centro, zoom, filtros,
    no: S.mapNo, ver: S.seePlace, base: en ? '/en/b/' : '/b/', ...S.plansTodayTpl,
  };
  return `<div id="mapa-sitios" class="mapa-explorar" role="region" aria-label="${esc(S.onMap)}" data-sitios="${esc(JSON.stringify(datos))}"></div>`;
}

/** Los scripts de la página de Sitios (la hora de cada fila y el mapa). */
export const SITIOS_SCRIPTS = `<script src="/assets/zona.js?v=2" defer></script>
<script src="/assets/sitios.js?v=1" defer></script>`;

export const SITIOS_CSS = `<style>
.que-fila { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 4px 0 10px; }
.que { display: inline-flex; padding: 4px; gap: 2px; border-radius: 999px; background: var(--soft); border: 1px solid var(--glass-border); }
.que-fila .vistas { width: auto; }
@media (max-width: 560px) {
  .que-fila .vista span { display: none; }
  .pub .que-fila .vista { flex: none; padding: 8px 12px; }
}
.pub .que a { display: inline-flex; align-items: center; padding: 8px 18px; min-height: 40px; border-radius: 999px; font-weight: 700; color: var(--ink); text-decoration: none; }
.pub .que a.on { background: var(--ink); color: var(--surface); }
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
.sitio-hora.abierto { color: #13803B; }
.sitio-extra { display: flex; align-items: center; gap: 4px; font-size: 13px; min-width: 0; }
.sitio-extra span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sitio-extra .ic { flex: none; color: var(--ink-2); }
.tag-oferta { justify-self: start; padding: 3px 9px; border-radius: 999px; background: var(--accent); color: var(--on-accent); font-weight: 800; font-size: 12px; margin-top: 3px; }
.pop .tag-oferta { display: inline-block; margin: 4px 0; }
.sitios-fin { text-align: center; margin: 18px 0 8px; }
.sitios-fin h2 { font-size: 17px; margin: 0 0 12px; }
.chip-solo { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 8px; }
@media (prefers-color-scheme: dark) { .sitio-hora.abierto { color: #4ADE80; } }
</style>`;
