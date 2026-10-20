/* «Tu cuenta»: «Te aviso cuando esté listo» (tanda D, migración
 * 20261235100000 de la app).
 *
 * - `#/listo/<código>`: «Tu pedido», lo mismo que `/listo/<código>` en la
 *   app. Sin pedido: el local y «Avísame cuando esté listo» (sin sesión,
 *   «Entrar para que te avisemos»). Con pedido: «Tu número», «Preparando…» y
 *   «Ya no lo espero»; al marcarlo, «¡Listo! Pasa a recogerlo», y si la
 *   página está abierta suena, vibra y, si lo has permitido, sale un aviso
 *   del navegador. Mientras espera, «Mientras esperas»: «Añadir a favoritos»
 *   y las ofertas de hoy del local. Se vuelve a pedir cada 10 s.
 * - En «Tus códigos» y en Planes, arriba: «Tu pedido en {negocio}»
 *   (`listoTarjetasHtml`).
 *
 * La página pública del cartel (`/listo/<código>`, assets/listo.js) trae aquí
 * a quien ya tiene sesión. Va después de app.js y de cola.js (usa su sonido:
 * `colaPreparaSonido`, `colaSuena`) y comparte ámbito: los nombres de aquí
 * empiezan por `listo`.
 */
'use strict';

/** Los errores, en palabras (los mismos que la app). */
const LISTO_ERR = {
  rate_limited: 'Demasiados intentos. Espera un minuto.',
  orders_off: 'Este local no avisa de pedidos ahora',
  orders_paused: 'Ahora no se pueden pedir avisos aquí',
  orders_ended: 'Los avisos han terminado por hoy',
  team: 'Eres del equipo de este local.',
  adults_only: 'Solo para mayores de 18 años.',
  bad_code: 'Este cartel ya no funciona.',
};
const listoError = (e) => (LISTO_ERR[e?.clave] ? t(LISTO_ERR[e.clave]) : (e?.message || amable('')));

/** El icono (takeout_dining), en SVG: no está en la fuente recortada. */
const LISTO_SVG = '<svg class="ms-svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m7.79 18-.51-7h9.46l-.51 7H7.79zM9.83 5h4.33l2.8 2.73L16.87 9H7.12l-.09-1.27L9.83 5zM22 7.46l-1.41-1.41L19 7.63l.03-.56L14.98 3H9.02L4.97 7.07l.03.5-1.59-1.56L2 7.44l3.23 3.11.7 9.45h12.14l.7-9.44L22 7.46z"/></svg>';

const listoNumero = (n) => (EN ? `No. ${n}` : t(`Nº ${n}`));
const listoFicha = (b) => `${pre}/b/${encodeURIComponent(b?.slug || b?.id || '')}`;

/** «¡Listo!»: suena, vibra y, si se ha permitido, aviso del navegador. */
function listoAvisa(negocio, numero) {
  try { if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 600]); } catch { /* sin vibración */ }
  colaSuena();
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      new Notification(t('¡Listo! Pasa a recogerlo'), {
        body: `${negocio} · ${listoNumero(numero)}`,
        tag: 'klendar-listo', icon: '/assets/icon-192.png',
      });
    }
  } catch { /* sin aviso: suena y vibra */ }
}

const listoCartelMalo = () => pinta(pantallaVacia({
  icono: 'qr_code_2', h: 'h1',
  titulo: t('Este cartel ya no funciona'),
  texto: t('Puede que el local lo haya cambiado. Pregunta en el mostrador.'),
  botones: botonTuCuenta(),
}));

/** «Mientras esperas»: favoritos y lo de hoy del local (como mucho tres:
 * `business_offers_page` con el día de hoy en la hora del local). Si falla
 * algo, lo que se pueda. */
