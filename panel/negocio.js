/* Panel del negocio: Negocio (o «Entidad»), como la pestaña Negocio del modo
 * negocio de la app (RUNBOOK §4zzb, parte 5, y §4zzz-panelapp; app
 * `business_index.dart` y `business_tools_catalog.dart`). Todas las
 * herramientas a la vista, por grupos y en el mismo orden que la app:
 * Tu ficha · Que vuelvan · En el local (en una entidad, «Pantallas y gente»)
 * · Agenda y equipo · Cifras, plan y ayuda y, al final, lo delicado del
 * propietario y «Salir del equipo». Arriba, la ficha (logo, dirección y
 * «Completa al X %») y, recién dado de alta, «Primeros pasos».
 *
 * Qué baldosa sale lo deciden las mismas condiciones que la app
 * (`BizTool.visibleFor` y `opensFor`): el papel (el personal ve lo suyo y
 * nada de importes), el tipo de negocio (`features` de
 * `business_tools_overview`, con lo que ya usa siempre a la vista), sin local
 * fijo (organizador o entidad), entidad y los interruptores (sorteos). Un
 * grupo que se quedaría con una sola baldosa se une al de antes (Iván, 18-11,
 * opción B). Cada baldosa abre la pantalla de siempre, en su dirección de
 * siempre (`/panel/ficha`, `/panel/sellos`…). Antes, esto estaba repartido entre «Lo
 * esencial» y «Tu negocio» del resumen, «Más herramientas» y el menú.
 *
 * `/panel/negocio/<grupo>` baja a ese grupo (el submenú de la izquierda).
 *
 * Va después de panel.js y herramientas.js y usa lo suyo (`PAGES`, `rpc`,
 * `BIZ`, `gestiona`, `herrAhora`, `herrEstado`, `herrSi`, `herrNum`,
 * `herrLleva`, `icono`, `ms`, `esc`, `bi`). Los nombres de aquí empiezan por
 * `neg`.
 */
'use strict';

/** Los sorteos con su interruptor (`app_config.giveaways`), cuando se sabe:
 * hasta entonces, sin su baldosa (como la app). */
let NEG_SORTEOS = false;

/** Quién mira y qué negocio es (`BizToolsContext` de la app). `o` es lo
 * último de `business_tools_overview` (del navegador mientras llega). */
function negContexto() {
  const ent = typeof esEntidad === 'function' && esEntidad();
  const org = esOrganizador();
  return {
    o: herrAhora(), edit: gestiona(), owner: esPropietario(), staff: !gestiona(),
    ent, venue: !org && !ent, sorteos: NEG_SORTEOS === true,
  };
}
/** ¿Su tipo lleva [k] o ya lo usa? Sin datos aún, no (como la app). */
const negLleva = (c, k, usa) => !!c.o && herrLleva(c.o, k, usa(c.o));

/** Las herramientas, en el orden de la app: [clave, grupo, icono, nombre
 * corto (la baldosa), nombre completo (lector de pantalla), adónde va (una
 * dirección, o una función que la da, o «widget»), si sale]. */
