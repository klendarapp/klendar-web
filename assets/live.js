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
  // Cada hora, la de su negocio (Canarias va una por detrás): ver
  // `/assets/zona.js`. Si no ha cargado, Madrid.
  const KZ = window.KlendarZona;
  const cuando = (iso, tz) => {
    if (KZ) return KZ.fmt(iso, tz, LOC, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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

  /** La zona de cada negocio (la agenda no trae coordenadas). */
  const zonas = async (ids) => {
    const unicos = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id || '')))];
    if (!unicos.length || !KZ) return new Map();
    try {
      const r = await fetch(`${env.url}/rest/v1/businesses?select=id,time_zone&id=in.(${unicos.join(',')})`, {
        headers: { apikey: env.key },
      });
      const filas = r.ok ? await r.json() : [];
      return new Map((Array.isArray(filas) ? filas : []).map((f) => [f.id, f.time_zone]));
    } catch { return new Map(); }
  };

  async function pintar(ciudad) {
    const items = await rpc('public_city_agenda', { p_city: ciudad, p_limit: MAX });
    if (!Array.isArray(items) || !items.length) return false;
    const tz = await zonas(items.slice(0, MAX).map((o) => o.business_id));

    lista.innerHTML = items.slice(0, MAX).map((o) => {
      const img = foto(o.images);
      const tag = etiqueta(o.discount, o.price_cents, o.currency);
      return `<a class="tarjeta" href="${base}/o/${esc(o.id)}">
        ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="ph">✦</span>'}
        <span class="tarjeta-cuerpo">
          <b>${esc(o.title)}</b>
          <span class="muted">${esc(o.business_name || '')}</span>
          <span class="tarjeta-meta">
            ${tag ? `<span class="tag">${esc(tag)}</span>` : ''}
            <span>${esc(cuando(o.starts_at, tz.get(o.business_id)))}</span>
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

    // «Qué hacer hoy en Madrid · Valencia…» del titular: la agenda de cada una.
    const enlaces = document.getElementById('liveCiudades');
    if (enlaces) {
      enlaces.innerHTML = ciudades.filter((c) => c.city).slice(0, 5).map((c) => `<a href="${base}${en ? '/whats-on/' : '/agenda/'}${encodeURIComponent(String(c.city).toLowerCase())}/">${esc(c.city)}</a>`).join('');
    }

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
