/* Administración → «Condiciones» (las condiciones para negocios; migración
 * 20261217100000_aviso_condiciones_negocios de la app).
 *
 * Reglamento (UE) 2019/1150 (P2B), art. 3.2: cada cambio en las condiciones
 * para negocios se avisa en un soporte duradero y se aplica, como pronto, 15
 * días después. Aquí:
 * - las versiones (identificador = fecha de publicación, como `VERSION` de
 *   build_legal.py), desde cuándo se aplican y el resumen ES/EN;
 *   la vigente es la última publicada (la que acepta quien se da de alta);
 * - «Registrar una versión»: identificador, fechas y resumen (la base no deja
 *   menos de 15 días de preaviso); se puede corregir mientras no se avise;
 * - «Avisar a los negocios»: con confirmación, una sola vez por versión. A
 *   cada negocio activo le llega un correo (`business-terms`, en el idioma
 *   del propietario) y el aviso fijo de «Mi negocio» y del panel;
 * - cuántos negocios la han visto o aceptado (al darse de alta o con
 *   «Entendido») y cómo van los correos.
 * El texto de las condiciones se publica antes en la web (build_legal.py).
 *
 * Va después de admin.js y usa lo suyo (`PAGES`, `rpc`, `modal`,
 * `confirmDlg`, `table`, `toast`, `esperando`, `helpBox`, `fmtDate`,
 * `fmtNum`, `diaMadridISO`, `tag`…).
 */
'use strict';

