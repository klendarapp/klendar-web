/* Las tarjetas de publicación de la web pública (functions/_lib/tarjeta.js),
 * el feed de Descubre y los filtros de Explorar y Descubre.
 *
 * - Galería: todas las fotos y vídeos de cada publicación, como en la app. Se
 *   deslizan de lado; los puntos dicen cuál es y, en el escritorio, hay
 *   flechas.
 * - Vídeo: se reproduce en silencio mientras se ve (solo el que está a la
 *   vista en su galería), como en Descubre de la app. Nunca con «reducir
 *   movimiento» ni con ahorro de datos (o una conexión lenta): ahí se queda la
 *   foto de portada con el botón de reproducir. El altavoz le pone el sonido y
 *   se recuerda mientras navegas (esta pestaña, `sessionStorage`), pero al
 *   entrar en una página nada suena hasta que la tocas: el navegador tampoco
 *   lo dejaría. Con sonido, solo suena uno a la vez.
 * - Cuenta atrás: «Ahora · quedan 1 h 20 min» en las ofertas en marcha (la
 *   página va en caché y una hora escrita en el servidor saldría vieja).
 * - Distancia: si has usado «Cerca de mí» hace poco, cada tarjeta dice a
 *   cuánto está. La posición se queda en este navegador (no se manda a nada).
 * - Descubre: una por pantalla; ↑/↓ (y AvPág/RePág, J/K), los botones de los
 *   lados y la rueda pasan de una a otra; ←/→ mueven la galería. La cabecera
 *   sigue a lo que hay detrás (foto: blanco con velo; el final: el tema). Al
 *   llegar al final de la página se trae la siguiente. El scroll es del
 *   <body> (ver public.css): aquí se fija el alto de una pantalla una vez (y
 *   solo cambia si cambia la ventana de verdad) y se piden ya las fotos de
 *   la tarjeta siguiente para que no lleguen en blanco.
 * - Ficha: la misma galería en grande; tocar una pieza (o «Ver a pantalla
 *   completa») abre el visor, como en la app. Las miniaturas de la carta, las
 *   novedades y las reseñas también lo abren.
 * - Filtros: los desplegables y la hoja se cierran al pulsar fuera o con
 *   Escape, y solo hay uno abierto a la vez; «Cerca de mí» y «Estoy aquí»
 *   piden la ubicación (solo al pulsarlos); los enlaces de la propia página
 *   no se pisan con los filtros guardados (ver `guardaFiltros` en
 *   functions/_lib/explore.js).
 */
