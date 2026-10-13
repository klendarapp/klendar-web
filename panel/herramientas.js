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
 *   si está activa y su botón.
 * - «Crear»: elegir qué publicar (oferta flash, evento o novedad).
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
  candado: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z',
});

/** El estado de las herramientas del negocio de ahora (null si falla). */
async function herrEstado() {
  const r = await rpc('business_tools_overview', { p_business: BIZ.id }).catch(() => null);
  return r && r.ok !== false ? r : null;
}
const herrNum = (o, k, f) => Number(o?.[k]?.[f]) || 0;
const herrSi = (o, k, f) => o?.[k]?.[f] === true;
/** Plural sencillo: herrPl(n, ['1 tele', 'teles'], ['1 TV', 'TVs']). Con
 * varios se traduce la plantilla «{n} teles» (en los idiomas nuevos, el
 * diccionario la tiene así) y luego se pone el número. */
const herrPl = (n, [es1, esN], [en1, enN]) => (n === 1
  ? bi(es1, en1)
  : bi(`{n} ${esN}`, `{n} ${enN}`).replace('{n}', fmtNum(n)));

// ── «Crear»: qué publicar ───────────────────────────────────────────────────
/** Como la hoja de «Crear» de la app: tres opciones con su frase. */
function herrCrear() {
  const d = $('#modal');
  const op = (href, icon, titulo, frase) => `<a class="crear-op" href="${href}">${icono(icon)}
    <span><b>${esc(titulo)}</b><small>${esc(frase)}</small></span>${ms('chevron_right')}</a>`;
  d.innerHTML = `<form method="dialog"><h2>${esc(bi('¿Qué quieres publicar?', 'What do you want to publish?'))}</h2>
    <div class="crear-ops">
      ${op('#/publicaciones/nueva-flash', 'bolt', bi('Oferta flash', 'Flash offer'), bi('Canjeable con QR durante unas horas', 'Redeemable with a QR for a few hours'))}
      ${op('#/publicaciones/nuevo-evento', 'event', bi('Evento', 'Event'), bi('Con fecha, aforo y reserva de plaza', 'With a date, a limit and place booking'))}
      ${op('#/novedades', 'campaign', bi('Novedad', 'Update'), bi('Una nota corta en tu ficha: «hoy hay pulpo»', 'A short note on your page: “octopus today”'))}
    </div>
    <div class="foot"><button type="button" class="btn ghost" data-cancel>${esc(bi('Cancelar', 'Cancel'))}</button></div></form>`;
  const cerrar = () => d.close();
  $('[data-cancel]', d).onclick = cerrar;
  d.oncancel = (e) => { e.preventDefault(); cerrar(); };
  $$('.crear-op', d).forEach((a) => a.addEventListener('click', cerrar));
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
  return `<nav class="esencial" aria-label="${esc(bi('Lo esencial', 'The essentials'))}">
    ${gestiona()
    ? herrTile('#/ficha', 'storefront', bi('Tu ficha', 'Your page'), '', 'esFicha')
    : herrTile(`${APP_URL}/b/${encodeURIComponent(BIZ.id)}`, 'storefront', bi('Tu ficha', 'Your page'), bi('Ver cómo se ve', 'See how it looks'))}
    ${herrTile('#/fidelizar', 'favorite', bi('Fidelizar', 'Loyalty'), '', 'esFiel')}
    ${herrTile('#/informe', 'bar_chart', bi('Cifras', 'Stats'), herrPl(canjes, ['1 canje · 30 días', 'canjes · 30 días'], ['1 redemption · 30 days', 'redemptions · 30 days']))}
    ${gestiona()
    ? herrTile('#/rrpp', 'rrpp', 'RRPP', '', 'esRrpp')
    : herrTile('#/validar', 'qr_code_scanner', bi('Listas de esta noche', "Tonight's lists"), bi('Quién viene esta noche', "Who's coming tonight"))}
  </nav>`;
}