async function listoMientras(b) {
  const zona = await zonasDe([{ business_id: b.id }]).catch(() => null);
  const tz = (zona && zona({ business_id: b.id })) || 'Europe/Madrid';
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  const [fav, ofertas] = await Promise.all([
    YO ? sb.from('favorites').select('business_id').eq('business_id', b.id).eq('user_id', YO.id).limit(1)
      .then((r) => Array.isArray(r.data) && r.data.length > 0, () => false) : false,
    llamar('business_offers_page', { p_id: b.id, p_day: hoy, p_limit: 3 }).catch(() => []),
  ]);
  const lista = (Array.isArray(ofertas) ? ofertas : []).slice(0, 3);
  return `<section class="listo-mientras" aria-labelledby="listo-mientras-h">
      <h2 id="listo-mientras-h" class="listo-h2">${esc(t('Mientras esperas'))}</h2>
      <button type="button" class="pill${fav ? ' on' : ''}" id="listo-fav" aria-pressed="${fav}">
        ${ic(fav ? 'favorite' : 'favorite_border')}${esc(t(fav ? 'Quitar de favoritos' : 'Añadir a favoritos'))}</button>
      ${lista.length ? `<div class="olist">${lista.map((o) => `<a class="ocard" href="${esc(`${pre}/o/${encodeURIComponent(o.id)}`)}">
          ${(o.images || [])[0] ? `<img src="${esc(o.images[0])}" alt="" loading="lazy">` : `<span class="ph">${LISTO_SVG}</span>`}
          <span class="ocard-body"><b>${esc(o.title || '')}</b></span>${ic('chevron_right')}</a>`).join('')}</div>` : ''}
    </section>`;
}