(function () {
  'use strict';
  var EN = document.documentElement.lang === 'en';
  var LOC = EN ? 'en-GB' : 'es-ES';
  var feed = document.getElementById('feed');

  // ── Movimiento, datos y sonido ─────────────────────────────────────────
  var quieto = window.matchMedia('(prefers-reduced-motion: reduce)');
  function ahorro() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return Boolean(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
  }
  function puedeMoverse() { return !quieto.matches && !ahorro(); }
  function suave() { return quieto.matches ? 'auto' : 'smooth'; }

  var tocado = false; // ¿ha tocado algo la persona en esta página?
  function activada() {
    return tocado || Boolean(navigator.userActivation && navigator.userActivation.hasBeenActive);
  }
  ['pointerdown', 'keydown'].forEach(function (t) {
    document.addEventListener(t, function () { tocado = true; }, { capture: true, passive: true });
  });
  function sonidoGuardado() {
    try { return sessionStorage.getItem('klendar.sonido') === '1'; } catch (e) { return false; }
  }
  function guardaSonido(on) {
    try { if (on) sessionStorage.setItem('klendar.sonido', '1'); else sessionStorage.removeItem('klendar.sonido'); } catch (e) { /* nada */ }
  }

  // ── Vídeos ─────────────────────────────────────────────────────────────
  var videos = [];
  var aLaVista = new Set();
  var visor = null; // el visor a pantalla completa, si está abierto
  function carga(v) {
    if (!v.getAttribute('src')) v.setAttribute('src', v.getAttribute('data-src'));
  }
  function galeriaDe(el) { return el.closest ? el.closest('.tj-galeria') : null; }
  function indice(g) {
    var pista = g.querySelector('.tj-pista');
    return Math.max(0, Math.min(pista.children.length - 1, Math.round(pista.scrollLeft / Math.max(1, pista.clientWidth))));
  }
  function esLaActual(v) {
    var g = galeriaDe(v);
    if (!g) return true;
    return g.querySelector('.tj-pista').children[indice(g)] === v.closest('.tj-pieza');
  }
  function callaLosDemas(v) {
    videos.forEach(function (o) { if (o !== v && !o.muted) o.muted = true; });
  }
  function reproduce(v, aMano) {
    carga(v);
    var conSonido = sonidoGuardado() && (aMano || activada());
    v.muted = !conSonido;
    if (conSonido) callaLosDemas(v);
    var p = v.play();
    if (p && p.catch) {
      p.catch(function () {
        // El navegador no deja con sonido: en silencio; si tampoco, la portada.
        if (!v.muted) { v.muted = true; v.play().catch(function () { /* la portada */ }); }
      });
    }
  }
  function decide(v) {
    // Con el visor abierto, solo se mueve lo que hay dentro de él.
    var tapado = visor && !visor.contains(v);
    if (!tapado && aLaVista.has(v) && esLaActual(v) && puedeMoverse()) reproduce(v, false);
    else if (!v.paused) v.pause();
  }
  var mira = 'IntersectionObserver' in window ? new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (e.isIntersecting && e.intersectionRatio >= 0.6) aLaVista.add(e.target); else aLaVista.delete(e.target);
      decide(e.target);
    });
  }, { threshold: [0, 0.6] }) : null;
  if (quieto.addEventListener) quieto.addEventListener('change', function () { videos.forEach(decide); });

  // ── Galería ────────────────────────────────────────────────────────────
  function pintaGaleria(g) {
    var pista = g.querySelector('.tj-pista');
    var n = pista.children.length;
    var i = indice(g);
    g.querySelectorAll('.tj-puntos i').forEach(function (p, k) { p.classList.toggle('on', k === i); });
    var ant = g.querySelector('.tj-ant');
    var sig = g.querySelector('.tj-sig');
    if (ant) ant.classList.toggle('fuera', i <= 0);
    if (sig) sig.classList.toggle('fuera', i >= n - 1);
    var pieza = pista.children[i];
    var v = pieza && pieza.querySelector('video');
    var son = g.querySelector('.tj-sonido');
    var play = g.querySelector('.tj-play');
    if (son) son.hidden = !v;
    if (play) play.hidden = !v || !v.paused || puedeMoverse();
    g.querySelectorAll('video').forEach(decide);
    // «Foto 2 de 3» para el lector de pantalla (solo al cambiar) y, en el
    // visor, «2 / 3» en la barra.
    if (g.dataset.i !== String(i)) {
      var primeraVez = g.dataset.i == null;
      g.dataset.i = String(i);
      var txt = nombrePieza(Boolean(v), i + 1, n);
      var estado = g.querySelector('.tj-estado');
      if (estado && !primeraVez) estado.textContent = txt;
      // «Denunciar» de la pieza que se ve (los medios de una reseña).
      var den = g.closest('.visor') && g.closest('.visor').querySelector('.visor-denuncia');
      if (den) {
        var dd = pieza && pieza.getAttribute('data-denuncia');
        den.hidden = !dd;
        if (dd) den.setAttribute('href', dd);
      }
      var barra = g.closest('.visor') && g.closest('.visor').querySelector('.visor-n');
      if (barra) {
        barra.firstElementChild.textContent = (i + 1) + ' / ' + n;
        if (!primeraVez) barra.lastElementChild.textContent = txt;
      }
    }
  }
  // Los textos, de assets/tarjeta.js (cargado donde hay ficha o visor).
  function nombrePieza(video, i, n) {
    var KT = window.KlendarTarjeta;
    return KT ? KT.nombrePieza(video, i, n, EN ? 'en' : 'es') : '';
  }
  function mueve(g, d) {
    var pista = g.querySelector('.tj-pista');
    pista.scrollTo({ left: (indice(g) + d) * pista.clientWidth, behavior: suave() });
  }
  function pintaSonido() {
    var on = sonidoGuardado();
    document.querySelectorAll('.tj-sonido').forEach(function (b) {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('on', on);
    });
  }

  // ── Arranque de un trozo de página (al cargar y con cada página nueva del feed) ──
  function iniciar(raiz) {
    raiz.querySelectorAll('video[data-src]').forEach(function (v) {
      if (videos.indexOf(v) >= 0) return;
      videos.push(v);
      // Sin portada: el primer fotograma, para que no quede un rectángulo
      // negro (salvo con ahorro de datos: ahí, la inicial del negocio).
      if (v.controls) carga(v);
      if (!v.getAttribute('poster') && !ahorro()) { v.preload = 'metadata'; carga(v); }
      else if (!v.getAttribute('poster')) {
        var ph = document.createElement('span');
        ph.className = 'tj-ph'; ph.setAttribute('aria-hidden', 'true'); ph.textContent = '▶';
        v.after(ph);
      }
      var g = galeriaDe(v);
      if (g) {
        v.addEventListener('play', function () { pintaGaleria(g); });
        v.addEventListener('pause', function () { pintaGaleria(g); });
      }
      if (mira) mira.observe(v);
    });
    raiz.querySelectorAll('.tj-galeria').forEach(function (g) {
      if (g.dataset.lista) return;
      g.dataset.lista = '1';
      g.querySelectorAll('.tj-flecha, .tj-ampliar').forEach(function (b) { b.hidden = false; });
      var pista = g.querySelector('.tj-pista');
      var t = null;
      pista.addEventListener('scroll', function () {
        clearTimeout(t);
        t = setTimeout(function () { pintaGaleria(g); }, 60);
      }, { passive: true });
      pintaGaleria(g);
    });
    // Miniaturas de vídeo (reseñas, novedades): el primer fotograma, solo al
    // acercarse y nunca con ahorro de datos (ahí, el triángulo sobre gris).
    raiz.querySelectorAll('video[data-mini]').forEach(function (v) {
      if (ahorro()) return;
      if (cercaMini) cercaMini.observe(v); else v.src = v.getAttribute('data-mini');
    });
    pintaSonido();
    relojes = Array.prototype.slice.call(document.querySelectorAll('.tj-cuando[data-fin]'));
    tic();
    distancias(raiz);
  }

  document.addEventListener('click', function (e) {
    var t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    var flecha = t.closest('[data-galeria]');
    if (flecha) { e.preventDefault(); mueve(flecha.closest('.tj-galeria'), Number(flecha.getAttribute('data-galeria'))); return; }
    var son = t.closest('.tj-sonido');
    if (son) {
      e.preventDefault();
      var on = !sonidoGuardado();
      guardaSonido(on);
      pintaSonido();
      var g = son.closest('.tj-galeria');
      var v = g && g.querySelector('.tj-pista').children[indice(g)].querySelector('video');
      if (v) {
        v.muted = !on;
        if (on) { callaLosDemas(v); if (v.paused) reproduce(v, true); }
      }
      return;
    }
    var play = t.closest('.tj-play');
    if (play) {
      e.preventDefault();
      var gp = play.closest('.tj-galeria');
      var vp = gp.querySelector('.tj-pista').children[indice(gp)].querySelector('video');
      if (vp) reproduce(vp, true);
      return;
    }
    if (t.closest('[data-visor-cierra]')) { e.preventDefault(); cierraVisor(); return; }
    // En el visor, tocar el vídeo lo para o lo sigue.
    var vv = visor && t.closest('.visor video');
    if (vv) { e.preventDefault(); if (vv.paused) reproduce(vv, true); else vv.pause(); return; }
    var abre = t.closest('[data-visor-abre]');
    if (abre) {
      var ga = abre.closest('.tj-galeria');
      var actualA = ga && ga.querySelector('.tj-pista').children[indice(ga)];
      if (actualA && abreVisor(actualA.getAttribute('data-visor'), Number(actualA.getAttribute('data-visor-i')) || 0, abre)) e.preventDefault();
      return;
    }
    var pieza = t.closest('a[data-visor]');
    if (pieza && !e.shiftKey && !e.metaKey && !e.ctrlKey && e.button === 0
      && abreVisor(pieza.getAttribute('data-visor'), Number(pieza.getAttribute('data-visor-i')) || 0, pieza)) e.preventDefault();
  });

  // ── Cuenta atrás de las ofertas flash ──────────────────────────────────
  var relojes = [];
  var reloj = null;
  function dur(ms) {
    var m = Math.floor(ms / 60000);
    if (m >= 1440) return Math.floor(m / 1440) + ' d';
    if (m >= 60) return Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
    return Math.max(1, m) + ' min';
  }
  function tic() {
    clearTimeout(reloj);
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
    if (relojes.length) reloj = setTimeout(tic, 30000);
  }

  // ── Distancia, si sabemos dónde estás ──────────────────────────────────
  var aqui = null;
  try {
    var gg = JSON.parse(localStorage.getItem('klendar.cerca') || 'null');
    if (gg && Date.now() - gg.t < 6 * 3600e3 && isFinite(gg.lat) && isFinite(gg.lng)) aqui = gg;
    // Pasadas las 6 horas ya no sirve: se borra (es tu posición; nada de
    // guardarla más de lo necesario).
    else if (gg) localStorage.removeItem('klendar.cerca');
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
  function distancias(raiz) {
    if (!aqui) return;
    raiz.querySelectorAll('[data-lat][data-lng]').forEach(function (el) {
      var hueco = el.querySelector('.tj-dist') || (el.classList.contains('dist') ? el : null);
      if (!hueco || hueco.textContent.trim()) return;
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

  // En la dirección, la posición de «Cerca de mí» va con 3 decimales (unos
  // 100 m), nunca más precisa: la distancia de cada tarjeta se calcula aquí
  // con la de `klendar.cerca`. Un enlace de antes con más decimales se
  // redondea también en la barra de direcciones (el servidor ya lo redondea
  // al leerlo).
  function posUrl(x) { return (Math.round(x * 1000) / 1000).toFixed(3); }
  (function () {
    try {
      var u = new URL(location.href), cambia = false;
      ['lat', 'lng'].forEach(function (k) {
        var v = u.searchParams.get(k), n = parseFloat(v);
        if (v && isFinite(n) && /\.\d{4,}/.test(v)) { u.searchParams.set(k, posUrl(n)); cambia = true; }
      });
      if (cambia) history.replaceState(history.state, '', u.toString());
    } catch (e) { /* nada */ }
  })();

  // ── Visor a pantalla completa (como `showPhotoViewer` en la app) ───────
  // Lo abren las piezas de la galería de una ficha, su botón «Ver a pantalla
  // completa» y las miniaturas (`[data-visor]`: carta, novedades, reseñas).
  // Es un <dialog> modal: el foco entra en «Cerrar», lo de detrás queda
  // inerte, Escape lo cierra y el foco vuelve a donde estaba. ←/→ pasan de
  // pieza, y en el móvil se desliza (de lado) o se cierra arrastrando hacia
  // abajo. Lo pinta `assets/tarjeta.js` (la misma galería, entera y en negro).
  function piezasDe(grupo) {
    var urls = [];
    document.querySelectorAll('[data-visor]').forEach(function (a) {
      if (a.getAttribute('data-visor') !== grupo || (visor && visor.contains(a))) return;
      var i = Number(a.getAttribute('data-visor-i')) || 0;
      // El tipo y la portada, si la miniatura los sabe (los medios de una
      // reseña); si no, el tipo sale de la extensión.
      if (!urls[i]) {
        urls[i] = {
          url: a.getAttribute('href'),
          video: a.hasAttribute('data-visor-video') ? true : null,
          poster: a.getAttribute('data-visor-poster') || null,
          denuncia: a.getAttribute('data-visor-denuncia') || null,
        };
      }
    });
    return urls.filter(Boolean);
  }
  var deDonde = null; // { foco, galeria }
  function abreVisor(grupo, i, desde) {
    var KT = window.KlendarTarjeta;
    var urls = piezasDe(grupo);
    if (!KT || !urls.length || visor) return false;
    var tmp = document.createElement('div');
    tmp.innerHTML = KT.visor(urls, { lang: EN ? 'en' : 'es', i: i });
    visor = tmp.firstElementChild;
    if (typeof visor.showModal !== 'function') { visor = null; return false; }
    var g = desde && desde.closest('.tj-galeria');
    deDonde = { foco: g ? g.querySelector('.tj-ampliar') : desde, galeria: g };
    document.body.appendChild(visor);
    document.documentElement.classList.add('con-visor');
    visor.addEventListener('cancel', function (e) { e.preventDefault(); cierraVisor(); });
    visor.showModal();
    var pista = visor.querySelector('.tj-pista');
    pista.scrollLeft = i * pista.clientWidth;
    videos.forEach(decide); // lo de detrás se para
    iniciar(visor);
    arrastre(visor);
    return true;
  }
  function cierraVisor() {
    if (!visor) return;
    var g = visor.querySelector('.tj-galeria');
    var i = g ? indice(g) : 0;
    visor.querySelectorAll('video').forEach(function (v) {
      v.pause(); v.removeAttribute('src'); v.load();
      if (mira) mira.unobserve(v);
      aLaVista.delete(v);
    });
    videos = videos.filter(function (v) { return !visor.contains(v); });
    visor.close();
    visor.remove();
    visor = null;
    document.documentElement.classList.remove('con-visor');
    var d = deDonde || {};
    deDonde = null;
    // La galería de la ficha se queda en la pieza que se estaba viendo.
    if (d.galeria) {
      var p = d.galeria.querySelector('.tj-pista');
      p.scrollLeft = i * p.clientWidth;
      pintaGaleria(d.galeria);
    }
    videos.forEach(decide);
    if (d.foco && d.foco.isConnected) d.foco.focus({ preventScroll: true });
  }
  // Arrastrar hacia abajo cierra (con el dedo; de lado, la galería).
  function arrastre(el) {
    var x0 = 0, y0 = 0, dy = 0, eje = '';
    var g = el.querySelector('.tj-galeria');
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { eje = 'no'; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dy = 0; eje = '';
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (eje === 'no' || e.touches.length !== 1) return;
      var mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
      if (!eje && Math.abs(mx) + Math.abs(my) > 10) eje = Math.abs(my) > Math.abs(mx) ? 'y' : 'x';
      if (eje !== 'y') return;
      dy = Math.max(0, my);
      g.style.transform = 'translateY(' + dy + 'px)';
      el.style.backgroundColor = 'rgba(0,0,0,' + Math.max(0.3, 1 - dy / 400) + ')';
    }, { passive: true });
    el.addEventListener('touchend', function () {
      if (eje === 'y' && dy > 120) { cierraVisor(); return; }
      g.style.transform = ''; el.style.backgroundColor = '';
      eje = '';
    }, { passive: true });
  }
  // ←/→: en el visor, y en la galería de una ficha si tiene el foco.
  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var t = e.target instanceof Element ? e.target : null;
    if (t && t.closest('input, textarea, select, [contenteditable]')) return;
    var g = visor ? visor.querySelector('.tj-galeria') : t && t.closest('.tj-galeria--ficha');
    if (!g || !g.querySelector('.tj-flecha')) return;
    e.preventDefault();
    mueve(g, e.key === 'ArrowRight' ? 1 : -1);
  });
  var cercaMini = 'IntersectionObserver' in window ? new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      cercaMini.unobserve(e.target);
      e.target.preload = 'metadata';
      e.target.src = e.target.getAttribute('data-mini');
    });
  }, { rootMargin: '300px' }) : null;

  // ── Filtros: lo de la propia página no se pisa con lo guardado ─────────
  function marcaPropia() { try { sessionStorage.setItem('klendar.filtros.sin', '1'); } catch (e) { /* nada */ } }
  document.addEventListener('click', function (e) {
    var a = e.target instanceof Element ? e.target.closest('a[href]') : null;
    if (!a) return;
    try {
      var u = new URL(a.getAttribute('href'), location.href);
      if (u.origin === location.origin && u.pathname === location.pathname && u.search !== location.search) marcaPropia();
    } catch (x) { /* un enlace raro */ }
  }, true);
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f && f.method && f.method.toLowerCase() === 'get') {
      try { if (new URL(f.action, location.href).pathname === location.pathname) marcaPropia(); } catch (x) { /* nada */ }
    }
  }, true);

  // «Cerca de mí», «Estoy aquí» y «Cercanía»: piden la ubicación y vuelven
  // con ella (y con lo de `data-mas`), sin ciudad ni página.
  var errCerca = document.getElementById('cercaErr');
  document.querySelectorAll('[data-cerca]').forEach(function (b) {
    if (!navigator.geolocation) return;
    b.hidden = false;
    b.addEventListener('click', function () {
      navigator.geolocation.getCurrentPosition(function (p) {
        var lat = p.coords.latitude, lng = p.coords.longitude;
        window.KL_CERCA(lat, lng);
        var u = new URL(location.href);
        u.searchParams.set('lat', posUrl(lat)); u.searchParams.set('lng', posUrl(lng));
        ['p', 'ciudad', 'city'].forEach(function (k) { u.searchParams.delete(k); });
        new URLSearchParams(b.getAttribute('data-mas') || '').forEach(function (v, k) { u.searchParams.set(k, v); });
        marcaPropia();
        location.href = u.toString();
      }, function () {
        if (errCerca) { errCerca.textContent = b.getAttribute('data-err'); errCerca.hidden = false; }
      }, { maximumAge: 300000, timeout: 10000 });
    });
  });
  var aviso = document.querySelector('[data-cerca-aviso]');
  if (aviso && navigator.geolocation) aviso.hidden = false;

  // ── Desplegables y hoja de filtros ─────────────────────────────────────
  // «Cambiar filtros» (al final de la lista) abre la hoja.
  document.addEventListener('click', function (e) {
    var a = e.target instanceof Element ? e.target.closest('[data-abre-filtros]') : null;
    var hoja = document.getElementById('filtros');
    if (!a || !hoja) return;
    e.preventDefault();
    hoja.open = true;
  });
  // «Restablecer»: la hoja vuelve a lo de serie sin salir de ella (como la
  // app); sin JavaScript es un enlace.
  document.addEventListener('click', function (e) {
    var a = e.target instanceof Element ? e.target.closest('[data-restablecer]') : null;
    if (!a) return;
    var f = a.closest('form');
    if (!f) return;
    e.preventDefault();
    Array.prototype.forEach.call(f.querySelectorAll('input[type=radio]'), function (r) { r.checked = r.value === ''; });
    // «Según el tiempo» no está en la hoja (va en el menú de orden): el
    // oculto que lo conserva no se toca.
    Array.prototype.forEach.call(f.querySelectorAll('input[type=checkbox]'), function (c) { c.checked = false; });
    f.dispatchEvent(new Event('change'));
  });
  // La hoja manda solo lo que tiene valor (sin `precio=&orden=` en la URL).
  document.querySelectorAll('form.hoja-cuerpo').forEach(function (f) {
    f.addEventListener('submit', function () {
      Array.prototype.forEach.call(f.elements, function (el) {
        if (el.name && !el.value && (el.type !== 'radio' || el.checked)) el.disabled = true;
      });
    });
    // «Más filtros (2 activos)» y «Ver 24 resultados» al cambiar algo: el
    // número lo da la misma página (`?contar=1`), con lo que lleva marcado.
    var ver = f.querySelector('[data-ver-n]');
    var masN = f.querySelector('[data-mas-n]');
    var espera = null;
    var pedido = 0;
    f.addEventListener('change', function () {
      // «Edad de los niños» solo con «Apto para niños» marcado (y sin él se
      // desmarca: la base no la usaría).
      var edades = f.querySelector('[data-con-ninos]');
      if (edades) {
        var ninos = f.querySelector('.hoja-sitio input[value="ninos"], .hoja-sitio input[value="kids"]');
        var con = Boolean(ninos && ninos.checked);
        edades.hidden = !con;
        if (!con) Array.prototype.forEach.call(edades.querySelectorAll('input'), function (c) { c.checked = false; });
      }
      if (masN) {
        // Casillas marcadas y opciones elegidas que no son «Cualquiera».
        var n = f.querySelectorAll('details.hoja-mas input[type=checkbox]:checked').length
          + Array.prototype.filter.call(f.querySelectorAll('details.hoja-mas input[type=radio]:checked'), function (r) { return r.value !== ''; }).length;
        masN.hidden = n === 0;
        masN.textContent = n === 1 ? masN.getAttribute('data-uno') : masN.getAttribute('data-varios').replace('{n}', n);
      }
      if (!ver) return;
      clearTimeout(espera);
      espera = setTimeout(function () {
        var qs = new URLSearchParams();
        Array.prototype.forEach.call(f.elements, function (el) {
          if (!el.name || !el.value || el.disabled) return;
          if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
          qs.append(el.name, el.value);
        });
        qs.set('contar', '1');
        var este = ++pedido;
        fetch((f.getAttribute('action') || location.pathname) + '?' + qs.toString(), { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            if (este !== pedido) return;
            var n = d && typeof d.total === 'number' ? d.total : null;
            ver.textContent = n == null ? ver.getAttribute('data-sin')
              : n > 100 ? ver.getAttribute('data-muchos')
                : n === 1 ? ver.getAttribute('data-uno') : ver.getAttribute('data-varios').replace('{n}', n);
          })
          .catch(function () { if (este === pedido) ver.textContent = ver.getAttribute('data-sin'); });
      }, 350);
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
        var primero = d.querySelector('.hoja-cuerpo input:checked') || d.querySelector('.hoja-cuerpo input:not([type=hidden])');
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
    // Lo que pasa en un diálogo abierto desde la hoja (el selector de
    // categorías va en un <dialog> fuera de ella) no la cierra: al elegir
    // una categoría se vuelve a la hoja, como en la app.
    if (!t.closest('details.desplegable, details.hoja, dialog')) cierra(null);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    // Escape en el selector cierra solo el selector.
    if (e.target instanceof Element && e.target.closest('dialog')) return;
    var lista = abiertos();
    if (!lista.length) return;
    var ultimo = lista[lista.length - 1];
    ultimo.open = false;
    var s = ultimo.querySelector('summary');
    if (s) s.focus();
  });

  // ── Descubre: una por pantalla ─────────────────────────────────────────
  if (feed) {
    var fondo = document.querySelector('.feed-fondo');
    var actual = null;
    var pantallas = function () { return Array.prototype.slice.call(feed.querySelectorAll(':scope > .tj, :scope > .feed-fin')); };
    // Lo que hace scroll: el <body> (public.css); sin `:has()`, el documento.
    var rueda = function () {
      var b = document.body;
      return b.classList.contains('pagina-feed') && /(auto|scroll)/.test(getComputedStyle(b).overflowY) ? b : null;
    };
    var caja0 = rueda();
    // El alto de una pantalla: el del <body>, fijado aquí una vez. Solo se
    // vuelve a poner si la ventana cambia de verdad (girar el móvil, otra
    // ventana): el documento no se mueve, así que la barra del navegador no
    // lo cambia a mitad de gesto.
    if (caja0) {
      var altoPuesto = 0;
      var fijaAlto = function () {
        var h = caja0.clientHeight;
        if (!h || Math.abs(h - altoPuesto) < 1) return;
        altoPuesto = h;
        caja0.style.setProperty('--feed-vp', h + 'px');
      };
      fijaAlto();
      if ('ResizeObserver' in window) new ResizeObserver(fijaAlto).observe(caja0);
      else window.addEventListener('resize', fijaAlto, { passive: true });
      caja0.classList.add('feed-listo');
    }
    // Pasado el feed («Más formas de explorar» y el pie), la cabecera vuelve a
    // ser la de siempre y lo de encima de la foto se va.
    var fuera = false;
    var cromoPuesto = '';
    var cromo = function () {
      var conFoto = actual && actual.classList.contains('tj') && Boolean(actual.querySelector('img.tj-img, video.tj-img'));
      var c = fuera ? 'fuera' : conFoto ? 'media' : 'tema';
      // Cambiarlo recalcula los estilos de toda la página: solo si cambia.
      if (c !== cromoPuesto) { cromoPuesto = c; document.body.setAttribute('data-cromo', c); }
    };
    // Las fotos de la siguiente (y de la anterior) se piden ya, y el vídeo
    // de la siguiente prepara su principio: al deslizar ya están (con
    // `loading="lazy"` dentro de una caja con scroll, Safari no las pide
    // hasta que asoman). De la actual, también la segunda pieza de su
    // galería. Con ahorro de datos, solo la foto de la siguiente.
    var prepara = function (el, todo) {
      if (!el || !el.classList.contains('tj')) return;
      var piezas = el.querySelectorAll('.tj-pista > .tj-pieza');
      Array.prototype.forEach.call(piezas, function (p, k) {
        if (k > (todo ? 1 : 0)) return;
        var im = p.querySelector('img[loading="lazy"]');
        if (im) im.loading = 'eager';
        var v = k === 0 && !todo && p.querySelector('video[data-src]');
        if (v && !ahorro() && !v.getAttribute('src')) { v.preload = 'metadata'; carga(v); }
      });
    };
    var marca = function (el) {
      if (!el || el === actual) return;
      actual = el;
      cromo();
      var lista = pantallas();
      var i = lista.indexOf(el);
      prepara(el, true);
      prepara(lista[i + 1], false);
      if (!ahorro()) { prepara(lista[i + 2], false); prepara(lista[i - 1], false); }
      if (fondo && fondo.offsetParent !== null) {
        var img = el.querySelector('.tj-pista > :first-child img, img.tj-img');
        var src = img ? (img.currentSrc || img.src) : (el.querySelector('video[poster]') || {}).poster;
        fondo.style.setProperty('--foto', src ? 'url("' + String(src).replace(/["\\]/g, '') + '")' : 'none');
      }
    };
    var ojo = 'IntersectionObserver' in window ? new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { if (e.isIntersecting) marca(e.target); });
    }, { threshold: 0.55 }) : null;
    // «Fuera» cuando «Más formas» ha subido por encima del 60 % de la
    // pantalla. Se vigilan «Más formas» y el feed: si se salta de golpe al
    // pie, «Más formas» pasa de no verse a no verse (sin aviso) pero el feed
    // sí avisa al irse. Al avisar, se mira dónde está de verdad.
    var masFormas = document.querySelector('.mas-formas');
    if (masFormas && 'IntersectionObserver' in window) {
      var limite = new IntersectionObserver(function () {
        // (+4: el navegador redondea el margen a píxeles enteros.)
        fuera = masFormas.getBoundingClientRect().top < window.innerHeight * 0.6 + 4;
        cromo();
      }, { rootMargin: '0px 0px -40% 0px' });
      limite.observe(masFormas);
      limite.observe(feed);
    }
    var vigila = function (raiz) { if (ojo) raiz.querySelectorAll(':scope > .tj, :scope > .feed-fin').forEach(function (el) { ojo.observe(el); }); };
    vigila(feed);
    // Las que llegan después (la oferta fijada de un RRPP, /assets/fijada.js,
    // va la primera): también se vigilan.
    if (ojo && 'MutationObserver' in window) {
      new MutationObserver(function (cambios) {
        cambios.forEach(function (c) {
          Array.prototype.forEach.call(c.addedNodes, function (n) {
            if (n.nodeType === 1 && n.matches('.tj, .feed-fin')) ojo.observe(n);
          });
        });
      }).observe(feed, { childList: true });
    }
    marca(pantallas()[0]);

    var ir = function (d) {
      var lista = pantallas();
      var i = Math.max(0, lista.indexOf(actual));
      var destino = lista[Math.max(0, Math.min(lista.length - 1, i + d))];
      if (destino && destino !== actual) destino.scrollIntoView({ block: 'start', behavior: suave() });
    };
    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target;
      if (t instanceof Element && t.closest('input, textarea, select, [contenteditable], details[open], dialog')) return;
      if (abiertos().length) return;
      var k = e.key;
      if (k === 'ArrowDown' || k === 'PageDown' || k === 'j' || k === 'J') { e.preventDefault(); ir(1); }
      else if (k === 'ArrowUp' || k === 'PageUp' || k === 'k' || k === 'K') { e.preventDefault(); ir(-1); }
      else if ((k === 'ArrowLeft' || k === 'ArrowRight') && actual) {
        var g = actual.querySelector('.tj-galeria');
        if (g) { e.preventDefault(); mueve(g, k === 'ArrowRight' ? 1 : -1); }
      }
    });
    // La rueda (y el trackpad): una pantalla por gesto, como el dedo en el
    // móvil. Se espera a que el gesto acabe (la inercia del trackpad manda
    // muchos eventos seguidos) antes de aceptar otro. En la pantalla final,
    // hacia abajo, la página sigue normal hasta el pie.
    var acumulado = 0;
    var quieta = 0;
    var tRueda = null;
    // Lo fijo de encima (filtros, flechas, el fondo de los lados, las
    // pestañas) no está dentro de lo que hace scroll: el navegador manda su
    // gesto al documento, que no se mueve. Ahí lo hacemos a mano.
    var FIJOS = '.feed-cab, .feed-nav, .feed-fondo, .feed-lado, .tabbar';
    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey || abiertos().length || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      var t = e.target instanceof Element ? e.target : null;
      if (t && t.closest('.hoja-cuerpo, .menu-d, header.top')) return;
      if (fuera || (actual && actual.classList.contains('feed-fin') && e.deltaY > 0)) {
        // Pasado el feed, la página sigue normal hasta el pie.
        if (caja0 && t && t.closest(FIJOS)) { e.preventDefault(); caja0.scrollBy({ top: e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY }); }
        return;
      }
      e.preventDefault();
      clearTimeout(tRueda);
      tRueda = setTimeout(function () { acumulado = 0; quieta = 0; }, 180);
      if (Date.now() < quieta) return;
      acumulado += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      if (Math.abs(acumulado) < 30) return;
      ir(acumulado > 0 ? 1 : -1);
      acumulado = 0;
      quieta = Date.now() + 100000; // hasta que pare el gesto (el temporizador de arriba)
    }, { passive: false });
    // Con el dedo pasa lo mismo: deslizar en vertical sobre la cabecera, los
    // filtros o las pestañas pasa de tarjeta (pasado el feed, mueve la
    // página). Pasivo: no frena el scroll de lado de los filtros ni los toques.
    if (caja0) {
      var dedo = null;
      document.addEventListener('touchstart', function (e) {
        dedo = null;
        var t = e.target instanceof Element ? e.target : null;
        if (e.touches.length !== 1 || !t || !t.closest('header.top, ' + FIJOS) || t.closest('.menu-d, details[open], nav.main')) return;
        var menu = document.getElementById('menu');
        if (abiertos().length || (menu && menu.checked)) return;
        dedo = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }, { passive: true });
      document.addEventListener('touchend', function (e) {
        if (!dedo || !e.changedTouches.length) return;
        var dx = e.changedTouches[0].clientX - dedo.x, dy = e.changedTouches[0].clientY - dedo.y;
        dedo = null;
        if (Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
        if (fuera || (actual && actual.classList.contains('feed-fin') && dy < 0)) caja0.scrollBy({ top: -dy * 2, behavior: suave() });
        else ir(dy < 0 ? 1 : -1);
      }, { passive: true });
      document.addEventListener('touchcancel', function () { dedo = null; }, { passive: true });
    }
    document.querySelectorAll('[data-feed-ir]').forEach(function (b) {
      b.addEventListener('click', function () { ir(Number(b.getAttribute('data-feed-ir'))); });
    });
    // «Volver al principio»: a la primera.
    document.addEventListener('click', function (e) {
      var a = e.target instanceof Element ? e.target.closest('a[href="#arriba"]') : null;
      if (!a) return;
      e.preventDefault();
      (rueda() || window).scrollTo({ top: 0, behavior: suave() });
    });

    // La página siguiente, al acercarse al final (sin JavaScript, «Ver más»).
    var trae = function (enlace) {
      if (enlace.dataset.cargando) return;
      enlace.dataset.cargando = '1';
      fetch(enlace.href, { credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (txt) {
        var doc = new DOMParser().parseFromString(txt, 'text/html');
        var nuevo = doc.getElementById('feed');
        var caja = enlace.closest('.feed-mas');
        if (!nuevo || !caja) throw new Error('sin feed');
        var trozo = document.createDocumentFragment();
        Array.prototype.forEach.call(nuevo.children, function (el, i) {
          if (i === 0 && el.classList.contains('feed-mas')) return; // «Anterior»
          trozo.appendChild(document.importNode(el, true));
        });
        var tmp = document.createElement('div');
        tmp.appendChild(trozo);
        var hijos = Array.prototype.slice.call(tmp.children);
        caja.replaceWith.apply(caja, hijos);
        hijos.forEach(function (h) { iniciar(h); if (ojo && (h.classList.contains('tj') || h.classList.contains('feed-fin'))) ojo.observe(h); });
        hijos.forEach(function (h) { var m = h.querySelector && h.querySelector('[data-feed-mas]'); if (m) observaMas(m); if (h.matches && h.matches('.feed-mas')) { var mm = h.querySelector('[data-feed-mas]'); if (mm) observaMas(mm); } });
      }).catch(function () { delete enlace.dataset.cargando; });
    };
    // Con el <body> haciendo scroll, el margen ha de ser el suyo (con la
    // ventana de raíz, lo de debajo está recortado por el <body> y nunca se
    // «acerca»): se trae dos pantallas antes de llegar.
    var cerca = 'IntersectionObserver' in window ? new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { if (e.isIntersecting) { cerca.unobserve(e.target); trae(e.target); } });
    }, { root: caja0, rootMargin: '200% 0px' }) : null;
    var observaMas = function (a) { if (cerca) cerca.observe(a); };
    feed.querySelectorAll('[data-feed-mas]').forEach(observaMas);
  }

  iniciar(document);
  window.KlendarTarjetas = { iniciar: iniciar };
})();
