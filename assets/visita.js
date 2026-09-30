/* La ficha de un negocio abierta desde el QR del local (klendar.app/v/…).
 *
 * El QR abre la ficha, sin más. Si el local da sellos por visita en alguna
 * tarjeta, aquí se da el de hoy y se avisa con un aviso discreto encima de
 * la ficha: «+1 sello en «Cafés» · 4/10», o por qué no ha caído (ya tenías
 * el de hoy, estás lejos…), o «Entra para llevarte el sello de hoy». Lo
 * mismo que la app. La sesión es la de «Tu cuenta» (mismo sitio). La
 * ubicación solo se usa para comprobar que estás en el local; no se guarda.
 */
(function () {
  'use strict';
  var yo = document.currentScript;
  var token = yo && yo.dataset.token;
  var en = yo && yo.dataset.lang === 'en';
  if (!token || !window.supabase || !window.KLENDAR_ENV) return;

  // Fuera `?visita=` de la dirección: al recargar o compartir la ficha no
  // viaja el código del local.
  try {
    var u = new URL(location.href);
    u.searchParams.delete('visita');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch (e) { /* navegador viejo: se queda */ }

  var T = en ? {
    added: function (c, n, m) { return '+1 stamp on “' + c + '” · ' + n + '/' + m; },
    already: function (c, n, m) { return '“' + c + "”: you already have today's stamp · " + n + '/' + m; },
    reward: "You've earned the reward! Ask for it in Stamp cards.",
    far: function (d) { return "No stamp: you seem to be " + d + " from the venue. If you're inside, turn on precise location and try again."; },
    noLoc: "No stamp: we need to check you're at the venue, and we don't have your location.",
    blocked: 'Allow location for klendar.app in your browser settings and try again.',
    team: "You're on this venue's team: the QR code works, but the stamps are for your customers.",
    signIn: "Log in to get today's stamp",
    changed: 'This QR code no longer gives stamps: the venue has changed it. Scan the new poster.',
    rate: 'Too many attempts. Give it a moment.',
    checking: "Checking you're at the venue…",
    cards: 'Stamp cards', retry: 'Try again', useLoc: 'Use my location', login: 'Log in', close: 'Close the notice',
  } : {
    added: function (c, n, m) { return '+1 sello en «' + c + '» · ' + n + '/' + m; },
    already: function (c, n, m) { return '«' + c + '»: ya tenías el sello de hoy · ' + n + '/' + m; },
    reward: '¡Te toca premio! Pídelo en Tarjetas de sellos.',
    far: function (d) { return 'Sin sello: parece que estás a ' + d + ' del local. Si estás dentro, activa la ubicación precisa y vuelve a probar.'; },
    noLoc: 'Sin sello: para darlo tenemos que comprobar que estás en el local, y no tenemos tu ubicación.',
    blocked: 'Permite la ubicación a klendar.app en los ajustes del navegador y vuelve a probar.',
    team: 'Eres del equipo de este local: el QR funciona, pero los sellos son para tus clientes.',
    signIn: 'Entra para llevarte el sello de hoy',
    changed: 'Este QR ya no da sellos: el local lo ha cambiado. Escanea el cartel nuevo.',
    rate: 'Demasiados intentos. Espera un momento.',
    checking: 'Comprobando que estás en el local…',
    cards: 'Tarjetas de sellos', retry: 'Volver a probar', useLoc: 'Usar mi ubicación', login: 'Entrar', close: 'Cerrar el aviso',
  };
  var cuenta = en ? '/app/?lang=en' : '/app/';

  // «1,2 km» / «350 m», como la app.
  function distancia(m) {
    if (m < 1000) return Math.round(m) + ' m';
    var km = m / 1000;
    if (km < 10) return (en ? km.toFixed(1) : km.toFixed(1).replace('.', ',')) + ' km';
    return Math.round(km) + ' km';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var estilo = document.createElement('style');
  estilo.textContent = '.visita{position:fixed;left:16px;right:16px;bottom:16px;z-index:50;max-width:480px;margin:0 auto;' +
    'background:var(--elevated,#fff);color:var(--ink,#0A0A0A);border:1px solid var(--glass-border,rgba(10,10,10,.08));' +
    'border-radius:22px;box-shadow:var(--shadow,0 20px 60px -30px rgba(10,10,10,.35));padding:12px 8px 8px 16px;' +
    'display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:start;font-size:15px;line-height:1.35}' +
    '.visita[hidden]{display:none!important}.visita .v-ic{font-size:20px;line-height:1.2}.visita p{margin:0 0 4px}' +
    '.visita p.v-2{color:var(--ink-2,#636363);font-size:13px;font-weight:400}.visita p b{font-weight:700}' +
    '.visita .v-x{background:none;border:0;color:var(--ink-2,#636363);font-size:20px;line-height:1;padding:4px 8px;cursor:pointer}' +
    '.visita .v-acc{grid-column:1/-1;text-align:right}.visita .v-acc a,.visita .v-acc button{font:inherit;font-weight:700;' +
    'color:var(--ink,#0A0A0A);background:none;border:0;padding:8px 10px;cursor:pointer;text-decoration:none}';
  document.head.appendChild(estilo);

  var caja = document.createElement('div');
  caja.className = 'visita';
  caja.setAttribute('role', 'status');
  caja.setAttribute('aria-live', 'polite');
  caja.hidden = true;

  /** lineas: [texto], la primera en negrita; accion: {texto, href} o {texto, fn}. */
  function pinta(icono, lineas, accion) {
    caja.innerHTML = '<span class="v-ic" aria-hidden="true">' + icono + '</span><div>' +
      lineas.map(function (l, i) { return '<p class="' + (i === 0 || l.fuerte ? '' : 'v-2') + '">' + (i === 0 || l.fuerte ? '<b>' : '') + esc(l.t || l) + (i === 0 || l.fuerte ? '</b>' : '') + '</p>'; }).join('') +
      '</div><button class="v-x" type="button" aria-label="' + esc(T.close) + '">×</button>' +
      (accion ? '<div class="v-acc">' + (accion.href ? '<a href="' + esc(accion.href) + '">' + esc(accion.texto) + '</a>' : '<button type="button" class="v-go">' + esc(accion.texto) + '</button>') + '</div>' : '');
    caja.querySelector('.v-x').onclick = function () { caja.hidden = true; };
    var go = caja.querySelector('.v-go');
    if (go && accion.fn) go.onclick = accion.fn;
    caja.hidden = false;
    if (!caja.parentNode) document.body.appendChild(caja);
  }

  // Un solo cliente por página (amigos.js usa el mismo y con las mismas
  // opciones): dos sobre la misma sesión se pisan al renovar el token. Esta
  // página no recibe vueltas de acceso: no lee nada de la dirección (así un
  // enlace con `#access_token=…` de otra persona no cambia tu sesión).
  var sb = window.klendarSb || (window.klendarSb = window.supabase.createClient(window.KLENDAR_ENV.url, window.KLENDAR_ENV.key,
    { auth: { flowType: 'pkce', detectSessionInUrl: false } }));

  function dondeEstoy() {
    return new Promise(function (ok) {
      if (!navigator.geolocation) { ok({ bloqueada: false }); return; }
      navigator.geolocation.getCurrentPosition(
        function (p) { ok({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }); },
        function (e) { ok({ bloqueada: e && e.code === 1 }); },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 120000 });
    });
  }

  function sellar() {
    pinta('⌛', [T.checking]);
    return dondeEstoy().then(function (aqui) {
      return sb.rpc('scan_visit_qr', {
        p_token: token,
        p_lat: aqui.lat == null ? null : aqui.lat,
        p_lng: aqui.lng == null ? null : aqui.lng,
        p_accuracy: aqui.precision == null ? null : aqui.precision,
      }).then(function (res) { resultado(res.data || {}, aqui); });
    }).catch(function () { caja.hidden = true; });
  }

  function resultado(r, aqui) {
    if (r.ok === false) {
      if (r.error === 'token_changed') pinta('ⓘ', [T.changed]);
      else if (r.error === 'rate_limited') pinta('ⓘ', [T.rate]);
      else caja.hidden = true;
      return;
    }
    var tarjetas = r.cards || [];
    if (r.stamp === 'stamped' || r.stamp === 'already_today') {
      var lineas = tarjetas.map(function (c) {
        return { t: c.added ? T.added(c.name, c.stamps, c.goal) : T.already(c.name, c.stamps, c.goal), fuerte: true };
      });
      if (tarjetas.some(function (c) { return c.goal > 0 && c.stamps >= c.goal; })) lineas.push({ t: T.reward });
      pinta(r.stamp === 'stamped' ? '✓' : 'ⓘ', lineas, { texto: T.cards, href: cuenta + '#/sellos' });
    } else if (r.stamp === 'too_far') {
      pinta('ⓘ', [T.far(distancia(r.distance_m || 0))], { texto: T.retry, fn: sellar });
    } else if (r.stamp === 'no_location') {
      if (aqui && aqui.bloqueada) pinta('ⓘ', [T.noLoc, { t: T.blocked }], { texto: T.retry, fn: sellar });
      else pinta('ⓘ', [T.noLoc], { texto: T.useLoc, fn: sellar });
    } else if (r.stamp === 'team') {
      pinta('ⓘ', [T.team]);
    } else {
      caja.hidden = true; // el local no da sellos por visita
    }
  }

  // Primero, si el local da sellos por visita (si no, la ficha sin avisos y
  // sin pedir la ubicación). Luego, con sesión, el sello; sin ella, a entrar.
  sb.rpc('visit_qr_info', { p_token: token }).then(function (res) {
    var info = res.data || {};
    if (info.ok === false && info.error === 'token_changed') { pinta('ⓘ', [T.changed]); return null; }
    if (!info.ok || !(info.visit_cards || []).length) return null;
    return sb.auth.getSession().then(function (s) {
      if (!s.data || !s.data.session) {
        pinta('ⓘ', [T.signIn], { texto: T.login, href: cuenta + '#/entrar?siguiente=' + encodeURIComponent('visita/' + token) });
        return null;
      }
      return sellar();
    });
  }).catch(function () { /* sin red: la ficha, sin aviso */ });
})();
