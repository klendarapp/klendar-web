// «¿Hay sitio ahora?» en las páginas públicas (ficha del negocio y tarjeta
// del mapa de Explorar): «Animado · hace 20 min».
//
// La página sale de la caché unos minutos y lo marcado caduca a las 2 h y
// solo vale con el local abierto: lo pide el navegador a la base
// (`business_marks`, sin sesión) y lo pinta. Si no hay nada, no sale nada.
//
// Uso: `<p data-sitio-ahora="<id del negocio>" hidden></p>` y este script con
// `data-url`, `data-key` y `data-lang` (necesita /assets/marcas.js antes).
// El mapa llama a `KlendarSitioAhora.pide(ids)` y pinta lo que vuelve.
(function () {
  'use strict';
  const KM = window.KlendarMarcas;
  const yo = document.currentScript;
  if (!KM || !yo) return;
  const url = yo.getAttribute('data-url');
  const key = yo.getAttribute('data-key');
  const lang = yo.getAttribute('data-lang') === 'en' ? 'en' : 'es';
  const ICONOS = {
    // event_seat, groups y do_not_disturb_on (Material), como la app.
    quiet: 'M4 18v3h3v-3h10v3h3v-6H4v3zm15-8h3v3h-3v-3zM2 10h3v3H2v-3zm15 3H7V5c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v8z',
    lively: 'M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58A2.01 2.01 0 0 0 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85A6.95 6.95 0 0 0 20 14c-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z',
    full: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z',
  };

  async function pide(ids) {
    const lista = [...new Set(ids.filter(Boolean))].slice(0, 200);
    if (!url || !key || !lista.length) return {};
    try {
      const r = await fetch(`${url}/rest/v1/rpc/business_marks`, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_ids: lista }),
      });
      if (!r.ok) return {};
      const filas = await r.json();
      return Object.fromEntries((Array.isArray(filas) ? filas : []).map((f) => [f.business_id, f]));
    } catch { return {}; }
  }

  /** «Animado · hace 20 min» con su icono, o '' si no hay nada que decir. */
  function texto(m) {
    if (!m || !m.crowd || !m.crowd_at) return '';
    return `${KM.nivel(m.crowd, lang)} · ${KM.hace(m.crowd_at, lang)}`;
  }
  function pinta(el, m) {
    const t = texto(m);
    if (!t) { el.hidden = true; return; }
    el.innerHTML = `<svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="${ICONOS[m.crowd] || ''}"/></svg><span></span>`;
    el.querySelector('span').textContent = t;
    el.setAttribute('aria-label', (lang === 'en' ? KM.t('en') : KM.t('es')).crowdNowA11y(KM.nivel(m.crowd, lang), KM.hace(m.crowd_at, lang)));
    el.hidden = false;
  }

  async function refresca() {
    const els = [...document.querySelectorAll('[data-sitio-ahora]')];
    if (!els.length) return;
    const datos = await pide(els.map((e) => e.getAttribute('data-sitio-ahora')));
    for (const el of els) pinta(el, datos[el.getAttribute('data-sitio-ahora')]);
  }

  window.KlendarSitioAhora = { pide, texto, ICONOS, lang };
  refresca();
  // «hace 20 min» sigue la hora, y a las 2 h desaparece solo.
  setInterval(refresca, 60000);
})();
