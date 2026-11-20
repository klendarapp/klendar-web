/* Panel del negocio: «Mi negocio» ordenado (Iván, 2026-10-10: «no quitar
 * nada, cuantas más cosas extras mejor, pero organizadas»). Lo mismo que la
 * app:
 *
 * - El estado de cada herramienta en una sola llamada
 *   (`business_tools_overview`, migración 20261212100000 de la app): qué está
 *   activo y cuánto, sin datos de personas. Lo ve todo el equipo.
 * - En el resumen: «Lo esencial» (Tu ficha · Fidelizar · Cifras · RRPP, o las
 *   listas de esta noche para un empleado) y, como filas de acceso rápido,
 *   lo que el negocio usa (grupos, reseñas sin responder, antes de cerrar,
 *   partidos de la semana, teles, lo que se publica solo, la cola cerrada).
 * - #/herramientas: «Más herramientas», lo opcional, cada una con su frase,
 *   si está activa y su botón. Arriba «Las que usas» y debajo por grupos
 *   (Iván, 2026-10-22): «Tu carta y tus enlaces», «En el local»,
 *   «Pantallas y gente» y «Lo que se repite».
 * - «Crear»: elegir qué publicar (oferta, evento o novedad).
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

/** «¿Qué quieres publicar?», como la hoja de «Crear» y la pestaña Publicar
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
async function herrCrear() {
  const d = $('#modal');
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
  const opMenu = ['#/menu-del-dia', 'restaurant_menu', bi('Menú del día', 'Daily menu'), bi('Foto de la pizarra y precio: hasta el cierre, en un toque.', 'Photo of the board and price: until closing, in one tap.')];
  const opAntes = ['#/antes-de-cerrar', 'bolsa', bi('Antes de cerrar', 'Before closing'), bi('Lo que te ha sobrado hoy, con lo de la última vez ya puesto. Se paga en el local.', "What's left over today, with last time's details filled in. Paid at the venue.")];
  // Una entidad publica eventos y novedades, gratis (la base tampoco le deja
  // crear una oferta; §4zzz-propent).
  const arriba = [
    ent ? null : ['#/publicaciones/nueva-flash', 'bolt', bi('Oferta', 'Offer'), bi('De unas horas a varios días, o cada semana.', 'From a few hours to several days, or every week.')],
    ent
      ? ['#/publicaciones/nuevo-evento', 'event', bi('Evento', 'Event'), bi('Con fecha y hora, gratis. Puede llevar un enlace para apuntarse.', 'Has a date and time, free. Can include a sign-up link.')]
      : ['#/publicaciones/nuevo-evento', 'event', bi('Evento', 'Event'), bi('Con fecha y hora. Puede tener precio y enlace para entradas.', 'With a date and time. It can have a price and a ticket link.')],
    menu ? opMenu : antes ? opAntes : null,
    ent
      ? ['#/novedades', 'campaign', bi('Novedad', 'News'), bi('Una novedad de la entidad: una foto, un aviso, un cambio de fechas.', 'News from the organisation: a photo, a notice, a change of dates.')]
      : ['#/novedades', 'campaign', bi('Novedad', 'News'), bi('Una novedad del local: una foto, una carta nueva, un cambio de horario.', 'News from your place: a photo, a new menu, a change in opening hours.')],
  ].filter(Boolean);
  const delDia = [
    menu && antes ? opAntes : null,
    local && gestiona() && herrSi(o, 'broadcasts', 'suggested') ? ['#/partidos', 'partido', bi('Oferta para el partido', 'Offer for the match'), bi('Para que te encuentre quien busca dónde ver el partido: marca lo que pones.', "So people looking for where to watch the match find you: mark what you're showing.")] : null,
  ].filter(Boolean);
  const tuyos = ent ? [] : [
    ['#/publicaciones/nueva-flash?primera=1', 'waving_hand', bi('Oferta de primera visita', 'First-visit offer'), bi('Para atraer clientes nuevos: una oferta que solo puede usar quien no ha canjeado nunca nada en tu negocio.', 'To attract new customers: an offer that only people who have never redeemed anything at your business can use.')],
    ['#/publicaciones/nueva-flash?exclusiva=1', 'candado', bi('Exclusiva', 'Exclusive'), bi('Para premiar a los tuyos: una oferta que solo ve entera quien te tiene en favoritos o ya es cliente.', 'To reward your people: an offer only those who have you in favourites, or are already customers, see in full.')],
    ['#/publicaciones/nueva-flash?rrpp=1', 'rrpp', bi('Oferta para RRPP', 'Promoter offer'), bi('Solo con el enlace de un RRPP', "Only with a promoter's link")],
    ['#/mensajes', 'campaign', bi('Avisar a mis clientes', 'Message my customers'), bi('Para contar algo a tus favoritos y clientes con una notificación. Uno por semana.', 'To tell your favourites and customers something with a notification. One a week.')],
  ];
  const vender = ent ? [] : [
    ['#/bonos/nuevo', 'redeem', bi('Bono', 'Pass'), bi('Para vender en tu local bonos de varios usos (5 cafés, 10 clases…). Cada uso se descuenta con el QR del cliente.', 'To sell multi-use passes at your venue (5 coffees, 10 classes…). Each use is taken off with the customer’s QR.')],
    ['#/sellos/nueva', 'loyalty', bi('Tarjeta de sellos', 'Stamp card'), bi('Para premiar a quien repite: cada canje (o cada visita con el QR del local) suma un sello y al llegar a la meta hay premio.', 'To reward people who come back: each redemption (or visit with the venue QR) adds a stamp and reaching the goal earns a reward.')],
    conEncargos ? ['#/encargos-cosas', 'encargo', bi('Algo para encargar', 'Something to pre-order'), bi('Tus clientes encargan desde tu ficha (una tarta, una bandeja, un ramo) y lo recogen y pagan aquí.', 'Your customers order from your page (a cake, a platter, a bouquet) and pick it up and pay here.')] : null,
    conSorteos ? ['#/sorteos/nuevo', 'sorteo', bi('Sorteo', 'Giveaway'), bi('Para darte a conocer: un sorteo gratis en el que participa quien te añade a favoritos.', 'To get known: a free giveaway people enter by adding you to their favourites.')] : null,
  ].filter(Boolean);
  // Plegado, qué hay dentro (los tres primeros nombres).
  const dentro = [...delDia, ...tuyos, ...vender].map((x) => x[2]);
  const resumen = dentro.slice(0, 3).join(' · ') + (dentro.length > 3 ? '…' : '');
  d.innerHTML = `<form method="dialog"><h2>${esc(bi('¿Qué quieres publicar?', 'What do you want to publish?'))}</h2>
    ${lista(arriba)}
    ${dentro.length ? `<details class="bloque crear-mas"${herrMasAbierto ? ' open' : ''}>
      <summary><span class="b-tit">${esc(bi('Más formas de publicar', 'More ways to publish'))}</span><span class="b-res" translate="no">${esc(resumen)}</span></summary>
      <div class="b-cuerpo">
        ${delDia.length ? lista(delDia) : ''}
        ${grupo(bi('Para los tuyos', 'For your people'), tuyos)}
        ${grupo(bi('Para vender o dar en el local', 'To sell or give at your venue'), vender)}
      </div></details>` : ''}
    <div class="foot"><button type="button" class="btn ghost" data-cancel>${esc(bi('Cancelar', 'Cancel'))}</button></div></form>`;
  const cerrar = () => d.close();
  $('[data-cancel]', d).onclick = cerrar;
  d.oncancel = (e) => { e.preventDefault(); cerrar(); };
  $$('.crear-op', d).forEach((a) => a.addEventListener('click', cerrar));
  const mas = $('.crear-mas', d);
  if (mas) mas.addEventListener('toggle', () => { herrMasAbierto = mas.open; });
  d.showModal();
}

// ── En el resumen: «Lo esencial» y lo que el negocio usa ────────────────────
/** Una de las cuatro de «Lo esencial»: icono, nombre y cómo va. */
const herrTile = (href, icon, titulo, linea, id = '') => `<a class="esencial-tile" href="${href}"${id ? ` id="${id}"` : ''}>
  ${icono(icon)}<b>${esc(titulo)}</b><small data-linea>${esc(linea || '')}</small></a>`;