function negHerramientas(c) {
  const tipo = typeof tipoCarta === 'function' ? tipoCarta() : 'menu';
  const carta = typeof segunCarta === 'function'
    ? segunCarta([bi('Carta', 'Menu'), bi('Servicios', 'Services'), bi('Productos', 'Products'), bi('Precios', 'Prices')], tipo)
    : bi('Carta', 'Menu');
  const ficha = `${APP_URL}/b/${encodeURIComponent(BIZ.id)}`;
  const aforoOn = herrSi(c.o, 'capacity', 'enabled');
  const encargos = herrNum(c.o, 'preorders', 'items_all') > 0;
  return [
    // ── Tu ficha ──
    ['profileEdit', 'tu-ficha', 'storefront', bi('Editar ficha', 'Edit page'), null, '/panel/ficha', c.edit],
    ['viewPublic', 'tu-ficha', 'visibility', bi('Cómo se ve', 'How it looks'), bi('Ver cómo se ve', 'See how it looks'), ficha, true],
    ['hours', 'tu-ficha', 'schedule', bi('Horario', 'Opening hours'), null, '/panel/ficha/horario', c.edit && c.venue],
    ['menu', 'tu-ficha', 'restaurant_menu', carta, null, '/panel/carta',
      c.edit && negLleva(c, 'menu', (o) => herrNum(o, 'menu', 'items') > 0 || herrNum(o, 'menu', 'files') > 0)],
    ['highlights', 'tu-ficha', 'star', bi('Qué pedir', 'What to order'), bi('Qué pedir aquí', 'What to order here'), '/panel/ficha/que-pedir', c.edit && c.venue],
    ['venueInfo', 'tu-ficha', 'deck', bi('Tu local', 'Your place'), bi('Cómo es tu local', 'About your place'), '/panel/ficha/local', c.edit && c.venue],
    ['links', 'tu-ficha', 'link', bi('Reservar y pedir', 'Book and order'), null, '/panel/ficha/contacto', c.edit],
    ['closures', 'tu-ficha', 'event_busy', bi('Días cerrados', 'Closed days'), null, '/panel/cerrados', c.edit && c.venue],
    ['reviews', 'tu-ficha', 'reviews', bi('Reseñas', 'Reviews'), null, '/panel/resenas', true],
    ['questions', 'tu-ficha', 'contact_support', bi('Preguntas', 'Questions'), null, '/panel/preguntas', true],
    ['closedReports', 'tu-ficha', 'no_meeting_room', bi('Estaba cerrado', 'It was closed'), null, '/panel/estaba-cerrado', c.edit && c.venue],
    // ── Que vuelvan (nada para una entidad). «Fidelizar» entero, solo al
    // personal: lo mira todo ahí, también lo que no abre. ──
    ['loyalty', 'que-vuelvan', 'favorite', bi('Fidelizar', 'Loyalty'), null, '/panel/fidelizar', !c.ent && c.staff],
    ['stamps', 'que-vuelvan', 'approval', bi('Sellos', 'Stamps'), bi('Tarjetas de sellos', 'Stamp cards'), '/panel/sellos', !c.ent],
    ['passes', 'que-vuelvan', 'confirmation_number', bi('Bonos', 'Passes'), null, '/panel/bonos', !c.ent],
    ['coupon', 'que-vuelvan', 'redeem', bi('Cupón', 'Coupon'), bi('Cupón para la próxima visita', 'Coupon for the next visit'), '/panel/cupon', !c.ent],
    ['birthday', 'que-vuelvan', 'cake', bi('Cumpleaños', 'Birthday'), bi('Regalo de cumpleaños', 'Birthday gift'), '/panel/cumpleanos', !c.ent],
    ['thanks', 'que-vuelvan', 'volunteer_activism', bi('Agradecer', 'Thank'), bi('Agradecer a los habituales', 'Thank your regulars'), '/panel/habituales', !c.ent && c.edit],
    ['message', 'que-vuelvan', 'campaign', bi('Avisar', 'Notify'), bi('Avisar a mis clientes', 'Message my customers'), '/panel/mensajes', !c.ent && c.edit],
    ['firstVisit', 'que-vuelvan', 'waving_hand', bi('Primera visita', 'First visit'), bi('Ofertas de primera visita', 'First-visit offers'), '/panel/publicaciones/nueva-flash?primera=1', !c.ent && c.edit],
    ['exclusives', 'que-vuelvan', 'lock', bi('Exclusivas', 'Exclusives'), bi('Exclusivas para favoritos o clientes', 'Exclusives for favourites or customers'), '/panel/publicaciones/nueva-flash?exclusiva=1', !c.ent && c.edit],
    ['giveaways', 'que-vuelvan', 'celebration', bi('Sorteos', 'Giveaways'), null, '/panel/sorteos', !c.ent && c.sorteos],
    // ── En el local («Pantallas y gente» en una entidad) ──
    ['queue', 'en-el-local', 'people', bi('Cola virtual', 'Virtual queue'), null, '/panel/cola',
      !c.ent && negLleva(c, 'queue', (o) => herrSi(o, 'queue', 'open') || herrSi(o, 'queue', 'used_30d'))],
    ['capacity', 'en-el-local', 'exposure_plus_1', bi('Aforo', 'Capacity'), bi('Aforo en directo', 'Live capacity'), aforoOn ? '/panel/aforo' : '/panel/aforo/ajustes',
      c.venue && (c.edit || aforoOn) && negLleva(c, 'capacity', (o) => herrSi(o, 'capacity', 'enabled'))],
    // «Te aviso cuando esté listo»: hasta que se pueda activar, sin baldosa.
    ['orders', 'en-el-local', 'takeout_dining', bi('Pedido listo', 'Order ready'), bi('Te aviso cuando esté listo', 'Ready alert'), '/panel/pedidos',
      !c.ent && (c.edit || herrSi(c.o, 'orders', 'enabled')) && negLleva(c, 'orders', (o) => herrSi(o, 'orders', 'enabled'))
      && (herrSi(c.o, 'orders', 'enabled') || c.o?.orders_available !== false)],
    ['preorders', 'en-el-local', 'shopping_basket', bi('Encargos', 'Pre-orders'), null, encargos ? '/panel/encargos' : '/panel/encargos-cosas',
      herrSi(c.o, 'preorders', 'enabled') && !c.ent && (c.edit || encargos) && negLleva(c, 'preorders', (o) => herrNum(o, 'preorders', 'items_all') > 0)],
    ['dailyMenu', 'en-el-local', 'restaurant_menu', bi('Menú del día', 'Daily menu'), null, '/panel/menu-del-dia', c.edit && c.venue && herrSi(c.o, 'daily_menu', 'suggested')],
    ['beforeClosing', 'en-el-local', 'shopping_bag', bi('Antes de cerrar', 'Before closing'), null, '/panel/antes-de-cerrar', c.edit && c.venue && herrSi(c.o, 'before_closing', 'suggested')],
    ['tableQr', 'en-el-local', 'wifi', bi('Wifi', 'Wi-Fi'), bi('Wifi para clientes', 'Wi-Fi for customers'), '/panel/wifi-clientes',
      c.edit && c.venue && negLleva(c, 'table_qr', (o) => herrSi(o, 'table_qr', 'wifi') || herrSi(o, 'table_qr', 'has'))],
    // Una entidad, el de su agenda («Sigue nuestra agenda»; §4zzz-propent).
    ['poster', 'en-el-local', 'qr_code_2', bi('Cartel', 'Poster'), c.ent ? bi('Cartel «Sigue nuestra agenda»', '“Follow our events” poster') : bi('Cartel del local', 'Venue poster'),
      '/panel/cartel-local', c.edit && (c.venue || c.ent)],
    // La pegatina de escaparate «Encuéntranos en Klendar» (§4zzz-cartel): la
    // página de la web, con el QR a su ficha. Solo con local (va en el cristal).
    ['sticker', 'en-el-local', 'escaparate', bi('Pegatina', 'Sticker'), bi('Pegatina de escaparate', 'Window sticker'), pegatinaUrl(), c.edit && c.venue],
    ['tv', 'en-el-local', 'tv', bi('Tele', 'TV'), bi('Poner en la tele', 'Show on TV'), '/panel/tele', c.edit],
    ['broadcasts', 'en-el-local', 'live_tv', bi('Partidos', 'Matches'), bi('Partidos que pones', "Matches you're showing"), '/panel/partidos', c.venue && herrSi(c.o, 'broadcasts', 'suggested')],
    ['groups', 'en-el-local', 'groups', bi('Grupos', 'Groups'), bi('Grupos y empresas', 'Groups and companies'), '/panel/grupos',
      c.edit && !c.ent && negLleva(c, 'groups', (o) => herrSi(o, 'groups', 'enabled'))],
    ['webWidget', 'en-el-local', 'code', bi('En tu web', 'On your website'), bi('Klendar en tu web', 'Klendar on your website'), 'widget', true],
    // ── Agenda y equipo ──
    ['series', 'agenda-y-equipo', 'event_repeat', bi('Series', 'Series'), bi('Series y repeticiones', 'Series and repeats'), '/panel/series', true],
    ['calendar', 'agenda-y-equipo', 'calendar_month', bi('Calendario', 'Calendar'), null, '/panel/calendario', true],
    ['team', 'agenda-y-equipo', 'group', bi('Equipo', 'Team'), null, '/panel/equipo', c.edit],
    ['promoters', 'agenda-y-equipo', 'badge', 'RRPP', bi('RRPP', 'Promoters'), '/panel/rrpp', c.edit && !c.ent],
    // Las listas de la puerta: el personal siempre (es lo suyo); quien
    // gestiona las tiene en RRPP y en Validar, y aquí solo si tiene RRPP.
    ['door', 'agenda-y-equipo', 'how_to_reg', bi('Listas', 'Lists'), bi('Listas de esta noche', "Tonight's lists"), '/panel/validar?listas=1',
      !c.ent && (!c.edit || herrNum(c.o, 'promoters', 'active') > 0)],
    // ── Cifras, plan y ayuda (el asistente va dentro de Ayuda) ──
    ['report', 'cifras', 'insights', bi('Cifras', 'Stats'), null, '/panel/informe', true],
    // Una entidad no paga cuota: sin plan.
    ['plan', 'cifras', 'receipt_long', bi('Tu plan', 'Your plan'), null, '/panel/plan', c.edit && !c.ent],
    ['help', 'cifras', 'help_outline', bi('Ayuda', 'Help'), bi('Preguntas frecuentes', 'Frequently asked questions'), '/panel/ayuda', true],
  ];
}

