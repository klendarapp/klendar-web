/* «Grupos y empresas» (/grupos/, /en/groups/): elegir hasta 3 negocios y
 * «Pedir presupuesto (2)» en una barra fija abajo, que lleva al formulario
 * de «Tu cuenta» (`#/grupos/pedir?b=<id>,<id>`). Lo elegido se recuerda en
 * esta pestaña (`klendar.grupos.elegidos`, también lo usa «Tu cuenta» al
 * quitar uno o con «Añadir otro»), para poder cambiar de zona o de filtro
 * sin perderlo. Un 4.º: «Como mucho 3 a la vez.»
 */
(function () {
  'use strict';
  var form = document.getElementById('grupos-lista');
  if (!form) return;
  var barra = document.getElementById('grupos-pedir');
  var boton = document.getElementById('grupos-pedir-btn');
  var pedir = form.getAttribute('data-pedir') || '/app/#/grupos/pedir?b=';
  var plantilla = form.getAttribute('data-ask') || '{n}';
  var max = form.getAttribute('data-max') || '';
  var CLAVE = 'klendar.grupos.elegidos';
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var elegidos = [];
  try {
    var q = new URLSearchParams(location.search).get('b');
    elegidos = q ? q.split(',') : JSON.parse(sessionStorage.getItem(CLAVE) || '[]');
  } catch (x) { elegidos = []; }
  elegidos = (Array.isArray(elegidos) ? elegidos : []).filter(function (id) { return UUID.test(id); }).slice(0, 3);

  var aviso = null;
  function toast(msg) {
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.className = 'am-toast';
      aviso.setAttribute('role', 'status');
      document.body.appendChild(aviso);
    }
    aviso.textContent = msg;
    aviso.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { aviso.hidden = true; }, 3500);
  }
  function guarda() {
    try { sessionStorage.setItem(CLAVE, JSON.stringify(elegidos)); } catch (x) { /* sin almacenamiento */ }
  }
  function pinta() {
    form.querySelectorAll('input[name="b"]').forEach(function (c) {
      c.checked = elegidos.indexOf(c.value) >= 0;
      var l = c.closest('.grupo-elegir');
      if (l) l.classList.toggle('on', c.checked);
    });
    var n = elegidos.length;
    barra.hidden = !n;
    document.body.classList.toggle('con-barra-grupos', !!n);
    boton.textContent = plantilla.replace('{n}', n);
    boton.setAttribute('href', pedir + elegidos.join(','));
  }
  form.addEventListener('change', function (e) {
    var c = e.target;
    if (!c || c.name !== 'b') return;
    var i = elegidos.indexOf(c.value);
    if (c.checked && i < 0) {
      if (elegidos.length >= 3) { c.checked = false; toast(max); return; }
      elegidos.push(c.value);
    } else if (!c.checked && i >= 0) {
      elegidos.splice(i, 1);
    }
    guarda();
    pinta();
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  pinta();
})();
