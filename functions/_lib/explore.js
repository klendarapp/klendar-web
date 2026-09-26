// Explorar, categorías y colecciones: la web deja de ser un folleto.
//
// Todo se pinta en el servidor y funciona sin JavaScript: un buscador que es
// un formulario GET, unos filtros que son enlaces y una lista paginada. Así
// lo lee Google, lo lee un lector de pantalla y lo lee alguien con el móvil
// en mitad de la calle.

import { esc, html, rpc, rpcAll } from './page.js';
import {
  agendaBase, BASE, collectionBase, exploreBase, isVideo, offerCard, publicPage,
} from './public.js';

const PRETTY = (s) => String(s || '').replace(/(^|[\s-])(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
const CITY = (c) => encodeURIComponent(String(c || '').toLowerCase());
const POR_PAGINA = 24;

const T = (en) => en
  ? {
      exp: 'Explore', agenda: "What's on", search: 'Search', ph: 'A bar, a market, «brunch»…',
      all: 'All', allCities: 'Every city', offers: 'Flash offers', events: 'Events',
      city: 'City', cat: 'Category', kind: 'Type', clear: 'Clear filters',
      none: 'Nothing matches that. Try with fewer filters.',
      results: (n) => `${n} ${n === 1 ? 'result' : 'results'}`,
      prev: '← Previous', next: 'Next →', page: 'Page',
      lead: 'Everything live right now: flash offers and local events. No account needed to look.',
      biz: 'Publish your business', app: 'Get the app',
      catTitle: (c, city) => `${c} in ${city}`,
      catLead: (c, city) => `Flash offers and events from ${c.toLowerCase()} in ${city}, updated as businesses publish.`,
      catNone: (c, city) => `No ${c.toLowerCase()} in ${city} have anything live right now.`,
      colNone: 'This selection is empty right now. Have a look in a while.',
      inCity: 'in', everywhere: 'Everywhere',
      what: 'Show', plans: 'Plans', places: 'Places',
      noPlaces: 'No places match that yet.',
      live: (n) => `${n} on right now`,
      picks: 'Selections', seeProfile: 'See the place',
      price: 'Price', any: 'Any', free: 'Free', upTo: (n) => `Up to €${n}`,
      when: 'When?', anytime: 'Any time', now: 'Right now', today: 'Today', tomorrow: 'Tomorrow', next10: 'Next 10 days',
      discount: 'Discounts only', sort: 'Sort by', soonest: 'Soonest', newest: 'Newest', nearest: 'Nearest',
      near: 'Near me', nearOn: 'Near you', nearNo: 'We could not get your location. Allow it in the browser and try again.',
      view: 'View', listView: 'List', mapView: 'Map',
      mapNo: 'The map cannot load right now. The list has the same.', away: 'away',
    }
  : {
      exp: 'Explorar', agenda: 'Agenda local', search: 'Buscar', ph: 'Un bar, un mercadillo, «brunch»…',
      all: 'Todo', allCities: 'Todas las ciudades', offers: 'Ofertas flash', events: 'Eventos',
      city: 'Ciudad', cat: 'Categoría', kind: 'Tipo', clear: 'Quitar filtros',
      none: 'No hay nada con esos filtros. Prueba con menos.',
      results: (n) => `${n} ${n === 1 ? 'resultado' : 'resultados'}`,
      prev: '← Anterior', next: 'Siguiente →', page: 'Página',
      lead: 'Todo lo que hay ahora mismo: ofertas flash y planes de barrio. Para mirar no hace falta cuenta.',
      biz: 'Publicar mi negocio', app: 'Descargar la app',
      catTitle: (c, city) => `${c} en ${city}`,
      catLead: (c, city) => `Ofertas y planes de ${c.toLowerCase()} en ${city}, según van publicando los negocios.`,
      catNone: (c, city) => `Ahora mismo no hay nada de ${c.toLowerCase()} en ${city}.`,
      colNone: 'Esta selección está vacía ahora mismo. Vuelve a mirar en un rato.',
      inCity: 'en', everywhere: 'En todas partes',
      what: 'Ver', plans: 'Planes', places: 'Negocios',
      noPlaces: 'Todavía no hay negocios con eso.',
      live: (n) => `${n} ahora mismo`,
      picks: 'Selecciones', seeProfile: 'Ver el sitio',
      price: 'Precio', any: 'Cualquiera', free: 'Gratis', upTo: (n) => `Hasta ${n} €`,
      when: '¿Cuándo?', anytime: 'Cuando sea', now: 'Ahora mismo', today: 'Hoy', tomorrow: 'Mañana', next10: 'Próximos 10 días',
      discount: 'Solo con descuento', sort: 'Ordenar', soonest: 'Más pronto', newest: 'Novedades', nearest: 'Más cerca',
      near: 'Cerca de mí', nearOn: 'Cerca de ti', nearNo: 'No hemos podido saber dónde estás. Permítelo en el navegador y vuelve a probar.',
      view: 'Ver en', listView: 'Lista', mapView: 'Mapa',
      mapNo: 'El mapa no se puede cargar ahora mismo. En la lista está lo mismo.', away: '',
    };

const catName = (c, en) => (en ? c?.names?.en : c?.names?.es) || c?.slug || '';
const colTitle = (c, en) => (en ? c?.title?.en : c?.title?.es) || c?.slug || '';
const colSub = (c, en) => (en ? c?.subtitle?.en : c?.subtitle?.es) || '';

/** Lista de publicaciones más «no hay nada» dicho en cristiano. */
const lista = (items, lang, vacio) => items.length
  ? `<div class="olist">${items.map((o) => offerCard(o, lang)).join('')}</div>`
  : `<p class="empty">${esc(vacio)}</p>`;

/** Tarjeta de negocio, para la pestaña «Negocios». */
const bizCard = (b, lang, S) => {
  const en = lang === 'en';
  const nombre = (en ? b.names?.en : b.names?.es) || '';
  return `<a class="ocard" href="${en ? '/en' : ''}/b/${esc(b.id)}">
    ${b.logo_url ? `<img src="${esc(b.logo_url)}" alt="" loading="lazy">` : '<span class="ph">✦</span>'}
    <span class="ocard-body">
      <b>${esc(b.name)}</b>
      <span class="muted">${esc(nombre)}${b.address ? ` · ${esc(b.address)}` : ''}</span>
      <span class="ocard-meta">
        ${b.live ? `<span class="tag">${esc(S.live(b.live))}</span>` : ''}
        <span class="muted">${esc(S.seeProfile)} →</span>
      </span>
    </span>
  </a>`;
};

/** Mapa con una chincheta por publicación. Si Mapbox no carga (sin token,
 * sin red), se dice y se enseña la lista: nunca un hueco en blanco. */
const mapaHtml = (items, lang, S) => {
  const puntos = items.filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lng)).map((o) => ({
    id: o.id, t: o.title, b: o.business_name, lat: o.lat, lng: o.lng,
    u: `${lang === 'en' ? '/en' : ''}/o/${o.id}`,
  }));
  return `<div id="mapa" class="mapa-explorar" data-no="${esc(S.mapNo)}"></div>
  <div id="mapaLista" hidden>${lista(items, lang, S.none)}</div>
  <script type="application/json" id="mapaPuntos">${JSON.stringify(puntos).replace(/</g, '\\u003c')}</script>
  <script>(async function(){
    var caja=document.getElementById('mapa');var puntos=JSON.parse(document.getElementById('mapaPuntos').textContent||'[]');
    function falla(){caja.innerHTML='<p class="empty">'+caja.dataset.no+'</p>';document.getElementById('mapaLista').hidden=false;}
    try{
      var tk=(await (await fetch('/api/mapbox-token')).json()).token;if(!tk)return falla();
      await new Promise(function(ok,ko){var c=document.createElement('link');c.rel='stylesheet';c.href='https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.css';document.head.append(c);
        var s=document.createElement('script');s.src='https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.js';s.onload=ok;s.onerror=ko;document.head.append(s);});
      mapboxgl.accessToken=tk;
      var oscuro=matchMedia('(prefers-color-scheme: dark)').matches;
      var m=new mapboxgl.Map({container:caja,style:oscuro?'mapbox://styles/mapbox/dark-v11':'mapbox://styles/mapbox/light-v11',center:puntos.length?[puntos[0].lng,puntos[0].lat]:[-3.7038,40.4168],zoom:12});
      m.addControl(new mapboxgl.NavigationControl({showCompass:false}));
      var bounds=new mapboxgl.LngLatBounds();
      puntos.forEach(function(p){bounds.extend([p.lng,p.lat]);
        var el=document.createElement('a');el.className='chincheta';el.href=p.u;el.setAttribute('aria-label',p.t);
        var a=document.createElement('a');a.className='pop';a.href=p.u;
        var bt=document.createElement('b');bt.textContent=p.t;var sp=document.createElement('span');sp.textContent=p.b||'';
        a.append(bt,sp);
        var pop=new mapboxgl.Popup({offset:18,closeButton:false,focusAfterOpen:false}).setDOMContent(a);
        new mapboxgl.Marker({element:el}).setLngLat([p.lng,p.lat]).setPopup(pop).addTo(m);
        el.addEventListener('click',function(e){e.preventDefault();});
      });
      if(puntos.length>1)m.fitBounds(bounds,{padding:48,maxZoom:15,duration:0});
    }catch(e){falla();}
  })();</script>`;
};

