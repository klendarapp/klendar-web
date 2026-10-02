import { configure, esc, html, rpc } from '../_lib/page.js';
import { guard, publicPage } from '../_lib/public.js';

// Darse de baja del correo semanal (o del resumen del negocio), sin entrar a
// la cuenta ni buscar nada. El enlace lleva un testigo que solo sirve para esto.
//
// Abrir el enlace (GET) solo pregunta: los antivirus y los correos que abren
// los enlaces por su cuenta daban de baja a gente sin que pulsara nada. La baja
// se hace con POST: el botón de esta página o la «baja en un clic» de Gmail y
// Outlook (cabecera List-Unsubscribe-Post, RFC 8058).
//
// Una pregunta y una confirmación sueltas: centradas (`.vacio`).

export async function onRequestGet(ctx) {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es';
  const en = lang === 'en';
  const token = String(ctx.params.token || '').slice(0, 64);
  const S = en
    ? { title: 'Unsubscribe', body: 'You will stop getting this email. You can switch it back on in Notification settings.', go: 'Unsubscribe', no: 'Keep getting it' }
    : { title: 'Darse de baja', body: 'Dejarás de recibir este correo. Se puede volver a encender en Ajustes de notificaciones.', go: 'Darme de baja', no: 'Seguir recibiéndolo' };
  const body = `
  <section class="vacio">
    <h1>${esc(S.title)}</h1>
    <p>${esc(S.body)}</p>
    <form class="vacio-botones" method="post" action="/baja/${encodeURIComponent(token)}${en ? '?lang=en' : ''}">
      <button class="pill accent" type="submit">${esc(S.go)}</button>
      <a class="pill" href="/${en ? 'en/' : ''}">${esc(S.no)}</a>
    </form>
  </section>`;
  return html(publicPage({
    contador: false,
    // Sin el testigo: `path` da la canónica y el og:url, y el enlace de
    // baja de cada persona no debe acabar en ningún índice ni caché.
    lang, path: '/baja/', title: S.title, description: S.body, body,
    head: '<meta name="robots" content="noindex, nofollow">',
  }), 200, 'no-store');
}

export async function onRequestPost(ctx) {
  configure(ctx.env);
  const lang0 = new URL(ctx.request.url).searchParams.get('lang') === 'en' ? 'en' : 'es';
  return guard(lang0, new URL(ctx.request.url).pathname, async () => {
  const token = String(ctx.params.token || '').slice(0, 64);
  const lang = new URL(ctx.request.url).searchParams.get('lang') === 'en' ? 'en' : 'es';
  const en = lang === 'en';

  const r = await rpc('email_optout', { p_token: token });
  const ok = r?.ok === true;
  const negocio = r?.kind === 'business';

  const S = en
    ? {
        title: ok ? 'Done' : 'That link no longer works',
        body: ok
          ? (negocio
            ? 'You won’t get your business’s weekly summary any more. You can turn it back on in Notification settings, in the app or on the website.'
            : 'You won’t get the weekly email any more. You can turn it back on in Notification settings, in the app or on the website.')
          : 'Maybe it was already used. You can also switch it off in Notification settings, in the app or on the website.',
        home: 'Go to Klendar',
      }
    : {
        title: ok ? 'Listo' : 'Ese enlace ya no vale',
        body: ok
          ? (negocio
            ? 'No volverás a recibir el resumen semanal de tu negocio. Si te arrepientes, se vuelve a encender en Ajustes de notificaciones, en la app o en la web.'
            : 'No volverás a recibir el correo semanal. Si te arrepientes, se vuelve a encender en Ajustes de notificaciones, en la app o en la web.')
          : 'A lo mejor ya se usó. También puedes apagarlo en Ajustes de notificaciones, en la app o en la web.',
        home: 'Ir a Klendar',
      };

  const body = `
  <section class="vacio">
    <h1>${esc(S.title)}</h1>
    <p>${esc(S.body)}</p>
    <div class="vacio-botones"><a class="pill accent" href="/${en ? 'en/' : ''}">${esc(S.home)}</a></div>
  </section>`;

  return html(publicPage({
    contador: false,
    lang,
    path: '/baja/',
    title: S.title,
    description: S.body,
    body,
    head: '<meta name="robots" content="noindex, nofollow">',
  }), 200, 'no-store');
  });
}

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
