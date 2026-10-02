// Descubre, Explorar, categorías y colecciones: la web organizada como la app.
//
// Todo se pinta en el servidor y funciona sin JavaScript: el buscador es un
// formulario GET, los desplegables son <details> con enlaces, la hoja de
// filtros es otro formulario GET y la lista va paginada. Así lo lee Google,
// lo lee un lector de pantalla y lo lee alguien con el móvil en mitad de la
// calle. Con JavaScript, además: «Cerca de mí», el mapa, el vídeo de las
// tarjetas y cerrar los desplegables al pulsar fuera.
//
// - Descubre (/descubre/, /en/discover/): el feed de tarjetas grandes, lo
//   más cerca primero si has dicho dónde estás (la pestaña 1 de la app).
// - Explorar (/explorar/, /en/explore/): buscar, y verlo en Lista, Mapa o
//   Calendario (la pestaña 2 de la app: calendario + mapa).

import { esc, html, rpc, rpcAll } from './page.js';
import KZ from '../../assets/zona.js';
import {
  agendaBase, bizPath, cityLinks, collectionBase, decodeSeg, discoverBase, exploreBase, isVideo, ldScript, listingLd,
  publicPage, todayBase,
} from './public.js';
import { rejilla, tarjeta } from './tarjeta.js';

/** Una dirección mal codificada no es un 500: se manda al listado (302). */
const aListado = (loc) => new Response(null, { status: 302, headers: { Location: loc, 'Cache-Control': 'no-store' } });