RUTAS.listo = async ([code]) => {
  const codigo = /^[A-Za-z0-9_-]{16}$/.test(code || '') ? code : '';
  if (!codigo) { listoCartelMalo(); return; }
  let info;
  try {
    info = await llamar('orders_info', { p_code: codigo });
  } catch (e) {
    if (e.clave === 'bad_code') { listoCartelMalo(); return; }
    throw e;
  }
  let firma = '';
  let mirando = false;
  let mientras = '';

  const firmaDe = (d) => JSON.stringify([d.team, d.state, d.me && [d.me.id, d.me.status]]);

  const cabecera = (b) => `
    <p class="crumbs"><a href="#/codigos">${esc(t('Tus códigos'))}</a></p>
    <p class="cola-kicker">${esc(t('Te aviso cuando esté listo'))}</p>
    <h1 class="cola-h1">${esc(b.name || '')}</h1>`;

  const pedir = async (boton) => {
    colaPreparaSonido();
    await ocupado(boton, async () => {
      try {
        await llamar('order_join', { p_code: codigo });
      } catch (e) {
        toast(listoError(e), true);
      }
      await mira(true);
    });
  };

  const pintaListo = (d) => {
    firma = firmaDe(d);
    const b = d.business || {};
    const me = d.me;
    const vivo = me && (me.status === 'waiting' || me.status === 'ready');
    document.title = `${me?.status === 'ready' ? `${t('¡Listo! Pasa a recogerlo')} · ` : ''}${t('Tu pedido')} · Klendar`;
    const verLocal = (cls = 'accent') => `<a class="pill ${cls}" href="${esc(listoFicha(b))}">${esc(t('Ver el local'))}</a>`;
    if (d.team) {
      pinta(pantallaVacia({
        icono: 'storefront', h: 'h1',
        titulo: EN ? `You're on the ${b.name} team` : t(`Eres del equipo de ${b.name}`),
        texto: t('Los pedidos se llevan desde «Pedidos de hoy», en Mi negocio.'),
        botones: `<a class="pill accent" href="/panel/#/pedidos?biz=${esc(b.id)}">${esc(t('Ir a Pedidos de hoy'))}</a>`,
      }));
      return;
    }
    if (vivo) {
      const listo = me.status === 'ready';
      const avisos = !listo && typeof Notification !== 'undefined' && Notification.permission === 'default';
      pinta(`${cabecera(b)}
        <section class="cola-turno${listo ? ' llamado' : ''}" aria-live="polite">
          ${listo ? `<p class="cola-toca">${esc(t('¡Listo! Pasa a recogerlo'))}</p>` : ''}
          <p class="cola-tu">${esc(t('Tu número'))}</p>
          <p class="cola-numero">${esc(String(me.number))}</p>
          ${listo
    ? `<p class="cola-linea"><b>${esc(t('Di tu número en el mostrador.'))}</b></p>`
    : `<p class="cola-linea"><b>${esc(t('Preparando…'))}</b></p>
             <p class="muted">${esc(t('Te avisamos en cuanto esté. Con la página abierta, suena y vibra.'))}</p>`}
        </section>
        <div class="cola-botones">
          ${avisos ? `<button type="button" class="pill" id="listo-avisos">${esc(t('Activar avisos'))}</button>` : ''}
          <button type="button" class="pill" id="listo-salir">${esc(t('Ya no lo espero'))}</button>
        </div>
        <div id="listo-mientras">${mientras}</div>`);
      $('#listo-avisos')?.addEventListener('click', async (ev) => {
        colaPreparaSonido();
        try { await Notification.requestPermission(); } catch { /* navegador viejo */ }
        ev.currentTarget.remove();
      });
      $('#listo-salir').onclick = async (ev) => {
        const boton = ev.currentTarget;
        const ok = await confirma({
          titulo: t('¿Ya no lo esperas?'),
          texto: t('Dejaremos de avisarte de este pedido.'),
          aceptar: t('Ya no lo espero'), cancelar: t('Seguir esperando'), peligro: true,
        });
        if (!ok) return;
        await ocupado(boton, async () => {
          await llamar('order_leave', { p_ticket: me.id });
          await mira(true);
        });
      };
      if (!mientras) {
        listoMientras(b).then((h) => {
          mientras = h;
          const caja = $('#listo-mientras');
          if (caja) { caja.innerHTML = h; I18N.translate(caja); enganchaFav(b); }
        }).catch(() => {});
      } else {
        enganchaFav(b);
      }
      return;
    }
    const disponible = d.state === 'available';
    const otro = `<button type="button" class="pill accent" id="listo-otro">${esc(t('Avísame de otro pedido'))}</button>`;
    if (me) {
      const fin = {
        picked_up: ['check_circle', '¡Que aproveche!', 'Has recogido tu pedido.'],
        expired: ['timer_off', 'Tu pedido se cerró solo', 'Pasaron 2 horas sin recogerlo. Si aún lo esperas, pregunta en el mostrador.'],
        removed: ['block', 'Tu pedido ya no está en la lista', 'El local lo ha quitado. Si es un error, pregunta en el mostrador.'],
        left: ['close', 'Ya no esperas este pedido', 'Si ha sido sin querer, pide otro aviso.'],
      }[me.status] || ['close', 'Ya no esperas este pedido', 'Si ha sido sin querer, pide otro aviso.'];
      pinta(`<p class="crumbs"><a href="#/codigos">${esc(t('Tus códigos'))}</a></p>
        ${pantallaVacia({
    icono: fin[0], h: 'h1', titulo: t(fin[1]), texto: t(fin[2]),
    botones: disponible ? otro : verLocal(),
  }).replace('<section class="vacio">', `<section class="vacio"><p class="cola-kicker">${esc(b.name || '')} · ${esc(listoNumero(me.number))}</p>`)}`);
      $('#listo-otro')?.addEventListener('click', (ev) => pedir(ev.currentTarget));
      return;
    }
    if (!disponible) {
      const [tit, txt] = {
        off: ['Este local no avisa de pedidos ahora', t('Pregunta en el mostrador.')],
        paused: ['Ahora no se pueden pedir avisos aquí', EN ? `${b.name} isn’t serving on Klendar right now. Ask at the counter.` : t(`${b.name} no está atendiendo en Klendar en este momento. Pregunta en el mostrador.`)],
        ended: ['Los avisos han terminado por hoy', EN ? `${b.name} isn’t sending any more order alerts today. Ask at the counter.` : t(`${b.name} ya no avisa de más pedidos hoy. Pregunta en el mostrador.`)],
      }[d.state] || ['Este local no avisa de pedidos ahora', t('Pregunta en el mostrador.')];
      pinta(pantallaVacia({ icono: 'storefront', h: 'h1', titulo: t(tit), texto: txt, botones: verLocal() }));
      return;
    }
    pinta(`${cabecera(b)}
      <section class="cola-turno">
        <p class="cola-cuantos listo-intro">${esc(t('¿Has pedido en el mostrador? Te avisamos en el móvil cuando esté listo.'))}</p>
        <div class="cola-botones">
          ${YO ? `<button type="button" class="pill accent" id="listo-pedir">${esc(t('Avísame cuando esté listo'))}</button>`
    : `<a class="pill accent" href="#/entrar?siguiente=${encodeURIComponent(`listo/${codigo}`)}">${esc(t('Entrar para que te avisemos'))}</a>`}
        </div>
        <p class="muted cola-ayuda">${esc(t('Te daremos un número: es el que dicen en el mostrador.'))}</p>
        ${b.adults_only ? `<p class="muted cola-ayuda">${esc(t('Solo para mayores de 18 años.'))}</p>` : ''}
      </section>`);
    $('#listo-pedir')?.addEventListener('click', (ev) => pedir(ev.currentTarget));
  };

  /** «Añadir a favoritos» de «Mientras esperas». */
  function enganchaFav(b) {
    const boton = $('#listo-fav');
    if (!boton) return;
    boton.onclick = () => ocupado(boton, async () => {
      try {
        await llamar('toggle_favorite', { p_business_id: b.id });
      } catch (e) { toast(e?.message || amable(''), true); return; }
      mientras = await listoMientras(b).catch(() => mientras);
      const caja = $('#listo-mientras');
      if (caja) { caja.innerHTML = mientras; I18N.translate(caja); enganchaFav(b); }
    });
  }

  /** Vuelve a pedir el pedido; si lo acaban de marcar, suena y vibra. */
  const mira = async (forzar = false) => {
    if (mirando || (!forzar && document.visibilityState === 'hidden')) return;
    mirando = true;
    try {
      const d = await llamar('orders_info', { p_code: codigo });
      const antes = info.me;
      info = d;
      if (antes?.status === 'waiting' && d.me?.id === antes.id && d.me.status === 'ready') {
        listoAvisa(d.business?.name || '', d.me.number);
      }
      if (forzar || firmaDe(d) !== firma) { pintaListo(d); I18N.translate(view); }
    } catch (e) {
      if (e.clave === 'bad_code') { listoCartelMalo(); clearInterval(reloj); }
    } finally { mirando = false; }
  };

  pintaListo(info);
  const reloj = setInterval(() => mira(), 10000);
  const alVolver = () => { if (document.visibilityState === 'visible') mira(); };
  document.addEventListener('visibilitychange', alVolver);
  document.addEventListener('pointerdown', colaPreparaSonido, { once: true, capture: true });
  alSalir(() => {
    clearInterval(reloj);
    document.removeEventListener('visibilitychange', alVolver);
    document.removeEventListener('pointerdown', colaPreparaSonido, { capture: true });
    document.title = `${t('Tu cuenta')} · Klendar`;
  });
};

