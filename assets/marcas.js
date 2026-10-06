// Marcas de la tanda A (las mismas que la app y la base, migración
// 20261119100000): rango de precio del local, «¿Hay sitio ahora?», «Ideal
// para ir solo», edad recomendada con niños, requisito de carné, «Solidario»
// y «Escúchalo antes».
//
// Los filtros van por los mismos `traits` que «El sitio» (offer_traits), con
// identificadores que solo sirven para filtrar: solo · charity ·
// age_0_3 / age_4_8 / age_9_12 / age_13_17 · card_student / card_youth /
// card_senior · price_le_1 / price_le_2 / price_le_3 («hasta €€»).
//
// Sirve igual para el navegador (script clásico: deja `KlendarMarcas` en
// `window`) y para las Pages Functions (`import KM from
// '../../assets/marcas.js'`), como assets/zona.js.
(function () {
  'use strict';

  const T = {
    es: {
      price: ['Económico', 'Precio medio', 'Caro', 'Muy caro'],
      priceTitle: 'Rango de precio', priceNone: 'Sin indicar',
      priceHint: 'Lo que suele gastar una persona en tu local.',
      priceA11y: 'Rango de precio: ',
      crowd: { quiet: 'Tranquilo', lively: 'Animado', full: 'Lleno' },
      crowdTitle: '¿Hay sitio ahora?',
      crowdSettingHint: 'Cualquiera de tu equipo marca desde Mi negocio, con un toque, cómo está el local: Tranquilo, Animado o Lleno. Sale en tu ficha y en el mapa mientras estás abierto, y se quita solo a las 2 horas.',
      agoNow: 'ahora mismo', agoMin: (n) => `hace ${n} min`, agoH: (n) => `hace ${n} h`,
      crowdNowA11y: (l, a) => `Ahora: ${l}, ${a}`,
      solo: 'Ideal para ir solo',
      soloHint: 'Planes en los que se está a gusto sin compañía o se conoce gente: una cata en barra, un taller, un club de lectura.',
      charity: 'Solidario', charityHint: 'Benéfico o a favor de una causa del barrio.',
      kidAgesTitle: 'Edad recomendada',
      kidAgesHint: 'Puedes marcar varias. Sin marcar ninguna, vale para cualquier edad.',
      kidAge: (r) => `${r} años`, kidAgesLine: (a) => `Edad recomendada: ${a}`,
      cardTitle: '¿Pide carné?',
      cardHint: 'Solo para quien lo enseñe. Klendar no lo comprueba: lo mira tu equipo en la puerta (el escáner se lo recuerda).',
      card: { student: 'Con carné de estudiante', youth: 'Con carné joven', senior: 'Mayores de 65' },
      cardFor: { student: 'Estudiantes', youth: 'Jóvenes', senior: 'Mayores' },
      cardDoc: { student: 'el carné de estudiante', youth: 'el carné joven', senior: 'el DNI (mayores de 65)' },
      or: 'o', cardChecked: 'Lo comprueba el local, no Klendar.',
      cardBring: (d) => `Lleva ${d}: te lo pedirán en el local.`, cardAsk: (d) => `Pide ${d}`,
      listenTitle: 'Escúchalo antes', listenField: 'Escúchalo antes (opcional)',
      listenHint: 'Para conciertos y sesiones: un enlace de Spotify, YouTube, SoundCloud, Apple Music o Bandcamp. En la ficha sale un botón para escucharlo.',
      listenInvalid: 'Solo enlaces de Spotify, YouTube, SoundCloud, Apple Music o Bandcamp.',
      listenOn: (s) => `Escúchalo en ${s}`, listenWillSay: (l) => `En la ficha: «${l}»`,
      opensOutside: 'Se abre fuera de Klendar',
      fPriceLevel: 'Precio del local', fUpTo: (s) => `Hasta ${s}`,
      fPriceHint: 'Lo que marca cada local: € económico, €⁠€ precio medio, €⁠€⁠€ caro.',
      fCards: 'Descuentos para', fCardsAny: 'Todos', fAny: 'Cualquiera',
      fKidAges: 'Edad de los niños', fKidAgesHint: 'Planes para todas las edades que marques.',
    },
    en: {
      price: ['Inexpensive', 'Moderate', 'Expensive', 'Very expensive'],
      priceTitle: 'Price range', priceNone: 'Not set',
      priceHint: 'What one person usually spends at your place.',
      priceA11y: 'Price range: ',
      crowd: { quiet: 'Quiet', lively: 'Lively', full: 'Full' },
      crowdTitle: 'Room right now?',
      crowdSettingHint: 'Anyone on your team can tap how busy it is from My business: Quiet, Lively or Full. It shows on your page and on the map while you’re open, and clears itself after 2 hours.',
      agoNow: 'just now', agoMin: (n) => `${n} min ago`, agoH: (n) => `${n} h ago`,
      crowdNowA11y: (l, a) => `Right now: ${l}, ${a}`,
      solo: 'Good for going solo',
      soloHint: 'Plans that are easy to enjoy on your own or to meet people at: a tasting at the bar, a workshop, a book club.',
      charity: 'Charity', charityHint: 'For charity or a local cause.',
      kidAgesTitle: 'Recommended age',
      kidAgesHint: 'You can tick more than one. With none ticked, it’s for any age.',
      kidAge: (r) => `Ages ${r}`, kidAgesLine: (a) => `Recommended age: ${a}`,
      cardTitle: 'ID needed?',
      cardHint: 'Only for people who show it. Klendar doesn’t check it: your team does at the door (the scanner reminds them).',
      card: { student: 'With a student card', youth: 'With a youth card', senior: 'Over 65s' },
      cardFor: { student: 'Students', youth: 'Young people', senior: 'Seniors' },
      cardDoc: { student: 'a student card', youth: 'a youth card', senior: 'ID (over 65s)' },
      or: 'or', cardChecked: 'The venue checks it, not Klendar.',
      cardBring: (d) => `Bring ${d}: you’ll be asked for it at the venue.`, cardAsk: (d) => `Ask for ${d}`,
      listenTitle: 'Listen first', listenField: 'Listen first (optional)',
      listenHint: 'For gigs and DJ sets: a Spotify, YouTube, SoundCloud, Apple Music or Bandcamp link. Your page gets a button to listen.',
      listenInvalid: 'Only Spotify, YouTube, SoundCloud, Apple Music or Bandcamp links.',
      listenOn: (s) => `Listen on ${s}`, listenWillSay: (l) => `On your page: “${l}”`,
      opensOutside: 'Opens outside Klendar',
      fPriceLevel: 'Venue price', fUpTo: (s) => `Up to ${s}`,
      fPriceHint: 'As each venue sets it: € inexpensive, €⁠€ moderate, €⁠€⁠€ expensive.',
      fCards: 'Discounts for', fCardsAny: 'Everyone', fAny: 'Any',
      fKidAges: 'Children’s age', fKidAgesHint: 'Plans that suit every age you tick.',
    },
  };
  const t = (lang) => T[lang === 'en' ? 'en' : 'es'];

  const KID_AGES = [['0_3', '0–3'], ['4_8', '4–8'], ['9_12', '9–12'], ['13_17', '13–17']];
  const CARDS = ['student', 'youth', 'senior'];
  const CROWD = ['quiet', 'lively', 'full'];

  // ── Rango de precio ───────────────────────────────────────────────────────
  const simbolo = (n) => (n >= 1 && n <= 4 ? '€'.repeat(n) : '');
  const significado = (n, lang) => t(lang).price[n - 1] || '';

  // ── «¿Hay sitio ahora?» ───────────────────────────────────────────────────
  function hace(iso, lang, ahora = Date.now()) {
    const m = Math.floor((ahora - Date.parse(iso)) / 60000);
    const x = t(lang);
    if (!(m >= 1)) return x.agoNow;
    return m < 60 ? x.agoMin(m) : x.agoH(Math.floor(m / 60));
  }
  const nivel = (l, lang) => t(lang).crowd[l] || '';

  // ── Carné ─────────────────────────────────────────────────────────────────
  const carnes = (lista) => CARDS.filter((c) => (lista || []).includes(c));
  function documentos(lista, lang) {
    const d = carnes(lista).map((c) => t(lang).cardDoc[c]);
    if (d.length <= 1) return d.join('');
    return `${d.slice(0, -1).join(', ')} ${t(lang).or} ${d[d.length - 1]}`;
  }

  // ── Edades ────────────────────────────────────────────────────────────────
  const edades = (lista) => KID_AGES.filter(([id]) => (lista || []).includes(id));
  const edadesTexto = (lista, lang) => edades(lista).map(([, r]) => t(lang).kidAge(r)).join(', ');

  // ── «Escúchalo antes» ─────────────────────────────────────────────────────
  // La misma expresión que `listen_url_ok` en la base y `ListenService` en la
  // app.
  const ESCUCHA = /^https:\/\/(open\.spotify\.com|spotify\.link|(www\.|m\.|music\.)?youtube\.com|youtu\.be|(www\.|m\.|on\.)?soundcloud\.com|music\.apple\.com|([a-z0-9-]+\.)?bandcamp\.com)(\/\S*)?$/i;
  // Trazados de Simple Icons (CC0), en una caja de 24 × 24.
  const SERVICIOS = {
    spotify: { nombre: 'Spotify', d: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z' },
    youtube: { nombre: 'YouTube', d: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
    soundcloud: { nombre: 'SoundCloud', d: 'M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z' },
    apple: { nombre: 'Apple Music', d: 'M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 011.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 00.02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 00-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066-.76.15-1.52.303-2.28.456l-2.325.47-1.374.278c-.016.003-.032.01-.048.013-.277.077-.377.203-.39.49-.002.042 0 .086 0 .13-.002 2.602 0 5.204-.003 7.805 0 .42-.047.836-.215 1.227-.278.64-.77 1.04-1.434 1.233-.35.1-.71.16-1.075.172-.96.036-1.755-.6-1.92-1.544-.14-.812.23-1.685 1.154-2.075.357-.15.73-.232 1.108-.31.287-.06.575-.116.86-.177.383-.083.583-.323.6-.714v-.15c0-2.96 0-5.922.002-8.882 0-.123.013-.25.042-.37.07-.285.273-.448.546-.518.255-.066.515-.112.774-.165.733-.15 1.466-.296 2.2-.444l2.27-.46c.67-.134 1.34-.27 2.01-.403.22-.043.442-.088.663-.106.31-.025.523.17.554.482.008.073.012.148.012.223.002 1.91.002 3.822 0 5.732z' },
    bandcamp: { nombre: 'Bandcamp', d: 'M0 18.75l7.437-13.5H24l-7.438 13.5H0z' },
  };

  /** Lo escrito, arreglado (sin espacios alrededor y con https://). */
  function normaliza(v) {
    let s = String(v || '').trim();
    if (!s) return '';
    if (/^http:\/\//i.test(s)) s = `https://${s.slice(7)}`;
    if (!/^https:\/\//i.test(s)) s = `https://${s}`;
    return s;
  }

  /** El servicio de un enlace válido ({id, nombre, d}) o null. */
  function servicio(url) {
    const v = String(url || '').trim();
    if (!v || v.length > 300 || !ESCUCHA.test(v)) return null;
    let host = '';
    try { host = new URL(v).hostname.toLowerCase(); } catch { return null; }
    const id = host.includes('spotify') ? 'spotify'
      : host.includes('youtu') ? 'youtube'
        : host.includes('soundcloud') ? 'soundcloud'
          : host === 'music.apple.com' ? 'apple'
            : host.endsWith('bandcamp.com') ? 'bandcamp' : '';
    return id ? { id, ...SERVICIOS[id] } : null;
  }

  /** El icono de un servicio, en SVG del color del texto. */
  const icono = (s, size = 18) => (s
    ? `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${s.d}"/></svg>`
    : '');

  // ── Filtros ───────────────────────────────────────────────────────────────
  const PRECIOS = [1, 2, 3];
  const precioDe = (traits) => PRECIOS.find((l) => (traits || []).includes(`price_le_${l}`)) || 0;
  const carneDe = (traits) => CARDS.find((c) => (traits || []).includes(`card_${c}`)) || '';
  const esMarca = (x) => x === 'solo' || x === 'charity' || /^(price_le_[1-3]|card_(student|youth|senior)|age_(0_3|4_8|9_12|13_17))$/.test(x);
  /** El nombre corto de un filtro de marca (para el resumen). */
  function nombreFiltro(x, lang) {
    const s = t(lang);
    if (x === 'solo') return s.solo;
    if (x === 'charity') return s.charity;
    let m = /^price_le_([1-3])$/.exec(x);
    if (m) return m[1] === '1' ? '€' : s.fUpTo('€'.repeat(+m[1]));
    m = /^card_(\w+)$/.exec(x);
    if (m) return s.cardFor[m[1]] || '';
    m = /^age_(\w+)$/.exec(x);
    if (m) { const e = KID_AGES.find(([id]) => id === m[1]); return e ? s.kidAge(e[1]) : ''; }
    return '';
  }

  const KlendarMarcas = {
    t, KID_AGES, CARDS, CROWD, PRECIOS,
    simbolo, significado, hace, nivel, carnes, documentos, edades, edadesTexto,
    ESCUCHA, SERVICIOS, normaliza, servicio, icono,
    precioDe, carneDe, esMarca, nombreFiltro,
  };
  globalThis.KlendarMarcas = KlendarMarcas;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarMarcas;
})();
