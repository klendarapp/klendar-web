// «Dónde verlo»: los nombres y las frases, en un solo sitio.
//
// Los mismos en la web pública (Pages Functions: `import KE from
// '../../assets/emisiones.js'`), en «Tu cuenta», en el panel del negocio y en
// el admin (script clásico: deja `KlendarEmisiones` en `window`). Son los de
// la app (docs/GLOSARIO.md y la especificación de la tanda B): si cambia uno,
// cambia en todos los sitios a la vez.
//
// Las fechas, en la hora de quien mira la zona (la de una ciudad o la de un
// negocio; sin nada, Madrid): `assets/zona.js` tiene que estar cargado antes.
(function () {
  'use strict';
  // «Tu cuenta» y el panel, en un idioma sin tabla propia (catalán, francés…):
  // la española, pasada por el diccionario que ha cargado /assets/i18n.js.
  const klBi = (x, lang) => (lang === 'en' ? x.en : globalThis.KL_TABLA ? globalThis.KL_TABLA(x.es, lang) : x.es);
  const klLoc = (lang) => (globalThis.KL_LOCALE ? globalThis.KL_LOCALE(lang) : lang === 'en' ? 'en-GB' : 'es-ES');

  /** Deportes, en el orden de la base (`broadcast_sports()`). */
  const DEPORTES = ['football', 'basketball', 'motor', 'tennis', 'handball', 'combat', 'american_football', 'other'];
  const NOMBRES = {
    es: { football: 'Fútbol', basketball: 'Baloncesto', motor: 'Motor', tennis: 'Tenis', handball: 'Balonmano', combat: 'Boxeo y MMA', american_football: 'Fútbol americano', other: 'Otros' },
    en: { football: 'Football', basketball: 'Basketball', motor: 'Motorsport', tennis: 'Tennis', handball: 'Handball', combat: 'Boxing and MMA', american_football: 'American football', other: 'Other' },
  };

  /** Las fuentes que piden que se las cite, bajo cada lista o detalle con
   * sus datos y con enlace: TheSportsDB (la de los horarios desde el
   * 2026-11-03; sus condiciones: «must mention us as the source») y
   * football-data.org (mientras quede algo suyo). */
  const FUENTES = {
    thesportsdb: { url: 'https://www.thesportsdb.com/', es: 'Datos deportivos: TheSportsDB', en: 'Sports data: TheSportsDB' },
    'football-data': { url: 'https://www.football-data.org/', es: 'Football data provided by the Football-Data.org API', en: 'Football data provided by the Football-Data.org API' },
  };
  /** La de siempre (TheSportsDB): `{ url, texto }`, como antes. */
  const FUENTE = { url: FUENTES.thesportsdb.url, texto: FUENTES.thesportsdb.es };
  /** Las citas que tocan para una lista: `[{ url, texto }]`. */
  const fuentesDe = (lista, lang) => Object.keys(FUENTES)
    .filter((k) => (lista || []).some((x) => x && x.source === k))
    .map((k) => ({ url: FUENTES[k].url, texto: klBi(FUENTES[k], lang) }));

  const T = {
    es: {
      title: 'Dónde verlo',
      lead: 'Bares que ponen el fútbol, el baloncesto, la F1 y más',
      nearby: 'Lo ponen cerca',
      more: 'Más partidos',
      compAll: 'Todas',
      competition: 'Competición',
      searchPh: 'Equipo, partido o competición',
      search: 'Buscar',
      all: 'Todo',
      today: 'Hoy',
      tomorrow: 'Mañana',
      tbc: 'Hora por confirmar',
      bars: (n) => (n === 1 ? 'Lo pone 1 bar cerca' : `Lo ponen ${n} bares cerca`),
      offers: (n) => ` · ${n} con oferta`,
      none: 'Aún no lo pone ningún bar cerca',
      barsSection: 'Bares que lo ponen',
      detailEmpty: 'Sigue al equipo y te avisamos antes del partido si algún bar cercano lo pone.',
      follow: (x) => `Seguir a ${x}`,
      following: (x) => `Sigues a ${x}`,
      yourTeams: 'Sigues',
      followTeam: 'Seguir',
      noTeams: 'Sigue a tu equipo y te avisamos antes de cada partido con los bares que lo ponen cerca.',
      searchTeam: 'Busca un equipo o deportista',
      noTeamFound: 'No encontramos ese equipo',
      emptyTitle: 'Aún no hay partidos por aquí',
      emptyText: 'Cuando un bar cercano diga qué partidos pone, saldrán aquí.',
      notFound: (q) => `No encontramos «${q}»`,
      notFoundText: 'Prueba con el nombre del equipo o de la competición.',
      showingOne: 'Pone el partido',
      showingMany: 'Pone estos partidos',
      seeAll: 'Ver todos',
      prefTeams: 'Equipos y deportistas que sigues',
      teamsYouFollow: 'Equipos y deportistas que sigues',
      unfollow: 'Dejar de seguir',
      offer: (x) => `Oferta: ${x}`,
      // Panel del negocio.
      tool: 'Partidos que pones',
      toolLead: 'Marca lo que pongas y saldrá en tu ficha y en «Dónde verlo».',
      alwaysTitle: 'Pones siempre',
      alwaysHint: 'Se marcan solos al salir. Para dejar de ponerlos, quítalo.',
      alwaysTeam: (x) => `Poner siempre los de ${x}`,
      alwaysComp: (x) => `Poner siempre: ${x}`,
      alwaysRemove: (x) => `Dejar de poner siempre ${x}`,
      alwaysDone: 'Hecho: se marcarán solos',
      auto: 'Lo pones siempre',
      moreOptions: 'Más opciones',
      emptyWeekText: 'Añade lo que vayas a poner y saldrá en tu ficha.',
      thisWeek: 'Esta semana',
      nextWeek: 'La próxima',
      searchBiz: 'Buscar: equipo o competición',
      groupCount: (c, n, total) => `${c} · ${n} de ${total}`,
      showAll: 'Ponerlos todos',
      removeAll: 'Quitar todos',
      weShow: 'Lo ponemos',
      offerFor: 'Oferta para el partido',
      createOffer: 'Crear una oferta para el partido',
      useOffer: 'Usar una que ya tienes',
      removeOffer: 'Quitar la oferta',
      offerTitle: (p) => `${p} · oferta del partido`,
      offerDesc: 'Durante el partido.',
      addAnother: 'Añadir otro',
      sport: 'Deporte',
      what: '¿Qué pones?',
      whatHelp: 'Ej.: CD Pueblo – CD Vecino',
      competitionOpt: 'Competición (opcional)',
      dayTime: 'Día y hora',
      add: 'Añadir',
      added: 'Añadido y marcado',
      existing: 'Ya estaba en la lista: lo hemos marcado',
      errTitle: 'Escribe qué es (de 3 a 90 caracteres)',
      errDate: 'Elige un día de los próximos 60',
      errOffensive: 'Ese texto no se puede publicar',
      emptyWeek: 'No hay partidos esta semana',
      readOnly: 'Solo el propietario o un encargado puede cambiarlo.',
    },
    en: {
      title: 'Where to watch',
      lead: 'Bars showing football, basketball, F1 and more',
      nearby: 'Showing nearby',
      more: 'More matches',
      compAll: 'All',
      competition: 'Competition',
      searchPh: 'Team, match or competition',
      search: 'Search',
      all: 'All',
      today: 'Today',
      tomorrow: 'Tomorrow',
      tbc: 'Time to be confirmed',
      bars: (n) => (n === 1 ? '1 bar nearby is showing it' : `${n} bars nearby are showing it`),
      offers: (n) => ` · ${n} with an offer`,
      none: 'No bar nearby is showing it yet',
      barsSection: 'Bars showing it',
      detailEmpty: "Follow the team and we'll let you know before the match if a bar nearby is showing it.",
      follow: (x) => `Follow ${x}`,
      following: (x) => `Following ${x}`,
      yourTeams: 'Following',
      followTeam: 'Follow',
      noTeams: "Follow your team and we'll tell you before each match which bars nearby are showing it.",
      searchTeam: 'Search for a team or athlete',
      noTeamFound: "We can't find that team",
      emptyTitle: 'No matches around here yet',
      emptyText: "When a bar nearby says which matches it's showing, they'll appear here.",
      notFound: (q) => `We couldn't find “${q}”`,
      notFoundText: 'Try the name of the team or the competition.',
      showingOne: 'Showing the match',
      showingMany: 'Showing these matches',
      seeAll: 'See all',
      prefTeams: 'Teams and athletes you follow',
      teamsYouFollow: 'Teams and athletes you follow',
      unfollow: 'Unfollow',
      offer: (x) => `Offer: ${x}`,
      tool: "Matches you're showing",
      toolLead: 'Tick what you’re showing and it’ll appear on your page and in “Where to watch”.',
      alwaysTitle: 'You always show',
      alwaysHint: "They're marked automatically as they come out. Remove it to stop.",
      alwaysTeam: (x) => `Always show ${x}'s matches`,
      alwaysComp: (x) => `Always show: ${x}`,
      alwaysRemove: (x) => `Stop always showing ${x}`,
      alwaysDone: "Done: they'll be marked automatically",
      auto: 'You always show this',
      moreOptions: 'More options',
      emptyWeekText: "Add what you're showing and it'll appear on your page.",
      thisWeek: 'This week',
      nextWeek: 'Next week',
      searchBiz: 'Search: team or competition',
      groupCount: (c, n, total) => `${c} · ${n} of ${total}`,
      showAll: 'Show them all',
      removeAll: 'Remove all',
      weShow: "We're showing it",
      offerFor: 'Offer for the match',
      createOffer: 'Create an offer for the match',
      useOffer: 'Use one you already have',
      removeOffer: 'Remove the offer',
      offerTitle: (p) => `${p} · match offer`,
      offerDesc: 'During the match.',
      addAnother: 'Add another',
      sport: 'Sport',
      what: 'What are you showing?',
      whatHelp: 'E.g. CD Pueblo – CD Vecino',
      competitionOpt: 'Competition (optional)',
      dayTime: 'Day and time',
      add: 'Add',
      added: 'Added and marked',
      existing: "It was already on the list: we've marked it",
      errTitle: 'Say what it is (3 to 90 characters)',
      errDate: 'Pick a day in the next 60',
      errOffensive: "That text can't be published",
      emptyWeek: 'No matches this week',
      readOnly: 'Only the owner or a manager can change this.',
    },
  };

  const en = (lang) => lang === 'en';
  // «Seguir» (el botón de seguir a un equipo o deportista) no puede ir por el
  // diccionario: allí «Seguir» es «Continuar» (los formularios). Va aquí.
  const SEGUIR = { ca: 'Segueix', gl: 'Seguir', eu: 'Jarraitu', fr: 'Suivre', de: 'Folgen', it: 'Segui' };
  const tablas = {};
  const t = (lang) => {
    const x = klBi(T, lang);
    if (!SEGUIR[lang] || x === T.es) return x;
    const c = tablas[lang];
    if (c && c.de === x) return c.t;
    tablas[lang] = { de: x, t: { ...x, followTeam: SEGUIR[lang] } };
    return tablas[lang].t;
  };
  const deporte = (s, lang) => klBi(NOMBRES, lang)[s] || klBi(NOMBRES, lang).other;
  const loc = klLoc;
  const KZ = () => globalThis.KlendarZona;

  /** ¿Hay datos de una fuente que pide que se la cite? */
  const conAtribucion = (lista) => (lista || []).some((x) => x && FUENTES[x.source]);

  /** «AAAA-MM-DD» del partido en esa zona. */
  const dia = (iso, tz) => KZ().dia(iso, tz);

  /** «21:00». */
  const hora = (iso, tz, lang) => KZ().fmt(iso, tz, loc(lang), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  /** Hoy · Mañana · «sábado 11». */
  function etiquetaDia(iso, tz, lang) {
    const d = dia(iso, tz);
    if (d === KZ().hoy(tz)) return t(lang).today;
    if (d === KZ().hoy(tz, 1)) return t(lang).tomorrow;
    return KZ().fmt(iso, tz, loc(lang), { weekday: 'long', day: 'numeric' }).replace(',', '');
  }

  /** «sábado 11 de octubre» (o Hoy / Mañana) para la cabecera del detalle. */
  function diaLargo(iso, tz, lang) {
    const d = dia(iso, tz);
    if (d === KZ().hoy(tz)) return t(lang).today;
    if (d === KZ().hoy(tz, 1)) return t(lang).tomorrow;
    const s = KZ().fmt(iso, tz, loc(lang), { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** «sáb». */
  const diaCorto = (iso, tz, lang) => KZ().fmt(iso, tz, loc(lang), { weekday: 'short' }).replace('.', '');

  /** «sáb 21:00» o «sáb · Hora por confirmar» (la ficha del bar y el panel). */
  const cuandoCorto = (b, tz, lang) => (b.time_confirmed === false
    ? `${diaCorto(b.starts_at, tz, lang)} · ${t(lang).tbc}`
    : `${diaCorto(b.starts_at, tz, lang)} ${hora(b.starts_at, tz, lang)}`);

  /** «Hoy · 21:00», «Sábado 11 de octubre · Hora por confirmar». */
  const cuandoLargo = (b, tz, lang) => `${diaLargo(b.starts_at, tz, lang)} · ${b.time_confirmed === false ? t(lang).tbc : hora(b.starts_at, tz, lang)}`;

  /** Sin tildes y en minúsculas: para buscar en el panel. */
  const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const KlendarEmisiones = {
    DEPORTES, FUENTE, FUENTES, fuentesDe, t, deporte, conAtribucion, dia, hora, etiquetaDia, diaLargo, diaCorto, cuandoCorto, cuandoLargo, plano,
  };
  globalThis.KlendarEmisiones = KlendarEmisiones;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarEmisiones;
})();
