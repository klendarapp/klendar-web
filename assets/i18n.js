// Motor de traducción del panel y de administración.
//
// Las dos herramientas se escribieron en español y con las frases dentro del
// HTML, que para algo interno está bien. En vez de reescribirlas enteras (y
// arriesgarse a romper lo que funciona), se traduce **lo que se ve**: después
// de pintar cada pantalla se recorren los textos y se cambian por su
// equivalente. Lo que no esté en el diccionario se queda en español: feo,
// pero nunca un hueco en blanco.
//
// Cada herramienta trae su propio diccionario y llama a `makeI18N(EN)`.
'use strict';

function makeI18N(EN) {
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  let lang = 'es';

  try {
    lang = localStorage.getItem('klendar_lang')
      || new URLSearchParams(location.search).get('lang')
      || (/^en/i.test(navigator.language || '') ? 'en' : 'es');
  } catch { lang = 'es'; }
  if (lang !== 'en') lang = 'es';

  // Se compara sin los espacios de los lados, pero se devuelven: si no, se
  // pegan las palabras de al lado.
  const one = (s) => {
    const k = (s || '').trim();
    return k && EN[k] ? s.replace(k, EN[k]) : null;
  };

  /** Traduce lo que ya está pintado dentro de `root`. */
  function translate(root = document.body) {
    if (lang !== 'en' || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const pending = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = one(n.nodeValue);
      if (t) pending.push([n, t]);
    }
    for (const [n, t] of pending) n.nodeValue = t;

    for (const el of root.querySelectorAll('[placeholder],[title],[aria-label],[alt]')) {
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        const t = v && one(v);
        if (t) el.setAttribute(a, t);
      }
    }
    document.documentElement.lang = 'en';
  }

  /** Para textos que se crean a mano (avisos, confirmaciones). */
  const t = (s) => (lang === 'en' && EN[s]) || s;

  function setLang(next) {
    try { localStorage.setItem('klendar_lang', next); } catch { /* sin permisos */ }
    location.reload();
  }

  /** Pinta el botón ES/EN donde se le diga. */
  function pickers(ids) {
    const html = ['es', 'en']
      .map((l) => `<a href="#" data-lang="${l}" class="${lang === l ? 'on' : ''}">${l.toUpperCase()}</a>`)
      .join('');
    for (const id of ids) {
      const el = document.querySelector(id);
      if (!el) continue;
      el.innerHTML = html;
      for (const a of el.querySelectorAll('a')) {
        a.onclick = (e) => { e.preventDefault(); setLang(a.dataset.lang); };
      }
    }
  }

  // Lo que se pinta después (diálogos, listas que se recargan al filtrar,
  // pestañas, carta…) también se traduce: se vigila la página y se traduce
  // cada trozo nuevo. Cambiar el texto de un nodo no añade nodos, así que no
  // se vuelve a disparar a sí mismo.
  if (lang === 'en' && typeof MutationObserver === 'function') {
    let pendientes = [];
    let programado = false;
    const vigila = new MutationObserver((cambios) => {
      for (const c of cambios) {
        for (const n of c.addedNodes) {
          if (n.nodeType === 1) pendientes.push(n);
          else if (n.nodeType === 3 && n.parentElement) pendientes.push(n.parentElement);
        }
      }
      if (programado || !pendientes.length) return;
      programado = true;
      queueMicrotask(() => {
        const lote = pendientes;
        pendientes = [];
        programado = false;
        for (const el of lote) if (el.isConnected) translate(el);
      });
    });
    const empieza = () => vigila.observe(document.body, { childList: true, subtree: true });
    if (document.body) empieza(); else document.addEventListener('DOMContentLoaded', empieza);
  }

  return { get lang() { return lang; }, translate, t, setLang, pickers };
}
