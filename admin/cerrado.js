/* «Estaba cerrado» en la ficha de un negocio del admin (migración
 * 20261229100000 de la app): si su ficha dice «Horario sin confirmar»,
 * cuántas personas lo encontraron cerrado en 14 días, cuándo (nunca quién)
 * y cuándo revisó el horario. */
'use strict';

async function cerradoEnFicha(caja, id) {
  if (!caja) return;
  const d = await rpc('admin_business_closed_reports', { p_business: id });
  if (!d) return;
  const en = I18N.lang === 'en';
  const avisos = d.reports_30d || [];
  // Nada que contar: no ocupa sitio.
  if (!avisos.length && !d.unconfirmed) return;
  const cuando = (local) => {
    const f = new Date(`${local}:00Z`);
    return `${f.toLocaleDateString(LOC(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })} · ${local.slice(11, 16)}`;
  };
  caja.innerHTML = `<div class="card"><h2>${en ? '“It was closed”' : '«Estaba cerrado»'}</h2>
    <dl class="kv">
      <dt>${en ? 'Page' : 'Ficha'}</dt><dd>${d.unconfirmed
    ? `<span class="tag warn">${en ? 'Opening hours not confirmed' : 'Horario sin confirmar'}</span>`
    : `<span class="tag ok">${en ? 'Hours OK' : 'Horario sin avisos pendientes'}</span>`}</dd>
      <dt>${en ? '“It was closed” (14 days)' : '«Estaba cerrado» (14 días)'}</dt><dd>${en ? `${d.people_14d} people` : `${d.people_14d} personas`}</dd>
      <dt>${en ? 'Hours checked' : 'Horario revisado'}</dt><dd>${d.confirmed_at ? esc(fmtDay(d.confirmed_at)) : '—'}</dd>
    </dl>
    ${avisos.length ? `<p class="muted small" style="margin:8px 0 4px">${en ? 'Reports in the last 30 days (local time; never who):' : 'Avisos de los últimos 30 días (hora del local; nunca quién):'}</p>
      <p class="small" style="margin:0">${avisos.map((a) => esc(cuando(a))).join(' · ')}</p>` : ''}
  </div>`;
}
