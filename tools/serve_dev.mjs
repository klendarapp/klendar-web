// Servidor de desarrollo mínimo: sirve los ficheros estáticos del repo y
// ejecuta las Pages Functions de /o/, /b/ (por id o por dirección), /r/, /rp/, /v/, /amigo/, /cartel/, /agenda/,
// /hoy/, /con-ninos/, /partidos/ y los sitemaps de agenda y negocios.
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
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2',
};

// El token de Mapbox en producción vive en las variables de Cloudflare. En
// local, si no se ha puesto a mano, se toma el de la app (env/dev.json del
// repo hermano), que nunca se sube a ningún sitio.
if (!process.env.MAPBOX_TOKEN) {
  try {
    const dev = JSON.parse(await readFile(join(ROOT, '..', 'klendar', 'env', 'dev.json'), 'utf8'));
    if (dev.MAPBOX_ACCESS_TOKEN) process.env.MAPBOX_TOKEN = dev.MAPBOX_ACCESS_TOKEN;
  } catch { /* sin mapa en local */ }
}

// Como Cloudflare Pages: las reglas de `_headers` se aplican a los ficheros
// estáticos (no a lo que devuelven las Functions). Así, en local, «Tu cuenta»,
// el panel y el admin llevan la misma CSP (y los avisos salen en la consola).
const REGLAS = [];
try {
  let actual = null;
  for (const linea of (await readFile(join(ROOT, '_headers'), 'utf8')).split(/\r?\n/)) {
    if (!linea.trim() || linea.trim().startsWith('#')) continue;
    if (!/^\s/.test(linea)) {
      // En `_headers` solo hay rutas con `*`: lo demás se toma literal.
      const patron = linea.trim().split('*').map((t) => t.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
      actual = { re: new RegExp(`^${patron}$`), poner: [], quitar: [] };
      REGLAS.push(actual);
    } else if (actual) {
      const t = linea.trim();
      if (t.startsWith('!')) actual.quitar.push(t.slice(1).trim().toLowerCase());
      else { const i = t.indexOf(':'); actual.poner.push([t.slice(0, i).trim().toLowerCase(), t.slice(i + 1).trim()]); }
    }
  }
} catch { /* sin _headers */ }
const cabecerasDe = (ruta) => {
  const h = {};
  for (const r of REGLAS) {
    if (!r.re.test(ruta)) continue;
    for (const q of r.quitar) delete h[q];
    for (const [k, v] of r.poner) h[k] = h[k] ? `${h[k]}, ${v}` : v;
  }
  return h;
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
    // El cartel del local: /cartel/local/<código> y /en/poster/venue/<código>.
    else if ((m = rest.match(/^\/(cartel\/local|poster\/venue)\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'poster/venue' : 'cartel/local'}/[token].js`); params = { token: m[2] }; }
    else if ((m = rest.match(/^\/(cartel|poster)\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'poster' : 'cartel'}/[id].js`); params = { id: m[2] }; }
    // «Compartir en historias»: /historia/<o|b|c>/<…> y /en/story/<o|b|c>/<…>.
    else if ((m = rest.match(/^\/(historia|story)\/([obc])\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'story' : 'historia'}/[kind]/[id].js`); params = { kind: m[2], id: m[3] }; }
    else if ((m = rest.match(/^\/b\/([^/]+)\/?$/))) { mod = await load(`functions/${en}b/[id].js`); params = { id: m[1] }; }
    // En inglés la cartelera se llama «what's on», no «agenda».
    else if ((m = rest.match(/^\/(agenda|whats-on)\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'whats-on' : 'agenda'}/[city].js`); params = { city: m[2] }; }
    else if (/^\/(agenda|whats-on)\/?$/.test(rest)) { mod = await load(`functions/${en}${en ? 'whats-on' : 'agenda'}/index.js`); }
    // «Qué hacer hoy en <ciudad>»: /hoy/<ciudad>/ y /en/today/<city>/.
    else if ((m = rest.match(/^\/(hoy|today)\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'today' : 'hoy'}/[city].js`); params = { city: m[2] }; }
    else if (/^\/(hoy|today)\/?$/.test(rest)) { mod = await load(`functions/${en}${en ? 'today' : 'hoy'}/index.js`); }
    // «Planes con niños en <ciudad>»: /con-ninos/<ciudad>/ y /en/kids/<city>/.
    else if ((m = rest.match(/^\/(con-ninos|kids)\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'kids' : 'con-ninos'}/[city].js`); params = { city: m[2] }; }
    else if (/^\/(con-ninos|kids)\/?$/.test(rest)) { mod = await load(`functions/${en}${en ? 'kids' : 'con-ninos'}/index.js`); }
    // Explorar, categoria dentro de una ciudad y colecciones.
    else if ((m = rest.match(/^\/(explorar|explore)\/?$/))) { mod = await load(`functions/${en}${en ? 'explore' : 'explorar'}/index.js`); }
    else if ((m = rest.match(/^\/(descubre|discover)\/?$/))) { mod = await load(`functions/${en}${en ? 'discover' : 'descubre'}/index.js`); }
    else if ((m = rest.match(/^\/(agenda|whats-on)\/([^/]+)\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'whats-on' : 'agenda'}/[city]/[category].js`); params = { city: m[2], category: m[3] }; }
    else if ((m = rest.match(/^\/(coleccion|collection)\/([^/]+)\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'collection' : 'coleccion'}/[slug]/[city].js`); params = { slug: m[2], city: m[3] }; }
    else if ((m = rest.match(/^\/(coleccion|collection)\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'collection' : 'coleccion'}/[slug].js`); params = { slug: m[2] }; }
    // «Dónde ver el partido»: /partidos/[<id>] y /en/matches/[<id>].
    else if ((m = rest.match(/^\/(partidos|matches)\/([^/]+)\/?$/))) { mod = await load(`functions/${en}${en ? 'matches' : 'partidos'}/[id].js`); params = { id: m[2] }; }
    else if (/^\/(partidos|matches)\/?$/.test(rest)) { mod = await load(`functions/${en}${en ? 'matches' : 'partidos'}/index.js`); }
    // El enlace de amigo: /amigo/<código> y /en/friend/<código>.
    else if ((m = path.match(/^\/amigo\/([^/]+)\/?$/))) { mod = await load('functions/amigo/[code].js'); params = { code: m[1] }; }
    else if ((m = path.match(/^\/en\/friend\/([^/]+)\/?$/))) { mod = await load('functions/en/friend/[code].js'); params = { code: m[1] }; }
    else if ((m = path.match(/^\/r\/([^/]+)\/?$/))) { mod = await load('functions/r/[code].js'); params = { code: m[1] }; }
    // El enlace de un RRPP: /rp/<código> y /en/rp/<código>.
    else if ((m = path.match(/^\/rp\/([^/]+)\/?$/))) { mod = await load('functions/rp/[code].js'); params = { code: m[1] }; }
    else if ((m = path.match(/^\/en\/rp\/([^/]+)\/?$/))) { mod = await load('functions/en/rp/[code].js'); params = { code: m[1] }; }
    // El QR del cartel del local: a la ficha del negocio.
    // «Klendar en la tele»: el QR de la tele por enlazar, al panel.
    else if ((m = path.match(/^\/tv\/enlazar\/([^/]+)\/?$/))) { mod = await load('functions/tv/enlazar/[code].js'); params = { code: m[1] }; }
    else if ((m = path.match(/^\/v\/([^/]+)\/?$/))) { mod = await load('functions/v/[token].js'); params = { token: m[1] }; }
    // «Tus planes en tu calendario»: /cal/<token>.ics.
    else if ((m = path.match(/^\/cal\/([^/]+)$/))) { mod = await load('functions/cal/[token].js'); params = { token: m[1] }; }
    else if ((m = path.match(/^\/baja\/([^/]+)\/?$/))) { mod = await load('functions/baja/[token].js'); params = { token: m[1] }; }
    else if ((m = path.match(/^\/widget\/([^/]+)\/?$/))) { mod = await load('functions/widget/[id].js'); params = { id: m[1] }; }
    else if (path === '/api/mapbox-token') { mod = await load('functions/api/mapbox-token.js'); }
    else if (path === '/sitemap-agenda.xml') { mod = await load('functions/sitemap-agenda.xml.js'); }
    else if (path === '/sitemap-negocios.xml') { mod = await load('functions/sitemap-negocios.xml.js'); }

    if (mod) {
      const request = new Request(`https://klendar.app${path}${url.search}`, { headers: { 'accept-language': 'es' } });
      const out = await mod.onRequestGet({ request, params, env: process.env });
      res.writeHead(out.status, Object.fromEntries(out.headers));
      // En local, sin el contador de Cloudflare (su servidor no acepta
      // localhost y la consola se llenaba de errores que en producción no hay).
      res.end((await out.text()).replace(/<script defer src="https:\/\/static\.cloudflareinsights\.com[^>]*><\/script>/g, ''));
      return;
    }

    const file = path.endsWith('/') ? `${path}index.html` : path;
    const buf = await readFile(join(ROOT, file));
    res.writeHead(200, { ...cabecerasDe(path), 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch (e) {
    // Como Cloudflare: /precios → /precios/, y si no existe, la 404.html más
    // cercana (/en/404.html para /en/…).
    if (e.code === 'EISDIR') {
      res.writeHead(308, { Location: `${path}/${url.search}` });
      res.end();
      return;
    }
    if (e.code === 'ENOENT') {
      try {
        const nf = await readFile(join(ROOT, path.startsWith('/en/') ? 'en/404.html' : '404.html'));
        res.writeHead(404, { 'content-type': TYPES['.html'] });
        res.end(nf);
        return;
      } catch { /* sin 404.html: el texto de abajo */ }
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`404 ${e.message}`);
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