const PRETTY = (s) => String(s || '').replace(/(^|[\s-])(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
const CITY = (c) => encodeURIComponent(String(c || '').toLowerCase());
const POR_PAGINA = 24;

const T = (en) => en
  ? {
      exp: 'Explore', disc: 'Discover', agenda: "What's on", search: 'Search', ph: 'A bar, a market, “brunch”…',
      all: 'All', allCities: 'Every city', offers: 'Flash offers', events: 'Events',
      city: 'City', cat: 'Category', kind: 'Type', clear: 'Clear filters',
      none: 'Nothing matches those filters. Try removing some.',
      results: (n) => `${n} ${n === 1 ? 'result' : 'results'}`,
      places: (n) => `${n} ${n === 1 ? 'place' : 'places'}`,
      prev: '← Previous', next: 'Next →', page: 'Page',
      lead: 'Search, and see it as a list, on the map or on the calendar. No account needed to browse.',
      discLead: 'Flash offers and events from the businesses around you, closest first. No account needed to browse.',
      biz: 'List your business', app: 'Create a free account',
      catTitle: (c, city) => `${c} in ${city}`,
      catHead: (c, city) => `${c} in ${city}: deals and events`,
      catLead: (c, city) => `Flash offers and events from ${c.toLowerCase()} in ${city}, updated as businesses publish.`,
      catDesc: (c, city, n) => `${n} ${n === 1 ? 'deal or event' : 'deals and events'} from ${c.toLowerCase()} in ${city}: flash offers with a countdown, events and the places that publish them. No account needed to browse.`,
      catPlaces: (c, city) => `${c} in ${city} on Klendar`,
      todayIn: 'Things to do today in', weekIn: 'This week in', byCat: 'By category',
      catNone: (c, city) => `No ${c.toLowerCase()} in ${city} have anything on right now.`,
      colNone: 'Nothing in this selection right now. Check back soon.',
      inCity: 'in', everywhere: 'Everywhere',
      placesType: 'Places',
      noPlaces: 'No places match that yet.',
      live: (n) => `${n} on right now`,
      picks: 'Selections', seeProfile: 'See the place', more: 'More ways to explore',
      price: 'Price', any: 'Any', free: 'Free', upTo: (n) => `Up to €${n}`,
      when: 'When?', anytime: 'Any time', now: 'Right now', today: 'Today', tomorrow: 'Tomorrow', next10: 'Next 10 days',
      discount: 'Discounts only', openNow: 'Open now', sort: 'Sort by', soonest: 'Soonest', newest: 'Newest', nearest: 'Nearest',
      near: 'Near me', nearOn: 'Near you', nearNo: "We couldn't get your location. Allow it in your browser and try again.",
      where: 'Where', useLoc: 'Use my location', nearPrompt: 'See what’s closest to you first.',
      view: 'View', listView: 'List', mapView: 'Map', calView: 'Calendar', distance: 'Distance',
      filters: 'Filters', filtersN: (n) => `Filters, ${n} on`, showResults: 'Show results', close: 'Close',
      mapNo: "The map can't load right now. The list shows the same results.", onMap: (n) => `${n} on the map`,
      // Calendario (la agenda de la app).
      prevMonth: 'Previous month', nextMonth: 'Next month', legendEv: 'Events', legendFl: 'Flash offers',
      dayPlans: (n) => `${n} ${n === 1 ? 'plan' : 'plans'}`, dayNone: 'Nothing on this day.',
      nextWith: (d) => `Next day with plans: ${d}`, todayRel: 'Today', tomorrowRel: 'Tomorrow',
      dayLabel: (d, n) => `${d}: ${n ? `${n} ${n === 1 ? 'plan' : 'plans'}` : 'nothing'}`,
      // Final de la lista (como el final de Descubre en la app).
      endTitle: (d) => `You've seen everything ${d}`, endTitleAll: "You're all caught up for now",
      within: (km) => `within ${km} km`, inPlace: (c) => `in ${c}`,
      endBody: "Widen the search to see more, or check what's on in the coming days.",
      endBodyFiltered: "That's with the filters you have on. Clear them or widen the search to see more.",
      endBodyAll: "There's nothing else for now. Businesses publish every day: check back later or let us tell you.",
      endBodyAllFiltered: "There's nothing else with the filters you have on. Clear them, or let us tell you when something new comes up.",
      widen: (km) => `Widen to ${km} km`, allCitiesBtn: 'See every city',
      clearF: 'Clear filters', changeF: 'Change filters', seeAgenda: "See what's on",
      backTop: 'Back to the top', notifyMe: "Tell me when there's something new",
      recommend: 'Missing a place? Recommend a business', recommendDraft: "I'd like to see this business on Klendar: ",
      maybe: 'You might like',
      // Lista vacía (como Descubre vacío en la app): las mismas salidas.
      emptyTitle: 'Nothing around here yet', emptyTitleFiltered: 'Nothing with those filters',
      emptyBody: (d) => `Nothing active ${d} right now. Widen the search, check what's on or let us tell you when there's something new.`,
      emptyBodyFiltered: (d) => `Nothing ${d} with the filters you have on. Clear them or widen the search to see more.`,
      emptyBodyAll: "Nothing active right now. Businesses publish every day: check back later or let us tell you.",
      emptyBodyAllFiltered: 'Nothing with the filters you have on. Clear them, or let us tell you when something new comes up.',
    }
  : {
      exp: 'Explorar', disc: 'Descubre', agenda: 'Agenda local', search: 'Buscar', ph: 'Un bar, un mercadillo, «brunch»…',
      all: 'Todo', allCities: 'Todas las ciudades', offers: 'Ofertas flash', events: 'Eventos',
      city: 'Ciudad', cat: 'Categoría', kind: 'Tipo', clear: 'Quitar filtros',
      none: 'No hay nada con esos filtros. Prueba con menos.',
      results: (n) => `${n} ${n === 1 ? 'resultado' : 'resultados'}`,
      places: (n) => `${n} ${n === 1 ? 'negocio' : 'negocios'}`,
      prev: '← Anterior', next: 'Siguiente →', page: 'Página',
      lead: 'Busca y míralo en lista, en el mapa o en el calendario. Para mirar no hace falta cuenta.',
      discLead: 'Ofertas flash y planes de los negocios de tu alrededor, lo más cerca primero. Para mirar no hace falta cuenta.',
      biz: 'Publicar mi negocio', app: 'Crear cuenta gratis',
      catTitle: (c, city) => `${c} en ${city}`,
      catHead: (c, city) => `${c} en ${city}: ofertas y planes`,
      catLead: (c, city) => `Ofertas y planes de ${c.toLowerCase()} en ${city}, según van publicando los negocios.`,
      catDesc: (c, city, n) => `${n} ${n === 1 ? 'oferta o plan' : 'ofertas y planes'} de ${c.toLowerCase()} en ${city}: ofertas flash con cuenta atrás, eventos y los negocios que los publican. Sin cuenta para mirar.`,
      catPlaces: (c, city) => `${c} de ${city} en Klendar`,
      todayIn: 'Qué hacer hoy en', weekIn: 'Esta semana en', byCat: 'Por categoría',
      catNone: (c, city) => `Ahora mismo no hay nada de ${c.toLowerCase()} en ${city}.`,
      colNone: 'Esta selección está vacía ahora mismo. Vuelve a mirar en un rato.',
      inCity: 'en', everywhere: 'En todas partes',
      placesType: 'Negocios',
      noPlaces: 'Todavía no hay negocios con eso.',
      live: (n) => `${n} ahora mismo`,
      picks: 'Selecciones', seeProfile: 'Ver el sitio', more: 'Más formas de explorar',
      price: 'Precio', any: 'Cualquiera', free: 'Gratis', upTo: (n) => `Hasta ${n} €`,
      when: '¿Cuándo?', anytime: 'Cuando sea', now: 'Ahora mismo', today: 'Hoy', tomorrow: 'Mañana', next10: 'Próximos 10 días',
      discount: 'Solo con descuento', openNow: 'Abierto ahora', sort: 'Ordenar', soonest: 'Más pronto', newest: 'Novedades', nearest: 'Más cerca',
      near: 'Cerca de mí', nearOn: 'Cerca de ti', nearNo: 'No hemos podido saber dónde estás. Permítelo en el navegador y vuelve a probar.',
      where: 'Dónde', useLoc: 'Usar mi ubicación', nearPrompt: 'Mira primero lo que tienes más cerca.',
      view: 'Ver en', listView: 'Lista', mapView: 'Mapa', calView: 'Calendario', distance: 'Distancia',
      filters: 'Filtros', filtersN: (n) => (n === 1 ? 'Filtros, 1 puesto' : `Filtros, ${n} puestos`), showResults: 'Ver resultados', close: 'Cerrar',
      mapNo: 'El mapa no se puede cargar ahora mismo. En la lista está lo mismo.', onMap: (n) => `${n} en el mapa`,
      prevMonth: 'Mes anterior', nextMonth: 'Mes siguiente', legendEv: 'Eventos', legendFl: 'Ofertas flash',
      dayPlans: (n) => `${n} ${n === 1 ? 'plan' : 'planes'}`, dayNone: 'Este día no hay nada.',
      nextWith: (d) => `Siguiente día con planes: ${d}`, todayRel: 'Hoy', tomorrowRel: 'Mañana',
      dayLabel: (d, n) => `${d}: ${n ? `${n} ${n === 1 ? 'plan' : 'planes'}` : 'nada'}`,
      // Final de la lista (como el final de Descubre en la app).
      endTitle: (d) => `Has visto todo lo que hay ${d}`, endTitleAll: 'Ya lo has visto todo por ahora',
      within: (km) => `a ${km} km`, inPlace: (c) => `en ${c}`,
      endBody: 'Amplía la búsqueda para ver más o mira lo que viene en la agenda.',
      endBodyFiltered: 'Esto es con los filtros que tienes puestos. Quítalos o amplía la búsqueda para ver más.',
      endBodyAll: 'No hay nada más por ahora. Los negocios publican cada día: vuelve luego o deja que te avisemos.',
      endBodyAllFiltered: 'No hay nada más con los filtros que tienes puestos. Quítalos o deja que te avisemos cuando haya algo nuevo.',
      widen: (km) => `Ampliar a ${km} km`, allCitiesBtn: 'Ver todas las ciudades',
      clearF: 'Quitar filtros', changeF: 'Cambiar filtros', seeAgenda: 'Ver la agenda',
      backTop: 'Volver al principio', notifyMe: 'Avísame cuando haya algo nuevo',
      recommend: '¿Echas en falta algún sitio? Recomiéndanos un negocio', recommendDraft: 'Me gustaría ver en Klendar este negocio: ',
      maybe: 'Quizá te interese',
      // Lista vacía (como Descubre vacío en la app): las mismas salidas.
      emptyTitle: 'Aún no hay nada por aquí', emptyTitleFiltered: 'No hay nada con esos filtros',
      emptyBody: (d) => `No hay nada activo ${d} ahora mismo. Amplía la búsqueda, mira la agenda o deja que te avisemos cuando haya algo nuevo.`,
      emptyBodyFiltered: (d) => `No hay nada ${d} con los filtros que tienes puestos. Quítalos o amplía la búsqueda para ver más.`,
      emptyBodyAll: 'No hay nada activo ahora mismo. Los negocios publican cada día: vuelve luego o deja que te avisemos.',
      emptyBodyAllFiltered: 'No hay nada con los filtros que tienes puestos. Quítalos o deja que te avisemos cuando haya algo nuevo.',
    };

const catName = (c, en) => (en ? c?.names?.en : c?.names?.es) || c?.slug || '';
const colTitle = (c, en) => (en ? c?.title?.en : c?.title?.es) || c?.slug || '';
const colSub = (c, en) => (en ? c?.subtitle?.en : c?.subtitle?.es) || '';

// Iconos de Material en SVG (las páginas públicas no cargan la fuente).
const IC = {
  tune: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
  cerca: 'M21 3 3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z',
  lugar: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
  reloj: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  tipo: 'M12 2 6.5 11h11L12 2zm5.5 11c-2.49 0-4.5 2.01-4.5 4.5S15.01 22 17.5 22s4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zM3 21.5h8v-8H3v8z',
  abajo: 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z',
  lista: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
  mapa: 'm20.5 3-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z',
  cal: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10Zm0-12H5V6h14v2Z',
  buscar: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  izq: 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  der: 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z',
  x: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
};
const ic = (n, s = 18) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${IC[n]}"/></svg>`;

/** Tarjeta de negocio, para «Tipo: Negocios». */
const bizCard = (b, lang, S) => {
  const en = lang === 'en';
  const nombre = (en ? b.names?.en : b.names?.es) || '';
  return `<a class="ncard" href="${esc(bizPath(lang, b.slug || b.id))}">
    ${b.logo_url ? `<img src="${esc(b.logo_url)}" alt="" width="64" height="64" loading="lazy" decoding="async">` : `<span class="ph" aria-hidden="true">${esc((b.name || '·').charAt(0).toUpperCase())}</span>`}
    <span class="ncard-body">
      <b>${esc(b.name)}</b>
      <span class="muted">${esc(nombre)}${b.address ? ` · ${esc(b.address)}` : ''}</span>
      ${b.live ? `<span class="tag">${esc(S.live(b.live))}</span>` : ''}
    </span>
    <span class="ncard-ir" aria-hidden="true">${ic('der', 20)}</span>
  </a>`;
};

/** Mapa con una chincheta por publicación. Si Mapbox no carga (sin token,
 * sin red), se dice: debajo está la lista con lo mismo. */
const mapaHtml = (items, lang, S) => {
  const puntos = items.filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lng)).map((o) => ({
    id: o.id, t: o.title, b: o.business_name, lat: o.lat, lng: o.lng, k: o.kind === 'flash_offer' ? 'f' : 'e',
    u: `${lang === 'en' ? '/en' : ''}/o/${o.id}`,
  }));
  return `<div id="mapa" class="mapa-explorar" role="region" aria-label="${esc(S.mapView)}" data-no="${esc(S.mapNo)}"></div>
  <script type="application/json" id="mapaPuntos">${JSON.stringify(puntos).replace(/</g, '\\u003c')}</script>
  <script>(async function(){
    var caja=document.getElementById('mapa');var puntos=JSON.parse(document.getElementById('mapaPuntos').textContent||'[]');
    function falla(){caja.innerHTML='<p class="empty">'+caja.dataset.no+'</p>';caja.classList.add('sin-mapa');}
    try{
      var tk=(await (await fetch('/api/mapbox-token')).json()).token;if(!tk)return falla();
      await new Promise(function(ok,ko){var c=document.createElement('link');c.rel='stylesheet';c.href='https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.css';document.head.append(c);
        var s=document.createElement('script');s.src='https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.js';s.onload=ok;s.onerror=ko;document.head.append(s);});
      mapboxgl.accessToken=tk;
      var oscuro=matchMedia('(prefers-color-scheme: dark)').matches;
      var m=new mapboxgl.Map({container:caja,style:oscuro?'mapbox://styles/mapbox/dark-v11':'mapbox://styles/mapbox/light-v11',center:puntos.length?[puntos[0].lng,puntos[0].lat]:[-3.7038,40.4168],zoom:12,performanceMetricsCollection:false,collectResourceTiming:false,cooperativeGestures:matchMedia('(pointer: coarse)').matches});
      m.addControl(new mapboxgl.NavigationControl({showCompass:false}));
      var bounds=new mapboxgl.LngLatBounds();
      puntos.forEach(function(p){bounds.extend([p.lng,p.lat]);
        var el=document.createElement('a');el.className='chincheta'+(p.k==='f'?' flash':'');el.href=p.u;el.setAttribute('aria-label',p.t);
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

/** Las distancias de «Cerca de mí», las mismas que la hoja de filtros de la
 * app. Sin elegir, 10 km. */
const RADIOS_KM = [1, 3, 5, 10, 25];
const RADIO_KM = 10;

/** Al final de la lista (última página): qué se ha visto y qué hacer ahora.
 * Lo mismo que la tarjeta final de Descubre en la app. Con [vacio] (no hay
 * nada desde el principio), las mismas salidas y la misma lógica, pero
 * centradas como una pantalla vacía (`.vacio`), como Descubre vacío. */
const finalHtml = ({ S, en, lang, cerca, km, city, filtros, link, page, alertaHref, sugerencias, vacio = false }) => {
  const sigKm = cerca ? RADIOS_KM.find((k) => k > km) : null;
  // ¿Se puede mirar más lejos? Con «Cerca de mí», a la distancia siguiente;
  // en una ciudad, en todas.
  const ampliar = cerca ? (sigKm ? { href: link({ km: sigKm }), txt: S.widen(sigKm) } : null)
    : city ? { href: link({ city: '' }), txt: S.allCitiesBtn } : null;
  const donde = cerca ? S.within(km) : city ? S.inPlace(PRETTY(city)) : '';
  const titulo = vacio ? (filtros ? S.emptyTitleFiltered : S.emptyTitle) : ampliar ? S.endTitle(donde) : S.endTitleAll;
  const cuerpo = vacio
    ? (ampliar ? (filtros ? S.emptyBodyFiltered(donde) : S.emptyBody(donde)) : (filtros ? S.emptyBodyAllFiltered : S.emptyBodyAll))
    : ampliar ? (filtros ? S.endBodyFiltered : S.endBody) : (filtros ? S.endBodyAllFiltered : S.endBodyAll);
  const agenda = `${agendaBase(lang)}/${city ? `${CITY(city)}/` : ''}`;
  const quitar = filtros
    ? `<a class="pill" href="${esc(link({ q: '', cat: '', kind: '', price: '', when: '', soloDescuento: false, abierto: false }))}">${esc(S.clearF)}</a>`
    : '';
  const sugiere = ampliar ? '' : `<p class="${vacio ? 'vacio-sugiere' : 'fin-sugiere'}"><a href="${esc(`${en ? '/app/?lang=en' : '/app/'}#/sugerencias?texto=${encodeURIComponent(S.recommendDraft)}`)}">${esc(S.recommend)}</a></p>`;
  const quizas = sugerencias.length ? `<h2 class="fin-h">${esc(S.maybe)}</h2>
  ${rejilla(sugerencias, lang)}` : '';
  if (vacio) {
    // Ampliar (si se puede), quitar filtros (si hay), avisar y la agenda.
    const avisar = `<a class="pill${ampliar ? '' : ' accent'}" href="${esc(alertaHref)}">${esc(S.notifyMe)}</a>`;
    return `<section class="vacio" aria-labelledby="finTitulo">
    <span class="vacio-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-5.5-2.5 7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5Zm5.5-6.6a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z"/></svg></span>
    <h2 id="finTitulo">${esc(titulo)}</h2>
    <p>${esc(cuerpo)}</p>
    <div class="vacio-botones">
      ${ampliar ? `<a class="pill accent" href="${esc(ampliar.href)}">${esc(ampliar.txt)}</a>` : avisar}
      ${quitar}
      ${ampliar ? avisar : ''}
      <a class="pill" href="${esc(agenda)}">${esc(S.seeAgenda)}</a>
    </div>
    ${sugiere}
  </section>
  ${quizas}`;
  }
  const botones = ampliar
    ? `<a class="pill accent" href="${esc(ampliar.href)}">${esc(ampliar.txt)}</a>
       ${quitar}
       <a class="pill" href="#filtros" data-abre-filtros>${esc(S.changeF)}</a>
       <a class="pill" href="${esc(agenda)}">${esc(S.seeAgenda)}</a>`
    : `<a class="pill accent" href="${esc(alertaHref)}">${esc(S.notifyMe)}</a>
       ${quitar}
       <a class="pill" href="${esc(page > 1 ? link({ p: 1 }) : '#arriba')}">${esc(S.backTop)}</a>
       <a class="pill" href="${esc(agenda)}">${esc(S.seeAgenda)}</a>`;
  return `<section class="fin" aria-labelledby="finTitulo">
    <span class="fin-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path fill="currentColor" d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/></svg></span>
    <h2 id="finTitulo">${esc(titulo)}</h2>
    <p class="muted">${esc(cuerpo)}</p>
    <div class="fin-botones">${botones}</div>
    ${sugiere}
  </section>
  ${quizas}`;
};

const portada = (items) => items.map((o) => (o.images || []).find((u) => !isVideo(u))).find(Boolean);

/** Todas las de un filtro (para el calendario): la base da 60 por llamada. */
async function todas(args, max = 240) {
  const primera = await rpc('public_explore', { ...args, p_limit: 60, p_offset: 0 });
  const items = [...(primera?.items || [])];
  const total = Math.min(primera?.total || 0, max);
  const resto = [];
  for (let off = 60; off < total; off += 60) resto.push(rpc('public_explore', { ...args, p_limit: 60, p_offset: off }));
  for (const r of await Promise.all(resto)) items.push(...(r?.items || []));
  return items;
}

const dos = (n) => String(n).padStart(2, '0');
/** «2026-10» + n meses. */
const sumaMes = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}`;
};

