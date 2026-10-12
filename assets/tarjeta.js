// La tarjeta de una publicación (oferta flash o evento): UNA para toda la web.
// La web pública (Descubre, Explorar —lista, mapa y calendario—, la agenda,
// «Qué hacer hoy», las colecciones y la ficha del negocio) y el panel del
// negocio («Tus publicaciones», el calendario y la vista previa del
// formulario) la pintan con esta función, como la app pinta todas con
// `OfferCard`. Así el negocio ve exactamente lo que verá la gente.
//
// Sirve igual para el navegador (script clásico: deja `KlendarTarjeta` en
// `window`) y para las Pages Functions (`functions/_lib/tarjeta.js` la
// importa y la reexporta). Necesita `assets/zona.js` cargado antes (la hora
// de cada negocio); se lee al pintar, no al cargar. Los estilos están en
// `assets/tarjeta.css` (la web pública y el panel la enlazan).
//
// Dos formas:
// - `grande` (por defecto): la foto o el vídeo de protagonista y, encima, el
//   panel con el negocio, el título, el precio o el descuento, cuándo y el
//   botón. Como una tarjeta de Descubre en la app.
// - `fila`: miniatura, hora, precio, título y negocio en una línea, para la
//   lista de un día del calendario (la agenda de la app).
//
// Diseños (`offers.style`, los elige el negocio al publicar):
// `{ template, accent }`. Especificación común con la app:
// `klendar/docs/DISENOS_PUBLICACION.md`. Clásica (glass, por defecto), Foto
// grande (photo: la foto manda, datos pequeños sobre un degradado), Cartel
// (poster: título enorme y la fecha arriba), Color (bold: panel del color del
// negocio) y Minimal (panel liso). Una plantilla nueva es una entrada en
// `PLANTILLAS` y su bloque `.tj--<nombre>` en tarjeta.css. Una que la web no
// conozca sale como «glass». El color se corrige con `colorSeguro` (lo mismo
// que la base y la app) para que el texto encima pase AA.
//
// También:
// - Lugar propio (`venue_name`, `venue_address`; 20261101100000): la
//   tarjeta dice el sitio y «Organiza: <negocio>»; la fila, «Negocio · en
//   <sitio>». La distancia ya viene medida desde el sitio.
// - Entradas fuera (`external_url`; 20261101100001): «Entradas en DICE» si
//   es una plataforma conocida (`plataformaEntradas`).
// - «Van mis amigos» (20261102*): `/assets/amigos.js` pinta quién va en
//   `.tj-amigos` (con sesión, en el navegador: la página va en caché y no
//   sabe quién mira).
// - La galería (`galeria`) es la misma en la tarjeta, en la cabecera de las
//   fichas y en el visor a pantalla completa (`visor`); las miniaturas que
//   abren el visor (carta, novedades, reseñas), `miniatura`/`miniaturas`.
(function () {
  'use strict';

  const KZ = () => globalThis.KlendarZona;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── Dinero y fechas (en la hora del negocio: ver assets/zona.js) ──────────
  const money = (cents, currency = 'EUR', lang = 'es') =>
    cents == null
      ? ''
      : (cents / 100).toLocaleString(lang === 'en' ? 'en-IE' : 'es-ES', {
          style: 'currency',
          currency,
        });

  const loc = (lang) => (lang === 'en' ? 'en-GB' : 'es-ES');

  /** «mié 24 sept» */
  const fmtDay = (iso, lang = 'es', tz) => KZ().fmt(iso, tz, loc(lang), {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  const fmtTime = (iso, lang = 'es', tz) => KZ().fmt(iso, tz, loc(lang), {
    hour: '2-digit', minute: '2-digit',
  });

  /** ¿Mismo día en la zona del negocio? */
  const sameDay = (a, b, tz) => !!a && !!b && KZ().dia(a, tz) === KZ().dia(b, tz);

  /** El final de una franja: solo la hora si acaba el mismo día; si no, con el
   *  día delante («dom 27 sept 10:57»). Como `Formatters.timeRange` en la app. */
  function fmtEnd(startIso, endIso, lang = 'es', tz) {
    if (!endIso) return '';
    return sameDay(startIso, endIso, tz)
      ? fmtTime(endIso, lang, tz)
      : `${fmtDay(endIso, lang, tz)} ${fmtTime(endIso, lang, tz)}`;
  }

  /** El beneficio en una etiqueta: «−20 %», «2x1», «12 €». */
  function benefit(d, priceCents, currency, lang = 'es') {
    if (d) {
      if (d.type === 'percent') return `−${d.value} %`;
      if (d.type === 'fixed') {
        return money(Math.round(Number(d.value) * 100), d.currency || currency, lang);
      }
      if (d.type === '2x1') return '2x1';
      if (d.type === 'free') return lang === 'en' ? 'Free' : 'Gratis';
      // «Segunda unidad al 50 %» lo escribe el negocio: se enseña tal cual, sin
      // traducciones inventadas.
      if (d.type === 'other' && d.value) return String(d.value);
    }
    return priceCents == null ? '' : money(priceCents, currency, lang);
  }

  /** Precio anterior tachado (obligatorio cuando se anuncia una rebaja). */
  const priorPrice = (d, lang = 'es') =>
    d?.compare_at_cents ? money(d.compare_at_cents, d.currency || 'EUR', lang) : '';

  const isVideo = (u) => /\.(mp4|mov|webm)(\?|$)/i.test(u || '');

  /** Las plantillas que la web sabe pintar (el orden del selector de la app). */
  const PLANTILLAS = ['glass', 'photo', 'poster', 'bold', 'minimal'];

  const T = {
    es: {
      flash: 'Oferta flash', event: 'Evento', verOferta: 'Ver oferta', verEvento: 'Ver evento',
      seats: (n) => (n === 1 ? 'Queda 1 plaza' : `Quedan ${n} plazas`), soldOut: 'Agotado',
      antes: 'Antes de cerrar', bolsas: (n) => (n === 1 ? 'Queda 1 bolsa' : `Quedan ${n} bolsas`),
      en: (l) => `en ${l}`, entradas: (p) => `Entradas en ${p}`, video: 'Vídeo',
      organiza: (n) => `Organiza: ${n}`, hoy: 'Hoy', manana: 'Mañana',
      // Quién publica, si es una entidad (migración 20261130100000).
      entidad: { council: 'Ayuntamiento', district: 'Junta de distrito', merchants: 'Asociación de comerciantes',
        neighbours: 'Asociación vecinal', ngo: 'ONG', public_agenda: 'Agenda pública' },
      anterior: 'Foto anterior', siguiente: 'Foto siguiente', sonido: 'Sonido', play: 'Reproducir vídeo',
      galeria: 'Fotos y vídeos', ampliar: 'Ver a pantalla completa', cerrar: 'Cerrar', denunciar: 'Denunciar',
      pieza: (video, i, n) => `${video ? 'Vídeo' : 'Foto'}${n > 1 ? ` ${i} de ${n}` : ''}`,
      // «Ver solo la foto» en Descubre (como `feedHideInfo`… en la app).
      ocultar: 'Ocultar la información', mostrar: 'Mostrar la información',
      oculta: 'Información oculta', aLaVista: 'Información a la vista',
    },
    en: {
      flash: 'Flash offer', event: 'Event', verOferta: 'See offer', verEvento: 'See event',
      seats: (n) => (n === 1 ? '1 place left' : `${n} places left`), soldOut: 'Sold out',
      antes: 'Before closing', bolsas: (n) => (n === 1 ? '1 bag left' : `${n} bags left`),
      en: (l) => `at ${l}`, entradas: (p) => `Tickets on ${p}`, video: 'Video',
      organiza: (n) => `Organised by ${n}`, hoy: 'Today', manana: 'Tomorrow',
      entidad: { council: 'Council', district: 'District council', merchants: "Traders' association",
        neighbours: "Residents' association", ngo: 'NGO', public_agenda: 'Public listings' },
      anterior: 'Previous photo', siguiente: 'Next photo', sonido: 'Sound', play: 'Play video',
      galeria: 'Photos and videos', ampliar: 'View full screen', cerrar: 'Close', denunciar: 'Report',
      pieza: (video, i, n) => `${video ? 'Video' : 'Photo'}${n > 1 ? ` ${i} of ${n}` : ''}`,
      ocultar: 'Hide the details', mostrar: 'Show the details',
      oculta: 'Details hidden', aLaVista: 'Details showing',
    },
  };

  // Iconos de Material en SVG (las páginas públicas no cargan la fuente).
  const IC = {
    cal: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10Zm0-12H5V6h14v2Z',
    rayo: 'M7 2v11h3v9l7-12h-4l4-8z',
    lugar: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
    flecha: 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z',
    play: 'M8 5v14l11-7z',
    izq: 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z',
    mudo: 'M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z',
    sonido: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
    ampliar: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
    // «Ver solo la foto»: expandir (open_in_full) y recoger (close_fullscreen).
    expandir: 'M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z',
    recoger: 'M22 3.41 16.71 8.7 20 12h-8V4l3.29 3.29L20.59 2 22 3.41zM3.41 22l5.29-5.29L12 20v-8H4l3.29 3.29L2 20.59 3.41 22z',
    bandera: 'M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z',
    cerrar: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    // account_balance (outlined): el sello de las entidades, como la app.
    entidad: 'M6.5 10h-2v7h2v-7zm6 0h-2v7h2v-7zm8.5 9H2v2h19v-2zm-2.5-9h-2v7h2v-7zm-7-6.74L16.71 6H6.29l5.21-2.74m0-2.26L2 6v2h19V6l-9.5-5z',
  };
  const ic = (n, s = 16) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${IC[n]}"/></svg>`;

  /** «350 m», «1,2 km» (en: «1.2 km»). */
  function distancia(m, lang = 'es') {
    if (!Number.isFinite(m) || m < 0) return '';
    if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
    const km = m < 10000 ? (Math.round(m / 100) / 10) : Math.round(m / 1000);
    return `${km.toLocaleString(lang === 'en' ? 'en-GB' : 'es-ES')} km`;
  }

  // ── Color con contraste (DISENOS_PUBLICACION.md §4) ─────────────────────────
  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const LUM_TINTA = lum([10, 10, 10]);
  /** [contraste con la tinta #0A0A0A, contraste con el blanco]. */
  const contrastes = (c) => { const l = lum(c); return [(l + 0.05) / (LUM_TINTA + 0.05), 1.05 / (l + 0.05)]; };

  /** El color con el texto encima legible (AA, 4,5:1): si ni la tinta ni el
   * blanco llegan, se aclara u oscurece en pasos de 1/25. Lo mismo que
   * `color_seguro` en la base y `OfferStyle.safeAccent` en la app. null si no es
   * un #RRGGBB. */
  function colorSeguro(hex) {
    const t = String(hex || '').trim();
    if (!/^#?[0-9a-f]{6}$/i.test(t)) return null;
    const h = (t.startsWith('#') ? t : `#${t}`).toUpperCase();
    const c = rgb(h);
    const pasa = (x) => Math.max(...contrastes(x)) >= 4.5;
    if (pasa(c)) return h;
    const [ci, cw] = contrastes(c);
    const destino = ci >= cw ? 255 : 0;
    for (let i = 1; i <= 25; i++) {
      // (x·(25−i) + destino·i) / 25 nunca cae en ,5: el mismo redondeo en todos.
      const m = c.map((x) => Math.round((x * (25 - i) + destino * i) / 25));
      if (pasa(m)) return '#' + m.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    return h;
  }

  /** El estilo de la publicación, saneado: plantilla conocida y color seguro. */
  function estiloDe(o) {
    const s = o?.style && typeof o.style === 'object' ? o.style : {};
    const plantilla = PLANTILLAS.includes(s.template) ? s.template : 'glass';
    return { plantilla, acento: colorSeguro(s.accent) };
  }

  /** Texto legible sobre el acento: tinta o blanco, el que más contraste dé
   * (como `OfferStyle.onColor` en la app). */
  function sobreAcento(hex) {
    const [ci, cw] = contrastes(rgb(hex));
    return ci >= cw ? '#0A0A0A' : '#FFFFFF';
  }

  // ── Entradas fuera de Klendar (DISENOS_PUBLICACION.md §6) ───────────────────
  const PLATAFORMAS = Object.fromEntries((
    `dice.fm=DICE|entradium.com=Entradium|eventbrite.com=Eventbrite|eventbrite.es=Eventbrite|eventbrite.co.uk=Eventbrite|
    eventbrite.ie=Eventbrite|eventbrite.fr=Eventbrite|eventbrite.de=Eventbrite|eventbrite.it=Eventbrite|eventbrite.pt=Eventbrite|
    ticketmaster.es=Ticketmaster|ticketmaster.com=Ticketmaster|ticketmaster.co.uk=Ticketmaster|ticketmaster.ie=Ticketmaster|
    ticketmaster.fr=Ticketmaster|ticketmaster.de=Ticketmaster|feverup.com=Fever|fever.com=Fever|wegow.com=Wegow|tiqets.com=Tiqets|
    taquilla.com=Taquilla.com|ticketea.com=Ticketea|entradas.com=Entradas.com|universe.com=Universe|seetickets.com=See Tickets|
    ra.co=Resident Advisor|residentadvisor.net=Resident Advisor|xceed.me=Xceed|shotgun.live=Shotgun|ticketswap.es=TicketSwap|
    ticketswap.com=TicketSwap|giglon.com=Giglon|atrapalo.com=Atrápalo|eventim.es=Eventim|eventim.de=Eventim|eventim.co.uk=Eventim|
    fnactickets.com=Fnac Tickets|bacantix.com=Bacantix|compralaentrada.com=CompraLaEntrada|redentradas.com=Red Entradas|
    enterticket.es=Enterticket|notikumi.com=Notikumi|tickentradas.com=Tickentradas|koobin.com=Koobin|ticketib.com=Ticketib`
  ).split('|').map((x) => x.trim().split('=')));

  /** `{ plataforma, dominio }` de un enlace de entradas (`plataforma` null si no
   * es una conocida: entonces «Conseguir entradas» y el dominio debajo). */
  function plataformaEntradas(url) {
    const t = String(url || '').trim();
    if (!t) return null;
    let u;
    try { u = new URL(t.includes('://') ? t : `https://${t}`); } catch { return null; }
    let host = u.hostname.toLowerCase();
    for (const pre of ['www.', 'm.']) if (host.startsWith(pre)) host = host.slice(pre.length);
    let plataforma = null;
    for (const [dom, nombre] of Object.entries(PLATAFORMAS)) {
      if (host === dom || host.endsWith(`.${dom}`)) { plataforma = nombre; break; }
    }
    if (!plataforma && (host === 'elcorteingles.es' || host.endsWith('.elcorteingles.es'))
      && u.pathname.toLowerCase().startsWith('/entradas')) plataforma = 'El Corte Inglés';
    return { plataforma, dominio: host };
  }

  /** El sitio de una publicación que no es en el local: su nombre o la primera
   * parte de la dirección; '' si es en el local. */
  function sitioDe(o) {
    if (!o?.venue_address) return '';
    return String(o.venue_name || '').trim() || String(o.venue_address).split(',')[0].trim();
  }

  /** Cuándo, corto: «sáb 4 oct · 12:00» o «vie 2 oct · 14:06 – 18:36». */
  function cuandoCorto(o, lang = 'es', tz = KZ().de(o)) {
    if (o.kind === 'future_event') {
      const ev = o.event_at || o.starts_at;
      // Lo de una entidad sin hora (la agenda pública: todo el día) llega a
      // las 00:00: solo el día, como la app.
      const hora = fmtTime(ev, lang, tz);
      if (o.entity_kind && /^0?0[:.]00$/.test(hora)) return fmtDay(ev, lang, tz);
      return `${fmtDay(ev, lang, tz)} · ${hora}`;
    }
    const ini = o.redeem_start_at || o.starts_at;
    return `${fmtDay(ini, lang, tz)} · ${fmtTime(ini, lang, tz)}${o.redeem_end_at ? ` – ${fmtEnd(ini, o.redeem_end_at, lang, tz)}` : ''}`;
  }

  // ── La agenda pública sin foto ─────────────────────────────────────────
  // Lo importado de los ayuntamientos casi nunca trae foto: la importación le
  // pone la imagen genérica de su categoría (`business-images/agenda/<cat>.webp`,
  // que sirve para la vista previa de un enlace compartido). Como foto quedaba
  // pobre (un icono gris sobre negro): aquí se reconoce por su dirección, se
  // quita de las fotos y se pinta el fondo del color de la categoría con su
  // icono en grande y apagado, como `AgendaArt` en la app (los mismos colores
  // e iconos de Material, Apache 2.0). Sin «Ver solo la foto».
  const AGENDA_ARTE = {
    stage: ['#5B2A6E', 'M18 6.52C18 5.95 18.47 5.48 18.98 5.48C19.55 5.48 20.02 5.95 20.02 6.52C20.02 7.03 19.55 7.5 18.98 7.5C18.47 7.5 18 7.03 18 6.52ZM14.02 6.52C14.02 5.95 14.44 5.48 15 5.48C15.56 5.48 15.98 5.95 15.98 6.52C15.98 7.03 15.56 7.5 15 7.5C14.44 7.5 14.02 7.03 14.02 6.52ZM16.97 9C15.61 9 14.48 9.84 14.48 10.88H19.5C19.5 9.84 18.38 9 16.97 9ZM0.98 15.98C0.98 19.31 3.7 21.98 6.98 21.98C10.31 21.98 12.98 19.31 12.98 15.98V9H0.98V15.98ZM3 11.02H11.02V15.98C11.02 18.19 9.19 20.02 6.98 20.02C4.78 20.02 3 18.19 3 15.98V11.02ZM11.02 2.02V7.5H12.98V3.98H21V9C21 11.2 19.22 12.98 17.02 12.98C16.03 12.98 15.19 12.66 14.48 12.09V14.44C15.28 14.81 16.12 15 17.02 15C20.3 15 23.02 12.33 23.02 9V2.02H11.02ZM3.98 13.5C3.98 12.94 4.45 12.52 5.02 12.52C5.53 12.52 6 12.94 6 13.5C6 14.06 5.53 14.48 5.02 14.48C4.45 14.48 3.98 14.06 3.98 13.5ZM8.02 13.5C8.02 12.94 8.44 12.52 9 12.52C9.56 12.52 9.98 12.94 9.98 13.5C9.98 14.06 9.56 14.48 9 14.48C8.44 14.48 8.02 14.06 8.02 13.5ZM6.98 17.86C8.39 17.86 9.52 17.06 9.52 15.98H4.5C4.5 17.06 5.62 17.86 6.98 17.86Z'],
    music: ['#2E3A78', 'M12 3V13.55C11.44 13.22 10.73 12.98 10.03 12.98C7.78 12.98 6 14.81 6 17.02C6 19.22 7.78 21 10.03 21C12.23 21 14.02 19.22 14.02 17.02V6.98H18V3H12ZM10.03 18.98C8.91 18.98 8.02 18.09 8.02 17.02C8.02 15.89 8.91 15 10.03 15C11.11 15 12 15.89 12 17.02C12 18.09 11.11 18.98 10.03 18.98Z'],
    culture: ['#1F5A5C', 'M21.98 11.02V9L12 2.02L2.02 9V11.02H3.98V20.02H2.02V21.98H21.98V20.02H20.02V11.02H21.98ZM18 20.02H6V9H18V20.02ZM9.98 14.02 12 17.02 14.02 14.02V18H15.98V11.02H14.02L12 14.02L9.98 11.02H8.02V18H9.98V14.02Z'],
    art: ['#7E2C46', 'M12 21.98C6.47 21.98 2.02 17.53 2.02 12C2.02 6.47 6.47 2.02 12 2.02C17.53 2.02 21.98 6.05 21.98 11.02C21.98 14.3 19.31 17.02 15.98 17.02H14.25C13.97 17.02 13.73 17.2 13.73 17.48C13.73 17.62 13.78 17.72 13.88 17.81C14.25 18.28 14.48 18.89 14.48 19.5C14.48 20.86 13.36 21.98 12 21.98ZM12 3.98C7.59 3.98 3.98 7.59 3.98 12C3.98 16.41 7.59 20.02 12 20.02C12.28 20.02 12.52 19.78 12.52 19.5C12.52 19.36 12.42 19.22 12.38 19.17C11.95 18.7 11.72 18.09 11.72 17.48C11.72 16.12 12.84 15 14.25 15H15.98C18.19 15 20.02 13.22 20.02 11.02C20.02 7.12 16.41 3.98 12 3.98ZM5.02 11.48C5.02 10.69 5.67 9.98 6.52 9.98C7.31 9.98 8.02 10.69 8.02 11.48C8.02 12.33 7.31 12.98 6.52 12.98C5.67 12.98 5.02 12.33 5.02 11.48ZM8.02 7.5C8.02 6.66 8.67 6 9.52 6C10.31 6 11.02 6.66 11.02 7.5C11.02 8.34 10.31 9 9.52 9C8.67 9 8.02 8.34 8.02 7.5ZM12.98 7.5C12.98 6.66 13.69 6 14.48 6C15.33 6 15.98 6.66 15.98 7.5C15.98 8.34 15.33 9 14.48 9C13.69 9 12.98 8.34 12.98 7.5ZM15.98 11.48C15.98 10.69 16.69 9.98 17.48 9.98C18.33 9.98 18.98 10.69 18.98 11.48C18.98 12.33 18.33 12.98 17.48 12.98C16.69 12.98 15.98 12.33 15.98 11.48Z'],
    learning: ['#2B4A6B', 'M12 3 0.98 9 5.02 11.2V17.2L12 21L18.98 17.2V11.2L21 10.08V17.02H23.02V9L12 3ZM18.8 9 12 12.7 5.2 9 12 5.3 18.8 9ZM17.02 15.98 12 18.7 6.98 15.98V12.28L12 15L17.02 12.28V15.98Z'],
    family: ['#7A4316', 'M13.27 10.5C13.27 9.8 13.83 9.23 14.48 9.23C15.19 9.23 15.75 9.8 15.75 10.5C15.75 11.2 15.19 11.77 14.48 11.77C13.83 11.77 13.27 11.2 13.27 10.5ZM8.25 10.5C8.25 9.8 8.81 9.23 9.52 9.23C10.17 9.23 10.73 9.8 10.73 10.5C10.73 11.2 10.17 11.77 9.52 11.77C8.81 11.77 8.25 11.2 8.25 10.5ZM22.92 11.34C22.69 9.84 21.56 8.58 20.11 8.16C19.59 7.03 18.84 6.05 17.95 5.25C16.36 3.84 14.3 3 12 3C9.7 3 7.64 3.84 6.05 5.25C5.16 6.05 4.41 7.08 3.89 8.16C2.44 8.58 1.31 9.8 1.08 11.34C1.03 11.53 0.98 11.77 0.98 12C0.98 12.23 1.03 12.47 1.08 12.66C1.31 14.16 2.44 15.42 3.89 15.84C4.41 16.92 5.16 17.91 6.05 18.7C7.64 20.16 9.7 21 12 21C14.3 21 16.36 20.16 17.95 18.7C18.89 17.91 19.64 16.92 20.16 15.84C21.56 15.42 22.69 14.2 22.92 12.66C22.97 12.47 23.02 12.23 23.02 12C23.02 11.77 22.97 11.53 22.92 11.34ZM18.98 14.02C18.89 14.02 18.8 13.97 18.7 13.97C18.52 14.62 18.23 15.28 17.86 15.84C16.59 17.72 14.44 18.98 12 18.98C9.56 18.98 7.41 17.72 6.14 15.84C5.77 15.28 5.48 14.62 5.3 13.97C5.2 13.97 5.11 14.02 5.02 14.02C3.89 14.02 3 13.08 3 12C3 10.92 3.89 9.98 5.02 9.98C5.11 9.98 5.2 10.03 5.3 10.03C5.48 9.38 5.77 8.72 6.14 8.16C7.41 6.28 9.56 5.02 12 5.02C14.44 5.02 16.59 6.28 17.86 8.16C18.23 8.72 18.52 9.38 18.7 10.03C18.8 10.03 18.89 9.98 18.98 9.98C20.11 9.98 21 10.92 21 12C21 13.08 20.11 14.02 18.98 14.02ZM12 17.02C14.02 17.02 15.75 15.75 16.5 14.02H7.5C8.25 15.75 9.98 17.02 12 17.02Z'],
    experiences: ['#1D5670', 'M21 3.98H6.98V2.02H5.02V21.98H6.98V14.02H21L18.98 9L21 3.98ZM17.16 9.75 18.05 12H6.98V6H18.05L17.16 8.25L16.83 9L17.16 9.75ZM14.02 9C14.02 10.08 13.08 11.02 12 11.02C10.92 11.02 9.98 10.08 9.98 9C9.98 7.92 10.92 6.98 12 6.98C13.08 6.98 14.02 7.92 14.02 9Z'],
    sport: ['#2F5E2E', 'M13.5 5.48C14.58 5.48 15.47 4.59 15.47 3.47C15.47 2.39 14.58 1.5 13.5 1.5C12.38 1.5 11.48 2.39 11.48 3.47C11.48 4.59 12.38 5.48 13.5 5.48ZM9.89 19.36 10.88 15 12.98 16.97V22.97H15V15.47L12.89 13.5L13.5 10.5C14.81 12 16.78 12.98 18.98 12.98V10.97C17.11 10.97 15.47 9.98 14.67 8.58L13.69 6.98C13.31 6.38 12.7 6 12 6C11.67 6 11.48 6.09 11.2 6.09L6 8.3V12.98H7.97V9.56L9.8 8.86L8.2 16.97L3.28 15.98L2.91 18L9.89 19.36Z'],
    market: ['#65511C', 'M21.89 8.91 20.86 4.5C20.62 3.61 19.83 3 18.94 3H5.06C4.17 3 3.38 3.61 3.14 4.5L2.11 8.91C1.88 9.89 2.06 10.97 2.72 11.77C2.81 11.86 2.91 11.95 3 12.05V18.98C3 20.11 3.89 21 5.02 21H18.98C20.11 21 21 20.11 21 18.98V12.05C21.09 11.95 21.19 11.86 21.28 11.77C21.94 10.97 22.17 9.89 21.89 8.91ZM18.89 4.97 19.97 9.38C20.06 9.8 19.97 10.22 19.69 10.55C19.55 10.69 19.27 11.02 18.75 11.02C18.14 11.02 17.62 10.5 17.58 9.84L16.97 5.02L18.89 4.97ZM12.98 5.02H14.95L15.52 9.52C15.56 9.89 15.42 10.31 15.19 10.59C14.95 10.83 14.62 11.02 14.2 11.02C13.55 11.02 12.98 10.41 12.98 9.7V5.02ZM8.48 9.52 9.05 5.02H11.02V9.7C11.02 10.41 10.45 11.02 9.7 11.02C9.38 11.02 9.05 10.83 8.81 10.59C8.58 10.31 8.44 9.89 8.48 9.52ZM4.03 9.38 5.06 5.02H7.03L6.42 9.84C6.38 10.5 5.86 11.02 5.25 11.02C4.73 11.02 4.45 10.69 4.31 10.55C4.03 10.22 3.94 9.8 4.03 9.38ZM5.02 18.98V12.98C5.06 12.98 5.16 12.98 5.25 12.98C6.09 12.98 6.89 12.66 7.45 12.05C8.06 12.66 8.86 12.98 9.8 12.98C10.64 12.98 11.44 12.66 12 12.05C12.61 12.66 13.41 12.98 14.3 12.98C15.14 12.98 15.94 12.66 16.55 12.05C17.11 12.66 17.91 12.98 18.8 12.98C18.84 12.98 18.94 12.98 19.03 12.98V18.98H5.02Z'],
    games: ['#732454', 'M2.02 21.98 15.98 17.02 6.98 8.02 2.02 21.98ZM12.33 16.17 5.3 18.7 7.83 11.67 12.33 16.17ZM14.53 12.52 20.11 6.94C20.62 6.47 21.42 6.47 21.89 6.94L22.5 7.55L23.53 6.47L22.97 5.86C21.89 4.83 20.11 4.83 19.08 5.86L13.45 11.48L14.53 12.52ZM10.08 6.89 9.47 7.45 10.55 8.53 11.11 7.92C12.19 6.89 12.19 5.11 11.11 4.03L10.55 3.47L9.47 4.55L10.08 5.11C10.55 5.58 10.55 6.42 10.08 6.89ZM17.06 11.86 15.47 13.45 16.55 14.53 18.14 12.94C18.61 12.47 19.41 12.47 19.88 12.94L21.52 14.53L22.55 13.5L20.95 11.86C19.88 10.83 18.14 10.83 17.06 11.86ZM15.05 5.86 11.48 9.47 12.52 10.55 16.12 6.94C17.2 5.86 17.2 4.12 16.12 3.05L14.53 1.45L13.45 2.53L15.05 4.12C15.56 4.59 15.56 5.39 15.05 5.86Z'],
    books: ['#5A4431', 'M21 5.02C19.88 4.64 18.66 4.5 17.48 4.5C15.56 4.5 13.45 4.92 12 6C10.55 4.92 8.44 4.5 6.52 4.5C4.55 4.5 2.44 4.92 0.98 6V20.67C0.98 20.91 1.27 21.14 1.5 21.14C1.59 21.14 1.64 21.09 1.73 21.09C3.09 20.44 5.06 20.02 6.52 20.02C8.44 20.02 10.55 20.39 12 21.52C13.36 20.67 15.8 20.02 17.48 20.02C19.17 20.02 20.86 20.3 22.27 21.05C22.36 21.09 22.41 21.09 22.5 21.09C22.73 21.09 23.02 20.86 23.02 20.58V6C22.41 5.53 21.75 5.25 21 5.02ZM21 18.52C19.92 18.14 18.7 18 17.48 18C15.8 18 13.36 18.66 12 19.5V8.02C13.36 7.17 15.8 6.52 17.48 6.52C18.7 6.52 19.92 6.66 21 6.98V18.52ZM17.48 10.5C18.38 10.5 19.22 10.59 20.02 10.78V9.23C19.22 9.09 18.38 9 17.48 9C15.8 9 14.25 9.28 12.98 9.84V11.48C14.11 10.83 15.7 10.5 17.48 10.5ZM12.98 12.47V14.16C14.11 13.5 15.7 13.17 17.48 13.17C18.38 13.17 19.22 13.27 20.02 13.41V11.91C19.22 11.77 18.38 11.67 17.48 11.67C15.8 11.67 14.25 11.95 12.98 12.47ZM17.48 14.34C15.8 14.34 14.25 14.62 12.98 15.14V16.83C14.11 16.17 15.7 15.84 17.48 15.84C18.38 15.84 19.22 15.94 20.02 16.08V14.58C19.22 14.39 18.38 14.34 17.48 14.34Z'],
    civic: ['#3A4654', 'M6.52 9.98H4.5V17.02H6.52V9.98ZM12.52 9.98H10.5V17.02H12.52V9.98ZM21 18.98H2.02V21H21V18.98ZM18.52 9.98H16.5V17.02H18.52V9.98ZM11.48 3.28 16.69 6H6.28L11.48 3.28ZM11.48 0.98 2.02 6V8.02H21V6L11.48 0.98Z'],
  };
  const RE_GENERICA = /\/storage\/v1\/object\/public\/business-images\/agenda\/([a-z0-9_-]+)\.webp(?:[?#]|$)/;
  /** ¿Es `u` la imagen genérica de la agenda (no una foto)? */
  const esGenerica = (u) => typeof u === 'string' && RE_GENERICA.test(u);
  /** La categoría del diseño sin foto de `o` (o null si trae foto o vídeo). */
  function arteDe(o) {
    const imgs = (o?.images || []).filter((u) => typeof u === 'string');
    if (imgs.some((u) => !esGenerica(u))) return null;
    const m = imgs.map((u) => RE_GENERICA.exec(u)).find(Boolean);
    return m ? m[1] : null;
  }
  /** El fondo del diseño sin foto (`compacto`: miniatura, el icono a la vista). */
  function arteHtml(cat, { compacto = false } = {}) {
    const [color, d] = AGENDA_ARTE[cat] || ['#3A4654', AGENDA_ARTE.civic[1]];
    return `<span class="tj-arte${compacto ? ' tj-arte--mini' : ''}" style="--arte:${color}" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg></span>`;
  }

  /** La pieza de foto o vídeo de la tarjeta. El vídeo va en silencio y sin
   * cargar nada hasta que se ve; `/assets/tarjetas.js` lo reproduce mientras
   * está a la vista (no con «reducir movimiento» ni con ahorro de datos). Sin
   * JavaScript se ve la foto de portada. */
  function mediaTarjeta(o, { primera, ancho, alto, S }) {
    const piezas = soloWeb(o.images);
    const arte = piezas.length ? null : arteDe(o);
    if (arte) return arteHtml(arte, { compacto: ancho < 200 });
    const foto = piezas.find((u) => !isVideo(u)) || o.business_cover || null;
    const video = piezas[0] && isVideo(piezas[0]) ? piezas[0] : null;
    const carga = primera ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
    if (video) {
      // Con portada: no se pide nada del vídeo hasta que se va a reproducir.
      // Sin portada: solo los metadatos, para enseñar el primer fotograma.
      return `<video class="tj-img" muted playsinline loop disablepictureinpicture preload="${foto ? 'none' : 'metadata'}"
      ${foto ? `poster="${esc(foto)}"` : ''} data-src="${esc(video)}${foto ? '' : '#t=0.1'}" width="${ancho}" height="${alto}" aria-hidden="true"></video>
      ${foto ? '' : `<noscript><span class="tj-ph" aria-hidden="true">${ic('play', 34)}</span></noscript>`}
      <span class="tj-video" aria-hidden="true">${ic('play', 14)}<span class="sr">${esc(S.video)}</span></span>`;
    }
    if (foto) return `<img class="tj-img" src="${esc(foto)}" alt="" width="${ancho}" height="${alto}" ${carga}>`;
    // Sin foto: la inicial del negocio sobre un fondo neutro (nunca un hueco).
    return `<span class="tj-ph" aria-hidden="true">${esc((o.business_name || o.title || '·').trim().charAt(0).toUpperCase())}</span>`;
  }

  /** Todas las fotos y vídeos de la publicación, como la galería de la app:
   * se deslizan de lado (con el dedo, o con las flechas en el escritorio) y
   * los puntos dicen cuál es. Cada pieza lleva a la ficha, como la tarjeta.
   * Los vídeos empiezan en silencio; el altavoz les pone el sonido
   * (`/assets/tarjetas.js`). Sin JavaScript se deslizan igual. */
  function galeriaTarjeta(o, { primera, ancho, alto, S, href }) {
    const piezas = soloWeb(o.images).slice(0, 8);
    if (piezas.length < 2 && !(piezas[0] && isVideo(piezas[0]))) {
      return `<a class="tj-pieza" href="${esc(href)}" tabindex="-1" aria-hidden="true">${mediaTarjeta(o, { primera, ancho, alto, S })}</a>`;
    }
    return galeria(piezas, { modo: 'tarjeta', primera, ancho, alto, S, href, portada: o.business_cover });
  }

  /** Solo enlaces https (lo que sube la gente o el negocio nunca es otra
   * cosa) y sin la imagen genérica de la agenda (no es una foto: `arteDe`). */
  const soloWeb = (urls) => (urls || []).filter((u) => typeof u === 'string' && /^https:\/\//.test(u) && !esGenerica(u));

  /**
   * La galería de fotos y vídeos: UNA para la tarjeta, la ficha y el visor a
   * pantalla completa (como `GalleryDots` + `InlineVideo` + `showPhotoViewer`
   * en la app). El comportamiento (deslizar, puntos, flechas, sonido, el
   * visor) lo pone `/assets/tarjetas.js`; sin JavaScript se desliza igual.
   *
   * - `tarjeta`: cada pieza lleva a la ficha (`href`); los puntos arriba.
   * - `ficha`: la cabecera de la ficha de una publicación o de un negocio.
   *   Tocar una pieza (o «Ver a pantalla completa») abre el visor con las
   *   mismas piezas (`grupo`); sin JavaScript, la pieza abre el archivo.
   * - `visor`: dentro del visor (`visor()`): la pieza entera (sin recortar),
   *   flechas siempre en el escritorio y el contador fuera, en la barra.
   *
   * Los vídeos empiezan en silencio; el altavoz les pone el sonido. La
   * portada de un vídeo es la foto siguiente (o la primera, o `portada`).
   */
  function galeria(urls, o = {}) {
    const modo = o.modo === 'ficha' || o.modo === 'visor' ? o.modo : 'tarjeta';
    const S = o.S || T[o.lang === 'en' ? 'en' : 'es'];
    const piezas = piezasDe(urls).slice(0, o.max || 8);
    const n = piezas.length;
    if (!n) return '';
    const [ancho, alto] = [o.ancho || 900, o.alto || 1125];
    const fotos = piezas.filter((p) => !p.video).map((p) => p.url);
    const portadaDe = (i) => piezas[i].poster
      || fotos.find((u) => piezas.findIndex((p) => p.url === u) > i) || fotos[0] || o.portada || null;
    // En el visor cada pieza se anuncia («Foto 2 de 3»); fuera, el grupo y
    // el estado ya lo dicen y las piezas no se leen.
    const nombre = (p, i) => (modo === 'visor' ? `aria-label="${esc(S.pieza(p.video, i + 1, n))}"` : 'aria-hidden="true"');
    const media = (p, i) => {
      if (p.video) {
        const por = portadaDe(i);
        return `<video class="tj-img" muted playsinline loop disablepictureinpicture preload="${por ? 'none' : 'metadata'}"
        ${por ? `poster="${esc(por)}"` : ''} data-src="${esc(p.url)}${por ? '' : '#t=0.1'}" width="${ancho}" height="${alto}" ${nombre(p, i)}></video>`;
      }
      const carga = o.primera && i === 0 ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
      return `<img class="tj-img" src="${esc(p.url)}" alt="${modo === 'visor' ? esc(S.pieza(false, i + 1, n)) : ''}" width="${ancho}" height="${alto}" ${carga}>`;
    };
    const grupo = esc(o.grupo || 'ficha');
    const pieza = (p, i) => {
      const clase = `tj-pieza${p.video ? ' es-video' : ''}`;
      if (modo === 'visor') return `<div class="${clase}"${p.denuncia ? ` data-denuncia="${esc(p.denuncia)}"` : ''}>${media(p, i)}</div>`;
      const destino = modo === 'ficha' ? `${esc(p.url)}" data-visor="${grupo}" data-visor-i="${i}` : esc(o.href || '#');
      return `<a class="${clase}" href="${destino}" tabindex="-1" aria-hidden="true">${media(p, i)}</a>`;
    };
    const hayVideo = piezas.some((p) => p.video);
    const etiqueta = modo === 'tarjeta' ? ''
      : ` role="group" aria-label="${esc(o.titulo ? `${S.galeria}: ${o.titulo}` : S.galeria)}"`;
    return `<div class="tj-galeria tj-galeria--${modo}" data-n="${n}"${etiqueta}>
      <div class="tj-pista">${piezas.map(pieza).join('')}</div>
      ${n > 1 && modo !== 'visor' ? `<span class="tj-puntos" aria-hidden="true">${piezas.map((_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</span>` : ''}
      ${n > 1 ? `<button type="button" class="tj-flecha tj-ant" data-galeria="-1" aria-label="${esc(S.anterior)}" hidden>${ic('izq', 22)}</button>
      <button type="button" class="tj-flecha tj-sig" data-galeria="1" aria-label="${esc(S.siguiente)}" hidden>${ic('flecha', 22)}</button>` : ''}
      ${hayVideo ? `<button type="button" class="tj-sonido" aria-pressed="false" aria-label="${esc(S.sonido)}" title="${esc(S.sonido)}" hidden>${ic('mudo', 20)}${ic('sonido', 20)}</button>
      <button type="button" class="tj-play" aria-label="${esc(S.play)}" hidden>${ic('play', 30)}</button>` : ''}
      ${modo === 'ficha' ? `<button type="button" class="tj-ampliar" data-visor-abre aria-label="${esc(S.ampliar)}" title="${esc(S.ampliar)}" hidden>${ic('ampliar', 22)}</button>
      ${n > 1 ? `<span class="sr tj-estado" aria-live="polite"></span>` : ''}` : ''}
    </div>`;
  }

  /** Las piezas, como `{ url, video, poster }`. Vale una lista de direcciones
   * (el tipo, por la extensión) o de objetos: `{ url, kind: 'photo'|'video',
   * poster_url }` (los medios de una reseña) o `{ url, video, poster }`. */
  function piezasDe(lista) {
    return (lista || []).map((x) => {
      if (typeof x === 'string') return { url: x, video: isVideo(x), poster: null };
      if (!x || typeof x !== 'object') return null;
      const video = x.video != null ? Boolean(x.video) : x.kind ? x.kind === 'video' : isVideo(x.url);
      const poster = soloWeb([x.poster || x.poster_url])[0] || null;
      const ms = Number(x.duration_ms);
      return {
        url: x.url, video, poster: video ? poster : null,
        // Dónde se denuncia esta pieza sola (los medios de una reseña).
        denuncia: typeof x.denuncia === 'string' && /^\/[^/]/.test(x.denuncia) ? x.denuncia : null,
        duracion: video && Number.isFinite(ms) && ms > 0 ? ms : null,
      };
    }).filter((p) => p && soloWeb([p.url]).length);
  }

  /**
   * Una miniatura que abre el visor (las fotos de la carta, un plato, una
   * novedad, los medios de una reseña). Las del mismo `grupo` se ven juntas
   * en el visor, en el orden de `i`. Sin JavaScript abre el archivo.
   * Un vídeo enseña su portada (`poster_url`) o, si no tiene, su primer
   * fotograma (se pide al acercarse, ver `/assets/tarjetas.js`), con el
   * triángulo de reproducir encima. `u`: dirección u objeto (ver `piezasDe`).
   */
  function miniatura(u, { grupo, i = 0, n = 1, clase = 'mini', etiqueta = '', lang = 'es', ancho = 192, alto = 192, carga = 'lazy' }) {
    const p = piezasDe([u])[0];
    if (!p) return '';
    const S = T[lang === 'en' ? 'en' : 'es'];
    const nombre = n === 1 && etiqueta ? `${S.ampliar}: ${etiqueta}`
      : `${S.ampliar}: ${S.pieza(p.video, i + 1, n)}${etiqueta ? ` · ${etiqueta}` : ''}`;
    const img = (src) => `<img src="${esc(src)}" alt="" width="${ancho}" height="${alto}" loading="${carga === 'eager' ? 'eager' : 'lazy'}" decoding="async">`;
    const extra = `${p.video ? ' data-visor-video="1"' : ''}${p.poster ? ` data-visor-poster="${esc(p.poster)}"` : ''}${p.denuncia ? ` data-visor-denuncia="${esc(p.denuncia)}"` : ''}`;
    return `<a class="${esc(clase)}${p.video ? ' es-video' : ''}" href="${esc(p.url)}" data-visor="${esc(grupo)}" data-visor-i="${i}"${extra} aria-label="${esc(nombre)}">${p.video
      ? `${p.poster ? img(p.poster) : `<video muted playsinline preload="none" data-mini="${esc(p.url)}#t=0.1" width="${ancho}" height="${alto}" aria-hidden="true"></video>`}<span class="mini-play" aria-hidden="true">${ic('play', 22)}</span>${p.duracion ? `<span class="mini-dur" aria-hidden="true">${duracionTxt(p.duracion)}</span>` : ''}`
      : img(p.url)}</a>`;
  }

  /** «0:12», «1:05»: lo que dura un vídeo. */
  const duracionTxt = (ms) => {
    const sg = Math.max(1, Math.round(ms / 1000));
    return `${Math.floor(sg / 60)}:${String(sg % 60).padStart(2, '0')}`;
  };

  /** Varias miniaturas seguidas, del mismo grupo. */
  const miniaturas = (urls, { grupo, lang = 'es', clase = 'miniaturas', etiqueta = '' }) => {
    const l = piezasDe(urls);
    return l.length ? `<div class="${esc(clase)}">${l.map((p, i) => miniatura(p, { grupo, i, n: l.length, lang, etiqueta })).join('')}</div>` : '';
  };

  /** El visor a pantalla completa (lo abre `/assets/tarjetas.js`): como
   * `showPhotoViewer` en la app, fondo negro, «Cerrar» arriba a la izquierda
   * y «2 / 3» a la derecha. Escape o deslizar hacia abajo lo cierran.
   * `urls`: direcciones u objetos (ver `piezasDe`). */
  function visor(urls, { lang = 'es', i = 0 } = {}) {
    const S = T[lang === 'en' ? 'en' : 'es'];
    const l = piezasDe(urls);
    const n = l.length;
    const j = Math.max(0, Math.min(n - 1, i));
    return `<dialog class="visor" aria-label="${esc(S.galeria)}">
      <div class="visor-barra">
        <button type="button" class="visor-cerrar" data-visor-cierra aria-label="${esc(S.cerrar)}" title="${esc(S.cerrar)}" autofocus>${ic('cerrar', 24)}</button>
        <span class="visor-der">
          ${l.some((p) => p.denuncia) ? `<a class="visor-denuncia" href="${esc(l[j].denuncia || '#')}" rel="nofollow"${l[j].denuncia ? '' : ' hidden'}>${ic('bandera', 18)}<span>${esc(S.denunciar)}</span></a>` : ''}
          ${n > 1 ? `<span class="visor-n"><span aria-hidden="true">${j + 1} / ${n}</span><span class="sr" aria-live="polite">${esc(S.pieza(l[j].video, j + 1, n))}</span></span>` : ''}
        </span>
      </div>
      ${galeria(l, { modo: 'visor', lang, ancho: 1080, alto: 1350 })}
    </dialog>`;
  }

  /**
   * Una tarjeta de publicación.
   *
   * @param {object} o  fila de `public_explore`, `business_offers`, `public_city_agenda`…
   * @param {'es'|'en'} lang
   * @param {object} [opts]
   * @param {'grande'|'fila'|'pantalla'} [opts.forma='grande']  `pantalla`: una
   *   por pantalla (el feed de Descubre), con la foto o el vídeo de fondo
   * @param {boolean} [opts.galeria]  todas las fotos y vídeos (Descubre y Explorar)
   * @param {string} [opts.tz]  zona del negocio (si no, la de sus coordenadas)
   * @param {boolean} [opts.primera]  la primera de la página (LCP): su foto se pide ya
   * @param {'h2'|'h3'} [opts.h='h3']  nivel del título según la página
   * @param {boolean} [opts.desc]  con la descripción (Descubre, como la app)
   * @param {boolean} [opts.sinNegocio]  en la ficha del negocio, el nombre sobra
   * @param {string} [opts.href]  a dónde lleva (el panel: editarla); si no, su ficha
   */
  function tarjeta(o, lang = 'es', opts = {}) {
    const en = lang === 'en';
    const S = T[en ? 'en' : 'es'];
    const tz = opts.tz || KZ().de(o);
    const h = opts.h === 'h2' ? 'h2' : 'h3';
    const flash = o.kind === 'flash_offer';
    const href = opts.href || `${en ? '/en' : ''}/o/${encodeURIComponent(o.id)}`;
    const precio = benefit(o.discount, o.price_cents, o.currency, lang);
    const antes = priorPrice(o.discount, lang);
    const dist = o.distance_m == null ? '' : distancia(Number(o.distance_m), lang);
    const ini = flash ? (o.redeem_start_at || o.starts_at) : (o.event_at || o.starts_at);
    const sitio = sitioDe(o);
    const lugar = sitio ? S.en(sitio) : '';
    const plataforma = o.ticket_platform || plataformaEntradas(o.external_url)?.plataforma || null;
    const agotado = o.status === 'sold_out' || (o.seats_left != null && Number(o.seats_left) <= 0);
    // «Antes de cerrar» (`style.badge`): lo que sobra del día. Su sello va
    // donde el tipo y las plazas son bolsas.
    const antesCierre = flash && o.style?.badge === 'before_closing';
    const quedan = (n) => (antesCierre ? S.bolsas(n) : S.seats(n));
    // Distancia en el navegador si la página no la sabe (ver /assets/tarjetas.js).
    const geo = !dist && Number.isFinite(o.lat) && Number.isFinite(o.lng)
      ? ` data-lat="${Number(o.lat).toFixed(5)}" data-lng="${Number(o.lng).toFixed(5)}"` : '';
    const cuentaAtras = flash && o.redeem_end_at
      ? ` data-ini="${esc(ini || '')}" data-fin="${esc(o.redeem_end_at)}"` : '';

    if (opts.forma === 'fila') {
      const hora = fmtTime(ini, lang, tz);
      return `<article class="tj tj-fila" data-o="${esc(o.id)}"${geo}>
    <div class="tj-media">${mediaTarjeta(o, { primera: false, ancho: 72, alto: 72, S })}</div>
    <div class="tj-cuerpo">
      <p class="tj-datos"><span class="tj-hora">${esc(hora)}</span>${flash ? `<span class="tj-rayo" title="${esc(S.flash)}">${ic('rayo', 14)}<span class="sr">${esc(S.flash)}</span></span>` : ''}${antesCierre ? `<span class="tj-chip">${esc(S.antes)}</span>` : ''}${precio ? `<span class="tj-precio">${esc(precio)}</span>` : ''}${agotado ? `<span class="tj-chip">${esc(S.soldOut)}</span>` : ''}</p>
      <${h} class="tj-titulo"><a class="tj-enlace" href="${esc(href)}">${esc(o.title)}</a></${h}>
      <p class="tj-negocio">${esc(o.business_name || '')}${lugar ? ` · ${esc(lugar)}` : ''}<span class="tj-dist">${dist ? ` · ${esc(dist)}` : ''}</span></p>
      <div class="tj-amigos"></div>
    </div>
    <span class="tj-chevron" aria-hidden="true">${ic('flecha', 20)}</span>
  </article>`;
    }

    const { plantilla, acento } = estiloDe(o);
    const estilo = acento ? ` style="--tj-acento:${acento};--tj-sobre:${sobreAcento(acento)}"` : '';
    const titulo = `<${h} class="tj-titulo"><a class="tj-enlace" href="${esc(href)}">${esc(o.title)}</a></${h}>`;
    // «Cartel»: la fecha arriba, en un bloque del color (mayúsculas).
    const kicker = plantilla === 'poster' && ini
      ? `<span class="tj-kicker">${esc(cuandoCorto(o, lang, tz).replace(/[.,]/g, '').toUpperCase())}</span>` : '';
    const datos = [
      precio ? `<span class="tj-precio">${esc(precio)}</span>` : '',
      antes ? `<s class="tj-antes">${esc(antes)}</s>` : '',
      // En «Cartel», la fecha de un evento ya va arriba (el antetítulo).
      plantilla === 'poster' && !flash ? ''
        : `<span class="tj-chip tj-cuando"${cuentaAtras}>${ic(flash ? 'rayo' : 'cal', 15)}<span>${esc(cuandoCorto(o, lang, tz))}</span></span>`,
      agotado ? `<span class="tj-chip">${esc(S.soldOut)}</span>`
        : o.seats_left != null && Number(o.seats_left) <= 20 ? `<span class="tj-chip">${esc(quedan(Number(o.seats_left)))}</span>` : '',
      plataforma ? `<span class="tj-chip">${esc(S.entradas(plataforma))}</span>` : '',
    ].filter(Boolean).join('');
    const logo = o.business_logo && /^https:\/\//.test(o.business_logo)
      ? `<img class="tj-logo" src="${esc(o.business_logo)}" alt="" width="24" height="24" loading="lazy" decoding="async">` : '';
    const pantalla = opts.forma === 'pantalla';
    // El tipo («Evento», «Oferta flash», «Antes de cerrar»): sobre la foto en
    // la rejilla; en Descubre (una por pantalla), pegado al panel, como los
    // sellos de la app: arriba, entre los filtros y los avisos, tapaba la
    // foto (Iván, 2026-10-06). Ahí van también «De la lista de…» (fijada.js).
    const tipo = `<span class="tj-tipo">${esc(antesCierre ? S.antes : flash ? S.flash : S.event)}</span>`;
    // Ayuntamiento, asociación, ONG o la agenda pública: en Descubre, con los
    // sellos; en la rejilla, una línea encima del negocio.
    const entidad = S.entidad[o.entity_kind] || '';
    const selloEntidad = entidad ? `<span class="tj-sello tj-sello--entidad">${ic('entidad', 14)}<span>${esc(entidad)}</span></span>` : '';
    const [ancho, alto] = pantalla ? [540, 960] : [480, 600];
    // «Ver solo la foto» (Descubre, con foto o vídeo): esconde el panel, los
    // sellos y lo de encima de la foto, y el mismo botón lo devuelve. Lo
    // enseña y lo maneja /assets/tarjetas.js en Descubre (sin JavaScript, o
    // en la vista previa del panel, no sale).
    const solo = pantalla && soloWeb(o.images).length > 0;
    const botonSolo = solo
      ? `<button type="button" class="tj-solo" aria-label="${esc(S.ocultar)}" title="${esc(S.ocultar)}" data-ocultar="${esc(S.ocultar)}" data-mostrar="${esc(S.mostrar)}" data-oculta="${esc(S.oculta)}" data-vista="${esc(S.aLaVista)}" hidden>${ic('expandir', 20)}${ic('recoger', 20)}</button>`
      : '';
    return `<article class="tj tj--${plantilla}${opts.desc ? ' tj--desc' : ''}${pantalla ? ' tj--pantalla' : ''}" data-o="${esc(o.id)}"${geo}${estilo}>
    <div class="tj-media">
      ${opts.galeria || pantalla ? galeriaTarjeta(o, { primera: opts.primera, ancho, alto, S, href })
    : mediaTarjeta(o, { primera: opts.primera, ancho, alto, S })}
      ${pantalla ? '' : tipo}
      ${botonSolo}
    </div>
    <div class="tj-panel">
      ${pantalla ? `<p class="tj-sellos">${tipo}${selloEntidad}</p>` : ''}${!pantalla && entidad && !opts.sinNegocio ? `<p class="tj-entidad">${ic('entidad', 14)}<span>${esc(entidad)}</span></p>` : ''}${kicker}${plantilla === 'poster' ? titulo : ''}
      ${sitio
      // En otro sitio: el sitio y, debajo, quién lo organiza.
      ? `<p class="tj-negocio">${logo}<span class="tj-nombre">${ic('lugar', 14)}${esc(sitio)}</span><span class="tj-dist">${dist ? esc(dist) : ''}</span></p>
      <p class="tj-org">${esc(S.organiza(o.business_name || ''))}</p>`
      : opts.sinNegocio ? '' : `<p class="tj-negocio">${logo}<span class="tj-nombre">${esc(o.business_name || '')}</span><span class="tj-dist">${dist ? esc(dist) : ''}</span></p>`}
      ${plantilla === 'poster' ? '' : titulo}
      ${opts.desc && o.description ? `<p class="tj-desc">${esc(o.description)}</p>` : ''}
      <p class="tj-datos">${datos}</p>
      <div class="tj-amigos"></div>
      <span class="tj-cta" aria-hidden="true">${ic(flash ? 'rayo' : 'cal', 18)}${esc(flash ? S.verOferta : S.verEvento)}</span>
    </div>
  </article>`;
  }

  /** Una rejilla de tarjetas grandes. La primera de la página se pide ya. */
  const rejilla = (items, lang, opts = {}) => `<div class="tjs${opts.feed ? ' tjs--feed' : ''}">${items
    .map((o, i) => tarjeta(o, lang, { ...opts, primera: Boolean(opts.primera) && i === 0, tz: opts.tzDe ? opts.tzDe(o) : opts.tz }))
    .join('')}</div>`;

  const KlendarTarjeta = {
    PLANTILLAS, tarjeta, rejilla, distancia, colorSeguro, estiloDe, sobreAcento, plataformaEntradas, sitioDe,
    cuandoCorto, money, fmtDay, fmtTime, sameDay, fmtEnd, benefit, priorPrice, isVideo, esc,
    galeria, miniatura, miniaturas, visor, soloWeb, piezasDe, duracionTxt, arteDe, arteHtml, esGenerica, AGENDA_ARTE,
    nombrePieza: (video, i, n, lang) => T[lang === 'en' ? 'en' : 'es'].pieza(video, i, n),
  };
  globalThis.KlendarTarjeta = KlendarTarjeta;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarTarjeta;
})();
