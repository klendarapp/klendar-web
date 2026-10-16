/* «¿Qué tal?» y «Estaba cerrado» en el panel (migración 20261229100000 de
 * la app), como la app:
 *
 *   · Cifras: «¿Qué tal?: 42 👍 · 5 👎» (todo el equipo) y, a propietario y
 *     encargado, «Mensajes privados» (`#/que-tal`).
 *   · `#/que-tal`: los mensajes de quien respondió 👎, con su nombre visible
 *     y nada más; contestar una vez, leído / no leído y denunciar.
 *   · `#/estaba-cerrado` (desde la notificación): cuándo lo encontraron
 *     cerrado (nunca quién), «Horario» y «Era un cierre puntual».
 *   · En «Tu ficha › Horario», el aviso con «Está bien así»; guardar el
 *     horario también cuenta como revisarlo.
 *
 * Comparte ámbito con panel.js: nombres que empiezan por `qt`. */
'use strict';

const QT_DIAS = 30;

/** La tarjeta de Cifras (null si la base aún no lo tiene). */
function qtCifrasHtml(q) {
  if (!q) return '';
  const cuenta = bi(`¿Qué tal?: ${q.up} 👍 · ${q.down} 👎`, `How was it?: ${q.up} 👍 · ${q.down} 👎`);
  const sinLeer = q.unread || 0;
  return `<div class="card"><h2>${esc(bi('¿Qué tal?', 'How was it?'))}</h2>
    <p style="margin:0 0 6px"><b>${esc(cuenta)}</b></p>
    <p class="muted" style="margin:0">${esc(q.can_manage ? qtAyuda() : qtSoloGestion())}</p>
    ${q.can_manage ? `<p style="margin:10px 0 0"><a class="btn" href="#/que-tal">${esc(bi('Mensajes privados', 'Private messages'))}${sinLeer ? ` · ${esc(bi(`${sinLeer} sin leer`, `${sinLeer} unread`))}` : ''}</a></p>` : ''}
  </div>`;
}
const qtResumen = (q) => (q ? `${q.up} 👍 · ${q.down} 👎` : '');
const qtAyuda = () => bi('Al día siguiente de usar algo en tu local, la gente responde con un toque. Quien responde 👎 puede escribirte en privado; reseñar sigue abierto para todos.',
  'The day after using something at your place, people answer with one tap. Anyone who answers 👎 can write to you privately; everyone can still leave a review.');
const qtSoloGestion = () => bi('Los mensajes privados los ven el propietario y los encargados.', 'Private messages are seen by the owner and managers.');

const qtDia = (iso) => new Intl.DateTimeFormat(LOC(), { day: 'numeric', month: 'short', timeZone: 'UTC' })
  .format(new Date(`${iso}T00:00:00Z`));

