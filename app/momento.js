/* «Tu cuenta»: «Dar en el momento» (migración 20261228100000).
 *
 * El negocio enseña un QR suyo que cambia cada 30 segundos
 * (`klendar.app/m/<clave>.<ventana>.<firma>`). Escaneado con la cámara del
 * móvil sin la app, `functions/m/[token].js` trae aquí (#/momento/<…>):
 * «La Taberna te da: 1 sello en Cafés» y «Aceptar». Como la app
 * (`SpotReceiveScreen`): una vez por persona y QR, sin notificación (ya se ve
 * aquí), y lo de «algo del momento» queda en «Tus códigos» («Te dieron»).
 *
 * Personal de verdad (migración 20261241100000): si el navegador YA tiene
 * permiso de ubicación para Klendar, se manda dónde estás (sin guardarlo en
 * ningún sitio) y la base solo lo da cerca del local (`too_far`). Sin
 * permiso no se pide nada: nunca sale el diálogo del navegador. Con tope de
 * personas, el siguiente ve «Ya lo han recibido todos» (`full`).
 *
 * Va después de app.js y usa lo suyo (`RUTAS`, `llamar`, `pinta`, `t`, `esc`,
 * `ic`, `fecha`, `pantallaVacia`…). Comparten ámbito: los nombres de aquí
 * empiezan por `momento`.
 */
'use strict';

/** Por qué no se puede (lo que devuelve la base), como en la app. */
const MOMENTO_ERR = {
  qr_expired: 'Ese QR ya no vale',
  qr_invalid: 'No es un QR de un negocio de Klendar',
  ended: 'El negocio ya ha cerrado este QR',
  already_received: 'Ya lo has recibido',
  daily_limit: 'Hoy ya has recibido 5 cosas en este negocio. Vuelve otro día.',
  team: 'Eres del equipo de este negocio: no puedes recibirlo.',
  no_pass: 'No tienes este bono con usos en este negocio.',
  adults_only: 'Es solo para mayores de 18. Si lo eres, pon tu fecha de nacimiento en Ajustes.',
  business_blocked: 'Este negocio ahora no puede dar esto.',
  card_gone: 'Esa tarjeta de sellos ya no está activa.',
  business_inactive: 'Este negocio no está activo.',
  too_fast: 'Vas muy rápido. Espera un momento y vuelve a probar.',
  rate_limited: 'Vas muy rápido. Espera un momento y vuelve a probar.',
  account_suspended: 'Tu cuenta está suspendida.',
  full: 'Ya lo han recibido todos',
  too_far: 'Tienes que estar en el local para aceptarlo',
};

/** Dónde estás, solo si ya hay permiso (nunca se pide): `{p_lat, p_lng,
 * p_accuracy}` o `{}`. Como la app: con lo que el navegador ya sepa (hasta
 * 1 minuto), sin alta precisión y como mucho unos 4 segundos. No se guarda. */
