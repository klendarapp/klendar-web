// La ficha de una oferta o un evento (`/o/<id>`, functions/_lib/views.js).
// Antes, tres <script> en línea; la CSP de scripts no los deja (RUNBOOK §4zzz-csp).
// Lo que cambia de una ficha a otra va en la etiqueta: data-lang, data-over
// («Terminada»…), data-abre-en («Abre en »), data-abren (con la apertura de
// las reservas), data-url y data-key (Supabase público) y data-oferta (el id).
(function () {
  var s = document.currentScript, D = (s && s.dataset) || {};
  var en = D.lang === 'en';

  // La cuenta atrás, como en la app («Quedan 1 h 31 min»): siempre en coral y
  // la urgencia con la negrita (menos de 60 min, menos de 15). Se calcula en el
  // navegador: la página va en caché y una hora escrita en ella saldría vieja.
  (function () {
    var el = document.getElementById('cuenta'); if (!el) return;
    var ini = Date.parse(el.dataset.ini) || 0, fin = Date.parse(el.dataset.fin);
    function dur(ms) { var m = Math.floor(ms / 60000); if (m >= 1440) return Math.floor(m / 1440) + ' d'; if (m >= 60) return Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); return Math.max(1, m) + ' min'; }
    function tic() {
      var n = Date.now();
      if (n >= fin) { el.textContent = D.over || ''; return; }
      el.textContent = n < ini ? (en ? 'Starts in ' : 'Empieza en ') + dur(ini - n) : (en ? dur(fin - n) + ' left' : 'Quedan ' + dur(fin - n));
      el.style.fontWeight = n < ini ? 600 : fin - n < 900e3 ? 800 : fin - n < 3600e3 ? 700 : 600; el.hidden = false; setTimeout(tic, 30000);
    }
    tic();
  })();

  // La apertura de las reservas: la cuenta atrás con menos de 24 h y, al
  // llegar la hora, «Reservar plaza» en lugar de «Avísame».
  if (D.abren === '1') (function () {
    var p = document.getElementById('abren'); if (!p) return;
    var t = Date.parse(p.dataset.abre), c = document.getElementById('abren-cuenta');
    function dur(ms) { var m = Math.ceil(ms / 60000); if (m >= 60) return Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); return Math.max(1, m) + ' min'; }
    function tic() {
      var n = Date.now();
      if (n >= t) {
        var a = document.querySelector('[data-principal="avisame"]'), r = document.getElementById('abren-reservar'), x = document.getElementById('avisame-nota');
        if (a) a.remove(); if (x) x.hidden = true; p.hidden = true; if (r) { r.hidden = false; r.setAttribute('data-principal', 'codigo'); } return;
      }
      if (t - n < 864e5) { c.textContent = ' · ' + (D.abreEn || '') + dur(t - n); c.hidden = false; }
      setTimeout(tic, Math.max(1000, Math.min(30000, t - n)));
    }
    tic();
  })();

  // La vista cuenta para el negocio (panel e informe), como en la app. Solo
  // desde un navegador de verdad: los robots de Google o de WhatsApp no
  // ejecutan esto. Sin guardar nada en el navegador: la base no cuenta dos
  // veces a la misma persona en 30 minutos (`offer_views_dedupe`).
  try {
    if (!navigator.webdriver && D.url && D.key && D.oferta) {
      fetch(D.url + '/rest/v1/offer_views', { method: 'POST', keepalive: true, headers: { apikey: D.key, Authorization: 'Bearer ' + D.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ offer_id: D.oferta }) });
    }
  } catch (e) { /* sin red */ }
})();
