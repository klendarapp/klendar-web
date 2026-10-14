/* «Avísame cuando Klendar llegue» en Descubre y Explorar (crecer,
 * 2026-10-14; migración 20261218100000_crecer de la app).
 *
 * La página (functions/_lib/explore.js, `sinKlendarHtml`) sale así cuando,
 * con «Cerca de ti», no hay nada y `klendar_coverage` dice que aquí aún no
 * hay Klendar. Aquí:
 *  - La zona: si la página no la sabe (no hay ciudad de Klendar cerca), se
 *    pregunta a Mapbox el nombre de la localidad (geocodificación inversa,
 *    `types=place`) con el punto redondeado a 2 decimales (~1 km). Sin token
 *    o sin red, se queda «aquí» y la base pone la zona.
 *  - «Avísame cuando llegue»: con una sesión de «Tu cuenta» en este
 *    navegador, `join_city_waitlist` con la cuenta (sin correo de
 *    confirmación: ya es tuya). Sin sesión, un formulario de correo con su
 *    nota de privacidad y «Entrar»; la base manda un correo para confirmarlo
 *    (doble confirmación) y responde siempre «mira tu correo», sin decir si
 *    ese correo ya estaba.
 *  - «Elegir una ciudad»: abre el «dónde» de la barra de filtros.
 * Sin JavaScript, el botón lleva a «Tu cuenta» (`#/avisame`), que lo hace al
 * entrar. Los textos llegan de la página (`#avisame-textos`).
 */
