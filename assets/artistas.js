// Artistas («Quién actúa», seguir a un artista) y organizadores sin local
// fijo: los nombres y las frases, en un solo sitio.
//
// Los mismos en la web pública (Pages Functions: `import KA from
// '../../assets/artistas.js'`), en «Tu cuenta», en el panel del negocio y en
// el admin (script clásico: deja `KlendarArtistas` en `window`). Son los de
// la app (tanda C, migraciones 20261205100000_artistas y
// 20261205100001_sin_local_fijo): si cambia uno, cambia en todos los sitios.
//
// Las fechas van en la hora del sitio (la zona del local, `time_zone`):
// `assets/zona.js` tiene que estar cargado antes.
(function () {
  'use strict';

  const KZ = () => globalThis.KlendarZona;
  const loc = (lang) => (lang === 'en' ? 'en-GB' : 'es-ES');

  /** Enlaces de la ficha de un artista, en el orden de la app (y de la base,
   *  `artist_clean_links`). */
  const REDES = [
    ['spotify', 'Spotify'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'],
    ['soundcloud', 'SoundCloud'], ['bandcamp', 'Bandcamp'], ['web', 'Web'],
  ];
  const MAX_POR_EVENTO = 10;

  const T = {
    es: {
      artists: 'Artistas',
      artist: 'Artista',
      whoPerforms: 'Quién actúa',
      addArtist: 'Añadir artista',
      searchPh: 'Busca o escribe un nombre',
      addNew: (x) => `Añadir «${x}» como nuevo`,
      remove: (x) => `Quitar a ${x}`,
      panelHint: 'Elige a quien ya está en Klendar o escribe un nombre nuevo. Lo que escribas solo pone el nombre: la foto y la descripción las revisa Klendar.',
      venueAlways: 'Como no tienes local fijo, cada publicación lleva su sitio.',
      savedBut: (n, motivo) => `La publicación se ha guardado, pero «${n}» no se ha podido poner: ${motivo}. Cámbialo al editarla.`,
      reasons: { offensive_name: 'tiene palabras que no se permiten', name_invalid: 'el nombre debe tener entre 2 y 60 caracteres', too_many: 'como mucho 10 artistas', other: 'algo no ha ido bien' },
      yourArtists: 'Los que ya has puesto',
      noneFound: 'No encontramos ese nombre',
      performing: (n) => (n === 1 ? 'Actúa:' : 'Actúan:'),
      follow: 'Seguir',
      following: 'Siguiendo',
      unfollow: 'Dejar de seguir',
      upcoming: 'Próximas fechas',
      noDates: 'No tiene fechas próximas en Klendar',
      weTell: 'Te avisamos cuando tenga una fecha nueva cerca de ti.',
      youFollow: 'Artistas que sigues',
      noneYet: 'Aún no sigues a ningún artista',
      noneYetText: 'Sigue a tus artistas y te avisamos cuando tengan una fecha nueva cerca de ti.',
      followOne: 'Seguir a un artista',
      whenNew: 'Cuando tienen una fecha nueva cerca',
      searchArtist: 'Busca un artista',
      nextDate: 'Próxima fecha',
      noNext: 'Por ahora no tiene fechas',
      notPublic: 'Ya no tiene página en Klendar',
      dates: (n) => (n === 1 ? '1 fecha' : `${n} fechas`),
      on: (n) => `Sigues a ${n}. Te avisamos cuando tenga una fecha nueva cerca de ti.`,
      off: (n) => `Ya no sigues a ${n}.`,
      tooManyFollow: 'Sigues a 100 artistas, el máximo. Deja alguno para seguir este.',
      rateLimited: 'Vas muy rápido. Espera un momento y vuelve a probar.',
      notFound: 'Ese artista ya no está en Klendar.',
      nameInvalid: (x) => (x ? `«${x}» no vale como nombre: entre 2 y 60 caracteres, con letras o números.` : 'Escribe un nombre de entre 2 y 60 caracteres.'),
      offensive: (x) => (x ? `«${x}» no se puede usar como nombre. Si es el nombre real del artista, escríbenos a info@klendar.app.` : 'Ese nombre no se puede usar. Si es el nombre real del artista, escríbenos a info@klendar.app.'),
      tooMany: 'Como mucho 10 artistas por evento.',
      oops: 'Algo no ha ido bien. Si vuelve a pasar, escríbenos a info@klendar.app.',
      linksTitle: 'Enlaces',
      eventsOf: (n) => `Próximas fechas de ${n}`,
      pageTitle: (n) => `${n}: próximas fechas`,
      pageDesc: (n) => `Las próximas fechas de ${n} en Klendar, en cualquier local, y aviso cuando tenga una nueva cerca de ti.`,
      gone: 'Este artista no está en Klendar',
      goneText: 'Puede que lo hayan quitado o que el enlace esté mal.',
      // Organizador sin local fijo.
      noVenue: 'No tengo local fijo (organizo eventos en distintos sitios)',
      zoneLabel: 'Zona donde organizas',
      zoneHint: 'Tu ciudad. No sale como dirección: cada evento lleva su sitio.',
      organises: 'Organiza en distintos sitios',
      venueRequired: 'Di dónde es: como no tienes local fijo, cada publicación lleva su sitio.',
      offersAtVenue: 'Antes, pasa a «en otro sitio» o retira lo que tienes publicado en el local.',
      addressRequired: 'Escribe la dirección del local.',
      venueTooFar: 'Ese sitio está a más de 1.200 km de tu zona: revisa la dirección.',
      noDatesBiz: 'Ahora mismo no tiene fechas publicadas.',
    },
    en: {
      artists: 'Artists',
      artist: 'Artist',
      whoPerforms: "Who's performing",
      addArtist: 'Add artist',
      searchPh: 'Search or type a name',
      addNew: (x) => `Add “${x}” as new`,
      remove: (x) => `Remove ${x}`,
      panelHint: 'Pick someone already on Klendar or type a new name. What you type only sets the name: Klendar reviews the photo and description.',
      venueAlways: 'With no fixed venue, every post needs its place.',
      savedBut: (n, motivo) => `The post has been saved, but “${n}” couldn't be added: ${motivo}. Change it when you edit it.`,
      reasons: { offensive_name: "it contains words that aren't allowed", name_invalid: 'the name must be 2–60 characters', too_many: '10 artists at most', other: 'something went wrong' },
      yourArtists: "The ones you've already added",
      noneFound: "We can't find that name",
      performing: () => 'Performing:',
      follow: 'Follow',
      following: 'Following',
      unfollow: 'Unfollow',
      upcoming: 'Upcoming dates',
      noDates: 'No upcoming dates on Klendar',
      weTell: "We'll let you know when they have a new date near you.",
      youFollow: 'Artists you follow',
      noneYet: "You don't follow any artists yet",
      noneYetText: "Follow your artists and we'll let you know when they have a new date near you.",
      followOne: 'Follow an artist',
      whenNew: 'When they have a new date near you',
      searchArtist: 'Search for an artist',
      nextDate: 'Next date',
      noNext: 'No dates for now',
      notPublic: 'No longer has a page on Klendar',
      dates: (n) => (n === 1 ? '1 date' : `${n} dates`),
      on: (n) => `You're following ${n}. We'll let you know when they have a new date near you.`,
      off: (n) => `You're no longer following ${n}.`,
      tooManyFollow: "You're following 100 artists, the maximum. Unfollow one to follow this one.",
      rateLimited: "You're going too fast. Wait a moment and try again.",
      notFound: 'That artist is no longer on Klendar.',
      nameInvalid: (x) => (x ? `“${x}” isn't a valid name: 2 to 60 characters, with letters or numbers.` : 'Type a name of 2 to 60 characters.'),
      offensive: (x) => (x ? `“${x}” can't be used as a name. If it's the artist's real name, email us at info@klendar.app.` : "That name can't be used. If it's the artist's real name, email us at info@klendar.app."),
      tooMany: 'At most 10 artists per event.',
      oops: 'Something went wrong. If it happens again, email info@klendar.app.',
      linksTitle: 'Links',
      eventsOf: (n) => `Upcoming dates for ${n}`,
      pageTitle: (n) => `${n}: upcoming dates`,
      pageDesc: (n) => `${n}'s upcoming dates on Klendar, at any venue, and a heads-up when they have a new one near you.`,
      gone: "This artist isn't on Klendar",
      goneText: 'It may have been removed or the link may be wrong.',
      noVenue: "I don't have a fixed venue (I organise events in different places)",
      zoneLabel: 'Area where you organise',
      zoneHint: 'Your city. It isn’t shown as an address: each event has its own place.',
      organises: 'Organises events in different places',
      venueRequired: "Say where it is: since you don't have a fixed venue, every publication has its own place.",
      offersAtVenue: 'First, switch to “somewhere else” or take down what you have published at your venue.',
      addressRequired: "Type your venue's address.",
      venueTooFar: "That place is more than 1,200 km from your area: check the address.",
      noDatesBiz: 'No dates published right now.',
    },
  };
  const t = (lang) => T[lang === 'en' ? 'en' : 'es'];

  /** El mensaje de un error de las funciones de artistas (`{ok:false, error}`). */
  function error(clave, lang, nombre = '') {
    const S = t(lang);
    switch (clave) {
      case 'too_many': return S.tooMany;
      case 'name_invalid': return S.nameInvalid(nombre);
      case 'offensive_name': return S.offensive(nombre);
      case 'rate_limited': return S.rateLimited;
      case 'not_found': return S.notFound;
      default: return S.oops;
    }
  }

  /** La inicial para el círculo cuando no hay foto. */
  const inicial = (n) => String(n || '·').trim().charAt(0).toUpperCase() || '·';

  /** Una dirección bien formada para /a/<slug>. */
  const esSlug = (s) => typeof s === 'string' && s.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

  /** Solo https (lo que guarda la base; por si acaso). */
  const seguro = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : '');

  /** Los enlaces de un artista, en orden: [[clave, nombre, url]]. */
  const enlaces = (links) => REDES.map(([k, n]) => [k, n, seguro(links && links[k])]).filter((x) => x[2]);

  /** La ciudad de una dirección escrita («Calle Mayor 3, 28013 Madrid» →
   *  «Madrid»): el último trozo sin el código postal ni el país. */
  function ciudadDe(direccion) {
    const partes = String(direccion || '').split(',').map((x) => x.replace(/\b\d{4,5}\b/g, '').trim()).filter(Boolean);
    while (partes.length > 1 && /^(españa|spain)$/i.test(partes[partes.length - 1])) partes.pop();
    return partes.length > 1 ? partes[partes.length - 1] : '';
  }

  /** Dónde es una fecha: el sitio («Sala Sol»; si no tiene nombre, la calle;
   *  si es en el local, el local) y la ciudad (la del sitio si es en otro
   *  sitio; si no, la del local). */
  function donde(d) {
    const enOtro = !!d.venue_address;
    const sitio = d.venue_name || (enOtro ? String(d.venue_address).split(',')[0].trim() : '') || d.business_name || '';
    const ciudad = (enOtro && ciudadDe(d.venue_address)) || d.city || '';
    return { sitio, ciudad: ciudad && ciudad.toLowerCase() !== sitio.toLowerCase() ? ciudad : '' };
  }

  /** «sáb 12 oct · 23:30» en la hora del sitio. */
  function cuando(iso, tz, lang) {
    if (!iso || !KZ()) return '';
    const dia = KZ().fmt(iso, tz, loc(lang), { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '').replace(/\./g, '');
    const hora = KZ().fmt(iso, tz, loc(lang), { hour: '2-digit', minute: '2-digit' });
    return `${dia} · ${hora}`;
  }

  /** «sáb 12 oct · 23:30 · Sala Sol · Madrid». */
  function linea(d, lang) {
    const w = donde(d);
    return [cuando(d.starts_at, d.time_zone, lang), w.sitio, w.ciudad].filter(Boolean).join(' · ');
  }

  const KlendarArtistas = { REDES, MAX_POR_EVENTO, t, error, inicial, esSlug, seguro, enlaces, ciudadDe, donde, cuando, linea };
  globalThis.KlendarArtistas = KlendarArtistas;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarArtistas;
})();
