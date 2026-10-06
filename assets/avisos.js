/* Los avisos de Descubre: bajo los filtros, como mucho UNO a la vez, en una
 * línea y con su × (docs/GLOSARIO.md de la app, «Avisos de Descubre»; la
 * app hace lo mismo en `feed_notice.dart`). La publicación se tiene que ver.
 *
 * Van en `#feed-avisos` por orden de importancia, cada uno con
 * `data-aviso`; se enseña el primero que «quiere» salir (`data-quiere`):
 *
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

  // El de viaje lo enciende /assets/gustos.js (llama a `pinta()` al saber
  // dónde estás).
  pinta();
})();
