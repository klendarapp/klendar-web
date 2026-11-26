/* Esqueletos con la forma de cada pantalla (§4zzz-cargas, P3 aprobada por
 * Iván el 26-11), para el panel y «Tu cuenta». Antes había uno para todas
 * (filas con un cuadrado en el panel, tarjetas iguales en «Tu cuenta») y con
 * las esquinas rectas; ahora cada pantalla enseña la forma de lo que viene:
 * tarjetas de 20 (como `.card` del panel y `.ocard` de «Tu cuenta»), cifras
 * de 18 (`.hoy-cifra`), fotos de 14, campos de 12 y botones redondos. El gris
 * y el brillo son los de siempre (`mov-brillo`, site.css); con «Reducir
 * movimiento», sin brillo.
 *
 *   KL_ESQUELETO('lista', 'Cargando…')         → el HTML (role="status")
 *   KL_ESQUELETO('hoy', 'Cargando…', true)     → sale a los 200 ms (sin parpadeo)
 *   KL_ESQUELETO('lista', 'Cargando…', false, true) → con la cejilla de «Tu cuenta»
 *
 * Qué tipo lleva cada pantalla: `ESQUELETO_DE` en panel/panel.js y en
 * assets/cuenta/app.js. tools/esqueletos_check.py (pre-push) falla si una
 * pantalla no tiene el suyo o si se pide un tipo que no está aquí. */
