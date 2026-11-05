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
      boton.href = boton.dataset.cuenta || '/cuenta/';
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

  window.KL_YO = { sesion: sesion, clave: clave, proyecto: proyecto, refDe: refDe, pinta: pinta, justa: justa };
  pinta();
  justa();
})();
