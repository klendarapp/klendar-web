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

import { cabeceraEdad, edadDeclarada, esc, html, preguntaEdadEncendida, rows, rpc, rpcAll, supabasePublic, vistosEncendido } from './page.js';
import KZ from '../../assets/zona.js';
import {
  agendaBase, bizPath, cityLinks, collectionBase, decodeSeg, discoverBase, exploreBase, firstPhoto, historiaBoton, isVideo, kidsBase, ldScript,
  listingLd, publicPage, todayBase,
} from './public.js';
import KC from '../../assets/categorias.js';
import { SITIO, esDieta, icSitio, nombreSitio, ordenaSitio, sitioAUrl, sitioDeUrl } from './sitio.js';
import { FUENTE_TIEMPO, dondeTiempo, tiempoDeHoy } from './tiempo.js';
import { rejilla, tarjeta } from './tarjeta.js';
import KM from '../../assets/marcas.js';
import KMO from '../../assets/momentos.js';
import { notFound, sitioAhoraScripts } from './views.js';
import { PARTIDOS_CSS, icPartido, origenDeZona, partidosBase, partidosEnBusqueda, zonaBaseDeExplorar, zonaDeExplorar } from './partidos.js';
import { artistasEnBusqueda } from './artistas.js';
import KA from '../../assets/artistas.js';
import KE from '../../assets/emisiones.js';
import KG from '../../assets/textos-grupos.js';
import KS from '../../assets/textos-sorteos.js';
import { GRUPOS_CSS, gruposBase, icGrupos } from './grupos.js';
import { icSorteo, sorteosBase, sorteosEncendidos } from './sorteos.js';
import { SITIOS_CSS, SITIOS_SCRIPTS, TS, filaSitio, mapaSitios } from './sitios.js';
import { icCat } from './iconos-cat.js';

/** Una dirección mal codificada no es un 500: se manda al listado (302). */
const aListado = (loc) => new Response(null, { status: 302, headers: { Location: loc, 'Cache-Control': 'no-store' } });