/** La pegatina de escaparate de este negocio (en el idioma del panel). */
const pegatinaUrl = () => new URL(`${I18N.pub === 'en' ? '/en/poster/sticker/' : '/cartel/pegatina/'}${encodeURIComponent(BIZ.id)}${['es', 'en'].includes(I18N.lang) ? '' : `?lang=${encodeURIComponent(I18N.lang)}`}`, location.href).href;

/** El título de un grupo (los de la app). */
function negTitulo(g, lista, c) {
  return {
    'tu-ficha': bi('Tu ficha', 'Your page'),
    'que-vuelvan': bi('Que vuelvan', 'Bring them back'),
    // Una entidad no tiene local: ahí solo le quedan la tele y la web.
    'en-el-local': c.ent ? bi('Pantallas y gente', 'Screens and people') : bi('En el local', 'At your venue'),
    'agenda-y-equipo': bi('Agenda y equipo', 'Calendar and team'),
    // Una entidad (y el personal) no ve el plan.
    cifras: lista.some((t) => t[0] === 'plan') ? bi('Cifras, plan y ayuda', 'Numbers, plan and help') : bi('Cifras y ayuda', 'Numbers and help'),
    delicado: bi('Zona delicada · solo el propietario', 'Sensitive · owner only'),
  }[g];
}

