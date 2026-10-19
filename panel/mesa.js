/* Panel del negocio: «Menú del día» y «Wifi para clientes» (QR de mesa).
 * Tanda D, migraciones 20261230100001–02 de la app. Lo mismo que la app
 * (`daily_menu_sheet.dart`, `table_qr_screen.dart`):
 *
 * - #/menu-del-dia: la foto de la pizarra, el precio, una línea opcional y
 *   para qué es (comida, cena o las dos); sale como «Menú de hoy · 12,50 €»
 *   hasta que cierra la cocina (o el local) y al día siguiente desaparece
 *   solo (sin horario ese día: comida hasta las 16:00, cena hasta las
 *   23:00). «Repetir el de ayer», «Añadir la foto de hoy» y «Todos los días».
 *   Si hoy sale cerrado (`closed_today`, migración 20261232100000): «¿Abres
 *   hoy?» arriba, con «Sí, abro hoy» (horario o «Días cerrados») y «Seguir
 *   igualmente».
 * - #/wifi-clientes: red y contraseña (opcionales) y los carteles de mesa
 *   (`/cartel/mesa/<código>`, cuatro por folio, numerados si se quiere),
 *   los escaneos del mes y «Cambiar el enlace».
 *
 * Va después de panel.js y herramientas.js y usa lo suyo (`PAGES`, `rpc`,
 * `BIZ`, `sb`, `BUCKET`, `KFotos`, `KZ`, `TZ`, `LOC`, `esc`, `bi`, `toast`,
 * `friendly`, `icono`, `confirmDlg`, `route`, `fmtMoney`, `fmtNum`). Comparten
 * ámbito: los nombres de aquí empiezan por `mesa`.
 */
'use strict';

// Iconos que no están en la fuente recortada del panel.
Object.assign(SVG, {
  wifi: 'M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z',
});