const portada = (items) => items.map((o) => (o.images || []).find((u) => !isVideo(u))).find(Boolean);

// ── Explorar ───────────────────────────────────────────────────────────────
export async function explorePage(url, lang) {
  const en = lang === 'en';
  const S = T(en);
  const qs = url.searchParams;
  const q = (qs.get('q') || '').slice(0, 60);
  const city = (qs.get(en ? 'city' : 'ciudad') || '').slice(0, 60);
  const cat = (qs.get(en ? 'category' : 'categoria') || '').slice(0, 40);
  const kind = (qs.get(en ? 'type' : 'tipo') || '').slice(0, 20);
  const page = Math.max(1, Math.min(50, parseInt(qs.get('p') || '1', 10) || 1));
  // «Planes» o «Negocios»: la misma búsqueda, dos maneras de mirarla.
  const ver = (qs.get(en ? 'show' : 'ver') || '').slice(0, 20);
  const negocios = ver === 'places' || ver === 'negocios';
  // Los filtros de la app: precio, cuándo, solo descuento, orden, cerca de mí
  // y lista o mapa. Todo en la URL: se comparte y va sin JavaScript (salvo
  // el mapa y pedir la ubicación).
  const K = en
    ? { price: 'price', when: 'when', discount: 'discount', sort: 'sort', view: 'view' }
    : { price: 'precio', when: 'cuando', discount: 'descuento', sort: 'orden', view: 'vista' };
  const price = (qs.get(K.price) || '').slice(0, 10);
  const when = (qs.get(K.when) || '').slice(0, 12);
  const soloDescuento = qs.get(K.discount) === '1';
  const sort = (qs.get(K.sort) || '').slice(0, 12);
  const vista = (qs.get(K.view) || '').slice(0, 8);
  const mapa = !negocios && (vista === 'map' || vista === 'mapa');
  const lat = Number.parseFloat(qs.get('lat') || '');
  const lng = Number.parseFloat(qs.get('lng') || '');
  const cerca = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const WHEN = { ahora: 'now', now: 'now', hoy: 'today', today: 'today', manana: 'tomorrow', tomorrow: 'tomorrow', '10dias': 'next10', next10: 'next10' };
  const SORT = { nuevas: 'newest', newest: 'newest', cerca: 'nearest', nearest: 'nearest' };
  const filtros = {
    ...(price === 'gratis' || price === 'free' ? { free: true } : {}),
    ...(/^\d{1,3}$/.test(price) ? { max_price_cents: Number(price) * 100 } : {}),
    ...(WHEN[when] ? { when: WHEN[when] } : {}),
    ...(soloDescuento ? { discount_only: true } : {}),
    ...(SORT[sort] ? { sort: SORT[sort] } : cerca ? { sort: 'nearest' } : {}),
    ...(cerca ? { radius_m: 10000 } : {}),
  };
  const filtrado = Boolean(q || city || cat || kind || negocios || page > 1 || price || when || soloDescuento || sort || cerca);

  const [res, cities, cats, cols] = await Promise.all([
    negocios
      ? rpc('public_businesses', {
        p_city: city || null,
        p_category: cat || null,
        p_q: q || null,
        p_limit: POR_PAGINA,
        p_offset: (page - 1) * POR_PAGINA,
      })
      : rpc('public_explore', {
      p_city: city || null,
      p_category: cat || null,
      p_kind: kind === 'offers' || kind === 'ofertas' ? 'flash_offer'
        : kind === 'events' || kind === 'eventos' ? 'future_event' : null,
      p_q: q || null,
      p_limit: mapa ? 60 : POR_PAGINA,
      p_offset: mapa ? 0 : (page - 1) * POR_PAGINA,
      p_filters: filtros,
      p_lat: cerca ? lat : null,
      p_lng: cerca ? lng : null,
    }),
    rpcAll('public_cities', {}),
    rpcAll('public_categories', { p_city: city || null }),
    rpcAll('public_collections', { p_city: city || null }),
  ]);
  const items = res?.items || [];
  const total = res?.total || 0;
  const paginas = mapa ? 1 : Math.max(1, Math.ceil(total / POR_PAGINA));

  // Los filtros son enlaces: se puede compartir la URL y va sin JavaScript.
  const link = (cambios) => {
    const p = new URLSearchParams();
    const base = { q, city, cat, kind, ver, price, when, soloDescuento, sort, vista, cerca, p: 1, ...cambios };
    if (base.q) p.set('q', base.q);
    if (base.city) p.set(en ? 'city' : 'ciudad', base.city);
    if (base.cat) p.set(en ? 'category' : 'categoria', base.cat);
    if (base.kind && !base.ver) p.set(en ? 'type' : 'tipo', base.kind);
    if (base.ver) p.set(en ? 'show' : 'ver', base.ver);
    if (!base.ver) {
      if (base.price) p.set(K.price, base.price);
      if (base.when) p.set(K.when, base.when);
      if (base.soloDescuento) p.set(K.discount, '1');
      if (base.sort) p.set(K.sort, base.sort);
      if (base.vista) p.set(K.view, base.vista);
      if (base.cerca) { p.set('lat', lat.toFixed(4)); p.set('lng', lng.toFixed(4)); }
    }
    if (base.p && base.p > 1) p.set('p', String(base.p));
    const s = p.toString();
    return `${exploreBase(lang)}/${s ? `?${s}` : ''}`;
  };
  const chip = (href, label, on) => `<a class="chip${on ? ' on' : ''}" href="${esc(href)}">${esc(label)}</a>`;

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${agendaBase(lang)}/">${S.agenda}</a></p>
  <h1>${esc(S.exp)}</h1>
  <p class="muted" style="max-width:640px">${esc(S.lead)}</p>

  <form class="finder" method="get" action="${exploreBase(lang)}/">
    <input type="search" name="q" value="${esc(q)}" placeholder="${esc(S.ph)}" aria-label="${esc(S.search)}">
    ${city ? `<input type="hidden" name="${en ? 'city' : 'ciudad'}" value="${esc(city)}">` : ''}
    ${cat ? `<input type="hidden" name="${en ? 'category' : 'categoria'}" value="${esc(cat)}">` : ''}
    ${kind && !negocios ? `<input type="hidden" name="${en ? 'type' : 'tipo'}" value="${esc(kind)}">` : ''}
    ${negocios ? `<input type="hidden" name="${en ? 'show' : 'ver'}" value="${esc(ver)}">` : ''}
    ${negocios ? '' : [[K.price, price], [K.when, when], [K.discount, soloDescuento ? '1' : ''], [K.sort, sort], [K.view, vista],
      ['lat', cerca ? lat.toFixed(4) : ''], ['lng', cerca ? lng.toFixed(4) : '']]
      .filter(([, val]) => val).map(([k, val]) => `<input type="hidden" name="${k}" value="${esc(val)}">`).join('')}
    <button class="pill accent" type="submit">${esc(S.search)}</button>
  </form>

  <div class="filters">
    <div class="frow"><span class="flabel">${esc(S.what)}</span>
      ${chip(link({ ver: '' }), S.plans, !negocios)}
      ${chip(link({ ver: en ? 'places' : 'negocios' }), S.places, negocios)}
    </div>
    ${negocios ? '' : `<div class="frow"><span class="flabel">${esc(S.kind)}</span>
      ${chip(link({ kind: '' }), S.all, !kind)}
      ${chip(link({ kind: en ? 'offers' : 'ofertas' }), S.offers, kind === 'offers' || kind === 'ofertas')}
      ${chip(link({ kind: en ? 'events' : 'eventos' }), S.events, kind === 'events' || kind === 'eventos')}
    </div>`}
    ${negocios ? '' : `<div class="frow"><span class="flabel">${esc(S.when)}</span>
      ${chip(link({ when: '' }), S.anytime, !when)}
      ${[[en ? 'now' : 'ahora', S.now], [en ? 'today' : 'hoy', S.today], [en ? 'tomorrow' : 'manana', S.tomorrow], [en ? 'next10' : '10dias', S.next10]]
        .map(([k, n]) => chip(link({ when: k }), n, when === k)).join('')}
    </div>
    <div class="frow"><span class="flabel">${esc(S.price)}</span>
      ${chip(link({ price: '' }), S.any, !price)}
      ${chip(link({ price: en ? 'free' : 'gratis' }), S.free, price === 'free' || price === 'gratis')}
      ${['10', '25', '50'].map((n) => chip(link({ price: n }), S.upTo(n), price === n)).join('')}
      ${chip(link({ soloDescuento: !soloDescuento }), S.discount, soloDescuento)}
    </div>
    <div class="frow"><span class="flabel">${esc(S.sort)}</span>
      ${chip(link({ sort: '' }), S.soonest, !sort && !cerca)}
      ${chip(link({ sort: en ? 'newest' : 'nuevas' }), S.newest, sort === 'newest' || sort === 'nuevas')}
      ${cerca
        ? `${chip(link({ sort: en ? 'nearest' : 'cerca' }), S.nearest, sort === 'nearest' || sort === 'cerca' || !sort)}
           ${chip(link({ cerca: false, sort: '' }), `✕ ${S.nearOn}`, true)}`
        : `<button type="button" class="chip" id="cercaDeMi" data-err="${esc(S.nearNo)}">${esc(S.near)}</button>`}
    </div>
    <div class="frow"><span class="flabel">${esc(S.view)}</span>
      ${chip(link({ vista: '' }), S.listView, !mapa)}
      ${chip(link({ vista: en ? 'map' : 'mapa' }), S.mapView, mapa)}
    </div>`}
    ${cities.length > 1 ? `<div class="frow"><span class="flabel">${esc(S.city)}</span>
      ${chip(link({ city: '' }), S.allCities, !city)}
      ${cities.filter((c) => c.city).slice(0, 12).map((c) => chip(link({ city: String(c.city) }), PRETTY(c.city), city.toLowerCase() === String(c.city).toLowerCase())).join('')}
    </div>` : ''}
    ${(cats || []).length ? `<div class="frow"><span class="flabel">${esc(S.cat)}</span>
      ${chip(link({ cat: '' }), S.all, !cat)}
      ${(cats || []).map((c) => chip(link({ cat: c.slug }), negocios ? catName(c, en) : `${catName(c, en)} (${c.n})`, cat === c.slug)).join('')}
    </div>` : ''}
    ${filtrado ? `<p><a class="muted" href="${exploreBase(lang)}/">${esc(S.clear)}</a></p>` : ''}
  </div>

  ${cols.length ? `<div class="filters"><div class="frow"><span class="flabel">${esc(S.picks)}</span>
    ${cols.map((c) => `<a class="chip" href="${collectionBase(lang)}/${encodeURIComponent(c.slug)}/${city ? `${CITY(city)}/` : ''}">${esc(colTitle(c, en))}</a>`).join('')}
  </div></div>` : ''}

  <p class="muted" style="margin:18px 0 8px">${esc(S.results(total))}</p>
  ${negocios
    ? (items.length
      ? `<div class="olist">${items.map((b) => bizCard(b, lang, S)).join('')}</div>`
      : `<p class="empty">${esc(S.noPlaces)}</p>`)
    : mapa ? mapaHtml(items, lang, S) : lista(items, lang, S.none)}
  ${paginas > 1 ? `<nav class="pager">
    ${page > 1 ? `<a class="pill" href="${esc(link({ p: page - 1 }))}">${esc(S.prev)}</a>` : ''}
    <span class="muted">${esc(S.page)} ${page}/${paginas}</span>
    ${page < paginas ? `<a class="pill" href="${esc(link({ p: page + 1 }))}">${esc(S.next)}</a>` : ''}
  </nav>` : ''}

  <script>(function(){var b=document.getElementById('cercaDeMi');if(!b)return;
    if(!navigator.geolocation){b.hidden=true;return;}
    b.onclick=function(){navigator.geolocation.getCurrentPosition(function(p){
      var u=new URL(location.href);u.searchParams.set('lat',p.coords.latitude.toFixed(4));u.searchParams.set('lng',p.coords.longitude.toFixed(4));u.searchParams.delete('p');location.href=u.toString();
    },function(){alert(b.dataset.err);},{maximumAge:300000,timeout:10000});};})();</script>
  <p style="margin-top:22px"><a class="pill accent" href="/${en ? 'en/' : ''}">${esc(S.app)}</a> <a class="pill" href="${en ? '/en/business-terms/' : '/negocios/'}">${esc(S.biz)}</a></p>`;

  return html(publicPage({
    lang,
    path: `${exploreBase(lang)}/`,
    title: S.exp,
    description: S.lead,
    image: portada(items),
    body,
    // Una búsqueda concreta no aporta nada al índice de Google; la página
    // limpia sí.
    head: filtrado ? '<meta name="robots" content="noindex, follow">' : '',
  }), 200, 'public, max-age=120, s-maxage=600');
}

// ── Una categoría en una ciudad ────────────────────────────────────────────
export async function categoryPage(rawCity, rawCat, lang) {
  const en = lang === 'en';
  const S = T(en);
  const rawc = decodeURIComponent(rawCity || '').replace(/\/+$/, '');
  const slug = decodeURIComponent(rawCat || '').replace(/\/+$/, '').toLowerCase();
  const path = `${agendaBase(lang)}/${CITY(rawc)}/${encodeURIComponent(slug)}/`;

  const [res, cats] = await Promise.all([
    rpc('public_explore', { p_city: rawc, p_category: slug, p_limit: 60 }),
    rpcAll('public_categories', { p_city: rawc }),
  ]);
  const cat = (cats || []).find((c) => c.slug === slug);
  const items = res?.items || [];
  const city = PRETTY(items[0]?.city || rawc);
  const nombre = cat ? catName(cat, en) : PRETTY(slug);
  const h1 = S.catTitle(nombre, city);

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${agendaBase(lang)}/">${S.agenda}</a> · <a href="${agendaBase(lang)}/${CITY(rawc)}/">${esc(city)}</a></p>
  <h1>${esc(h1)}</h1>
  <p class="muted" style="max-width:640px">${esc(S.catLead(nombre, city))}</p>
  ${(cats || []).length ? `<div class="filters"><div class="frow">
    ${(cats || []).map((c) => `<a class="chip${c.slug === slug ? ' on' : ''}" href="${agendaBase(lang)}/${CITY(rawc)}/${encodeURIComponent(c.slug)}/">${esc(catName(c, en))} <span class="muted">${c.n}</span></a>`).join('')}
  </div></div>` : ''}
  ${lista(items, lang, S.catNone(nombre, city))}
  <p style="margin-top:22px"><a class="pill accent" href="${exploreBase(lang)}/">${esc(S.exp)}</a> <a class="pill" href="${agendaBase(lang)}/${CITY(rawc)}/">${esc(city)}</a></p>`;

  const jsonLd = items.length ? {
    '@context': 'https://schema.org', '@type': 'ItemList', name: h1, url: `${BASE}${path}`,
    numberOfItems: items.length,
    itemListElement: items.slice(0, 30).map((o, i) => ({
      '@type': 'ListItem', position: i + 1, url: `${BASE}${en ? '/en' : ''}/o/${o.id}`, name: o.title,
    })),
  } : null;

  return html(publicPage({
    lang, path, body, title: h1,
    description: items.length ? S.catLead(nombre, city) : S.catNone(nombre, city),
    image: portada(items),
    head: jsonLd
      ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
      : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=300, s-maxage=900');
}

// ── Una colección ──────────────────────────────────────────────────────────
export async function collectionPage(rawSlug, rawCity, lang) {
  const en = lang === 'en';
  const S = T(en);
  const slug = decodeURIComponent(rawSlug || '').replace(/\/+$/, '').toLowerCase();
  const rawc = decodeURIComponent(rawCity || '').replace(/\/+$/, '');
  const path = `${collectionBase(lang)}/${encodeURIComponent(slug)}/${rawc ? `${CITY(rawc)}/` : ''}`;

  const [cols, res, cities] = await Promise.all([
    rpcAll('public_collections', { p_city: rawc || null }),
    rpc('public_explore', { p_city: rawc || null, p_collection: slug, p_limit: 48 }),
    rpcAll('public_cities', {}),
  ]);
  const col = (cols || []).find((c) => c.slug === slug);
  const items = res?.items || [];
  const titulo = col ? colTitle(col, en) : PRETTY(slug.replace(/-/g, ' '));
  const city = rawc ? PRETTY(items[0]?.city || rawc) : '';
  const h1 = city ? `${titulo} ${S.inCity} ${city}` : titulo;

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${exploreBase(lang)}/">${esc(S.exp)}</a></p>
  <h1>${esc(h1)}</h1>
  ${col && colSub(col, en) ? `<p class="muted" style="max-width:640px">${esc(colSub(col, en))}</p>` : ''}
  ${cities.length > 1 ? `<div class="filters"><div class="frow"><span class="flabel">${esc(S.city)}</span>
    <a class="chip${rawc ? '' : ' on'}" href="${collectionBase(lang)}/${encodeURIComponent(slug)}/">${esc(S.everywhere)}</a>
    ${cities.filter((c) => c.city).slice(0, 12).map((c) => `<a class="chip${rawc.toLowerCase() === String(c.city).toLowerCase() ? ' on' : ''}" href="${collectionBase(lang)}/${encodeURIComponent(slug)}/${CITY(c.city)}/">${esc(PRETTY(c.city))}</a>`).join('')}
  </div></div>` : ''}
  ${lista(items, lang, S.colNone)}
  <p style="margin-top:22px"><a class="pill accent" href="${exploreBase(lang)}/">${esc(S.exp)}</a> <a class="pill" href="${agendaBase(lang)}/">${esc(S.agenda)}</a></p>`;

  return html(publicPage({
    lang, path, body, title: h1,
    description: (col && colSub(col, en)) || S.lead,
    image: portada(items),
    head: items.length ? '' : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=300, s-maxage=900');
}
