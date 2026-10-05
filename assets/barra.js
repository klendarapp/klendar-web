/* La acción principal de una ficha (oferta, evento o negocio), siempre a mano
 * en el móvil.
 *
 * En el escritorio la tarjeta lateral ya va fija al hacer scroll. En el móvil
 * esa tarjeta queda arriba y, al bajar a leer la descripción, el horario o
 * las reseñas, el botón se pierde. Aquí, cuando el botón principal sale de la
 * pantalla, aparece una barra abajo con ese mismo botón (texto y enlace del
 * momento: si /assets/amigos.js lo ha cambiado a «Quitar de favoritos», sale
 * así). Volver es la flecha del navegador y la cabecera, que ya va fija.
 */
(function () {
  'use strict';
  // El primero que se vea: al equipo del negocio, amigos.js le cambia el
  // favorito por «Editar ficha» (los otros quedan con `hidden`).
  var botones = document.querySelectorAll('.detail .side .pill.big');
  if (!botones.length) return;
  var original = botones[0];
  function elVisible() {
    for (var i = 0; i < botones.length; i++) if (!botones[i].hidden) return botones[i];
    return null;
  }
  var movil = window.matchMedia('(max-width: 860px)');

  var barra = document.createElement('div');
  barra.className = 'barra-accion';
  barra.hidden = true;
  var boton = document.createElement('a');
  barra.appendChild(boton);
  document.body.appendChild(barra);

  function copia() {
    original = elVisible() || original;
    boton.className = original.className;
    boton.removeAttribute('id');
    boton.innerHTML = original.innerHTML;
    boton.setAttribute('href', original.getAttribute('href') || '#');
    if (original.getAttribute('rel')) boton.setAttribute('rel', original.getAttribute('rel'));
  }

  var visible = false;
  function pinta() {
    // Solo cuando ya lo has pasado (queda por encima), no si aún no has llegado.
    var actual = elVisible();
    var ver = !!actual && movil.matches && actual.getBoundingClientRect().bottom < 64;
    if (ver === visible) return;
    visible = ver;
    if (ver) copia();
    barra.hidden = !ver;
    document.body.classList.toggle('con-barra-accion', ver);
  }
  window.addEventListener('scroll', pinta, { passive: true });
  window.addEventListener('resize', pinta);
  pinta();
})();
