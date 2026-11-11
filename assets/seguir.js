/* Seguir a un equipo, un deportista o una competición («Dónde verlo») o a un
 * artista desde las páginas públicas: lo personal.
 *
 * Las páginas van en caché y no saben quién las mira. Si en este navegador
 * hay una sesión de «Tu cuenta», aquí:
 *  - «Sigues» (`#mis-equipos`, en la lista de partidos): los equipos y
 *    deportistas que sigues, cada uno para buscar sus partidos, y «Seguir».
 *  - «Seguir a Real Madrid» / «Seguir Fórmula 1» (`[data-seguir-equipo]`,
 *    con su aviso en `data-msg-si` / `data-msg-no`) y «Seguir» en la página
 *    de un artista (`[data-seguir-artista]`): en activo («Sigues a Real
 *    Madrid», «Siguiendo») si ya lo sigues; tocarlo sigue o deja de seguir
 *    sin salir de la página. Al seguir, se guarda la zona de los filtros para
 *    los avisos (`set_broadcast_area`, la misma para equipos y artistas).
 * Sin sesión no carga nada: el botón lleva a «Tu cuenta»
 * (`/cuenta/equipos?seguir=<id>` o `/cuenta/artistas?seguir=<id>`), que lo hace al
 * entrar, con la marca de que se ha pulsado aquí (así no vuelve a preguntar;
 * ver `hayIntencion` en app.js).
 *
 * Los textos de los artistas, de /assets/artistas.js (cargado antes en su
 * página); los de los equipos, aquí. En la ficha de un evento, los
 * deportistas que no caben van en «Ver N más» (`.seguir-mas`): los que ya
 * sigues salen de ahí.
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
    teams: 'Following', follow: 'Follow',
    oops: 'Something went wrong. If it happens again, email info@klendar.app.',
    rate: 'Too many attempts. Wait a while and try again.',
  } : {
    teams: 'Sigues', follow: 'Seguir',
    oops: 'Algo no ha ido bien. Si vuelve a pasar, escríbenos a info@klendar.app.',
    rate: 'Demasiados intentos. Espera un rato y vuelve a probar.',
  };

  /** Lo que cambia entre seguir a un equipo y a un artista. */
  var TIPOS = [
    {
      attr: 'data-seguir-equipo', ruta: 'equipos', param: 'p_team',
      si: 'follow_broadcast_team', no: 'unfollow_broadcast_team',
      mios: ['my_followed_teams', { p_lang: en ? 'en' : 'es' }],
      // Los textos de la app (watchTooMany, watchFollowedSnack,
      // watchUnfollowedSnack) y los de «Tu cuenta» (assets/cuenta/partidos.js).
      tope: en ? 'You can follow up to 30 teams, athletes and competitions' : 'Puedes seguir 30 equipos, deportistas y competiciones como mucho',
      on: function (n) { return en ? "You're following " + n + ": we'll let you know before their matches" : 'Sigues a ' + n + ': te avisamos antes de sus partidos'; },
      off: function (n) { return en ? "You're no longer following " + n : 'Ya no sigues a ' + n; },
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

  // Qué tipos hay en la página (los equipos también si está «Sigues»).
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
            if (tipo === TIPOS[0]) sacaSeguidos(siguiendo);
            document.querySelectorAll('[' + tipo.attr + ']').forEach(function (b) { enganchaBoton(sb, tipo, b, siguiendo); });
          });
        }));
      });
    })
    .catch(function () { /* sin red: la página, sin lo personal */ });

  // «Sigues»: un chip por equipo (busca sus partidos) y «Seguir».
  function misEquipos(lista) {
    var base = caja.getAttribute('data-base') || '/partidos';
    var zona = caja.getAttribute('data-zona') || '';
    var cuenta = en ? '/cuenta/equipos?lang=en' : '/cuenta/equipos';
    caja.innerHTML = '<p class="mis-equipos-t">' + esc(T.teams) + '</p><div class="mis-equipos-chips">'
      + lista.map(function (x) {
        var q = new URLSearchParams(zona);
        q.set('q', x.name);
        return '<a class="chip" href="' + esc(base + '?' + q.toString()) + '">' + esc(x.name) + '</a>';
      }).join('') + '</div><a class="pill" href="' + cuenta + '">' + esc(T.follow) + '</a>';
  }

  // «Ver N más»: los deportistas que ya sigues, fuera (delante), como la app.
  function sacaSeguidos(siguiendo) {
    document.querySelectorAll('details.seguir-mas').forEach(function (d) {
      var dentro = d.querySelector('.seguir-equipos');
      if (!dentro) return;
      Array.prototype.slice.call(dentro.querySelectorAll('[data-seguir-equipo]')).forEach(function (b) {
        if (siguiendo[b.getAttribute('data-seguir-equipo')]) d.parentNode.insertBefore(b, d);
      });
      var n = dentro.querySelectorAll('[data-seguir-equipo]').length;
      if (!n) { d.remove(); return; }
      var s = d.querySelector('summary');
      if (s) s.textContent = n === 1 ? d.getAttribute('data-ver-uno') : String(d.getAttribute('data-ver-n') || '').replace('{n}', n);
    });
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
    // Optimista (como la app): cambia al momento (y al encenderse late: lo
    // pone /assets/cabecera.js con aria-pressed); si la base dice que no,
    // vuelve atrás y el aviso lo dice.
    b.addEventListener('click', function (e) {
      e.preventDefault();
      if (ocupado) return;
      ocupado = true;
      var on = b.getAttribute('aria-pressed') === 'true';
      var args = {};
      args[tipo.param] = id;
      pinta(!on);
      var falla = function (msg) { pinta(on); toast(msg, true); };
      sb.rpc(on ? tipo.no : tipo.si, args).then(function (res) {
        var d = res.data;
        if (res.error || (d && d.ok === false)) {
          var c = d && d.error;
          falla(c === 'too_many' ? tipo.tope : c === 'rate_limited' ? T.rate : T.oops);
          return;
        }
        if (!on) sb.rpc('set_broadcast_area', zonaParaAvisos()).then(function () {}, function () {});
        // El aviso según lo que es («…antes de sus carreras», «Sigues LaLiga…»).
        toast(on ? (b.getAttribute('data-msg-no') || tipo.off(nombre)) : (b.getAttribute('data-msg-si') || tipo.on(nombre)));
      }).catch(function () { falla(T.oops); }).then(function () { ocupado = false; });
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
      var a = new URLSearchParams((g && (g[/^\/en(\/|$)/.test(location.pathname) ? 'en' : 'es'])) || '');
      var km = parseInt(a.get('km') || '', 10);
      if ([1, 3, 5, 10, 25].indexOf(km) >= 0) z.p_radius_m = km * 1000;
      var c = a.get('ciudad') || a.get('city');
      if (!(a.get('lat') && a.get('lng')) && c) z.p_city = c;
    } catch (x) { /* sin almacenamiento: la de siempre */ }
    return z;
  }
})();
