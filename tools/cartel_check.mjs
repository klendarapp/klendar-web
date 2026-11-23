// «Imprimir cartel» de una publicación y la pegatina de escaparate
// (§4zzz-cartel de la app, 23-11), con datos de mentira
// (tools/_web_con_datos.mjs; no toca Supabase).
//
//  1. El cartel: el QR lleva a la ficha de ESA publicación (en español o en
//     inglés según el idioma), la línea de qué hacer (oferta: «consigue tu
//     código»; evento con reserva: «reserva tu plaza»), el beneficio y el
//     precio de antes, los 8 idiomas, A3, y sin cartel para una exclusiva, una
//     de RRPP sin enlace y una que no existe.
//  2. La pegatina: la de un local lleva a su ficha (`/b/<dirección>`, no al
//     `/v/` de los sellos), la genérica a klendar.app; la de imprenta, en una
//     hoja de 106 mm; un negocio que no existe, 404.
//  3. Con Playwright (PW=…): el QR dibujado es el de esa dirección (se vuelve
//     a sacar con la misma librería y se compara), cada uno sale en UNA página
//     al imprimir (A4, A3 y 106 mm), nada se sale del folio, y la página se
//     ve en el móvil sin desbordar, en claro y en oscuro, y pasa axe-core
//     (WCAG 2.1 AA) si está instalado.
//
//   node tools/cartel_check.mjs            (sin Playwright, solo 1 y 2)
//   PW=<ruta a playwright> node tools/cartel_check.mjs
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { DATOS, webConDatos } from './_web_con_datos.mjs';

let fallos = 0;
const ok = (c, m, extra = '') => { if (c) console.log(`ok: ${m}`); else { fallos += 1; console.log(`FALLO: ${m} ${extra}`); } };

const flash = DATOS.PLANES.find((p) => p.title === 'Cafe y tostada' || p.title === 'Café y tostada');
const uid = (n) => `a9000000-0000-4000-8000-0000000c${String(n).padStart(4, '0')}`;
const evento = { ...DATOS.PLANES.find((p) => p.title === 'Cata de vinos'), id: uid(1), reservations_enabled: true };
const exclusiva = { ...flash, id: uid(2), audience: 'favorites', title: null };
const rrpp = { ...flash, id: uid(3), audience: 'promoters' };
const rebaja = { ...flash, id: uid(4), title: 'Camiseta de la casa', discount: { type: 'percent', value: 30, compare_at_cents: 2000 } };
const negocio = DATOS.NEGOCIOS[0];

const web = await webConDatos({
  puerto: Number(process.env.PORT || 8964),
  datos: { ...DATOS, PLANES: [...DATOS.PLANES, evento, exclusiva, rrpp, rebaja] },
});
const pide = async (ruta) => { const r = await fetch(`${web.BASE}${ruta}`, { redirect: 'manual' }); return { st: r.status, h: await r.text() }; };
const qrDe = (h) => [...h.matchAll(/data-qr="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

const require = createRequire(import.meta.url);
const qrcode = require('../assets/vendor/qrcode.js');
const svgDe = (url, nivel) => { const q = qrcode(0, nivel); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 6, margin: 0, scalable: true }); };

