/* Los avisos de Descubre: bajo los filtros, como mucho UNO a la vez, en una
 * línea y con su × (docs/GLOSARIO.md de la app, «Avisos de Descubre»; la
 * app hace lo mismo en `feed_notice.dart`). La publicación se tiene que ver.
 *
 * Van en `#feed-avisos` por orden de importancia, cada uno con
 * `data-aviso`; se enseña el primero que «quiere» salir (`data-quiere`):
 *
 * - `viaje`: «Estás en Valencia · Lo mejor de hoy ›». Lo rellena
 *   /assets/gustos.js si estás lejos de tu ciudad; la × lo quita hasta mañana.
 * - `tiempo`: «Llueve hoy: primero, bajo techo», solo la primera vez del día
 *   (`klendar.tiempo-aviso` guarda la fecha). Luego basta el chip de orden
 *   («Bajo techo primero»), y en su menú está qué hace y de dónde salen los
 *   datos (MET Norway). Tocarlo abre ese menú; la × o pasar a la siguiente
 *   publicación lo quitan.
 *
 * Con un aviso a la vista, el cuerpo lleva `con-aviso` (las tarjetas dejan
 * su sitio). `window.KlendarAvisos.pinta()` vuelve a decidir.
 */
(function () {
  'use strict';
  var caja = document.getElementById('feed-avisos');
  if (!caja) return;
  var KT = 'klendar.tiempo-aviso';
  var hoy = function () {
    var n = new Date();
    return n.getFullYear() + '-' + (n.getMonth() + 1) + '-' + n.getDate();
  };
  var lee = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var pon = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* no se recuerda */ } };

  function pinta() {
    var visto = false;
    Array.prototype.forEach.call(caja.querySelectorAll('[data-aviso]'), function (a) {
      var sale = a.hasAttribute('data-quiere') && !visto;
      a.hidden = !sale;
      if (sale) visto = true;
      // El del tiempo cuenta como visto cuando sale de verdad (no si lo
      // tapaba otro que mandaba más).
      if (sale && a.getAttribute('data-aviso') === 'tiempo') pon(KT, hoy());
    });
    caja.hidden = !visto;
    document.body.classList.toggle('con-aviso', visto);
  }
  window.KlendarAvisos = { pinta: pinta };

  // El tiempo: la primera vez del día.
  var tiempo = caja.querySelector('[data-aviso="tiempo"]');
  if (tiempo) {
    var quita = function () {
      if (!tiempo.hasAttribute('data-quiere')) return;
      tiempo.removeAttribute('data-quiere');
      pinta();
    };
    if (lee(KT) !== hoy()) tiempo.setAttribute('data-quiere', '');
    tiempo.querySelector('[data-cierra]').addEventListener('click', quita);
    tiempo.querySelector('[data-abre-orden]').addEventListener('click', function (e) {
      var orden = document.querySelector('.feed-cab details.orden');
      if (!orden) return;
      e.stopPropagation();
      orden.open = true;
      var s = orden.querySelector('summary');
      if (s) s.focus();
    });
    // Al pasar a la siguiente publicación, se va (el chip lo sigue diciendo).
    var alPasar = function () {
      var y = document.body.scrollTop || document.documentElement.scrollTop || 0;
      if (y > window.innerHeight / 2) {
        quita();
        document.removeEventListener('scroll', alPasar, true);
      }
    };
    document.addEventListener('scroll', alPasar, { capture: true, passive: true });
  }
  // Si puede salir el de viaje (hay una ciudad tuya guardada y no lo has
  // quitado hoy), se le espera un momento: así no asoma el del tiempo para
  // quitarse enseguida. /assets/gustos.js llama a `pinta()` al saberlo.
  var viaje = caja.querySelector('[data-aviso="viaje"]');
  var g = null;
  try { g = JSON.parse(lee('klendar.gustos') || 'null'); } catch (e) { g = null; }
  var hoyViaje = (function () { try { return JSON.parse(lee('klendar.viaje') || 'null'); } catch (e) { return null; } })();
  if (viaje && g && g.city && hoyViaje !== hoy()) setTimeout(pinta, 1500);
  else pinta();
})();
