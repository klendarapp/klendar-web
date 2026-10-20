/* Administración → «Crecer» (crecer, 2026-10-14; migración
 * 20261218100000_crecer de la app).
 *
 * - «Locales pedidos» (#/pedidos, #/pedidos/<id>): los sitios que la gente
 *   pide que estén en Klendar, agrupados (mismo nombre o muy parecido y
 *   cerca). Pestañas Abiertos / Enlazados / Descartados con sus cuentas,
 *   filtro por ciudad o zona y buscador; por ciudad y, dentro, por número
 *   («N personas lo piden»). Sin personas: solo cuántas y los nombres con que
 *   lo escriben. Acciones: «Preparar carta» (el mensaje de captación ya
 *   escrito, Copiar y «Carta para imprimir (PDF)», /admin/carta.html),
 *   «Enlazar con un negocio…» (al enlazarlo, si el negocio ya sale, se avisa
 *   a quien lo pidió) y en «Más acciones»: unir con otro, renombrar,
 *   descartar o reabrir y quitar el enlace.
 * - En la ficha de un negocio (`businessDetail` de admin.js): «Locales
 *   pedidos que pueden ser este» con «Enlazar» (`pedidosEnFicha`).
 * - «Dónde crecer» (#/crecer): el ranking de zonas donde esperan a Klendar
 *   (`admin_city_waitlist`) con «Activar ciudad…» y «Avisar ahora» (los dos
 *   avisan a gente: no tienen vuelta atrás, se confirman), y debajo las
 *   ciudades de Klendar con Encender / Apagar.
 *
 * Va después de admin.js y artistas.js y usa lo suyo (`PAGES`, `rpc`, `$`,
 * `$$`, `esc`, `ms`, `modal`, `confirmDlg`, `table`, `toast`, `esperando`,
 * `params`, `ponUrl`, `menuAcciones`, `itemMenu`, `enlaceMenu`, `debounce`,
 * `downloadCsv`, `helpBox`, `fmtNum`, `fmtDay`, `fmtDate`, `ago`, `bi`,
 * `APP_URL`, `go`, `route`).
 */
'use strict';

const CR = { estado: 'open', ciudad: '', q: '' };
const CR_ESTADOS = [['open', () => bi('Abiertos', 'Open')], ['linked', () => bi('Enlazados', 'Linked')], ['dismissed', () => bi('Descartados', 'Dismissed')]];
const crPersonas = (n) => bi(Number(n) === 1 ? '1 persona lo pide' : `${fmtNum(n)} personas lo piden`, Number(n) === 1 ? '1 person wants it' : `${fmtNum(n)} people want it`);
const crDonde = (g) => g.city_name || g.area || '—';
const crEstado = (g) => (g.status === 'linked'
  ? `<span class="tag ok">${esc(bi('Enlazado', 'Linked'))}</span>${g.business_live === false ? ` <span class="tag warn">${esc(bi('aún no sale', 'not live yet'))}</span>` : ''}`
  : g.status === 'dismissed' ? `<span class="tag dim">${esc(bi('Descartado', 'Dismissed'))}</span>`
    : `<span class="tag dim">${esc(bi('Abierto', 'Open'))}</span>`);
const CR_ERR = {
  business_not_found: () => bi('Ese negocio ya no existe.', 'That business no longer exists.'),
  same_group: () => bi('Es el mismo sitio.', "It's the same place."),
  invalid_name: () => bi('El nombre tiene que tener al menos 2 letras, sin correos, enlaces ni teléfonos.', 'The name needs at least 2 letters, with no emails, links or phone numbers.'),
  invalid_city_id: () => bi('El identificador va en minúsculas, sin espacios ni tildes (2 a 32 letras): «teruel», «sansebastian».', 'The id is lowercase letters only, no spaces or accents (2 to 32): “teruel”, “sansebastian”.'),
  invalid_point: () => bi('La latitud o la longitud no valen.', "The latitude or longitude isn't valid."),
  invalid_zone: () => bi('Esa zona no vale.', "That area isn't valid."),
};
/** Un error de las RPC de crecer, en cristiano. */
const crError = (e) => {
  const m = String(e?.message || '');
  for (const [k, txt] of Object.entries(CR_ERR)) if (m.includes(k)) return txt();
  return m || bi('No se ha podido completar. Prueba otra vez.', "Couldn't complete it. Try again.");
};

// ── La carta ────────────────────────────────────────────────────────────────
/** El mensaje de captación (en español: va a negocios de aquí). Sin precios,
 * sin cifras de usuarios, sin «te traemos clientes» y nunca quién lo pidió
 * (docs/negocios/correos.md de la app). */
function crCarta(g) {
  const n = Number(g.people) || 0;
  const titulo = n === 1 ? `Una persona ha pedido verte en Klendar` : `${fmtNum(n)} personas han pedido verte en Klendar`;
  const quien = n === 1 ? `Una persona ha pedido` : `${fmtNum(n)} personas han pedido`;
  const donde = crDonde(g) !== '—' ? ` (${crDonde(g)})` : '';
  // Una sola plantilla (sin comillas): la carta va siempre en español.
  const texto = `${titulo}

Hola:

${quien} en Klendar que ${g.name} esté en la app${donde}. Por privacidad no compartimos quién lo pide: solo contamos cuántas personas son.

Klendar es una app y una web donde los negocios de cada ciudad publican ofertas flash con cuenta atrás y eventos con reserva de plaza. La gente los descubre por cercanía y los canjea con un código QR de un solo uso que validas con tu móvil. Darte de alta lleva unos minutos y te echamos una mano.

Lo pruebas gratis, sin tarjeta, y nunca cobramos comisión por canje. Sin permanencia.

Si te interesa, entra en klendar.app/para-negocios o contesta a este mensaje. Si no, no te volveremos a escribir.

Un saludo,
Iván · Klendar
info@klendar.app · klendar.app/para-negocios`;
  return { titulo, texto };
}
/** La página imprimible (A4) de la carta: solo el número, el sitio y la zona. */
const crCartaUrl = (g) => `/admin/carta.html?${new URLSearchParams({ n: String(Number(g.people) || 0), local: g.name || '', zona: crDonde(g) === '—' ? '' : crDonde(g) })}`;

