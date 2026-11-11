// Prueba de lo publicado el 2026-11-11 de «Privacidad: capturas en sugerencias»
// (CS1–CS3, aprobados por Iván el 11-11 tal cual; «Privacidad - capturas en
// sugerencias.pdf»), en la web local:
//
//  1. Privacidad (ES y EN): fila nueva «Sugerencias y mejoras» justo antes de
//     «Soporte», con la frase de tapar los datos de otras personas (CS1). Fecha y
//     primera línea del historial (CS3); la versión sigue siendo la 2026-09-29.
//  2. Eliminar tu cuenta (ES y EN): las capturas se eliminan (debajo de las
//     reseñas) y lo escrito se conserva sin autor hasta 1 año (al final de «Qué se
//     conserva»), CS2. Fecha y primera línea del historial (CS3).
//  3. «Tu cuenta › Sugerencias y mejoras»: la nota de lo que se manda dice el
//     idioma, la página de la que se venía y las capturas (ya no «Nada más»).
//  4. Condiciones para negocios (ES y EN), 2 bis, el orden real de Sitios
//     (aprobado por Iván el 11-11; migración 20261274500000 de la app): después
//     de los que tienen planes hoy, los que tienen foto y horario y luego el
//     resto. Fecha y primera línea del historial; la versión sigue la 2026-11-05.
//  5. Sin desplazamiento horizontal ni errores de JavaScript.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800). Solo HTML estático.
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_cs_check.mjs
//
// Con BASE=https://klendar.app … mira lo publicado (Supabase, simulado igual).
import { readFileSync } from 'node:fs';
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium, webkit } = playwright();

const BASE = process.env.BASE || 'http://localhost:8871';
// La web local no puede llegar a Supabase (ver _supabase_simulado).
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

