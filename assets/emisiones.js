// «Dónde ver el partido»: los nombres y las frases, en un solo sitio.
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

  /** Deportes, en el orden de la base (`broadcast_sports()`). */
  const DEPORTES = ['football', 'basketball', 'motor', 'tennis', 'combat', 'american_football', 'other'];
  const NOMBRES = {
    es: { football: 'Fútbol', basketball: 'Baloncesto', motor: 'Motor', tennis: 'Tenis', combat: 'Boxeo y MMA', american_football: 'Fútbol americano', other: 'Otros' },
    en: { football: 'Football', basketball: 'Basketball', motor: 'Motorsport', tennis: 'Tennis', combat: 'Boxing and MMA', american_football: 'American football', other: 'Other' },
  };

  /** Condiciones de football-data.org: bajo cada lista o detalle con sus
   * datos, igual en los dos idiomas y con enlace. */
  const FUENTE = { url: 'https://www.football-data.org/', texto: 'Football data provided by the Football-Data.org API' };

  const T = {
    es: {
      title: 'Dónde ver el partido',
      lead: 'Bares que ponen el fútbol, la F1 y más',
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
      yourTeams: 'Tus equipos',
      followTeam: 'Seguir a un equipo',
      noTeams: 'Sigue a tu equipo y te avisamos antes de cada partido con los bares que lo ponen cerca.',
      searchTeam: 'Busca tu equipo',
      noTeamFound: 'No encontramos ese equipo',
      emptyTitle: 'Aún no hay partidos por aquí',
      emptyText: 'Cuando un bar cercano diga qué partidos pone, saldrán aquí.',
      notFound: (q) => `No encontramos «${q}»`,
      notFoundText: 'Prueba con el nombre del equipo o de la competición.',
      showingOne: 'Pone el partido',
      showingMany: 'Pone estos partidos',
      seeAll: 'Ver todos',
      prefTeams: 'Partidos de tus equipos',
      teamsYouFollow: 'Equipos que sigues',
      unfollow: 'Dejar de seguir',
      offer: (x) => `Oferta: ${x}`,
      // Panel del negocio.
      tool: 'Partidos que pones',
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
      what: '¿Qué ponéis?',
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
      title: 'Where to watch the match',
      lead: 'Bars showing football, F1 and more',
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
      yourTeams: 'Your teams',
      followTeam: 'Follow a team',
      noTeams: "Follow your team and we'll tell you before each match which bars nearby are showing it.",
      searchTeam: 'Search for your team',
      noTeamFound: "We can't find that team",
      emptyTitle: 'No matches around here yet',
      emptyText: "When a bar nearby says which matches it's showing, they'll appear here.",
      notFound: (q) => `We couldn't find “${q}”`,
      notFoundText: 'Try the name of the team or the competition.',
      showingOne: 'Showing the match',
      showingMany: 'Showing these matches',
      seeAll: 'See all',
      prefTeams: "Your teams' matches",
      teamsYouFollow: 'Teams you follow',
      unfollow: 'Unfollow',
      offer: (x) => `Offer: ${x}`,
      tool: "Matches you're showing",
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
  const t = (lang) => T[en(lang) ? 'en' : 'es'];
  const deporte = (s, lang) => NOMBRES[en(lang) ? 'en' : 'es'][s] || NOMBRES[en(lang) ? 'en' : 'es'].other;
  const loc = (lang) => (en(lang) ? 'en-GB' : 'es-ES');
  const KZ = () => globalThis.KlendarZona;

  /** ¿Hay datos de football-data.org? Entonces va la atribución. */
  const conAtribucion = (lista) => (lista || []).some((x) => x && x.source === 'football-data');

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
    DEPORTES, FUENTE, t, deporte, conAtribucion, dia, hora, etiquetaDia, diaLargo, diaCorto, cuandoCorto, cuandoLargo, plano,
  };
  globalThis.KlendarEmisiones = KlendarEmisiones;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarEmisiones;
})();
