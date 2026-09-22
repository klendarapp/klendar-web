// /legal/<documento>: lleva a la versión en el idioma del visitante.
//
// Es la URL que se da a terceros (Google, Apple, las tiendas, contratos): una
// sola dirección, estable, que no ata el documento a un idioma. Quien navega en
// inglés acaba en /en/…; el resto, en la versión española, que es la que
// prevalece legalmente.
//
// No se indexa (robots.txt la excluye): lo que buscan los buscadores son las
// páginas de cada idioma, que ya llevan canonical y hreflang.

const DOCS = {
  privacy: ['/privacidad/', '/en/privacy/'],
  terms: ['/terminos/', '/en/terms/'],
  'business-terms': ['/negocios/', '/en/business-terms/'],
  cookies: ['/cookies/', '/en/cookies/'],
  guidelines: ['/normas/', '/en/community-guidelines/'],
  'legal-notice': ['/aviso-legal/', '/en/legal-notice/'],
  'delete-account': ['/eliminar-cuenta/', '/en/delete-account/'],
  support: ['/soporte/', '/en/support/'],
};

export function onRequestGet({ request, params }) {
  const doc = DOCS[String(params.doc || '').toLowerCase()];
  if (!doc) return Response.redirect('https://klendar.app/', 302);
  // ?lang=en|es fuerza el idioma (útil para enlazar desde la app).
  const forced = new URL(request.url).searchParams.get('lang');
  const en = forced
    ? forced.toLowerCase().startsWith('en')
    : /(^|,)\s*en\b/i.test(request.headers.get('accept-language') || '');
  return new Response(null, {
    status: 302,
    headers: {
      location: 'https://klendar.app' + (en ? doc[1] : doc[0]),
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
      vary: 'accept-language',
    },
  });
}
