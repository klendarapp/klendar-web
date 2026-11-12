// La bandeja del admin para verla en un navegador sin tocar ninguna base: sirve la web local con
// config.js apuntando a un Supabase de mentira (este mismo servidor, /sb) que contesta con
// tools/_bandeja_datos.mjs, y una sesión de administrador inventada. Nada sale a *.supabase.co.
//
//   PORT=8898 node tools/bandeja_demo.mjs      → http://localhost:8898/admin#/resumen
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { contesta, estadoInicial, IDS } from './_bandeja_datos.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PORT = Number(process.env.PORT || 8898);
const SB = `http://localhost:${PORT}/sb`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ahora = Math.floor(Date.now() / 1000);
const USER = { id: IDS.admin, aud: 'authenticated', role: 'authenticated', email: 'admin@example.com', app_metadata: {}, user_metadata: { display_name: 'Admin' }, created_at: '2026-01-01T00:00:00Z' };
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: IDS.admin, role: 'authenticated', aal: 'aal2', exp: 4102444800, amr: [{ method: 'password', timestamp: ahora }] })}.x`;
const SESION = JSON.stringify({ access_token: TOKEN, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
let estado = estadoInicial();

const manda = (res, status, tipo, cuerpo) => { res.writeHead(status, { 'Content-Type': tipo, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); res.end(cuerpo); };
const json = (res, x) => manda(res, 200, 'application/json', JSON.stringify(x));

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') return manda(res, 204, 'text/plain', '');
  // El Supabase de mentira.
  if (url.pathname.startsWith('/sb/')) {
    const ruta = url.pathname.slice(3);
    let cuerpo = '';
    for await (const c of req) cuerpo += c;
    if (ruta.startsWith('/auth/v1/user')) return json(res, USER);
    if (ruta.startsWith('/auth/v1/')) return json(res, {});
    if (ruta.startsWith('/storage/v1/object/sign/')) return json(res, { signedURL: '/storage/v1/object/public/x.svg' });
    if (ruta.startsWith('/storage/v1/')) return manda(res, 200, 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#bbb"/></svg>');
    if (ruta.startsWith('/rest/v1/rpc/')) return json(res, contesta(ruta.split('/').pop(), cuerpo ? JSON.parse(cuerpo) : {}, estado));
    if (ruta.startsWith('/rest/v1/admin_users')) return json(res, [{ user_id: IDS.admin }]);
    return json(res, []);
  }
  // Para empezar de cero: /reinicia.
  if (url.pathname === '/reinicia') { estado = estadoInicial(); return manda(res, 200, 'text/plain', 'ok'); }
  if (url.pathname === '/config.js') {
    return manda(res, 200, TYPES['.js'], `window.KLENDAR_ENV = { name: 'demo', url: '${SB}', key: 'demo', turnstile: '' };`);
  }
  let ruta = url.pathname === '/admin' || url.pathname === '/admin/' ? '/admin.html' : decodeURIComponent(url.pathname);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const fichero = normalize(join(ROOT, ruta));
  if (!fichero.startsWith(normalize(ROOT))) return manda(res, 403, 'text/plain', 'no');
  try {
    let datos = await readFile(fichero);
    if (ruta === '/admin.html') {
      // La sesión de administrador de mentira, antes de que cargue nada.
      const s = `<script>try{localStorage.setItem('sb-klendar-admin-auth-token', ${JSON.stringify(SESION)});localStorage.setItem('sb-klendar-auth-token', ${JSON.stringify(SESION)});}catch(e){}</script>`;
      datos = Buffer.from(datos.toString('utf8').replace('<head>', `<head>${s}`));
    }
    return manda(res, 200, TYPES[extname(fichero)] || 'application/octet-stream', datos);
  } catch {
    return manda(res, 404, 'text/plain', 'no está');
  }
}).listen(PORT, () => console.log(`Bandeja de mentira en http://localhost:${PORT}/admin#/resumen`));
