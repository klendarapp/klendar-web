// «Tus planes en tu calendario»: el .ics de suscripción (`/cal/<token>.ics`).
//
// La base dice qué entra (`calendar_feed`, migración 20261120100001 de la
// app): eventos guardados o con «Voy» (también las fechas que añade una
// serie), reservas y ofertas flash con hora, y las mesas confirmadas
// (`kind: 'table_booking'`, migración 20261207100000: «Mesa en {negocio}»,
// dos horas, con enlace a la ficha del negocio). Aquí solo se pinta.
//
// - Una entrada por publicación con UID estable (`plan-<id>@klendar.app`): si
//   cambia la hora, el calendario mueve la misma; si se anula, deja de venir
//   y el calendario la quita.
// - La hora va en la zona del local (TZID + VTIMEZONE). Para Madrid y
//   Canarias, las únicas que pone hoy `zone_for`, con sus reglas; para
//   cualquier otra, en UTC (siempre correcta, sin depender de la zona).
// - Líneas de 75 octetos como mucho (RFC 5545 §3.1) y CRLF.
//
// Sin dependencias: se usa igual en Cloudflare y en node (pruebas).

const ZONAS = {
  'Europe/Madrid': [
    'BEGIN:VTIMEZONE', 'TZID:Europe/Madrid', 'X-LIC-LOCATION:Europe/Madrid',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
    'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
    'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE',
  ],
  'Atlantic/Canary': [
    'BEGIN:VTIMEZONE', 'TZID:Atlantic/Canary', 'X-LIC-LOCATION:Atlantic/Canary',
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0000', 'TZOFFSETTO:+0100', 'TZNAME:WEST',
    'DTSTART:19700329T010000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0000', 'TZNAME:WET',
    'DTSTART:19701025T020000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
    'END:VTIMEZONE',
  ],
};

const TEXTOS = {
  es: {
    nombre: 'Klendar · Tus planes',
    desc: 'Lo que tienes en Planes en Klendar: eventos a los que vas, reservas, códigos y fechas de las series que sigues.',
    reservation: (n) => (n > 1 ? `Tienes ${n} plazas reservadas.` : 'Tienes plaza reservada.'),
    codeUsed: 'Ya usaste el código.',
    code: 'Tienes el código: está en «Tus códigos».',
    going: 'Vas.',
    saved: 'Guardado en Planes.',
    organiza: (b) => `Organiza: ${b}.`,
    ver: 'Míralo en Klendar',
    mesa: (b) => `Mesa en ${b}`,
    mesaPara: (n) => `Mesa para ${n}.`,
  },
  en: {
    nombre: 'Klendar · Your plans',
    desc: 'What you have in Plans on Klendar: events you\'re going to, reservations, codes and dates from the series you follow.',
    reservation: (n) => (n > 1 ? `You have ${n} places reserved.` : 'You have a place reserved.'),
    codeUsed: 'You\'ve used the code.',
    code: 'You have the code: it\'s in “Your codes”.',
    going: 'You\'re going.',
    saved: 'Saved in Plans.',
    organiza: (b) => `Hosted by ${b}.`,
    ver: 'See it on Klendar',
    mesa: (b) => `Table at ${b}`,
    mesaPara: (n) => `Table for ${n}.`,
  },
};

/** Texto de una propiedad (RFC 5545 §3.3.11). */
export const textoIcs = (v) => String(v ?? '')
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

/** Parte una línea en trozos de 75 octetos como mucho, sin cortar un carácter. */
export function plegar(linea) {
  const enc = new TextEncoder();
  if (enc.encode(linea).length <= 75) return linea;
  const out = [];
  let actual = '';
  let bytes = 0;
  let limite = 75;
  for (const ch of linea) {
    const n = enc.encode(ch).length;
    if (bytes + n > limite) {
      out.push(actual);
      actual = '';
      bytes = 0;
      limite = 74; // la continuación empieza con un espacio
    }
    actual += ch;
    bytes += n;
  }
  out.push(actual);
  return out.join('\r\n ');
}

const dos = (n) => String(n).padStart(2, '0');

/** 20261010T210000Z */
export const utcIcs = (iso) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${dos(d.getUTCMonth() + 1)}${dos(d.getUTCDate())}T${dos(d.getUTCHours())}${dos(d.getUTCMinutes())}${dos(d.getUTCSeconds())}Z`;
};

/** 20261010T210000 en la hora de [tz]. */
export function localIcs(iso, tz) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(iso))) p[x.type] = x.value;
  return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}${p.second}`;
}