const mesaHora = (iso) => new Date(iso).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const mesaComida = (m) => ({
  lunch: bi('Comida', 'Lunch'), dinner: bi('Cena', 'Dinner'), both: bi('Comida y cena', 'Lunch and dinner'),
}[m] || bi('Comida', 'Lunch'));
const mesaCents = (txt) => {
  const n = Number(String(txt || '').trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};
const mesaPrecioTxt = (c) => (c == null ? '' : (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', ',')));

/** Sube una foto (reducida como en la app) y devuelve su dirección. */
async function mesaSubeFoto(file) {
  const f = await KFotos.reduce(file, KFotos.TAM.foto);
  if (f.size > 5 * 1024 * 1024) { toast(bi('Esa foto pesa más de 5 MB.', 'That photo is over 5 MB.'), true); return null; }
  const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${BIZ.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type });
  if (error) { toast(friendly(error.message), true); return null; }
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Por qué no se ha podido publicar, dicho para el negocio. */
function mesaError(err) {
  const e = String(err || '');
  const tope = /plan_limit_reached:(\d+)/.exec(e);
  if (tope) return friendly(e);
  return ({
    invalid_price: bi('Pon el precio del menú (entre 1 y 200 €).', 'Enter the menu price (between €1 and €200).'),
    invalid_window: bi('Elige una hora de fin dentro de las próximas 24 horas (y que no sea ya).', 'Pick an end time within the next 24 hours (and not right now).'),
    note_too_long: bi('La línea puede tener hasta 200 caracteres.', 'The line can be up to 200 characters.'),
    invalid_time: bi('Elige una hora entre las 6:00 y las 22:00.', 'Pick a time between 6:00 and 22:00.'),
    ssid_too_long: bi('El nombre puede tener hasta 64 caracteres y la contraseña hasta 128.', 'The name can be up to 64 characters and the password up to 128.'),
    password_too_long: bi('El nombre puede tener hasta 64 caracteres y la contraseña hasta 128.', 'The name can be up to 64 characters and the password up to 128.'),
  })[e] || friendly(e);
}

// ── Menú del día ────────────────────────────────────────────────────────────
PAGES['menu-del-dia'] = async (v) => {
  let s = await rpc('daily_menu_setup', { p_business: BIZ.id });
  if (!s) throw new Error('not_authorized');
  const last = s.last;
  const live = s.live;
  const plan = s.plan || { weekdays: [], at: '11:00' };
  let foto = null;
  let comida = plan.weekdays?.length ? plan.meal : (last?.meal || 'lunch');
  let hasta = null; // otra hora de fin elegida a mano
  const precioIni = mesaPrecioTxt(plan.weekdays?.length ? plan.price_cents : last?.price_cents);
  const lineaIni = (plan.weekdays?.length ? plan.note : last?.note) || '';
  const repetible = last && last.price_cents != null && (!live || live.id !== last.id);
  const dias = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const diasEn = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const finTxt = () => {
    const u = hasta || s.until?.[comida]?.until;
    if (!u) return '';
    const hora = mesaHora(u);
    if (hasta || !s.until?.[comida]?.at_close) return bi(`Hasta las ${hora}`, `Until ${hora}`);
    return s.kitchen
      ? bi(`Al cerrar la cocina (${hora})`, `When the kitchen closes (${hora})`)
      : bi(`Al cierre (${hora})`, `At closing time (${hora})`);
  };
  const precioHoy = live ? fmtMoney(live.price_cents) : '';
  const comidaHoy = live ? mesaComida(live.meal) : '';
  const horaHoy = live ? mesaHora(live.until) : '';
  const precioAyer = last ? fmtMoney(last.price_cents) : '';
  const hhmm = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });

  v.innerHTML = `
    <div class="page-head"><h1>${esc(bi('Menú del día', 'Daily menu'))}</h1></div>
    <p class="muted" style="margin:-6px 0 14px;max-width:640px">${esc(bi('Una foto de la pizarra y el precio: sale como «Menú de hoy» hasta que cierra la cocina y al día siguiente desaparece solo.',
      'A photo of the board and the price: it shows as “Today’s menu” until the kitchen closes and disappears by itself the next day.'))}</p>
    ${s.closed_today && s.can_publish ? `<div class="card" id="mesaCerrado">
      <b>${esc(bi('Hoy tu local sale cerrado en Klendar. ¿Abres hoy?', 'Today your place shows as closed on Klendar. Are you open today?'))}</b>
      <p class="hint" style="margin:4px 0 10px">${esc(s.closed_today === 'closure'
    ? bi('Hoy está en «Días cerrados»: mientras siga así, no se ve nada de tu local.', 'Today is in “Closed days”: while it stays that way, nothing from your place is shown.')
    : bi('Tu horario no tiene horas hoy: el menú se publica igual, pero la ficha dice «Cerrado».', 'Your opening hours have nothing for today: the menu is posted anyway, but your page says “Closed”.'))}</p>
      <div class="acciones-fila" style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn" href="${s.closed_today === 'closure' ? '#/cerrados' : '#/ficha/horario'}">${esc(bi('Sí, abro hoy', 'Yes, I’m open today'))}</a>
        <button class="btn" type="button" id="mesaSigue">${esc(bi('Seguir igualmente', 'Continue anyway'))}</button>
      </div>
    </div>` : ''}
    ${live ? `<div class="card antes">
      <div class="antes-ultima">
        ${live.image ? `<img src="${esc(live.image)}" alt="" loading="lazy">` : `<span class="antes-ic">${icono('restaurant_menu')}</span>`}
        <div><b>${esc(bi(`Publicado: menú de hoy · ${precioHoy}`, `Live: today’s menu · ${precioHoy}`))}</b>
          <small class="muted">${esc(bi(`${comidaHoy} · hasta las ${horaHoy}`, `${comidaHoy} · until ${horaHoy}`))}</small></div>
      </div>
      ${!live.image && s.can_publish ? `<label class="btn" style="margin-top:10px">${esc(bi('Añadir la foto de hoy', 'Add today’s photo'))}<input type="file" accept="image/*" capture="environment" id="fotoHoy" hidden></label>` : ''}
      <p class="hint">${esc(bi('Si publicas otro, sustituye al de hoy.', 'If you post another one, it replaces today’s.'))}</p>
    </div>` : ''}
    ${repetible ? `<div class="card">
      <button class="btn grande" type="button" id="repetir" ${s.can_publish ? '' : 'disabled'}>${esc(bi(`Repetir el de ayer (${precioAyer})`, `Repeat yesterday’s (${precioAyer})`))}</button>
      <p class="hint" style="text-align:center">${esc(bi('Mismo precio, misma foto y la misma línea, en un toque.', 'Same price, same photo and same line, in one tap.'))}</p>
    </div>` : ''}
    <div class="card antes">
      <label class="f"><span>${esc(bi('Foto de la pizarra (opcional)', 'Photo of the board (optional)'))}</span>
        <input type="file" accept="image/*" capture="environment" id="foto"></label>
      <div id="fotoVista"></div>
      <p class="hint">${esc(bi('Sin foto sale la portada de tu ficha.', 'Without a photo, your page’s cover is shown.'))}</p>
      <label class="f"><span>${esc(bi('Precio del menú', 'Menu price'))}</span>
        <input type="text" inputmode="decimal" id="precio" placeholder="${esc(bi('Ej. 12,50', 'E.g. 12.50'))}" value="${esc(precioIni)}" required></label>
      <label class="f"><span>${esc(bi('Qué incluye (opcional)', 'What’s included (optional)'))}</span>
        <input type="text" id="linea" maxlength="200" placeholder="${esc(bi('Primeros, segundos, bebida y postre', 'Starters, mains, drink and dessert'))}" value="${esc(lineaIni)}"></label>
      <div class="f"><span>${esc(bi('Para', 'For'))}</span><div class="elige" role="radiogroup" aria-label="${esc(bi('Para', 'For'))}">
        ${['lunch', 'dinner', 'both'].map((m) => `<label><input type="radio" name="comida" value="${m}" ${m === comida ? 'checked' : ''}><span>${esc(mesaComida(m))}</span></label>`).join('')}
      </div></div>
      <label class="f" style="max-width:220px"><span>${esc(bi('Hasta', 'Until'))}</span><input type="time" id="hasta"></label>
      <p class="hint" id="finTxt">${esc(finTxt())}</p>
      <button class="btn primary grande" type="button" id="publicar" ${s.can_publish ? '' : 'disabled'}>${esc(I18N.t('Publicar'))}</button>
    </div>
    <div class="card"><h2>${esc(bi('Todos los días', 'Every day'))}</h2>
      <label class="opcion"><input type="checkbox" id="planOn" ${plan.weekdays?.length ? 'checked' : ''} ${s.can_publish ? '' : 'disabled'}>
        <span>${esc(bi('Mismo precio cada día (por ejemplo, de lunes a viernes): se publica solo y tú solo cambias la foto.',
          'Same price every day (e.g. Monday to Friday): it publishes itself and you only change the photo.'))}</span></label>
      <div id="planDias" class="elige" style="margin:10px 0" role="group" aria-label="${esc(bi('Días', 'Days'))}" ${plan.weekdays?.length ? '' : 'hidden'}>
        ${dias.map((d, i) => `<label><input type="checkbox" name="dia" value="${i + 1}" ${(plan.weekdays || []).includes(i + 1) ? 'checked' : ''}><span>${esc(I18N.lang === 'en' ? diasEn[i] : d)}</span></label>`).join('')}
      </div>
      <label class="f" style="max-width:200px" ${plan.weekdays?.length ? '' : 'hidden'} id="planHoraF"><span>${esc(bi('Se publica a las', 'Published at'))}</span>
        <input type="time" id="planHora" min="06:00" max="22:00" value="${esc(plan.at || '11:00')}"></label>
      <p class="hint">${esc(bi('Con el precio, la línea y la comida/cena de arriba. No se publica los días cerrados ni si ese día ya has publicado uno. Te avisamos para que añadas la foto.',
        'With the price, line and lunch/dinner above. It isn’t posted on closed days or if you’ve already posted one that day. We’ll remind you to add the photo.'))}</p>
    </div>`;

  const pintaFin = () => { $('#finTxt', v).textContent = finTxt(); };
  // «Seguir igualmente»: fuera el aviso de «Hoy sale cerrado».
  const sigue = $('#mesaSigue', v);
  if (sigue) sigue.onclick = () => { $('#mesaCerrado', v).hidden = true; };
  $$('input[name=comida]', v).forEach((r) => {
    r.onchange = () => { comida = r.value; hasta = null; $('#hasta', v).value = ''; pintaFin(); };
  });
  $('#hasta', v).onchange = () => {
    const [h, m] = String($('#hasta', v).value || '').split(':').map(Number);
    if (!Number.isFinite(h)) { hasta = null; pintaFin(); return; }
    const [y, mo, d] = KZ.hoy(TZ).split('-').map(Number);
    let t = KZ.instante(TZ, y, mo, d, h, m || 0);
    // Las 1:00 de una noche: del día siguiente.
    if (t.getTime() < Date.now() - 6 * 3600e3) t = new Date(t.getTime() + 86400e3);
    hasta = t.toISOString();
    pintaFin();
  };
  if (s.until?.[comida]?.until) $('#hasta', v).placeholder = hhmm(s.until[comida].until);
  $('#foto', v).onchange = async (e) => {
    if (!e.target.files?.[0]) return;
    foto = await mesaSubeFoto(e.target.files[0]);
    $('#fotoVista', v).innerHTML = foto ? `<img src="${esc(foto)}" alt="" style="max-width:180px;border-radius:14px;margin-top:8px">` : '';
  };
  const publica = async (b, args) => {
    b.disabled = true;
    try {
      const r = await rpc('publish_daily_menu', { p_business: BIZ.id, ...args });
      if (!r?.ok) { toast(mesaError(r?.error), true); return; }
      toast(bi('Menú del día publicado', 'Daily menu posted'));
      route();
    } catch (err) {
      toast(friendly(err.message), true);
    } finally { b.disabled = false; }
  };
  $('#publicar', v).onclick = (e) => {
    const c = mesaCents($('#precio', v).value);
    if (c == null || c < 100 || c > 20000) { toast(mesaError('invalid_price'), true); $('#precio', v).focus(); return; }
    publica(e.currentTarget, {
      p_price_cents: c, p_meal: comida, p_note: $('#linea', v).value.trim() || null,
      p_image: foto, p_until: hasta, p_reuse_photo: false,
    });
  };
  const rep = $('#repetir', v);
  if (rep) rep.onclick = (e) => publica(e.currentTarget, { p_price_cents: last.price_cents, p_meal: last.meal || 'lunch', p_note: last.note || null, p_reuse_photo: true });
  const fh = $('#fotoHoy', v);
  if (fh) {
    fh.onchange = async (e) => {
      if (!e.target.files?.[0]) return;
      const url = await mesaSubeFoto(e.target.files[0]);
      if (!url) return;
      const r = await rpc('set_daily_menu_photo', { p_offer: live.id, p_image: url }).catch((err) => ({ ok: false, error: err.message }));
      if (!r?.ok) { toast(mesaError(r?.error), true); return; }
      toast(bi('Foto añadida', 'Photo added'));
      route();
    };
  }
  const guardaPlan = async () => {
    const on = $('#planOn', v).checked;
    let diasSel = $$('input[name=dia]:checked', v).map((x) => Number(x.value));
    if (on && !diasSel.length) diasSel = [1, 2, 3, 4, 5];
    const c = mesaCents($('#precio', v).value);
    if (on && (c == null || c < 100 || c > 20000)) { toast(mesaError('invalid_price'), true); $('#planOn', v).checked = false; return; }
    try {
      const r = await rpc('save_daily_menu_plan', {
        p_business: BIZ.id, p_weekdays: on ? diasSel : [], p_price_cents: c, p_meal: comida,
        p_note: $('#linea', v).value.trim() || null, p_at: $('#planHora', v).value || '11:00',
      });
      if (!r?.ok) { toast(mesaError(r?.error), true); return; }
      $$('input[name=dia]', v).forEach((x) => { x.checked = on && diasSel.includes(Number(x.value)); });
      $('#planDias', v).hidden = !on;
      $('#planHoraF', v).hidden = !on;
      toast(on ? bi('Se publicará solo esos días', 'It will publish itself on those days') : bi('«Todos los días» apagado', '“Every day” turned off'));
    } catch (err) { toast(friendly(err.message), true); }
  };
  $('#planOn', v).onchange = guardaPlan;
  $$('input[name=dia]', v).forEach((x) => { x.onchange = guardaPlan; });
  $('#planHora', v).onchange = guardaPlan;
};

// ── Wifi para clientes (QR de mesa) ─────────────────────────────────────────
PAGES['wifi-clientes'] = async (v) => {
  const d = await rpc('business_table_qr', { p_business: BIZ.id });
  if (d?.ok === false) throw new Error(friendly(d.error));
  const en = I18N.pub === 'en';
  const base = en ? '/en/poster/table/' : '/cartel/mesa/';
  const url = `https://klendar.app/m/${d.token}`;
  const n = Number(d.scans_month) || 0;
  const puede = d.can_change === true;
  const num = fmtNum(n);
  v.innerHTML = `
    <div class="page-head"><h1>${esc(bi('Wifi para clientes', 'Wi-Fi for customers'))}</h1></div>
    ${helpBox(bi('¿Para qué sirve?', 'What is it for?'), bi(
    '<p>Carteles para las mesas con un QR. Quien lo escanea ve tu wifi (red y contraseña, con «Copiar contraseña»), lo que tienes hoy y tu carta, y puede añadirte a favoritos. Sin wifi, sirven igual de QR de mesa.</p><p>El QR no lleva la contraseña: si la cambias, los carteles siguen valiendo. Contamos escaneos, no personas: no guardamos quién escanea.</p>',
    '<p>Table cards with a QR code. Whoever scans it sees your Wi-Fi (network and password, with “Copy password”), what you have on today and your menu, and can add you to their favourites. Without Wi-Fi, they still work as a table QR.</p><p>The QR doesn’t contain the password: if you change it, the cards still work. We count scans, not people: we don’t keep who scans.</p>'))}
    <div class="card">
      <h2 style="margin-top:0">${esc(bi('Tu wifi', 'Your Wi-Fi'))}</h2>
      <label class="f"><span>${esc(bi('Nombre de la red', 'Network name'))}</span><input type="text" id="ssid" maxlength="64" autocomplete="off" value="${esc(d.ssid || '')}" ${puede ? '' : 'disabled'}></label>
      <label class="f"><span>${esc(bi('Contraseña', 'Password'))}</span><input type="text" id="clave" maxlength="128" autocomplete="off" spellcheck="false" value="${esc(d.password || '')}" ${puede ? '' : 'disabled'}></label>
      <p class="hint">${esc(bi('Las dos son opcionales. La verá cualquiera que escanee el cartel: usa una red para clientes, no la de tu negocio.',
    'Both are optional. Anyone who scans the card will see it: use a guest network, not your business one.'))}</p>
      ${puede ? `<button class="btn primary" type="button" id="guardaWifi">${esc(bi('Guardar', 'Save'))}</button>` : ''}
    </div>
    <div class="card cartel-local">
      <div id="qr" class="cl-qr" role="img" aria-label="QR ${esc(url)}"></div>
      <div class="cl-txt">
        <h2 style="margin-top:0">${esc(bi('Carteles de mesa', 'Table cards'))}</h2>
        <p class="muted">${esc(bi('Cuatro por folio, para recortar. Se imprimen o se guardan en PDF desde el navegador.', 'Four per sheet, to cut out. Print them or save them as PDF from the browser.'))}</p>
        <label class="opcion"><input type="checkbox" id="numerar"><span>${esc(bi('Numerar las mesas («Mesa 1», «Mesa 2»…)', 'Number the tables (“Table 1”, “Table 2”…)'))}</span></label>
        <label class="f" style="max-width:200px" id="mesasF" hidden><span>${esc(bi('Cuántas mesas', 'How many tables'))}</span><input type="number" id="mesas" min="1" max="200" value="12"></label>
        <p class="acciones"><a class="btn" id="imprimir" href="${base}${esc(d.token)}" target="_blank" rel="noopener">${esc(bi('Imprimir carteles de mesa', 'Print table cards'))}</a>
          <a class="btn ghost" href="/m/${esc(d.token)}" target="_blank" rel="noopener">${esc(bi('Ver la página', 'See the page'))}</a></p>
        <p><b>${esc(bi(n === 0 ? 'Ningún escaneo este mes' : n === 1 ? '1 escaneo este mes' : `${num} escaneos este mes`,
    n === 0 ? 'No scans this month' : n === 1 ? '1 scan this month' : `${num} scans this month`))}</b></p>
        <p class="hint">${esc(bi('Cuenta escaneos, no personas: no guardamos quién escanea.', 'Counts scans, not people: we don’t keep who scans.'))}</p>
        <p class="cartel-url">${esc(url)}</p>
      </div>
    </div>
    ${puede ? `<div class="card">
      <h2 style="margin-top:0">${esc(bi('Cambiar el enlace', 'Change the link'))}</h2>
      <p class="muted">${esc(bi('Los carteles que ya tienes impresos dejarán de enseñar el wifi. Tendrás que imprimir los nuevos.', 'The cards you’ve already printed will stop showing the Wi-Fi. You’ll need to print new ones.'))}</p>
      <button class="btn bad ghost" type="button" id="cambiar">${esc(bi('Cambiar el enlace', 'Change the link'))}</button>
    </div>` : ''}`;

  const qr = window.qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('#qr', v).innerHTML = qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true });

  const enlace = () => {
    const num = $('#numerar', v).checked ? Math.min(200, Math.max(1, Number($('#mesas', v).value) || 0)) : 0;
    $('#imprimir', v).href = `${base}${d.token}${num ? `?mesas=${num}` : ''}`;
  };
  $('#numerar', v).onchange = () => { $('#mesasF', v).hidden = !$('#numerar', v).checked; enlace(); };
  $('#mesas', v).oninput = enlace;
  const guarda = $('#guardaWifi', v);
  if (guarda) {
    guarda.onclick = async () => {
      guarda.disabled = true;
      try {
        const r = await rpc('save_business_wifi', {
          p_business: BIZ.id, p_ssid: $('#ssid', v).value.trim() || null, p_password: $('#clave', v).value || null,
        });
        if (!r?.ok) { toast(mesaError(r?.error), true); return; }
        toast(bi('Wifi guardado', 'Wi-Fi saved'));
      } catch (err) { toast(friendly(err.message), true); } finally { guarda.disabled = false; }
    };
  }
  const cambiar = $('#cambiar', v);
  if (cambiar) {
    cambiar.onclick = async () => {
      if (!await confirmDlg(bi('¿Cambiar el enlace?', 'Change the link?'),
        esc(bi('Los carteles que ya tienes impresos dejarán de enseñar el wifi. Tendrás que imprimir los nuevos.', 'The cards you’ve already printed will stop showing the Wi-Fi. You’ll need to print new ones.')),
        { danger: true, submit: bi('Cambiar', 'Change') })) return;
      const r = await rpc('rotate_table_qr', { p_business: BIZ.id }).catch((err) => ({ ok: false, error: err.message }));
      if (!r?.ok) { toast(friendly(r?.error), true); return; }
      toast(bi('Enlace cambiado: imprime los carteles nuevos', 'Link changed: print the new cards'));
      route();
    };
  }
};

/** «Cifras»: «QR de mesa · 142 escaneos este mes», si el local lo tiene. */
async function mesaCifras(caja) {
  if (!caja) return;
  const s = await rpc('table_qr_stats', { p_business: BIZ.id }).catch(() => null);
  if (!s?.has || !caja.isConnected) return;
  const m = Number(s.month) || 0;
  const d30 = Number(s.d30) || 0;
  const num = fmtNum(m);
  const num30 = fmtNum(d30);
  caja.innerHTML = `<div class="card"><h2 style="margin-top:0">${esc(bi('QR de mesa', 'Table QR'))}</h2>
    <p><b>${esc(bi(m === 1 ? '1 escaneo este mes' : `${num} escaneos este mes`, m === 1 ? '1 scan this month' : `${num} scans this month`))}</b>
    · ${esc(bi(`${num30} en los últimos 30 días`, `${num30} in the last 30 days`))}</p>
    <p class="hint">${esc(bi('Cuenta escaneos, no personas: no guardamos quién escanea.', 'Counts scans, not people: we don’t keep who scans.'))}</p></div>`;
}
