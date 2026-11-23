// Los carteles para imprimir (el de una publicación y la pegatina de
// escaparate; `functions/_lib/poster.js` y `pegatina.js`): dibuja cada QR
// (`data-qr`, con su nivel de corrección en `data-nivel`), «Imprimir» y el
// selector de idioma, que cambia al elegir (sin JS, con su botón
// «Cambiar»). Sin código en línea: la CSP no lo necesita.
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  function dibuja() {
    if (typeof qrcode !== 'function') return;
    const cache = new Map();
    document.querySelectorAll('[data-qr]').forEach((el) => {
      const url = el.getAttribute('data-qr');
      const nivel = /^[LMQH]$/.test(el.getAttribute('data-nivel') || '') ? el.getAttribute('data-nivel') : 'M';
      const clave = `${nivel}|${url}`;
      let svg = cache.get(clave);
      if (!svg) {
        const q = qrcode(0, nivel);
        q.addData(url);
        q.make();
        // Sin margen: el blanco de alrededor ya deja la zona tranquila.
        svg = q.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
        cache.set(clave, svg);
      }
      el.innerHTML = svg;
      const s = el.querySelector('svg');
      if (s) { s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); }
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-imprimir]')) window.print();
  });
  document.querySelectorAll('form[data-cambia] select').forEach((s) => {
    s.addEventListener('change', () => s.form.submit());
  });
  dibuja();
})();
