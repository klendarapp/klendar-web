/* Panel del negocio: el estado de las herramientas y lo que se pinta con él
 * (Iván, 2026-10-10: «no quitar nada, cuantas más cosas extras mejor, pero
 * organizadas»; desde el 23-11, con las cuatro secciones de la app,
 * §4zzz-panelapp):
 *
 * - El estado de cada herramienta en una sola llamada
 *   (`business_tools_overview`, migración 20261212100000 de la app): qué está
 *   activo y cuánto, sin datos de personas. Lo ve todo el equipo. Se guarda
 *   en el navegador para que Hoy, Publicar y Negocio no esperen.
 * - En Hoy: «Por contestar» y las filas de «Ahora» (aforo, menú del día,
 *   cola cerrada, antes de cerrar, partidos, teles, lo que se publica solo).
 * - En Publicar: «¿Qué quieres publicar?» (las cuatro de siempre y «Más
 *   formas de publicar ▾»).
 * - Las baldosas de Negocio, por grupos, están en panel/negocio.js (antes,
 *   «Lo esencial» del resumen y «Más herramientas»; hoy en /panel/negocio).
 *
 * Va después de panel.js y usa lo suyo (`PAGES`, `rpc`, `BIZ`, `gestiona`,
 * `esOrganizador`, `esc`, `ms`, `icono`, `SVG`, `bi`, `toast`, `fmtNum`).
 * Comparten ámbito: los nombres de aquí empiezan por `herr`.
 */
'use strict';

// Iconos que no están en la fuente recortada del panel.
Object.assign(SVG, {
  herramientas: 'M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z',
  enlace: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  codigo: 'M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
  // Aforo en directo (how_to_reg).
  aforo: 'M9 17l3-2.94c-.39-.04-.68-.06-1-.06-2.67 0-8 1.34-8 4v2h9l-3-3zm2-5c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm4.47 8.5L12 17l1.4-1.41 2.07 2.08 5.13-5.17 1.4 1.41-6.53 6.59z',
  candado: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z',
});

/** El último estado leído (para «Crear»: «Menú del día» solo a los sitios
 * de comida). */
let herrUltimo = null;

/** Lo último que se supo de las herramientas de un negocio, guardado en el
 * navegador: el resumen pinta «Ahora» (Menú del día, antes de cerrar, cola…)
 * y «Crear» lo usa mientras llega lo de ahora, así que no aparecen tarde
 * empujando lo de debajo (Iván, 11-11; como la app). */
const HERR_GUARDADO = 'klendar.herr.';
function herrGuardado(biz) {
  try {
    const o = JSON.parse(localStorage.getItem(HERR_GUARDADO + biz) || 'null');
    return o && o.biz === biz ? o : null;
  } catch { return null; }
}

/** El estado de las herramientas del negocio de ahora (null si falla). */
async function herrEstado() {
  const r = await rpc('business_tools_overview', { p_business: BIZ.id }).catch(() => null);
  herrUltimo = r && r.ok !== false ? { ...r, biz: BIZ.id } : null;
  if (herrUltimo) {
    try { localStorage.setItem(HERR_GUARDADO + BIZ.id, JSON.stringify(herrUltimo)); } catch { /* sin almacenamiento */ }
  }
  return herrUltimo;
}
/** «Menú del día» sugerido (sitio de comida o ya ha publicado uno). */
const herrAhora = () => (herrUltimo?.biz === BIZ?.id ? herrUltimo : herrGuardado(BIZ?.id));
const herrMenuSugerido = () => gestiona() && !esOrganizador() && !esEntidad()
  && herrSi(herrAhora(), 'daily_menu', 'suggested');
/** «Antes de cerrar» sugerido (panaderías, cafeterías, restaurantes…). */
const herrAntesSugerido = () => gestiona() && !esOrganizador() && !esEntidad()
  && herrSi(herrAhora(), 'before_closing', 'suggested');
const herrNum = (o, k, f) => Number(o?.[k]?.[f]) || 0;
const herrSi = (o, k, f) => o?.[k]?.[f] === true;
/** ¿Se enseña la herramienta [k]? Si su tipo de negocio la lleva (`features`
 * de `business_tools_overview`, migración 20261275100000 de la app: la suma
 * de sus categorías) o si ya la usa ([usa]): a nadie se le esconde lo que
 * tiene puesto. Sin `features` (una base sin la migración), sí, como antes. */
const herrLleva = (o, k, usa) => !!usa || o?.features?.[k] !== false;
/** Plural sencillo: herrPl(n, ['1 tele', 'teles'], ['1 TV', 'TVs']). Con
 * varios se traduce la plantilla «{n} teles» (en los idiomas nuevos, el
 * diccionario la tiene así) y luego se pone el número. */
