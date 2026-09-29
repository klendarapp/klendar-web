/* «Planes con amigos» en las páginas públicas.
 *
 * Las fichas y los listados van en caché y no saben quién los mira. Si en
 * este navegador hay una sesión de «Tu cuenta», aquí se pinta lo personal:
 *
 * - En cada tarjeta (`[data-o]`): qué amigos van, con sus avatares («Ana y
 *   2 amigos más van»). Solo amigos: nunca recuentos de desconocidos.
 * - En una ficha (`#amigos-ficha`): quién va, el botón «Voy» en activo
 *   («Vas», que lleva a quitarlo) y, si un amigo te ha invitado, la tarjeta
 *   «Ana te invita a este plan» con «Voy» / «No puedo».
 *
 * Sin sesión guardada no carga nada más: ni la configuración ni Supabase
 * (quien no ha entrado no paga por esto).
 */
(function () {
  'use strict';
  var yo = document.currentScript;
  var en = !!(yo && yo.dataset.lang === 'en');
  var ficha = document.getElementById('amigos-ficha');
  var tarjetas = document.querySelectorAll('[data-o]');
  // «Añadir a favoritos» (ficha del negocio) y «Guardar en Planes» (ficha de
  // una publicación): si ya lo tienes, en activo y para quitarlo, como la app.
  var botonFav = document.querySelector('[data-fav]');
  var botonPlan = document.querySelector('[data-plan]');
  // Reseñas de la ficha de un negocio: las de quien has bloqueado no se ven.
  var resenas = document.querySelectorAll('[data-autor]');
  if (!ficha && !tarjetas.length && !botonFav && !botonPlan && !resenas.length) return;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var cuenta = en ? '/app/?lang=en' : '/app/';

  var T = en ? {
    someone: 'Someone',
    one: function (a) { return a + ' is going'; },
    two: function (a, b) { return a + ' and ' + b + ' are going'; },
    many: function (a, n) { return a + ' and ' + n + ' more friends are going'; },
    going: "I'm going", youGo: "You're going", remove: 'Remove “I\'m going”',
    auto: { reservation: "You're going: you've reserved a place", code: "You're going: you have the code" },
    inv1: function (a) { return a + ' has invited you to this plan'; },
    invN: function (a, n) { return a + ' and ' + n + (n === 1 ? ' more friend' : ' more friends') + ' have invited you to this plan'; },
    yes: "I'm going", no: "Can't make it", change: 'Change',
    saidYes: "You've said you're going", saidNo: "You've said you can't make it",
    doneShare: "Done! Your friends will see you're going. It's in your plans too.",
    doneNoShare: "Done. It's in your plans.",
    declined: "Done. We won't tell them.",
    gone: 'This publication is no longer available.',
    oops: 'Something did not work. If it happens again, write to info@klendar.app.',
    favOn: 'Remove from favourites', planOn: 'Remove from Plans',
    block: function (a) { return 'Block ' + a; },
  } : {
    someone: 'Alguien',
    one: function (a) { return a + ' va'; },
    two: function (a, b) { return a + ' y ' + b + ' van'; },
    many: function (a, n) { return a + ' y ' + n + ' amigos más van'; },
    going: 'Voy', youGo: 'Vas', remove: 'Quitar «Voy»',
    auto: { reservation: 'Vas: tienes plaza reservada', code: 'Vas: tienes el código' },
    inv1: function (a) { return a + ' te invita a este plan'; },
    invN: function (a, n) { return a + ' y ' + n + (n === 1 ? ' amigo más' : ' amigos más') + ' te invitan a este plan'; },
    yes: 'Voy', no: 'No puedo', change: 'Cambiar',
    saidYes: 'Has dicho que vas', saidNo: 'Has dicho que no puedes',
    doneShare: '¡Hecho! Tus amigos verán que vas. También está en tus planes.',
    doneNoShare: 'Hecho. Está en tus planes.',
    declined: 'Hecho. No le avisamos.',
    gone: 'Esta publicación ya no está disponible.',
    oops: 'Algo no ha ido bien. Si vuelve a pasar, escríbenos a info@klendar.app.',
    favOn: 'Quitar de favoritos', planOn: 'Quitar de Planes',
    block: function (a) { return 'Bloquear a ' + a; },
  };

  // ── ¿Hay sesión? Sin llamar a nada: lo que guarda Supabase en el navegador.
  function sesionGuardada(ref) {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var clave = localStorage.key(i);
        if (!/^sb-[a-z0-9]+-auth-token$/.test(clave)) continue;
        if (ref && clave !== 'sb-' + ref + '-auth-token') continue;
        var s = JSON.parse(localStorage.getItem(clave) || 'null');
        if (s && (s.refresh_token || s.access_token)) return true;
      }
    } catch (e) { /* sin almacenamiento: como sin sesión */ }
    return false;
  }
  if (!sesionGuardada()) return;

  // Con `integrity`, el navegador comprueba que el archivo del CDN es
  // exactamente el esperado (versión fija de supabase-js).
  function carga(src, integrity) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nombre(p) { return (p && p.name) || T.someone; }
  function avatar(p) {
    var foto = p && /^https:\/\//.test(p.avatar || '') ? p.avatar : '';
    return '<span class="av-amigo" aria-hidden="true">' + (foto
      ? '<img src="' + esc(foto) + '" alt="" loading="lazy" referrerpolicy="no-referrer">'
      : esc(nombre(p).trim().charAt(0).toUpperCase() || '·')) + '</span>';
  }
  function pila(lista) { return '<span class="av-pila">' + (lista || []).slice(0, 3).map(avatar).join('') + '</span>'; }
  /** «Ana va» · «Ana y Bea van» · «Ana y 3 amigos más van». */
  function frase(lista, total) {
    var n = Math.max(total || 0, (lista || []).length);
    if (!n || !(lista || []).length) return '';
    if (n === 1) return T.one(nombre(lista[0]));
    if (n === 2 && lista[1]) return T.two(nombre(lista[0]), nombre(lista[1]));
    return T.many(nombre(lista[0]), n - 1);
  }
  function quienVa(lista, total) {
    return pila(lista) + '<span>' + esc(frase(lista, total)) + '</span>';
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

  // ── Arranque: la configuración y Supabase, solo ahora que hay sesión ────
  (window.KLENDAR_ENV ? Promise.resolve() : carga('/config.js?v=3'))
    .then(function () {
      var env = window.KLENDAR_ENV;
      var ref = env && (env.url.match(/^https:\/\/([a-z0-9]+)\./) || [])[1];
      if (!env || !sesionGuardada(ref)) return null;
      return (window.supabase ? Promise.resolve() : carga('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js',
          'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok'))
        .then(function () {
          var sb = window.supabase.createClient(env.url, env.key);
          return sb.auth.getSession().then(function (r) {
            if (!r.data || !r.data.session) return;
            if (ficha) social(sb);
            if (tarjetas.length) enTarjetas(sb);
            var uid = r.data.session.user && r.data.session.user.id;
            if (botonFav) yaLoTienes(sb, uid, botonFav, 'favorites', 'business_id', botonFav.getAttribute('data-fav'), '#/seguir/', T.favOn);
            if (botonPlan) yaLoTienes(sb, uid, botonPlan, 'saved_offers', 'offer_id', botonPlan.getAttribute('data-plan'), '#/guardar/', T.planOn);
            if (resenas.length) sinBloqueadas(sb, uid);
          });
        });
    })
    .catch(function () { /* sin red: la página, sin lo de amigos */ });

  // ── «Añadir a favoritos» / «Guardar en Planes» ya puestos ──────────────
  // Solo mira si ya lo tienes; el cambio lo hace «Tu cuenta» (con ?quitar=1
  // lo quita), igual que el botón «Voy».
  function yaLoTienes(sb, uid, boton, tabla, campo, id, ruta, textoOn) {
    if (!uid || !UUID.test(id || '')) return;
    sb.from(tabla).select(campo).eq(campo, id).eq('user_id', uid).limit(1).then(function (res) {
      if (!res || res.error || !(res.data || []).length) return;
      var texto = boton.querySelector('span');
      if (texto) texto.textContent = textoOn;
      boton.classList.remove('accent');
      boton.classList.add('on');
      boton.setAttribute('href', cuenta + ruta + id + '?quitar=1');
    }, function () { /* sin red: el botón tal cual */ });
  }

  // ── Reseñas de personas bloqueadas: fuera ───────────────────────────────
  // La página va en caché y no sabe quién mira: aquí se esconden las de
  // quien has bloqueado (y tu propia reseña no ofrece bloquearte).
  function sinBloqueadas(sb, uid) {
    resenas.forEach(function (r) {
      if (r.getAttribute('data-autor') !== uid) return;
      var b = r.querySelector('a[href*="#/bloquear/"]');
      if (b) { var sep = b.previousSibling; if (sep && sep.nodeType === 3) sep.textContent = ''; b.remove(); }
    });
    sb.rpc('my_blocks').then(function (res) {
      var ids = ((res && res.data && res.data.blocks) || []).map(function (p) { return p.id; });
      if (!ids.length) return;
      resenas.forEach(function (r) {
        if (ids.indexOf(r.getAttribute('data-autor')) >= 0) r.hidden = true;
      });
      var caja = document.querySelector('.resenas');
      if (caja && !caja.querySelector('article:not([hidden])')) caja.hidden = true;
    }, function () { /* sin red: las reseñas tal cual */ });
  }

  // ── Tarjetas: qué amigos van a cada una ─────────────────────────────────
  function enTarjetas(sb) {
    var ids = [];
    for (var i = 0; i < tarjetas.length; i++) {
      var id = tarjetas[i].getAttribute('data-o');
      if (UUID.test(id || '') && ids.indexOf(id) < 0) ids.push(id);
    }
    // friends_going mira hasta 60 de una vez.
    for (var j = 0; j < ids.length; j += 60) {
      sb.rpc('friends_going', { p_offers: ids.slice(j, j + 60) }).then(function (res) {
        (res.data || []).forEach(function (fila) {
          if (!fila || !(fila.friends || []).length) return;
          document.querySelectorAll('[data-o="' + fila.offer_id + '"]').forEach(function (card) {
            if (card.querySelector('.quien-va')) return;
            var cuerpo = card.querySelector('.ocard-body') || card;
            var linea = document.createElement('span');
            linea.className = 'quien-va mini';
            linea.innerHTML = quienVa(fila.friends, fila.total);
            cuerpo.appendChild(linea);
          });
        });
      }, function () { /* sin red: sin la línea */ });
    }
  }

  // ── Ficha: quién va, «Vas» y las invitaciones ───────────────────────────
  function social(sb) {
    var id = ficha.getAttribute('data-offer');
    if (!UUID.test(id || '')) return;
    var voy = document.getElementById('voy');
    var nota = document.getElementById('voy-auto');
    var linea = document.getElementById('quien-va');
    var caja = document.getElementById('invita');
    var cambiando = false;

    function pinta(d) {
      if (!d || d.ok === false || !d.visible) return;
      if (linea) {
        var hay = (d.friends || []).length > 0;
        linea.innerHTML = hay ? quienVa(d.friends, d.total) : '';
        linea.hidden = !hay;
      }
      if (voy) {
        var texto = voy.querySelector('span');
        voy.classList.toggle('on', !!d.going);
        if (texto) texto.textContent = d.going ? T.youGo : T.going;
        voy.setAttribute('href', cuenta + '#/voy/' + id + (d.going ? '?quitar=1' : ''));
        if (d.going) { voy.title = T.remove; voy.setAttribute('aria-label', T.remove); } else {
          voy.removeAttribute('title'); voy.removeAttribute('aria-label');
        }
      }
      if (nota) {
        nota.textContent = d.auto ? (T.auto[d.auto] || '') : '';
        nota.hidden = !d.auto;
      }
      pintaInvitacion(d);
    }

    function pintaInvitacion(d) {
      if (!caja) return;
      var invs = d.invites || [];
      if (!invs.length) { caja.hidden = true; caja.innerHTML = ''; return; }
      var quienes = [];
      invs.forEach(function (i) { if (i.from && !quienes.some(function (q) { return q.id === i.from.id; })) quienes.push(i.from); });
      var titulo = invs.length > 1 ? T.invN(nombre(invs[0].from), invs.length - 1) : T.inv1(nombre(invs[0].from));
      var pendientes = invs.filter(function (i) { return !i.response; });
      var todasNo = invs.every(function (i) { return i.response === 'declined'; });
      var botones = pendientes.length || cambiando
        ? '<button type="button" class="pill accent" data-r="1">' + esc(T.yes) + '</button>' +
          '<button type="button" class="pill" data-r="0">' + esc(T.no) + '</button>'
        : '<span class="invita-estado">' + esc(todasNo ? T.saidNo : T.saidYes) + '</span>' +
          '<button type="button" class="linkbtn" data-cambiar>' + esc(T.change) + '</button>';
      // Bloquear a quien invita (el primero): «Tu cuenta» pregunta antes.
      var de = invs[0].from && UUID.test(invs[0].from.id || '') ? invs[0].from.id : '';
      var bloquear = de
        ? '<a class="denuncia" rel="nofollow" href="' + esc(cuenta + '#/bloquear/' + de) + '">' + esc(T.block(nombre(invs[0].from))) + '</a>'
        : '';
      caja.innerHTML = '<p class="invita-cab">' + pila(quienes) + '<b>' + esc(titulo) + '</b></p>' +
        '<div class="invita-acc">' + botones + '</div>' + bloquear;
      caja.hidden = false;
      var cambiar = caja.querySelector('[data-cambiar]');
      if (cambiar) cambiar.onclick = function () { cambiando = true; pintaInvitacion(d); };
      Array.prototype.forEach.call(caja.querySelectorAll('[data-r]'), function (b) {
        b.onclick = function () { contesta(d, b.getAttribute('data-r') === '1'); };
      });
    }

    function contesta(d, va) {
      var todos = caja.querySelectorAll('button');
      Array.prototype.forEach.call(todos, function (b) { b.disabled = true; });
      var invs = d.invites || [];
      var trabajo;
      if (va) {
        // Uno basta: «Voy» contesta a todas las invitaciones de esta publicación.
        var primera = invs.filter(function (i) { return i.response !== 'going'; })[0] || invs[0];
        trabajo = sb.rpc('answer_invite', { p_invite: primera.id, p_going: true }).then(comprueba)
          .then(function () { return sb.rpc('my_consents'); })
          .then(function (c) { toast(c && c.data && c.data.share_plans === false ? T.doneNoShare : T.doneShare); });
      } else {
        var cuales = invs.filter(function (i) { return i.response !== 'declined'; });
        trabajo = Promise.all(cuales.map(function (i) {
          return sb.rpc('answer_invite', { p_invite: i.id, p_going: false }).then(comprueba);
        })).then(function () { toast(T.declined); });
      }
      trabajo.then(function () {
        cambiando = false;
        return recarga();
      }, function (e) {
        toast(e && e.clave === 'not_available' ? T.gone : T.oops, true);
        Array.prototype.forEach.call(todos, function (b) { if (b.isConnected) b.disabled = false; });
      });
    }

    function comprueba(res) {
      var d = res && res.data;
      if (res && res.error) throw { clave: res.error.message };
      if (d && d.ok === false) throw { clave: d.error };
      return d;
    }

    function recarga() {
      return sb.rpc('offer_friends', { p_offer: id }).then(function (res) { pinta(res.data); }, function () {});
    }
    recarga();
  }
})();
