/* «Horario sin confirmar» y «Estaba cerrado» en la ficha pública de un
 * negocio (`/b/<slug>`), como la app (migración 20261229100000):
 *
 *   · «Horario sin confirmar»: 3 o más personas lo encontraron cerrado en 14
 *     días cuando su horario decía abierto, y el negocio aún no lo ha
 *     revisado. Lo ve todo el mundo.
 *   · «Estaba cerrado»: solo con sesión y con Klendar dándolo por abierto
 *     ahora; uno por persona, negocio y día. Si el navegador ya tiene permiso
 *     de ubicación, se manda para comprobar que está cerca (la base no la
 *     guarda); nunca se pide el permiso para esto.
 *
 * Va en `<div data-cerrado="<id>">` debajo del horario (con
 * `data-solo-publico`: el equipo del negocio no lo ve). Sin red, nada. */
(function () {
  'use strict';
  var el = document.querySelector('[data-cerrado]');
  if (!el) return;
  var id = el.getAttribute('data-cerrado');
  var en = el.getAttribute('data-lang') === 'en';
  var T = en ? {
    sin: 'Opening hours not confirmed',
    sinAyuda: 'Several people found it closed when its opening hours said open, and the business hasn’t checked them yet. If you’re going, better call first.',
    boton: 'It was closed',
    pregunta: 'Was it closed? We’ll ask the business to check its opening hours. They won’t know it was you.',
    avisar: 'Let them know', cancelar: 'Cancel',
    gracias: 'Thanks. We’ve told the business.',
    ya: 'You’ve already reported it closed today.',
    lejos: 'You can only report this when you’re near the venue.',
    noAbierto: 'The page already says it’s closed now.',
    tope: 'That’s enough for today: try again tomorrow.',
    error: 'Something went wrong. Try again in a moment.',
  } : {
    sin: 'Horario sin confirmar',
    sinAyuda: 'Varias personas lo encontraron cerrado cuando su horario decía abierto, y el negocio aún no lo ha revisado. Si vas, mejor llama antes.',
    boton: 'Estaba cerrado',
    pregunta: '¿Estaba cerrado? Avisaremos al negocio para que revise su horario. No sabrá quién has sido.',
    avisar: 'Avisar', cancelar: 'Cancelar',
    gracias: 'Gracias. Se lo hemos dicho al negocio.',
    ya: 'Ya has avisado hoy de que estaba cerrado.',
    lejos: 'Solo puedes avisar si estás cerca del local.',
    noAbierto: 'La ficha ya dice que ahora está cerrado.',
    tope: 'Por hoy ya está: inténtalo mañana.',
    error: 'Algo no ha ido bien. Prueba otra vez en un momento.',
  };
  var ERR = { already: T.ya, too_far: T.lejos, not_open: T.noAbierto, rate_limited: T.tope };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
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
  /** Sin sesión, una llamada suelta con la clave pública. */
  function rpcAnon(env, fn, args) {
    return fetch(env.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: env.key, Authorization: 'Bearer ' + env.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    }).then(function (r) { return r.ok ? r.json() : null; });
  }
  /** La posición, solo si ya hay permiso (nunca se pide aquí). */
  function dondeSiYa() {
    if (!navigator.geolocation || !navigator.permissions || !navigator.permissions.query) return Promise.resolve(null);
    return navigator.permissions.query({ name: 'geolocation' }).then(function (p) {
      if (p.state !== 'granted') return null;
      return new Promise(function (ok) {
        navigator.geolocation.getCurrentPosition(
          function (pos) { ok({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
          function () { ok(null); },
          { maximumAge: 600000, timeout: 6000 });
      });
    }).catch(function () { return null; });
  }

  function pinta(st, sb) {
    var html = '';
    if (st.unconfirmed) {
      html += '<p class="horario-sin"><b>' + esc(T.sin) + '</b><br><small class="muted">' + esc(T.sinAyuda) + '</small></p>';
    }
    if (st.can_report && sb) {
      html += '<p class="horario-cerrado"><button type="button" class="pill" data-cerrado-boton>' + esc(T.boton) + '</button></p>';
    } else if (st.reported_today) {
      html += '<p class="muted horario-cerrado">' + esc(T.ya) + '</p>';
    }
    el.innerHTML = html;
    // El equipo no lo ve (amigos.js marca `es-equipo` y esconde lo público).
    el.hidden = !html || document.body.classList.contains('es-equipo');
    var boton = el.querySelector('[data-cerrado-boton]');
    if (!boton) return;
    boton.addEventListener('click', function () {
      var caja = boton.parentNode;
      caja.innerHTML = '<span>' + esc(T.pregunta) + '</span><span class="horario-cerrado-botones">'
        + '<button type="button" class="pill accent" data-si>' + esc(T.avisar) + '</button>'
        + '<button type="button" class="pill" data-no>' + esc(T.cancelar) + '</button></span>';
      caja.querySelector('[data-no]').addEventListener('click', function () { pinta(st, sb); });
      caja.querySelector('[data-si]').addEventListener('click', function (ev) {
        ev.target.disabled = true;
        dondeSiYa().then(function (pos) {
          return sb.rpc('report_closed', { p_business: id, p_lat: pos ? pos.lat : null, p_lng: pos ? pos.lng : null });
        }).then(function (r) {
          var d = r && r.data;
          if (r && !r.error && d && d.ok) {
            caja.innerHTML = '<span>' + esc(T.gracias) + '</span>';
            if (d.unconfirmed && !st.unconfirmed) { st.unconfirmed = true; }
            st.can_report = false;
            setTimeout(function () { st.reported_today = true; pinta(st, sb); }, 4000);
          } else {
            caja.innerHTML = '<span>' + esc((d && ERR[d.error]) || T.error) + '</span>';
          }
        }).catch(function () { caja.innerHTML = '<span>' + esc(T.error) + '</span>'; });
      });
    });
  }

  (window.KLENDAR_ENV ? Promise.resolve() : carga('/config.js?v=3'))
    .then(function () {
      var env = window.KLENDAR_ENV;
      if (!env) return null;
      var ref = (env.url.match(/^https:\/\/([a-z0-9]+)\./) || [])[1];
      if (!sesionGuardada(ref)) {
        // Sin sesión, a la base que dice la página (la misma que la ficha).
        var pub = { url: el.getAttribute('data-url') || env.url, key: el.getAttribute('data-key') || env.key };
        return rpcAnon(pub, 'business_hours_status', { p_business: id }).then(function (st) {
          if (st && st.ok) pinta(st, null);
        });
      }
      return (window.supabase ? Promise.resolve() : carga('/assets/vendor/supabase-js-2.117.2.js',
          'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok'))
        .then(function () {
          // El mismo cliente que amigos.js y visita.js (uno por página).
          var sb = window.klendarSb || (window.klendarSb = window.supabase.createClient(env.url, env.key,
            { auth: { flowType: 'pkce', detectSessionInUrl: false } }));
          return sb.rpc('business_hours_status', { p_business: id }).then(function (r) {
            if (r && !r.error && r.data && r.data.ok) pinta(r.data, sb);
          });
        });
    })
    .catch(function () { /* sin red: la ficha, sin esto */ });
})();