/** La vista Calendario: el mes con los días marcados y, debajo (al lado en
 * el escritorio), lo de ese día. Como la agenda de Explorar en la app. Los
 * días son enlaces: va sin JavaScript y cada día se puede compartir. */
function calendarioHtml({ items, lang, S, link, mes, dia, hoy }) {
  const en = lang === 'en';
  const loc = en ? 'en-GB' : 'es-ES';
  // Cada publicación, en el día de su negocio; lo que empezó antes y sigue en
  // marcha (una oferta flash de anoche), hoy.
  const porDia = new Map();
  for (const o of items) {
    const tz = KZ.de(o);
    let d = KZ.dia(o.starts_at || o.event_at || o.redeem_start_at, tz);
    if (d < hoy) d = hoy;
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d).push(o);
  }
  for (const l of porDia.values()) l.sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  const [y, m] = mes.split('-').map(Number);
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const hueco = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // lunes = 0
  const mesTitulo = KZ.fmt(`${mes}-15T12:00:00Z`, 'UTC', loc, { month: 'long', year: 'numeric' });
  const semana = [...Array(7)].map((_, i) => KZ.fmt(`2026-10-${dos(5 + i)}T12:00:00Z`, 'UTC', loc, { weekday: 'short' }).replace('.', ''));
  const largo = (iso) => KZ.fmt(`${iso}T12:00:00Z`, 'UTC', loc, { weekday: 'long', day: 'numeric', month: 'long' });
  const rel = (iso) => (iso === hoy ? S.todayRel : iso === KZ.hoy('Europe/Madrid', 1) ? S.tomorrowRel : '');
  const hoyMes = hoy.slice(0, 7);
  const anterior = mes > hoyMes ? sumaMes(mes, -1) : null;
  const siguiente = mes < sumaMes(hoyMes, 11) ? sumaMes(mes, 1) : null;

  const celdas = [];
  for (let i = 0; i < hueco; i++) celdas.push('<span class="cal-dia vacio-dia" aria-hidden="true"></span>');
  for (let d = 1; d <= diasMes; d++) {
    const iso = `${mes}-${dos(d)}`;
    const lista = porDia.get(iso) || [];
    const pasado = iso < hoy;
    const ev = lista.some((o) => o.kind !== 'flash_offer');
    const fl = lista.some((o) => o.kind === 'flash_offer');
    const puntos = lista.length ? `<span class="cal-puntos" aria-hidden="true">${ev ? '<i class="pe"></i>' : ''}${fl ? '<i class="pf"></i>' : ''}</span>` : '';
    const cls = `cal-dia${iso === hoy ? ' hoy' : ''}${iso === dia ? ' sel' : ''}${pasado ? ' pasado' : ''}`;
    const etiqueta = S.dayLabel(largo(iso), lista.length);
    celdas.push(pasado
      ? `<span class="${cls}" aria-hidden="true">${d}</span>`
      : `<a class="${cls}" href="${esc(link({ dia: iso, mes }))}#dia" aria-label="${esc(etiqueta)}"${iso === dia ? ' aria-current="date"' : ''}>${d}${puntos}</a>`);
  }
  const delDia = porDia.get(dia) || [];
  const proximo = delDia.length ? null : [...porDia.keys()].sort().find((k) => k > dia);
  return `<div class="calendario">
    <section class="cal-mes" aria-labelledby="calTitulo">
      <div class="cal-cab">
        ${anterior ? `<a class="cal-nav" href="${esc(link({ mes: anterior, dia: '' }))}" aria-label="${esc(S.prevMonth)}">${ic('izq', 22)}</a>` : `<span class="cal-nav" aria-hidden="true"></span>`}
        <h2 id="calTitulo">${esc(mesTitulo.charAt(0).toUpperCase() + mesTitulo.slice(1))}</h2>
        ${siguiente ? `<a class="cal-nav" href="${esc(link({ mes: siguiente, dia: '' }))}" aria-label="${esc(S.nextMonth)}">${ic('der', 22)}</a>` : `<span class="cal-nav" aria-hidden="true"></span>`}
      </div>
      <div class="cal-rejilla">
        ${semana.map((w) => `<span class="cal-sem" aria-hidden="true">${esc(w)}</span>`).join('')}
        ${celdas.join('')}
      </div>
      <p class="cal-leyenda"><span><i class="pe"></i>${esc(S.legendEv)}</span><span><i class="pf"></i>${esc(S.legendFl)}</span></p>
    </section>
    <section class="cal-lista" id="dia" aria-labelledby="diaTitulo">
      <div class="cal-lista-cab">
        <h2 id="diaTitulo">${esc(rel(dia) ? `${rel(dia)} · ${largo(dia)}` : largo(dia).charAt(0).toUpperCase() + largo(dia).slice(1))}</h2>
        <span class="muted">${esc(S.dayPlans(delDia.length))}</span>
      </div>
      ${delDia.length
        ? `<div class="tj-filas">${delDia.map((o) => tarjeta(o, lang, { forma: 'fila' })).join('')}</div>`
        : `<p class="empty">${esc(S.dayNone)}${proximo ? `<br><a href="${esc(link({ dia: proximo, mes: proximo.slice(0, 7) }))}#dia">${esc(S.nextWith(rel(proximo) || largo(proximo)))} →</a>` : ''}</p>`}
    </section>
  </div>`;
}

