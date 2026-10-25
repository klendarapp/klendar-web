/* El mapa de Explorar: cómo se juntan los puntos (igual que la app,
 * `lib/features/map/domain/map_grouping.dart`, 2026-10-25) y el mapa de
 * Planes.
 *
 * Lo mismo para el servidor y las pruebas (`import KA from
 * '../../assets/mapa.js'`) y para el navegador (script clásico,
 * `window.KlendarAgrupa`):
 *
 * 1. **Sitios** (`sitios`): lo que está en el mismo punto (a menos de 15 m)
 *    es un solo sitio. Por mucho zoom que se haga no se separa (los planes
 *    de un local, o los de la agenda pública en una biblioteca, tienen las
 *    mismas coordenadas), así que no se agrupa: es un marcador con «N planes»
 *    que, al tocarlo, abre su lista por partes.
 * 2. **Grupos** (`agrupa`): sitios distintos que a este zoom se pisarían en
 *    pantalla (a menos de 36 px). Al tocar uno, el mapa se acerca justo hasta
 *    separarlos (`zoomQueSepara`). Desde el zoom 17 ya no se agrupa nada.
 *
 * El número dice siempre lo mismo: en Planes, planes; en Sitios, sitios.
 * Burbujas e insignias en tinta (en oscuro, al revés): el coral es de las
 * ofertas.
 */
