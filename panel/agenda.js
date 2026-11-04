/* Panel: «Conecta tu agenda» (#/agenda), como la pantalla de la app
   (`lib/features/entities/presentation/entity_calendar_screen.dart`,
   migración 20261260100400 de la app).

   La entidad pega la dirección iCal/ICS del calendario de su web y sus
   eventos entran solos en Klendar una vez al día. El estado (última lectura,
   cuántos eventos, el último error) y desconectar van por la base
   (`my_entity_calendars`, `entity_calendar_remove`…); probar, conectar y
   «Sincronizar ahora», por la Edge Function `entity-calendar`, que es la que
   lee la dirección (solo webs públicas, 10 s, 3 MB).

   Script clásico: comparte ámbito con panel.js. Los nombres de aquí empiezan
   por `cal`. */
'use strict';

Object.assign(SVG, {
  sincronizar: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
  agendaConectada: 'M17 10H7v2h10v-2zm2-7h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-5-5H7v2h7v-2z',
});

/** El texto de cada error (de la base o de la función). Los mismos que la app. */
const CAL_ERR = {
  invalid_url: () => bi('Esa dirección no parece válida. Copia el enlace iCal o ICS de tu calendario (empieza por https:// o webcal://).', "That address doesn't look valid. Copy your calendar's iCal or ICS link (it starts with https:// or webcal://)."),
  not_allowed_url: () => bi('Esa dirección no se puede usar: tiene que ser una web pública, sin usuario ni contraseña y sin direcciones internas.', "That address can't be used: it has to be a public website, with no username or password and no internal addresses."),
  unreachable: () => bi('No hemos podido conectar con esa web. Comprueba la dirección o prueba más tarde.', "We couldn't connect to that website. Check the address or try again later."),
  timeout: () => bi('Esa web tarda demasiado en responder (más de 10 segundos). Prueba más tarde.', 'That website takes too long to respond (more than 10 seconds). Try again later.'),
  not_found: () => bi('En esa dirección no hay nada (error 404). Vuelve a copiar el enlace del calendario.', "There's nothing at that address (error 404). Copy the calendar link again."),
  private: () => bi('El calendario no es público: la web pide usuario y contraseña. Usa el enlace público o la dirección secreta en formato iCal.', "The calendar isn't public: the website asks for a username and password. Use the public link or the secret address in iCal format."),
  http_error: () => bi('La web respondió con un error. Prueba más tarde.', 'The website responded with an error. Try again later.'),
  too_big: () => bi('El calendario es demasiado grande (más de 3 MB). Usa uno solo con los eventos públicos.', 'The calendar is too big (more than 3 MB). Use one with just the public events.'),
  html_page: () => bi('Esa dirección es una página web, no un calendario. Busca el enlace «iCal», «ICS» o «Exportar» y cópialo.', 'That address is a web page, not a calendar. Look for the “iCal”, “ICS” or “Export” link and copy it.'),
  feed_not_calendar: () => bi('Es un canal de noticias (RSS o Atom): sus fechas son las de publicación, no las de los eventos. Busca el enlace iCal o ICS de tu agenda.', "It's a news feed (RSS or Atom): its dates are publishing dates, not event dates. Look for your calendar's iCal or ICS link."),
  not_calendar: () => bi('Lo que hay en esa dirección no es un calendario iCal. Busca el enlace «iCal», «ICS» o «Exportar».', "What's at that address isn't an iCal calendar. Look for the “iCal”, “ICS” or “Export” link."),
  too_many_redirects: () => bi('La dirección redirige demasiadas veces. Copia el enlace final del calendario.', 'The address redirects too many times. Copy the final calendar link.'),
  already_connected: () => bi('Esa agenda ya está conectada.', 'That calendar is already connected.'),
  too_many: () => bi('Puedes conectar hasta 3 agendas.', 'You can connect up to 3 calendars.'),
  rate_limited: () => bi('Has probado muchas veces seguidas. Espera un poco.', "You've tried many times in a row. Wait a little."),
  sync_too_soon: () => bi('Acabas de sincronizarla: podrás volver a hacerlo dentro de unos minutos.', "You've just synced it: you can do it again in a few minutes."),
  sync_daily_limit: () => bi('Ya la has sincronizado 6 veces hoy. Mañana se vuelve a sincronizar sola.', "You've already synced it 6 times today. Tomorrow it syncs again on its own."),
  running: () => bi('Ya se está sincronizando. En un momento verás los cambios.', "It's already syncing. You'll see the changes in a moment."),
  calendar_off: () => bi('Muy pronto podrás conectar aquí la agenda de tu web.', "Very soon you'll be able to connect your website's calendar here."),
  entity_pending: () => bi('Podrás conectar tu agenda cuando comprobemos la entidad.', "You'll be able to connect your calendar once we've checked the organisation."),
  not_allowed: () => bi('Solo quien gestiona la entidad puede conectar o cambiar la agenda.', 'Only whoever manages the organisation can connect or change the calendar.'),
  not_entity: () => bi('Conectar una agenda es para las cuentas de entidad.', 'Connecting a calendar is for organisation accounts.'),
  incomplete: () => bi('No dio tiempo a leerla entera: sigue en la próxima vuelta.', "There wasn't time to read it all: it carries on next time."),
};
CAL_ERR.dns = CAL_ERR.unreachable;
CAL_ERR.account_suspended = CAL_ERR.not_allowed;
const calErr = (code) => (CAL_ERR[code] ? CAL_ERR[code]() : bi('Algo ha fallado. Prueba otra vez.', 'Something went wrong. Try again.'));

