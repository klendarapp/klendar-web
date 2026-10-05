// Traducción automática en las fichas públicas (publicación y negocio).
//
// Solo para quien la ha encendido en «Tu cuenta» → Ajustes («Traducir
// publicaciones a mi idioma»; se guarda en su perfil y aquí en
// `localStorage['klendar.traducir']`). Para el resto este script no hace
// nada: ni una petición.
//
// La página marca lo que se puede traducir con `data-tr="<clave>"` (título,
// descripción y condiciones; descripción de la ficha, novedades y carta) y
// dónde va el aviso con `data-tr-nota="<prefijos>"`. Se pide a la Edge
// Function `translate` con el idioma de la página: nunca se manda el texto,
// solo qué publicación o negocio es; lo traduce el servidor una vez y lo
// guarda. Las reseñas y los nombres no se traducen.
//
// Lo traducido se pinta como texto (sin HTML); «Ver original» devuelve lo
// que venía en la página.
(() => {
  'use strict';

  const yo = document.currentScript;
  let encendido = false;
  try { encendido = localStorage.getItem('klendar.traducir') === '1'; } catch { /* sin permisos */ }
  if (!encendido || !yo) return;

  const url = yo.dataset.url;
  const key = yo.dataset.key;
  const lang = yo.dataset.lang === 'en' ? 'en' : 'es';
  const pedidos = (yo.dataset.pedir || '').split(/\s+/).filter(Boolean)
    .map((x) => { const [kind, id] = x.split(':'); return { kind, id }; })
    .filter((p) => p.kind && /^[0-9a-f-]{36}$/i.test(p.id || ''));
  if (!url || !key || !pedidos.length) return;

  const T = lang === 'en'
    ? { auto: 'Translated automatically', orig: 'Original text', verOrig: 'See original', verTrad: 'See translation' }
    : { auto: 'Traducido automáticamente', orig: 'Texto original', verOrig: 'Ver original', verTrad: 'Ver traducción' };

  // Con sesión de «Tu cuenta», su token (una exclusiva suya también se
  // traduce); sin ella, como cualquiera.
  let token = key;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!/^sb-[a-z0-9]+-auth-token$/.test(k)) continue;
      const s = JSON.parse(localStorage.getItem(k) || 'null');
      if (s && s.access_token && (s.expires_at || 0) * 1000 > Date.now()) token = s.access_token;
    }
  } catch { /* sin sesión */ }

  const pide = (p) => fetch(`${url}/functions/v1/translate`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: p.kind, id: p.id, lang }),
  }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  const ICONO = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style="flex:none"><path fill="currentColor" d="m12.87 15.07-2.54-2.51.03-.03A17.5 17.5 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7 1.62-4.33L19.12 17h-3.24z"/></svg>';

  Promise.all(pedidos.map(pide)).then((res) => {
    const tr = Object.assign({}, ...res.filter((r) => r && r.available).map((r) => r.translations || {}));
    const els = Array.from(document.querySelectorAll('[data-tr]')).filter((el) => typeof tr[el.dataset.tr] === 'string');
    if (!els.length) return;

    const original = new Map(els.map((el) => [el, el.innerHTML]));
    const traduce = (el) => {
      el.textContent = '';
      tr[el.dataset.tr].split('\n').forEach((linea, i) => {
        if (i) el.appendChild(document.createElement('br'));
        el.appendChild(document.createTextNode(linea));
      });
      el.lang = lang;
    };
    let viendoOriginal = false;

    // Los avisos, solo donde algo se ha traducido.
    const claves = Object.keys(tr).filter((k) => els.some((el) => el.dataset.tr === k));
    const notas = Array.from(document.querySelectorAll('[data-tr-nota]')).filter((n) =>
      n.dataset.trNota.split(/\s+/).some((pre) => pre && claves.some((k) => k.startsWith(pre))));
    const pintaNotas = () => notas.forEach((n) => {
      n.innerHTML = `${ICONO}<span></span> · <button type="button"></button>`;
      n.querySelector('span').textContent = viendoOriginal ? T.orig : T.auto;
      const b = n.querySelector('button');
      b.textContent = viendoOriginal ? T.verTrad : T.verOrig;
      Object.assign(b.style, {
        font: 'inherit', fontWeight: '700', color: 'inherit', background: 'none', border: '0',
        padding: '6px 2px', cursor: 'pointer', textDecoration: 'underline', minHeight: '32px',
      });
      b.addEventListener('click', () => {
        viendoOriginal = !viendoOriginal;
        els.forEach((el) => {
          if (viendoOriginal) { el.innerHTML = original.get(el); el.removeAttribute('lang'); } else traduce(el);
        });
        pintaNotas();
        n.querySelector('button').focus();
      });
      Object.assign(n.style, {
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 6px',
        fontSize: '13px', color: 'var(--ink-2, inherit)', margin: '4px 0 10px',
      });
      n.hidden = false;
    });

    els.forEach(traduce);
    pintaNotas();
  });
})();
