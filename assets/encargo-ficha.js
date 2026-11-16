// Encargos en la ficha del negocio (/b/<slug>): si tiene algo para encargar,
// «Hacer un encargo ›» con lo que se encarga, que lleva a encargar en «Tu
// cuenta» (/cuenta/encargar/<negocio>). Como la app (`PreorderFichaRow`).
//
// La ficha va en caché: lo pide el navegador a la base sin sesión
// (`preorder_menu`, migración 20261284000000). Con el interruptor apagado,
// sin nada activo o si falla, no sale nada.
//
// Uso: `<p data-encargo-ficha="<id del negocio>" data-lang="es|en" hidden></p>`
// y este script con `data-url` y `data-key`.
(function () {
  'use strict';
  const yo = document.currentScript;
  if (!yo) return;
  const url = yo.getAttribute('data-url');
  const key = yo.getAttribute('data-key');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  const pinta = async (caja) => {
    const id = caja.getAttribute('data-encargo-ficha');
    const en = caja.getAttribute('data-lang') === 'en';
    if (!url || !key || !/^[0-9a-f-]{36}$/.test(id || '')) return;
    try {
      const r = await fetch(`${url}/rest/v1/rpc/preorder_menu`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_business: id }),
      });
      if (!r.ok) return;
      const m = await r.json();
      if (!m || m.enabled !== true || !Array.isArray(m.items) || !m.items.length) return;
      const que = m.items.slice(0, 3).map((i) => i.name).join(' · ');
      caja.innerHTML = `<a class="encargo-ficha-fila" href="${en ? '/en' : ''}/cuenta/encargar/${esc(id)}">`
        + `<span><b>${esc(en ? 'Place a pre-order' : 'Hacer un encargo')}</b><br><small>${esc(que)}</small></span>`
        + '<span aria-hidden="true">›</span></a>';
      const a = caja.firstElementChild;
      Object.assign(a.style, {
        display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center',
        padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--glass-border)',
        background: 'var(--glass)', color: 'inherit', textDecoration: 'none', minHeight: '48px',
      });
      caja.style.margin = '10px 0';
      caja.hidden = false;
    } catch { /* sin red: no sale */ }
  };
  const empieza = () => document.querySelectorAll('[data-encargo-ficha]').forEach(pinta);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', empieza);
  else empieza();
})();