PAGES['que-tal'] = async (v) => {
  const q = await rpc('business_quetal', { p_business: BIZ.id, p_days: QT_DIAS });
  const lista = q?.messages || [];
  const cabeza = `<div class="page-head"><h1>${esc(bi('¿Qué tal?', 'How was it?'))}</h1></div>
    <div class="card"><p style="margin:0"><b>${esc(bi(`¿Qué tal?: ${q.up} 👍 · ${q.down} 👎`, `How was it?: ${q.up} 👍 · ${q.down} 👎`))}</b></p>
      <p class="muted" style="margin:2px 0 8px">${esc(bi('Últimos 30 días', 'Last 30 days'))}</p>
      <p class="muted" style="margin:0">${esc(q.can_manage ? qtAyuda() : qtSoloGestion())}</p></div>`;
  if (!lista.length) {
    v.innerHTML = `${cabeza}<section class="vacio"><h2>${esc(bi('Aún no hay mensajes', 'No messages yet'))}</h2>
      <p>${esc(q.can_manage ? bi('Cuando alguien te cuente en privado qué ha fallado, lo verás aquí.', 'When someone tells you privately what went wrong, you’ll see it here.') : qtSoloGestion())}</p>
      <div class="vacio-botones"><a class="btn primary" href="#/informe">${esc(bi('Ver Cifras', 'See stats'))}</a></div></section>`;
    return;
  }
  v.innerHTML = `${cabeza}<div class="resenas-panel">${lista.map((m, i) => `<article class="card${m.read ? '' : ' qt-nuevo'}">
      <header><span><b>${esc(m.name || bi('Usuario de Klendar', 'Klendar user'))}</b>
        <small class="muted">${esc(bi(`Visita del ${qtDia(m.visit_day)}`, `Visit on ${qtDia(m.visit_day)}`))}${m.what ? ` · ${esc(m.what)}` : ''}</small></span>
        ${m.read ? '' : `<span class="tag st-pending">${esc(bi('Sin leer', 'Unread'))}</span>`}</header>
      <p>${esc(m.message).replace(/\n/g, '<br>')}</p>
      ${m.reply ? `<div class="respuesta"><b>${esc(bi('Tu respuesta', 'Your reply'))}</b>${m.reply_at ? `<small class="muted"> · ${esc(fmtDate(m.reply_at))}</small>` : ''}<p>${esc(m.reply).replace(/\n/g, '<br>')}</p></div>` : ''}
      ${m.reported ? `<p class="muted" style="margin:6px 0 0">${esc(bi('Denunciado', 'Reported'))}</p>` : ''}
      <div class="pie">
        ${!m.reply && q.can_reply ? `<button class="btn sm" data-qt-resp="${i}">${ms('reply')}${esc(bi('Contestar', 'Reply'))}</button>` : ''}
        <button class="btn sm ghost" data-qt-leido="${i}">${ms('markunread')}${esc(m.read ? bi('Marcar como no leído', 'Mark as unread') : bi('Marcar como leído', 'Mark as read'))}</button>
        ${m.reported ? '' : `<button class="btn sm ghost" data-qt-den="${i}">${esc(bi('Denunciar', 'Report'))}</button>`}
      </div>
    </article>`).join('')}</div>`;

  $$('[data-qt-resp]', v).forEach((b) => { b.onclick = async () => {
    const m = lista[+b.dataset.qtResp];
    const out = await modal({
      title: bi('Contestar en privado', 'Reply privately'),
      intro: esc(bi('Solo lo verá esta persona. Puedes contestar una vez.', 'Only this person will see it. You can reply once.')),
      fields: [{ name: 'reply', label: bi('Tu respuesta', 'Your reply'), type: 'textarea', maxlength: 500, rows: 6 }],
      submit: bi('Contestar', 'Reply'),
    });
    if (!out || !out.reply.trim()) return;
    const r = await rpc('quetal_reply', { p_id: m.id, p_text: out.reply.trim() }).catch((e) => ({ ok: false, error: e.message }));
    if (!r?.ok) {
      toast({
        too_short: bi('Escribe al menos 2 caracteres.', 'Write at least 2 characters.'),
        offensive_text: bi('Revisa el texto: hay palabras que no se permiten.', 'Check the text: some words aren’t allowed.'),
        already_replied: bi('Ya has contestado a este mensaje.', 'You’ve already replied to this message.'),
      }[r?.error] || bi('No se ha podido guardar', 'Couldn’t save'), true);
      return;
    }
    toast(bi('Respuesta enviada', 'Reply sent'));
    route();
  }; });
  $$('[data-qt-leido]', v).forEach((b) => { b.onclick = async () => {
    const m = lista[+b.dataset.qtLeido];
    try { await rpc('quetal_mark_read', { p_id: m.id, p_read: !m.read }); route(); } catch (e) { toast(friendly(e.message), true); }
  }; });
  $$('[data-qt-den]', v).forEach((b) => { b.onclick = async () => {
    const m = lista[+b.dataset.qtDen];
    const r = await modal({
      title: bi('Denunciar', 'Report'),
      intro: esc(bi('Dinos qué pasa con este mensaje. La revisará una persona del equipo de Klendar.',
        'Tell us what’s wrong with this message. A person on the Klendar team will review it.')),
      fields: [
        { type: 'select', name: 'motivo', label: bi('Motivo', 'Reason'), value: 'inappropriate', options: [
          ['inappropriate', bi('Contenido inapropiado u ofensivo', 'Inappropriate or offensive content')],
          ['spam', bi('Spam o publicidad engañosa', 'Spam or misleading advertising')],
          ['illegal', bi('Contenido ilegal', 'Illegal content')],
          ['other', bi('Otro motivo', 'Other reason')],
        ] },
        { type: 'textarea', name: 'detalles', label: bi('Detalles (opcional)', 'Details (optional)'), maxlength: 500, rows: 3 },
      ],
      submit: bi('Enviar', 'Send'),
      danger: true,
    });
    if (!r) return;
    try {
      await rpc('report_target', { p_type: 'quetal_message', p_id: m.id, p_reason: r.motivo, p_details: r.detalles || null });
      toast(bi('Denuncia enviada. Gracias por avisar.', 'Report sent. Thanks for letting us know.'));
      route();
    } catch (e) { toast(friendly(e.message), true); }
  }; });
};

/** «Alguien encontró cerrado tu local el jueves a las 18:00». `local`:
 * «2026-10-16T18:00» en la hora del negocio. */