/** Los grupos de Negocio para quien mira, en su orden y sin los vacíos:
 * [grupo, título, baldosas]. Uno que se quedaría con una sola baldosa se une
 * al de antes (como la app). Al final, «delicado» (solo el propietario). */
function negGrupos(c = negContexto()) {
  const todas = negHerramientas(c).filter((t) => t[6]);
  const out = [];
  for (const [g] of GRUPOS_NEGOCIO) {
    const lista = todas.filter((t) => t[1] === g);
    if (!lista.length) continue;
    if (lista.length === 1 && out.length) { out[out.length - 1][2].push(lista[0]); continue; }
    out.push([g, null, lista]);
  }
  for (const x of out) x[1] = negTitulo(x[0], x[2], c);
  if (c.owner) out.push(['delicado', negTitulo('delicado', [], c), []]);
  return out;
}

/** Una baldosa: el icono y el nombre corto; el lector lee el completo (que
 * lleva dentro el corto, para quien habla al ordenador: WCAG 2.5.3). La de
 * la ficha pública se abre en otra pestaña y lo dice. */
function negBaldosa([clave, , ic, corto, completo, destino]) {
  const fuera = /^https?:/.test(destino);
  let nombre = completo && completo !== corto
    ? (completo.toLocaleLowerCase(LOC()).includes(corto.toLocaleLowerCase(LOC())) ? completo : `${corto} (${completo})`) : '';
  if (fuera) nombre = `${nombre || corto} (${bi('se abre en otra pestaña', 'opens in a new tab')})`;
  const aria = nombre ? ` aria-label="${esc(nombre)}"` : '';
  const dentro = `${icono(ic)}<span>${esc(corto)}${fuera ? '<span aria-hidden="true"> ↗</span>' : ''}</span>`;
  if (destino === 'widget') return `<li><button type="button" class="neg-tile" data-neg="${clave}"${aria}>${dentro}</button></li>`;
  return `<li><a class="neg-tile" href="${esc(destino)}" data-neg="${clave}"${aria}${fuera ? ' target="_blank" rel="noopener"' : ''}>${dentro}</a></li>`;
}

