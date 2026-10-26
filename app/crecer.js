/* «Tu cuenta» → «Pedir un local» y «Avísame cuando Klendar llegue» (crecer,
 * 2026-10-14; migración 20261218100000_crecer de la app). Como la app.
 *
 * - `#/pedir-local[?nombre=…]`: «Quiero que [local] esté en Klendar». Nombre
 *   del sitio, ciudad o zona (con la zona guardada de Explorar, si la hay),
 *   dirección aproximada (opcional) y, si quieres, el punto del LOCAL en el
 *   mapa (nunca tu ubicación). Se agrupa con lo que pidan otras personas; el
 *   negocio solo sabrá cuántas lo piden, nunca quién (`request_venue`). Si el
 *   sitio ya está en Klendar, se dice y se lleva a su ficha.
 * - `#/pedidos`: «Lo que has pedido» (`my_venue_requests`: Esperando · Ya
 *   está en Klendar · No va a estar; retirar con confirmación) y «Te avisamos
 *   cuando llegue Klendar» (`my_city_waitlist`, quitar).
 * - `#/avisame?lat=&lng=&zona=`: lo que hace «Avísame cuando llegue» de
 *   Descubre y Explorar sin JavaScript o después de entrar
 *   (`join_city_waitlist` con tu cuenta). Si el enlace no viene de un botón de
 *   esta web, primero se pregunta (`confirmaEnlace`).
 * - La fila de la portada (`filaPedidos`).
 * El interruptor «Locales que has pedido» está en Ajustes → Notificaciones
 * (app/cuenta.js, `notify_requests`).
 *
 * Va después de app.js y cuenta.js y usa lo suyo (`RUTAS`, `llamar`, `pinta`,
 * `esc`, `t`, `fila`, `ic`, `toast`, `exigeSesion`, `confirmaEnlace`,
 * `confirma`, `ocupado`, `pantallaVacia`, `fecha`, `pre`…).
 */
'use strict';

/** Los errores de `request_venue` y `join_city_waitlist`, dichos como en la app. */
const ERR_PEDIDO = {
  // Los mismos que la app (`venueReqErr*`), con el tope (5 al día y 30
  // abiertas: `venue_requests_per_day` y `venue_requests_open`).
  invalid_name: 'Escribe el nombre del sitio, sin correos, enlaces ni teléfonos.',
  invalid_place: 'Dinos en qué ciudad o zona está (o márcalo en el mapa). La dirección, sin correos, enlaces ni teléfonos.',
  offensive_text: 'Hay alguna palabra que no está permitida. Revísalo.',
  too_many_today: 'Hoy ya has pedido 5 sitios, el máximo. Mañana puedes pedir más.',
  too_many_open: 'Tienes 30 sitios pedidos esperando, el máximo. Retira alguno para pedir otro.',
  invalid_point: 'No sabemos dónde es eso. Vuelve a Descubre y prueba otra vez.',
  too_many: 'Demasiados intentos seguidos. Espera un rato y vuelve a probar.',
};
const errorPedido = (e) => (ERR_PEDIDO[e?.clave] ? t(ERR_PEDIDO[e.clave]) : e?.message || amable(''));

/** La fila de la portada de «Tu cuenta» (grupo Preferencias). */
function filaPedidos() {
  return fila({ href: '#/pedidos', icono: 'storefront', titulo: t('Pedir un local'), detalle: t('Un sitio que echas en falta y lo que ya has pedido') });
}

/** La ficha pública de un negocio. */
const fichaNegocio = (slug, id) => `${pre}/b/${encodeURIComponent(slug || id)}`;

/** La zona guardada de Explorar (la ciudad elegida), si la hay; con «Cerca
 * de mí», la localidad de ese punto según Mapbox (redondeado, ~1 km). */
