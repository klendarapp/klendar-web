// «Ahora mismo» en la portada: las próximas publicaciones de verdad.
//
// La portada contaba lo que es Klendar pero no enseñaba ni una sola cosa
// real. Esto trae las que vienen en la ciudad con más movimiento y las pinta
// debajo del titular. Si no hay nada o falla la conexión, **la sección no
// aparece**: mejor sin sección que con un hueco vacío.
//
// Solo lee datos públicos (los mismos que la agenda) con la clave publicable
// de `/config.js`. No pide ubicación ni pone cookies.
(() => {
  'use strict';

  const env = window.KLENDAR_ENV || {};
  const seccion = document.getElementById('ahora');
  const lista = document.getElementById('liveList');
  if (!env.url || !env.key || !seccion || !lista) return;

  const en = document.documentElement.lang === 'en';
  const LOC = en ? 'en-GB' : 'es-ES';
  const MAX = 4;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (c, cur = 'EUR') => (c == null ? '' : (c / 100)
    .toLocaleString(en ? 'en-IE' : 'es-ES', { style: 'currency', currency: cur }));
  const cuando = (iso) => {
    try {
      return new Intl.DateTimeFormat(LOC, {
        timeZone: 'Europe/Madrid', weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(iso));
    } catch { return ''; }
  };
  const etiqueta = (d, price, cur) => {
    if (d) {
      if (d.type === 'percent') return `−${d.value} %`;
      if (d.type === 'fixed') return money(Math.round(Number(d.value) * 100), d.currency || cur);
      if (d.type === '2x1') return '2x1';
      if (d.type === 'free') return en ? 'Free' : 'Gratis';
      if (d.type === 'other' && d.value) return String(d.value);
    }
    return money(price, cur);
  };
  const foto = (imgs) => (imgs || []).find((u) => !/\.(mp4|mov|webm)(\?|$)/i.test(u));

  const rpc = async (fn, body) => {
    const r = await fetch(`${env.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: env.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return r.ok ? r.json() : null;
  };

  const base = en ? '/en' : '';

  async function pintar(ciudad) {
    const items = await rpc('public_city_agenda', { p_city: ciudad, p_limit: MAX });
    if (!Array.isArray(items) || !items.length) return false;

    lista.innerHTML = items.slice(0, MAX).map((o) => {
      const img = foto(o.images);
      const tag = etiqueta(o.discount, o.price_cents, o.currency);
      return `<a class="ocard" href="${base}/o/${esc(o.id)}">
        ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="ph">✦</span>'}
        <span class="ocard-body">
          <b>${esc(o.title)}</b>
          <span class="muted">${esc(o.business_name || '')}</span>
          <span class="ocard-meta">
            ${tag ? `<span class="tag">${esc(tag)}</span>` : ''}
            <span class="muted">${esc(cuando(o.starts_at))}</span>
          </span>
        </span>
      </a>`;
    }).join('');

    const todas = document.getElementById('liveAll');
    if (todas) {
      todas.href = `${base}${en ? '/whats-on/' : '/agenda/'}${encodeURIComponent(ciudad.toLowerCase())}/`;
    }
    return true;
  }

  (async () => {
    const ciudades = (await rpc('public_cities')) || [];
    if (!Array.isArray(ciudades) || !ciudades.length) return;

    // La primera es la que más se mueve, no la más cercana: aquí no se pide
    // la ubicación de nadie. Si hay varias, que se pueda cambiar.
    const inicial = ciudades[0].city;
    if (!await pintar(inicial)) return;

    const donde = document.getElementById('liveCity');
    if (donde) {
      if (ciudades.length > 1) {
        donde.innerHTML = `<select id="liveSelect" aria-label="${en ? 'City' : 'Ciudad'}">`
          + ciudades.map((c) => `<option value="${esc(c.city)}">${esc(c.city)}</option>`).join('')
          + '</select>';
        document.getElementById('liveSelect').onchange = (e) => pintar(e.target.value);
      } else {
        donde.textContent = `${en ? 'in' : 'en'} ${inicial}`;
      }
    }
    seccion.hidden = false;
  })().catch(() => { /* sin conexión: la sección se queda escondida */ });
})();
