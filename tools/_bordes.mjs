// Los bordes de los bloques de una pantalla del panel (revisión de coherencia,
// RUNBOOK §4zzz-coherencia1). Para evaluar en la página con Playwright:
//
//   const r = await page.evaluate(bordesPantalla);
//   const r = await page.evaluate(bordesPantalla, '#view');   (otra raíz: «Tu cuenta», la web pública…)
//
// Devuelve el ancho de la pantalla (`#view > div`, o la raíz que se le pase) y:
//  - `cortos`: las filas de bloques de primer nivel (con borde, fondo, campo,
//    tabla o botón de bloque; o una rejilla o fila flex que los contiene)
//    anchas (más del 40 % de la pantalla) que no llegan a su borde derecho o
//    izquierdo (más de 2 px). Lo de dentro de una caja no cuenta: la caja
//    manda. Un botón en línea (ajustado a su texto) no cuenta.
//  - `salidos`: lo que se sale por abajo o por la derecha de su caja (una
//    tarjeta, un recuadro), más de 1 px, y lo que se sale de la pantalla.
export function bordesPantalla(sel) {
  const raiz = (typeof sel === 'string' && [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length)) || document.querySelector('#view > div') || document.querySelector('#view');
  if (!raiz) return { ancho: 0, cortos: [], salidos: [] };
  // La caja de dentro de la raíz (sin su relleno): `main` lleva sus 20 px a cada lado.
  const rr = raiz.getBoundingClientRect();
  const rcs = getComputedStyle(raiz);
  const R = { left: rr.left + parseFloat(rcs.paddingLeft), right: rr.right - parseFloat(rcs.paddingRight) };
  R.width = R.right - R.left;
  const nombre = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : ''} «${(el.innerText || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 30)}»`;
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return false;
    const r = el.getBoundingClientRect();
    if (Number(cs.opacity) === 0) return false;
    const d = el.parentElement?.closest('details:not([open])');
    if (d && !el.closest('summary')) return false;
    return r.width > 0 && r.height > 0 && !el.closest('[hidden], dialog:not([open]), .sr-only, [popover]:not(:popover-open)');
  };
  const transparente = (c) => c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
  const esCaja = (el) => {
    const cs = getComputedStyle(el);
    if (/^(INPUT|SELECT|TEXTAREA|TABLE|DETAILS)$/.test(el.tagName)) return true;
    if (el.classList.contains('btn') || el.tagName === 'BUTTON') return true;
    const borde = ['Top', 'Bottom', 'Left', 'Right'].some((l) => parseFloat(cs[`border${l}Width`]) > 0 && cs[`border${l}Style`] !== 'none');
    return borde || !transparente(cs.backgroundColor) || cs.backgroundImage !== 'none';
  };
  const cajas = [];
  const recorre = (el) => {
    for (const h of el.children) {
      if (!visible(h)) continue;
      if (/^(SCRIPT|STYLE|TEMPLATE|svg)$/i.test(h.tagName)) continue;
      // La pantalla vacía (`.vacio`) va centrada a propósito (GLOSARIO).
      if (h.classList.contains('vacio')) continue;
      const d = getComputedStyle(h).display;
      if (esCaja(h)) { if (!d.startsWith('inline')) cajas.push(h); continue; }
      // Una rejilla o una fila (flex) con cajas dentro cuenta entera: lo que
      // importa es hasta dónde llega ella (las baldosas, las cifras, dos
      // botones lado a lado), no cada una de sus piezas.
      if ((d === 'grid' || d === 'flex') && [...h.querySelectorAll('*')].some((x) => visible(x) && esCaja(x))) { cajas.push(h); continue; }
      recorre(h);
    }
  };
  recorre(raiz);
  // Los de una misma fila (dos campos o dos botones lado a lado) cuentan
  // juntos: lo que se mira es de dónde a dónde va la fila.
  const filas = [];
  for (const c of cajas) {
    const r = c.getBoundingClientRect();
    const f = filas.find((x) => r.top < x.bottom - 4 && r.bottom > x.top + 4);
    if (f) { f.left = Math.min(f.left, r.left); f.right = Math.max(f.right, r.right); f.top = Math.min(f.top, r.top); f.bottom = Math.max(f.bottom, r.bottom); f.els.push(c); }
    else filas.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, els: [c] });
  }
  const cortos = [];
  for (const f of filas) {
    const ancho = f.right - f.left;
    if (ancho < R.width * 0.4) continue;
    const der = Math.round(R.right - f.right);
    const izq = Math.round(f.left - R.left);
    if (der > 2 || izq > 2) cortos.push({ que: f.els.map(nombre).join(' + '), ancho: Math.round(ancho), izq, der });
  }
  // Lo que se sale de su caja: cada descendiente visible frente a la caja
  // más cercana que lo contiene y recorta a la vista (borde o fondo).
  const salidos = [];
  for (const el of raiz.querySelectorAll('*')) {
    if (!visible(el) || /^(svg|path|use|g|circle|rect|line|polyline|OPTION)$/i.test(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    // Dentro de una fila que se desliza de lado (los chips), salirse es lo normal.
    let desliza = false;
    for (let q = el.parentElement; q && q !== raiz; q = q.parentElement) { if (/auto|scroll|hidden|clip/.test(getComputedStyle(q).overflowX)) { desliza = true; break; } }
    if (desliza) continue;
    if (r.right > Math.max(R.right, document.documentElement.clientWidth) + 1) { salidos.push({ que: nombre(el), por: 'la derecha de la pantalla', px: Math.round(r.right - R.right) }); continue; }
    for (let p = el.parentElement; p && p !== raiz; p = p.parentElement) {
      if (!esCaja(p) || /^(TABLE|DETAILS|INPUT|SELECT|TEXTAREA)$/.test(p.tagName)) continue;
      // Los avisos de Descubre van a propósito fuera de la fila de los filtros
      // (a la derecha de la tarjeta, o sobre su foto en tablet en vertical):
      // lo suyo se mira frente a la pantalla y dentro de cada aviso.
      if (p.matches('.feed-cab') && el.closest('.feed-avisos')) break;
      const cs = getComputedStyle(p);
      if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) break; // se desplaza: no es salirse
      const q = p.getBoundingClientRect();
      const abajo = r.bottom - q.bottom;
      const dcha = r.right - q.right;
      if (abajo > 1 || dcha > 1) salidos.push({ que: nombre(el), de: nombre(p), abajo: Math.round(abajo), dcha: Math.round(dcha) });
      break;
    }
  }
  return { ancho: Math.round(R.width), cortos, salidos: salidos.slice(0, 12) };
}
