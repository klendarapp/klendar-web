// Motor de traducción de «Tu cuenta», del panel y de administración.
//
// Las tres herramientas se escribieron en español y con las frases dentro del
// HTML. En vez de reescribirlas enteras (y arriesgarse a romper lo que
// funciona), se traduce **lo que se ve**: después de pintar cada pantalla se
// recorren los textos y se cambian por su equivalente. Lo que no esté en el
// diccionario se queda en español: feo, pero nunca un hueco en blanco.
//
// Idiomas: español (la fuente), inglés (diccionario dentro de cada
// herramienta: `makeI18N(EN)`) y catalán, gallego, euskera, francés, alemán e
// italiano, cada uno en su propio fichero (`/app/i18n/<lang>.js`,
// `/panel/i18n/<lang>.js`) que solo se descarga si es el que toca. Ese fichero
// lo escribe aquí abajo `document.write` mientras se lee la página, así que
// está cargado antes de que arranque nada (y no hace falta nada en línea: la
// CSP no lo deja). Quien lo pide es la etiqueta de este script:
//   <script src="/assets/i18n.js?v=…" data-dic="/app/i18n/" data-dic-v="3">
// (`data-dic-v` lo sube tools/i18n_merge.py al meter traducciones).
//
// Las claves pueden llevar huecos: `'Quedan {n} plazas': 'Queden {n} places'`
// traduce «Quedan 3 plazas» a «Queden 3 places». Primero se busca la frase
// exacta; si no está, la plantilla más concreta que encaje.
//
// Las páginas públicas (landing, legales, fichas…) solo existen en español e
// inglés: `esOEn(lang)` dice a cuál mandar a cada idioma.
'use strict';

/** Los idiomas de «Tu cuenta» y del panel, con su nombre en su idioma. */
const KL_IDIOMAS = ['es', 'en', 'ca', 'gl', 'eu', 'fr', 'de', 'it'];
const KL_NOMBRE_IDIOMA = {
  es: 'Español', en: 'English', ca: 'Català', gl: 'Galego',
  eu: 'Euskara', fr: 'Français', de: 'Deutsch', it: 'Italiano',
};
/** El `locale` de `Intl` (fechas, números, monedas) de cada idioma. */
const KL_LOCALES = {
  es: 'es-ES', en: 'en-GB', ca: 'ca-ES', gl: 'gl-ES',
  eu: 'eu-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT',
};
const KL_LOCALE = (lang) => KL_LOCALES[lang] || 'es-ES';

/** La versión de las páginas públicas para un idioma: quien lee francés,
 * alemán o italiano entiende mejor el inglés; catalán, gallego y euskera, el
 * español. */
function esOEn(lang) {
  return /^(en|fr|de|it)$/.test(String(lang || '').toLowerCase()) ? 'en' : 'es';
}

/** «ca-ES-valencia» → «ca», «en_GB» → «en»… y null si no es de los nuestros. */
function klIdioma(s) {
  const l = String(s || '').toLowerCase().split(/[-_]/)[0];
  return KL_IDIOMAS.includes(l) ? l : null;
}

/** El idioma elegido: el guardado, el de `?lang=` o el del navegador. Un
 * `?lang=en|es` que llega de una página pública solo dice en qué versión
 * estaba (solo hay dos): si el navegador está en un idioma de ese mismo lado
 * (francés → inglés, catalán → español), gana el del navegador. */
function klIdiomaElegido(admitidos = KL_IDIOMAS) {
  let guardado = null;
  let pedido = null;
  let navegador = null;
  try { guardado = klIdioma(localStorage.getItem('klendar_lang')); } catch { /* sin permisos */ }
  try { pedido = klIdioma(new URLSearchParams(location.search).get('lang')); } catch { /* sin URL */ }
  try {
    for (const l of [...(navigator.languages || []), navigator.language]) {
      navegador = klIdioma(l);
      if (navegador) break;
    }
  } catch { /* sin navegador */ }
  let lang = guardado || pedido || navegador || 'es';
  if (!guardado && pedido && navegador && (pedido === 'es' || pedido === 'en')
    && esOEn(navegador) === pedido) lang = navegador;
  if (admitidos.includes(lang)) return lang;
  return admitidos.includes(esOEn(lang)) ? esOEn(lang) : 'es';
}

// ── Diccionarios de los idiomas nuevos ─────────────────────────────────────
/** Lo que ha cargado `/…/i18n/<lang>.js` (`KL_DIC('ca', {…})`). */
const KL_DICCIONARIOS = {};
function KL_DIC(lang, dic) {
  KL_DICCIONARIOS[lang] = Object.assign(KL_DICCIONARIOS[lang] || {}, dic);
}