try {
  // ── 1. El cartel de una publicación ──
  {
    const { st, h } = await pide(`/cartel/${flash.id}`);
    ok(st === 200, 'cartel: 200', String(st));
    ok(qrDe(h)[0] === `https://klendar.app/o/${flash.id}`, 'cartel: el QR lleva a su ficha', qrDe(h)[0]);
    ok(h.includes('Escanea y consigue tu código'), 'cartel de una oferta: «Escanea y consigue tu código»');
    ok(h.includes('Café y tostada') && h.includes(flash.business_name), 'cartel: el título y el local');
    ok(/class="precio">−2\s€</.test(h), 'cartel: el descuento en grande («−2 €»)', (h.match(/class="precio">[^<]*/) || [])[0]);
    ok(/@page \{ size: A4; margin: 0; \}/.test(h) && /aria-current="page">A4</.test(h), 'cartel: A4 de serie');
    ok(/<html lang="es">/.test(h) && /noindex/.test(h), 'cartel: español y sin buscadores');
    ok(!/<script>(?!<\/script>)/.test(h) && !/onclick=/.test(h), 'cartel: sin código en línea (CSP)');
    ok(/src="\/assets\/cartel\.js\?v=/.test(h), 'cartel: el QR y «Imprimir» con /assets/cartel.js');
  }
  {
    const { h } = await pide(`/cartel/${flash.id}?tam=a3`);
    ok(/@page \{ size: A3; margin: 0; \}/.test(h) && /width: 297mm; height: 420mm/.test(h), 'cartel A3: la hoja A3');
  }
  {
    const { h } = await pide(`/cartel/${evento.id}`);
    ok(h.includes('Escanea y reserva tu plaza'), 'evento con reserva: «Escanea y reserva tu plaza»');
    ok(/class="tipo">Evento</.test(h), 'evento: lo dice arriba');
  }
  {
    const { h } = await pide(`/cartel/${rebaja.id}`);
    ok(/−30 %/.test(h) && /Antes <s>20\s€<\/s>/u.test(h), 'rebaja: el precio de antes tachado', (h.match(/class="antes">.*?<\/span>/) || [])[0]);
  }
  {
    const { st, h } = await pide(`/en/poster/${flash.id}`);
    ok(st === 200 && h.includes('Scan and get your code') && /<html lang="en">/.test(h), 'inglés: /en/poster/');
    ok(qrDe(h)[0] === `https://klendar.app/en/o/${flash.id}`, 'inglés: el QR a la ficha en inglés', qrDe(h)[0]);
  }
  const IDIOMAS = { ca: ['Escaneja i aconsegueix el teu codi', '/o/'], gl: ['Escanea e consegue o teu código', '/o/'], eu: ['Eskaneatu eta lortu zure kodea', '/o/'],
    fr: ['Scannez et obtenez votre code', '/en/o/'], de: ['Scannen und Code holen', '/en/o/'], it: ['Scansiona e ottieni il tuo codice', '/en/o/'] };
  for (const [l, [frase, ficha]] of Object.entries(IDIOMAS)) {
    const { st, h } = await pide(`/cartel/${flash.id}?lang=${l}`);
    ok(st === 200 && h.includes(frase) && h.includes(`<html lang="${l}">`), `${l}: el cartel en su idioma`);
    ok(qrDe(h)[0] === `https://klendar.app${ficha}${flash.id}`, `${l}: el QR a la ficha que hay (${ficha})`, qrDe(h)[0]);
    ok(new RegExp(`<option value="${l}" lang="${l}" selected>`).test(h), `${l}: el idioma elegido, marcado`);
  }
  {
    const { st, h } = await pide(`/cartel/${exclusiva.id}`);
    ok(st === 200 && !qrDe(h).length && h.includes('Es una exclusiva'), 'exclusiva: sin cartel, y lo dice', String(st));
    const r = await pide(`/cartel/${rrpp.id}`);
    ok(r.st === 404 && !qrDe(r.h).length, 'RRPP sin enlace: 404', String(r.st));
    const x = await pide('/cartel/00000000-0000-4000-8000-000000000000');
    ok(x.st === 404 && !qrDe(x.h).length, 'la que no existe: 404', String(x.st));
  }

  // ── 2. La pegatina ──
  {
    const { st, h } = await pide(`/cartel/pegatina/${negocio.id}`);
    ok(st === 200, 'pegatina: 200', String(st));
    const qrs = qrDe(h);
    ok(qrs.length === 4 && qrs.every((u) => u === `https://klendar.app/b/${negocio.slug}`), 'pegatina: cuatro por folio, QR a la ficha del local', qrs[0]);
    ok(!qrs.some((u) => u.includes('/v/')), 'pegatina: no lleva el QR de los sellos');
    ok(h.includes('Encuéntranos en Klendar') && h.includes(negocio.name), 'pegatina: la frase y el nombre');
    ok(/@page \{ size: A4; margin: 0; \}/.test(h), 'pegatina: en A4');
  }
  {
    const { h } = await pide(`/cartel/pegatina/${negocio.id}?modo=imprenta&fondo=claro`);
    ok(/@page \{ size: 106mm 106mm; margin: 0; \}/.test(h) && qrDe(h).length === 1, 'pegatina de imprenta: 106 × 106 mm, una');
    ok(/class="peg claro"/.test(h) && /aria-current="page">Claro</.test(h), 'pegatina: fondo claro');
    const g = await pide(`/cartel/pegatina/${negocio.id}?modo=grande`);
    ok(qrDe(g.h).length === 1 && /aria-current="page">1 grande/.test(g.h), 'pegatina grande: una de 14 cm');
  }
  {
    const { st, h } = await pide('/cartel/pegatina');
    ok(st === 200 && qrDe(h).every((u) => u === 'https://klendar.app/') && h.includes('Estamos en Klendar'), 'pegatina genérica: «Estamos en Klendar» y QR a klendar.app', qrDe(h)[0]);
    const e = await pide('/en/poster/sticker?lang=de');
    ok(e.st === 200 && e.h.includes('Wir sind auf Klendar') && qrDe(e.h)[0] === 'https://klendar.app/en', 'pegatina genérica en alemán: QR a klendar.app/en', qrDe(e.h)[0]);
    const c = await pide(`/cartel/pegatina/${negocio.id}?lang=ca`);
    ok(c.h.includes('Troba’ns a Klendar'), 'pegatina en catalán');
    const x = await pide('/cartel/pegatina/00000000-0000-4000-8000-000000000000');
    ok(x.st === 404 && !qrDe(x.h).length, 'pegatina de un negocio que no existe: 404', String(x.st));
  }

  // ── 3. En el navegador ──
  let pw = null;
  try { pw = (await import('./_supabase_simulado.mjs')).playwright(); } catch { pw = null; }
  if (!pw) console.log('sin Playwright (PW=…): me salto el QR dibujado y la impresión');
  else {
    const nav = await pw.chromium.launch();
    try {
      const casos = [
        [`/cartel/${flash.id}`, `https://klendar.app/o/${flash.id}`, 'M', '.folio'],
        [`/cartel/${evento.id}?tam=a3&lang=de`, `https://klendar.app/en/o/${evento.id}`, 'M', '.folio'],
        [`/cartel/pegatina/${negocio.id}`, `https://klendar.app/b/${negocio.slug}`, 'Q', '.hoja'],
        [`/cartel/pegatina/${negocio.id}?modo=imprenta`, `https://klendar.app/b/${negocio.slug}`, 'Q', '.hoja'],
        ['/cartel/pegatina?modo=grande&fondo=claro', 'https://klendar.app/', 'Q', '.hoja'],
      ];
      for (const [ruta, url, nivel, hoja] of casos) {
        const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
        await web.conDatos(ctx);
        const p = await ctx.newPage();
        const errores = [];
        p.on('pageerror', (e) => errores.push(e.message));
        await p.goto(`${web.BASE}${ruta}`, { waitUntil: 'networkidle' });
        // Los módulos del QR (el `d` de su trazado), como los saca la librería para esa dirección.
        const modulos = (svg) => [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join('|');
        const dibujados = await p.$$eval('[data-qr] svg', (l) => l.map((el) => el.outerHTML));
        const esperado = modulos(svgDe(url, nivel));
        ok(esperado.length > 100 && dibujados.length > 0 && dibujados.every((s) => modulos(s) === esperado), `${ruta}: el QR dibujado es el de ${url}`, `${dibujados.length} QR`);
        ok(!errores.length, `${ruta}: sin errores de JS`, errores.join(' | '));
        // Nada se sale del folio: lo último queda dentro.
        await p.emulateMedia({ media: 'print' });
        const fuera = await p.$eval(hoja, (f) => {
          const r = f.getBoundingClientRect();
          const e = [...f.querySelectorAll('*')].find((x) => { const b = x.getBoundingClientRect(); return b.height && (b.bottom > r.bottom + 1 || b.right > r.right + 1 || b.left < r.left - 1 || b.top < r.top - 1); });
          return e ? `${e.tagName}.${e.getAttribute('class')} ${JSON.stringify(e.getBoundingClientRect())} en ${JSON.stringify(r)}` : '';
        });
        ok(!fuera, `${ruta}: todo cabe en la hoja impresa`, fuera);
        const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
        const paginas = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
        ok(paginas === 1, `${ruta}: se imprime en UNA página`, `${paginas} páginas`);
        await ctx.close();
      }
      // El móvil, en claro y en oscuro: sin desbordar y con «Imprimir» a mano.
      for (const tema of ['light', 'dark']) {
        for (const ruta of [`/cartel/${flash.id}?lang=fr`, `/cartel/pegatina/${negocio.id}`]) {
          const ctx = await nav.newContext({ viewport: { width: 360, height: 760 }, colorScheme: tema, deviceScaleFactor: 2 });
          await web.conDatos(ctx);
          const p = await ctx.newPage();
          await p.goto(`${web.BASE}${ruta}`, { waitUntil: 'networkidle' });
          const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
          ok(ancho <= 360, `${tema} 360 px ${ruta}: sin desbordar`, String(ancho));
          const boton = await p.locator('[data-imprimir]').boundingBox();
          ok(boton && boton.height >= 44, `${tema} 360 px ${ruta}: «Imprimir» de 44 px o más`);
          if (process.env.CAPTURAS) await p.screenshot({ path: `${process.env.CAPTURAS}/movil-${tema}-${ruta.includes('pegatina') ? 'pegatina' : 'cartel'}.png`, fullPage: true });
          await ctx.close();
        }
      }
      // Accesibilidad (axe-core, WCAG 2.1 A y AA), en claro y en oscuro, si está instalado.
      const axeRuta = process.env.AXE || (process.env.APPDATA ? join(process.env.APPDATA, 'npm', 'node_modules', 'axe-core', 'axe.min.js') : '');
      if (!axeRuta || !existsSync(axeRuta)) console.log('sin axe-core: me salto la accesibilidad');
      else {
        const AXE = readFileSync(axeRuta, 'utf8');
        for (const tema of ['light', 'dark']) {
          for (const ruta of [`/cartel/${flash.id}`, `/cartel/pegatina/${negocio.id}?fondo=claro`, `/cartel/${exclusiva.id}`]) {
            const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, colorScheme: tema });
            await web.conDatos(ctx);
            const p = await ctx.newPage();
            await p.goto(`${web.BASE}${ruta}`, { waitUntil: 'networkidle' });
            await p.addScriptTag({ content: AXE });
            const v = await p.evaluate(async () => (await globalThis.axe.run(document, {
              runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'],
            })).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`));
            ok(!v.length, `${tema} ${ruta}: accesible (axe)`, v.join(' | '));
            await ctx.close();
          }
        }
      }
      // El idioma se cambia al elegirlo (sin botón con JS).
      {
        const ctx = await nav.newContext();
        await web.conDatos(ctx);
        const p = await ctx.newPage();
        await p.goto(`${web.BASE}/cartel/${flash.id}?tam=a3`, { waitUntil: 'networkidle' });
        ok(!(await p.locator('.idioma button').isVisible()), 'idioma: sin botón «Cambiar» con JS');
        await Promise.all([p.waitForNavigation(), p.selectOption('#lang', 'it')]);
        ok(/lang=it/.test(p.url()) && /tam=a3/.test(p.url()) && (await p.locator('.accion').innerText()).includes('Scansiona'), 'idioma: al elegir italiano, el cartel en italiano y sigue en A3', p.url());
        await ctx.close();
      }
    } finally {
      await nav.close();
    }
  }
} finally {
  await web.cierra();
}
console.log(fallos ? `${fallos} fallos` : 'todo bien');
process.exit(fallos ? 1 : 0);
