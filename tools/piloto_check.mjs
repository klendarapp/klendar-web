// El piloto automático en la web, con Supabase contestado aquí (no toca dev ni prod): el Resumen con
// «Lo que se ha hecho solo» y deshacer en un toque, la pantalla «Automático» (interruptores y listas),
// lo que dicen las colas de por qué algo te llega, y «¿Es tu negocio?» con el código, en español y en francés.
//
//   SUPABASE_BLOQUEADO=1 PORT=8897 node tools/serve_dev.mjs &
//   BASE=http://localhost:8897 PW=<ruta a playwright> OUT=<carpeta> node tools/piloto_check.mjs
import { playwright, REF, SUPA, realtimeMudo, servidorSeguro } from './_supabase_simulado.mjs';

const { chromium } = playwright();
const BASE = process.env.BASE || 'http://localhost:8897';
await servidorSeguro(BASE);
const OUT = process.env.OUT || 'tools/out';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });

const U = '0e7717e0-0000-4000-8000-0000000097d4';
const B = '0e7717e0-0000-4000-8000-00000000b12d';
const CL = '0e7717e0-0000-4000-8000-00000000c1a1';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ahora = Math.floor(Date.now() / 1000);
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aal: 'aal2', exp: 4102444800, amr: [{ method: 'password', timestamp: ahora }] })}.x`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'piloto@example.com', app_metadata: {}, user_metadata: { display_name: 'Piloto' }, created_at: '2026-01-01T00:00:00Z' };
const SESION = JSON.stringify({ access_token: jwt(), refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });

let fallos = 0;
function ok(cond, nombre, extra = '') {
  if (cond) console.log(`  ok  ${nombre}`);
  else { fallos += 1; console.log(`  MAL ${nombre} ${extra}`); }
}

const ACCIONES = [
  { id: 'a0000000-0000-4000-8000-000000000001', kind: 'verify_business', target_type: 'business', target_id: B, business_id: B, label: 'Bar Prueba', reasons: ['tax_id'], ai: false, undoable: true, created_at: '2026-11-05T10:00:00Z' },
  { id: 'a0000000-0000-4000-8000-000000000002', kind: 'report_hide', target_type: 'offer', target_id: B, business_id: null, label: 'offer', reasons: ['insults'], ai: true, undoable: true, created_at: '2026-11-05T09:00:00Z' },
  { id: 'a0000000-0000-4000-8000-000000000003', kind: 'venue_group', target_type: 'venue_request', target_id: B, business_id: null, label: 'Sushi', reasons: [], ai: false, undoable: false, created_at: '2026-11-05T08:00:00Z' },
];

async function abre(nav, { lang = 'es', claveAdmin = false }) {
  const ctx = await nav.newContext({ viewport: { width: 1200, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(([k, v, a, l]) => {
    try {
      localStorage.setItem(k, v);
      if (a) localStorage.setItem(a, v);
      localStorage.setItem('klendar_lang', l);
    } catch { /* */ }
  }, [`sb-${REF}-auth-token`, SESION, claveAdmin ? `sb-${REF}-admin-auth-token` : '', lang]);
  const estado = { rpc: [], cfg: { verify_business: { enabled: false }, report_review: { enabled: true } }, acciones: ACCIONES.map((x) => ({ ...x })), marcas: [{ id: 'm1', value: 'starbucks' }], codigo: { available: true, masked: 'i***@bar.es', sent: false, sends_left: 2 } };
  await ctx.route(`${BASE}/api/**`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.pathname.startsWith('/auth/v1/user')) return json(USER);
    if (url.pathname.startsWith('/auth/v1/')) return json({});
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.split('/').pop();
      const cuerpo = req.postData() ? JSON.parse(req.postData()) : {};
      estado.rpc.push({ fn, cuerpo });
      switch (fn) {
        case 'admin_kpis': return json({ businesses_pending: 1, reports_open: 1, offers_pending: 0 });
        case 'admin_attention': return json({ pending: {}, tasks: { crons: [], agenda: [], leagues: [], billing: {} }, urgent: [], alerts: { config: { email: true } }, media_filter: { enabled: false }, free_tier_cfg: { warn_pct: 80 }, free_tier: [] });
        case 'admin_pending_now': return json({ total: 1, rows: [{ id: B, name: 'Bar Pendiente', city: 'Málaga', address: 'Calle 1', created_at: '2026-11-05T10:00:00Z', category: 'Bares', has_tax_id: false, has_logo: false, offers: 0, rules: 0, owner_email: 'a@example.com', auto_failed: ['tax_id', 'brand'] }] });
        case 'admin_piloto_overview': return json({ config: estado.cfg, ai: { report_review: { enabled: true, cap_eur: 1, spent_eur: 0.012 }, document_review: { enabled: false, cap_eur: 1, spent_eur: 0 } }, week: { total: 3, undone: 0, by_kind: { verify_business: 1, report_hide: 1, venue_group: 1 } }, month: {}, actions: estado.acciones, lists: { brand: estado.marcas.length, official_domain: 0 } });
        case 'admin_piloto_undo': {
          const a = estado.acciones.find((x) => x.id === cuerpo.p_id);
          a.undone_at = '2026-11-05T11:00:00Z';
          return json({ ok: true, kind: a.kind });
        }
        case 'admin_piloto_set': estado.cfg[cuerpo.p_part] = { enabled: cuerpo.p_enabled }; return json({ ok: true });
        case 'admin_piloto_list': return json(cuerpo.p_kind === 'brand' ? estado.marcas : []);
        case 'admin_piloto_list_add': estado.marcas.push({ id: 'm2', value: cuerpo.p_value }); return json({ ok: true });
        case 'admin_piloto_list_remove': estado.marcas = estado.marcas.filter((x) => x.id !== cuerpo.p_id); return json(null);
        case 'admin_business_claims': return json({ counts: { pending: 1 }, items: [{ id: CL, status: 'pending', created_at: '2026-11-05T10:00:00Z', role_title: 'Dueña', contact_email: 'a@b.es', business_id: B, business_name: 'Bar Reclamado', user_id: U, user_email: 'r@example.com', proved_at: '2026-11-05T10:30:00Z', proved_via: 'code_email', auto_failed: ['owner_active'], doc_check: { verdict: 'no_coincide', motive: 'nif_distinto', state: 'done' } }] });
        case 'admin_report_groups': return json({ total: 1, hot: 0, rows: [{ target_type: 'offer', target_id: B, n: 1, open_count: 1, total_count: 1, people: 1, with_account: 1, without_account: 0, last_at: '2026-11-05T10:00:00Z', state: 'published', live: true, target: { title: 'Oferta', business: 'Bar', business_id: B }, reasons: [{ reason: 'spam', n: 1 }], ai: { verdict: 'dudoso', confidence: 0.5, reason: 'No está claro', action: 'to_admin', why: 'doubt', decided_at: '2026-11-05T10:20:00Z' } }] });
        case 'admin_duplicate_alerts': return json([{ id: B, name: 'Mesón', city: 'Málaga', verification_status: 'pending', created_at: '2026-11-05T10:00:00Z', pending: true, candidates: [{ id: CL, name: 'Mesón SL', city: 'Málaga', verification_status: 'verified', reason: 'same_name_city', safe: true }] }]);
        case 'business_profile': return json([{ id: B, name: 'Bar Reclamado', city: 'Málaga' }]);
        case 'my_business_claim': return json({ can_claim: false, why: 'already_pending', claim: { id: CL, status: 'pending', created_at: '2026-11-05T10:00:00Z' } });
        case 'my_claim_code': return json(estado.codigo);
        case 'request_claim_code': estado.codigo.sent = true; return json({ ok: true, masked: 'i***@bar.es' });
        case 'verify_claim_code':
          return cuerpo.p_code === '123456' ? json({ ok: true, resolved: true }) : json({ ok: false, error: 'code_wrong', attempts_left: 4 });
        case 'claim_code_no_access': return json({ ok: true });
        case 'my_consents': return json({ terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true, has_birth_date: true });
        case 'my_tastes': return json({ categories: ['bares'], asked_at: '2026-01-01T00:00:00Z' });
        default: return json(null);
      }
    }
    if (url.pathname.startsWith('/rest/v1/admin_users')) return json([{ user_id: U }]);
    if (url.pathname.startsWith('/rest/v1/profiles')) {
      const f = { id: U, display_name: 'Ana', avatar_url: null, birth_date: '1990-01-01', locale: lang };
      return json(req.headers().accept?.includes('vnd.pgrst.object') ? f : [f]);
    }
    if (url.pathname.startsWith('/rest/v1/')) return json([]);
    return json({});
  });
  await realtimeMudo(ctx);
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  return { ctx, page, estado, errs };
}

const nav = await chromium.launch();
console.log('Resumen del admin');
{
  const { ctx, page, estado, errs } = await abre(nav, { claveAdmin: true });
  await page.goto(`${BASE}/admin#/resumen`, { waitUntil: 'load' });
  await page.waitForSelector('#hechoSolo', { timeout: 15000 });
  const t = await page.textContent('#hechoSolo');
  ok(t.includes('Lo que se ha hecho solo'), 'el bloque está');
  ok(t.includes('negocio verificado') && t.includes('contenido oculto tras una denuncia'), 'el recuento', t);
  ok((await page.$$('#hechoSolo [data-deshacer]')).length === 2, 'deshacer en lo que se puede, no en lo que no');
  ok((await page.textContent('#porVerificar')).includes('Por qué te llega'), '«Por verificar ahora» dice por qué');
  await page.selectOption('#hechoSolo [data-motivo]', 'data');
  await page.click('#hechoSolo [data-deshacer]');
  await page.waitForFunction(() => document.body.textContent.includes('deshecho'), null, { timeout: 8000 });
  const u = estado.rpc.find((x) => x.fn === 'admin_piloto_undo');
  ok(u && u.cuerpo.p_motive === 'data', 'un toque, con el motivo elegido', JSON.stringify(u));
  await page.screenshot({ path: `${OUT}/piloto_resumen.png` });

  console.log('Automático');
  await page.goto(`${BASE}/admin#/automatico`, { waitUntil: 'load' });
  await page.waitForSelector('[data-parte]', { timeout: 15000 });
  ok((await page.$$('[data-parte]')).length === 9, '9 interruptores');
  ok((await page.textContent('#view, main, body')).includes('apagado'), 'dice si está apagado');
  await page.waitForSelector('#listaMarcas [data-quita]', { timeout: 8000 });
  await page.fill('#listaMarcas input[name=v]', 'Cadena X');
  await page.click('#listaMarcas [data-anade] button');
  await page.waitForFunction(() => document.querySelector('#listaMarcas').textContent.includes('Cadena X'), null, { timeout: 8000 });
  ok(true, 'añadir una marca');
  await page.screenshot({ path: `${OUT}/piloto_automatico.png`, fullPage: true });

  console.log('Colas');
  await page.goto(`${BASE}/admin#/reclamaciones`, { waitUntil: 'load' });
  await page.waitForSelector('#list .item', { timeout: 15000 });
  const r = await page.textContent('#list');
  ok(r.includes('Código comprobado') && r.includes('el dueño está activo') && r.includes('no coincide') && r.includes('otro NIF'), 'reclamaciones: código, por qué y documento', r.slice(0, 300));
  await page.goto(`${BASE}/admin#/denuncias`, { waitUntil: 'load' });
  await page.waitForSelector('#list .item', { timeout: 15000 });
  const d = await page.textContent('#list');
  ok(d.includes('Lectura con IA') && d.includes('No está claro'), 'denuncias: lo que ha leído la IA', d.slice(0, 300));
  await page.goto(`${BASE}/admin#/duplicados`, { waitUntil: 'load' });
  await page.waitForSelector('#list .item', { timeout: 15000 });
  ok((await page.textContent('#list')).includes('Coinciden con seguridad'), 'duplicados: los seguros, marcados');
  ok(errs.length === 0, 'sin errores de JavaScript', errs.join(' | '));
  await ctx.close();
}

for (const [lang, titulo, boton, malo] of [['es', 'Demuéstralo con un código', 'Mandar el código', 'Ese código no es'], ['fr', 'Prouve-le avec un code', 'Envoyer le code', 'Ce n’est pas le bon code']]) {
  console.log(`«¿Es tu negocio?» (${lang})`);
  const { ctx, page, estado, errs } = await abre(nav, { lang });
  await page.goto(`${BASE}/cuenta/reclamar/${B}?lang=${lang}`, { waitUntil: 'load' });
  await page.waitForSelector('#codigo', { timeout: 15000 }).catch(async (e) => {
    throw e;
  });
  const t = await page.textContent('#codigo');
  ok(t.includes(titulo) && t.includes('i***@bar.es'), 'pide el código y enseña el correo enmascarado', t.slice(0, 200));
  ok((await page.textContent('#pedirCodigo')).includes(boton), 'el botón, en su idioma');
  await page.click('#pedirCodigo');
  await page.waitForSelector('#codigoForm:not([hidden])', { timeout: 8000 });
  ok(estado.rpc.some((x) => x.fn === 'request_claim_code' && x.cuerpo.p_claim === CL), 'lo pide');
  await page.fill('#codigoForm input', '000000');
  await page.click('#comprobarCodigo');
  await page.waitForFunction((m) => document.querySelector('#errCodigo')?.textContent.includes(m), malo, { timeout: 8000 });
  ok(true, 'un código mal lo dice, en su idioma');
  await page.fill('#codigoForm input', '123456');
  await page.click('#comprobarCodigo');
  await page.waitForFunction(() => document.body.textContent.length > 0, null, { timeout: 3000 });
  await page.waitForTimeout(400);
  ok(estado.rpc.some((x) => x.fn === 'verify_claim_code' && x.cuerpo.p_code === '123456'), 'manda el bueno');
  ok(errs.length === 0, 'sin errores de JavaScript', errs.join(' | '));
  await page.screenshot({ path: `${OUT}/piloto_codigo_${lang}.png` });
  await ctx.close();
}
await nav.close();
console.log(fallos ? `\n${fallos} MAL` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