const herrPl = (n, [es1, esN], [en1, enN]) => (n === 1
  ? bi(es1, en1)
  : bi(`{n} ${esN}`, `{n} ${enN}`).replace('{n}', fmtNum(n)));

// ── «Crear»: qué publicar ───────────────────────────────────────────────────
/** ¿Está abierto «Más formas de publicar»? Se recuerda mientras dura la
 * página (entre visitas pediría una línea más en la política de cookies). */
let herrMasAbierto = false;

/** «¿Qué quieres publicar?», arriba en Publicar, como la pestaña Publicar
 * de la app (Iván, 18-11; ordenado el 20-11, revisión del negocio): arriba
 * las cuatro de siempre (oferta, evento, menú del día o, si no lo lleva,
 * antes de cerrar, y novedad) y el resto en «Más formas de publicar ▾»
 * (plegado, recordado y diciendo qué hay dentro): lo que quede del día
 * (antes de cerrar con menú del día, la oferta para el partido), «Para los
 * tuyos» (primera visita, exclusiva, oferta para RRPP, avisar a mis
 * clientes) y «Para vender o dar en el local» (bono, tarjeta de sellos,
 * algo para encargar, sorteo). Cada fila, solo con su nombre: la pregunta
 * ya dice que es publicar («Avisar a mis clientes» se queda: no se publica,
 * se manda). Todo sigue también en su sitio (Fidelizar, RRPP, Partidos, Más
 * herramientas). Solo sale lo que va con ese negocio, con las reglas de su
 * sitio: sin local fijo, sin menú del día, antes de cerrar ni partidos; una
 * entidad, sin los dos grupos de abajo; los encargos con
 * `app_config.preorders` y su tipo; los sorteos con `app_config.giveaways`. */