/** La Edge Function, con la sesión de quien llama. Devuelve `{ ok, … }`. */
async function calFn(body) {
  const { data, error } = await sb.functions.invoke('entity-calendar', { body });
  if (error) {
    let d = null;
    try { d = await error.context?.json(); } catch { /* sin cuerpo */ }
    return { ok: false, error: d?.error || 'server_error' };
  }
  return data || { ok: false, error: 'server_error' };
}

/** El estado de las agendas del negocio activo (null si falla). */
const calEstado = () => rpc('my_entity_calendars', { p_business: BIZ.id }).catch(() => null);

let CAL_VIGIA = null;

PAGES.agenda = async (v) => {
  clearTimeout(CAL_VIGIA);
  const c = await calEstado();
  if (!v.isConnected) return;
  if (!c || c.ok === false) throw new Error(c?.error || 'not_authorized');
  const items = c.items || [];
  const nota = (t) => `<p class="muted" style="text-align:center;margin:18px 0">${esc(t)}</p>`;
  const aviso = !c.enabled ? nota(calErr('calendar_off'))
    : c.block === 'entity_pending' ? nota(calErr('entity_pending'))
      : !c.can_edit && !items.length ? nota(calErr(c.block || 'not_allowed'))
        : !items.length ? nota(bi('Aún no has conectado ninguna agenda.', "You haven't connected a calendar yet.")) : '';
  v.innerHTML = `
    <div class="page-head"><h1>${esc(bi('Conecta tu agenda', 'Connect your calendar'))}</h1></div>
    ${helpBox(bi('¿Cómo funciona?', 'How does it work?'), `<p>${esc(bi(
    'Pega la dirección iCal o ICS del calendario que ya usas (Google Calendar, Outlook, la agenda de tu web…). Una vez al día leemos los eventos de los próximos 90 días (hasta 300) y los publicamos en tu nombre: lo que cambies o borres allí, se cambia o se borra aquí. Si editas un evento en Klendar, ese deja de actualizarse desde tu calendario; si lo borras, no vuelve. Lo que se repite entra una vez, con su próxima fecha. Sin lugar, sale en la dirección de la entidad.',
    "Paste the iCal or ICS address of the calendar you already use (Google Calendar, Outlook, your website's events…). Once a day we read the events for the next 90 days (up to 300) and publish them for you: whatever you change or delete there is changed or deleted here. If you edit an event in Klendar, it stops following your calendar; if you delete it, it doesn't come back. Repeating events come in once, with their next date. Without a place, they show at the organisation's address."))}</p>`)}
    ${aviso}
    <div style="display:grid;gap:12px;max-width:760px">${items.map((x) => calTarjeta(x, c)).join('')}</div>
    ${c.can_edit && items.length < (c.max || 3)
    ? `<p style="margin-top:16px"><button type="button" class="btn primary" id="calNueva">${esc(items.length ? bi('Conectar otra agenda', 'Connect another calendar') : bi('Conectar una agenda', 'Connect a calendar'))}</button></p>`
    : c.can_edit ? nota(bi('Puedes conectar hasta 3 agendas.', 'You can connect up to 3 calendars.')) : ''}`;

  const otraVez = () => { if (v.isConnected && currentRoute()[0] === 'agenda') PAGES.agenda(v); };
  const nueva = $('#calNueva', v);
  if (nueva) nueva.onclick = async () => { if (await calConectar()) otraVez(); };
  $$('[data-cal]', v).forEach((b) => {
    b.onclick = async () => {
      const x = items.find((i) => i.id === b.dataset.id);
      if (!x) return;
      const que = b.dataset.cal;
      b.disabled = true;
      try {
        if (que === 'sync') {
          const r = await calFn({ op: 'sync', calendar_id: x.id });
          if (!r.ok) { toast(calErr(r.error), true); return; }
          toast(bi('Sincronizando: en un momento verás los cambios.', "Syncing: you'll see the changes in a moment."));
        } else if (que === 'seguir') {
          if (!await confirmDlg(bi('Volver a seguirla', 'Follow it again'), esc(bi(
            'Lo que cambiaste en Klendar se pondrá como en tu calendario y lo que borraste volverá a entrar, en la próxima sincronización.',
            "What you changed in Klendar will go back to how it is in your calendar, and what you deleted will come back in, at the next sync.")),
          { submit: bi('Volver a seguirla', 'Follow it again') })) return;
          const r = await rpc('entity_calendar_follow_again', { p_calendar: x.id });
          if (r?.ok === false) { toast(calErr(r.error), true); return; }
          toast(bi('Hecho: en la próxima sincronización quedarán como en tu agenda.', "Done: at the next sync they'll be as they are in your calendar."));
        } else if (que === 'quitar') {
          const borrar = await calDesconectar();
          if (borrar === null) return;
          const r = await rpc('entity_calendar_remove', { p_calendar: x.id, p_remove_events: borrar });
          if (r?.ok === false) { toast(calErr(r.error), true); return; }
          const n = Number(r?.removed_events) || 0;
          toast(n === 0 ? bi('Agenda desconectada.', 'Calendar disconnected.')
            : n === 1 ? bi('Agenda desconectada y 1 evento borrado.', 'Calendar disconnected and 1 event deleted.')
              : bi(`Agenda desconectada y ${fmtNum(n)} eventos borrados.`, `Calendar disconnected and ${fmtNum(n)} events deleted.`));
        }
        otraVez();
      } catch (e) {
        toast(friendly(e.message), true);
      } finally {
        b.disabled = false;
      }
    };
  });
  $$('[data-cal-modo]', v).forEach((chk) => {
    chk.onchange = async () => {
      try {
        const r = await rpc('entity_calendar_set_mode', { p_calendar: chk.dataset.calModo, p_publish_mode: chk.checked ? 'publish' : 'draft' });
        if (r?.ok === false) { toast(calErr(r.error), true); chk.checked = !chk.checked; return; }
        toast(bi('Guardado', 'Saved'));
      } catch (e) { toast(friendly(e.message), true); chk.checked = !chk.checked; }
    };
  });
  // Mientras alguna se está leyendo, se mira otra vez cada 4 s.
  if (items.some((x) => x.running)) CAL_VIGIA = setTimeout(otraVez, 4000);
};

