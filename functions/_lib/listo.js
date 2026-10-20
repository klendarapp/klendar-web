// klendar.app/listo/<código> y /en/ready/<código>: la página pública de «Te
// aviso cuando esté listo» (la dirección del QR del «Cartel para el
// mostrador»). La pinta `assets/listo.js`; aquí se pide `orders_info` sin
// sesión y se envuelve en la página de siempre. Como la de la cola: ni
// buscadores, ni canonical, ni caché compartida, ni contador de visitas; con
// una sesión de «Tu cuenta» guardada, la etiqueta del <head> lleva al pedido
// en vivo (`/app/#/listo/<código>`).

import { esc, html, rpc } from './page.js';
import { publicPage } from './public.js';
import KL from '../../assets/listo.js';

const HEAD = `<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<style>
.cola-pub { max-width: 560px; margin: 0 auto; padding: 4px 0 32px; }
.cola-cab { display: flex; gap: 14px; align-items: center; margin: 8px 0 18px; min-width: 0; }
.cola-cab > div { min-width: 0; }
.cola-cab h1 { margin: 2px 0; font-size: clamp(26px, 7vw, 34px); line-height: 1.15; overflow-wrap: anywhere; }
.cola-cab p { margin: 0; }
.cola-logo { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex: none; background: var(--soft); }
.cola-kicker { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); }
.cola-vacio .cola-kicker { margin-bottom: 4px; }
.cola-estado { text-align: center; border: 1px solid var(--glass-border); background: var(--glass); border-radius: 24px; padding: 24px 18px; }
.cola-cuantos { font-family: var(--display); font-size: 22px; font-weight: 800; line-height: 1.3; letter-spacing: -.01em; margin: 0 0 6px; }
.cola-estado .vacio-botones { margin-top: 18px; }
.cola-estado .cola-ayuda { font-size: 14px; margin: 14px auto 0; max-width: 40ch; }
</style>`;

export async function ordersPublicPage(rawCode, lang) {
  const en = lang === 'en';
  const code = KL.codigoValido(rawCode);
  const path = `${en ? '/en/ready' : '/listo'}/${code || encodeURIComponent(String(rawCode || '').slice(0, 32))}`;
  const info = code ? await rpc('orders_info', { p_code: code }) : null;
  const vale = info?.ok === true && !!info.business;
  const S = KL.T[en ? 'en' : 'es'];
  const res = html(publicPage({
    lang,
    path,
    title: KL.titulo(info, lang),
    description: vale ? S.intro : S.badBody,
    image: vale && /^https:\/\//.test(info.business.logo_url || '') ? info.business.logo_url : null,
    // Con sesión, al pedido en vivo antes de pintar nada.
    head: `${HEAD}${code && vale ? `\n${KL.saltoConSesion(lang, code)}` : ''}`,
    body: `<div id="listo-pub" class="cola-pub" data-code="${esc(code)}">${KL.cuerpo(info, lang, code)}</div>`,
    contador: false,
    privada: true,
    // El idioma lo elige la persona: «ES» lleva a /listo/<código>?lang=es.
    consulta: '?lang=es',
    bodyClass: 'cola-pagina',
  }), vale ? 200 : 404, 'private, no-store');
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  return res;
}
