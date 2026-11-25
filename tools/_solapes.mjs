// La regla de solapes de la app en la web (Iván, 25-11; RUNBOOK §4zzz-solape
// de la app y §4zzz-solapes-web): lo que se mide en la página con Playwright.
// La usa tools/solapes_check.mjs; sirve para cualquier prueba:
//
//   const r = await page.evaluate(solapesPantalla);
//   await letraGrande(ctx, 1.3);                  (la letra al 130 %, antes de cargar)
//   await ctx.addInitScript(sinAnimaciones);
//
// `solapesPantalla()` devuelve:
//  - `pisados`: bloques hermanos que se pisan o van a menos de 4 px el uno del
//    otro (de arriba abajo o de lado). Un bloque es lo que se ve como caja
//    (borde, fondo distinto del de detrás, sombra o imagen de fondo), un campo
//    o un botón; «hermanos», los que van en la misma caja (la más cercana que
//    los contiene), en la misma lista que se desliza y en la misma capa (lo
//    fijo, lo pegajoso, un diálogo o un desplegable van aparte: lo de la
//    página pasa por debajo). No cuentan: uno entero dentro de otro (una
//    etiqueta sobre una foto), un botón de texto (sin borde ni fondo) pegado a
//    algo (pisarse sí cuenta) y las filas de una lista agrupada (mismos bordes
//    de los lados, o de arriba y abajo, y las esquinas rectas donde se juntan).
//  - `salidos`: textos e iconos que se salen de su tarjeta (la caja más cercana
//    que los lleva) con el desbordamiento a la vista, o de la pantalla; lo que
//    va dentro de algo que recorta o se desliza no cuenta.
//  - `lateral`: cuánto se puede desplazar la página de lado (px) y qué se sale.
export function solapesPantalla(opc = {}) {
  const HUECO = 4;
  const MAX = opc.max || 12;
  const W = document.documentElement.clientWidth;
  const memo = new Map();
  const cs = (e) => { let c = memo.get(e); if (!c) { c = getComputedStyle(e); memo.set(e, c); } return c; };
  const texto = (el) => (el.innerText || el.getAttribute?.('aria-label') || el.placeholder || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 32);
  const firma = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}`;
  // La firma de algo sin clase, con la de lo más cercano que la tiene
  // (`span en a.tab`): así se distingue en el resumen.
  const firmaCon = (el) => {
    const f = firma(el);
    if (/[.#]/.test(f)) return f;
    for (let p = el.parentElement, i = 0; p && p !== document.body && i < 4; p = p.parentElement, i += 1) {
      const g = firma(p);
      if (/[.#]/.test(g) || p.id) return `${f} en ${p.id ? `${p.tagName.toLowerCase()}#${p.id}` : g}`;
    }
    return f;
  };
  const nombre = (el) => {
    const c = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${c} «${texto(el)}»`;
  };
  const transparente = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const s = cs(el);
    if (s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    return !el.closest('.sr-only, .visually-hidden, [hidden], dialog:not([open])');
  };
  // El fondo de detrás (el primero no transparente de los de fuera).
  const fondoDetras = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = cs(p);
      if (s.backgroundImage !== 'none') return 'imagen';
      if (!transparente(s.backgroundColor)) return s.backgroundColor;
    }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
  };
  const conBorde = (s) => ['Top', 'Right', 'Bottom', 'Left'].some((l) => parseFloat(s[`border${l}Width`]) > 0
    && !/^(none|hidden)$/.test(s[`border${l}Style`]) && !transparente(s[`border${l}Color`]));
  /** ¿Se ve como caja? */
  const esCaja = (el) => {
    const s = cs(el);
    if (s.display === 'inline' || s.display === 'contents') return false;
    if (/^(IMG|VIDEO|CANVAS|IFRAME|PICTURE|svg|HR|BR)$/i.test(el.tagName)) return false;
    if (conBorde(s)) return true;
    if (s.boxShadow && s.boxShadow !== 'none') return true;
    if (s.backgroundImage !== 'none') return true;
    return !transparente(s.backgroundColor) && s.backgroundColor !== fondoDetras(el);
  };
  const esCampo = (el) => /^(SELECT|TEXTAREA)$/.test(el.tagName)
    || (el.tagName === 'INPUT' && !/^(hidden|checkbox|radio|range|color|file|image)$/.test(el.type));
  const esBoton = (el) => el.tagName === 'BUTTON' || (el.tagName === 'INPUT' && /^(submit|button|reset)$/.test(el.type))
    || el.getAttribute('role') === 'button' || el.classList.contains('btn');
  // Una foto (o su hueco sin foto, o un mapa): en la app las imágenes no son
  // bloques; lo que va encima (una etiqueta, el panel de una tarjeta) puede
  // pisarlas. Lo es si lleva una imagen de fondo o casi toda (70 %) la cubre
  // una imagen, un vídeo, un lienzo o un hueco sin texto con su dibujo (encima,
  // absoluto: el «sin foto» de las tarjetas).
  const memoMedia = new Map();
  // Los huecos de foto de las tarjetas, con foto o sin ella (las iniciales o
  // el dibujo de la categoría): `.tj-media`, `.sin-foto`, `.tj-arte`,
  // `.tj-ph`, `.ph` y el móvil de la portada (`.phone`).
  const FOTO = '.tj-media, .sin-foto, .tj-arte, .tj-ph, .ph, .phone';
  const esMedia = (el) => {
    if (memoMedia.has(el)) return memoMedia.get(el);
    let v = el.matches(FOTO) || /url\(/.test(cs(el).backgroundImage);
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (!v && area > 0) {
      const cubre = (d) => {
        const q = d.getBoundingClientRect();
        const w = Math.min(q.right, r.right) - Math.max(q.left, r.left);
        const h = Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top);
        return w > 0 && h > 0 && (w * h) / area >= 0.7;
      };
      const hijos = [...el.children, ...[...el.children].flatMap((c) => [...c.children])];
      v = hijos.some((d) => (/^(IMG|PICTURE|VIDEO|CANVAS|IFRAME)$/.test(d.tagName) || /url\(/.test(cs(d).backgroundImage)
        || (cs(d).position === 'absolute' && !(d.innerText || '').trim() && d.querySelector?.('svg, img'))) && cubre(d));
    }
    memoMedia.set(el, v);
    return v;
  };
  /** Un bloque: caja, campo o botón (y no en línea con el texto ni una foto). */
  const memoBloque = new Map();
  const esBloque = (el) => {
    let v = memoBloque.get(el);
    if (v === undefined) {
      const d = cs(el).display;
      // Una caja vacía (sin texto ni nada dentro: una barra de una gráfica,
      // un punto, un esqueleto) tampoco: no es una tarjeta ni un botón.
      const vacia = !el.children.length && !(el.textContent || '').trim() && !esCampo(el) && !esBoton(el);
      v = d !== 'inline' && d !== 'contents' && !vacia && (esCampo(el) || esBoton(el) || esCaja(el)) && !esMedia(el);
      memoBloque.set(el, v);
    }
    return v;
  };
  const botonDeTexto = (el) => esBoton(el) && !esCaja(el);
  // La capa: lo fijo, lo pegajoso, un diálogo, un `popover` o un desplegable
  // (absoluto, con z-index y de buen tamaño) van aparte.
  const capaDe = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const s = cs(p);
      if (s.position === 'fixed' || s.position === 'sticky' || p.tagName === 'DIALOG' || p.hasAttribute('popover')) return p;
      if (s.position === 'absolute' && s.zIndex !== 'auto') {
        const r = p.getBoundingClientRect();
        if (r.width * r.height > 2500) return p;
      }
    }
    return document.body;
  };
  const desliza = (s) => /auto|scroll/.test(s.overflowX) || /auto|scroll/.test(s.overflowY);
  const recorta = (s) => s.overflowX !== 'visible' || s.overflowY !== 'visible';
  /** La lista que se desliza en la que va (la más cercana, sin contarse). */
  const listaDe = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (desliza(cs(p))) return p;
    return document.body;
  };
  /** La caja en la que va (la más cercana, sin contarse), dentro de su capa. */
  const cajaDe = (el, capa) => {
    if (el === capa) return capa.parentElement || document.body;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (esBloque(p)) return p;
      if (p === capa) return p;
    }
    return document.body;
  };
  const radios = (s) => ({ tl: parseFloat(s.borderTopLeftRadius) || 0, tr: parseFloat(s.borderTopRightRadius) || 0,
    bl: parseFloat(s.borderBottomLeftRadius) || 0, br: parseFloat(s.borderBottomRightRadius) || 0 });

  // 1. Los bloques, por grupos de hermanos.
  const grupos = new Map();
  const todos = document.body.querySelectorAll('*');
  for (const el of todos) {
    if (/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|OPTION|svg|path|g|use)$/i.test(el.tagName)) continue;
    if (el.closest('svg')) continue;
    if (!esBloque(el) || !visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 8 || r.height <= 8) continue;
    const capa = capaDe(el);
    const caja = cajaDe(el, capa);
    const lista = listaDe(el);
    let g = grupos.get(caja);
    if (!g) { g = new Map(); grupos.set(caja, g); }
    let h = g.get(lista);
    if (!h) { h = []; g.set(lista, h); }
    h.push({ el, r, capa });
  }
  const rect = (q) => [Math.round(q.left + scrollX), Math.round(q.top + scrollY), Math.round(q.width), Math.round(q.height)];
  const contiene = (x, y) => x.left - 0.5 <= y.left && x.top - 0.5 <= y.top && x.right + 0.5 >= y.right && x.bottom + 0.5 >= y.bottom;
  const pisados = [];
  for (const g of grupos.values()) {
    for (const h of g.values()) {
      for (let i = 0; i < h.length; i += 1) {
        for (let j = i + 1; j < h.length; j += 1) {
          const A = h[i]; const B = h[j];
          if (A.capa !== B.capa) continue;
          const a = A.r; const b = B.r;
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 1 && oy > 1) {
            if (contiene(a, b) || contiene(b, a)) continue;
            pisados.push({ como: 'se pisan', px: `${Math.round(ox)}×${Math.round(oy)}`, a: nombre(A.el), b: nombre(B.el), firma: `${firma(A.el)} y ${firma(B.el)}`, caja: [A.r, B.r].map(rect) });
            continue;
          }
          if (botonDeTexto(A.el) || botonDeTexto(B.el)) continue;
          if (ox > 1 && oy > -(HUECO - 0.05)) {
            const [arr, aba] = a.top <= b.top ? [A, B] : [B, A];
            const ra = radios(cs(arr.el)); const rb = radios(cs(aba.el));
            const agrupadas = Math.abs(a.left - b.left) < 1 && Math.abs(a.right - b.right) < 1 && ra.bl + ra.br < 0.5 && rb.tl + rb.tr < 0.5;
            if (agrupadas) continue;
            pisados.push({ como: 'pegados de arriba abajo', px: (-oy).toFixed(1), a: nombre(arr.el), b: nombre(aba.el), firma: `${firma(arr.el)} y ${firma(aba.el)}`, caja: [A.r, B.r].map(rect) });
          } else if (oy > 1 && ox > -(HUECO - 0.05)) {
            const [izq, der] = a.left <= b.left ? [A, B] : [B, A];
            const ri = radios(cs(izq.el)); const rd = radios(cs(der.el));
            const agrupadas = Math.abs(a.top - b.top) < 1 && Math.abs(a.bottom - b.bottom) < 1 && ri.tr + ri.br < 0.5 && rd.tl + rd.bl < 0.5;
            if (agrupadas) continue;
            pisados.push({ como: 'pegados de lado', px: (-ox).toFixed(1), a: nombre(izq.el), b: nombre(der.el), firma: `${firma(izq.el)} y ${firma(der.el)}`, caja: [A.r, B.r].map(rect) });
          }
        }
      }
    }
  }

  // 2. Textos e iconos que se salen de su tarjeta (o de la pantalla).
  const salidos = [];
  const vistos = new Set();
  /** La tarjeta de [el] (la caja más cercana, empezando por él), si algo
   * recorta o se desliza entre él y ella (`antes`) y si algo recorta más
   * arriba (`arriba`: entonces no se sale de la pantalla, se corta o se
   * desliza). */
  const tarjetaDe = (el) => {
    let t = null; let antes = false; let arriba = false;
    for (let p = el; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const s = cs(p);
      if (!t && esBloque(p) && !esCampo(p)) t = p;
      if (recorta(s)) { arriba = true; if (!t || t === p) antes = true; }
      if (s.position === 'fixed') break;
    }
    return { t, antes, arriba };
  };
  const mira = (el, rects, fs, que, fq) => {
    const { t, antes, arriba } = tarjetaDe(el);
    if (antes && arriba && !t) return;
    for (const r0 of rects) {
      if (r0.width < 0.5 || r0.height < 0.5) continue;
      // Lo que pinta la letra: un «em» centrado en la línea (la caja del
      // texto lleva el hueco de la fuente por arriba y por abajo).
      const m = (r0.top + r0.bottom) / 2;
      const r = { left: r0.left, right: r0.right, top: Math.max(r0.top, m - fs * 0.5), bottom: Math.min(r0.bottom, m + fs * 0.5) };
      let fuera = null;
      if (!arriba && (r.right > W + 1 || r.left < -1)) fuera = { de: 'la pantalla', px: Math.round(r.right > W + 1 ? r.right - W : -r.left) };
      else if (t && !antes) {
        const q = t.getBoundingClientRect();
        const px = Math.max(q.left - r.left, r.right - q.right, q.top - r.top, r.bottom - q.bottom);
        if (px > 1) fuera = { de: nombre(t), px: Math.round(px) };
      }
      if (fuera) {
        const k = `${que}|${fuera.de}`;
        if (!vistos.has(k)) { vistos.add(k); salidos.push({ que, ...fuera, firma: `${fq} de ${t && fuera.de !== 'la pantalla' ? firma(t) : 'la pantalla'}`, caja: [rect(r0)] }); }
        return;
      }
    }
  };
  const recorre = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.data.trim() ? 1 : 2) });
  const rango = document.createRange();
  for (let n = recorre.nextNode(); n; n = recorre.nextNode()) {
    const el = n.parentElement;
    if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION|TEXTAREA|TITLE)$/.test(el.tagName) || el.closest('svg') || !visible(el)) continue;
    rango.selectNodeContents(n);
    mira(el, rango.getClientRects(), parseFloat(cs(el).fontSize) || 16, `«${n.data.trim().replace(/\s+/g, ' ').slice(0, 32)}» (${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/)[0]}` : ''})`, `texto en ${firmaCon(el)}`);
  }
  for (const s of document.body.querySelectorAll('svg')) {
    if (s.parentElement?.closest('svg') || !visible(s)) continue;
    const r = s.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    mira(s.parentElement, [r], r.height, `icono en ${nombre(s.parentElement)}`, `icono en ${firmaCon(s.parentElement)}`);
  }

  // 3. El desplazamiento de lado.
  const x0 = window.scrollX; const y0 = window.scrollY;
  window.scrollTo(100000, y0);
  const px = Math.max(window.scrollX, document.documentElement.scrollWidth - document.documentElement.clientWidth > 1 && cs(document.documentElement).overflowX === 'visible' && cs(document.body).overflowX === 'visible' ? document.documentElement.scrollWidth - document.documentElement.clientWidth : 0);
  window.scrollTo(x0, y0);
  // En el móvil, lo que no cabe ensancha la ventana de la página (se ve más
  // pequeña o se arrastra de lado) aunque `overflow-x: hidden` no la deje
  // desplazar: también cuenta.
  const lado = Math.max(px, matchMedia("(pointer: coarse)").matches && window.innerWidth > W + 1 && visualViewport && visualViewport.width < window.innerWidth - 1 ? Math.round(window.innerWidth - W) : 0);
  const culpables = [];
  if (lado > 1) {
    for (const el of todos) {
      if (culpables.length >= 5) break;
      if (!visible(el) || el.closest('svg')) continue;
      const r = el.getBoundingClientRect();
      if (r.right <= W + 1) continue;
      let dentro = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (recorta(cs(p))) { dentro = true; break; }
        if (p.getBoundingClientRect().right > W + 1) { dentro = true; break; } // ya cuenta su padre
      }
      if (!dentro) culpables.push(`${nombre(el)} (+${Math.round(r.right - W)} px)`);
    }
  }
  return { ancho: W, pisados: pisados.slice(0, MAX), nPisados: pisados.length, salidos: salidos.slice(0, MAX), nSalidos: salidos.length, lateral: { px: lado, culpables } };
}

/** La letra de toda la página ×k, como «Ampliar solo el texto» de Firefox, el
 * tamaño de texto de Android o el `textScaler` de la app (la caja se queda, la
 * letra crece): en cada hoja (`.css`) que pide el navegador, cada `font-size`,
 * `font` y `line-height` en px ×k, y la raíz a 16×k para los rem y em; en los
 * `style=` de la página, lo mismo. Se hace al servir la hoja (no después):
 * lo que la página mide al cargar (la cabecera) ya ve la letra grande, como con
 * la letra del navegador.
 *
 *   await letraGrande(ctx, 1.3);   (antes de abrir la página) */
/** Una hoja con su letra ×k (lo de `letraGrande`). */
export function escalaCss(css, k) {
  const escala = (v) => v.replace(/(-?\d*\.?\d+)px/g, (m, n) => `${(parseFloat(n) * k).toFixed(3)}px`);
  return css.replace(/(^|[;{\s])(font-size|line-height|font)(\s*:\s*)([^;}]*)/g, (m, a, prop, dos, v) => `${a}${prop}${dos}${escala(v)}`);
}
export async function letraGrande(ctx, k) {
  if (!k || k === 1) return;
  const hoja = (css) => escalaCss(css, k);
  await ctx.route(/\.css(\?|$)/, async (route) => {
    try {
      const r = await route.fetch();
      let css = hoja(await r.text());
      css = `html{font-size:${(16 * k).toFixed(3)}px}
