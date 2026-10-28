// Traducción a petición en las fichas públicas (publicación y negocio), como
// la app (Iván, 2026-10-28; como «Ver traducción» de Instagram o X).
//
// El texto sale siempre en su idioma. Debajo de lo que está en otro idioma
// que el de la página sale un «Traducir» pequeño (icono de traducir, en
// tinta): al tocarlo se traduce ahí mismo (la aguja pequeña mientras llega)
// y pasa a «Ver original» con «Traducido automáticamente · Google
// Translate». Si falla o se ha llegado al tope del mes: «No se ha podido
// traducir ahora» (tocándolo, otra vez) y el texto sigue en el original.
// Con «Traducir siempre automáticamente» («Tu cuenta» → Ajustes; aquí,
// `localStorage['klendar.traducir']`) sale ya traducido, sin tocar nada.
//
// La página marca lo traducible con `data-tr="<clave>"` y dónde va cada
// «Traducir» con `data-tr-nota="<prefijos>"` (la publicación, la descripción
// de la ficha, cada novedad, «Qué pedir aquí» y la carta). Si nada está en
// otro idioma, este script no pide nada. Se pide a la Edge Function
// `translate` con el idioma de la página y `only` (solo lo de ese
// «Traducir»): nunca se manda el texto. Las reseñas, las preguntas y los
// nombres no se traducen. Lo traducido se pinta como texto (sin HTML) y se
// marca como traducción automática (`lang="en-x-mtfrom-es"`, lo pide Google).
(() => {
  'use strict';

  const yo = document.currentScript;
  if (!yo || !globalThis.KIdioma) return;
  const url = yo.dataset.url;
  const key = yo.dataset.key;
  const lang = yo.dataset.lang === 'en' ? 'en' : 'es';
  const pedidos = (yo.dataset.pedir || '').split(/\s+/).filter(Boolean)
    .map((x) => { const [kind, id] = x.split(':'); return { kind, id }; })
    .filter((p) => p.kind && /^[0-9a-f-]{36}$/i.test(p.id || ''));
  if (!url || !key || !pedidos.length) return;

  let siempre = false;
  try { siempre = localStorage.getItem('klendar.traducir') === '1'; } catch { /* sin permisos */ }

  const T = lang === 'en'
    ? { tr: 'Translate', orig: 'See original', verTr: 'See translation', auto: 'Translated automatically',
      falla: "Couldn't translate right now", mismo: "It's already in your language", traduciendo: 'Translating…' }
    : { tr: 'Traducir', orig: 'Ver original', verTr: 'Ver traducción', auto: 'Traducido automáticamente',
      falla: 'No se ha podido traducir ahora', mismo: 'Ya está en tu idioma', traduciendo: 'Traduciendo…' };
  const PROVEEDOR = { google: 'Google Translate', deepl: 'DeepL' };

  // Cada «Traducir»: sus prefijos, sus textos y de qué publicación o ficha.
  const kindDe = (pre) => (pre.startsWith('offer:') ? 'offer' : pre.startsWith('menu_') ? 'menu' : 'business');
  const unidades = Array.from(document.querySelectorAll('[data-tr-nota]')).map((nota) => {
    const prefijos = nota.dataset.trNota.split(/\s+/).filter(Boolean);
    const kind = kindDe(prefijos[0] || '');
    const pedido = pedidos.find((p) => p.kind === kind);
    const els = Array.from(document.querySelectorAll('[data-tr]'))
      .filter((el) => prefijos.some((p) => el.dataset.tr.startsWith(p)));
    // La carta entera de una vez (sus claves no llevan el negocio).
    return { nota, prefijos, kind, pedido, els, only: kind === 'menu' ? null : prefijos,
      original: new Map(els.map((el) => [el, el.innerHTML])), estado: 'nada', viendoOriginal: false };
  }).filter((u) => u.pedido && u.els.length
    && KIdioma.hayQueTraducir(u.els.map((el) => el.textContent).join('\n'), lang));
  if (!unidades.length) return;

  // Con «Tu cuenta», su sesión (una exclusiva suya también se traduce); sin
  // ella, como cualquiera.
  let token = key;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!/^sb-[a-z0-9]+-auth-token$/.test(k)) continue;
      const s = JSON.parse(localStorage.getItem(k) || 'null');
      if (s && s.access_token && (s.expires_at || 0) * 1000 > Date.now()) token = s.access_token;
    }
  } catch { /* sin sesión */ }

  const llama = (body) => fetch(`${url}/functions/v1/translate`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  // ¿Hay proveedor? (sin clave, ni «Traducir»). Se recuerda 10 minutos.
  const disponible = () => {
    try {
      const c = JSON.parse(sessionStorage.getItem('klendar.traducir.ok') || 'null');
      if (c && c.t > Date.now() - 600e3) return Promise.resolve(c.ok);
    } catch { /* sin permisos */ }
    return llama({ op: 'status' }).then((r) => {
      const ok = !!(r && r.available);
      try { sessionStorage.setItem('klendar.traducir.ok', JSON.stringify({ ok, t: Date.now() })); } catch { /* */ }
      return ok;
    });
  };

  const ICONO = '<svg class="tr-ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="m12.87 15.07-2.54-2.51.03-.03A17.5 17.5 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7 1.62-4.33L19.12 17h-3.24z"/></svg>';
  // La aguja de Klendar, pequeña y del color del texto (la del botón ocupado).
  const AGUJA = '<svg class="tr-ic tr-aguja" viewBox="0 0 64 64" width="16" height="16" aria-hidden="true"><path d="M32 6.8A25.2 25.2 0 1 1 8.03 24.21" fill="none" stroke="currentColor" stroke-width="8.4" stroke-linecap="round"/><g class="simbolo-aguja"><path d="M32 32V19.4" stroke="currentColor" stroke-width="5.6" stroke-linecap="round"/></g><circle cx="32" cy="32" r="5.6" fill="currentColor"/></svg>';

  const textos = {};
  const origenes = {};
  let proveedor = null;

  const pintaTexto = (el) => {
    el.textContent = '';
    textos[el.dataset.tr].split('\n').forEach((linea, i) => {
      if (i) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(linea));
    });
    el.lang = `${lang}-x-mtfrom-${origenes[el.dataset.tr] || 'und'}`;
  };

  const pinta = (u) => {
    const n = u.nota;
    n.classList.add('tr-nota');
    n.setAttribute('aria-live', 'polite');
    n.hidden = false;
    const traducido = u.estado === 'hecho' && !u.viendoOriginal;
    u.els.forEach((el) => {
      if (traducido && typeof textos[el.dataset.tr] === 'string') pintaTexto(el);
      else { el.innerHTML = u.original.get(el); el.removeAttribute('lang'); }
    });
    const boton = (ic = ICONO, apagado = false) =>
      `<button type="button" class="tr-boton"${apagado ? ' disabled' : ''}>${ic}<span></span></button>`;
    switch (u.estado) {
      case 'pidiendo':
        n.innerHTML = boton(AGUJA, true);
        n.querySelector('span').textContent = T.tr;
        n.querySelector('button').setAttribute('aria-label', T.traduciendo);
        return;
      case 'hecho':
        n.innerHTML = `${boton()}${u.viendoOriginal ? '' : '<small class="tr-atrib"></small>'}`;
        n.querySelector('span').textContent = u.viendoOriginal ? T.verTr : T.orig;
        if (!u.viendoOriginal) n.querySelector('small').textContent = `${T.auto} · ${PROVEEDOR[proveedor] || PROVEEDOR.google}`;
        return;
      case 'mismo':
        n.innerHTML = `<span class="tr-mismo">${ICONO}<span></span></span>`;
        n.querySelector('span span').textContent = T.mismo;
        return;
      case 'falla':
        n.innerHTML = boton();
        n.querySelector('button').classList.add('tr-falla');
        n.querySelector('span').textContent = T.falla;
        return;
      default:
        n.innerHTML = boton();
        n.querySelector('span').textContent = T.tr;
    }
  };

  // Lo pedido a la vez a la misma publicación o ficha va en una llamada.
  const pide = (lista) => {
    const porPedido = new Map();
    for (const u of lista) {
      u.estado = 'pidiendo';
      pinta(u);
      const k = `${u.kind}:${u.pedido.id}`;
      if (!porPedido.has(k)) porPedido.set(k, []);
      porPedido.get(k).push(u);
    }
    return Promise.all([...porPedido.values()].map(async (grupo) => {
      const { kind, id } = grupo[0].pedido;
      const todo = grupo.some((u) => !u.only);
      const only = todo ? undefined : [...new Set(grupo.flatMap((u) => u.only))].slice(0, 60);
      const r = await llama({ kind, id, lang, ...(only ? { only } : {}) });
      const ok = r && r.available;
      if (ok) {
        Object.assign(textos, r.translations || {});
        Object.assign(origenes, r.from || {});
        proveedor = r.provider || proveedor;
      }
      const mismos = new Set(ok && Array.isArray(r.same) ? r.same : []);
      for (const u of grupo) {
        const mias = u.els.map((el) => el.dataset.tr);
        u.estado = ok && mias.some((k) => typeof (r.translations || {})[k] === 'string') ? 'hecho'
          : ok && mias.some((k) => mismos.has(k)) ? 'mismo' : 'falla';
        u.viendoOriginal = false;
        pinta(u);
      }
    }));
  };

  disponible().then((ok) => {
    if (!ok) return;
    for (const u of unidades) {
      pinta(u);
      u.nota.addEventListener('click', (ev) => {
        if (!ev.target.closest('button')) return;
        if (u.estado === 'hecho') {
          u.viendoOriginal = !u.viendoOriginal;
          pinta(u);
          u.nota.querySelector('button')?.focus();
        } else if (u.estado === 'nada' || u.estado === 'falla') {
          pide([u]).then(() => u.nota.querySelector('button')?.focus());
        }
      });
    }
    if (siempre) pide(unidades);
  });
})();
