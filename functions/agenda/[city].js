import { esc, html, pickLang, render, rpcAll } from '../_lib/page.js';
import { BASE, fmtLong, offerCard, publicPage } from '../_lib/public.js';

// /agenda/<ciudad>: lo que hay esta semana en una ciudad, sin app y sin cuenta.
//
// Esto es el «modo prensa/ayuntamiento»: una página que se puede enlazar desde
// el periódico local, la web del ayuntamiento o el grupo del barrio, y que
// Google indexa. No pide ubicación ni cuenta, no enseña nada de +18 y cada
// publicación lleva a su ficha.

const PRETTY = (s) => String(s || '').replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('es'));

export async function onRequestGet({ request, params }) {
  const lang = pickLang(request);
  const raw = decodeURIComponent(params.city || '').replace(/\/+$/, '');
  const path = `/agenda/${encodeURIComponent(raw.toLowerCase())}/`;
  const en = lang === 'en';
  if (!raw || raw.length > 60) return html(render({ lang, path, kind: 'o', notFound: true }), 404, 'no-store');

  const offers = await rpcAll('public_city_agenda', { p_city: raw, p_limit: 60 });
  const city = PRETTY(offers[0]?.city || raw);

  const S = en
    ? {
        h1: `What's on in ${city}`,
        lead: 'Flash deals and local events for the next few days. No account needed to look; the app is only for getting the code.',
        none: `Nothing published in ${city} yet. If you run a business here, you can be the first.`,
        biz: 'Publish your business', all: 'Other cities', app: 'Get the app',
        note: 'Updated as businesses publish. Times are local (Europe/Madrid).',
      }
    : {
        h1: `Qué hacer en ${city}`,
        lead: 'Ofertas flash y planes de los próximos días. Para mirar no hace falta cuenta; la app solo se usa para conseguir el código.',
        none: `Todavía no hay nada publicado en ${city}. Si tienes un negocio aquí, puedes ser el primero.`,
        biz: 'Publicar mi negocio', all: 'Otras ciudades', app: 'Descargar la app',
        note: 'Se actualiza según van publicando los negocios. Horas locales (Europe/Madrid).',
      };

  // Agrupado por día: una agenda se lee por días, no por relevancia.
  const days = new Map();
  for (const o of offers) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(o.starts_at));
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(o);
  }
  const dayTitle = (iso) => new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', {
    timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${iso}T12:00:00Z`));

  const body = `
  <p class="crumbs"><a href="/">Klendar</a> · <a href="/agenda/">${en ? 'Agenda' : 'Agenda'}</a></p>
  <h1>${esc(S.h1)}</h1>
  <p class="muted" style="max-width:620px">${esc(S.lead)}</p>
  ${offers.length
    ? [...days.entries()].map(([iso, list]) => `<section class="daygroup">
        <h3>${esc(dayTitle(iso))}</h3>
        <div class="olist">${list.map((o) => offerCard(o, lang)).join('')}</div>
      </section>`).join('')
    : `<p class="empty">${esc(S.none)}</p>`}
  <p class="muted" style="font-size:13px">${esc(S.note)}</p>
  <p><a class="pill accent" href="/">${S.app}</a> <a class="pill" href="/negocios/">${S.biz}</a></p>
  <p><a href="/agenda/">${S.all} →</a></p>`;

  const jsonLd = offers.length
    ? {
        '@context': 'https://schema.org', '@type': 'ItemList', name: S.h1, url: `${BASE}${path}`,
        numberOfItems: offers.length,
        itemListElement: offers.slice(0, 30).map((o, i) => ({
          '@type': 'ListItem', position: i + 1, url: `${BASE}/o/${o.id}`, name: o.title,
        })),
      }
    : null;

  return html(publicPage({
    lang, path, body,
    title: S.h1,
    description: offers.length
      ? `${offers.length} ${en ? 'plans and deals' : 'planes y ofertas'} · ${city} · ${fmtLong(offers[0].starts_at, lang)}`
      : S.none,
    image: offers.map((o) => (o.images || [])[0]).find(Boolean),
    head: jsonLd
      ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
      : '<meta name="robots" content="noindex, follow">',
  }), 200, 'public, max-age=300, s-maxage=900');
}
