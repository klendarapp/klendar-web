// «Tus planes en tu calendario»: `/cal/<token>.ics`, la suscripción que el
// calendario de cada persona consulta cada pocas horas. El token es la llave
// (no hay sesión); uno que no existe, cambiado o desactivado da 404.
// Lo que entra lo decide la base (`calendar_feed`); el formato,
// `_lib/calendario.js`.

import { configure, supabasePublic, BackendDown } from '../_lib/page.js';
import { icsDePlanes, tokenDe } from '../_lib/calendario.js';

const PRIVADO = {
  // El enlace es secreto: ni buscadores, ni cachés compartidas, ni Referer.
  'x-robots-tag': 'noindex, nofollow',
  'referrer-policy': 'no-referrer',
};

const texto = (status, cuerpo) => new Response(cuerpo, {
  status,
  headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...PRIVADO },
});

export const onRequestGet = async (ctx) => {
  configure(ctx.env);
  const token = tokenDe(ctx.params.token);
  if (!token) return texto(404, 'Este enlace de calendario no existe.\n');
  try {
    // Sin `rpc()` de page.js: ese trata el null de la base como «no hay fila»
    // igual que un error; aquí null es «el token no existe» (404).
    const cfg = supabasePublic();
    const r = await fetch(`${cfg.url}/rest/v1/rpc/calendar_feed`, {
      method: 'POST',
      headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token }),
    });
    if (!r.ok) throw new BackendDown(`calendar_feed: ${r.status}`);
    const datos = await r.json();
    if (!datos) return texto(404, 'Este enlace de calendario no existe o se ha cambiado. Cópialo de nuevo en Klendar: Ajustes → Tus planes en tu calendario.\n');
    return new Response(icsDePlanes(datos), {
      status: 200,
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': 'inline; filename="klendar-planes.ics"',
        // Privado: un enlace cambiado deja de servir en cuanto se cambia.
        'cache-control': 'private, max-age=300',
        ...PRIVADO,
      },
    });
  } catch {
    // 503: el calendario lo vuelve a intentar sin borrar lo que tenía.
    return texto(503, 'Klendar no responde ahora mismo. Tu calendario lo volverá a intentar.\n');
  }
};

export const onRequestHead = onRequestGet;
