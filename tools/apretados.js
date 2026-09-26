// Detector de diseño apretado, para pegar en la consola (o lanzar desde las
// pruebas) en cualquier pantalla de la web:
//
//   - botones, enlaces-botón y campos que se tocan o quedan a menos de 6 px
//     de otro (en la misma fila o uno encima de otro);
//   - elementos que se salen por la derecha (scroll horizontal);
//   - textos cortados dentro de un botón.
//
// Devuelve una lista de avisos legibles. Solo mira lo que está a la vista.
(() => {
  const SEL = 'button, a.pill, a.btn, .pill, .btn, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, .chip';
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden], dialog:not([open])')
      // Lo de dentro de un <details> cerrado no se ve (aunque mida algo).
      && !(el.closest('details:not([open])') && !el.closest('summary'));
  };
  const nombre = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} «${(el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().slice(0, 30)}»`;
  const els = [...document.querySelectorAll(SEL)].filter(vis)
    // Los hijos de otro control (un icono dentro de un botón) no cuentan.
    .filter((el, _, todos) => !todos.some((o) => o !== el && o.contains(el)));
  const avisos = [];
  const ancho = document.documentElement.clientWidth;
  for (let i = 0; i < els.length; i++) {
    const a = els[i].getBoundingClientRect();
    if (a.right > ancho + 1) avisos.push(`se sale por la derecha (${Math.round(a.right - ancho)} px): ${nombre(els[i])}`);
    if (els[i].scrollWidth > els[i].clientWidth + 2 && /BUTTON|A/.test(els[i].tagName) && getComputedStyle(els[i]).overflow === 'hidden') {
      avisos.push(`texto cortado: ${nombre(els[i])}`);
    }
    for (let j = i + 1; j < els.length; j++) {
      const b = els[j].getBoundingClientRect();
      const solapeV = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const solapeH = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      let hueco = null;
      if (solapeV > 4) hueco = Math.max(b.left - a.right, a.left - b.right); // misma fila
      else if (solapeH > 4) hueco = Math.max(b.top - a.bottom, a.top - b.bottom); // uno encima de otro
      if (hueco !== null && hueco < 6 && !(solapeV > 4 && solapeH > 4 && hueco < -2 && (els[i].contains(els[j]) || els[j].contains(els[i])))) {
        avisos.push(`${hueco < 0 ? 'se montan' : `a ${Math.round(hueco)} px`}: ${nombre(els[i])} ↔ ${nombre(els[j])}`);
      }
    }
  }
  if (document.documentElement.scrollWidth > ancho + 1) avisos.push(`la página tiene scroll horizontal (${document.documentElement.scrollWidth} > ${ancho})`);
  return avisos;
})();
