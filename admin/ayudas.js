/* Administración → Sistema → «Automático»: interruptores y coste de las ayudas de IA para negocios (migración
 * 20261271500000 de la app; RUNBOOK §4zh). Lo estimado es una cuenta sin medir: lo mide `tool/ayudas_prueba_real.mjs`.
 *
 * Va después de foto.js y usa lo suyo (`PAGES`, `rpc`, `esc`, `I18N`, `esperando`…).
 */
'use strict';

{
  const automaticoSinAyudas = PAGES.automatico;
  PAGES.automatico = async (v, param) => {
    await automaticoSinAyudas(v, param);
    const hueco = document.createElement('div');
    hueco.className = 'card';
    hueco.style.marginTop = '12px';
    const cabeza = v.querySelector('.card');
    if (cabeza) cabeza.after(hueco); else v.append(hueco);
    const en = I18N.lang === 'en';
    const euros = (n, d = 2) => `${Number(n || 0).toLocaleString(en ? 'en-GB' : 'es-ES', { minimumFractionDigits: d, maximumFractionDigits: Math.max(d, 5) })} €`;
    const NOMBRES = {
      suggest_category: [en ? 'Suggested category and tags' : 'Categoría y etiquetas propuestas', en ? 'From the title and description, when creating a publication.' : 'A partir del título y la descripción, al crear una publicación.', en ? 'suggestion' : 'propuesta'],
      business_ideas: [en ? 'Business ideas' : 'Ideas para el negocio', en ? 'In a batch, once per business and week, only for those who turn them on.' : 'En lote, una vez por negocio y semana, solo para quien las enciende.', en ? 'business and week' : 'negocio y semana'],
      review_replies: [en ? 'Suggested review replies' : 'Respuestas propuestas a reseñas', en ? 'The review text, without a name, for the owner to edit. Requires the notice to reviewers.' : 'El texto de la reseña, sin nombre, para que el dueño lo edite. Necesita el aviso a quien escribe.', en ? 'draft' : 'borrador'],
    };
    const pinta = (d) => {
      hueco.innerHTML = `<h2>${en ? 'AI help for businesses' : 'Ayudas de IA para negocios'}</h2>
        <p class="meta">${en ? 'Sent to Claude (Anthropic). Texts published on 12-11-2026. Nothing is published or sent on its own.' : 'Va a Claude (Anthropic). Textos publicados el 12-11-2026. Nada se publica ni se envía solo.'}${d.only_users ? ` · ${en ? 'only for' : 'solo para'} ${esc(String(d.only_users))} ${en ? 'accounts' : 'cuentas'}` : ''}</p>
        ${d.uses.map((u) => `<div class="item" style="grid-template-columns:1fr auto"><div style="min-width:0">
          <b>${esc(NOMBRES[u.use][0])}</b> <span class="tag ${u.enabled ? 'ok' : 'dim'}">${u.enabled ? (en ? 'on' : 'encendido') : (en ? 'off' : 'apagado')}</span>
          <div class="meta">${esc(NOMBRES[u.use][1])}</div>
          <div class="meta">${en ? 'This month' : 'Este mes'}: ${esc(euros(u.spent_eur, 3))} / ${esc(euros(u.cap_eur))} · ${esc(String(u.calls))} ${en ? 'calls' : 'llamadas'}${u.avg_eur != null ? ` · ${en ? 'average' : 'media'} ${esc(euros(u.avg_eur, 5))}` : ''}</div>
          <div class="meta">${en ? 'Estimated, not measured' : 'Estimado, sin medir'}: ≈ ${esc(euros(u.estimate_eur, 5))} ${en ? 'per' : 'por'} ${esc(NOMBRES[u.use][2])}</div>
          ${u.use === 'business_ideas' ? `<div class="meta">${en ? 'Businesses with ideas on' : 'Negocios con ideas encendidas'}: ${esc(String(d.ideas_businesses))}</div>` : ''}
          ${u.use === 'review_replies' ? `<div class="meta">${en ? 'Notice to reviewers' : 'Aviso a quien escribe reseñas'}: ${d.review_notice_from ? `${en ? 'since' : 'desde'} ${esc(d.review_notice_from.slice(0, 10))}` : (en ? 'not shown: no review can be sent' : 'sin poner: no sale ninguna reseña')}</div>` : ''}
        </div><div class="ia-botones">
          ${u.use === 'review_replies' ? `<button class="btn sm" type="button" data-aviso>${d.review_notice_from ? (en ? 'Remove notice' : 'Quitar el aviso') : (en ? 'Show notice' : 'Poner el aviso')}</button>` : ''}
          <button class="btn sm${u.enabled ? '' : ' ok'}" type="button" data-uso="${esc(u.use)}" data-on="${u.enabled ? '1' : ''}" ${u.use === 'review_replies' && !u.enabled && !d.review_notice_from ? 'disabled' : ''}>${u.enabled ? (en ? 'Switch off' : 'Apagar') : (en ? 'Switch on' : 'Encender')}</button></div></div>`).join('')}`;
      hueco.querySelectorAll('[data-uso]').forEach((b) => {
        b.onclick = () => esperando(b, async () => {
          await rpc('admin_ai_help_set', { p_use: b.dataset.uso, p_enabled: !b.dataset.on });
          pinta(await rpc('admin_ai_help_overview'));
        });
      });
      const aviso = hueco.querySelector('[data-aviso]');
      if (aviso) {
        aviso.onclick = () => esperando(aviso, async () => {
          await rpc('admin_review_notice_set', { p_on: !d.review_notice_from });
          pinta(await rpc('admin_ai_help_overview'));
        });
      }
    };
    try {
      pinta(await rpc('admin_ai_help_overview'));
    } catch {
      hueco.remove();
    }
  };
}
