// «Rellenar desde una foto» en el panel, en la web local, con Supabase contestado aquí (no toca dev ni prod ni llama a
// ninguna IA): apagado no sale; el permiso, una casilla sin marcar; lo leído llena el formulario, con lo dudoso marcado,
// y se deshace; nunca publica sola; si falla, un mensaje y lo escrito sigue; la repetición al publicar; la carta desde
// fotos con alérgenos que hay que confirmar; en francés; el interruptor de «Tu cuenta» y el del admin.
//
//   SUPABASE_BLOQUEADO=1 PORT=8872 node tools/serve_dev.mjs &
//   BASE=http://localhost:8872 PW=<ruta a playwright> OUT=<carpeta> node tools/foto_check.mjs
import { claveSesion, playwright, SUPA, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium } = playwright();
const BASE = process.env.BASE || 'http://localhost:8872';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });

const U = '0e7717e0-0000-4000-8000-00000000f070';
const BIZ = 'b1000000-0000-4000-8000-00000000f070';
const OFERTA = 'c1000000-0000-4000-8000-00000000f070';
const CATS = [
  { id: 'c0000000-0000-4000-8000-000000000001', slug: 'cafe', names: { es: 'Cafeterías', en: 'Cafés' }, position: 1 },
  { id: 'c0000000-0000-4000-8000-000000000002', slug: 'bar', names: { es: 'Bares', en: 'Bars' }, position: 2 },
];
// Un JPEG de 1×1 de verdad: el navegador lo abre y lo reduce.
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const FOTO = { name: 'cartel.jpg', mimeType: 'image/jpeg', buffer: JPG };

let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2',
  amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
})}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'foto@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const sesion = () => JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

const DIA = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
const OFERTA_LEIDA = {
  injection: false, kind: 'flash_offer', title: 'Café y tostada 2,50 €', description: 'De lunes a viernes en barra.',
  price_cents: 250, prior_price_cents: null, discount: null, start: `${DIA}T08:00`, end: `${DIA}T11:00`,
  repeat: { weekdays: [1, 2], start_time: '08:00', minutes: 180 }, category_id: CATS[1].id, category_name: 'Bares', doubts: ['price', 'when'],
};
const CARTA_LEIDA = {
  injection: false,
  sections: [{ name: 'Para picar', items: [
    { name: 'Croquetas', description: null, price_cents: 850, allergens: ['gluten', 'lacteos'], doubt: false },
    { name: 'Boquerones', description: 'Con limón', price_cents: 900, allergens: [], doubt: true },
  ] }],
};

function supabaseFalso(e) {
  return async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = {};
    try { body = req.postDataJSON() || {}; } catch { /* sin cuerpo */ }
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/')) return json({});
    if (p === '/functions/v1/photo-fill') {
      e.lecturas.push(body);
      const r = e.leer(body, e.lecturas.length);
      if (r === 'red') return route.abort('failed');
      return json(r);
    }
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
      return json([{ id: BIZ, time_zone: 'Europe/Madrid', category_id: CATS[0].id, logo_url: null, cover_image_url: null, gallery: [], opening_hours: null, menu_url: null, menu_images: [], created_at: '2026-01-01T00:00:00Z' }]);
    }
    if (p.startsWith('/storage/v1/object/')) {
      if (req.method() === 'POST') { e.subidas.push(p); return json({ Key: 'x' }); }
      return route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPG });
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  };
}

const estadoFoto = (x = {}) => ({ available: true, consent: true, asked: true, offer_left: 10, menu_left: 12, max_menu_photos: 6, ...x });
const PANEL = (x = {}) => ({
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: 'Café Sonda', role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Málaga' }],
  my_business_offer_counts: { total: 3, todas: 3, activa: 1 },
  business_is_organizer: false,
  business_menu: [{ name: 'Para picar', items: [{ name: 'Tortilla', price_cents: 700, allergens: [] }] }],
  save_offer_rule: 'r1',
  save_business_menu: { ok: true, sections: 2, items: 3 },
  set_menu_files: [],
  update_business: { ok: true },
  my_entity_application: { entity_kind: null, application: null, can_apply: true },
  ...x,
});