// Si la página pide diccionario y el idioma es uno de los nuevos, se escribe
// su <script> justo después de este: el navegador lo carga y lo ejecuta antes
// de seguir con los demás.
(() => {
  const yo = document.currentScript;
  const ruta = yo?.dataset?.dic;
  if (!ruta) return;
  const lang = klIdiomaElegido();
  if (lang === 'es' || lang === 'en') return;
  const v = encodeURIComponent(yo.dataset.dicV || '1');
  document.write(`<script src="${ruta}${lang}.js?v=${v}"><\/script>`);
})();

/** Prepara un diccionario {español: traducción}: las frases exactas y las
 * plantillas con huecos (`{n}`). Devuelve `trad(texto)` → traducción o null. */
function klTraductor(dic) {
  const exactas = new Map();
  const plantillas = [];
  for (const [k, v] of Object.entries(dic || {})) {
    if (typeof v !== 'string' || !v) continue;
    if (!/\{\w+\}/.test(k)) { exactas.set(k, v); continue; }
    const nombres = [];
    const trozos = k.split(/\{(\w+)\}/);
    let re = '^';
    let fijo = '';
    trozos.forEach((x, i) => {
      if (i % 2) { nombres.push(x); re += '([\\s\\S]+?)'; } else {
        re += x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (x.trim().length > fijo.length) fijo = x.trim();
      }
    });
    // Sin nada fijo con letras no es una frase: no se usa.
    if (!/\p{L}/u.test(trozos.filter((_, i) => !(i % 2)).join(''))) continue;
    const largo = trozos.filter((_, i) => !(i % 2)).join('').length;
    plantillas.push({ re: new RegExp(`${re}$`), nombres, fijo, largo, v });
  }
  // La más concreta primero: «Quedan {n} plazas» antes que «{n} plazas».
  plantillas.sort((a, b) => b.largo - a.largo);
  // Lo que va en un hueco también puede estar en el diccionario («Abre el
  // {dia}» con «lunes»): se prueba la frase exacta.
  const hueco = (x) => {
    const k = x.trim();
    const e = exactas.get(k);
    return e ? x.replace(k, () => e) : x;
  };
  return (k) => {
    if (!k) return null;
    const e = exactas.get(k);
    if (e) return e;
    for (const p of plantillas) {
      if (p.fijo && !k.includes(p.fijo)) continue;
      const m = p.re.exec(k);
      if (!m) continue;
      const val = {};
      p.nombres.forEach((n, i) => { val[n] = m[i + 1]; });
      return p.v.replace(/\{(\w+)\}/g, (todo, n) => (n in val ? hueco(val[n]) : todo));
    }
    return null;
  };
}

/** Para los módulos de /assets que pintan con su propia tabla {es, en}
 * (tarjeta, emisiones…): en un idioma nuevo, la tabla española pasada por el
 * diccionario cargado. Las funciones de la tabla devuelven su texto
 * traducido. Sin diccionario, la española tal cual. */
let KL_TRAD_GLOBAL = null;
function KL_TABLA(tabla, lang) {
  const dic = KL_DICCIONARIOS[lang];
  if (!dic || !tabla) return tabla;
  if (!KL_TRAD_GLOBAL || KL_TRAD_GLOBAL.dic !== dic) KL_TRAD_GLOBAL = { dic, trad: klTraductor(dic), cache: new WeakMap() };
  const g = KL_TRAD_GLOBAL;
  if (g.cache.has(tabla)) return g.cache.get(tabla);
  const una = (s) => {
    const k = String(s).trim();
    const r = g.trad(k);
    return r ? String(s).replace(k, () => r) : s;
  };
  // Recorre la tabla entera: textos, funciones que devuelven texto y listas o
  // tablas de dentro (los niveles de precio, los nombres de los deportes…).
  const pasa = (v) => {
    if (typeof v === 'string') return una(v);
    if (typeof v === 'function') return (...a) => { const r = v(...a); return typeof r === 'string' ? una(r) : r; };
    if (Array.isArray(v)) return v.map(pasa);
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      const o = {};
      for (const [k, x] of Object.entries(v)) o[k] = pasa(x);
      return o;
    }
    return v;
  };
  const fuera = pasa(tabla);
  g.cache.set(tabla, fuera);
  return fuera;
}
globalThis.KL_TABLA = KL_TABLA;
/** Un texto suelto en español, por el diccionario cargado de `lang`. */
const KL_TEXTO = (s, lang) => KL_TABLA({ s }, lang).s;
globalThis.KL_TEXTO = KL_TEXTO;
globalThis.KL_LOCALE = KL_LOCALE;
globalThis.esOEn = esOEn;

