// La hora de cada negocio: una sola regla para toda la web.
//
// Canarias va una hora por detrás de la península. Una oferta de 18:00 en
// Las Palmas es a las 18:00 de allí, la mire quien la mire y con el reloj que
// tenga el ordenador. La base guarda `businesses.time_zone`; cuando una fila
// no la trae, se deduce de las coordenadas con la misma regla que la base
// (`zone_for`): latitud entre 27,4 y 29,5 y longitud entre −18,5 y −13,2 es
// Canarias; lo demás, la península (con Baleares, Ceuta y Melilla). Sin nada,
// Madrid.
//
// Sirve igual para las páginas del navegador (script clásico: deja
// `KlendarZona` en `window`) y para las Pages Functions (`import KZ from
// '../../assets/zona.js'`).
(function () {
  'use strict';

  const MADRID = 'Europe/Madrid';
  const CANARIAS = 'Atlantic/Canary';

  // Una zona que el navegador no conozca rompería todas las fechas: se
  // comprueba una vez y, si no vale, se usa Madrid.
  const validas = new Map([[MADRID, true], [CANARIAS, true]]);
  function valida(tz) {
    if (typeof tz !== 'string' || !tz) return false;
    if (!validas.has(tz)) {
      let ok = true;
      try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }); } catch { ok = false; }
      validas.set(tz, ok);
    }
    return validas.get(tz);
  }

  const num = (v) => (v == null || v === '' ? NaN : Number(v));

  /** La zona que toca a unas coordenadas, o null si no las hay. */
  function porCoordenadas(lat, lng) {
    const y = num(lat);
    const x = num(lng);
    if (!Number.isFinite(y) || !Number.isFinite(x)) return null;
    return y >= 27.4 && y <= 29.5 && x >= -18.5 && x <= -13.2 ? CANARIAS : MADRID;
  }

  /** La zona de una fila (negocio, publicación, código…): la que traiga,
   * si no la de sus coordenadas y, si no hay nada, Madrid. */
  function de(fila) {
    if (!fila || typeof fila !== 'object') return MADRID;
    const tz = fila.time_zone || fila.business_time_zone;
    if (valida(tz)) return tz;
    return porCoordenadas(fila.lat ?? fila.business_lat, fila.lng ?? fila.business_lng) || MADRID;
  }

  /** La más repetida de una lista (la de una ciudad a partir de sus locales). */
  function comun(zonas) {
    const n = new Map();
    for (const z of zonas || []) if (valida(z)) n.set(z, (n.get(z) || 0) + 1);
    let mejor = MADRID;
    let max = 0;
    for (const [z, c] of n) if (c > max) { mejor = z; max = c; }
    return mejor;
  }

  const zona = (tz) => (valida(tz) ? tz : MADRID);

  // Un formateador por zona: crearlos cuesta y se usan mucho.
  const formatos = new Map();
  function formato(tz) {
    if (!formatos.has(tz)) {
      formatos.set(tz, new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }));
    }
    return formatos.get(tz);
  }

  /** Año, mes, día, hora, minuto y segundo que marca el reloj de esa zona. */
  function partes(instante, tz) {
    const p = Object.fromEntries(formato(zona(tz)).formatToParts(new Date(instante)).map((x) => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, s: +p.second };
  }

  /** Milisegundos que la zona va por delante de UTC en ese instante. */
  function desfase(t, tz) {
    const p = partes(t, tz);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(t / 1000) * 1000;
  }

  /** Una hora del reloj de esa zona → el instante. Se corrige dos veces por
   * si cae justo en el cambio de hora. */
  function instante(tz, y, m, d, h = 0, min = 0) {
    const pared = Date.UTC(y, m - 1, d, h, min);
    let t = pared - desfase(pared, tz);
    t = pared - desfase(t, tz);
    return new Date(t);
  }

  const dos = (n) => String(n).padStart(2, '0');

  /** «AAAA-MM-DD» de ese instante en esa zona. */
  function dia(inst, tz) {
    const p = partes(inst, tz);
    return `${p.y}-${dos(p.m)}-${dos(p.d)}`;
  }

  /** «AAAA-MM-DD» de hoy (o dentro de `dias`) en esa zona. */
  function hoy(tz, dias = 0) {
    const p = partes(Date.now(), tz);
    return new Date(Date.UTC(p.y, p.m - 1, p.d + dias)).toISOString().slice(0, 10);
  }

  /** Dentro de `dias` días, a esa hora del reloj de la zona. */
  function enDias(tz, dias, h, min = 0) {
    const [y, m, d] = hoy(tz, dias).split('-').map(Number);
    return instante(tz, y, m, d, h, min);
  }

  /** Día de la semana de hoy en esa zona: 1 = lunes … 7 = domingo. */
  function diaSemana(tz) {
    const p = partes(Date.now(), tz);
    return ((new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay() + 6) % 7) + 1;
  }

  /** Para <input type="datetime-local">: la hora de la zona, sin zona. */
  function aInput(iso, tz) {
    if (!iso) return '';
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return '';
    const p = partes(t, tz);
    return `${p.y}-${dos(p.m)}-${dos(p.d)}T${dos(p.h)}:${dos(p.min)}`;
  }

  /** Lo escrito en un datetime-local, leído como hora de la zona → ISO. */
  function deInput(v, tz) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(v || ''));
    if (!m) return null;
    return instante(zona(tz), +m[1], +m[2], +m[3], +m[4], +m[5]).toISOString();
  }

  /** Una fecha escrita con `Intl` en esa zona ('' si no se puede). */
  function fmt(iso, tz, locale, opciones) {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat(locale, { ...opciones, timeZone: zona(tz) }).format(new Date(iso));
    } catch { return ''; }
  }

  const KlendarZona = {
    MADRID, CANARIAS, valida, porCoordenadas, de, comun, zona,
    partes, instante, dia, hoy, enDias, diaSemana, aInput, deInput, fmt,
  };
  globalThis.KlendarZona = KlendarZona;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarZona;
})();
