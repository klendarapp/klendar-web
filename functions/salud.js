// /salud: una sola dirección para el vigilante de caídas (UptimeRobot).
//
// Contesta 200 si la web (esta Function), la base (PostgREST + Postgres) y el
// servicio de acceso (GoTrue) de Supabase responden; 503 si alguno falla o
// tarda más de 5 s. Mira el mismo Supabase al que apunta la web (ver
// `configure` en _lib/page.js), así que el día que la web pase a prod vigila
// prod sin tocar nada.
//
// No dice nada que sirva a nadie más: solo «bien» o qué pieza falla. El
// resultado se guarda 30 s para que pedirla en bucle no cargue la base.

import { configure, supabasePublic } from './_lib/page.js';

const ESPERA_MS = 5000;
const RECUERDA_MS = 30000;
let ultimo = null; // { en, estado, cuerpo }

async function comprueba(nombre, url, init) {
  const inicio = Date.now();
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(ESPERA_MS) });
    return { nombre, ok: r.ok, ms: Date.now() - inicio };
  } catch {
    return { nombre, ok: false, ms: Date.now() - inicio };
  }
}

export async function onRequestGet({ env }) {
  if (!ultimo || Date.now() - ultimo.en > RECUERDA_MS) {
    configure(env);
    const { url, key } = supabasePublic();
    const cabeceras = { apikey: key, 'content-type': 'application/json' };
    const partes = await Promise.all([
      comprueba('base', `${url}/rest/v1/rpc/current_user_is_adult`, {
        method: 'POST', headers: cabeceras, body: '{}',
      }),
      comprueba('acceso', `${url}/auth/v1/health`, { headers: cabeceras }),
    ]);
    const bien = partes.every((p) => p.ok);
    ultimo = {
      en: Date.now(),
      estado: bien ? 200 : 503,
      cuerpo: JSON.stringify({
        estado: bien ? 'bien' : 'fallo',
        web: 'bien',
        ...Object.fromEntries(partes.map((p) => [p.nombre, p.ok ? 'bien' : 'fallo'])),
        ms: Math.max(...partes.map((p) => p.ms)),
      }),
    };
  }
  return new Response(ultimo.cuerpo, {
    status: ultimo.estado,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
}

// HEAD igual que GET (el middleware quita el cuerpo): comprobadores de enlaces
// y vigilantes de caídas preguntan con HEAD, y sin esto Cloudflare da 404.
export const onRequestHead = onRequestGet;
