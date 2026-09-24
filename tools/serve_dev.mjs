// Servidor de desarrollo mínimo: sirve los ficheros estáticos del repo y
// ejecuta las Pages Functions de /o/, /b/, /agenda/ y el sitemap de agendas.
// No sustituye a Cloudflare; es para ver las páginas mientras se escriben.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PORT = Number(process.env.PORT || 8788);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json',
};

const load = (p) => import(`file://${join(ROOT, p).replace(/\\/g, '/')}`);

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  try {
    let mod = null; let params = {};
    let m;
    // El prefijo /en/ elige la versión inglesa de la misma página.
    const en = path.startsWith('/en/') ? 'en/' : '';
    const rest = en ? path.slice(3) : path;
    if ((m = rest.match(/^\/o\/([^/]+)\/?$/))) { mod = await load(`functions/${en}o/[id].js`); params = { id: m[1] }; }
    else if ((m = rest.match(/^\/b\/([^/]+)\/?$/))) { mod = await load(`functions/${en}b/[id].js`); params = { id: m[1] }; }
    // En inglés la cartelera se llama «what's on», no «agenda».
    else if ((m = rest.match(/^\/(agenda|whats-on)\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'whats-on' : 'agenda'}/[city].js`); params = { city: m[2] }; }
    else if (/^\/(agenda|whats-on)\/?$/.test(rest)) { mod = await load(`functions/${en}${en ? 'whats-on' : 'agenda'}/index.js`); }
    // Explorar, categoria dentro de una ciudad y colecciones.
    else if ((m = rest.match(/^\/(explorar|explore)\/?$/))) { mod = await load(`functions/${en}${en ? 'explore' : 'explorar'}/index.js`); }
    else if ((m = rest.match(/^\/(agenda|whats-on)\/([^/]+)\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'whats-on' : 'agenda'}/[city]/[category].js`); params = { city: m[2], category: m[3] }; }
    else if ((m = rest.match(/^\/(coleccion|collection)\/([^/]+)\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'collection' : 'coleccion'}/[slug]/[city].js`); params = { slug: m[2], city: m[3] }; }
    else if ((m = rest.match(/^\/(coleccion|collection)\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'collection' : 'coleccion'}/[slug].js`); params = { slug: m[2] }; }
    else if ((m = path.match(/^\/baja\/([^/]+)\/?$/))) { mod = await load('functions/baja/[token].js'); params = { token: m[1] }; }
    else if ((m = path.match(/^\/widget\/([^/]+)\/?$/))) { mod = await load('functions/widget/[id].js'); params = { id: m[1] }; }
    else if (path === '/sitemap-agenda.xml') { mod = await load('functions/sitemap-agenda.xml.js'); }

    if (mod) {
      const request = new Request(`https://klendar.app${path}${url.search}`, { headers: { 'accept-language': 'es' } });
      const out = await mod.onRequestGet({ request, params, env: process.env });
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(await out.text());
      return;
    }

    const file = path.endsWith('/') ? `${path}index.html` : path;
    const buf = await readFile(join(ROOT, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch (e) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`404 ${e.message}`);
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
