/* «Sorteos» en las páginas públicas: lo que hace el navegador (tanda C).
 *
 * Las páginas van en caché y no saben quién las mira. Aquí:
 *  - «Comprobar el resultado» (en la página de un sorteo ya sorteado): repite
 *    el sorteo con la semilla publicada (`KlendarSorteos.verifica`, con
 *    `crypto.subtle`) y dice si sale lo mismo. Sin sesión.
 *  - «Compartir»: el menú de compartir del móvil o, si no hay, copiar el
 *    enlace.
 *  - Con una sesión de «Tu cuenta» guardada en este navegador:
 *    · en la página del sorteo, lo tuyo (`giveaway_detail` con tu sesión):
 *      participar, «Participas · tu número es el 37» con «Dejar el sorteo»,
 *      sin edad, del equipo, «¡Has ganado!» con «Aceptar el premio» y
 *      «Renunciar», aceptado, entregado, caducado o «Esta vez no te ha
 *      tocado.»;
 *    · en la lista, «Participas · nº 37» en los tuyos y la pestaña «En los
 *      que participas» (`my_giveaways`).
 * Sin sesión, «Participar» lleva a «Tu cuenta» (`#/sorteo/<id>`), que pide
 * entrar, participa y vuelve aquí; se deja la marca de que se ha pulsado en
 * esta web (así no vuelve a preguntar; ver `hayIntencion` en app.js).
 */
