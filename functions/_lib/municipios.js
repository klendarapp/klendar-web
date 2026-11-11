// Las páginas de un municipio (/hoy/<municipio>/, /agenda/<municipio>/[…],
// /con-ninos/<municipio>/, /coleccion/<slug>/<municipio>/ y en inglés), con
// la tabla oficial de municipios (2026-11-03, «Toda España preparada";
// migraciones 20261260100005 y 20261260100006 de la app):
//
// - La dirección buena lleva el slug del municipio, sin tildes y único
//   (`/hoy/malaga`, `/hoy/donostia-san-sebastian`, `/hoy/torrent-valencia`).
// - Otra forma del mismo sitio (con tildes o mayúsculas, «/hoy/málaga/»;
//   otro de sus nombres, «/hoy/san-sebastian/», «/hoy/elche/»; el id de
//   antes de una Ciudad de Klendar, «/hoy/coruna/»; el texto que escribía el
//   negocio, «/hoy/santa%20cruz%20de%20tenerife/») da un 301 a la buena: las
//   variantes, en una sola página.
// - Un homónimo sin provincia («/hoy/torrent/») lleva a elegir cuál (sin
//   indexar): los homónimos, separados.
// - Lo que no es un municipio (o sin la tabla cargada) sigue como antes: el
//   texto se compara con el que escribió el negocio.
//
// Lo público que se pide con `p_city` entiende el slug (`business_in_place`
// en la base): cuenta el municipio del negocio por su punto.

import { esc, html, rpcAll } from './page.js';
import { publicPage } from './public.js';

/** El municipio de un trozo de la dirección (ya decodificado). */
export async function sitioDeRuta(raw) {
  const l = await rpcAll('resolve_municipality', { p_slug: raw }).catch(() => []);
  if (!l.length || !l[0]?.municipality?.slug) return { slug: raw, nombre: null, m: null };
  if (l[0].match === 'choice') return { elegir: l.map((x) => x.municipality).filter((m) => m?.slug) };
  const m = l[0].municipality;
  if (l[0].match === 'alias' || raw !== m.slug) return { otro: m.slug, nombre: m.name, m };
  return { slug: m.slug, nombre: m.name, m };
}

/** 301 a la dirección buena (las variantes en una sola página). */
export const aLaBuena = (url) => new Response(null, {
  status: 301, headers: { Location: url, 'Cache-Control': 'public, max-age=3600' },
});

/** «¿Cuál de ellos?»: un homónimo sin provincia. Sin indexar. */
export function eligeMunicipio(lang, path, opciones, hacia) {
  const en = lang === 'en';
  const titulo = en ? 'Which one?' : '¿Cuál de ellos?';
  const texto = en ? 'There are several towns with this name.' : 'Hay varios municipios con este nombre.';
  const body = `
  <p class="crumbs"><a href="${en ? '/en' : '/'}">Klendar</a></p>
  <section class="vacio">
    <h1>${esc(titulo)}</h1>
    <p>${esc(texto)}</p>
    <ul class="muni-elige">${opciones.map((m) => `<li><a class="pill" href="${esc(hacia(m.slug))}">${esc(m.name)}${m.province ? ` · ${esc(m.province)}` : ''}</a></li>`).join('')}</ul>
  </section>`;
  return html(publicPage({
    lang, path, body, title: titulo, description: texto, head: '<meta name="robots" content="noindex">',
  }), 200);
}

/** Lo de todas las páginas de municipio: el municipio, el 301 o «¿Cuál?».
 * `hacia(slug)` da la dirección de esta misma página en otro municipio.
 * Devuelve `{ respuesta }` (si ya está) o `{ pCity, nombre }`. */
export async function paginaDeMunicipio(raw, lang, path, hacia) {
  const s = await sitioDeRuta(raw);
  if (s.elegir) return { respuesta: eligeMunicipio(lang, path, s.elegir, hacia) };
  if (s.otro) return { respuesta: aLaBuena(hacia(s.otro)) };
  return { pCity: s.slug, nombre: s.nombre, m: s.m };
}
