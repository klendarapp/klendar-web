// «Grupos y empresas» en la web pública (tanda C; migración
// 20261208100000_grupos_y_empresas de la app): la lista de negocios que
// aceptan grupos (/grupos, /en/groups) y la fila «Acepta grupos» de la
// ficha del negocio. Lo mismo que la app (especificación de la tanda C).
//
// Como «Dónde ver el partido»: se pinta en el servidor, los filtros son
// enlaces y formularios GET y la zona es una ciudad o «Cerca de mí» (la
// celda de unos 5 km, `?celda=`/`?cell=`; los enlaces de antes con
// `?lat=&lng=` van a su celda: _lib/celda_zona.js), con 10 km alrededor
// («Ampliar a 25 km»).
// Elegir hasta 3 y «Pedir presupuesto» lo hace /assets/grupos.js: lleva a
// «Tu cuenta» (`#/grupos/pedir?b=<id>,<id>`), que pide entrar.

import { enlaceCuenta } from './cuenta.js';
import { ARRANQUE, compilaAlArrancar, esc, html, rows, rpcAll } from './page.js';
import KG from '../../assets/textos-grupos.js';
import { bizPath, breadcrumbLd, ldScript, publicPage } from './public.js';
import { recuperaZona, zonaMenu } from './partidos.js';
import { ajustaDistancias } from './distancia.js';
import { aSuCelda, celdaDeUrl, celdaDeZona, claveCelda, radioConCelda } from './celda_zona.js';

/** Dónde vive la lista en cada idioma. */
export const gruposBase = (lang) => (lang === 'en' ? '/en/groups' : '/grupos');
const cuentaBase = enlaceCuenta;
/** «Pedir presupuesto» a esos negocios: el formulario de «Tu cuenta». */
export const pedirHref = (lang, ids) => `${cuentaBase(lang, `grupos/pedir?b=${ids.map(encodeURIComponent).join(',')}`)}`;

export const GRUPOS_CSS = '<link rel="stylesheet" href="/assets/grupos-sorteos.css?v=3">';

const CLAVES = {
  es: { city: 'ciudad', kind: 'tipo', people: 'personas' },
  en: { city: 'city', kind: 'kind', people: 'people' },
};
const plano = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const RADIOS = [10, 25];

// Personas (groups, people outline de Material Symbols, Apache 2.0).
const SVG_GRUPOS = 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z';
/** El icono de grupos (para Explorar y la ficha). */
export const icGrupos = (s = 18) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${SVG_GRUPOS}"/></svg>`;

function leeEstado(qs) {
  const de = (k, max) => (qs.get(CLAVES.es[k]) || qs.get(CLAVES.en[k]) || '').slice(0, max);
  const z = celdaDeUrl(qs);
  const cerca = Boolean(z);
  // Los tipos, de varios a la vez (§4zzz-chips): `?tipo=afterwork&tipo=…`
  // (o con comas), en el orden de `KG.KINDS`. Ninguno o todos = todos.
  const pedidos = [...qs.getAll(CLAVES.es.kind), ...qs.getAll(CLAVES.en.kind)].flatMap((v) => String(v).split(','));
  const kinds = KG.KINDS.filter((k) => pedidos.includes(k));
  const people = Number.parseInt(de('people', 4), 10);
  const km = Number.parseInt(qs.get('km') || '', 10);
  return {
    city: cerca ? '' : de('city', 60),
    cerca, lat: cerca ? z.lat : null, lng: cerca ? z.lng : null, celda: cerca ? z.celda : '', celdaVieja: Boolean(z?.vieja),
    kinds,
    people: Number.isInteger(people) && people >= 2 && people <= 500 ? people : null,
    km: RADIOS.includes(km) ? km : 10,
  };
}