/** Lo delicado del propietario: descargar los datos y darse de baja (las
 * mismas tarjetas que antes en el resumen parado y en la ficha). */
const negDelicado = (titulo) => `<section class="neg-grupo neg-delicado" id="g-delicado" aria-labelledby="gt-delicado">
    <h2 id="gt-delicado">${esc(titulo)}</h2>
    ${tarjetaDescarga()}
    <div class="card"><h3>Dar de baja el negocio</h3>
      <p class="muted" style="margin:0 0 10px">${esc(esEntidad()
    ? bi('Si dejas Klendar: cerrar hasta nuevo aviso, traspasar la entidad o eliminarla.', 'If you’re leaving Klendar: close until further notice, hand over the organisation or delete it.')
    : bi('Si dejas Klendar: cerrar hasta nuevo aviso, cancelar la suscripción, traspasar el negocio o eliminarlo.', 'If you’re leaving Klendar: close until further notice, cancel the subscription, transfer the business or delete it.'))}</p>
      <a class="btn" href="/panel/baja">Dar de baja el negocio</a></div></section>`;

/** Al final: «Salir del equipo» (quien no es propietario) y, en el móvil,
 * la sesión y «Cerrar sesión» (en el ordenador están abajo del menú). */
const negFinal = (c) => `${c.owner ? '' : `<div class="card neg-salir"><h2>Salir del equipo</h2>
      <p class="muted" style="margin:0 0 10px">Dejarás de ver este panel y de validar sus códigos. Avisaremos al propietario.</p>
      <button class="btn bad ghost" type="button" id="salir-equipo">Salir del equipo</button></div>`}
    <p class="neg-sesion"><span class="muted">${esc(bi('Sesión', 'Logged in as'))}</span> <b translate="no">${esc(ME?.email || ME?.phone || '')}</b>
      <button type="button" class="linkbtn" id="negLogout">${esc(bi('Cerrar sesión', 'Log out'))}</button></p>`;

/** La cabecera: logo, nombre, sellos y dirección y, a quien gestiona,
 * «Completa al X %» (como `BusinessHeaderRow` de la app). */