const PRETTY = (s) => String(s || '').replace(/(^|[\s-])(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
const CITY = (c) => encodeURIComponent(String(c || '').toLowerCase());
const POR_PAGINA = 24;

const T = (en) => en
  ? {
      exp: 'Explore', disc: 'Discover', agenda: "What's on", search: 'Search', ph: 'A bar, a market, “brunch”…',
      all: 'All', allCities: 'Every city', allCitiesShort: 'All', offers: 'Flash offers', events: 'Events',
      city: 'City', cat: 'Category', clear: 'Clear filters',
      results: (n) => `${n} ${n === 1 ? 'result' : 'results'}`,
      prev: '← Previous', next: 'Next →', page: 'Page',
      lead: 'Search for plans and places, and see them as a list, on the map or on the calendar. No account needed to browse.',
      discLead: 'Flash offers and events from the businesses around you. No account needed to browse.',
      biz: 'List your business', app: 'Create a free account',
      catTitle: (c, city) => `${c} in ${city}`,
      catHead: (c, city) => `${c} in ${city}: deals and events`,
      catLead: (c, city) => `Flash offers and events from ${c.toLowerCase()} in ${city}, updated as businesses publish.`,
      catDesc: (c, city, n) => `${n} ${n === 1 ? 'deal or event' : 'deals and events'} from ${c.toLowerCase()} in ${city}: flash offers with a countdown, events and the places that publish them. No account needed to browse.`,
      catPlaces: (c, city) => `${c} in ${city} on Klendar`,
      todayIn: 'Things to do today in', weekIn: 'This week in', byCat: 'By category',
      catNone: (c, city) => `No ${c.toLowerCase()} in ${city} have anything on right now.`,
      colNone: 'Nothing left here', colNoneBody: 'This pick has run out of plans for now. Look at what else is on or check back later.',
      inCity: 'in', everywhere: 'Everywhere',
      live: (n) => `${n} on right now`,
      picks: 'Picks', more: 'More ways to explore',
      price: 'Price', any: 'Any', free: 'Free', upTo: (n) => `Up to €${n}`,
      when: 'When?', anytime: 'Any time', now: 'Next 2 hours', today: 'Today', tomorrow: 'Tomorrow', next10: 'Next 10 days',
      discount: 'Discounts only', openNow: 'Open now', soonest: 'Soonest', newest: 'Newest',
      nearOn: 'Near you', approx: 'Approximate location', nearNo: "We couldn't get your location. Allow it in your browser and try again.",
      where: 'Where', useLoc: 'Use my location', useLocHint: "What's closest to where you are now", nearPrompt: 'See what’s closest to you first.', nearNeedsWhere: 'To see what’s closest first, tell us where you are.',
      ageQ: 'Are you 18 or over?', ageYes: 'I’m 18 or over', ageNo: 'I’m under 18', ageHidden: (n) => (n === 1 ? '1 result is for over-18s only.' : `${n} results are for over-18s only.`),
      view: 'View', listView: 'List', mapView: 'Map', calView: 'Calendar', distance: 'Distance',
      filters: 'Filters', filtersN: (n) => `Filters, ${n} on`, showResults: 'Show results', close: 'Close',
      mapNo: "The map can't load right now. The list shows the same results.", onMap: (n) => `${n} on the map`,
      // Calendario (la agenda de la app).
      prevMonth: 'Previous month', nextMonth: 'Next month', legendEv: 'Events', legendFl: 'Flash offers',
      dayPlans: (n) => (n === 0 ? 'No plans' : `${n} ${n === 1 ? 'plan' : 'plans'}`), dayNone: 'Nothing this day',
      dayNoneBody: 'Try another day or change the filters.', todayPill: 'Today',
      outsideWhen: (w) => `This day is outside “${w}”`,
      outsideWhenBody: "That's what you've picked under “When?”, at the top (the same here and in Discover).",
      outsideWhenAll: 'Show every day',
      nextWith: (d) => `Next day with plans: ${d}`, todayRel: 'Today', tomorrowRel: 'Tomorrow',
      dayLabel: (d, n) => `${d}: ${n ? `${n} ${n === 1 ? 'plan' : 'plans'}` : 'nothing'}`,
      // Final de la lista (como el final de Descubre en la app).
      endTitle: (d) => `You've seen everything ${d}`, endTitleAll: "You're all caught up for now",
      within: (km) => `within ${km} km`, inPlace: (c) => `in ${c}`,
      endBody: "Widen the search to see more, or check what's on in the coming days.",
      endBodyFiltered: "That's with the filters you have on. Clear them or widen the search to see more.",
      endBodyAll: "There's nothing else for now. Businesses publish every day: check back later or let us tell you.",
      endBodyAllFiltered: "There's nothing else with the filters you have on. Clear them, or let us tell you when something new comes up.",
      endBodyNear: "Widen the distance to see more, or check what's coming up in the agenda.",
      endBodyFilteredNear: "That's with the filters you have on. Clear them or widen the distance to see more.",
      endBodyAllNear: (d) => `There's nothing else ${d}. Businesses publish every day: check back later or let us tell you.`,
      endBodyAllFilteredNear: (d) => `There's nothing else ${d} with the filters you have on. Clear them, or let us tell you when something new comes up.`,
      widen: (km) => `Widen to ${km} km`, allCitiesBtn: 'See every city',
      clearF: 'Clear filters', changeF: 'Change filters', seeAgenda: "See what's on",
      backTop: 'Back to the top', notifyMe: "Tell me when there's something new",
      // «Pedir un local» (crecer, 2026-10-14): a «Tu cuenta», #/pedir-local.
      recommend: 'Missing a place? Ask for it on Klendar', recommendShort: 'Missing a place? Ask for it on Klendar', askFor: (q) => `Can't find “${q}”? Ask for it on Klendar`,
      // «Avísame si…» por palabras (tanda D): como la app.
      alertWord: (q) => `Tell me when there’s something for “${q}”`, alertWordOn: (q) => `We’ll let you know about “${q}”`,
      alertWordHint: 'We’ll write to you when something nearby matches',
      alertWordOnHint: 'Your keywords are in Your account → Settings → Notifications',
      // Sin Klendar en la zona (`klendar_coverage`): «Avísame cuando llegue».
      notHere: "Klendar isn't here yet", notHereIn: (z) => `Klendar isn't in ${z} yet`,
      notHereBody: "We're opening city by city. If you like, we'll let you know once when we get there.",
      notHereComing: (c) => `We're getting ${c} ready: there are no places yet. If you like, we'll tell you just once when they arrive.`,
      notifyArrive: 'Tell me when it arrives', pickCity: 'Choose a city', askVenue: 'Ask for a place',
      maybe: 'You might like',
      // Una búsqueda sin nada en Planes: los textos de la app (searchEmpty…)
      // y, como salida, buscar lo mismo en Sitios.
      searchEmptyTitle: 'No results', searchEmptyBody: (q) => `Nothing matches “${q}”. Try another word.`,
      searchInPlaces: 'Search in Places',
      // Lista vacía (como Descubre vacío en la app): las mismas salidas.
      emptyTitle: 'Nothing around here yet', emptyTitleFiltered: 'Nothing with those filters',
      emptyBody: (d) => `Nothing active ${d} right now. Widen the search, check what's on or let us tell you when there's something new.`,
      emptyBodyFiltered: (d) => `Nothing ${d} with the filters you have on. Clear them or widen the search to see more.`,
      emptyBodyAll: "Nothing active right now. Businesses publish every day: check back later or let us tell you.",
      emptyBodyAllFiltered: 'Nothing with the filters you have on. Clear them, or let us tell you when something new comes up.',
      emptyBodyNear: (d) => `Nothing active ${d} right now. Widen the distance, check the agenda or let us tell you when there's something new.`,
      emptyBodyFilteredNear: (d) => `Nothing ${d} with the filters you have on. Clear them or widen the distance to see more.`,
      emptyBodyAllNear: (d) => `Nothing active ${d} right now. Businesses publish every day: check back later or let us tell you.`,
      emptyBodyAllFilteredNear: (d) => `Nothing ${d} with the filters you have on. Clear them, or let us tell you when something new comes up.`,
      // La barra y la hoja de filtros: las de la app (feed_filter_bar.dart, filter_sheet.dart).
      zoneChange: 'Change area', hereNow: "I'm here", hereNowHint: 'Within walking distance and starting in the next two hours',
      sortBy: 'Sort by', sortNearest: 'Nearest', sortSoonest: 'Starts soonest', sortNewest: 'Newest',
      type: 'Type', categories: 'Categories', reset: 'Reset', distHint: 'Applies with “Near you”.',
      bizSection: 'Places', offersSection: 'Offers and events', allPlaces: 'See all places',
      // El feed de Descubre.
      feedKeys: 'Swipe, scroll or use ↑ ↓ to move on.', feedPos: (i, n) => `${i} of ${n}`,
      prevItem: 'Previous', nextItem: 'Next', seeMore: 'See more',
      // «Lo ya visto, al final» (/assets/vistos.js).
      seenTitle: 'You’ve seen everything new', seenBody: 'You’ve seen these already', seenChange: 'Change this',
      // «El sitio», «Con niños» y «Según el tiempo».
      beforeClosing: 'Before closing', beforeClosingHint: 'What’s left at the end of the day in bakeries, cafés and restaurants, at a discount. You pay at the venue.',
      dailyMenu: 'Daily menu', dailyMenuHint: 'Today’s set menu at places to eat, with its price.',
      eatNow: 'Food served now', eatNowHint: 'Places to eat with the kitchen open, going by their kitchen hours or, if none, the venue’s',
      moment: 'Time of day', momentHint: '“For right now” picks by the local time: breakfast in the morning, vermouth at midday, drinks at night…',
      placeAttrs: "What it's like", diets: 'Allergens and diets', dietsHint: 'Each business declares this: if you have an allergy, check with the venue.',
      place: 'The place', withKids: 'With kids', kidsIn: 'Plans with kids in', placeN: (n) => `The place (${n})`,
      seeAll: (n) => `See all (${n})`, seeLess: 'See fewer',
      byWeather: 'Based on the weather',
      byWeatherHint: "When it rains, indoor plans come first; when it's nice, terraces and outdoor plans. Nothing is hidden.",
      weatherData: 'Weather data:',
      rainLine: "It's raining today: indoor plans first", sunLine: 'Nice weather today: terraces and outdoor plans first',
      weatherOff: 'Turn off',
      sortRain: 'Indoors first', sortSun: 'Outdoors first',
      // Modo viaje y el buscador (/assets/gustos.js).
      travelLabel: 'Away from {home}', travelTitle: "You're in {city} · Today's best", travelClose: 'Dismiss',
      searchRecent: 'What you searched for', searchClear: 'Clear', searchLocal: 'Stored only in this browser.',
      searchPopular: 'Most searched in {city}', searchPopularHint: 'What people searched for most this week. Without knowing who.',
      searchRemove: 'Remove “{q}”',
      // La hoja por orden de uso (2026-10-06).
      what: 'What', whatHint: 'Flash offers: deals that last a few hours. Events: on a set day and time.',
      openNowHint: "The venue, going by today's opening hours",
      // La hoja en cuatro bloques (2026-10-07): Lo básico abierto; Para quién,
      // El sitio y Más plegados, con cuántos lleva cada uno.
      basics: 'The basics', forWhom: "Who it's for", forWhomHint: 'With kids, going solo, student discounts…',
      placeHint: 'Open now, for right now, venue price, terrace…', moreB: 'More', moreBHint: 'Charity, public listings, discounts only',
      withKidsHint: 'Only child-friendly plans', friends: 'Friends going',
      whereTitle: 'Where?', orCity: 'Or pick a city', removeF: (n) => `Remove “${n}”`,
      showN: (n) => (n === 1 ? 'Show 1 result' : `Show ${n} results`), showMany: (n) => `Show more than ${n} results`,
      // Las tres preguntas (opción A, 2026-10-26): ¿Dónde? ¿Cuándo? ¿Qué? y lo demás en Filtros.
      whenQ: 'When', whatQ: 'What', whatTitle: 'What?', tonight: 'Tonight', weekend: 'This weekend',
      shortcuts: 'Shortcuts', walkNow: 'Now, a short walk away', walkNowHint: '1 km, the next 2 hours and the nearest first.',
      planIs: 'The plan is…', placeNow: 'The place, right now', clearQ: 'Clear',
      forEating: "Food and today's specials", pricePlan: 'Plan price', pricePlanHint: 'Free, up to €10, €25 or €50',
      placeLike: 'What the place is like', placeLikeHint: 'Terrace, indoors, dogs, wheelchair access, Wi-Fi, venue price…',
      dietsBHint: 'Vegetarian, vegan, gluten-free, coeliac, lactose-free, halal',
      nearMe: 'Near me', aCity: 'A city', howFar: 'How far?', walk1: '1 km · a short walk', wholeCity: 'The whole city, no distance.',
      mapNoKm: 'On the map you see what is on the screen.',
      sortRec: 'Recommended', sortDefault: 'default',
      recLine: 'Paid featured placements first (with their label), then the newest nearby.',
      weatherLine: "If it rains, indoor plans first; when it's nice, terraces and outdoors.",
      recSteps: ['Paid featured placements, always labelled', "Today's plans, based on the weather", 'Your interests, a little earlier', 'The newest and nearest'],
      sortNearestHint: 'The nearest first', sortSoonestHint: 'What starts or ends first', sortNewestHint: 'The latest publications',
      useTastes: 'Take your interests into account', changeTastes: 'Change', onlyRec: 'Both boxes apply to “Recommended”.',
      byTime: 'By time', rated: 'Top rated',
      placesNearHint: 'By distance and, at the same distance, first the ones with plans today.',
      placesRatedHint: 'By rating; when level, the ones with plans today first.',
      eatSoon: 'Food right now', tonightNear: 'Tonight nearby',
    }
  : {
      exp: 'Explorar', disc: 'Descubre', agenda: 'Agenda local', search: 'Buscar', ph: 'Un bar, un mercadillo, «brunch»…',
      all: 'Todo', allCities: 'Todas las ciudades', allCitiesShort: 'Todas', offers: 'Ofertas flash', events: 'Eventos',
      city: 'Ciudad', cat: 'Categoría', clear: 'Quitar filtros',
      results: (n) => `${n} ${n === 1 ? 'resultado' : 'resultados'}`,
      prev: '← Anterior', next: 'Siguiente →', page: 'Página',
      lead: 'Busca planes y sitios, y míralos en lista, en el mapa o en el calendario. Para mirar no hace falta cuenta.',
      discLead: 'Ofertas flash y planes de los negocios de tu alrededor. Para mirar no hace falta cuenta.',
      biz: 'Publicar mi negocio', app: 'Crear cuenta gratis',
      catTitle: (c, city) => `${c} en ${city}`,
      catHead: (c, city) => `${c} en ${city}: ofertas y planes`,
      catLead: (c, city) => `Ofertas y planes de ${c.toLowerCase()} en ${city}, según van publicando los negocios.`,
      catDesc: (c, city, n) => `${n} ${n === 1 ? 'oferta o plan' : 'ofertas y planes'} de ${c.toLowerCase()} en ${city}: ofertas flash con cuenta atrás, eventos y los negocios que los publican. Sin cuenta para mirar.`,
      catPlaces: (c, city) => `${c} de ${city} en Klendar`,
      todayIn: 'Qué hacer hoy en', weekIn: 'Esta semana en', byCat: 'Por categoría',
      catNone: (c, city) => `Ahora mismo no hay nada de ${c.toLowerCase()} en ${city}.`,
      colNone: 'Aquí no queda nada', colNoneBody: 'Esta selección se ha quedado sin planes por ahora. Mira qué más hay o vuelve más tarde.',
      inCity: 'en', everywhere: 'En todas partes',
      live: (n) => `${n} ahora mismo`,
      picks: 'Selecciones', more: 'Más formas de explorar',
      price: 'Precio', any: 'Cualquiera', free: 'Gratis', upTo: (n) => `Hasta ${n} €`,
      when: '¿Cuándo?', anytime: 'Cuando sea', now: 'Próximas 2 horas', today: 'Hoy', tomorrow: 'Mañana', next10: 'Próximos 10 días',
      discount: 'Solo con descuento', openNow: 'Abierto ahora', soonest: 'Más pronto', newest: 'Novedades',
      nearOn: 'Cerca de ti', approx: 'Ubicación aproximada', nearNo: 'No hemos podido saber dónde estás. Permítelo en el navegador y vuelve a probar.',
      where: 'Dónde', useLoc: 'Usar mi ubicación', useLocHint: 'Lo más cercano a donde estás ahora', nearPrompt: 'Mira primero lo que tienes más cerca.', nearNeedsWhere: 'Para ver lo más cerca primero, dinos dónde estás.',
      ageQ: '¿Tienes 18 años o más?', ageYes: 'Tengo 18 años o más', ageNo: 'Soy menor', ageHidden: (n) => (n === 1 ? 'Hay 1 resultado solo para mayores de 18.' : `Hay ${n} resultados solo para mayores de 18.`),
      view: 'Ver en', listView: 'Lista', mapView: 'Mapa', calView: 'Calendario', distance: 'Distancia',
      filters: 'Filtros', filtersN: (n) => (n === 1 ? 'Filtros, 1 puesto' : `Filtros, ${n} puestos`), showResults: 'Ver resultados', close: 'Cerrar',
      mapNo: 'El mapa no se puede cargar ahora mismo. En la lista está lo mismo.', onMap: (n) => `${n} en el mapa`,
      prevMonth: 'Mes anterior', nextMonth: 'Mes siguiente', legendEv: 'Eventos', legendFl: 'Ofertas flash',
      dayPlans: (n) => (n === 0 ? 'Sin planes' : `${n} ${n === 1 ? 'plan' : 'planes'}`), dayNone: 'Nada este día',
      dayNoneBody: 'Prueba otro día o cambia los filtros.', todayPill: 'Hoy',
      outsideWhen: (w) => `Este día queda fuera de «${w}»`,
      outsideWhenBody: 'Es lo que tienes en «¿Cuándo?», arriba (aquí y en Descubre es lo mismo).',
      outsideWhenAll: 'Ver todos los días',
      nextWith: (d) => `Siguiente día con planes: ${d}`, todayRel: 'Hoy', tomorrowRel: 'Mañana',
      dayLabel: (d, n) => `${d}: ${n ? `${n} ${n === 1 ? 'plan' : 'planes'}` : 'nada'}`,
      // Final de la lista (como el final de Descubre en la app).
      endTitle: (d) => `Has visto todo lo que hay ${d}`, endTitleAll: 'Ya lo has visto todo por ahora',
      within: (km) => `a ${km} km`, inPlace: (c) => `en ${c}`,
      endBody: 'Amplía la búsqueda para ver más o mira lo que viene en la agenda.',
      endBodyFiltered: 'Esto es con los filtros que tienes puestos. Quítalos o amplía la búsqueda para ver más.',
      endBodyAll: 'No hay nada más por ahora. Los negocios publican cada día: vuelve luego o deja que te avisemos.',
      endBodyAllFiltered: 'No hay nada más con los filtros que tienes puestos. Quítalos o deja que te avisemos cuando haya algo nuevo.',
      endBodyNear: 'Amplía la distancia para ver más o mira lo que viene en la agenda.',
      endBodyFilteredNear: 'Esto es con los filtros que tienes puestos. Quítalos o amplía la distancia para ver más.',
      endBodyAllNear: (d) => `No hay nada más ${d}. Los negocios publican cada día: vuelve luego o deja que te avisemos.`,
      endBodyAllFilteredNear: (d) => `No hay nada más ${d} con los filtros que tienes puestos. Quítalos o deja que te avisemos cuando haya algo nuevo.`,
      widen: (km) => `Ampliar a ${km} km`, allCitiesBtn: 'Ver todas las ciudades',
      clearF: 'Quitar filtros', changeF: 'Cambiar filtros', seeAgenda: 'Ver la agenda',
      backTop: 'Volver al principio', notifyMe: 'Avísame cuando haya algo nuevo',
      recommend: '¿Echas en falta algún sitio? Pide que esté en Klendar', recommendShort: '¿Falta un sitio? Pide que esté en Klendar', askFor: (q) => `¿No encuentras «${q}»? Pide que esté en Klendar`,
      // «Avísame si…» por palabras (tanda D): como la app.
      alertWord: (q) => `Avísame si hay algo de «${q}»`, alertWordOn: (q) => `Te avisaremos de «${q}»`,
      alertWordHint: 'Te escribimos cuando algo cerca encaje',
      alertWordOnHint: 'Tus palabras, en Tu cuenta → Ajustes → Notificaciones',
      notHere: 'Klendar aún no ha llegado aquí', notHereIn: (z) => `Klendar aún no ha llegado a ${z}`,
      notHereBody: 'Vamos abriendo ciudad a ciudad. Si quieres, te avisamos una sola vez cuando lleguemos.',
      notHereComing: (c) => `Estamos preparando ${c}: aún no hay sitios. Si quieres, te avisamos una sola vez cuando lleguen.`,
      notifyArrive: 'Avísame cuando llegue', pickCity: 'Elegir una ciudad', askVenue: 'Pedir un local',
      maybe: 'Quizá te interese',
      // Una búsqueda sin nada en Planes: los textos de la app (searchEmpty…)
      // y, como salida, buscar lo mismo en Sitios.
      searchEmptyTitle: 'Sin resultados', searchEmptyBody: (q) => `No hay nada con «${q}». Prueba con otra palabra.`,
      searchInPlaces: 'Buscar en Sitios',
      // Lista vacía (como Descubre vacío en la app): las mismas salidas.
      emptyTitle: 'Aún no hay nada por aquí', emptyTitleFiltered: 'No hay nada con esos filtros',
      emptyBody: (d) => `No hay nada activo ${d} ahora mismo. Amplía la búsqueda, mira la agenda o deja que te avisemos cuando haya algo nuevo.`,
      emptyBodyFiltered: (d) => `No hay nada ${d} con los filtros que tienes puestos. Quítalos o amplía la búsqueda para ver más.`,
      emptyBodyAll: 'No hay nada activo ahora mismo. Los negocios publican cada día: vuelve luego o deja que te avisemos.',
      emptyBodyAllFiltered: 'No hay nada con los filtros que tienes puestos. Quítalos o deja que te avisemos cuando haya algo nuevo.',
      emptyBodyNear: (d) => `No hay nada activo ${d} ahora mismo. Amplía la distancia, mira la agenda o deja que te avisemos cuando haya algo nuevo.`,
      emptyBodyFilteredNear: (d) => `No hay nada ${d} con los filtros que tienes puestos. Quítalos o amplía la distancia para ver más.`,
      emptyBodyAllNear: (d) => `No hay nada activo ${d} ahora mismo. Los negocios publican cada día: vuelve luego o deja que te avisemos.`,
      emptyBodyAllFilteredNear: (d) => `No hay nada ${d} con los filtros que tienes puestos. Quítalos o deja que te avisemos cuando haya algo nuevo.`,
      zoneChange: 'Cambiar zona', hereNow: 'Estoy aquí', hereNowHint: 'Lo que pillas andando y empieza en las dos próximas horas',
      sortBy: 'Ordenar por', sortNearest: 'Más cerca', sortSoonest: 'Empieza antes', sortNewest: 'Lo más nuevo',
      type: 'Tipo', categories: 'Categorías', reset: 'Restablecer', distHint: 'Vale con «Cerca de ti».',
      bizSection: 'Sitios', offersSection: 'Ofertas y eventos', allPlaces: 'Ver todos los sitios',
      feedKeys: 'Desliza, usa la rueda o ↑ ↓ para pasar.', feedPos: (i, n) => `${i} de ${n}`,
      prevItem: 'Anterior', nextItem: 'Siguiente', seeMore: 'Ver más',
      // «Lo ya visto, al final» (/assets/vistos.js).
      seenTitle: 'Ya has visto todo lo nuevo', seenBody: 'Esto ya lo viste', seenChange: 'Cambiar esto',
      beforeClosing: 'Antes de cerrar', beforeClosingHint: 'Lo que sobra del día en panaderías, cafeterías y restaurantes, con descuento. Se paga en el local.',
      dailyMenu: 'Menú del día', dailyMenuHint: 'El menú de hoy de los sitios de comida, con su precio.',
      eatNow: 'Se puede comer ahora', eatNowHint: 'Sitios de comida con la cocina abierta, según su horario de cocina o, si no tienen, el del local',
      moment: 'Momento del día', momentHint: '«Para ahora» elige según la hora del sitio: desayunar por la mañana, vermut a mediodía, copas por la noche…',
      placeAttrs: 'Cómo es', diets: 'Alérgenos y dietas', dietsHint: 'Lo declara cada negocio: si tienes alergia, confírmalo en el local.',
      place: 'El sitio', withKids: 'Con niños', kidsIn: 'Planes con niños en', placeN: (n) => `El sitio (${n})`,
      seeAll: (n) => `Ver todas (${n})`, seeLess: 'Ver menos',
      byWeather: 'Según el tiempo',
      byWeatherHint: 'Con lluvia, primero lo que es bajo techo; con buen tiempo, terrazas y aire libre. No quita nada.',
      weatherData: 'Datos del tiempo:',
      rainLine: 'Hoy llueve: primero, planes bajo techo', sunLine: 'Hace buen tiempo: primero, terrazas y aire libre',
      weatherOff: 'Quitar',
      sortRain: 'Bajo techo primero', sortSun: 'Al aire libre primero',
      // Modo viaje y el buscador (/assets/gustos.js).
      travelLabel: 'Lejos de {home}', travelTitle: 'Estás en {city} · Lo mejor de hoy', travelClose: 'Quitar el aviso',
      searchRecent: 'Lo que buscaste', searchClear: 'Borrar', searchLocal: 'Se guarda solo en este navegador.',
      searchPopular: 'Lo más buscado en {city}', searchPopularHint: 'Lo que más ha buscado la gente esta semana. Sin saber quién.',
      searchRemove: 'Quitar «{q}»',
      // La hoja por orden de uso (2026-10-06).
      what: 'Qué', whatHint: 'Ofertas flash: descuentos que duran unas horas. Eventos: con día y hora.',
      openNowHint: 'El local, según su horario de hoy',
      basics: 'Lo básico', forWhom: 'Para quién', forWhomHint: 'Con niños, ir solo, descuentos para estudiantes…',
      placeHint: 'Abierto ahora, para ahora, precio del local, terraza…', moreB: 'Más', moreBHint: 'Solidario, agenda pública, solo con descuento',
      withKidsHint: 'Solo planes aptos para ir con niños', friends: 'Van mis amigos',
      whereTitle: '¿Dónde?', orCity: 'O elige una ciudad', removeF: (n) => `Quitar «${n}»`,
      showN: (n) => (n === 1 ? 'Ver 1 resultado' : `Ver ${n} resultados`), showMany: (n) => `Ver más de ${n} resultados`,
      // Las tres preguntas (opción A, 2026-10-26): ¿Dónde? ¿Cuándo? ¿Qué? y lo demás en Filtros.
      whenQ: 'Cuándo', whatQ: 'Qué', whatTitle: '¿Qué?', tonight: 'Esta noche', weekend: 'Este finde',
      shortcuts: 'Atajos', walkNow: 'Ahora, a un paseo', walkNowHint: '1 km, las próximas 2 horas y lo más cerca primero.',
      planIs: 'El plan es…', placeNow: 'El sitio, ahora', clearQ: 'Quitar',
      forEating: 'Para comer y lo del día', pricePlan: 'Precio del plan', pricePlanHint: 'Gratis, hasta 10, 25 o 50 €',
      placeLike: 'Cómo es el sitio', placeLikeHint: 'Terraza, bajo techo, perros, accesible, wifi, precio del local…',
      dietsBHint: 'Vegetariano, vegano, sin gluten, celíacos, sin lactosa, halal',
      nearMe: 'Cerca de mí', aCity: 'Una ciudad', howFar: '¿Hasta dónde?', walk1: '1 km · a un paseo', wholeCity: 'Toda la ciudad, sin distancia.',
      mapNoKm: 'En el mapa ves lo que hay en la pantalla.',
      sortRec: 'Recomendado', sortDefault: 'de serie',
      recLine: 'Lo destacado de pago primero (con su etiqueta) y luego lo más nuevo cerca.',
      weatherLine: 'Si llueve, primero lo de bajo techo; con buen tiempo, terrazas y aire libre.',
      recSteps: ['Lo destacado de pago, siempre con su etiqueta', 'Lo de hoy, según el tiempo', 'Lo de tus gustos, un poco antes', 'Lo más nuevo y cerca'],
      sortNearestHint: 'Lo más cercano primero', sortSoonestHint: 'Lo que empieza o acaba primero', sortNewestHint: 'Lo último que han publicado',
      useTastes: 'Tener en cuenta tus gustos', changeTastes: 'Cambiar', onlyRec: 'Las dos casillas valen con «Recomendado».',
      byTime: 'Por hora', rated: 'Mejor valorados',
      placesNearHint: 'Por cercanía y, a la misma distancia, primero los que tienen planes hoy.',
      placesRatedHint: 'Por su valoración; a la par, los que tienen planes hoy.',
      eatSoon: 'Para comer ya', tonightNear: 'Esta noche cerca',
    };

/** «El local, según…» → «el local, según…» (detrás de «Abierto ahora:»). */
const minus = (t) => String(t || '').charAt(0).toLowerCase() + String(t || '').slice(1);
const catName = (c, en) => (en ? c?.names?.en : c?.names?.es) || c?.slug || '';
const colTitle = (c, en) => (en ? c?.title?.en : c?.title?.es) || c?.slug || '';
const colSub = (c, en) => (en ? c?.subtitle?.en : c?.subtitle?.es) || '';

// Iconos de Material en SVG (las páginas públicas no cargan la fuente).
const IC = {
  // «Avísame si…» (Material «notifications_active»).
  campana: 'M7.58 4.08 6.15 2.65C3.75 4.48 2.17 7.3 2.03 10.5h2a8.445 8.445 0 0 1 3.55-6.42zm12.39 6.42h2c-.15-3.2-1.73-6.02-4.12-7.85l-1.42 1.43a8.495 8.495 0 0 1 3.54 6.42zM18 11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2v-5zm-6 11c.14 0 .27-.01.4-.04.65-.14 1.18-.58 1.44-1.18.1-.24.15-.5.15-.78h-4c.01 1.1.9 2 2.01 2z',
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
  // «Antes de cerrar» (shopping_bag).
  carta: 'M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z',
  bolsa: 'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z',
  aqui: 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z',
  ciudad: 'M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z',
  arriba: 'M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z',
  // El orden (Material «swap_vert»).
  orden: 'M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3 5 6.99h3V14h2V6.99h3L9 3z',
};
const ic = (n, s = 18) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${IC[n]}"/></svg>`;

/** El rango de precio («€€») de cada negocio de una lista (`public_businesses`
 * no lo trae): `businesses` se lee sin cuenta. Sin respuesta, sin precio. */
async function conPrecios(lista) {
  const ids = [...new Set((lista || []).map((b) => b.id).filter((id) => /^[0-9a-f-]{36}$/i.test(id || '')))].slice(0, 100);
  if (!ids.length) return;
  // Y los organizadores sin local fijo (`public_organizers`, una lista
  // corta): su tarjeta no lleva dirección sino «Organiza en distintos sitios».
  const [filas, organizadores] = await Promise.all([
    rows('businesses', `select=id,price_level&id=in.(${ids.join(',')})`).catch(() => []),
    rpcAll('public_organizers', {}).then((x) => new Set(x)).catch(() => new Set()),
  ]);
  const por = new Map(filas.map((f) => [f.id, f.price_level]));
  for (const b of lista) {
    if (por.get(b.id)) b.price_level = por.get(b.id);
    if (organizadores.has(b.id)) { b.organizer = true; b.address = null; }
  }
}

/** Tarjeta de negocio, para «Tipo: Negocios». */
const bizCard = (b, lang, S) => {
  const en = lang === 'en';
  const nombre = (en ? b.names?.en : b.names?.es) || '';
  const precio = KM.simbolo(Number(b.price_level));
  return `<a class="ncard" href="${esc(bizPath(lang, b.slug || b.id))}">
    ${b.logo_url ? `<img src="${esc(b.logo_url)}" alt="" width="64" height="64" loading="lazy" decoding="async">` : `<span class="ph" aria-hidden="true">${esc((b.name || '·').charAt(0).toUpperCase())}</span>`}
    <span class="ncard-body">
      <b>${esc(b.name)}</b>
      <span class="muted">${esc(nombre)}${precio ? ` · <span aria-label="${esc(KM.t(lang).priceA11y + KM.significado(Number(b.price_level), lang))}">${precio}</span>` : ''}${b.address ? ` · ${esc(b.address)}` : ''}</span>
      ${b.organizer ? `<span class="muted">${esc(KA.t(lang).organises)}</span>` : ''}
      ${b.live ? `<span class="tag">${esc(S.live(b.live))}</span>` : ''}
    </span>
    <span class="ncard-ir" aria-hidden="true">${ic('der', 20)}</span>
  </a>`;
};

/** La zona de Explorar en las claves de «Grupos y empresas» y «Sorteos»
 * (tu posición o la ciudad; la distancia allí es la suya, 10 km). */
const zonaGrupos = (e, lang) => {
  const p = new URLSearchParams();
  if (e.cerca) { p.set('lat', posUrl(e.lat)); p.set('lng', posUrl(e.lng)); } else if (e.city) p.set(lang === 'en' ? 'city' : 'ciudad', e.city);
  return p.toString();
};

/** «Esta noche se mueve» (tanda C), solo en el mapa de Explorar: la casilla
 * (`?ambiente=1`, en inglés `?buzz=1`), el aviso de una línea (sin
 * movimiento, o con el mapa muy alejado) y la leyenda bajo el mapa. Las
 * zonas las pide y las pinta /assets/ambiente.js (`nightlife_now` con lo que
 * se ve del mapa, otra vez al moverlo): círculos neutros, en tinta. La fila
 * no se enseña hasta que hay alguna zona con ambiente cerca. */
function ambienteHtml(e, lang, link) {
  const en = lang === 'en';
  const sp = supabasePublic();
  const T = en
    ? {
        chk: 'Buzzing tonight', empty: 'Not enough going on around here yet to show it.', why: 'Why?',
        whyText: (n, h) => `We only show areas where at least ${n} different people have been in the last ${h} (redemptions and visits), so nobody can tell who is where. No names or businesses, and never how many people.`,
        wide: 'Zoom in to see where it’s buzzing.',
        legend: (h) => `A bit of buzz · Busy · Buzzing · last ${h}`,
        levels: ['A bit of buzz', 'Busy', 'Buzzing'],
        hours: (n) => (n === 1 ? '1 h' : `${n} h`), mins: (n) => `${n} min`,
      }
    : {
        chk: 'Esta noche se mueve', empty: 'Aún no hay bastante movimiento por aquí para enseñarlo.', why: '¿Por qué?',
        whyText: (n, h) => `Solo enseñamos zonas donde ha habido al menos ${n} personas distintas en las últimas ${h} (canjes y visitas), para que nadie pueda saber quién está dónde. Sin nombres ni negocios, y nunca cuántas personas hay.`,
        wide: 'Acerca el mapa para ver dónde se mueve.',
        legend: (h) => `Algo · Bastante · Mucho ambiente · últimas ${h}`,
        levels: ['Algo de ambiente', 'Bastante ambiente', 'Mucho ambiente'],
        hours: (n) => (n === 1 ? '1 h' : `${n} h`), mins: (n) => `${n} min`,
      };
  const textos = {
    empty: T.empty, why: T.why, wide: T.wide, levels: T.levels,
    whyText: T.whyText('{n}', '{h}'), legend: T.legend('{h}'),
    // «2 h» con lo que diga la base (`window_minutes`).
    h: T.hours(9).replace('9', '{n}'), m: T.mins(9).replace('9', '{n}'),
  };
  // Sin la casilla encendida, la fila sale escondida: depende de que haya
  // gente, y /assets/ambiente.js solo la enseña si hay alguna zona con
  // ambiente cerca (unos 30 km del centro del mapa). Sin datos, nada.
  return `<div class="ambiente-fila"${e.ambiente ? '' : ' hidden'}>
    <label class="ambiente-chk"><input type="checkbox" id="ambiente"${e.ambiente ? ' checked' : ''}
      data-on="${esc(link({ ambiente: true }))}" data-off="${esc(link({ ambiente: false }))}"> <span>${esc(T.chk)}</span></label>
  </div>
  <p class="ambiente-aviso" id="ambiente-aviso" role="status" aria-live="polite" hidden></p>
  <script type="application/json" id="ambiente-textos">${JSON.stringify(textos).replace(/</g, '\\u003c')}</script>
  <script src="/assets/ambiente.js?v=2" defer data-url="${esc(sp.url)}" data-key="${esc(sp.key)}"></script>`;
}

/** Los textos del mapa de Planes (`assets/mapa.js`), como la app
 * (`mapSpotPlans`, `offerDirections`, `mapSpotSeePlace`). */
const MAPA_T = {
  es: { plan1: '1 plan', planesN: '{n} planes', verMas: 'Ver {n} más', comoLlegar: 'Cómo llegar', verSitio: 'Ver el sitio', cerrar: 'Cerrar', acercar: 'Acercar', hasta: (t) => `Hasta las ${t}` },
  en: { plan1: '1 plan', planesN: '{n} plans', verMas: 'See {n} more', comoLlegar: 'Directions', verSitio: 'See the place', cerrar: 'Close', acercar: 'Zoom in', hasta: (t) => `Until ${t}` },
};

/** Cuándo es un plan en la lista de un sitio del mapa: el día y la hora (con
 * la hora del sitio); una oferta ya empezada, hasta cuándo dura. */
function cuandoEnMapa(o, lang) {
  const tz = KZ.de(o);
  const loc = lang === 'en' ? 'en-GB' : 'es-ES';
  const empezada = o.kind === 'flash_offer' && o.starts_at && Date.parse(o.starts_at) <= Date.now() && o.redeem_end_at;
  if (empezada) return MAPA_T[lang === 'en' ? 'en' : 'es'].hasta(KZ.fmt(o.redeem_end_at, tz, loc, { hour: '2-digit', minute: '2-digit' }));
  // «sáb 21 nov · 16:30», como la app.
  if (!o.starts_at) return '';
  const dia = KZ.fmt(o.starts_at, tz, loc, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
  return `${dia} · ${KZ.fmt(o.starts_at, tz, loc, { hour: '2-digit', minute: '2-digit' })}`;
}

/** Mapa de Planes (`assets/mapa.js`): una chincheta por plan; lo del mismo
 * sitio, un marcador con «N planes» que abre su lista; los sitios cercanos,
 * una burbuja con el total que se acerca hasta separarlos. Si Mapbox no carga
 * (sin token, sin red), se dice: debajo está la lista con lo mismo. */
const mapaHtml = (items, lang, S) => {
  const en = lang === 'en';
  const puntos = items.filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lng)).map((o) => ({
    id: o.id, t: o.title, b: o.business_name, lat: o.lat, lng: o.lng, k: o.kind === 'flash_offer' ? 'f' : 'e',
    u: `${en ? '/en' : ''}/o/${o.id}`,
    // Para la lista de un sitio: cuándo (y el orden), el logo y su nombre
    // (el del sitio si es en otro sitio).
    at: o.starts_at || '', w: cuandoEnMapa(o, lang), lg: o.business_logo || undefined,
    // El marcador (GLOSARIO «Aspecto › El mapa»): de la agenda pública (su
    // icono) y con descuento de verdad (el anillo coral; «Gratis» no cuenta).
    ...(o.imported ? { im: 1 } : {}),
    // La foto del marcador: la portada del plan (no las genéricas de la agenda).
    ...((o.images || []).filter((u) => typeof u === 'string' && /^https:\/\//.test(u) && !/\/business-images\/agenda\//.test(u) && !/\.mp4(\?|$)/i.test(u))[0]
      ? { ft: (o.images || []).filter((u) => typeof u === 'string' && /^https:\/\//.test(u) && !/\/business-images\/agenda\//.test(u) && !/\.mp4(\?|$)/i.test(u))[0] } : {}),
    ...(o.discount && o.discount.type !== 'free' ? { d: 1 } : {}),
    sn: o.venue_address ? (o.venue_name || String(o.venue_address).split(',')[0]) : o.business_name,
    // El local (no un sitio de la publicación): su precio, «¿Hay sitio
    // ahora?» y «Ver el sitio».
    ...(o.venue_address ? {} : { n: o.business_id, bu: `${en ? '/en' : ''}/b/${o.business_id}` }),
  }));
  const { hasta, ...textos } = MAPA_T[en ? 'en' : 'es'];
  return `<div id="mapa" class="mapa-explorar" role="region" aria-label="${esc(S.mapView)}" data-no="${esc(S.mapNo)}" data-textos="${esc(JSON.stringify(textos))}"></div>
  <p class="ambiente-leyenda" id="ambiente-leyenda" hidden></p>
  ${sitioAhoraScripts(lang).replace(/ defer/g, '')}
  <script type="application/json" id="mapaPuntos">${JSON.stringify(puntos).replace(/</g, '\u003c')}</script>
  <script src="/assets/iconos-mapa.js?v=1"></script>
  <script src="/assets/mapa.js?v=6"></script>`;
};

/** Las distancias de «Cerca de mí», las mismas que la hoja de filtros de la
 * app (`FeedFilters.radiusOptionsM`). Sin elegir, 5 km, como la app. */
const RADIOS_KM = [1, 3, 5, 10, 25];
const RADIO_KM = 5;
/** «Una ciudad»: toda ella, 25 km de su centro (como la app, `cityRadiusM`). */
const RADIO_CIUDAD_M = 25000;

/** «Pedir un local» en «Tu cuenta» (`#/pedir-local`), con el nombre ya
 * escrito si viene de una búsqueda. */
const pedirHref = (lang, nombre = '') => `${lang === 'en' ? '/app/?lang=en' : '/app/'}#/pedir-local${nombre ? `?nombre=${encodeURIComponent(String(nombre).slice(0, 80))}` : ''}`;

/** «Klendar aún no ha llegado a {zona}» (crecer, 2026-10-14): con «Cerca de
 * ti», la lista vacía y `klendar_coverage` diciendo que aquí no hay Klendar
 * (ningún negocio a 25 km). La pantalla vacía de siempre (`.vacio`, centrada
 * y con salidas): «Avísame cuando llegue» (el principal), «Elegir una
 * ciudad» (abre el «dónde») y «Pedir un local». La zona: la ciudad de
 * Klendar que viene (`coming`) o «aquí», que /assets/avisame.js afina con la
 * geocodificación inversa de Mapbox (el punto redondeado). Ese script hace
 * también el «Avísame»: con sesión de «Tu cuenta», directo; sin ella, un
 * correo con doble confirmación. Sin JavaScript, el botón lleva a «Tu
 * cuenta» (`#/avisame`), que lo hace al entrar. No se enseña «Quizá te
 * interese» (sería de otra ciudad) ni el aviso del modo viaje. */
const sinKlendarHtml = ({ S, lang, lat, lng, cobertura, link }) => {
  const en = lang === 'en';
  const zona = cobertura?.status === 'coming' && cobertura.city_name ? String(cobertura.city_name) : '';
  const sp = supabasePublic();
  const pos = { lat: posUrl(lat), lng: posUrl(lng) };
  const app = `${en ? '/app/?lang=en' : '/app/'}#/avisame?${new URLSearchParams({ ...pos, ...(zona ? { zona } : {}) })}`;
  const textos = { notHere: S.notHere, notHereIn: S.notHereIn('{zona}'), ...avisameTextos(en) };
  return `${AVISAME_CSS}<section class="vacio avisame" aria-labelledby="finTitulo" data-avisame data-lat="${esc(pos.lat)}" data-lng="${esc(pos.lng)}" data-zona="${esc(zona)}">
    <span class="vacio-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="${IC.lugar}"/></svg></span>
    <h2 id="finTitulo" tabindex="-1" data-avisame-titulo>${esc(zona ? S.notHereIn(zona) : S.notHere)}</h2>
    <p data-avisame-texto>${esc(zona ? S.notHereComing(zona) : S.notHereBody)}</p>
    <div class="vacio-botones" data-avisame-botones>
      <a class="pill accent" href="${esc(app)}" data-avisame-si>${esc(S.notifyArrive)}</a>
      <a class="pill" href="${esc(`${link({ cerca: false, city: '' })}#barra`)}" data-elige-ciudad>${esc(S.pickCity)}</a>
      <a class="pill" href="${esc(pedirHref(lang))}">${esc(S.askVenue)}</a>
    </div>
    <div class="avisame-caja" data-avisame-caja hidden></div>
  </section>
  <script type="application/json" id="avisame-textos">${JSON.stringify(textos).replace(/</g, '\\u003c')}</script>
  <script src="/assets/avisame.js?v=1" defer data-url="${esc(sp.url)}" data-key="${esc(sp.key)}" data-lang="${en ? 'en' : 'es'}"></script>`;
};

/** Lo que dice /assets/avisame.js (el formulario y lo que pasa después). */
const avisameTextos = (en) => (en
  ? {
      email: 'Your email', send: 'Tell me', login: 'Log in with my account', busy: 'One moment…',
      note: "Only to tell you once. You'll get an email to confirm it and you can unsubscribe whenever you like.",
      privacy: 'Privacy', privacyUrl: '/en/privacy/',
      badEmail: "Check the email: it doesn't look valid.", tooMany: 'Too many attempts. Try again in a while.',
      captcha: "We couldn't check that you're not a robot. Try again.",
      oops: 'Something went wrong. If it happens again, email info@klendar.app.',
      checkTitle: 'Check your email to confirm it',
      checkBody: "We've sent a link to {correo}. Until you confirm it we won't add you (and if you don't within 7 days, we'll delete it).",
      okTitle: "We'll tell you when Klendar reaches {zona}",
      okBody: 'Just once. You can remove it in Your account → What you have asked for.',
      alreadyBody: 'You were already on the list. You can remove it in Your account → What you have asked for.',
      seeMine: 'See what you have asked for', liveTitle: 'Klendar is already here', liveBody: 'Reload the page to see it.', reload: 'Reload',
    }
  : {
      email: 'Tu correo', send: 'Avísame', login: 'Entrar con mi cuenta', busy: 'Un momento…',
      note: 'Solo para avisarte una vez. Te llegará un correo para confirmarlo y podrás borrarte cuando quieras.',
      privacy: 'Privacidad', privacyUrl: '/privacidad/',
      badEmail: 'Revisa el correo: no parece válido.', tooMany: 'Demasiados intentos. Prueba dentro de un rato.',
      captcha: 'No hemos podido comprobar que no eres un robot. Vuelve a probar.',
      oops: 'Algo no ha ido bien. Si vuelve a pasar, escríbenos a info@klendar.app.',
      checkTitle: 'Mira tu correo para confirmarlo',
      checkBody: 'Te hemos mandado un enlace a {correo}. Hasta que no lo confirmes no te apuntamos (y si no lo haces en 7 días, lo borramos).',
      okTitle: 'Te avisaremos cuando Klendar llegue a {zona}',
      okBody: 'Una sola vez. Lo puedes quitar en Tu cuenta → Lo que has pedido.',
      alreadyBody: 'Ya estabas en la lista. Lo puedes quitar en Tu cuenta → Lo que has pedido.',
      seeMine: 'Ver lo que has pedido', liveTitle: 'Klendar ya está aquí', liveBody: 'Vuelve a cargar la página para verlo.', reload: 'Volver a cargar',
    });

/** Estilos del formulario de «Avísame» (solo en esa pantalla). */
const AVISAME_CSS = `<style>
.avisame-caja { width: min(420px, 100%); margin-top: 22px; text-align: left; }
.avisame-form { display: grid; gap: 12px; }
.avisame-form label { display: grid; gap: 6px; font-weight: 700; font-size: 14px; }
.avisame-form input { font: inherit; font-size: 16px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--glass-border); background: var(--elevated); color: var(--ink); }
.avisame-form input:focus { outline: 2px solid var(--ink); outline-offset: 1px; }
.avisame-nota { margin: 0; color: var(--ink-2); font-size: 13px; }
.avisame-nota a { text-decoration: underline; text-underline-offset: 2px; color: inherit; }
.avisame-err { margin: 0; color: #C81E42; font-size: 14px; font-weight: 700; }
.avisame-form .vacio-botones { margin-top: 4px; }
@media (prefers-color-scheme: dark) { .avisame-err { color: #FF9B9B; } }
</style>`;

/** Al final de la lista (última página): qué se ha visto y qué hacer ahora.
 * Lo mismo que la tarjeta final de Descubre en la app. Con [vacio] (no hay
 * nada desde el principio), las mismas salidas y la misma lógica, pero
 * centradas como una pantalla vacía (`.vacio`), como Descubre vacío. */
const finalHtml = ({ S, en, lang, cerca, km, city, filtros, link, page, alertaHref, sugerencias, vacio = false, limpiar = '', compacto = false, pedirQ = '', sinSugiere = false, agendaHref = '', busqueda = '', enSitios = '' }) => {
  const sigKm = cerca ? RADIOS_KM.find((k) => k > km) : null;
  // ¿Se puede mirar más lejos? Con «Cerca de mí», a la distancia siguiente;
  // en una ciudad, en todas.
  const ampliar = cerca ? (sigKm ? { href: link({ km: sigKm }), txt: S.widen(sigKm) } : null)
    : city ? { href: link({ city: '' }), txt: S.allCitiesBtn } : null;
  const donde = cerca ? S.within(km) : city ? S.inPlace(PRETTY(city)) : '';
  const titulo = vacio ? (filtros ? S.emptyTitleFiltered : S.emptyTitle) : ampliar ? S.endTitle(donde) : S.endTitleAll;
  // Con «Cerca de ti», los textos de la app: «Amplía la distancia» y, en la
  // mayor, «No hay nada más a 25 km». Con una ciudad, «Amplía la búsqueda».
  const cuerpo = cerca
    ? (vacio
      ? (ampliar ? (filtros ? S.emptyBodyFilteredNear(donde) : S.emptyBodyNear(donde)) : (filtros ? S.emptyBodyAllFilteredNear(donde) : S.emptyBodyAllNear(donde)))
      : ampliar ? (filtros ? S.endBodyFilteredNear : S.endBodyNear) : (filtros ? S.endBodyAllFilteredNear(donde) : S.endBodyAllNear(donde)))
    : vacio
      ? (ampliar ? (filtros ? S.emptyBodyFiltered(donde) : S.emptyBody(donde)) : (filtros ? S.emptyBodyAllFiltered : S.emptyBodyAll))
      : ampliar ? (filtros ? S.endBodyFiltered : S.endBody) : (filtros ? S.endBodyAllFiltered : S.endBodyAll);
  // «Ver la agenda»: Explorar › Planes › calendario con los mismos filtros (la app).
  const agenda = agendaHref || `${agendaBase(lang)}/${city ? `${CITY(city)}/` : ''}`;
  // «Quitar filtros» deja la página limpia: sin filtros, sin zona y sin
  // distancia (lo que se espera al pulsarlo; también lo guardado).
  const quitar = limpiar
    ? `<a class="pill" href="${esc(limpiar)}" data-limpia-filtros>${esc(S.clearF)}</a>`
    : '';
  // «Pedir un local» (en la distancia mayor, o con una búsqueda sin negocios
  // que encajen: «¿No encuentras «X»? Pide que esté en Klendar»).
  const sugiere = sinSugiere || (ampliar && !pedirQ) ? ''
    : `<p class="${vacio ? 'vacio-sugiere' : 'fin-sugiere'}"><a href="${esc(pedirHref(lang, pedirQ))}">${esc(pedirQ ? S.askFor(pedirQ) : S.recommend)}</a></p>`;
  // En el feed de Descubre, en filas (caben en la última pantalla).
  const quizas = sugerencias.length ? `<h2 class="fin-h">${esc(S.maybe)}</h2>
  ${compacto ? `<div class="tj-filas">${sugerencias.map((o) => tarjeta(o, lang, { forma: 'fila' })).join('')}</div>` : rejilla(sugerencias, lang)}` : '';
  if (vacio && busqueda) {
    // Una búsqueda sin nada (como la app): «Sin resultados… Prueba con otra
    // palabra.» y buscar lo mismo en Sitios; «Quitar filtros» solo si hay
    // otros filtros además de la palabra, y «Pide que esté en Klendar» solo si
    // tampoco hay ningún sitio que se llame así (`pedirQ`).
    return `<section class="vacio" aria-labelledby="finTitulo">
    <span class="vacio-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z"/></svg></span>
    <h2 id="finTitulo">${esc(S.searchEmptyTitle)}</h2>
    <p>${esc(S.searchEmptyBody(busqueda))}</p>
    <div class="vacio-botones">
      ${enSitios ? `<a class="pill accent" href="${esc(enSitios)}">${esc(S.searchInPlaces)}</a>` : ''}
      ${quitar}
    </div>
    ${sugiere}
  </section>
  ${quizas}`;
  }
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

const portada = (items) => items.map((o) => firstPhoto(o.images) || o.photo).find(Boolean);

/** Dónde se mira, para los textos de Sitios: «a 5 km», «en Madrid» o nada. */
const dondeSitios = (e, S) => (e.cerca ? S.within(e.km) : e.city ? S.inPlace(PRETTY(e.city)) : '');

/** «Quitar filtros» en Sitios: lo del sitio fuera; la zona y Sitios se quedan. */
const sinFiltrosSitio = (link) => link({ cat: '', cats: [], abierto: false, traits: [], precioLocal: 0, menuDia: false, comerAhora: false, momento: '', q: '' });

/** Explorar › Sitios: la lista (o el mapa y debajo la primera parte), o la
 * pantalla vacía centrada con sus salidas. */
function sitiosHtml({ items, lang, S, TSi, e, link, mapa, pedirQ, centro }) {
  const en = lang === 'en';
  const conFiltros = Boolean(e.q || e.cat || e.abierto || sitioSinNinos(e).length || e.precioLocal || e.menuDia || e.comerAhora || e.momento);
  const quitaSolo = e.q ? `<p class="chip-solo"><a class="chip on chip-quitar" href="${esc(link({ que: '' }))}" aria-label="${esc(TSi.removeOnlyPlaces)}"><span>${esc(TSi.onlyPlaces)}</span>${ic('x', 16)}</a></p>` : '';
  const zoom = e.cerca ? (e.km <= 1 ? 15 : e.km <= 3 ? 14 : 13) : 13;
  const mapaH = mapa ? mapaSitios({
    lang, zoom, desde: e.cerca ? [e.lng, e.lat] : null,
    centro: centro && Number.isFinite(Number(centro.lng)) ? [Number(centro.lng), Number(centro.lat)] : null,
    filtros: {
      ...(e.catIds?.length ? { p_categories: e.catIds } : e.cat ? { p_category: e.cat } : {}), ...(e.abierto ? { p_open_now: true } : {}),
      ...(() => {
        const t = [...sitioSinNinos(e), ...(e.precioLocal ? [`price_le_${e.precioLocal}`] : []), ...(e.menuDia ? ['daily_menu'] : []),
          ...(e.comerAhora ? ['eat_now'] : []), ...(e.momento ? [KMO.trait(e.momento)] : [])];
        return t.length ? { p_traits: t } : {};
      })(),
    },
  }) : '';
  if (!items.length) {
    const sigKm = e.cerca ? RADIOS_KM.find((k) => k > e.km) : null;
    const donde = dondeSitios(e, S);
    return `${quitaSolo}${mapaH}<section class="vacio" aria-labelledby="finTitulo">
    <span class="vacio-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="currentColor" d="${IC.lugar}"/></svg></span>
    <h2 id="finTitulo">${esc(conFiltros ? TSi.emptyTitleFiltered : TSi.emptyTitle)}</h2>
    <p>${esc(donde ? TSi.emptyBody(donde) : TSi.emptyBodyNoZone)}</p>
    <div class="vacio-botones">
      ${sigKm ? `<a class="pill accent" href="${esc(link({ km: sigKm }))}">${esc(S.widen(sigKm))}</a>` : ''}
      ${conFiltros ? `<a class="pill${sigKm ? '' : ' accent'}" href="${esc(sinFiltrosSitio(link))}">${esc(S.clearF)}</a>` : ''}
    </div>
    <p class="vacio-sugiere"><a href="${esc(pedirHref(lang, pedirQ))}">${esc(pedirQ ? S.askFor(pedirQ) : S.recommend)}</a></p>
  </section>`;
  }
  return `${quitaSolo}${mapaH}<div class="sitios-lista">${items.map((p) => filaSitio(p, lang, { conDistancia: e.cerca })).join('')}</div>`;
}

/** Al final de la lista de Sitios: «Has visto todos los sitios a 5 km» y
 * «Ampliar a 10 km», si se puede. */
function sitiosFinal({ items, TSi, S, e, link, page, paginas, mapa }) {
  if (mapa || !items.length || page < paginas) return '';
  const sigKm = e.cerca ? RADIOS_KM.find((k) => k > e.km) : null;
  const donde = dondeSitios(e, S);
  if (!donde) return '';
  return `<section class="sitios-fin" aria-labelledby="finSitios">
    <h2 id="finSitios">${esc(TSi.end(donde))}</h2>
    ${sigKm ? `<a class="pill" href="${esc(link({ km: sigKm }))}">${esc(S.widen(sigKm))}</a>` : ''}
  </section>`;
}

/** Todas las de un filtro (para el calendario): la base da 60 por llamada. */
async function todas(args, max = 240, H = null) {
  const primera = await rpc('public_explore', { ...args, p_limit: 60, p_offset: 0 }, H);
  const items = [...(primera?.items || [])];
  const total = Math.min(primera?.total || 0, max);
  const resto = [];
  for (let off = 60; off < total; off += 60) resto.push(rpc('public_explore', { ...args, p_limit: 60, p_offset: off }, H));
  for (const r of await Promise.all(resto)) items.push(...(r?.items || []));
  return items;
}

const dos = (n) => String(n).padStart(2, '0');
/** El calendario llega a este mes y los 12 siguientes (13), como la app. */
const MESES_CAL = 12;
/** Los días (AAAA-MM-DD, hora de Madrid) que cuentan con «¿Cuándo?», o null
 * sin él: el calendario solo marca esos y abre en el primero (como la app,
 * `whenDays`). */
function diasDeCuando(when, hoy) {
  if (!when) return null;
  if (when === 'today') return [hoy];
  if (when === 'tomorrow') return [KZ.hoy('Europe/Madrid', 1)];
  if (when === 'next10') return [...Array(11)].map((_, i) => KZ.hoy('Europe/Madrid', i));
  // «Esta noche»: hoy (de madrugada, la noche sigue siendo la de hoy).
  if (when === 'tonight') return [hoy];
  // «Este finde»: de viernes a domingo (empezado el finde, desde hoy).
  if (when === 'weekend') {
    const dow = (new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7 + 1; // lunes = 1
    const desde = dow >= 5 ? 0 : 5 - dow;
    return [...Array(8 - dow - desde)].map((_, i) => KZ.hoy('Europe/Madrid', desde + i));
  }
  // «Próximas 2 horas»: hoy y, si pasa de medianoche, mañana.
  const fin = KZ.dia(new Date(Date.now() + 2 * 3600e3).toISOString(), 'Europe/Madrid');
  return fin > hoy ? [hoy, fin] : [hoy];
}
/** «2026-10» + n meses. */
const sumaMes = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}`;
};

/** La vista Calendario: el mes con los días marcados y, debajo (al lado en
 * el escritorio), lo de ese día. Como la agenda de Explorar en la app. Los
 * días son enlaces: va sin JavaScript y cada día se puede compartir. */
function calendarioHtml({ items, lang, S, link, mes, dia, hoy, delDiaParte = null, totalDia = null, cuando = null, quitarFiltros = '', orden = '' }) {
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
  const siguiente = mes < sumaMes(hoyMes, MESES_CAL) ? sumaMes(mes, 1) : null;

  const celdas = [];
  for (let i = 0; i < hueco; i++) celdas.push('<span class="cal-dia vacio-dia" aria-hidden="true"></span>');
  for (let d = 1; d <= diasMes; d++) {
    const iso = `${mes}-${dos(d)}`;
    // Con «¿Cuándo?», solo llevan punto los días que cuentan.
    const fuera = Boolean(cuando) && !cuando.dias.includes(iso);
    const lista = fuera ? [] : porDia.get(iso) || [];
    const pasado = iso < hoy;
    const ev = lista.some((o) => o.kind !== 'flash_offer');
    const fl = lista.some((o) => o.kind === 'flash_offer');
    const puntos = lista.length ? `<span class="cal-puntos" aria-hidden="true">${ev ? '<i class="pe"></i>' : ''}${fl ? '<i class="pf"></i>' : ''}</span>` : '';
    const cls = `cal-dia${iso === hoy ? ' hoy' : ''}${iso === dia ? ' sel' : ''}${pasado ? ' pasado' : ''}${fuera && !pasado ? ' fuera' : ''}`;
    const etiqueta = S.dayLabel(largo(iso), lista.length);
    celdas.push(pasado
      ? `<span class="${cls}" aria-hidden="true">${d}</span>`
      : `<a class="${cls}" href="${esc(link({ dia: iso, mes }))}#dia" aria-label="${esc(etiqueta)}"${iso === dia ? ' aria-current="date"' : ''}>${d}${puntos}</a>`);
  }
  // Lo del día, por partes (`public_explore` con `day` y `?p=`); sin
  // respuesta, lo que haya de las del mes.
  const diaFuera = Boolean(cuando) && !cuando.dias.includes(dia);
  const delDia = diaFuera ? [] : delDiaParte || porDia.get(dia) || [];
  const nDia = diaFuera ? 0 : Number.isFinite(totalDia) ? totalDia : delDia.length;
  const proximo = delDia.length ? null : [...porDia.keys()].sort()
    .find((k) => k > dia && (!cuando || cuando.dias.includes(k)));
  // «Hoy», si se mira otro día u otro mes (la píldora de la app).
  const hoyBoton = dia !== hoy || mes !== hoyMes
    ? `<a class="pill cal-hoy" href="${esc(link({ mes: hoyMes, dia: hoy }))}#dia">${esc(S.todayPill)}</a>` : '';
  // Sin nada ese día: por qué y qué hacer (como la app). Fuera de «¿Cuándo?»,
  // se dice y se ofrece verlo todo; si no, «Nada este día» con «Quitar
  // filtros» si hay alguno, y el siguiente día con planes.
  const vacioDia = diaFuera
    ? `<div class="vacio cal-vacio"><h3>${esc(S.outsideWhen(cuando.etiqueta))}</h3><p>${esc(S.outsideWhenBody)}</p>
        <div class="vacio-botones"><a class="pill" href="${esc(cuando.quitar)}#dia">${esc(S.outsideWhenAll)}</a></div></div>`
    : `<div class="vacio cal-vacio"><h3>${esc(S.dayNone)}</h3><p>${esc(S.dayNoneBody)}</p>
        ${proximo ? `<p><a href="${esc(link({ dia: proximo, mes: proximo.slice(0, 7) }))}#dia">${esc(S.nextWith(rel(proximo) || largo(proximo)))} →</a></p>` : ''}
        ${quitarFiltros ? `<div class="vacio-botones"><a class="pill" href="${esc(quitarFiltros)}#dia">${esc(S.clearF)}</a></div>` : ''}</div>`;
  return `<div class="calendario">
    <section class="cal-mes" aria-labelledby="calTitulo">
      <div class="cal-cab">
        ${anterior ? `<a class="cal-nav" href="${esc(link({ mes: anterior, dia: '' }))}" aria-label="${esc(S.prevMonth)}">${ic('izq', 22)}</a>` : `<span class="cal-nav" aria-hidden="true"></span>`}
        <div class="cal-titulo"><h2 id="calTitulo">${esc(mesTitulo.charAt(0).toUpperCase() + mesTitulo.slice(1))}</h2>${hoyBoton}</div>
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
        <span class="muted">${esc(S.dayPlans(nDia))}</span>
        ${nDia > 1 ? orden : ''}
      </div>
      ${delDia.length
        ? `<div class="tj-filas">${delDia.map((o) => tarjeta(o, lang, { forma: 'fila' })).join('')}</div>`
        : vacioDia}
    </section>
  </div>`;
}

// ── Descubre y Explorar ────────────────────────────────────────────────────
// Los filtros son los de la app (`FeedFilters`, la barra de
// `feed_filter_bar.dart`, la hoja de `filter_sheet.dart` y el «dónde» de
// `location_sheet.dart`), los mismos en las dos páginas y con los mismos
// nombres (docs/GLOSARIO.md, «Los filtros»; opción A de
// docs/PROPUESTA_FILTROS.md, aprobada el 2026-10-26):
//   fila:  ¿Dónde? · ¿Cuándo? · ¿Qué? y ☰ fijo a la derecha, la misma y en el
//          mismo orden en todas las vistas (Iván, 2026-10-27: nada salta de
//          sitio). Cada pregunta dice lo que lleva («Esta noche», «Bares,
//          Música») y se encoge con «…» para que en 360 px quepa todo; sin
//          chips sueltos con × ni el orden en la fila.
//   ¿Dónde?:  Cerca de mí (¿Hasta dónde? 1 km · a un paseo / 3 / 5 / 10 / 25)
//          | Una ciudad (toda la ciudad, sin distancia; «Todas las ciudades»).
//   ¿Cuándo?: Atajos (Ahora, a un paseo · Esta noche · Este finde) · El plan
//          es… · El sitio, ahora (Abierto ahora · Se puede comer ahora) ·
//          Momento del día. En Sitios, lo del sitio.
//   ¿Qué?:  Tipo · Menú del día y Antes de cerrar · Categorías (varias, todas
//          a la vista: una cuadrícula de iconos por los cinco grupos).
//   ☰:     Ordenar por (en Descubre y la lista de Planes) · Precio del plan ·
//          Para quién · Cómo es el sitio (con el precio del local) ·
//          Alérgenos y dietas · Más, plegados y con su número.
//   orden: dentro de ☰, arriba: Recomendado (de serie: destacado, el tiempo de hoy y tus gustos
//          encima de lo más nuevo) · Más cerca · Empieza antes · Lo más nuevo,
//          con las casillas «Según el tiempo» y «Tener en cuenta tus gustos»
//          (solo con Recomendado). En el calendario, «Por hora» / «Más cerca»
//          en la cabecera del día; en Sitios, «Más cerca» / «Mejor valorados»
//          en la cabecera de la lista; en el mapa, ninguno.
// («Ocultar contenido +18» no está: la web pública nunca enseña +18.)
//
// Todo va en la URL. Las dos páginas leen las claves de los dos idiomas
// (`?ciudad=` y `?city=`), así un enlace sirve aunque se cambie de idioma.
// «El sitio» va en `?sitio=terraza&sitio=ninos` (varios a la vez: tienen que
// cumplirse todos) y «Según el tiempo», encendido de serie, solo se escribe
// apagado (`?tiempo=0`).
// Lo compartido (zona, distancia, filtros, orden, «Van mis amigos») se guarda
// en el navegador al entrar en una de las dos y se recupera al llegar a la
// otra sin filtros en la dirección (`guardaFiltros`); un enlace con filtros
// manda sobre lo guardado.

/** Las claves de la dirección en cada idioma. */
const CLAVES = {
  es: { city: 'ciudad', cat: 'categoria', kind: 'tipo', price: 'precio', when: 'cuando', discount: 'descuento', open: 'abierto', sort: 'orden', view: 'vista', month: 'mes', day: 'dia', show: 'ver', place: 'sitio', weather: 'tiempo',
    age: 'edad', vprice: 'precio-local', card: 'descuento-para', solo: 'solo', charity: 'solidario', entity: 'agenda-publica', closing: 'antes-de-cerrar', buzz: 'ambiente', menu: 'menu-del-dia', eat: 'comer-ahora', moment: 'momento', what: 'que', notastes: 'sin-gustos' },
  en: { city: 'city', cat: 'category', kind: 'type', price: 'price', when: 'when', discount: 'discount', open: 'open', sort: 'sort', view: 'view', month: 'month', day: 'day', show: 'show', place: 'place', weather: 'weather',
    age: 'age', vprice: 'venue-price', card: 'discount-for', solo: 'solo', charity: 'charity', entity: 'public-listings', closing: 'before-closing', buzz: 'buzz', menu: 'daily-menu', eat: 'food-now', moment: 'moment', what: 'what', notastes: 'no-tastes' },
};
/** Marcas (tanda A) en la dirección: edades «4-8», carné en cada idioma. */
const EDAD_URL = { '0-3': '0_3', '4-8': '4_8', '9-12': '9_12', '13-17': '13_17' };
const edadAUrl = (id) => id.replace('_', '-');
const CARNE_URL = { estudiantes: 'student', jovenes: 'youth', mayores: 'senior', students: 'student', young: 'youth', seniors: 'senior' };
const carneAUrl = (c, en) => (en ? { student: 'students', youth: 'young', senior: 'seniors' } : { student: 'estudiantes', youth: 'jovenes', senior: 'mayores' })[c] || '';
/** Lo que se le pide a la base por las marcas (los mismos `traits` que la
 * app): edades solo con «Con niños». */
const traitsMarcas = (e) => [
  ...((e.traits || []).includes('kids') ? (e.edades || []).map((a) => `age_${a}`) : []),
  ...(e.precioLocal ? [`price_le_${e.precioLocal}`] : []),
  ...(e.carne ? [`card_${e.carne}`] : []),
  ...(e.solo ? ['solo'] : []),
  ...(e.solidario ? ['charity'] : []),
  // «Agenda pública»: lo de entidades (migración 20261130100000).
  ...(e.entidad ? ['entity'] : []),
];
/** Los valores, por dentro en inglés; en la dirección, en el idioma de la página. */
const VALORES_ES = {
  offers: 'ofertas', events: 'eventos', places: 'negocios', free: 'gratis',
  now: 'ahora', today: 'hoy', tomorrow: 'manana', next10: '10dias', tonight: 'esta-noche', weekend: 'finde',
  newest: 'nuevas', soonest: 'pronto', nearest: 'cerca', rated: 'valorados', map: 'mapa', calendar: 'calendario',
};
const NORMAL = { ...Object.fromEntries(Object.entries(VALORES_ES).map(([k, v]) => [v, k])), sitios: 'places' };
const norm = (v) => NORMAL[v] || v;
const enIdioma = (v, en) => (en ? v : VALORES_ES[v] || v);
/** Orden de la app por defecto: «Recomendado» (`FeedFilters.defaultSort`):
 * lo de hoy según el tiempo y tus gustos encima de lo más nuevo. No se
 * escribe en la dirección. */
const ORDEN_DEFECTO = 'recommended';

/** Posición para la dirección: 3 decimales (unos 100 m), nunca más precisa.
 * La distancia de cada tarjeta la calcula el navegador con la suya. */
const redondeaPos = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x);
const posUrl = (x) => redondeaPos(Number(x)).toFixed(3);

/** Lee el estado de la dirección (con las claves de cualquiera de los dos idiomas). */
function leeEstado(qs) {
  const de = (k, max) => (qs.get(CLAVES.es[k]) || qs.get(CLAVES.en[k]) || '').slice(0, max);
  let kind = norm(de('kind', 20));
  // Qué se busca: Planes (de serie) o Sitios (`?que=sitios`, `?what=places`).
  // «Negocios» era un tipo más; los enlaces de antes (`?tipo=negocios`,
  // `?ver=negocios`) llevan ahora a Sitios.
  let que = norm(de('what', 20)) === 'places' ? 'places' : '';
  if (kind === 'places' || /^(places|negocios)$/.test(de('show', 20))) { kind = ''; que = 'places'; }
  if (!['offers', 'events'].includes(kind)) kind = '';
  const price = norm(de('price', 10));
  const when = norm(de('when', 12));
  const sort = norm(de('sort', 12));
  const vista = norm(de('view', 12));
  // La posición de «Cerca de mí» va en la dirección con 3 decimales (unos
  // 100 m); un enlace de antes con más se redondea al leerlo.
  const lat = redondeaPos(Number.parseFloat(qs.get('lat') || ''));
  const lng = redondeaPos(Number.parseFloat(qs.get('lng') || ''));
  const cerca = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const kmPedido = Number.parseInt(qs.get('km') || '', 10);
  // Varios valores (`?sitio=a&sitio=b`) o separados por comas.
  const todos = (k) => [...qs.getAll(CLAVES.es[k]), ...qs.getAll(CLAVES.en[k])];
  const traits = ordenaSitio(todos('place').flatMap((v) => String(v).split(',')).slice(0, 24).map(sitioDeUrl));
  const tiempo = todos('weather');
  // Marcas: edad (con «Con niños»), precio del local, carné, solo, solidario.
  const edades = [...new Set(todos('age').flatMap((v) => String(v).split(',')).map((v) => EDAD_URL[v.trim()]).filter(Boolean))]
    .sort((a, b) => Object.values(EDAD_URL).indexOf(a) - Object.values(EDAD_URL).indexOf(b));
  const precioLocal = Number.parseInt(de('vprice', 2), 10);
  const cats = [...new Set(todos('cat').flatMap((v) => String(v).split(',')).map((v) => v.trim().slice(0, 40))
    .filter((v) => /^[a-z0-9-]{1,40}$/.test(v)))].slice(0, 12);
  return {
    que,
    // «Todas las ciudades» elegido a mano: sin la zona aproximada de la conexión.
    todas: qs.get('todas') === '1',
    q: (qs.get('q') || '').slice(0, 60),
    city: de('city', 60),
    // Varias categorías (`?categoria=a&categoria=b`, también con comas); `cat`
    // es la primera (lo que piden las páginas de una sola).
    cats,
    cat: cats[0] || '',
    kind,
    price: price === 'free' || /^\d{1,3}$/.test(price) ? price : '',
    when: ['now', 'today', 'tomorrow', 'next10', 'tonight', 'weekend'].includes(when) ? when : '',
    soloDescuento: de('discount', 2) === '1',
    abierto: de('open', 2) === '1',
    // «Mejor valorados» solo en Sitios (`rated`); lo demás, en Planes.
    sort: ['newest', 'soonest', 'nearest', 'rated'].includes(sort) && (sort !== 'rated' || que === 'places') ? sort : '',
    // «Tener en cuenta tus gustos» (en el menú de orden), apagado: `?sin-gustos=1`.
    sinGustos: de('notastes', 2) === '1',
    vista: ['map', 'calendar'].includes(vista) ? vista : '',
    cerca, lat: cerca ? lat : null, lng: cerca ? lng : null,
    km: RADIOS_KM.includes(kmPedido) ? kmPedido : RADIO_KM,
    amigos: qs.get('amigos') === '1',
    traits,
    edades: traits.includes('kids') ? edades : [],
    precioLocal: KM.PRECIOS.includes(precioLocal) ? precioLocal : 0,
    carne: CARNE_URL[de('card', 20)] || '',
    solo: de('solo', 2) === '1',
    solidario: de('charity', 2) === '1',
    entidad: de('entity', 2) === '1',
    // «Antes de cerrar»: lo que sobra del día (`before_closing` en
    // `offer_traits`, migración 20261121100000).
    antesCierre: de('closing', 2) === '1',
    // «Menú del día» (`daily_menu`, migración 20261230100001) y «Se puede
    // comer ahora» (`eat_now`, migración 20261230100000), como la app.
    menuDia: de('menu', 2) === '1',
    comerAhora: de('eat', 2) === '1',
    // Momento del día (`moment_now` o `moment_<x>`, migración
    // 20261233100001): uno como mucho, como la app.
    momento: KMO.deUrl(de('moment', 20)),
    // «Esta noche se mueve» (solo en el mapa de Explorar; tanda C).
    ambiente: de('buzz', 2) === '1',
    // Apagado solo si lo dice la dirección (la hoja sin JavaScript manda
    // `tiempo=0&tiempo=1` cuando está encendido).
    tiempoOff: tiempo.includes('0') && !tiempo.includes('1'),
    page: Math.max(1, Math.min(50, parseInt(qs.get('p') || '1', 10) || 1)),
    mes: de('month', 7),
    dia: de('day', 10),
    // «Tus gustos» (slugs, como mucho 5): pesan en el orden, no filtran. Los
    // pone el navegador desde lo guardado (ver `guardaFiltros`).
    gustos: [...new Set((qs.get('gustos') || '').split(',').filter((x) => /^[a-z0-9-]{1,40}$/.test(x)))].slice(0, 5),
  };
}

/** Las categorías de un estado: la lista (`cats`) o, si alguien solo cambió
 * `cat`, esa. `cat: ''` sin `cats` las quita todas. */
const catsDe = (e) => (Array.isArray(e.cats) && (e.cats.length ? e.cats[0] === e.cat : !e.cat) ? e.cats : e.cat ? [e.cat] : []);

/** La dirección de un estado. `soloCompartido`: solo lo que viaja entre
 * Descubre y Explorar (sin búsqueda, vista, mes, día ni página). */
function query(e, lang, { soloCompartido = false } = {}) {
  const en = lang === 'en';
  const K = CLAVES[en ? 'en' : 'es'];
  const p = new URLSearchParams();
  // En Sitios solo filtra lo que vale para un sitio: la zona y la distancia,
  // categoría, «Abierto ahora», «Menú del día», «Se puede comer ahora», el
  // momento, el precio del local y cómo es (como la app). Lo de Planes
  // (¿Cuándo?, Qué, Precio, Para quién, Más, el orden y la vista Calendario)
  // va en la dirección sin filtrar nada: al volver a Planes sigue ahí y lo
  // guardado no se pierde (revisión 2026-10-22, F3 y F4).
  const sit = e.que === 'places';
  if (!soloCompartido && sit) p.set(K.what, en ? 'places' : 'sitios');
  if (!soloCompartido && e.q) p.set('q', e.q);
  if (e.city && !e.cerca) p.set(K.city, e.city);
  for (const c of catsDe(e)) p.append(K.cat, c);
  if (e.kind) p.set(K.kind, enIdioma(e.kind, en));
  if (e.abierto) p.set(K.open, '1');
  if (e.price) p.set(K.price, enIdioma(e.price, en));
  if (e.when) p.set(K.when, enIdioma(e.when, en));
  if (e.soloDescuento) p.set(K.discount, '1');
  if (e.sort) p.set(K.sort, enIdioma(e.sort, en));
  if (!soloCompartido && e.vista) p.set(K.view, enIdioma(e.vista, en));
  if (!sit && !soloCompartido && e.vista === 'calendar' && e.mes) p.set(K.month, e.mes);
  if (!sit && !soloCompartido && e.vista === 'calendar' && e.dia) p.set(K.day, e.dia);
  // La zona aproximada de la conexión nunca va en la dirección (UA1): solo
  // la distancia, si no es la de serie.
  if (e.cerca && !e.aprox) {
    p.set('lat', posUrl(e.lat)); p.set('lng', posUrl(e.lng));
    if (e.km !== RADIO_KM) p.set('km', String(e.km));
  } else if (e.cerca && e.aprox && e.km !== RADIO_KM) p.set('km', String(e.km));
  if (e.todas && !e.cerca && !e.city) p.set('todas', '1');
  if (e.amigos) p.set('amigos', '1');
  for (const t of e.traits || []) p.append(K.place, sitioAUrl(t, en));
  if ((e.traits || []).includes('kids')) for (const a of e.edades || []) p.append(K.age, edadAUrl(a));
  if (e.precioLocal) p.set(K.vprice, String(e.precioLocal));
  if (e.carne) p.set(K.card, carneAUrl(e.carne, en));
  if (e.solo) p.set(K.solo, '1');
  if (e.solidario) p.set(K.charity, '1');
  if (e.entidad) p.set(K.entity, '1');
  if (e.antesCierre) p.set(K.closing, '1');
  if (e.menuDia) p.set(K.menu, '1');
  if (e.comerAhora) p.set(K.eat, '1');
  if (e.momento) p.set(K.moment, KMO.aUrl(e.momento, en));
  if (!sit && !soloCompartido && e.vista === 'map' && e.ambiente) p.set(K.buzz, '1');
  if (e.tiempoOff) p.set(K.weather, '0');
  if (e.sinGustos) p.set(K.notastes, '1');
  if (!soloCompartido && e.page > 1) p.set('p', String(e.page));
  if (!sit && !soloCompartido && e.gustos?.length) p.set('gustos', e.gustos.join(','));
  return p.toString();
}

/**
 * Guardar y recuperar los filtros entre Descubre y Explorar (en el <head>,
 * antes de pintar nada).
 *
 * - Sin filtros en la dirección y con unos guardados: se va a la misma página
 *   con ellos (`location.replace`, así «Atrás» no vuelve a la página sin
 *   filtros). Se recuerdan siempre (opción A, 2026-10-26), salvo ¿Cuándo?,
 *   que vale hasta las 6:00 del día siguiente («Esta noche» guardada engaña
 *   al día siguiente), y tu posición («Cerca de mí»), que como siempre se
 *   olvida a las 6 h. De ¿Cuándo? es todo lo suyo, como en la app
 *   (`whenReset`): el plan, «Abierto ahora», «Se puede comer ahora» y el
 *   momento; y si era «Ahora, a un paseo», también su 1 km y «Más cerca».
 * - Si no, se guardan los de esta página (en los dos idiomas).
 * - Los enlaces de la propia página (cambiar un filtro, «Quitar filtros»,
 *   «Todas las ciudades») dejan una marca para que su resultado no se pise con
 *   lo guardado (ver /assets/tarjetas.js); tampoco al volver con «Atrás».
 */
function guardaFiltros(e, lang, base, explorar = false) {
  const compartido = { es: query(e, 'es', { soloCompartido: true }), en: query(e, 'en', { soloCompartido: true }) };
  // Explorar recuerda lo último elegido (Planes o Sitios; lista, mapa o calendario),
  // como la app: al volver a /explorar/ sin nada en la dirección, se abre ahí.
  const vistaDe = (l) => {
    const K = CLAVES[l];
    const x = new URLSearchParams();
    if (e.que === 'places') x.set(K.what, l === 'en' ? 'places' : 'sitios');
    // Lista, mapa o calendario (en Sitios, solo el mapa).
    if (e.vista === 'map' || (e.vista === 'calendar' && e.que !== 'places')) x.set(K.view, enIdioma(e.vista, l === 'en'));
    return x.toString();
  };
  // Lo que no viaja entre páginas (la búsqueda, la vista y el día del
  // calendario) se queda en la dirección al recuperar lo guardado.
  const K = CLAVES[lang === 'en' ? 'en' : 'es'];
  const resto = new URLSearchParams();
  if (e.que === 'places') resto.set(K.what, lang === 'en' ? 'places' : 'sitios');
  if (e.q) resto.set('q', e.q);
  if (e.vista) resto.set(K.view, enIdioma(e.vista, lang === 'en'));
  if (e.vista === 'calendar' && e.mes) resto.set(K.month, e.mes);
  if (e.vista === 'calendar' && e.dia) resto.set(K.day, e.dia);
  if (e.vista === 'map' && e.ambiente) resto.set(K.buzz, '1');
  const vacia = !compartido.es;
  const datos = JSON.stringify({
    A: compartido, L: lang, v: vacia, r: resto.toString(), b: `${base}/`, g: (e.gustos || []).join(','),
    ...(explorar ? { ex: 1, x: { es: vistaDe('es'), en: vistaDe('en') } } : {}),
  }).replace(/</g, '\\u003c');
  return `<script>(function(d){try{var K='klendar.filtros',X='klendar.explorar',s=sessionStorage,ls=localStorage;
var sin=s.getItem('klendar.filtros.sin');s.removeItem('klendar.filtros.sin');
var n=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0])||{};
var g=JSON.parse(ls.getItem(K)||'null');
var gu=JSON.parse(ls.getItem('klendar.gustos')||'null'),gq=gu&&Array.isArray(gu.c)?gu.c.filter(function(x){return /^[a-z0-9-]{1,40}$/.test(x);}).slice(0,5).join(','):'';
var conG=function(u){var q=new URL(u,location.href);if(gq)q.searchParams.set('gustos',gq);else q.searchParams.delete('gustos');return q.pathname+q.search+q.hash;};
var libre=!sin&&n.type!=='back_forward',vx=d.ex?JSON.parse(ls.getItem(X)||'null'):null,ex=d.ex&&libre&&!location.search&&vx&&vx[d.L]?vx[d.L]:'';
var seis=new Date();if(seis.getHours()<6)seis.setDate(seis.getDate()-1);seis.setHours(6,0,0,0);
var viejo=function(s,t){var u=new URLSearchParams(s||'');if(!(t>=seis.getTime())){var w=u.get('cuando')||u.get('when');if((w==='ahora'||w==='now')&&u.get('km')==='1'&&/^(cerca|nearest)$/.test(u.get('orden')||u.get('sort')||'')){u.delete('km');u.delete('orden');u.delete('sort');}['cuando','when','abierto','open','comer-ahora','food-now','momento','moment'].forEach(function(k){u.delete(k);});}if(!(Date.now()-t<216e5)){u.delete('lat');u.delete('lng');}return u.toString();};
var gq0=g&&g[d.L]?viejo(g[d.L],g.t):'';
if(d.v&&libre&&gq0){location.replace(conG(d.b+'?'+gq0+(d.r?'&'+d.r:'')+(ex?'&'+ex:'')+location.hash));return;}
if(ex){location.replace(conG(d.b+'?'+ex+location.hash));return;}
if(d.ex)ls.setItem(X,JSON.stringify(d.x));
ls.setItem(K,JSON.stringify({t:Date.now(),es:d.A.es,en:d.A.en}));
if(gq!==d.g)location.replace(conG(location.href));}catch(x){}})(${datos});</script>`;
}

/** «El sitio» de la hoja: todo menos «Apto para niños», que es «Con niños»
 * (en «Para quién»). */
const sitioSinNinos = (e) => (e.traits || []).filter((t) => t !== 'kids');

/** Lo puesto en la hoja Filtros (lo que no es dónde, cuándo ni qué), por
 * bloques y en su orden (como `filterSummary` en la app): «Gratis, Con niños,
 * Terraza». Va en la etiqueta de ☰ para el lector de pantalla; sin nada,
 * vacío. Lo de ¿Cuándo? y ¿Qué? lo dice su propio botón. */
function resumenFiltros(e, S) {
  const lang = S.place === 'The place' ? 'en' : 'es';
  const marca = (t) => KM.nombreFiltro(t, lang);
  const partes = [];
  const sitios = e.que === 'places';
  // Precio del plan.
  if (!sitios && e.price) partes.push(e.price === 'free' ? S.free : S.upTo(e.price));
  // Para quién.
  if (!sitios && (e.traits || []).includes('kids')) {
    const edades = (e.edades || []).map((a) => marca(`age_${a}`)).filter(Boolean);
    partes.push(edades.length ? `${S.withKids} (${edades.join(', ')})` : S.withKids);
  }
  if (!sitios && e.solo) partes.push(marca('solo'));
  if (!sitios && e.carne) partes.push(marca(`card_${e.carne}`));
  if (!sitios && e.amigos) partes.push(S.friends);
  // Cómo es el sitio y alérgenos.
  if (e.precioLocal) partes.push(marca(`price_le_${e.precioLocal}`));
  const sitio = sitioSinNinos(e);
  if (sitio.length === 1) partes.push(nombreSitio(sitio[0], lang === 'en'));
  else if (sitio.length > 1) partes.push(S.placeN(sitio.length));
  // Más.
  if (!sitios && e.solidario) partes.push(marca('charity'));
  if (!sitios && e.entidad) partes.push(marca('entity'));
  if (!sitios && e.soloDescuento) partes.push(S.discount);
  return partes.filter(Boolean).join(' · ');
}

/**
 * La misma búsqueda pintada de dos maneras: `modo` 'explorar' (buscar, y
 * Lista, Mapa o Calendario) o 'descubre' (el feed a pantalla completa, una
 * publicación por pantalla, como la pestaña 1 de la app).
 */
/** Las páginas que cambian con la cookie de la edad (`klendar_18`): que
 * ninguna caché sirva a uno lo que se pintó para otro. */
function conCookie(res) {
  res.headers.set('vary', 'Cookie');
  return res;
}

/** Ubicación aproximada por la conexión (Iván, 2026-10-28; privacidad,
 * «Ubicación aproximada por la conexión», UA1): sin posición ni ciudad en la
 * dirección, la ciudad y el punto que Cloudflare deduce de la IP
 * (`request.cf`), redondeado a 0,1° (unos 10 km). Sin pedir permiso, sin
 * guardarlo (ni en la dirección, ni en el navegador, ni en la base) y la
 * página que sale con él va en caché privada. Solo en España (donde está
 * Klendar) y nunca para los robots (Google debe ver la página de siempre).
 * Sin dato, `null`: «Todas las ciudades». */
export function zonaDeConexion(request) {
  const cf = request?.cf;
  if (!cf) return null;
  const ua = request.headers?.get?.('user-agent') || '';
  if (/bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram/i.test(ua)) return null;
  if (String(cf.country || '').toUpperCase() !== 'ES') return null;
  const lat = Number.parseFloat(cf.latitude);
  const lng = Number.parseFloat(cf.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const r = (x) => Math.round(x * 10) / 10;
  return { lat: r(lat), lng: r(lng) };
}

export async function explorePage(url, lang, modo = 'explorar', request = null) {
  const en = lang === 'en';
  const S = T(en);
  // Contenido +18 (Iván, 2026-10-27): lo contestado en este navegador a
  // «¿Tienes 18 años o más?» (con sesión, lo pone la cuenta: amigos.js). La
  // base solo enseña +18 con «18 o más» (o con la pregunta apagada).
  const edad = edadDeclarada(request);
  const H = cabeceraEdad(edad);
  const descubre = modo === 'descubre';
  const base = descubre ? discoverBase(lang) : exploreBase(lang);
  // «Sorteos» solo con el interruptor encendido (se pide a la vez que lo demás).
  const conSorteos = sorteosEncendidos().catch(() => false);
  const e = leeEstado(url.searchParams);
  if (descubre) { e.q = ''; e.vista = ''; e.que = ''; }
  // Sin posición, ciudad ni «Todas las ciudades» en la dirección, la página
  // depende de la conexión: con su zona aproximada, «Ubicación aproximada ·
  // 5 km» (como la app); sin dato, «Todas las ciudades». Esa página no se
  // guarda en ninguna caché compartida.
  const deLaConexion = !e.cerca && !e.city && !e.todas;
  const aprox = deLaConexion ? zonaDeConexion(request) : null;
  if (aprox) { e.lat = aprox.lat; e.lng = aprox.lng; e.cerca = true; e.aprox = true; }
  const cachePublica = (publica) => (deLaConexion || edad ? 'private, max-age=0' : publica);
  const variaCon = (res) => { if (deLaConexion) res.headers.set('vary', 'Cookie, CF-Connecting-IP'); return res; };
  const { q, city, cat, kind, price, when, soloDescuento, abierto, cerca, lat, lng, km, page, traits, tiempoOff, gustos, antesCierre, menuDia, comerAhora } = e;
  // Las categorías elegidas (varias, como la app). En Sitios, varias van por
  // sus ids (`public_places` y `map_places`).
  const catsSel = e.cats || [];
  if (e.que === 'places' && catsSel.length > 1) {
    e.catIds = await rows('categories', 'select=id,slug').then((r) => r.filter((c) => catsSel.includes(c.slug)).map((c) => c.id)).catch(() => []);
  }
  // Explorar › Sitios (`?que=sitios`): los negocios con la ficha completa,
  // por cercanía, en lista o en el mapa (`public_places`, `map_places`). Los
  // filtros de los planes no cuentan aquí.
  const negocios = !descubre && e.que === 'places';
  const sitiosMapa = negocios && e.vista === 'map';
  const TSi = TS(en);
  const esOfertas = kind === 'offers';
  const esEventos = kind === 'events';
  // «Mejor valorados» solo desde su fecha (`rated_sort_available()`, en la
  // base, migración 20261247100000; lo mismo que la app): antes ni sale ni se
  // pide (la base, además, lo ignora).
  const valoradosYa = negocios && e.sort === 'rated'
    ? (await rpc('rated_sort_available', {}).catch(() => false)) === true
    : negocios ? rpc('rated_sort_available', {}).then((x) => x === true).catch(() => false) : false;
  const sort = e.sort === 'rated' && valoradosYa !== true ? '' : e.sort;
  const mapa = !negocios && e.vista === 'map';
  const calendario = !negocios && e.vista === 'calendar';
  // «Lo ya visto, al final» (Iván, 2026-10-28): en Descubre y en la lista de
  // Explorar (las dos van en el orden elegido, como Descubre en la app), no
  // en una búsqueda. Lo hace el navegador (/assets/vistos.js) con lo que
  // guarda él: la base no sabe qué has visto. Con su interruptor.
  const conVistos = !negocios && !mapa && !calendario && !q && (await vistosEncendido());
  // En Sitios (sin calendario) se ve en lista, pero el Calendario de Planes
  // se conserva para volver a él.
  const vista = negocios ? (sitiosMapa ? 'map' : e.vista === 'calendar' ? 'calendar' : '') : e.vista;
  // Lo que se le pide a la base por «El sitio» en Sitios.
  const traitsSitio = [...sitioSinNinos(e), ...(e.precioLocal ? [`price_le_${e.precioLocal}`] : []),
    ...(menuDia ? ['daily_menu'] : []), ...(comerAhora ? ['eat_now'] : []), ...(e.momento ? [KMO.trait(e.momento)] : [])];
  // Una ciudad es toda ella: 25 km de su centro, como la app (Iván,
  // 2026-10-27). Si no se sabe su centro, los negocios de esa ciudad.
  const argsSitios = (centro) => ({
    p_lat: cerca ? lat : centro?.lat ?? null, p_lng: cerca ? lng : centro?.lng ?? null,
    p_radius_m: cerca ? km * 1000 : centro ? RADIO_CIUDAD_M : null, p_city: cerca || centro ? null : city || null,
    // Una categoría por su slug; varias, por sus ids (`public_places` las
    // pide así).
    p_category: catsSel.length === 1 ? cat : null, p_q: q || null, p_open_now: abierto,
    ...(catsSel.length > 1 ? { p_categories: e.catIds || [] } : {}),
    // +18: lo decide la base con la cabecera (`viewer_sees_adults()`).
    p_traits: traitsSitio.length ? traitsSitio : null,
    // «Mejor valorados» (migración 20261246100000); «Más cerca» es lo de siempre.
    ...(sort === 'rated' ? { p_sort: 'rated' } : {}),
  });
  // El centro de la ciudad elegida (para ordenar por cercanía sin tu posición).
  const plano0 = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const centroDe = (ck) => (cerca || !city ? null
    : (ck || []).find((c) => c.id === plano0(city) || plano0(c.name) === plano0(city)) || null);
  // Las ciudades de Klendar (`cities`), para el centro de la elegida.
  const ciudadesP = rows('cities', 'select=id,name,lat,lng&order=position.asc').catch(() => []);
  const centroCiudad = city && !cerca ? centroDe(await ciudadesP) : null;
  // El calendario: qué mes y qué día (en la hora de Madrid; cada publicación
  // va en el día de su negocio).
  const hoy = KZ.hoy('Europe/Madrid');
  const mesPedido = e.mes;
  const diaPedido = e.dia;
  // Lo que se le pide a la base. El orden: el elegido o «Recomendado» (la
  // app). «Según el tiempo» y «Tus gustos» solo valen con «Recomendado»: los
  // órdenes sencillos van sin ellos.
  const ordenBase = sort && sort !== 'rated' ? sort : ORDEN_DEFECTO;
  const recomendado = ordenBase === ORDEN_DEFECTO;
  const filtros = {
    ...(price === 'free' ? { free: true } : {}),
    ...(/^\d{1,3}$/.test(price) ? { max_price_cents: Number(price) * 100 } : {}),
    // En el calendario manda el día elegido, no «¿Cuándo?».
    ...(when && !calendario ? { when } : {}),
    ...(soloDescuento ? { discount_only: true } : {}),
    ...(abierto ? { open_now: true } : {}),
    // «El sitio» y «Con niños»: todos los marcados a la vez.
    ...(traits.length || traitsMarcas(e).length || antesCierre || menuDia || comerAhora || e.momento
      ? { traits: [...traits, ...traitsMarcas(e), ...(antesCierre ? ['before_closing'] : []),
          ...(menuDia ? ['daily_menu'] : []), ...(comerAhora ? ['eat_now'] : []),
          ...(e.momento ? [KMO.trait(e.momento)] : [])] } : {}),
    // «Más cerca» sin saber dónde (ni tu posición ni una ciudad): se pide la
    // ubicación (`sinDondeCerca`) y mientras, por hora.
    sort: ordenBase === 'nearest' && !cerca && !centroCiudad ? 'soonest' : ordenBase,
    ...(cerca ? { radius_m: km * 1000 } : centroCiudad ? { radius_m: RADIO_CIUDAD_M } : {}),
    // Varias categorías (`cats`, migración 20261246100000); una sola va en
    // `p_category`, como siempre.
    ...(catsSel.length > 1 ? { cats: catsSel } : {}),
    // «Tus gustos»: pesan en el orden, sin esconder nada (como la app), con
    // «Recomendado» y la casilla encendida.
    ...(gustos.length && recomendado && !e.sinGustos ? { prefer: gustos } : {}),
    // «Van mis amigos» necesita sesión: no va en esta página (pública y en
    // caché); lo filtra /assets/amigos.js en el navegador.
  };
  const pKind = esOfertas ? 'flash_offer' : esEventos ? 'future_event' : null;
  const filtrado = Boolean(e.que || q || city || cat || kind || page > 1 || price || when || soloDescuento || abierto || sort || cerca || vista || e.amigos || e.sinGustos
    || traits.length || traitsMarcas(e).length || antesCierre || menuDia || comerAhora || e.momento || tiempoOff || gustos.length);

  const argsExplore = {
    p_city: cerca || centroCiudad ? null : city || null, p_category: catsSel.length === 1 ? cat : null, p_kind: pKind, p_q: q || null,
    p_filters: filtros, p_lat: cerca ? lat : centroCiudad?.lat ?? null, p_lng: cerca ? lng : centroCiudad?.lng ?? null,
  };
  // «Ver N resultados»: la hoja pregunta cuántas saldrían con lo que lleva
  // marcado (`?contar=1`, /assets/tarjetas.js). Solo el número.
  if (url.searchParams.get('contar') === '1') {
    const n = mapa || sitiosMapa ? null
      : negocios
        ? await rpc('public_places', { ...argsSitios(centroCiudad), p_limit: 1, p_offset: 0 }, H)
          .then((r) => (typeof r?.total === 'number' ? r.total : null)).catch(() => null)
        // También en el calendario con ¿Cuándo? (allí la lista va por días,
        // pero el número es el de la app: lo que sale con esos filtros).
        : await rpc('public_explore', { ...argsExplore, p_filters: { ...filtros, ...(when ? { when } : {}) }, p_limit: 1, p_offset: 0 }, H)
          .then((r) => (typeof r?.total === 'number' ? r.total : null)).catch(() => null);
    return new Response(JSON.stringify({ total: n }), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cachePublica('public, max-age=60, s-maxage=120'), vary: deLaConexion ? 'Cookie, CF-Connecting-IP' : 'Cookie', 'x-robots-tag': 'noindex' },
    });
  }

  // Con una búsqueda, arriba los negocios que encajan (como la búsqueda de la
  // app: «Negocios» y «Ofertas y eventos»).
  const conNegociosArriba = !descubre && !negocios && !mapa && !calendario && Boolean(q) && page === 1;
  // «Según el tiempo» (encendido de serie): solo en la lista (en el mapa y el
  // calendario el orden no cuenta) y si se sabe dónde se mira. Con lluvia o
  // buen tiempo, la base pone primero lo de hoy que encaja; no quita nada.
  const enLista = !negocios && !mapa && !calendario;
  const tiempoP = !tiempoOff && enLista && recomendado ? tiempoDeHoy(dondeTiempo({ cerca, lat, lng, city })) : Promise.resolve(null);
  // Las ciudades de Klendar (`ciudadesP`, arriba): de cuál es una búsqueda y,
  // para «Dónde ver el partido», el punto desde el que se cuentan los bares.
  const [res, cities, cats, cols, sitios, tiempo, todasCats, klendarCities, seccionPartidos, seccionArtistas] = await Promise.all([
    negocios
      ? rpc('public_places', {
        ...argsSitios(centroCiudad),
        p_limit: POR_PAGINA, p_offset: sitiosMapa ? 0 : (page - 1) * POR_PAGINA,
      // Si la base aún no la tiene (o no contesta), la pantalla vacía con sus
      // salidas en vez de un error.
      }, H).catch(() => ({ items: [], total: 0 }))
      : calendario
        ? todas(argsExplore, 240, H).then((items) => ({ items, total: items.length }))
        : tiempoP.then((w) => rpc('public_explore', {
          ...argsExplore, p_filters: w ? { ...filtros, weather: w } : filtros,
          p_limit: mapa ? 60 : POR_PAGINA, p_offset: mapa ? 0 : (page - 1) * POR_PAGINA,
        }, H)),
    rpcAll('public_cities', {}),
    rpcAll('public_categories', { p_city: cerca ? null : city || null }),
    rpcAll('public_collections', { p_city: cerca ? null : city || null }),
    conNegociosArriba
      ? rpc('public_businesses', { p_city: cerca ? null : city || null, p_category: cat || null, p_q: q, p_limit: 4, p_offset: 0, p_open_now: abierto }, H).catch(() => null)
      : null,
    tiempoP,
    // Todas las categorías, en el orden de la app, con su grupo si la base lo
    // tiene (`select=*`: sin la migración 20261114100000, el grupo sale del
    // slug). Si no llegan, las que tienen algo publicado.
    rows('categories', 'select=*&order=position.asc').catch(() => []),
    ciudadesP,
    // Con una búsqueda: «Dónde ver el partido», como mucho 3 partidos que
    // pone algún bar cerca (como la búsqueda de la app). Es un extra.
    conNegociosArriba
      ? ciudadesP.then((ck) => partidosEnBusqueda({ q, lang, origen: origenDeZona(e, ck), zona: zonaDeExplorar(e, lang), zonaBase: zonaBaseDeExplorar(e) })).catch(() => '')
      : '',
    // Y «Artistas»: los que encajan, cada uno a su página (como la app).
    conNegociosArriba ? artistasEnBusqueda({ q, lang }).catch(() => '') : '',
  ]);
  const catsHoja = (todasCats || []).length ? todasCats : (cats || []);
  const items = res?.items || [];
  // Las tarjetas de negocio llevan su rango de precio.
  await conPrecios([...(sitios?.items || [])]);
  const total = res?.total || 0;
  // «¿Tienes 18 años o más?» (Iván, 2026-10-27): sin contestar y con la
  // pregunta encendida, solo donde de verdad hay algo +18 que no se ve (lo
  // menos molesto: una línea, sin tapar nada, y nada si no hace falta).
  const ocultos18 = !edad && page === 1 && !mapa && !sitiosMapa && !calendario && (await preguntaEdadEncendida())
    ? await (negocios
      ? rpc('public_places', { ...argsSitios(centroCiudad), p_limit: 1, p_offset: 0 }, cabeceraEdad('1'))
      : rpc('public_explore', { ...argsExplore, p_limit: 1, p_offset: 0 }, cabeceraEdad('1')))
      .then((r) => Math.max(0, (Number(r?.total) || 0) - total)).catch(() => 0)
    : 0;
  let paginas = mapa || calendario || sitiosMapa ? 1 : Math.max(1, Math.min(50, Math.ceil(total / POR_PAGINA)));

  // El mes y el día del calendario, dentro de lo que se puede mirar (este mes
  // y los once siguientes).
  const hoyMes = hoy.slice(0, 7);
  let mes = /^\d{4}-\d{2}$/.test(mesPedido) && mesPedido >= hoyMes && mesPedido <= sumaMes(hoyMes, MESES_CAL) ? mesPedido
    : /^\d{4}-\d{2}-\d{2}$/.test(diaPedido) && diaPedido >= hoy ? diaPedido.slice(0, 7) : hoyMes;
  let dia = /^\d{4}-\d{2}-\d{2}$/.test(diaPedido) && diaPedido.startsWith(mes) && diaPedido >= hoy ? diaPedido : '';
  // «¿Cuándo?» en el calendario (como la app): marca los días que cuentan y
  // abre en el primero.
  const diasCuando = calendario ? diasDeCuando(when, hoy) : null;
  if (calendario && !dia && diasCuando && !/^\d{4}-\d{2}$/.test(mesPedido)) {
    dia = diasCuando[0];
    mes = dia.slice(0, 7);
  }
  if (calendario && !dia) {
    if (hoy.startsWith(mes)) dia = hoy;
    else {
      const conAlgo = items.map((o) => KZ.dia(o.starts_at, KZ.de(o))).filter((d) => d.startsWith(mes)).sort();
      dia = conAlgo[0] || `${mes}-01`;
    }
  }

  // El calendario: la lista del día elegido, por partes (24 de cada vez,
  // `?p=`), en vez de sacarla de las 240 del mes.
  const diaParte = calendario && dia && (!diasCuando || diasCuando.includes(dia))
    ? await rpc('public_explore', {
      // «Por hora» (de serie) o «Más cerca», con tu posición o la ciudad.
      ...argsExplore, p_filters: { ...filtros, day: dia, sort: sort === 'nearest' && (cerca || centroCiudad) ? 'nearest' : 'soonest' },
      p_limit: POR_PAGINA, p_offset: (page - 1) * POR_PAGINA,
    }, H).catch(() => null)
    : null;
  if (diaParte) paginas = Math.max(1, Math.min(50, Math.ceil((Number(diaParte.total) || 0) / POR_PAGINA)));

  // Última página de la lista: el final, con «Quizá te interese» de fuera de
  // lo que se está mirando (más lejos que la distancia o en otras ciudades).
  const lista = !negocios && !mapa && !calendario;
  const alFinal = lista && items.length > 0 && page >= paginas;
  // Sin nada desde el principio: la pantalla vacía, con las mismas salidas.
  const vacio = !calendario && items.length === 0;
  // Lo que deja fuera publicaciones (`hasNarrowingFilters` en la app): la
  // zona y la distancia se dicen aparte y el orden no quita nada.
  const conFiltrosSinPalabra = Boolean(catsSel.length || kind || price || when || soloDescuento || abierto || e.amigos || traits.length
    || traitsMarcas(e).length || antesCierre || e.menuDia || e.comerAhora || e.momento);
  const conFiltros = Boolean(q) || conFiltrosSinPalabra;
  // «Cerca de ti» y nada: ¿es que aquí aún no hay Klendar? (`klendar_coverage`,
  // ningún negocio a 25 km). Entonces, «Avísame cuando llegue» en vez del
  // vacío de siempre. Si no contesta, el vacío de siempre.
  const cobertura = vacio && cerca && !negocios
    ? await rpc('klendar_coverage', { p_lat: lat, p_lng: lng }).catch(() => null) : null;
  const sinKlendar = Boolean(cobertura?.status) && cobertura.status !== 'live';
  let sugerencias = [];
  // «Quizá te interese» respeta el tipo elegido (como la app): con «Ofertas
  // flash», solo ofertas flash; con «Eventos», solo eventos.
  const delTipo = (o) => (esOfertas ? o.kind === 'flash_offer' : esEventos ? o.kind === 'future_event' : true);
  if (sinKlendar) {
    // Nada de «Quizá te interese»: sería de otra ciudad.
  } else if (negocios) {
    // Sitios tiene su propio final.
  } else if ((alFinal || vacio) && (cerca || city)) {
    const vistos = new Set(items.map((o) => o.id));
    // Son un extra: si no llegan, la página sale igual (sin ellas).
    const fuera = await (cerca
      ? rpcAll('recommended_offers', {
        p_lat: lat, p_lng: lng, p_min_distance_m: km * 1000, p_limit: kind ? 30 : 8,
        ...(gustos.length ? { p_categories: (todasCats || []).filter((c) => gustos.includes(c.slug)).map((c) => c.id) } : {}),
      })
      : rpc('public_explore', { p_city: null, p_limit: 24, p_filters: {} }).then((r) => (r?.items || [])
        .filter((o) => String(o.city || '').toLowerCase() !== city.toLowerCase()))).catch(() => []);
    sugerencias = (fuera || []).filter((o) => !vistos.has(o.id) && delTipo(o)).slice(0, 4);
  } else if (vacio && conFiltros) {
    // En todas las ciudades y sin ubicación: lo que hay sin esos filtros.
    const todo = await rpc('public_explore', { p_city: null, p_limit: kind ? 24 : 8, p_filters: {} }).catch(() => null);
    sugerencias = (todo?.items || []).filter(delTipo).slice(0, 4);
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
  // «Según el tiempo» se queda como estaba: no quita nada, solo ordena.
  const limpia = `${base}/${tiempoOff ? `?${CLAVES[en ? 'en' : 'es'].weather}=0` : ''}`;

  // ── La barra de filtros: la de la app (opción A, 2026-10-26) ──
  // ☰ (lo demás, con su número) · ¿Dónde? · ¿Cuándo? · ¿Qué? · el orden. Cada
  // pregunta dice lo que lleva puesto («Esta noche», «Bares, Música»): ya no
  // hay chips sueltos de atajos con ×; se quitan en su pregunta.
  // Una opción de un desplegable (enlace).
  const opcion = (href, label, on, icono = '', ayuda = '') => `<a class="op${on ? ' on' : ''}${ayuda ? ' op-h' : ''}" href="${esc(href)}"${on ? ' aria-current="true"' : ''}>${icono}${ayuda ? `<span><span class="op-t">${esc(label)}</span><small>${esc(ayuda)}</small></span>` : esc(label)}</a>`;
  const desplegable = (icono, titulo, valor, activo, opciones, { cls = '', etiqueta = '' } = {}) => `<details class="desplegable${cls}">
      <summary class="chip${activo ? ' on' : ''}"${etiqueta ? ` aria-label="${esc(etiqueta)}"` : ''}>${icono ? ic(icono, 16) : ''}<span class="chip-t">${esc(valor || titulo)}</span>${ic('abajo', 16)}</summary>
      <div class="menu-d" role="group" aria-label="${esc(titulo)}"><p class="menu-d-t" aria-hidden="true">${esc(titulo)}</p>${opciones}</div>
    </details>`;

  const ciudades = cities.filter((c) => c.city).slice(0, 20);
  // La ciudad de Klendar de lo que se mira (para «Lo más buscado»): la que
  // hay donde estás (a menos de 30 km de su centro) o la elegida.
  const plano = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const ciudadK = (() => {
    const lista = klendarCities || [];
    if (cerca) {
      const rad = (d) => (d * Math.PI) / 180;
      const dist = (c) => 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin(rad(c.lat - lat) / 2) ** 2
        + Math.cos(rad(lat)) * Math.cos(rad(c.lat)) * Math.sin(rad(c.lng - lng) / 2) ** 2)));
      return lista.map((c) => ({ c, d: dist(c) })).filter((x) => x.d <= 30).sort((a, b) => a.d - b.d)[0]?.c || null;
    }
    return city ? lista.find((c) => c.id === plano(city) || plano(c.name) === plano(city)) || null : null;
  })();
  // Pedir la ubicación y volver con ella (más lo de `data-mas`): /assets/tarjetas.js.
  const botonCerca = (txt, mas = '', cls = 'op', icono = 'cerca') => `<button type="button" class="${cls}" data-cerca${mas ? ` data-mas="${esc(mas)}"` : ''} data-err="${esc(S.nearNo)}" hidden>${icono ? ic(icono, 16) : ''}<span>${esc(txt)}</span></button>`;
  const K = CLAVES[en ? 'en' : 'es'];
  const M = KM.t(lang);
  const radio = (name, value, label, on, cls = '') => `<label class="op-r${cls ? ` ${cls}` : ''}"><input type="radio" name="${name}" value="${esc(value)}"${on ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  const casilla = (name, label, on) => `<label class="op-r"><input type="checkbox" name="${name}" value="1"${on ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  const enMapa = mapa || sitiosMapa;

  // «Ahora, a un paseo» (antes «Estoy aquí»): 1 km, las próximas 2 horas y
  // lo más cerca primero. Es un atajo de ¿Cuándo?.
  const aquiOn = cerca && when === 'now' && km === 1 && sort === 'nearest';
  const quitaAqui = link({ when: '', km: RADIO_KM, sort: '' });
  const masAqui = `${K.when}=${enIdioma('now', en)}&km=1&${K.sort}=${enIdioma('nearest', en)}`;

  // ── ¿Dónde?: «Cerca de mí» (con la distancia dentro) o «Una ciudad» (toda
  // la ciudad, sin distancia, o «Todas las ciudades»). El mismo texto en
  // todas las vistas, también en el mapa (Iván, 2026-10-28: la fila es
  // idéntica en Descubre y en Explorar; que en el mapa manda lo que se ve lo
  // dice la hoja).
  const zonaValor = cerca ? (e.aprox ? S.approx : S.nearOn) : city ? PRETTY(city) : S.allCities;
  const zonaTxt = cerca ? `${zonaValor} · ${km} km` : zonaValor;
  const kmOp = (k) => {
    const txt = k === 1 ? S.walk1 : `${k} km`;
    return cerca
      ? `<a class="op-km${km === k ? ' on' : ''}" href="${esc(link({ km: k }))}"${km === k ? ' aria-current="true"' : ''}>${esc(txt)}</a>`
      : `<button type="button" class="op-km" data-cerca data-mas="km=${k}" data-err="${esc(S.nearNo)}" hidden>${esc(txt)}</button>`;
  };
  // ¿Dónde?, como las otras hojas (Iván, 2026-10-28): título, ✕ y el velo
  // detrás (en el escritorio, centrada; en el móvil, desde abajo). Sus
  // opciones son enlaces: cada una ya lleva a su página, sin «Ver N» abajo.
  // El botón de la fila es el mismo de siempre (no cambia la fila).
  const hojaDonde = (icono, titulo, valor, cuerpo, { etiqueta = '' } = {}) => `<details class="hoja zona" id="zona">
      <summary class="chip"${etiqueta ? ` aria-label="${esc(etiqueta)}"` : ''}>${icono ? ic(icono, 16) : ''}<span class="chip-t">${esc(valor || titulo)}</span>${ic('abajo', 16)}</summary>
      <div class="hoja-cuerpo" role="dialog" aria-labelledby="zonaTitulo">
        <div class="hoja-cab"><h2 id="zonaTitulo">${esc(titulo)}</h2>
          <a class="hoja-x" href="#zona" data-cerrar-hoja aria-label="${esc(S.close)}">${ic('x', 22)}</a></div>
        <div class="hoja-scroll hoja-donde">${cuerpo}</div>
      </div>
    </details>`;
  const zonaMenu = hojaDonde(cerca ? 'cerca' : city ? 'ciudad' : 'lugar', S.whereTitle, zonaTxt,
    `<div class="donde-modos" role="group" aria-label="${esc(S.whereTitle)}">
       <button type="button" class="donde-modo${cerca ? ' on' : ''}" data-donde-modo="cerca" aria-pressed="${cerca}" hidden>${ic('cerca', 16)}<span>${esc(S.nearMe)}</span></button>
       <button type="button" class="donde-modo${cerca ? '' : ' on'}" data-donde-modo="ciudad" aria-pressed="${!cerca}" hidden>${ic('ciudad', 16)}<span>${esc(S.aCity)}</span></button>
     </div>
     <div class="donde-sec" data-donde-sec="cerca">
       ${cerca && !e.aprox ? '' : `${botonCerca(S.useLoc, '', 'op')}<p class="menu-nota">${esc(S.useLocHint)}</p>`}
       <p class="menu-d-t">${esc(S.howFar)}</p>
       <div class="menu-km" role="group" aria-label="${esc(S.howFar)}">${RADIOS_KM.map(kmOp).join('')}</div>
       ${enMapa ? `<p class="menu-nota">${esc(S.mapNoKm)}</p>` : ''}
     </div>
     <div class="donde-sec" data-donde-sec="ciudad">
       <p class="menu-d-t">${esc(S.aCity)}</p>
       <p class="menu-nota">${esc(S.wholeCity)}</p>
       ${opcion(link({ city: '', cerca: false, aprox: false, todas: true }), S.allCities, !city && !cerca)}
       ${ciudades.map((c) => opcion(link({ city: String(c.city), cerca: false }), PRETTY(c.city), !cerca && city.toLowerCase() === String(c.city).toLowerCase())).join('')}
     </div>`,
    { etiqueta: `${S.zoneChange}: ${zonaTxt}` })
    // Por debajo de 400 px, con «Cerca de ti», solo «5 km» (el icono ya dice
    // «cerca») y «Todas» en vez de «Todas las ciudades», como la app: así
    // caben ¿Dónde?, ¿Cuándo?, ¿Qué? y ☰ en un móvil de 360, y lo que se
    // acorta es el dónde, no «Todo».
    .replace(`<span class="chip-t">${esc(zonaTxt)}</span>`, cerca
      ? `<span class="chip-t"><span class="zona-larga">${esc(zonaValor)} · </span>${km} km</span>`
      : !city
        ? `<span class="chip-t"><span class="zona-larga">${esc(zonaTxt)}</span><span class="zona-corta">${esc(S.allCitiesShort)}</span></span>`
        : `<span class="chip-t">${esc(zonaTxt)}</span>`);

  // Los campos ocultos de una hoja: todo lo de la dirección menos lo que esa
  // hoja elige (`propias`) y la página. `pasa(k, v)`: lo que, aun siendo de
  // esa clave, no está en esta hoja y hay que conservar.
  const estadoUrl = [...new URLSearchParams(query({ ...e, vista, page: 1, mes: calendario ? mes : '', dia: calendario ? dia : '' }, lang))];
  const ocultosMenos = (propias, pasa = () => false) => estadoUrl
    .filter(([k, v]) => k !== 'p' && (!propias.has(k) || pasa(k, v)))
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}"${k === 'amigos' ? ' data-amigos-oculto' : ''}>`).join('');
  // «Ver N resultados»: el número de lo que ya se ve; con JavaScript, se
  // vuelve a contar al cambiar algo (en el mapa, sin número).
  const conNumero = !enMapa;
  const verTxt = !conNumero ? S.showResults : total > 100 ? S.showMany(100) : S.showN(total);
  const pie = `<div class="hoja-pie">
        <button class="pill accent" type="submit"${conNumero ? ` data-ver-n data-uno="${esc(S.showN(1))}" data-varios="${esc(S.showN(2)).replace('2', '{n}')}" data-muchos="${esc(S.showMany(100))}" data-sin="${esc(S.showResults)}" aria-live="polite"` : ''}>${esc(verTxt)}</button>
      </div>`;
  // Una hoja: un formulario GET (va sin JavaScript) que se abre desde su
  // botón de la fila. «Quitar» / «Restablecer» deja lo suyo de serie sin
  // cerrarla (/assets/tarjetas.js; sin JavaScript, un enlace).
  const hojaDe = ({ id, summary, titulo, reset, resetTxt, ocultos, cuerpo }) => `<details class="hoja" id="${id}">
    ${summary}
    <form class="hoja-cuerpo" method="get" action="${base}/" role="dialog" aria-labelledby="${id}Titulo">
      <div class="hoja-cab"><h2 id="${id}Titulo">${esc(titulo)}</h2>
        <a class="hoja-reset" href="${esc(reset)}" data-restablecer>${esc(resetTxt)}</a>
        <a class="hoja-x" href="#${id}" data-cerrar-hoja aria-label="${esc(S.close)}">${ic('x', 22)}</a></div>
      ${ocultos}
      <div class="hoja-scroll">${cuerpo}</div>
      ${pie}
    </form>
  </details>`;
  const chipHoja = (icono, txt, on, etiqueta, cls = '') => `<summary class="chip${cls}${on ? ' on' : ''}" aria-label="${esc(etiqueta)}">${ic(icono, 16)}<span class="chip-t">${esc(txt)}</span>${ic('abajo', 16)}</summary>`;

  // ── ¿Cuándo?: atajos, «El plan es…», «El sitio, ahora» y el momento del
  // día (todos los «ahora» juntos). En Sitios, solo lo del sitio.
  const nombreCuando = { now: S.now, today: S.today, tonight: S.tonight, tomorrow: S.tomorrow, weekend: S.weekend, next10: S.next10 };
  const partesCuando = aquiOn ? [S.walkNow] : [
    !negocios && when ? nombreCuando[when] : '',
    abierto ? S.openNow : '', comerAhora ? S.eatNow : '',
    e.momento ? KMO.etiquetaFiltro(e.momento, lang) : '',
  ].filter(Boolean);
  const atajo = (href, txt, on, icono) => `<a class="atajo${on ? ' on' : ''}" href="${esc(href)}"${on ? ' aria-current="true"' : ''}>${icono.startsWith('<') ? icono : ic(icono, 16)}<span>${esc(txt)}</span></a>`;
  const atajosCuando = negocios ? '' : `<fieldset class="hoja-atajos"><legend>${esc(S.shortcuts)}</legend><div class="ops">
        ${aquiOn ? atajo(quitaAqui, S.walkNow, true, 'aqui') : cerca ? atajo(link({ when: 'now', km: 1, sort: 'nearest' }), S.walkNow, false, 'aqui') : botonCerca(S.walkNow, masAqui, 'atajo', 'aqui')}
        ${atajo(link({ when: when === 'tonight' ? '' : 'tonight' }), S.tonight, when === 'tonight', 'reloj')}
        ${atajo(link({ when: when === 'weekend' ? '' : 'weekend' }), S.weekend, when === 'weekend', 'cal')}
      </div><p class="hoja-nota hoja-nota-bajo">${esc(S.walkNow)}: ${esc(S.walkNowHint)}</p></fieldset>`;
  const hojaCuando = hojaDe({
    id: 'cuando',
    // El botón dice siempre lo que vale («Cuando sea», «Esta noche»), nunca la
    // pregunta (Iván, 2026-10-27); el lector, «Cuándo: Cuando sea».
    summary: chipHoja('reloj', partesCuando.join(', ') || S.anytime, partesCuando.length > 0,
      `${S.whenQ}: ${partesCuando.join(', ') || S.anytime}`),
    titulo: S.when, resetTxt: S.clearQ,
    reset: link({ when: '', abierto: false, comerAhora: false, momento: '', ...(aquiOn ? { km: RADIO_KM, sort: '' } : {}) }),
    // En el calendario, al cambiar «¿Cuándo?» se abre en el primer día que cuenta.
    // En Sitios no está «El plan es…»: el «¿Cuándo?» de Planes pasa de largo
    // (al volver a Planes sigue ahí, como el resto de lo de Planes).
    ocultos: ocultosMenos(new Set([...(negocios ? [] : [K.when]), K.open, K.eat, K.moment, K.month, K.day])),
    cuerpo: `${atajosCuando}
      ${negocios ? '' : `<fieldset><legend>${esc(S.planIs)}</legend><div class="ops">
        ${[['', S.anytime], ['now', S.now], ['today', S.today], ['tonight', S.tonight], ['tomorrow', S.tomorrow], ['weekend', S.weekend], ['next10', S.next10]]
          .map(([v, n]) => radio(K.when, v ? enIdioma(v, en) : '', n, when === v)).join('')}
      </div></fieldset>`}
      <fieldset class="hoja-casillas"><legend>${esc(S.placeNow)}</legend><div class="ops">
        ${casilla(K.open, S.openNow, abierto)}
        ${casilla(K.eat, S.eatNow, e.comerAhora)}
      </div><p class="hoja-nota hoja-nota-bajo">${esc(S.openNow)}: ${esc(minus(S.openNowHint))}.</p>
      <p class="hoja-nota hoja-nota-bajo">${esc(S.eatNow)}: ${esc(minus(S.eatNowHint))}.</p></fieldset>
      <fieldset><legend>${esc(S.moment)}</legend><div class="ops">
        ${radio(K.moment, '', M.fAny, !e.momento)}
        ${['now', ...KMO.MOMENTOS.map((m) => m.id)].map((m) => radio(K.moment, KMO.aUrl(m, en), KMO.etiquetaFiltro(m, lang), e.momento === m)).join('')}
      </div><p class="hoja-nota hoja-nota-bajo">${esc(S.momentHint)}</p></fieldset>`,
  });

  // ── ¿Qué?: el tipo, «Menú del día» y «Antes de cerrar», y las categorías
  // (varias). En Sitios, las categorías y «Menú del día».
  const porSlug = new Map(catsHoja.map((c) => [c.slug, c]));
  const nombreCat = (slug) => { const c = porSlug.get(slug) || (cats || []).find((x) => x.slug === slug); return c ? catName(c, en) : slug; };
  const partesQue = [
    !negocios && esOfertas ? S.offers : '', !negocios && esEventos ? S.events : '',
    e.menuDia ? S.dailyMenu : '', !negocios && antesCierre ? S.beforeClosing : '',
    ...catsSel.map(nombreCat),
  ].filter(Boolean);
  // Las categorías, todas a la vista: una cuadrícula de iconos grandes con su
  // nombre, por los cinco grupos del selector único (Comer y beber · Noche,
  // música y cultura · Ocio, deporte y familia · Belleza y salud · Tiendas y
  // servicios), varias a la vez (Iván, 2026-10-27, como la app). Sin
  // JavaScript, casillas de un formulario GET, como siempre.
  const celdaCat = (c) => `<label class="cat-celda"><input type="checkbox" name="${K.cat}" value="${esc(c.slug)}"${catsSel.includes(c.slug) ? ' checked' : ''}>
        <span class="cat-celda-c">${icCat(c.slug, 28)}<span class="cat-celda-t">${esc(catName(c, en))}</span></span></label>`;
  const catsHtml = catsHoja.length ? `<h3 class="hoja-cats-t">${esc(S.categories)}</h3>
    ${KC.agrupa(catsHoja, '').filter((g) => g.cats.length).map((g) => `<fieldset class="hoja-cats-grupo">
      <legend>${esc(KC.nombreGrupo(g.id, lang))}</legend>
      <div class="cat-rejilla">${g.cats.map(celdaCat).join('')}</div>
    </fieldset>`).join('')}` : '';
  const hojaQue = hojaDe({
    id: 'que-hoja',
    // «Todo» o lo elegido («Bares, Música»); el lector, «Qué: Todo».
    summary: chipHoja('tipo', partesQue.join(', ') || S.all, partesQue.length > 0,
      `${S.whatQ}: ${partesQue.join(', ') || S.all}`),
    titulo: S.whatTitle, resetTxt: S.clearQ,
    reset: link({ kind: '', menuDia: false, antesCierre: false, cat: '', cats: [] }),
    ocultos: ocultosMenos(new Set([K.kind, K.menu, K.closing, K.cat])),
    cuerpo: `${negocios ? '' : `<fieldset><legend>${esc(S.type)}</legend><div class="ops">
        ${radio(K.kind, '', S.all, !kind)}
        ${radio(K.kind, enIdioma('offers', en), S.offers, esOfertas)}
        ${radio(K.kind, enIdioma('events', en), S.events, esEventos)}
      </div><p class="hoja-nota hoja-nota-bajo">${esc(S.whatHint)}</p></fieldset>`}
      <fieldset class="hoja-casillas"><legend>${esc(S.forEating)}</legend><div class="ops">
        ${casilla(K.menu, S.dailyMenu, e.menuDia)}
        ${negocios ? '' : casilla(K.closing, S.beforeClosing, antesCierre)}
      </div><p class="hoja-nota hoja-nota-bajo">${esc(S.dailyMenu)}: ${esc(minus(S.dailyMenuHint))}</p>
      ${negocios ? '' : `<p class="hoja-nota hoja-nota-bajo">${esc(S.beforeClosing)}: ${esc(minus(S.beforeClosingHint))}</p>`}</fieldset>
      ${catsHtml}`,
  });

  // ── Filtros (☰): lo demás, plegado y por orden de uso, cada bloque con
  // cuántos lleva: Precio del plan · Para quién · Cómo es el sitio (con el
  // precio del local) · Alérgenos y dietas · Más. En Sitios, «Cómo es el
  // sitio» y «Alérgenos y dietas». ☰ (N) cuenta solo lo de aquí.
  const ninosOn = traits.includes('kids');
  const atributos = sitioSinNinos(e).filter((t) => !esDieta(t));
  const dietas = sitioSinNinos(e).filter((t) => esDieta(t));
  const nPrecio = !negocios && price ? 1 : 0;
  const nParaQuien = negocios ? 0 : [ninosOn, e.solo, e.carne, e.amigos].filter(Boolean).length;
  const nComo = (e.precioLocal ? 1 : 0) + atributos.length;
  const nDietas = dietas.length;
  const nMas = negocios ? 0 : [e.solidario, e.entidad, soloDescuento].filter(Boolean).length;
  // El orden va dentro de ☰, arriba (Iván, 2026-10-27): en Descubre y en la
  // lista de Planes. En el calendario y en Sitios, en la cabecera de su lista;
  // en el mapa, ninguno. ☰ lo cuenta si no es el de serie.
  const conOrden = !negocios && !mapa && !calendario;
  const nOrden = conOrden && !recomendado ? 1 : 0;
  const nFiltros = nPrecio + nParaQuien + nComo + nDietas + nMas + nOrden;
  const ordenNombre = { recommended: S.sortRec, nearest: S.sortNearest, soonest: S.sortSoonest, newest: S.sortNewest };
  const resumen = [nOrden ? `${S.sortBy}: ${ordenNombre[ordenBase]}` : '', resumenFiltros(e, S)].filter(Boolean).join(' · ');
  // Un bloque plegado: «Para quién · 1», con su ayuda; abierto si lleva algo.
  // El número lo pone al día /assets/tarjetas.js al marcar.
  const bloque = (id, titulo, ayuda, n, cuerpo, abierto = false) => `<details class="hoja-bloque" data-bloque="${id}"${n || abierto ? ' open' : ''}>
      <summary><span class="hoja-bloque-t"><h3 id="bloque-${id}">${esc(titulo)}<span class="hoja-bloque-n" data-bloque-n${n ? '' : ' hidden'}> · ${n}</span></h3><small>${esc(ayuda)}</small></span>${ic('abajo', 20)}</summary>
      <div class="hoja-bloque-c" role="group" aria-labelledby="bloque-${id}">${cuerpo}</div>
    </details>`;
  const precioBloque = negocios ? '' : bloque('precio', S.pricePlan, S.pricePlanHint, nPrecio, `
      <fieldset><legend class="sr">${esc(S.pricePlan)}</legend><div class="ops">
        ${radio(K.price, '', S.any, !price)}
        ${radio(K.price, enIdioma('free', en), S.free, price === 'free')}
        ${['10', '25', '50'].map((n) => radio(K.price, n, S.upTo(n), price === n)).join('')}
      </div></fieldset>`, true);
  // Para quién: Con niños (y la edad), Ideal para ir solo, Descuentos para y,
  // con sesión, «Van mis amigos» (lo pone /assets/amigos.js en su hueco).
  const paraQuien = negocios ? '' : bloque('para-quien', S.forWhom, S.forWhomHint, nParaQuien, `
      <fieldset class="hoja-casillas"><legend class="sr">${esc(S.withKids)}</legend><div class="ops">
        <label class="op-r op-sitio"><input type="checkbox" name="${K.place}" value="${esc(sitioAUrl('kids', en))}" data-ninos${ninosOn ? ' checked' : ''}><span>${icSitio('kids', 18)}${esc(S.withKids)}</span></label>
      </div><p class="hoja-nota hoja-nota-bajo">${esc(S.withKidsHint)}</p></fieldset>
      <fieldset class="hoja-edades" data-con-ninos${ninosOn ? '' : ' hidden'}><legend>${esc(M.fKidAges)}</legend><div class="ops">
        ${KM.KID_AGES.map(([id, r]) => `<label class="op-r"><input type="checkbox" name="${K.age}" value="${esc(edadAUrl(id))}" data-no-cuenta${e.edades.includes(id) ? ' checked' : ''}><span>${esc(M.kidAge(r))}</span></label>`).join('')}
      </div><p class="hoja-nota hoja-nota-bajo">${esc(M.fKidAgesHint)}</p></fieldset>
      <fieldset class="hoja-casillas"><legend class="sr">${esc(M.solo)}</legend><div class="ops">
        ${casilla(K.solo, M.solo, e.solo)}
        <span data-amigos-hoja hidden></span>
      </div></fieldset>
      <fieldset><legend>${esc(M.fCards)}</legend><div class="ops">
        ${radio(K.card, '', M.fCardsAny, !e.carne)}
        ${KM.CARDS.map((c) => radio(K.card, carneAUrl(c, en), M.cardFor[c], e.carne === c)).join('')}
      </div></fieldset>`);
  // Una casilla de «Cómo es el sitio» o de «Alérgenos y dietas» (con su icono).
  const opSitio = (x) => `<label class="op-r op-sitio"><input type="checkbox" name="${K.place}" value="${esc(sitioAUrl(x.id, en))}"${traits.includes(x.id) ? ' checked' : ''}><span>${icSitio(x.id, 18)}${esc(en ? x.en : x.es)}</span></label>`;
  // Cómo es el sitio: el precio del local y lo que es (los atributos menos
  // «Apto para niños», que es «Con niños»; tienen que cumplirse todos).
  const comoBloque = bloque('sitio', S.placeLike, S.placeLikeHint, nComo, `
      <fieldset><legend>${esc(M.fPriceLevel)}</legend><div class="ops">
        ${radio(K.vprice, '', M.fAny, !e.precioLocal)}
        ${KM.PRECIOS.map((l) => radio(K.vprice, String(l), l === 1 ? '€' : M.fUpTo('€'.repeat(l)), e.precioLocal === l)).join('')}
      </div><p class="hoja-nota hoja-nota-bajo">${esc(M.fPriceHint)}</p></fieldset>
      <fieldset class="hoja-sitio"><legend>${esc(S.placeAttrs)}</legend><div class="ops">
        ${SITIO.filter((x) => x.id !== 'kids' && !esDieta(x.id)).map(opSitio).join('')}
      </div></fieldset>`, negocios);
  const dietasBloque = bloque('dietas', S.diets, S.dietsBHint, nDietas, `
      <fieldset class="hoja-sitio hoja-dietas"><legend class="sr">${esc(S.diets)}</legend><div class="ops">
        ${SITIO.filter((x) => esDieta(x.id)).map(opSitio).join('')}
      </div><p class="hoja-nota hoja-nota-bajo">${esc(S.dietsHint)}</p></fieldset>`);
  // Más: Solidario, Agenda pública y Solo con descuento.
  const masBloque = negocios ? '' : bloque('mas', S.moreB, S.moreBHint, nMas, `
      <fieldset class="hoja-casillas"><legend class="sr">${esc(S.moreB)}</legend><div class="ops">
        ${casilla(K.charity, M.charity, e.solidario)}
        ${casilla(K.entity, M.entity, e.entidad)}
        ${casilla(K.discount, S.discount, soloDescuento)}
      </div><p class="hoja-nota hoja-nota-bajo">${esc(M.charity)}: ${esc(M.charityHint)}</p>
      <p class="hoja-nota hoja-nota-bajo">${esc(M.entity)}: ${esc(M.entityHint)}</p></fieldset>`);
  // «Restablecer»: lo de esta hoja de serie. El dónde, el cuándo, el qué, el
  // orden y sus casillas se quedan como estén. En Sitios, «Con niños» (que es
  // de Planes) también se queda.
  const ninosUrl = sitioAUrl('kids', en);
  const restablecer = link({ price: negocios ? price : '', soloDescuento: negocios ? soloDescuento : false, traits: negocios && ninosOn ? ['kids'] : [], edades: negocios ? e.edades : [],
    precioLocal: 0, carne: negocios ? e.carne : '', solo: negocios ? e.solo : false, solidario: negocios ? e.solidario : false,
    entidad: negocios ? e.entidad : false, amigos: negocios ? e.amigos : false, ...(conOrden ? { sort: '' } : {}) });
  const propiasFiltros = negocios ? new Set([K.vprice, K.place]) : new Set([K.price, K.age, K.card, K.solo, 'amigos', K.vprice, K.place, K.charity, K.entity, K.discount,
    ...(conOrden ? [K.sort, K.weather, K.notastes] : [])]);
  // «Ordenar por»: «Recomendado» (de serie) con sus dos casillas debajo
  // (encendidas de serie; «Restablecer» no las toca) y los tres sencillos.
  // Va con «Ver N resultados», como lo demás de la hoja. Las casillas van
  // seguidas de un oculto con el valor de apagado: marcada, manda los dos y
  // gana la casilla (`tiempoOff`, `sinGustos`).
  const gustosHref = `${en ? '/app/?lang=en' : '/app/'}#/gustos`;
  const radioOrden = (v, label, ayuda) => `<label class="op-orden"><input type="radio" name="${K.sort}" value="${esc(v ? enIdioma(v, en) : '')}"${(v || ORDEN_DEFECTO) === ordenBase ? ' checked' : ''}>
        <span><span class="op-t">${label}</span><small>${esc(ayuda)}</small></span></label>`;
  const ordenBloque = conOrden ? `<fieldset class="hoja-orden"><legend>${esc(S.sortBy)}</legend>
      ${radioOrden('', `${esc(S.sortRec)} <small class="op-serie">· ${esc(S.sortDefault)}</small>`, S.recLine)}
      <div class="orden-casillas">
        <label class="op-r op-casilla"><input type="checkbox" name="${K.weather}" value="1" data-no-restablecer${tiempoOff ? '' : ' checked'}><span>${esc(S.byWeather)}</span></label>
        <input type="hidden" name="${K.weather}" value="0">
        <p class="hoja-nota">${esc(S.weatherLine)} ${esc(S.weatherData)} <a href="${FUENTE_TIEMPO.url}" rel="noopener" target="_blank">${FUENTE_TIEMPO.nombre}</a></p>
        <label class="op-r op-casilla"><input type="checkbox" name="${K.notastes}" value="0" data-no-restablecer${e.sinGustos ? '' : ' checked'}><span>${esc(S.useTastes)}</span></label>
        <input type="hidden" name="${K.notastes}" value="1">
        <p class="hoja-nota"><a href="${esc(gustosHref)}">${esc(S.changeTastes)}</a></p>
      </div>
      ${radioOrden('nearest', esc(S.sortNearest), S.sortNearestHint)}
      ${radioOrden('soonest', esc(S.sortSoonest), S.sortSoonestHint)}
      ${radioOrden('newest', esc(S.sortNewest), S.sortNewestHint)}
    </fieldset>` : '';
  const hojaFiltros = hojaDe({
    id: 'filtros',
    summary: `<summary class="chip chip-filtros${nFiltros ? ' on' : ''}" aria-label="${esc(nFiltros ? `${S.filtersN(nFiltros)}: ${resumen.replace(/ · /g, ', ')}` : S.filters)}">${ic('tune', 18)}${nFiltros ? `<span class="n" aria-hidden="true">${nFiltros}</span>` : ''}</summary>`,
    titulo: S.filters, resetTxt: S.reset, reset: restablecer,
    // En Sitios, «Con niños» es de Planes: pasa de largo.
    ocultos: ocultosMenos(propiasFiltros, (k, v) => negocios && k === K.place && v === ninosUrl),
    cuerpo: `${ordenBloque}${precioBloque}${paraQuien}${comoBloque}${dietasBloque}${masBloque}`,
  });

  // «Más cerca» sin tu posición ni una ciudad: va por hora y lo dice
  // (`avisoCerca`), con el botón para dar la ubicación.
  const sinDondeCerca = ordenBase === 'nearest' && !cerca && !centroCiudad;
  // El orden de la lista de un día del calendario: «Por hora» o «Más cerca».
  const ordenCal = calendario ? desplegable('orden', S.sortBy, sort === 'nearest' ? S.sortNearest : S.byTime, false,
    `${opcion(link({ sort: '' }), S.byTime, sort !== 'nearest')}
     ${cerca || centroCiudad ? opcion(link({ sort: 'nearest' }), S.sortNearest, sort === 'nearest', '', S.sortNearestHint)
      : botonCerca(S.sortNearest, `${K.sort}=${enIdioma('nearest', en)}`).replace(ic('cerca', 16), '')}`,
    { cls: ' orden orden-lista', etiqueta: `${S.sortBy}: ${sort === 'nearest' ? S.sortNearest : S.byTime}` }) : '';
  // El orden de Sitios: «Más cerca» (por tramos) o «Mejor valorados».
  const ordenSitios = negocios && !sitiosMapa && (await valoradosYa) === true ? desplegable('orden', S.sortBy, sort === 'rated' ? S.rated : S.sortNearest, false,
    `${opcion(link({ sort: '' }), S.sortNearest, sort !== 'rated', '', S.placesNearHint)}
     ${opcion(link({ sort: 'rated' }), S.rated, sort === 'rated', '', S.placesRatedHint)}`,
    { cls: ' orden orden-lista', etiqueta: `${S.sortBy}: ${sort === 'rated' ? S.rated : S.sortNearest}` }) : '';

  const vistas = descubre ? '' : `<nav class="vistas" aria-label="${esc(S.view)}">
      ${(negocios ? [['', S.listView, 'lista', !sitiosMapa], ['map', S.mapView, 'mapa', sitiosMapa]]
        // Calendario delante: Lista y Mapa quedan en el mismo sitio en
        // Planes y en Sitios (sin saltos al cambiar).
        : [['calendar', S.calView, 'cal', calendario], ['', S.listView, 'lista', !mapa && !calendario], ['map', S.mapView, 'mapa', mapa]])
        .map(([v, n, i, on]) => `<a class="vista${on ? ' on' : ''}" href="${esc(link({ vista: v }))}" aria-label="${esc(n)}"${on ? ' aria-current="page"' : ''}>${ic(i, 18)}<span>${esc(n)}</span></a>`).join('')}
    </nav>`;
  // Arriba, qué se busca: «Planes | Sitios» (como la app). Al cambiar, la
  // zona, la distancia y los filtros que valen en los dos se quedan.
  const que = descubre ? '' : `<nav class="que" aria-label="${esc(TSi.what)}">
      <a href="${esc(link({ que: '', vista: e.vista === 'calendar' ? 'calendar' : '' }))}"${negocios ? '' : ' class="on" aria-current="page"'}>${esc(TSi.plans)}</a>
      <a href="${esc(link({ que: 'places', vista: e.vista === 'map' || e.vista === 'calendar' ? e.vista : '' }))}"${negocios ? ' class="on" aria-current="page"' : ''}>${esc(TSi.places)}</a>
    </nav>`;

  // Al tocar el buscador: lo que buscaste (en este navegador) y «Lo más
  // buscado en <ciudad>» (/assets/gustos.js).
  const sorteosOn = await conSorteos;
  const textosBusqueda = JSON.stringify({
    recent: S.searchRecent, clear: S.searchClear, local: S.searchLocal,
    popular: S.searchPopular, popularHint: S.searchPopularHint, remove: S.searchRemove,
    // «Dónde ver el partido» con su subtítulo, arriba del panel en reposo.
    partidos: { t: KE.t(lang).title, s: KE.t(lang).lead, href: `${partidosBase(lang)}/${zonaDeExplorar(e, lang) ? `?${zonaDeExplorar(e, lang)}` : ''}` },
    // «Grupos y empresas» y «Sorteos» (tanda C), detrás, como en la app.
    grupos: { t: KG.t(lang).title, s: KG.t(lang).sub, href: `${gruposBase(lang)}/${zonaGrupos(e, lang) ? `?${zonaGrupos(e, lang)}` : ''}` },
    ...(sorteosOn ? { sorteos: { t: KS.t(lang).title, s: KS.t(lang).sub, href: `${sorteosBase(lang)}/${zonaGrupos(e, lang) ? `?${zonaGrupos(e, lang)}` : ''}` } } : {}),
    // «Pedir un local», el cuarto, como en el buscador de la app.
    pedir: { t: S.askVenue, s: S.recommendShort, href: pedirHref(lang) },
  });
  const buscador = descubre ? '' : `<form class="buscador" role="search" method="get" action="${base}/" data-busqueda
    data-ciudad="${esc(ciudadK?.id || '')}" data-ciudad-nombre="${esc(ciudadK?.name || '')}" data-textos="${esc(textosBusqueda)}">
    <label class="buscador-campo">${ic('buscar', 20)}<span class="sr">${esc(S.search)}</span>
      <input type="search" name="q" value="${esc(q)}" placeholder="${esc(S.ph)}" enterkeyhint="search"></label>
    ${new URLSearchParams(query({ ...e, q: '', page: 1, mes: calendario ? mes : '', dia: calendario ? dia : '' }, lang)).toString().split('&').filter(Boolean)
      .map((kv) => { const [k, v] = kv.split('='); return `<input type="hidden" name="${esc(decodeURIComponent(k))}" value="${esc(decodeURIComponent(v.replace(/\+/g, ' ')))}">`; }).join('')}
    <button class="pill ink" type="submit">${esc(S.search)}</button>
  </form>`;

  // La fila (opción A): ☰ · ¿Dónde? · ¿Cuándo? · ¿Qué? · el orden. Con el
  // tiempo reordenando hoy, el orden va justo detrás de ☰, a la vista.
  // «Van mis amigos» (/assets/amigos.js) pide con las mismas categorías y lo
  // mismo de «El sitio», «Para quién», «Más», ¿Qué? y el momento que esta
  // página (antes los dejaba fuera: con «Música» salía todo lo de tus amigos).
  const amigosFiltros = e.amigos ? JSON.stringify({
    traits: filtros.traits || [],
    cats: (todasCats || []).filter((c) => catsSel.includes(c.slug)).map((c) => c.id),
  }) : '';
  const barra = `<div class="barra-filtros fila-fija" id="barra"${descubre ? ' data-amigos-resultados="#feed"' : ''}${amigosFiltros ? ` data-amigos-params="${esc(amigosFiltros)}"` : ''}>
    <div class="barra-preg">
      ${zonaMenu}
      ${hojaCuando}
      ${hojaQue}
      <span data-amigos-hueco hidden></span>
    </div>
    ${hojaFiltros}
  </div>
  <p id="cercaErr" class="aviso-error" role="alert" hidden></p>
  <script src="/assets/categorias.js?v=6" defer></script>
  <script src="/assets/gustos.js?v=6" defer data-lang="${en ? 'en' : 'es'}"></script>`;

  // Los atajos (la lupa de la web): debajo del buscador, si no hay búsqueda
  // ni filtros. Cada uno pone lo que haga falta y se ve arriba, en la fila.
  const atajosFila = !descubre && !q && !conFiltros ? `<nav class="atajos-fila" aria-label="${esc(S.shortcuts)}">
    <span class="atajos-t">${esc(S.shortcuts)}</span>
    ${cerca ? atajo(link({ que: '', when: 'tonight' }), S.tonightNear, false, 'reloj') : botonCerca(S.tonightNear, `${K.when}=${enIdioma('tonight', en)}`, 'atajo', 'reloj')}
    ${atajo(link({ que: 'places', vista: '', comerAhora: true }), S.eatSoon, false, 'carta')}
    ${atajo(link({ que: '', when: 'weekend' }), S.weekend, false, 'cal')}
    ${cerca ? atajo(link({ que: '', when: 'now', km: 1, sort: 'nearest' }), S.walkNow, false, 'aqui') : botonCerca(S.walkNow, masAqui, 'atajo', 'aqui')}
    ${atajo(link({ que: '', traits: [...traits, 'kids'] }), S.withKids, false, icSitio('kids', 16))}
    ${atajo(link({ que: '', antesCierre: true }), S.beforeClosing, false, 'bolsa')}
  </nav>` : '';

  // En Explorar, sin ubicación ni ciudad: «Mira primero lo que tienes más cerca».
  // Un solo aviso a la vez (Iván, 2026-10-28): con la pregunta de la edad, la
  // ubicación espera (`data-tras-edad`, oculta) y sale al contestar «Soy
  // menor»; con «18 o más» la página vuelve a cargarse y ya sale sola.
  const trasEdad = ocultos18 ? ' data-tras-edad hidden' : '';
  const avisoCerca = sinDondeCerca
    ? `<p class="cerca-aviso" data-cerca-falta${trasEdad}>${ic('cerca', 18)}<span>${esc(S.nearNeedsWhere)}</span>
        <button type="button" class="pill ink" data-cerca data-mas="${esc(`${K.sort}=${enIdioma('nearest', en)}`)}" data-err="${esc(S.nearNo)}">${esc(S.useLoc)}</button></p>`
    : '';
  // La pregunta de la edad (ver `ocultos18`): se guarda en una cookie de un
  // año (`klendar_18`) y, con «18 o más», se vuelve a pedir la página.
  const avisoEdad = ocultos18
    ? `<div class="cerca-aviso edad-aviso" data-edad><span>${esc(S.ageHidden(ocultos18))} <strong>${esc(S.ageQ)}</strong></span>
        <button type="button" class="pill ink" data-edad-si>${esc(S.ageYes)}</button>
        <button type="button" class="pill" data-edad-no>${esc(S.ageNo)}</button></div>
  <script>(function(){var b=document.querySelector('[data-edad]');if(!b)return;function f(v){document.cookie='klendar_18='+v+'; Max-Age=31536000; Path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');if(v==='1')location.reload();else{b.remove();document.querySelectorAll('[data-tras-edad]').forEach(function(a){if(a.hasAttribute('data-cerca-aviso')&&!navigator.geolocation)return;a.hidden=false;});}}b.querySelector('[data-edad-si]').addEventListener('click',function(){f('1');});b.querySelector('[data-edad-no]').addEventListener('click',function(){f('0');});})();</script>`
    : '';
  const invitaCerca = !descubre && !cerca && !city
    ? `<p class="cerca-aviso" data-cerca-aviso${ocultos18 ? ' data-tras-edad' : ''} hidden>${ic('cerca', 18)}<span>${esc(S.nearPrompt)}</span>
        <button type="button" class="pill ink" data-cerca data-err="${esc(S.nearNo)}">${esc(S.useLoc)}</button></p>`
    : '';

  const alertaHref = `${en ? '/app/?lang=en' : '/app/'}#/alerta/nueva?${new URLSearchParams({
    origen: descubre ? 'descubre' : 'explorar',
    ...(esOfertas ? { tipo: 'flash_offer' } : esEventos ? { tipo: 'future_event' } : {}),
    ...(cat ? { cat } : {}),
    ...(price === 'free' ? { precio: '0' } : /^\d{1,3}$/.test(price) ? { precio: String(Number(price) * 100) } : {}),
    ...(soloDescuento ? { descuento: '1' } : {}),
    ...(cerca ? { radio: String(km * 1000), lat: posUrl(lat), lng: posUrl(lng) } : {}),
  })}`;
  const hayAlgo = conFiltros || cerca || Boolean(city) || Boolean(sort);
  // «Según el tiempo» ya no lleva línea encima de la lista: lo dice el chip
  // de orden («☂ Recomendado»), adelantado detrás de ☰ (como la app).
  // Con una búsqueda y ningún negocio que encaje: «¿No encuentras «X»? Pide
  // que esté en Klendar» (a «Pedir un local», con el nombre escrito). Con
  // resultados, una línea debajo de ellos; sin nada, en la pantalla vacía.
  const pedirQ = q && !descubre && (negocios ? items.length === 0 && page === 1 : conNegociosArriba && !(sitios?.items || []).length) ? q : '';
  const lineaPedir = pedirQ && !negocios && !vacio
    ? `<p class="fin-sugiere"><a href="${esc(pedirHref(lang, pedirQ))}">${esc(S.askFor(pedirQ))}</a></p>` : '';
  // «Avísame si hay algo de «karaoke»» (tanda D): al final de una búsqueda
  // y también sin resultados. Sin JavaScript (o sin sesión en este
  // navegador) lleva a «Tu cuenta», que la añade al entrar; con sesión,
  // /assets/palabras.js la añade sin salir de aquí.
  const palabra = q.trim().slice(0, 40);
  const lineaAvisame = !descubre && !negocios && !sinKlendar && palabra.replace(/[^\p{L}\p{N}]/gu, '').length >= 3
    ? `<div class="avisame-palabra" data-avisame-palabra="${esc(palabra)}" data-si="${esc(S.alertWordOn(palabra))}" data-si-hint="${esc(S.alertWordOnHint)}">
      <a href="${esc(`/app/${en ? '?lang=en' : ''}#/avisame-palabra?palabra=${encodeURIComponent(palabra)}`)}">
        ${ic('campana', 22)}<span><b>${esc(S.alertWord(palabra))}</b><small>${esc(S.alertWordHint)}</small></span></a>
    </div>
    <script src="/assets/palabras.js?v=2" defer data-lang="${en ? 'en' : 'es'}" data-url="${esc(supabasePublic().url)}" data-key="${esc(supabasePublic().key)}"></script>` : '';
  const final = sinKlendar ? sinKlendarHtml({ S, lang, lat, lng, cobertura, link })
    : alFinal || vacio ? finalHtml({
      S, en, lang, cerca, km, city, filtros: conFiltros, link, page, sugerencias, vacio, alertaHref,
      // Con una búsqueda sin nada: «Quitar filtros» solo si hay otros filtros
      // además de la palabra (la palabra se cambia en el buscador).
      limpiar: (vacio && q && !negocios && !descubre ? conFiltrosSinPalabra : hayAlgo) ? limpia : '', compacto: descubre && !vacio,
      pedirQ: vacio ? pedirQ : '', sinSugiere: Boolean(lineaPedir),
      busqueda: vacio && !negocios && !descubre ? q : '',
      enSitios: vacio && q && !negocios && !descubre ? link({ que: 'places', vista: '', page: 1 }) : '',
      agendaHref: `${exploreBase(lang)}/?${query({ ...e, que: '', q: '', vista: 'calendar', page: 1, mes: '', dia: '' }, lang)}`,
    }) : '';

  // ── Más formas de explorar: las páginas de Google, abajo y en su sitio ──
  const ciudadSeo = (cerca ? '' : city) || (ciudades.length === 1 ? String(ciudades[0].city) : '');
  const masFormas = negocios ? '' : `<section class="mas-formas" aria-labelledby="masFormas">
    <h2 id="masFormas">${esc(S.more)}</h2>
    ${ciudades.length ? `<div class="mf-fila"><h3>${esc(S.todayIn)}</h3><p>${ciudades.map((c) => `<a href="${todayBase(lang)}/${CITY(c.city)}/">${esc(PRETTY(c.city))}</a>`).join('')}</p></div>
    <div class="mf-fila"><h3>${esc(S.weekIn)}</h3><p>${ciudades.map((c) => `<a href="${agendaBase(lang)}/${CITY(c.city)}/">${esc(PRETTY(c.city))}</a>`).join('')}</p></div>
    <div class="mf-fila"><h3>${esc(S.kidsIn)}</h3><p>${ciudades.map((c) => `<a href="${kidsBase(lang)}/${CITY(c.city)}/">${esc(PRETTY(c.city))}</a>`).join('')}</p></div>` : ''}
    ${ciudadSeo && (cats || []).length ? `<div class="mf-fila"><h3>${esc(S.byCat)} · ${esc(PRETTY(ciudadSeo))}</h3><p>${(cats || []).map((c) => `<a href="${agendaBase(lang)}/${CITY(ciudadSeo)}/${encodeURIComponent(c.slug)}/">${esc(catName(c, en))}</a>`).join('')}</p></div>` : ''}
    ${cols.length ? `<div class="mf-fila"><h3>${esc(S.picks)}</h3><p>${cols.map((c) => `<a href="${collectionBase(lang)}/${encodeURIComponent(c.slug)}/${city && !cerca ? `${CITY(city)}/` : ''}">${esc(colTitle(c, en))}</a>`).join('')}</p></div>` : ''}
    <p class="mf-cta"><a class="pill" href="${en ? '/app/?lang=en' : '/app/'}#/registro" data-sin-sesion>${esc(S.app)}</a> <a class="pill" href="${en ? '/en/for-business/' : '/para-negocios/'}">${esc(S.biz)}</a></p>
  </section>`;

  // Cuántas hay y «Quitar filtros»: la página limpia del todo (también la zona).
  // (Sin resultados, «Quitar filtros» va con las demás salidas, abajo.)
  // En Sitios, el orden va aquí, en la cabecera de la lista, con lo que hace.
  const resumenN = calendario ? '' : `<div class="resumen"><h2 class="resumen-n">${esc(negocios ? TSi.count(total) : S.results(total))}</h2>
    ${ordenSitios && items.length ? ordenSitios : ''}
    ${hayAlgo && !vacio ? `<a href="${esc(limpia)}" data-limpia-filtros>${esc(S.clear)}</a>` : ''}</div>
    ${negocios && !sitiosMapa && items.length ? `<p class="resumen-orden">${esc(sort === 'rated' ? S.placesRatedHint : S.placesNearHint)}</p>` : ''}`;

  // Lo que se le dice a Google: la página y su lista (como la agenda).
  const jsonLd = !filtrado && items.length && !negocios ? ldScript(listingLd({
    lang, path: `${base}/`, name: descubre ? S.disc : S.exp, description: descubre ? S.discLead : S.lead, city: '', items,
    migas: [['Klendar', en ? '/en/' : '/'], [descubre ? S.disc : S.exp, `${base}/`]],
  })) : '';
  // «Lo ya visto, al final»: cuenta lo que ves en todas las páginas y, en la
  // primera, pone lo visto al final (en las demás, el orden de la base).
  const vistosJs = conVistos && !vacio
    ? `
<script src="/assets/vistos.js?v=2" defer data-ordena="${page === 1 ? '1' : ''}" data-t="${esc(JSON.stringify({ title: S.seenTitle, body: S.seenBody, more: S.seeMore, change: S.seenChange, settings: `${en ? '/app/?lang=en' : '/app/'}#/ajustes/lo-que-ves` }))}"></script>`
    : '';
  const head = `${guardaFiltros({ ...e, vista }, lang, base, !descubre)}${vistosJs}
${filtrado ? '<meta name="robots" content="noindex, follow">' : jsonLd}${descubre ? '' : `
${PARTIDOS_CSS}
${SITIOS_CSS}`}${mapa ? `
${GRUPOS_CSS}` : ''}`;

  // Los avisos de Descubre (docs/GLOSARIO.md, «Avisos de Descubre»): bajo
  // los filtros, como mucho UNO a la vez, en una línea y con su ×. Por orden:
  // el modo viaje (con tu posición, si estás lejos de tu ciudad: lo dice
  // /assets/gustos.js, porque la página va en caché y no sabe cuál es).
  // «Según el tiempo» no es un aviso: lo dice el chip de orden, que entonces
  // va justo detrás de Filtros. Quién se enseña lo decide /assets/avisos.js. La oferta fijada de un RRPP no es un
  // aviso: es la primera tarjeta (/assets/fijada.js).
  const viaje = descubre && cerca && !vacio
    ? `<div id="viaje" class="feed-aviso" data-aviso="viaje" hidden data-lat="${esc(posUrl(lat))}" data-lng="${esc(posUrl(lng))}"
        data-hoy="${esc(link({ when: 'today' }))}" data-textos="${esc(JSON.stringify({ label: S.travelLabel, title: S.travelTitle, close: S.travelClose }))}"></div>`
    : '';
  const avisos = viaje
    ? `<div class="feed-avisos" id="feed-avisos" hidden>${viaje}</div>
  <script src="/assets/avisos.js?v=2" defer></script>`
    : '';
  if (descubre) {
    return variaCon(conCookie(html(publicPage({
      lang,
      path: `${base}/`,
      title: S.disc,
      description: S.discLead,
      image: portada(items),
      // En Descubre, la pregunta de la edad al final (nada encima de la
      // publicación, salvo la fila y un aviso).
      body: feedHtml({ S, en, lang, items, page, paginas, link, barra, final: `${avisoCerca}${avisoEdad}${final}`, vacio, resumenN, masFormas, avisos, vistos: conVistos }),
      actual: 'descubre',
      bodyClass: vacio ? 'pagina-descubre' : 'pagina-descubre pagina-feed',
      head,
      // Con «Cerca de mí» la dirección lleva tu posición (?lat=&lng=): esa
      // página no pasa por el contador de visitas.
      contador: !cerca,
    }), 200, cachePublica('public, max-age=120, s-maxage=600'))));
  }

  // ── Resultados de Explorar ──
  let resultados;
  if (negocios) {
    resultados = sitiosHtml({
      items, lang, S, TSi, e, link, page, paginas, mapa: sitiosMapa, pedirQ,
      centro: cerca ? { lat, lng } : centroDe(klendarCities) || items[0] || null,
    });
  } else if (calendario) {
    resultados = calendarioHtml({
      items, lang, S, link, mes, dia, hoy,
      delDiaParte: diaParte ? diaParte.items || [] : null, totalDia: diaParte ? Number(diaParte.total) || 0 : null,
      cuando: diasCuando ? { dias: diasCuando, etiqueta: { now: S.now, today: S.today, tonight: S.tonight, tomorrow: S.tomorrow, weekend: S.weekend, next10: S.next10 }[when], quitar: link({ when: '' }) } : null,
      orden: ordenCal,
      // «Quitar filtros» deja el calendario sin lo que quita publicaciones
      // (la zona y la distancia se quedan, como `clearNarrowing` en la app).
      quitarFiltros: conFiltros ? link({
        q: '', cat: '', cats: [], kind: '', price: '', when: '', soloDescuento: false, abierto: false, amigos: false, traits: [], edades: [],
        precioLocal: 0, carne: '', solo: false, solidario: false, entidad: false, antesCierre: false, menuDia: false, comerAhora: false, momento: '',
      }) : '',
    });
  } else if (mapa) {
    resultados = `${ambienteHtml(e, lang, link)}${mapaHtml(items, lang, S)}${items.length ? `<h2 class="fin-h">${esc(S.onMap(items.length))}</h2>${rejilla(items, lang, { galeria: true })}` : ''}`;
  } else {
    const negArriba = (sitios?.items || []);
    // El orden de la búsqueda de la app: partidos, artistas, Sitios, Ofertas y
    // eventos y, debajo, «Avísame si…» y «¿No encuentras…?».
    resultados = `${q && !descubre ? `<p class="chip-solo"><a class="chip" href="${esc(link({ que: 'places', vista: '' }))}">${esc(TSi.onlyPlaces)}</a></p>` : ''}
    ${seccionPartidos}
    ${seccionArtistas}
    ${negArriba.length ? `<section class="seccion-negocios" aria-labelledby="secNeg">
      <div class="seccion-cab"><h2 id="secNeg">${esc(S.bizSection)}</h2>${(sitios?.total || 0) > negArriba.length ? `<a href="${esc(link({ que: 'places', vista: '' }))}">${esc(S.allPlaces)}</a>` : ''}</div>
      <div class="nlist">${negArriba.map((b) => bizCard(b, lang, S)).join('')}</div></section>` : ''}
    ${(negArriba.length || seccionPartidos || seccionArtistas) && items.length ? `<h2 class="seccion-t-pub">${esc(S.offersSection)}</h2>` : ''}
    ${vacio ? '' : rejilla(items, lang, { primera: !negArriba.length && !seccionPartidos && !seccionArtistas, galeria: true, vistos: conVistos })}
    ${vacio ? lineaPedir : ''}`;
  }

  const body = `
  <div class="exp-cab cab-pagina" id="arriba">
    <div><h1>${esc(S.exp)}</h1>
    <p class="muted exp-lead">${esc(S.lead)}</p>
    <p class="exp-atajo"><a href="${esc(`${partidosBase(lang)}/${zonaDeExplorar(e, lang) ? `?${zonaDeExplorar(e, lang)}` : ''}`)}">${icPartido(16)}<span>${esc(KE.t(lang).title)}</span></a>
      <a href="${esc(`${gruposBase(lang)}/${zonaGrupos(e, lang) ? `?${zonaGrupos(e, lang)}` : ''}`)}">${icGrupos(16)}<span>${esc(KG.t(lang).title)}</span></a>
      ${sorteosOn ? `<a href="${esc(`${sorteosBase(lang)}/${zonaGrupos(e, lang) ? `?${zonaGrupos(e, lang)}` : ''}`)}">${icSorteo(16)}<span>${esc(KS.t(lang).title)}</span></a>` : ''}</p></div>
  </div>
  <div class="que-fila">${que}${vistas}</div>
  ${buscador}
  ${barra}
  ${atajosFila}
  ${invitaCerca}
  ${avisoCerca}
  ${avisoEdad}
  ${resumenN}
  ${resultados}
  ${vacio ? '' : lineaAvisame}
  ${!vacio && !negocios && !mapa && !calendario ? lineaPedir : ''}
  ${paginas > 1 ? `<nav class="pager" aria-label="${esc(S.page)}">
    ${page > 1 ? `<a class="pill" href="${esc(link({ p: page - 1 }))}" rel="prev">${esc(S.prev)}</a>` : ''}
    <span class="muted">${esc(S.page)} ${page}/${paginas}</span>
    ${page < paginas ? `<a class="pill" href="${esc(link({ p: page + 1 }))}" rel="next">${esc(S.next)}</a>` : ''}
  </nav>` : ''}
  ${negocios ? sitiosFinal({ items, TSi, S, e, link, page, paginas, mapa: sitiosMapa }) : final}
  ${vacio && !negocios ? lineaAvisame : ''}
  ${masFormas}${negocios ? `
${SITIOS_SCRIPTS}` : ''}`;

  // Una búsqueda concreta no aporta nada al índice de Google; la página
  // limpia sí.
  return variaCon(conCookie(html(publicPage({
    lang,
    path: `${base}/`,
    title: S.exp,
    description: S.lead,
    image: portada(items),
    body,
    actual: 'explorar',
    bodyClass: 'pagina-explorar',
    head,
    contador: !cerca,
  }), 200, cachePublica('public, max-age=120, s-maxage=600'))));
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
 * Encima de la publicación, solo los filtros y como mucho un aviso de una
 * línea ([avisos]). Con sesión, la oferta de la lista de un RRPP por la que
 * entró esa persona es la primera tarjeta (la pone /assets/fijada.js; nadie
 * más la ve).
 */
function feedHtml({ S, en, lang, items, page, paginas, link, barra, final, vacio, resumenN, masFormas, avisos = '', vistos = false }) {
  const cab = `<div class="feed-lado" id="arriba">
      <h1>${esc(S.disc)}</h1>
      <p class="muted">${esc(S.discLead)}</p>
      ${vacio ? '' : `<p class="feed-teclas">${esc(S.feedKeys)}</p>`}
    </div>`;
  if (vacio) {
    return `<div class="feed-vacio">
    ${cab}
    ${barra}
    ${final}
    </div>
    ${masFormas}`;
  }
  const pantallas = items.map((o, i) => tarjeta(o, lang, {
    forma: 'pantalla', primera: page === 1 && i === 0, desc: true, h: 'h2', galeria: true, vistos,
  })).join('');
  const mas = page < paginas
    ? `<div class="feed-mas"><a class="pill" href="${esc(link({ p: page + 1 }))}" rel="next" data-feed-mas>${esc(S.seeMore)}</a></div>`
    : '';
  return `<div class="feed-fondo" aria-hidden="true"></div>
  ${cab}
  <div class="feed-velo" aria-hidden="true"></div>
  <div class="feed-cab">
    ${barra}
    ${avisos}
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
  ${masFormas}
  ${page === 1 ? `<script src="/assets/fijada.js?v=10" defer data-lang="${en ? 'en' : 'es'}"></script>` : ''}`;
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
  await conPrecios(lugares);
  // Una categoría que no existe (escrita a mano en la URL) es un 404, no una
  // página vacía con 200. Si existe pero aquí no hay nada, la página vacía,
  // con su nombre («Panaderías y pastelerías en Madrid», no «Bakery»).
  let fila = null;
  if (!cat) {
    const existe = await rows('categories', `select=slug,names&slug=eq.${encodeURIComponent(slug)}`).catch(() => [{ slug }]);
    if (!existe.length && !items.length && !lugares.length) return notFound(lang, path, 'c');
    fila = existe[0]?.names ? existe[0] : null;
  }
  const city = PRETTY(items[0]?.city || lugares[0]?.city || rawc);
  const nombre = cat || fila ? catName(cat || fila, en) : PRETTY(slug);
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
export async function collectionPage(rawSlug, rawCity, lang, search = '') {
  const en = lang === 'en';
  const S = T(en);
  const decSlug = decodeSeg(rawSlug);
  const decCity = decodeSeg(rawCity);
  if (decSlug == null || decCity == null) return aListado(`${exploreBase(lang)}/`);
  const slug = decSlug.replace(/\/+$/, '').toLowerCase();
  const rawc = decCity.replace(/\/+$/, '');
  const path = `${collectionBase(lang)}/${encodeURIComponent(slug)}/${rawc ? `${CITY(rawc)}/` : ''}`;

  // Por páginas (`?p=`, como Explorar): 24 de cada vez. Antes, 48 y ya.
  const page = Math.max(1, Math.min(50, parseInt(new URLSearchParams(search).get('p') || '1', 10) || 1));
  const [cols, res, cities] = await Promise.all([
    rpcAll('public_collections', { p_city: rawc || null }),
    rpc('public_explore', { p_city: rawc || null, p_collection: slug, p_limit: POR_PAGINA, p_offset: (page - 1) * POR_PAGINA }),
    rpcAll('public_cities', {}),
  ]);
  const col = (cols || []).find((c) => c.slug === slug);
  const items = res?.items || [];
  const paginas = Math.max(1, Math.min(50, Math.ceil((Number(res?.total) || items.length) / POR_PAGINA)));
  const enlace = (n) => (n > 1 ? `${path}?p=${n}` : path);
  // Una selección que no existe es un 404. Antes salía con 200 y el título
  // «Zzz»… y con todas las publicaciones (la base no filtra por una selección
  // que no conoce).
  if (!col) {
    const todas = rawc ? await rpcAll('public_collections', { p_city: null }) : cols;
    if (!(todas || []).some((c) => c.slug === slug)) return notFound(lang, path, 'c');
  }
  const titulo = col ? colTitle(col, en) : PRETTY(slug.replace(/-/g, ' '));
  const city = rawc ? PRETTY(items[0]?.city || rawc) : '';
  const h1 = city ? `${titulo} ${S.inCity} ${city}` : titulo;

  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${exploreBase(lang)}/">${esc(S.exp)}</a></p>
  <h1>${esc(h1)}</h1>
  ${col && colSub(col, en) ? `<p class="muted" style="max-width:640px">${esc(colSub(col, en))}</p>` : ''}
  ${col && items.length ? `<p class="acciones">${historiaBoton(lang, 'c', slug)}</p>` : ''}
  ${cities.length > 1 ? `<div class="filters"><div class="frow"><span class="flabel">${esc(S.city)}</span>
    <a class="chip${rawc ? '' : ' on'}" href="${collectionBase(lang)}/${encodeURIComponent(slug)}/">${esc(S.everywhere)}</a>
    ${cities.filter((c) => c.city).slice(0, 12).map((c) => `<a class="chip${rawc.toLowerCase() === String(c.city).toLowerCase() ? ' on' : ''}" href="${collectionBase(lang)}/${encodeURIComponent(slug)}/${CITY(c.city)}/">${esc(PRETTY(c.city))}</a>`).join('')}
  </div></div>` : ''}
  ${items.length
    ? `${rejilla(items, lang, { primera: page === 1, h: 'h2' })}
  ${paginas > 1 ? `<nav class="pager" aria-label="${esc(S.page)}">
    ${page > 1 ? `<a class="pill" href="${esc(enlace(page - 1))}" rel="prev">${esc(S.prev)}</a>` : ''}
    <span class="muted">${esc(S.page)} ${page}/${paginas}</span>
    ${page < paginas ? `<a class="pill" href="${esc(enlace(page + 1))}" rel="next">${esc(S.next)}</a>` : ''}
  </nav>` : ''}
  <p style="margin-top:22px"><a class="pill accent" href="${exploreBase(lang)}/">${esc(S.exp)}</a> <a class="pill" href="${agendaBase(lang)}/">${esc(S.agenda)}</a></p>`
    // Vacía: la pantalla vacía, centrada, con las mismas salidas.
    : `<section class="vacio"><h2>${esc(S.colNone)}</h2><p>${esc(S.colNoneBody)}</p>
    <div class="vacio-botones"><a class="pill accent" href="${exploreBase(lang)}/">${esc(S.exp)}</a><a class="pill" href="${agendaBase(lang)}/">${esc(S.agenda)}</a></div></section>`}`;

  return html(publicPage({
    lang, path, body, title: h1,
    description: (col && colSub(col, en)) || S.lead,
    image: portada(items),
    actual: 'explorar',
    consulta: page > 1 ? `?p=${page}` : '',
    head: items.length && page === 1 ? '' : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=300, s-maxage=900');
}

// ── Planes con niños en una ciudad ─────────────────────────────────────────
/**
 * «Planes con niños en Madrid» (/con-ninos/madrid/, /en/kids/madrid/): lo que
 * se busca para salir en familia. Las publicaciones aptas para niños (lo dice
 * ella o su local: `traits` = ["kids"], lo mismo que «Con niños» en Explorar
 * y la selección `con-ninos`) y, debajo, los sitios de la ciudad que lo son,
 * para que la página responda aunque hoy no haya planes. Sin nada, la
 * pantalla vacía centrada con sus salidas (la agenda, hoy, Explorar).
 */
export async function kidsPage(rawCity, lang) {
  const en = lang === 'en';
  const S = T(en);
  const dec = decodeSeg(rawCity);
  if (dec == null) return aListado(`${agendaBase(lang)}/`);
  const raw = dec.replace(/[/]+$/, '');
  const path = `${kidsBase(lang)}/${CITY(raw)}/`;
  if (!raw || raw.length > 60) return notFound(lang, path, 'c');

  const [res, cats, cities, lugares] = await Promise.all([
    rpc('public_explore', { p_city: raw, p_filters: { traits: ['kids'] }, p_limit: 60 }),
    rpcAll('public_categories', { p_city: raw }),
    rpcAll('public_cities', {}),
    // Los sitios de la ciudad que el negocio marca como aptos para niños (o con
    // zona infantil). Son un extra: si no llegan, la página sale igual.
    rows('businesses', `select=id,slug,name,city&city=ilike.${encodeURIComponent(raw.replace(/[*%,()]/g, ''))}`
      + '&amenities=ov.%7Bkids,play_area%7D&is_active=eq.true&adults_only=eq.false'
      + '&closed_indefinitely_at=is.null&closed_permanently_at=is.null&order=name.asc&limit=24').catch(() => []),
  ]);
  const items = res?.items || [];
  const conocida = (cities || []).find((c) => String(c.city || '').toLowerCase() === raw.toLowerCase());
  // Una ciudad sin nada de nada (mal escrita, o donde aún no hay negocios).
  if (!items.length && !lugares.length && !conocida) return notFound(lang, path, 'c');
  const city = PRETTY(items[0]?.city || lugares[0]?.city || conocida?.city || raw);
  const agendaCiudad = `${agendaBase(lang)}/${CITY(raw)}/`;
  const explorar = `${exploreBase(lang)}/?${en ? 'city' : 'ciudad'}=${encodeURIComponent(city)}&${en ? 'place=kids' : 'sitio=ninos'}`;

  const K = en
    ? {
        h1: `Plans with kids in ${city}`,
        title: `Plans with kids in ${city}: family-friendly places and plans`,
        lead: `Family-friendly places and plans in ${city}: flash offers and events from businesses that say they're child-friendly. No account needed to browse.`,
        desc: (n) => `${n} ${n === 1 ? 'plan' : 'plans'} with kids in ${city}: family-friendly flash offers and events from local businesses. No account needed to browse.`,
        descNone: `Family-friendly places in ${city} and what's on for kids, updated as businesses publish.`,
        places: `Child-friendly places in ${city}`,
        emptyTitle: `No plans with kids in ${city} yet`,
        emptyBody: "There aren't any published right now. Have a look at what's on in the city today or this week: businesses publish every day.",
        today: 'Things to do today', inExplore: 'See it in Explore',
        note: "Each business says whether it's child-friendly. If in doubt, ask at the venue.",
      }
    : {
        h1: `Planes con niños en ${city}`,
        title: `Planes con niños en ${city}: sitios y planes para ir en familia`,
        lead: `Sitios y planes aptos para ir en familia en ${city}: ofertas flash y eventos de negocios que dicen que son aptos para niños. Para mirar no hace falta cuenta.`,
        desc: (n) => `${n} ${n === 1 ? 'plan' : 'planes'} con niños en ${city}: ofertas flash y eventos aptos para ir en familia, de los negocios de la ciudad. Sin cuenta para mirar.`,
        descNone: `Sitios aptos para niños en ${city} y planes para ir en familia, según van publicando los negocios.`,
        places: `Sitios aptos para niños en ${city}`,
        emptyTitle: `Aún no hay planes con niños en ${city}`,
        emptyBody: 'Ahora mismo no hay ninguno publicado. Mira lo que hay hoy en la ciudad o esta semana: los negocios publican cada día.',
        today: 'Qué hacer hoy', inExplore: 'Verlo en Explorar',
        note: 'Que un sitio es apto para niños lo dice cada negocio. Si tienes dudas, pregunta en el local.',
      };

  const sitios = lugares.length ? `<section class="daygroup"><h2>${esc(K.places)}</h2>
    <div class="cities">${lugares.map((b) => `<a href="${esc(bizPath(lang, b.slug || b.id))}">${esc(b.name)}</a>`).join('')}</div></section>` : '';
  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a> · <a href="${agendaBase(lang)}/">${esc(S.agenda)}</a> · <a href="${esc(agendaCiudad)}">${esc(city)}</a></p>
  <h1>${esc(K.h1)}</h1>
  <p class="muted" style="max-width:640px">${esc(K.lead)}</p>
  ${cityLinks(lang, raw, city, cats, 'ninos')}
  ${items.length ? rejilla(items, lang, { primera: true, h: 'h2' })
    // Vacía: la pantalla vacía, centrada, con las mismas salidas.
    : `<section class="vacio" aria-labelledby="ninosVacio">
    <span class="vacio-ic" aria-hidden="true">${icSitio('kids', 30)}</span>
    <h2 id="ninosVacio">${esc(K.emptyTitle)}</h2>
    <p>${esc(K.emptyBody)}</p>
    <div class="vacio-botones">
      <a class="pill accent" href="${todayBase(lang)}/${CITY(raw)}/">${esc(K.today)}</a>
      <a class="pill" href="${esc(agendaCiudad)}">${esc(S.seeAgenda)}</a>
      <a class="pill" href="${esc(explorar)}">${esc(K.inExplore)}</a>
    </div>
    <p class="vacio-sugiere"><a href="${esc(pedirHref(lang))}">${esc(S.recommend)}</a></p>
  </section>`}
  ${sitios}
  <p class="muted" style="font-size:13px">${esc(K.note)}</p>
  ${items.length ? `<p><a class="pill accent" href="${esc(explorar)}">${esc(K.inExplore)}</a>
     <a class="pill" href="${todayBase(lang)}/${CITY(raw)}/">${esc(K.today)}</a>
     <a class="pill" href="${esc(agendaCiudad)}">${esc(S.seeAgenda)}</a></p>` : ''}`;

  const description = items.length ? K.desc(items.length) : K.descNone;
  // Se indexa si hay algo que enseñar: planes o sitios aptos para niños.
  const indexable = items.length || lugares.length;
  const jsonLd = listingLd({
    lang, path, name: K.h1, description, city, items,
    migas: [['Klendar', en ? '/en/' : '/'], [S.agenda, `${agendaBase(lang)}/`], [city, agendaCiudad], [S.withKids, path]],
  });

  return html(publicPage({
    lang, path, body, title: K.title,
    description,
    image: portada(items),
    actual: 'explorar',
    head: indexable ? ldScript(jsonLd) : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=300, s-maxage=900');
}