${css}`;
      await route.fulfill({ response: r, body: css, headers: { ...r.headers(), 'content-type': 'text/css; charset=utf-8' } });
    } catch { await route.fallback().catch(() => {}); }
  });
  await ctx.addInitScript((k2) => {
    const hechas = new WeakSet();
    const escala = (v) => v.replace(/(-?\d*\.?\d+)px/g, (m, n) => `${(parseFloat(n) * k2).toFixed(3)}px`);
    const toca = (e) => {
      if (hechas.has(e)) return;
      hechas.add(e);
      for (const p of ['font-size', 'line-height', 'font']) {
        const v = e.style.getPropertyValue(p);
        if (v && /\dpx/.test(v)) e.style.setProperty(p, escala(v), e.style.getPropertyPriority(p));
      }
    };
    const todo = () => document.querySelectorAll('[style]').forEach((e) => { if (/font|line-height/.test(e.getAttribute('style'))) toca(e); });
    document.addEventListener('DOMContentLoaded', () => {
      todo();
      new MutationObserver(todo).observe(document.documentElement, { childList: true, subtree: true });
    });
  }, k);
}

/** Para `ctx.addInitScript(sinAnimaciones)`: sin transiciones ni animaciones
 * (se mide lo de después, no un paso intermedio). */
export function sinAnimaciones() {
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style');
    s.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important}';
    document.head.appendChild(s);
  });
}
