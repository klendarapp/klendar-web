/* «Klendar en la tele del local» (klendar.app/tv).
 *
 * Una página para el navegador de una tele, un Chromecast o un Fire TV: las
 * publicaciones activas del local a pantalla completa, con su diseño
 * (Clásica, Foto grande, Cartel, A todo color, Minimal: la especificación de
 * docs/DISENOS_PUBLICACION.md §8 en el repo de la app), la cuenta atrás de
 * las ofertas flash, un QR grande y, si el local lo usa, «¿Hay sitio
 * ahora?».
 *
 * Emparejar sin teclear nada en la tele: pide un código de 6 cifras
 * (`tv_pair_start`), lo enseña con un QR a klendar.app/tv/enlazar/<código>
 * y pregunta cada pocos segundos (`tv_pair_poll`) hasta que alguien del
 * local lo escribe en «Poner en la tele» (app o panel). Entonces recoge una
 * llave larga que guarda en este navegador y, con ella, pide lo que enseña
 * (`tv_feed`) cada minuto. Si la desvinculan, la llave deja de valer y la
 * tele vuelve a enseñar un código.
 *
 * Lo que guarda en el navegador (localStorage): la llave y lo último que
 * enseñó, para seguir si se va la red o se reinicia sin conexión. Nada de
 * nadie.
 *
 * Escrito para navegadores de tele algo viejos (Chromium 70 y parecidos):
 * sin `?.`, sin `??` y sin depender de otros scripts de la web; solo
 * /config.js (a qué base se llama) y el generador de QR.
 */