/** Una agenda conectada: su estado y lo que se puede hacer. */
function calTarjeta(x, c) {
  const titulo = (x.name || '').trim() || x.host;
  const n = Number(x.events) || 0;
  const estado = x.running ? bi('Sincronizando…', 'Syncing…')
    : x.last_status === 'ok' && x.last_ok_at
      ? bi(`Última sincronización: ${fmtDate(x.last_ok_at)} · ${n === 1 ? '1 evento' : `${fmtNum(n)} eventos`}`,
        `Last sync: ${fmtDate(x.last_ok_at)} · ${n === 1 ? '1 event' : `${fmtNum(n)} events`}`)
      : x.last_status === 'error'
        ? `${bi('No se ha podido leer.', "Couldn't be read.")} ${calErr(x.last_error)}`
        : bi('Aún sin sincronizar', 'Not synced yet');
  const lugar = Number(x.needs_place) || 0;
  const raras = Number(x.skipped?.repeat_simplified) || 0;
  const cambiados = (Number(x.edited) || 0) + (Number(x.dismissed) || 0);
  const linea = (t) => `<p class="muted" style="margin:6px 0 0">${esc(t)}</p>`;
  return `<div class="card">
    <h2 style="display:flex;align-items:center;gap:8px;margin:0">${icono('agendaConectada')}<span>${esc(titulo)}</span></h2>
    <p class="muted" style="margin:2px 0 0;overflow-wrap:anywhere" translate="no">${esc(x.url)}</p>
    <p class="herr-estado">${x.last_status === 'error' ? '<span class="herr-off" aria-hidden="true"></span>' : ms('check_circle')}<span>${esc(estado)}</span></p>
    ${x.failing ? linea(bi('Hemos dejado de intentarlo tras 14 días con error: sincronízala a mano o vuelve a conectarla.', "We've stopped trying after 14 days of errors: sync it by hand or connect it again.")) : ''}
    ${lugar ? linea(lugar === 1
    ? bi('1 evento por situar en el mapa: está en borrador en tus publicaciones.', '1 event to put on the map: it is a draft in your publications.')
    : bi(`${fmtNum(lugar)} eventos por situar en el mapa: están en borrador en tus publicaciones.`, `${fmtNum(lugar)} events to put on the map: they are drafts in your publications.`)) : ''}
    ${raras ? linea(raras === 1
    ? bi('1 evento se repite de una forma que no entendemos: entra solo su primera fecha.', "1 event repeats in a way we don't understand: only its first date comes in.")
    : bi(`${fmtNum(raras)} eventos se repiten de una forma que no entendemos: entra solo su primera fecha.`, `${fmtNum(raras)} events repeat in a way we don't understand: only their first date comes in.`)) : ''}
    ${cambiados ? linea(cambiados === 1
    ? bi('1 editado o borrado en Klendar ya no sigue tu agenda.', '1 edited or deleted in Klendar no longer follows your calendar.')
    : bi(`${fmtNum(cambiados)} editados o borrados en Klendar ya no siguen tu agenda.`, `${fmtNum(cambiados)} edited or deleted in Klendar no longer follow your calendar.`)) : ''}
    ${c.can_remove ? `<label class="opcion" style="margin-top:10px"><input type="checkbox" data-cal-modo="${esc(x.id)}" ${x.publish_mode !== 'draft' ? 'checked' : ''}>
      <span><b>${esc(bi('Publicarlos solos', 'Publish them automatically'))}</b><small class="muted" style="display:block">${esc(bi('Si lo quitas, entran como borrador para que los revises y los publiques tú.', 'If you turn it off, they come in as drafts for you to review and publish.'))}</small></span></label>` : ''}
    <div class="herr-botones" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
      ${c.can_edit ? `<button type="button" class="btn" data-cal="sync" data-id="${esc(x.id)}" ${x.running ? 'disabled' : ''}>${icono('sincronizar')} ${esc(bi('Sincronizar ahora', 'Sync now'))}</button>` : ''}
      ${c.can_edit && cambiados ? `<button type="button" class="btn ghost" data-cal="seguir" data-id="${esc(x.id)}">${esc(bi('Volver a seguirla', 'Follow it again'))}</button>` : ''}
      ${c.can_remove ? `<button type="button" class="btn ghost" data-cal="quitar" data-id="${esc(x.id)}">${esc(bi('Desconectar', 'Disconnect'))}</button>` : ''}
    </div>
  </div>`;
}

/** «¿Desconectar esta agenda?»: true = borrar sus eventos, false = dejarlos,
 * null = cancelar. */
function calDesconectar() {
  return new Promise((resolve) => {
    const d = $('#modal');
    d.innerHTML = `<form method="dialog"><h2>${esc(bi('¿Desconectar esta agenda?', 'Disconnect this calendar?'))}</h2>
      <p class="muted" style="margin:0">${esc(bi('Dejarán de entrar sus eventos. ¿Qué hacemos con los que ya entraron y aún no han pasado? Los que editaste en Klendar se quedan siempre.',
    "Its events will stop coming in. What should we do with the ones that already came in and haven't happened yet? The ones you edited in Klendar always stay."))}</p>
      <div class="foot"><button type="button" class="btn ghost" data-r="">${esc(bi('Cancelar', 'Cancel'))}</button>
      <button type="button" class="btn" data-r="dejar">${esc(bi('Dejarlos', 'Keep them'))}</button>
      <button type="button" class="btn bad" data-r="borrar">${esc(bi('Borrarlos', 'Delete them'))}</button></div></form>`;
    const fin = (r) => { d.close(); resolve(r); };
    $$('[data-r]', d).forEach((b) => { b.onclick = () => fin(b.dataset.r === '' ? null : b.dataset.r === 'borrar'); });
    d.oncancel = (e) => { e.preventDefault(); fin(null); };
    d.showModal();
  });
}

/** Pegar la dirección, probarla (cuántos eventos y una muestra) y conectarla.
 * Devuelve true si se ha conectado. */
function calConectar() {
  return new Promise((resolve) => {
    const d = $('#modal');
    d.innerHTML = `<form method="dialog" novalidate><h2>${esc(bi('Conectar una agenda', 'Connect a calendar'))}</h2>
      <label class="f"><span>${esc(bi('Dirección del calendario (iCal o ICS)', 'Calendar address (iCal or ICS)'))}</span>
        <input name="url" type="url" inputmode="url" autocomplete="off" spellcheck="false" maxlength="2000" placeholder="${esc(bi('https://… o webcal://…', 'https://… or webcal://…'))}">
        <small class="muted">${esc(bi(
    'Dónde encontrarla: en Google Calendar, Configuración › tu calendario › «Dirección pública en formato iCal» (o la secreta, si no es público). En Outlook, «Publicar calendario» › enlace ICS. En una web con WordPress, el enlace «iCal» o «Exportar» de la agenda. Un canal RSS o Atom no sirve: sus fechas son las de publicación, no las de los eventos.',
    "Where to find it: in Google Calendar, Settings › your calendar › “Public address in iCal format” (or the secret one, if it isn't public). In Outlook, “Publish calendar” › ICS link. On a WordPress website, the events calendar's “iCal” or “Export” link. An RSS or Atom feed won't do: its dates are publishing dates, not event dates."))}</small></label>
      <p class="err" id="calErr" role="alert" hidden></p>
      <p><button type="button" class="btn" id="calProbar">${esc(bi('Probar', 'Test'))}</button></p>
      <div id="calRes" aria-live="polite"></div>
      <div id="calFin" hidden>
        <label class="opcion"><input type="checkbox" name="auto" checked>
          <span><b>${esc(bi('Publicarlos solos', 'Publish them automatically'))}</b><small class="muted" style="display:block">${esc(bi('Si lo quitas, entran como borrador para que los revises y los publiques tú.', 'If you turn it off, they come in as drafts for you to review and publish.'))}</small></span></label>
        <p class="muted" style="margin:8px 0 0">${esc(bi('Al conectarla confirmas que la entidad puede publicar estos eventos. Lo que entra sigue las mismas normas que lo que publicas a mano.', 'By connecting it you confirm that the organisation may publish these events. What comes in follows the same rules as what you publish by hand.'))}</p>
      </div>
      <div class="foot"><button type="button" class="btn ghost" data-cancel>${esc(bi('Cancelar', 'Cancel'))}</button>
        <button type="submit" class="btn primary" id="calOk" disabled>${esc(bi('Conectar', 'Connect'))}</button></div></form>`;
    const form = $('form', d);
    const url = form.elements.url;
    const err = $('#calErr', d);
    const res = $('#calRes', d);
    let probada = null;
    const fallo = (code) => { err.textContent = calErr(code); err.hidden = false; };
    const fin = (r) => { d.close(); resolve(r); };
    url.oninput = () => {
      err.hidden = true;
      const igual = probada === url.value.trim();
      $('#calOk', d).disabled = !igual;
      $('#calFin', d).hidden = !igual;
    };
    $('#calProbar', d).onclick = async () => {
      const u = url.value.trim();
      if (!u) { url.focus(); return; }
      const b = $('#calProbar', d);
      b.disabled = true;
      err.hidden = true;
      res.innerHTML = `<p class="muted">${esc(bi('Leyendo la agenda…', 'Reading the calendar…'))}</p>`;
      try {
        const r = await calFn({ op: 'test', business_id: BIZ.id, url: u });
        if (!r.ok) { res.innerHTML = ''; fallo(r.error); return; }
        probada = u;
        res.innerHTML = calResumen(r);
        I18N.translate(res);
        $('#calFin', d).hidden = false;
        $('#calOk', d).disabled = false;
      } catch (e) {
        res.innerHTML = '';
        fallo('server_error');
      } finally {
        b.disabled = false;
      }
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const ok = $('#calOk', d);
      ok.disabled = true;
      const r = await calFn({ op: 'save', business_id: BIZ.id, url: url.value.trim(), publish_mode: form.elements.auto.checked ? 'publish' : 'draft' }).catch(() => ({ ok: false }));
      if (!r.ok) { fallo(r.error); ok.disabled = false; return; }
      toast(bi('Agenda conectada: sus eventos están entrando.', 'Calendar connected: its events are coming in.'));
      fin(true);
    };
    $('[data-cancel]', d).onclick = () => fin(false);
    d.oncancel = (e) => { e.preventDefault(); fin(false); };
    I18N.translate(d);
    d.showModal();
    url.focus();
  });
}

/** Lo que ha encontrado la prueba: cuántos, una muestra y lo que hay que saber. */
function calResumen(r) {
  const n = Number(r.events) || 0;
  const rep = Number(r.recurring) || 0;
  const sin = Number(r.without_place) || 0;
  const fuera = Object.entries(r.skipped || {}).filter(([k]) => k !== 'over_limit' && k !== 'repeat_simplified')
    .reduce((s, [, x]) => s + (Number(x) || 0), 0);
  const fecha = (s) => {
    const [dia, hora] = String(s || '').split(' ');
    const d = new Date(`${dia}T12:00:00Z`);
    const txt = Number.isNaN(d.getTime()) ? dia : d.toLocaleDateString(LOC(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    return hora && hora !== '00:00' ? `${txt} ${hora}` : txt;
  };
  const linea = (t) => `<p class="muted" style="margin:6px 0 0">${esc(t)}</p>`;
  return `<p style="margin:12px 0 4px"><b>${esc(n === 0
    ? bi('Lo hemos leído, pero no tiene eventos en los próximos 90 días.', "We've read it, but it has no events in the next 90 days.")
    : n === 1 ? bi('Hemos encontrado 1 evento en los próximos 90 días.', 'We found 1 event in the next 90 days.')
      : bi(`Hemos encontrado ${fmtNum(n)} eventos en los próximos 90 días.`, `We found ${fmtNum(n)} events in the next 90 days.`))}</b></p>
    <ul style="margin:4px 0 0;padding-left:18px" translate="no">${(r.sample || []).slice(0, 3).map((s) => `<li>${esc([fecha(s.starts_local), s.title, s.place].filter(Boolean).join(' · '))}</li>`).join('')}</ul>
    ${rep ? linea(rep === 1 ? bi('1 se repite: entra con su próxima fecha.', '1 repeats: it comes in with its next date.')
    : bi(`${fmtNum(rep)} se repiten: entran con su próxima fecha.`, `${fmtNum(rep)} repeat: they come in with their next date.`)) : ''}
    ${sin ? linea(sin === 1
    ? bi('1 tiene un lugar sin coordenadas: entrará como borrador hasta que lo sitúes en el mapa (si ya situaste ese lugar en otro evento, se usa ese).', "1 has a place without coordinates: it will come in as a draft until you put it on the map (if you've already placed that spot in another event, that one is used).")
    : bi(`${fmtNum(sin)} tienen un lugar sin coordenadas: entrarán como borrador hasta que los sitúes en el mapa (si ya situaste ese lugar en otro evento, se usa ese).`, `${fmtNum(sin)} have a place without coordinates: they will come in as drafts until you put them on the map (if you've already placed that spot in another event, that one is used).`)) : ''}
    ${fuera ? linea(fuera === 1 ? bi('1 no entra (pasado, cancelado, privado o más allá de 90 días).', "1 doesn't come in (past, cancelled, private or beyond 90 days).")
    : bi(`${fmtNum(fuera)} no entran (pasados, cancelados, privados o más allá de 90 días).`, `${fmtNum(fuera)} don't come in (past, cancelled, private or beyond 90 days).`)) : ''}`;
}

/** La tarjeta de «Más herramientas» (solo entidades). */
async function calTarjetaHerramienta() {
  const c = await calEstado();
  const n = (c?.items || []).length;
  const error = (c?.items || []).some((x) => x.last_status === 'error');
  return herrT({
    grupo: 'repite', usa: n > 0,
    icon: 'agendaConectada', titulo: bi('Conecta tu agenda', 'Connect your calendar'),
    frase: bi('Los eventos del calendario de tu web entran solos en Klendar cada día, sin escribirlos dos veces.', "The events in your website's calendar come into Klendar on their own every day, without typing them twice."),
    estado: !c ? '' : !c.enabled ? bi('Muy pronto podrás conectar aquí la agenda de tu web.', "Very soon you'll be able to connect your website's calendar here.")
      : error ? bi('Una agenda no se ha podido leer', "A calendar couldn't be read")
        : n === 0 ? bi('Sin conectar', 'Not connected')
          : n === 1 ? bi('1 agenda conectada', '1 calendar connected') : bi(`${n} agendas conectadas`, `${n} calendars connected`),
    on: n > 0,
    botones: [[bi('Abrir', 'Open'), '#/agenda']],
  });
}
