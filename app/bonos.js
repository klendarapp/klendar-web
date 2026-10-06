/* «Tu cuenta»: bonos pagados en el local (tanda B, migración 20261202100000).
 *
 * - «Tu QR de cliente» (#/qr-cliente): lo escanea el negocio para cargar un
 *   bono o descontar un uso. Cambia cada 30 segundos (una captura vieja no
 *   vale): la clave y el secreto se piden a `customer_qr_key` y la firma se
 *   calcula aquí con HMAC-SHA256, igual que la app y que la base
 *   (`customer_qr_check`). El secreto solo vive en la memoria de la página.
 * - En «Tus códigos», arriba: el QR de cliente y la sección «Bonos».
 * - Cada bono (#/bono/<id>): usos que quedan, caducidad, qué incluye,
 *   condiciones e historial de usos.
 *
 * Va después de app.js y usa lo suyo (`RUTAS`, `llamar`, `pinta`, `t`, `esc`,
 * `ic`, `fecha`, `money`, `pantallaVacia`…). Comparten ámbito: los nombres de
 * aquí empiezan por `bono`.
 */
'use strict';

Object.assign(ERRORES, {
  qr_expired: 'Ese QR ya no vale.',
  qr_invalid: 'No es un QR de cliente de Klendar.',
});

/** «12 de noviembre de 2027». */
const bonoFecha = (iso) => fecha(iso, { day: 'numeric', month: 'long', year: 'numeric' });
/** «Te quedan 7 de 10». */
const bonoQuedan = (left, total) => (EN ? `${left} of ${total} left`
  : left === 1 ? `Te queda 1 de ${total}` : `Te quedan ${left} de ${total}`);

/** Lo que se dice del estado o de la caducidad. */
function bonoEstado(p) {
  switch (p.state) {
    case 'used_up': return t('Gastado: no quedan usos');
    case 'expired': return p.expires_at ? `${t('Caducó el')} ${bonoFecha(p.expires_at)}` : t('Caducado');
    case 'closed': return t('El negocio ya no está en Klendar. Lo que quede, reclámaselo al negocio.');
    default: return p.expires_at ? `${t('Caduca el')} ${bonoFecha(p.expires_at)}` : t('Sin caducidad');
  }
}

/** La barra de lo que queda (neutra: el texto lo dice todo). */
const bonoBarra = (p) => `<span class="bono-barra" aria-hidden="true"><span style="width:${p.uses_total ? Math.round((p.uses_left / p.uses_total) * 100) : 0}%"></span></span>`;

/** «Tu QR de cliente», arriba en «Tus códigos». */
function bonoFilaQr() {
  return `<a class="ocard" href="#/qr-cliente">
      <span class="ph">${ic('qr_code_2')}</span>
      <span class="ocard-body"><b>${esc(t('Tu QR de cliente'))}</b>
        <span class="muted">${esc(t('Para comprar o usar bonos en el local'))}</span>
      </span>
    </a>`;
}

/** Un bono en «Tus códigos». */
function bonoFila(p) {
  return `<a class="ocard bono" href="#/bono/${esc(p.id)}">
      ${p.business_logo ? `<img src="${esc(p.business_logo)}" alt="" loading="lazy">` : `<span class="ph">${ic('local_activity')}</span>`}
      <span class="ocard-body"><b>${esc(p.name)}</b>
        <span class="muted">${esc(p.business_name || '')}</span>
        <span class="bono-quedan">${esc(bonoQuedan(p.uses_left, p.uses_total))}</span>
        ${bonoBarra(p)}
        <span class="${p.state === 'active' ? 'muted' : 'bono-estado'}">${esc(bonoEstado(p))}</span>
      </span>
    </a>`;
}

// ── Tu QR de cliente ──────────────────────────────────────────────────────
let BONO_RELOJ = null;
/** HMAC-SHA256(secreto, texto) en hexadecimal. */
async function bonoFirma(secreto, texto) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(texto)));
  return [...s].map((b) => b.toString(16).padStart(2, '0')).join('');
}