async function herrCrearHtml() {
  const o = herrAhora();
  const ent = esEntidad();
  const local = !esOrganizador() && !ent;
  const conSorteos = !ent && typeof sorteosEnPanel === 'function' && await sorteosEnPanel().catch(() => false);
  const cosas = herrNum(o, 'preorders', 'items_all');
  const conEncargos = !ent && herrSi(o, 'preorders', 'enabled') && herrLleva(o, 'preorders', cosas > 0);
  const menu = herrMenuSugerido();
  const antes = herrAntesSugerido();
  // Cada opción: [href, icono, nombre, para qué]; null si no va.
  const op = ([href, icon, titulo, frase]) => `<a class="crear-op" href="${href}">${icono(icon)}
    <span><b>${esc(titulo)}</b><small>${esc(frase)}</small></span>${ms('chevron_right')}</a>`;
  const lista = (ops) => `<div class="crear-ops">${ops.map(op).join('')}</div>`;
  const grupo = (titulo, ops) => (ops.length ? `<h3 class="crear-grupo">${esc(titulo)}</h3>${lista(ops)}` : '');
  const opMenu = ['/panel/menu-del-dia', 'restaurant_menu', bi('Menú del día', 'Daily menu'), bi('Foto de la pizarra y precio: hasta el cierre, en un toque.', 'Photo of the board and price: until closing, in one tap.')];
  const opAntes = ['/panel/antes-de-cerrar', 'bolsa', bi('Antes de cerrar', 'Before closing'), bi('Lo que te ha sobrado hoy, con lo de la última vez ya puesto. Se paga en el local.', "What's left over today, with last time's details filled in. Paid at the venue.")];
  // Una entidad publica eventos y novedades, gratis (la base tampoco le deja
  // crear una oferta; §4zzz-propent).
  const arriba = [
    ent ? null : ['/panel/publicaciones/nueva-flash', 'local_offer', bi('Oferta', 'Offer'), bi('De unas horas a varios días, o cada semana.', 'From a few hours to several days, or every week.')],
    ent
      ? ['/panel/publicaciones/nuevo-evento', 'event', bi('Evento', 'Event'), bi('Con fecha y hora, gratis. Puede llevar un enlace para apuntarse.', 'Has a date and time, free. Can include a sign-up link.')]
      : ['/panel/publicaciones/nuevo-evento', 'event', bi('Evento', 'Event'), bi('Con fecha y hora. Puede tener precio y enlace para entradas.', 'With a date and time. It can have a price and a ticket link.')],
    menu ? opMenu : antes ? opAntes : null,
    ent
      ? ['/panel/novedades', 'campaign', bi('Novedad', 'News'), bi('Una novedad de la entidad: una foto, un aviso, un cambio de fechas.', 'News from the organisation: a photo, a notice, a change of dates.')]
      : ['/panel/novedades', 'campaign', bi('Novedad', 'News'), bi('Una novedad del local: una foto, una carta nueva, un cambio de horario.', 'News from your place: a photo, a new menu, a change in opening hours.')],
  ].filter(Boolean);
  const delDia = [
    menu && antes ? opAntes : null,
    local && gestiona() && herrSi(o, 'broadcasts', 'suggested') ? ['/panel/partidos', 'partido', bi('Oferta para el partido', 'Offer for the match'), bi('Para que te encuentre quien busca dónde ver el partido: marca lo que pones.', "So people looking for where to watch the match find you: mark what you're showing.")] : null,
  ].filter(Boolean);
  const tuyos = ent ? [] : [
    ['/panel/publicaciones/nueva-flash?primera=1', 'waving_hand', bi('Oferta de primera visita', 'First-visit offer'), bi('Para atraer clientes nuevos: una oferta que solo puede usar quien no ha canjeado nunca nada en tu negocio.', 'To attract new customers: an offer that only people who have never redeemed anything at your business can use.')],
    ['/panel/publicaciones/nueva-flash?exclusiva=1', 'candado', bi('Exclusiva', 'Exclusive'), bi('Para premiar a los tuyos: una oferta que solo ve entera quien te tiene en favoritos o ya es cliente.', 'To reward your people: an offer only those who have you in favourites, or are already customers, see in full.')],
    ['/panel/publicaciones/nueva-flash?rrpp=1', 'rrpp', bi('Oferta para RRPP', 'Promoter offer'), bi('Solo con el enlace de un RRPP', "Only with a promoter's link")],
    ['/panel/mensajes', 'campaign', bi('Avisar a mis clientes', 'Message my customers'), bi('Para contar algo a tus favoritos y clientes con una notificación. Uno por semana.', 'To tell your favourites and customers something with a notification. One a week.')],
  ];
  const vender = ent ? [] : [
    ['/panel/bonos/nuevo', 'confirmation_number', bi('Bono', 'Pass'), bi('Para vender en tu local bonos de varios usos (5 cafés, 10 clases…). Cada uso se descuenta con el QR del cliente.', 'To sell multi-use passes at your venue (5 coffees, 10 classes…). Each use is taken off with the customer’s QR.')],
    ['/panel/sellos/nueva', 'loyalty', bi('Tarjeta de sellos', 'Stamp card'), bi('Para premiar a quien repite: cada canje (o cada visita con el QR del local) suma un sello y al llegar a la meta hay premio.', 'To reward people who come back: each redemption (or visit with the venue QR) adds a stamp and reaching the goal earns a reward.')],
    conEncargos ? ['/panel/encargos-cosas', 'encargo', bi('Algo para encargar', 'Something to pre-order'), bi('Tus clientes encargan desde tu ficha (una tarta, una bandeja, un ramo) y lo recogen y pagan aquí.', 'Your customers order from your page (a cake, a platter, a bouquet) and pick it up and pay here.')] : null,
    conSorteos ? ['/panel/sorteos/nuevo', 'redeem', bi('Sorteo', 'Giveaway'), bi('Para darte a conocer: un sorteo gratis en el que participa quien te añade a favoritos.', 'To get known: a free giveaway people enter by adding you to their favourites.')] : null,
  ].filter(Boolean);
  // Plegado, qué hay dentro (los tres primeros nombres).
  const dentro = [...delDia, ...tuyos, ...vender].map((x) => x[2]);
  const resumen = dentro.slice(0, 3).join(' · ') + (dentro.length > 3 ? '…' : '');
  return `<section class="crear" aria-labelledby="crearT"><h2 id="crearT">${esc(bi('¿Qué quieres publicar?', 'What do you want to publish?'))}</h2>
    ${lista(arriba)}
    ${dentro.length ? `<details class="bloque crear-mas"${herrMasAbierto ? ' open' : ''}>
      <summary><span class="b-tit">${esc(bi('Más formas de publicar', 'More ways to publish'))}</span><span class="b-res" translate="no">${esc(resumen)}</span></summary>
      <div class="b-cuerpo">
        ${delDia.length ? lista(delDia) : ''}
        ${grupo(bi('Para los tuyos', 'For your people'), tuyos)}
        ${grupo(bi('Para vender o dar en el local', 'To sell or give at your venue'), vender)}
      </div></details>` : ''}</section>`;
}
/** Después de pintarlo: recordar si «Más formas de publicar» está abierto. */
function herrCrearActiva(caja) {
  const mas = $('.crear-mas', caja);
  if (mas) mas.addEventListener('toggle', () => { herrMasAbierto = mas.open; });
}

