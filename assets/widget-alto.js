// Dentro del iframe del widget (`/widget/<id>`, functions/widget/[id].js): le
// decimos a la web que nos embebe cuánto medimos, para que no haya barras de
// desplazamiento dentro del recuadro (lo recoge /widget.js). Antes en línea;
// la CSP de scripts no lo deja (RUNBOOK §4zzz-csp).
(function () {
  function alto() {
    var b = document.getElementById('box'); if (!b) return;
    var h = b.getBoundingClientRect().height + 4;
    parent.postMessage({ klendar: 'height', height: Math.ceil(h) }, '*');
  }
  addEventListener('load', alto); addEventListener('resize', alto); alto();
})();
