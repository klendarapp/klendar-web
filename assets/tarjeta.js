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
      en: (l) => `en ${l}`, entradas: (p) => `Entradas en ${p}`, video: 'Vídeo',
      organiza: (n) => `Organiza: ${n}`, hoy: 'Hoy', manana: 'Mañana',
    },
    en: {
      flash: 'Flash offer', event: 'Event', verOferta: 'See offer', verEvento: 'See event',
      seats: (n) => (n === 1 ? '1 place left' : `${n} places left`), soldOut: 'Sold out',
      en: (l) => `at ${l}`, entradas: (p) => `Tickets on ${p}`, video: 'Video',
      organiza: (n) => `Organised by ${n}`, hoy: 'Today', manana: 'Tomorrow',
    },
  };

  // Iconos de Material en SVG (las páginas públicas no cargan la fuente).
  const IC = {
    cal: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10Zm0-12H5V6h14v2Z',
    rayo: 'M7 2v11h3v9l7-12h-4l4-8z',
    lugar: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
    flecha: 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z',
    play: 'M8 5v14l11-7z',
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
      return `${fmtDay(ev, lang, tz)} · ${fmtTime(ev, lang, tz)}`;
    }
    const ini = o.redeem_start_at || o.starts_at;
    return `${fmtDay(ini, lang, tz)} · ${fmtTime(ini, lang, tz)}${o.redeem_end_at ? ` – ${fmtEnd(ini, o.redeem_end_at, lang, tz)}` : ''}`;
  }

  /** La pieza de foto o vídeo de la tarjeta. El vídeo va en silencio y sin
   * cargar nada hasta que se ve; `/assets/tarjetas.js` lo reproduce mientras
   * está a la vista (no con «reducir movimiento» ni con ahorro de datos). Sin
   * JavaScript se ve la foto de portada. */
  function mediaTarjeta(o, { primera, ancho, alto, S }) {
    const piezas = (o.images || []).filter((u) => typeof u === 'string' && /^https:\/\//.test(u));
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

  /**
   * Una tarjeta de publicación.
   *
   * @param {object} o  fila de `public_explore`, `business_offers`, `public_city_agenda`…
   * @param {'es'|'en'} lang
   * @param {object} [opts]
   * @param {'grande'|'fila'} [opts.forma='grande']
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
      <p class="tj-datos"><span class="tj-hora">${esc(hora)}</span>${flash ? `<span class="tj-rayo" title="${esc(S.flash)}">${ic('rayo', 14)}<span class="sr">${esc(S.flash)}</span></span>` : ''}${precio ? `<span class="tj-precio">${esc(precio)}</span>` : ''}${agotado ? `<span class="tj-chip">${esc(S.soldOut)}</span>` : ''}</p>
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
        : o.seats_left != null && Number(o.seats_left) <= 20 ? `<span class="tj-chip">${esc(S.seats(Number(o.seats_left)))}</span>` : '',
      plataforma ? `<span class="tj-chip">${esc(S.entradas(plataforma))}</span>` : '',
    ].filter(Boolean).join('');
    const logo = o.business_logo && /^https:\/\//.test(o.business_logo)
      ? `<img class="tj-logo" src="${esc(o.business_logo)}" alt="" width="24" height="24" loading="lazy" decoding="async">` : '';
    return `<article class="tj tj--${plantilla}${opts.desc ? ' tj--desc' : ''}" data-o="${esc(o.id)}"${geo}${estilo}>
    <div class="tj-media">
      ${mediaTarjeta(o, { primera: opts.primera, ancho: 480, alto: 600, S })}
      <span class="tj-tipo">${esc(flash ? S.flash : S.event)}</span>
    </div>
    <div class="tj-panel">
      ${kicker}${plantilla === 'poster' ? titulo : ''}
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
  };
  globalThis.KlendarTarjeta = KlendarTarjeta;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarTarjeta;
})();
