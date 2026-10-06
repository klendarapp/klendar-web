/* «Dónde ver el partido» en las páginas públicas: lo personal.
 *
 * Las páginas van en caché y no saben quién las mira. Si en este navegador
 * hay una sesión de «Tu cuenta», aquí:
 *  - «Tus equipos» (`#mis-equipos`, en la lista): los equipos que sigues, cada
 *    uno para buscar sus partidos, y «Seguir a un equipo».
 *  - «Seguir a Real Madrid» (`[data-seguir-equipo]`, en el detalle): en activo
 *    («Sigues a Real Madrid») si ya lo sigues; tocarlo sigue o deja de seguir
 *    sin salir de la página.
 * Sin sesión no carga nada: «Seguir a…» lleva a «Tu cuenta»
 * (`#/equipos?seguir=<id>`), que lo hace al entrar, con la marca de que se
 * ha pulsado aquí (así no vuelve a preguntar; ver `hayIntencion` en app.js).
 */
(function () {
  'use strict';
  var yo = document.currentScript;
  var en = !!(yo && yo.dataset.lang === 'en');
  var URL_SB = yo && yo.dataset.url;
  var KEY = yo && yo.dataset.key;
  var caja = document.getElementById('mis-equipos');
  var botones = document.querySelectorAll('[data-seguir-equipo]');
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var T = en ? {
    teams: 'Your teams', follow: 'Follow a team',
    tooMany: "You're following 30 teams, the maximum. Unfollow one to follow this one.",
    oops: 'Something went wrong. If it happens again, email info@klendar.app.',
    on: function (n) { return "You're following " + n + ". We'll let you know before each match."; },
    off: function (n) { return "You're no longer following " + n + '.'; },
  } : {
    teams: 'Tus equipos', follow: 'Seguir a un equipo',
    tooMany: 'Sigues a 30 equipos, el máximo. Deja alguno para seguir este.',
    oops: 'Algo no ha ido bien. Si vuelve a pasar, escríbenos a info@klendar.app.',
    on: function (n) { return 'Sigues a ' + n + '. Te avisamos antes de cada partido.'; },
    off: function (n) { return 'Ya no sigues a ' + n + '.'; },
  };

  // Sin sesión: la marca de que «Seguir a…» se ha pulsado en esta web.
  document.addEventListener('click', function (e) {
    var a = e.target instanceof Element ? e.target.closest('[data-seguir-equipo]') : null;
    if (!a || a.getAttribute('data-directo') === '1') return;
    var id = a.getAttribute('data-seguir-equipo');
    if (!UUID.test(id || '')) return;
    try { sessionStorage.setItem('klendar.intencion', JSON.stringify({ r: 'equipos?seguir=' + id, t: Date.now() })); } catch (x) { /* sin almacenamiento */ }
  }, true);

  if ((!caja && !botones.length) || !URL_SB || !KEY) return;
  var ref = (URL_SB.match(/^https:\/\/([a-z0-9]+)\./) || [])[1];

  function sesionGuardada() {
    try {
      var s = JSON.parse(localStorage.getItem('sb-' + ref + '-auth-token') || 'null');
      return !!(s && (s.refresh_token || s.access_token));
    } catch (x) { return false; }
  }
  if (!ref || !sesionGuardada()) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var aviso = null;
  function toast(msg, malo) {
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.className = 'am-toast';
      aviso.setAttribute('role', 'status');
      document.body.appendChild(aviso);
    }
    aviso.textContent = msg;
    aviso.classList.toggle('bad', !!malo);
    aviso.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { aviso.hidden = true; }, malo ? 6000 : 3500);
  }
  function carga(src, integrity) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }

  (window.supabase ? Promise.resolve() : carga('/assets/vendor/supabase-js-2.117.2.js',
    'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok'))
    .then(function () {
      var sb = window.klendarSb || (window.klendarSb = window.supabase.createClient(URL_SB, KEY,
        { auth: { flowType: 'pkce', detectSessionInUrl: false } }));
      return sb.auth.getSession().then(function (r) {
        if (!r.data || !r.data.session) return;
        return sb.rpc('my_followed_teams', { p_lang: en ? 'en' : 'es' }).then(function (res) {
          if (res.error) return;
          var lista = Array.isArray(res.data) ? res.data : [];
          var siguiendo = {};
          lista.forEach(function (x) { if (x && x.id) siguiendo[x.id] = true; });
          if (caja && lista.length) misEquipos(lista);
          botones.forEach(function (b) { enganchaBoton(sb, b, siguiendo); });
        });
      });
    })
    .catch(function () { /* sin red: la página, sin lo personal */ });

  // «Tus equipos»: un chip por equipo (busca sus partidos) y «Seguir a un equipo».
  function misEquipos(lista) {
    var base = caja.getAttribute('data-base') || '/partidos/';
    var zona = caja.getAttribute('data-zona') || '';
    var cuenta = en ? '/app/?lang=en#/equipos' : '/app/#/equipos';
    caja.innerHTML = '<p class="mis-equipos-t">' + esc(T.teams) + '</p><div class="mis-equipos-chips">'
      + lista.map(function (x) {
        var q = new URLSearchParams(zona);
        q.set('q', x.name);
        return '<a class="chip" href="' + esc(base + '?' + q.toString()) + '">' + esc(x.name) + '</a>';
      }).join('') + '</div><a class="pill" href="' + cuenta + '">' + esc(T.follow) + '</a>';
  }

  // «Seguir a Real Madrid» ⇄ «Sigues a Real Madrid», sin salir de la página.
  function enganchaBoton(sb, b, siguiendo) {
    var id = b.getAttribute('data-seguir-equipo');
    var nombre = b.getAttribute('data-nombre') || '';
    if (!UUID.test(id || '')) return;
    var pinta = function (on) {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.textContent = on ? b.getAttribute('data-si') : b.getAttribute('data-no');
    };
    b.setAttribute('data-directo', '1');
    b.setAttribute('role', 'button');
    pinta(!!siguiendo[id]);
    var ocupado = false;
    b.addEventListener('click', function (e) {
      e.preventDefault();
      if (ocupado) return;
      ocupado = true;
      var on = b.getAttribute('aria-pressed') === 'true';
      sb.rpc(on ? 'unfollow_broadcast_team' : 'follow_broadcast_team', { p_team: id }).then(function (res) {
        var d = res.data;
        if (res.error || (d && d.ok === false)) {
          toast(d && d.error === 'too_many' ? T.tooMany : T.oops, true);
          return;
        }
        pinta(!on);
        toast(on ? T.off(nombre) : T.on(nombre));
      }).catch(function () { toast(T.oops, true); }).then(function () { ocupado = false; });
    });
  }
})();
