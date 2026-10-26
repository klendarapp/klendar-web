/* Seguir a un equipo («Dónde ver el partido») o a un artista desde las
 * páginas públicas: lo personal.
 *
 * Las páginas van en caché y no saben quién las mira. Si en este navegador
 * hay una sesión de «Tu cuenta», aquí:
 *  - «Tus equipos» (`#mis-equipos`, en la lista de partidos): los equipos que
 *    sigues, cada uno para buscar sus partidos, y «Seguir a un equipo».
 *  - «Seguir a Real Madrid» (`[data-seguir-equipo]`) y «Seguir» en la página
 *    de un artista (`[data-seguir-artista]`): en activo («Sigues a Real
 *    Madrid», «Siguiendo») si ya lo sigues; tocarlo sigue o deja de seguir
 *    sin salir de la página. Al seguir, se guarda la zona de los filtros para
 *    los avisos (`set_broadcast_area`, la misma para equipos y artistas).
 * Sin sesión no carga nada: el botón lleva a «Tu cuenta»
 * (`#/equipos?seguir=<id>` o `#/artistas?seguir=<id>`), que lo hace al
 * entrar, con la marca de que se ha pulsado aquí (así no vuelve a preguntar;
 * ver `hayIntencion` en app.js).
 *
 * Los textos de los artistas, de /assets/artistas.js (cargado antes en su
 * página); los de los equipos, aquí.
 */
