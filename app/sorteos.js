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
 * Con los sorteos apagados (`app_config.giveaways`, migración 20261243100000
 * de la app; al lanzar, apagados por la norma 5.3 de Apple) las dos dicen
 * «Los sorteos no están disponibles» con salida a Descubre, y la bandeja y
 * los ajustes de notificaciones no enseñan los de sorteos
 * (`sorteosEnCuenta`, que también usa cuenta.js).
 *
 * Va después de app.js y usa lo suyo. Los textos, de
 * /assets/textos-sorteos.js (los mismos que la web pública).
 */
'use strict';

const KSo = globalThis.KlendarSorteos;
const sorteoLang = () => LANG;
const SORTEO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sorteoPagina = (id) => `${PUB_EN ? '/en/giveaway/' : '/sorteo/'}${encodeURIComponent(id)}`;

/** ¿Salen los sorteos en la web? Se pregunta una vez por carga de página; sin
 * respuesta, apagados. */
let SORTEOS_EN_CUENTA = null;
function sorteosEnCuenta() {
  if (!SORTEOS_EN_CUENTA) {
    SORTEOS_EN_CUENTA = sb.from('app_config').select('value').eq('key', 'giveaways').limit(1)
      .then(({ data }) => KSo.encendidos(data?.[0]?.value, 'web'), () => false);
  }
  return SORTEOS_EN_CUENTA;
}

/** «Los sorteos no están disponibles», con salida a Descubre. */
function sorteosApagadosCuenta() {
  const S = KSo.t(sorteoLang());
  pinta(pantallaVacia({ icono: 'local_activity', titulo: S.offTitle, h: 'h1', texto: S.offText,
    botones: `<a class="pill accent" href="${PUB_EN ? '/en/discover/' : '/descubre/'}">${esc(S.offGo)}</a>` }));
}

RUTAS.sorteos = async () => {
  if (!(await sorteosEnCuenta())) { sorteosApagadosCuenta(); return; }
  location.replace(PUB_EN ? '/en/giveaways/?mine=1' : '/sorteos/?mios=1');
};

RUTAS.sorteo = async ([id]) => {
  if (!(await sorteosEnCuenta())) { sorteosApagadosCuenta(); return; }
  const S = KSo.t(sorteoLang());
  const lista = PUB_EN ? '/en/giveaways/' : '/sorteos/';
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