function qtCuando(local) {
  const d = new Date(`${local}:00Z`);
  const dia = new Intl.DateTimeFormat(LOC(), { weekday: 'long', timeZone: 'UTC' }).format(d);
  const hora = local.slice(11, 16);
  const largo = new Intl.DateTimeFormat(LOC(), { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
  return { dia, hora, largo: `${largo} · ${hora}` };
}
const qtRegla = () => bi('Si 3 personas distintas lo encuentran cerrado en 14 días, tu ficha dirá «Horario sin confirmar» hasta que revises el horario. Nunca sabrás quién ha avisado.',
  'If 3 different people find it closed within 14 days, your page will say “Opening hours not confirmed” until you check your hours. You’ll never know who reported it.');
const qtSinConfirmar = () => bi('Tu ficha dice «Horario sin confirmar»: 3 o más personas lo encontraron cerrado en 14 días. Se quita en cuanto revises el horario.',
  'Your page says “Opening hours not confirmed”: 3 or more people found it closed within 14 days. It goes away as soon as you check your hours.');

PAGES['estaba-cerrado'] = async (v) => {
  const c = await rpc('business_closed_reports', { p_business: BIZ.id });
  const ultimo = (c.reports || [])[0];
  const u = ultimo ? qtCuando(ultimo.local) : null;
  v.innerHTML = `<div class="page-head"><h1>${esc(bi('Estaba cerrado', 'It was closed'))}</h1></div>
    <div class="card"><h2 style="margin-top:0">${esc(u
    ? bi(`Alguien encontró cerrado tu local el ${u.dia} a las ${u.hora}. ¿Está bien tu horario?`,
      `Someone found your place closed on ${u.dia} at ${u.hora}. Are your opening hours right?`)
    : bi('Nadie lo ha encontrado cerrado en los últimos 14 días.', 'Nobody has found it closed in the last 14 days.'))}</h2>
      <p class="muted">${esc(c.unconfirmed ? qtSinConfirmar() : qtRegla())}</p>
      ${c.can_manage ? `<div class="qt-dos">
        <a class="btn" href="#/ficha/horario">${esc(bi('Horario', 'Opening hours'))}</a>
        <button type="button" class="btn" id="qtPuntual">${esc(bi('Era un cierre puntual', 'It was a one-off'))}</button>
      </div>` : ''}
    </div>
    ${(c.reports || []).length ? `<div class="card"><h2>${esc(bi('Últimos 14 días', 'Last 14 days'))}</h2>
      <ul class="qt-lista">${c.reports.map((r) => `<li>${esc(qtCuando(r.local).largo)}</li>`).join('')}</ul>
      <p class="muted" style="margin:8px 0 0">${esc(bi(
    c.people === 1 ? '1 persona desde que revisaste el horario' : `${c.people} personas desde que revisaste el horario`,
    c.people === 1 ? '1 person since you last checked your hours' : `${c.people} people since you last checked your hours`))}</p></div>` : ''}`;
  const b = $('#qtPuntual', v);
  if (b) b.onclick = async () => {
    try {
      await rpc('confirm_business_hours', { p_business: BIZ.id });
      toast(bi('Horario revisado', 'Opening hours checked'));
      location.hash = '#/cerrados';
    } catch (e) { toast(friendly(e.message), true); }
  };
};

/** Encima del editor del horario (Tu ficha › Horario): si alguien lo
 * encontró cerrado desde la última revisión, el aviso y «Está bien así». */
async function qtAvisoHorario(caja) {
  if (!caja || !gestiona()) return;
  const c = await rpc('business_closed_reports', { p_business: BIZ.id }).catch(() => null);
  if (!c || !c.people) return;
  caja.innerHTML = `<div class="help qt-aviso"><p style="margin:0"><b>${esc(bi('Alguien encontró cerrado tu local', 'Someone found your place closed'))}</b></p>
    <p class="muted" style="margin:4px 0 8px">${esc(c.unconfirmed ? qtSinConfirmar()
    : bi('Comprueba que el horario está bien. Si lo está, confírmalo.', 'Check that your opening hours are right. If they are, confirm them.'))}</p>
    <button type="button" class="btn sm" id="qtBien">${esc(bi('Está bien así', 'They’re right'))}</button></div>`;
  $('#qtBien', caja).onclick = async () => {
    try {
      await rpc('confirm_business_hours', { p_business: BIZ.id });
      caja.innerHTML = '';
      toast(bi('Horario revisado', 'Opening hours checked'));
    } catch (e) { toast(friendly(e.message), true); }
  };
}

/** Guardar el horario cuenta como revisarlo, aunque no cambie nada. */
const qtHorarioGuardado = () => rpc('confirm_business_hours', { p_business: BIZ.id }).catch(() => null);