(function () {
  'use strict';

  var ENV = window.KLENDAR_ENV || {};
  var SITIO = 'https://klendar.app';
  var CLAVE = 'klendar.tv.llave';
  var ULTIMO = 'klendar.tv.ultimo';
  var CADA_FEED = 60 * 1000;
  var CADA_POLL = 4 * 1000;

  var consulta = new URLSearchParams(location.search);
  var EN = consulta.get('lang') ? consulta.get('lang') === 'en'
    : String((navigator.languages && navigator.languages[0]) || navigator.language || 'es').toLowerCase().indexOf('en') === 0;
  var LOC = EN ? 'en-GB' : 'es-ES';
  document.documentElement.lang = EN ? 'en' : 'es';

  var T = EN ? {
    titulo: 'Show your publications on this TV',
    paso1: 'On your phone, open Klendar: <b>My business → Show on TV</b>.',
    paso1b: 'Or on a computer: <b>klendar.app/panel</b> → Show on TV.',
    paso2: 'Type in this code or scan the QR code.',
    caduca: function (t) { return 'The code changes in ' + t; },
    pidiendo: 'Getting a code…',
    sinRed: 'No connection. We’ll try again in a few seconds.',
    lista: function (n) { return 'Done! This TV now shows ' + n + '.'; },
    flash: 'Flash offer', evento: 'Event', antes: 'Before closing',
    empieza: function (h) { return 'Starts at ' + h; },
    empiezaDia: function (d, h) { return 'Starts ' + d + ' at ' + h; },
    empiezaEn: function (m) { return 'Starts in ' + m + ' min'; },
    termina: function (h) { return 'Until ' + h; },
    terminaManana: function (h) { return 'Until tomorrow at ' + h; },
    terminaDia: function (d, h) { return 'Until ' + d + ' at ' + h; },
    quedan: function (t) { return t + ' left'; },
    ahora: 'Happening now', hoy: 'Today', manana: 'Tomorrow',
    plazas: function (n) { return n === 1 ? '1 place left' : n + ' places left'; },
    bolsas: function (n) { return n === 1 ? '1 bag left' : n + ' bags left'; },
    agotado: 'Sold out', organiza: function (x) { return 'at ' + x; },
    qrFlash: 'Get the code here', qrEvento: 'See it on Klendar',
    qrFav: 'Add us to your favourites', qrFavSub: 'and find out about the next one',
    vacio: 'Nothing on right now', vacioSub: 'Add us to your favourites on Klendar to find out about the next one.',
    sitio: 'Room right now?', crowd: { quiet: 'Quiet', lively: 'Lively', full: 'Full' },
    offline: 'No connection · showing the latest we had',
    pantalla: 'Press OK or click to go full screen',
    gratis: 'Free',
  } : {
    titulo: 'Pon tus publicaciones en esta tele',
    paso1: 'En el móvil, abre Klendar: <b>Mi negocio → Poner en la tele</b>.',
    paso1b: 'O en el ordenador: <b>klendar.app/panel</b> → Poner en la tele.',
    paso2: 'Escribe este código o escanea el QR.',
    caduca: function (t) { return 'El código cambia en ' + t; },
    pidiendo: 'Pidiendo un código…',
    sinRed: 'Sin conexión. Lo volvemos a intentar en unos segundos.',
    lista: function (n) { return '¡Lista! Esta tele ya enseña ' + n + '.'; },
    flash: 'Oferta flash', evento: 'Evento', antes: 'Antes de cerrar',
    empieza: function (h) { return 'Empieza a las ' + h; },
    empiezaDia: function (d, h) { return 'Empieza el ' + d + ' a las ' + h; },
    empiezaEn: function (m) { return 'Empieza en ' + m + ' min'; },
    termina: function (h) { return 'Hasta las ' + h; },
    terminaManana: function (h) { return 'Hasta mañana a las ' + h; },
    terminaDia: function (d, h) { return 'Hasta el ' + d + ' a las ' + h; },
    quedan: function (t) { return 'Quedan ' + t; },
    ahora: 'Está pasando ahora', hoy: 'Hoy', manana: 'Mañana',
    plazas: function (n) { return n === 1 ? 'Queda 1 plaza' : 'Quedan ' + n + ' plazas'; },
    bolsas: function (n) { return n === 1 ? 'Queda 1 bolsa' : 'Quedan ' + n + ' bolsas'; },
    agotado: 'Agotado', organiza: function (x) { return 'en ' + x; },
    qrFlash: 'Consigue el código aquí', qrEvento: 'Míralo en Klendar',
    qrFav: 'Añádenos a favoritos', qrFavSub: 'y entérate de lo próximo',
    vacio: 'Ahora mismo no hay nada', vacioSub: 'Añádenos a favoritos en Klendar para enterarte de lo próximo.',
    sitio: '¿Hay sitio ahora?', crowd: { quiet: 'Tranquilo', lively: 'Animado', full: 'Lleno' },
    offline: 'Sin conexión · enseñando lo último que teníamos',
    pantalla: 'Pulsa OK o haz clic para verla a pantalla completa',
    gratis: 'Gratis',
  };

  var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var cambia = function (e) { reducido = e.matches; document.body.classList.toggle('quieto', reducido); };
    if (mq.addEventListener) mq.addEventListener('change', cambia); else if (mq.addListener) mq.addListener(cambia);
  }

  // ── Utilidades ────────────────────────────────────────────────────────────
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lee(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guarda(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento: sigue en memoria */ } }

  // La hora del servidor manda (la de la tele puede ir mal).
  var desfase = 0;
  function ahora() { return Date.now() + desfase; }

  function rpc(fn, cuerpo) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    return fetch(ENV.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: ENV.key, Authorization: 'Bearer ' + ENV.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo || {}),
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }, function (e) { clearTimeout(t); throw e; });
  }

  function qr(texto) {
    if (typeof window.qrcode !== 'function') return '';
    var q = window.qrcode(0, 'M');
    q.addData(texto);
    q.make();
    return q.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
  }

  function fmt(iso, tz, opciones) {
    var o = {};
    for (var k in opciones) o[k] = opciones[k];
    try { return new Intl.DateTimeFormat(LOC, Object.assign(o, { timeZone: tz || 'Europe/Madrid' })).format(new Date(iso)); } catch (e) {
      return new Intl.DateTimeFormat(LOC, opciones).format(new Date(iso));
    }
  }
  function hora(iso, tz) { return fmt(iso, tz, { hour: '2-digit', minute: '2-digit' }); }
  function dia(iso, tz) { return fmt(iso, tz, { weekday: 'short', day: 'numeric', month: 'short' }); }
  function mismoDia(a, b, tz) { return fmt(a, tz, { year: 'numeric', month: 'numeric', day: 'numeric' }) === fmt(b, tz, { year: 'numeric', month: 'numeric', day: 'numeric' }); }

  // ── Precio y color (lo mismo que assets/tarjeta.js) ──────────────────────
  function dinero(c, moneda) {
    return (c / 100).toLocaleString(EN ? 'en-IE' : 'es-ES', { style: 'currency', currency: moneda || 'EUR' });
  }
  function beneficio(d, precio, moneda) {
    if (d) {
      if (d.type === 'percent') return '−' + d.value + ' %';
      if (d.type === 'fixed') return dinero(Math.round(Number(d.value) * 100), d.currency || moneda);
      if (d.type === '2x1') return '2x1';
      if (d.type === 'free') return T.gratis;
      if (d.type === 'other' && d.value) return String(d.value);
    }
    return precio == null ? '' : dinero(precio, moneda);
  }
  function antes(d) { return d && d.compare_at_cents ? dinero(d.compare_at_cents, d.currency || 'EUR') : ''; }

  var PLANTILLAS = ['glass', 'photo', 'poster', 'bold', 'minimal'];
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lin(c) { var v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
  var LUM_TINTA = lum([10, 10, 10]);
  function contrastes(c) { var l = lum(c); return [(l + 0.05) / (LUM_TINTA + 0.05), 1.05 / (l + 0.05)]; }
  function colorSeguro(hex) {
    var t = String(hex || '').trim();
    if (!/^#?[0-9a-f]{6}$/i.test(t)) return null;
    var h = (t.charAt(0) === '#' ? t : '#' + t).toUpperCase();
    var c = rgb(h);
    var pasa = function (x) { var k = contrastes(x); return Math.max(k[0], k[1]) >= 4.5; };
    if (pasa(c)) return h;
    var k = contrastes(c);
    var destino = k[0] >= k[1] ? 255 : 0;
    for (var i = 1; i <= 25; i++) {
      var m = c.map(function (x) { return Math.round((x * (25 - i) + destino * i) / 25); });
      if (pasa(m)) return '#' + m.map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').toUpperCase();
    }
    return h;
  }
  function sobre(hex) { var k = contrastes(rgb(hex)); return k[0] >= k[1] ? '#0A0A0A' : '#FFFFFF'; }
  function estilo(o) {
    var s = o && o.style && typeof o.style === 'object' ? o.style : {};
    return { plantilla: PLANTILLAS.indexOf(s.template) >= 0 ? s.template : 'glass', acento: colorSeguro(s.accent) || '#FF4D6D' };
  }
  function esVideo(u) { return /\.(mp4|mov|webm)(\?|$)/i.test(u || ''); }

  // ── Escala: todo se mide en «u» (1 u = 1 px a 1920 × 1080) ───────────────
  function escala() {
    var u = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.documentElement.style.setProperty('--u', u + 'px');
  }
  window.addEventListener('resize', escala);
  escala();
  document.body.classList.toggle('quieto', reducido);

  // ── Pantalla encendida, cursor fuera, pantalla completa, mando ───────────
  var bloqueo = null;
  function sinApagar() {
    if (!navigator.wakeLock || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(function (b) { bloqueo = b; }, function () { /* no lo deja: nada */ });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { sinApagar(); actualiza(); }
  });
  var cursor = null;
  document.addEventListener('mousemove', function () {
    document.body.classList.remove('sin-cursor');
    clearTimeout(cursor);
    cursor = setTimeout(function () { document.body.classList.add('sin-cursor'); }, 3000);
  });
  function completa() {
    var el = document.documentElement;
    var pide = el.requestFullscreen || el.webkitRequestFullscreen;
    if (pide && !(document.fullscreenElement || document.webkitFullscreenElement)) {
      try { var p = pide.call(el); if (p && p.catch) p.catch(function () {}); } catch (e) { /* nada */ }
    }
    var aviso = $('#completa');
    if (aviso) aviso.hidden = true;
  }
  document.addEventListener('click', completa);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { siguiente(true); return; }
    if (e.key === 'ArrowLeft') { siguiente(true, -1); return; }
    if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13) completa();
  });
  window.addEventListener('online', function () { actualiza(); });

  // Contra las marcas en las pantallas OLED: lo fijo (logo, hora, QR) se
  // mueve unos píxeles cada pocos minutos, sin que se note.
  setInterval(function () {
    var x = Math.round(Math.random() * 12 - 6);
    var y = Math.round(Math.random() * 8 - 4);
    document.documentElement.style.setProperty('--dx', x + 'px');
    document.documentElement.style.setProperty('--dy', y + 'px');
  }, 3 * 60 * 1000);

  // Una vez al día (de madrugada) se recarga, para coger la última versión.
  var cargada = Date.now();
  setInterval(function () {
    var h = new Date().getHours();
    if (Date.now() - cargada > 12 * 3600 * 1000 && h === 5 && navigator.onLine !== false) location.reload();
  }, 10 * 60 * 1000);

  // ── Emparejar ─────────────────────────────────────────────────────────────
  var poll = null;
  var cuentaCodigo = null;
  function emparejar() {
    clearInterval(poll); clearInterval(cuentaCodigo); clearInterval(relojFeed);
    paraPase();
    estado = 'emparejar';
    var raiz = $('#tv');
    raiz.className = 'tv-emparejar';
    raiz.innerHTML = '<div class="em">'
      + '<div class="em-txt">'
      + '<p class="marca"><img src="/assets/symbol.png" alt="" width="64" height="64"> Klendar</p>'
      + '<h1>' + esc(T.titulo) + '</h1>'
      + '<ol class="em-pasos"><li><span class="n">1</span><span>' + T.paso1 + '<small>' + T.paso1b + '</small></span></li>'
      + '<li><span class="n">2</span><span>' + esc(T.paso2) + '</span></li></ol>'
      + '<p class="em-codigo texto" id="codigo" aria-live="polite">' + esc(T.pidiendo) + '</p>'
      + '<p class="em-caduca" id="caduca"></p>'
      + '</div>'
      + '<div class="em-qr" id="emQr" aria-hidden="true"></div>'
      + '</div>';
    pideCodigo(0);
  }

  function pideCodigo(intento) {
    rpc('tv_pair_start', {}).then(function (r) {
      if (!r || !r.ok) throw new Error((r && r.error) || 'error');
      var cod = String(r.code);
      $('#codigo').classList.remove('texto');
      $('#codigo').innerHTML = '<span>' + esc(cod.slice(0, 3)) + '</span><span>' + esc(cod.slice(3)) + '</span>';
      $('#codigo').setAttribute('aria-label', cod.split('').join(' '));
      $('#emQr').innerHTML = qr(SITIO + '/tv/enlazar/' + cod);
      var fin = Date.parse(r.expires_at);
      var pinta = function () {
        var s = Math.max(0, Math.round((fin - Date.now()) / 1000));
        $('#caduca').textContent = T.caduca(Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2));
        if (s <= 0) { clearInterval(cuentaCodigo); clearInterval(poll); pideCodigo(0); }
      };
      clearInterval(cuentaCodigo);
      cuentaCodigo = setInterval(pinta, 1000);
      pinta();
      clearInterval(poll);
      poll = setInterval(function () {
        rpc('tv_pair_poll', { p_code: cod, p_secret: r.secret }).then(function (p) {
          if (p && p.ok && p.status === 'paired' && p.token) {
            clearInterval(poll); clearInterval(cuentaCodigo);
            guarda(CLAVE, p.token);
            guarda(ULTIMO, null);
            $('#codigo').classList.add('ok', 'texto');
            $('#codigo').textContent = T.lista(p.business_name || 'Klendar');
            $('#caduca').textContent = '';
            setTimeout(conLlave, 2500);
          } else if (p && !p.ok && p.error === 'expired') {
            clearInterval(poll); clearInterval(cuentaCodigo);
            pideCodigo(0);
          }
        }, function () { /* sin red un momento: sigue preguntando */ });
      }, CADA_POLL);
    }).catch(function () {
      $('#codigo').classList.add('texto');
      $('#codigo').textContent = T.sinRed;
      $('#emQr').innerHTML = '';
      setTimeout(function () { if (estado === 'emparejar') pideCodigo(intento + 1); }, Math.min(60, 5 * (intento + 1)) * 1000);
    });
  }

  // ── Con llave: lo que enseña ─────────────────────────────────────────────
  var estado = 'inicio';
  var FEED = null;
  var relojFeed = null;
  function conLlave() {
    clearInterval(poll); clearInterval(cuentaCodigo);
    estado = 'feed';
    var raiz = $('#tv');
    raiz.className = 'tv-feed';
    raiz.innerHTML = '<div class="escena" id="escena"></div>'
      + '<header class="arriba fijo"><div class="local" id="local"></div><div class="dcha"><div class="sitio" id="sitio" hidden></div><p class="reloj" id="reloj"></p></div></header>'
      + '<div class="qr fijo" id="qr" aria-hidden="true"></div>'
      + '<div class="progreso" id="progreso" aria-hidden="true"></div>'
      + '<p class="red" id="red" role="status" hidden>' + esc(T.offline) + '</p>'
      + '<p class="completa" id="completa" hidden>' + esc(T.pantalla) + '</p>';
    var aviso = $('#completa');
    var el = document.documentElement;
    if ((el.requestFullscreen || el.webkitRequestFullscreen) && !(document.fullscreenElement || document.webkitFullscreenElement)) {
      aviso.hidden = false;
      setTimeout(function () { aviso.hidden = true; }, 10000);
    }
    var ultimo = null;
    try { ultimo = JSON.parse(lee(ULTIMO) || 'null'); } catch (e) { ultimo = null; }
    if (ultimo && ultimo.ok) aplica(ultimo);
    actualiza();
    clearInterval(relojFeed);
    relojFeed = setInterval(actualiza, CADA_FEED);
  }

  var pidiendo = false;
  function actualiza() {
    if (estado !== 'feed' || pidiendo) return;
    var llave = lee(CLAVE) || llaveEnMemoria;
    if (!llave) { emparejar(); return; }
    pidiendo = true;
    rpc('tv_feed', { p_token: llave }).then(function (r) {
      pidiendo = false;
      if (r && !r.ok && r.error === 'unlinked') {
        guarda(CLAVE, null); guarda(ULTIMO, null); llaveEnMemoria = null;
        emparejar();
        return;
      }
      if (!r || !r.ok) { red(false); return; }
      desfase = Date.parse(r.now) - Date.now();
      if (!isFinite(desfase)) desfase = 0;
      guarda(ULTIMO, JSON.stringify(r));
      red(true);
      aplica(r);
    }, function () { pidiendo = false; red(false); });
  }
  var llaveEnMemoria = null;

  function red(bien) { var r = $('#red'); if (r) r.hidden = bien; }

  // Lo que queda por enseñar: lo vivo (sin lo que ya ha caducado aunque la
  // base aún no lo sepa porque no hay red) y, al final de cada vuelta, la
  // del local con «Añádenos a favoritos».
  function vivas() {
    if (!FEED) return [];
    var t = ahora();
    return (FEED.offers || []).filter(function (o) { return !o.ends_at || Date.parse(o.ends_at) > t; });
  }
  function diapositivas() {
    var lista = vivas().map(function (o) { return { tipo: 'oferta', id: 'o:' + o.id, o: o }; });
    if (lista.length && FEED.business && FEED.business.visible && FEED.business.slug) lista.push({ tipo: 'local', id: 'local' });
    return lista;
  }

  function aplica(feed) {
    FEED = feed;
    var b = feed.business || {};
    var tz = b.time_zone || 'Europe/Madrid';
    $('#local').innerHTML = (b.logo && /^https:\/\//.test(b.logo) ? '<img src="' + esc(b.logo) + '" alt="" width="72" height="72">' : '')
      + '<span>' + esc(b.name || '') + '</span>';
    var s = $('#sitio');
    if (feed.crowd && T.crowd[feed.crowd]) {
      s.hidden = false;
      s.className = 'sitio sitio-' + feed.crowd;
      s.innerHTML = '<small>' + esc(T.sitio) + '</small><b>' + esc(T.crowd[feed.crowd]) + '</b>';
    } else s.hidden = true;
    pintaReloj(tz);
    var lista = diapositivas();
    if (!lista.length) { vacio(); return; }
    LISTA = lista;
    if (!pasando) arrancaPase();
    else {
      // Sigue donde iba: si la de ahora sigue, la vuelta continúa desde ella.
      var i = -1;
      for (var k = 0; k < LISTA.length; k++) if (LISTA[k].id === actualId) i = k;
      indice = i >= 0 ? i : Math.min(indice, LISTA.length - 1);
      pintaProgreso();
    }
  }

  function pintaReloj(tz) { var r = $('#reloj'); if (r) r.textContent = hora(new Date(ahora()).toISOString(), tz); }

  // ── El pase ───────────────────────────────────────────────────────────────
  var LISTA = [];
  var indice = 0;
  var actualId = null;
  var pasando = false;
  var temporizador = null;
  var segundero = null;

  function paraPase() {
    pasando = false;
    clearTimeout(temporizador);
    clearInterval(segundero);
  }

  function arrancaPase() {
    paraPase();
    pasando = true;
    indice = 0;
    muestra(LISTA[0], true);
    programa();
    segundero = setInterval(tic, 1000);
  }

  function segundos() { return (FEED && FEED.screen && FEED.screen.seconds) || 12; }
  function programa() {
    clearTimeout(temporizador);
    temporizador = setTimeout(function () { siguiente(false); }, segundos() * 1000);
  }

  function siguiente(aMano, paso) {
    if (!pasando) return;
    var lista = diapositivas();
    if (!lista.length) { vacio(); return; }
    LISTA = lista;
    var i = -1;
    for (var k = 0; k < LISTA.length; k++) if (LISTA[k].id === actualId) i = k;
    indice = ((i < 0 ? indice - 1 : i) + (paso || 1) + LISTA.length) % LISTA.length;
    // Con una sola no hay pase: se queda (y se refrescan sus datos).
    if (LISTA.length === 1 && LISTA[0].id === actualId && !aMano) { programa(); refresca(); return; }
    muestra(LISTA[indice], false);
    programa();
  }

  function tic() {
    if (!FEED) return;
    var tz = (FEED.business && FEED.business.time_zone) || 'Europe/Madrid';
    pintaReloj(tz);
    // Lo que ha caducado sale de la vuelta en cuanto caduca (sin esperar a
    // la base, por si no hay red).
    var quedan = diapositivas();
    if (quedan.length !== LISTA.length) {
      if (!quedan.length) { vacio(); return; }
      var sigue = quedan.some(function (x) { return x.id === actualId; });
      LISTA = quedan;
      if (!sigue) { siguiente(true); return; }
      pintaProgreso();
    }
    // La de ahora ha caducado: a la siguiente sin esperar.
    var actual = null;
    for (var k = 0; k < LISTA.length; k++) if (LISTA[k].id === actualId) actual = LISTA[k];
    if (actual && actual.tipo === 'oferta' && actual.o.ends_at && Date.parse(actual.o.ends_at) <= ahora()) {
      siguiente(true);
      return;
    }
    refresca();
  }

  // La cuenta atrás y lo que cambia cada segundo, sin repintar la diapositiva.
  function refresca() {
    var d = document.querySelector('.pase.visible [data-cuando]');
    if (!d) return;
    var act = null;
    for (var k = 0; k < LISTA.length; k++) if (LISTA[k].id === actualId) act = LISTA[k];
    if (act && act.tipo === 'oferta') {
      var c = cuando(act.o);
      d.textContent = c.texto;
      d.classList.toggle('urgente', c.urgente);
    }
  }

  function cuando(o) {
    var tz = o.time_zone || 'Europe/Madrid';
    var t = ahora();
    if (o.kind === 'flash_offer') {
      var ini = Date.parse(o.redeem_start_at);
      var fin = Date.parse(o.redeem_end_at);
      if (t < ini) {
        var min = Math.ceil((ini - t) / 60000);
        if (min <= 60) return { texto: T.empiezaEn(min), urgente: false };
        return { texto: mismoDia(o.redeem_start_at, new Date(t).toISOString(), tz) ? T.empieza(hora(o.redeem_start_at, tz)) : T.empiezaDia(dia(o.redeem_start_at, tz), hora(o.redeem_start_at, tz)), urgente: false };
      }
      var s = Math.max(0, Math.floor((fin - t) / 1000));
      if (s < 3600) return { texto: T.quedan(Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2)), urgente: true };
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      // Si acaba otro día, se dice cuál («Hasta las 20:44» con 23 h por delante
      // parecía hoy).
      var hf = hora(o.redeem_end_at, tz);
      var hasta = mismoDia(o.redeem_end_at, new Date(t).toISOString(), tz) ? T.termina(hf)
        : mismoDia(o.redeem_end_at, new Date(t + 86400000).toISOString(), tz) ? T.terminaManana(hf)
          : T.terminaDia(dia(o.redeem_end_at, tz), hf);
      return { texto: hasta + ' · ' + T.quedan(h + ' h' + (m ? ' ' + m + ' min' : '')), urgente: false };
    }
    var ev = o.event_at;
    if (Date.parse(ev) <= t) return { texto: T.ahora, urgente: true };
    var hoy = new Date(t).toISOString();
    var manana = new Date(t + 86400000).toISOString();
    var d = mismoDia(ev, hoy, tz) ? T.hoy : mismoDia(ev, manana, tz) ? T.manana : dia(ev, tz);
    return { texto: d + ' · ' + hora(ev, tz), urgente: false };
  }

  function media(o, primera) {
    var piezas = (o.images || []).filter(function (u) { return typeof u === 'string' && /^https:\/\//.test(u); });
    var foto = null;
    for (var i = 0; i < piezas.length; i++) if (!esVideo(piezas[i])) { foto = piezas[i]; break; }
    if (!foto && o.business_cover && /^https:\/\//.test(o.business_cover)) foto = o.business_cover;
    var video = piezas[0] && esVideo(piezas[0]) ? piezas[0] : null;
    if (video) {
      return '<video class="m" muted loop playsinline autoplay preload="auto"' + (foto ? ' poster="' + esc(foto) + '"' : '') + ' src="' + esc(video) + '"></video>';
    }
    if (foto) return '<img class="m" src="' + esc(foto) + '" alt="" decoding="async"' + (primera ? ' fetchpriority="high"' : '') + '>';
    return '<div class="m sin-foto"></div>';
  }

  function diapositiva(d) {
    if (d.tipo === 'local') {
      var b = FEED.business || {};
      return '<section class="pase pase-local">'
        + '<div class="fondo">' + (b.cover && /^https:\/\//.test(b.cover) ? '<img class="m" src="' + esc(b.cover) + '" alt="">' : '<div class="m sin-foto"></div>') + '</div>'
        + '<div class="velo"></div>'
        + '<div class="centro">' + (b.logo && /^https:\/\//.test(b.logo) ? '<img class="logo" src="' + esc(b.logo) + '" alt="">' : '')
        + '<h2>' + esc(b.name) + '</h2><p>' + esc(T.vacioSub) + '</p></div>'
        + '</section>';
    }
    var o = d.o;
    var e = estilo(o);
    var flash = o.kind === 'flash_offer';
    var antesCierre = flash && o.style && o.style.badge === 'before_closing';
    var precio = beneficio(o.discount, o.price_cents, o.currency);
    var tachado = antes(o.discount);
    var c = cuando(o);
    var agotado = o.status === 'sold_out' || (o.seats_left != null && Number(o.seats_left) <= 0);
    var plazas = agotado ? T.agotado
      : o.seats_left != null && Number(o.seats_left) <= 20 ? (antesCierre ? T.bolsas(Number(o.seats_left)) : T.plazas(Number(o.seats_left))) : '';
    var lugar = o.venue_address ? (String(o.venue_name || '').trim() || String(o.venue_address).split(',')[0].trim()) : '';
    var tipo = antesCierre ? T.antes : flash ? T.flash : T.evento;
    var kicker = e.plantilla === 'poster'
      ? '<p class="kicker">' + esc((flash ? c.texto : dia(o.event_at, o.time_zone).replace(/[.,]/g, '') + ' · ' + hora(o.event_at, o.time_zone)).toUpperCase()) + '</p>' : '';
    var conDesc = (e.plantilla === 'glass' || e.plantilla === 'minimal' || e.plantilla === 'bold') && o.description;
    return '<section class="pase p-' + e.plantilla + '" style="--acento:' + e.acento + ';--sobre:' + sobre(e.acento) + '">'
      + '<div class="fondo">' + media(o, true) + '</div>'
      + '<div class="velo"></div>'
      + '<div class="panel">'
      + '<p class="tipo"><span>' + esc(tipo) + '</span></p>'
      + kicker
      + '<h2 class="titulo">' + esc(o.title) + '</h2>'
      + (lugar ? '<p class="lugar">' + esc(T.organiza(lugar)) + '</p>' : '')
      + (conDesc ? '<p class="desc">' + esc(o.description) + '</p>' : '')
      + '<p class="datos">'
      + (precio ? '<span class="precio">' + esc(precio) + '</span>' : '')
      + (tachado ? '<s class="antes">' + esc(tachado) + '</s>' : '')
      + (e.plantilla === 'poster' && !flash ? '' : '<span class="chip cuando' + (c.urgente ? ' urgente' : '') + '" data-cuando>' + esc(c.texto) + '</span>')
      + (plazas ? '<span class="chip">' + esc(plazas) + '</span>' : '')
      + '</p>'
      + '</div>'
      + '</section>';
  }

  function pintaQr(d) {
    var b = FEED.business || {};
    var url;
    var texto;
    var sub = '';
    if (d.tipo === 'oferta') {
      url = SITIO + '/o/' + encodeURIComponent(d.o.id) + '?ref=tv';
      texto = d.o.kind === 'flash_offer' ? T.qrFlash : T.qrEvento;
    } else {
      url = SITIO + '/b/' + encodeURIComponent(b.slug || b.id) + '?ref=tv';
      texto = T.qrFav;
      sub = T.qrFavSub;
    }
    var q = $('#qr');
    if (q.dataset.url === url) return;
    q.dataset.url = url;
    q.innerHTML = '<div class="qr-caja">' + qr(url) + '</div><p><b>' + esc(texto) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</p>';
  }

  function pintaProgreso() {
    var p = $('#progreso');
    if (!p) return;
    if (LISTA.length < 2) { p.innerHTML = ''; return; }
    var html = '';
    for (var k = 0; k < LISTA.length; k++) {
      var on = LISTA[k].id === actualId;
      html += '<i class="' + (on ? 'on' : '') + '"' + (on ? ' style="--dur:' + segundos() + 's"' : '') + '><b></b></i>';
    }
    p.innerHTML = html;
  }

  function muestra(d, primera) {
    var escena = $('#escena');
    if (!escena || !d) return;
    actualId = d.id;
    // En la del local, su nombre ya va en grande: arriba sobra.
    $('#tv').classList.toggle('en-local', d.tipo === 'local');
    var tmp = document.createElement('div');
    tmp.innerHTML = diapositiva(d);
    var nueva = tmp.firstChild;
    nueva.style.setProperty('--dur', (segundos() + 2) + 's');
    if (Math.random() < 0.5) nueva.classList.add('al-reves');
    escena.appendChild(nueva);
    var viejas = [].slice.call(escena.querySelectorAll('.pase')).filter(function (x) { return x !== nueva; });
    var hecho = false;
    var entra = function () {
      if (hecho) return;
      hecho = true;
      // Dos fotogramas: el navegador pinta la nueva transparente y luego la funde.
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        nueva.classList.add('visible');
        var v = nueva.querySelector('video');
        if (v && v.play) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        viejas.forEach(function (x) {
          x.classList.remove('visible');
          x.classList.add('sale');
          var vv = x.querySelector('video');
          setTimeout(function () { if (vv) { vv.pause(); vv.removeAttribute('src'); vv.load(); } if (x.parentNode) x.parentNode.removeChild(x); }, reducido ? 500 : 1600);
        });
      }); });
    };
    // Espera a la foto (como mucho 2,5 s): mejor un momento más la anterior
    // que fundir a negro.
    var img = nueva.querySelector('img.m');
    if (img && !img.complete && !primera) {
      img.addEventListener('load', entra);
      img.addEventListener('error', entra);
      setTimeout(entra, 2500);
    } else entra();
    pintaQr(d);
    pintaProgreso();
  }

  function vacio() {
    paraPase();
    actualId = null;
    LISTA = [];
    $('#tv').classList.add('en-local');
    var escena = $('#escena');
    if (!escena) return;
    var b = (FEED && FEED.business) || {};
    var conQr = b.visible && b.slug;
    escena.innerHTML = '<section class="pase pase-local vacio visible">'
      + '<div class="fondo">' + (b.cover && /^https:\/\//.test(b.cover) ? '<img class="m" src="' + esc(b.cover) + '" alt="">' : '<div class="m sin-foto"></div>') + '</div>'
      + '<div class="velo"></div>'
      + '<div class="centro">' + (b.logo && /^https:\/\//.test(b.logo) ? '<img class="logo" src="' + esc(b.logo) + '" alt="">' : '')
      + '<h2>' + esc(b.name || '') + '</h2>'
      + (conQr ? '<p>' + esc(T.vacioSub) + '</p>' : '')
      + '</div></section>';
    var q = $('#qr');
    if (conQr) pintaQr({ tipo: 'local' });
    else if (q) { q.innerHTML = ''; q.dataset.url = ''; }
    pintaProgreso();
    // Si llega algo (o vuelve a haber), `aplica` arranca el pase.
    clearInterval(segundero);
    segundero = setInterval(function () {
      if (!FEED) return;
      pintaReloj((FEED.business && FEED.business.time_zone) || 'Europe/Madrid');
    }, 1000);
  }

  // ── Arranque ──────────────────────────────────────────────────────────────
  if (!ENV.url || !ENV.key) { $('#tv').textContent = 'Klendar'; return; }
  sinApagar();
  // `?llave=` no existe a propósito: la llave nunca va en la dirección.
  if (lee(CLAVE)) conLlave(); else emparejar();

  // Para las pruebas automáticas: estado sin tocar nada.
  window.KlendarTele = {
    estado: function () { return { estado: estado, actual: actualId, n: LISTA.length, offline: !!($('#red') && !$('#red').hidden) }; },
  };
})();
