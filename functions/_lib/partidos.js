// «Dónde ver el partido» en la web pública: la lista (/partidos/,
// /en/matches/), el detalle de un partido (/partidos/<id>) con los bares que
// lo ponen, la sección «Pone el partido» de la ficha de un bar y la de la
// búsqueda de Explorar. Lo mismo que la app (especificación de la tanda B;
// migración 20261201100000_partidos de la app).
//
// Como el resto de páginas públicas: se pinta en el servidor, va sin
// JavaScript (el buscador y los filtros son enlaces y formularios GET) y la
// zona es una ciudad o «Cerca de mí» (`?lat=&lng=`, con 3 decimales). Con
// JavaScript y una sesión guardada, /assets/partidos.js pinta «Tus equipos»
// y deja seguir a un equipo desde aquí; sin sesión, «Seguir a…» lleva a «Tu
// cuenta» (`#/equipos?seguir=<id>`).
//
// La web nunca enseña +18: la base no devuelve los bares +18 a quien mira sin
// sesión (`broadcast_business_ok`).

import { esc, html, rows, rpc, rpcAll, supabasePublic, isUuid } from './page.js';
import KZ from '../../assets/zona.js';
import KE from '../../assets/emisiones.js';
import { bizPath, breadcrumbLd, ldScript, publicPage } from './public.js';

/** Dónde vive cada página en cada idioma. */
export const partidosBase = (lang) => (lang === 'en' ? '/en/matches' : '/partidos');
const cuentaBase = (lang) => (lang === 'en' ? '/app/?lang=en' : '/app/');
/** «Seguir a <equipo>» sin sesión: a «Tu cuenta», que lo hace al entrar. */
export const seguirHref = (lang, t) => `${cuentaBase(lang)}#/equipos?seguir=${encodeURIComponent(t.id)}&nombre=${encodeURIComponent(t.name || '')}`;

