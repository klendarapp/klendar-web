// «Abierto · cierra a las 21:00» en la ficha de un negocio.
//
// La ficha sale de la caché unos minutos, así que el estado no puede venir
// escrito del servidor: lo calcula el navegador con el horario y la zona del
// negocio (la hora de allí, no la del ordenador). Misma regla que la app
// (`lib/core/utils/opening_hours.dart`): un tramo que acaba antes de empezar
// cruza la medianoche, y «Cierra pronto» / «Abre pronto» si cambia en menos
// de una hora. Un día cerrado (vacaciones, festivo) manda sobre el horario.
(function () {
  'use strict';
  const KZ = window.KlendarZona;
  const el = document.querySelector('[data-horario]');
  if (!KZ || !el) return;

  let horas;
  let cierres;
  try {
    horas = JSON.parse(el.getAttribute('data-horario') || '{}');
    cierres = JSON.parse(el.getAttribute('data-cierres') || '[]');
  } catch { return; }
  const tz = KZ.zona(el.getAttribute('data-tz'));
  const en = el.getAttribute('data-lang') === 'en';
  const T = en
    ? { open: 'Open', closed: 'Closed', closingSoon: 'Closing soon', openingSoon: 'Opening soon',
        closesAt: (t) => `closes at ${t}`, closesLate: (t) => `closes at ${t} (after midnight)`,
        opensAt: (t) => `opens at ${t}`, opensTomorrow: (t) => `opens tomorrow at ${t}`,
        opensOn: (d, t) => `opens on ${d} at ${t}`,
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }
    : { open: 'Abierto', closed: 'Cerrado', closingSoon: 'Cierra pronto', openingSoon: 'Abre pronto',
        closesAt: (t) => `cierra a las ${t}`, closesLate: (t) => `cierra a las ${t} (madrugada)`,
        opensAt: (t) => `abre a las ${t}`, opensTomorrow: (t) => `abre mañana a las ${t}`,
        opensOn: (d, t) => `abre el ${d} a las ${t}`,
        days: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] };

  const min = (s) => {
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(String(s || '').trim());
    return m && +m[1] <= 24 && +m[2] <= 59 ? (+m[1] % 24) * 60 + +m[2] : null;
  };
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const tramos = (d) => (Array.isArray(horas[d]) ? horas[d] : [])
    .map((t) => (Array.isArray(t) ? [min(t[0]), min(t[1])] : [null, null]))
    .filter(([a, b]) => a != null && b != null);

  function estado() {
    const p = KZ.partes(Date.now(), tz);
    const ahora = p.h * 60 + p.min;
    const hoy = KZ.diaSemana(tz);
    const hoyIso = KZ.hoy(tz);
    if (cierres.some((c) => c.starts_on <= hoyIso && hoyIso <= c.ends_on)) {
      return { abierto: false, texto: '' };
    }
    for (const [a, b] of tramos(hoy)) {
      const cruza = b <= a;
      if (cruza ? ahora >= a : ahora >= a && ahora < b) {
        const falta = (cruza || b < ahora ? b + 1440 : b) - ahora;
        return { abierto: true, pronto: falta <= 60, texto: cruza ? T.closesLate(hhmm(b)) : T.closesAt(hhmm(b)) };
      }
    }
    const ayer = hoy === 1 ? 7 : hoy - 1;
    for (const [a, b] of tramos(ayer)) {
      if (b <= a && ahora < b) return { abierto: true, pronto: b - ahora <= 60, texto: T.closesAt(hhmm(b)) };
    }
    for (let n = 0; n < 7; n++) {
      const d = ((hoy - 1 + n) % 7) + 1;
      for (const [a] of tramos(d)) {
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
    el.hidden = false;
  }

  pinta();
  setInterval(pinta, 60000);
})();
