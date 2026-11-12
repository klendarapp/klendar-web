/* Administración → Sistema → «Automático»: el interruptor y el coste de «Rellenar desde una foto» (migración
 * 20261270700000 de la app; RUNBOOK §4zg) y de «Rellenar desde un enlace o un texto» (20261278400000, §4zl). Lo estimado es una cuenta sin medir: lo mide `tool/foto_prueba_real.mjs`.
 *
 * Va después de piloto.js y usa lo suyo (`PAGES`, `rpc`, `esc`, `I18N`…).
 */
'use strict';

{
  const automaticoSinFoto = PAGES.automatico;
  PAGES.automatico = async (v, param) => {
    await automaticoSinFoto(v, param);
    const hueco = document.createElement('div');
    hueco.className = 'card';
    hueco.style.marginTop = '12px';
    const cabeza = v.querySelector('.card');
    if (cabeza) cabeza.after(hueco); else v.append(hueco);
    const en = I18N.lang === 'en';
    const euros = (n, d = 2) => `${Number(n || 0).toLocaleString(en ? 'en-GB' : 'es-ES', { minimumFractionDigits: d, maximumFractionDigits: Math.max(d, 4) })} €`;
    const pinta = (d) => {
      hueco.innerHTML = `<h2>${en ? 'Fill in from a photo' : 'Rellenar desde una foto'} <span class="tag ${d.enabled ? 'ok' : 'dim'}">${d.enabled ? (en ? 'on' : 'encendido') : (en ? 'off' : 'apagado')}</span></h2>
        <div class="item" style="grid-template-columns:1fr auto"><div style="min-width:0">
          <div class="meta">${en ? 'The owner takes a photo of a poster or menu and the form fills itself; they check and publish. Sent to Claude (Anthropic). Texts published on 12-11-2026.' : 'El dueño hace una foto a un cartel o carta y se rellena el formulario; él lo revisa y lo publica. Va a Claude (Anthropic). Textos publicados el 12-11-2026.'}</div>
          <div class="meta">${en ? 'This month' : 'Este mes'}: ${esc(euros(d.spent_eur, 3))} / ${esc(euros(d.cap_eur))} · ${esc(String(d.calls))} ${en ? 'photos' : 'fotos'}${d.avg_eur != null ? ` · ${en ? 'average' : 'media'} ${esc(euros(d.avg_eur, 4))}` : ''}</div>
          <div class="meta">${en ? 'Estimated, not measured' : 'Estimado, sin medir'}: ${en ? 'poster' : 'cartel'} ≈ ${esc(euros(d.estimate_offer_eur, 4))} · ${en ? 'menu photo' : 'foto de carta'} ≈ ${esc(euros(d.estimate_menu_photo_eur, 4))}</div>
          <div class="meta">${en ? 'Per business and day' : 'Por negocio y día'}: ${esc(String(d.offer_day_cap))} ${en ? 'posters' : 'carteles'}, ${esc(String(d.menu_day_cap))} ${en ? 'menu photos' : 'fotos de carta'}${d.only_users ? ` · ${en ? 'only for' : 'solo para'} ${esc(String(d.only_users))} ${en ? 'accounts' : 'cuentas'}` : ''}</div>
        </div><div><button class="btn sm${d.enabled ? '' : ' ok'}" type="button" id="fotoInterruptor">${d.enabled ? (en ? 'Switch off' : 'Apagar') : (en ? 'Switch on' : 'Encender')}</button></div></div>`;
      const b = hueco.querySelector('#fotoInterruptor');
      b.onclick = () => esperando(b, async () => {
        await rpc('admin_photo_fill_set', { p_enabled: !d.enabled });
        pinta(await rpc('admin_photo_fill_overview'));
      });
    };
    try {
      pinta(await rpc('admin_photo_fill_overview'));
    } catch {
      hueco.remove();
    }

    // «Rellenar desde un enlace o un texto» (migración 20261278400000; RUNBOOK §4zl): su interruptor y su coste.
    const hueco2 = document.createElement('div');
    hueco2.className = 'card';
    hueco2.style.marginTop = '12px';
    (hueco.isConnected ? hueco : (cabeza || v.lastElementChild)).after(hueco2);
    const pinta2 = (d) => {
      hueco2.innerHTML = `<h2>${en ? 'Fill in from a link or text' : 'Rellenar desde un enlace o un texto'} <span class="tag ${d.enabled ? 'ok' : 'dim'}">${d.enabled ? (en ? 'on' : 'encendido') : (en ? 'off' : 'apagado')}</span></h2>
        <div class="item" style="grid-template-columns:1fr auto"><div style="min-width:0">
          <div class="meta">${en ? 'The business pastes a link (our server reads the page: https only, nothing internal, robots.txt) or some text, and the form or a list of events fills itself; they check and publish. Sent to Claude (Anthropic). Texts published on 12-11-2026.' : 'El negocio pega un enlace (lee la página nuestro servidor: solo https, nada interno, robots.txt) o un texto, y se rellena el formulario o una lista de eventos; él lo revisa y lo publica. Va a Claude (Anthropic). Textos publicados el 12-11-2026.'}</div>
          <div class="meta">${en ? 'This month' : 'Este mes'}: ${esc(euros(d.spent_eur, 3))} / ${esc(euros(d.cap_eur))} · ${esc(String(d.calls))} ${en ? 'readings' : 'lecturas'}${d.avg_eur != null ? ` · ${en ? 'average' : 'media'} ${esc(euros(d.avg_eur, 4))}` : ''}</div>
          <div class="meta">${en ? 'Estimated, not measured' : 'Estimado, sin medir'}: ${en ? 'one event' : 'un evento'} ≈ ${esc(euros(d.estimate_one_eur, 4))} · ${en ? 'a whole agenda' : 'una agenda entera'} ≈ ${esc(euros(d.estimate_agenda_eur, 4))}</div>
          <div class="meta">${en ? 'Per business and day' : 'Por negocio y día'}: ${esc(String(d.day_cap))} ${en ? 'readings' : 'lecturas'} · ${en ? 'up to' : 'hasta'} ${esc(String(d.max_events))} ${en ? 'events each' : 'eventos cada una'}${d.only_users ? ` · ${en ? 'only for' : 'solo para'} ${esc(String(d.only_users))} ${en ? 'accounts' : 'cuentas'}` : ''}</div>
        </div><div><button class="btn sm${d.enabled ? '' : ' ok'}" type="button" id="enlaceInterruptor">${d.enabled ? (en ? 'Switch off' : 'Apagar') : (en ? 'Switch on' : 'Encender')}</button></div></div>`;
      const b = hueco2.querySelector('#enlaceInterruptor');
      b.onclick = () => esperando(b, async () => {
        await rpc('admin_link_fill_set', { p_enabled: !d.enabled });
        pinta2(await rpc('admin_link_fill_overview'));
      });
    };
    try {
      pinta2(await rpc('admin_link_fill_overview'));
    } catch {
      hueco2.remove();
    }
  };
}