function query(e, lang) {
  const K = CLAVES[lang === 'en' ? 'en' : 'es'];
  const p = new URLSearchParams();
  if (e.cerca) p.set(claveCelda(lang), celdaDeZona(e)); else if (e.city) p.set(K.city, e.city);
  if (e.km && e.km !== 10) p.set('km', String(e.km));
  for (const k of KG.KINDS.filter((x) => (e.kinds || []).includes(x))) p.append(K.kind, k);
  if (e.people) p.set(K.people, String(e.people));
  return p.toString();
}
const conQs = (path, qs) => (qs ? `${path}?${qs}` : path);
/** Varias listas en una: sin repetir y por cercanía (sin distancia, detrás). */
const juntaSinRepetir = (listas) => {
  const vistos = new Set();
  const todos = listas.flat().filter((b) => b && !vistos.has(b.id) && vistos.add(b.id));
  const d = (b) => (Number.isFinite(b.distance_m) ? b.distance_m : Infinity);
  return todos.sort((a, b) => d(a) - d(b));
};

/** La lista. */
export async function gruposPage(url, lang) {
  if (url === ARRANQUE) return null; // compilaAlArrancar (page.js)
  const en = lang === 'en';
  const S = KG.t(lang);
  const base = gruposBase(lang);
  const e = leeEstado(url.searchParams);
  // Un enlace de antes con tu punto (`?lat=&lng=`): a su celda.
  if (e.celdaVieja) return aSuCelda(url, lang, e.celda);
  const [ciudades, ciudadesK, cats] = await Promise.all([
    rpcAll('public_cities', {}),
    rows('cities', 'select=id,name,lat,lng&order=position.asc').catch(() => []),
    rows('categories', 'select=id,names,slug').catch(() => []),
  ]);
  // El punto: tu posición o el centro de la ciudad (10 km alrededor, o 25).
  let origen = null;
  let ciudadK = null;
  if (e.cerca) origen = { lat: e.lat, lng: e.lng };
  else if (e.city) {
    const c = (ciudadesK || []).find((x) => x.id === plano(e.city) || plano(x.name) === plano(e.city));
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) { origen = { lat: c.lat, lng: c.lng }; ciudadK = c; }
  }
  // La base filtra por un tipo: con uno, ese; con varios (no todos), uno
  // por tipo y juntos (sin repetir, por cercanía); ninguno o todos, todo.
  const args = (kind) => ({
    // Con la celda, desde su centro y con su margen (_lib/celda_zona.js).
    p_lat: origen ? origen.lat : null, p_lng: origen ? origen.lng : null, p_radius_m: e.cerca ? radioConCelda(e.celda, e.km * 1000) : e.km * 1000,
    p_kind: kind, p_people: e.people, p_categories: null,
    p_city: !origen && e.city ? e.city : null, p_limit: 60,
  });
  const filtraTipos = e.kinds.length > 0 && e.kinds.length < KG.KINDS.length;
  const lista = !filtraTipos || e.kinds.length === 1
    ? await rpcAll('group_venues', args(filtraTipos ? e.kinds[0] : null))
    : juntaSinRepetir(await Promise.all(e.kinds.map((k) => rpcAll('group_venues', args(k))))).slice(0, 60);
  // Con una ciudad, desde su punto: «En Málaga» o «A 30 km de Málaga», no «12 km» como si fuera desde aquí (I1).
  // Con la celda, la distancia desde su centro no es la tuya: la pone el navegador con tu punto (`data-lat`).
  ajustaDistancias(lista, { cerca: e.cerca, aprox: e.cerca, centro: ciudadK ? {} : null, nombre: ciudadK?.name || '', lang });
  const nombreCat = new Map((cats || []).map((c) => [c.id, (c.names && (c.names[en ? 'en' : 'es'] || c.names.es)) || c.slug || '']));

  const link = (cambios) => {
    const b = { ...e, ...cambios };
    if (b.cerca === false) { b.lat = null; b.lng = null; b.celda = ''; }
    return conQs(`${base}`, query(b, lang));
  };
  // Un tipo se pulsa y se suelta, junto con otros (el lector dice «pulsado»).
  const chipTipo = (k) => {
    const on = e.kinds.includes(k);
    return `<a class="chip${on ? ' on' : ''}" href="${esc(link({ kinds: on ? e.kinds.filter((x) => x !== k) : [...e.kinds, k] }))}" role="button" aria-pressed="${on}">${esc(KG.plural(k, lang))}</a>`;
  };
  const K = CLAVES[en ? 'en' : 'es'];
  const ocultos = [[K.city, e.cerca ? '' : e.city], [claveCelda(lang), e.cerca ? e.celda : ''],
    ['km', e.km !== 10 ? String(e.km) : ''], ...KG.KINDS.filter((k) => e.kinds.includes(k)).map((k) => [K.kind, k])]
    .filter(([, v]) => v).map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join('');
  const barra = `<div class="barra-filtros grupos-barra">
    ${zonaMenu({ ...e, km: e.km }, lang, ciudades, link)}
    ${KG.KINDS.map(chipTipo).join('')}
  </div>
  <form class="grupos-personas" method="get" action="${base}">
    ${ocultos}
    <label for="personas">${esc(S.howMany)}</label>
    <input id="personas" name="${K.people}" type="number" inputmode="numeric" min="2" max="500" value="${e.people || ''}" placeholder="12">
    <button class="pill" type="submit">${esc(S.apply)}</button>
  </form>
  <p id="cercaErr" class="aviso-error" role="alert" hidden></p>`;

  const tarjeta = (b) => {
    const logo = /^https:\/\//.test(b.logo_url || '') ? `<img src="${esc(b.logo_url)}" alt="" width="56" height="56" loading="lazy" decoding="async">`
      : `<span class="ph" aria-hidden="true">${esc((b.name || '·').charAt(0).toUpperCase())}</span>`;
    const donde = [nombreCat.get(b.category_id), b.city, b.distance_txt || KG.distancia(b.distance_m, lang)].filter(Boolean).join(' · ');
    const tipos = (b.kinds || []).filter((k) => KG.KINDS.includes(k)).map((k) => KG.plural(k, lang)).join(' · ');
    // Con «Cerca de mí», tu distancia la pone el navegador (/assets/tarjetas.js, con tu punto).
    const punto = e.cerca && Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng))
      ? ` data-lat="${Number(b.lat).toFixed(5)}" data-lng="${Number(b.lng).toFixed(5)}"` : '';
    return `<article class="grupo-neg" data-grupo="${esc(b.id)}"${punto}>
      <a class="grupo-neg-cab" href="${esc(bizPath(lang, b.slug || b.id))}">
        ${logo}
        <span class="grupo-neg-t"><b>${esc(b.name)}</b>${donde || punto ? `<small class="muted">${esc(donde)}${punto ? `<span class="tj-dist"${donde ? ' data-sep' : ''} hidden></span>` : ''}</small>` : ''}</span>
      </a>
      <p class="grupo-neg-max"><b>${esc(S.upTo(b.max_people))}</b>${tipos ? `<br><span class="muted">${esc(tipos)}</span>` : ''}</p>
      ${b.note ? `<p class="grupo-neg-nota">${esc(b.note)}</p>` : ''}
      <label class="pill grupo-elegir"><input type="checkbox" name="b" value="${esc(b.id)}" data-nombre="${esc(b.name)}">
        <span class="grupo-elegir-no">${esc(S.choose)}</span><span class="grupo-elegir-si" aria-hidden="true">✓ ${esc(S.chosen)}</span></label>
    </article>`;
  };

  const conFiltros = Boolean(e.kinds.length || e.people);
  let cuerpo;
  if (lista.length) {
    cuerpo = `<form class="grupos-lista" id="grupos-lista" data-pedir="${esc(`${cuentaBase(lang, 'grupos/pedir?b=')}`)}"
        data-max="${esc(S.max3)}" data-ask="${esc(S.ask(9)).replace('9', '{n}')}">
      ${lista.map(tarjeta).join('')}
      <div class="grupos-pedir" id="grupos-pedir" hidden>
        <a class="pill accent big" id="grupos-pedir-btn" href="${cuentaBase(lang, 'grupos/pedir')}">${esc(S.ask(0))}</a>
      </div>
    </form>
    <p class="aviso-error" id="grupos-aviso" role="status" aria-live="polite" hidden></p>`;
  } else {
    const ampliar = origen && e.km < 25 ? `<a class="pill accent" href="${esc(link({ km: 25 }))}">${esc(S.widen)}</a>` : '';
    const quitar = conFiltros ? `<a class="pill${ampliar ? '' : ' accent'}" href="${esc(link({ kinds: [], people: null }))}">${esc(S.clear)}</a>` : '';
    const todas = !ampliar && !quitar && (e.city || e.cerca)
      ? `<a class="pill accent" href="${esc(link({ city: '', cerca: false, km: 10 }))}">${esc(en ? 'See every city' : 'Ver todas las ciudades')}</a>` : '';
    cuerpo = `<section class="vacio">
      <span class="vacio-ic" aria-hidden="true">${icGrupos(30)}</span>
      <h2>${esc(S.emptyTitle)}</h2>
      <p>${esc(S.emptyText)}</p>
      ${ampliar || quitar || todas ? `<div class="vacio-botones">${ampliar}${quitar}${todas}</div>` : ''}
    </section>`;
  }

  const body = `
  <p class="crumbs"><a href="${en ? '/en' : '/'}">Klendar</a> · <a href="${en ? '/en/explore' : '/explorar'}">${en ? 'Explore' : 'Explorar'}</a></p>
  <div class="exp-cab cab-pagina"><div><h1>${esc(S.title)}</h1>
    <p class="muted exp-lead">${esc(S.lead)}</p>
    <p class="exp-atajo"><a href="${esc(`${cuentaBase(lang, 'grupos')}`)}">${esc(S.yourRequests)}</a></p></div></div>
  ${barra}
  ${cuerpo}
  <script src="/assets/grupos.js?v=20261111sinbarra" defer></script>`;

  const filtrada = Boolean(e.city || e.cerca || e.kinds.length || e.people || e.km !== 10);
  const migas = [['Klendar', en ? '/en' : '/'], [S.title, `${base}`]];
  return html(publicPage({
    lang,
    path: `${base}`,
    title: S.title,
    description: S.lead,
    body,
    actual: 'explorar',
    head: `${GRUPOS_CSS}
${recuperaZona()}
${filtrada ? '<meta name="robots" content="noindex, follow">' : ldScript({ '@context': 'https://schema.org', ...breadcrumbLd(migas) })}`,
    contador: !e.cerca,
  }), 200, 'public, max-age=120, s-maxage=300');
}

/** En la ficha del negocio: «Acepta grupos · hasta 40 personas», los tipos,
 * la nota y «Pedir presupuesto». '' si no acepta grupos. */
export function grupoEnFicha(info, businessId, lang) {
  if (!info || !info.max_people) return '';
  const S = KG.t(lang);
  const tipos = (info.kinds || []).filter((k) => KG.KINDS.includes(k)).map((k) => KG.plural(k, lang)).join(' · ');
  return `<section class="grupo-ficha" id="grupos" aria-labelledby="grupoT">
      <p class="grupo-ficha-t" id="grupoT">${icGrupos(20)}<b>${esc(S.takes(info.max_people))}</b></p>
      ${tipos ? `<p class="muted">${esc(tipos)}</p>` : ''}
      ${info.note ? `<p class="muted">${esc(info.note)}</p>` : ''}
      <p><a class="pill" data-solo-publico href="${esc(pedirHref(lang, [businessId]))}" rel="nofollow">${esc(S.askOne)}</a></p>
    </section>`;
}

// Compilada al cargar el módulo (page.js, compilaAlArrancar; RUNBOOK §4zzz-cpu-web).
compilaAlArrancar(gruposPage);