(function () {
  'use strict';
  var yo = document.currentScript;
  var en = !!(yo && yo.dataset.lang === 'en');
  var URL_SB = yo && yo.dataset.url;
  var KEY = yo && yo.dataset.key;
  var caja = document.getElementById('mis-equipos');
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var KA = globalThis.KlendarArtistas ? globalThis.KlendarArtistas.t(en ? 'en' : 'es') : null;

  var T = en ? {
    teams: 'Your teams', follow: 'Follow a team',
    oops: 'Something went wrong. If it happens again, email info@klendar.app.',
  } : {
    teams: 'Tus equipos', follow: 'Seguir a un equipo',
    oops: 'Algo no ha ido bien. Si vuelve a pasar, escríbenos a info@klendar.app.',
  };

  /** Lo que cambia entre seguir a un equipo y a un artista. */
  var TIPOS = [
    {
      attr: 'data-seguir-equipo', ruta: 'equipos', param: 'p_team',
      si: 'follow_broadcast_team', no: 'unfollow_broadcast_team',
      mios: ['my_followed_teams', { p_lang: en ? 'en' : 'es' }],
      tope: en ? "You're following 30 teams, the maximum. Unfollow one to follow this one." : 'Sigues a 30 equipos, el máximo. Deja alguno para seguir este.',
      on: function (n) { return en ? "You're following " + n + ". We'll let you know before each match." : 'Sigues a ' + n + '. Te avisamos antes de cada partido.'; },
      off: function (n) { return en ? "You're no longer following " + n + '.' : 'Ya no sigues a ' + n + '.'; },
    },
    {
      attr: 'data-seguir-artista', ruta: 'artistas', param: 'p_artist',
      si: 'follow_artist', no: 'unfollow_artist',
      mios: ['my_followed_artists', {}],
      tope: KA ? KA.tooManyFollow : T.oops,
      on: function (n) { return KA ? KA.on(n) : ''; },
      off: function (n) { return KA ? KA.off(n) : ''; },
    },
  ];
  var tipoDe = function (el) {
    for (var i = 0; i < TIPOS.length; i++) if (el.hasAttribute(TIPOS[i].attr)) return TIPOS[i];
    return null;
  };
  var selector = TIPOS.map(function (x) { return '[' + x.attr + ']'; }).join(',');
  var botones = document.querySelectorAll(selector);

  // Sin sesión: la marca de que «Seguir…» se ha pulsado en esta web.
  document.addEventListener('click', function (e) {
    var a = e.target instanceof Element ? e.target.closest(selector) : null;
    if (!a || a.getAttribute('data-directo') === '1') return;
    var tipo = tipoDe(a);
    var id = tipo && a.getAttribute(tipo.attr);
    if (!UUID.test(id || '')) return;
    try { sessionStorage.setItem('klendar.intencion', JSON.stringify({ r: tipo.ruta + '?seguir=' + id, t: Date.now() })); } catch (x) { /* sin almacenamiento */ }
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
    if (!msg) return;
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.className = 'am-toast';
      aviso.setAttribute('role', 'status');
      document.body.appendChild(aviso);
    }
    aviso.textContent = msg;
    aviso.classList.toggle('bad', !!malo);
    aviso.classList.remove('mov-sale');
    aviso.hidden = false;
    clearTimeout(toast.t);
    // Se va con un fundido corto (Movimiento, /assets/site.css).
    toast.t = setTimeout(function () {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { aviso.hidden = true; return; }
      aviso.classList.add('mov-sale');
      toast.t = setTimeout(function () { aviso.hidden = true; aviso.classList.remove('mov-sale'); }, 150);
    }, malo ? 6000 : 3500);
  }
  function carga(src, integrity) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }

  // Qué tipos hay en la página (los equipos también si está «Tus equipos»).
  var usados = TIPOS.filter(function (x, i) {
    return document.querySelector('[' + x.attr + ']') || (i === 0 && caja);
  });

  (window.supabase ? Promise.resolve() : carga('/assets/vendor/supabase-js-2.117.2.js',
    'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok'))
    .then(function () {
      var sb = window.klendarSb || (window.klendarSb = window.supabase.createClient(URL_SB, KEY,
        { auth: { flowType: 'pkce', detectSessionInUrl: false } }));
      return sb.auth.getSession().then(function (r) {
        if (!r.data || !r.data.session) return;
        return Promise.all(usados.map(function (tipo) {
          return sb.rpc(tipo.mios[0], tipo.mios[1]).then(function (res) {
            if (res.error) return;
            var lista = Array.isArray(res.data) ? res.data : [];
            var siguiendo = {};
            lista.forEach(function (x) { if (x && x.id) siguiendo[x.id] = true; });
            if (tipo === TIPOS[0] && caja && lista.length) misEquipos(lista);
            document.querySelectorAll('[' + tipo.attr + ']').forEach(function (b) { enganchaBoton(sb, tipo, b, siguiendo); });
          });
        }));
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

  // «Seguir» ⇄ «Siguiendo», sin salir de la página.
  function enganchaBoton(sb, tipo, b, siguiendo) {
    var id = b.getAttribute(tipo.attr);
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
      var args = {};
      args[tipo.param] = id;
      sb.rpc(on ? tipo.no : tipo.si, args).then(function (res) {
        var d = res.data;
        if (res.error || (d && d.ok === false)) {
          toast(d && d.error === 'too_many' ? tipo.tope : T.oops, true);
          return;
        }
        pinta(!on);
        if (!on) sb.rpc('set_broadcast_area', zonaParaAvisos()).then(function () {}, function () {});
        toast(on ? tipo.off(nombre) : tipo.on(nombre));
      }).catch(function () { toast(T.oops, true); }).then(function () { ocupado = false; });
    });
  }
  /** La zona de los filtros de Explorar (la que se guarda en este navegador)
   * para los avisos de lo que sigues: la distancia y, con una ciudad, esa
   * ciudad (migración 20261203100002 de la app). La base solo la guarda si
   * sigue algún equipo o artista. */
  function zonaParaAvisos() {
    var z = { p_radius_m: 5000, p_lat: null, p_lng: null, p_city: null };
    try {
      var g = JSON.parse(localStorage.getItem('klendar.filtros') || 'null');
      var a = new URLSearchParams((g && (g[/^\/en\//.test(location.pathname) ? 'en' : 'es'])) || '');
      var km = parseInt(a.get('km') || '', 10);
      if ([1, 3, 5, 10, 25].indexOf(km) >= 0) z.p_radius_m = km * 1000;
      var c = a.get('ciudad') || a.get('city');
      if (!(a.get('lat') && a.get('lng')) && c) z.p_city = c;
    } catch (x) { /* sin almacenamiento: la de siempre */ }
    return z;
  }
})();