// [ruta, cabecera, lo que tiene que decir, lo que tiene que ir antes que lo otro]
const PAGINAS = [
  ['/privacidad', 'Última actualización: 11 de noviembre de 2026 · Versión 2026-09-29', [
    /Sugerencias y mejoras\s+Tu cuenta; lo que nos escribes y de qué se trata \(«Sugerencia», «Algo falla», «Soy un negocio» u «Otra cosa»\); la versión de la app, si la usas en Android, iPhone o la web, y el idioma \(en la web, también la página de la que venías\); y, si las añades, hasta 3 capturas o fotos de tu galería/,
    /No se analizan de forma automática\. Si en una captura salen datos de otras personas que no hacen falta, mejor tápalos\s+Ejecución del contrato \(atender lo que nos mandas\) e interés legítimo \(art\. 6\.1\.f RGPD\) en arreglar fallos y mejorar Klendar\. Las capturas son opcionales\s+El mensaje, hasta 1 año después de cerrarlo; si eliminas tu cuenta, se queda sin tu nombre ni tu cuenta\. Las capturas, hasta que se borra el mensaje o eliminas tu cuenta, lo que pase antes; las que eliges pero no llegas a enviar, en 1 o 2 días\s+[\s\S]*?Soporte\s+Email y contenido de tu mensaje/,
    /Historial de cambios\s+11 de noviembre de 2026: Fila nueva «Sugerencias y mejoras»: lo que nos mandas, las capturas que puedes añadir \(qué datos les quitamos, quién las ve y cuándo se borran\) y cuánto tiempo lo guardamos\./,
  ]],
  ['/en/privacy', 'Last updated: 11 November 2026 · Version 2026-09-29', [
    /Ideas and feedback\s+Your account; what you write to us and what it's about \(“Suggestion”, “Something's broken”, “I run a business” or “Something else”\); the app version, whether you use Android, iPhone or the website, and the language \(on the website, also the page you came from\); and, if you add them, up to 3 screenshots or photos from your gallery/,
    /They are not analysed automatically\. If a screenshot shows other people's details that aren't needed, it's best to cover them\s+Performance of a contract \(dealing with what you send us\) and legitimate interest \(art\. 6\.1\.f GDPR\) in fixing problems and improving Klendar\. Screenshots are optional\s+The message, up to 1 year after we close it; if you delete your account, it stays without your name or your account\. Screenshots, until the message is deleted or you delete your account, whichever comes first; those you pick but don't send, within 1 or 2 days\s+[\s\S]*?Support\s+Email and the content of your message/,
    /Change history\s+11 November 2026: New “Ideas and feedback” row: what you send us, the screenshots you can add \(what data we remove from them, who sees them and when they are deleted\) and how long we keep it\./,
  ]],
  ['/eliminar-cuenta', 'Última actualización: 11 de noviembre de 2026 · Versión 2026-09-29', [
    /Tus reseñas, con sus fotos y vídeos, se eliminan junto con tu cuenta\.\s+Las capturas y fotos que añadiste en «Sugerencias y mejoras»\.\s+Tus avisos de «Estaba cerrado»/,
    /Denuncias resueltas, 2 años, para cumplir el Reglamento de Servicios Digitales\.\s+Lo que nos escribiste en «Sugerencias y mejoras», sin tu nombre ni tu cuenta, hasta 1 año después de cerrarlo, para seguir arreglando lo que nos contaste\.\s+Historial de cambios/,
    /Historial de cambios\s+11 de noviembre de 2026: Lista al día: se borran las capturas que añadiste en «Sugerencias y mejoras»; lo que escribiste se queda sin tu nombre hasta 1 año después de cerrarlo\./,
  ]],
  ['/en/delete-account', 'Last updated: 11 November 2026 · Version 2026-09-29', [
    /Your reviews, with their photos and videos, are deleted together with your account\.\s+The screenshots and photos you added in “Ideas and feedback”\.\s+Your “It was closed” reports/,
    /Resolved reports, 2 years, to comply with the Digital Services Act\.\s+What you wrote to us in “Ideas and feedback”, without your name or your account, for up to 1 year after we close it, so we can keep fixing what you told us about\.\s+Change history/,
    /Change history\s+11 November 2026: List brought up to date: the screenshots you added in “Ideas and feedback” are deleted; what you wrote stays without your name for up to 1 year after we close it\./,
  ]],
  ['/negocios', 'Última actualización: 11 de noviembre de 2026 · Versión 2026-11-05', [
    /«Más cerca» \(de serie: por tramos de distancia y, en cada tramo, primero los que tienen planes hoy, luego los que tienen foto y horario y después el resto\) y «Mejor valorados» \(por la valoración media de sus reseñas y, a la par, primero los que tienen planes hoy, luego los que tienen foto y horario y después los más cercanos\)/,
    /Historial de cambios\s+11 de noviembre de 2026: Cómo se ordena Sitios \(apartado 2 bis\): en cada tramo de distancia \(y, con «Mejor valorados», a la par\), después de los que tienen planes hoy van los que tienen foto y horario, y luego el resto\. Como aún no hay negocios usando Klendar, se aplica al publicarse, sin los 15 días de aviso\./,
  ]],
  ['/en/business-terms', 'Last updated: 11 November 2026 · Version 2026-11-05', [
    /“Nearest” \(by default: by distance bands and, within each band, those with plans today first, then those with a photo and opening hours, then the rest\) and “Top rated” \(by the average rating of their reviews and, when level, those with plans today first, then those with a photo and opening hours, then the nearest\)/,
    /Change history\s+11 November 2026: How Places is ordered \(section 2a\): within each distance band \(and, with “Top rated”, when level\), after those with plans today come those with a photo and opening hours, then the rest\. As no businesses are using Klendar yet, it applies on publication, without the 15 days' notice\./,
  ]],
];

// La nota de «Sugerencias y mejoras» en «Tu cuenta» (sale con sesión: se mira en el código).
const raiz = new URL('../', import.meta.url);
const cuenta = readFileSync(new URL('assets/cuenta/cuenta.js', raiz), 'utf8');
const NOTA = 'Mandamos también que escribes desde la web, tu idioma y la página de la que venías, para entender mejor los fallos. Y las capturas, solo si las añades.';
ok(cuenta.includes(NOTA) && !cuenta.includes('Nada más.'), '«Tu cuenta»: la nota de lo que se manda, al día');
for (const f of ['i18n.js', 'i18n/ca.js', 'i18n/gl.js', 'i18n/eu.js', 'i18n/fr.js', 'i18n/de.js', 'i18n/it.js']) {
  ok(readFileSync(new URL(`assets/cuenta/${f}`, raiz), 'utf8').includes(JSON.stringify(NOTA) + ':'), `«Tu cuenta»: la nota traducida en ${f}`);
}

async function paginas(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(`${p.url()}: ${e.message}`));
  for (const [ruta, cabecera, esperas] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const txt = (await p.locator('body').innerText()).replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    ok(txt.includes(cabecera), `${nombre}/${t} ${ruta}: «${cabecera}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0),
      `${nombre}/${t} ${ruta}: sin desplazamiento horizontal`);
  }
  ok(errores.length === 0, `${nombre}/${t}: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 800 }]]) {
    await paginas(nav, nombre, t, vp);
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