/** «Lo esencial»: Tu ficha · Fidelizar · Cifras · RRPP. `stats` es
 * `business_stats` (para «N canjes · 30 días»). */
function herrEsencialHtml(stats) {
  const canjes = Number(stats?.redemptions_30d) || 0;
  // Una entidad (ayuntamiento, asociación, ONG): sin Fidelizar ni RRPP; su
  // agenda (series) y su equipo.
  if (esEntidad()) {
    return `<nav class="esencial" aria-label="${esc(bi('Lo esencial', 'The essentials'))}">
    ${gestiona()
    ? herrTile('#/ficha', 'storefront', bi('Tu ficha', 'Your page'), '', 'esFicha')
    : herrTile(`${APP_URL}/b/${encodeURIComponent(BIZ.id)}`, 'storefront', bi('Tu ficha', 'Your page'), bi('Ver cómo se ve', 'See how it looks'))}
    ${herrTile('#/informe', 'bar_chart', bi('Cifras', 'Stats'), herrPl(canjes, ['1 canje · 30 días', 'canjes · 30 días'], ['1 redemption · 30 days', 'redemptions · 30 days']))}
    ${herrTile('#/series', 'repite', bi('Series y repeticiones', 'Series and repeats'), '', 'esSeries')}
    ${gestiona() ? herrTile('#/equipo', 'group', bi('Equipo', 'Team'), '', 'esEquipo') : ''}
  </nav>`;
  }
  return `<nav class="esencial" aria-label="${esc(bi('Lo esencial', 'The essentials'))}">
    ${gestiona()
    ? herrTile('#/ficha', 'storefront', bi('Tu ficha', 'Your page'), '', 'esFicha')
    : herrTile(`${APP_URL}/b/${encodeURIComponent(BIZ.id)}`, 'storefront', bi('Tu ficha', 'Your page'), bi('Ver cómo se ve', 'See how it looks'))}
    ${herrTile('#/fidelizar', 'favorite', bi('Fidelizar', 'Loyalty'), '', 'esFiel')}
    ${herrTile('#/informe', 'bar_chart', bi('Cifras', 'Stats'), herrPl(canjes, ['1 canje · 30 días', 'canjes · 30 días'], ['1 redemption · 30 days', 'redemptions · 30 days']))}
    ${gestiona()
    ? herrTile('#/rrpp', 'rrpp', 'RRPP', '', 'esRrpp')
    : herrTile('#/validar?listas=1', 'qr_code_scanner', bi('Listas de esta noche', "Tonight's lists"), bi('Quién viene esta noche', "Who's coming tonight"))}
  </nav>`;
}