/** Rellena las líneas de «Lo esencial» y las filas de acceso rápido. */
async function herrResumen(v, { cajaFilas }) {
  const negocio = BIZ.id;
  const [o, fiel, ficha] = await Promise.all([
    herrEstado(),
    rpc('business_loyalty', { p_business: negocio }).catch(() => null),
    gestiona() && typeof datosFicha === 'function' ? datosFicha().catch(() => null) : null,
  ]);
  if (!v.isConnected || BIZ?.id !== negocio) return;
  const linea = (id, texto) => { const s = $(`#${id} [data-linea]`, v); if (s) s.textContent = texto; };
  if (ficha?.b && typeof fichaCompleta === 'function') {
    const pct = fichaCompleta(ficha.b, { sitio: ficha.b.amenities, carta: ficha.carta });
    linea('esFicha', bi(`Completa al ${pct} %`, `${pct}% complete`));
  }
  if (o && fiel && fiel.ok !== false) {
    const n = [herrNum(o, 'stamps', 'active') > 0, fiel.coupon?.enabled === true, herrSi(o, 'birthday', 'enabled'),
      herrNum(o, 'first_visit', 'live') > 0, herrNum(o, 'exclusives', 'live') > 0, fiel.thanks?.enabled === true,
      herrNum(o, 'passes', 'on_sale') > 0, herrNum(o, 'giveaways', 'active') > 0].filter(Boolean).length;
    linea('esFiel', n === 0 ? bi('Nada activado', 'Nothing on yet') : bi(n === 1 ? '1 activada' : `${n} activadas`, `${n} on`));
  }
  if (o) {
    const r = herrNum(o, 'promoters', 'active');
    linea('esRrpp', r === 0 ? bi('Invita al primero', 'Invite your first') : herrPl(r, ['1 RRPP activo', 'RRPP activos'], ['1 active promoter', 'active promoters']));
  }
  if (!o || !cajaFilas) return;
  const org = esOrganizador();
  const fila = (href, icon, texto, attrs = '') => `<a class="fila-inicio" href="${href}" ${attrs}>${icono(icon)}<span>${esc(texto)}</span>${ms('chevron_right')}</a>`;
  const pend = herrNum(o, 'groups', 'pending');
  const resenas = herrNum(o, 'reviews', 'unanswered');
  const bc = o.before_closing || {};
  const filas = [
    // La cola abierta ya sale en su fila (panel/cola.js); si la usa y ahora
    // está cerrada, la fila para abrirla.
    !herrSi(o, 'queue', 'open') && herrSi(o, 'queue', 'used_30d') ? fila('#/cola', 'cola', bi('Cola virtual · cerrada', 'Virtual queue · closed')) : '',
    gestiona() && herrSi(o, 'groups', 'enabled') ? fila('#/grupos', 'grupos', bi(
      `Grupos y empresas · ${pend === 0 ? 'sin peticiones' : pend === 1 ? '1 sin contestar' : `${pend} sin contestar`}`,
      `Groups and companies · ${pend === 0 ? 'no requests' : pend === 1 ? '1 to answer' : `${pend} to answer`}`)) : '',
    resenas > 0 ? fila('#/resenas', 'reviews', bi(`Reseñas · ${resenas === 1 ? '1 sin responder' : `${resenas} sin responder`}`, `Reviews · ${resenas} unanswered`)) : '',
    gestiona() && !org && bc.suggested && (bc.live || bc.reminder_at) ? fila('#/antes-de-cerrar', 'bolsa', bc.live
      ? bi('Antes de cerrar · publicada hoy', 'Before closing · published today')
      : bi(`Antes de cerrar · aviso a las ${bc.reminder_at}`, `Before closing · reminder at ${bc.reminder_at}`)) : '',
    !org && herrNum(o, 'broadcasts', 'upcoming') > 0 ? fila('#/partidos', 'partido', bi(`Partidos que pones · ${herrNum(o, 'broadcasts', 'upcoming')} esta semana`, `Matches you're showing · ${herrNum(o, 'broadcasts', 'upcoming')} this week`)) : '',
    gestiona() && herrNum(o, 'tv', 'screens') > 0 ? fila('#/tele', 'tele', bi('Poner en la tele · ', 'Show on TV · ') + herrPl(herrNum(o, 'tv', 'screens'), ['1 tele', 'teles'], ['1 TV', 'TVs'])) : '',
    herrNum(o, 'series', 'rules_active') > 0 ? fila('#/series', 'repite', bi('Series y repeticiones · ', 'Series and repeats · ')
      + herrPl(herrNum(o, 'series', 'rules_active'), ['1 se publica sola', 'se publican solas'], ['1 publishes itself', 'publish themselves'])) : '',
  ].filter(Boolean);
  cajaFilas.innerHTML = filas.length ? `<div class="filas-inicio">${filas.join('')}</div>` : '';
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

PAGES.herramientas = async (v) => {
  const o = await rpc('business_tools_overview', { p_business: BIZ.id });
  if (!o || o.ok === false) throw new Error(o?.error || 'not_authorized');
  const edit = o.can_edit === true;
  const local = !esOrganizador();
  const onOff = (x) => (x ? bi('Activado', 'On') : bi('Apagado', 'Off'));
  const sinPreparar = bi('Sin preparar', 'Not set up');
  const configurar = bi('Configurar', 'Set up');
  const abrir = bi('Abrir', 'Open');
  const activar = bi('Activar', 'Turn on');
  const items = herrNum(o, 'menu', 'items');
  const archivos = herrNum(o, 'menu', 'files');
  const enlaces = herrNum(o, 'links', 'count');
  const bc = o.before_closing || {};
  const reglas = herrNum(o, 'series', 'rules_active');
  const series = herrNum(o, 'series', 'active');
  const espera = herrNum(o, 'queue', 'waiting');
  const partidos = herrNum(o, 'broadcasts', 'upcoming');
  const teles = herrNum(o, 'tv', 'screens');
  const pend = herrNum(o, 'groups', 'pending');
  const codigo = `<script src="${APP_URL}/widget.js" data-klendar="${BIZ.id}"></script>`;
  const tarjetas = [
    edit ? herrTarjeta({
      icon: 'restaurant_menu', titulo: bi('Carta', 'Menu'),
      frase: bi('Para enseñar lo que tienes, con precios, fotos y alérgenos. Sale en tu ficha.', 'To show what you offer, with prices, photos and allergens. It shows on your page.'),
      estado: items ? herrPl(items, ['1 plato', 'platos'], ['1 dish', 'dishes']) : archivos ? herrPl(archivos, ['1 archivo', 'archivos'], ['1 file', 'files']) : sinPreparar,
      on: items > 0 || archivos > 0, botones: [[configurar, '#/carta']],
    }) : '',
    edit ? herrTarjeta({
      icon: 'enlace', titulo: bi('Reservar y pedir', 'Book and order'),
      frase: bi('Para que reserven o pidan donde ya trabajas (TheFork, Glovo…): botones en tu ficha.', 'So people book or order where you already work (TheFork, Glovo…): buttons on your page.'),
      estado: enlaces ? herrPl(enlaces, ['1 enlace', 'enlaces'], ['1 link', 'links']) : sinPreparar,
      on: enlaces > 0, botones: [[configurar, '#/ficha/contacto']],
    }) : '',
    edit && local && bc.suggested ? herrTarjeta({
      icon: 'bolsa', titulo: bi('Antes de cerrar', 'Before closing'),
      frase: bi('Para lo que te sobra del día: una bolsa sorpresa hasta el cierre, en dos toques.', 'For what’s left at the end of the day: a surprise bag until closing, in two taps.'),
      estado: bc.live ? bi('Publicada hoy', 'Published today') : bc.reminder_at ? bi(`Aviso cada día a las ${bc.reminder_at}`, `Daily reminder at ${bc.reminder_at}`) : '',
      on: !!(bc.live || bc.reminder_at), botones: [[abrir, '#/antes-de-cerrar']],
    }) : '',
    herrTarjeta({
      icon: 'repite', titulo: bi('Series y repeticiones', 'Series and repeats'),
      frase: bi('Para lo que se repite: una oferta que se publica sola cada semana o las fechas de una misma serie.', 'For what repeats: an offer that publishes itself every week, or the dates of one series.'),
      estado: reglas === 0 ? bi('Nada se publica solo', 'Nothing publishes itself') : herrPl(reglas, ['1 se publica sola', 'se publican solas'], ['1 publishes itself', 'publish themselves']),
      on: reglas > 0, detalle: series ? herrPl(series, ['1 serie', 'series'], ['1 series', 'series']) : '',
      botones: [[abrir, '#/series']],
    }),
    local ? herrTarjeta({
      icon: 'people', titulo: bi('¿Hay sitio ahora?', 'Room right now?'),
      frase: bi('Para decir con un toque si hay sitio (tranquilo, animado o lleno). Sale en tu ficha durante 2 horas.', 'To say with one tap whether there’s room (quiet, lively or full). It shows on your page for 2 hours.'),
      estado: onOff(herrSi(o, 'crowd', 'enabled')), on: herrSi(o, 'crowd', 'enabled'),
      botones: edit ? [[herrSi(o, 'crowd', 'enabled') ? configurar : activar, '#/ficha/local']] : [],
    }) : '',
    herrTarjeta({
      icon: 'cola', titulo: bi('Cola virtual', 'Virtual queue'),
      frase: bi('Para que no hagan cola en la puerta: se apuntan con el QR del cartel y les avisamos cuando les toca.', 'So nobody queues at the door: people join with the poster’s QR and we tell them when it’s their turn.'),
      estado: herrSi(o, 'queue', 'open') ? bi(`Abierta · ${espera} esperando`, `Open · ${espera} waiting`)
        : herrSi(o, 'queue', 'used_30d') ? bi('Cerrada ahora', 'Closed now') : bi('Apagado', 'Off'),
      on: herrSi(o, 'queue', 'open'), botones: [[abrir, '#/cola']],
    }),
    local && herrSi(o, 'broadcasts', 'suggested') ? herrTarjeta({
      icon: 'partido', titulo: bi('Partidos que pones', "Matches you're showing"),
      frase: bi('Para que te encuentre quien busca dónde ver el partido: marca lo que pones.', 'So people looking for where to watch the match find you: mark what you’re showing.'),
      estado: partidos === 0 ? bi('Nada marcado esta semana', 'Nothing marked this week') : herrPl(partidos, ['1 partido esta semana', 'partidos esta semana'], ['1 match this week', 'matches this week']),
      on: partidos > 0, botones: [[abrir, '#/partidos']],
    }) : '',
    edit ? herrTarjeta({
      icon: 'tele', titulo: bi('Poner en la tele', 'Show on TV'),
      frase: bi('Para la tele de tu local: tus publicaciones van pasando, cada una con un QR para guardarla.', 'For the TV in your venue: your publications take turns, each with a QR to save it.'),
      estado: teles ? herrPl(teles, ['1 tele enlazada', 'teles enlazadas'], ['1 TV linked', 'TVs linked']) : bi('Apagado', 'Off'),
      on: teles > 0, botones: [[configurar, '#/tele']],
    }) : '',
    edit ? herrTarjeta({
      icon: 'grupos', titulo: bi('Grupos y empresas', 'Groups and companies'),
      frase: bi('Para recibir peticiones de grupos y empresas (cenas, cumpleaños, comidas de equipo) y mandar tu propuesta.', 'To get requests from groups and companies (dinners, birthdays, team meals) and send your proposal.'),
      estado: onOff(herrSi(o, 'groups', 'enabled')), on: herrSi(o, 'groups', 'enabled'),
      detalle: herrSi(o, 'groups', 'enabled') ? (pend === 0 ? bi('Sin peticiones ahora', 'No requests right now') : herrPl(pend, ['1 petición sin contestar', 'peticiones sin contestar'], ['1 request to answer', 'requests to answer'])) : '',
      botones: [[herrSi(o, 'groups', 'enabled') ? abrir : activar, '#/grupos']],
    }) : '',
    edit && local ? herrTarjeta({
      icon: 'qr_code_2', titulo: bi('Cartel del local', 'Venue poster'),
      frase: bi('Para tu puerta o tu mostrador: un QR que abre tu ficha y suma un sello por visita.', 'For your door or counter: a QR that opens your page and adds a stamp per visit.'),
      botones: [[abrir, '#/cartel-local']],
    }) : '',
    herrTarjeta({
      icon: 'codigo', titulo: bi('Klendar en tu web', 'Klendar on your website'),
      frase: bi('Pega esta línea en tu web y saldrá lo que tienes publicado. Se actualiza sola.', 'Paste this line on your website and what you’ve published will show there. It updates itself.'),
      extra: `<pre id="wcode" class="code" style="margin:10px 0 0">${esc(codigo)}</pre>`,
      botones: [[bi('Copiar', 'Copy'), null, 'id="wcopy"'], [bi('Ver cómo queda', 'See how it looks'), `${APP_URL}/widget/${BIZ.id}`, 'target="_blank" rel="noopener"']],
    }),
  ].filter(Boolean);
  v.innerHTML = `
    <div class="page-head"><h1>${esc(bi('Más herramientas', 'More tools'))}</h1></div>
    <p class="muted" style="max-width:640px">${esc(bi('Herramientas opcionales: activa las que te sirvan. Las que uses suben a la pantalla principal de tu negocio.', 'Optional tools: turn on the ones that help. The ones you use move up to your business’s main screen.'))}</p>
    <div class="fiel-lista" style="display:grid;gap:12px;max-width:820px">${tarjetas.join('')}</div>`;
  const copiar = $('#wcopy', v);
  if (copiar) {
    copiar.onclick = async () => {
      try { await navigator.clipboard.writeText(codigo); } catch { toast(bi('No se ha podido copiar', "Couldn't copy"), true); return; }
      toast(bi('Código copiado', 'Code copied'));
    };
  }
};
