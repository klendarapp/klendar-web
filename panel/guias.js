/* Panel del negocio → publicar: «Añadir a «<Guía>»» (guías de temporada,
 * migración 20261283800000 de la app; lo mismo que la app,
 * `lib/features/guides/presentation/offer_guides_field.dart`).
 *
 * Sale mientras haya una guía abierta en la ciudad del negocio y lo que se
 * publica cae dentro de sus fechas (`business_guides`). Desmarcada de serie;
 * al editar, como esté. Solo lo que ven todos: con «Quién la ve» en otra
 * cosa, no sale (y la base tampoco deja). Si Klendar la quitó, sale marcada
 * como tal y sin poder tocarla. Se guarda al guardar la publicación
 * (`set_offer_guide`); si falla, ella queda guardada y se dice.
 *
 * Va después de panel.js y usa lo suyo (`$`, `esc`, `rpc`, `I18N`, `BIZ`,
 * `fromLocalInput`, `toast`).
 */
'use strict';

function guiasHtml() {
  return '<fieldset class="f plano guias-fila" id="guiasFila" hidden></fieldset>';
}

/**
 * `que()` da { kind, audiencia } del formulario en cada momento; `offerId`,
 * la publicación al editar. Devuelve { guarda(offerId, kind, ini, fin, audiencia) }
 * → true si todo bien.
 */
function guiasEngancha(v, offerId, que) {
  const caja = $('#guiasFila', v);
  let guias = [];
  const elegido = {};
  let pedido = 0;
  const titulo = (g) => (I18N.lang === 'en' ? g.title?.en || g.title?.es : g.title?.es || g.title?.en) || '';
  const fechas = () => {
    const f = new FormData($('#form', v));
    return { ini: fromLocalInput(f.get('start')), fin: fromLocalInput(f.get('end')) };
  };

  const pinta = () => {
    const visibles = que().audiencia === 'all' ? guias.filter((g) => g.fits || g.on || g.blocked) : [];
    caja.hidden = !visibles.length;
    caja.innerHTML = visibles.map((g) => {
      const marcada = !g.blocked && (elegido[g.id] ?? g.on);
      const quieta = g.blocked || (!g.fits && !marcada);
      return `<label class="opcion bl-fila"><input type="checkbox" data-guia="${esc(g.id)}" ${marcada ? 'checked' : ''} ${quieta ? 'disabled' : ''}>
        <span><b>${esc(I18N.t(`Añadir a «${titulo(g)}»`))}</b><br><small class="muted">${esc(I18N.t(g.blocked
          ? 'Klendar la ha quitado de esta guía.'
          : 'Sale en esta guía de temporada de Klendar mientras dure. Puedes quitarla cuando quieras.'))}</small></span></label>`;
    }).join('');
    caja.querySelectorAll('[data-guia]').forEach((c) => {
      c.onchange = () => { elegido[c.dataset.guia] = c.checked; };
    });
  };

  const pide = async (idOferta = offerId) => {
    const { ini, fin } = fechas();
    if (!ini) return [];
    return rpc('business_guides', {
      p_business: BIZ.id, p_kind: que().kind, p_start: ini, p_end: fin || null, p_offer: idOferta || null,
    }).catch(() => []);
  };

  let espera = null;
  const refresca = () => {
    clearTimeout(espera);
    espera = setTimeout(async () => {
      const n = ++pedido;
      const r = await pide();
      if (n !== pedido) return;
      guias = Array.isArray(r) ? r : [];
      pinta();
    }, 250);
  };
  v.addEventListener('change', (e) => { if (!e.target?.dataset?.guia) refresca(); });
  refresca();

  return {
    async guarda(idOferta) {
      const todoEl = que().audiencia === 'all';
      if (!Object.keys(elegido).length && todoEl) return true;
      const ahora = await pide(idOferta);
      if (!Array.isArray(ahora)) return false;
      let ok = true;
      for (const g of ahora) {
        const quiere = todoEl && (elegido[g.id] ?? g.on);
        if (quiere === g.on || g.blocked) continue;
        const r = await rpc('set_offer_guide', { p_offer: idOferta, p_guide: g.id, p_on: quiere }).catch(() => ({ ok: false }));
        if (r?.ok !== true) ok = false;
      }
      return ok;
    },
  };
}
