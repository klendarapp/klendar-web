import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { posterPage } from '../../_lib/poster.js';

// Printable poster for a publication (see `_lib/poster.js`).
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  return guard('en', new URL(ctx.request.url).pathname, () => posterPage(ctx.params.id, 'en'));
};
