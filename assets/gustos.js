/* «Tus gustos», el modo viaje y el buscador de la web (tanda A, como la app).
 *
 * - Tus gustos (de 3 a 5 categorías y tu ciudad) se guardan en «Tu cuenta»
 *   (`user_tastes`) y una copia en este navegador (`klendar.gustos`): la
 *   cabecera de Descubre y Explorar los pone en la dirección (`?gustos=`)
 *   para que pesen en el orden sin esconder nada (`public_explore`).
 * - Modo viaje (Descubre con «Cerca de mí»): si estás a más de 50 km de tu
 *   ciudad (cualquier municipio de España, con su punto) y en otro
 *   municipio («Busca tu municipio», `municipality_here`, como la app),
 *   «Estás en Valencia · Lo mejor de hoy ›», en una línea
 *   (/assets/avisos.js decide si sale: un aviso a la vez).
 *   Se compara en el momento: no se guarda la posición. La × lo quita hasta
 *   mañana (`klendar.viaje` guarda solo la fecha).
 * - El buscador de Explorar: al tocarlo, lo que buscaste (como mucho 10, solo
 *   en este navegador: `klendar.busquedas`, se borra una o todas) y «Lo más
 *   buscado en <ciudad>» (`popular_searches`: agregado, sin saber quién). Cada
 *   búsqueda cuenta en su ciudad con `log_search`, sin persona ni IP.
 *   Arriba del todo, el acceso a «Dónde ver el partido» con su subtítulo
 *   («Bares que ponen el fútbol, la F1 y más»), como el buscador en reposo
 *   de la app (`textos.partidos`).
 *
 * Las Ciudades de Klendar salen de la base (`cities`, las mismas que la app):
 * «Lo más buscado» y «Tu ciudad» guardada por una versión de antes.
 * `window.KlendarGustos` lo usa también «Tu cuenta» (`assets/cuenta/cuenta.js`).
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
    /** Lo guardado en este navegador: { c: [slugs], city, home: {code,
     * slug, name, lat, lng}, asked, t }. */
    lee: function () { var g = lee(KG); return g && typeof g === 'object' ? g : {}; },
    guarda: function (g) { pon(KG, g); },
    borra: function () { pon(KG, null); },
    ciudades: ciudades,
    km: km,
    ciudadCerca: ciudadCerca,
    /** «Modo viaje»: el municipio en el que estás ([aqui], de
     * `municipality_here`) si está a más de 50 km del tuyo y es otro; null
     * si no. */
    viaje: function (casa, lat, lng, aqui) {
      if (!casa || !aqui || km(casa.lat, casa.lng, lat, lng) <= VIAJE_KM) return null;
      var mismo = (casa.code && casa.code === aqui.code) || (casa.slug && casa.slug === aqui.slug)
        || (casa.id && casa.id === aqui.city_id);
      return mismo ? null : aqui;
    },
  };
  window.KlendarGustos = G;

  // ── Modo viaje (Descubre) ───────────────────────────────────────────────
  var caja = document.getElementById('viaje');
  if (caja) {
    var g = G.lee();
    var lat = Number(caja.dataset.lat);
    var lng = Number(caja.dataset.lng);
    if ((g.home || g.city) && Number.isFinite(lat) && Number.isFinite(lng) && lee(KV) !== hoy()) {
      ciudades().then(function (lista) {
        // Tu ciudad: el municipio guardado o, de una versión de antes, su
        // Ciudad de Klendar.
        var casa = g.home && Number.isFinite(Number(g.home.lat)) ? g.home
          : lista.filter(function (c) { return c.id === g.city; })[0];
        if (!casa || km(casa.lat, casa.lng, lat, lng) <= VIAJE_KM) return null;
        return rpc('municipality_here', { p_lat: lat, p_lng: lng }).then(function (m) {
          var aqui = G.viaje(casa, lat, lng, m && m.slug ? m : ciudadCerca(lat, lng, lista));
          return aqui ? { casa: casa, aqui: aqui } : null;
        });
      }).then(function (v) {
        if (!v) return;
        var casa = v.casa;
        var aqui = v.aqui;
        var T = {};
        try { T = JSON.parse(caja.dataset.textos || '{}'); } catch (e) { /* sin textos */ }
        // Una línea: «Estás en Valencia · Lo mejor de hoy ›» y la ×. Sale si
        // no hay otro aviso que mande más (/assets/avisos.js).
        var titulo = rellena(T.title, { city: aqui.name });
        caja.innerHTML = '<a class="feed-aviso-t" href="' + esc(caja.dataset.hoy) + '" data-viaje-hoy aria-label="'
          + esc(rellena(T.label, { home: casa.name }) + '. ' + titulo) + '">'
          + '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9.5 18H8V9h1.5v9zm3.25 0h-1.5V9h1.5v9zM16 18h-1.5V9H16v9zm1-12h-2V3c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v3H7c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2 0 .55.45 1 1 1s1-.45 1-1h6c0 .55.45 1 1 1s1-.45 1-1c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10.5 3.5h3V6h-3V3.5zM17 19H7V8h10v11z"/></svg>'
          + '<span>' + esc(titulo) + '</span><span aria-hidden="true">›</span></a>'
          + '<button type="button" class="feed-aviso-x" data-viaje-x aria-label="' + esc(T.close) + '" title="' + esc(T.close) + '">'
          + '<svg class="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>';
        caja.setAttribute('data-quiere', '');
        var pinta = function () {
          if (window.KlendarAvisos) window.KlendarAvisos.pinta();
          else caja.hidden = !caja.hasAttribute('data-quiere');
        };
        pinta();
        var cierra = function () { pon(KV, hoy()); };
        caja.querySelector('[data-viaje-hoy]').addEventListener('click', cierra);
        caja.querySelector('[data-viaje-x]').addEventListener('click', function () {
          cierra();
          caja.removeAttribute('data-quiere');
          caja.innerHTML = '';
          pinta();
        });
      });
    }
  }

  // ── El buscador (Explorar) ──────────────────────────────────────────────
  var form = document.querySelector('form[data-busqueda]');
  var campo = form && form.querySelector('input[name=q]');
  if (!form || !campo) return;
  // En la hoja «Buscar» de Descubre (`data-panel-fijo`) el panel está siempre
  // a la vista mientras la hoja está abierta, como la lupa de la app.
  var fijo = form.hasAttribute('data-panel-fijo');
  var hojaLupa = fijo ? form.closest('details') : null;
  var hT = fijo ? 'h3' : 'h2';
  // «O mira por tipo de sitio»: lo pinta la página; aquí va al final del
  // panel. Los grupos plegados enseñan «N más».
  var tipos = document.querySelector('[data-busq-tipos]');
  if (tipos) {
    Array.prototype.forEach.call(tipos.querySelectorAll('[data-plegado]'), function (g) {
      var mas = g.querySelector('[data-mas-grupo]');
      if (!mas) return;
      Array.prototype.forEach.call(g.querySelectorAll('a.busq-cat'), function (a) { a.hidden = true; });
      mas.hidden = false;
      mas.addEventListener('click', function () {
        var primera = null;
        Array.prototype.forEach.call(g.querySelectorAll('a.busq-cat'), function (a) { a.hidden = false; if (!primera) primera = a; });
        // Escondido, no quitado: un clic en algo que ya no está en la página
        // cerraba la hoja (/assets/tarjetas.js lo toma por un clic fuera).
        mas.hidden = true;
        if (primera) primera.focus();
      });
    });
  }

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
    + '.busq-borrar{border:0;background:none;color:var(--ink);font:inherit;font-weight:600;font-size:14px;min-height:40px;padding:0 4px;cursor:pointer}'
    + '.busq-atajo{display:flex;align-items:center;gap:12px;min-height:48px;color:var(--ink);text-decoration:none}.busq-atajo:hover{text-decoration:none}'
    + '.busq-atajo svg{flex:none;color:var(--ink-2)}.busq-atajo span{display:grid;gap:2px;min-width:0;flex:1}.busq-atajo b{font-size:15px}.busq-atajo small{margin:0}'
    + '.busq-panel.fijo{margin:0;padding:0;border:0;border-radius:0;background:none}div.busq-panel.fijo h3{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px;font-size:15px}'
    + 'div.busq-panel>.busq-tipos{margin-top:18px}';
  document.head.appendChild(estilo);

  var panel = document.createElement('div');
  panel.className = 'busq-panel';
  panel.id = 'busq-panel';
  panel.hidden = true;
  var sitio = fijo && document.querySelector('[data-busq-panel]');
  if (sitio) { sitio.appendChild(panel); panel.classList.add('fijo'); }
  else form.insertAdjacentElement('afterend', panel);
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

  // Los mismos iconos que el buscador de la app (fuente de Material de
  // Flutter, Apache 2.0; docs/GLOSARIO.md, «Iconos por concepto»):
  // «Dónde verlo» (live_tv), «Grupos y empresas» (groups), «Sorteos»
  // (redeem) y «Pedir un local» (add_business), con contorno.
  var BALON = 'M9 9.98V18L15.98 14.02L9 9.98ZM21 6H13.41L16.69 2.72L15.98 2.02L12 6H11.95L7.97 2.02L7.27 2.72L10.55 6H3C1.92 6 0.98 6.89 0.98 8.02V20.02C0.98 21.09 1.92 21.98 3 21.98H21C22.08 21.98 23.02 21.09 23.02 20.02V8.02C23.02 6.89 22.08 6 21 6ZM21 20.02H3V8.02H21V20.02Z';
  var GRUPOS = 'M3.98 12.98C5.11 12.98 6 12.09 6 11.02C6 9.89 5.11 9 3.98 9C2.91 9 2.02 9.89 2.02 11.02C2.02 12.09 2.91 12.98 3.98 12.98ZM5.11 14.11C4.78 14.06 4.41 14.02 3.98 14.02C3 14.02 2.06 14.2 1.22 14.58C0.47 14.91 0 15.61 0 16.45V18H4.5V16.41C4.5 15.56 4.73 14.77 5.11 14.11ZM20.02 12.98C21.09 12.98 21.98 12.09 21.98 11.02C21.98 9.89 21.09 9 20.02 9C18.89 9 18 9.89 18 11.02C18 12.09 18.89 12.98 20.02 12.98ZM24 16.45C24 15.61 23.53 14.91 22.78 14.58C21.94 14.2 21 14.02 20.02 14.02C19.59 14.02 19.22 14.06 18.89 14.11C19.27 14.77 19.5 15.56 19.5 16.41V18H24V16.45ZM16.22 13.64C15.05 13.12 13.64 12.75 12 12.75C10.36 12.75 8.95 13.12 7.78 13.64C6.7 14.11 6 15.19 6 16.41V18H18V16.41C18 15.19 17.3 14.11 16.22 13.64ZM8.06 15.98C8.16 15.75 8.2 15.61 9 15.33C9.94 14.95 10.97 14.77 12 14.77C13.03 14.77 14.06 14.95 15 15.33C15.8 15.61 15.84 15.75 15.94 15.98H8.06ZM12 8.02C12.56 8.02 12.98 8.44 12.98 9C12.98 9.56 12.56 9.98 12 9.98C11.44 9.98 11.02 9.56 11.02 9C11.02 8.44 11.44 8.02 12 8.02ZM12 6C10.36 6 9 7.36 9 9C9 10.64 10.36 12 12 12C13.64 12 15 10.64 15 9C15 7.36 13.64 6 12 6Z';
  var SORTEO = 'M20.02 6H17.81C17.95 5.67 18 5.34 18 5.02C18 3.33 16.64 2.02 15 2.02C13.97 2.02 13.03 2.53 12.52 3.33L12 4.03L11.48 3.33C10.97 2.53 10.03 2.02 9 2.02C7.36 2.02 6 3.33 6 5.02C6 5.34 6.05 5.67 6.19 6H3.98C2.91 6 2.02 6.89 2.02 8.02V18.98C2.02 20.11 2.91 21 3.98 21H20.02C21.09 21 21.98 20.11 21.98 18.98V8.02C21.98 6.89 21.09 6 20.02 6ZM15 3.98C15.56 3.98 15.98 4.45 15.98 5.02C15.98 5.53 15.56 6 15 6C14.44 6 14.02 5.53 14.02 5.02C14.02 4.45 14.44 3.98 15 3.98ZM9 3.98C9.56 3.98 9.98 4.45 9.98 5.02C9.98 5.53 9.56 6 9 6C8.44 6 8.02 5.53 8.02 5.02C8.02 4.45 8.44 3.98 9 3.98ZM20.02 18.98H3.98V17.02H20.02V18.98ZM20.02 14.02H3.98V8.02H9.09L6.98 10.83L8.62 12L11.02 8.77L12 7.41L12.98 8.77L15.38 12L17.02 10.83L14.91 8.02H20.02V14.02Z';
  var TIENDA = 'M2.02 3.98H17.02V6H2.02V3.98ZM15 17.02H17.02V14.02H18V12L17.02 6.98H2.02L0.98 12V14.02H2.02V20.02H11.02V14.02H15V17.02ZM9 18H3.98V14.02H9V18ZM3.05 12 3.66 9H15.38L15.94 12H3.05ZM23.02 18H20.02V15H18V18H15V20.02H18V23.02H20.02V20.02H23.02V18Z';
  // «Borrar» todo: preguntando (el paso de confirmar) y lo borrado, para «Deshacer».
  var preguntando = false;
  var deshacer = null;
  function pinta(pop) {
    var rec = recientes();
    var html = '';
    // Los accesos del buscador en reposo, como la app: «Dónde ver el
    // partido», «Grupos y empresas» y «Sorteos» (tanda C).
    var atajos = [[T.partidos, /^\/(en\/matches|partidos)([/?]|$)/, BALON],
      [T.grupos, /^\/(en\/groups|grupos)([/?]|$)/, GRUPOS], [T.sorteos, /^\/(en\/giveaways|sorteos)([/?]|$)/, SORTEO],
      // «Pedir un local» (a «Tu cuenta»), como la app.
      [T.pedir, /^\/cuenta\/pedir-local/, TIENDA]]
      .filter(function (x) { return x[0] && x[0].t && x[1].test(String(x[0].href || '')); });
    if (atajos.length) {
      html += '<section>' + atajos.map(function (x) {
        return '<a class="busq-atajo" href="' + esc(x[0].href) + '"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="' + x[2] + '"/></svg>'
          + '<span><b>' + esc(x[0].t) + '</b><small>' + esc(x[0].s || '') + '</small></span></a>';
      }).join('') + '</section>';
    }
    // «Borrar» todo, en dos pasos (como la app): primero se pregunta y,
    // borradas, «Deshacer» las devuelve (hasta que se vuelve a pintar).
    if (preguntando && rec.length && T.clearAsk) {
      html += '<section><p class="busq-pregunta" role="alert" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 8px;font-weight:600">' + esc(T.clearAsk)
        + ' <button type="button" class="busq-borrar" data-borrar-si>' + esc(T.clear) + '</button>'
        + ' <button type="button" class="busq-borrar" data-borrar-no>' + esc(T.cancel || '') + '</button></p></section>';
    } else if (deshacer && !rec.length && T.cleared) {
      html += '<section><p class="busq-pregunta" role="status" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 8px;font-weight:600">' + esc(T.cleared)
        + ' <button type="button" class="busq-borrar" data-deshacer>' + esc(T.undo || '') + '</button></p></section>';
    }
    if (rec.length && !preguntando) {
      html += '<section><' + hT + '><span>' + esc(T.recent) + '</span><button type="button" class="busq-borrar" data-borrar-todo>' + esc(T.clear) + '</button></' + hT + '>'
        + '<div class="busq-chips">' + rec.map(function (t) {
          return '<span class="busq-chip"><button type="button" data-busca="' + esc(t) + '">' + esc(t) + '</button>'
            + '<button type="button" class="busq-x" data-quita="' + esc(t) + '" aria-label="' + esc(rellena(T.remove, { q: t })) + '">×</button></span>';
        }).join('') + '</div><small>' + esc(T.local) + '</small></section>';
    }
    if (pop && pop.length && ciudadPop) {
      html += '<section><' + hT + '><span>' + esc(rellena(T.popular, { city: ciudadPop.name })) + '</span></' + hT + '><div class="busq-chips">'
        + pop.map(function (t) {
          return '<span class="busq-chip"><button type="button" data-busca="' + esc(t) + '">↗ ' + esc(t) + '</button></span>';
        }).join('') + '</div><small>' + esc(T.popularHint) + '</small></section>';
    }
    panel.innerHTML = html;
    if (tipos) { panel.appendChild(tipos); tipos.hidden = false; }
    panel.hidden = !panel.firstChild || campo.value.trim() !== '';
  }

  var abierto = function () {
    return fijo ? Boolean(hojaLupa && hojaLupa.open) : document.activeElement === campo || panel.contains(document.activeElement);
  };
  function abre() {
    pinta(null);
    pidePopulares().then(function (pop) { if (abierto()) pinta(pop); });
  }
  campo.addEventListener('focus', abre);
  // La lupa (la de la cabecera y la de Explorar) abre la hoja «Buscar»
  // (/assets/tarjetas.js); desde otra página, Explorar la trae abierta.
  campo.addEventListener('input', function () { if (campo.value.trim()) panel.hidden = true; else abre(); });
  if (hojaLupa) hojaLupa.addEventListener('toggle', function () { if (hojaLupa.open) abre(); });
  // Ya abierta al llegar (`?buscar=1`, la lupa desde otra página).
  if (hojaLupa && hojaLupa.open) abre();
  // En la hoja, Escape la cierra (/assets/tarjetas.js).
  if (!fijo) campo.addEventListener('keydown', function (e) { if (e.key === 'Escape') panel.hidden = true; });
  form.addEventListener('submit', function () { anade(campo.value); });
  panel.addEventListener('click', function (e) {
    var b = e.target instanceof Element ? e.target.closest('button') : null;
    if (!b || b.hasAttribute('data-mas-grupo')) return;
    if (b.hasAttribute('data-busca')) { busca(b.getAttribute('data-busca')); return; }
    if (b.hasAttribute('data-quita')) {
      var t = b.getAttribute('data-quita');
      pon(KB, recientes().filter(function (x) { return x !== t; }));
    } else if (b.hasAttribute('data-borrar-todo')) {
      // Sin los textos nuevos (una página de antes en caché), como antes.
      if (T.clearAsk) preguntando = true; else pon(KB, null);
    } else if (b.hasAttribute('data-borrar-si')) {
      deshacer = recientes();
      preguntando = false;
      pon(KB, null);
    } else if (b.hasAttribute('data-borrar-no')) {
      preguntando = false;
    } else if (b.hasAttribute('data-deshacer')) {
      if (deshacer) pon(KB, deshacer);
      deshacer = null;
    }
    if (!b.hasAttribute('data-borrar-si')) deshacer = null;
    pidePopulares().then(pinta);
    campo.focus();
  });
  // Al salir del buscador y del panel, se cierra (en la hoja, no: se ve
  // mientras está abierta).
  if (fijo) return;
  document.addEventListener('focusin', function (e) {
    if (e.target !== campo && !panel.contains(e.target)) panel.hidden = true;
  });
  document.addEventListener('pointerdown', function (e) {
    if (e.target !== campo && !panel.contains(e.target) && !form.contains(e.target)) panel.hidden = true;
  });
})();
