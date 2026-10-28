// «Lo ya visto, al final» (Iván, 2026-10-28; como Descubre en la app).
//
// En Descubre y en la lista de Explorar, al cargar la página, primero lo que
// no has visto y, detrás de una separación («Ya has visto todo lo nuevo ·
// Esto ya lo viste»), lo que ya viste, en el mismo orden. No se esconde
// nada: lo visto sale cuando ya ha llegado todo lo demás.
//
// - Una publicación cuenta como vista cuando su tarjeta ha estado en
//   pantalla (la mitad o más) 1,5 s seguidos; pasarla rápido no cuenta.
// - Se guarda SOLO en este navegador (`localStorage`, clave
//   `klendar.vistos`: `{id: [segundos, huella]}`), nunca se manda a
//   Klendar. Cada una vale 7 días desde que se vio y como mucho se guardan
//   2.000 (las más antiguas se olvidan).
// - Si cambia algo que importa (baja de precio, nueva fecha u hora, quedan
//   pocas plazas, vuelve a estar disponible), cambia su huella (`data-vh`,
//   la pone la página) y vuelve a ser nueva.
// - Lo destacado de pago (`data-dest`) sigue primero aunque esté visto; la
//   agenda pública (`data-imp`) va como mucho una de cada cinco dentro de
//   cada bloque, como la base.
// - Por partes: Descubre trae la página siguiente sola (/assets/tarjetas.js)
//   y aquí se colocan sus tarjetas; la lista de Explorar, con «Ver más»
//   (sin JavaScript, las páginas numeradas de siempre). Lo que ya se ve no
//   se mueve nunca: lo nuevo se añade por el final y lo visto espera a que
//   no quede nada por traer.
// - Solo ordena en la primera página (`data-ordena`); en las demás, cuenta
//   lo que ves.
//
// Lo carga la página solo con el interruptor encendido (`app_config.seen_last`).
(function () {
  'use strict';
  var CLAVE = 'klendar.vistos';
  var DURA = 7 * 24 * 3600 * 1000;
  var MAX = 2000;
  var MIRADA = 1500;
  var CADA = 4;

  // «Poner al final lo que ya he visto» apagado (Tu cuenta › Ajustes › Lo
  // que ves, también sin sesión): ni se reordena ni se guarda nada.
  try { if (localStorage.getItem(CLAVE) === 'off') return; } catch (e) { /* sin almacenamiento: sigue */ }

  var yo = document.currentScript;
  var T = {};
  try { T = JSON.parse((yo && yo.getAttribute('data-t')) || '{}'); } catch (e) { /* sin textos */ }
  var ordena = Boolean(yo && yo.getAttribute('data-ordena') === '1');

  // ── Lo guardado ──────────────────────────────────────────────────────────
  var lee = function () {
    try {
      var m = JSON.parse(localStorage.getItem(CLAVE) || '{}');
      return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
    } catch (e) { return {}; }
  };
  var limpia = function (m, ahora) {
    var ids = Object.keys(m).filter(function (id) {
      var v = m[id];
      var vale = Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'string' && ahora - v[0] * 1000 < DURA;
      if (!vale) delete m[id];
      return vale;
    });
    if (ids.length > MAX) {
      ids.sort(function (a, b) { return m[a][0] - m[b][0]; });
      ids.slice(0, ids.length - MAX).forEach(function (id) { delete m[id]; });
    }
    return m;
  };
  var guarda = function (m) { try { localStorage.setItem(CLAVE, JSON.stringify(m)); } catch (e) { /* lleno o bloqueado */ } };

  // Lo visto al cargar: todo lo que llega por partes se mira contra esto
  // (lo que ves mientras tanto no mueve nada hasta la próxima vez).
  var t0 = Date.now();
  var foto = limpia(lee(), t0);
  var idDe = function (el) { return el.getAttribute('data-o'); };
  var esVista = function (el) {
    var v = foto[idDe(el)];
    return Boolean(v) && v[1] === el.getAttribute('data-vh');
  };
  var marca = function (el) {
    var ahora = Date.now();
    var m = limpia(lee(), ahora);
    m[idDe(el)] = [Math.floor(ahora / 1000), el.getAttribute('data-vh') || ''];
    guarda(limpia(m, ahora));
  };

  var feed = document.getElementById('feed');
  var lista = feed ? null : document.querySelector('.tjs[data-vistos]');
  var caja = feed || lista;
  if (!caja) return;
  var esTarjeta = function (n) { return n.nodeType === 1 && n.matches('.tj[data-o][data-vh]'); };

  // ── Qué cuenta como visto ───────────────────────────────────────────────
  var mitad = new Set();
  var relojes = new Map();
  var arranca = function (el) {
    if (relojes.has(el) || document.hidden) return;
    relojes.set(el, setTimeout(function () { relojes.delete(el); if (mitad.has(el)) marca(el); }, MIRADA));
  };
  var para = function (el) { clearTimeout(relojes.get(el)); relojes.delete(el); };
  var ojo = 'IntersectionObserver' in window ? new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (e.isIntersecting && e.intersectionRatio >= 0.5) { mitad.add(e.target); arranca(e.target); }
      else { mitad.delete(e.target); para(e.target); }
    });
  }, { threshold: [0, 0.5] }) : null;
  // Con la pestaña escondida no se ve nada: se vuelve a empezar al volver.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) relojes.forEach(function (_, el) { para(el); });
    else mitad.forEach(arranca);
  });
  var vigila = function (el) { if (ojo && !el.hasAttribute('data-vv')) { el.setAttribute('data-vv', ''); ojo.observe(el); } };

  // Sin ordenar (páginas 2 y siguientes): solo se cuenta.
  if (!ordena) {
    caja.querySelectorAll('.tj[data-o][data-vh]').forEach(vigila);
    return;
  }

  // ── El orden ─────────────────────────────────────────────────────────────
  var esAgenda = function (el) { return el.hasAttribute('data-imp'); };
  var abiertoDestacado = true;
  var desde = 0; // de negocios desde la última de la agenda
  var normal = [];
  var agenda = [];
  var vistas = [];
  var hecho = false;
  var sep = null;
  // Recibidas de negocios y de la agenda (vistas o no): si llega una de la
  // agenda antes de su hueco, a la base ya no le quedan de negocios y lo de
  // la agenda que espera sale ya (como en la app, `normalDone`).
  var rawN = 0;
  var rawA = 0;
  var sinNegocios = false;

  // Dónde se colocan: en Descubre, antes de «Ver más» (la página siguiente)
  // o del final; en la lista, al final de la rejilla.
  var ancla = function () {
    if (!feed) return null;
    var mas = feed.querySelector(':scope > .feed-mas [data-feed-mas]');
    return (mas && mas.closest('.feed-mas')) || feed.querySelector(':scope > .feed-fin');
  };
  var pon = function (el) { caja.insertBefore(el, ancla()); vigila(el); };

  // Una de la agenda cuando le toca (cuatro de negocios desde la anterior) y,
  // si no, las de negocios. Lo de la agenda que queda al final, solo con
  // todo recibido.
  var saca = function (n, a, s, completo, poner) {
    for (;;) {
      if (s >= CADA && a.length) { poner(a.shift()); s = 0; }
      else if (n.length) { poner(n.shift()); s++; }
      else if (completo && a.length) { poner(a.shift()); s = 0; }
      else break;
    }
    return s;
  };

  var separacion = function () {
    var el = document.createElement(feed ? 'section' : 'div');
    el.className = feed ? 'feed-sep' : 'vistos-sep';
    el.setAttribute('aria-label', (T.title || '') + '. ' + (T.body || ''));
    el.innerHTML = '<div class="vs-in"><svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/></svg>'
      + '<h2 class="vs-t"></h2><p class="vs-b"></p>'
      + (T.change && T.settings ? '<p class="vs-c"><a></a></p>' : '')
      + '<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg></div>';
    el.querySelector('.vs-t').textContent = T.title || '';
    el.querySelector('.vs-b').textContent = T.body || '';
    // Para apagarlo: Ajustes › Lo que ves (también sin sesión).
    var cambia = el.querySelector('.vs-c a');
    if (cambia) { cambia.textContent = T.change; cambia.href = T.settings; }
    if (sepOjo) sepOjo.observe(el); else el.classList.add('on');
    return el;
  };
  // El texto de la separación entra con un fundido al llegar a ella (con
  // «Reducir movimiento», sin animación: lo dice el CSS).
  var sepOjo = 'IntersectionObserver' in window ? new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('on'); });
  }, { threshold: 0.4 }) : null;

  var recibe = function (tarjetas, completo) {
    if (hecho) return;
    tarjetas.forEach(function (el) {
      if (el.hasAttribute('data-vo')) return;
      el.setAttribute('data-vo', '');
      if (el.parentNode) el.parentNode.removeChild(el);
      if (esAgenda(el)) {
        rawA++;
        if (!(abiertoDestacado && el.hasAttribute('data-dest')) && rawN < CADA * rawA) sinNegocios = true;
      } else rawN++;
      if (abiertoDestacado && el.hasAttribute('data-dest')) {
        pon(el);
        desde += esAgenda(el) ? -CADA : 1;
        return;
      }
      abiertoDestacado = false;
      if (esVista(el)) vistas.push(el);
      else if (esAgenda(el)) agenda.push(el);
      else normal.push(el);
    });
    desde = saca(normal, agenda, desde, completo || sinNegocios, pon);
    if (!completo) return;
    hecho = true;
    if (!vistas.length) return;
    sep = separacion();
    pon(sep);
    saca(vistas.filter(function (el) { return !esAgenda(el); }), vistas.filter(esAgenda), 0, true, pon);
  };

  var nuevas = function () {
    return Array.prototype.filter.call(caja.children, function (n) { return esTarjeta(n) && !n.hasAttribute('data-vo'); });
  };
  // Lo nuevo a la vista (sin lo destacado): con poco, se pide más ya.
  var aLaVista = function () {
    return Array.prototype.filter.call(caja.children, function (n) { return esTarjeta(n) && !n.hasAttribute('data-dest'); }).length;
  };

  // ── Descubre: la página siguiente la trae /assets/tarjetas.js ─────────────
  if (feed) {
    var completoFeed = function () { return !feed.querySelector('[data-feed-mas]'); };
    recibe(nuevas(), completoFeed());
    new MutationObserver(function () {
      var n = nuevas();
      if (n.length || (!hecho && completoFeed())) recibe(n, completoFeed());
    }).observe(feed, { childList: true });
    // Las que no son de aquí (la fijada de un RRPP) también cuentan.
    feed.querySelectorAll(':scope > .tj[data-o][data-vh]').forEach(vigila);
    return;
  }

  // ── Lista de Explorar: «Ver más» en vez de las páginas ───────────────────
  var pager = document.querySelector('nav.pager');
  var siguiente = pager && pager.querySelector('a[rel="next"]');
  var href = siguiente ? siguiente.href : null;
  recibe(nuevas(), !href);
  if (!href) return;
  pager.hidden = true;
  var bloque = document.createElement('div');
  bloque.className = 'vistos-mas';
  var boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'pill';
  boton.textContent = T.more || '…';
  bloque.appendChild(boton);
  lista.insertAdjacentElement('afterend', bloque);
  var trayendo = false;
  var trae = function () {
    if (trayendo || !href) return;
    trayendo = true;
    boton.setAttribute('aria-busy', 'true');
    var antes = aLaVista();
    fetch(href, { credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (txt) {
      var doc = new DOMParser().parseFromString(txt, 'text/html');
      var otra = doc.querySelector('.tjs[data-vistos]');
      var sig = doc.querySelector('nav.pager a[rel="next"]');
      href = sig ? new URL(sig.getAttribute('href'), location.href).href : null;
      var llegan = otra ? Array.prototype.map.call(otra.querySelectorAll(':scope > .tj'), function (el) { return document.importNode(el, true); }) : [];
      llegan.forEach(function (el) { lista.appendChild(el); });
      if (window.KlendarTarjetas) llegan.forEach(function (el) { window.KlendarTarjetas.iniciar(el); });
      recibe(llegan, !href);
      if (!href) {
        // El final de la lista (con «Quizá te interese»), el de la última página.
        var fin = doc.querySelector('section.fin');
        if (fin && !document.querySelector('section.fin')) bloque.insertAdjacentElement('afterend', document.importNode(fin, true));
        bloque.remove();
      }
      trayendo = false;
      boton.removeAttribute('aria-busy');
      // Si todo lo que llegó ya se había visto, la siguiente ya.
      if (href && aLaVista() - antes < 6) trae();
    }).catch(function () { trayendo = false; boton.removeAttribute('aria-busy'); });
  };
  boton.addEventListener('click', trae);
  // Si la primera página era casi toda vista, se pide la siguiente sin esperar.
  if (aLaVista() < 6) trae();
})();

