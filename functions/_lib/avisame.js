import { esc, html, rpc } from './page.js';
import { guard, publicPage } from './public.js';

// Los enlaces del correo de «Avísame cuando Klendar llegue» (crecer,
// 2026-10-14; los manda la Edge Function `city-waitlist`):
//   /avisame/confirmar/<token>?lang=…  → confirmar el correo (doble confirmación)
//   /avisame/baja/<token>?lang=…       → borrarse de la lista
// Como /baja/<token>: abrir el enlace (GET) solo pregunta, porque los
// antivirus y los correos que abren los enlaces por su cuenta lo harían sin
// que la persona pulsase nada; lo hace el POST (el botón de la página, o la
// «baja en un clic» de Gmail y Outlook, RFC 8058). Sin índice ni caché, el
// testigo nunca en la canónica. Español o inglés según `?lang=` (los correos
// van en 8 idiomas; catalán, gallego y euskera ven la española y francés,
// alemán e italiano la inglesa, como el resto de páginas públicas). Una
// pregunta y una respuesta sueltas: centradas (`.vacio`).

/** El idioma de la página a partir del `?lang=` del correo. */
export const idiomaAvisame = (url) => (['en', 'fr', 'de', 'it'].includes(String(url.searchParams.get('lang') || '').slice(0, 2)) ? 'en' : 'es');

const TEXTOS = {
  confirmar: {
    es: {
      title: 'Confirma tu correo', body: 'Pulsa el botón y te avisaremos una sola vez, cuando Klendar llegue a tu zona.',
      go: 'Confirmar', no: 'Ahora no',
      ok: (z) => `Listo: te avisaremos cuando Klendar llegue a ${z || 'tu zona'}`,
      okBody: 'Una sola vez. En cada correo que te mandemos tendrás el enlace para borrarte.',
    },
    en: {
      title: 'Confirm your email', body: "Press the button and we'll let you know once, when Klendar arrives in your area.",
      go: 'Confirm', no: 'Not now',
      ok: (z) => `Done: we'll let you know when Klendar arrives in ${z || 'your area'}`,
      okBody: "Just once. Every email we send you has a link to remove yourself.",
    },
  },
  baja: {
    es: {
      title: 'Borrarte de la lista', body: 'No te avisaremos cuando Klendar llegue a tu zona y tu correo saldrá de la lista.',
      go: 'Borrarme', no: 'Seguir en la lista',
      ok: () => 'Te hemos borrado de la lista',
      okBody: 'No volverás a recibir nada por esto. Si cambias de idea, puedes volver a apuntarte desde Descubre.',
    },
    en: {
      title: 'Remove yourself from the list', body: "We won't let you know when Klendar arrives in your area and your email will come off the list.",
      go: 'Remove me', no: 'Stay on the list',
      ok: () => "We've removed you from the list",
      okBody: "You won't get anything else about this. If you change your mind, you can sign up again from Discover.",
    },
  },
};
const MALO = {
  es: { title: 'Ese enlace ya no vale', body: 'A lo mejor ya se usó o ha caducado (lo que no se confirma se borra a los 7 días). Puedes volver a pedirlo desde Descubre.' },
  en: { title: 'That link no longer works', body: "Maybe it was already used or it has expired (anything not confirmed is deleted after 7 days). You can ask again from Discover." },
};

const pagina = (lang, title, description, body) => html(publicPage({
  contador: false, privada: true,
  lang, path: '/avisame/', title, description, body,
  head: '<meta name="robots" content="noindex, nofollow">',
}), 200, 'no-store');

/** GET: solo la pregunta, con el botón que hace el POST. */
export function preguntaAvisame(ctx, que) {
  const url = new URL(ctx.request.url);
  const lang = idiomaAvisame(url);
  const en = lang === 'en';
  const S = TEXTOS[que][lang];
  const token = String(ctx.params.token || '').slice(0, 64);
  const accion = `/avisame/${que}/${encodeURIComponent(token)}${url.searchParams.get('lang') ? `?lang=${encodeURIComponent(String(url.searchParams.get('lang')).slice(0, 2))}` : ''}`;
  const body = `
  <section class="vacio">
    <h1>${esc(S.title)}</h1>
    <p>${esc(S.body)}</p>
    <form class="vacio-botones" method="post" action="${esc(accion)}">
      <button class="pill accent" type="submit">${esc(S.go)}</button>
      <a class="pill" href="/${en ? 'en/' : ''}">${esc(S.no)}</a>
    </form>
  </section>`;
  return pagina(lang, S.title, S.body, body);
}

/** POST: confirmar (`confirm_city_waitlist`) o borrarse (`leave_city_waitlist`). */
export function haceAvisame(ctx, que) {
  const url = new URL(ctx.request.url);
  const lang = idiomaAvisame(url);
  return guard(lang, url.pathname, async () => {
    const en = lang === 'en';
    const token = String(ctx.params.token || '').slice(0, 64);
    const r = /^[A-Za-z0-9_-]{20,64}$/.test(token)
      ? await rpc(que === 'confirmar' ? 'confirm_city_waitlist' : 'leave_city_waitlist', { p_token: token })
      : { ok: false };
    const ok = r?.ok === true;
    const S = TEXTOS[que][lang];
    const titulo = ok ? S.ok(r.zone ? String(r.zone) : '') : MALO[lang].title;
    const texto = ok ? S.okBody : MALO[lang].body;
    const body = `
  <section class="vacio">
    <h1>${esc(titulo)}</h1>
    <p>${esc(texto)}</p>
    <div class="vacio-botones"><a class="pill accent" href="/${en ? 'en/discover/' : 'descubre/'}">${esc(en ? 'Go to Discover' : 'Ir a Descubre')}</a></div>
  </section>`;
    return pagina(lang, titulo, texto, body);
  });
}
