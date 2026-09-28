import { configure, pickLang, render, html, rpc } from '../_lib/page.js';
import { guard } from '../_lib/public.js';

// klendar.app/v/<código>: la dirección que va dentro del QR del cartel del
// local. Con la app instalada, Android la abre en la app (App Link); si no,
// llega aquí y lleva a la ficha del negocio en la web, con `?visita=` para
// que la ficha dé el sello de hoy si el local da sellos por visita (lo hace
// `/assets/visita.js`, con la sesión de «Tu cuenta»). Un código que el local
// ha cambiado abre igual la ficha: el aviso dice que ya no da sellos.

export const onRequestGet = (ctx) => {
  configure(ctx.env);
  const token = String(ctx.params.token || '');
  const lang = pickLang(ctx.request);
  const path = `/v/${token}`;
  return guard(lang, path, async () => {
    const info = /^[A-Za-z0-9_-]{16}$/.test(token)
      ? await rpc('visit_qr_info', { p_token: token })
      : null;
    const slug = info?.business?.slug || info?.slug || info?.business?.id || info?.business_id;
    if (!slug) {
      return html(render({ lang, path, kind: 'b', notFound: true }), 404, 'no-store');
    }
    const ficha = `${lang === 'en' ? '/en' : ''}/b/${encodeURIComponent(slug)}?visita=${encodeURIComponent(token)}`;
    // Relativa: se queda en el mismo sitio (klendar.app o el de pruebas).
    return new Response(null, {
      status: 302,
      headers: { Location: ficha, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    });
  });
};