// ── Descubre y Explorar ────────────────────────────────────────────────────
/**
 * La misma búsqueda pintada de dos maneras: `modo` 'explorar' (buscar, y
 * Lista, Mapa o Calendario) o 'descubre' (el feed de tarjetas grandes).
 */
export async function explorePage(url, lang, modo = 'explorar') {
  const en = lang === 'en';
  const S = T(en);
  const descubre = modo === 'descubre';
  const base = descubre ? discoverBase(lang) : exploreBase(lang);
  const qs = url.searchParams;
  const q = descubre ? '' : (qs.get('q') || '').slice(0, 60);
  const city = (qs.get(en ? 'city' : 'ciudad') || '').slice(0, 60);
  const cat = (qs.get(en ? 'category' : 'categoria') || '').slice(0, 40);
  let kind = (qs.get(en ? 'type' : 'tipo') || '').slice(0, 20);
  const page = Math.max(1, Math.min(50, parseInt(qs.get('p') || '1', 10) || 1));
  // «Negocios» es un tipo más (Todo · Ofertas flash · Eventos · Negocios).
  // Los enlaces de antes (`?ver=negocios`) siguen valiendo.
  const verViejo = (qs.get(en ? 'show' : 'ver') || '').slice(0, 20);
  if (verViejo === 'places' || verViejo === 'negocios') kind = en ? 'places' : 'negocios';
  const negocios = !descubre && (kind === 'places' || kind === 'negocios');
  const esOfertas = kind === 'offers' || kind === 'ofertas';
  const esEventos = kind === 'events' || kind === 'eventos';
  // Los filtros de la app: precio, cuándo, solo descuento, orden, cerca de mí
  // y lista, mapa o calendario. Todo en la URL: se comparte y va sin
  // JavaScript (salvo el mapa y pedir la ubicación).
  const K = en
    ? { price: 'price', when: 'when', discount: 'discount', open: 'open', sort: 'sort', view: 'view', month: 'month', day: 'day' }
    : { price: 'precio', when: 'cuando', discount: 'descuento', open: 'abierto', sort: 'orden', view: 'vista', month: 'mes', day: 'dia' };
  const price = (qs.get(K.price) || '').slice(0, 10);
  const when = (qs.get(K.when) || '').slice(0, 12);
  const soloDescuento = qs.get(K.discount) === '1';
  // «Abierto ahora»: vale para publicaciones y para negocios (la base mira
  // el horario en la zona de cada negocio; sin horario no pasa).
  const abierto = qs.get(K.open) === '1';
  const sort = (qs.get(K.sort) || '').slice(0, 12);
  const vista = descubre ? '' : (qs.get(K.view) || '').slice(0, 12);
  const mapa = !negocios && (vista === 'map' || vista === 'mapa');
  const calendario = !negocios && (vista === 'calendar' || vista === 'calendario');
  const lat = Number.parseFloat(qs.get('lat') || '');
  const lng = Number.parseFloat(qs.get('lng') || '');
  const cerca = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  // La distancia de «Cerca de mí» (solo las de la lista).
  const kmPedido = Number.parseInt(qs.get('km') || '', 10);
  const km = RADIOS_KM.includes(kmPedido) ? kmPedido : RADIO_KM;
  // El calendario: qué mes y qué día (en la hora de Madrid; cada publicación
  // va en el día de su negocio).
  const hoy = KZ.hoy('Europe/Madrid');
  const mesPedido = (qs.get(K.month) || '').slice(0, 7);
  const diaPedido = (qs.get(K.day) || '').slice(0, 10);
  const WHEN = { ahora: 'now', now: 'now', hoy: 'today', today: 'today', manana: 'tomorrow', tomorrow: 'tomorrow', '10dias': 'next10', next10: 'next10' };
  const SORT = { nuevas: 'newest', newest: 'newest', cerca: 'nearest', nearest: 'nearest' };
  const filtros = {
    ...(price === 'gratis' || price === 'free' ? { free: true } : {}),
    ...(/^\d{1,3}$/.test(price) ? { max_price_cents: Number(price) * 100 } : {}),
    // En el calendario manda el día elegido, no «¿Cuándo?».
    ...(WHEN[when] && !calendario ? { when: WHEN[when] } : {}),
    ...(soloDescuento ? { discount_only: true } : {}),
    ...(abierto ? { open_now: true } : {}),
    ...(SORT[sort] ? { sort: SORT[sort] } : cerca ? { sort: 'nearest' } : {}),
    ...(cerca ? { radius_m: km * 1000 } : {}),
    // Hueco para «Van mis amigos» (migraciones 20261102*): necesita sesión,
    // así que no va en esta página (pública y en caché); lo filtra «Tu cuenta».
  };
  const pKind = esOfertas ? 'flash_offer' : esEventos ? 'future_event' : null;
  const filtrado = Boolean(q || city || cat || kind || page > 1 || price || when || soloDescuento || abierto || sort || cerca || vista);

  const argsExplore = {
    p_city: city || null, p_category: cat || null, p_kind: pKind, p_q: q || null,
    p_filters: filtros, p_lat: cerca ? lat : null, p_lng: cerca ? lng : null,
  };
  const [res, cities, cats, cols] = await Promise.all([
    negocios
      ? rpc('public_businesses', {
        p_city: city || null, p_category: cat || null, p_q: q || null,
        p_limit: POR_PAGINA, p_offset: (page - 1) * POR_PAGINA, p_open_now: abierto,
      })
      : calendario
        ? todas(argsExplore).then((items) => ({ items, total: items.length }))
        : rpc('public_explore', { ...argsExplore, p_limit: mapa ? 60 : POR_PAGINA, p_offset: mapa ? 0 : (page - 1) * POR_PAGINA }),
    rpcAll('public_cities', {}),
    rpcAll('public_categories', { p_city: city || null }),
    rpcAll('public_collections', { p_city: city || null }),
  ]);
  const items = res?.items || [];
  const total = res?.total || 0;
  const paginas = mapa || calendario ? 1 : Math.max(1, Math.ceil(total / POR_PAGINA));

  // El mes y el día del calendario, dentro de lo que se puede mirar (este mes
  // y los once siguientes).
  const hoyMes = hoy.slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(mesPedido) && mesPedido >= hoyMes && mesPedido <= sumaMes(hoyMes, 11) ? mesPedido
    : /^\d{4}-\d{2}-\d{2}$/.test(diaPedido) && diaPedido >= hoy ? diaPedido.slice(0, 7) : hoyMes;
  let dia = /^\d{4}-\d{2}-\d{2}$/.test(diaPedido) && diaPedido.startsWith(mes) && diaPedido >= hoy ? diaPedido : '';
  if (calendario && !dia) {
    if (hoy.startsWith(mes)) dia = hoy;
    else {
      const conAlgo = items.map((o) => KZ.dia(o.starts_at, KZ.de(o))).filter((d) => d.startsWith(mes)).sort();
      dia = conAlgo[0] || `${mes}-01`;
    }
  }

  // Última página de la lista: el final, con «Quizá te interese» de fuera de
  // lo que se está mirando (más lejos que la distancia o en otras ciudades).
  const lista = !negocios && !mapa && !calendario;
  const alFinal = lista && items.length > 0 && page >= paginas;
  // Sin nada desde el principio: la pantalla vacía, con las mismas salidas.
  const vacio = !negocios && !calendario && items.length === 0;
  const conFiltros = Boolean(q || cat || kind || price || when || soloDescuento || abierto);
  let sugerencias = [];
  if ((alFinal || vacio) && (cerca || city)) {
    const vistos = new Set(items.map((o) => o.id));
    // Son un extra: si no llegan, la página sale igual (sin ellas).
    const fuera = await (cerca
      ? rpcAll('recommended_offers', { p_lat: lat, p_lng: lng, p_min_distance_m: km * 1000, p_limit: 8 })
      : rpc('public_explore', { p_city: null, p_limit: 24, p_filters: {} }).then((r) => (r?.items || [])
        .filter((o) => String(o.city || '').toLowerCase() !== city.toLowerCase()))).catch(() => []);
    sugerencias = (fuera || []).filter((o) => !vistos.has(o.id)).slice(0, 4);
  } else if (vacio && conFiltros) {
    // En todas las ciudades y sin ubicación: lo que hay sin esos filtros.
    const todo = await rpc('public_explore', { p_city: null, p_limit: 8, p_filters: {} }).catch(() => null);
    sugerencias = (todo?.items || []).slice(0, 4);
  }

  // Los filtros son enlaces: se puede compartir la URL y va sin JavaScript.
  const link = (cambios) => {
    const p = new URLSearchParams();
    const b = { q, city, cat, kind, price, when, soloDescuento, abierto, sort, vista, cerca, km, p: 1, mes: calendario ? mes : '', dia: calendario ? dia : '', ...cambios };
    const neg = b.kind === 'places' || b.kind === 'negocios';
    if (b.q) p.set('q', b.q);
    if (b.city) p.set(en ? 'city' : 'ciudad', b.city);
    if (b.cat) p.set(en ? 'category' : 'categoria', b.cat);
    if (b.kind) p.set(en ? 'type' : 'tipo', b.kind);
    if (b.abierto) p.set(K.open, '1');
    if (!neg) {
      if (b.price) p.set(K.price, b.price);
      if (b.when) p.set(K.when, b.when);
      if (b.soloDescuento) p.set(K.discount, '1');
      if (b.sort) p.set(K.sort, b.sort);
      if (b.vista) p.set(K.view, b.vista);
      if (b.mes && /^cal/.test(b.vista)) p.set(K.month, b.mes);
      if (b.dia && /^cal/.test(b.vista)) p.set(K.day, b.dia);
      if (b.cerca) {
        p.set('lat', lat.toFixed(4)); p.set('lng', lng.toFixed(4));
        if (b.km !== RADIO_KM) p.set('km', String(b.km));
      }
    }
    if (b.p && b.p > 1) p.set('p', String(b.p));
    const s = p.toString();
    return `${base}/${s ? `?${s}` : ''}`;
  };

  // ── La barra de filtros: lo esencial a la vista, el resto en la hoja ──
  // Una opción de un desplegable (enlace) o de la hoja (radio o casilla).
  const opcion = (href, label, on) => `<a class="op${on ? ' on' : ''}" href="${esc(href)}"${on ? ' aria-current="true"' : ''}>${esc(label)}</a>`;
  const desplegable = (icono, titulo, valor, activo, opciones, extra = '') => `<details class="desplegable">
      <summary class="chip${activo ? ' on' : ''}">${ic(icono, 16)}<span>${esc(valor || titulo)}</span>${ic('abajo', 16)}</summary>
      <div class="menu-d" role="group" aria-label="${esc(titulo)}"><p class="menu-d-t" aria-hidden="true">${esc(titulo)}</p>${extra}${opciones}</div>
    </details>`;

  const ciudades = cities.filter((c) => c.city).slice(0, 20);
  const dondeValor = cerca ? S.nearOn : city ? PRETTY(city) : S.allCities;
  const dondeMenu = desplegable('cerca', S.where, dondeValor, cerca || Boolean(city),
    `${negocios ? '' : `<button type="button" class="op" data-cerca data-err="${esc(S.nearNo)}" hidden>${ic('cerca', 16)} ${esc(S.near)}</button>`}
     ${cerca ? opcion(link({ cerca: false, sort: sort === 'nearest' || sort === 'cerca' ? '' : sort }), `✕ ${S.nearOn}`, false) : ''}
     ${opcion(link({ city: '', cerca: false }), S.allCities, !city && !cerca)}
     ${ciudades.map((c) => opcion(link({ city: String(c.city), cerca: false }), PRETTY(c.city), !cerca && city.toLowerCase() === String(c.city).toLowerCase())).join('')}`);
  const WHENS = [[en ? 'now' : 'ahora', S.now], [en ? 'today' : 'hoy', S.today], [en ? 'tomorrow' : 'manana', S.tomorrow], [en ? 'next10' : '10dias', S.next10]];
  const whenTxt = (WHENS.find(([k]) => k === when) || [])[1] || '';
  const cuandoMenu = negocios || calendario ? '' : desplegable('reloj', S.when, whenTxt ? `${S.when.replace(/[¿?]/g, '')} · ${whenTxt}` : S.when, Boolean(whenTxt),
    `${opcion(link({ when: '' }), S.anytime, !whenTxt)}${WHENS.map(([k, n]) => opcion(link({ when: k }), n, when === k)).join('')}`);
  const tipoTxt = esOfertas ? S.offers : esEventos ? S.events : negocios ? S.placesType : '';
  const tipoMenu = desplegable('tipo', S.kind, tipoTxt ? `${S.kind} · ${tipoTxt}` : S.kind, Boolean(tipoTxt),
    `${opcion(link({ kind: '' }), S.all, !kind)}
     ${opcion(link({ kind: en ? 'offers' : 'ofertas' }), S.offers, esOfertas)}
     ${opcion(link({ kind: en ? 'events' : 'eventos' }), S.events, esEventos)}
     ${descubre ? '' : opcion(link({ kind: en ? 'places' : 'negocios', vista: '' }), S.placesType, negocios)}`);

  // La hoja de filtros: un formulario GET (va sin JavaScript) con lo demás.
  const nFiltros = [price, soloDescuento, abierto, cat, sort && !(cerca && (sort === 'nearest' || sort === 'cerca')),
    cerca && km !== RADIO_KM].filter(Boolean).length;
  const radio = (name, value, label, on) => `<label class="op-r"><input type="radio" name="${name}" value="${esc(value)}"${on ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  const casilla = (name, label, on) => `<label class="op-r"><input type="checkbox" name="${name}" value="1"${on ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  const ocultos = [
    ['q', q], [en ? 'city' : 'ciudad', city], [en ? 'type' : 'tipo', kind], [K.when, negocios ? '' : when], [K.view, vista],
    [K.month, calendario ? mes : ''], [K.day, calendario ? dia : ''],
    ['lat', cerca && !negocios ? lat.toFixed(4) : ''], ['lng', cerca && !negocios ? lng.toFixed(4) : ''],
  ].filter(([, v]) => v).map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join('');
  const sortCerca = sort === 'nearest' || sort === 'cerca' || (!sort && cerca);
  const hoja = `<details class="hoja" id="filtros">
    <summary class="chip chip-filtros${nFiltros ? ' on' : ''}" aria-label="${esc(nFiltros ? S.filtersN(nFiltros) : S.filters)}">${ic('tune', 16)}<span>${esc(S.filters)}</span>${nFiltros ? `<span class="n" aria-hidden="true">${nFiltros}</span>` : ''}</summary>
    
    <form class="hoja-cuerpo" method="get" action="${base}/" role="dialog" aria-labelledby="hojaTitulo">
      <div class="hoja-cab"><h2 id="hojaTitulo">${esc(S.filters)}</h2>
        <a class="hoja-x" href="#filtros" data-cerrar-hoja aria-label="${esc(S.close)}">${ic('x', 22)}</a></div>
      ${ocultos}
      <div class="hoja-scroll">
      ${negocios ? '' : `<fieldset><legend>${esc(S.sort)}</legend><div class="ops">
        ${radio(K.sort, '', S.soonest, !sort && !cerca)}
        ${radio(K.sort, en ? 'newest' : 'nuevas', S.newest, sort === 'newest' || sort === 'nuevas')}
        ${cerca ? radio(K.sort, en ? 'nearest' : 'cerca', S.nearest, sortCerca) : ''}
      </div></fieldset>
      <fieldset><legend>${esc(S.price)}</legend><div class="ops">
        ${radio(K.price, '', S.any, !price)}
        ${radio(K.price, en ? 'free' : 'gratis', S.free, price === 'free' || price === 'gratis')}
        ${['10', '25', '50'].map((n) => radio(K.price, n, S.upTo(n), price === n)).join('')}
      </div>
      <div class="ops">${casilla(K.discount, S.discount, soloDescuento)}</div></fieldset>`}
      <fieldset><legend>${esc(S.openNow)}</legend><div class="ops">${casilla(K.open, S.openNow, abierto)}</div></fieldset>
      ${cerca && !negocios ? `<fieldset><legend>${esc(S.distance)}</legend><div class="ops">
        ${RADIOS_KM.map((k) => radio('km', k === RADIO_KM ? '' : String(k), `${k} km`, km === k)).join('')}
      </div></fieldset>` : ''}
      ${(cats || []).length ? `<fieldset><legend>${esc(S.cat)}</legend><div class="ops">
        ${radio(en ? 'category' : 'categoria', '', S.all, !cat)}
        ${(cats || []).map((c) => radio(en ? 'category' : 'categoria', c.slug, negocios ? catName(c, en) : `${catName(c, en)} (${c.n})`, cat === c.slug)).join('')}
      </div></fieldset>` : ''}
      </div>
      <div class="hoja-pie">
        <a class="pill" href="${esc(link({ price: '', soloDescuento: false, abierto: false, cat: '', sort: '', km: RADIO_KM }))}">${esc(S.clearF)}</a>
        <button class="pill accent" type="submit">${esc(S.showResults)}</button>
      </div>
    </form>
  </details>`;

  const vistas = descubre ? '' : `<nav class="vistas" aria-label="${esc(S.view)}">
      ${[['', S.listView, 'lista', !mapa && !calendario], [en ? 'map' : 'mapa', S.mapView, 'mapa', mapa], [en ? 'calendar' : 'calendario', S.calView, 'cal', calendario]]
        .map(([v, n, i, on]) => `<a class="vista${on ? ' on' : ''}" href="${esc(link({ vista: v, kind: negocios ? '' : kind }))}"${on ? ' aria-current="page"' : ''}>${ic(i, 18)}<span>${esc(n)}</span></a>`).join('')}
    </nav>`;

  const buscador = descubre ? '' : `<form class="buscador" role="search" method="get" action="${base}/">
    <label class="buscador-campo">${ic('buscar', 20)}<span class="sr">${esc(S.search)}</span>
      <input type="search" name="q" value="${esc(q)}" placeholder="${esc(S.ph)}" enterkeyhint="search"></label>
    ${[[en ? 'city' : 'ciudad', city], [en ? 'category' : 'categoria', cat], [en ? 'type' : 'tipo', kind], [K.open, abierto ? '1' : '']]
      .concat(negocios ? [] : [[K.price, price], [K.when, when], [K.discount, soloDescuento ? '1' : ''], [K.sort, sort], [K.view, vista],
        ['lat', cerca ? lat.toFixed(4) : ''], ['lng', cerca ? lng.toFixed(4) : ''], ['km', cerca && km !== RADIO_KM ? String(km) : '']])
      .filter(([, val]) => val).map(([k, val]) => `<input type="hidden" name="${k}" value="${esc(val)}">`).join('')}
    <button class="pill ink" type="submit">${esc(S.search)}</button>
  </form>`;

  const barra = `<div class="barra-filtros" id="barra">
    ${hoja}
    ${dondeMenu}
    ${cuandoMenu}
    ${tipoMenu}
    ${descubre ? `<a class="chip" href="${exploreBase(lang)}/">${ic('buscar', 16)}<span>${esc(S.search)}</span></a>` : ''}
  </div>
  <p id="cercaErr" class="aviso-error" role="alert" hidden></p>`;

  // En Descubre, sin ubicación ni ciudad: «Mira primero lo que tienes más cerca».
  const invitaCerca = descubre && !cerca && !city
    ? `<p class="cerca-aviso" data-cerca-aviso hidden>${ic('cerca', 18)}<span>${esc(S.nearPrompt)}</span>
        <button type="button" class="pill ink" data-cerca data-err="${esc(S.nearNo)}">${esc(S.useLoc)}</button></p>`
    : '';

  // ── Resultados ──
  const resumen = calendario ? '' : `<div class="resumen"><h2 class="resumen-n">${esc(negocios ? S.places(total) : S.results(total))}</h2>
    ${conFiltros || cerca || city ? `<a href="${esc(base)}/">${esc(S.clear)}</a>` : ''}</div>`;
  let resultados;
  if (negocios) {
    resultados = items.length
      ? `<div class="nlist">${items.map((b) => bizCard(b, lang, S)).join('')}</div>`
      : `<section class="vacio"><h2>${esc(S.noPlaces)}</h2>
        ${conFiltros ? `<div class="vacio-botones"><a class="pill accent" href="${esc(link({ q: '', cat: '', abierto: false }))}">${esc(S.clearF)}</a></div>` : ''}</section>`;
  } else if (calendario) {
    resultados = calendarioHtml({ items, lang, S, link, mes, dia, hoy });
  } else if (mapa) {
    resultados = `${mapaHtml(items, lang, S)}${items.length ? `<h2 class="fin-h">${esc(S.onMap(items.length))}</h2>${rejilla(items, lang)}` : ''}`;
  } else {
    resultados = vacio ? '' : rejilla(items, lang, { primera: true, desc: descubre, feed: descubre });
  }

  // ── Más formas de explorar: las páginas de Google, abajo y en su sitio ──
  const ciudadSeo = city || (ciudades.length === 1 ? String(ciudades[0].city) : '');
  const masFormas = negocios ? '' : `<section class="mas-formas" aria-labelledby="masFormas">
    <h2 id="masFormas">${esc(S.more)}</h2>
    ${ciudades.length ? `<div class="mf-fila"><h3>${esc(S.todayIn)}</h3><p>${ciudades.map((c) => `<a href="${todayBase(lang)}/${CITY(c.city)}/">${esc(PRETTY(c.city))}</a>`).join('')}</p></div>
    <div class="mf-fila"><h3>${esc(S.weekIn)}</h3><p>${ciudades.map((c) => `<a href="${agendaBase(lang)}/${CITY(c.city)}/">${esc(PRETTY(c.city))}</a>`).join('')}</p></div>` : ''}
    ${ciudadSeo && (cats || []).length ? `<div class="mf-fila"><h3>${esc(S.byCat)} · ${esc(PRETTY(ciudadSeo))}</h3><p>${(cats || []).map((c) => `<a href="${agendaBase(lang)}/${CITY(ciudadSeo)}/${encodeURIComponent(c.slug)}/">${esc(catName(c, en))}</a>`).join('')}</p></div>` : ''}
    ${cols.length ? `<div class="mf-fila"><h3>${esc(S.picks)}</h3><p>${cols.map((c) => `<a href="${collectionBase(lang)}/${encodeURIComponent(c.slug)}/${city ? `${CITY(city)}/` : ''}">${esc(colTitle(c, en))}</a>`).join('')}</p></div>` : ''}
    <p class="mf-cta"><a class="pill" href="${en ? '/app/?lang=en' : '/app/'}#/registro" data-sin-sesion>${esc(S.app)}</a> <a class="pill" href="${en ? '/en/for-business/' : '/para-negocios/'}">${esc(S.biz)}</a></p>
  </section>`;

  const body = `
  <div class="exp-cab" id="arriba">
    <div><h1>${esc(descubre ? S.disc : S.exp)}</h1>
    <p class="muted exp-lead">${esc(descubre ? S.discLead : S.lead)}</p></div>
    ${vistas}
  </div>
  ${buscador}
  ${barra}
  ${invitaCerca}
  ${resumen}
  ${resultados}
  ${paginas > 1 ? `<nav class="pager" aria-label="${esc(S.page)}">
    ${page > 1 ? `<a class="pill" href="${esc(link({ p: page - 1 }))}" rel="prev">${esc(S.prev)}</a>` : ''}
    <span class="muted">${esc(S.page)} ${page}/${paginas}</span>
    ${page < paginas ? `<a class="pill" href="${esc(link({ p: page + 1 }))}" rel="next">${esc(S.next)}</a>` : ''}
  </nav>` : ''}

  ${alFinal || vacio ? finalHtml({
    S, en, lang, cerca, km, city, filtros: conFiltros, link, page, sugerencias, vacio,
    alertaHref: `${en ? '/app/?lang=en' : '/app/'}#/alerta/nueva?${new URLSearchParams({
      origen: 'explorar',
      ...(esOfertas ? { tipo: 'flash_offer' } : esEventos ? { tipo: 'future_event' } : {}),
      ...(cat ? { cat } : {}),
      ...(price === 'gratis' || price === 'free' ? { precio: '0' } : /^\d{1,3}$/.test(price) ? { precio: String(Number(price) * 100) } : {}),
      ...(soloDescuento ? { descuento: '1' } : {}),
      ...(cerca ? { radio: String(km * 1000), lat: lat.toFixed(4), lng: lng.toFixed(4) } : {}),
    })}`,
  }) : ''}
  ${masFormas}
  <script>(function(){
    var err=document.getElementById('cercaErr');
    var botones=document.querySelectorAll('[data-cerca]');
    if(!navigator.geolocation)return;
    function ir(lat,lng){var u=new URL(location.href);u.searchParams.set('lat',lat.toFixed(4));u.searchParams.set('lng',lng.toFixed(4));u.searchParams.delete('p');
      ${en ? "u.searchParams.delete('city');" : "u.searchParams.delete('ciudad');"}location.href=u.toString();}
    botones.forEach(function(b){b.hidden=false;b.onclick=function(){navigator.geolocation.getCurrentPosition(function(p){
      if(window.KL_CERCA)window.KL_CERCA(p.coords.latitude,p.coords.longitude);ir(p.coords.latitude,p.coords.longitude);
    },function(){if(err){err.textContent=b.dataset.err;err.hidden=false;}},{maximumAge:300000,timeout:10000});};});
    var aviso=document.querySelector('[data-cerca-aviso]');
    if(aviso){
      // Descubre: si ya usaste «Cerca de mí» hace poco, se vuelve a usar (como la app, que recuerda dónde estás).
      try{var g=JSON.parse(localStorage.getItem('klendar.cerca')||'null');if(g&&Date.now()-g.t<6*3600e3&&!location.search){ir(g.lat,g.lng);return;}}catch(e){}
      aviso.hidden=false;
    }
  })();</script>`;

  // Una búsqueda concreta no aporta nada al índice de Google; la página
  // limpia sí.
  return html(publicPage({
    lang,
    path: `${base}/`,
    title: descubre ? S.disc : S.exp,
    description: descubre ? S.discLead : S.lead,
    image: portada(items),
    body,
    actual: descubre ? 'descubre' : 'explorar',
    head: filtrado ? '<meta name="robots" content="noindex, follow">' : '',
  }), 200, 'public, max-age=120, s-maxage=600');
}

