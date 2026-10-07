/* «Esta noche se mueve» en el mapa de Explorar (tanda C; migración
 * 20261208100002_esta_noche_se_mueve de la app).
 *
 * Con la casilla encendida (`?ambiente=1`, en inglés `?buzz=1`) se piden las
 * zonas con ambiente de lo que se ve del mapa (`nightlife_now`, sin sesión) y
 * otra vez al moverlo, y se pintan círculos de unos 150 m en tinta (nunca en
 * coral), más opacos cuanto más ambiente: «Algo», «Bastante» y «Mucho
 * ambiente». Sin nombres ni negocios. Sin zonas, un aviso de una línea encima
 * del mapa con «¿Por qué?»; con el mapa muy alejado, «Acerca el mapa…». La
 * casilla cambia la dirección (para compartirla) sin recargar.
 */
(function () {
  'use strict';
  var yo = document.currentScript;
  var URL_SB = yo && yo.dataset.url;
  var KEY = yo && yo.dataset.key;
  var chk = document.getElementById('ambiente');
  var aviso = document.getElementById('ambiente-aviso');
  var leyenda = document.getElementById('ambiente-leyenda');
  var T = {};
  try { T = JSON.parse(document.getElementById('ambiente-textos').textContent || '{}'); } catch (x) { T = {}; }
  if (!chk || !aviso || !URL_SB || !KEY) return;

  var FUENTE = 'klendar-ambiente';
  var mapa = null;
  var pedido = 0;
  var espera = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** «2 h» o «90 min», con lo que dice la base. */
  function tramo(min) {
    var m = Number(min) || 120;
    return m % 60 === 0 ? String(T.h || '{n} h').replace('{n}', m / 60) : String(T.m || '{n} min').replace('{n}', m);
  }
  function tinta() {
    return matchMedia('(prefers-color-scheme: dark)').matches ? '#FFFFFF' : '#0A0A0A';
  }

  function quitaCapa() {
    if (!mapa) return;
    try {
      if (mapa.getLayer(FUENTE)) mapa.removeLayer(FUENTE);
      if (mapa.getSource(FUENTE)) mapa.removeSource(FUENTE);
    } catch (x) { /* ya no estaba */ }
  }
  function ponAviso(html) {
    aviso.innerHTML = html;
    aviso.hidden = !html;
  }

  function pinta(d) {
    if (!chk.checked || !mapa) return;
    var zonas = (d && Array.isArray(d.zones)) ? d.zones.filter(function (z) {
      return isFinite(z.lat) && isFinite(z.lng) && z.level >= 1 && z.level <= 3;
    }) : [];
    var geo = {
      type: 'FeatureCollection',
      features: zonas.map(function (z) {
        return { type: 'Feature', properties: { level: Number(z.level) }, geometry: { type: 'Point', coordinates: [Number(z.lng), Number(z.lat)] } };
      }),
    };
    // Unos 150 m de radio en el suelo, a cualquier zoom (metros por píxel a
    // la latitud del centro).
    var lat = mapa.getCenter().lat;
    var r0 = 150 / (156543.03392 * Math.cos(lat * Math.PI / 180));
    if (mapa.getSource(FUENTE)) mapa.getSource(FUENTE).setData(geo);
    else {
      mapa.addSource(FUENTE, { type: 'geojson', data: geo });
      mapa.addLayer({
        id: FUENTE,
        type: 'circle',
        source: FUENTE,
        paint: {
          'circle-color': tinta(),
          'circle-opacity': ['match', ['get', 'level'], 3, 0.7, 2, 0.45, 0.22],
          'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, r0, 22, r0 * Math.pow(2, 22)],
          'circle-stroke-width': 0,
        },
      });
    }
    var h = tramo(d && d.window_minutes);
    if (d && d.too_wide) {
      ponAviso(esc(T.wide));
      leyenda.hidden = true;
    } else if (!zonas.length) {
      var porque = String(T.whyText || '').replace('{n}', (d && d.min_people) || 10).replace('{h}', h);
      ponAviso(esc(T.empty) + ' <button type="button" id="ambiente-porque" aria-expanded="false">' + esc(T.why) + '</button>'
        + '<span class="ambiente-porque" id="ambiente-porque-t" hidden><br>' + esc(porque) + '</span>');
      var b = document.getElementById('ambiente-porque');
      b.addEventListener('click', function () {
        var t = document.getElementById('ambiente-porque-t');
        t.hidden = !t.hidden;
        b.setAttribute('aria-expanded', String(!t.hidden));
      });
      leyenda.hidden = true;
    } else {
      ponAviso('');
      var nv = T.levels || [];
      leyenda.innerHTML = '<span><i class="n1"></i><i class="n2"></i><i class="n3"></i></span>'
        + '<span>' + esc(String(T.legend || '').replace('{h}', h)) + '</span>';
      leyenda.setAttribute('aria-label', nv.join(', '));
      leyenda.hidden = false;
    }
  }

  function pide() {
    if (!chk.checked || !mapa) return;
    var b = mapa.getBounds();
    var n = ++pedido;
    fetch(URL_SB + '/rest/v1/rpc/nightlife_now', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_min_lat: b.getSouth(), p_min_lng: b.getWest(), p_max_lat: b.getNorth(), p_max_lng: b.getEast() }),
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (n !== pedido) return;
      if (d && d.enabled === false) d = { zones: [], window_minutes: d.window_minutes, min_people: d.min_people };
      pinta(d || { zones: [] });
    }).catch(function () { if (n === pedido) pinta({ zones: [] }); });
  }
  function pideLuego() {
    clearTimeout(espera);
    espera = setTimeout(pide, 350);
  }

  function engancha(m) {
    mapa = m;
    var listo = function () {
      m.on('moveend', function () { if (chk.checked) pideLuego(); });
      if (chk.checked) pide();
    };
    if (m.loaded()) listo(); else m.once('load', listo);
  }
  if (window.KlendarMapa) engancha(window.KlendarMapa);
  else document.addEventListener('klendar-mapa', function () { engancha(window.KlendarMapa); }, { once: true });
  // Sin mapa (sin token o sin red), la casilla no hace nada: fuera.
  document.addEventListener('klendar-mapa-falla', function () {
    var f = chk.closest('.ambiente-fila');
    if (f) f.hidden = true;
    ponAviso('');
  });

  chk.addEventListener('change', function () {
    try { history.replaceState(history.state, '', chk.getAttribute(chk.checked ? 'data-on' : 'data-off')); } catch (x) { /* nada */ }
    if (chk.checked) { pide(); return; }
    pedido++;
    quitaCapa();
    ponAviso('');
    leyenda.hidden = true;
  });
  // Al cambiar el tema del sistema, la tinta también.
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (mapa && mapa.getLayer(FUENTE)) mapa.setPaintProperty(FUENTE, 'circle-color', tinta());
    });
  } catch (x) { /* navegador viejo */ }
})();
