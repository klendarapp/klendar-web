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
      discLead: 'Flash offers and events from the businesses around you. No account needed to browse.',
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
      // La barra y la hoja de filtros: las de la app (feed_filter_bar.dart, filter_sheet.dart).
      zoneChange: 'Change area', hereNow: "I'm here", hereNowHint: 'Within walking distance and starting in the next two hours',
      sortBy: 'Sort by', sortNearest: 'Nearest', sortSoonest: 'Soonest', sortNewest: 'Newest',
      type: 'Type', categories: 'Categories', reset: 'Reset', distHint: 'Applies with “Near you”.',
      bizSection: 'Businesses', offersSection: 'Offers and events', allPlaces: 'See all businesses',
      // El feed de Descubre.
      feedKeys: 'Swipe, scroll or use ↑ ↓ to move on.', feedPos: (i, n) => `${i} of ${n}`,
      prevItem: 'Previous', nextItem: 'Next', seeMore: 'See more',
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
      discLead: 'Ofertas flash y planes de los negocios de tu alrededor. Para mirar no hace falta cuenta.',
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
      zoneChange: 'Cambiar zona', hereNow: 'Estoy aquí', hereNowHint: 'Lo que pillas andando y empieza en las dos próximas horas',
      sortBy: 'Ordenar por', sortNearest: 'Cercanía', sortSoonest: 'Más pronto', sortNewest: 'Novedades',
      type: 'Tipo', categories: 'Categorías', reset: 'Restablecer', distHint: 'Vale con «Cerca de ti».',
      bizSection: 'Negocios', offersSection: 'Ofertas y eventos', allPlaces: 'Ver todos los negocios',
      feedKeys: 'Desliza, usa la rueda o ↑ ↓ para pasar.', feedPos: (i, n) => `${i} de ${n}`,
      prevItem: 'Anterior', nextItem: 'Siguiente', seeMore: 'Ver más',
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
  aqui: 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z',
  ciudad: 'M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z',
  arriba: 'M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z',
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
 * app (`FeedFilters.radiusOptionsM`). Sin elegir, 5 km, como la app. */
const RADIOS_KM = [1, 3, 5, 10, 25];
const RADIO_KM = 5;

/** Al final de la lista (última página): qué se ha visto y qué hacer ahora.
 * Lo mismo que la tarjeta final de Descubre en la app. Con [vacio] (no hay
 * nada desde el principio), las mismas salidas y la misma lógica, pero
 * centradas como una pantalla vacía (`.vacio`), como Descubre vacío. */
