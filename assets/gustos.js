/* «Tus gustos», el modo viaje y el buscador de la web (tanda A, como la app).
 *
 * - Tus gustos (de 3 a 5 categorías y tu ciudad) se guardan en «Tu cuenta»
 *   (`user_tastes`) y una copia en este navegador (`klendar.gustos`): la
 *   cabecera de Descubre y Explorar los pone en la dirección (`?gustos=`)
 *   para que pesen en el orden sin esconder nada (`public_explore`).
 * - Modo viaje (Descubre con «Cerca de mí»): si estás a más de 50 km de tu
 *   ciudad y en otra ciudad de Klendar, «Estás en Valencia: lo mejor de hoy».
 *   Se compara en el momento: no se guarda la posición. La × lo quita hasta
 *   mañana (`klendar.viaje` guarda solo la fecha).
 * - El buscador de Explorar: al tocarlo, lo que buscaste (como mucho 10, solo
 *   en este navegador: `klendar.busquedas`, se borra una o todas) y «Lo más
 *   buscado en <ciudad>» (`popular_searches`: agregado, sin saber quién). Cada
 *   búsqueda cuenta en su ciudad con `log_search`, sin persona ni IP.
 *
 * Las ciudades salen de la base (`cities`, las mismas que la app).
 * `window.KlendarGustos` lo usa también «Tu cuenta» (`app/cuenta.js`).
 */
