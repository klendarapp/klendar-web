import { configure } from '../../../_lib/page.js';
import { guard } from '../../../_lib/public.js';
import { venuePosterPage } from '../../../_lib/poster.js';

// Printable venue poster (see `_lib/poster.js`). `?mesa=1`: four per sheet,
// for the tables.
export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const url = new URL(ctx.request.url);
  return guard('en', url.pathname, () => venuePosterPage(ctx.params.token, 'en', url.searchParams.get('mesa') === '1'));
};
