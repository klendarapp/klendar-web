/* La ficha de una publicación para quien tiene su código o su reserva
 * (Iván, 2026-11-16; migración 20261282800000 de la app).
 *
 * La ficha pública (`/o/<id>`) se pinta sin sesión. Si la publicación está
 * en pausa o el local cerrado hoy, sale «Esta publicación ya no está»; pero
 * quien tiene un código o una reserva vivos sí la puede ver (como en la
 * app). Este script va solo en ese «ya no está»: si el navegador tiene
 * sesión, vuelve a pedir la página con ella (`x-klendar-sesion`) y, si la
 * base se la da, la pone en lugar del aviso. Sin sesión, sin red o sin
 * código, se queda el «ya no está». No guarda nada en el navegador.
 *
 * Va en `<span hidden data-ficha-codigo="<id>">`. */
(function () {
  'use strict';
  var el = document.querySelector('[data-ficha-codigo]');
  if (!el || !window.fetch) return;

  function carga(src, integrity) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }
  function sesionGuardada(ref) {
    try {
      var s = JSON.parse(localStorage.getItem('sb-' + ref + '-auth-token') || 'null');
      return !!(s && (s.refresh_token || s.access_token));
    } catch (e) { return false; }
  }

  (window.KLENDAR_ENV ? Promise.resolve() : carga('/config.js?v=4'))
    .then(function () {
      var env = window.KLENDAR_ENV;
      if (!env) return null;
      var ref = (env.url.match(/^https:\/\/([a-z0-9]+)\./) || [])[1];
      if (!sesionGuardada(ref)) return null;
      return (window.supabase ? Promise.resolve() : carga('/assets/vendor/supabase-js-2.117.2.js',
          'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok'))
        .then(function () {
          // El mismo cliente que amigos.js y cerrado.js (uno por página).
          var sb = window.klendarSb || (window.klendarSb = window.supabase.createClient(env.url, env.key,
            { auth: { flowType: 'pkce', detectSessionInUrl: false } }));
          // getSession renueva el token si ha caducado.
          return sb.auth.getSession();
        })
        .then(function (r) {
          var token = r && r.data && r.data.session && r.data.session.access_token;
          if (!token) return null;
          return fetch(location.pathname + location.search, {
            headers: { 'x-klendar-sesion': token },
            cache: 'no-store',
            credentials: 'same-origin',
          });
        })
        .then(function (res) {
          if (!res || res.status !== 200) return null;
          return res.text().then(function (html) {
            // La ficha entera, con sus scripts («Ver mi código»…).
            document.open();
            document.write(html);
            document.close();
          });
        });
    })
    .catch(function () { /* se queda el «ya no está» */ });
})();
