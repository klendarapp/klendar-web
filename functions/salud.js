// /salud: una sola dirección para el vigilante de caídas (UptimeRobot, cada
// 5 min, correo a dev@ si no da 200).
//
// Contesta 200 si todo responde y 503 si algo falla o tarda más de 5 s:
//  · la web (esta Function);
//  · la base a la que apunta la web (`configure` en _lib/page.js): PostgREST +
//    Postgres (`base`), el servicio de acceso (`acceso`) y, con
//    `service_health()`, si las tareas programadas van (`tareas`: alguna
//    acabó bien en 5 min y ninguna lleva 3 fallos seguidos) y si quedan
//    conexiones libres (`conexiones`);
//  · producción, lo mismo (`prod`), mientras la web siga apuntando a dev: así
//    el vigilante que ya existe avisa también si prod deja de contestar o sus
//    cron fallan seguidos. El día que la web pase a prod, `prod` desaparece
//    solo (es la misma base).
//
// Desde fuera a propósito: si la base cae, no puede avisar de sí misma. Si
// `service_health` aún no existe en una base (migración sin subir), `tareas`
// dice «sin dato» y no cuenta como fallo.
//
// No dice nada que sirva a nadie más: solo «bien» o qué pieza falla. El
// resultado se guarda 30 s para que pedirla en bucle no cargue la base.

import { configure, supabasePublic } from './_lib/page.js';

// 9 s: prod en frío tardó 4,7 s la primera vez (2026-10-15) y UptimeRobot
// espera 30 s, así que hay margen sin dar falsos avisos.
const ESPERA_MS = 9000;
const RECUERDA_MS = 30000;
let ultimo = null; // { en, estado, cuerpo }

// Producción. La clave «publishable» es pública (la lleva la app); las
// variables SALUD_PROD_URL / SALUD_PROD_KEY de Cloudflare mandan sobre esto.
const PROD = {
  url: 'https://hcxurneiftwyxuebpndf.supabase.co',
  key: 'sb_publishable_k8KYqQGIYsoI38kZzaeK3A_vPJ0PdJK',
};

async function pide(url, init) {
  const inicio = Date.now();
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(ESPERA_MS) });
    let cuerpo = null;
    try { cuerpo = await r.json(); } catch { /* sin cuerpo */ }
    return { ok: r.ok, status: r.status, cuerpo, ms: Date.now() - inicio };
  } catch {
    return { ok: false, status: 0, cuerpo: null, ms: Date.now() - inicio };
  }
}

/** Las piezas de una base: { base, acceso, tareas, conexiones, ms }. */
async function mira({ url, key }) {
  const cabeceras = { apikey: key, 'content-type': 'application/json' };
  const [base, acceso, salud] = await Promise.all([
    pide(`${url}/rest/v1/rpc/current_user_is_adult`, { method: 'POST', headers: cabeceras, body: '{}' }),
    pide(`${url}/auth/v1/health`, { headers: cabeceras }),
    pide(`${url}/rest/v1/rpc/service_health`, { method: 'POST', headers: cabeceras, body: '{}' }),
  ]);
  const de = (campo) => {
    if (salud.ok) return salud.cuerpo?.[campo] === 'bien' ? 'bien' : 'fallo';
    // 404: la función aún no está en esa base. Si la base no contesta, ya
    // lo dice `base`.
    return salud.status === 404 || !base.ok ? 'sin dato' : 'fallo';
  };
  return {
    base: base.ok ? 'bien' : 'fallo',
    acceso: acceso.ok ? 'bien' : 'fallo',
    tareas: de('tareas'),
    conexiones: de('conexiones'),
    ms: Math.max(base.ms, acceso.ms, salud.ms),
  };
}

const bienTodo = (p) => Object.entries(p).every(([k, v]) => k === 'ms' || v !== 'fallo');

export async function onRequestGet({ env }) {
  if (!ultimo || Date.now() - ultimo.en > RECUERDA_MS) {
    configure(env);
    const web = supabasePublic();
    const prod = { url: env?.SALUD_PROD_URL || PROD.url, key: env?.SALUD_PROD_KEY || PROD.key };
    const otraBase = web.url.replace(/\/+$/, '').toLowerCase() !== prod.url.replace(/\/+$/, '').toLowerCase();
    const [suya, deProd] = await Promise.all([mira(web), otraBase ? mira(prod) : null]);
    const bien = bienTodo(suya) && (!deProd || bienTodo(deProd));
    ultimo = {
      en: Date.now(),
      estado: bien ? 200 : 503,
      cuerpo: JSON.stringify({
        estado: bien ? 'bien' : 'fallo',
        web: 'bien',
        ...suya,
        ...(deProd ? { prod: deProd } : {}),
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
