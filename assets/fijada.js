/* Descubre: la oferta de la lista de un RRPP, la primera publicación.
 *
 * Solo para quien entró por el enlace de un RRPP (con sesión de «Tu
 * cuenta»): `my_promoter_pins` da las ofertas de esa lista hasta que saca el
 * código, se acaba la oferta o cierra el local en la sesión de la oferta.
 * Nadie más la ve (la página va en caché y no sabe quién mira: lo pinta el
 * navegador). Es una publicación, no un aviso: va como la primera tarjeta
 * del feed (la misma de `assets/tarjeta.js`), con «De la lista de Marta» y
 * una × entre sus sellos que la quita (`dismiss_promoter_pin`, también en la
 * app), y su ficha lleva el enlace (`?rp=`). Si también venía en el feed, no
 * sale dos veces.
 *
 * Sin sesión guardada no carga nada más: ni la configuración ni Supabase.
 * Lo mismo que la app (migración 20261112100001).
 */
(function () {
  'use strict';
  var yo = document.currentScript;
  var feed = document.getElementById('feed');
  if (!yo || !feed) return;
  var en = yo.dataset.lang === 'en';
  var T = en
    ? { from: function (n) { return 'From ' + n + "'s list"; }, user: 'Klendar user', remove: 'Remove from Discover' }
    : { from: function (n) { return 'De la lista de ' + n; }, user: 'Usuario de Klendar', remove: 'Quitar de Descubre' };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function haySesion() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!/^sb-[a-z0-9]+-auth-token$/.test(k)) continue;
        var s = JSON.parse(localStorage.getItem(k) || 'null');
        if (s && (s.refresh_token || s.access_token)) return true;
      }
    } catch (e) { /* sin almacenamiento: como sin sesión */ }
    return false;
  }
  if (!haySesion()) return;

  function carga(src, integrity) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }

  var PIN = '<svg class="ic" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>';
  var X = '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

  function pinta(sb, pins) {
    var KT = window.KlendarTarjeta;
    if (!KT || !pins.length) return;
    // Si se está en la primera, la fijada pasa a ser la que se ve (el
    // navegador, por no mover lo que se mira, la dejaría encima, fuera).
    var rueda = document.scrollingElement || document.documentElement;
    var arriba = document.body.scrollTop < 8 && rueda.scrollTop < 8;
    // Al principio de la lista, en su orden (como mucho dos).
    pins.slice(0, 2).reverse().forEach(function (p) {
      var nombre = String(p.promoter_name || '').trim() || T.user;
      var href = (en ? '/en' : '') + '/o/' + encodeURIComponent(p.id) + (p.rp ? '?rp=' + encodeURIComponent(p.rp) : '');
      var tmp = document.createElement('div');
      tmp.innerHTML = KT.tarjeta(p, en ? 'en' : 'es', { forma: 'pantalla', desc: true, h: 'h2', galeria: true, href: href });
      var el = tmp.firstElementChild;
      if (!el) return;
      el.classList.add('tj--fijada');
      var sellos = el.querySelector('.tj-sellos');
      if (sellos) {
        sellos.insertAdjacentHTML('afterbegin', '<span class="tj-sello tj-sello--fijada">' + PIN + '<span>' + esc(T.from(nombre)) + '</span>'
          + '<button type="button" data-quita="' + esc(p.id) + '" aria-label="' + esc(T.remove) + '" title="' + esc(T.remove) + '">' + X + '</button></span>');
      }
      // Si también venía en el feed, no sale dos veces.
      Array.prototype.forEach.call(feed.querySelectorAll(':scope > .tj[data-o="' + String(p.id).replace(/"/g, '') + '"]'), function (x) { x.remove(); });
      var primera = feed.querySelector(':scope > .tj, :scope > .feed-fin');
      feed.insertBefore(el, primera || null);
      var quita = el.querySelector('[data-quita]');
      if (quita) {
        quita.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          el.remove();
          sb.rpc('dismiss_promoter_pin', { p_offer: p.id }).then(null, function () { /* vuelve a salir otro día */ });
        });
      }
    });
    if (arriba) { document.body.scrollTop = 0; rueda.scrollTop = 0; }
  }

  (window.KLENDAR_ENV ? Promise.resolve() : carga('/config.js?v=3'))
    .then(function () {
      return window.supabase ? null : carga('/assets/vendor/supabase-js-2.117.2.js',
        'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok');
    })
    .then(function () {
      var e = window.KLENDAR_ENV;
      if (!e || !window.supabase) return null;
      var sb = window.klendarSb || (window.klendarSb = window.supabase.createClient(e.url, e.key,
        { auth: { flowType: 'pkce', detectSessionInUrl: false } }));
      return sb.auth.getSession().then(function (r) {
        if (!r.data || !r.data.session) return null;
        return sb.rpc('my_promoter_pins', {}).then(function (res) {
          if (res.error || !Array.isArray(res.data) || !res.data.length) return null;
          // La tarjeta es la de toda la web (assets/tarjeta.js).
          return (window.KlendarZona ? Promise.resolve() : carga('/assets/zona.js?v=1'))
            .then(function () { return window.KlendarTarjeta ? null : carga('/assets/tarjeta.js?v=9'); })
            .then(function () { pinta(sb, res.data); });
        });
      });
    })
    .catch(function () { /* sin fijadas: Descubre sigue igual */ });
})();
