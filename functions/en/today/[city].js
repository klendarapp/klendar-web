import { configure } from '../../_lib/page.js';
import { guard } from '../../_lib/public.js';
import { todayPage } from '../../_lib/views.js';

// «Things to do in <city> today»: lo que hay hoy en una ciudad. La página la arma
// `_lib/views.js`; la versión en el otro idioma vive en la ruta gemela
// (/hoy/<ciudad>/).

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  return guard('en', new URL(ctx.request.url).pathname, () => todayPage(ctx.params.city, 'en'));
};