function crPreparaCarta(g) {
  const d = $('#modal');
  const { texto } = crCarta(g);
  d.classList.add('ancho');
  d.innerHTML = `<form method="dialog">
    <h2>${esc(bi(`Carta para «${g.name}»`, `Letter for “${g.name}”`))}</h2>
    <div class="warn">${bi('<b>Solo a quien te ha dado su contacto o en mano.</b> Un correo o un WhatsApp comercial que no se ha pedido está prohibido, también a una empresa (LSSI, art. 21). Lo más fácil: imprime la carta y llévala al local.',
      "<b>Only to someone who gave you their contact details, or by hand.</b> An unsolicited commercial email or WhatsApp is forbidden, even to a business (Spain's LSSI, art. 21). Easiest: print the letter and take it to the venue.")}</div>
    <label class="f ancho"><span>${esc(bi('El mensaje (en español)', 'The message (in Spanish)'))}</span><textarea id="crCartaTxt" rows="14" readonly>${esc(texto)}</textarea></label>
    <p class="muted small" style="margin:0">${esc(bi('Nunca lleva quién lo pidió: solo cuántas personas son.', 'It never says who asked: only how many people.'))}</p>
    <div class="foot"><button type="button" class="btn ghost" data-cancel>${esc(bi('Cerrar', 'Close'))}</button>
      <a class="btn" href="${esc(crCartaUrl(g))}" target="_blank" rel="noopener">${ms('print')} ${esc(bi('Carta para imprimir (PDF)', 'Printable letter (PDF)'))}</a>
      <button type="submit" class="btn primary">${ms('content_copy')} ${esc(bi('Copiar', 'Copy'))}</button></div>
  </form>`;
  const cerrar = () => { d.classList.remove('ancho'); d.close(); };
  $('[data-cancel]', d).onclick = cerrar;
  d.oncancel = (e) => { e.preventDefault(); cerrar(); };
  $('form', d).onsubmit = async (e) => {
    e.preventDefault();
    try { await navigator.clipboard.writeText(texto); toast(bi('Copiada', 'Copied')); } catch {
      const ta = $('#crCartaTxt', d); ta.focus(); ta.select();
      toast(bi('Seleccionada: cópiala con Ctrl+C', 'Selected: copy it with Ctrl+C'));
    }
  };
  d.showModal();
}

// ── Buscar y elegir (negocio o grupo) ───────────────────────────────────────
/** Una ventana con un buscador y una lista para elegir uno. `busca(q)` →
 * filas; `fila(x)` → { titulo, sub }. Devuelve la fila elegida o null. */
function crElige({ titulo, intro = '', placeholder, busca, fila, boton, vacio }) {
  return new Promise((resolve) => {
    const d = $('#modal');
    d.classList.add('ancho');
    d.innerHTML = `<form method="dialog">
      <h2>${esc(titulo)}</h2>
      ${intro ? `<p class="muted" style="margin:0">${intro}</p>` : ''}
      <label class="f ancho"><span>${esc(bi('Buscar', 'Search'))}</span><input id="crBusca" type="search" autocomplete="off" placeholder="${esc(placeholder)}"></label>
      <div id="crRes" class="cr-res" aria-live="polite"></div>
      <div class="foot"><button type="button" class="btn ghost" data-cancel>${esc(bi('Cancelar', 'Cancel'))}</button></div>
    </form>`;
    let filas = [];
    const cerrar = (v) => { d.classList.remove('ancho'); d.close(); resolve(v); };
    $('[data-cancel]', d).onclick = () => cerrar(null);
    d.oncancel = (e) => { e.preventDefault(); cerrar(null); };
    $('form', d).onsubmit = (e) => e.preventDefault();
    const pinta = async () => {
      const q = $('#crBusca', d).value.trim();
      try { filas = (await busca(q)) || []; } catch (e) { $('#crRes', d).innerHTML = `<p class="err">${esc(crError(e))}</p>`; return; }
      $('#crRes', d).innerHTML = filas.length
        ? `<ul class="cr-lista">${filas.map((x, i) => { const f = fila(x); return `<li><span><b>${esc(f.titulo)}</b>${f.sub ? `<span class="sub">${esc(f.sub)}</span>` : ''}</span><button type="button" class="btn sm" data-i="${i}">${esc(boton)}</button></li>`; }).join('')}</ul>`
        : `<p class="muted">${esc(vacio)}</p>`;
      $$('[data-i]', d).forEach((b) => { b.onclick = () => cerrar(filas[Number(b.dataset.i)]); });
    };
    $('#crBusca', d).oninput = debounce(pinta, 300);
    d.showModal();
    $('#crBusca', d).focus();
    pinta();
  });
}

const crBuscaNegocios = (q) => rpc('admin_businesses_page', { p_status: 'all', p_query: q || null, p_plan: 'all', p_active: null, p_sort: q ? 'name' : 'created_desc', p_limit: 12, p_offset: 0 }).then((r) => r?.rows || []);