function negCabecera(b, pct) {
  const letra = String(BIZ.name || '?').trim().charAt(0).toLocaleUpperCase(LOC());
  const logo = b?.logo_url && window.KFotos?.mini
    ? `<img class="neg-logo" src="${esc(KFotos.mini(b.logo_url))}" alt="" width="56" height="56" loading="lazy">`
    : b?.logo_url ? `<img class="neg-logo" src="${esc(b.logo_url)}" alt="" width="56" height="56" loading="lazy">`
      // Sin logo, el hueco de siempre (§4zzz-sinfoto): el icono de su tipo de negocio.
      : window.KlendarSinFoto ? KlendarSinFoto.html({ categoria: b?.category_id ?? BIZ.category_id, nombre: BIZ.name, clase: 'neg-logo' })
        : `<span class="neg-logo neg-letra" aria-hidden="true">${esc(letra)}</span>`;
  const donde = [b?.address, b?.city].filter(Boolean).join(', ');
  return `<div class="neg-cab">${logo}<div class="neg-cab-t">
      <p class="neg-nombre"><b translate="no">${esc(BIZ.name)}</b>${BIZ.entity?.kind ? ` <span class="tag badge-entidad">${icono('entidad')} ${esc(entSello(BIZ.entity.kind))}</span>` : ''}
        <span class="tag st-${esc(BIZ.verification_status)}">${esc(BIZ_LABELS[BIZ.verification_status] || BIZ.verification_status)}</span></p>
      ${donde ? `<p class="muted neg-donde" translate="no">${esc(donde)}</p>` : ''}
      ${pct != null && pct < 100 ? `<a class="link" href="/panel/ficha">${esc(bi(`Completa al ${pct} %`, `${pct}% complete`))}</a>` : ''}
    </div></div>`;
}

/** «Klendar en tu web»: la línea para pegar, «Copiar» y «Ver cómo queda»
 * (antes, una tarjeta de «Más herramientas»; en la app, una hoja). */
function negWidget(boton) {
  const d = $('#modal');
  const codigo = `<script src="${APP_URL}/widget.js" data-klendar="${BIZ.id}"></script>`;
  d.innerHTML = `<form method="dialog"><h2>${esc(bi('Klendar en tu web', 'Klendar on your website'))}</h2>
    <p class="muted" style="margin:0">${esc(bi('Pega esta línea en tu web y saldrá lo que tienes publicado. Se actualiza sola.', 'Paste this line on your website and what you’ve published will show there. It updates itself.'))}</p>
    <pre class="code" style="margin:10px 0 0">${esc(codigo)}</pre>
    <div class="foot"><a class="btn ghost" href="${esc(`${APP_URL}/widget/${BIZ.id}`)}" target="_blank" rel="noopener">${esc(bi('Ver cómo queda', 'See how it looks'))}<span class="sr-only"> (${esc(bi('se abre en otra pestaña', 'opens in a new tab'))})</span></a>
      <button type="button" class="btn" data-copiar>${esc(bi('Copiar', 'Copy'))}</button>
      <button type="button" class="btn primary" data-cancel>${esc(bi('Cerrar', 'Close'))}</button></div></form>`;
  const cerrar = () => { d.close(); boton?.focus(); };
  $('[data-cancel]', d).onclick = cerrar;
  d.oncancel = (e) => { e.preventDefault(); cerrar(); };
  $('[data-copiar]', d).onclick = async () => {
    try { await navigator.clipboard.writeText(codigo); } catch { toast(bi('No se ha podido copiar', "Couldn't copy"), true); return; }
    toast(bi('Código copiado', 'Code copied'));
  };
  d.showModal();
}

/** Baja al grupo de `/panel/negocio/<grupo>` (el submenú de la izquierda). */
function negBajaA(v, grupo) {
  const sec = grupo && $(`#g-${CSS.escape(grupo)}`, v);
  if (!sec) return;
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  sec.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' });
  const h = $('h2', sec);
  if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
}