// ── Una categoría en una ciudad ────────────────────────────────────────────
/**
 * «Peluquerías en Madrid»: lo que la gente escribe en Google. Las ofertas y
 * planes vivos de esa categoría y, debajo, los negocios que la forman (con
 * enlace a su ficha), para que la página responda aunque hoy no haya nada.
 */
export async function categoryPage(rawCity, rawCat, lang) {
  const en = lang === 'en';
  const S = T(en);
  const decCity = decodeSeg(rawCity);
  const decCat = decodeSeg(rawCat);
  if (decCity == null || decCat == null) return aListado(`${agendaBase(lang)}/`);
  const rawc = decCity.replace(/[/]+$/, '');
  const slug = decCat.replace(/[/]+$/, '').toLowerCase();
  const path = `${agendaBase(lang)}/${CITY(rawc)}/${encodeURIComponent(slug)}/`;

  const [res, cats, negocios] = await Promise.all([
    rpc('public_explore', { p_city: rawc, p_category: slug, p_limit: 60 }),
    rpcAll('public_categories', { p_city: rawc }),
    rpc('public_businesses', { p_city: rawc, p_category: slug, p_limit: 24 }),
  ]);
  const cat = (cats || []).find((c) => c.slug === slug);
  const items = res?.items || [];
  const lugares = negocios?.items || [];
  const city = PRETTY(items[0]?.city || lugares[0]?.city || rawc);
  const nombre = cat ? catName(cat, en) : PRETTY(slug);
  const h1 = S.catTitle(nombre, city);

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${agendaBase(lang)}/">${S.agenda}</a> · <a href="${agendaBase(lang)}/${CITY(rawc)}/">${esc(city)}</a></p>
  <h1>${esc(h1)}</h1>
  <p class="muted" style="max-width:640px">${esc(S.catLead(nombre, city))}</p>
  ${cityLinks(lang, rawc, city, cats, slug)}
  ${items.length ? rejilla(items, lang, { primera: true, h: 'h2' }) : `<p class="empty">${esc(S.catNone(nombre, city))}</p>`}
  ${lugares.length ? `<h2>${esc(S.catPlaces(nombre, city))}</h2>
    <div class="nlist">${lugares.map((b) => bizCard(b, lang, S)).join('')}</div>` : ''}
  <p style="margin-top:22px"><a class="pill accent" href="${todayBase(lang)}/${CITY(rawc)}/">${esc(S.todayIn)} ${esc(city)}</a> <a class="pill" href="${agendaBase(lang)}/${CITY(rawc)}/">${esc(S.weekIn)} ${esc(city)}</a> <a class="pill" href="${exploreBase(lang)}/">${esc(S.exp)}</a></p>`;

  const description = items.length ? S.catDesc(nombre, city, items.length) : S.catNone(nombre, city);
  // Se indexa si hay algo que enseñar: publicaciones o negocios de la
  // categoría. Una categoría inventada en la URL no.
  const indexable = Boolean(cat) && (items.length || lugares.length);
  const jsonLd = listingLd({
    lang, path, name: h1, description, city, items,
    migas: [['Klendar', en ? '/en/' : '/'], [S.agenda, `${agendaBase(lang)}/`], [city, `${agendaBase(lang)}/${CITY(rawc)}/`], [nombre, path]],
  });

  return html(publicPage({
    lang, path, body, title: S.catHead(nombre, city),
    description,
    image: portada(items),
    actual: 'explorar',
    head: indexable ? ldScript(jsonLd) : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=300, s-maxage=900');
}

// ── Una colección ──────────────────────────────────────────────────────────
export async function collectionPage(rawSlug, rawCity, lang) {
  const en = lang === 'en';
  const S = T(en);
  const decSlug = decodeSeg(rawSlug);
  const decCity = decodeSeg(rawCity);
  if (decSlug == null || decCity == null) return aListado(`${exploreBase(lang)}/`);
  const slug = decSlug.replace(/\/+$/, '').toLowerCase();
  const rawc = decCity.replace(/\/+$/, '');
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
  ${items.length
    ? `${rejilla(items, lang, { primera: true, h: 'h2' })}
  <p style="margin-top:22px"><a class="pill accent" href="${exploreBase(lang)}/">${esc(S.exp)}</a> <a class="pill" href="${agendaBase(lang)}/">${esc(S.agenda)}</a></p>`
    // Vacía: la pantalla vacía, centrada, con las mismas salidas.
    : `<section class="vacio"><h2>${esc(S.colNone)}</h2>
    <div class="vacio-botones"><a class="pill accent" href="${exploreBase(lang)}/">${esc(S.exp)}</a><a class="pill" href="${agendaBase(lang)}/">${esc(S.agenda)}</a></div></section>`}`;

  return html(publicPage({
    lang, path, body, title: h1,
    description: (col && colSub(col, en)) || S.lead,
    image: portada(items),
    actual: 'explorar',
    head: items.length ? '' : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=300, s-maxage=900');
}