// ── En Hoy: «Por contestar» y «Ahora» ───────────────────────────────────────
/** Pinta «Por contestar» y las filas de «Ahora» de Hoy: lo de la última vez
 * ya (si lo hay) y, al llegar lo de ahora, otra vez. */
async function herrHoy(v, { cajaFilas, cajaPendiente }) {
  const negocio = BIZ.id;
  const guardado = herrGuardado(negocio);
  if (guardado) herrFilas(guardado, null, { cajaFilas, cajaPendiente });
  const [o, demanda] = await Promise.all([
    herrEstado(),
    // «Pedir un local»: cuántas personas lo pidieron antes de que estuviera
    // en Klendar (solo el número, nunca quién). Como la app.
    gestiona() ? rpc('business_venue_demand', { p_business: negocio }).catch(() => null) : null,
  ]);
  if (!v.isConnected || BIZ?.id !== negocio || !o) return;
  herrFilas(o, demanda, { cajaFilas, cajaPendiente });
  // El menú de la izquierda: los grupos de Negocio dependen de lo que tiene.
  renderNav(currentRoute()[0]);
}

/** «Ahora» (las filas de acceso rápido) y «Por contestar» de Hoy. */
function herrFilas(o, demanda, { cajaFilas, cajaPendiente }) {
  if (!o || !cajaFilas) return;
  // Sin local (organizador o entidad): sin antes de cerrar ni partidos.
  const ent = esEntidad();
  const org = esOrganizador() || ent;
  const fila = (href, icon, texto, attrs = '') => `<a class="fila-inicio" href="${href}" ${attrs}>${icono(icon)}<span>${esc(texto)}</span>${ms('chevron_right')}</a>`;
  const pend = herrNum(o, 'groups', 'pending');
  const resenas = herrNum(o, 'reviews', 'unanswered');
  const preguntas = herrNum(o, 'questions', 'unanswered');
  const bc = o.before_closing || {};
  const dm = o.daily_menu || {};
  const horaMenu = dm.live_until ? new Date(dm.live_until).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '';
  const filas = [
    // Aforo en directo: la puerta, con la cifra de ahora (panel/aforo.js).
    !org && herrSi(o, 'capacity', 'enabled') ? fila('/panel/aforo', 'aforo', bi('Aforo en directo · ', 'Live capacity · ')
      + `${fmtNum(herrNum(o, 'capacity', 'people'))} / ${fmtNum(herrNum(o, 'capacity', 'max'))}`) : '',
    // Menú del día: a mano, en los sitios de comida (una fila).
    gestiona() && !org && dm.suggested ? fila('/panel/menu-del-dia', 'restaurant_menu', horaMenu
      ? bi(`Menú del día · hasta las ${horaMenu}`, `Daily menu · until ${horaMenu}`)
      : bi('Menú del día · publicar el de hoy', 'Daily menu · publish today’s')) : '',
    // La cola abierta ya sale en su fila (panel/cola.js); si la usa y ahora
    // está cerrada, la fila para abrirla.
    // Con cola hoy (abierta o cerrada) ya sale su fila «· N esperando».
    !ent && !herrSi(o, 'queue', 'open') && !herrSi(o, 'queue', 'today') && herrSi(o, 'queue', 'used_30d') ? fila('/panel/cola', 'cola', bi('Cola virtual · cerrada', 'Virtual queue · closed')) : '',
    gestiona() && !org && bc.suggested && (bc.live || bc.reminder_at) ? fila('/panel/antes-de-cerrar', 'bolsa', bc.live
      ? bi('Antes de cerrar · publicada hoy', 'Before closing · published today')
      : bi(`Antes de cerrar · aviso a las ${bc.reminder_at}`, `Before closing · reminder at ${bc.reminder_at}`)) : '',
    !org && herrNum(o, 'broadcasts', 'upcoming') > 0 ? fila('/panel/partidos', 'partido', bi(`Partidos que pones · ${herrNum(o, 'broadcasts', 'upcoming')} esta semana`, `Matches you're showing · ${herrNum(o, 'broadcasts', 'upcoming')} this week`)) : '',
    gestiona() && herrNum(o, 'tv', 'screens') > 0 ? fila('/panel/tele', 'tele', bi('Poner en la tele · ', 'Show on TV · ') + herrPl(herrNum(o, 'tv', 'screens'), ['1 tele', 'teles'], ['1 TV', 'TVs'])) : '',
    !ent && herrNum(o, 'series', 'rules_active') > 0 ? fila('/panel/series', 'repite', bi('Series y repeticiones · ', 'Series and repeats · ')
      + herrPl(herrNum(o, 'series', 'rules_active'), ['1 se publica sola', 'se publican solas'], ['1 publishes itself', 'publish themselves'])) : '',
    herrDemanda(demanda) > 0 ? fila('/panel', 'campaign', herrDemandaTxt(herrDemanda(demanda)), 'data-demanda') : '',
  ].filter(Boolean);
  cajaFilas.innerHTML = filas.length ? `<div class="filas-inicio">${filas.join('')}</div>` : '';
  const filaDemanda = $('[data-demanda]', cajaFilas);
  if (filaDemanda) {
    filaDemanda.onclick = (e) => {
      e.preventDefault();
      modal({
        title: herrDemandaTxt(herrDemanda(demanda)),
        intro: esc(I18N.t('Antes de que estuvieras en Klendar, esta gente pidió que estuvieras con «Pedir un local». No sabemos (ni te decimos) quiénes son: solo cuántos. Ya les hemos avisado de que estás.')),
        submit: I18N.t('Cerrar'),
        cancel: null,
      });
    };
  }
  // «Por contestar: 2 preguntas · 1 reseña · 2 grupos»: una sola fila y cada
  // trozo a su sitio (antes, una fila para cada cosa). Como la app.
  if (cajaPendiente) {
    const trozos = [
      // Las preguntas las contestan propietario y encargado.
      gestiona() && preguntas > 0 ? ['/panel/preguntas', preguntas === 1 ? bi('1 pregunta', '1 question')
        : bi('{n} preguntas', '{n} questions').replace('{n}', fmtNum(preguntas))] : null,
      resenas > 0 ? ['/panel/resenas', resenas === 1 ? bi('1 reseña', '1 review')
        : bi('{n} reseñas', '{n} reviews').replace('{n}', fmtNum(resenas))] : null,
      !ent && gestiona() && herrSi(o, 'groups', 'enabled') && pend > 0 ? ['/panel/grupos', pend === 1 ? bi('1 grupo', '1 group')
        : bi('{n} grupos', '{n} groups').replace('{n}', fmtNum(pend))] : null,
    ].filter(Boolean);
    const titulo = bi('Por contestar', 'To answer');
    cajaPendiente.innerHTML = trozos.length ? `<p class="por-contestar">${icono('reviews')}<span><b>${esc(titulo)}:</b> ${trozos
      .map(([href, txt]) => `<a href="${href}" aria-label="${esc(`${titulo}: ${txt}`)}">${esc(txt)}</a>`).join('<span aria-hidden="true"> · </span>')}</span></p>` : '';
  }
}