async function contexto(nav, { lang = 'es', rpc = {}, leer = () => ({ ok: true, kind: 'offer', read: OFERTA_LEIDA, left: 9, micro_usd: 600 }) }) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, l, a]) => {
    try {
      localStorage.setItem(k, v);
      localStorage.setItem(a, v);
      localStorage.setItem('klendar_lang', l);
    } catch { /* */ }
  }, [claveSesion(), sesion(), lang, claveSesion('admin')]);
  const estado = { llamadas: [], insertadas: [], subidas: [], lecturas: [], rpc: PANEL(rpc), leer };
  await ctx.route(`${SUPA}/**`, supabaseFalso(estado));
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (x) => errores.push(x.message));
  p.setDefaultTimeout(15000);
  return { ctx, p, estado, errores };
}

const nueva = async (p) => {
  await p.goto(`${BASE}/panel/#/publicaciones/nueva-flash`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[name=title]');
};
const abreFuentes = async (p) => {
  await p.click('#fotoCta');
  await p.waitForSelector('#fotoFuentes:not([hidden])');
};
const subeFoto = (p) => p.locator('#fotoFuentes input[type=file]').last().setInputFiles(FOTO);

const nav = await chromium.launch();
const estado2 = { on: false };

// ── Apagado ───────────────────────────────────────────────────────────────
{
  const { ctx, p, errores, estado } = await contexto(nav, { rpc: { photo_fill_status: estadoFoto({ available: false, consent: false }) } });
  await nueva(p);
  await p.waitForTimeout(300);
  ok(await p.locator('#fotoCta').count() === 0, 'apagado: en el formulario no sale');
  await p.goto(`${BASE}/panel/#/carta`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#add-sec');
  ok(await p.locator('#foto-carta').count() === 0, 'apagado: en la carta no sale');
  ok(estado.lecturas.length === 0, 'apagado: no se llama a nadie');
  ok(errores.length === 0, `apagado: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── El permiso ────────────────────────────────────────────────────────────
{
  const { ctx, p, errores, estado } = await contexto(nav, { rpc: { photo_fill_status: estadoFoto({ consent: false, asked: false }), set_ai_consent: { ok: true } } });
  await nueva(p);
  await p.fill('[name=title]', 'Lo mío');
  await p.click('#fotoCta');
  await p.waitForSelector('#modal[open]');
  const txt = await p.locator('#modal').innerText();
  ok(/Claude/.test(txt) && /Anthropic/.test(txt) && /Estados Unidos/.test(txt), 'permiso: dice a quién va y dónde');
  ok(!await p.locator('#modal [name=foto_permiso]').isChecked(), 'permiso: la casilla, sin marcar');
  await p.screenshot({ path: `${OUT}/foto-permiso.png` });
  await p.click('#modal button[type=submit]');
  ok(await p.locator('#modal[open]').count() === 1, 'permiso: sin marcarla no sigue');
  ok(!estado.llamadas.some(([f]) => f === 'set_ai_consent'), 'permiso: sin marcarla no se guarda nada');
  await p.click('#modal [data-cancel]');
  ok(await p.locator('#fotoFuentes:not([hidden])').count() === 0, 'permiso: «Ahora no» y a mano');
  ok(await p.inputValue('[name=title]') === 'Lo mío', 'permiso: lo escrito sigue');
  ok(!estado.llamadas.some(([f]) => f === 'set_ai_consent'), 'permiso: «Ahora no» no guarda nada');
  await p.click('#fotoCta');
  await p.check('#modal [name=foto_permiso]');
  await p.click('#modal button[type=submit]');
  await p.waitForSelector('#fotoFuentes:not([hidden])');
  const dado = estado.llamadas.find(([f]) => f === 'set_ai_consent');
  ok(dado?.[1]?.p_use === 'photo_fill' && dado?.[1]?.p_granted === true, 'permiso: se guarda, para este uso');
  ok(errores.length === 0, `permiso: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── Rellenar, revisar, deshacer y publicar ────────────────────────────────
{
  const { ctx, p, errores, estado } = await contexto(nav, { rpc: { photo_fill_status: estadoFoto() } });
  await nueva(p);
  await abreFuentes(p);
  ok(await p.locator('#fotoFuentes input[capture]').count() === 1, 'cámara y galería');
  await subeFoto(p);
  await p.waitForSelector('.foto-hecho');
  const leida = estado.lecturas[0];
  ok(leida.kind === 'offer' && leida.business_id === BIZ && leida.mime === 'image/jpeg' && leida.image.length > 10, 'manda una foto reducida a JPEG, con su negocio');
  ok(await p.inputValue('[name=title]') === OFERTA_LEIDA.title, 'llena el título');
  ok(await p.inputValue('[name=description]') === OFERTA_LEIDA.description, 'llena la descripción');
  ok(await p.inputValue('[name=price]') === '2,50', 'llena el precio');
  ok(await p.inputValue('[name=start]') === `${DIA}T08:00` && await p.inputValue('[name=end]') === `${DIA}T11:00`, 'llena fechas y horas');
  ok(await p.locator('.foto-duda').count() === 2, 'lo dudoso, marcado debajo de su campo');
  const aviso = await p.locator('.foto-hecho').innerText();
  ok(/Revísalo antes de publicar/.test(aviso), 'dice que lo revise');
  ok(/Bares/.test(aviso), 'dice qué categoría propone');
  ok(/lun, mar · 08:00–11:00/.test(aviso), 'dice que se repite, con sus días');
  ok(estado.insertadas.length === 0, 'NO publica solo');
  await p.screenshot({ path: `${OUT}/foto-rellenado.png`, fullPage: true });
  // Deshacer deja el formulario como estaba.
  await p.click('#fotoDeshacer');
  await p.waitForSelector('#fotoCta');
  ok(await p.inputValue('[name=title]') === '' && await p.inputValue('[name=price]') === '', 'deshacer: como estaba');
  ok(await p.locator('.foto-duda').count() === 0, 'deshacer: sin marcas');
  // Otra vez y publicar: la repetición, unida a la publicación.
  await p.click('#fotoCta');
  await subeFoto(p);
  await p.waitForSelector('.foto-hecho');
  await p.click('#fotoImagen');
  await p.waitForFunction(() => document.querySelector('.foto-hecho')?.innerText.includes('Foto añadida'));
  ok(estado.subidas.length === 1, 'usar la foto como imagen: se sube solo entonces');
  await p.click('#btnPublicar');
  await p.click('#pubAhora');
  await p.waitForFunction(() => location.hash.includes('publicaciones') && !location.hash.includes('nueva'), null, { timeout: 8000 }).catch(() => {});
  ok(estado.insertadas.length === 1 && estado.insertadas[0].status === 'active' && estado.insertadas[0].title === OFERTA_LEIDA.title, 'lo publica el dueño, con «Publicar»');
  const regla = estado.llamadas.find(([f]) => f === 'save_offer_rule');
  ok(regla?.[1]?.p_offer === OFERTA && JSON.stringify(regla?.[1]?.p_weekdays) === '[1,2]' && regla?.[1]?.p_start_time === '08:00' && regla?.[1]?.p_duration_min === 180, 'la repetición, al publicar');
  ok(errores.length === 0, `rellenar: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── Sin precio anterior en una rebaja; 2x1 sin contestar el alcohol; inyección ─
{
  const rebaja = { ...OFERTA_LEIDA, title: '-20 % en todo', description: '', price_cents: null, discount: { type: 'percent', value: '20' }, repeat: null, category_id: null, category_name: null, doubts: ['prior_price', 'when'], injection: true };
  const { ctx, p, errores } = await contexto(nav, { rpc: { photo_fill_status: estadoFoto() }, leer: () => ({ ok: true, kind: 'offer', read: rebaja }) });
  await nueva(p);
  await abreFuentes(p);
  await subeFoto(p);
  await p.waitForSelector('.foto-hecho');
  ok(await p.inputValue('[name=prior_price]') === '', 'rebaja: el precio anterior no se inventa');
  ok(/la ley pide que lo pongas tú/.test(await p.locator('#form').innerText()), 'rebaja: y se dice');
  ok(/instrucciones para una IA/.test(await p.locator('.foto-hecho').innerText()), 'inyección: se avisa de que no se le ha hecho caso');
  ok(errores.length === 0, `rebaja: sin errores (${errores.join(' | ')})`);
  await ctx.close();
  const dos = { ...OFERTA_LEIDA, title: '2x1 en cañas', discount: { type: '2x1', value: '' }, price_cents: null, repeat: null, doubts: [] };
  const c2 = await contexto(nav, { rpc: { photo_fill_status: estadoFoto() }, leer: () => ({ ok: true, kind: 'offer', read: dos }) });
  await nueva(c2.p);
  await abreFuentes(c2.p);
  await subeFoto(c2.p);
  await c2.p.waitForSelector('.foto-hecho');
  ok(await c2.p.locator('[name=alcohol]:checked').count() === 0, '2x1: lo del alcohol se queda sin contestar');
  await c2.ctx.close();
}

// ── Si falla: mensaje claro, a mano, y lo escrito sigue ───────────────────
for (const [why, frase] of [['nothing', /No vemos ningún cartel/], ['cap', /Este mes no se pueden/], ['daily', /Hoy ya se han leído/], ['off', /Ahora no se pueden/], ['failed', /No hemos podido leer/], ['unreadable', /No hemos podido leer/], ['red', /Sin conexión/]]) {
  const { ctx, p, errores, estado } = await contexto(nav, { rpc: { photo_fill_status: estadoFoto() }, leer: () => (why === 'red' ? 'red' : { ok: false, why }) });
  await nueva(p);
  await p.fill('[name=title]', 'Lo mío');
  await p.fill('[name=description]', 'Mi texto');
  await abreFuentes(p);
  await subeFoto(p);
  await p.waitForFunction(() => document.querySelector('#toasts')?.innerText.trim().length > 0);
  ok(frase.test(await p.locator('#toasts').innerText()), `${why}: mensaje claro`);
  ok(await p.inputValue('[name=title]') === 'Lo mío' && await p.inputValue('[name=description]') === 'Mi texto', `${why}: lo escrito sigue`);
  ok(estado.insertadas.length === 0 && await p.locator('.foto-hecho').count() === 0, `${why}: nada más`);
  ok(errores.length === 0, `${why}: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── Con algo escrito: no se pisa ──────────────────────────────────────────
{
  const { ctx, p } = await contexto(nav, { rpc: { photo_fill_status: estadoFoto() } });
  await nueva(p);
  await p.fill('[name=title]', 'Lo mío');
  await abreFuentes(p);
  await subeFoto(p);
  await p.waitForSelector('.foto-hecho');
  ok(await p.inputValue('[name=title]') === 'Lo mío', 'lo ya escrito no se pisa');
  ok(await p.inputValue('[name=price]') === '2,50', '…y lo vacío se llena');
  await ctx.close();
}

// ── La carta ──────────────────────────────────────────────────────────────
{
  const { ctx, p, errores, estado } = await contexto(nav, {
    rpc: { photo_fill_status: estadoFoto() },
    leer: (_b, n) => (n === 2 ? { ok: false, why: 'unreadable' } : { ok: true, kind: 'menu', read: CARTA_LEIDA }),
  });
  await p.goto(`${BASE}/panel/#/carta`, { waitUntil: 'networkidle' });
  await p.waitForSelector('#foto-carta');
  await p.click('#foto-carta');
  await p.waitForSelector('.foto-fuentes');
  await p.locator('.foto-fuentes input[type=file]').last().setInputFiles([FOTO, { ...FOTO, name: 'b.jpg' }]);
  await p.waitForSelector('#fotoLeer');
  ok(/2 fotos/.test(await p.locator('#fotoLeer').innerText()), 'carta: varias fotos');
  await p.screenshot({ path: `${OUT}/foto-carta-fotos.png`, fullPage: true });
  await p.click('#fotoLeer');
  await p.waitForSelector('#fotoAnadir');
  ok(estado.lecturas.length === 2 && estado.lecturas[0].kind === 'menu', 'carta: se leen una a una');
  const txt = await p.locator('#view').innerText();
  ok(/Una foto no se ha podido leer/.test(txt), 'carta: si una falla, se dice y sigue con las demás');
  ok(await p.inputValue('[data-i="0:0:name"]') === 'Croquetas' && await p.inputValue('[data-i="0:0:price"]') === '8,50', 'carta: lista editable');
  ok(/Gluten/.test(txt) && /Compruébalos con tu cocina/.test(txt), 'carta: alérgenos a la vista, para revisar');
  ok(await p.locator('.foto-plato .foto-duda').count() === 1, 'carta: el dudoso, marcado');
  ok(await p.locator('#fotoAnadir').isDisabled(), 'carta: sin confirmar los alérgenos, no se añade');
  await p.screenshot({ path: `${OUT}/foto-carta-revision.png`, fullPage: true });
  await p.fill('[data-i="0:0:name"]', 'Croquetas de jamón');
  await p.check('#fotoAl');
  ok(await p.locator('#fotoAnadir').isEnabled(), 'carta: confirmados, sí');
  await p.click('#fotoAnadir');
  await p.waitForSelector('#add-sec');
  const carta = await p.locator('#view').innerText();
  ok(/Tortilla/.test(carta) && /Croquetas de jamón/.test(carta) && /Boquerones/.test(carta), 'carta: se añade sin quitar lo que había, con lo corregido');
  ok(!estado.llamadas.some(([f]) => f === 'save_business_menu'), 'carta: NO guarda sola');
  await p.click('#save');
  for (let i = 0; i < 50 && !estado.llamadas.some(([f]) => f === 'save_business_menu'); i++) await p.waitForTimeout(100);
  const guarda = estado.llamadas.find(([f]) => f === 'save_business_menu');
  const secc = guarda?.[1]?.p_menu || [];
  ok(secc.length === 1 && secc[0].items.length === 3, 'carta: se guarda con «Guardar la carta», en la misma sección');
  ok(JSON.stringify(secc[0].items.find((i) => i.name.startsWith('Croquetas'))?.allergens) === '["gluten","lacteos"]', 'carta: con los alérgenos confirmados');
  ok(JSON.stringify(secc[0].items.find((i) => i.name === 'Boquerones')?.allergens) === '[]', 'carta: ningún alérgeno inventado');
  ok(errores.length === 0, `carta: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// Sin nada leído: de vuelta a las fotos, con el mensaje.
{
  const { ctx, p, errores } = await contexto(nav, { rpc: { photo_fill_status: estadoFoto() }, leer: () => ({ ok: false, why: 'cap' }) });
  await p.goto(`${BASE}/panel/#/carta`, { waitUntil: 'networkidle' });
  await p.click('#foto-carta');
  await p.waitForSelector('.foto-fuentes');
  await p.locator('.foto-fuentes input[type=file]').last().setInputFiles(FOTO);
  await p.waitForSelector('#fotoLeer');
  await p.click('#fotoLeer');
  await p.waitForFunction(() => /Este mes no se pueden/.test(document.querySelector('#view')?.innerText || ''));
  ok(await p.locator('#fotoLeer').count() === 1, 'carta sin tope: se queda con las fotos y el mensaje');
  ok(errores.length === 0, `carta sin tope: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── En francés ────────────────────────────────────────────────────────────
{
  const { ctx, p, errores } = await contexto(nav, { lang: 'fr', rpc: { photo_fill_status: estadoFoto({ consent: false, asked: false }), set_ai_consent: { ok: true } } });
  await nueva(p);
  await p.waitForSelector('#fotoCta');
  ok(/Remplir à partir d’une photo/.test(await p.locator('#fotoRellena').innerText()), 'francés: la tarjeta');
  await p.click('#fotoCta');
  await p.waitForSelector('#modal[open]');
  ok(/On lit ta photo/.test(await p.locator('#modal').innerText()), 'francés: el permiso');
  ok(errores.length === 0, `francés: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

// ── «Tu cuenta»: dar y quitar el permiso ──────────────────────────────────
{
  const { ctx, p, errores, estado } = await contexto(nav, { rpc: {
    photo_fill_status: { available: false, consent: true, asked: true, max_menu_photos: 6 },
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, has_birth_date: true },
    ai_consent_status: { active: false, granted: false },
    set_ai_consent: { ok: true },
  } });
  await p.goto(`${BASE}/cuenta/ajustes`);
  await p.waitForSelector('#permiso-ia-foto', { state: 'attached' });
  await p.waitForSelector('#dt-ia-foto:not([hidden])');
  ok(await p.locator('#permiso-ia-foto').isChecked(), '«Tu cuenta»: el interruptor, tras contestar');
  await p.locator('#permiso-ia-foto').uncheck();
  for (let i = 0; i < 30 && !estado.llamadas.some(([f]) => f === 'set_ai_consent'); i++) await p.waitForTimeout(100);
  const quita = estado.llamadas.find(([f]) => f === 'set_ai_consent');
  ok(quita?.[1]?.p_granted === false && quita?.[1]?.p_use === 'photo_fill', '«Tu cuenta»: quitarlo, para este uso');
  ok(errores.length === 0, `«Tu cuenta»: sin errores (${errores.join(' | ')})`);
  await ctx.close();
  const c2 = await contexto(nav, { rpc: {
    photo_fill_status: { available: false, consent: false, asked: false, max_menu_photos: 6 },
    my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, has_birth_date: true },
  } });
  await c2.p.goto(`${BASE}/cuenta/ajustes`);
  await c2.p.waitForSelector('#permiso-ia-foto', { state: 'attached' });
  await c2.p.waitForTimeout(300);
  ok(await c2.p.locator('#dt-ia-foto:not([hidden])').count() === 0, '«Tu cuenta»: sin haber contestado, no sale');
  await c2.ctx.close();
}

// ── El admin: interruptor y coste ─────────────────────────────────────────
{
  const resumen = { enabled: false, only_users: 0, cap_eur: 1, spent_eur: 0.0123, calls: 20, avg_eur: 0.0006, estimate_offer_eur: 0.0006, estimate_menu_photo_eur: 0.002, offer_day_cap: 10, menu_day_cap: 12 };
  const { ctx, p, errores, estado } = await contexto(nav, { rpc: {
    admin_piloto_overview: { config: {}, ai: {}, week: { total: 0, undone: 0, by_kind: {} }, month: {}, actions: [], lists: { brand: 0, official_domain: 0 } },
    admin_piloto_list: [],
    admin_photo_fill_overview: () => ({ ...resumen, enabled: estado2.on }),
    admin_photo_fill_set: (b) => { estado2.on = b.p_enabled; return { ok: true, enabled: b.p_enabled }; },
  } });
  await p.goto(`${BASE}/admin/#/automatico`);
  await p.waitForSelector('#fotoInterruptor');
  const txt = await p.locator('#fotoInterruptor').locator('xpath=ancestor::div[contains(@class,"card")]').innerText();
  ok(/Rellenar desde una foto/.test(txt) && /apagado/.test(txt), 'admin: apagado');
  ok(/0,012/.test(txt) && /1,00\s€/.test(txt) && /20 fotos/.test(txt), 'admin: lo gastado, contra su tope');
  ok(/Estimado, sin medir/.test(txt) && /0,0006/.test(txt) && /0,002/.test(txt), 'admin: el coste estimado');
  await p.click('#fotoInterruptor');
  await p.waitForFunction(() => /encendido/.test(document.querySelector('#fotoInterruptor')?.closest('.card')?.innerText || ''));
  ok(estado.llamadas.some(([f, b]) => f === 'admin_photo_fill_set' && b.p_enabled === true), 'admin: se enciende');
  await p.screenshot({ path: `${OUT}/foto-admin.png`, fullPage: true });
  ok(errores.length === 0, `admin: sin errores (${errores.join(' | ')})`);
  await ctx.close();
}

await nav.close();
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
