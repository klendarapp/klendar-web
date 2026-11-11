// Lo de la cabecera que depende de si has entrado, ANTES del primer pintado
// (Iván, 2026-11-04: «a veces mete un pequeño saltito» al pasar entre
// Descubre, Explorar, Planes y Cuenta).
//
// Va justo detrás de </header>, sin `defer` (es pequeño y se guarda en
// caché): «Entrar» pasa a ser tu inicial (o tu foto), la campana sale si hay
// sesión y, si no cabe todo, el logo se queda en el símbolo. Antes lo hacía
// cabecera.js con `defer`, y en «Tu cuenta» (con sus scripts al final) la
// cabecera se pintaba primero con «Entrar» y luego se movía: «Para
// negocios» y el idioma saltaban 42 px a la derecha.
//
// No llama a nada: mira si el navegador guarda una sesión de Supabase (la
// misma que usan «Tu cuenta» y el panel). cabecera.js lo vuelve a usar al
// entrar o salir y al cambiar el ancho (`window.KL_YO`).
//
// Solo vale la sesión del Supabase al que apunta la web (Iván, 2026-11-04: al
// pasar la web de dev a prod, «Tu cuenta» pedía entrar y la cabecera seguía
// con su foto, la de la sesión de dev que quedaba en el navegador). El
// proyecto se sabe por `window.KLENDAR_ENV` (config.js), por la etiqueta de
// errores.js (las páginas de las Functions lo llevan en el <head>) o, en las
// estáticas, que cargan config.js después, por lo último que se vio
// (`klendar.sb`); sin saberlo, como sin sesión (cabecera.js lo pide y vuelve
// a pintar). Cuando se sabe, las sesiones de otro proyecto se borran y, si el
// proyecto ha cambiado, lo guardado de la cuenta de antes (`olvida`).
(function () {
  'use strict';

  var MARCA = 'klendar.sb';

  function refDe(url) {
    try { return new URL(url).hostname.split('.')[0].toLowerCase(); } catch (e) { return ''; }
  }

  /** Lo que es de una cuenta o de un proyecto, guardado en este navegador:
   * los gustos y «Tu ciudad», el negocio del panel, los códigos y colas sin
   * conexión, las ciudades y el interruptor de los sorteos de esa base. Lo
   * mismo que se borra al salir (assets/cuenta/app.js, panel/panel.js) y lo que solo
   * vale para ese Supabase. */
  function olvida() {
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && (k.indexOf('klendar.cola.') === 0 || k.indexOf('klendar.codigos.') === 0)) localStorage.removeItem(k);
      }
      ['klendar.biz', 'klendar.gustos'].forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* sin almacenamiento */ }
    try {
      ['klendar.sorteosWeb', 'klendar.ciudades', 'klendar.grupos.elegidos'].forEach(function (k) { sessionStorage.removeItem(k); });
    } catch (e) { /* sin almacenamiento */ }
  }

  /** El proyecto de verdad (config.js o la etiqueta de errores.js): borra las
   * sesiones de otros proyectos y, si ha cambiado, lo de la cuenta de antes. */
  function asegura(ref) {
    try {
      var otro = false;
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        var m = /^sb-([a-z0-9-]+?)-(?:admin-)?auth-token/.exec(k || '');
        if (m && m[1] !== ref) { localStorage.removeItem(k); otro = true; }
      }
      var antes = localStorage.getItem(MARCA);
      if (antes !== ref) {
        if (otro || antes) olvida();
        localStorage.setItem(MARCA, ref);
      }
    } catch (e) { /* sin almacenamiento */ }
  }

  /** `sb-<ref>`: el proyecto al que apunta la web, o '' si aún no se sabe. */
  function proyecto() {
    var url = (window.KLENDAR_ENV && window.KLENDAR_ENV.url) || '';
    if (!url) {
      var e = document.querySelector('script[src*="/assets/errores.js"][data-url]');
      url = (e && e.getAttribute('data-url')) || '';
    }
    var ref = url ? refDe(url) : '';
    if (ref) { asegura(ref); return ref; }
    try { return localStorage.getItem(MARCA) || ''; } catch (x) { return ''; }
  }

  /** La clave de la sesión de supabase-js en este proyecto. */
  function clave() {
    var ref = proyecto();
    return ref ? 'sb-' + ref + '-auth-token' : null;
  }

  function sesion() {
    try {
      var k = clave();
      if (!k) return null;
      var s = JSON.parse(localStorage.getItem(k) || 'null');
      var u = s && (s.user || (s.currentSession && s.currentSession.user));
      if (u && (!s.expires_at || s.refresh_token)) return u;
    } catch (e) { /* sin almacenamiento: como sin sesión */ }
    return null;
  }

  function pinta() {
    // «Tu cuenta» lleva las cabeceras de los dos idiomas: puede haber dos.
    var botones = document.querySelectorAll('.top-entrar');
    var usuario = sesion();
    // Lo que solo tiene sentido sin cuenta («Crear cuenta gratis»).
    document.querySelectorAll('[data-sin-sesion]').forEach(function (el) { el.hidden = Boolean(usuario); });
    // La campana, solo con sesión (la cifra la pone cabecera.js).
    document.querySelectorAll('[data-campana]').forEach(function (b) { b.hidden = !usuario; });
    var meta = (usuario && usuario.user_metadata) || {};
    var nombre = meta.display_name || meta.full_name || (usuario && usuario.email) || '';
    var inicial = (nombre.trim().charAt(0) || '·').toUpperCase();
    var foto = meta.avatar_url || meta.picture;
    Array.prototype.forEach.call(botones, function (boton) {
      if (!boton.dataset.entrar) boton.dataset.entrar = JSON.stringify([boton.textContent, boton.getAttribute('href')]);
      if (!usuario) {
        var antes = JSON.parse(boton.dataset.entrar);
        boton.classList.remove('top-yo');
        boton.textContent = antes[0];
        boton.setAttribute('href', antes[1]);
        boton.removeAttribute('aria-label');
        boton.removeAttribute('title');
        return;
      }
      boton.classList.add('top-yo');
      boton.href = boton.dataset.cuenta || '/cuenta';
      boton.setAttribute('aria-label', boton.dataset.cuentaTxt || 'Tu cuenta');
      boton.title = nombre;
      var ya = boton.querySelector('img');
      if (foto && /^https:\/\//.test(foto)) {
        if (ya && ya.getAttribute('src') === foto) return;
        boton.textContent = '';
        var img = document.createElement('img');
        img.src = foto; img.alt = ''; img.referrerPolicy = 'no-referrer';
        img.onerror = function () { img.remove(); boton.textContent = inicial; };
        boton.appendChild(img);
      } else {
        boton.textContent = inicial;
      }
    });
  }

  // Si en la cabecera no cabe todo (Descubre en un móvil estrecho, con ✨, la
  // lupa y la campana), el logo se queda en el símbolo, como el nombre que
  // se encoge en la app. El nombre sigue para el lector.
  function justa() {
    document.querySelectorAll('header.top').forEach(function (cab) {
      var fila = cab.querySelector('.wrap');
      if (!fila || !cab.querySelector('.top-iconos')) return;
      cab.classList.remove('top-justa');
      var a = cab.querySelector('.top-acciones');
      var b = cab.querySelector('.brand');
      // La cabecera escondida (la del otro idioma en «Tu cuenta») no mide.
      if (!a || !b || !fila.offsetParent) return;
      if (b.getBoundingClientRect().right + 8 > a.getBoundingClientRect().left || fila.scrollWidth > fila.clientWidth + 1) cab.classList.add('top-justa');
    });
  }

  // Volver al enlace después de entrar (Iván, 11-11: entró desde un enlace de
  // amigo, inició sesión en la web y no le salió nada). En una página de
  // enlace (amigo, oferta, sorteo, cola, RRPP…), «Entrar» de la cabecera
  // apunta adónde volver; «Tu cuenta» lo usa al entrar, sea con contraseña,
  // código, el botón del correo (otra pestaña), Google o el móvil, o al crear
  // la cuenta (assets/cuenta/app.js, `tomaVuelta`). Caduca a los 20 min.
  var DE_CUENTA = { amigo: 'amigo', friend: 'amigo', cola: 'cola', queue: 'cola', sorteo: 'sorteo', giveaway: 'sorteo', listo: 'listo', ready: 'listo' };
  function vueltaDe(path) {
    var m = /^\/(?:en\/)?(amigo|friend|cola|queue|sorteo|giveaway|listo|ready)\/([A-Za-z0-9_-]{1,64})$/.exec(path);
    if (m) return 'cuenta:' + DE_CUENTA[m[1]] + '/' + m[2];
    if (/^\/(?:en\/)?(o|rp|r|v|m|c|coleccion|collection)\/[A-Za-z0-9_-]{1,80}$/.test(path)) return 'web:' + path;
    return '';
  }
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('.top-entrar');
    if (!a || sesion()) return;
    var v = vueltaDe(location.pathname.replace(/\/+$/, ''));
    if (!v) return;
    try { localStorage.setItem('klendar.vuelta', JSON.stringify({ r: v, t: Date.now() })); } catch (e) { /* sin almacenamiento */ }
  }, true);

  window.KL_YO = { sesion: sesion, clave: clave, proyecto: proyecto, refDe: refDe, pinta: pinta, justa: justa, vueltaDe: vueltaDe };
  pinta();
  justa();

  // «Abrir en la app» en el móvil (Iván, 11-11): una barra discreta debajo de
  // la cabecera, que se pone antes del primer pintado (este script va justo
  // detrás de </header>) para que nada salte. Con la app instalada, Android la
  // abre en la misma página (intent:// a las direcciones que la app reconoce,
  // las del manifiesto; en las demás, la app a secas); si no está instalada,
  // vuelve aquí con #sin-app. Mientras la app no esté publicada para todos
  // (`APP_PUBLICA` en functions/_lib/chrome.js, que deja `data-app-publica`
  // en la cabecera), «Muy pronto en Android e iPhone» en vez de mandar a la
  // tienda; publicada, a Google Play o a la App Store. En iPhone un enlace
  // universal no abre la app desde la misma web: ahí solo la tienda (o «muy
  // pronto»). Se cierra con la X y no vuelve en 7 días (1 en las páginas de
  // enlaces, donde va más a la vista). Ni en «Tu cuenta», el panel, el admin,
  // la tele, la comprobación anti-robots ni Descubre (cabecera fija).
  var ENLACE = /^\/(?:en\/)?(o|b|r|rp|v|m|c|a|amigo|friend|sorteo|giveaway|cola|queue|listo|ready|partidos|matches)\/[^/]+/;
  var DE_LA_APP = /^\/(r|o|b|v|rp|amigo|tv\/enlazar|partidos|a|c|m|sorteo|cola|listo|en\/(o|b|friend|rp|giveaway|queue|ready|a|m))\//;
  function barraApp() {
    var yo = document.currentScript;
    var cab = yo && yo.previousElementSibling;
    var ua = navigator.userAgent || '';
    var android = /Android/i.test(ua);
    var ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var ruta = location.pathname.replace(/\/+$/, '') || '/';
    if (!cab || !cab.matches || !cab.matches('header.top') || (!android && !ios) || window.KL_BARRA_APP) return;
    if (/^\/(cuenta|panel|admin|tv|captcha|widget)(\/|$)/.test(ruta)) return;
    if (/pagina-(feed|descubre)/.test(document.body.className) || window.matchMedia('(display-mode: standalone)').matches) return;
    var enlace = ENLACE.test(ruta);
    // La oferta, el negocio y el enlace de amigo ya llevan su «Abrir en la
    // app» en Android (functions/_lib/public.js, openInApp): no dos.
    if (android && /^\/(?:en\/)?(o|b|amigo|friend)\//.test(ruta)) return;
    var cerrada = 0;
    try { cerrada = Number(localStorage.getItem('klendar.barraApp')) || 0; } catch (e) { /* sin almacenamiento */ }
    if (Date.now() - cerrada < (enlace ? 1 : 7) * 864e5) return;
    window.KL_BARRA_APP = true;
    var en = (document.documentElement.lang || 'es').slice(0, 2) === 'en';
    var publica = cab.hasAttribute('data-app-publica');
    var T = en
      ? { t: enlace ? 'Open it in the app' : 'Klendar is better in the app', ab: enlace ? 'Open in the app' : 'Open', des: 'Download', pronto: 'The app: coming soon to Android and iPhone', x: 'Close' }
      : { t: enlace ? 'Ábrelo en la app' : 'Klendar va mejor en la app', ab: enlace ? 'Abrir en la app' : 'Abrir', des: 'Descargar', pronto: 'La app, muy pronto en Android e iPhone', x: 'Cerrar' };
    var aqui = location.href.split('#')[0];
    var deLaApp = DE_LA_APP.test(ruta + '/');
    var accion = '';
    if (android) {
      var vuelta = publica ? 'https://play.google.com/store/apps/details?id=app.klendar' : aqui + '#sin-app';
      accion = (deLaApp ? 'intent://klendar.app' + ruta + '#Intent;scheme=https' : 'intent://auth-callback/#Intent;scheme=app.klendar')
        + ';package=app.klendar;S.browser_fallback_url=' + encodeURIComponent(vuelta) + ';end';
    } else if (publica) accion = 'https://apps.apple.com/app/klendar/id6825686729';
    var est = document.createElement('style');
    est.textContent = '.barra-app{display:flex;align-items:center;gap:10px;margin:0 auto;padding:6px 12px 6px 16px;max-width:1100px;font-size:14px;font-weight:600;color:var(--ink,#0a0a0a);border-bottom:1px solid var(--glass-border,rgba(0,0,0,.08))}'
      + '.barra-app.es-enlace{margin:8px 16px 0;border:1px solid var(--glass-border,rgba(0,0,0,.08));border-radius:16px;background:var(--glass,rgba(255,255,255,.6))}'
      + '.barra-app .ba-t{flex:1;min-width:0}'
      + '.barra-app .ba-b{flex:none;display:inline-flex;align-items:center;min-height:36px;padding:6px 14px;border-radius:999px;background:var(--ink,#0a0a0a);color:var(--surface,#fff);text-decoration:none;font-weight:700}'
      + '.barra-app .ba-x{flex:none;display:inline-grid;place-items:center;width:44px;height:44px;margin:-4px -8px -4px 0;border:0;background:none;color:inherit;font-size:22px;line-height:1;cursor:pointer}'
      + '.barra-app [hidden]{display:none!important}';
    document.head.appendChild(est);
    var b = document.createElement('div');
    b.className = 'barra-app' + (enlace ? ' es-enlace' : '');
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'Klendar app');
    b.innerHTML = '<span class="ba-t"></span><a class="ba-b" hidden></a><button type="button" class="ba-x"><span aria-hidden="true">×</span></button>';
    var tx = b.querySelector('.ba-t');
    var bt = b.querySelector('.ba-b');
    b.querySelector('.ba-x').setAttribute('aria-label', T.x);
    function pon() {
      var sinApp = !accion || (location.hash === '#sin-app' && !publica);
      tx.textContent = sinApp ? T.pronto : T.t;
      bt.hidden = sinApp;
      if (!sinApp) { bt.textContent = android ? T.ab : T.des; bt.href = accion; }
    }
    pon();
    addEventListener('hashchange', pon);
    b.querySelector('.ba-x').onclick = function () {
      b.remove();
      try { localStorage.setItem('klendar.barraApp', String(Date.now())); } catch (e) { /* sin almacenamiento */ }
    };
    yo.parentNode.insertBefore(b, yo.nextSibling);
  }
  try { barraApp(); } catch (e) { /* nunca rompe la cabecera */ }
})();