/** Cuántas personas pidieron el local (`business_venue_demand`), 0 si nada. */
const herrDemanda = (d) => Number(d?.people) || 0;
const herrDemandaTxt = (n) => (n === 1
  ? bi('1 persona pidió tu local antes de que estuvieras', '1 person asked for your venue before you were here')
  : bi('{n} personas pidieron tu local antes de que estuvieras', '{n} people asked for your venue before you were here').replace('{n}', fmtNum(n)));

/** «Ahora» en Hoy: como mucho 3 filas a la vista y «Ver N más» (la
 * cola, «Pedidos de hoy» y el resto llegan cada una por su lado: se cuenta
 * cada vez que cambia algo dentro). Como la app. */
function herrLimitaAhora(caja) {
  if (!caja) return;
  const MAX = 3;
  let todas = false;
  const aplica = () => {
    const filas = $$('.fila-inicio', caja);
    const sobran = filas.length - MAX;
    filas.forEach((f, i) => { f.hidden = !todas && i >= MAX; });
    let btn = $('.ahora-mas', caja);
    if (sobran <= 0) { if (btn) btn.remove(); return; }
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'linkbtn ahora-mas';
      btn.onclick = () => { todas = !todas; aplica(); };
      caja.append(btn);
    }
    btn.textContent = todas ? bi('Ver menos', 'See fewer')
      : sobran === 1 ? bi('Ver 1 más', 'See 1 more') : bi(`Ver {n} más`, 'See {n} more').replace('{n}', fmtNum(sobran));
  };
  const obs = new MutationObserver((cambios) => {
    // Lo que cambia el propio botón no cuenta.
    if (cambios.every((c) => c.target.classList?.contains('ahora-mas') || [...c.addedNodes].every((n) => n.classList?.contains('ahora-mas')))) return;
    aplica();
  });
  obs.observe(caja, { childList: true, subtree: true });
  aplica();
}