/** Enlazar un grupo con un negocio (avisa a quien lo pidió si ya sale). */
async function crEnlaza(g, negocio) {
  const b = negocio || await crElige({
    titulo: bi(`Enlazar «${g.name}» con un negocio`, `Link “${g.name}” to a business`),
    intro: esc(bi('El negocio que se ha dado de alta y es este sitio.', 'The business that has signed up and is this place.')),
    placeholder: bi('Nombre, ciudad o id del negocio…', 'Business name, city or id…'),
    busca: crBuscaNegocios,
    fila: (x) => ({ titulo: x.name, sub: [x.category, x.city, x.address, LABELS[x.verification_status] || x.verification_status].filter(Boolean).join(' · ') }),
    boton: bi('Enlazar', 'Link'),
    vacio: bi('Ningún negocio con eso.', 'No business matches.'),
  });
  if (!b) return false;
  const n = Number(g.people) || 0;
  if (!await confirmDlg(bi('¿Enlazar?', 'Link?'), esc(bi(
    `«${g.name}» quedará enlazado con «${b.name}». Si el negocio ya sale en Klendar (verificado y activo), se avisa ahora a ${n === 1 ? 'la persona que lo pidió' : `las ${n} personas que lo pidieron`} («${b.name} ya está en Klendar», según sus preferencias); si no, en cuanto salga. Los avisos no se pueden retirar.`,
    `“${g.name}” will be linked to “${b.name}”. If the business is already live on Klendar (verified and active), ${n === 1 ? 'the person who asked' : `the ${n} people who asked`} get a notice now (“${b.name} is now on Klendar”, depending on their settings); otherwise, as soon as it goes live. Notices can't be taken back.`)),
  { submit: bi('Enlazar', 'Link') })) return false;
  try {
    const r = await rpc('admin_link_venue_request', { p_group: g.id, p_business: b.id });
    toast(r?.business_live
      ? bi(`Enlazado. Avisadas ahora: ${fmtNum(r.notified_now || 0)}.`, `Linked. Notified now: ${fmtNum(r.notified_now || 0)}.`)
      : bi('Enlazado. Se avisará en cuanto el negocio salga en Klendar.', 'Linked. People will be told as soon as the business goes live.'));
    return true;
  } catch (e) { toast(crError(e), true); return false; }
}

/** Unir con otro grupo que es el mismo sitio: se elige cuál se queda. */
async function crUne(g) {
  const otro = await crElige({
    titulo: bi(`Unir «${g.name}» con otro`, `Merge “${g.name}” with another`),
    intro: esc(bi('Si es el mismo sitio pedido con otro nombre. Quien lo pidió en los dos cuenta una vez.', 'If it is the same place asked for under another name. Anyone who asked in both counts once.')),
    placeholder: bi('Nombre del sitio…', 'Name of the place…'),
    busca: (q) => rpc('admin_venue_requests', { p_status: null, p_city: null, p_q: q || g.name.split(/\s+/)[0] || null, p_limit: 20, p_offset: 0 })
      .then((r) => (r?.items || []).filter((x) => x.id !== g.id && x.status !== 'dismissed')),
    fila: (x) => ({ titulo: x.name, sub: `${crDonde(x)} · ${crPersonas(x.people)}${x.status === 'linked' ? ` · ${bi('enlazado', 'linked')}` : ''}` }),
    boton: bi('Elegir', 'Choose'),
    vacio: bi('Ningún otro sitio pedido con eso.', 'No other requested place matches.'),
  });
  if (!otro) return false;
  const r = await modal({
    title: bi('¿Cuál se queda?', 'Which one stays?'),
    intro: esc(bi('El otro pasa a este (con su gente y sus nombres) y deja de salir en la lista.', 'The other one moves into this one (with its people and names) and leaves the list.')),
    fields: [{ name: 'queda', label: bi('Se queda', 'Keep'), type: 'select', value: otro.status === 'linked' ? otro.id : g.id,
      options: [[g.id, `${g.name} · ${crDonde(g)} · ${crPersonas(g.people)}`], [otro.id, `${otro.name} · ${crDonde(otro)} · ${crPersonas(otro.people)}`]] }],
    submit: bi('Unir', 'Merge'),
  });
  if (!r) return false;
  const into = r.queda === otro.id ? otro : g;
  const from = into === g ? otro : g;
  try {
    const x = await rpc('admin_merge_venue_requests', { p_from: from.id, p_into: into.id });
    toast(bi(`Unidos: ${crPersonas(x?.people ?? 0)}.`, `Merged: ${crPersonas(x?.people ?? 0)}.`));
    return into.id;
  } catch (e) { toast(crError(e), true); return false; }
}

async function crRenombra(g) {
  const r = await modal({ title: bi('Renombrar', 'Rename'), intro: esc(bi('El nombre con que se ve y se agrupa (por ejemplo, el de su rótulo).', 'The name it shows and groups by (for example, the one on its sign).')),
    fields: [{ name: 'nombre', label: bi('Nombre', 'Name'), value: g.name, required: true }], submit: bi('Guardar', 'Save') });
  if (!r) return false;
  try { await rpc('admin_rename_venue_request', { p_group: g.id, p_name: r.nombre }); toast(bi('Guardado', 'Saved')); return true; } catch (e) { toast(crError(e), true); return false; }
}

async function crDescarta(g) {
  if (g.status === 'dismissed') {
    if (!await confirmDlg(bi('¿Reabrir?', 'Reopen?'), esc(bi('Vuelve a la lista de abiertos y la gente lo verá otra vez como «Esperando».', 'It goes back to the open list and people will see it as “Waiting” again.')), { submit: bi('Reabrir', 'Reopen') })) return false;
    try { await rpc('admin_dismiss_venue_request', { p_group: g.id, p_reason: null, p_reopen: true }); toast(bi('Reabierto', 'Reopened')); return true; } catch (e) { toast(crError(e), true); return false; }
  }
  const r = await modal({ title: bi(`Descartar «${g.name}»`, `Dismiss “${g.name}”`),
    intro: esc(bi('No es un sitio, ya cerró o no encaja en Klendar. Quien lo pidió lo verá como «No va a estar» (no se le avisa).', "It isn't a real place, has closed or doesn't fit Klendar. Whoever asked will see it as “Won't be on Klendar” (they aren't notified).")),
    fields: [{ name: 'motivo', label: bi('Motivo (solo para administración)', 'Reason (admin only)'), type: 'textarea' }], submit: bi('Descartar', 'Dismiss'), danger: true });
  if (!r) return false;
  try { await rpc('admin_dismiss_venue_request', { p_group: g.id, p_reason: r.motivo || null, p_reopen: false }); toast(bi('Descartado', 'Dismissed')); return true; } catch (e) { toast(crError(e), true); return false; }
}

async function crDesenlaza(g) {
  if (!await confirmDlg(bi('¿Quitar el enlace?', 'Remove the link?'), esc(bi('Vuelve a abiertos. Los avisos que ya salieron, salieron.', 'It goes back to open. Notices already sent stay sent.')), { submit: bi('Quitar el enlace', 'Remove the link'), danger: true })) return false;
  try { await rpc('admin_unlink_venue_request', { p_group: g.id }); toast(bi('Enlace quitado', 'Link removed')); return true; } catch (e) { toast(crError(e), true); return false; }
}

