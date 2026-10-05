/* «Planes con amigos» en las páginas públicas.
 *
 * Las fichas y los listados van en caché y no saben quién los mira. Si en
 * este navegador hay una sesión de «Tu cuenta», aquí se pinta lo personal:
 *
 * - En cada tarjeta (`[data-o]`): qué amigos van, con sus avatares («Ana y
 *   2 amigos más van»). Solo amigos: nunca recuentos de desconocidos.
 * - En una ficha (`#amigos-ficha`): quién va, el botón «Voy» en activo
 *   («Vas», que lleva a quitarlo) y, si un amigo te ha invitado, la tarjeta
 *   «Ana te invita a este plan» con «Voy» / «No puedo». Con código o
 *   reserva (`data-codigo`) no hay «Voy»: conseguirlo ya cuenta, y «Voy» en
 *   la invitación lleva a conseguirlo.
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
  // Explorar y Descubre: la barra de filtros, donde va «Van mis amigos».
  var barra = document.querySelector('[data-amigos-filtro]') || document.getElementById('barra');
  // Ficha de una publicación o de un negocio: si quien mira es de su equipo.
  var equipoEl = document.querySelector('[data-equipo-biz]');
  if (!ficha && !tarjetas.length && !botonFav && !botonPlan && !resenas.length && !barra && !equipoEl) return;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var cuenta = en ? '/app/?lang=en' : '/app/';

  var T = en ? {
    someone: 'Klendar user',
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
    oops: 'Something went wrong. If it happens again, email info@klendar.app.',
    favOn: 'Remove from favourites', planOn: 'Remove from Plans',
    block: function (a) { return 'Block ' + a; },
    filtro: 'Friends going', cargando: 'Looking at your friends’ plans…',
    total: function (n) { return n === 1 ? '1 plan your friends are going to' : n + ' plans your friends are going to'; },
    vacioT: "Your friends aren't going to anything here yet",
    vacioB: "When a friend taps “I'm going”, gets a code or reserves a place, it'll show up here. Each friend's page shows all their upcoming plans.",
    sinT: "You don't have any friends on Klendar yet",
    sinB: 'With “Friends going” you see which plans your friends are going to. Add them with your friend link or QR code: only people who have it can find you.',
    verAmigos: 'See your friends', anadir: 'Add friends', quitar: 'Turn off “Friends going”', free: 'Free',
  } : {
    someone: 'Usuario de Klendar',
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
    filtro: 'Van mis amigos', cargando: 'Mirando los planes de tus amigos…',
    total: function (n) { return n === 1 ? '1 plan al que van tus amigos' : n + ' planes a los que van tus amigos'; },
    vacioT: 'Tus amigos aún no van a nada por aquí',
    vacioB: 'Cuando un amigo marque «Voy», consiga un código o reserve plaza, saldrá aquí. En la ficha de cada amigo ves todos sus próximos planes.',
    sinT: 'Aún no tienes amigos en Klendar',
    sinB: 'Con «Van mis amigos» ves a qué planes van tus amigos. Añádelos con tu enlace de amigo o tu QR: solo te encuentra quien lo tiene.',
    verAmigos: 'Ver tus amigos', anadir: 'Añadir amigos', quitar: 'Quitar «Van mis amigos»', free: 'Gratis',
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

  // Con `integrity`, el navegador comprueba que el archivo es exactamente
  // el esperado (supabase-js 2.117.2, servido desde klendar.app).
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
      return (window.supabase ? Promise.resolve() : carga('/assets/vendor/supabase-js-2.117.2.js',
          'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok'))
        .then(function () {
          // El mismo cliente que visita.js si ya lo ha creado (uno por página,
          // con las mismas opciones): sin leer nada de la dirección.
          var sb = window.klendarSb || (window.klendarSb = window.supabase.createClient(env.url, env.key,
            { auth: { flowType: 'pkce', detectSessionInUrl: false } }));
          return sb.auth.getSession().then(function (r) {
            if (!r.data || !r.data.session) return;
            if (ficha) social(sb);
            if (tarjetas.length) enTarjetas(sb);
            var uid = r.data.session.user && r.data.session.user.id;
            if (botonFav) yaLoTienes(sb, uid, botonFav, 'favorites', 'business_id', botonFav.getAttribute('data-fav'), '#/seguir/', T.favOn);
            if (botonPlan) yaLoTienes(sb, uid, botonPlan, 'saved_offers', 'offer_id', botonPlan.getAttribute('data-plan'), '#/guardar/', T.planOn);
            if (resenas.length) sinBloqueadas(sb, uid);
            if (barra) filtroAmigos(sb);
            if (equipoEl) comoEquipo(sb);
          });
        });
    })
    .catch(function () { /* sin red: la página, sin lo de amigos */ });

  // ── El equipo del negocio, en su propia ficha ───────────────────────────
  // Como la app: no guarda, no añade a favoritos ni denuncia lo suyo; lo
  // edita en el panel. Lo dice la base (`my_businesses`), no la página, que
  // va en caché: `[data-solo-publico]` se esconde y `[data-solo-equipo]` sale.
  function comoEquipo(sb) {
    var biz = equipoEl.getAttribute('data-equipo-biz');
    if (!UUID.test(biz || '')) return;
    sb.rpc('my_businesses', {}).then(function (res) {
      var mios = (res && res.data) || [];
      var yo = mios.filter(function (b) { return b && b.id === biz; })[0];
      if (!yo) return;
      // `data-solo-equipo="gestion"`: propietario o encargado (editan la
      // ficha); `="empleado"`: el resto del equipo; vacío: todos.
      var grupo = yo.role === 'owner' || yo.role === 'manager' ? 'gestion' : 'empleado';
      document.querySelectorAll('[data-solo-publico]').forEach(function (e) { e.hidden = true; });
      document.querySelectorAll('[data-solo-equipo]').forEach(function (e) {
        var para = e.getAttribute('data-solo-equipo');
        if (!para || para === grupo) e.hidden = false;
      });
      document.body.classList.add('es-equipo');
    }, function () { /* sin red: la ficha de siempre */ });
  }

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

  // ── Explorar y Descubre: «Van mis amigos» ───────────────────────────────
  // Un chip más en la barra de filtros. Encendido (`?amigos=1`), lo que pintó
  // el servidor se esconde y aquí se pinta lo que devuelve
  // `friends_plans_feed`: solo publicaciones vivas a las que va algún amigo,
  // con la privacidad de cada uno decidida en la base. Mismos filtros de la
  // dirección (tipo, cuándo, precio, descuento, abierto, orden, cerca de mí;
  // ciudad y búsqueda, aquí); +18 nunca, como el resto de la web pública.
  // En el mapa, el calendario y «Negocios» no sale.
  var GRUPO = '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>';

  function ventana(cuando) {
    var ahora = new Date();
    var dia = function (mas) { return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + mas); };
    switch (cuando) {
      case 'ahora': case 'now': return [ahora, new Date(ahora.getTime() + 2 * 3600e3)];
      case 'hoy': case 'today': return [ahora, dia(1)];
      case 'manana': case 'tomorrow': return [dia(1), dia(2)];
      case '10dias': case 'next10': return [ahora, dia(11)];
      default: return [null, null];
    }
  }

  function beneficio(o) {
    var d = o.discount || null;
    var loc = en ? 'en-GB' : 'es-ES';
    if (d && d.type === 'percent') return '−' + d.value + ' %';
    if (d && d.type === '2x1') return '2x1';
    if (d && d.type === 'free') return T.free;
    if (d && d.type === 'fixed' && typeof d.value === 'number') {
      return d.value.toLocaleString(loc, { style: 'currency', currency: d.currency || o.currency || 'EUR' });
    }
    if (o.price_cents === 0) return T.free;
    if (o.price_cents > 0) return (o.price_cents / 100).toLocaleString(loc, { style: 'currency', currency: o.currency || 'EUR' });
    return '';
  }

  function cuandoEs(o) {
    var loc = en ? 'en-GB' : 'es-ES';
    var largo = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    if (o.kind === 'future_event') return o.event_at ? new Date(o.event_at).toLocaleString(loc, largo) : '';
    if (!o.redeem_start_at) return '';
    var ini = new Date(o.redeem_start_at);
    var fin = o.redeem_end_at ? new Date(o.redeem_end_at) : null;
    var mismo = fin && fin.toDateString() === ini.toDateString();
    return ini.toLocaleString(loc, largo) + (fin ? ' – ' + fin.toLocaleString(loc, mismo
      ? { hour: '2-digit', minute: '2-digit' } : largo) : '');
  }

  function tarjetaDeAmigos(o) {
    var id = encodeURIComponent(o.id);
    var foto = (o.images || []).filter(function (u) { return /^https:\/\//.test(u) && !/\.(mp4|mov|webm)(\?|$)/i.test(u); })[0];
    var tag = beneficio(o);
    var lugar = o.venue_name ? (en ? 'at ' : 'en ') + o.venue_name : '';
    return '<a class="ocard" href="' + (en ? '/en' : '') + '/o/' + id + '" data-o="' + esc(o.id) + '">' +
      (foto ? '<img src="' + esc(foto) + '" alt="" loading="lazy" decoding="async">' : '<span class="ph">✦</span>') +
      '<span class="ocard-body"><b>' + esc(o.title) + '</b>' +
      '<span class="muted">' + esc(o.business_name || '') + (lugar ? ' · ' + esc(lugar) : '') + '</span>' +
      '<span class="ocard-meta">' + (tag ? '<span class="tag">' + esc(tag) + '</span>' : '') +
      '<span class="muted">' + esc(cuandoEs(o)) + '</span></span>' +
      '<span class="quien-va mini">' + quienVa(o.friends, o.friends_total) + '</span>' +
      '</span></a>';
  }

  function filtroAmigos(sb) {
    var q = new URLSearchParams(location.search);
    var de = function () { for (var i = 0; i < arguments.length; i++) { var v = q.get(arguments[i]); if (v) return v; } return ''; };
    var tipo = de('tipo', 'type');
    if (/^(mapa|map|calendario|calendar)$/.test(de('vista', 'view')) || /^(negocios|places)$/.test(tipo) ||
        /^(negocios|places)$/.test(de('ver', 'show'))) return;
    var on = q.get('amigos') === '1';

    // El chip: enciende o apaga (sin la página: vuelve a la primera).
    var otra = new URL(location.href);
    if (on) otra.searchParams.delete('amigos'); else otra.searchParams.set('amigos', '1');
    otra.searchParams.delete('p');
    var chip = document.createElement('a');
    chip.className = 'chip' + (on ? ' on' : '');
    chip.href = otra.pathname + otra.search;
    chip.setAttribute('data-amigos-chip', '');
    if (on) chip.setAttribute('aria-current', 'true');
    chip.innerHTML = GRUPO + '<span>' + esc(T.filtro) + '</span>';
    // En su sitio, como en la app: junto a «Estoy aquí» (antes de «Ordenar por»).
    var hueco = barra.querySelector('[data-amigos-hueco]');
    if (hueco) barra.insertBefore(chip, hueco); else barra.appendChild(chip);
    if (!on) return;

    // Que cambiar otro filtro no lo apague.
    barra.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href') || '';
      if (a === chip || h.charAt(0) === '#') return;
      try {
        var x = new URL(h, location.href);
        if (x.origin !== location.origin) return;
        x.searchParams.set('amigos', '1');
        a.setAttribute('href', x.pathname + x.search + x.hash);
      } catch (e) { /* un enlace raro: tal cual */ }
    });
    document.querySelectorAll('form[method="get"], form[method="GET"]').forEach(function (f) {
      if (f.querySelector('input[name="amigos"]')) return;
      var i = document.createElement('input');
      i.type = 'hidden'; i.name = 'amigos'; i.value = '1';
      f.appendChild(i);
    });

    // Lo que pintó el servidor (resumen, tarjetas, páginas, final) se
    // esconde; «Más formas de explorar» se queda. En Descubre (el feed, con la
    // barra encima de la foto) se esconde el feed entero y la lista va en su
    // sitio, con la página en su aspecto normal.
    var ocultos = [];
    var el = barra.nextElementSibling;
    var destino = barra.getAttribute('data-amigos-resultados');
    var feedDestino = destino ? document.querySelector(destino) : null;
    var caja = document.createElement('section');
    caja.className = 'amigos-resultados';
    caja.setAttribute('aria-live', 'polite');
    caja.innerHTML = '<p class="muted">' + esc(T.cargando) + '</p>';
    if (feedDestino) {
      ocultos.push(feedDestino);
      document.querySelectorAll('.feed-nav, .feed-fondo').forEach(function (x) { ocultos.push(x); });
      document.body.classList.remove('pagina-feed');
      document.body.classList.add('feed-amigos');
      feedDestino.parentNode.insertBefore(caja, feedDestino);
    } else {
      while (el && !el.matches('.mas-formas, script, footer')) {
        if (!el.matches('#cercaErr, .aviso-error, [data-cerca-aviso]')) ocultos.push(el);
        el = el.nextElementSibling;
      }
      barra.parentNode.insertBefore(caja, ocultos[0] || el || null);
    }
    ocultos.forEach(function (x) { x.hidden = true; });

    var precio = de('precio', 'price');
    var orden = de('orden', 'sort');
    // Con 3 decimales (unos 100 m), como la dirección: un enlace de antes con más se redondea.
    var lat = Math.round(parseFloat(q.get('lat')) * 1000) / 1000;
    var lng = Math.round(parseFloat(q.get('lng')) * 1000) / 1000;
    var cerca = isFinite(lat) && isFinite(lng);
    var km = parseInt(q.get('km'), 10);
    var v = ventana(de('cuando', 'when'));
    var params = {
      p_kind: /^(ofertas|offers)$/.test(tipo) ? 'flash_offer' : /^(eventos|events)$/.test(tipo) ? 'future_event' : null,
      p_max_price_cents: /^(gratis|free)$/.test(precio) ? 0 : /^\d{1,3}$/.test(precio) ? Number(precio) * 100 : null,
      p_discount_only: de('descuento', 'discount') === '1',
      p_open_now: de('abierto', 'open') === '1',
      p_hide_adults: true,
      p_sort: /^(nuevas|newest)$/.test(orden) ? 'newest' : /^(cerca|nearest)$/.test(orden) || (cerca && !orden) ? 'nearest' : 'soonest',
      p_from: v[0] ? v[0].toISOString() : null,
      p_until: v[1] ? v[1].toISOString() : null,
    };
    if (cerca) {
      params.p_lat = lat; params.p_lng = lng;
      params.p_radius_m = ([1, 3, 5, 10, 25].indexOf(km) >= 0 ? km : 10) * 1000;
    }
    var ciudad = de('ciudad', 'city').toLowerCase();
    var busca = de('q').toLowerCase();
    var sinTildes = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };

    Promise.all([
      sb.rpc('friends_plans_feed', params),
      sb.rpc('my_friends').then(function (r) { return r.data; }, function () { return null; }),
    ]).then(function (r) {
      if (r[0].error) throw r[0].error;
      var filas = (r[0].data || []).filter(function (o) {
        if (ciudad && String(o.city || '').toLowerCase() !== ciudad) return false;
        if (busca && sinTildes(o.title + ' ' + (o.business_name || '')).indexOf(sinTildes(busca)) < 0) return false;
        return true;
      });
      var amigos = r[1] && r[1].friends ? r[1].friends.length : -1;
      if (filas.length) {
        caja.innerHTML = '<div class="resumen"><h2 class="resumen-n">' + esc(T.total(filas.length)) + '</h2></div>' +
          '<div class="olist">' + filas.map(tarjetaDeAmigos).join('') + '</div>';
        return;
      }
      var sinAmigos = amigos === 0;
      caja.innerHTML = '<section class="vacio"><h2>' + esc(sinAmigos ? T.sinT : T.vacioT) + '</h2>' +
        '<p>' + esc(sinAmigos ? T.sinB : T.vacioB) + '</p><div class="vacio-botones">' +
        '<a class="pill accent" href="' + esc(cuenta + '#/amigos') + '">' + esc(sinAmigos ? T.anadir : T.verAmigos) + '</a>' +
        '<a class="pill" href="' + esc(otra.pathname + otra.search) + '">' + esc(T.quitar) + '</a></div></section>';
    }).catch(function () {
      // Sin red o algo raro: se vuelve a enseñar lo de siempre.
      caja.remove();
      ocultos.forEach(function (x) { x.hidden = false; });
      if (feedDestino) { document.body.classList.add('pagina-feed'); document.body.classList.remove('feed-amigos'); }
      toast(T.oops, true);
    });
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
            // Las tarjetas de publicación (functions/_lib/tarjeta.js) traen su hueco.
            var cuerpo = card.querySelector('.tj-amigos') || card.querySelector('.ocard-body') || card;
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
    // 'codigo' | 'reservar' en lo que tiene código o reserva.
    var conCodigo = ficha.getAttribute('data-codigo');
    var voy = document.getElementById('voy');
    var nota = document.getElementById('voy-auto');
    var pista = document.getElementById('voy-pista');
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
        // Como botón principal, «Vas» va en tinta (lo seleccionado), no en
        // el color del botón principal.
        if (voy.classList.contains('big')) voy.classList.toggle('accent', !d.going);
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
      if (pista) pista.hidden = !!d.going;
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
      // Dijo «Voy» pero ya no va (anuló el código, quitó «Voy»): se vuelve a
      // preguntar.
      var yaNoVa = !d.going && invs.some(function (i) { return i.response === 'going'; });
      var botones = pendientes.length || cambiando || yaNoVa
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
      // Con código o reserva, «Voy» es conseguirlo: al tenerlo, la base
      // contesta la invitación y avisa a quien invitó.
      if (va && conCodigo) {
        location.href = cuenta + '#/' + conCodigo + '/' + id;
        return;
      }
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