/**
 * El traductor de una herramienta.
 * @param EN diccionario español → inglés de la herramienta.
 * @param opts.idiomas los que admite (el administrador, solo `['es','en']`).
 */
function makeI18N(EN, opts = {}) {
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const idiomas = opts.idiomas || KL_IDIOMAS;
  const lang = klIdiomaElegido(idiomas);
  const dic = lang === 'en' ? EN : lang === 'es' ? null : (KL_DICCIONARIOS[lang] || {});
  const trad = dic ? klTraductor(dic) : () => null;

  // Se compara sin los espacios de los lados, pero se devuelven: si no, se
  // pegan las palabras de al lado.
  const one = (s) => {
    const k = (s || '').trim();
    const r = k && trad(k);
    return r ? s.replace(k, () => r) : null;
  };

  // Lo marcado con `translate="no"` ya viene en su idioma o lo ha escrito
  // alguien (la tarjeta de una publicación, pintada por /assets/tarjeta.js,
  // con el título que puso el negocio): no se toca.
  const fuera = (el) => !!el?.closest?.('[translate="no"]');

  /** Traduce lo que ya está pintado dentro de `root`. */
  function translate(root = document.body) {
    if (lang === 'es' || !root || fuera(root)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const pending = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = one(n.nodeValue);
      if (t && !fuera(n.parentElement)) pending.push([n, t]);
    }
    for (const [n, t] of pending) n.nodeValue = t;

    for (const el of root.querySelectorAll('[placeholder],[title],[aria-label],[alt]')) {
      if (fuera(el)) continue;
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        const t = v && one(v);
        if (t) el.setAttribute(a, t);
      }
    }
    document.documentElement.lang = lang;
  }

  /** Para textos que se crean a mano (avisos, confirmaciones). */
  const t = (s) => (lang !== 'es' && typeof s === 'string' && trad(s)) || s;

  function setLang(next) {
    try { localStorage.setItem('klendar_lang', next); } catch { /* sin permisos */ }
    // Un `?lang=` en la dirección ya no manda: se quita al recargar.
    try {
      const u = new URL(location.href);
      if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); location.replace(u.href); return; }
    } catch { /* sin URL */ }
    location.reload();
  }

  /** Pinta el selector de idioma donde se le diga: ES/EN con dos idiomas y
   * un desplegable (cada idioma con su nombre en su idioma) con más. */
  function pickers(ids) {
    const html = idiomas.length > 2
      ? `<select class="lang-sel" aria-label="Idioma / Language">${idiomas
        .map((l) => `<option value="${l}" lang="${l}"${lang === l ? ' selected' : ''}>${KL_NOMBRE_IDIOMA[l]}</option>`)
        .join('')}</select>`
      : idiomas
        .map((l) => `<a href="#" data-lang="${l}" class="${lang === l ? 'on' : ''}">${l.toUpperCase()}</a>`)
        .join('');
    for (const id of ids) {
      const els = typeof id === 'string' ? document.querySelectorAll(id) : [id];
      for (const el of els) {
        if (!el) continue;
        el.innerHTML = html;
        el.classList.toggle('lang-lista', idiomas.length > 2);
        for (const a of el.querySelectorAll('a')) {
          a.onclick = (e) => { e.preventDefault(); setLang(a.dataset.lang); };
        }
        const sel = el.querySelector('select');
        if (sel) sel.onchange = () => setLang(sel.value);
      }
    }
  }

  // Lo que se pinta después (diálogos, listas que se recargan al filtrar,
  // pestañas, carta…) también se traduce: se vigila la página y se traduce
  // cada trozo nuevo. Cambiar el texto de un nodo no añade nodos, así que no
  // se vuelve a disparar a sí mismo.
  if (lang !== 'es' && typeof MutationObserver === 'function') {
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

  return {
    /** El idioma real (uno de `idiomas`). */
    get lang() { return lang; },
    /** El `locale` de `Intl` de ese idioma. */
    get locale() { return KL_LOCALE(lang); },
    /** La versión de las páginas públicas que le toca: 'es' o 'en'. */
    get pub() { return esOEn(lang); },
    translate, t, setLang, pickers,
  };
}
