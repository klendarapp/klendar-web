/* Descubre: la oferta de la lista de un RRPP, fijada arriba.
 *
 * Solo para quien entró por el enlace de un RRPP (con sesión de «Tu
 * cuenta»): `my_promoter_pins` da las ofertas de esa lista hasta que saca el
 * código, se acaba la oferta o cierra el local en la sesión de la oferta.
 * Nadie más la ve (la página va en caché y no sabe quién mira: lo pinta el
 * navegador). Cada una lleva «De la lista de Marta», su ficha con el enlace
 * (`?rp=`) y una × que la quita (`dismiss_promoter_pin`, también en la app).
 *
 * Sin sesión guardada no carga nada más: ni la configuración ni Supabase.
 * Lo mismo que la app (migración 20261112100001).
 */
(function () {
  'use strict';
  var yo = document.currentScript;
  var caja = document.getElementById('rp-fijadas');
  if (!yo || !caja) return;
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

  function pinta(sb, pins) {
    if (!pins.length) { caja.hidden = true; caja.innerHTML = ''; return; }
    caja.innerHTML = pins.slice(0, 2).map(function (p) {
      var nombre = String(p.promoter_name || '').trim() || T.user;
      var href = (en ? '/en' : '') + '/o/' + encodeURIComponent(p.id) + (p.rp ? '?rp=' + encodeURIComponent(p.rp) : '');
      return '<div class="exclusiva rp-fijada" style="display:flex;align-items:center;gap:8px;margin:8px 0 0;padding:8px 8px 8px 14px">' +
        '<a href="' + esc(href) + '" style="flex:1;min-width:0;color:inherit;text-decoration:none">' +
        '<small style="display:block;font-weight:700;opacity:.75">' + esc(T.from(nombre)) + '</small>' +
        '<b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
        esc([p.title, p.business_name].filter(Boolean).join(' · ')) + '</b></a>' +
        '<button type="button" class="pill" data-quita="' + esc(p.id) + '" aria-label="' + esc(T.remove) + '" title="' + esc(T.remove) + '" style="min-width:44px;min-height:44px">×</button>' +
        '</div>';
    }).join('');
    caja.hidden = false;
    Array.prototype.forEach.call(caja.querySelectorAll('[data-quita]'), function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-quita');
        pinta(sb, pins.filter(function (x) { return x.id !== id; }));
        sb.rpc('dismiss_promoter_pin', { p_offer: id }).then(null, function () { /* vuelve a salir otro día */ });
      };
    });
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
          if (res.error || !Array.isArray(res.data)) return;
          pinta(sb, res.data);
        });
      });
    })
    .catch(function () { /* sin fijadas: Descubre sigue igual */ });
})();
