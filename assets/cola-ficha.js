// La cola virtual en la ficha del negocio (/b/<slug>): si hoy está abierta,
// «Cola virtual · 5 esperando · unos 20 min ›», que lleva a coger número
// (la página del cartel). Como la app (`QueueFichaRow`).
//
// La ficha va en caché: lo pide el navegador a la base sin sesión
// (`business_queue_public`, migración 20261281900000). Sin cola abierta, o si
// falla, no sale nada.
//
// Uso: `<p data-cola-ficha="<id del negocio>" data-lang="es|en" hidden></p>`
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
  // Redondeada como la app (`roundWait`).
  const redondea = (m) => (m < 15 ? m : Math.floor((m + 2) / 5) * 5);
  const texto = (q, en) => {
    const n = Number(q.waiting_people) || 0;
    const m = q.wait_minutes == null ? null : redondea(Number(q.wait_minutes));
    return [
      en ? `Virtual queue · ${n} waiting` : `Cola virtual · ${n} esperando`,
      m == null ? '' : m <= 1 ? '1 min' : (en ? `about ${m} min` : `unos ${m} min`),
    ].filter(Boolean).join(' · ');
  };
  const pinta = async (caja) => {
    const id = caja.getAttribute('data-cola-ficha');
    const en = caja.getAttribute('data-lang') === 'en';
    if (!url || !key || !id) return;
    try {
      const r = await fetch(`${url}/rest/v1/rpc/business_queue_public`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_business: id }),
      });
      if (!r.ok) return;
      const q = await r.json();
      if (!q || q.open !== true || !/^[A-Za-z0-9_-]{16}$/.test(q.code || '')) return;
      caja.innerHTML = `<a class="cola-ficha-fila" href="${en ? '/en/queue/' : '/cola/'}${esc(q.code)}">`
        + `<span>${esc(texto(q, en))}</span><span aria-hidden="true">›</span></a>`;
      // Estilo por CSSOM (sin tocar site.css, que va en caché un año).
      const a = caja.firstElementChild;
      Object.assign(a.style, {
        display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center',
        padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--glass-border)',
        background: 'var(--glass)', color: 'inherit', fontWeight: '700', textDecoration: 'none', minHeight: '48px',
      });
      caja.style.margin = '10px 0';
      caja.hidden = false;
    } catch { /* sin red: no sale */ }
  };
  const empieza = () => document.querySelectorAll('[data-cola-ficha]').forEach(pinta);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', empieza);
  else empieza();
})();