/** Lo que hace cada botón o elemento de menú (`data-cr="accion"`) de `g`. */
async function crAccion(accion, g, tras) {
  let hecho = false;
  if (accion === 'carta') { crPreparaCarta(g); return; }
  if (accion === 'enlazar') hecho = await crEnlaza(g);
  else if (accion === 'unir') {
    const queda = await crUne(g);
    if (queda && queda !== g.id && currentRoute()[1] === g.id) { go(`#/pedidos/${queda}`); return; }
    hecho = Boolean(queda);
  } else if (accion === 'renombrar') hecho = await crRenombra(g);
  else if (accion === 'descartar' || accion === 'reabrir') hecho = await crDescarta(g);
  else if (accion === 'desenlazar') hecho = await crDesenlaza(g);
  if (hecho) tras();
}

const crMenu = (g, sm = false) => menuAcciones([
  g.status === 'linked' ? '' : itemMenu('data-cr="enlazar"', esc(bi('Enlazar con un negocio…', 'Link to a business…'))),
  itemMenu('data-cr="unir"', esc(bi('Unir con otro…', 'Merge with another…'))),
  itemMenu('data-cr="renombrar"', esc(bi('Renombrar…', 'Rename…'))),
  '-',
  g.status === 'linked' ? itemMenu('data-cr="desenlazar"', esc(bi('Quitar el enlace…', 'Remove the link…')), { peligro: true }) : '',
  g.status === 'dismissed' ? itemMenu('data-cr="reabrir"', esc(bi('Reabrir…', 'Reopen…')))
    : itemMenu('data-cr="descartar"', esc(bi('Descartar…', 'Dismiss…')), { peligro: true }),
], { label: bi('Más acciones', 'More actions'), icono: sm, sm });

// ── Locales pedidos ─────────────────────────────────────────────────────────
PAGES.pedidos = async (v, id) => {
  if (id) return crDetalle(v, id);
  const p = params();
  if (CR_ESTADOS.some(([k]) => k === p.estado)) CR.estado = p.estado;
  if (p.ciudad != null) CR.ciudad = p.ciudad;
  const aUrl = () => ponUrl('pedidos', { estado: CR.estado === 'open' ? null : CR.estado, ciudad: CR.ciudad || null });
  aUrl();
  v.innerHTML = `
    <div class="page-head"><h1>${esc(bi('Locales pedidos', 'Requested places'))}</h1><span class="spacer"></span><button class="btn sm ghost" id="crCsv">${esc(bi('Exportar CSV', 'Export CSV'))}</button></div>
    ${helpBox(bi('¿Qué es esto?', 'What is this?'), bi(
      `<p>Los sitios que la gente pide que estén en Klendar («Pedir un local», en la app y en la web: al buscar algo que no está o desde su cuenta). Se agrupan solos si tienen el mismo nombre (o muy parecido) y están cerca; si dos son el mismo, <b>Únelos</b>. La lista va por ciudad y, dentro, por cuánta gente lo pide: son los negocios a los que ir primero.</p>
       <p><b>Preparar carta</b> deja escrito el mensaje para el negocio y una carta para imprimir. <b>Enlazar</b> cuando ese sitio se dé de alta: quien lo pidió recibe «[Local] ya está en Klendar» en cuanto el negocio salga (verificado y activo). <b>Descartar</b> si no es un sitio o ya cerró: lo verán como «No va a estar».</p>
       <p><b>Privacidad</b>: aquí nunca sale quién lo pide, solo cuántas personas y los nombres con que lo escriben. El negocio, tampoco: solo el número. No lo cuentes de otra forma.</p>`,
      `<p>Places people ask to see on Klendar (“Ask for a place”, in the app and on the website: when a search finds nothing or from their account). They group automatically when the name is the same (or very similar) and they are close; if two are the same place, <b>Merge</b> them. The list goes by city and, within it, by how many people ask: those are the businesses to visit first.</p>
       <p><b>Prepare letter</b> writes the message for the business and a printable letter. <b>Link</b> it when the place signs up: whoever asked gets “[Place] is now on Klendar” as soon as the business is live (verified and active). <b>Dismiss</b> it if it isn't a real place or has closed: they'll see “Won't be on Klendar”.</p>
       <p><b>Privacy</b>: who asks never shows here, only how many people and the names they type. The business doesn't see it either: just the number. Don't share it any other way.</p>`))}
    <div class="tabs" id="crTabs"></div>
    <div class="toolbar"><input id="q" class="grow" type="search" placeholder="${esc(bi('Buscar por nombre…', 'Search by name…'))}" aria-label="${esc(bi('Buscar locales pedidos', 'Search requested places'))}" value="${esc(CR.q)}">
      <select id="crCiudad" aria-label="${esc(bi('Ciudad o zona', 'City or area'))}"></select></div>
    <div id="list"><div class="loading">${esc(bi('Cargando…', 'Loading…'))}</div></div>`;
  let filas = [];
  const load = async () => {
    const r = await rpc('admin_venue_requests', { p_status: CR.estado, p_city: CR.ciudad || null, p_q: CR.q || null, p_limit: 200, p_offset: 0 });
    filas = r?.items || [];
    const c = r?.counts || {};
    $('#crTabs').innerHTML = CR_ESTADOS.map(([k, nombre]) => `<button type="button" data-t="${k}" class="${CR.estado === k ? 'on' : ''}" aria-pressed="${CR.estado === k}">${esc(nombre())} <span class="muted">${fmtNum(c[k] || 0)}</span></button>`).join('');
    $$('#crTabs button').forEach((b) => { b.onclick = () => { CR.estado = b.dataset.t; aUrl(); load(); }; });
    const ciudades = r?.cities || [];
    const sel = $('#crCiudad');
    sel.innerHTML = `<option value="">${esc(bi('Todas las ciudades y zonas', 'All cities and areas'))}</option>${ciudades.map((x) => `<option value="${esc(x.id || '')}"${String(x.id || '') === CR.ciudad ? ' selected' : ''}>${esc(x.name)} (${fmtNum(x.people)})</option>`).join('')}${CR.ciudad && !ciudades.some((x) => String(x.id) === CR.ciudad) ? `<option value="${esc(CR.ciudad)}" selected>${esc(CR.ciudad)}</option>` : ''}`;
    $('#list').innerHTML = `${CR.estado === 'open' && c.people_open ? `<p class="muted small" style="margin:0 0 10px">${esc(bi(`${fmtNum(c.people_open)} peticiones en ${fmtNum(c.open || 0)} sitios abiertos.`, `${fmtNum(c.people_open)} requests across ${fmtNum(c.open || 0)} open places.`))}</p>` : ''}${table({
      cols: [
        { h: bi('Local', 'Place'), r: (g) => `<a class="link title" href="#/pedidos/${esc(g.id)}">${esc(g.name)}</a>${g.business_name ? `<span class="sub">→ ${esc(g.business_name)}</span>` : ''}` },
        { h: bi('Ciudad o zona', 'City or area'), r: (g) => esc(crDonde(g)) },
        { h: bi('Lo piden', 'Asked by'), num: true, r: (g) => `<b>${fmtNum(g.people)}</b> <span class="muted small">${esc(bi(Number(g.people) === 1 ? 'persona' : 'personas', Number(g.people) === 1 ? 'person' : 'people'))}</span>` },
        { h: bi('Último', 'Latest'), r: (g) => `<span class="nowrap">${esc(ago(g.last_request_at))}</span>` },
        { h: bi('Estado', 'Status'), r: (g) => crEstado(g) },
        { h: '', r: (g, i) => `<div class="actions cr-acciones" data-fila="${i}">${g.status === 'dismissed' ? '' : `<button type="button" class="btn sm" data-cr="carta">${esc(bi('Preparar carta', 'Prepare letter'))}</button>`}${crMenu(g, true)}</div>` },
      ],
      rows: filas,
      empty: CR.q || CR.ciudad ? bi('Nada con esos filtros.', 'Nothing with those filters.')
        : CR.estado === 'open' ? bi('Nadie ha pedido ningún sitio todavía.', 'Nobody has asked for a place yet.') : bi('Ninguno.', 'None.'),
    })}`;
    $$('#list [data-fila]').forEach((caja) => {
      const g = filas[Number(caja.dataset.fila)];
      $$('[data-cr]', caja).forEach((b) => { b.onclick = () => esperando(b, () => crAccion(b.dataset.cr, g, load)); });
    });
  };
  $('#q').oninput = debounce(() => { CR.q = $('#q').value.trim(); load(); });
  $('#crCiudad').onchange = () => { CR.ciudad = $('#crCiudad').value; aUrl(); load(); };
  $('#crCsv').onclick = () => downloadCsv('locales-pedidos', filas, [['name', bi('local', 'place')], [(g) => crDonde(g), bi('ciudad o zona', 'city or area')], ['people', bi('personas', 'people')], ['status', bi('estado', 'status')], ['business_name', bi('negocio', 'business')], ['last_request_at', bi('último', 'latest')], ['created_at', bi('primero', 'first')]]);
  await load();
};