async function zonaGuardada() {
  let q = null;
  try {
    const g = JSON.parse(localStorage.getItem('klendar.filtros') || 'null');
    if (g && Date.now() - g.t < 30 * 864e5) q = new URLSearchParams(g.es || g.en || '');
  } catch { /* sin almacenamiento */ }
  if (!q) return '';
  const ciudad = (q.get('ciudad') || q.get('city') || '').trim();
  if (ciudad) return ciudad.replace(/(^|[\s-])(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase()).slice(0, 80);
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  if (!q.get('lat') || !Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  const lugar = await geocodifica(`${Math.round(lng * 100) / 100},${Math.round(lat * 100) / 100}`, 'place');
  return lugar?.ciudad || '';
}

/** El token público de Mapbox (vacío si no hay: sin mapa). */
let TOKEN_MAPBOX = null;
async function tokenMapboxCuenta() {
  if (TOKEN_MAPBOX !== null) return TOKEN_MAPBOX;
  try {
    const r = await fetch('/api/mapbox-token');
    TOKEN_MAPBOX = r.ok ? (await r.json()).token || '' : '';
  } catch { TOKEN_MAPBOX = ''; }
  return TOKEN_MAPBOX;
}
/** Una búsqueda en Mapbox (texto o «lng,lat») → { lat, lng, ciudad }. */
async function geocodifica(consulta, tipos = 'address,poi,place') {
  const token = await tokenMapboxCuenta();
  if (!token || !String(consulta).trim()) return null;
  try {
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(consulta)}.json?limit=1&language=${EN ? 'en' : 'es'}&types=${tipos}&access_token=${encodeURIComponent(token)}`);
    if (!r.ok) return null;
    const f = (await r.json()).features?.[0];
    if (!f) return null;
    const ctx = f.context || [];
    const ciudad = (ctx.find((c) => String(c.id).startsWith('place.')) || (String(f.id).startsWith('place.') ? f : null))?.text || '';
    return { lng: f.center[0], lat: f.center[1], ciudad };
  } catch { return null; }
}
/** Mapbox GL, solo si se abre el mapa. */
let GL_CUENTA = null;
function cargaMapboxCuenta() {
  if (!GL_CUENTA) {
    GL_CUENTA = new Promise((ok, ko) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.css';
      document.head.append(css);
      const js = document.createElement('script');
      js.src = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.js';
      js.onload = () => ok(window.mapboxgl);
      js.onerror = () => { GL_CUENTA = null; ko(new Error('mapbox')); };
      document.head.append(js);
    });
  }
  return GL_CUENTA;
}
/** El mapa para marcar el local: una chincheta que se pone con un toque y se
 * arrastra (como el alta del panel). null si no hay mapa. */
async function mapaLocal(caja, alMover) {
  const token = await tokenMapboxCuenta();
  let gl = null;
  if (token) { try { gl = await cargaMapboxCuenta(); } catch { gl = null; } }
  if (!gl) {
    caja.classList.add('sin-mapa');
    caja.innerHTML = `<p class="muted">${esc(t('El mapa no se puede cargar ahora mismo. Con la dirección basta.'))}</p>`;
    return null;
  }
  gl.accessToken = token;
  const oscuro = matchMedia('(prefers-color-scheme: dark)').matches;
  const mapa = new gl.Map({
    container: caja, style: oscuro ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12',
    center: [-3.7038, 40.4168], zoom: 4.6, cooperativeGestures: true,
    performanceMetricsCollection: false, collectResourceTiming: false,
  });
  mapa.addControl(new gl.NavigationControl({ showCompass: false }));
  const chincheta = new gl.Marker({ draggable: true, color: oscuro ? '#FFFFFF' : '#0A0A0A' });
  const avisa = () => { const p = chincheta.getLngLat(); alMover({ lat: p.lat, lng: p.lng }); };
  chincheta.on('dragend', avisa);
  mapa.on('click', (e) => { chincheta.setLngLat(e.lngLat).addTo(mapa); avisa(); });
  return {
    centra(p, zoom = 15) { mapa.jumpTo({ center: [p.lng, p.lat], zoom }); },
    pon(p) { chincheta.setLngLat([p.lng, p.lat]).addTo(mapa); mapa.flyTo({ center: [p.lng, p.lat], zoom: 17 }); },
    quita() { chincheta.remove(); },
  };
}

// ── Pedir un local ─────────────────────────────────────────────────────────
RUTAS['pedir-local'] = async (_partes, params, crudo) => {
  if (!exigeSesion(crudo || 'pedir-local')) return;
  const nombre0 = String(params.get('nombre') || '').trim().slice(0, 80);
  const [zona0, ciudades] = await Promise.all([
    zonaGuardada().catch(() => ''),
    sb.rpc('public_cities', {}).then((r) => (Array.isArray(r.data) ? r.data : []), () => []),
  ]);
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a> › <a href="#/pedidos">${esc(t('Lo que has pedido'))}</a></p>
    <h1>${esc(t('Pedir un local'))}</h1>
    <p class="muted">${esc(t('¿Echas en falta un bar, un restaurante o una tienda? Pide que esté en Klendar.'))}</p>
    <form class="formu" id="fPedir" novalidate>
      <label>${esc(t('Nombre del sitio'))}
        <input name="nombre" maxlength="80" autocomplete="off" required value="${esc(nombre0)}" placeholder="${esc(t('Ej.: Bar Casa Paco'))}"></label>
      <label>${esc(t('Ciudad o zona'))}
        <input name="zona" maxlength="80" autocomplete="off" list="ciudadesKlendar" value="${esc(zona0)}" placeholder="${esc(t('Ej.: Zaragoza, o el barrio'))}"></label>
      <datalist id="ciudadesKlendar">${ciudades.filter((c) => c?.city).map((c) => `<option value="${esc(c.city)}"></option>`).join('')}</datalist>
      <label>${esc(t('Dirección aproximada'))} <small>${esc(t('(opcional)'))}</small>
        <input name="direccion" maxlength="120" autocomplete="off" placeholder="${esc(t('Ej.: calle Mayor, junto a la plaza'))}"></label>
      <details class="pedir-mapa" id="pedirMapa">
        <summary>${esc(t('Marcar en el mapa (opcional)'))}</summary>
        <p class="muted">${esc(t('Toca el sitio del local o arrastra la chincheta. Es el punto del local, nunca el tuyo: no usamos tu ubicación.'))}</p>
        <div class="acciones"><button type="button" class="pill" id="buscaMapa">${esc(t('Buscar la dirección en el mapa'))}</button>
          <button type="button" class="pill" id="quitaPunto" hidden>${esc(t('Quitar el punto'))}</button></div>
        <div class="mapa-local" id="mapaLocal" role="region" aria-label="${esc(t('Mapa'))}"></div>
        <p class="muted" id="puntoTxt" aria-live="polite"></p>
      </details>
      <p class="muted nota-pedir">${esc(t('Se junta con lo que pidan otras personas. El negocio solo verá cuántas personas lo piden, nunca quién. Si llega, te avisamos (puedes apagarlo en Ajustes).'))}</p>
      <p class="err" id="errPedir" role="alert"></p>
      <button class="pill accent" id="enviarPedir">${esc(t('Pedirlo'))}</button>
    </form>`);

  const f = $('#fPedir');
  let punto = null;
  let mapa = null;
  const pintaPunto = () => {
    $('#puntoTxt').textContent = punto ? t('Marcado en el mapa') : '';
    $('#quitaPunto').hidden = !punto;
  };
  // El mapa se carga al abrirlo (pesa lo suyo) y se centra en lo escrito.
  $('#pedirMapa').addEventListener('toggle', async () => {
    if (!$('#pedirMapa').open || mapa !== null) return;
    mapa = false;
    mapa = await mapaLocal($('#mapaLocal'), (p) => { punto = p; pintaPunto(); });
    if (!mapa) { $('#buscaMapa').hidden = true; return; }
    const donde = [f.direccion.value, f.zona.value].map((x) => x.trim()).filter(Boolean).join(', ');
    const p = donde ? await geocodifica(donde) : null;
    if (p) mapa.centra(p, f.direccion.value.trim() ? 16 : 12);
  });
  $('#buscaMapa').addEventListener('click', (ev) => ocupado(ev.currentTarget, async () => {
    const donde = [f.nombre.value, f.direccion.value, f.zona.value].map((x) => x.trim()).filter(Boolean).join(', ');
    const p = donde ? await geocodifica(donde) : null;
    if (!p || !mapa) { toast(t('No lo encontramos en el mapa. Toca el sitio a mano.'), true); return; }
    punto = { lat: p.lat, lng: p.lng };
    mapa.pon(punto);
    pintaPunto();
  }));
  $('#quitaPunto').addEventListener('click', () => { punto = null; mapa?.quita(); pintaPunto(); });
  for (const n of ['nombre', 'zona']) f[n].addEventListener('input', () => errorCampo(f[n], ''));

  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const nombre = f.nombre.value.trim();
    const zona = f.zona.value.trim();
    let mal = false;
    if (nombre.length < 2) { errorCampo(f.nombre, t('Escribe el nombre del sitio')); mal = true; }
    if (!zona && !punto) { errorCampo(f.zona, t('Escribe la ciudad o la zona')); mal = true; }
    if (mal) { $('[aria-invalid="true"]', f)?.focus(); return; }
    $('#errPedir').textContent = '';
    ocupado($('#enviarPedir'), async () => {
      let r;
      try {
        r = await llamar('request_venue', {
          p_name: nombre, p_place: zona || null, p_city: null, p_address: f.direccion.value.trim() || null,
          p_lat: punto ? Math.round(punto.lat * 1e5) / 1e5 : null, p_lng: punto ? Math.round(punto.lng * 1e5) / 1e5 : null,
        });
      } catch (e) {
        $('#errPedir').textContent = errorPedido(e);
        return;
      }
      resultadoPedido(r || {});
    });
  });
  if (!nombre0) f.nombre.focus();
};

