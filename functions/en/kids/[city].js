import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { kidsPage } from '../../_lib/explore.js';

// «Plans with kids in <city>». The page is built by `_lib/explore.js`; the
// Spanish version lives at /con-ninos/<ciudad>/.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  return guard('en', new URL(ctx.request.url).pathname, () => kidsPage(ctx.params.city, 'en'));
};

// HEAD igual que GET (el middleware quita el cuerpo).
export const onRequestHead = onRequestGet;
