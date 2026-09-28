import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { friendLinkPage } from '../../_lib/views.js';

// La versión inglesa de klendar.app/amigo/<código> (ver functions/amigo/).

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  return guard('en', new URL(ctx.request.url).pathname, () => friendLinkPage(String(ctx.params.code || ''), 'en'));
};