(function () {
  var CSS =
    '.esq-p{display:grid;gap:12px;margin:0 0 16px;max-width:760px}' +
    '.esq-p.esq-tarda{animation:mov-funde var(--mov-base,200ms) var(--mov-entra,ease) 200ms backwards}' +
    '.esq-b{display:block;position:relative;overflow:hidden;background:var(--soft,#eee);border-radius:6px;height:12px}' +
    '.esq-b::after{content:"";position:absolute;inset:0;pointer-events:none;transform:translateX(-100%);' +
    'background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);animation:mov-brillo 1.4s ease-in-out infinite}' +
    '@media (prefers-color-scheme: dark){.esq-b::after{background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.08) 50%,transparent 70%)}}' +
    '@media (prefers-reduced-motion: reduce){.esq-b::after{animation:none!important}.esq-p.esq-tarda{animation-duration:.01ms}}' +
    '.esq-t{height:28px;border-radius:8px;width:60%}.esq-t2{height:18px;border-radius:6px;width:40%;margin-top:8px}' +
    '.esq-l2{height:10px}.esq-pill{height:36px;border-radius:18px;width:34%}' +
    '.esq-pills{display:flex;gap:8px}.esq-pills .esq-pill{width:22%}' +
    '.esq-c{display:grid;gap:14px;padding:14px;border-radius:20px;border:1px solid var(--glass-border,rgba(10,10,10,.08));background:var(--glass,transparent)}' +
    '.esq-fila{display:flex;gap:12px;align-items:center;min-height:44px}' +
    '.esq-tx{flex:1;display:grid;gap:8px;min-width:0}' +
    '.esq-th{flex:none;width:44px;height:44px;border-radius:14px}' +
    '.esq-ic{flex:none;width:24px;height:24px;border-radius:8px}' +
    '.esq-foto{flex:none;width:96px;height:78px;border-radius:14px}' +
    '.esq-oc{display:flex;gap:14px;align-items:center;padding:10px;border-radius:20px;border:1px solid var(--glass-border,rgba(10,10,10,.08))}' +
    '.esq-tiles{display:grid;gap:8px;grid-template-columns:repeat(3,minmax(0,1fr))}.esq-tiles.dos{grid-template-columns:repeat(2,minmax(0,1fr))}' +
    '.esq-tile{height:84px;border-radius:18px}.esq-tile.alto{height:96px}' +
    '.esq-campo{height:48px;border-radius:12px}.esq-btn{height:48px;border-radius:24px;width:45%}' +
    '.esq-big{height:340px;border-radius:24px}.esq-cuadro{height:280px;border-radius:20px}' +
    '.esq-cifra{height:40px;width:30%;border-radius:10px}.esq-graf{height:200px;border-radius:20px}.esq-cal{height:320px;border-radius:20px}.esq-cover{height:200px;border-radius:20px}' +
    '.esq-in{display:contents}.esq-p .w25{width:25%}.esq-p .w40{width:40%}.esq-p .w55{width:55%}.esq-p .w70{width:70%}.esq-p .w85{width:85%}';

  var b = function (c) { return '<span class="esq-b ' + c + '"></span>'; };
  var texto = function (a, b2) { return '<span class="esq-tx">' + b(a) + b('esq-l2 ' + b2) + '</span>'; };
  var fila = function (i, conFoto) { return '<span class="esq-fila">' + (conFoto ? b('esq-th') : '') + texto(['w70', 'w55', 'w85', 'w40'][i % 4], ['w40', 'w55', 'w25', 'w40'][i % 4]) + '</span>'; };
  var filas = function (n, conFoto) { var s = ''; for (var i = 0; i < n; i++) s += fila(i, conFoto); return s; };
  var tarjeta = function (dentro) { return '<span class="esq-c">' + dentro + '</span>'; };
  // Una fila de navegación (icono + texto, una tarjeta por fila: «Menú del día», «Oferta»…).
  var nav = function (i) { return tarjeta('<span class="esq-fila">' + b('esq-ic') + texto(['w70', 'w55', 'w85'][i % 3], 'w40') + '</span>'); };
  var navs = function (n) { var s = ''; for (var i = 0; i < n; i++) s += nav(i); return s; };
  var tiles = function (n, clase) { var s = '<span class="esq-tiles' + (n % 3 ? ' dos' : '') + '">'; for (var i = 0; i < n; i++) s += b('esq-tile ' + (clase || '')); return s + '</span>'; };
  var campos = function (n) { var s = ''; for (var i = 0; i < n; i++) s += b('w40') + b('esq-campo'); return tarjeta(s); };
  var ocard = function (i) { return '<span class="esq-oc">' + b('esq-foto') + texto(['w70', 'w85', 'w55'][i % 3], 'w40') + '</span>'; };
  var pills = '<span class="esq-pills">' + b('esq-pill') + b('esq-pill') + b('esq-pill') + '</span>';

  // Cada tipo, como la pantalla que lo lleva (de arriba abajo).
  var TIPOS = {
    // Hoy del panel: el día, «Cerrar por hoy», las cifras, un aviso, accesos y «Para hoy».
    hoy: function () { return b('esq-t') + b('esq-pill') + tiles(3) + navs(3) + b('esq-t2') + tarjeta(filas(2)); },
    // Publicar y Publicaciones: los tipos que se publican y una tarjeta grande.
    publicar: function () { return b('esq-t') + navs(4) + b('esq-t2') + b('esq-big'); },
    // Listas (reseñas, equipo, sellos, bonos…): una tarjeta con filas.
    lista: function () { return b('esq-t') + b('w85') + tarjeta(filas(4, true)); },
    // Listas sin foto (avisos, ayuda, cerrados…).
    filas: function () { return b('esq-t') + b('w85') + tarjeta(filas(5)); },
    // Cifras e informes: los periodos, los recuadros y la gráfica.
    cifras: function () { return b('esq-t') + pills + tiles(4) + b('esq-graf'); },
    // Negocio (todas las herramientas): recuadros en dos columnas.
    menu: function () { return b('esq-t') + tiles(6, 'alto'); },
    // Formularios (la ficha, ajustes, regalos…): etiquetas, campos y el botón.
    formulario: function () { return b('esq-t') + b('w85') + campos(3) + b('esq-btn'); },
    calendario: function () { return b('esq-t') + b('esq-pill') + b('esq-cal'); },
    // Validar: la cámara y el campo del código.
    validar: function () { return b('esq-t') + b('esq-cuadro') + b('esq-campo'); },
    // «Tu cuenta»: tarjetas con foto (tus códigos, favoritos, planes…).
    tarjetas: function () { return b('esq-t') + ocard(0) + ocard(1) + ocard(2); },
    // Una ficha (un código, un sorteo, un bono…): la parte de arriba, el texto y el botón.
    ficha: function () { return b('esq-cover') + b('esq-t') + b('w85') + b('w70') + b('esq-btn'); },
    // Un resumen con una cifra grande (lo que has ahorrado) y la lista de debajo.
    resumen: function () { return b('esq-t') + b('esq-l2 w25') + b('esq-cifra') + b('w40') + tarjeta(filas(3)); },
  };
  window.KL_ESQUELETO_TIPOS = Object.keys(TIPOS);
  // `cejilla`: la línea pequeña de encima del título («Tu cuenta»).
  window.KL_ESQUELETO = function (tipo, cargando, tarda, cejilla) {
    var pinta = TIPOS[tipo] || TIPOS.lista;
    return '<div class="esq-p esq-' + (TIPOS[tipo] ? tipo : 'lista') + (tarda ? ' esq-tarda' : '') + '" role="status">' +
      '<span class="sr">' + String(cargando || 'Cargando…').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }) + '</span>' +
      '<span class="esq-in" aria-hidden="true">' + (cejilla ? b('esq-l2 w25') : '') + pinta() + '</span></div>';
  };

  var estilo = document.createElement('style');
  estilo.textContent = CSS;
  document.head.appendChild(estilo);
})();