// ── «Tu pedido en {negocio}» en «Tus códigos» y en Planes ─────────────────
/** Las tarjetas de los pedidos activos (`my_orders`), o ''. */
function listoTarjetasHtml(pedidos) {
  const lista = (Array.isArray(pedidos) ? pedidos : []).filter((x) => x && (x.status === 'waiting' || x.status === 'ready'));
  if (!lista.length) return '';
  return `<div class="olist cola-tarjetas">${lista.map((x) => {
    const b = x.business || {};
    const listo = x.status === 'ready';
    const linea = listo ? t('¡Listo! Pasa a recogerlo') : `${listoNumero(x.number)} · ${t('Preparando…')}`;
    return `<a class="ocard cola-tarjeta${listo ? ' llamado' : ''}" href="#/listo/${esc(x.code)}">
        ${b.logo_url ? `<img src="${esc(b.logo_url)}" alt="" loading="lazy">` : `<span class="ph">${LISTO_SVG}</span>`}
        <span class="ocard-body"><b>${esc(EN ? `Your order at ${b.name || ''}` : t(`Tu pedido en ${b.name || ''}`))}</b>
          <span class="${listo ? 'cola-toca-linea' : 'muted'}">${esc(linea)}</span>
        </span>
        ${ic('chevron_right')}
      </a>`;
  }).join('')}</div>`;
}
