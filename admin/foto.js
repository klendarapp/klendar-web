/* Administración → Sistema → «Automático»: el interruptor y el coste de «Rellenar desde una foto» (migración
 * 20261270700000 de la app; RUNBOOK §4zg). Lo estimado es una cuenta sin medir: lo mide `tool/foto_prueba_real.mjs`.
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
          <div class="meta">${en ? 'The owner takes a photo of a poster or menu and the form fills itself; they check and publish. Sent to Claude (Anthropic). Approve the FO texts first.' : 'El dueño hace una foto a un cartel o carta y se rellena el formulario; él lo revisa y lo publica. Va a Claude (Anthropic). Antes, aprobar los textos FO.'}</div>
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
  };
}
