/* Explorar › Sitios (tanda D, migración 20261236100000 de la app).
 *
 * Lo mismo para el servidor (Pages Functions: `import KS from
 * '../../assets/sitios.js'`) y para el navegador (script clásico):
 *
 * - `horaTexto(h, tz, lang, ahora)`: la línea del horario de una fila,
 *   «Abierto hasta las 23:00 · Cocina: hasta las 22:30» o «Cerrado · abre
 *   mañana a las 12:00», con la hora del local. Igual que la app
 *   (`placeHoursLine`). `h` es lo que da `public_places` (`hours`).
 * - En el navegador, al cargar: la página sale de la caché unos minutos, así
 *   que cada línea se vuelve a escribir con la hora de ahora (un sitio que ya
 *   ha cerrado no puede seguir diciendo «Abierto»).
 * - El mapa de Sitios (`#mapa-sitios`): todos los sitios del recuadro
 *   (`map_places`, sin sesión), otra vez al moverlo; los que tienen planes
 *   hoy con punto grande (coral, con su nombre) y los demás con punto
 *   pequeño y gris. Tocar uno abre su tarjeta con el enlace a la ficha.
 */
(function () {
  'use strict';

  const T = {
    es: {
      open: 'Abierto',
      openUntil: (h, t) => (h === 1 ? `Abierto hasta la ${t}` : `Abierto hasta las ${t}`),
      kitchenUntil: (t) => `Cocina: hasta las ${t}`,
      kitchenOpen: 'Cocina abierta',
      kitchenClosed: 'Cocina cerrada',
      kitchenOpensAt: (t) => `Cocina cerrada · abre a las ${t}`,
      closed: 'Cerrado',
      opensAt: (t) => `abre a las ${t}`,
      opensTomorrow: (t) => `abre mañana a las ${t}`,
      opensOn: (d, t) => `abre el ${d} a las ${t}`,
      loc: 'es-ES',
    },
    en: {
      open: 'Open',
      openUntil: (h, t) => `Open until ${t}`,
      kitchenUntil: (t) => `Kitchen: until ${t}`,
      kitchenOpen: 'Kitchen open',
      kitchenClosed: 'Kitchen closed',
      kitchenOpensAt: (t) => `Kitchen closed · opens at ${t}`,
      closed: 'Closed',
      opensAt: (t) => `opens at ${t}`,
      opensTomorrow: (t) => `opens tomorrow at ${t}`,
      opensOn: (d, t) => `opens on ${d} at ${t}`,
      loc: 'en-GB',
    },
  };

  const ms = (iso) => (iso ? Date.parse(iso) : NaN);
  const dos = (n) => String(n).padStart(2, '0');

  /** { texto, abierto } con la hora de ahora ([ahora], en ms). */
  function horaTexto(h, tz, lang, ahora) {
    if (!h) return { texto: '', abierto: false };
    const KZ = globalThis.KlendarZona;
    const L = T[lang === 'en' ? 'en' : 'es'];
    const now = Number.isFinite(ahora) ? ahora : Date.now();
    const z = KZ ? KZ.zona(tz) : 'Europe/Madrid';
    const hhmm = (iso) => {
      const p = KZ.partes(iso, z);
      return { h: p.h, t: `${dos(p.h)}:${dos(p.min)}` };
    };
    const cierra = ms(h.closes_at);
    const abre = ms(h.opens_at);
    // La página puede venir de la caché: lo que ya ha pasado manda.
    const abierto = h.open ? !(cierra <= now) : abre <= now;
    if (abierto) {
      const partes = [];
      if (h.open && Number.isFinite(cierra)) {
        const x = hhmm(h.closes_at);
        partes.push(L.openUntil(x.h, x.t));
      } else partes.push(L.open);
      const k = h.open ? h.kitchen : null;
      if (k) {
        const hasta = ms(k.until);
        const kabre = ms(k.opens_at);
        if (k.open && hasta > now) partes.push(L.kitchenUntil(hhmm(k.until).t));
        else if (k.open) partes.push(L.kitchenClosed);
        else if (kabre > now) partes.push(L.kitchenOpensAt(hhmm(k.opens_at).t));
        else if (kabre <= now) partes.push(L.kitchenOpen);
        else partes.push(L.kitchenClosed);
      }
      return { texto: partes.join(' · '), abierto: true };
    }
    if (!(abre > now)) return { texto: L.closed, abierto: false };
    const x = hhmm(h.opens_at);
    const hoy = KZ.dia(now, z);
    const dia = KZ.dia(abre, z);
    const dias = Math.round((Date.parse(`${dia}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 864e5);
    const cuando = dias <= 0 ? L.opensAt(x.t)
      : dias === 1 ? L.opensTomorrow(x.t)
        : L.opensOn(KZ.fmt(h.opens_at, z, L.loc, { weekday: 'long' }), x.t);
    return { texto: `${L.closed} · ${cuando}`, abierto: false };
  }

  const KlendarSitios = { horaTexto };
  globalThis.KlendarSitios = KlendarSitios;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarSitios;

  // ── En el navegador ──────────────────────────────────────────────────────
  if (typeof document === 'undefined') return;

  function horasAlDia() {
    document.querySelectorAll('[data-sitio-hora]').forEach((el) => {
      try {
        const h = JSON.parse(el.getAttribute('data-sitio-hora') || 'null');
        const r = horaTexto(h, el.getAttribute('data-tz'), el.getAttribute('data-lang'));
        if (r.texto) el.textContent = r.texto;
        el.classList.toggle('abierto', r.abierto);
      } catch { /* se queda lo del servidor */ }
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function mapa() {
    const caja = document.getElementById('mapa-sitios');
    if (!caja) return;
    let d = {};
    try { d = JSON.parse(caja.getAttribute('data-sitios') || '{}'); } catch { d = {}; }
    const falla = () => {
      caja.innerHTML = `<p class="empty">${esc(d.no || '')}</p>`;
      caja.classList.add('sin-mapa');
    };
    try {
      const tk = (await (await fetch('/api/mapbox-token')).json()).token;
      if (!tk || !d.url || !d.key) { falla(); return; }
      await new Promise((ok, ko) => {
        const c = document.createElement('link');
        c.rel = 'stylesheet';
        c.href = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.css';
        document.head.append(c);
        const s = document.createElement('script');
        s.src = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.js';
        s.onload = ok;
        s.onerror = ko;
        document.head.append(s);
      });
      const mb = window.mapboxgl;
      mb.accessToken = tk;
      const oscuro = matchMedia('(prefers-color-scheme: dark)').matches;
      const m = new mb.Map({
        container: caja,
        style: oscuro ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
        center: d.centro || [-3.7038, 40.4168],
        zoom: d.zoom || 14,
        performanceMetricsCollection: false,
        collectResourceTiming: false,
        cooperativeGestures: matchMedia('(pointer: coarse)').matches,
      });
      m.addControl(new mb.NavigationControl({ showCompass: false }));
      const coral = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#FF4F6D';
      const tinta = oscuro ? '#FFFFFF' : '#0A0A0A';
      let pedido = 0;
      let espera = null;
      let pop = null;
      const carga = async () => {
        const n = ++pedido;
        const b = m.getBounds();
        try {
          const r = await fetch(`${d.url}/rest/v1/rpc/map_places`, {
            method: 'POST',
            headers: { apikey: d.key, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              p_min_lat: b.getSouth(), p_min_lng: b.getWest(), p_max_lat: b.getNorth(), p_max_lng: b.getEast(),
              ...(d.filtros || {}), p_hide_adults: true,
            }),
          });
          if (!r.ok || n !== pedido) return;
          const filas = await r.json();
          const geo = {
            type: 'FeatureCollection',
            features: (Array.isArray(filas) ? filas : []).filter((f) => isFinite(f.lat) && isFinite(f.lng)).map((f) => ({
              type: 'Feature',
              properties: { nombre: f.name || '', slug: f.slug || f.id, planes: Number(f.plans_today) || 0 },
              geometry: { type: 'Point', coordinates: [Number(f.lng), Number(f.lat)] },
            })),
          };
          if (m.getSource('sitios')) m.getSource('sitios').setData(geo);
          else {
            m.addSource('sitios', { type: 'geojson', data: geo });
            // Sin planes: punto pequeño y gris, sin nombre.
            m.addLayer({
              id: 'sitios-sin', type: 'circle', source: 'sitios', filter: ['==', ['get', 'planes'], 0],
              paint: { 'circle-radius': 5, 'circle-color': '#8E8E93', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5 },
            });
            // Con planes hoy: punto grande, en coral, con su nombre.
            m.addLayer({
              id: 'sitios-con', type: 'circle', source: 'sitios', filter: ['>', ['get', 'planes'], 0],
              paint: { 'circle-radius': 9, 'circle-color': coral, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2.5 },
            });
            m.addLayer({
              id: 'sitios-nombre', type: 'symbol', source: 'sitios', filter: ['>', ['get', 'planes'], 0],
              layout: { 'text-field': ['get', 'nombre'], 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-optional': true },
              paint: { 'text-color': tinta, 'text-halo-color': oscuro ? '#000000' : '#FFFFFF', 'text-halo-width': 1.5 },
            });
            const abre = (e) => {
              const f = e.features && e.features[0];
              if (!f) return;
              const p = f.properties;
              const n = Number(p.planes) || 0;
              const planes = n ? (n === 1 ? d.uno : String(d.varios || '').replace('{n}', n)) : '';
              const a = document.createElement('a');
              a.className = 'pop';
              a.href = `${d.base || '/b/'}${encodeURIComponent(p.slug)}`;
              a.innerHTML = `<b>${esc(p.nombre)}</b>${planes ? `<span class="tag-oferta">${esc(planes)}</span>` : ''}<span>${esc(d.ver || '')}</span>`;
              if (pop) pop.remove();
              pop = new mb.Popup({ offset: 12, closeButton: false, focusAfterOpen: false })
                .setLngLat(f.geometry.coordinates).setDOMContent(a).addTo(m);
            };
            ['sitios-sin', 'sitios-con'].forEach((id) => {
              m.on('click', id, abre);
              m.on('mouseenter', id, () => { m.getCanvas().style.cursor = 'pointer'; });
              m.on('mouseleave', id, () => { m.getCanvas().style.cursor = ''; });
            });
          }
        } catch { /* el próximo movimiento lo vuelve a pedir */ }
      };
      m.on('load', carga);
      m.on('moveend', () => { clearTimeout(espera); espera = setTimeout(carga, 300); });
    } catch { falla(); }
  }

  const empieza = () => { horasAlDia(); mapa(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', empieza);
  else empieza();
})();
