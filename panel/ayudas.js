/* Ayudas de IA para negocios en el panel, igual que en la app (GLOSARIO; RUNBOOK §4zh de la app):
 *
 *  · Categoría y etiquetas propuestas, en el formulario, sin que espere a nadie.
 *  · «Ideas para esta semana», en el Resumen y en «Primeros pasos».
 *  · «Proponer respuesta», en cada reseña.
 *
 * Nada se publica ni se envía solo: esto llena un formulario que el dueño tiene delante. Solo sale lo que la base dice
 * `available`: apagado (`app_config.ai.uses.*`), nada, y todo como siempre.
 *
 * Va después de panel.js y usa lo suyo (`rpc`, `sb`, `BIZ`, `modal`, `esc`, `toast`, `I18N`, `gestiona`…).
 */
'use strict';

window.KAyudas = (() => {
  const t = (s) => I18N.t(s);
  const CHISPA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>';
  const USOS = {
    suggest: {
      use: 'suggest_category',
      titulo: '¿Proponemos categoría y etiquetas con IA?',
      cuerpo: 'Para proponértelas, el título y la descripción que escribes se envían a Claude, la IA de Anthropic, una empresa de Estados Unidos. Klendar no guarda lo que se envía ni lo que contesta. Anthropic no lo usa para entrenar su IA y lo borra en 30 días; lo que sus sistemas marquen como grave puede guardarlo hasta 2 años. Procura no escribir datos de personas. Sin esto, el formulario sigue como siempre, y puedes cambiarlo en Ajustes.',
      casilla: 'Acepto que el título y la descripción se envíen a Claude (Anthropic, Estados Unidos)',
    },
    ideas: {
      use: 'business_ideas',
      titulo: '¿Preparamos tus ideas con IA?',
      cuerpo: 'Una vez por semana se envían a Claude, la IA de Anthropic, una empresa de Estados Unidos: tu categoría, los partidos que pones, la previsión del tiempo de tu zona, los festivos y tus publicaciones de los últimos meses con sus vistas y canjes en total. No se envía el nombre de tu negocio, tu dirección ni nada de tus clientes. Las ideas se guardan en Klendar unas semanas para enseñártelas. Anthropic no lo usa para entrenar su IA y lo borra en 30 días; lo que sus sistemas marquen como grave puede guardarlo hasta 2 años. Las apagas cuando quieras.',
      casilla: 'Acepto que esos datos se envíen a Claude (Anthropic, Estados Unidos) para preparar ideas',
    },
    replies: {
      use: 'review_replies',
      titulo: '¿Proponemos la respuesta con IA?',
      cuerpo: 'Para prepararla, el texto de la reseña y sus estrellas se envían a Claude, la IA de Anthropic, una empresa de Estados Unidos, sin el nombre ni nada más de quien la escribió. Klendar no guarda lo que se envía ni el borrador hasta que lo publiques tú. Anthropic no lo usa para entrenar su IA y lo borra en 30 días; lo que sus sistemas marquen como grave puede guardarlo hasta 2 años. Sin esto, contestas a mano como siempre, y puedes cambiarlo en Ajustes.',
      casilla: 'Acepto que el texto de las reseñas se envíe a Claude (Anthropic, Estados Unidos) para proponerme respuestas',
    },
  };

  const estado = async () => {
    try { return await rpc('ai_help_status', { p_business: BIZ.id }); } catch { return null; }
  };

  // El permiso, antes de mandar nada: una casilla clara, sin marcar. Sin ella, como siempre.
  const permiso = async (cual) => {
    const u = USOS[cual];
    const r = await modal({
      title: t(u.titulo),
      intro: `${esc(t(u.cuerpo))} <a class="link" href="/privacidad" target="_blank" rel="noopener">${esc(t('Más información'))}</a>`,
      html: `<label class="f foto-permiso"><input type="checkbox" name="ia_permiso" required><span>${esc(t(u.casilla))}</span></label>`,
      submit: t('Continuar'),
      cancel: t('Ahora no'),
    });
    if (!r) return false;
    try {
      await rpc('set_ai_consent', { p_granted: true, p_use: u.use });
      return true;
    } catch (e) {
      toast(friendly(e.message), true);
      return false;
    }
  };

  const llama = async (cuerpo) => {
    if (navigator.onLine === false) return { ok: false, why: 'offline' };
    try {
      const res = await sb.functions.invoke('ai-help', { body: { business_id: BIZ.id, ...cuerpo } });
      if (res.error) return { ok: false, why: res.error.name === 'FunctionsFetchError' ? 'offline' : 'failed' };
      return res.data || { ok: false, why: 'failed' };
    } catch {
      return { ok: false, why: 'offline' };
    }
  };

  // ── 1. Categoría y etiquetas, en el formulario ──────────────────────────
  /** `api`: lo del formulario (panel.js): campo, val, pon, tipo, categoria, nombreCategoria, refresca, cards. */
  const formulario = async (caja, api) => {
    if (!caja) return;
    const st = await estado();
    if (!st?.suggest?.available || !caja.isConnected) return;

    let temporizador = null;
    let llamadas = 0;
    let ultimo = null;
    let puesto = null;
    let deshecho = false;

    const estaIgual = (p) => ({
      cat: (api.campo('category_id')?.value || null) === (p?.category_id ?? null),
      solo: api.campo('solo_friendly').checked === (p?.tags.solo ?? false),
      kids: api.val('for_kids') === (p?.tags.kids ? 'si' : ''),
      setting: api.val('setting') === (p?.tags.setting ?? ''),
      charity: api.campo('charity').checked === (p?.tags.charity ?? false),
      cards: api.cards().sort().join() === [...(p?.tags.cards ?? [])].sort().join(),
    });

    const pinta = () => {
      if (!puesto) { caja.innerHTML = ''; return; }
      const partes = [
        puesto.category_id ? api.nombreCategoria(puesto.category_id) || puesto.category_name : null,
        puesto.tags.solo ? api.marcas.solo : null,
        puesto.tags.kids ? t('Apto para niños') : null,
        puesto.tags.setting === 'indoor' ? t('Bajo techo') : null,
        puesto.tags.setting === 'outdoor' ? t('Al aire libre') : null,
        puesto.tags.setting === 'both' ? `${t('Bajo techo')} · ${t('Al aire libre')}` : null,
        puesto.tags.charity ? api.marcas.charity : null,
        ...puesto.tags.cards.map((c) => api.marcas.card[c] || c),
      ].filter(Boolean);
      const resumen = partes.join(' · ');
      caja.innerHTML = `<p class="ia-puesto" role="status">${CHISPA}<span>${esc(I18N.t(`Propuesto con IA: ${resumen}. Se cambia en «Más opciones».`))}</span>
        <button type="button" class="linkbtn" id="iaDeshacer">${esc(t('Deshacer'))}</button></p>`;
      $('#iaDeshacer', caja).onclick = () => {
        const igual = estaIgual(puesto);
        if (igual.cat) api.categoria(null);
        if (igual.solo) api.campo('solo_friendly').checked = false;
        if (igual.kids) api.pon('for_kids', '');
        if (igual.setting) api.pon('setting', '');
        if (igual.charity) api.campo('charity').checked = false;
        if (igual.cards) api.ponCards([]);
        puesto = null;
        deshecho = true;
        clearTimeout(temporizador);
        api.refresca();
        pinta();
      };
    };

    // Solo se cambia lo que sigue como estaba: lo que ha tocado el dueño no se pisa.
    const aplica = (s) => {
      const igual = estaIgual(puesto);
      if (igual.cat) api.categoria(s.category_id);
      if (igual.solo) api.campo('solo_friendly').checked = s.tags.solo;
      if (igual.kids && !api.campo('adults_only')?.checked) api.pon('for_kids', s.tags.kids ? 'si' : '');
      if (igual.setting) api.pon('setting', s.tags.setting ?? '');
      if (igual.charity) api.campo('charity').checked = s.tags.charity;
      if (igual.cards) api.ponCards(s.tags.cards);
      puesto = s;
      api.refresca();
      pinta();
    };

    const pide = async () => {
      if (!caja.isConnected || deshecho || llamadas >= 2 || api.ocupado()) return;
      const titulo = String(api.val('title')).trim();
      const descripcion = String(api.val('description')).trim();
      const texto = `${titulo} ${descripcion}`.trim();
      if (texto === ultimo || (ultimo !== null && Math.abs(texto.length - ultimo.length) < 20)) return;
      if (texto.replace(/[^\p{L}\p{N}]/gu, '').length < (st.min_chars || 25)) return;
      const ahora = await estado();
      if (!ahora?.suggest?.available || !ahora.suggest.consent || !caja.isConnected) return;
      ultimo = texto;
      llamadas++;
      const r = await llama({ kind: 'suggest', title: titulo, description: descripcion, offer_kind: api.tipo() });
      // Si no hay nada, falla o no hay red: como si nada.
      if (r?.ok && r.suggestion && !deshecho && caja.isConnected) aplica(r.suggestion);
    };

    const alEscribir = () => {
      clearTimeout(temporizador);
      if (deshecho || llamadas >= 2) return;
      temporizador = setTimeout(pide, 2000);
    };
    api.campo('title').addEventListener('input', alEscribir);
    api.campo('description').addEventListener('input', alEscribir);

    // La primera vez, se ofrece; si dice que no, no vuelve a salir.
    if (!st.suggest.consent && !st.suggest.asked) {
      caja.innerHTML = `<div class="foto-caja ia-oferta">
        <p class="foto-tit">${esc(t('¿Te proponemos categoría y etiquetas?'))}</p>
        <p class="hint">${esc(t('Una IA lee el título y la descripción y te lo deja puesto. Tú lo cambias si quieres.'))}</p>
        <p class="foto-acciones"><button type="button" class="linkbtn" id="iaActivar">${esc(t('Activar'))}</button>
          <button type="button" class="linkbtn" id="iaNo">${esc(t('No, gracias'))}</button></p></div>`;
      $('#iaActivar', caja).onclick = async () => {
        if (await permiso('suggest')) { caja.innerHTML = ''; alEscribir(); }
      };
      $('#iaNo', caja).onclick = () => {
        rpc('set_ai_consent', { p_granted: false, p_use: USOS.suggest.use }).catch(() => {});
        caja.innerHTML = '';
      };
    }
  };

  // ── 2. Ideas ────────────────────────────────────────────────────────────
  let ideaPendiente = null;
  /** La idea que ha tocado el dueño: el formulario la coge una sola vez. */
  const tomaIdea = () => {
    const i = ideaPendiente;
    ideaPendiente = null;
    return i;
  };

  // Aquí mismo: la fuente de iconos del panel solo lleva los que usa.
  const svg = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONOS = {
    match: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 5h-5L8 10z"/>'),
    weather: svg('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>'),
    holiday: svg('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
    history: svg('<path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/>'),
  };

  const tarjeta = async (caja) => {
    if (!caja || !gestiona()) return;
    const pinta = async () => {
      let w;
      try { w = await rpc('business_ideas_week', { p_business: BIZ.id }); } catch { return; }
      if (!w?.available || !caja.isConnected) { caja.innerHTML = ''; return; }
      const cabeza = `<div class="ia-cabeza"><h2>${esc(t('Ideas para esta semana'))}</h2>
        ${w.enabled ? `<button type="button" class="linkbtn" id="iaApagar">${esc(t('Apagar las ideas'))}</button>` : ''}</div>`;
      if (!w.enabled) {
        caja.innerHTML = `<div class="card ia-ideas">${cabeza}
          <p class="hint">${esc(t('Cada semana, de 1 a 3 ideas según tus partidos, el tiempo, los festivos y lo que te ha funcionado. Tocas una y se abre el formulario relleno: tú la revisas y la publicas.'))}</p>
          <p class="foto-acciones"><button type="button" class="btn sm" id="iaEncender">${esc(t('Quiero ideas'))}</button></p></div>`;
        $('#iaEncender', caja).onclick = async () => {
          if (!w.consent && !(await permiso('ideas'))) return;
          const r = await rpc('set_business_ideas', { p_business: BIZ.id, p_on: true }).catch((e) => ({ ok: false, why: e.message }));
          if (!r?.ok) toast(t('No se ha podido guardar'), true);
          pinta();
        };
        return;
      }
      if (!w.ideas?.length) {
        const preparando = w.state === 'none' || w.state === 'working';
        caja.innerHTML = `<div class="card ia-ideas">${cabeza}<p class="hint">${esc(t(preparando ? 'Estamos preparando tus ideas. Vuelve en un rato.' : 'Esta semana no tenemos ideas para ti. El lunes, más.'))}</p></div>`;
      } else {
        const hayTiempo = w.ideas.some((i) => i.reason_kind === 'weather');
        caja.innerHTML = `<div class="card ia-ideas">${cabeza}
          <p class="hint">${esc(t('Propuestas con IA. Toca una: la revisas y pones el precio antes de publicarla.'))}</p>
          ${w.ideas.map((i, n) => `<div class="ia-idea">
            <button type="button" class="ia-abrir" data-idea-ia="${n}">${ICONOS[i.reason_kind] || ICONOS.history}
              <span><b>${esc(i.title)}</b>${i.description ? `<small>${esc(i.description)}</small>` : ''}${i.reason ? `<small class="muted">${esc(i.reason)}</small>` : ''}</span></button>
            <button type="button" class="btn-icon ia-quitar" data-quita-ia="${n}" aria-label="${esc(t('Quitar esta idea'))}" title="${esc(t('Quitar esta idea'))}">×</button></div>`).join('')}
          ${hayTiempo ? `<p class="hint">${esc(t('Previsión: MET Norway.'))}</p>` : ''}</div>`;
        $$('[data-idea-ia]', caja).forEach((b) => {
          b.onclick = () => {
            const i = w.ideas[+b.dataset.ideaIa];
            ideaPendiente = i;
            location.hash = i.kind === 'future_event' ? '#/publicaciones/nuevo-evento' : '#/publicaciones/nueva-flash';
          };
        });
        $$('[data-quita-ia]', caja).forEach((b) => {
          b.onclick = async () => {
            await rpc('dismiss_business_idea', { p_business: BIZ.id, p_index: w.ideas[+b.dataset.quitaIa].i }).catch(() => {});
            pinta();
          };
        });
      }
      const apagar = $('#iaApagar', caja);
      if (apagar) {
        apagar.onclick = async () => {
          if (!(await confirmDlg(t('¿Apagar las ideas de este negocio?'), '', { submit: t('Apagar las ideas') }))) return;
          await rpc('set_business_ideas', { p_business: BIZ.id, p_on: false }).catch(() => {});
          pinta();
        };
      }
    };
    await pinta();
  };

  // ── 3. Proponer respuesta ───────────────────────────────────────────────
  const MENSAJES = {
    offline: 'Sin conexión no se puede proponer. Contéstala a mano.',
    cap: 'Ahora no se pueden proponer más respuestas. Contéstala a mano.',
    failed: 'No hemos podido proponer una respuesta. Prueba otra vez o contéstala a mano.',
    manual: 'Esta reseña hay que contestarla a mano.',
  };
  const mensaje = (code) => {
    const k = ['cap', 'daily', 'person', 'off'].includes(code) ? 'cap'
      : code === 'offline' ? 'offline'
        : ['failed', 'forbidden'].includes(code) ? 'failed' : 'manual';
    return t(MENSAJES[k]);
  };

  /** ¿Enseñar «Proponer respuesta»? */
  const respuestasActivas = async () => (await estado())?.replies || null;

  /** El borrador, o null (ya se ha dicho por qué y se contesta a mano). */
  const proponer = async (reviewId, st) => {
    if (!st.consent) {
      if (!(await permiso('replies'))) return null;
      st.consent = true;
    }
    const r = await llama({ kind: 'reply', review_id: reviewId });
    if (r?.ok && r.reply?.draft) return r.reply;
    toast(mensaje(r?.why), true);
    return null;
  };

  /** Lo que se le dice encima del cuadro de responder. */
  const avisoBorrador = (b) => [t('Borrador propuesto con IA. Revísalo y cámbialo: no se envía hasta que lo publiques.'),
    b.delicate ? t('Esta reseña habla de algo serio: léela con calma antes de contestar.') : null].filter(Boolean).join(' ');

  return { formulario, tomaIdea, tarjeta, respuestasActivas, proponer, avisoBorrador, CHISPA };
})();