/** DTSTART/DTEND en la zona del local, o en UTC si no tenemos sus reglas. */
const fecha = (prop, iso, tz) => (ZONAS[tz] ? `${prop};TZID=${tz}:${localIcs(iso, tz)}` : `${prop}:${utcIcs(iso)}`);

/** Lo que cambia la entrada (para SEQUENCE): minutos desde 2026. */
const secuencia = (iso) => Math.max(0, Math.floor((Date.parse(iso || 0) - Date.UTC(2026, 0, 1)) / 60000));

/**
 * El .ics entero.
 * @param {{lang?: string, items: Array<object>}} datos lo que devuelve `calendar_feed`
 * @param {{base?: string, ahora?: Date}} [op]
 */
export function icsDePlanes(datos, { base = 'https://klendar.app', ahora = new Date() } = {}) {
  const lang = datos?.lang === 'en' ? 'en' : 'es';
  const T = TEXTOS[lang];
  const items = Array.isArray(datos?.items) ? datos.items : [];
  const zonas = [...new Set(items.map((i) => i.time_zone).filter((z) => ZONAS[z]))];
  const stamp = utcIcs(ahora.toISOString());
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Klendar//Tus planes//${lang.toUpperCase()}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${textoIcs(T.nombre)}`,
    `X-WR-CALNAME:${textoIcs(T.nombre)}`,
    `DESCRIPTION:${textoIcs(T.desc)}`,
    `X-WR-CALDESC:${textoIcs(T.desc)}`,
    'X-WR-TIMEZONE:Europe/Madrid',
    // Cada cuánto conviene volver a mirar (Apple y Outlook lo respetan;
    // Google va a su ritmo, de unas horas).
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...zonas.flatMap((z) => ZONAS[z]),
  ];
  for (const i of items) {
    if (!i?.id || !i.starts_at || !i.ends_at) continue;
    const tz = i.time_zone || 'Europe/Madrid';
    // Una mesa confirmada: el enlace es la ficha del negocio (no hay
    // publicación) y el título, «Mesa en {negocio}».
    const mesa = i.kind === 'table_booking' || i.how === 'table';
    const negocio = i.business || i.title || '';
    const url = mesa
      ? `${base}${lang === 'en' ? '/en' : ''}/b/${encodeURIComponent(i.slug || '')}`
      : `${base}${lang === 'en' ? '/en' : ''}/o/${i.id}`;
    const estado = mesa ? T.mesaPara(Math.max(1, Number(i.seats) || 1))
      : i.how === 'reservation' ? T.reservation(i.seats || 1)
        : i.how === 'code' ? (i.code_used ? T.codeUsed : T.code)
          : i.how === 'going' ? T.going : T.saved;
    const lugar = [i.place, i.address].filter(Boolean).filter((v, k, a) => a.indexOf(v) === k).join(', ');
    const desc = [estado, !mesa && i.business && i.business !== i.place ? T.organiza(i.business) : '', `${T.ver}: ${url}`]
      .filter(Boolean).join('\n');
    lineas.push(
      'BEGIN:VEVENT',
      `UID:plan-${i.id}@klendar.app`,
      `DTSTAMP:${stamp}`,
      `LAST-MODIFIED:${utcIcs(i.updated_at || ahora.toISOString())}`,
      `SEQUENCE:${secuencia(i.updated_at)}`,
      fecha('DTSTART', i.starts_at, tz),
      fecha('DTEND', i.ends_at, tz),
      `SUMMARY:${textoIcs(mesa ? T.mesa(negocio) : (i.title || 'Klendar'))}`,
      ...(lugar ? [`LOCATION:${textoIcs(lugar)}`] : []),
      ...(Number.isFinite(i.lat) && Number.isFinite(i.lng) ? [`GEO:${i.lat.toFixed(6)};${i.lng.toFixed(6)}`] : []),
      `URL:${url}`,
      `DESCRIPTION:${textoIcs(desc)}`,
      `STATUS:${i.how === 'saved' ? 'TENTATIVE' : 'CONFIRMED'}`,
      `TRANSP:${i.how === 'saved' ? 'TRANSPARENT' : 'OPAQUE'}`,
      'END:VEVENT',
    );
  }
  lineas.push('END:VCALENDAR');
  return lineas.map(plegar).join('\r\n') + '\r\n';
}

/** El token de la dirección: `/cal/<token>.ics` (el .ics es opcional). */
export const tokenDe = (seg) => {
  const t = String(seg || '').replace(/\.ics$/i, '');
  return /^[A-Za-z0-9_-]{32,64}$/.test(t) ? t : null;
};
