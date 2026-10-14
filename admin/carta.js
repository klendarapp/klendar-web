/* La carta imprimible de «Locales pedidos» (admin/carta.html): rellena el
 * número, el sitio y la zona que llegan en la dirección (`?n=&local=&zona=`)
 * y el botón de imprimir (el navegador la guarda en PDF). Sin nada de la
 * base: solo lo que manda el admin, nunca quién lo pidió. */
'use strict';
(function () {
  var q = new URLSearchParams(location.search);
  var n = Math.max(0, parseInt(q.get('n') || '0', 10) || 0);
  var local = String(q.get('local') || '').slice(0, 80);
  var zona = String(q.get('zona') || '').slice(0, 80);
  var pon = function (id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; };
  pon('numero', n.toLocaleString('es-ES'));
  pon('titulo', n === 1 ? 'persona de tu barrio quiere verte en Klendar' : 'personas de tu barrio quieren verte en Klendar');
  pon('local', local);
  pon('zona', zona);
  pon('frase1', (n === 1 ? 'Una persona ha pedido' : n.toLocaleString('es-ES') + ' personas han pedido')
    + ' en Klendar que ' + (local || 'tu negocio') + ' esté en la app. Por privacidad no compartimos quién lo pide: solo contamos cuántas personas son.');
  document.title = (local ? local + ' · ' : '') + 'Carta · Klendar';
  var b = document.getElementById('imprimir');
  if (b) b.addEventListener('click', function () { window.print(); });
})();