(function () {
  'use strict';

  const METROS_SITIO = 15;
  const RADIO_PX = 36;
  const ZOOM_MAX_GRUPOS = 17;

  /** Metros entre dos puntos (aproximado: sobra para unos metros). */
  function metros(lat1, lng1, lat2, lng2) {
    const rad = Math.PI / 180;
    const x = (lng2 - lng1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
    const y = (lat2 - lat1) * rad;
    return 6371000 * Math.sqrt(x * x + y * y);
  }

  /** Junta lo del mismo punto: [{ lat, lng, items }] (cada item con lat y
   *  lng; el primero manda en la posición). */
  function sitios(puntos, m = METROS_SITIO) {
    const out = [];
    for (const p of puntos || []) {
      const s = out.find((x) => metros(x.lat, x.lng, p.lat, p.lng) <= m);
      if (s) s.items.push(p);
      else out.push({ lat: p.lat, lng: p.lng, items: [p] });
    }
    return out;
  }

  /** Píxeles lógicos (Web Mercator, teselas de 512, como Mapbox). */
  function px(lat, lng, z) {
    const escala = 512 * Math.pow(2, z);
    const la = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
    return {
      x: ((lng + 180) / 360) * escala,
      y: ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * escala,
    };
  }

  /** Agrupa los sitios que se pisarían a zoom [z]: [{ lat, lng, sitios }]. */
  function agrupa(lista, z, radio = RADIO_PX, zMax = ZOOM_MAX_GRUPOS) {
    if (z >= zMax) return lista.map((s) => ({ lat: s.lat, lng: s.lng, sitios: [s] }));
    const grupos = [];
    const centros = [];
    for (const s of lista) {
      const p = px(s.lat, s.lng, z);
      const i = centros.findIndex((c) => Math.hypot(c.x - p.x, c.y - p.y) <= radio);
      if (i < 0) {
        grupos.push({ lat: s.lat, lng: s.lng, sitios: [s] });
        centros.push(p);
        continue;
      }
      const g = grupos[i];
      g.sitios.push(s);
      const n = g.sitios.length;
      centros[i] = { x: centros[i].x + (p.x - centros[i].x) / n, y: centros[i].y + (p.y - centros[i].y) / n };
      g.lat += (s.lat - g.lat) / n;
      g.lng += (s.lng - g.lng) / n;
    }
    return grupos;
  }

  /** El zoom al que [g] se separa en dos o más, desde [z] (como mucho 17,
   *  donde ya no se agrupa). null si es un solo sitio: no se separa nunca. */
  function zoomQueSepara(g, z) {
    if (g.sitios.length < 2) return null;
    for (let x = Math.floor(z / 0.25) * 0.25 + 0.25; x < ZOOM_MAX_GRUPOS; x += 0.25) {
      if (agrupa(g.sitios, x).length > 1) return x;
    }
    return ZOOM_MAX_GRUPOS;
  }

  /** Planes de un sitio (cada punto del mapa de Planes es un plan) o de un
   *  grupo. */
  const planesDe = (s) => s.items.length;
  const planesDeGrupo = (g) => g.sitios.reduce((n, s) => n + planesDe(s), 0);

  const KA = {
    METROS_SITIO, RADIO_PX, ZOOM_MAX_GRUPOS, metros, sitios, px, agrupa, zoomQueSepara, planesDe, planesDeGrupo,
  };
  globalThis.KlendarAgrupa = KA;
  if (typeof module === 'object' && module && module.exports) module.exports = KA;

  // ── En el navegador ──────────────────────────────────────────────────────
  if (typeof document === 'undefined') return;

  const POR_PARTE = 8;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  const ICONO = {
    lugar: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    local: 'M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z',
  };
  const icono = (n, t = 22) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" aria-hidden="true"><path fill="currentColor" d="${ICONO[n]}"/></svg>`;

  /**
   * La hoja de un sitio dentro del mapa, abajo y a lo ancho (como la de la
   * app): con su propio scroll, nunca se sale del mapa ni queda debajo de la
   * barra de abajo. Se cierra con su ×, con Escape o tocando el mapa. El
   * mapa se mueve para que el sitio quede a la vista, encima de la hoja.
   */
  function abreHoja(m, nodo, lngLat) {
    const caja = m.getContainer();
    caja.querySelectorAll('.hoja-lugar').forEach((h) => h.remove());
    const hoja = document.createElement('div');
    hoja.className = 'hoja-lugar';
    hoja.setAttribute('role', 'dialog');
    hoja.append(nodo);
    caja.append(hoja);
    const cierra = () => {
      hoja.remove();
      m.off('click', cierra);
      document.removeEventListener('keydown', tecla);
    };
    const tecla = (e) => { if (e.key === 'Escape') cierra(); };
    hoja.addEventListener('click', (e) => e.stopPropagation());
    nodo.querySelectorAll('.pl-cerrar').forEach((b) => b.addEventListener('click', cierra));
    document.addEventListener('keydown', tecla);
    setTimeout(() => m.on('click', cierra), 0);
    if (lngLat) {
      // En el móvil la hoja va abajo (el sitio, encima); en el escritorio, a
      // la izquierda (el sitio, a su derecha).
      const deLado = hoja.offsetWidth < caja.clientWidth / 2;
      m.easeTo({
        center: lngLat,
        offset: deLado ? [hoja.offsetWidth / 2, 0] : [0, -hoja.offsetHeight / 2],
        duration: 350,
      });
    }
    const foco = nodo.querySelector('.pl-cerrar');
    if (foco) foco.focus({ preventScroll: true });
    return cierra;
  }

  /** Cara del sitio: el local (si lo hay) o el primero. */
  const principal = (s) => s.items.find((p) => p.n) || s.items[0];

  /** La cabeza de un sitio (logo o icono). */
  function cara(p, clase) {
    return p.lg
      ? `<span class="${clase}"><img src="${esc(p.lg)}" alt="" loading="lazy" decoding="async"></span>`
      : `<span class="${clase} sin-logo">${icono(p.n ? 'local' : 'lugar')}</span>`;
  }

  /**
   * El mapa de Planes con sus puntos (`#mapaPuntos`): un marcador por plan,
   * los del mismo sitio en uno con «N planes» y los sitios cercanos en una
   * burbuja con el total. [T]: los textos (`data-textos` de la caja).
   */
  function planes(m, puntos, T) {
    const mb = window.mapboxgl;
    const lista = sitios(puntos);
    const SA = window.KlendarSitioAhora;
    const KM = window.KlendarMarcas;
    const locales = [...new Set(puntos.filter((p) => p.n).map((p) => p.n))];
    // Precio del local y «¿Hay sitio ahora?» (una vez para todos).
    const ahora = SA && KM && locales.length ? SA.pide(locales).catch(() => ({})) : Promise.resolve({});
    let marcas = [];

    function chincheta(p) {
      const el = document.createElement('a');
      el.className = `chincheta${p.k === 'f' ? ' flash' : ''}`;
      el.href = p.u;
      el.setAttribute('aria-label', p.t);
      const a = document.createElement('a');
      a.className = 'pop';
      a.href = p.u;
      const bt = document.createElement('b');
      bt.textContent = p.t;
      const sp = document.createElement('span');
      sp.textContent = p.b || '';
      a.append(bt, sp);
      const w = document.createElement('div');
      w.className = 'pop-caja';
      w.append(a);
      if (p.n) {
        ahora.then((d) => {
          const x = d && d[p.n];
          if (!x) return;
          const pr = KM.simbolo(x.price_level);
          const t = SA.texto(x);
          if (pr || t) {
            const l = document.createElement('small');
            l.className = 'pop-ahora';
            l.textContent = [pr, t].filter(Boolean).join(' · ');
            a.append(l);
          }
          // «Avísame cuando haya sitio» debajo (sitio-ahora.js decide si sale).
          if (SA.avisame && x.crowd) {
            const c = document.createElement('div');
            c.hidden = true;
            w.append(c);
            SA.avisame(c, p.n, x);
          }
        });
      }
      el.addEventListener('click', (e) => e.preventDefault());
      const pop = new mb.Popup({ offset: 18, closeButton: false, focusAfterOpen: false }).setDOMContent(w);
      return new mb.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(pop);
    }

    /** La hoja de un sitio: cabeza, Cómo llegar (y Ver el sitio si es un
     *  local) y sus planes por partes, cada uno con su fecha y hora. */
    function abreSitio(s) {
      const p = principal(s);
      const n = planesDe(s);
      const caja = document.createElement('div');
      caja.className = 'pop-lugar';
      caja.innerHTML = `<div class="pl-cab">${cara(p, 'pl-cara')}<div class="pl-tit"><b>${esc(p.sn || p.b)}</b><span>${esc(T.planes(n))}</span></div>
        <button type="button" class="pl-cerrar" aria-label="${esc(T.cerrar)}">×</button></div>
        <div class="pl-acciones"><a class="pl-btn" href="https://www.google.com/maps/dir/?api=1&amp;destination=${s.lat},${s.lng}" target="_blank" rel="noopener nofollow">${esc(T.comoLlegar)}</a>${
  p.n && p.bu ? `<a class="pl-btn" href="${esc(p.bu)}">${esc(T.verSitio)}</a>` : ''}</div>
        <ul class="pl-lista"></ul>`;
      const ul = caja.querySelector('.pl-lista');
      const items = [...s.items].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
      let hechos = 0;
      let mas = null;
      const parte = () => {
        items.slice(hechos, hechos + POR_PARTE).forEach((x) => {
          const li = document.createElement('li');
          li.innerHTML = `<a href="${esc(x.u)}"><span class="pl-cuando${x.k === 'f' ? ' flash' : ''}">${esc(x.w || '')}</span><b>${esc(x.t)}</b>${
            x.n && x.b && x.b !== (p.sn || p.b) ? `<span class="pl-de">${esc(x.b)}</span>` : ''}</a>`;
          ul.append(li);
        });
        hechos = Math.min(items.length, hechos + POR_PARTE);
        if (hechos < items.length) {
          if (!mas) {
            mas = document.createElement('button');
            mas.type = 'button';
            mas.className = 'pl-mas';
            mas.addEventListener('click', parte);
            caja.append(mas);
          }
          mas.textContent = T.verMas(items.length - hechos);
        } else if (mas) mas.remove();
      };
      parte();
      abreHoja(m, caja, [s.lng, s.lat]);
    }

    function marcaSitio(s) {
      const p = principal(s);
      const n = planesDe(s);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'sitio-marca';
      el.setAttribute('aria-label', `${p.sn || p.b}, ${T.planes(n)}`);
      el.innerHTML = `${cara(p, 'sm-cara')}<span class="sm-n">${esc(T.planes(n))}</span><span class="sm-nombre">${esc(p.sn || p.b)}</span>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); abreSitio(s); });
      return new mb.Marker({ element: el, anchor: 'center' }).setLngLat([s.lng, s.lat]);
    }

    function burbuja(g) {
      const n = planesDeGrupo(g);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'grupo-marca';
      el.textContent = String(n);
      el.setAttribute('aria-label', `${T.planes(n)}. ${T.acercar}`);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const z = zoomQueSepara(g, m.getZoom());
        if (z == null) abreSitio(g.sitios[0]);
        else m.easeTo({ center: [g.lng, g.lat], zoom: z, duration: 450 });
      });
      return new mb.Marker({ element: el, anchor: 'center' }).setLngLat([g.lng, g.lat]);
    }

    function pinta() {
      marcas.forEach((x) => x.remove());
      marcas = agrupa(lista, m.getZoom()).map((g) => {
        if (g.sitios.length > 1) return burbuja(g);
        const s = g.sitios[0];
        return s.items.length > 1 ? marcaSitio(s) : chincheta(s.items[0]);
      });
      marcas.forEach((x) => x.addTo(m));
    }
    pinta();
    m.on('zoomend', pinta);
  }

  /** Arranca el mapa de Planes (`#mapa`, con `#mapaPuntos`). */
  async function mapaPlanes() {
    const caja = document.getElementById('mapa');
    const datos = document.getElementById('mapaPuntos');
    if (!caja || !datos) return;
    const falla = () => {
      caja.innerHTML = `<p class="empty">${esc(caja.dataset.no)}</p>`;
      caja.classList.add('sin-mapa');
      document.dispatchEvent(new CustomEvent('klendar-mapa-falla'));
    };
    let puntos = [];
    let t = {};
    try {
      puntos = JSON.parse(datos.textContent || '[]');
      t = JSON.parse(caja.getAttribute('data-textos') || '{}');
    } catch { /* sin puntos */ }
    const T = {
      planes: (n) => (n === 1 ? t.plan1 : String(t.planesN || '').replace('{n}', n)),
      verMas: (n) => String(t.verMas || '').replace('{n}', n),
      comoLlegar: t.comoLlegar, verSitio: t.verSitio, cerrar: t.cerrar, acercar: t.acercar,
    };
    try {
      const tk = (await (await fetch('/api/mapbox-token')).json()).token;
      if (!tk) { falla(); return; }
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
        center: puntos.length ? [puntos[0].lng, puntos[0].lat] : [-3.7038, 40.4168],
        zoom: 12,
        performanceMetricsCollection: false,
        collectResourceTiming: false,
        cooperativeGestures: matchMedia('(pointer: coarse)').matches,
      });
      m.addControl(new mb.NavigationControl({ showCompass: false }));
      // «Esta noche se mueve» (ambiente.js) engancha aquí su capa.
      window.KlendarMapa = m;
      document.dispatchEvent(new CustomEvent('klendar-mapa'));
      if (puntos.length > 1) {
        const b = new mb.LngLatBounds();
        puntos.forEach((p) => b.extend([p.lng, p.lat]));
        m.fitBounds(b, { padding: 48, maxZoom: 15, duration: 0 });
      }
      planes(m, puntos, T);
    } catch { falla(); }
  }

  KA.planes = planes;
  KA.abreHoja = abreHoja;
  KA.mapaPlanes = mapaPlanes;
  if (document.getElementById('mapaPuntos')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mapaPlanes);
    else mapaPlanes();
  }
})();
