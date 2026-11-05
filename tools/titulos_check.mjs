// Los títulos de la pestaña (Iván, 2026-11-05): formato «Página · Klendar», sin
// repetir la marca, sin punto antes del «·» y en el idioma de la página, en todo
// lo que se puede abrir sin datos (estáticas, fichas sin datos y errores, ES y
// EN) y en «Tu cuenta», el panel y el admin idioma a idioma. Además, el logo
// lleva a la portada desde Descubre en ES y EN, y «Descubre» se queda.
//
//   SUPABASE_BLOQUEADO=1 PORT=8791 node tools/serve_dev.mjs &
//   PW=<ruta a playwright> BASE=http://localhost:8791 node tools/titulos_check.mjs
import { playwright, servidorSeguro, supabaseVacio } from './_supabase_simulado.mjs';

const { chromium } = playwright();
const BASE = process.env.BASE || 'http://localhost:8791';
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLA:', m); } else console.log('ok:', m); };

// Los que no siguen el formato a propósito.
const NATURALES = new Set([
  'Klendar — Ofertas y planes cerca de ti, hoy',
  'Klendar — Deals and things to do near you, today',
  'Sobre Klendar', 'About Klendar', 'Klendar en la tele',
]);
const bien = (t) => NATURALES.has(t)
  || (/ · Klendar$/.test(t) && !/Klendar.* · Klendar$/.test(t) && !/[.:] · Klendar$/.test(t) && !/^ · | ·  · /.test(t));

const EXACTOS = {
  '/para-negocios/': 'Para negocios · Klendar',
  '/en/for-business/': 'For businesses · Klendar',
  '/para-entidades/': 'Para ayuntamientos y asociaciones · Klendar',
  '/en/for-organisations/': 'For councils and associations · Klendar',
  '/sobre/': 'Sobre Klendar',
  '/en/about/': 'About Klendar',
  '/como-funciona/': 'Cómo funciona · Klendar',
  '/en/how-it-works/': 'How it works · Klendar',
  '/captcha/': 'Comprobación · Klendar',
  '/tv/': 'Klendar en la tele',
  '/amigo/abcdefghijklmnop': 'Te han invitado a ser amigos · Klendar',
  '/en/friend/abcdefghijklmnop': "You've been invited to be friends · Klendar",
  '/b/no-existe': 'Este negocio no está · Klendar',
  '/en/b/no-existe': "This business isn't here · Klendar",
  '/a/no-existe': 'Este artista no está · Klendar',
  '/en/a/no-existe': "This artist isn't here · Klendar",
  '/rp/NOEXISTE': 'Este enlace no existe · Klendar',
  '/en/rp/NOEXISTE': "This link doesn't exist · Klendar",
};
const RUTAS = [
  ...Object.keys(EXACTOS),
  '/', '/en/', '/no-existe/', '/en/no-existe/', '/descubre/', '/en/discover/', '/explorar/', '/en/explore/',
  '/agenda/', '/en/whats-on/', '/agenda/malaga/', '/en/whats-on/malaga/', '/hoy/malaga/', '/en/today/malaga/',
  '/con-ninos/malaga/', '/en/kids/malaga/', '/coleccion/no-existe/', '/en/collection/no-existe/',
  '/grupos/', '/en/groups/', '/partidos/', '/en/matches/', '/partidos/no-existe/', '/en/matches/no-existe/',
  '/sorteos/', '/en/giveaways/', '/sorteo/no-existe/', '/en/giveaway/no-existe/',
  '/o/no-existe', '/en/o/no-existe',
  '/m/abcdefghijklmnop', '/en/m/abcdefghijklmnop', '/cola/NOEXISTE', '/en/queue/NOEXISTE', '/listo/NOEXISTE', '/en/ready/NOEXISTE',
  '/baja/no-existe', '/avisame/confirmar/no-existe', '/avisame/baja/no-existe', '/v/no-existe', '/widget/no-existe',
  '/historia/o/no-existe', '/en/story/o/no-existe', '/cartel/no-existe', '/en/poster/no-existe',
  '/accesibilidad/', '/en/accessibility/', '/aviso-legal/', '/en/legal-notice/', '/privacidad/', '/en/privacy/',
  '/terminos/', '/en/terms/', '/negocios/', '/en/business-terms/', '/cookies/', '/en/cookies/', '/normas/', '/en/community-guidelines/',
  '/eliminar-cuenta/', '/en/delete-account/', '/estado/', '/en/status/', '/fuentes/', '/en/sources/', '/precios/', '/en/pricing/',
  '/preguntas/', '/en/faq/', '/prensa/', '/en/press/', '/soporte/', '/en/support/', '/alta/', '/admin/carta.html',
];

const titulo = (html) => (/<title>([^<]*)<\/title>/.exec(html)?.[1] || '')
  .replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"');
