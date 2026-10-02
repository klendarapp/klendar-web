/* Las tarjetas de publicación de la web pública (functions/_lib/tarjeta.js)
 * y los desplegables de Explorar y Descubre.
 *
 * - Vídeo: se reproduce en silencio mientras la tarjeta está a la vista, como
 *   en Descubre de la app. Nunca con «reducir movimiento» ni con ahorro de
 *   datos (o una conexión lenta): ahí se queda la foto de portada.
 * - Cuenta atrás: «Ahora · quedan 1 h 20 min» en las ofertas en marcha (la
 *   página va en caché y una hora escrita en el servidor saldría vieja).
 * - Distancia: si has usado «Cerca de mí» hace poco, cada tarjeta dice a
 *   cuánto está. La posición se queda en este navegador (no se manda a nada).
 * - Desplegables (`details.desplegable`) y la hoja de filtros: se cierran al
 *   pulsar fuera o con Escape, y solo hay uno abierto a la vez.
 */
(function () {
  'use strict';
  var EN = document.documentElement.lang === 'en';
  var LOC = EN ? 'en-GB' : 'es-ES';

  // ── Vídeo a la vista ────────────────────────────────────────────────────
  var quieto = window.matchMedia('(prefers-reduced-motion: reduce)');
  function ahorro() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return Boolean(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
  }
  function puedeMoverse() { return !quieto.matches && !ahorro(); }

  var videos = Array.prototype.slice.call(document.querySelectorAll('video[data-src]'));
  function carga(v) {
    if (!v.getAttribute('src')) { v.setAttribute('src', v.getAttribute('data-src')); }
  }
  // Sin portada: el primer fotograma, para que no quede un rectángulo negro
  // (salvo con ahorro de datos: ahí, la inicial del negocio).
  videos.forEach(function (v) {
    // El de una ficha lleva controles: con `preload="none"` no se baja nada
    // hasta que se pulsa, pero así se puede reproducir aunque no arranque solo.
    if (v.controls) carga(v);
    if (!v.getAttribute('poster') && !ahorro()) { v.preload = 'metadata'; carga(v); }
    else if (!v.getAttribute('poster')) {
      var ph = document.createElement('span');
      ph.className = 'tj-ph'; ph.setAttribute('aria-hidden', 'true'); ph.textContent = '▶';
      v.after(ph);
    }
  });
  if ('IntersectionObserver' in window && videos.length) {
    var mira = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting && e.intersectionRatio >= 0.6 && puedeMoverse()) {
          carga(v);
          v.muted = true;
          var p = v.play();
          if (p && p.catch) p.catch(function () { /* el navegador no deja: se queda la portada */ });
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { threshold: [0, 0.6] });
    videos.forEach(function (v) { mira.observe(v); });
    var pararTodo = function () { if (!puedeMoverse()) videos.forEach(function (v) { if (!v.paused) v.pause(); }); };
    if (quieto.addEventListener) quieto.addEventListener('change', pararTodo);
  }

  // ── Cuenta atrás de las ofertas flash ──────────────────────────────────
  var relojes = Array.prototype.slice.call(document.querySelectorAll('.tj-cuando[data-fin]'));
  function dur(ms) {
    var m = Math.floor(ms / 60000);
    if (m >= 1440) return Math.floor(m / 1440) + ' d';
    if (m >= 60) return Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
    return Math.max(1, m) + ' min';
  }
  function tic() {
    var n = Date.now();
    relojes.forEach(function (el) {
      var ini = Date.parse(el.getAttribute('data-ini')) || 0;
      var fin = Date.parse(el.getAttribute('data-fin'));
      var txt = el.querySelector('span');
      if (!txt || !fin) return;
      if (!el.hasAttribute('data-original')) el.setAttribute('data-original', txt.textContent);
      if (n >= fin) { txt.textContent = EN ? 'Ended' : 'Terminada'; el.classList.remove('ahora'); el.classList.add('fin'); }
      else if (n >= ini) { txt.textContent = EN ? 'Now · ' + dur(fin - n) + ' left' : 'Ahora · quedan ' + dur(fin - n); el.classList.add('ahora'); }
    });
    if (relojes.length) setTimeout(tic, 30000);
  }
  tic();

  // ── Distancia, si sabemos dónde estás ──────────────────────────────────
  var aqui = null;
  try {
    var g = JSON.parse(localStorage.getItem('klendar.cerca') || 'null');
    if (g && Date.now() - g.t < 6 * 3600e3 && isFinite(g.lat) && isFinite(g.lng)) aqui = g;
  } catch (e) { /* sin almacenamiento */ }
  function metros(a, b, c, d) {
    var r = Math.PI / 180, x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2);
    var h = x * x + Math.cos(a * r) * Math.cos(c * r) * y * y;
    return 12742000 * Math.asin(Math.sqrt(h));
  }
  function fmtDist(m) {
    if (m < 1000) return Math.max(10, Math.round(m / 10) * 10) + ' m';
    var km = m < 10000 ? Math.round(m / 100) / 10 : Math.round(m / 1000);
    return km.toLocaleString(LOC) + ' km';
  }
  if (aqui) {
    document.querySelectorAll('[data-lat][data-lng]').forEach(function (el) {
      var hueco = el.querySelector('.tj-dist') || (el.classList.contains('dist') ? el : null);
      if (!hueco) return;
      var m = metros(aqui.lat, aqui.lng, +el.getAttribute('data-lat'), +el.getAttribute('data-lng'));
      if (!isFinite(m) || m > 300000) return;
      hueco.textContent = (el.classList.contains('tj-fila') ? ' · ' : '') + fmtDist(m);
      hueco.hidden = false;
    });
  }
  // Lo que pone «Cerca de mí» lo recuerda aquí (Explorar y Descubre).
  window.KL_CERCA = function (lat, lng) {
    try { localStorage.setItem('klendar.cerca', JSON.stringify({ lat: lat, lng: lng, t: Date.now() })); } catch (e) { /* nada */ }
  };

  // ── Carrusel de la ficha: «2/3» al deslizar ────────────────────────────
  document.querySelectorAll('.ficha-media').forEach(function (caja) {
    var pista = caja.querySelector('.fm-pista');
    var n = caja.querySelector('.fm-n');
    if (!pista || !n) return;
    var total = pista.children.length;
    pista.addEventListener('scroll', function () {
      var i = Math.round(pista.scrollLeft / Math.max(1, pista.clientWidth));
      n.textContent = Math.min(total, i + 1) + '/' + total;
    }, { passive: true });
  });

  // ── Desplegables y hoja de filtros ─────────────────────────────────────
  // «Cambiar filtros» (al final de la lista) abre la hoja.
  document.addEventListener('click', function (e) {
    var a = e.target instanceof Element ? e.target.closest('[data-abre-filtros]') : null;
    var hoja = document.getElementById('filtros');
    if (!a || !hoja) return;
    e.preventDefault();
    hoja.open = true;
  });
  // La hoja manda solo lo que tiene valor (sin `precio=&orden=` en la URL).
  document.querySelectorAll('form.hoja-cuerpo').forEach(function (f) {
    f.addEventListener('submit', function () {
      Array.prototype.forEach.call(f.elements, function (el) {
        if (el.name && !el.value && (el.type !== 'radio' || el.checked)) el.disabled = true;
      });
    });
  });
  var abiertos = function () { return document.querySelectorAll('details.desplegable[open], details.hoja[open]'); };
  function cierra(excepto) {
    Array.prototype.forEach.call(abiertos(), function (d) { if (d !== excepto) d.open = false; });
  }
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.matches('.desplegable, .hoja')) return;
    if (d.open) {
      cierra(d);
      if (d.classList.contains('hoja')) {
        document.body.classList.add('con-hoja');
        var primero = d.querySelector('.hoja-cuerpo input, .hoja-cuerpo select, .hoja-cuerpo a, .hoja-cuerpo button');
        if (primero) setTimeout(function () { primero.focus({ preventScroll: true }); }, 30);
      }
    } else if (d.classList.contains('hoja')) {
      document.body.classList.remove('con-hoja');
    }
  }, true);
  document.addEventListener('click', function (e) {
    var t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    if (t.closest('[data-cerrar-hoja]')) {
      var h = t.closest('details.hoja');
      if (h) { e.preventDefault(); h.open = false; h.querySelector('summary').focus(); }
      return;
    }
    if (!t.closest('details.desplegable, details.hoja')) cierra(null);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var lista = abiertos();
    if (!lista.length) return;
    var ultimo = lista[lista.length - 1];
    ultimo.open = false;
    var s = ultimo.querySelector('summary');
    if (s) s.focus();
  });
})();
