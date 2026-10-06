// Entidades y agenda pública (migraciones 20261130100000–02 del repo de la
// app): el sello de quién publica (ayuntamiento, junta de distrito,
// asociación, ONG o la «Agenda pública de <ciudad>» que crea el sistema) y
// la «Fuente» de un evento importado de datos abiertos, con su licencia.
// Lo mismo que la app (`lib/features/entities/`).

import { esc } from './page.js';

const NOMBRES = {
  es: {
    council: 'Ayuntamiento', district: 'Junta de distrito', merchants: 'Asociación de comerciantes',
    neighbours: 'Asociación vecinal', ngo: 'ONG', public_agenda: 'Agenda pública',
  },
  en: {
    council: 'Council', district: 'District council', merchants: "Traders' association",
    neighbours: "Residents' association", ngo: 'NGO', public_agenda: 'Public listings',
  },
};

/** «Ayuntamiento», «Agenda pública»… o '' si no es una entidad. */
export const nombreEntidad = (kind, lang) => NOMBRES[lang === 'en' ? 'en' : 'es'][kind] || '';

// account_balance (outlined), el icono de la app.
const ICONO = 'M6.5 10h-2v7h2v-7zm6 0h-2v7h2v-7zm8.5 9H2v2h19v-2zm-2.5-9h-2v7h2v-7zm-7-6.74L16.71 6H6.29l5.21-2.74m0-2.26L2 6v2h19V6l-9.5-5z';

/** El sello (`.badge`), o '' si no es una entidad. */
export function selloEntidad(kind, lang) {
  const n = nombreEntidad(kind, lang);
  if (!n) return '';
  const a11y = lang === 'en' ? `Published by: ${n}` : `Lo publica: ${n}`;
  return `<span class="badge badge-entidad" title="${esc(a11y)}"><svg class="ic" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="${ICONO}"/></svg> ${esc(n)}</span>`;
}

/** «Fuente» de un evento importado: la atribución que piden las licencias
 *  (CC BY 4.0 y las condiciones de cada ayuntamiento), cuándo se actualizó,
 *  que Klendar lo ha adaptado y el enlace al original. `src` es lo que
 *  devuelve `offer_source`. */
export function fuenteHtml(src, lang) {
  if (!src) return '';
  const en = lang === 'en';
  const atribucion = (en ? src.attribution_en : src.attribution_es) || src.attribution_es || '';
  const fecha = src.updated_at
    ? new Date(src.updated_at).toLocaleDateString(en ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid' })
    : '';
  const lineas = [
    fecha ? (en ? `Data updated on ${fecha}.` : `Datos actualizados el ${fecha}.`) : '',
    src.edited
      ? (en ? 'Reviewed by hand on Klendar.' : 'Revisados a mano en Klendar.')
      : (en ? 'Adapted by Klendar (dates, category and shortened text).' : 'Adaptados por Klendar (fechas, categoría y texto recortado).'),
    en ? "Klendar doesn't organise this event: check the time, price and conditions at the source."
      : 'Klendar no organiza este evento: confirma la hora, el precio y las condiciones en la fuente.',
  ].filter(Boolean).join(' ');
  const ver = /^https:\/\//.test(src.source_url || '')
    ? `<p class="acciones"><a class="pill" href="${esc(src.source_url)}" rel="nofollow noopener" target="_blank">${esc(en ? `See it on ${src.site}` : `Ver en ${src.site}`)}</a></p>` : '';
  return `<h2>${en ? 'Source' : 'Fuente'}</h2>
      <div class="fuente-evento">
      <p><b>${esc(atribucion)}</b></p>
      <p class="muted">${esc(lineas)}</p>
      <p class="muted"><a href="${esc(src.license_url)}" rel="license noopener" target="_blank">${esc(en ? `Licence: ${src.license}` : `Licencia: ${src.license}`)}</a> · <a href="${en ? '/en/sources/' : '/fuentes/'}">${en ? 'All sources and licences' : 'Todas las fuentes y licencias'}</a></p>
      ${ver}
      </div>`;
}