const finalHtml = ({ S, en, lang, cerca, km, city, filtros, link, page, alertaHref, sugerencias, vacio = false, limpiar = '', compacto = false }) => {
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
  // «Quitar filtros» deja la página limpia: sin filtros, sin zona y sin
  // distancia (lo que se espera al pulsarlo; también lo guardado).
  const quitar = limpiar
    ? `<a class="pill" href="${esc(limpiar)}" data-limpia-filtros>${esc(S.clearF)}</a>`
    : '';
  const sugiere = ampliar ? '' : `<p class="${vacio ? 'vacio-sugiere' : 'fin-sugiere'}"><a href="${esc(`${en ? '/app/?lang=en' : '/app/'}#/sugerencias?texto=${encodeURIComponent(S.recommendDraft)}`)}">${esc(S.recommend)}</a></p>`;
  // En el feed de Descubre, en filas (caben en la última pantalla).
  const quizas = sugerencias.length ? `<h2 class="fin-h">${esc(S.maybe)}</h2>
  ${compacto ? `<div class="tj-filas">${sugerencias.map((o) => tarjeta(o, lang, { forma: 'fila' })).join('')}</div>` : rejilla(sugerencias, lang)}` : '';
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
// Los filtros son los de la app (`FeedFilters`, la barra de
// `feed_filter_bar.dart` y la hoja de `filter_sheet.dart`), los mismos en las
// dos páginas y con los mismos nombres:
//   barra: Filtros · <resumen> · Zona · Estoy aquí · [Van mis amigos] · Ordenar
//   hoja:  Tipo · Categorías · Distancia · Precio · ¿Cuándo? · Abierto ahora ·
//          Solo con descuento (Restablecer arriba, Ver resultados abajo)
// («Ocultar contenido +18» no está: la web pública nunca enseña +18. Las
// categorías son una sola, que es lo que filtra `public_explore`.)
//
// Todo va en la URL. Las dos páginas leen las claves de los dos idiomas
// (`?ciudad=` y `?city=`), así un enlace sirve aunque se cambie de idioma.
// Lo compartido (zona, distancia, filtros, orden, «Van mis amigos») se guarda
// en el navegador al entrar en una de las dos y se recupera al llegar a la
// otra sin filtros en la dirección (`guardaFiltros`); un enlace con filtros
// manda sobre lo guardado.

/** Las claves de la dirección en cada idioma. */
const CLAVES = {
  es: { city: 'ciudad', cat: 'categoria', kind: 'tipo', price: 'precio', when: 'cuando', discount: 'descuento', open: 'abierto', sort: 'orden', view: 'vista', month: 'mes', day: 'dia', show: 'ver' },
  en: { city: 'city', cat: 'category', kind: 'type', price: 'price', when: 'when', discount: 'discount', open: 'open', sort: 'sort', view: 'view', month: 'month', day: 'day', show: 'show' },
};
/** Los valores, por dentro en inglés; en la dirección, en el idioma de la página. */
const VALORES_ES = {
  offers: 'ofertas', events: 'eventos', places: 'negocios', free: 'gratis',
  now: 'ahora', today: 'hoy', tomorrow: 'manana', next10: '10dias',
  newest: 'nuevas', soonest: 'pronto', nearest: 'cerca', map: 'mapa', calendar: 'calendario',
};
const NORMAL = Object.fromEntries(Object.entries(VALORES_ES).map(([k, v]) => [v, k]));
const norm = (v) => NORMAL[v] || v;
const enIdioma = (v, en) => (en ? v : VALORES_ES[v] || v);
/** Orden de la app por defecto: Novedades (`FeedFilters.defaultSort`). */
const ORDEN_DEFECTO = 'newest';

/** Lee el estado de la dirección (con las claves de cualquiera de los dos idiomas). */
function leeEstado(qs) {
  const de = (k, max) => (qs.get(CLAVES.es[k]) || qs.get(CLAVES.en[k]) || '').slice(0, max);
  let kind = norm(de('kind', 20));
  // «Negocios» era un tipo más; los enlaces de antes (`?ver=negocios`) siguen valiendo.
  if (/^(places|negocios)$/.test(de('show', 20))) kind = 'places';
  if (!['offers', 'events', 'places'].includes(kind)) kind = '';
  const price = norm(de('price', 10));
  const when = norm(de('when', 12));
  const sort = norm(de('sort', 12));
  const vista = norm(de('view', 12));
  const lat = Number.parseFloat(qs.get('lat') || '');
  const lng = Number.parseFloat(qs.get('lng') || '');
  const cerca = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const kmPedido = Number.parseInt(qs.get('km') || '', 10);
  return {
    q: (qs.get('q') || '').slice(0, 60),
    city: de('city', 60),
    cat: de('cat', 40),
    kind,
    price: price === 'free' || /^\d{1,3}$/.test(price) ? price : '',
    when: ['now', 'today', 'tomorrow', 'next10'].includes(when) ? when : '',
    soloDescuento: de('discount', 2) === '1',
    abierto: de('open', 2) === '1',
    sort: ['newest', 'soonest', 'nearest'].includes(sort) && sort !== ORDEN_DEFECTO ? sort : '',
    vista: ['map', 'calendar'].includes(vista) ? vista : '',
    cerca, lat: cerca ? lat : null, lng: cerca ? lng : null,
    km: RADIOS_KM.includes(kmPedido) ? kmPedido : RADIO_KM,
    amigos: qs.get('amigos') === '1',
    page: Math.max(1, Math.min(50, parseInt(qs.get('p') || '1', 10) || 1)),
    mes: de('month', 7),
    dia: de('day', 10),
  };
}

/** La dirección de un estado. `soloCompartido`: solo lo que viaja entre
 * Descubre y Explorar (sin búsqueda, vista, mes, día ni página). */
function query(e, lang, { soloCompartido = false } = {}) {
  const en = lang === 'en';
  const K = CLAVES[en ? 'en' : 'es'];
  const p = new URLSearchParams();
  const neg = e.kind === 'places';
  if (!soloCompartido && e.q) p.set('q', e.q);
  if (e.city && !e.cerca) p.set(K.city, e.city);
  if (e.cat) p.set(K.cat, e.cat);
  if (e.kind && !(soloCompartido && neg)) p.set(K.kind, enIdioma(e.kind, en));
  if (e.abierto) p.set(K.open, '1');
  if (!neg) {
    if (e.price) p.set(K.price, enIdioma(e.price, en));
    if (e.when) p.set(K.when, enIdioma(e.when, en));
    if (e.soloDescuento) p.set(K.discount, '1');
    if (e.sort) p.set(K.sort, enIdioma(e.sort, en));
    if (!soloCompartido && e.vista) p.set(K.view, enIdioma(e.vista, en));
    if (!soloCompartido && e.vista === 'calendar' && e.mes) p.set(K.month, e.mes);
    if (!soloCompartido && e.vista === 'calendar' && e.dia) p.set(K.day, e.dia);
    if (e.cerca) {
      p.set('lat', Number(e.lat).toFixed(4)); p.set('lng', Number(e.lng).toFixed(4));
      if (e.km !== RADIO_KM) p.set('km', String(e.km));
    }
    if (e.amigos) p.set('amigos', '1');
  }
  if (!soloCompartido && e.page > 1) p.set('p', String(e.page));
  return p.toString();
}

/**
 * Guardar y recuperar los filtros entre Descubre y Explorar (en el <head>,
 * antes de pintar nada).
 *
 * - Sin filtros en la dirección y con unos guardados hace menos de 6 h (como
 *   «Cerca de mí»): se va a la misma página con ellos (`location.replace`,
 *   así «Atrás» no vuelve a la página sin filtros).
 * - Si no, se guardan los de esta página (en los dos idiomas).
 * - Los enlaces de la propia página (cambiar un filtro, «Quitar filtros»,
 *   «Todas las ciudades») dejan una marca para que su resultado no se pise con
 *   lo guardado (ver /assets/tarjetas.js); tampoco al volver con «Atrás».
 */
function guardaFiltros(e, lang, base) {
  const compartido = { es: query(e, 'es', { soloCompartido: true }), en: query(e, 'en', { soloCompartido: true }) };
  // Lo que no viaja entre páginas (la búsqueda, la vista y el día del
  // calendario) se queda en la dirección al recuperar lo guardado.
  const K = CLAVES[lang === 'en' ? 'en' : 'es'];
  const resto = new URLSearchParams();
  if (e.q) resto.set('q', e.q);
  if (e.vista) resto.set(K.view, enIdioma(e.vista, lang === 'en'));
  if (e.vista === 'calendar' && e.mes) resto.set(K.month, e.mes);
  if (e.vista === 'calendar' && e.dia) resto.set(K.day, e.dia);
  const vacia = !compartido.es;
  const datos = JSON.stringify({ A: compartido, L: lang, v: vacia, r: resto.toString(), b: `${base}/` }).replace(/</g, '\\u003c');
  return `<script>(function(d){try{var K='klendar.filtros',s=sessionStorage,ls=localStorage;
var sin=s.getItem('klendar.filtros.sin');s.removeItem('klendar.filtros.sin');
var n=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0])||{};
var g=JSON.parse(ls.getItem(K)||'null');
if(d.v&&!sin&&n.type!=='back_forward'&&g&&Date.now()-g.t<216e5&&g[d.L]){location.replace(d.b+'?'+g[d.L]+(d.r?'&'+d.r:'')+location.hash);return;}
ls.setItem(K,JSON.stringify({t:Date.now(),es:d.A.es,en:d.A.en}));}catch(x){}})(${datos});</script>`;
}

/** Texto corto con lo puesto, como `filterSummary` en la app: «Todo · 5 km». */
function resumenFiltros(e, S, catNombre) {
  const partes = [];
  if (e.kind === 'offers') partes.push(S.offers);
  else if (e.kind === 'events') partes.push(S.events);
  else if (e.kind === 'places') partes.push(S.placesType);
  if (e.cat) partes.push(catNombre || e.cat);
  if (!partes.length) partes.push(S.all);
  if (e.cerca) partes.push(`${e.km} km`);
  if (e.price) partes.push(e.price === 'free' ? S.free : S.upTo(e.price));
  if (e.abierto) partes.push(S.openNow);
  if (e.soloDescuento) partes.push(S.discount);
  if (e.when) partes.push({ now: S.now, today: S.today, tomorrow: S.tomorrow, next10: S.next10 }[e.when]);
  return partes.join(' · ');
}

/**
 * La misma búsqueda pintada de dos maneras: `modo` 'explorar' (buscar, y
 * Lista, Mapa o Calendario) o 'descubre' (el feed a pantalla completa, una
 * publicación por pantalla, como la pestaña 1 de la app).
 */
export async function explorePage(url, lang, modo = 'explorar') {
  const en = lang === 'en';
  const S = T(en);
  const descubre = modo === 'descubre';
  const base = descubre ? discoverBase(lang) : exploreBase(lang);
  const e = leeEstado(url.searchParams);
  if (descubre) { e.q = ''; e.vista = ''; if (e.kind === 'places') e.kind = ''; }
  const { q, city, cat, kind, price, when, soloDescuento, abierto, cerca, lat, lng, km, page } = e;
  const negocios = !descubre && kind === 'places';
  const esOfertas = kind === 'offers';
  const esEventos = kind === 'events';
  const sort = e.sort;
  const mapa = !negocios && e.vista === 'map';
  const calendario = !negocios && e.vista === 'calendar';
  const vista = negocios ? '' : e.vista;
  // El calendario: qué mes y qué día (en la hora de Madrid; cada publicación
  // va en el día de su negocio).
  const hoy = KZ.hoy('Europe/Madrid');
  const mesPedido = e.mes;
  const diaPedido = e.dia;
  // Lo que se le pide a la base. El orden: el elegido o Novedades (la app).
  const ordenBase = sort || ORDEN_DEFECTO;
  const filtros = {
    ...(price === 'free' ? { free: true } : {}),
    ...(/^\d{1,3}$/.test(price) ? { max_price_cents: Number(price) * 100 } : {}),
    // En el calendario manda el día elegido, no «¿Cuándo?».
    ...(when && !calendario ? { when } : {}),
    ...(soloDescuento ? { discount_only: true } : {}),
    ...(abierto ? { open_now: true } : {}),
    sort: ordenBase === 'nearest' && !cerca ? 'soonest' : ordenBase,
    ...(cerca ? { radius_m: km * 1000 } : {}),
    // «Van mis amigos» necesita sesión: no va en esta página (pública y en
    // caché); lo filtra /assets/amigos.js en el navegador.
  };
  const pKind = esOfertas ? 'flash_offer' : esEventos ? 'future_event' : null;
  const filtrado = Boolean(q || city || cat || kind || page > 1 || price || when || soloDescuento || abierto || sort || cerca || vista || e.amigos);

  const argsExplore = {
    p_city: cerca ? null : city || null, p_category: cat || null, p_kind: pKind, p_q: q || null,
    p_filters: filtros, p_lat: cerca ? lat : null, p_lng: cerca ? lng : null,
  };
  // Con una búsqueda, arriba los negocios que encajan (como la búsqueda de la
  // app: «Negocios» y «Ofertas y eventos»).
  const conNegociosArriba = !descubre && !negocios && !mapa && !calendario && Boolean(q) && page === 1;
  const [res, cities, cats, cols, sitios] = await Promise.all([
    negocios
      ? rpc('public_businesses', {
        p_city: city || null, p_category: cat || null, p_q: q || null,
        p_limit: POR_PAGINA, p_offset: (page - 1) * POR_PAGINA, p_open_now: abierto,
      })
      : calendario
        ? todas(argsExplore).then((items) => ({ items, total: items.length }))
        : rpc('public_explore', { ...argsExplore, p_limit: mapa ? 60 : POR_PAGINA, p_offset: mapa ? 0 : (page - 1) * POR_PAGINA }),
    rpcAll('public_cities', {}),
    rpcAll('public_categories', { p_city: cerca ? null : city || null }),
    rpcAll('public_collections', { p_city: cerca ? null : city || null }),
    conNegociosArriba
      ? rpc('public_businesses', { p_city: cerca ? null : city || null, p_category: cat || null, p_q: q, p_limit: 4, p_offset: 0, p_open_now: abierto }).catch(() => null)
      : null,
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
  // Lo que deja fuera publicaciones (`hasNarrowingFilters` en la app): la
  // zona y la distancia se dicen aparte y el orden no quita nada.
  const conFiltros = Boolean(q || cat || kind || price || when || soloDescuento || abierto || e.amigos);
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
    const b = { ...e, vista, page: 1, mes: calendario ? mes : '', dia: calendario ? dia : '', ...cambios };
    if ('p' in cambios) b.page = cambios.p;
    if (b.cerca === false) { b.lat = null; b.lng = null; }
    const s = query(b, lang);
    return `${base}/${s ? `?${s}` : ''}`;
  };
  // Todo fuera, también la zona: la página limpia (y lo guardado, limpio).
  const limpia = `${base}/`;

  // ── La barra de filtros: la de la app ──
  // Una opción de un desplegable (enlace).
  const opcion = (href, label, on, icono = '') => `<a class="op${on ? ' on' : ''}" href="${esc(href)}"${on ? ' aria-current="true"' : ''}>${icono}${esc(label)}</a>`;
  const desplegable = (icono, titulo, valor, activo, opciones, { cls = '', etiqueta = '' } = {}) => `<details class="desplegable${cls}">
      <summary class="chip${activo ? ' on' : ''}"${etiqueta ? ` aria-label="${esc(etiqueta)}"` : ''}>${icono ? ic(icono, 16) : ''}<span class="chip-t">${esc(valor || titulo)}</span>${ic('abajo', 16)}</summary>
      <div class="menu-d" role="group" aria-label="${esc(titulo)}"><p class="menu-d-t" aria-hidden="true">${esc(titulo)}</p>${opciones}</div>
    </details>`;

  const ciudades = cities.filter((c) => c.city).slice(0, 20);
  // Pedir la ubicación y volver con ella (más lo de `data-mas`): /assets/tarjetas.js.
  const botonCerca = (txt, mas = '', cls = 'op') => `<button type="button" class="${cls}" data-cerca${mas ? ` data-mas="${esc(mas)}"` : ''} data-err="${esc(S.nearNo)}" hidden>${ic('cerca', 16)}<span>${esc(txt)}</span></button>`;
  const zonaValor = cerca ? S.nearOn : city ? PRETTY(city) : S.allCities;
  const zonaMenu = desplegable(cerca ? 'cerca' : city ? 'ciudad' : 'lugar', S.zoneChange, zonaValor, false,
    `${negocios ? '' : botonCerca(S.near)}
     ${opcion(link({ city: '', cerca: false }), S.allCities, !city && !cerca)}
     ${ciudades.map((c) => opcion(link({ city: String(c.city), cerca: false }), PRETTY(c.city), !cerca && city.toLowerCase() === String(c.city).toLowerCase())).join('')}`,
    { etiqueta: `${S.zoneChange}: ${zonaValor}` });
  // «Estoy aquí»: a un paseo (1 km), lo que empieza ya y lo más cerca
  // primero. Se quita tocándolo otra vez.
  const aquiOn = cerca && when === 'now' && km === 1 && sort === 'nearest';
  const aqui = negocios ? '' : aquiOn
    ? `<a class="chip on" href="${esc(link({ when: '', km: RADIO_KM, sort: '' }))}" aria-current="true" title="${esc(S.hereNowHint)}">${ic('aqui', 16)}<span>${esc(S.hereNow)}</span></a>`
    : cerca
      ? `<a class="chip" href="${esc(link({ when: 'now', km: 1, sort: 'nearest' }))}" title="${esc(S.hereNowHint)}">${ic('aqui', 16)}<span>${esc(S.hereNow)}</span></a>`
      : `<button type="button" class="chip" data-cerca data-mas="${esc(`${CLAVES[lang].when}=${enIdioma('now', en)}&km=1&${CLAVES[lang].sort}=${enIdioma('nearest', en)}`)}" data-err="${esc(S.nearNo)}" title="${esc(S.hereNowHint)}" hidden>${ic('aqui', 16)}<span>${esc(S.hereNow)}</span></button>`;
  // «Ordenar por»: un desplegable compacto, como la app (no en el mapa ni en
  // el calendario, donde no cambia nada).
  const ordenTxt = { nearest: S.sortNearest, soonest: S.sortSoonest, newest: S.sortNewest };
  const ordenActual = sort || ORDEN_DEFECTO;
  const ordenMenu = negocios || mapa || calendario ? '' : desplegable('', S.sortBy, ordenTxt[ordenActual], false,
    `${cerca
      ? opcion(link({ sort: 'nearest' }), S.sortNearest, ordenActual === 'nearest')
      : botonCerca(S.sortNearest, `${CLAVES[lang].sort}=${enIdioma('nearest', en)}`).replace(ic('cerca', 16), '')}
     ${opcion(link({ sort: 'soonest' }), S.sortSoonest, ordenActual === 'soonest')}
     ${opcion(link({ sort: '' }), S.sortNewest, ordenActual === 'newest')}`,
    { cls: ' orden', etiqueta: `${S.sortBy}: ${ordenTxt[ordenActual]}` });

  // La hoja de filtros: un formulario GET (va sin JavaScript), en el orden de la app.
  const nFiltros = [kind && !negocios, cat, cerca && km !== RADIO_KM, price, soloDescuento, when && !calendario, abierto].filter(Boolean).length;
  const K = CLAVES[en ? 'en' : 'es'];
  const radio = (name, value, label, on) => `<label class="op-r"><input type="radio" name="${name}" value="${esc(value)}"${on ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  const casilla = (name, label, on) => `<label class="op-r"><input type="checkbox" name="${name}" value="1"${on ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  const ocultos = [
    ['q', q], [K.city, cerca ? '' : city], [K.sort, negocios ? '' : sort ? enIdioma(sort, en) : ''], [K.view, vista ? enIdioma(vista, en) : ''],
    [K.month, calendario ? mes : ''], [K.day, calendario ? dia : ''],
    ['lat', cerca && !negocios ? lat.toFixed(4) : ''], ['lng', cerca && !negocios ? lng.toFixed(4) : ''],
    ['amigos', e.amigos ? '1' : ''], ...(negocios ? [[K.kind, enIdioma('places', en)]] : []),
  ].filter(([, v]) => v).map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join('');
  const catActual = (cats || []).find((c) => c.slug === cat);
  const resumen = resumenFiltros(e, S, catActual ? catName(catActual, en) : '');
  const restablecer = link({ kind: negocios ? 'places' : '', cat: '', km: RADIO_KM, price: '', when: '', soloDescuento: false, abierto: false });
  const hoja = `<details class="hoja" id="filtros">
    <summary class="chip chip-filtros${nFiltros ? ' on' : ''}" aria-label="${esc(`${S.filters}: ${resumen.replace(/ · /g, ', ')}`)}">${ic('tune', 16)}<span>${esc(S.filters)}</span><span class="chip-resumen">· ${esc(resumen)}</span></summary>
    <form class="hoja-cuerpo" method="get" action="${base}/" role="dialog" aria-labelledby="hojaTitulo">
      <div class="hoja-cab"><h2 id="hojaTitulo">${esc(S.filters)}</h2>
        <a class="hoja-reset" href="${esc(restablecer)}" data-restablecer>${esc(S.reset)}</a>
        <a class="hoja-x" href="#filtros" data-cerrar-hoja aria-label="${esc(S.close)}">${ic('x', 22)}</a></div>
      ${ocultos}
      <div class="hoja-scroll">
      ${negocios ? '' : `<fieldset><legend>${esc(S.type)}</legend><div class="ops">
        ${radio(K.kind, '', S.all, !kind)}
        ${radio(K.kind, enIdioma('offers', en), S.offers, esOfertas)}
        ${radio(K.kind, enIdioma('events', en), S.events, esEventos)}
      </div></fieldset>`}
      ${(cats || []).length ? `<fieldset><legend>${esc(S.categories)}</legend><div class="ops">
        ${radio(K.cat, '', S.all, !cat)}
        ${(cats || []).map((c) => radio(K.cat, c.slug, catName(c, en), cat === c.slug)).join('')}
      </div></fieldset>` : ''}
      ${negocios ? '' : `<fieldset><legend>${esc(S.distance)}</legend>${cerca ? '' : `<p class="hoja-nota">${esc(S.distHint)}</p>`}<div class="ops">
        ${RADIOS_KM.map((k) => radio('km', k === RADIO_KM ? '' : String(k), `${k} km`, km === k)).join('')}
      </div></fieldset>
      <fieldset><legend>${esc(S.price)}</legend><div class="ops">
        ${radio(K.price, '', S.any, !price)}
        ${radio(K.price, enIdioma('free', en), S.free, price === 'free')}
        ${['10', '25', '50'].map((n) => radio(K.price, n, S.upTo(n), price === n)).join('')}
      </div></fieldset>
      ${calendario ? '' : `<fieldset><legend>${esc(S.when)}</legend><div class="ops">
        ${[['', S.anytime], ['today', S.today], ['tomorrow', S.tomorrow], ['now', S.now], ['next10', S.next10]]
          .map(([v, n]) => radio(K.when, v ? enIdioma(v, en) : '', n, when === v)).join('')}
      </div></fieldset>`}`}
      <fieldset class="hoja-casillas"><legend class="sr">${esc(S.openNow)}</legend><div class="ops">
        ${casilla(K.open, S.openNow, abierto)}
        ${negocios ? '' : casilla(K.discount, S.discount, soloDescuento)}
      </div></fieldset>
      </div>
      <div class="hoja-pie">
        <button class="pill accent" type="submit">${esc(S.showResults)}</button>
      </div>
    </form>
  </details>`;

  const vistas = descubre ? '' : `<nav class="vistas" aria-label="${esc(S.view)}">
      ${[['', S.listView, 'lista', !mapa && !calendario], ['map', S.mapView, 'mapa', mapa], ['calendar', S.calView, 'cal', calendario]]
        .map(([v, n, i, on]) => `<a class="vista${on ? ' on' : ''}" href="${esc(link({ vista: v, kind: negocios ? '' : kind }))}"${on ? ' aria-current="page"' : ''}>${ic(i, 18)}<span>${esc(n)}</span></a>`).join('')}
    </nav>`;

  const buscador = descubre ? '' : `<form class="buscador" role="search" method="get" action="${base}/">
    <label class="buscador-campo">${ic('buscar', 20)}<span class="sr">${esc(S.search)}</span>
      <input type="search" name="q" value="${esc(q)}" placeholder="${esc(S.ph)}" enterkeyhint="search"></label>
    ${new URLSearchParams(query({ ...e, q: '', page: 1, mes: calendario ? mes : '', dia: calendario ? dia : '' }, lang)).toString().split('&').filter(Boolean)
      .map((kv) => { const [k, v] = kv.split('='); return `<input type="hidden" name="${esc(decodeURIComponent(k))}" value="${esc(decodeURIComponent(v.replace(/\+/g, ' ')))}">`; }).join('')}
    <button class="pill ink" type="submit">${esc(S.search)}</button>
  </form>`;

  // El orden de la app: Filtros · Zona · Estoy aquí · [Van mis amigos] · Ordenar.
  const barra = `<div class="barra-filtros" id="barra"${descubre ? ' data-amigos-resultados="#feed"' : ''}>
    ${hoja}
    ${zonaMenu}
    ${aqui}
    <span data-amigos-hueco hidden></span>
    ${ordenMenu}
  </div>
  <p id="cercaErr" class="aviso-error" role="alert" hidden></p>`;

  // En Explorar, sin ubicación ni ciudad: «Mira primero lo que tienes más cerca».
  const invitaCerca = !descubre && !negocios && !cerca && !city
    ? `<p class="cerca-aviso" data-cerca-aviso hidden>${ic('cerca', 18)}<span>${esc(S.nearPrompt)}</span>
        <button type="button" class="pill ink" data-cerca data-err="${esc(S.nearNo)}">${esc(S.useLoc)}</button></p>`
    : '';

  const alertaHref = `${en ? '/app/?lang=en' : '/app/'}#/alerta/nueva?${new URLSearchParams({
    origen: descubre ? 'descubre' : 'explorar',
    ...(esOfertas ? { tipo: 'flash_offer' } : esEventos ? { tipo: 'future_event' } : {}),
    ...(cat ? { cat } : {}),
    ...(price === 'free' ? { precio: '0' } : /^\d{1,3}$/.test(price) ? { precio: String(Number(price) * 100) } : {}),
    ...(soloDescuento ? { descuento: '1' } : {}),
    ...(cerca ? { radio: String(km * 1000), lat: lat.toFixed(4), lng: lng.toFixed(4) } : {}),
  })}`;
  const hayAlgo = conFiltros || cerca || Boolean(city) || Boolean(sort);
  const final = alFinal || vacio ? finalHtml({
    S, en, lang, cerca, km, city, filtros: conFiltros, link, page, sugerencias, vacio, alertaHref,
    limpiar: hayAlgo ? limpia : '', compacto: descubre && !vacio,
  }) : '';

  // ── Más formas de explorar: las páginas de Google, abajo y en su sitio ──
  const ciudadSeo = (cerca ? '' : city) || (ciudades.length === 1 ? String(ciudades[0].city) : '');
  const masFormas = negocios ? '' : `<section class="mas-formas" aria-labelledby="masFormas">
    <h2 id="masFormas">${esc(S.more)}</h2>
    ${ciudades.length ? `<div class="mf-fila"><h3>${esc(S.todayIn)}</h3><p>${ciudades.map((c) => `<a href="${todayBase(lang)}/${CITY(c.city)}/">${esc(PRETTY(c.city))}</a>`).join('')}</p></div>
    <div class="mf-fila"><h3>${esc(S.weekIn)}</h3><p>${ciudades.map((c) => `<a href="${agendaBase(lang)}/${CITY(c.city)}/">${esc(PRETTY(c.city))}</a>`).join('')}</p></div>` : ''}
    ${ciudadSeo && (cats || []).length ? `<div class="mf-fila"><h3>${esc(S.byCat)} · ${esc(PRETTY(ciudadSeo))}</h3><p>${(cats || []).map((c) => `<a href="${agendaBase(lang)}/${CITY(ciudadSeo)}/${encodeURIComponent(c.slug)}/">${esc(catName(c, en))}</a>`).join('')}</p></div>` : ''}
    ${cols.length ? `<div class="mf-fila"><h3>${esc(S.picks)}</h3><p>${cols.map((c) => `<a href="${collectionBase(lang)}/${encodeURIComponent(c.slug)}/${city && !cerca ? `${CITY(city)}/` : ''}">${esc(colTitle(c, en))}</a>`).join('')}</p></div>` : ''}
    <p class="mf-cta"><a class="pill" href="${en ? '/app/?lang=en' : '/app/'}#/registro" data-sin-sesion>${esc(S.app)}</a> <a class="pill" href="${en ? '/en/for-business/' : '/para-negocios/'}">${esc(S.biz)}</a></p>
  </section>`;

  // Cuántas hay y «Quitar filtros»: la página limpia del todo (también la zona).
  // (Sin resultados, «Quitar filtros» va con las demás salidas, abajo.)
  const resumenN = calendario ? '' : `<div class="resumen"><h2 class="resumen-n">${esc(negocios ? S.places(total) : S.results(total))}</h2>
    ${hayAlgo && !vacio ? `<a href="${esc(limpia)}" data-limpia-filtros>${esc(S.clear)}</a>` : ''}</div>`;

  // Lo que se le dice a Google: la página y su lista (como la agenda).
  const jsonLd = !filtrado && items.length && !negocios ? ldScript(listingLd({
    lang, path: `${base}/`, name: descubre ? S.disc : S.exp, description: descubre ? S.discLead : S.lead, city: '', items,
    migas: [['Klendar', en ? '/en/' : '/'], [descubre ? S.disc : S.exp, `${base}/`]],
  })) : '';
  const head = `${guardaFiltros({ ...e, vista }, lang, base)}
${filtrado ? '<meta name="robots" content="noindex, follow">' : jsonLd}`;

  if (descubre) {
    return html(publicPage({
      lang,
      path: `${base}/`,
      title: S.disc,
      description: S.discLead,
      image: portada(items),
      body: feedHtml({ S, en, lang, items, page, paginas, link, barra, final, vacio, resumenN, masFormas }),
      actual: 'descubre',
      bodyClass: vacio ? 'pagina-descubre' : 'pagina-descubre pagina-feed',
      head,
    }), 200, 'public, max-age=120, s-maxage=600');
  }

  // ── Resultados de Explorar ──
  let resultados;
  if (negocios) {
    resultados = items.length
      ? `<div class="nlist">${items.map((b) => bizCard(b, lang, S)).join('')}</div>`
      : `<section class="vacio"><h2>${esc(S.noPlaces)}</h2>
        ${conFiltros ? `<div class="vacio-botones"><a class="pill accent" href="${esc(link({ q: '', cat: '', abierto: false }))}">${esc(S.clearF)}</a></div>` : ''}</section>`;
  } else if (calendario) {
    resultados = calendarioHtml({ items, lang, S, link, mes, dia, hoy });
  } else if (mapa) {
    resultados = `${mapaHtml(items, lang, S)}${items.length ? `<h2 class="fin-h">${esc(S.onMap(items.length))}</h2>${rejilla(items, lang, { galeria: true })}` : ''}`;
  } else {
    const negArriba = (sitios?.items || []);
    resultados = `${negArriba.length ? `<section class="seccion-negocios" aria-labelledby="secNeg">
      <div class="seccion-cab"><h2 id="secNeg">${esc(S.bizSection)}</h2>${(sitios?.total || 0) > negArriba.length ? `<a href="${esc(link({ kind: 'places', vista: '' }))}">${esc(S.allPlaces)}</a>` : ''}</div>
      <div class="nlist">${negArriba.map((b) => bizCard(b, lang, S)).join('')}</div></section>
      ${items.length ? `<h2 class="seccion-t-pub">${esc(S.offersSection)}</h2>` : ''}` : ''}
    ${vacio ? '' : rejilla(items, lang, { primera: !negArriba.length, galeria: true })}`;
  }

  const body = `
  <div class="exp-cab cab-pagina" id="arriba">
    <div><h1>${esc(S.exp)}</h1>
    <p class="muted exp-lead">${esc(S.lead)}</p></div>
    ${vistas}
  </div>
  ${buscador}
  ${barra}
  ${invitaCerca}
  ${resumenN}
  ${resultados}
  ${paginas > 1 ? `<nav class="pager" aria-label="${esc(S.page)}">
    ${page > 1 ? `<a class="pill" href="${esc(link({ p: page - 1 }))}" rel="prev">${esc(S.prev)}</a>` : ''}
    <span class="muted">${esc(S.page)} ${page}/${paginas}</span>
    ${page < paginas ? `<a class="pill" href="${esc(link({ p: page + 1 }))}" rel="next">${esc(S.next)}</a>` : ''}
  </nav>` : ''}
  ${final}
  ${masFormas}`;

  // Una búsqueda concreta no aporta nada al índice de Google; la página
  // limpia sí.
  return html(publicPage({
    lang,
    path: `${base}/`,
    title: S.exp,
    description: S.lead,
    image: portada(items),
    body,
    actual: 'explorar',
    bodyClass: 'pagina-explorar',
    head,
  }), 200, 'public, max-age=120, s-maxage=600');
}

/**
 * Descubre: una publicación por pantalla, deslizando hacia abajo (como la
 * pestaña 1 de la app). La cabecera y los filtros van encima de la foto, en
 * blanco con un velo negro arriba. En el escritorio, una columna del ancho de
 * un móvil grande (9:16) en el centro; a los lados, el título y la foto de la
 * que se está viendo, difuminada. La última pantalla es el final («Has visto
 * todo…» con sus salidas); sin nada, la pantalla vacía centrada.
 *
 * Sin JavaScript se lee igual: es una lista de tarjetas que se desliza.
 */
function feedHtml({ S, en, lang, items, page, paginas, link, barra, final, vacio, resumenN, masFormas }) {
  const cab = `<div class="feed-lado" id="arriba">
      <h1>${esc(S.disc)}</h1>
      <p class="muted">${esc(S.discLead)}</p>
      ${vacio ? '' : `<p class="feed-teclas">${esc(S.feedKeys)}</p>`}
    </div>`;
  if (vacio) {
    return `<div class="feed-vacio">
    ${cab}
    ${barra}
    ${resumenN}
    ${final}
    </div>
    ${masFormas}`;
  }
  const pantallas = items.map((o, i) => tarjeta(o, lang, {
    forma: 'pantalla', primera: page === 1 && i === 0, desc: true, h: 'h2', galeria: true,
  })).join('');
  const mas = page < paginas
    ? `<div class="feed-mas"><a class="pill" href="${esc(link({ p: page + 1 }))}" rel="next" data-feed-mas>${esc(S.seeMore)}</a></div>`
    : '';
  return `<div class="feed-fondo" aria-hidden="true"></div>
  ${cab}
  <div class="feed-velo" aria-hidden="true"></div>
  <div class="feed-cab">
    ${barra}
  </div>
  <div class="feed" id="feed" data-pagina="${page}">
    ${page > 1 ? `<div class="feed-mas"><a class="pill" href="${esc(link({ p: page - 1 }))}" rel="prev">${esc(S.prev)}</a></div>` : ''}
    ${pantallas}
    ${mas}
    ${final ? `<div class="feed-fin">${final}</div>` : ''}
  </div>
  <nav class="feed-nav" aria-label="${esc(S.disc)}">
    <button type="button" class="feed-ir" data-feed-ir="-1" aria-label="${esc(S.prevItem)}">${ic('arriba', 24)}</button>
    <button type="button" class="feed-ir" data-feed-ir="1" aria-label="${esc(S.nextItem)}">${ic('abajo', 24)}</button>
  </nav>
  ${masFormas}`;
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
