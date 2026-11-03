/* Los avisos de Descubre: bajo los filtros, como mucho UNO a la vez, en una
 * línea y con su × (docs/GLOSARIO.md de la app, «Avisos de Descubre»; la
 * app hace lo mismo en `feed_notice.dart`). La publicación se tiene que ver.
 *
 * Van en `#feed-avisos` por orden de importancia, cada uno con
 * `data-aviso`; se enseña el primero que «quiere» salir (`data-quiere`):
 *
 * - `visita`: «Más planes en Marbella» (la ficha), solo para esa visita:
 *   «Volver a cerca de mí ›», o a la zona guardada («Volver a Madrid»,
 *   «Volver a todas las ciudades»), que se lee de lo guardado
 *   (`klendar.filtros`). Lleva a Descubre sin nada en la dirección; la ×
 *   solo lo quita (la visita sigue). Lo rellena este fichero.
 * - `viaje`: «Estás en Valencia · Lo mejor de hoy ›». Lo rellena
 *   /assets/gustos.js si estás lejos de tu ciudad; la × lo quita hasta mañana.
 * «Según el tiempo» no es un aviso: cuando reordena, lo dice el chip de
 * orden, que va justo detrás de Filtros.
 *
 * Con un aviso a la vista, el cuerpo lleva `con-aviso` (las tarjetas dejan
 * su sitio). `window.KlendarAvisos.pinta()` vuelve a decidir.
 */
(function () {
  'use strict';
  var caja = document.getElementById('feed-avisos');
  if (!caja) return;

  function pinta() {
    var visto = false;
    Array.prototype.forEach.call(caja.querySelectorAll('[data-aviso]'), function (a) {
      var sale = a.hasAttribute('data-quiere') && !visto;
      a.hidden = !sale;
      if (sale) visto = true;
    });
    caja.hidden = !visto;
    document.body.classList.toggle('con-aviso', visto);
  }
  window.KlendarAvisos = { pinta: pinta };

  // ── La visita de «Más planes en …» ──
  var vis = document.getElementById('visita');
  if (vis) {
    var esc = function (t) {
      return String(t).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
    var lee = function (n) { try { return JSON.parse(vis.getAttribute(n) || '{}'); } catch (e) { return {}; } };
    var T = lee('data-textos');
    var I = lee('data-iconos');
    var populares = lee('data-populares');
    var L = vis.getAttribute('data-lang') === 'en' ? 'en' : 'es';
    // La zona guardada (la de siempre: la visita no la cambia).
    var u = new URLSearchParams('');
    try {
      var g = JSON.parse(localStorage.getItem('klendar.filtros') || 'null');
      if (g && g[L]) u = new URLSearchParams(g[L]);
    } catch (e) { /* sin lo guardado: «Cerca de mí» */ }
    var pon = function (texto, icono) {
      vis.innerHTML = '<a class="feed-aviso-t" href="' + esc(vis.getAttribute('data-volver') || '/') + '" data-visita-volver aria-label="'
        + esc(T.label + '. ' + texto) + '">' + (I[icono] || '') + '<span>' + esc(texto) + '</span><span aria-hidden="true">›</span></a>'
        + '<button type="button" class="feed-aviso-x" data-visita-x aria-label="' + esc(T.close) + '" title="' + esc(T.close) + '">' + (I.x || '×') + '</button>';
      vis.setAttribute('data-quiere', '');
      vis.querySelector('[data-visita-x]').addEventListener('click', function () {
        vis.removeAttribute('data-quiere');
        vis.innerHTML = '';
        pinta();
      });
      pinta();
    };
    var slug = u.get('ciudad') || u.get('city');
    var a = function (nombre) { return String(T.to || '').replace('{city}', nombre); };
    if (u.get('todas') === '1') pon(T.all, 'todas');
    else if (!slug) pon(T.near, 'cerca');
    else {
      var p = Array.isArray(populares) ? populares.filter(function (m) { return m && m.slug === slug; })[0] : null;
      if (p) pon(a(p.name), 'ciudad');
      else {
        // Otro municipio: su nombre, de la base (`resolve_municipality`);
        // sin red, el de su slug.
        var bonito = slug.replace(/-/g, ' ').replace(/(^|\s)(\S)/g, function (m, x, y) { return x + y.toUpperCase(); });
        var conf = window.KLENDAR_ENV ? Promise.resolve() : new Promise(function (ok, ko) {
          var sc = document.createElement('script');
          sc.src = '/config.js?v=3'; sc.onload = ok; sc.onerror = ko;
          document.head.appendChild(sc);
        });
        conf.then(function () {
          var env = window.KLENDAR_ENV;
          if (!env) return null;
          return fetch(env.url + '/rest/v1/rpc/resolve_municipality', {
            method: 'POST',
            headers: { apikey: env.key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_slug: slug }),
          }).then(function (r) { return r.ok ? r.json() : null; });
        }).catch(function () { return null; }).then(function (l) {
          var m = Array.isArray(l) && l[0] ? l[0].municipality || l[0] : null;
          pon(a(m && m.name ? m.name : bonito), 'ciudad');
        });
      }
    }
  }

  // El de viaje lo enciende /assets/gustos.js (llama a `pinta()` al saber
  // dónde estás).
  pinta();
})();