const og = (html) => /property="og:title" content="([^"]*)"/.exec(html)?.[1]?.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'");

for (const ruta of RUTAS) {
  const r = await fetch(BASE + ruta, { redirect: 'follow' });
  const html = await r.text();
  if (!/text\/html/.test(r.headers.get('content-type') || '')) { console.log(`-- ${ruta}: ${r.status} ${r.headers.get('content-type')}`); continue; }
  const t = titulo(html);
  console.log(`   ${ruta} [${r.status}] «${t}»`);
  ok(bien(t), `${ruta}: «${t}» sigue el formato`);
  if (EXACTOS[ruta]) ok(t === EXACTOS[ruta], `${ruta}: «${EXACTOS[ruta]}»`);
  const o = og(html);
  if (o) ok(!/Klendar.*· Klendar/.test(o) && !/^Klendar$/.test(o), `${ruta}: og:title «${o}» sin la marca repetida`);
}

// «Tu cuenta», el panel y el admin, idioma a idioma.
const nav = await chromium.launch();
const IDIOMAS = {
  es: ['Tu cuenta', 'Panel del negocio', 'Administración'],
  en: ['Your account', 'Business dashboard', 'Administration'],
  ca: ['El teu compte', 'Tauler del negoci', 'Administración'],
  gl: ['A túa conta', 'Panel do negocio', 'Administración'],
  eu: ['Zure kontua', 'Negozioaren panela', 'Administración'],
  fr: ['Ton compte', 'Tableau de bord du commerce', 'Administration'],
  de: ['Dein Konto', 'Dashboard fürs Geschäft', 'Administration'],
  it: ['Il tuo account', 'Pannello dell’attività', 'Administration'],
};
for (const [lang, [cuenta, panel, admin]] of Object.entries(IDIOMAS)) {
  const ctx = await nav.newContext({ locale: 'es-ES' });
  await supabaseVacio(ctx);
  await ctx.addInitScript((l) => { try { localStorage.setItem('klendar_lang', l); } catch { /* sin permisos */ } }, lang);
  const p = await ctx.newPage();
  // Sin sesión, el panel salta a «Tu cuenta»: se apunta lo que pone cada página.
  await p.addInitScript(() => {
    const d = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
    Object.defineProperty(document, 'title', {
      get() { return d.get.call(document); },
      set(v) { sessionStorage.setItem(`__titulo ${location.pathname}`, v); d.set.call(document, v); },
    });
  });
  for (const [ruta, esperado] of [['/app/', cuenta], ['/panel/', panel], ['/admin/', admin]]) {
    await p.goto(BASE + ruta, { waitUntil: 'load' });
    await p.waitForTimeout(800);
    const t = await p.evaluate((r) => sessionStorage.getItem(`__titulo ${r}`) || (location.pathname === r ? document.title : ''), ruta);
    ok(t === `${esperado} · Klendar`, `[${lang}] ${ruta}: «${t}»`);
  }
  await ctx.close();
}

// El logo y la pestaña, en ES y EN.
for (const [ruta, portada, nombre] of [['/descubre/', '/', 'es'], ['/en/discover/', '/en/', 'en']]) {
  for (const [w, h] of [[390, 780], [1280, 800]]) {
    const ctx = await nav.newContext({ viewport: { width: w, height: h }, locale: nombre === 'en' ? 'en-GB' : 'es-ES' });
    await supabaseVacio(ctx);
    const p = await ctx.newPage();
    await p.goto(BASE + ruta, { waitUntil: 'load' });
    await p.waitForTimeout(500);
    ok(await p.getAttribute('header.top a.brand', 'aria-label') === null, `[${nombre} ${w}] el logo no dice «volver arriba»`);
    ok(await p.getAttribute('header.top a.brand', 'href') === portada, `[${nombre} ${w}] el logo enlaza a ${portada}`);
    // Tocar «Descubre» estando en Descubre: se queda, sin recargar.
    await p.evaluate(() => { window.__misma = true; });
    await p.locator('a[data-tab="descubre"]:visible').first().click();
    await p.waitForTimeout(1200);
    ok(new URL(p.url()).pathname === ruta && await p.evaluate(() => window.__misma === true), `[${nombre} ${w}] «Descubre» en Descubre: se queda`);
    await p.locator('header.top a.brand').first().click();
    await p.waitForURL((u) => u.pathname === portada);
    ok(new URL(p.url()).pathname === portada, `[${nombre} ${w}] el logo lleva a ${portada}`);
    await p.goBack();
    await p.waitForLoadState('load');
    ok(new URL(p.url()).pathname === ruta, `[${nombre} ${w}] «Atrás» vuelve a Descubre`);
    await ctx.close();
  }
}
await nav.close();
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
