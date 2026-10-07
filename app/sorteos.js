/* «Tu cuenta» → sorteos (tanda C; migración 20261208100001_sorteos de la
 * app). La página de cada sorteo es la pública (/sorteo/<id>, /en/giveaway/
 * <id>): allí, con la sesión de este navegador, /assets/sorteo.js pinta lo
 * tuyo y participa, lo deja, acepta o renuncia. Aquí solo:
 *
 * - `#/sorteo/<id>`: lo que manda «Participar» sin sesión (y una
 *   notificación de un sorteo). Pide entrar; si aún puedes participar,
 *   participa (con la marca de que se pulsó en la web; si no, primero
 *   pregunta, `confirmaEnlace`) y vuelve a la página del sorteo.
 * - `#/sorteos`: a «En los que participas» de la lista pública.
 *
 * Va después de app.js y usa lo suyo. Los textos, de
 * /assets/textos-sorteos.js (los mismos que la web pública).
 */
'use strict';

const KSo = globalThis.KlendarSorteos;
const sorteoLang = () => (EN ? 'en' : 'es');
const SORTEO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sorteoPagina = (id) => `${EN ? '/en/giveaway/' : '/sorteo/'}${encodeURIComponent(id)}`;

RUTAS.sorteos = async () => {
  location.replace(EN ? '/en/giveaways/?mine=1' : '/sorteos/?mios=1');
};

RUTAS.sorteo = async ([id]) => {
  const S = KSo.t(sorteoLang());
  const lista = EN ? '/en/giveaways/' : '/sorteos/';
  if (!SORTEO_UUID.test(id || '')) {
    pinta(pantallaVacia({ icono: 'link', titulo: S.notHere, h: 'h1', texto: S.notHereText,
      botones: `<a class="pill accent" href="${lista}">${esc(S.title)}</a>` }));
    return;
  }
  const sid = id.toLowerCase();
  if (!exigeSesion(`sorteo/${sid}`)) return;
  const g = await llamar('giveaway_detail', { p_id: sid });
  if (!g || !g.id) {
    pinta(pantallaVacia({ icono: 'link', titulo: S.notHere, h: 'h1', texto: S.notHereText,
      botones: `<a class="pill accent" href="${lista}">${esc(S.title)}</a>` }));
    return;
  }
  const me = g.me || {};
  const puede = g.status === 'active' && !KSo.terminado(g) && !me.entered && !me.team && me.adult;
  if (puede) {
    const boton = g.requires_favorite && !me.favorite ? S.enterFav : S.enter;
    const sigue = await confirmaEnlace(`sorteo/${sid}`, {
      titulo: boton,
      que: `${S.word}: ${g.prize} · ${g.business?.name || ''}`,
      texto: S.free,
      boton,
      volver: sorteoPagina(sid),
    });
    if (!sigue) return;
    try {
      await llamar('giveaway_enter', { p_id: sid });
    } catch (e) {
      pinta(pantallaVacia({ icono: 'refresh', titulo: KSo.error(e.clave, sorteoLang()) || e.message || S.oops, h: 'h1',
        botones: `<a class="pill accent" href="${esc(sorteoPagina(sid))}">${esc(S.back)}</a>` }));
      return;
    }
  }
  // La página del sorteo, que ya enseña lo tuyo («Participas · tu número es el 37»).
  location.replace(sorteoPagina(sid));
};