async function crDetalle(v, id) {
  const g = await rpc('admin_venue_request_detail', { p_group: id });
  if (!g) throw new Error(bi('Ese sitio pedido no existe (o se ha unido con otro).', "That requested place doesn't exist (or was merged into another)."));
  const nombres = g.names || [];
  const lista = (xs) => (xs.length ? `<ul class="cr-nombres">${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">—</p>');
  v.innerHTML = `
    <div class="page-head"><a class="btn sm ghost" href="#/pedidos">← ${esc(bi('Locales pedidos', 'Requested places'))}</a></div>
    <div class="detail-head">
      <div class="ph">${ms('add_business')}</div>
      <div><h1>${esc(g.name)}</h1><div class="tags">${crEstado(g)} <span class="tag dim">${esc(crPersonas(g.people))}</span></div></div>
      <span class="spacer"></span>
      <div class="actions">
        ${g.status === 'dismissed' ? '' : `<button class="btn" data-cr="carta">${esc(bi('Preparar carta', 'Prepare letter'))}</button>`}
        ${g.status === 'linked' && g.business_id ? `<a class="btn" href="#/negocios/${esc(g.business_id)}">${esc(bi('Ver el negocio', 'See the business'))}</a>`
          : g.status === 'open' ? `<button class="btn" data-cr="enlazar">${esc(bi('Enlazar con un negocio…', 'Link to a business…'))}</button>` : `<button class="btn" data-cr="reabrir">${esc(bi('Reabrir…', 'Reopen…'))}</button>`}
        ${crMenu(g)}
      </div>
    </div>
    <div class="grid2">
      <div class="card"><h2>${esc(bi('Datos', 'Details'))}</h2><dl class="kv">
        <dt>${esc(bi('Ciudad o zona', 'City or area'))}</dt><dd>${esc(crDonde(g))}</dd>
        <dt>${esc(bi('Lo piden', 'Asked by'))}</dt><dd>${esc(crPersonas(g.people))}</dd>
        <dt>${esc(bi('Primera petición', 'First request'))}</dt><dd>${fmtDate(g.created_at)}</dd>
        <dt>${esc(bi('Última', 'Latest'))}</dt><dd>${fmtDate(g.last_request_at)}</dd>
        <dt>${esc(bi('Punto del local', "Place's location"))}</dt><dd>${g.lat != null ? `<a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${Number(g.lat)},${Number(g.lng)}">${esc(bi('ver en el mapa', 'see on the map'))} ↗</a>` : '—'}</dd>
        ${g.business_id ? `<dt>${esc(bi('Negocio', 'Business'))}</dt><dd><a class="link" href="#/negocios/${esc(g.business_id)}">${esc(g.business_name || g.business_id)}</a> ${g.business_live ? `<span class="tag ok">${esc(bi('sale en Klendar', 'live'))}</span>` : `<span class="tag warn">${esc(bi('aún no sale', 'not live yet'))}</span>`}</dd>
          <dt>${esc(bi('Avisos', 'Notices'))}</dt><dd>${esc(bi(`${fmtNum(g.notified || 0)} enviados · ${fmtNum(g.pending_notices || 0)} pendientes`, `${fmtNum(g.notified || 0)} sent · ${fmtNum(g.pending_notices || 0)} pending`))}</dd>` : ''}
        ${g.dismissed_reason ? `<dt>${esc(bi('Motivo del descarte', 'Reason for dismissing'))}</dt><dd>${esc(g.dismissed_reason)}</dd>` : ''}
      </dl></div>
      <div class="card"><h2>${esc(bi('Cómo lo piden', 'How people ask for it'))}</h2>
        <p class="muted small">${esc(bi('Los nombres con que lo escriben y cuántas veces. Sin personas.', 'The names people type and how many times. No people.'))}</p>
        ${nombres.length ? `<ul class="cr-nombres">${nombres.map((x) => `<li>${esc(x.name)} <span class="muted">× ${fmtNum(x.count)}</span></li>`).join('')}</ul>` : '<p class="muted">—</p>'}
        <h3 style="margin-top:12px">${esc(bi('Direcciones que escriben', 'Addresses typed'))}</h3>${lista(g.addresses || [])}
        <h3 style="margin-top:12px">${esc(bi('Ciudades o zonas que escriben', 'Cities or areas typed'))}</h3>${lista(g.places || [])}
      </div>
    </div>`;
  $$('[data-cr]', v).forEach((b) => { b.onclick = () => esperando(b, () => crAccion(b.dataset.cr, g, () => route())); });
}

// ── En la ficha de un negocio ───────────────────────────────────────────────
/** «Locales pedidos que pueden ser este» (nombre parecido y cerca), con
 * «Enlazar». Lo llama `businessDetail` (admin.js) en su hueco `#crecerPedidos`. */
async function pedidosEnFicha(v, b) {
  const caja = v.querySelector('#crecerPedidos');
  if (!caja) return;
  let filas = [];
  try { filas = (await rpc('admin_venue_request_matches', { p_business: b.id })) || []; } catch { filas = []; }
  if (!filas.length || !caja.isConnected) { caja.remove(); return; }
  caja.className = 'card';
  caja.innerHTML = `<h2>${esc(bi('Locales pedidos que pueden ser este', 'Requested places that may be this one'))}</h2>
    <p class="muted small" style="margin:0 0 8px">${esc(bi('Gente que pidió en Klendar un sitio con un nombre parecido, cerca. Al enlazarlo, cuando el negocio salga se les avisa.', 'People who asked on Klendar for a place with a similar name, nearby. Once linked, they are told when the business goes live.'))}</p>
    ${table({
      cols: [
        { h: bi('Local pedido', 'Requested place'), r: (g) => `<a class="link title" href="#/pedidos/${esc(g.id)}">${esc(g.name)}</a>` },
        { h: bi('Ciudad o zona', 'City or area'), r: (g) => esc(crDonde(g)) },
        { h: bi('Lo piden', 'Asked by'), num: true, r: (g) => fmtNum(g.people) },
        { h: '', r: (g, i) => (g.linked_here ? `<span class="tag ok">${esc(bi('Enlazado aquí', 'Linked here'))}</span>` : `<button type="button" class="btn sm" data-enlaza="${i}">${esc(bi('Enlazar', 'Link'))}</button>`) },
      ],
      rows: filas,
    })}`;
  $$('[data-enlaza]', caja).forEach((btn) => {
    btn.onclick = () => esperando(btn, async () => {
      if (await crEnlaza(filas[Number(btn.dataset.enlaza)], b)) pedidosEnFicha(v, b).catch(() => {});
    });
  });
  I18N.translate(caja);
}

// ── Dónde crecer ────────────────────────────────────────────────────────────
/** Un identificador de ciudad a partir de un nombre: «San Sebastián» → «sansebastian». */
/** La comunidad de la ciudad de Klendar más cercana (para proponerla al dar de alta una). */
const crRegionCerca = (C, lat, lng) => {
  const la = Number(lat), lo = Number(lng);
  const conReg = (C || []).filter((c) => c.region);
  if (!conReg.length || !Number.isFinite(la) || !Number.isFinite(lo)) return 'MD';
  return conReg.reduce((a, c) => ((c.lat - la) ** 2 + (c.lng - lo) ** 2 < (a.lat - la) ** 2 + (a.lng - lo) ** 2 ? c : a)).region;
};
const crIdCiudad = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 32);

PAGES.crecer = async (v) => {
  const [zonas, ciudades] = await Promise.all([rpc('admin_city_waitlist'), rpc('admin_klendar_cities')]);
  const Z = zonas || [];
  const C = ciudades || [];
  v.innerHTML = `
    <div class="page-head"><h1>${esc(bi('Dónde crecer', 'Where to grow'))}</h1></div>
    ${helpBox(bi('¿Qué es esto?', 'What is this?'), bi(
      `<p>Las zonas donde la gente ha pedido «Avísame cuando Klendar llegue» (en Descubre, cuando cerca no hay ningún negocio). Arriba, las que más gente esperan: confirmadas y aún sin avisar. Con cuenta cuenta ya; sin cuenta, solo cuando confirman el correo (lo que no se confirma se borra a los 7 días).</p>
       <p><b>Activar ciudad…</b> da de alta (o vuelve a encender) una ciudad de Klendar y avisa una sola vez, por notificación y por correo, a quien espera a menos de 40 km. <b>Avisar ahora</b> avisa solo a esa zona (por ejemplo, un barrio de una ciudad que ya está y donde ya hay negocios). Los dos <b>no tienen vuelta atrás</b>: hazlo cuando de verdad haya negocios publicando.</p>
       <p><b>Privacidad</b>: no se guarda la posición de nadie, solo la zona redondeada (unos 10 km) y su nombre; aquí no salen correos ni personas, solo cuántas.</p>`,
      `<p>Areas where people asked “Tell me when Klendar arrives” (in Discover, when there are no businesses nearby). At the top, those with the most people waiting: confirmed and not yet notified. With an account it counts straight away; without one, only after confirming the email (anything unconfirmed is deleted after 7 days).</p>
       <p><b>Activate city…</b> adds (or switches back on) a Klendar city and notifies once, by notification and email, everyone waiting within 40 km. <b>Notify now</b> only notifies that area (for example, a neighbourhood in a city that is already live and has businesses). Neither <b>can be undone</b>: do it when businesses are really posting.</p>
       <p><b>Privacy</b>: nobody's position is stored, only the rounded area (about 10 km) and its name; no emails or people show here, only how many.</p>`))}
    <div class="card"><h2>${esc(bi('Dónde esperan a Klendar', 'Where people are waiting for Klendar'))}</h2>
      <div id="crZonas"></div></div>
    <div class="card"><h2>${esc(bi('Ciudades de Klendar', 'Klendar cities'))}</h2>
      <p class="muted small" style="margin:0 0 8px">${esc(bi('Las que salen en las listas de ciudades (y desde las que se cuenta la zona de cada uno). Apagar una no borra nada.', 'The ones shown in city lists (and used to place each area). Switching one off deletes nothing.'))}</p>
      <div id="crCiudades"></div></div>`;
  const cerca = (z) => (z.nearest_city ? `${esc(z.nearest_city.name)} <span class="muted small">· ${fmtNum(z.nearest_city.km)} km</span> ${z.nearest_city.active ? `<span class="tag ok">${esc(bi('activa', 'live'))}</span>` : `<span class="tag dim">${esc(bi('apagada', 'off'))}</span>`}` : '—');
  $('#crZonas').innerHTML = table({
    cols: [
      { h: bi('Zona', 'Area'), r: (z) => `<span class="title">${esc(z.zone)}</span>${z.lat != null ? `<span class="sub">${String(z.lat).replace('.', ',')}, ${String(z.lng).replace('.', ',')}</span>` : ''}` },
      { h: bi('Esperando', 'Waiting'), num: true, r: (z) => `<b>${fmtNum(z.people)}</b><span class="sub">${esc(bi(`${fmtNum(z.accounts)} con cuenta · ${fmtNum(z.emails)} por correo`, `${fmtNum(z.accounts)} with account · ${fmtNum(z.emails)} by email`))}</span>` },
      { h: bi('Sin confirmar', 'Unconfirmed'), num: true, r: (z) => fmtNum(z.unconfirmed) },
      { h: bi('Ciudad de Klendar más cercana', 'Nearest Klendar city'), r: cerca },
      { h: bi('Negocios cerca', 'Businesses nearby'), num: true, r: (z) => fmtNum(z.businesses_near) },
      { h: bi('Último', 'Latest'), r: (z) => `<span class="nowrap">${esc(ago(z.last_at))}</span>` },
      { h: '', r: (z, i) => `<div class="actions cr-acciones"><button type="button" class="btn sm" data-activa="${i}">${esc(bi('Activar ciudad…', 'Activate city…'))}</button><button type="button" class="btn sm" data-avisa="${i}"${Number(z.people) > 0 ? '' : ' disabled'}>${esc(bi('Avisar ahora', 'Notify now'))}</button></div>` },
    ],
    rows: Z,
    empty: bi('Nadie espera a Klendar en ninguna zona todavía.', 'Nobody is waiting for Klendar anywhere yet.'),
  });
  $('#crCiudades').innerHTML = table({
    cols: [
      { h: bi('Ciudad', 'City'), r: (c) => `<span class="title">${esc(c.name)}</span><span class="sub"><code>${esc(c.id)}</code></span>` },
      { h: bi('Centro', 'Centre'), r: (c) => `<a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${Number(c.lat)},${Number(c.lng)}">${Number(c.lat).toFixed(3)}, ${Number(c.lng).toFixed(3)} ↗</a>` },
      { h: bi('Comunidad', 'Region'), r: (c) => (c.region ? esc(festCcaa(c.region)) : `<span class="tag warn">${esc(bi('sin comunidad', 'no region'))}</span>`) },
      { h: bi('Estado', 'Status'), r: (c) => (c.active ? `<span class="tag ok">${esc(bi('Encendida', 'On'))}</span>` : `<span class="tag dim">${esc(bi('Apagada', 'Off'))}</span>`) },
      { h: '', r: (c, i) => (c.active ? `<button type="button" class="btn sm" data-apaga="${i}">${esc(bi('Apagar…', 'Switch off…'))}</button>` : `<button type="button" class="btn sm" data-enciende="${i}">${esc(bi('Encender…', 'Switch on…'))}</button>`) },
    ],
    rows: C,
    empty: bi('No hay ciudades.', 'No cities.'),
  });

  /** Activar (o volver a encender) una ciudad: datos y luego confirmar. */
  const activa = async (pre, zona) => {
    const r = await modal({
      title: bi('Activar ciudad', 'Activate city'),
      intro: esc(bi('Una ciudad de Klendar: sale en las listas y, al activarla, se avisa a quien espera a menos de 40 km de este centro.', 'A Klendar city: it shows in lists and, when activated, everyone waiting within 40 km of this centre is notified.')),
      fields: [
        { name: 'id', label: bi('Identificador', 'Id'), value: pre.id, required: true, help: bi('minúsculas, sin espacios ni tildes', 'lowercase, no spaces or accents') },
        { name: 'name', label: bi('Nombre', 'Name'), value: pre.name, required: true },
        { name: 'lat', label: bi('Latitud del centro', 'Centre latitude'), type: 'number', step: 'any', value: pre.lat, required: true },
        { name: 'lng', label: bi('Longitud del centro', 'Centre longitude'), type: 'number', step: 'any', value: pre.lng, required: true },
        // Para los festivos (festivos.js): sin comunidad, sus negocios solo
        // reciben los nacionales.
        { name: 'region', label: bi('Comunidad autónoma', 'Region'), type: 'select', value: pre.region || crRegionCerca(C, pre.lat, pre.lng),
          options: FEST_CCAA.map(([c, n]) => [c, `${n} (${c})`]), help: bi('para los festivos', 'for public holidays') },
        { name: 'cp', label: bi('Código postal del municipio (primeras cifras)', 'Municipality postcode (first digits)'), value: pre.postal_prefix || '',
          placeholder: '440', help: bi('opcional: 440 para Teruel capital', 'optional: 440 for Teruel city') },
      ],
      submit: bi('Seguir', 'Continue'),
    });
    if (!r) return;
    const enZona = zona ? Number(zona.people) || 0 : 0;
    if (!await confirmDlg(bi(`¿Activar «${r.name}» y avisar?`, `Activate “${r.name}” and notify?`), esc(bi(
      `Se enciende la ciudad y se avisa una sola vez (notificación a quien tiene cuenta y correo a todos) a quien espera a menos de 40 km${zona ? `: solo en «${zona.zone}» son ${fmtNum(enZona)}` : ''}. Los avisos salen ya y no se pueden retirar.`,
      `The city goes live and everyone waiting within 40 km gets one notice (a notification if they have an account, and an email)${zona ? `: “${zona.zone}” alone has ${fmtNum(enZona)}` : ''}. Notices go out now and can't be taken back.`)),
    { submit: bi('Activar y avisar', 'Activate and notify') })) return;
    try {
      const x = await rpc('admin_activate_city', { p_id: crIdCiudad(r.id), p_name: r.name, p_lat: Number(String(r.lat).replace(',', '.')), p_lng: Number(String(r.lng).replace(',', '.')) });
      toast(bi(`Ciudad activada. Avisadas: ${fmtNum(x?.notified || 0)}.`, `City activated. Notified: ${fmtNum(x?.notified || 0)}.`));
      // Comunidad y código postal, y si le faltan los festivos locales.
      const f = await rpc('admin_set_city_holiday_info', { p_id: x?.id || crIdCiudad(r.id), p_region: r.region, p_postal_prefix: r.cp || null }).catch(() => null);
      const faltan = f?.holidays?.missing_years || [];
      if (!f?.ok) toast(bi('No se ha podido guardar la comunidad: ponla en Festivos.', "Couldn't save the region: set it in Public holidays."), true);
      else if (faltan.length) {
        const b = f.holidays.bulletin || {};
        if (await confirmDlg(bi(`A «${r.name}» le faltan los festivos locales`, `“${r.name}” has no local holidays`), `${esc(bi(
          `No tiene sus dos fiestas locales de ${faltan.join(' y ')}: hasta que estén, a sus negocios solo se les pregunta por los nacionales y los de su comunidad. Salen en el`,
          `It doesn't have its two local holidays for ${faltan.join(' and ')}: until they're added, its businesses are only asked about national and regional ones. They're published in the`))} ${b.url ? `<a class="link" target="_blank" rel="noopener" href="${esc(b.url)}">${esc(b.name || '')} ↗</a>` : esc(b.name || '')}.`,
        { submit: bi('Añadirlos ahora', 'Add them now') })) {
          location.hash = `#/festivos/${faltan[0]}`;
          return;
        }
      }
      route();
    } catch (e) { toast(crError(e), true); }
  };
  $$('[data-activa]', v).forEach((b) => {
    b.onclick = () => esperando(b, async () => {
      const z = Z[Number(b.dataset.activa)];
      const nc = z.nearest_city;
      // Si la más cercana es una ciudad apagada a menos de 30 km, es esa.
      const pre = nc && !nc.active && Number(nc.km) <= 30
        ? (() => { const c = C.find((x) => x.id === nc.id) || {}; return { id: nc.id, name: nc.name, lat: c.lat ?? z.lat, lng: c.lng ?? z.lng, region: c.region, postal_prefix: c.postal_prefix }; })()
        : { id: crIdCiudad(z.zone), name: z.zone, lat: z.lat, lng: z.lng };
      await activa(pre, z);
    });
  });
  $$('[data-avisa]', v).forEach((b) => {
    b.onclick = () => esperando(b, async () => {
      const z = Z[Number(b.dataset.avisa)];
      if (!await confirmDlg(bi(`¿Avisar ahora a «${z.zone}»?`, `Notify “${z.zone}” now?`), esc(bi(
        `Se avisa una sola vez a las ${fmtNum(z.people)} personas que esperan en esta zona («Klendar ya está en ${z.zone}»: notificación a quien tiene cuenta y correo a todos). Úsalo cuando ya haya negocios publicando aquí. No se puede deshacer.`,
        `The ${fmtNum(z.people)} people waiting in this area get one notice (“Klendar is now in ${z.zone}”: a notification if they have an account, and an email). Use it when businesses are already posting here. It can't be undone.`)),
      { submit: bi('Avisar ahora', 'Notify now') })) return;
      try {
        const x = await rpc('admin_notify_city_waitlist', { p_zone_key: z.zone_key });
        toast(bi(`Avisadas: ${fmtNum(x?.notified || 0)}.`, `Notified: ${fmtNum(x?.notified || 0)}.`));
        route();
      } catch (e) { toast(crError(e), true); }
    });
  });
  $$('[data-enciende]', v).forEach((b) => {
    b.onclick = () => esperando(b, async () => {
      const c = C[Number(b.dataset.enciende)];
      await activa({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, region: c.region, postal_prefix: c.postal_prefix }, null);
    });
  });
  $$('[data-apaga]', v).forEach((b) => {
    b.onclick = () => esperando(b, async () => {
      const c = C[Number(b.dataset.apaga)];
      if (!await confirmDlg(bi(`¿Apagar «${c.name}»?`, `Switch off “${c.name}”?`), esc(bi('Deja de salir en las listas de ciudades. No se borra nada y se puede volver a encender (al encenderla se avisa a quien espere).', "It stops showing in city lists. Nothing is deleted and it can be switched back on (switching it on notifies anyone waiting).")), { submit: bi('Apagar', 'Switch off'), danger: true })) return;
      try { await rpc('admin_deactivate_city', { p_id: c.id }); toast(bi('Apagada', 'Switched off')); route(); } catch (e) { toast(crError(e), true); }
    });
  });
};