// Los errores de la base, en palabras (en inglés, en admin/i18n.js).
Object.assign(RPC_ERRORS, {
  invalid_version: 'El identificador es la fecha de publicación (AAAA-MM-DD), y si hay dos el mismo día, con un sufijo: 2026-11-02-b.',
  dates_required: 'Faltan las fechas.',
  notice_too_short: 'Se aplica como pronto 15 días después de publicarla (un mes si cambia el precio).',
  summary_required: 'Escribe el resumen en español y en inglés.',
  summary_too_long: 'El resumen cabe en 1.000 caracteres.',
  already_launched: 'El aviso de esta versión ya se mandó: no se cambia ni se repite.',
  not_published_yet: 'Aún no se ha publicado: se avisa el día que sale en la web.',
  already_applies: 'Ya se aplica: el aviso tenía que salir 15 días antes.',
});
const enC = () => I18N.lang === 'en';
/** «28 oct 2026» de un día AAAA-MM-DD (sin zona). */
const diaC = (s) => (s ? new Date(`${String(s).slice(0, 10)}T12:00:00Z`).toLocaleDateString(LOC(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const masDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

PAGES.condiciones = async (v) => {
  const en = enC();
  const d = await rpc('admin_business_terms');
  const hoy = d.today;
  const cifra = (n, es, eng) => `<b>${fmtNum(n || 0)}</b> ${esc(en ? eng : es)}`;
  const estado = (x) => {
    if (x.notice_launched_at) {
      return `${tag(en ? 'notified' : 'avisada', 'ok')}<span class="sub">${esc(fmtDate(x.notice_launched_at))}${x.launched_by ? ` · ${esc(x.launched_by)}` : ''}</span>`;
    }
    if (x.applies_on <= hoy) return tag(en ? 'applies (no notice)' : 'se aplica (sin aviso)', 'dim');
    if (x.published_on > hoy) return tag(en ? 'not published yet' : 'sin publicar', 'warn');
    return tag(en ? 'pending notice' : 'falta avisar', 'warn');
  };
  v.innerHTML = `
    <div class="page-head"><h1>${en ? 'Business terms' : 'Condiciones para negocios'}</h1><span class="spacer"></span>
      <button class="btn primary sm" type="button" id="nueva-version">${en ? 'Register a version…' : 'Registrar una versión…'}</button></div>
    ${helpBox(en ? 'What do I do here?' : '¿Qué hago aquí?', en
      ? `<p>Every change to the <a class="link" href="/en/business-terms/" target="_blank" rel="noopener">business terms</a> is notified to the businesses at least <b>15 days</b> before it applies (Regulation (EU) 2019/1150, art. 3.2; a month if the price changes). First publish the text on the website (<code>build_legal.py</code>, with its line in the change history); then register the version here with the same date and a short summary in plain language, and on that same day press <b>Notify businesses</b>: each active business gets an email in the owner's language and a fixed notice in “My business” and the dashboard, with a link to “Leave Klendar” at no cost before that date. One email per business and version, never two. A business that signs up accepts the current version (the last one published).</p>`
      : `<p>Cada cambio en las <a class="link" href="/negocios/" target="_blank" rel="noopener">condiciones para negocios</a> se avisa a los negocios al menos <b>15 días</b> antes de que se aplique (Reglamento (UE) 2019/1150, art. 3.2; un mes si cambia el precio). Primero se publica el texto en la web (<code>build_legal.py</code>, con su línea en el historial de cambios); después se registra aquí la versión con la misma fecha y un resumen corto en lenguaje llano, y ese mismo día se pulsa <b>Avisar a los negocios</b>: a cada negocio activo le llega un correo en el idioma del propietario y un aviso fijo en «Mi negocio» y en el panel, con el enlace a «Dar de baja el negocio» sin coste antes de esa fecha. Un correo por negocio y versión, nunca dos. Quien se da de alta acepta la versión vigente (la última publicada).</p>`)}
    <div class="kpis">
      <div class="kpi"><b>${esc(d.current || '—')}</b><span>${en ? 'current version' : 'versión vigente'}</span></div>
      <div class="kpi"><b>${fmtNum(d.audience || 0)}</b><span>${en ? 'active businesses (they get the notice)' : 'negocios activos (les llega el aviso)'}</span></div>
    </div>
    ${table({ cols: [
      { h: en ? 'Version' : 'Versión', r: (x) => `<span class="title">${esc(x.version)}${x.version === d.current ? ` ${tag(en ? 'current' : 'vigente', 'ok')}` : ''}<span class="sub">${en ? 'published' : 'publicada'} ${diaC(x.published_on)} · ${en ? 'applies from' : 'se aplica desde el'} ${diaC(x.applies_on)}</span></span>` },
      { h: en ? 'What changes' : 'Qué cambia', r: (x) => `<span class="small">${esc(en ? x.summary_en : x.summary_es)}</span>` },
      { h: en ? 'Notice' : 'Aviso', r: estado },
      { h: en ? 'Businesses' : 'Negocios', r: (x) => (x.notice_launched_at
        ? `<span class="small">${cifra(x.notified, 'avisados', 'notified')} · ${cifra(x.emailed, 'correos enviados', 'emails sent')}${x.emailing ? ` · ${cifra(x.emailing, 'enviándose', 'sending')}` : ''}${x.failed ? ` · ${cifra(x.failed, 'fallidos', 'failed')}` : ''}${x.not_emailed ? ` · ${cifra(x.not_emailed, 'sin correo (prueba, rebota o no tiene)', 'no email (test, bounces or none)')}` : ''}<br>${cifra(x.seen, 'lo han visto', 'have seen it')} · ${cifra(x.acknowledged, '«Entendido»', '“Got it”')} · ${cifra(x.signed_up, 'la aceptaron al darse de alta', 'accepted it when signing up')}</span>`
        : `<span class="small">${cifra(x.signed_up, 'la aceptaron al darse de alta', 'accepted it when signing up')}</span>`) },
      { h: '', r: (x) => (x.notice_launched_at || x.applies_on <= hoy ? ''
        : `<span class="actions"><button class="btn sm" type="button" data-editar="${esc(x.version)}">${en ? 'Edit…' : 'Corregir…'}</button>${x.published_on <= hoy ? `<button class="btn sm primary" type="button" data-avisar="${esc(x.version)}">${en ? 'Notify businesses…' : 'Avisar a los negocios…'}</button>` : ''}</span>`) },
    ], rows: d.versions || [], empty: en ? 'No versions yet.' : 'Aún no hay versiones.' })}`;

  const porVersion = Object.fromEntries((d.versions || []).map((x) => [x.version, x]));

  const editar = async (x) => {
    const r = await modal({
      title: x ? (en ? `Edit version ${x.version}` : `Corregir la versión ${x.version}`) : (en ? 'Register a version' : 'Registrar una versión'),
      intro: esc(en
        ? 'Publish the text on the website first. The summary is what businesses read in the email and the notice: what changes, in plain language, with the section numbers.'
        : 'Publica antes el texto en la web. El resumen es lo que leen los negocios en el correo y en el aviso: qué cambia, en lenguaje llano y con los apartados.'),
      fields: [
        { name: 'version', label: en ? 'Identifier (publication date, YYYY-MM-DD)' : 'Identificador (fecha de publicación, AAAA-MM-DD)', value: x?.version || hoy, required: true },
        { name: 'published_on', label: en ? 'Published on' : 'Publicada el', type: 'date', value: x?.published_on || hoy, required: true },
        { name: 'applies_on', label: en ? 'Applies from (15 days later at least)' : 'Se aplica desde (15 días después como pronto)', type: 'date', value: x?.applies_on || masDias(hoy, 15), required: true },
        { name: 'summary_es', label: en ? 'Summary in Spanish' : 'Resumen en español', type: 'textarea', value: x?.summary_es || '', required: true },
        { name: 'summary_en', label: en ? 'Summary in English' : 'Resumen en inglés', type: 'textarea', value: x?.summary_en || '', required: true },
      ],
      submit: en ? 'Save' : 'Guardar',
    });
    if (!r) return;
    try {
      await rpc('admin_save_business_terms_version', {
        p_version: r.version, p_published_on: r.published_on, p_applies_on: r.applies_on,
        p_summary_es: r.summary_es, p_summary_en: r.summary_en,
      });
      toast(en ? 'Version saved' : 'Versión guardada');
      route();
    } catch (e) { toast(e.message, true); }
  };

  const avisar = async (x) => {
    const dias = Math.round((new Date(`${x.applies_on}T12:00:00Z`) - new Date(`${hoy}T12:00:00Z`)) / 86400000);
    const ok = await confirmDlg(
      en ? `Notify version ${x.version}?` : `¿Avisar de la versión ${x.version}?`,
      esc(en
        ? `Each active business (${fmtNum(d.audience || 0)}, except those that already accepted it when signing up) will get an email in the owner's language and a fixed notice in “My business” and the dashboard: what changes, that it applies from ${diaC(x.applies_on)} and that they can leave Klendar at no cost before then. It can only be done once and the version can't be changed afterwards.`
        : `A cada negocio activo (${fmtNum(d.audience || 0)}, menos los que ya la aceptaron al darse de alta) le llegará un correo en el idioma del propietario y un aviso fijo en «Mi negocio» y en el panel: qué cambia, que se aplica desde el ${diaC(x.applies_on)} y que puede darse de baja sin coste antes. Solo se hace una vez y la versión ya no se podrá corregir.`),
      {
        submit: en ? 'Notify businesses' : 'Avisar a los negocios',
        warn: dias < 15 ? esc(en
          ? `Only ${dias} days left until it applies: the regulation asks for 15. Better to move the date (Edit…) first.`
          : `Quedan solo ${dias} días hasta que se aplique y el Reglamento pide 15. Mejor mueve antes la fecha (Corregir…).`) : undefined,
        confirmWord: en ? 'NOTIFY' : 'AVISAR',
      },
    );
    if (!ok) return;
    try {
      const res = await rpc('admin_launch_business_terms_notice', { p_version: x.version });
      toast(en ? `Notice sent to ${fmtNum(res?.businesses || 0)} businesses` : `Aviso enviado a ${fmtNum(res?.businesses || 0)} negocios`);
      route();
    } catch (e) { toast(e.message, true); }
  };

  $('#nueva-version', v).onclick = () => editar(null);
  $$('[data-editar]', v).forEach((b) => { b.onclick = () => esperando(b, () => editar(porVersion[b.dataset.editar])); });
  $$('[data-avisar]', v).forEach((b) => { b.onclick = () => esperando(b, () => avisar(porVersion[b.dataset.avisar])); });
};

// Si el admin ya pintó esta ruta antes de cargar este fichero (con la sesión
// guardada entra muy deprisa), se pinta otra vez, ya con «Condiciones».
if (ME && currentRoute()[0] === 'condiciones' && !$('#view #nueva-version')) route();