const PRETTY = (s) => String(s || '').replace(/(^|[\s-])(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
const plano = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Las claves de la dirección en cada idioma (se leen las de los dos). */
const CLAVES = { es: { city: 'ciudad', sport: 'deporte' }, en: { city: 'city', sport: 'sport' } };

// Iconos de Material en SVG (las páginas públicas no cargan la fuente).
const IC = {
  cerca: 'M21 3 3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z',
  lugar: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
  ciudad: 'M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z',
  abajo: 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z',
  buscar: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  der: 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z',
  // sports_soccer (Material Icons, Apache 2.0).
  balon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 3.3 1.35-.95c1.82.56 3.37 1.76 4.38 3.34l-.39 1.34-1.35.46L13 6.7V5.3zm-3.35-.95L11 5.3v1.4L7.01 9.49l-1.35-.46-.39-1.34c1.01-1.57 2.56-2.77 4.38-3.34zM7.08 17.11l-1.14.1C4.73 15.81 4 13.99 4 12c0-.12.01-.23.02-.35l1-.73 1.38.48 1.46 4.34-.78 1.37zm7.42 2.48c-.79.26-1.63.41-2.5.41s-1.71-.15-2.5-.41l-.69-1.49.64-1.1h5.11l.64 1.11-.7 1.48zM14.27 15H9.73l-1.35-4.02L12 8.44l3.63 2.54L14.27 15zm3.79 2.21-1.14-.1-.79-1.37 1.46-4.34 1.39-.47 1 .73c.01.11.02.22.02.34 0 1.99-.73 3.81-1.94 5.21z',
  // local_offer: la oferta del bar para el partido.
  oferta: 'm21.41 11.58-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z',
};
const ic = (n, s = 18) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${IC[n]}"/></svg>`;
/** El balón (para el acceso de Explorar). */
export const icPartido = (s = 18) => ic('balon', s);

/** La atribución de football-data.org (obligatoria con sus datos). */
export const atribucion = () => `<p class="fuente-datos"><a href="${KE.FUENTE.url}" rel="noopener" target="_blank">${esc(KE.FUENTE.texto)}</a></p>`;

/** Los estilos de estas piezas (también en la ficha del bar y en Explorar). */
export const PARTIDOS_CSS = '<link rel="stylesheet" href="/assets/partidos.css?v=2">';

/** Lo personal (Tus equipos, seguir desde aquí): solo hace algo con sesión. */
const partidosScript = (lang) => {
  const sp = supabasePublic();
  return `<script src="/assets/partidos.js?v=2" defer data-url="${esc(sp.url)}" data-key="${esc(sp.key)}" data-lang="${lang === 'en' ? 'en' : 'es'}"></script>`;
};

/** «350 m», «1,2 km». */
function distancia(m, lang) {
  if (!Number.isFinite(m)) return '';
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  const km = (m / 1000).toFixed(m < 10000 ? 1 : 0);
  return `${lang === 'en' ? km : km.replace('.', ',')} km`;
}

// ── La zona: una ciudad o «Cerca de mí» ───────────────────────────────────
const redondea = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x);
const posUrl = (x) => redondea(Number(x)).toFixed(3);

function leeEstado(qs) {
  const de = (k, max) => (qs.get(CLAVES.es[k]) || qs.get(CLAVES.en[k]) || '').slice(0, max);
  const lat = redondea(Number.parseFloat(qs.get('lat') || ''));
  const lng = redondea(Number.parseFloat(qs.get('lng') || ''));
  const cerca = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const sport = de('sport', 20);
  return {
    q: (qs.get('q') || '').trim().slice(0, 60),
    city: cerca ? '' : de('city', 60),
    sport: KE.DEPORTES.includes(sport) ? sport : '',
    cerca, lat: cerca ? lat : null, lng: cerca ? lng : null,
  };
}

/** La dirección de un estado (en el idioma de la página). */
function query(e, lang, { sinQ = false, sinDeporte = false } = {}) {
  const K = CLAVES[lang === 'en' ? 'en' : 'es'];
  const p = new URLSearchParams();
  if (!sinQ && e.q) p.set('q', e.q);
  if (e.cerca) { p.set('lat', posUrl(e.lat)); p.set('lng', posUrl(e.lng)); } else if (e.city) p.set(K.city, e.city);
  if (!sinDeporte && e.sport) p.set(K.sport, e.sport);
  return p.toString();
}
/** Solo la zona (para los enlaces al detalle y a la lista). */
const zonaQs = (e, lang) => query({ city: e.city, cerca: e.cerca, lat: e.lat, lng: e.lng }, lang);
const conQs = (path, qs) => (qs ? `${path}?${qs}` : path);

/** El punto desde el que se cuentan los bares: tu posición o el centro de la
 * ciudad (`cities`); sin zona, ninguno (cuenta los de todas partes). */
function origenDe(e, ciudadesK) {
  if (e.cerca) return { lat: e.lat, lng: e.lng };
  if (!e.city) return null;
  const c = (ciudadesK || []).find((x) => x.id === plano(e.city) || plano(x.name) === plano(e.city));
  return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? { lat: c.lat, lng: c.lng } : null;
}
const zonaHora = (o) => (o ? KZ.porCoordenadas(o.lat, o.lng) || KZ.MADRID : KZ.MADRID);

/** El desplegable de la zona, como el de Explorar: «Cerca de mí», todas las
 * ciudades y cada una. «Cerca de mí» lo hace /assets/tarjetas.js. */
function zonaMenu(e, lang, ciudades, link) {
  const en = lang === 'en';
  const Z = en
    ? { change: 'Change area', near: 'Near me', nearOn: 'Near you', all: 'Every city', nearNo: "We couldn't get your location. Allow it in your browser and try again." }
    : { change: 'Cambiar zona', near: 'Cerca de mí', nearOn: 'Cerca de ti', all: 'Todas las ciudades', nearNo: 'No hemos podido saber dónde estás. Permítelo en el navegador y vuelve a probar.' };
  const valor = e.cerca ? Z.nearOn : e.city ? PRETTY(e.city) : Z.all;
  const op = (href, label, on) => `<a class="op${on ? ' on' : ''}" href="${esc(href)}"${on ? ' aria-current="true"' : ''}>${esc(label)}</a>`;
  return `<details class="desplegable">
      <summary class="chip" aria-label="${esc(`${Z.change}: ${valor}`)}">${ic(e.cerca ? 'cerca' : e.city ? 'ciudad' : 'lugar', 16)}<span class="chip-t">${esc(valor)}</span>${ic('abajo', 16)}</summary>
      <div class="menu-d" role="group" aria-label="${esc(Z.change)}"><p class="menu-d-t" aria-hidden="true">${esc(Z.change)}</p>
        <button type="button" class="op" data-cerca data-err="${esc(Z.nearNo)}" hidden>${ic('cerca', 16)}<span>${esc(Z.near)}</span></button>
        ${op(link({ city: '', cerca: false }), Z.all, !e.city && !e.cerca)}
        ${(ciudades || []).filter((c) => c.city).slice(0, 20).map((c) => op(link({ city: String(c.city), cerca: false }), PRETTY(c.city), !e.cerca && plano(e.city) === plano(c.city))).join('')}
      </div>
    </details>`;
}

/** Con la zona guardada en este navegador (la de Explorar y Descubre, menos
 * de 6 h) y sin zona en la dirección: se vuelve a la misma página con ella,
 * como en Explorar. Los enlaces de la propia página dejan una marca para no
 * pisarse (`klendar.filtros.sin`, /assets/tarjetas.js). */
const recuperaZona = () => `<script>(function(){try{var q=new URLSearchParams(location.search);
if(q.has('lat')||q.has('ciudad')||q.has('city'))return;var s=sessionStorage;var sin=s.getItem('klendar.filtros.sin');s.removeItem('klendar.filtros.sin');if(sin)return;
var n=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0])||{};if(n.type==='back_forward')return;
var g=JSON.parse(localStorage.getItem('klendar.filtros')||'null');if(!g||Date.now()-g.t>216e5)return;
var a=new URLSearchParams(g[/^\\/en\\//.test(location.pathname)?'en':'es']||'');var z=new URLSearchParams();
if(a.get('lat')&&a.get('lng')){z.set('lat',a.get('lat'));z.set('lng',a.get('lng'));}else{var c=a.get('ciudad')||a.get('city');if(c)z.set(/^\\/en\\//.test(location.pathname)?'city':'ciudad',c);}
if(!z.toString())return;q.forEach(function(v,k){z.set(k,v);});location.replace(location.pathname+'?'+z.toString()+location.hash);}catch(x){}})();</script>`;

// ── Una fila de partido ───────────────────────────────────────────────────
/** «Lo ponen 3 bares cerca · 1 con oferta» (lo de la oferta, en coral: es
 * información de una oferta) o «Aún no lo pone ningún bar cerca». */
function baresHtml(b, S) {
  const n = Number(b.bars) || 0;
  if (!n) return `<span class="partido-bares sin">${esc(S.none)}</span>`;
  const o = Number(b.offers) || 0;
  return `<span class="partido-bares">${esc(S.bars(n))}${o ? `<span class="partido-oferta">${esc(S.offers(o))}</span>` : ''}</span>`;
}

function filaPartido(b, { lang, S, tz, href }) {
  const que = [b.competition, KE.deporte(b.sport, lang)].filter(Boolean);
  // Con la competición, el deporte sobra si es fútbol (casi todo).
  const meta = b.competition && b.sport === 'football' ? b.competition : que.join(' · ');
  return `<a class="partido" href="${esc(href)}">
      <span class="partido-hora">${b.time_confirmed === false ? '' : esc(KE.hora(b.starts_at, tz, lang))}</span>
      <span class="partido-cuerpo">
        <b class="partido-t">${esc(b.title)}</b>
        <small class="muted">${esc(meta)}${b.time_confirmed === false ? ` · ${esc(S.tbc)}` : ''}</small>
        ${baresHtml(b, S)}
      </span>
      <span class="partido-ir" aria-hidden="true">${ic('der', 20)}</span>
    </a>`;
}

/** Agrupado por días (Hoy · Mañana · «sábado 11»), en la hora de la zona. */
function porDias(lista, { lang, S, tz, hrefDe }) {
  const grupos = [];
  for (const b of lista) {
    const d = KE.dia(b.starts_at, tz);
    let g = grupos.find((x) => x.d === d);
    if (!g) { g = { d, etiqueta: KE.etiquetaDia(b.starts_at, tz, lang), items: [] }; grupos.push(g); }
    g.items.push(b);
  }
  grupos.sort((a, b) => a.d.localeCompare(b.d));
  return grupos.map((g, i) => `<section class="partidos-dia" aria-labelledby="dia${i}">
      <h2 id="dia${i}">${esc(g.etiqueta)}</h2>
      <div class="partidos-lista">${g.items.map((b) => filaPartido(b, { lang, S, tz, href: hrefDe(b) })).join('')}</div>
    </section>`).join('');
}

// ── La lista ───────────────────────────────────────────────────────────────
export async function partidosPage(url, lang) {
  const en = lang === 'en';
  const S = KE.t(lang);
  const base = partidosBase(lang);
  const e = leeEstado(url.searchParams);
  const [ciudades, ciudadesK] = await Promise.all([
    rpcAll('public_cities', {}),
    rows('cities', 'select=id,name,lat,lng&order=position.asc').catch(() => []),
  ]);
  const origen = origenDe(e, ciudadesK);
  const tz = zonaHora(origen);
  // Sin deporte: así se saben los deportes que hay (los chips) y se filtra aquí.
  const conTexto = e.q.length >= 2;
  const todos = await rpcAll('where_to_watch', {
    p_q: conTexto ? e.q : null, p_lat: origen?.lat ?? null, p_lng: origen?.lng ?? null, p_lang: lang, p_limit: 120,
  });
  const deportes = KE.DEPORTES.filter((s) => todos.some((b) => b.sport === s));
  const lista = e.sport ? todos.filter((b) => b.sport === e.sport) : todos;

  const link = (cambios) => {
    const b = { ...e, ...cambios };
    if (b.cerca === false) { b.lat = null; b.lng = null; }
    return conQs(`${base}/`, query(b, lang));
  };
  const zona = zonaQs(e, lang);
  const hrefDe = (b) => conQs(`${base}/${b.id}`, zona);
  const K = CLAVES[en ? 'en' : 'es'];
  const ocultos = [[K.city, e.cerca ? '' : e.city], ['lat', e.cerca ? posUrl(e.lat) : ''], ['lng', e.cerca ? posUrl(e.lng) : '']]
    .filter(([, v]) => v).map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join('');

  const buscador = `<form class="buscador" role="search" method="get" action="${base}/">
    <label class="buscador-campo">${ic('buscar', 20)}<span class="sr">${esc(S.search)}</span>
      <input type="search" name="q" value="${esc(e.q)}" placeholder="${esc(S.searchPh)}" enterkeyhint="search" maxlength="60"></label>
    ${ocultos}
    <button class="pill ink" type="submit">${esc(S.search)}</button>
  </form>`;

  // La fila de filtros: la zona y los deportes que hay (si hay más de uno).
  const chip = (href, label, on) => `<a class="chip${on ? ' on' : ''}" href="${esc(href)}"${on ? ' aria-current="true"' : ''}>${esc(label)}</a>`;
  const chips = deportes.length > 1 || e.sport
    ? [chip(link({ sport: '' }), S.all, !e.sport), ...deportes.map((s) => chip(link({ sport: s }), KE.deporte(s, lang), e.sport === s))].join('')
    : '';
  const barra = `<div class="barra-filtros partidos-barra">
    ${zonaMenu(e, lang, ciudades, link)}
    ${chips}
  </div>
  <p id="cercaErr" class="aviso-error" role="alert" hidden></p>`;

  // «Tus equipos»: sin sesión (la página va en caché), la línea y el botón;
  // con sesión, /assets/partidos.js pone tus equipos.
  const misEquipos = `<div class="mis-equipos" id="mis-equipos" data-titulo="${esc(S.yourTeams)}" data-base="${esc(`${base}/`)}" data-zona="${esc(zona)}">
      <p>${esc(S.noTeams)}</p>
      <a class="pill" href="${esc(`${cuentaBase(lang)}#/equipos`)}">${esc(S.followTeam)}</a>
    </div>`;

  let cuerpo;
  if (lista.length) {
    cuerpo = `${misEquipos}${porDias(lista, { lang, S, tz, hrefDe })}${KE.conAtribucion(lista) ? atribucion() : ''}`;
  } else if (conTexto) {
    // Búsqueda sin nada: centrada, con salida.
    cuerpo = `<section class="vacio">
      <span class="vacio-ic" aria-hidden="true">${ic('buscar', 30)}</span>
      <h2>${esc(S.notFound(e.q))}</h2>
      <p>${esc(S.notFoundText)}</p>
      <div class="vacio-botones">
        <a class="pill accent" href="${esc(`${cuentaBase(lang)}#/equipos`)}">${esc(S.followTeam)}</a>
        <a class="pill" href="${esc(link({ q: '', sport: '' }))}">${esc(S.seeAll)}</a>
      </div>
    </section>`;
  } else {
    // Ningún bar cerca pone nada: centrada, con «Seguir a un equipo» (y, con
    // una zona, mirar en todas las ciudades).
    const todas = e.city || e.cerca ? `<a class="pill" href="${esc(link({ city: '', cerca: false, sport: '' }))}">${esc(en ? 'See every city' : 'Ver todas las ciudades')}</a>` : '';
    cuerpo = `<section class="vacio">
      <span class="vacio-ic" aria-hidden="true">${ic('balon', 30)}</span>
      <h2>${esc(S.emptyTitle)}</h2>
      <p>${esc(S.emptyText)}</p>
      <div class="vacio-botones">
        <a class="pill accent" href="${esc(`${cuentaBase(lang)}#/equipos`)}">${esc(S.followTeam)}</a>
        ${todas}
      </div>
    </section>`;
  }

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${en ? '/en/explore/' : '/explorar/'}">${en ? 'Explore' : 'Explorar'}</a></p>
  <div class="exp-cab cab-pagina"><div><h1>${esc(S.title)}</h1>
    <p class="muted exp-lead">${esc(S.lead)}</p></div></div>
  ${buscador}
  ${barra}
  ${cuerpo}`;

  // Una búsqueda, una zona o un deporte concretos no aportan nada al índice
  // de Google; la página limpia sí.
  const filtrada = Boolean(e.q || e.city || e.cerca || e.sport);
  const migas = [['Klendar', en ? '/en/' : '/'], [S.title, `${base}/`]];
  return html(publicPage({
    lang,
    path: `${base}/`,
    title: S.title,
    description: `${S.lead}. ${en ? 'Find a bar nearby showing your match, with its offer.' : 'Encuentra un bar cerca que ponga tu partido, con su oferta.'}`,
    body,
    actual: 'explorar',
    head: `${PARTIDOS_CSS}
${recuperaZona()}
${filtrada ? '<meta name="robots" content="noindex, follow">' : ldScript({ '@context': 'https://schema.org', ...breadcrumbLd(migas) })}
${partidosScript(lang)}`,
    contador: !e.cerca,
  }), 200, 'public, max-age=120, s-maxage=300');
}

// ── El detalle de un partido ──────────────────────────────────────────────
function noEsta(lang) {
  const en = lang === 'en';
  const S = KE.t(lang);
  const base = partidosBase(lang);
  const titulo = en ? 'This match is no longer here' : 'Este partido ya no está';
  const texto = en ? 'It may have been removed or the link may be wrong.' : 'Puede que lo hayan quitado o que el enlace esté mal.';
  return html(publicPage({
    lang, path: `${base}/`, title: titulo, description: texto, head: `<meta name="robots" content="noindex">\n${PARTIDOS_CSS}`,
    actual: 'explorar',
    body: `<p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${base}/">${esc(S.title)}</a></p>
  <section class="vacio">
    <h1>${esc(titulo)}</h1>
    <p>${esc(texto)}</p>
    <div class="vacio-botones"><a class="pill accent" href="${base}/">${esc(S.title)}</a></div>
  </section>`,
  }), 404, 'no-store');
}

export async function partidoPage(rawId, url, lang) {
  const en = lang === 'en';
  const S = KE.t(lang);
  const base = partidosBase(lang);
  const id = String(rawId || '').toLowerCase();
  if (!isUuid(id)) return noEsta(lang);
  const e = leeEstado(url.searchParams);
  const [ciudades, ciudadesK] = await Promise.all([
    rpcAll('public_cities', {}),
    rows('cities', 'select=id,name,lat,lng&order=position.asc').catch(() => []),
  ]);
  const origen = origenDe(e, ciudadesK);
  const d = await rpc('broadcast_detail', { p_broadcast: id, p_lat: origen?.lat ?? null, p_lng: origen?.lng ?? null, p_lang: lang });
  if (!d || !d.id) return noEsta(lang);
  const zona = zonaQs(e, lang);
  // Fusionado con otro: la dirección buena (una sola por partido).
  if (d.id !== id) {
    return new Response(null, { status: 301, headers: { location: conQs(`${base}/${d.id}`, zona), 'cache-control': 'public, max-age=300' } });
  }
  const tz = zonaHora(origen);
  const path = `${base}/${d.id}`;
  const bares = Array.isArray(d.bars) ? d.bars : [];
  const link = (cambios) => {
    const b = { ...e, ...cambios };
    if (b.cerca === false) { b.lat = null; b.lng = null; }
    return conQs(path, zonaQs(b, lang));
  };

  const que = [d.competition, KE.deporte(d.sport, lang)].filter(Boolean).join(' · ');
  // Lo que no está en juego ni por jugar (terminado, aplazado o cancelado).
  const estado = d.live ? '' : d.status === 'postponed' ? (en ? 'Postponed' : 'Aplazado')
    : d.status === 'cancelled' ? (en ? 'Cancelled' : 'Cancelado') : (en ? 'It has finished' : 'Ya ha terminado');
  const equipos = (d.teams || []).filter((t) => isUuid(t.id) && t.name);
  // «Seguir a Real Madrid» / «Seguir a Barça»: neutros, uno debajo de otro y del mismo ancho.
  const seguir = equipos.length ? `<div class="seguir-equipos">${equipos.map((t) => `<a class="pill" href="${esc(seguirHref(lang, t))}"
      data-seguir-equipo="${esc(t.id)}" data-nombre="${esc(t.name)}" data-si="${esc(S.following(t.name))}" data-no="${esc(S.follow(t.name))}" aria-pressed="false">${esc(S.follow(t.name))}</a>`).join('')}</div>` : '';

  const barHtml = (bz) => {
    const logo = /^https:\/\//.test(bz.logo || '') ? `<img src="${esc(bz.logo)}" alt="" width="56" height="56" loading="lazy" decoding="async">`
      : `<span class="ph" aria-hidden="true">${esc((bz.name || '·').charAt(0).toUpperCase())}</span>`;
    const donde = [bz.address || bz.city, distancia(Number(bz.distance_m), lang)].filter(Boolean).join(' · ');
    const o = bz.offer && isUuid(bz.offer.id) ? bz.offer : null;
    return `<article class="bar-partido">
        <a class="bar-partido-neg" href="${esc(bizPath(lang, bz.slug || bz.business_id))}">
          ${logo}
          <span class="bar-partido-t"><b>${esc(bz.name)}</b>${donde ? `<small class="muted">${esc(donde)}</small>` : ''}</span>
          <span class="partido-ir" aria-hidden="true">${ic('der', 20)}</span>
        </a>
        ${o ? `<a class="bar-partido-oferta" href="${en ? '/en' : ''}/o/${esc(o.id)}">${ic('oferta', 16)}<span>${esc(S.offer(o.title))}</span></a>` : ''}
      </article>`;
  };

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${esc(conQs(`${base}/`, zona))}">${esc(S.title)}</a></p>
  <div class="partido-cab">
    ${que ? `<p class="eyebrow">${esc(que)}</p>` : ''}
    <h1>${esc(d.title)}</h1>
    <p class="partido-cuando">${esc(KE.cuandoLargo(d, tz, lang))}${estado ? ` · <b>${esc(estado)}</b>` : ''}</p>
    ${seguir}
  </div>
  <div class="barra-filtros partidos-barra">${zonaMenu(e, lang, ciudades, link)}</div>
  <p id="cercaErr" class="aviso-error" role="alert" hidden></p>
  <h2 class="partido-h">${esc(S.barsSection)}</h2>
  ${bares.length
    ? `<div class="bares-partido">${bares.map(barHtml).join('')}</div>`
    : `<div class="partido-sin-bares"><p><b>${esc(S.none)}</b></p><p class="muted">${esc(S.detailEmpty)}</p></div>`}
  ${d.source === 'football-data' ? atribucion() : ''}`;

  const n = bares.length;
  const description = `${KE.cuandoLargo(d, tz, lang)}${d.competition ? ` · ${d.competition}` : ''}. ${n ? S.bars(n) : S.none}.`;
  const migas = [['Klendar', en ? '/en/' : '/'], [S.title, `${base}/`], [d.title, path]];
  return html(publicPage({
    lang,
    path,
    title: `${d.title}: ${S.title.charAt(0).toLowerCase()}${S.title.slice(1)}`,
    description,
    body,
    actual: 'explorar',
    head: `${PARTIDOS_CSS}
${zona || !d.live ? '<meta name="robots" content="noindex, follow">' : ldScript({ '@context': 'https://schema.org', ...breadcrumbLd(migas) })}
${partidosScript(lang)}`,
    contador: !e.cerca,
  }), 200, 'public, max-age=120, s-maxage=300');
}

// ── En la ficha del bar ───────────────────────────────────────────────────
/** «Pone el partido» / «Pone estos partidos»: lo que pone los próximos 7 días
 * («Real Madrid – Barça · sáb 21:00») y su oferta, en coral. '' si nada. */
export async function partidosDelBar(businessId, lang, tz) {
  let lista = [];
  try { lista = await rpcAll('business_broadcasts_public', { p_business: businessId, p_lang: lang }); } catch { return ''; }
  if (!lista.length) return '';
  const en = lang === 'en';
  const S = KE.t(lang);
  const base = partidosBase(lang);
  return `<section class="pone-partidos" id="partidos" aria-labelledby="poneT">
      <h2 id="poneT">${esc(lista.length === 1 ? S.showingOne : S.showingMany)}</h2>
      <ul class="pone-lista">${lista.map((b) => `<li>
        <a href="${base}/${esc(b.id)}">${ic('balon', 18)}<span><b>${esc(b.title)}</b> · ${esc(KE.cuandoCorto(b, tz, lang))}</span></a>
        ${b.offer && isUuid(b.offer.id) ? `<a class="bar-partido-oferta" href="${en ? '/en' : ''}/o/${esc(b.offer.id)}">${ic('oferta', 16)}<span>${esc(S.offer(b.offer.title))}</span></a>` : ''}
      </li>`).join('')}</ul>
      ${KE.conAtribucion(lista) ? atribucion() : ''}
    </section>`;
}

// ── En la búsqueda de Explorar ────────────────────────────────────────────
/** Con texto: como mucho 3 partidos que pone algún bar cerca y «Ver todos».
 * `origen`: tu posición o el centro de la ciudad (o nada). '' si no hay. */
export async function partidosEnBusqueda({ q, lang, origen, zona }) {
  if (String(q || '').trim().length < 2) return '';
  let lista = [];
  try {
    lista = await rpcAll('where_to_watch', { p_q: q, p_lat: origen?.lat ?? null, p_lng: origen?.lng ?? null, p_lang: lang, p_limit: 20 });
  } catch { return ''; }
  const conBares = lista.filter((b) => Number(b.bars) > 0).slice(0, 3);
  if (!conBares.length) return '';
  const S = KE.t(lang);
  const base = partidosBase(lang);
  const tz = zonaHora(origen);
  const zq = zona || '';
  const todos = new URLSearchParams(zq);
  todos.set('q', q);
  return `<section class="seccion-partidos" aria-labelledby="secPartidos">
      <div class="seccion-cab"><h2 id="secPartidos">${esc(S.title)}</h2><a href="${esc(`${base}/?${todos}`)}">${esc(S.seeAll)}</a></div>
      <div class="partidos-lista">${conBares.map((b) => filaPartido(b, { lang, S, tz, href: conQs(`${base}/${b.id}`, zq) })).join('')}</div>
      ${KE.conAtribucion(conBares) ? atribucion() : ''}
    </section>`;
}

/** El punto de una zona de Explorar (para `partidosEnBusqueda`). */
export const origenDeZona = (e, ciudadesK) => origenDe({ cerca: e.cerca, lat: e.lat, lng: e.lng, city: e.city || '' }, ciudadesK);
/** La zona de Explorar en las claves de estas páginas. */
export const zonaDeExplorar = (e, lang) => zonaQs({ cerca: e.cerca, lat: e.lat, lng: e.lng, city: e.city || '' }, lang);
