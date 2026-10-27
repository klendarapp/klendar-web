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
 *   (`map_places`, sin sesión), otra vez al moverlo, con los marcadores de
 *   Planes (`KlendarAgrupa.capa`, GLOSARIO «Aspecto › El mapa»): el logo o el
 *   icono de su categoría; anillo coral si tienen una oferta hoy, en tinta si
 *   tienen planes hoy (con su nombre de cerca), sin anillo si no. Tocar uno
 *   abre su tarjeta con el enlace a la ficha.
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
      holidayOpens: (d, h) => `Abre el festivo del ${d} (${h})`,
      holidayClosed: (d) => `Cerrado el festivo del ${d}`,
      holidayUnknown: (d) => `Festivo del ${d}: horario sin confirmar`,
      dailyMenu: 'Menú del día',
      highlight: (x) => `Qué pedir aquí: ${x}`,
      plansToday: (n) => (n === 1 ? '1 plan hoy' : `${n} planes hoy`),
      seePlace: 'Ver el sitio',
      placesHere: (n) => (n === 1 ? '1 sitio aquí' : `${n} sitios aquí`),
      seeMore: (n) => `Ver ${n} más`,
      close: 'Cerrar',
      places: (n) => (n === 1 ? '1 sitio' : `${n} sitios`),
      zoomIn: 'Acercar',
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
      holidayOpens: (d, h) => `Open on the ${d} holiday (${h})`,
      holidayClosed: (d) => `Closed on the ${d} holiday`,
      holidayUnknown: (d) => `${d} holiday: hours not confirmed`,
      dailyMenu: 'Daily menu',
      highlight: (x) => `What to order here: ${x}`,
      plansToday: (n) => (n === 1 ? '1 plan today' : `${n} plans today`),
      seePlace: 'See the place',
      placesHere: (n) => (n === 1 ? '1 place here' : `${n} places here`),
      seeMore: (n) => `See ${n} more`,
      close: 'Close',
      places: (n) => (n === 1 ? '1 place' : `${n} places`),
      zoomIn: 'Zoom in',
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

  /** «12,50 €» / «€12.50». */
  const precio = (c, en) => (Number.isFinite(c)
    ? (en ? `€${(c / 100).toFixed(2)}` : `${(c / 100).toFixed(2).replace('.', ',')} €`) : '');

  /**
   * Lo que dice un sitio debajo de su nombre, igual en la fila de la lista y
   * en la tarjeta del mapa (como `PlaceDetails` en la app): el horario de
   * ahora, el festivo de esta semana (como la ficha), su menú del día o «Qué
   * pedir aquí» y «2 planes hoy». `p` es una fila de `public_places` o
   * `place_card`.
   */
  function partes(p, lang, ahora) {
    const en = lang === 'en';
    const L = T[en ? 'en' : 'es'];
    const KZ = globalThis.KlendarZona;
    const tz = KZ ? KZ.zona(p.time_zone) : 'Europe/Madrid';
    const h = p.holiday;
    let festivo = null;
    if (h && /^\d{4}-\d{2}-\d{2}$/.test(String(h.day))) {
      const dia = new Intl.DateTimeFormat(L.loc, { day: 'numeric', month: 'long', timeZone: 'UTC' })
        .format(new Date(`${h.day}T00:00:00Z`));
      const tramos = (Array.isArray(h.hours) ? h.hours : []).filter((t) => Array.isArray(t)).map((t) => `${t[0]}–${t[1]}`).join(', ');
      festivo = {
        texto: h.state === 'unknown' ? L.holidayUnknown(dia)
          : h.state === 'closed' || !tramos ? L.holidayClosed(dia) : L.holidayOpens(dia, tramos),
        sinConfirmar: h.state === 'unknown',
      };
    }
    const menu = p.daily_menu;
    const extra = menu
      ? { tipo: 'menu', texto: [L.dailyMenu, precio(Number(menu.price_cents), en)].filter(Boolean).join(' · ') }
      : p.highlight && p.highlight.title ? { tipo: 'estrella', texto: L.highlight(p.highlight.title) } : null;
    const n = Number(p.plans_today) || 0;
    return {
      tz,
      hora: horaTexto(p.hours, tz, en ? 'en' : 'es', ahora),
      festivo,
      extra,
      planes: n ? L.plansToday(n) : '',
      ver: L.seePlace,
    };
  }

  const esc0 = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  const ICONOS = {
    menu: 'M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z',
    estrella: 'M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z',
  };
  const icono = (n) => `<svg class="ic" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="${ICONOS[n]}"/></svg>`;

  /** Las líneas de [partes] en HTML: la fila (servidor) y la tarjeta del
   * mapa (navegador) pintan exactamente esto. */
  function detallesHtml(p, lang, ahora) {
    const x = partes(p, lang, ahora);
    return [
      x.hora.texto ? `<span class="sitio-hora${x.hora.abierto ? ' abierto' : ''}" data-sitio-hora="${esc0(JSON.stringify(p.hours))}" data-tz="${esc0(x.tz)}" data-lang="${lang === 'en' ? 'en' : 'es'}">${esc0(x.hora.texto)}</span>` : '',
      x.festivo ? `<span class="sitio-festivo${x.festivo.sinConfirmar ? ' sin-confirmar' : ''}">${esc0(x.festivo.texto)}</span>` : '',
      x.extra ? `<span class="sitio-extra">${icono(x.extra.tipo)}<span>${esc0(x.extra.texto)}</span></span>` : '',
      // En tinta: «2 planes hoy» no es una oferta (el coral, solo para eso).
      x.planes ? `<span class="tag-planes">${esc0(x.planes)}</span>` : '',
    ].filter(Boolean).join('');
  }

  const KlendarSitios = { horaTexto, partes, detallesHtml };
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
      // Para las pruebas (como `KlendarMapa` en Planes).
      window.KlendarMapaSitios = m;
      const L = T[d.lang === 'en' ? 'en' : 'es'];
      const KA = globalThis.KlendarAgrupa;
      let pedido = 0;
      let espera = null;
      let pop = null;
      const planesDe = (f) => Number(f.plans_today) || 0;

      // La tarjeta de un sitio: lo mismo que la fila de la lista (`place_card`
      // y las mismas líneas, `detallesHtml`); mientras llega, el nombre.
      const abre = async (f, el) => {
        const a = document.createElement('a');
        a.className = 'pop pop-sitio';
        a.href = `${d.base || '/b/'}${encodeURIComponent(f.slug || f.id)}`;
        a.innerHTML = `<b>${esc(f.name)}</b><span class="pop-ver">${esc(d.ver || '')}</span>`;
        if (pop) pop.remove();
        pop = new mb.Popup({ offset: 22, closeButton: false, focusAfterOpen: false })
          .setLngLat([f.lng, f.lat]).setDOMContent(a).addTo(m);
        // El elegido: más grande y con el anillo marcado mientras está abierta.
        document.querySelectorAll('#mapa-sitios .marca.elegida').forEach((x) => x.classList.remove('elegida'));
        if (el) el.classList.add('elegida');
        pop.on('close', () => { if (el) el.classList.remove('elegida'); });
        try {
          const r = await fetch(`${d.url}/rest/v1/rpc/place_card`, {
            method: 'POST',
            headers: { apikey: d.key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_business: f.id, ...(d.desde ? { p_lat: d.desde[1], p_lng: d.desde[0] } : {}) }),
          });
          const fila = r.ok ? await r.json() : null;
          if (fila && a.isConnected) {
            a.innerHTML = `<b>${esc(fila.name)}</b>${detallesHtml(fila, d.lang)}<span class="pop-ver">${esc(d.ver || '')}</span>`;
          }
        } catch { /* se queda con el nombre */ }
      };

      // Varios sitios en el mismo punto: su lista, por partes.
      const lista = (s) => {
        const items = s.items;
        const caja = document.createElement('div');
        caja.className = 'pop-lugar';
        caja.innerHTML = `<div class="pl-cab"><div class="pl-tit"><b>${esc(L.placesHere(items.length))}</b></div>`
          + `<button type="button" class="pl-cerrar" aria-label="${esc(L.close)}">×</button></div><ul class="pl-lista"></ul>`;
        const ul = caja.querySelector('.pl-lista');
        let hechos = 0;
        let mas = null;
        const parte = () => {
          items.slice(hechos, hechos + 8).forEach((x) => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="${esc(`${d.base || '/b/'}${encodeURIComponent(x.slug || x.id)}`)}"><b>${esc(x.name)}</b>${
              planesDe(x) ? `<span class="pl-cuando">${esc(L.plansToday(planesDe(x)))}</span>` : ''}</a>`;
            ul.append(li);
          });
          hechos = Math.min(items.length, hechos + 8);
          if (hechos < items.length) {
            if (!mas) {
              mas = document.createElement('button');
              mas.type = 'button';
              mas.className = 'pl-mas';
              mas.addEventListener('click', parte);
              caja.append(mas);
            }
            mas.textContent = L.seeMore(items.length - hechos);
          } else if (mas) mas.remove();
        };
        parte();
        if (pop) pop.remove();
        KA.abreHoja(m, caja, [s.lng, s.lat]);
      };

      // Los marcadores: el mismo sistema que Planes (assets/mapa.js,
      // GLOSARIO «Aspecto › El mapa»): anillo en tinta si tiene planes hoy, sin anillo si
      // no; la cifra, cuántos sitios. Los sin planes, con su icono (no se baja
      // un logo por cada uno) y sin nombre.
      const capa = KA.capa(m, {
        // En Sitios, el logo del negocio o el icono de su categoría (en
        // Planes, el del tipo de plan): que se sepa de un vistazo el modo.
        cara: (s) => {
          const f = s.items.find(planesDe) || s.items[0];
          return {
            // La foto de perfil (logo), la que se reconoce y sale en su
            // tarjeta; sin ella, la portada.
            foto: f.logo || f.photo, icono: KA.iconoMapa('cat', f.category_slug), nombre: planesDe(f) ? f.name : null,
          };
        },
        anillo: (s) => (s.items.some((x) => x.has_offer) ? 'oferta' : s.items.some(planesDe) ? 'planes' : ''),
        uno: (f) => {
          const el = KA.marcaEl({
            foto: f.logo || f.photo, icono: KA.iconoMapa('cat', f.category_slug),
            anillo: f.has_offer ? 'oferta' : planesDe(f) ? 'planes' : '', n: 1,
            etiqueta: f.name, nombre: planesDe(f) ? f.name : null, prio: planesDe(f),
          });
          el.addEventListener('click', (e) => { e.stopPropagation(); abre(f, el); });
          return new mb.Marker({ element: el, anchor: 'center' }).setLngLat([f.lng, f.lat]);
        },
        varios: lista,
        etiqueta: (s, n) => L.placesHere(n),
        burbuja: (n) => `${L.places(n)}. ${L.zoomIn}`,
      });

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
          capa.poner((Array.isArray(filas) ? filas : []).filter((f) => isFinite(f.lat) && isFinite(f.lng))
            .map((f) => ({ ...f, lat: Number(f.lat), lng: Number(f.lng) })));
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
