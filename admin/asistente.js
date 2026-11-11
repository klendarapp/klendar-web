/* Administración → Sistema → «Automático»: el asistente de ayuda (migración 20261273100000 de la app; RUNBOOK §4zi): interruptor,
 * gasto y lo que no supo responder, agrupado y sin datos: un tema de una lista cerrada y el apartado publicado más cercano.
 * Lo estimado es una cuenta sin medir: lo mide `tool/asistente_prueba_real.mjs`.
 *
 * Va después de ayudas.js y usa lo suyo (`PAGES`, `rpc`, `esc`, `I18N`, `esperando`…).
 */
'use strict';

{
  const automaticoSinAsistente = PAGES.automatico;
  PAGES.automatico = async (v, param) => {
    await automaticoSinAsistente(v, param);
    const hueco = document.createElement('div');
    hueco.className = 'card';
    hueco.style.marginTop = '12px';
    const cabeza = v.querySelector('.card');
    if (cabeza) cabeza.after(hueco); else v.append(hueco);
    const en = I18N.lang === 'en';
    const euros = (n, d = 2) => `${Number(n || 0).toLocaleString(en ? 'en-GB' : 'es-ES', { minimumFractionDigits: d, maximumFractionDigits: Math.max(d, 5) })} €`;
    const TEMAS = {
      cuenta: ['Cuenta', 'Account'], canjes: ['Canjes', 'Redeeming'], reservas: ['Reservas', 'Reservations'], planes: ['Planes', 'Plans'], avisos: ['Avisos', 'Alerts'],
      resenas: ['Reseñas', 'Reviews'], privacidad: ['Privacidad', 'Privacy'], alta_negocio: ['Alta de negocio', 'Business sign-up'], publicar: ['Publicar', 'Publishing'],
      panel_negocio: ['Panel', 'Dashboard'], equipo: ['Equipo', 'Team'], cobros: ['Cobros', 'Billing'], moderacion: ['Moderación', 'Moderation'], entidades: ['Entidades', 'Organisations'],
      tecnico: ['Algo técnico', 'Technical'], otro: ['Otra cosa', 'Other'],
    };
    const ESTADOS = [
      ['answer', 'Contestadas', 'Answered'], ['unknown', 'No lo sabía', "Didn't know"], ['off_topic', 'Fuera de tema', 'Off topic'], ['injection', 'Intentos de engañarlo', 'Injection attempts'],
      ['advice', 'Consejo que no da', 'Advice declined'], ['grave', 'Graves', 'Serious'], ['failed', 'Fallos', 'Failures'], ['cap', 'Tope', 'Cap reached'],
    ];
    let titulos = {};
    try {
      const a = await fetch('/assets/ayuda.json').then((r) => r.json());
      for (const tab of ['ti', 'negocios']) for (const e of a[en ? 'en' : 'es'][tab]) titulos[e.id] = e.q;
    } catch { titulos = {}; }
    const pinta = (d) => {
      const n = (k) => Number(d.states?.[k] || 0);
      hueco.innerHTML = `<h2>${en ? 'Help assistant' : 'Asistente de ayuda'} <span class="tag ${d.enabled ? 'ok' : 'dim'}">${d.enabled ? (en ? 'on' : 'encendido') : (en ? 'off' : 'apagado')}</span></h2>
        <p class="meta">${en ? 'Answers only from what is published, in the app and on the web. Sent to Claude (Anthropic). Approve the AS texts first. Conversations are not stored: only counters.' : 'Responde solo con lo publicado, en la app y en la web. Va a Claude (Anthropic). Antes, aprobar los textos AS. No se guardan conversaciones: solo contadores.'}${d.only_users ? ` · ${en ? 'only for' : 'solo para'} ${esc(String(d.only_users))} ${en ? 'accounts' : 'cuentas'}` : ''}</p>
        <div class="item" style="grid-template-columns:1fr auto"><div style="min-width:0">
          <div class="meta">${en ? 'This month' : 'Este mes'}: ${esc(euros(d.spent_eur, 3))} / ${esc(euros(d.cap_eur))} · ${esc(String(d.calls))} ${en ? 'calls' : 'llamadas'}${d.avg_eur != null ? ` · ${en ? 'average' : 'media'} ${esc(euros(d.avg_eur, 5))}` : ''}${d.at_cap ? ` · <b>${en ? 'cap reached: Help as usual' : 'tope acabado: la Ayuda de siempre'}</b>` : ''}</div>
          <div class="meta">${en ? 'Estimated, not measured' : 'Estimado, sin medir'}: ≈ ${esc(euros(d.estimate_warm_eur, 5))} ${en ? 'with the prompt cache warm' : 'con la caché caliente'}, ≈ ${esc(euros(d.estimate_cold_eur, 5))} ${en ? 'cold' : 'fría'}</div>
          <div class="meta">${en ? 'Limits' : 'Topes'}: ${esc(String(d.max_turns))} ${en ? 'questions per conversation' : 'preguntas por conversación'} · ${esc(String(d.user_day_cap))} ${en ? 'a day per person' : 'al día por persona'} · ${esc(String(d.anon_day_cap))} ${en ? 'without an account' : 'sin cuenta'} · ${esc(String(d.anon_global_day_cap))} ${en ? 'among everyone without an account' : 'entre todos los que van sin cuenta'}</div>
          <div class="meta">${ESTADOS.filter(([k]) => n(k)).map(([k, es_, en_]) => `${esc(en ? en_ : es_)}: ${esc(String(n(k)))}`).join(' · ') || (en ? 'No questions this month' : 'Ninguna pregunta este mes')}</div>
        </div><div class="ia-botones">
          <button class="btn sm${d.enabled ? '' : ' ok'}" type="button" data-asistente-on="${d.enabled ? '1' : ''}">${d.enabled ? (en ? 'Switch off' : 'Apagar') : (en ? 'Switch on' : 'Encender')}</button></div></div>
        <h3 style="margin:12px 0 4px">${en ? 'What it could not answer' : 'Lo que no supo responder'}</h3>
        <p class="meta">${en ? 'Grouped, last two months. Only a topic from a closed list and the closest published section: nothing anyone wrote. To improve Help.' : 'Agrupado, de los dos últimos meses. Solo un tema de una lista cerrada y el apartado publicado más cercano: nada de lo que alguien escribió. Para mejorar la Ayuda.'}</p>
        ${(d.gaps || []).length ? `<div class="asistente-huecos">${d.gaps.map((g) => `<div class="item" style="grid-template-columns:1fr auto"><div style="min-width:0"><b>${esc((TEMAS[g.topic] || [g.topic, g.topic])[en ? 1 : 0])}</b>${g.near ? ` <span class="meta">· ${en ? 'closest' : 'lo más cercano'}: ${/^norma-/.test(g.near) ? esc(g.near) : `<a href="${en ? '/en/faq' : '/preguntas'}#${esc(g.near)}" target="_blank" rel="noopener">${esc(titulos[g.near] || g.near)}</a>`}</span>` : ''}</div><span class="tag dim">${esc(String(g.n))}</span></div>`).join('')}</div>` : `<p class="meta">${en ? 'Nothing yet.' : 'Nada todavía.'}</p>`}`;
      const b = hueco.querySelector('[data-asistente-on]');
      b.onclick = () => esperando(b, async () => {
        await rpc('admin_assistant_set', { p_enabled: !b.dataset.asistenteOn });
        pinta(await rpc('admin_assistant_overview'));
      });
    };
    try {
      pinta(await rpc('admin_assistant_overview'));
    } catch {
      hueco.remove();
    }
  };
}