/** Lo que ha pasado al pedirlo. */
function resultadoPedido(r) {
  const n = Number(r.people) || 1;
  const nombre = r.name || '';
  history.replaceState(null, '', '#/pedir-local');
  if (r.status === 'exists') {
    pinta(`
      <div class="ticket">
        <p class="hecho-ic" aria-hidden="true">${MARCA_HECHO}</p>
        <h1>${esc(EN ? `${r.business_name} is already on Klendar` : `${r.business_name} ya está en Klendar`)}</h1>
        <p class="muted">${esc(t('No hace falta pedirlo: mira su ficha y lo que publica.'))}</p>
        <p class="acciones">
          <a class="pill accent" href="${esc(fichaNegocio(r.slug, r.business_id))}">${esc(t('Ver su ficha'))}</a>
          <a class="pill" href="#/pedir-local">${esc(t('Pedir otro'))}</a>
        </p>
      </div>`);
    return;
  }
  // Como la app: «Hecho» y «Eres la primera persona…» / «Ya sois N…»; si ya
  // lo había pedido, «Ya lo habías pedido» con cuántos sois.
  const titulo = r.status === 'already' ? t('Ya lo habías pedido') : t('Hecho');
  const texto = r.status === 'already'
    ? (n <= 1
      ? t('De momento solo lo pides tú. Si llega a Klendar, te avisamos.')
      : (EN ? `${n} people are asking for ${nombre}. If it joins Klendar, we'll let you know.` : `Sois ${n} personas pidiendo ${nombre}. Si llega a Klendar, te avisamos.`))
    : n <= 1
      ? (EN ? `You're the first person to ask for ${nombre}. If it joins Klendar, we'll let you know.` : `Eres la primera persona que pide ${nombre}. Si llega a Klendar, te avisamos.`)
      : (EN ? `${n} people are now asking for ${nombre}. If it joins Klendar, we'll let you know.` : `Ya sois ${n} personas pidiendo ${nombre}. Si llega a Klendar, te avisamos.`);
  pinta(`
    <div class="ticket">
      <p class="hecho-ic" aria-hidden="true">${MARCA_HECHO}</p>
      <h1>${esc(titulo)}</h1>
      <p class="muted">${esc(texto)}</p>
      <p class="acciones">
        <a class="pill accent" href="#/pedidos">${esc(t('Lo que has pedido'))}</a>
        <a class="pill" href="#/pedir-local">${esc(t('Pedir otro'))}</a>
      </p>
    </div>`);
}