(function () {
  'use strict';

  var yo = document.currentScript;
  var en = (yo && yo.dataset.lang === 'en') || document.documentElement.lang === 'en';
  var KG = 'klendar.gustos';
  var KB = 'klendar.busquedas';
  var KV = 'klendar.viaje';
  var MAX_BUSQUEDAS = 10;
  var VIAJE_KM = 50;
  var CERCA_KM = 30;

  function lee(k) {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
  }
  function pon(k, v) {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { /* sin almacenamiento: no se recuerda */ }
  }
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var rellena = function (t, datos) {
    return String(t || '').replace(/\{(\w+)\}/g, function (_, k) { return datos[k] == null ? '' : datos[k]; });
  };

  function carga(src) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }
  function conf() {
    return (window.KLENDAR_ENV ? Promise.resolve() : carga('/config.js?v=3'))
      .then(function () { return window.KLENDAR_ENV || null; });
  }
  function rpc(fn, body) {
    return conf().then(function (e) {
      if (!e) return null;
      return fetch(e.url + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: { apikey: e.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }).then(function (r) { return r.ok && r.status !== 204 ? r.json() : null; });
    }).catch(function () { return null; });
  }

  /** Las ciudades de Klendar ({id, name, lat, lng}), una vez por sesión. */
  var pedidas = null;
  function ciudades() {
    if (pedidas) return pedidas;
    try {
      var g = JSON.parse(sessionStorage.getItem('klendar.ciudades') || 'null');
      if (Array.isArray(g) && g.length) { pedidas = Promise.resolve(g); return pedidas; }
    } catch (e) { /* se piden */ }
    pedidas = conf().then(function (e) {
      if (!e) return [];
      return fetch(e.url + '/rest/v1/cities?select=id,name,lat,lng&order=position.asc', { headers: { apikey: e.key } })
        .then(function (r) { return r.ok ? r.json() : []; });
    }).then(function (l) {
      var lista = Array.isArray(l) ? l : [];
      try { if (lista.length) sessionStorage.setItem('klendar.ciudades', JSON.stringify(lista)); } catch (e) { /* nada */ }
      return lista;
    }).catch(function () { return []; });
    return pedidas;
  }

  /** Distancia en km (círculo máximo). */
  function km(lat1, lng1, lat2, lng2) {
    var rad = function (d) { return (d * Math.PI) / 180; };
    var a = Math.pow(Math.sin(rad(lat2 - lat1) / 2), 2)
      + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.pow(Math.sin(rad(lng2 - lng1) / 2), 2);
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  /** La ciudad de Klendar en la que estás (a menos de 30 km), o null. */
  function ciudadCerca(lat, lng, lista) {
    var mejor = null;
    var d = CERCA_KM;
    (lista || []).forEach(function (c) {
      var x = km(lat, lng, c.lat, c.lng);
      if (x <= d) { mejor = c; d = x; }
    });
    return mejor;
  }
  var hoy = function () {
    var n = new Date();
    return n.getFullYear() + '-' + (n.getMonth() + 1) + '-' + n.getDate();
  };

  var G = {
    /** Lo guardado en este navegador: { c: [slugs], city, asked, t }. */
    lee: function () { var g = lee(KG); return g && typeof g === 'object' ? g : {}; },
    guarda: function (g) { pon(KG, g); },
    borra: function () { pon(KG, null); },
    ciudades: ciudades,
    km: km,
    ciudadCerca: ciudadCerca,
    /** «Modo viaje»: la ciudad en la que estás si es otra de Klendar a más
     * de 50 km de la tuya; null si no. */
    viaje: function (casa, lat, lng, lista) {
      if (!casa || km(casa.lat, casa.lng, lat, lng) <= VIAJE_KM) return null;
      var aqui = ciudadCerca(lat, lng, lista);
      return aqui && aqui.id !== casa.id ? aqui : null;
    },
  };
  window.KlendarGustos = G;

  // ── Modo viaje (Descubre) ───────────────────────────────────────────────
  var caja = document.getElementById('viaje');
  if (caja) {
    var g = G.lee();
    var lat = Number(caja.dataset.lat);
    var lng = Number(caja.dataset.lng);
    if (g.city && Number.isFinite(lat) && Number.isFinite(lng) && lee(KV) !== hoy()) {
      ciudades().then(function (lista) {
        var casa = lista.filter(function (c) { return c.id === g.city; })[0];
        var aqui = G.viaje(casa, lat, lng, lista);
        if (!aqui) return;
        var T = {};
        try { T = JSON.parse(caja.dataset.textos || '{}'); } catch (e) { /* sin textos */ }
        caja.innerHTML = '<div class="exclusiva rp-fijada viaje-aviso" style="display:flex;align-items:center;gap:8px;margin:8px 0 0;padding:8px 8px 8px 14px">'
          + '<a href="' + esc(caja.dataset.hoy) + '" data-viaje-hoy style="flex:1;min-width:0;color:inherit;text-decoration:none">'
          + '<small style="display:block;font-weight:700;opacity:.75">' + esc(rellena(T.label, { home: casa.name })) + '</small>'
          + '<b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(rellena(T.title, { city: aqui.name })) + '</b></a>'
          + '<button type="button" class="pill" data-viaje-x aria-label="' + esc(T.close) + '" title="' + esc(T.close) + '" style="min-width:44px;min-height:44px">×</button>'
          + '</div>';
        caja.hidden = false;
        var cierra = function () { pon(KV, hoy()); };
        caja.querySelector('[data-viaje-hoy]').addEventListener('click', cierra);
        caja.querySelector('[data-viaje-x]').addEventListener('click', function () {
          cierra();
          caja.hidden = true;
          caja.innerHTML = '';
        });
      });
    }
  }

  // ── El buscador (Explorar) ──────────────────────────────────────────────
  var form = document.querySelector('form[data-busqueda]');
  var campo = form && form.querySelector('input[name=q]');
  if (!form || !campo) return;

  var T = {};
  try { T = JSON.parse(form.dataset.textos || '{}'); } catch (e) { /* sin textos */ }
  var recientes = function () {
    var l = lee(KB);
    return Array.isArray(l) ? l.filter(function (x) { return typeof x === 'string'; }).slice(0, MAX_BUSQUEDAS) : [];
  };
  var anade = function (q) {
    var t = String(q || '').trim().toLowerCase();
    if (t.length < 3) return;
    pon(KB, [t].concat(recientes().filter(function (x) { return x !== t; })).slice(0, MAX_BUSQUEDAS));
  };

  // La búsqueda de esta página: se recuerda y cuenta en su ciudad (no al
  // volver atrás ni al recargar, que no son buscar otra vez).
  var q = (new URLSearchParams(location.search).get('q') || '').trim();
  var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
  if (q.length >= 3 && nav.type !== 'back_forward' && nav.type !== 'reload') {
    anade(q);
    if (form.dataset.ciudad) rpc('log_search', { p_term: q, p_city: form.dataset.ciudad });
  }

  var estilo = document.createElement('style');
  estilo.textContent = '.busq-panel{margin:-4px 0 16px;padding:14px 16px;border-radius:22px;border:1px solid var(--glass-border);background:var(--elevated,var(--surface))}'
    + 'div.busq-panel>section{margin:0;padding:0;border:0;background:none;min-height:0}div.busq-panel>section+section{margin-top:16px}'
    + 'div.busq-panel h2{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px;padding:0;font-size:15px;line-height:1.3}'
    + '.busq-chips{display:flex;flex-wrap:wrap;gap:8px}'
    + '.busq-chip{display:inline-flex;align-items:center;border-radius:999px;border:1px solid var(--glass-border);background:var(--soft);min-height:40px}'
    + '.busq-chip button{border:0;background:none;color:inherit;font:inherit;font-weight:600;font-size:14px;min-height:40px;padding:0 14px;cursor:pointer}'
    + '.busq-chip button.busq-x{padding:0 12px 0 2px;min-width:40px;font-weight:400;color:var(--ink-2)}'
    + '.busq-panel small{display:block;color:var(--ink-2);font-size:13px;margin-top:6px}'
    + '.busq-borrar{border:0;background:none;color:var(--ink);font:inherit;font-weight:600;font-size:14px;min-height:40px;padding:0 4px;cursor:pointer}';
  document.head.appendChild(estilo);

  var panel = document.createElement('div');
  panel.className = 'busq-panel';
  panel.id = 'busq-panel';
  panel.hidden = true;
  form.insertAdjacentElement('afterend', panel);
  campo.setAttribute('aria-controls', 'busq-panel');

  var populares = null;
  var ciudadPop = null;
  function pidePopulares() {
    if (populares) return populares;
    var g = G.lee();
    populares = (form.dataset.ciudad
      ? Promise.resolve({ id: form.dataset.ciudad, name: form.dataset.ciudadNombre })
      : g.city ? ciudades().then(function (l) { return l.filter(function (c) { return c.id === g.city; })[0] || null; }) : Promise.resolve(null))
      .then(function (c) {
        if (!c) return [];
        ciudadPop = c;
        return rpc('popular_searches', { p_city: c.id, p_limit: 8 });
      })
      .then(function (l) { return Array.isArray(l) ? l : []; });
    return populares;
  }

  function busca(t) {
    campo.value = t;
    if (form.requestSubmit) form.requestSubmit(); else form.submit();
  }

  function pinta(pop) {
    var rec = recientes();
    var html = '';
    if (rec.length) {
      html += '<section><h2><span>' + esc(T.recent) + '</span><button type="button" class="busq-borrar" data-borrar-todo>' + esc(T.clear) + '</button></h2>'
        + '<div class="busq-chips">' + rec.map(function (t) {
          return '<span class="busq-chip"><button type="button" data-busca="' + esc(t) + '">' + esc(t) + '</button>'
            + '<button type="button" class="busq-x" data-quita="' + esc(t) + '" aria-label="' + esc(rellena(T.remove, { q: t })) + '">×</button></span>';
        }).join('') + '</div><small>' + esc(T.local) + '</small></section>';
    }
    if (pop && pop.length && ciudadPop) {
      html += '<section><h2><span>' + esc(rellena(T.popular, { city: ciudadPop.name })) + '</span></h2><div class="busq-chips">'
        + pop.map(function (t) {
          return '<span class="busq-chip"><button type="button" data-busca="' + esc(t) + '">↗ ' + esc(t) + '</button></span>';
        }).join('') + '</div><small>' + esc(T.popularHint) + '</small></section>';
    }
    panel.innerHTML = html;
    panel.hidden = !html || campo.value.trim() !== '';
  }

  function abre() {
    pinta(null);
    pidePopulares().then(function (pop) { if (document.activeElement === campo || panel.contains(document.activeElement)) pinta(pop); });
  }
  campo.addEventListener('focus', abre);
  campo.addEventListener('input', function () { if (campo.value.trim()) panel.hidden = true; else abre(); });
  campo.addEventListener('keydown', function (e) { if (e.key === 'Escape') panel.hidden = true; });
  form.addEventListener('submit', function () { anade(campo.value); });
  panel.addEventListener('click', function (e) {
    var b = e.target instanceof Element ? e.target.closest('button') : null;
    if (!b) return;
    if (b.hasAttribute('data-busca')) { busca(b.getAttribute('data-busca')); return; }
    if (b.hasAttribute('data-quita')) {
      var t = b.getAttribute('data-quita');
      pon(KB, recientes().filter(function (x) { return x !== t; }));
    } else if (b.hasAttribute('data-borrar-todo')) {
      pon(KB, null);
    }
    pidePopulares().then(pinta);
    campo.focus();
  });
  // Al salir del buscador y del panel, se cierra.
  document.addEventListener('focusin', function (e) {
    if (e.target !== campo && !panel.contains(e.target)) panel.hidden = true;
  });
  document.addEventListener('pointerdown', function (e) {
    if (e.target !== campo && !panel.contains(e.target) && !form.contains(e.target)) panel.hidden = true;
  });
})();
