/* «Busca tu municipio» (2026-11-03, «Toda España preparada»; como la app,
 * `municipality_picker.dart`): cualquier municipio de España
 * (`search_municipalities`, sin tildes ni mayúsculas, por el principio de
 * cualquier palabra y con una letra mal si no hay nada) y el municipio de un
 * punto (`municipality_here`, no guarda nada).
 *
 * Mejora lo que ya funciona sin JavaScript: un `[data-muni-busca]` lleva un
 * `<input type="search">` (dentro de un formulario que, sin JavaScript, manda
 * el texto y la página lo resuelve), `[data-muni-res]` donde van los
 * resultados y, opcional, `[data-muni-sin]`: lo que se ve sin texto (las
 * «Populares», «Todas las ciudades»), que se esconde mientras se escribe.
 *
 * - Con `data-muni-href` («/descubre?ciudad=__SLUG__»), cada resultado es
 *   un enlace.
 * - Sin él, un botón: al tocarlo, el evento `muni-elegido` en el
 *   `[data-muni-busca]` con el municipio en `detail` (`{code, slug, name,
 *   province, lat, lng, radius_m, city_id}`): «Tu cuenta › Tu ciudad».
 *
 * `window.KlendarMunicipios`: `busca(q)`, `aqui(lat, lng)`, `activa(el)`.
 */
(function () {
  'use strict';

  function carga(src) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }
  function conf() {
    return (window.KLENDAR_ENV ? Promise.resolve() : carga('/config.js?v=4'))
      .then(function () { return window.KLENDAR_ENV || null; });
  }
  function rpc(fn, body) {
    return conf().then(function (e) {
      if (!e) return null;
      return fetch(e.url + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: { apikey: e.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }).then(function (r) {
        if (!r.ok) throw new Error(fn + ': ' + r.status);
        return r.status !== 204 ? r.json() : null;
      });
    });
  }
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // Lo que contestó la base, por texto (como mucho 40). Un fallo (sin red,
  // la función aún no está) no se guarda y da `null`, no «no existe»:
  // antes, «No encontramos ese municipio» hasta recargar (revisión del
  // 3-11-2026, 5.1).
  var cache = {};
  var enCache = [];
  function busca(q) {
    var k = String(q || '').trim().slice(0, 60);
    if (!cache[k]) {
      cache[k] = rpc('search_municipalities', { p_q: k, p_limit: 8 })
        .then(function (l) { return Array.isArray(l) ? l : []; }, function () {
          delete cache[k];
          return null;
        });
      enCache.push(k);
      if (enCache.length > 40) delete cache[enCache.shift()];
    }
    return cache[k];
  }
  function aqui(lat, lng) {
    return rpc('municipality_here', { p_lat: Number(lat), p_lng: Number(lng) })
      .then(function (m) { return m && m.slug ? m : null; }, function () { return null; });
  }

  function activa(caja) {
    if (!caja || caja.dataset.muniListo) return;
    caja.dataset.muniListo = '1';
    var campo = caja.querySelector('input[type=search]');
    var res = caja.querySelector('[data-muni-res]');
    var sin = caja.querySelector('[data-muni-sin]');
    if (!campo || !res) return;
    var href = caja.dataset.muniHref || '';
    var nada = caja.dataset.muniNada || '';
    var sinRed = caja.dataset.muniError || '';
    var pide = 0;
    var t = null;
    var pinta = function (lista, q) {
      if (!q) {
        res.innerHTML = '';
        if (sin) sin.hidden = false;
        return;
      }
      if (sin) sin.hidden = true;
      if (lista === null) {
        res.innerHTML = '<p class="menu-nota" role="alert">' + esc(sinRed || nada) + '</p>';
        return;
      }
      if (!lista.length) {
        res.innerHTML = '<p class="menu-nota">' + esc(nada) + '</p>';
        return;
      }
      res.innerHTML = lista.map(function (m, i) {
        var txt = '<span><span class="op-t">' + esc(m.name) + '</span>'
          + (m.province ? '<small>' + esc(m.province) + '</small>' : '') + '</span>';
        return href
          ? '<a class="op op-h" href="' + esc(href.replace('__SLUG__', encodeURIComponent(m.slug))) + '">' + txt + '</a>'
          : '<button type="button" class="op op-h" data-muni-i="' + i + '">' + txt + '</button>';
      }).join('');
      if (!href) {
        Array.prototype.forEach.call(res.querySelectorAll('[data-muni-i]'), function (b) {
          b.addEventListener('click', function () {
            caja.dispatchEvent(new CustomEvent('muni-elegido', { detail: lista[Number(b.dataset.muniI)], bubbles: true }));
          });
        });
      }
    };
    campo.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var q = campo.value.trim();
        var yo = ++pide;
        if (!q) { pinta([], ''); return; }
        busca(q).then(function (l) { if (yo === pide) pinta(l, q); });
      }, 250);
    });
    // Intro: el primero (sin JavaScript, el formulario manda el texto).
    campo.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      var primero = res.querySelector('a, button');
      if (primero) { ev.preventDefault(); primero.click(); }
    });
  }

  window.KlendarMunicipios = { busca: busca, aqui: aqui, activa: activa };
  Array.prototype.forEach.call(document.querySelectorAll('[data-muni-busca]'), activa);
})();