RUTAS['qr-cliente'] = async () => {
  if (!exigeSesion('qr-cliente')) return;
  if (!window.crypto?.subtle) {
    pinta(pantallaVacia({ icono: 'qr_code_2', titulo: t('Tu QR de cliente'), h: 'h1',
      texto: t('Este navegador no puede enseñar el QR. Ábrelo en la app de Klendar o en otro navegador.') }));
    return;
  }
  const clave = await llamar('customer_qr_key', {});
  const desfase = Number(clave.now || 0) - Math.floor(Date.now() / 1000);
  const paso = Number(clave.step || 30);
  pinta(`
    <p class="crumbs"><a href="#/codigos">${esc(t('Tus códigos'))}</a></p>
    <div class="ticket">
      <h1>${esc(t('Tu QR de cliente'))}</h1>
      <p>${esc(t('Enséñaselo al negocio para cargar un bono o descontar un uso.'))}</p>
      <div class="qr" id="qr-cliente" role="img" aria-label="${esc(t('Tu QR de cliente'))}"></div>
      <p class="muted" id="qr-cambia" aria-hidden="true"></p>
      <p class="muted">${esc(t('Solo un negocio de Klendar puede leerlo, y ve tu nombre visible y tus bonos de ese negocio.'))}</p>
    </div>`);
  let ventanaPintada = -1;
  const tick = async () => {
    const caja = $('#qr-cliente');
    if (!caja) { clearInterval(BONO_RELOJ); BONO_RELOJ = null; return; }
    const ahora = Math.floor(Date.now() / 1000) + desfase;
    const w = Math.floor(ahora / paso);
    $('#qr-cambia').textContent = EN ? `Changes in ${paso - (ahora % paso)}s: a screenshot won't work`
      : `Cambia en ${paso - (ahora % paso)} s: una captura no sirve`;
    if (w === ventanaPintada) return;
    ventanaPintada = w;
    const firma = (await bonoFirma(clave.secret, `${clave.key}.${w}`)).slice(0, 12);
    const qr = window.qrcode(0, 'M');
    qr.addData(`https://klendar.app/c/${clave.key}.${w}.${firma}`);
    qr.make();
    caja.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  };
  if (BONO_RELOJ) clearInterval(BONO_RELOJ);
  BONO_RELOJ = setInterval(tick, 1000);
  await tick();
};

// ── Un bono ───────────────────────────────────────────────────────────────
RUTAS.bono = async ([id]) => {
  if (!exigeSesion(`bono/${id}`)) return;
  const lista = await llamar('my_passes', {});
  const p = (lista || []).find((x) => x.id === id);
  if (!p) {
    pinta(pantallaVacia({ icono: 'local_activity', titulo: t('Ese bono no está'), h: 'h1',
      texto: t('Puede que el negocio deshiciera la venta. Tus bonos están en «Tus códigos».'),
      botones: `<a class="pill accent" href="#/codigos">${esc(t('Tus códigos'))}</a>` }));
    return;
  }
  const usos = p.uses || [];
  const dato = (k, v) => (v ? `<div class="fila fila-dato"><span class="fila-t"><small>${esc(k)}</small><b>${esc(v)}</b></span></div>` : '');
  pinta(`
    <p class="crumbs"><a href="#/codigos">${esc(t('Tus códigos'))}</a></p>
    <h1>${esc(p.name)}</h1>
    <p class="muted">${p.business_slug ? `<a href="${EN ? '/en' : ''}/b/${esc(p.business_slug)}">${esc(p.business_name)}</a>` : esc(p.business_name || '')}</p>
    <div class="bono-caja">
      <p class="bono-quedan grande">${esc(bonoQuedan(p.uses_left, p.uses_total))}</p>
      ${bonoBarra(p)}
      <p>${esc(bonoEstado(p))}</p>
      ${p.state === 'active' ? `<p><a class="pill accent" href="#/qr-cliente">${ic('qr_code_2')} ${esc(t('Enseñar mi QR'))}</a></p>
        <p class="muted">${esc(t('El negocio lo escanea y descuenta un uso.'))}</p>` : ''}
    </div>
    <div class="lista">
      ${dato(t('Incluye'), p.includes)}
      ${dato(t('Condiciones'), p.terms)}
      ${dato(t('Lo compraste'), [bonoFecha(p.sold_at), money(p.price_cents, p.currency)].filter(Boolean).join(' · '))}
    </div>
    <h2 class="seccion-t">${esc(t('Historial'))}</h2>
    ${usos.length ? `<ul class="bono-usos">${usos.map((u, i) => `<li>${esc(`${EN ? 'Use' : 'Uso'} ${usos.length - i} · ${fecha(u.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`)}</li>`).join('')}</ul>`
    : `<p class="muted">${esc(t('Aún no lo has usado.'))}</p>`}
    <p class="muted nota">${esc(t('El bono lo vende y lo cumple el negocio, y lo pagaste allí. Klendar solo lleva la cuenta de los usos. Si tienes algún problema con él, habla con el negocio.'))}</p>`);
};
