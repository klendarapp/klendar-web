// «Abierto · cierra a las 21:00» en la ficha de un negocio.
//
// La ficha sale de la caché unos minutos, así que el estado no puede venir
// escrito del servidor: lo calcula el navegador con el horario y la zona del
// negocio (la hora de allí, no la del ordenador). Misma regla que la app
// (`lib/core/utils/opening_hours.dart`): un tramo que acaba antes de empezar
// cruza la medianoche, y «Cierra pronto» / «Abre pronto» si cambia en menos
// de una hora. Un día cerrado (vacaciones, festivo) manda sobre el horario.
// Con horario de cocina (`data-cocina`, opcional; migración 20261230100000),
// debajo y con el local abierto: «Cocina: hasta las 23:00» o «Cocina
// cerrada», como la app. Los días con otro horario (`data-dias`, festivos,
// Navidad; migración 20261233100002) mandan ese día sobre el de la semana,
// también para la cocina, como `business_hours_json` en la base.
(function () {
  'use strict';
  const KZ = window.KlendarZona;
  const el = document.querySelector('[data-horario]');
  if (!KZ || !el) return;

  let horas;
  let cierres;
  let cocina = null;
  let dias = {};
  try {
    horas = JSON.parse(el.getAttribute('data-horario') || '{}');
    cierres = JSON.parse(el.getAttribute('data-cierres') || '[]');
    if (el.hasAttribute('data-cocina')) cocina = JSON.parse(el.getAttribute('data-cocina'));
    if (el.hasAttribute('data-dias')) dias = JSON.parse(el.getAttribute('data-dias')) || {};
  } catch { return; }
  const tz = KZ.zona(el.getAttribute('data-tz'));
  const en = el.getAttribute('data-lang') === 'en';
  const T = en
    ? { open: 'Open', closed: 'Closed', closingSoon: 'Closing soon', openingSoon: 'Opening soon',
        closesAt: (t) => `closes at ${t}`, closesLate: (t) => `closes at ${t} (after midnight)`,
        opensAt: (t) => `opens at ${t}`, opensTomorrow: (t) => `opens tomorrow at ${t}`,
        opensOn: (d, t) => `opens on ${d} at ${t}`,
        kitchenUntil: (t) => `Kitchen: until ${t}`, kitchenOpen: 'Kitchen open', kitchenClosed: 'Kitchen closed',
        kitchenOpensAt: (t) => `Kitchen closed · opens at ${t}`,
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }
    : { open: 'Abierto', closed: 'Cerrado', closingSoon: 'Cierra pronto', openingSoon: 'Abre pronto',
        closesAt: (t) => `cierra a las ${t}`, closesLate: (t) => `cierra a las ${t} (madrugada)`,
        opensAt: (t) => `abre a las ${t}`, opensTomorrow: (t) => `abre mañana a las ${t}`,
        opensOn: (d, t) => `abre el ${d} a las ${t}`,
        kitchenUntil: (t) => `Cocina: hasta las ${t}`, kitchenOpen: 'Cocina abierta', kitchenClosed: 'Cocina cerrada',
        kitchenOpensAt: (t) => `Cocina cerrada · abre a las ${t}`,
        days: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] };

  const min = (s) => {
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(s || '').trim());
    return m && +m[1] <= 24 && +m[2] <= 59 ? (+m[1] % 24) * 60 + +m[2] : null;
  };
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const tramosDe = (h, d) => (Array.isArray(h[d]) ? h[d] : [])
    .map((t) => (Array.isArray(t) ? [min(t[0]), min(t[1])] : [null, null]))
    .filter(([a, b]) => a != null && b != null);

  /** «2026-11-01» + n días. */
  const masDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  /** Los tramos de un horario en una fecha: los de ese día si tiene otro
   * horario; si no, los de su día de la semana. */
  // Un día de «Días cerrados» no abre (manda sobre todo): «abre mañana»
  // lo salta y dice «abre el jueves a las…» (Iván, 2026-10-22; como la app).
  const cerradoEn = (iso) => cierres.some((c) => c.starts_on <= iso && iso <= c.ends_on);
  const tramosEn = (h, iso, d) => (cerradoEn(iso) ? []
    : Array.isArray(dias[iso]) ? tramosDe({ x: dias[iso] }, 'x') : tramosDe(h, d));
  const hoyIso = () => KZ.hoy(tz);
  const tramos = (d, n = 0) => tramosEn(horas, masDias(hoyIso(), n), d);

  /** La cocina con el local abierto: abierta hasta X o cerrada (y si abre
   * hoy más tarde). */
  function cocinaAhora() {
    if (!cocina) return '';
    const p = KZ.partes(Date.now(), tz);
    const ahora = p.h * 60 + p.min;
    const hoy = KZ.diaSemana(tz);
    const iso = hoyIso();
    for (const [a, b] of tramosEn(cocina, iso, hoy)) {
      if (b <= a ? ahora >= a : ahora >= a && ahora < b) return T.kitchenUntil(hhmm(b));
    }
    const ayer = hoy === 1 ? 7 : hoy - 1;
    for (const [a, b] of tramosEn(cocina, masDias(iso, -1), ayer)) {
      if (b <= a && ahora < b) return T.kitchenUntil(hhmm(b));
    }
    for (const [a] of tramosEn(cocina, iso, hoy)) {
      if (a > ahora) return T.kitchenOpensAt(hhmm(a));
    }
    return T.kitchenClosed;
  }

  function estado() {
    const p = KZ.partes(Date.now(), tz);
    const ahora = p.h * 60 + p.min;
    const hoy = KZ.diaSemana(tz);
    const iso = hoyIso();
    // Hoy cerrado: ni lo de hoy ni lo que venía de anoche; sí cuándo abre.
    const hoyCerrado = cerradoEn(iso);
    for (const [a, b] of tramos(hoy)) {
      const cruza = b <= a;
      if (cruza ? ahora >= a : ahora >= a && ahora < b) {
        const falta = (cruza || b < ahora ? b + 1440 : b) - ahora;
        return { abierto: true, pronto: falta <= 60, texto: cruza ? T.closesLate(hhmm(b)) : T.closesAt(hhmm(b)) };
      }
    }
    const ayer = hoy === 1 ? 7 : hoy - 1;
    for (const [a, b] of hoyCerrado ? [] : tramos(ayer, -1)) {
      if (b <= a && ahora < b) return { abierto: true, pronto: b - ahora <= 60, texto: T.closesAt(hhmm(b)) };
    }
    for (let n = 0; n < 8; n++) {
      const d = ((hoy - 1 + n) % 7) + 1;
      for (const [a] of tramos(d, n)) {
        if (n === 0 && a <= ahora) continue;
        const texto = n === 0 ? T.opensAt(hhmm(a)) : n === 1 ? T.opensTomorrow(hhmm(a)) : T.opensOn(T.days[d - 1], hhmm(a));
        return { abierto: false, pronto: n * 1440 + a - ahora <= 60, texto };
      }
    }
    return { abierto: false, texto: '' };
  }

  function pinta() {
    const e = estado();
    const titulo = e.abierto ? (e.pronto ? T.closingSoon : T.open) : (e.pronto ? T.openingSoon : T.closed);
    el.className = `estado-hoy ${e.pronto ? 'pronto' : e.abierto ? 'abierto' : 'cerrado'}`;
    el.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = titulo;
    el.appendChild(b);
    if (e.texto) el.appendChild(document.createTextNode(` · ${e.texto}`));
    const k = e.abierto ? cocinaAhora() : '';
    if (k) {
      const s = document.createElement('small');
      s.className = 'cocina';
      s.textContent = k;
      el.appendChild(document.createElement('br'));
      el.appendChild(s);
    }
    el.hidden = false;
  }

  pinta();
  setInterval(pinta, 60000);
})();
