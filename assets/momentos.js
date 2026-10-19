// Momentos del día (migración 20261233100001 de la app): el negocio los marca
// en «Cómo es tu local» y la gente filtra en «El sitio» con «Para ahora»
// (según la hora del local) o uno concreto. Los mismos identificadores, el
// mismo orden y las mismas franjas que la base (`moment_slugs()`,
// `moment_window()`) y la app (`DayMoment`). Las franjas se pisan a
// propósito: a las 13:45 vale vermut y comer.
//
// Sirve igual para el navegador (script clásico: deja `KlendarMomentos` en
// `window`) y para las Pages Functions (`import KMO from
// '../../assets/momentos.js'`), como assets/marcas.js.
(function () {
  'use strict';
  const klBi = (x, lang) => (lang === 'en' ? x.en : globalThis.KL_TABLA ? globalThis.KL_TABLA(x.es, lang) : x.es);

  // [desde, hasta) en minutos del día; hasta <= desde cruza la medianoche.
  const MOMENTOS = [
    { id: 'breakfast', es: 'Para desayunar', en: 'Breakfast', urlEs: 'desayunar', desde: 7 * 60, hasta: 11 * 60 + 30 },
    { id: 'vermouth', es: 'Vermut', en: 'Vermouth', urlEs: 'vermut', desde: 12 * 60, hasta: 14 * 60 + 30 },
    { id: 'lunch', es: 'Para comer', en: 'Lunch', urlEs: 'comer', desde: 13 * 60 + 30, hasta: 16 * 60 + 30 },
    { id: 'snack', es: 'Para merendar', en: 'Afternoon snack', urlEs: 'merendar', desde: 17 * 60, hasta: 19 * 60 + 30 },
    { id: 'tardeo', es: 'Tardeo', en: 'Afternoon drinks', urlEs: 'tardeo', desde: 17 * 60 + 30, hasta: 21 * 60 + 30 },
    { id: 'dinner', es: 'Para cenar', en: 'Dinner', urlEs: 'cenar', desde: 20 * 60 + 30, hasta: 23 * 60 + 30 },
    { id: 'drinks', es: 'Copas', en: 'Drinks', urlEs: 'copas', desde: 22 * 60, hasta: 3 * 60 + 30 },
  ];
  const AHORA = { es: 'Para ahora', en: 'For right now' };
  const porId = new Map(MOMENTOS.map((m) => [m.id, m]));

  const dentro = (m, min) => (m.hasta > m.desde ? min >= m.desde && min < m.hasta : min >= m.desde || min < m.hasta);

  /** Los que tocan ahora en la península (la base decide con la hora de
   * cada local; Canarias va una hora menos). */
  function ahora(fecha) {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(fecha || new Date());
    const h = Number(p.find((x) => x.type === 'hour').value);
    const mi = Number(p.find((x) => x.type === 'minute').value);
    return MOMENTOS.filter((m) => dentro(m, h * 60 + mi));
  }

  const nombre = (id, lang) => {
    const m = porId.get(id);
    return m ? klBi(m, lang) : '';
  };

  /** «Para ahora: Vermut» o el nombre del momento. */
  function etiquetaFiltro(id, lang) {
    if (id !== 'now') return nombre(id, lang);
    const ya = ahora().map((m) => klBi(m, lang));
    const base = klBi(AHORA, lang);
    return ya.length ? `${base}: ${ya.join(', ')}` : base;
  }

  /** De la dirección (`?momento=vermut`, `?moment=vermouth`, `ahora`/`now`). */
  function deUrl(v) {
    const x = String(v || '').toLowerCase();
    if (!x) return '';
    if (x === 'ahora' || x === 'now') return 'now';
    const m = MOMENTOS.find((y) => y.id === x || y.urlEs === x);
    return m ? m.id : '';
  }

  const aUrl = (id, en) => (id === 'now' ? (en ? 'now' : 'ahora') : en ? id : (porId.get(id)?.urlEs || id));

  /** El identificador del filtro (`offer_traits`). */
  const trait = (id) => `moment_${id}`;

  const KlendarMomentos = { MOMENTOS, ahora, nombre, etiquetaFiltro, deUrl, aUrl, trait };
  globalThis.KlendarMomentos = KlendarMomentos;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarMomentos;
})();
