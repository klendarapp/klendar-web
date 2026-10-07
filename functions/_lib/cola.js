// klendar.app/cola/<código> y /en/queue/<código>: la página pública de la
// cola virtual de un local (la dirección del QR del «Cartel para la puerta»).
// La pinta `assets/cola.js` (el mismo código en el servidor y en el
// navegador); aquí se pide `queue_info` sin sesión y se envuelve en la página
// de siempre.
//
// La dirección lleva el código del cartel: ni buscadores (`noindex` en la
// etiqueta y en la cabecera), ni canonical ni hreflang, ni caché compartida,
// ni contador de visitas. Con una sesión de «Tu cuenta» guardada, la etiqueta
// del <head> lleva directamente al turno en vivo (`/app/#/cola/<código>`).

import { esc, html, rpc, supabasePublic } from './page.js';
import { publicPage } from './public.js';
import KC from '../../assets/cola.js';

export const COLA_JS_V = 1;

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
.cola-estado h2 { margin: 0 0 6px; font-size: 22px; }
.cola-estado p { margin: 0 0 6px; }
.cola-cuantos { font-family: var(--display); font-size: 28px; font-weight: 800; line-height: 1.2; letter-spacing: -.02em; }
.cola-estado .vacio-botones { margin-top: 18px; }
.cola-estado .cola-ayuda { font-size: 14px; margin: 14px auto 0; max-width: 40ch; }
</style>`;

export async function queuePublicPage(rawCode, lang) {
  const en = lang === 'en';
  const code = KC.codigoValido(rawCode);
  const path = `${en ? '/en/queue' : '/cola'}/${code || encodeURIComponent(String(rawCode || '').slice(0, 32))}`;
  const info = code ? await rpc('queue_info', { p_code: code }) : null;
  const vale = info?.ok === true && !!info.business;
  const sp = supabasePublic();
  const S = KC.T[en ? 'en' : 'es'];
  const descripcion = !vale ? S.badBody
    : !info.queue ? S.noneBody(info.business.name || '')
      : info.queue.status !== 'open' ? S.closedBody
        : S.waiting(Number(info.queue.waiting) || 0);
  const body = `
  <div id="cola-pub" class="cola-pub" data-code="${esc(code)}" data-estado="${vale ? 'ok' : 'bad'}">${KC.cuerpo(info, lang, code)}</div>
  ${vale ? `<script src="/assets/cola.js?v=${COLA_JS_V}" defer data-lang="${en ? 'en' : 'es'}" data-url="${esc(sp.url)}" data-key="${esc(sp.key)}"></script>` : ''}`;
  const res = html(publicPage({
    lang,
    path,
    title: KC.titulo(info, lang),
    description: descripcion,
    image: vale && /^https:\/\//.test(info.business.logo_url || '') ? info.business.logo_url : null,
    // Con sesión, al turno en vivo antes de pintar nada.
    head: `${HEAD}${code && vale ? `\n${KC.saltoConSesion(lang, code)}` : ''}`,
    body,
    contador: false,
    privada: true,
    // El idioma lo elige la persona: «ES» lleva a /cola/<código>?lang=es
    // (si no, el navegador inglés volvería a mandar al inglés).
    consulta: '?lang=es',
    bodyClass: 'cola-pagina',
  }), vale ? 200 : 404, 'private, no-store');
  res.headers.set('x-robots-tag', 'noindex, nofollow');
  return res;
}