(function () {
  'use strict';
  var yo = document.currentScript;
  var en = !!(yo && yo.dataset.lang === 'en');
  var lang = en ? 'en' : 'es';
  var URL_SB = yo && yo.dataset.url;
  var KEY = yo && yo.dataset.key;
  var KS = window.KlendarSorteos;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!KS) return;
  var S = KS.t(lang);
  var caja = document.getElementById('sorteo-accion');
  var lista = document.getElementById('sorteos-lista');
  var mios = document.getElementById('mis-sorteos');

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

  // ── Sin sesión: la marca de «Participar» pulsado aquí ─────────────────────
  document.addEventListener('click', function (e) {
    var a = e.target instanceof Element ? e.target.closest('[data-sorteo-entrar]') : null;
    if (!a || !caja || a.getAttribute('data-directo') === '1') return;
    var id = caja.getAttribute('data-id');
    if (!UUID.test(id || '')) return;
    try { sessionStorage.setItem('klendar.intencion', JSON.stringify({ r: 'sorteo/' + id, t: Date.now() })); } catch (x) { /* sin almacenamiento */ }
  }, true);

  // ── Comprobar el resultado ────────────────────────────────────────────────
  var comprobar = document.getElementById('sorteo-comprobar');
  var datosVer = document.getElementById('sorteo-ver-datos');
  var res = document.getElementById('sorteo-ver-res');
  if (comprobar && datosVer) {
    var puede = !!(window.crypto && window.crypto.subtle && typeof BigInt === 'function' && window.TextEncoder);
    comprobar.hidden = false;
    comprobar.addEventListener('click', function () {
      if (!puede) { res.textContent = S.noCrypto; return; }
      var d;
      try { d = JSON.parse(datosVer.textContent); } catch (x) { return; }
      comprobar.disabled = true;
      res.className = 'sorteo-ver-res';
      res.textContent = S.checking;
      KS.verifica(d).then(function (ok) {
        res.textContent = (ok ? '✓ ' : '') + (ok ? S.ok : S.bad);
        res.classList.add(ok ? 'ok' : 'mal');
      }).catch(function () { res.textContent = S.bad; res.classList.add('mal'); })
        .then(function () { comprobar.disabled = false; });
    });
  }

  // ── Compartir ─────────────────────────────────────────────────────────────
  var compartir = document.getElementById('sorteo-compartir');
  if (compartir) {
    compartir.addEventListener('click', function () {
      var url = compartir.getAttribute('data-url') || location.href;
      var titulo = compartir.getAttribute('data-titulo') || document.title;
      if (navigator.share) {
        navigator.share({ title: titulo, url: url }).catch(function () { /* cancelado */ });
        return;
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { toast(compartir.getAttribute('data-copiado') || S.copied); }, function () {});
      }
    });
  }

  // ── Con sesión ────────────────────────────────────────────────────────────
  if ((!caja && !lista && !mios) || !URL_SB || !KEY) return;
  var ref = (URL_SB.match(/^https:\/\/([a-z0-9]+)\./) || [])[1];
  function sesionGuardada() {
    try {
      var s = JSON.parse(localStorage.getItem('sb-' + ref + '-auth-token') || 'null');
      return !!(s && (s.refresh_token || s.access_token));
    } catch (x) { return false; }
  }
  if (!ref || !sesionGuardada()) return;
  function carga(src, integrity) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }
  var sb = null;
  (window.supabase ? Promise.resolve() : carga('/assets/vendor/supabase-js-2.117.2.js',
    'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok'))
    .then(function () {
      sb = window.klendarSb || (window.klendarSb = window.supabase.createClient(URL_SB, KEY,
        { auth: { flowType: 'pkce', detectSessionInUrl: false } }));
      return sb.auth.getSession().then(function (r) {
        if (!r.data || !r.data.session) return;
        if (caja) return recarga();
        return sb.rpc('my_giveaways').then(function (x) {
          if (x.error) return;
          var mis = Array.isArray(x.data) ? x.data : [];
          if (lista) marcaLista(mis);
          if (mios) pintaMios(mis);
        });
      });
    })
    .catch(function () { /* sin red: la página, sin lo personal */ });

  /** Pide el sorteo con tu sesión y pinta lo tuyo. */
  function recarga() {
    return sb.rpc('giveaway_detail', { p_id: caja.getAttribute('data-id') }).then(function (r) {
      if (r.error || !r.data || !r.data.me) return;
      pinta(r.data);
    });
  }

  // ── La caja del botón, con lo tuyo ────────────────────────────────────────
  var estado = document.getElementById('sorteo-estado');
  var boton = document.getElementById('sorteo-boton');
  var extra = document.getElementById('sorteo-extra');
  var accion = null; // lo que hace el botón principal
  var negocioActual = '';
  var ocupado = false;

  function pinta(g) {
    var me = g.me || {};
    var tz = caja.getAttribute('data-tz') || 'Europe/Madrid';
    var negocio = (g.business && g.business.name) || '';
    negocioActual = negocio;
    var est = '';
    var btn = null; // { texto, hace }
    var mas = '';
    if (g.status === 'cancelled') {
      est = esc(S.cancelled(g.cancel_reason || ''));
    } else if (g.status === 'drawn') {
      var p = me.prize;
      if (p && p.status === 'pending') {
        est = '<span class="sorteo-gana"><b>' + esc(S.won) + '</b>' + esc(S.acceptBy(KS.cuando(p.claim_until, lang, tz))) + '</span>';
        btn = { texto: S.claim, hace: 'claim' };
        mas = '<button type="button" class="pill" data-sorteo="decline">' + esc(S.decline) + '</button>';
      } else if (p && p.status === 'claimed') {
        est = '<span class="sorteo-gana"><b>' + esc(S.won) + '</b>' + esc(S.claimed(negocio)) + '</span>';
      } else if (p && p.status === 'delivered') {
        est = '<b>' + esc(S.delivered) + '</b>';
      } else if (p && p.status === 'expired') {
        est = '<b>' + esc(S.ended) + '</b><br>' + esc(S.expired);
      } else if (p && p.status === 'declined') {
        est = '<b>' + esc(S.ended) + '</b><br>' + esc(S.declined);
      } else {
        est = '<b>' + esc(S.ended) + '</b>' + (me.entered ? '<br>' + esc(S.noLuck) : '');
      }
    } else if (KS.terminado(g)) {
      est = '<b>' + esc(S.drawing) + '</b>';
      if (me.entered && me.number) mas = '<p class="note">' + esc(S.inNumber(me.number)) + '</p>';
    } else if (me.team) {
      est = esc(S.team);
    } else if (me.entered) {
      est = '<b>' + esc(S.inNumber(me.number)) + '</b>';
      mas = '<button type="button" class="enlace-discreto" data-sorteo="leave">' + esc(S.leave) + '</button>';
    } else if (!me.adult) {
      est = esc(S.noAge);
      mas = '<a class="pill" href="' + (en ? '/app/?lang=en' : '/app/') + '#/ajustes">' + esc(S.addBirth) + '</a>';
    } else {
      btn = { texto: g.requires_favorite && !me.favorite ? S.enterFav : S.enter, hace: 'enter' };
      mas = '<p class="note">' + esc(S.free) + '</p>';
    }
    estado.innerHTML = est;
    estado.hidden = !est;
    if (btn) {
      boton.textContent = btn.texto;
      boton.hidden = false;
      boton.setAttribute('data-directo', '1');
      // Abajo en el móvil (/assets/barra.js) el botón sube aquí.
      if (btn.hace !== 'enter') boton.setAttribute('href', '#sorteo-accion');
      accion = btn.hace;
    } else {
      boton.hidden = true;
      accion = null;
    }
    extra.innerHTML = mas;
    // Lo que no es de todo el mundo, solo para ti.
    var tj = caja.closest('.detail');
    if (tj) tj.classList.toggle('sorteo-ganado', !!(me.prize && me.prize.status === 'pending'));
  }

  function falla(r) {
    var d = r && r.data;
    var code = (d && d.ok === false && d.error) || '';
    toast(KS.error(code, lang) || S.oops, true);
  }
  function haz(fn) {
    if (ocupado) return;
    ocupado = true;
    var id = caja.getAttribute('data-id');
    sb.rpc(fn, { p_id: id }).then(function (r) {
      if (r.error || (r.data && r.data.ok === false)) { falla(r); return; }
      if (fn === 'giveaway_enter' && r.data && r.data.number) {
        toast(S.enteredOk(r.data.number) + (r.data.favorite_added ? ' ' + S.favAdded(negocioActual) : ''));
      }
      if (fn === 'giveaway_leave') toast(S.left);
      return recarga();
    }).catch(function () { toast(S.oops, true); }).then(function () { ocupado = false; });
  }
  if (caja) {
    boton.addEventListener('click', function (e) {
      if (!accion || !sb) return;
      e.preventDefault();
      if (accion === 'enter') haz('giveaway_enter');
      else if (accion === 'claim') haz('giveaway_claim');
    });
    extra.addEventListener('click', function (e) {
      var b = e.target instanceof Element ? e.target.closest('[data-sorteo]') : null;
      if (!b || !sb) return;
      var que = b.getAttribute('data-sorteo');
      if (que === 'leave') haz('giveaway_leave');
      if (que === 'decline') confirma(S.declineQ).then(function (si) { if (si) haz('giveaway_decline'); });
    });
  }

  /** Un diálogo de confirmar sencillo (como `confirma` de «Tu cuenta»). */
  function confirma(texto) {
    return new Promise(function (ok) {
      var d = document.createElement('dialog');
      d.className = 'dialogo sorteo-dialogo';
      d.innerHTML = '<p>' + esc(texto) + '</p><div class="dialogo-botones">'
        + '<button type="button" class="pill" value="no">' + esc(S.cancel) + '</button>'
        + '<button type="button" class="pill peligro-lleno" value="si">' + esc(S.decline) + '</button></div>';
      document.body.appendChild(d);
      var si = false;
      d.querySelectorAll('button').forEach(function (b) { b.onclick = function () { si = b.value === 'si'; d.close(); }; });
      d.addEventListener('close', function () { d.remove(); ok(si); });
      if (d.showModal) d.showModal(); else ok(window.confirm(texto));
    });
  }

  // ── La lista ──────────────────────────────────────────────────────────────
  function marcaLista(mis) {
    var num = {};
    mis.forEach(function (g) { if (g && g.me && g.me.entered && g.me.number) num[g.id] = g.me.number; });
    lista.querySelectorAll('[data-sorteo]').forEach(function (a) {
      var n = num[a.getAttribute('data-sorteo')];
      var y = a.querySelector('.sorteo-tj-yo');
      if (n && y) { y.textContent = S.youreIn(n); y.hidden = false; }
    });
  }
  function base() { return en ? '/en/giveaway/' : '/sorteo/'; }
  function tarjeta(g) {
    var b = g.business || {};
    var tz = (b.time_zone) || 'Europe/Madrid';
    var logo = /^https:\/\//.test(b.logo_url || '') ? '<img src="' + esc(b.logo_url) + '" alt="" width="56" height="56" loading="lazy" decoding="async">'
      : '<span class="ph" aria-hidden="true">' + esc((b.name || '·').charAt(0).toUpperCase()) + '</span>';
    var linea = KS.terminado(g)
      ? (g.status === 'cancelled' ? S.cancelled('') : g.status === 'drawn' ? S.ended : S.drawing)
      : S.endsOn(KS.cuando(g.ends_at, lang, tz)) + ' · ' + S.entrants(Number(g.entries) || 0);
    var yoTxt = g.me && g.me.prize && g.me.prize.status === 'pending' ? S.won
      : g.me && g.me.number ? S.youreIn(g.me.number) : '';
    return '<a class="sorteo-tj" href="' + base() + esc(g.id) + '" data-sorteo="' + esc(g.id) + '">' + logo
      + '<span class="sorteo-tj-t"><small class="muted">' + esc(b.name || '') + '</small>'
      + '<b><span class="sorteo-tj-ante">' + esc(S.word) + '</span> ' + esc(g.prize) + '</b>'
      + '<small class="muted">' + esc(linea) + '</small>'
      + (yoTxt ? '<small class="sorteo-tj-yo">' + esc(yoTxt) + '</small>' : '') + '</span>'
      + '<span class="sorteo-tj-ir" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg></span></a>';
  }
  function pintaMios(mis) {
    var ver = mis.filter(function (g) { return g && UUID.test(g.id || ''); });
    if (!ver.length) {
      mios.innerHTML = '<section class="vacio"><h2>' + esc(mios.getAttribute('data-vacio-t')) + '</h2>'
        + '<p>' + esc(mios.getAttribute('data-vacio-p')) + '</p>'
        + '<div class="vacio-botones"><a class="pill accent" href="' + esc(mios.getAttribute('data-cerca')) + '">' + esc(mios.getAttribute('data-cerca-t')) + '</a></div></section>';
      return;
    }
    mios.innerHTML = '<div class="sorteos-lista">' + ver.map(tarjeta).join('') + '</div>';
  }
})();