// ── Lo que has pedido ──────────────────────────────────────────────────────
const ESTADO_PEDIDO = { waiting: 'Esperando', live: 'Ya está en Klendar', closed: 'No va a estar' };

RUTAS.pedidos = async () => {
  if (!exigeSesion('pedidos')) return;
  const [locales, zonas] = await Promise.all([
    llamar('my_venue_requests', {}).then((x) => x || []),
    llamar('my_city_waitlist', {}).then((x) => x || []).catch(() => []),
  ]);
  const cabeza = `<p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Lo que has pedido'))}</h1>`;
  if (!locales.length && !zonas.length) {
    pinta(`${cabeza}${pantallaVacia({
      icono: 'storefront',
      titulo: t('Aún no has pedido nada'),
      texto: t('Si echas en falta un sitio, pídelo y te avisamos cuando esté en Klendar.'),
      botones: `<a class="pill accent" href="#/pedir-local">${esc(t('Pedir un local'))}</a>`,
    })}`);
    return;
  }
  const personas = (x) => (Number(x.people) <= 1
    ? t('Solo tú')
    : (EN ? `${x.people} people` : `${x.people} personas`));
  const filaLocal = (x) => {
    const estado = t(ESTADO_PEDIDO[x.status] || 'Esperando');
    const live = x.status === 'live' && x.business_id;
    return `<div class="aviso pedido">
      <b>${esc(x.name)}</b>
      ${x.place || x.address ? `<span>${esc([x.place, x.address].filter(Boolean).join(' · '))}</span>` : ''}
      <small><span class="tag ${live ? 'tag-tinta' : 'off'}">${esc(estado)}</span>${x.status === 'waiting' ? ` ${esc(personas(x))}` : ''} · <span class="muted">${esc(fecha(x.created_at, { day: 'numeric', month: 'short', year: 'numeric' }))}</span></small>
      ${live || x.status !== 'live' ? `<span class="acciones">
        ${live ? `<a class="pill" href="${esc(fichaNegocio(x.business_slug, x.business_id))}">${esc(t('Ver su ficha'))}</a>` : ''}
        ${x.status !== 'live' ? `<button type="button" class="pill" data-retirar="${esc(x.id)}" data-nombre="${esc(x.name)}" data-estado="${esc(x.status)}">${esc(t(x.status === 'closed' ? 'Quitar de la lista' : 'Retirar'))}</button>` : ''}
      </span>` : ''}
    </div>`;
  };
  const filaZona = (z) => `<div class="aviso pedido">
      <b>${esc(z.zone)}</b>
      <small class="muted">${esc(z.notified_at
        ? t('Ya te avisamos: Klendar ha llegado')
        : (EN ? `Since ${fecha(z.created_at, { day: 'numeric', month: 'long', year: 'numeric' })}` : `Desde el ${fecha(z.created_at, { day: 'numeric', month: 'long', year: 'numeric' })}`))}</small>
      <span class="acciones"><button type="button" class="pill" data-quitar-zona="${esc(z.id)}" data-zona="${esc(z.zone)}">${esc(t('Quitar'))}</button></span>
    </div>`;
  pinta(`${cabeza}
    <h2 class="seccion-t">${esc(t('Locales que has pedido'))}</h2>
    ${locales.length ? `<div class="avisos">${locales.map(filaLocal).join('')}</div>`
      : `<p class="empty">${esc(t('Aún no has pedido ningún local.'))}</p>`}
    <p class="acciones"><a class="pill" href="#/pedir-local">${ic('add')} ${esc(t('Pedir un local'))}</a></p>
    <h2 class="seccion-t">${esc(t('Te avisamos cuando llegue Klendar'))}</h2>
    ${zonas.length ? `<div class="avisos">${zonas.map(filaZona).join('')}</div>`
      : `<p class="empty">${esc(t('Aún no te has apuntado en ninguna zona.'))}</p>`}
    <p class="muted nota-pedir">${esc(t('Nadie ve quién pide qué: el negocio solo sabrá cuántas personas lo piden. Los avisos se apagan en Ajustes → Notificaciones.'))}</p>`);

  $$('[data-retirar]').forEach((b) => b.addEventListener('click', async () => {
    const cerrado = b.dataset.estado === 'closed';
    if (!(await confirma({
      titulo: EN ? `${cerrado ? 'Remove' : 'Withdraw'} “${b.dataset.nombre}”?` : `¿${cerrado ? 'Quitar' : 'Retirar'} «${b.dataset.nombre}»?`,
      texto: cerrado ? t('Saldrá de tu lista.') : t('Dejarás de contar entre quienes lo piden y no te avisaremos si llega.'),
      aceptar: t(cerrado ? 'Quitar de la lista' : 'Retirar'),
    }))) return;
    ocupado(b, async () => {
      await llamar('withdraw_venue_request', { p_id: b.dataset.retirar });
      toast(t(cerrado ? 'Quitado de tu lista' : 'Petición retirada'));
      RUTAS.pedidos();
    });
  }));
  $$('[data-quitar-zona]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirma({
      titulo: EN ? `Remove the alert for ${b.dataset.zona}?` : `¿Quitar el aviso de ${b.dataset.zona}?`,
      texto: t('No te avisaremos cuando Klendar llegue allí.'),
      aceptar: t('Quitar'),
    }))) return;
    ocupado(b, async () => {
      await llamar('leave_my_city_waitlist', { p_id: b.dataset.quitarZona });
      toast(t('Hecho: ya no te avisaremos'));
      RUTAS.pedidos();
    });
  }));
};

