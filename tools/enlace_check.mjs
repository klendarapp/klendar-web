// «Rellenar desde…» un enlace o un texto en el panel, en la web local, con Supabase contestado aquí (no toca dev ni prod
// ni llama a ninguna IA): apagado sale solo la foto, como siempre; encendido, «Rellenar desde…» con foto, enlace y
// texto; su propio permiso; un evento llena el formulario (con el sitio marcado); varios salen en una lista con
// casillas y se revisan uno a uno («Evento 1 de 2», «Saltar este»); nunca publica sola; si el enlace no se lee, se
// propone una captura; el interruptor de «Tu cuenta» y el del admin. Capturas en OUT.
//
//   SUPABASE_BLOQUEADO=1 PORT=8872 node tools/serve_dev.mjs &
//   BASE=http://localhost:8872 PW=<ruta a playwright> OUT=<carpeta> node tools/enlace_check.mjs
import { claveSesion, playwright, SUPA, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium } = playwright();
const BASE = process.env.BASE || 'http://localhost:8872';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });

const U = '0e7717e0-0000-4000-8000-00000000e070';
const BIZ = 'b1000000-0000-4000-8000-00000000e070';
const OFERTA = 'c1000000-0000-4000-8000-00000000e070';
const CATS = [
  { id: 'c0000000-0000-4000-8000-000000000001', slug: 'music', names: { es: 'Música', en: 'Music' }, position: 1 },
  { id: 'c0000000-0000-4000-8000-000000000002', slug: 'bar', names: { es: 'Bares', en: 'Bars' }, position: 2 },
];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'enlace@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const dia = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const ev = (x) => ({
  injection: false, kind: 'future_event', title: '', description: '', price_cents: null, prior_price_cents: null, discount: null,
  start: null, end: null, repeat: null, category_id: null, category_name: null, doubts: [], venue_name: '', venue_address: '', image_url: null, ...x,
});
const JAZZ = ev({
  title: 'Noche de jazz con Ana Trío', description: 'Trío de jazz en directo.', price_cents: 1200, start: `${dia(9)}T21:00`, end: `${dia(9)}T23:00`,
  venue_name: 'Sala Clamores', venue_address: 'Calle Alburquerque 14, Madrid', image_url: 'https://cdn.sala.es/jazz.jpg', image_token: 'firma', doubts: ['place'],
});
const AGENDA = [
  ev({ title: 'Cuentacuentos en la librería', start: `${dia(3)}T18:00`, doubts: ['price'] }),
  ev({ title: 'Concierto de jazz', price_cents: 1200, start: `${dia(6)}T21:30` }),
  ev({ title: 'Mercadillo solidario', doubts: ['when'] }),
];

function supabaseFalso(e) {
  return async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p === '/functions/v1/link-fill') {
      e.lecturas.push(body);
      if (body.image_url) return json({ ok: true, image: PNG.toString('base64'), mime: 'image/png' });
      return json(e.leer(body, e.lecturas.length));
    }
    if (p === '/functions/v1/photo-fill') { e.fotos.push(body); return json({ ok: true, kind: 'offer', read: ev({ kind: 'flash_offer', title: 'Del cartel' }) }); }
    if (p.startsWith('/functions/v1/')) return json({ ok: true });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      e.llamadas.push([fn, body]);
      const r = e.rpc[fn];
      return json(r === undefined ? null : typeof r === 'function' ? r(body) : r);
    }
    if (p.startsWith('/rest/v1/admin_users')) return json([{ user_id: U }]);
    if (p.startsWith('/rest/v1/categories')) return json(CATS);
    if (p.startsWith('/rest/v1/offers')) {
      if (req.method() === 'POST') { e.insertadas.push(body); return json({ id: OFERTA }, 201); }
      return json([]);
    }
    if (p.startsWith('/rest/v1/businesses')) {
      return json([{ id: BIZ, time_zone: 'Europe/Madrid', category_id: CATS[1].id, logo_url: null, cover_image_url: null, gallery: [], opening_hours: null, menu_url: null, menu_images: [], created_at: '2026-01-01T00:00:00Z' }]);
    }
    if (p.startsWith('/storage/v1/object/')) {
      if (req.method() === 'POST') { e.subidas.push(p); return json({ Key: 'x' }); }
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

const estadoFoto = (x = {}) => ({ available: true, consent: true, asked: true, offer_left: 10, menu_left: 12, max_menu_photos: 6, ...x });
const estadoEnlace = (x = {}) => ({ available: true, consent: true, asked: true, left: 9, max_events: 20, max_text: 20000, ...x });
const PANEL = (x = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: 'Sala Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Madrid' }],
  my_business_offer_counts: { total: 3, todas: 3, activa: 1 },
  business_is_organizer: false,
  photo_fill_status: estadoFoto(),
  link_fill_status: estadoEnlace(),
  set_ai_consent: { ok: true },
  my_entity_application: { entity_kind: null, application: null, can_apply: true },
  ...x,
});