/** «Primeros pasos» (recién dado de alta o sin nada publicado), como en la
 * app, que lo pone arriba de Negocio: la primera oferta, que se repite sola,
 * y lo que le falta a la ficha. Antes estaba en el resumen. */
async function negPrimeros(ficha, cuentas) {
  if (!gestiona() || BIZ.verification_status === 'rejected' || BIZ.entity?.pending
    || (esEntidad() && BIZ.verification_status !== 'verified') || !ficha) return { html: '', lista: [] };
  const sinNada = cuentas?.publicadas != null ? cuentas.publicadas === 0 : !(cuentas?.total);
  const faltan = fichaFaltan(ficha);
  const reciente = ficha.created_at && Date.now() - new Date(ficha.created_at).getTime() < 30 * 86400e3;
  if (!(sinNada || (reciente && faltan.some((f) => !f.hecho)))) return { html: '', lista: [] };
  const sinLocal = esOrganizador() || esEntidad();
  const sug = sinNada && !sinLocal ? await sugerenciasDelNegocio() : [];
  const paso = (hecho, titulo, pista, href) => `<a class="paso${hecho ? ' hecho' : ''}" ${hecho ? '' : `href="${href}"`}>
      <span class="n">${hecho ? ms('check') : ''}</span><span><b>${titulo}</b>${pista && !hecho ? `<small>${pista}</small>` : ''}</span>${hecho ? '' : ms('chevron_right')}</a>`;
  const html = `<div class="card primeros"><h2>${sug.length ? 'Primeros pasos' : 'Completa tu ficha'}</h2>
      ${sug.length ? `<h3 class="sug-titulo">Tu primera oferta, que se repite sola</h3>
      <p class="muted" style="margin:0 0 4px">Elige una y ajusta el precio o los días: sale sola cada semana a su hora.</p>
      ${sugLista(sug)}
      <p style="margin:2px 0 10px"><a class="link" href="/panel/publicaciones/nueva-flash?idea=1">Prefiero escribir otra</a></p>
      <h3 class="sug-titulo">Completa tu ficha</h3>` : ''}
      <p class="muted" style="margin:0 0 8px">Nada de esto frena tu alta: hazlo ahora o cuando quieras.</p>
      ${sinLocal && sinNada ? (esEntidad()
    ? paso(false, 'Publica tu primer evento', 'Con su fecha y su sitio: cada evento lleva el suyo.', '/panel/publicaciones/nuevo-evento')
    : paso(false, 'Publica tu primera oferta', 'Te la dejamos casi hecha: cambia el precio y la hora.', '/panel/publicaciones/nueva-flash?idea=1')) : ''}
      ${faltan.map((f) => paso(f.hecho, f.titulo, '', f.href)).join('')}
    </div>`;
  return { html, lista: sug };
}

/** Negocio con el negocio parado (bloqueado o en pausa): el aviso, «Tu plan»
 * y la ayuda, lo delicado y «Salir del equipo» (antes, en el resumen). */
function negParado(v, c) {
  const tiles = negHerramientas(c).filter((t) => t[6] && ['plan', 'help'].includes(t[0]));
  v.innerHTML = `<div class="page-head"><h1>${esc(nombreSeccion(SECCIONES[3])[1])}</h1></div>
    ${avisoParado(cobro())}
    <section class="neg-grupo" id="g-cifras" aria-labelledby="gt-cifras"><h2 id="gt-cifras">${esc(negTitulo('cifras', tiles, c))}</h2>
      <ul class="neg-tiles">${tiles.map(negBaldosa).join('')}</ul></section>
    ${c.owner ? negDelicado(negTitulo('delicado', [], c)) : ''}
    ${negFinal(c)}`;
  activaParado(v);
  negActiva(v);
}

/** Los botones de Negocio: «Klendar en tu web», «Salir del equipo» y
 * «Cerrar sesión». */
