/* «Estaba cerrado» en el panel (migración 20261229100000 de la app), como
 * la app:
 *
 *   · `#/estaba-cerrado` (desde la notificación): cuándo lo encontraron
 *     cerrado (nunca quién), «Horario» y «Era un cierre puntual».
 *   · En «Tu ficha › Horario», el aviso con «Está bien así»; guardar el
 *     horario también cuenta como revisarlo.
 *
 * Comparte ámbito con panel.js: nombres que empiezan por `cerr`. */
'use strict';

/** «Alguien encontró cerrado tu local el jueves a las 18:00». `local`:
 * «2026-10-16T18:00» en la hora del negocio. */
function cerrCuando(local) {
  const d = new Date(`${local}:00Z`);
  const dia = new Intl.DateTimeFormat(LOC(), { weekday: 'long', timeZone: 'UTC' }).format(d);
  const hora = local.slice(11, 16);
  const largo = new Intl.DateTimeFormat(LOC(), { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
  return { dia, hora, largo: `${largo} · ${hora}` };
}
const cerrRegla = () => bi('Si 3 personas distintas lo encuentran cerrado en 14 días, tu ficha dirá «Horario sin confirmar» hasta que revises el horario. Nunca sabrás quién ha avisado.',
  'If 3 different people find it closed within 14 days, your page will say “Opening hours not confirmed” until you check your hours. You’ll never know who reported it.');
const cerrSinConfirmar = () => bi('Tu ficha dice «Horario sin confirmar»: 3 o más personas lo encontraron cerrado en 14 días. Se quita en cuanto revises el horario.',
  'Your page says “Opening hours not confirmed”: 3 or more people found it closed within 14 days. It goes away as soon as you check your hours.');

PAGES['estaba-cerrado'] = async (v) => {
  const c = await rpc('business_closed_reports', { p_business: BIZ.id });
  const ultimo = (c.reports || [])[0];
  const u = ultimo ? cerrCuando(ultimo.local) : null;
  v.innerHTML = `<div class="page-head"><h1>${esc(bi('Estaba cerrado', 'It was closed'))}</h1></div>
    <div class="card"><h2 style="margin-top:0">${esc(u
    ? bi(`Alguien encontró cerrado tu local el ${u.dia} a las ${u.hora}. ¿Está bien tu horario?`,
      `Someone found your place closed on ${u.dia} at ${u.hora}. Are your opening hours right?`)
    : bi('Nadie lo ha encontrado cerrado en los últimos 14 días.', 'Nobody has found it closed in the last 14 days.'))}</h2>
      <p class="muted">${esc(c.unconfirmed ? cerrSinConfirmar() : cerrRegla())}</p>
      ${c.can_manage ? `<div class="cerr-dos">
        <a class="btn" href="#/ficha/horario">${esc(bi('Horario', 'Opening hours'))}</a>
        <button type="button" class="btn" id="cerrPuntual">${esc(bi('Era un cierre puntual', 'It was a one-off'))}</button>
      </div>` : ''}
    </div>
    ${(c.reports || []).length ? `<div class="card"><h2>${esc(bi('Últimos 14 días', 'Last 14 days'))}</h2>
      <ul class="cerr-lista">${c.reports.map((r) => `<li>${esc(cerrCuando(r.local).largo)}</li>`).join('')}</ul>
      <p class="muted" style="margin:8px 0 0">${esc(bi(
    c.people === 1 ? '1 persona desde que revisaste el horario' : `${c.people} personas desde que revisaste el horario`,
    c.people === 1 ? '1 person since you last checked your hours' : `${c.people} people since you last checked your hours`))}</p></div>` : ''}`;
  const b = $('#cerrPuntual', v);
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
async function cerrAvisoHorario(caja) {
  if (!caja || !gestiona()) return;
  const c = await rpc('business_closed_reports', { p_business: BIZ.id }).catch(() => null);
  if (!c || !c.people) return;
  caja.innerHTML = `<div class="help cerr-aviso"><p style="margin:0"><b>${esc(bi('Alguien encontró cerrado tu local', 'Someone found your place closed'))}</b></p>
    <p class="muted" style="margin:4px 0 8px">${esc(c.unconfirmed ? cerrSinConfirmar()
    : bi('Comprueba que el horario está bien. Si lo está, confírmalo.', 'Check that your opening hours are right. If they are, confirm them.'))}</p>
    <button type="button" class="btn sm" id="cerrBien">${esc(bi('Está bien así', 'They’re right'))}</button></div>`;
  $('#cerrBien', caja).onclick = async () => {
    try {
      await rpc('confirm_business_hours', { p_business: BIZ.id });
      caja.innerHTML = '';
      toast(bi('Horario revisado', 'Opening hours checked'));
    } catch (e) { toast(friendly(e.message), true); }
  };
}

/** Guardar el horario cuenta como revisarlo, aunque no cambie nada. */
const cerrHorarioGuardado = () => rpc('confirm_business_hours', { p_business: BIZ.id }).catch(() => null);
