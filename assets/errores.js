/* Klendar — errores de la web que ocurren en el navegador de la gente.
 *
 * Escucha `error` y `unhandledrejection` y los apunta en la base
 * (`log_web_error`, migración 20261012100000_errores_web en el repo de la
 * app), donde el admin los ve agrupados en «Errores de la web».
 *
 * - Sin terceros ni supabase-js: un `fetch` con la clave publicable, como
 *   anónimo (aunque haya sesión): nunca se sabe de quién es el error.
 * - Nada personal: solo la ruta de la página (sin query ni hash), el
 *   navegador resumido («Chrome 129 · Android»), el idioma y el error, con
 *   correos, tokens y números largos quitados aquí y otra vez en la base.
 * - Como mucho 5 por carga y cada uno una sola vez. Si el envío falla, se
 *   calla: nunca rompe nada ni se llama a sí mismo en bucle.
 * - La dirección y la clave salen de `window.KLENDAR_ENV` (config.js); en
 *   las páginas que pintan las Functions van en `data-url`/`data-key` de la
 *   propia etiqueta; y en las estáticas, que no cargan config.js, se carga
 *   /config.js solo si hay algo que mandar.
 *
 * Va en el <head>, antes que los demás scripts, para ver también sus errores.
 */
(function () {
  'use strict';
  if (window.__klendarErrores) return;
  window.__klendarErrores = true;

  var MAX = 5;
  var yo = document.currentScript;
  var vistos = {};
  var enviados = 0;
  var cola = [];
  var cargandoConfig = false;

  function config() {
    var e = window.KLENDAR_ENV;
    if (e && e.url && e.key) return { url: e.url, key: e.key };
    var d = yo && yo.dataset;
    if (d && d.url && d.key) return { url: d.url, key: d.key };
    return null;
  }

  function area(ruta) {
    if (/^\/admin(\/|$)/.test(ruta)) return 'admin';
    if (/^\/panel(\/|$)/.test(ruta)) return 'panel';
    if (/^\/app(\/|$)/.test(ruta)) return 'cuenta';
    return 'publica';
  }

  // Familia y versión mayor, y el sistema sin versión. Nunca el user-agent.
  function navegador() {
    var ua = navigator.userAgent || '';
    var reglas = [
      ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/], ['Opera', /OPR\/(\d+)/],
      ['Samsung', /SamsungBrowser\/(\d+)/], ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
      ['Chrome', /(?:Chrome|CriOS)\/(\d+)/], ['Safari', /Version\/(\d+)[\d.]*(?: Mobile\/\S+)? Safari/],
    ];
    var nombre = 'Otro', ver = '';
    for (var i = 0; i < reglas.length; i++) {
      var m = ua.match(reglas[i][1]);
      if (m) { nombre = reglas[i][0]; ver = m[1]; break; }
    }
    var so = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
      : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'ChromeOS'
      : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
    return nombre + (ver ? ' ' + ver.slice(0, 4) : '') + (so ? ' · ' + so : '');
  }

  function idioma() {
    var l = (window.I18N && window.I18N.lang) || document.documentElement.lang || '';
    l = String(l).slice(0, 2).toLowerCase();
    return /^[a-z]{2}$/.test(l) ? l : null;
  }

  // Lo mismo que hace la base (web_error_scrub), para que lo personal ni
  // siquiera salga del navegador.
  function limpia(s, max) {
    if (s == null) return null;
    s = String(s).slice(0, max * 4)
      // Los códigos de los enlaces personales (/amigo/<código>, /r/, /v/,
      // /baja/…), también en el archivo y la pila, no solo en la página.
      .replace(/(\/(en\/)?(amigo|friend|r|baja|unsubscribe|v|cartel\/local|poster\/venue))\/[\w-]{6,}/g, '$1/*')
      .replace(/\?(?!v=[\w.-]{1,20}(?::|\s|\)|$))[^\s)'"<>]*/g, '')
      .replace(/(access_token|refresh_token|provider_token|token|apikey|api_key|password|code|email)=[^&\s)'"<>]*/gi, '$1=<x>')
      .replace(/eyJ[\w-]{4,}\.[\w-]{4,}(\.[\w-]*)?/g, '<jwt>')
      .replace(/sb_[\w-]{8,}/g, '<key>')
      .replace(/Bearer\s+[^\s'"]+/gi, 'Bearer <token>')
      .replace(/[\w.%+-]+@[\w-]+(\.[\w-]+)*\.[A-Za-z]{2,}/g, '<email>')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
      .replace(/\b[0-9a-f]{16,}\b/gi, '<hex>')
      .replace(/(?=[\w+/-]*\d)(?=[\w+/-]*[A-Za-z])[\w+/-]{28,}={0,2}/g, '<token>')
      .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '<ip>')
      .replace(/\+?\d[\d -]{6,}\d/g, '<n>');
    s = s.slice(0, max).trim();
    return s || null;
  }

  // Ruido que no es de Klendar o que no se puede arreglar.
  function ruido(msg, src, pila) {
    if (/^(chrome|moz|safari|safari-web|ms-browser|edge)-extension:|^webkit-masked-url:/i.test(src || '')) return true;
    if (/(chrome|moz|safari|safari-web|ms-browser)-extension:\/\//i.test(pila || '')) return true;
    if (/^(uncaught )?script error\.?$/i.test(msg) && !src) return true;
    if (/ResizeObserver loop/i.test(msg)) return true;
    if (/AbortError|aborted|cancelled|cancelado|Failed to fetch|NetworkError|Load failed|Network request failed|net::ERR_/i.test(msg)) return true;
    if (navigator.onLine === false) return true;
    return false;
  }

  function cargarConfig() {
    if (cargandoConfig) return;
    cargandoConfig = true;
    try {
      var s = document.createElement('script');
      s.src = '/config.js?v=3';
      s.async = true;
      s.onload = function () { var c = cola; cola = []; for (var i = 0; i < c.length; i++) mandar(c[i]); };
      s.onerror = function () { cola = []; };
      (document.head || document.documentElement).appendChild(s);
    } catch (e) { /* nada */ }
  }

  function mandar(datos) {
    var c = config();
    if (!c) { cola.push(datos); cargarConfig(); return; }
    try {
      var r = fetch(c.url.replace(/\/+$/, '') + '/rest/v1/rpc/log_web_error', {
        method: 'POST',
        keepalive: true,
        credentials: 'omit',
        headers: { apikey: c.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      if (r && r.catch) r.catch(function () { /* se calla */ });
    } catch (e) { /* se calla */ }
  }

  // Archivo, línea y columna de la primera línea de la pila que tenga una
  // dirección (para los rechazos, que no traen archivo).
  function primerMarco(pila) {
    var m = /(https?:\/\/[^\s()]+?):(\d+):(\d+)/.exec(pila || '');
    return m ? { src: m[1], line: +m[2], col: +m[3] } : null;
  }

  function apunta(tipo, mensaje, src, linea, col, pila) {
    try {
      if (enviados >= MAX) return;
      var msg = String(mensaje == null ? '' : mensaje).replace(/\s+/g, ' ').trim()
        .replace(/^Uncaught (\(in promise\) )?/, '');
      if (!msg) return;
      pila = pila ? String(pila) : '';
      if (!src && pila) {
        var mc = primerMarco(pila);
        if (mc) { src = mc.src; linea = linea || mc.line; col = col || mc.col; }
      }
      src = src ? String(src) : '';
      if (/\/assets\/errores\.js/.test(src)) return; // lo nuestro no se apunta a sí mismo
      if (ruido(msg, src, pila)) return;

      // Mismo sitio y mismo mensaje: una vez por carga.
      var clave = msg + '|' + src + '|' + (linea || '');
      if (vistos[clave]) return;
      vistos[clave] = true;
      enviados++;

      var ver = /[?&]v=([\w.-]{1,20})/.exec(src);
      var ruta = location.pathname || '/';
      var fuente = src.replace(/[?#].*$/, '');
      if (fuente.indexOf(location.origin) === 0) fuente = fuente.slice(location.origin.length);

      mandar({
        p_message: limpia(msg, 500),
        p_area: area(ruta),
        p_source: limpia(fuente, 300),
        p_line: linea > 0 ? Math.floor(linea) : null,
        p_col: col > 0 ? Math.floor(col) : null,
        p_stack: limpia(pila.split(location.origin).join(''), 2000),
        p_page: limpia(ruta, 200),
        p_lang: idioma(),
        p_browser: navegador(),
        p_version: ver ? ver[1] : null,
        p_kind: tipo,
      });
    } catch (e) { /* nunca romper la página por apuntar un error */ }
  }

  window.addEventListener('error', function (ev) {
    // Los fallos al cargar una imagen o un script llegan aquí sin mensaje.
    if (!ev || !ev.message) return;
    apunta('error', ev.message, ev.filename, ev.lineno, ev.colno, ev.error && ev.error.stack);
  });

  window.addEventListener('unhandledrejection', function (ev) {
    // Se mira un momento después: si la página lo ha atendido
    // (`preventDefault`, como las pantallas viejas del admin), no es un error.
    setTimeout(function () {
      try {
        if (!ev || ev.defaultPrevented) return;
        var r = ev.reason;
        if (r && r.obsoleta) return;
        var msg = r && r.message ? (r.name && r.name !== 'Error' ? r.name + ': ' : '') + r.message
          : typeof r === 'string' ? r : (function () { try { return JSON.stringify(r); } catch (e) { return String(r); } })();
        apunta('rejection', msg, '', 0, 0, r && r.stack);
      } catch (e) { /* nada */ }
    }, 0);
  });
})();