(function () {
  'use strict';
  var yo = document.currentScript;
  var caja = document.querySelector('[data-avisame]');
  var datos = document.getElementById('avisame-textos');
  if (!caja || !datos || !yo) return;
  var T;
  try { T = JSON.parse(datos.textContent || '{}'); } catch (x) { return; }
  var en = yo.getAttribute('data-lang') === 'en';
  var URL_SB = yo.getAttribute('data-url');
  var KEY = yo.getAttribute('data-key');
  var ref = ((URL_SB || '').match(/^https:\/\/([a-z0-9]+)\./) || [])[1];
  var lat = Number(caja.getAttribute('data-lat'));
  var lng = Number(caja.getAttribute('data-lng'));
  if (!isFinite(lat) || !isFinite(lng)) return;
  var zona = caja.getAttribute('data-zona') || '';
  var titulo = caja.querySelector('[data-avisame-titulo]');
  var texto = caja.querySelector('[data-avisame-texto]');
  var botones = caja.querySelector('[data-avisame-botones]');
  var hueco = caja.querySelector('[data-avisame-caja]');
  var si = caja.querySelector('[data-avisame-si]');
  var CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
  var app = en ? '/app/?lang=en' : '/app/';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** La ruta de «Tu cuenta» que hace lo mismo (sin JavaScript, o al entrar). */
  function rutaCuenta() {
    var q = new URLSearchParams({ lat: lat.toFixed(3), lng: lng.toFixed(3) });
    if (zona) q.set('zona', zona);
    return 'avisame?' + q.toString();
  }
  function ponEnlaces() {
    if (si) si.setAttribute('href', app + '#/' + rutaCuenta());
  }

  // ── La zona, con Mapbox ──
  if (!zona) {
    fetch('/api/mapbox-token').then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) {
      if (!j || !j.token) return null;
      var p = (Math.round(lng * 100) / 100) + ',' + (Math.round(lat * 100) / 100);
      return fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/' + p + '.json?types=place&limit=1&language='
        + (en ? 'en' : 'es') + '&access_token=' + encodeURIComponent(j.token));
    }).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (d) {
      var f = d && d.features && d.features[0];
      var nombre = f && String(f.text || '').trim();
      if (!nombre || nombre.length > 80 || zona) return;
      zona = nombre;
      if (titulo && !hueco.querySelector('[data-hecho]')) titulo.textContent = T.notHereIn.replace('{zona}', zona);
      ponEnlaces();
    }).catch(function () { /* sin mapa: «aquí» */ });
  }

  // ── «Elegir una ciudad»: el «dónde» de la barra ──
  var elige = caja.querySelector('[data-elige-ciudad]');
  var donde = document.querySelector('details.desplegable.zona');
  if (elige && donde) {
    elige.addEventListener('click', function (e) {
      e.preventDefault();
      // Después de este clic: /assets/tarjetas.js cierra los desplegables al
      // pulsar fuera de ellos (y este botón está fuera).
      setTimeout(function () {
        donde.open = true;
        donde.scrollIntoView({ block: 'center', behavior: 'smooth' });
        var primera = donde.querySelector('.menu-d a.op, .menu-d button.op:not([hidden])');
        if (primera) setTimeout(function () { primera.focus({ preventScroll: true }); }, 250);
      }, 0);
    });
  }

  // ── Sesión de «Tu cuenta» en este navegador ──
  function sesionGuardada() {
    if (!ref) return false;
    try {
      var s = JSON.parse(localStorage.getItem('sb-' + ref + '-auth-token') || 'null');
      return !!(s && (s.refresh_token || s.access_token));
    } catch (x) { return false; }
  }
  function carga(src, integrity) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }
  function cliente() {
    return (window.supabase ? Promise.resolve() : carga('/assets/vendor/supabase-js-2.117.2.js',
      'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok'))
      .then(function () {
        return window.klendarSb || (window.klendarSb = window.supabase.createClient(URL_SB, KEY,
          { auth: { flowType: 'pkce', detectSessionInUrl: false } }));
      });
  }

  /** Lo que ha pasado, en el sitio de los botones (el título cambia). */
  function resultado(tituloTxt, cuerpo, botonesHtml) {
    titulo.textContent = tituloTxt;
    texto.textContent = cuerpo;
    botones.hidden = true;
    hueco.hidden = false;
    hueco.innerHTML = '<div class="vacio-botones" data-hecho>' + botonesHtml + '</div>';
    hueco.style.textAlign = 'center';
    titulo.focus();
  }
  function mensajeError(e) {
    var m = String((e && (e.message || e.error)) || e || '');
    if (/invalid_email/.test(m)) return T.badEmail;
    if (/too_many|rate/.test(m)) return T.tooMany;
    return T.oops;
  }
  function trasApuntarse(d) {
    var st = d && d.status;
    if (st === 'live') {
      resultado(T.liveTitle, T.liveBody, '<button type="button" class="pill accent" data-recarga>' + esc(T.reload) + '</button>');
      hueco.querySelector('[data-recarga]').addEventListener('click', function () { location.reload(); });
      return;
    }
    var z = (d && d.zone) || zona || '';
    resultado(T.okTitle.replace('{zona}', z), st === 'already' ? T.alreadyBody : T.okBody,
      '<a class="pill" href="' + esc(app + '#/pedidos') + '">' + esc(T.seeMine) + '</a>');
  }

  // ── Sin sesión: el correo ──
  function formulario() {
    var entrar = app + '#/entrar?siguiente=' + encodeURIComponent(rutaCuenta());
    botones.hidden = true;
    hueco.hidden = false;
    hueco.innerHTML = '<form class="avisame-form" novalidate>'
      + '<label>' + esc(T.email) + '<input type="email" name="correo" autocomplete="email" inputmode="email" maxlength="254" required spellcheck="false"></label>'
      + '<p class="avisame-nota">' + esc(T.note) + ' <a href="' + esc(T.privacyUrl) + '">' + esc(T.privacy) + '</a></p>'
      + '<p class="avisame-err" role="alert" hidden></p>'
      + '<div class="vacio-botones"><button type="submit" class="pill accent">' + esc(T.send) + '</button>'
      + '<a class="pill" href="' + esc(entrar) + '" data-entrar>' + esc(T.login) + '</a></div>'
      + '</form>';
    var f = hueco.querySelector('form');
    var campo = f.elements.correo;
    var err = f.querySelector('.avisame-err');
    var boton = f.querySelector('button[type=submit]');
    // Al volver de entrar, «Tu cuenta» lo hace sin preguntar otra vez (ver
    // `hayIntencion` en app/app.js): se ha pulsado aquí.
    f.querySelector('[data-entrar]').addEventListener('click', function () {
      try { sessionStorage.setItem('klendar.intencion', JSON.stringify({ r: 'avisame', t: Date.now() })); } catch (x) { /* sin almacenamiento */ }
    });
    campo.addEventListener('input', function () { err.hidden = true; campo.removeAttribute('aria-invalid'); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var correo = campo.value.trim().toLowerCase();
      if (!CORREO.test(correo)) {
        err.textContent = T.badEmail; err.hidden = false;
        campo.setAttribute('aria-invalid', 'true'); campo.focus();
        return;
      }
      if (boton.disabled) return;
      var antes = boton.textContent;
      boton.disabled = true; boton.textContent = T.busy;
      fetch(URL_SB + '/rest/v1/rpc/join_city_waitlist', {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_lat: lat, p_lng: lng, p_zone: zona || null, p_email: correo, p_lang: en ? 'en' : 'es', p_source: 'web' }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) throw new Error((d && d.message) || String(r.status));
          return Array.isArray(d) ? d[0] : d;
        });
      }).then(function (d) {
        if (d && d.status === 'live') { trasApuntarse(d); return; }
        resultado(T.checkTitle, T.checkBody.replace('{correo}', correo), '');
        hueco.querySelector('[data-hecho]').remove();
      }).catch(function (x) {
        err.textContent = mensajeError(x); err.hidden = false;
      }).then(function () {
        if (boton.isConnected) { boton.disabled = false; boton.textContent = antes; }
      });
    });
    campo.focus();
  }

  if (si) {
    si.addEventListener('click', function (e) {
      e.preventDefault();
      if (si.getAttribute('aria-disabled') === 'true') return;
      if (!URL_SB || !KEY) { location.href = si.getAttribute('href'); return; }
      if (!sesionGuardada()) { formulario(); return; }
      si.setAttribute('aria-disabled', 'true');
      var antes = si.textContent;
      si.textContent = T.busy;
      var listo = function () { si.removeAttribute('aria-disabled'); si.textContent = antes; };
      cliente().then(function (sb) {
        return sb.auth.getSession().then(function (r) {
          if (!r.data || !r.data.session) { listo(); formulario(); return; }
          return sb.rpc('join_city_waitlist', { p_lat: lat, p_lng: lng, p_zone: zona || null, p_lang: en ? 'en' : 'es', p_source: 'web' })
            .then(function (res) {
              listo();
              if (res.error) throw res.error;
              trasApuntarse(Array.isArray(res.data) ? res.data[0] : res.data);
            });
        });
      }).catch(function (x) {
        listo();
        // Que se vea qué ha pasado: debajo de los botones.
        hueco.hidden = false;
        hueco.innerHTML = '<p class="avisame-err" role="alert">' + esc(mensajeError(x)) + '</p>';
      });
    });
  }
  ponEnlaces();
})();