// Los estilos de la separación y de «Ver más» (solo existen con esto).
(function () {
  var st = document.createElement('style');
  st.textContent = ''
    + '.feed-sep{min-height:var(--feed-alto,100vh);display:flex;align-items:center;justify-content:center;text-align:center;'
    + 'padding:calc(var(--feed-arriba,96px) + 8px) 24px calc(var(--feed-abajo,24px) + 8px);background:var(--surface);color:var(--ink)}'
    + '.pagina-feed .feed>.feed-sep{scroll-snap-align:start;scroll-snap-stop:always}'
    + '.vistos-sep{grid-column:1/-1;display:flex;align-items:center;gap:18px;margin:6px 0;text-align:center;color:var(--ink)}'
    + '.vistos-sep::before,.vistos-sep::after{content:"";flex:1;border-top:1px solid var(--glass-border)}'
    + '.vs-in{display:flex;flex-direction:column;align-items:center;gap:4px}'
    + '.vs-t{margin:6px 0 0;font-size:1.1rem;font-weight:700}'
    + '.vs-b{margin:0;color:var(--ink-2)}'
    + '.vs-in svg:last-child{color:var(--ink-2)}'
    + '.vs-c{margin:4px 0 0;font-size:.9rem}.vs-c a{color:var(--ink-2);text-decoration:underline;text-underline-offset:2px}'
    + '.vistos-mas{display:flex;justify-content:center;margin:8px 0 20px}'
    + '@media (prefers-reduced-motion:no-preference){.feed-sep .vs-in{opacity:0;transform:translateY(8px);'
    + 'transition:opacity var(--mov-base,200ms) var(--mov-entra,ease-out),transform var(--mov-base,200ms) var(--mov-entra,ease-out)}'
    + '.feed-sep.on .vs-in{opacity:1;transform:none}}';
  document.head.appendChild(st);
})();