async function momentoDonde() {
  try {
    if (!navigator.geolocation || !navigator.permissions?.query) return {};
    const permiso = await navigator.permissions.query({ name: 'geolocation' });
    if (permiso?.state !== 'granted') return {};
    const pos = await Promise.race([
      new Promise((ok, mal) => navigator.geolocation.getCurrentPosition(ok, mal,
        { timeout: 4000, maximumAge: 60000, enableHighAccuracy: false })),
      new Promise((_, mal) => { setTimeout(() => mal(new Error('timeout')), 4500); }),
    ]);
    const { latitude: lat, longitude: lng, accuracy } = pos?.coords || {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
    return { p_lat: lat, p_lng: lng, p_accuracy: Number.isFinite(accuracy) ? accuracy : null };
  } catch {
    return {};
  }
}

/** Lo que da el QR: «1 sello en Cafés», «1 uso de tu bono «10 cafés»» o el
 * texto de «algo del momento». */
function momentoQue(d) {
  if (d.kind === 'stamps') {
    return d.stamps === 1 ? `1 sello en ${d.label}` : `${d.stamps} sellos en ${d.label}`;
  }
  if (d.kind === 'pass_use') return `1 uso de tu bono «${d.label}»`;
  return d.label || '';
}

/** Lo que lleva: «Llevas 3 de 8 · Premio: Un vermú gratis» o «Te quedan 7 de 10». */
function momentoLleva(d) {
  if (d.kind === 'stamps' && d.card) {
    return [`Llevas ${d.card.stamps || 0} de ${d.card.goal}`, d.card.reward ? `Premio: ${d.card.reward}` : '']
      .filter(Boolean).join(' · ');
  }
  if (d.kind === 'pass_use' && d.pass) {
    return d.pass.uses_left === 1 ? `Te queda 1 de ${d.pass.uses_total}` : `Te quedan ${d.pass.uses_left} de ${d.pass.uses_total}`;
  }
  return '';
}

const momentoLogo = (b) => (b?.logo_url
  ? `<img class="momento-logo" src="${esc(b.logo_url)}" alt="" loading="lazy">`
  : `<span class="momento-logo ph" aria-hidden="true">${ic('storefront')}</span>`);

RUTAS.momento = async ([token]) => {
  if (!exigeSesion(`momento/${token || ''}`)) return;
  const fuera = (clave, d) => {
    pinta(pantallaVacia({
      icono: 'qr_code_2',
      titulo: t(MOMENTO_ERR[clave] || 'Algo no ha ido bien. Si vuelve a pasar, escríbenos a info@klendar.app.'),
      h: 'h1',
      texto: clave === 'qr_expired' ? t('Pide que te lo enseñen otra vez: cambia cada 30 segundos.')
        : clave === 'too_far' ? t('Acércate y vuelve a escanear el QR.') : (d?.business?.name || ''),
      botones: `<a class="pill accent" href="#/codigos">${esc(t('Tus códigos'))}</a>`,
    }));
  };
  // La ubicación, solo si ya hay permiso (para «Aceptar», la misma).
  const donde = await momentoDonde();
  let d;
  try {
    d = await llamar('spot_give_info', { p_token: token || '', ...donde });
  } catch (e) {
    fuera(e.clave, e.datos);
    return;
  }
  const lleva = momentoLleva(d);
  pinta(`
    <div class="ticket momento">
      ${momentoLogo(d.business)}
      <p class="muted">${esc(`${d.business?.name || ''} te da:`)}</p>
      <h1>${esc(momentoQue(d))}</h1>
      ${lleva ? `<p class="muted">${esc(lleva)}</p>` : ''}
      ${d.adults_only ? `<p><b>${esc(t('Solo para mayores de 18'))}</b></p>` : ''}
      <p><button class="pill accent grande" id="momento-acepta" type="button">${esc(t('Aceptar'))}</button></p>
      <p><a class="link" href="#/codigos">${esc(t('Ahora no'))}</a></p>
      <p class="muted nota">${esc(t('Lo da y lo cumple el negocio.'))}</p>
    </div>`);
  const boton = $('#momento-acepta');
  boton.onclick = async () => {
    boton.disabled = true;
    let r;
    try {
      r = await llamar('spot_give_accept', { p_token: token || '', ...donde });
    } catch (e) {
      fuera(e.clave, e.datos || d);
      if (navigator.vibrate) navigator.vibrate([60, 60, 60]);
      return;
    }
    if (navigator.vibrate) navigator.vibrate(120);
    const premio = r.kind === 'stamps' && r.card && r.card.stamps >= r.card.goal;
    const lineas = [
      r.kind === 'stamps' ? (premio ? '¡Premio listo! Pídelo en Tarjetas de sellos.' : momentoLleva(r).split(' · ')[0]) : '',
      r.kind === 'pass_use' ? momentoLleva(r) : '',
      r.kind === 'gift' ? 'Lo tienes en Tus códigos. Si te lo piden, enséñalo.' : '',
      r.auto_stamps > 0 ? (r.auto_stamps === 1 ? 'Y 1 sello más en tus tarjetas de aquí.'
        : `Y ${r.auto_stamps} sellos más en tus tarjetas de aquí.`) : '',
    ].filter(Boolean);
    const [href, texto] = r.kind === 'stamps' ? ['#/sellos', 'Tarjetas de sellos']
      : r.kind === 'pass_use' && r.pass?.id ? [`#/bono/${r.pass.id}`, 'Bonos'] : ['#/codigos', 'Tus códigos'];
    pinta(`
      <div class="ticket canjeado momento" role="status">
        <p class="hecho-ic" aria-hidden="true">✓</p>
        <h1>${esc(t('¡Hecho!'))}</h1>
        <p><b>${esc(`${momentoQue(r)} · ${r.business?.name || ''}`)}</b></p>
        ${lineas.map((l) => `<p class="muted">${esc(t(l))}</p>`).join('')}
        <p><a class="pill" href="${esc(href)}">${esc(t(texto))}</a></p>
      </div>`);
  };
};

/** «Algo del momento» que te dieron, en «Tus códigos» («Te dieron»): ya
 * canjeado, con el negocio y cuándo. */
function momentoFila(g) {
  const cuando = fecha(g.received_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const dentro = `
      ${g.business_logo ? `<img src="${esc(g.business_logo)}" alt="" loading="lazy">` : `<span class="ph">${ic('volunteer_activism')}</span>`}
      <span class="ocard-body"><b>${esc(g.gift)}</b>
        <span class="muted">${esc(`${g.business_name} · ${cuando}`)}</span>
        <span class="ocard-meta"><span class="tag off">${esc(t('Canjeado'))}</span></span>
      </span>`;
  return g.business_slug
    ? `<a class="ocard" href="${PUB_EN ? '/en' : ''}/b/${esc(g.business_slug)}">${dentro}</a>`
    : `<div class="ocard">${dentro}</div>`;
}