function negActiva(v) {
  activaDescarga(v);
  $$('[data-neg="webWidget"]', v).forEach((b) => { b.onclick = () => negWidget(b); });
  const salir = $('#salir-equipo', v);
  if (salir) {
    salir.onclick = async () => {
      if (salir.disabled) return;
      salir.disabled = true;
      try { await salirDelEquipo(); } catch (e) { toast(e.message, true); }
      salir.disabled = false;
    };
  }
  const fuera = $('#negLogout', v);
  if (fuera) fuera.onclick = (e) => $('#logout').onclick(e);
}

PAGES.negocio = async (v, grupo) => {
  if (bloqueado()) return negParado(v, negContexto());
  const negocio = BIZ.id;
  const edit = gestiona();
  // Todo a la vez: el estado de las herramientas, el interruptor de los
  // sorteos y, a quien gestiona, lo de la ficha («Completa al X %» y
  // «Primeros pasos»); al personal, solo el logo y la dirección.
  const [o, sorteos, fichaR, carta, enlaces, cuentas] = await Promise.all([
    herrEstado(),
    typeof sorteosEnPanel === 'function' ? sorteosEnPanel().catch(() => false) : false,
    sb.from('businesses').select(edit
      ? 'logo_url, cover_image_url, gallery, description, opening_hours, phone, website, contact_email, social_links, amenities, menu_url, menu_images, address, city, created_at, category_id'
      : 'logo_url, address, city, category_id').eq('id', negocio).maybeSingle().then((r) => r.data || null, () => null),
    edit ? rpc('business_menu', { p_business: negocio }).catch(() => null) : null,
    edit ? rpc('business_links', { p_id: negocio }).catch(() => null) : null,
    edit ? rpc('my_business_offer_counts', { p_business: negocio }).catch(() => null) : null,
  ]);
  if (BIZ?.id !== negocio) return;
  NEG_SORTEOS = sorteos === true;
  const ficha = fichaR;
  if (ficha && ficha.category_id !== undefined) BIZ.category_id = ficha.category_id ?? null;
  let pct = null;
  if (edit && ficha && typeof fichaCompleta === 'function') {
    ficha.menu_files = Array.isArray(enlaces?.menu_files) ? enlaces.menu_files : null;
    pct = fichaCompleta(ficha, { sitio: Array.isArray(ficha.amenities) ? ficha.amenities : [], carta: carta || [] });
  }
  const c = negContexto();
  // Sin el estado de las herramientas (ni de ahora ni guardado), lo que
  // depende de él no sale; se dice y se puede volver a probar.
  const sinEstado = !o && !c.o;
  const grupos = negGrupos(c);
  const primeros = await negPrimeros(ficha, cuentas).catch(() => ({ html: '', lista: [] }));
  if (BIZ?.id !== negocio) return;
  v.innerHTML = `
    <div class="page-head"><h1>${esc(nombreSeccion(SECCIONES[3])[1])}</h1></div>
    ${negCabecera(ficha, pct)}
    ${sinEstado ? `<div class="help">${esc(bi('Algunas herramientas no se han podido cargar.', 'Some tools couldn’t be loaded.'))}
      <button type="button" class="linkbtn" data-neg-otra>${esc(I18N.t('Reintentar'))}</button></div>` : ''}
    ${primeros.html}
    ${grupos.map(([g, titulo, lista]) => (g === 'delicado' ? negDelicado(titulo)
    : `<section class="neg-grupo" id="g-${g}" aria-labelledby="gt-${g}"><h2 id="gt-${g}">${esc(titulo)}</h2>
      <ul class="neg-tiles">${lista.map(negBaldosa).join('')}</ul></section>`)).join('')}
    ${negFinal(c)}`;
  negActiva(v);
  sugActiva(v, primeros.lista, () => route());
  const otra = $('[data-neg-otra]', v);
  if (otra) otra.onclick = () => route();
  // El submenú depende de lo que ha llegado ahora.
  renderNav('negocio');
  if (grupo) requestAnimationFrame(() => negBajaA(v, grupo));
};
