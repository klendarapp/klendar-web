/* Administración → Sistema → «Traducción automática» (migración
 * 20261108100000 de la app, `admin_translation_usage`).
 *
 * Solo lectura y sencilla: si está encendida, el tope de caracteres al mes,
 * cuánto lleva gastado este mes (con la barra), los últimos 6 meses por
 * proveedor y cuántos textos hay en la caché. El tope y el interruptor se
 * cambian en `app_config.translation` (RUNBOOK); aquí no se tocan, para que
 * nadie suba el gasto sin querer.
 *
 * Va después de admin.js y usa lo suyo (`PAGES`, `rpc`, `table`, `fmtNum`,
 * `helpBox`, `LOC`, `esc`…).
 */
'use strict';

PAGES.traduccion = async (v) => {
  const en = I18N.lang === 'en';
  const d = await rpc('admin_translation_usage');
  const cfg = d.config || {};
  const meses = d.months || [];
  const tope = Number(cfg.monthly_char_cap || 0);
  const esteMes = new Date().toISOString().slice(0, 7);
  const gastadoMes = meses.filter((m) => String(m.month).slice(0, 7) === esteMes).reduce((a, m) => a + Number(m.chars || 0), 0);
  const pct = tope ? Math.min(100, Math.round((gastadoMes / tope) * 100)) : 0;
  const nombreMes = (s) => new Date(`${String(s).slice(0, 7)}-15T12:00:00Z`).toLocaleDateString(LOC(), { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const PROV = { google: 'Google', deepl: 'DeepL', same: en ? 'Already in that language' : 'Ya estaba en ese idioma' };
  const idiomas = (cfg.languages || []).map((l) => String(l).toUpperCase()).join(' · ');
  v.innerHTML = `
    <div class="page-head"><h1>Traducción automática</h1></div>
    ${helpBox('¿Qué hago aquí?', en
    ? '<p>What the automatic translation of what businesses write is costing (publications, news, the page description and the menu; never reviews or names). Each text is translated once per language and kept in the cache. When this month reaches the cap, nothing new is translated until the 1st and people see the original. The switch and the cap live in <code>app_config.translation</code> (RUNBOOK).</p>'
    : '<p>Lo que va gastando la traducción automática de lo que escriben los negocios (publicaciones, novedades, descripción de la ficha y carta; nunca reseñas ni nombres). Cada texto se traduce una vez por idioma y se guarda en la caché. Cuando el mes llega al tope, no se traduce nada nuevo hasta el día 1 y la gente ve el original. El interruptor y el tope están en <code>app_config.translation</code> (RUNBOOK).</p>')}
    <div class="kpis" style="margin-bottom:14px">
      <div class="kpi"><b>${cfg.enabled === false ? (en ? 'Off' : 'Apagada') : (en ? 'On' : 'Encendida')}</b><span>${esc(idiomas || '—')}</span></div>
      <div class="kpi"><b>${fmtNum(gastadoMes)}</b><span>${en ? 'characters this month' : 'caracteres este mes'}</span></div>
      <div class="kpi"><b>${fmtNum(tope)}</b><span>${en ? 'monthly cap' : 'tope al mes'}</span></div>
      <div class="kpi"><b>${fmtNum(d.cached)}</b><span>${en ? 'texts in the cache' : 'textos en la caché'}</span></div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <h2>${esc(nombreMes(esteMes))}</h2>
      <div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${en ? 'Share of the cap used' : 'Parte del tope gastada'}" style="height:10px;border-radius:5px;background:var(--soft);overflow:hidden"><div style="height:100%;width:${pct}%;background:${pct >= 90 ? 'var(--amber)' : 'var(--ink-2)'}"></div></div>
      <p class="muted small" style="margin:8px 0 0">${en ? `${pct}% of the cap.` : `El ${pct} % del tope.`}${pct >= 100 ? (en ? ' Nothing new is being translated until the 1st.' : ' No se traduce nada nuevo hasta el día 1.') : ''}</p>
    </div>
    <div class="card"><h2>Últimos 6 meses</h2>${table({
    cols: [
      { h: 'Mes', r: (x) => esc(nombreMes(x.month)) },
      { h: 'Proveedor', r: (x) => esc(PROV[x.provider] || x.provider) },
      { h: 'Caracteres', num: true, r: (x) => fmtNum(x.chars) },
      { h: 'Peticiones', num: true, r: (x) => fmtNum(x.requests) },
    ],
    rows: meses,
    empty: 'Todavía no se ha traducido nada.',
  })}</div>`;
};