/** Rellena las líneas de «Lo esencial» y las filas de acceso rápido. */
async function herrResumen(v, { cajaFilas, cajaPendiente }) {
  const negocio = BIZ.id;
  // Lo de la última vez, ya (si lo hay); al llegar lo de ahora, se repinta.
  const guardado = herrGuardado(negocio);
  if (guardado) herrFilas(guardado, null, { cajaFilas, cajaPendiente });
  const [o, fiel, ficha, demanda, conSorteos] = await Promise.all([
    herrEstado(),
    rpc('business_loyalty', { p_business: negocio }).catch(() => null),
    gestiona() && typeof datosFicha === 'function' ? datosFicha().catch(() => null) : null,
    // «Pedir un local»: cuántas personas lo pidieron antes de que estuviera
    // en Klendar (solo el número, nunca quién). Como la app.
    gestiona() ? rpc('business_venue_demand', { p_business: negocio }).catch(() => null) : null,
    // Los sorteos solo cuentan con el interruptor encendido (panel/sorteos.js).
    typeof sorteosEnPanel === 'function' ? sorteosEnPanel() : false,
  ]);
  if (!v.isConnected || BIZ?.id !== negocio) return;
  const linea = (id, texto) => { const s = $(`#${id} [data-linea]`, v); if (s) s.textContent = texto; };
  if (ficha?.b && typeof fichaCompleta === 'function') {
    BIZ.category_id = ficha.b.category_id ?? null;
    const pct = fichaCompleta(ficha.b, { sitio: ficha.b.amenities, carta: ficha.carta });
    // Al 100 %, nada (vuelve si baja): «Ver cómo se ve», como la app.
    linea('esFicha', pct < 100 ? bi(`Completa al ${pct} %`, `${pct}% complete`) : bi('Ver cómo se ve', 'See how it looks'));
  }
  if (o && fiel && fiel.ok !== false) {
    const n = [herrNum(o, 'stamps', 'active') > 0, fiel.coupon?.enabled === true, herrSi(o, 'birthday', 'enabled'),
      herrNum(o, 'first_visit', 'live') > 0, herrNum(o, 'exclusives', 'live') > 0, fiel.thanks?.enabled === true,
      herrNum(o, 'passes', 'on_sale') > 0, conSorteos && herrNum(o, 'giveaways', 'active') > 0].filter(Boolean).length;
    linea('esFiel', n === 0 ? bi('Nada activado', 'Nothing on yet') : bi(n === 1 ? '1 activada' : `${n} activadas`, `${n} on`));
  }
  if (o) {
    const reglas = herrNum(o, 'series', 'rules_active');
    linea('esSeries', reglas === 0 ? bi('Nada se publica solo', 'Nothing publishes itself') : herrPl(reglas, ['1 se publica sola', 'se publican solas'], ['1 publishes itself', 'publish themselves']));
    const eq = herrNum(o, 'team', 'members');
    linea('esEquipo', eq <= 1 ? bi('Solo tú', 'Just you') : herrPl(eq, ['1 persona', 'personas'], ['1 person', 'people']));
    const r = herrNum(o, 'promoters', 'active');
    linea('esRrpp', r === 0 ? bi('Invita al primero', 'Invite your first') : herrPl(r, ['1 RRPP activo', 'RRPP activos'], ['1 active promoter', 'active promoters']));
  }
  if (!o || !cajaFilas) return;
  herrFilas(o, demanda, { cajaFilas, cajaPendiente });
}