async function contexto(nav, { rpc = {}, leer = () => ({ ok: true, source: 'link', read: { injection: false, events: [JAZZ], more: false }, left: 8 }), ancho = 1280 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, a]) => {
    try {
      localStorage.setItem(k, v);
      localStorage.setItem(a, v);
      localStorage.setItem('klendar_lang', 'es');
    } catch { /* */ }
  }, [claveSesion(), sesion(), claveSesion('admin')]);
  const estado = { llamadas: [], insertadas: [], subidas: [], lecturas: [], fotos: [], rpc: PANEL(rpc), leer };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (x) => errores.push(x.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

const nuevo = async (p) => {
  await p.goto(`${BASE}/panel#/publicaciones/nuevo-evento`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[name=title]');
};
const elige = async (p, de) => {
  await p.click('#enlaceCta');
  await p.waitForSelector('#modal[open] [name=de]');
  await p.selectOption('#modal [name=de]', de);
  await p.click('#modal button[type=submit]');
};
const pegaEnlace = async (p, url) => {
  await p.waitForSelector('#modal[open] [name=url]');
  await p.fill('#modal [name=url]', url);
  await p.click('#modal button[type=submit]');
};

const nav = await chromium.launch();

// ── Apagado: solo la foto, como siempre ────────────────────────────────────
{
  const { ctx, p, errores, estado } = await contexto(nav, { rpc: { link_fill_status: estadoEnlace({ available: false, consent: false, asked: false }) } });
  await nuevo(p);
  await p.waitForSelector('#fotoCta');
  ok(await p.locator('#enlaceCta').count() === 0, 'apagado: no sale «Rellenar desde…»');
  ok(/Rellenar desde una foto/.test(await p.locator('#fotoRellena').innerText()), 'apagado: sale «Rellenar desde una foto», como siempre');
  ok(estado.lecturas.length === 0, 'apagado: no se llama a nadie');
  await p.screenshot({ path: `${OUT}/web-apagado.png` });
  ok(errores.length === 0, `apagado: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── Encendido: la tarjeta, las tres opciones y su permiso ─────────────────
{
  const { ctx, p, errores, estado } = await contexto(nav, { rpc: { link_fill_status: estadoEnlace({ consent: false, asked: false }) } });
  await nuevo(p);
  await p.waitForSelector('#enlaceCta');
  ok(/Rellenar desde…/.test(await p.locator('#enlaceCta').innerText()), 'encendido: «Rellenar desde…»');
  await p.screenshot({ path: `${OUT}/web-rellenar-desde.png` });
  await p.click('#enlaceCta');
  await p.waitForSelector('#modal[open] [name=de]');
  const opciones = await p.locator('#modal [name=de] option').allInnerTexts();
  ok(opciones.length === 3 && /Una foto/.test(opciones[0]) && /Un enlace/.test(opciones[1]) && /Un texto/.test(opciones[2]), 'tres opciones: foto, enlace y texto');
  await p.screenshot({ path: `${OUT}/web-tres-opciones.png` });
  await p.selectOption('#modal [name=de]', 'enlace');
  await p.click('#modal button[type=submit]');
  await p.waitForSelector('#modal[open] [name=enlace_permiso]');
  const txt = await p.locator('#modal').innerText();
  ok(/Claude/.test(txt) && /Anthropic/.test(txt) && /Estados Unidos/.test(txt) && /quitamos correos y teléfonos/.test(txt), 'permiso: dice a quién va, dónde y qué se quita');
  ok(!await p.locator('#modal [name=enlace_permiso]').isChecked(), 'permiso: la casilla, sin marcar');
  await p.screenshot({ path: `${OUT}/web-permiso.png` });
  await p.click('#modal [data-cancel]');
  ok(!estado.llamadas.some(([f]) => f === 'set_ai_consent') && estado.lecturas.length === 0, 'permiso: «Ahora no» no guarda ni manda nada');
  await elige(p, 'enlace');
  await p.check('#modal [name=enlace_permiso]');
  await p.click('#modal button[type=submit]');
  await pegaEnlace(p, 'https://sala.es/jazz');
  await p.waitForSelector('.foto-hecho');
  const dado = estado.llamadas.find(([f]) => f === 'set_ai_consent');
  ok(dado?.[1]?.p_use === 'link_fill' && dado?.[1]?.p_granted === true, 'permiso: se guarda, para este uso (no el de la foto)');
  ok(estado.lecturas[0].source === 'link' && estado.lecturas[0].url === 'https://sala.es/jazz' && estado.lecturas[0].business_id === BIZ, 'manda el enlace, con su negocio');
  ok(await p.inputValue('[name=title]') === JAZZ.title, 'llena el título');
  ok(await p.inputValue('[name=price]') === '12,00', 'llena el precio');
  ok(await p.inputValue('[name=start]') === JAZZ.start, 'llena la fecha y la hora');
  ok(await p.inputValue('[name=venue_name]') === 'Sala Clamores' && await p.inputValue('[name=venue_address]') === JAZZ.venue_address, 'llena el sitio');
  ok(/Mira dónde es/.test(await p.locator('#form').innerText()), 'el sitio, marcado para ponerlo en el mapa');
  const aviso = await p.locator('.foto-hecho').innerText();
  ok(/Rellenado desde el enlace/.test(aviso) && /no se publica nada sin ti/.test(aviso), 'dice de dónde viene y que lo revise');
  ok(estado.insertadas.length === 0, 'NO publica solo');
  await p.screenshot({ path: `${OUT}/web-rellenado-enlace.png`, fullPage: true });
  // La imagen de la página: solo si se pide.
  ok(estado.lecturas.length === 1 && estado.subidas.length === 0, 'la imagen de la página no se trae sola');
  await p.click('#fotoImagen');
  await p.waitForFunction(() => document.querySelector('.foto-hecho')?.innerText.includes('Imagen de la página añadida'));
  ok(estado.lecturas[1]?.image_url === JAZZ.image_url && estado.lecturas[1]?.image_token === 'firma' && estado.subidas.length === 1, 'usar la imagen de la página: la trae la función, con su firma, y se sube');
  await p.click('#fotoDeshacer');
  await p.waitForSelector('#enlaceCta');
  ok(await p.inputValue('[name=title]') === '' && await p.inputValue('[name=venue_name]') === '', 'deshacer: como estaba');
  ok(errores.length === 0, `enlace: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── Un texto con varios eventos: la lista y uno a uno ──────────────────────
{
  const { ctx, p, errores, estado } = await contexto(nav, {
    leer: () => ({ ok: true, source: 'text', read: { injection: false, events: AGENDA, more: false }, left: 8 }),
  });
  await nuevo(p);
  await p.waitForSelector('#enlaceCta');
  await elige(p, 'texto');
  await p.waitForSelector('#modal[open] [name=text]');
  await p.fill('#modal [name=text]', 'Agenda de diciembre\n15/12 Cuentacuentos 18:00\n18/12 Concierto de jazz 21:30, 12 €\nMercadillo solidario (fecha por confirmar)');
  await p.screenshot({ path: `${OUT}/web-pegar-texto.png` });
  await p.click('#modal button[type=submit]');
  await p.waitForSelector('#modal[open] [name=e0]');
  const lista = await p.locator('#modal').innerText();
  ok(/3 eventos encontrados/.test(lista), 'la lista: «3 eventos encontrados»');
  ok(/no se publica nada hasta que lo revises/.test(lista), 'la lista: dice que nada se publica sin revisar');
  ok(await p.locator('#modal input[type=checkbox]:checked').count() === 3, 'la lista: todas marcadas');
  ok(/Sin fecha: la pones tú/.test(lista) && /Hay cosas que mirar/.test(lista), 'la lista: lo que falta o hay que mirar');
  await p.uncheck('#modal [name=e2]');
  await p.screenshot({ path: `${OUT}/web-lista-eventos.png` });
  await p.click('#modal button[type=submit]');
  await p.waitForSelector('.foto-hecho');
  ok(await p.inputValue('[name=title]') === AGENDA[0].title, 'el primero, en el formulario');
  const aviso = await p.locator('.foto-hecho').innerText();
  ok(/Evento 1 de 2/.test(aviso) && /Saltar este/.test(aviso) && /Rellenado desde tu texto/.test(aviso), '«Evento 1 de 2» y «Saltar este»');
  ok(estado.insertadas.length === 0, 'NO publica solo');
  await p.screenshot({ path: `${OUT}/web-evento-1-de-2.png`, fullPage: true });
  // «Saltar este»: el siguiente, ya relleno, sin publicar el primero.
  await p.click('#fotoSaltar');
  await p.waitForFunction(() => location.hash.includes('cola=2'));
  await p.waitForFunction(() => /Evento 2 de 2/.test(document.querySelector('.foto-hecho')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
  ok(await p.inputValue('[name=title]') === AGENDA[1].title, 'saltar: el segundo, ya relleno');
  ok(/Evento 2 de 2/.test(await p.locator('.foto-hecho').innerText()), 'saltar: «Evento 2 de 2»');
  ok(await p.locator('#fotoSaltar').count() === 0, 'el último no se salta: se publica o se sale');
  ok(estado.insertadas.length === 0, 'saltar no publica nada');
  ok(errores.length === 0, `agenda: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── Un enlace que no se lee: «prueba con una captura» ──────────────────────
{
  const { ctx, p, errores, estado } = await contexto(nav, { leer: () => ({ ok: false, why: 'unreadable_link', detail: 'robots' }) });
  await nuevo(p);
  await p.fill('[name=title]', 'Lo mío');
  await p.waitForSelector('#enlaceCta');
  await elige(p, 'enlace');
  await pegaEnlace(p, 'https://www.instagram.com/p/xyz/');
  await p.waitForSelector('#modal[open]');
  const txt = await p.locator('#modal').innerText();
  ok(/No hemos podido leer este enlace/.test(txt) && /captura/.test(txt), 'no se lee: «prueba con una captura»');
  await p.screenshot({ path: `${OUT}/web-no-se-lee.png` });
  await p.click('#modal button[type=submit]');
  await p.waitForSelector('#fotoFuentes:not([hidden])');
  ok(await p.locator('#fotoFuentes input[type=file]').count() === 2, 'no se lee: se ofrece la foto (cámara o galería)');
  ok(await p.inputValue('[name=title]') === 'Lo mío', 'no se lee: lo escrito sigue');
  ok(estado.insertadas.length === 0, 'no se lee: nada publicado');
  ok(errores.length === 0, `no se lee: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── Otros fallos: mensaje claro, a mano, y lo escrito sigue ────────────────
for (const [why, frase] of [['bad_link', /tiene que empezar por https/], ['nothing', /No hemos encontrado ningún evento/], ['daily', /Hoy ya se ha leído/], ['cap', /Este mes no se puede/]]) {
  const { ctx, p, errores } = await contexto(nav, { leer: () => ({ ok: false, why }) });
  await nuevo(p);
  await p.fill('[name=title]', 'Lo mío');
  await p.waitForSelector('#enlaceCta');
  await elige(p, 'enlace');
  await pegaEnlace(p, 'https://sala.es/x');
  await p.waitForFunction(() => document.body.innerText.length && document.querySelector('.toast, #toast, [role=status]'));
  await p.waitForTimeout(300);
  ok(frase.test(await p.locator('body').innerText()), `${why}: mensaje claro`);
  ok(await p.inputValue('[name=title]') === 'Lo mío', `${why}: lo escrito sigue`);
  ok(errores.length === 0, `${why}: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── En el móvil (390 px) ───────────────────────────────────────────────────
{
  const { ctx, p, errores } = await contexto(nav, { ancho: 390 });
  await nuevo(p);
  await p.waitForSelector('#enlaceCta');
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(ancho <= 390, `móvil: sin desbordar (${ancho} px)`);
  await p.screenshot({ path: `${OUT}/web-movil.png` });
  ok(errores.length === 0, `móvil: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── El admin: interruptor y coste ──────────────────────────────────────────
{
  const on = { v: false };
  const resumen = { only_users: 0, cap_eur: 1, spent_eur: 0.012, calls: 20, avg_eur: 0.0006, estimate_one_eur: 0.0008, estimate_agenda_eur: 0.004, day_cap: 10, max_events: 20 };
  const { ctx, p, errores, estado } = await contexto(nav, { rpc: {
    admin_piloto_overview: { config: {}, ai: {}, week: { total: 0, undone: 0, by_kind: {} }, month: {}, actions: [], lists: { brand: 0, official_domain: 0 } },
    admin_piloto_list: [],
    admin_photo_fill_overview: { enabled: false, only_users: 0, cap_eur: 1, spent_eur: 0, calls: 0, avg_eur: null, estimate_offer_eur: 0.0006, estimate_menu_photo_eur: 0.002, offer_day_cap: 10, menu_day_cap: 12 },
    admin_link_fill_overview: () => ({ ...resumen, enabled: on.v }),
    admin_link_fill_set: (b) => { on.v = b.p_enabled; return { ok: true, enabled: b.p_enabled }; },
  } });
  await p.goto(`${BASE}/admin#/automatico`);
  await p.waitForSelector('#enlaceInterruptor');
  const txt = await p.locator('#enlaceInterruptor').locator('xpath=ancestor::div[contains(@class,"card")]').innerText();
  ok(/Rellenar desde un enlace o un texto/.test(txt) && /apagado/.test(txt), 'admin: apagado');
  ok(/Estimado, sin medir/.test(txt) && /0,0008/.test(txt) && /0,004/.test(txt), 'admin: el coste estimado');
  await p.click('#enlaceInterruptor');
  await p.waitForFunction(() => /encendido/.test(document.querySelector('#enlaceInterruptor')?.closest('.card')?.innerText || ''));
  ok(estado.llamadas.some(([f, b]) => f === 'admin_link_fill_set' && b.p_enabled === true), 'admin: se enciende');
  await p.screenshot({ path: `${OUT}/web-admin.png`, fullPage: true });
  ok(errores.length === 0, `admin: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

await nav.close();
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
