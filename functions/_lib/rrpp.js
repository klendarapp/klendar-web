// klendar.app/rp/<código>: el enlace (o el QR) de un RRPP de un negocio.
//
// «Lista de Marta», el negocio, el aviso «Te apuntas a la lista de…», las
// ofertas de su lista y lo demás del local. Cada publicación lleva a su
// ficha con `?rp=<código>`; al conseguir el código desde ahí, «Tu cuenta» se
// lo pasa a la base (`start_redemption`) y la persona cuenta para ese RRPP.
// Las ofertas de RRPP no salen en ninguna otra parte (la base las quita).
//
// La página es de cada RRPP: ni se indexa (`noindex` en la etiqueta y en la
// cabecera), ni canonical ni hreflang, ni se guarda en una caché compartida,
// ni pasa por el contador de visitas (la dirección lleva el código). La pinta
// `assets/rrpp-enlace.js` (el mismo código en el servidor y en el
// navegador), que en el navegador además abre el enlace con la sesión de
// «Tu cuenta» si la hay (para apuntar a la persona en esta sesión del
// local). Fuera del horario de la lista, dice cuándo abre (`link_closed`).

import { esc, html, rpc, rpcAll, supabasePublic } from './page.js';
import { datosDeNegocios, publicPage } from './public.js';
import './tarjeta.js';
import KR from '../../assets/rrpp-enlace.js';

/** La respuesta: nunca en una caché compartida y nunca en los buscadores. */
function privada(cuerpo, status = 200) {
  const res = html(cuerpo, status, 'private, no-store');
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  return res;
}

const HEAD = '<meta name="robots" content="noindex, nofollow">\n<meta name="referrer" content="no-referrer">';

export async function promoterLinkPage(rawCode, lang) {
  const en = lang === 'en';
  const code = KR.codigoValido(rawCode);
  const path = `${en ? '/en' : ''}/rp/${code || encodeURIComponent(String(rawCode || '').slice(0, 32))}`;
  const S = KR.T[en ? 'en' : 'es'];
  const sp = supabasePublic();
  // El script del navegador: la sesión (apuntarse) y, si el servidor no ha
  // podido, abrir el enlace desde aquí.
  const script = (pendiente) => `${pendiente ? '<script src="/assets/zona.js?v=1" defer></script>\n<script src="/assets/tarjeta.js?v=9" defer></script>\n' : ''}<script src="/assets/rrpp-enlace.js?v=2" defer data-lang="${en ? 'en' : 'es'}" data-url="${esc(sp.url)}" data-key="${esc(sp.key)}"></script>`;
  const pagina = ({ body, title, description, status = 200, image }) => privada(publicPage({
    lang, path, body, title, description, image, head: HEAD, contador: false, privada: true,
  }), status);

  if (!code) {
    return pagina({ body: KR.noVale('link_not_found', null, lang), title: S.notFound, description: S.notFound, status: 404 });
  }
  const d = await rpc('promoter_link_open', { p_code: code });

  // El tope por conexión (desde el servidor, todas las visitas salen por la
  // misma): lo abre el navegador con la suya.
  if (d?.ok === false && d.error === 'rate_limited') {
    return pagina({
      body: `<div id="rp-lista" data-code="${esc(code)}" data-estado="pendiente"><p class="muted cargando">${esc(S.loading)}</p></div>${script(true)}`,
      title: 'Klendar', description: S.loading,
    });
  }
  if (!d || d.ok !== true) {
    // Fuera del horario de la lista: cuándo abre, en la hora del negocio.
    const tzCerrada = d?.error === 'link_closed' && d.business?.id
      ? (await datosDeNegocios([d.business.id]).catch(() => null))?.zonas?.get(d.business.id) : null;
    const txt = d?.error === 'link_closed' ? KR.abre(d.opens_at, lang, tzCerrada)
      : { link_paused: S.paused, link_expired: S.expired, link_inactive: S.inactive }[d?.error] || S.notFound;
    return pagina({
      body: KR.noVale(d?.error, d?.business, lang, d, tzCerrada), title: txt, description: txt,
      status: !d || d.error === 'link_not_found' ? 404 : 200,
    });
  }

  const b = d.business || {};
  const [normales, datos] = await Promise.all([
    rpcAll('business_offers', { p_id: b.id }).catch(() => []),
    datosDeNegocios([b.id]),
  ]);
  const tz = datos.zonas.get(b.id);
  const nombre = KR.nombreDe(d.promoter, lang);
  const body = `
  <p class="crumbs"><a href="/${en ? 'en/' : ''}">Klendar</a></p>
  <div id="rp-lista" data-code="${esc(code)}" data-estado="ok">${KR.cuerpo(d, normales, lang, tz)}</div>
  ${script(false)}`;
  const avatar = d.promoter && /^https:\/\//.test(d.promoter.avatar || '') ? d.promoter.avatar : null;
  return pagina({
    body,
    title: `${S.list(nombre)} · ${b.name || ''}`,
    description: S.notice(nombre, b.name || ''),
    image: b.cover || avatar || b.logo || null,
  });
}