/** «Ahora» (las filas de acceso rápido) y «Por contestar» del resumen. */
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
    !org && herrSi(o, 'capacity', 'enabled') ? fila('#/aforo', 'aforo', bi('Aforo en directo · ', 'Live capacity · ')
      + `${fmtNum(herrNum(o, 'capacity', 'people'))} / ${fmtNum(herrNum(o, 'capacity', 'max'))}`) : '',
    // Menú del día: a mano, en los sitios de comida (una fila).
    gestiona() && !org && dm.suggested ? fila('#/menu-del-dia', 'restaurant_menu', horaMenu
      ? bi(`Menú del día · hasta las ${horaMenu}`, `Daily menu · until ${horaMenu}`)
      : bi('Menú del día · publicar el de hoy', 'Daily menu · publish today’s')) : '',
    // La cola abierta ya sale en su fila (panel/cola.js); si la usa y ahora
    // está cerrada, la fila para abrirla.
    // Con cola hoy (abierta o cerrada) ya sale su fila «· N esperando».
    !ent && !herrSi(o, 'queue', 'open') && !herrSi(o, 'queue', 'today') && herrSi(o, 'queue', 'used_30d') ? fila('#/cola', 'cola', bi('Cola virtual · cerrada', 'Virtual queue · closed')) : '',
    gestiona() && !org && bc.suggested && (bc.live || bc.reminder_at) ? fila('#/antes-de-cerrar', 'bolsa', bc.live
      ? bi('Antes de cerrar · publicada hoy', 'Before closing · published today')
      : bi(`Antes de cerrar · aviso a las ${bc.reminder_at}`, `Before closing · reminder at ${bc.reminder_at}`)) : '',
    !org && herrNum(o, 'broadcasts', 'upcoming') > 0 ? fila('#/partidos', 'partido', bi(`Partidos que pones · ${herrNum(o, 'broadcasts', 'upcoming')} esta semana`, `Matches you're showing · ${herrNum(o, 'broadcasts', 'upcoming')} this week`)) : '',
    gestiona() && herrNum(o, 'tv', 'screens') > 0 ? fila('#/tele', 'tele', bi('Poner en la tele · ', 'Show on TV · ') + herrPl(herrNum(o, 'tv', 'screens'), ['1 tele', 'teles'], ['1 TV', 'TVs'])) : '',
    !ent && herrNum(o, 'series', 'rules_active') > 0 ? fila('#/series', 'repite', bi('Series y repeticiones · ', 'Series and repeats · ')
      + herrPl(herrNum(o, 'series', 'rules_active'), ['1 se publica sola', 'se publican solas'], ['1 publishes itself', 'publish themselves'])) : '',
    herrDemanda(demanda) > 0 ? fila('#/', 'campaign', herrDemandaTxt(herrDemanda(demanda)), 'data-demanda') : '',
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
      gestiona() && preguntas > 0 ? ['#/preguntas', preguntas === 1 ? bi('1 pregunta', '1 question')
        : bi('{n} preguntas', '{n} questions').replace('{n}', fmtNum(preguntas))] : null,
      resenas > 0 ? ['#/resenas', resenas === 1 ? bi('1 reseña', '1 review')
        : bi('{n} reseñas', '{n} reviews').replace('{n}', fmtNum(resenas))] : null,
      !ent && gestiona() && herrSi(o, 'groups', 'enabled') && pend > 0 ? ['#/grupos', pend === 1 ? bi('1 grupo', '1 group')
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

/** «Ahora» en el resumen: como mucho 3 filas a la vista y «Ver N más» (la
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

// ── «Más herramientas» ──────────────────────────────────────────────────────
/** Una tarjeta: título, para qué sirve, cómo está y uno o dos botones (los
 * dos del mismo ancho). `botones`: [[texto, href, attrs]]. */
function herrTarjeta({ icon, titulo, frase, estado, on, detalle, botones = [], extra = '' }) {
  return `<div class="card fiel-card">
    <h2 style="display:flex;align-items:center;gap:8px;margin:0 0 6px">${icono(icon)}<span>${esc(titulo)}</span></h2>
    <p class="muted" style="margin:0">${esc(frase)}</p>
    ${estado ? `<p class="herr-estado">${on ? ms('check_circle') : '<span class="herr-off" aria-hidden="true"></span>'}<span>${esc(estado)}</span></p>` : ''}
    ${detalle ? `<p class="muted" style="margin:4px 0 0">${esc(detalle)}</p>` : ''}
    ${extra}
    ${botones.length ? `<div class="herr-botones n${botones.length}">${botones.map(([t, href, attrs]) => href
    ? `<a class="btn" href="${esc(href)}" ${attrs || ''}>${esc(t)}</a>`
    : `<button class="btn" type="button" ${attrs || ''}>${esc(t)}</button>`).join('')}</div>` : ''}
  </div>`;
}

/** Una tarjeta de «Más herramientas» con su grupo (`menu`, `local`, `gente`
 * o `repite`) y si el negocio la usa (sube a «Las que usas»). */
const herrT = ({ grupo, usa, ...t }) => ({ grupo, usa: !!usa, html: herrTarjeta(t) });

PAGES.herramientas = async (v) => {
  const [o] = await Promise.all([
    rpc('business_tools_overview', { p_business: BIZ.id }),
    // «Carta», «Servicios y precios»… según su tipo (Iván, 18-11).
    categoriaDelNegocio().catch(() => null),
  ]);
  if (!o || o.ok === false) throw new Error(o?.error || 'not_authorized');
  const tipo = tipoCarta();
  const edit = o.can_edit === true;
  // Sin local (organizador o entidad): fuera lo que necesita un local.
  const ent = esEntidad();
  const local = !esOrganizador() && !ent;
  const onOff = (x) => (x ? bi('Activado', 'On') : bi('Apagado', 'Off'));
  const sinPreparar = bi('Sin preparar', 'Not set up');
  const configurar = bi('Configurar', 'Set up');
  const abrir = bi('Abrir', 'Open');
  const activar = bi('Activar', 'Turn on');
  const items = herrNum(o, 'menu', 'items');
  const archivos = herrNum(o, 'menu', 'files');
  const enlaces = herrNum(o, 'links', 'count');
  const bc = o.before_closing || {};
  const dm = o.daily_menu || {};
  const tq = o.table_qr || {};
  const diasMenu = herrNum(o, 'daily_menu', 'plan_days');
  const horaMenu = dm.live_until ? new Date(dm.live_until).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '';
  const escaneos = herrNum(o, 'table_qr', 'scans_month');
  const reglas = herrNum(o, 'series', 'rules_active');
  const series = herrNum(o, 'series', 'active');
  const espera = herrNum(o, 'queue', 'waiting');
  const partidos = herrNum(o, 'broadcasts', 'upcoming');
  const teles = herrNum(o, 'tv', 'screens');
  const pend = herrNum(o, 'groups', 'pending');
  const codigo = `<script src="${APP_URL}/widget.js" data-klendar="${BIZ.id}"></script>`;
  const tarjetas = [
    edit && herrLleva(o, 'menu', items > 0 || archivos > 0) ? herrT({
      grupo: 'menu', usa: items > 0 || archivos > 0,
      icon: 'restaurant_menu', titulo: tituloCarta(tipo),
      frase: tipo === 'menu' ? bi('Para enseñar lo que tienes, con precios, fotos y alérgenos. Sale en tu ficha.', 'To show what you offer, with prices, photos and allergens. It shows on your page.')
        : bi('Para enseñar lo que ofreces, con precios y fotos. Sale en tu ficha.', 'To show what you offer, with prices and photos. It shows on your page.'),
      estado: items ? ({ service: herrPl(items, ['1 servicio', 'servicios'], ['1 service', 'services']), product: herrPl(items, ['1 producto', 'productos'], ['1 product', 'products']) }[o.features?.menu_kind] || herrPl(items, ['1 plato', 'platos'], ['1 dish', 'dishes'])) : archivos ? herrPl(archivos, ['1 archivo', 'archivos'], ['1 file', 'files']) : sinPreparar,
      on: items > 0 || archivos > 0, botones: [[configurar, '#/carta']],
    }) : '',
    edit ? herrT({
      grupo: 'menu', usa: enlaces > 0,
      icon: 'enlace', titulo: bi('Reservar y pedir', 'Book and order'),
      frase: bi('Para que reserven o pidan donde ya trabajas (TheFork, Glovo…): botones en tu ficha.', 'So people book or order where you already work (TheFork, Glovo…): buttons on your page.'),
      estado: enlaces ? herrPl(enlaces, ['1 enlace', 'enlaces'], ['1 link', 'links']) : sinPreparar,
      on: enlaces > 0, botones: [[configurar, '#/ficha/contacto']],
    }) : '',
    edit && local && dm.suggested ? herrT({
      grupo: 'local', usa: !!dm.live_until || diasMenu > 0,
      icon: 'restaurant_menu', titulo: bi('Menú del día', 'Daily menu'),
      frase: bi('La foto de la pizarra y el precio: sale hasta que cierra la cocina y desaparece solo.', 'The photo of the board and the price: it shows until the kitchen closes and disappears by itself.'),
      estado: dm.live_until ? bi(`Publicado hasta las ${horaMenu}`, `Live until ${horaMenu}`)
        : diasMenu > 0 ? (diasMenu === 1 ? bi('Se publica solo 1 día a la semana', 'Publishes itself 1 day a week') : bi(`Se publica solo ${fmtNum(diasMenu)} días a la semana`, `Publishes itself ${fmtNum(diasMenu)} days a week`)) : '',
      on: !!dm.live_until || diasMenu > 0, botones: [[abrir, '#/menu-del-dia']],
    }) : '',
    edit && local && bc.suggested ? herrT({
      grupo: 'local', usa: !!(bc.live || bc.reminder_at),
      icon: 'bolsa', titulo: bi('Antes de cerrar', 'Before closing'),
      frase: bi('Para lo que te sobra del día: una bolsa sorpresa hasta el cierre, en dos toques.', 'For what’s left at the end of the day: a surprise bag until closing, in two taps.'),
      estado: bc.live ? bi('Publicada hoy', 'Published today') : bc.reminder_at ? bi(`Aviso cada día a las ${bc.reminder_at}`, `Daily reminder at ${bc.reminder_at}`) : '',
      on: !!(bc.live || bc.reminder_at), botones: [[abrir, '#/antes-de-cerrar']],
    }) : '',
    herrT({
      grupo: 'repite', usa: reglas > 0 || series > 0,
      icon: 'repite', titulo: bi('Series y repeticiones', 'Series and repeats'),
      frase: bi('Para lo que se repite: una oferta que se publica sola cada semana o las fechas de una misma serie.', 'For what repeats: an offer that publishes itself every week, or the dates of one series.'),
      estado: reglas === 0 ? bi('Nada se publica solo', 'Nothing publishes itself') : herrPl(reglas, ['1 se publica sola', 'se publican solas'], ['1 publishes itself', 'publish themselves']),
      on: reglas > 0, detalle: series ? herrPl(series, ['1 serie', 'series'], ['1 series', 'series']) : '',
      botones: [[abrir, '#/series']],
    }),
    local && herrLleva(o, 'crowd', herrSi(o, 'crowd', 'enabled')) ? herrT({
      grupo: 'local', usa: herrSi(o, 'crowd', 'enabled'),
      icon: 'people', titulo: bi('¿Hay sitio ahora?', 'Room right now?'),
      frase: bi('Para decir con un toque cómo está el local: Hay sitio, Casi lleno o Lleno. Sale en tu ficha durante 2 horas.', 'To say with one tap how busy your place is: There’s room, Nearly full or Full. It shows on your page for 2 hours.'),
      estado: onOff(herrSi(o, 'crowd', 'enabled')), on: herrSi(o, 'crowd', 'enabled'),
      botones: edit ? [[herrSi(o, 'crowd', 'enabled') ? configurar : activar, '#/ficha/local']] : [],
    }) : '',
    // Aforo en directo (panel/aforo.js): +1 / −1 en la puerta y «¿Hay sitio
    // ahora?» se pone solo. Lo abre todo el equipo; activarlo, propietario o
    // encargado. Sin local fijo, no sale.
    local && herrLleva(o, 'capacity', herrSi(o, 'capacity', 'enabled')) ? herrT({
      grupo: 'local', usa: herrSi(o, 'capacity', 'enabled'),
      icon: 'aforo', titulo: bi('Aforo en directo', 'Live capacity'),
      frase: bi('Cuenta en la puerta con +1 y −1, y «¿Hay sitio ahora?» se pone solo.', 'Count at the door with +1 and −1, and “Room right now?” sets itself.'),
      estado: herrSi(o, 'capacity', 'enabled')
        ? (herrNum(o, 'capacity', 'people') > 0 && herrNum(o, 'capacity', 'max') > 0
          ? bi(`${fmtNum(herrNum(o, 'capacity', 'people'))} / ${fmtNum(herrNum(o, 'capacity', 'max'))} ahora`, `${fmtNum(herrNum(o, 'capacity', 'people'))} / ${fmtNum(herrNum(o, 'capacity', 'max'))} now`)
          : bi('Activado', 'On'))
        : sinPreparar,
      on: herrSi(o, 'capacity', 'enabled'),
      botones: herrSi(o, 'capacity', 'enabled') ? [[abrir, '#/aforo']] : edit ? [[activar, '#/aforo/ajustes']] : [],
    }) : '',
    ent || !herrLleva(o, 'queue', herrSi(o, 'queue', 'open') || herrSi(o, 'queue', 'used_30d')) ? '' : herrT({
      grupo: 'local', usa: herrSi(o, 'queue', 'open') || herrSi(o, 'queue', 'used_30d'),
      icon: 'cola', titulo: bi('Cola virtual', 'Virtual queue'),
      frase: bi('Para que no hagan cola en la puerta: se apuntan con el QR del cartel y les avisamos cuando les toca.', 'So nobody queues at the door: people join with the poster’s QR and we tell them when it’s their turn.'),
      // Como la app: abierta, cerrada con gente o sin abrir hoy.
      estado: herrSi(o, 'queue', 'open') ? bi(`Abierta · ${espera} esperando`, `Open · ${espera} waiting`)
        : herrSi(o, 'queue', 'today') ? bi(`Cerrada · ${espera} esperando`, `Closed · ${espera} waiting`) : bi('Sin abrir hoy', 'Not open today'),
      // «Abrir» se confundía con abrir la cola: lleva a la cola.
      on: herrSi(o, 'queue', 'open'), botones: [[bi('Ir a la cola', 'Go to the queue'), '#/cola']],
    }),
    // Encargos (panel/encargos.js): con `app_config.preorders` y en los
    // tipos que lo llevan (o si ya tiene algo). Crear, propietario y
    // encargado; con algo puesto, el personal gestiona los encargos.
    !ent && herrSi(o, 'preorders', 'enabled') && (edit || herrNum(o, 'preorders', 'items_all') > 0)
      && herrLleva(o, 'preorders', herrNum(o, 'preorders', 'items_all') > 0) ? herrT({
        grupo: 'menu', usa: herrNum(o, 'preorders', 'items_all') > 0,
        icon: 'encargo', titulo: bi('Encargos', 'Pre-orders'),
        frase: bi('Tus clientes encargan desde tu ficha (una tarta, una bandeja, un ramo) y lo recogen y pagan aquí.',
          'Your customers order from your page (a cake, a platter, a bouquet) and pick it up and pay here.'),
        estado: herrNum(o, 'preorders', 'items') > 0
          ? bi(`${fmtNum(herrNum(o, 'preorders', 'items'))} para encargar · ${fmtNum(herrNum(o, 'preorders', 'pending'))} por aceptar`,
            `${fmtNum(herrNum(o, 'preorders', 'items'))} to pre-order · ${fmtNum(herrNum(o, 'preorders', 'pending'))} to accept`)
          : bi('Sin preparar', 'Not set up'),
        on: herrNum(o, 'preorders', 'items') > 0,
        botones: [[herrNum(o, 'preorders', 'items_all') > 0 ? abrir : configurar,
          herrNum(o, 'preorders', 'items_all') > 0 ? '#/encargos' : '#/encargos-cosas']],
      }) : '',
    // Te aviso cuando esté listo (panel/listo.js): el avisador de pedidos
    // del mostrador. Activarlo, propietario o encargado (dentro de «Pedidos
    // de hoy»); activado, lo lleva todo el equipo. Una entidad no lo tiene.
    !ent && (edit || herrSi(o, 'orders', 'enabled')) && herrLleva(o, 'orders', herrSi(o, 'orders', 'enabled')) ? herrT({
      grupo: 'local', usa: herrSi(o, 'orders', 'enabled'),
      icon: 'listo', titulo: bi('Te aviso cuando esté listo', 'Ready alert'),
      frase: bi('Para cafeterías y comida para llevar: quien pide escanea el QR del mostrador y le avisamos en el móvil cuando está listo.', 'For cafés and takeaways: people scan the counter QR code and we tell them on their phone when it’s ready.'),
      // Hasta el 4-11-2026 no se puede activar (TL1; `orders_available`,
      // migración 20261235100001 de la app): lo dice y sin botón. Después la
      // base dice true y la tarjeta es la de siempre.
      estado: herrSi(o, 'orders', 'enabled')
        ? bi(`Activado · ${fmtNum(herrNum(o, 'orders', 'waiting'))} preparando`, `On · ${fmtNum(herrNum(o, 'orders', 'waiting'))} being prepared`)
        : o?.orders_available === false ? bi('Disponible desde el 4 de noviembre', 'Available from 4 November')
          : bi('Apagado', 'Off'),
      on: herrSi(o, 'orders', 'enabled'),
      botones: herrSi(o, 'orders', 'enabled') || o?.orders_available !== false
        ? [[herrSi(o, 'orders', 'enabled') ? abrir : activar, '#/pedidos']] : [],
    }) : '',
    edit ? herrT({
      grupo: 'gente', usa: teles > 0,
      icon: 'tele', titulo: bi('Poner en la tele', 'Show on TV'),
      frase: bi('Para la tele de tu local: tus publicaciones van pasando, cada una con un QR para guardarla.', 'For the TV in your venue: your publications take turns, each with a QR to save it.'),
      estado: teles ? herrPl(teles, ['1 tele enlazada', 'teles enlazadas'], ['1 TV linked', 'TVs linked']) : bi('Apagado', 'Off'),
      on: teles > 0, botones: [[configurar, '#/tele']],
    }) : '',
    local && herrSi(o, 'broadcasts', 'suggested') ? herrT({
      grupo: 'gente', usa: partidos > 0,
      icon: 'partido', titulo: bi('Partidos que pones', "Matches you're showing"),
      frase: bi('Para que te encuentre quien busca dónde ver el partido: marca lo que pones.', 'So people looking for where to watch the match find you: mark what you’re showing.'),
      estado: partidos === 0 ? bi('Nada marcado esta semana', 'Nothing marked this week') : herrPl(partidos, ['1 partido esta semana', 'partidos esta semana'], ['1 match this week', 'matches this week']),
      on: partidos > 0, botones: [[abrir, '#/partidos']],
    }) : '',
    edit && !ent && herrLleva(o, 'groups', herrSi(o, 'groups', 'enabled')) ? herrT({
      grupo: 'gente', usa: herrSi(o, 'groups', 'enabled'),
      icon: 'grupos', titulo: bi('Grupos y empresas', 'Groups and companies'),
      frase: bi('Para recibir peticiones de grupos y empresas (cenas, cumpleaños, comidas de equipo) y mandar tu propuesta.', 'To get requests from groups and companies (dinners, birthdays, team meals) and send your proposal.'),
      estado: onOff(herrSi(o, 'groups', 'enabled')), on: herrSi(o, 'groups', 'enabled'),
      detalle: herrSi(o, 'groups', 'enabled') ? (pend === 0 ? bi('Sin peticiones ahora', 'No requests right now') : herrPl(pend, ['1 petición sin contestar', 'peticiones sin contestar'], ['1 request to answer', 'requests to answer'])) : '',
      botones: [[herrSi(o, 'groups', 'enabled') ? abrir : activar, '#/grupos']],
    }) : '',
    edit && local && herrLleva(o, 'table_qr', tq.wifi || tq.has) ? herrT({
      grupo: 'local', usa: !!(tq.wifi || tq.has),
      icon: 'wifi', titulo: bi('Wifi para clientes', 'Wi-Fi for customers'),
      frase: segunCarta([bi('Carteles de mesa con un QR: tu wifi, tus ofertas de hoy y la carta. Sin wifi, sirven de QR de mesa.', 'Table cards with a QR code: your Wi-Fi, today’s offers and the menu. Without Wi-Fi, they work as a table QR.'), bi('Carteles de mesa con un QR: tu wifi, tus ofertas de hoy y tus servicios. Sin wifi, sirven de QR de mesa.', 'Table cards with a QR code: your Wi-Fi, today’s offers and your services. Without Wi-Fi, they work as a table QR.'), bi('Carteles de mesa con un QR: tu wifi, tus ofertas de hoy y tus productos. Sin wifi, sirven de QR de mesa.', 'Table cards with a QR code: your Wi-Fi, today’s offers and your products. Without Wi-Fi, they work as a table QR.'), bi('Carteles de mesa con un QR: tu wifi, tus ofertas de hoy y tus precios. Sin wifi, sirven de QR de mesa.', 'Table cards with a QR code: your Wi-Fi, today’s offers and your prices. Without Wi-Fi, they work as a table QR.')], tipo),
      estado: tq.has ? escaneos === 0 ? bi('Ningún escaneo este mes', 'No scans this month') : herrPl(escaneos, ['1 escaneo este mes', 'escaneos este mes'], ['1 scan this month', 'scans this month']) : sinPreparar,
      on: !!(tq.wifi || tq.has), botones: [[abrir, '#/wifi-clientes']],
    }) : '',
    edit && local ? herrT({
      grupo: 'local', usa: false,
      icon: 'qr_code_2', titulo: bi('Cartel del local', 'Venue poster'),
      frase: bi('Para tu puerta o tu mostrador: un QR que abre tu ficha y suma un sello por visita.', 'For your door or counter: a QR that opens your page and adds a stamp per visit.'),
      botones: [[abrir, '#/cartel-local']],
    }) : '',
    // Una entidad: el cartel de su agenda (§4zzz-propent).
    edit && esEntidad() ? herrT({
      grupo: 'local', usa: false,
      icon: 'qr_code_2', titulo: bi('Cartel «Sigue nuestra agenda»', '“Follow our events” poster'),
      frase: bi('Para el tablón de anuncios o la entrada: un QR que abre tu ficha con todo lo que publicas.', 'For the notice board or the entrance: a QR that opens your page with everything you publish.'),
      botones: [[abrir, '#/cartel-local']],
    }) : '',
    herrT({
      grupo: 'menu', usa: false,
      icon: 'codigo', titulo: bi('Klendar en tu web', 'Klendar on your website'),
      frase: bi('Pega esta línea en tu web y saldrá lo que tienes publicado. Se actualiza sola.', 'Paste this line on your website and what you’ve published will show there. It updates itself.'),
      extra: `<pre id="wcode" class="code" style="margin:10px 0 0">${esc(codigo)}</pre>`,
      botones: [[bi('Copiar', 'Copy'), null, 'id="wcopy"'], [bi('Ver cómo queda', 'See how it looks'), `${APP_URL}/widget/${BIZ.id}`, 'target="_blank" rel="noopener"']],
    }),
  ].filter(Boolean);
  // Arriba, «Las que usas» (activadas o usadas hace poco); debajo, el resto
  // por grupos con su título. Un grupo vacío no sale. Como la app.
  const GRUPOS = [
    ['menu', segunCarta([bi('Tu carta y tus enlaces', 'Your menu and links'), bi('Tus servicios y tus enlaces', 'Your services and links'), bi('Tus productos y tus enlaces', 'Your products and links'), bi('Tus precios y tus enlaces', 'Your prices and links')], tipo)],
    ['local', bi('En el local', 'At your venue')],
    ['gente', bi('Pantallas y gente', 'Screens and people')],
    ['repite', bi('Lo que se repite', 'What repeats')],
  ];
  const bloques = [
    [bi('Las que usas', 'The ones you use'), GRUPOS.flatMap(([g]) => tarjetas.filter((t) => t.usa && t.grupo === g))],
    ...GRUPOS.map(([g, titulo]) => [titulo, tarjetas.filter((t) => !t.usa && t.grupo === g)]),
  ].filter(([, ts]) => ts.length);
  v.innerHTML = `
    <div class="page-head"><h1>${esc(bi('Más herramientas', 'More tools'))}</h1></div>
    <p class="muted" style="max-width:640px">${esc(bi('Herramientas opcionales: activa las que te sirvan. Las que uses suben a la pantalla principal de tu negocio.', 'Optional tools: turn on the ones that help. The ones you use move up to your business’s main screen.'))}</p>
    ${bloques.map(([titulo, ts]) => `<h2 class="grupo-titulo">${esc(titulo)}</h2>
    <div class="fiel-lista" style="display:grid;gap:12px;max-width:820px">${ts.map((t) => t.html).join('')}</div>`).join('')}`;
  const copiar = $('#wcopy', v);
  if (copiar) {
    copiar.onclick = async () => {
      try { await navigator.clipboard.writeText(codigo); } catch { toast(bi('No se ha podido copiar', "Couldn't copy"), true); return; }
      toast(bi('Código copiado', 'Code copied'));
    };
  }
};
