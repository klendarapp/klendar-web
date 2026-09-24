import { esc, html, pickLang, rpcAll } from '../_lib/page.js';
import { publicPage } from '../_lib/public.js';

// /agenda/: las ciudades donde ya hay algo publicado.

export async function onRequestGet({ request }) {
  const lang = pickLang(request);
  const en = lang === 'en';
  const cities = (await rpcAll('public_cities', {})).filter((c) => c.city);

  const S = en
    ? {
        h1: 'Local agenda', lead: 'What is on in each city: flash deals and plans for the next few days. No account needed.',
        none: 'No city has anything published yet.', biz: 'Publish your business',
      }
    : {
        h1: 'Agenda local', lead: 'Lo que hay en cada ciudad: ofertas flash y planes de los próximos días. No hace falta cuenta.',
        none: 'Todavía no hay ninguna ciudad con publicaciones.', biz: 'Publicar mi negocio',
      };

  const body = `
  <p class="crumbs"><a href="/">Klendar</a></p>
  <h1>${S.h1}</h1>
  <p class="muted" style="max-width:620px">${S.lead}</p>
  ${cities.length
    ? `<div class="cities">${cities.map((c) => `<a href="/agenda/${encodeURIComponent(String(c.city).toLowerCase())}/">${esc(c.city)} <span class="muted">${c.n}</span></a>`).join('')}</div>`
    : `<p class="empty">${S.none}</p>`}
  <p><a class="pill" href="/negocios/">${S.biz}</a></p>`;

  return html(publicPage({
    lang, path: '/agenda/', body, title: S.h1, description: S.lead,
  }), 200, 'public, max-age=600, s-maxage=1800');
}
