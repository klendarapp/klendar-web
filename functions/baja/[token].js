import { configure, esc, html, rpc } from '../_lib/page.js';
import { publicPage } from '../_lib/public.js';

// Darse de baja del correo semanal: un clic desde el propio correo, sin
// entrar a la cuenta ni buscar nada. El enlace lleva un testigo que solo
// sirve para esto.

export async function onRequestGet(ctx) {
  configure(ctx.env);
  const token = String(ctx.params.token || '').slice(0, 64);
  const lang = new URL(ctx.request.url).searchParams.get('lang') === 'en' ? 'en' : 'es';
  const en = lang === 'en';

  const r = await rpc('email_optout', { p_token: token });
  const ok = r?.ok === true;

  const S = en
    ? {
        title: ok ? 'Done' : 'That link no longer works',
        body: ok
          ? 'You will not get the weekly email any more. You can switch it back on in the app, in Notification settings.'
          : 'Maybe it was already used. You can also switch it off in the app, in Notification settings.',
        home: 'Go to Klendar',
      }
    : {
        title: ok ? 'Listo' : 'Ese enlace ya no vale',
        body: ok
          ? 'No volverás a recibir el correo semanal. Si te arrepientes, se vuelve a encender en la app, en Ajustes de notificaciones.'
          : 'A lo mejor ya se usó. También puedes apagarlo en la app, en Ajustes de notificaciones.',
        home: 'Ir a Klendar',
      };

  const body = `
  <h1>${esc(S.title)}</h1>
  <p class="muted" style="max-width:560px">${esc(S.body)}</p>
  <p><a class="pill accent" href="/${en ? 'en/' : ''}">${esc(S.home)}</a></p>`;

  return html(publicPage({
    lang,
    path: `/baja/${esc(token)}/`,
    title: S.title,
    description: S.body,
    body,
    head: '<meta name="robots" content="noindex, nofollow">',
  }), 200, 'no-store');
}