// ── «Avísame cuando llegue» desde Descubre y Explorar ─────────────────────
RUTAS.avisame = async (_partes, params, crudo) => {
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  const zona = String(params.get('zona') || '').trim().slice(0, 80);
  if (!params.get('lat') || !params.get('lng') || !(Math.abs(lat) <= 90) || !(Math.abs(lng) <= 180)) {
    pinta(pantallaVacia({ icono: 'refresh', titulo: t('Ese enlace no vale'), texto: t(ERR_PEDIDO.invalid_point), h: 'h1', botones: botonTuCuenta() }));
    return;
  }
  if (!exigeSesion(crudo || 'avisame')) return;
  const sigue = await confirmaEnlace('avisame', {
    titulo: t('Avísame cuando llegue Klendar'),
    que: zona,
    texto: t('Te avisamos una sola vez, cuando Klendar llegue a esa zona. Lo puedes quitar cuando quieras en «Lo que has pedido».'),
    boton: t('Avísame'),
    volver: '#/pedidos',
  });
  if (!sigue) return;
  let r;
  try {
    r = await llamar('join_city_waitlist', { p_lat: lat, p_lng: lng, p_zone: zona || null, p_email: null, p_lang: LANG, p_source: 'web' });
  } catch (e) {
    pinta(pantallaVacia({ icono: 'refresh', titulo: t('Algo ha fallado'), texto: errorPedido(e), h: 'h1', botones: botonTuCuenta() }));
    return;
  }
  if (r?.status === 'live') {
    hecho({ titulo: t('Klendar ya está aquí'), texto: t('Ya hay sitios en Klendar cerca. Míralos en Descubre.'),
      volver: PUB_EN ? '/en/discover/' : '/descubre/', volverTxt: t('Ir a Descubre'), lista: '#/pedidos', listaTxt: t('Lo que has pedido') });
    return;
  }
  const z = r?.zone || zona;
  hecho({
    titulo: EN ? `Done: we'll let you know when Klendar arrives in ${z}` : `Listo: te avisaremos cuando Klendar llegue a ${z}`,
    texto: r?.status === 'already' ? t('Ya estabas en la lista.') : t('Una sola vez. Lo puedes quitar en «Lo que has pedido».'),
    volver: '#/pedidos', volverTxt: t('Lo que has pedido'),
    lista: '#/', listaTxt: t('Tu cuenta'),
  });
};
