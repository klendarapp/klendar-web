// Accesibilidad de la web, medida (parte 1 de «Accesibilidad», 19-11-2026):
// las páginas públicas, «Tu cuenta» y el panel (con una sesión de mentira),
// en claro y en oscuro, con datos de mentira (tools/_web_con_datos.mjs: no
// sale nada a Supabase). En cada página:
//
// Y el admin (parte 2), con una sesión de administradora de mentira.
//
//   · axe-core con las reglas de WCAG 2.1 A y AA (contraste 4,5:1 y 3:1,
//     nombres de botones, enlaces e imágenes, campos con etiqueta, `lang`,
//     título, ARIA bien puesto, orden de encabezados…);
//   · el foco con el teclado: se recorre con Tab y cada parada tiene que
//     verse (contorno, sombra, subrayado o un cambio de fondo o de borde);
//   · lo que se toca con el ratón y no con el teclado (cursor de mano en algo
//     que no es enlace, botón ni campo y no tiene tabindex);
//   · los bordes de los campos, 3:1 con el fondo (WCAG 1.4.11; axe no los
//     mide; parte 2, 19-11-2026);
//   · reflujo: a 320 px de ancho (lo mismo que 1280 con el zoom al 400 %) no
//     hay scroll horizontal. El 200 % (640 px) y la letra grande ya los mira
//     tools/barrido_check.mjs.
//
//   PW=<ruta a playwright> node tools/a11y_check.mjs     (axe-core: npm install -g axe-core,
//                                                        o AXE=<ruta a axe.min.js o a su carpeta>)
//   Unos 95 s; va en el pre-push si están Playwright y axe-core.
//   A11Y_SOLO=/precios,/cuenta/planes     solo esas rutas
//   A11Y_INFORME=1                        no falla: solo cuenta (diagnóstico)
//   A11Y_VER=1                            dice qué ha visto en cada página (y una captura)
//   A11Y_ANCHO=1280                       en el ordenador (de serie, un móvil de 390)
//
// Lo que sale y no se arregla sin cambiar el aspecto (colores, tamaños) va
// en PERMITIDOS con su porqué: lo decide Iván (PROPUESTA de accesibilidad).
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { webConDatos, NEGOCIOS, PLANES } from './_web_con_datos.mjs';
import { enSuHost, playwright, REF, SUPA } from './_supabase_simulado.mjs';

const { chromium } = playwright();
const OUT = process.env.OUT || 'tools/out/a11y';
mkdirSync(OUT, { recursive: true });
const INFORME = process.env.A11Y_INFORME === '1';
// A11Y_ANCHO=1280: en el ordenador (de serie, un móvil de 390).
const VENTANA = { width: Number(process.env.A11Y_ANCHO || 390), height: 844 };

function axeFuente() {
  let ruta = process.env.AXE || '';
  if (!ruta) {
    try { ruta = createRequire(import.meta.url).resolve('axe-core/axe.min.js'); } catch { /* sin instalar */ }
  }
  // El global (npm install -g axe-core): en Windows, en %APPDATA%/npm/node_modules.
  if (!ruta && process.env.APPDATA) ruta = join(process.env.APPDATA, 'npm', 'node_modules', 'axe-core');
  if (ruta && existsSync(ruta) && statSync(ruta).isDirectory()) ruta = join(ruta, 'axe.min.js');
  if (!ruta || !existsSync(ruta)) {
    console.log('a11y_check: falta axe-core (npm install -g axe-core, o AXE=<ruta a axe.min.js>).');
    process.exit(2);
  }
  return readFileSync(ruta, 'utf8');
}
const AXE = axeFuente();

const oferta = PLANES.find((p) => p.kind === 'flash_offer');
const evento = PLANES.find((p) => p.kind === 'future_event');
const PUBLICAS = [
  '/', '/descubre', '/explorar', '/explorar?que=sitios', `/b/${NEGOCIOS[0].slug}`, `/o/${oferta.id}`, `/o/${evento.id}`,
  '/precios', '/para-negocios', '/para-entidades', '/como-funciona', '/preguntas', '/soporte', '/novedades', '/sobre',
  '/accesibilidad', '/privacidad', '/en', '/alta', '/cuenta', '/panel',
];
const CON_SESION = [
  '/cuenta', '/cuenta/planes', '/cuenta/codigos', '/cuenta/sellos', '/cuenta/favoritos', '/cuenta/ajustes',
  '/cuenta/notificaciones', '/cuenta/tus-datos', '/cuenta/amigos',
  '/panel/hoy', '/panel/publicar', '/panel/negocio', '/panel/ficha', '/panel/validar', '/panel/ayuda',
];
// El admin (parte 2, 19-11-2026), con una sesión de administradora de mentira:
// cada pantalla del menú, con las listas vacías (lo que no se contesta, `[]`).
const ADMIN = [
  'resumen', 'semanas', 'cifras', 'negocios', 'publicaciones', 'canjes', 'usuarios', 'resenas', 'denuncias', 'duplicados',
  'reclamaciones', 'entidades', 'inactivas', 'mensajes', 'sugerencias', 'planes', 'avisos', 'categorias', 'ciudades',
  'colecciones', 'configuracion', 'errores', 'administradores', 'actividad', 'ayuda', 'artistas', 'condiciones', 'pedidos',
  'crecer', 'emisiones', 'festivos', 'guias', 'medios', 'sorteos', 'traduccion', 'automatico',
].map((r) => `/admin#/${r}`);
const solo = (process.env.A11Y_SOLO || '').split(',').filter(Boolean);

/**
 * Lo medido que no se arregla sin cambiar el aspecto: [ruta (prefijo o '*'),
 * regla de axe o 'foco'/'teclado'/'reflujo', selector (RegExp), porqué].
 */
// Los días pasados del calendario de Explorar ya pasan (parte 2, 19-11: gris
// secundario entero, 5,9:1 y 7,1:1); antes estaban aquí.
const PERMITIDOS = [];
const permitido = (ruta, regla, objetivo) =>
  PERMITIDOS.some(([r, g, re]) => (r === '*' || ruta.startsWith(r)) && g === regla && re.test(objetivo));

// ── Lo que se mira dentro de la página ────────────────────────────────────
/**
 * Bordes de los campos (parte 2, 19-11-2026): axe no los mide. WCAG 1.4.11
 * pide 3:1 entre el borde de un campo y el fondo de alrededor (con
 * --glass-border, 1,2:1 en claro y 1,4:1 en oscuro; ahora --field-border). Se
 * mezcla el color del borde (con su transparencia) sobre el primer fondo
 * opaco de los de fuera.
 */
function bordes() {
  const rgba = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [r, g, b, a];
  };
  const mezcla = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
  const lum = (c) => {
    const l = c.slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  };
  const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fondoDe = (el) => {
    const capas = [];
    for (let x = el.parentElement; x; x = x.parentElement) {
      const c = rgba(getComputedStyle(x).backgroundColor);
      if (c && c[3] > 0) { capas.push(c); if (c[3] >= 1) break; }
    }
    let fondo = rgba(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1];
    for (const c of capas.reverse()) fondo = mezcla(c, fondo);
    return fondo;
  };
  const sel = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=hidden])'
    + ':not([type=color]):not([type=submit]):not([type=button]), select, textarea, .buscador-campo, .calc-campo';
  const malos = [];
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden],[aria-hidden=true]')) continue;
    if (cs.borderTopStyle === 'none' || parseFloat(cs.borderTopWidth) < 0.5) continue;
    const borde = rgba(cs.borderTopColor);
    if (!borde || borde[3] === 0) continue;
    const fondo = fondoDe(el);
    const c = contraste(mezcla(borde, fondo), fondo);
    if (c < 2.95) {
      const id = el.id ? `#${el.id}` : (el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : '');
      malos.push(`${el.tagName.toLowerCase()}${id} ${c.toFixed(2)}:1`);
    }
  }
  return [...new Set(malos)];
}

async function axe(p) {
  await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await globalThis.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      resultTypes: ['violations'],
    });
    return r.violations.map((v) => ({
      regla: v.id, impacto: v.impact, ayuda: v.help,
      nodos: v.nodes.map((n) => ({ sel: n.target.join(' '), html: n.html.slice(0, 140), por: (n.failureSummary || '').split('\n').slice(1, 2).join(' ').trim() })),
    }));
  });
}

/** Recorre la página con Tab: las paradas sin foco visible y si se queda atascado. */
async function foco(p, paradas = 70) {
  await p.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  await p.mouse.click(1, 1).catch(() => {});
  const sinFoco = [];
  const vistos = new Set();
  let repetidos = 0;
  for (let i = 0; i < paradas; i += 1) {
    await p.keyboard.press('Tab');
    const r = await p.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const id = (e) => {
        const partes = [];
        for (let x = e; x && x !== document.body && partes.length < 4; x = x.parentElement) {
          let s = x.tagName.toLowerCase();
          if (x.id) { s += `#${x.id}`; partes.unshift(s); break; }
          const c = [...x.classList].slice(0, 2).join('.');
          if (c) s += `.${c}`;
          partes.unshift(s);
        }
        return partes.join(' > ');
      };
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return { sel: id(el), clave: id(el), oculto: true };
      const mira = (e, pseudo) => {
        const cs = getComputedStyle(e, pseudo);
        return [cs.outlineStyle !== 'none' && Number.parseFloat(cs.outlineWidth) > 0 ? `o:${cs.outlineStyle}${cs.outlineWidth}${cs.outlineColor}` : '',
          cs.boxShadow !== 'none' ? `s:${cs.boxShadow}` : '', `b:${cs.borderColor}${cs.borderWidth}`, `g:${cs.backgroundColor}`,
          `t:${cs.textDecorationLine}`, `c:${cs.color}`].join('|');
      };
      // El propio elemento, su ::before/::after y cinco de arriba (:focus-within, :has()).
      const cadena = () => {
        const out = [mira(el), mira(el, '::before'), mira(el, '::after')];
        for (let x = el.parentElement, i = 0; x && i < 5; x = x.parentElement, i += 1) out.push(mira(x));
        return out.join('#');
      };
      const con = cadena();
      const contorno = /o:|s:/.test(mira(el));
      if (!el.dataset.a11yN) el.dataset.a11yN = String(document.querySelectorAll('[data-a11y-n]').length + 1);
      const sel = id(el);
      const clave = el.dataset.a11yN;
      el.blur();
      const sin = cadena();
      el.focus({ preventScroll: true });
      // :focus-within en el padre (p. ej. la etiqueta de un interruptor) también vale.
      return { sel, clave, visible: contorno || con !== sin, texto: (el.getAttribute('aria-label') || el.innerText || el.value || '').trim().slice(0, 40) };
    });
    if (!r) continue;
    if (vistos.has(r.clave)) { repetidos += 1; if (repetidos > 3) break; continue; }
    vistos.add(r.clave);
    if (!r.oculto && !r.visible) sinFoco.push(`${r.sel} «${r.texto}»`);
  }
  return { sinFoco, paradas: vistos.size };
}

/** Lo que tiene cursor de mano y no se alcanza con el teclado. */
const soloRaton = () => {
  const out = [];
  const enfocable = (el) => el.closest('a[href], button, input, select, textarea, summary, label, [tabindex]:not([tabindex="-1"]), [contenteditable=""], [contenteditable="true"]');
  for (const el of document.querySelectorAll('body *')) {
    if (getComputedStyle(el).cursor !== 'pointer') continue;
    if (enfocable(el)) continue;
    // Solo el de más arriba de un grupo con mano (los hijos la heredan).
    if (el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer' && !enfocable(el.parentElement)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || el.closest('[hidden], [aria-hidden="true"], dialog:not([open])')) continue;
    const s = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${[...el.classList].slice(0, 2).map((c) => `.${c}`).join('')}`;
    out.push(`${s} «${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40)}»`);
  }
  return out;
};

const reflujo = () => {
  const ancho = document.documentElement.clientWidth;
  const sobra = document.documentElement.scrollWidth - ancho;
  return sobra > 1 ? [`scroll horizontal de ${sobra} px a ${ancho} px de ancho`] : [];
};

// ── La sesión de mentira (como tools/ayuda_guiada_check.mjs) ──────────────
const U = '0e7717e0-0000-4000-8000-0000000a11e1';
// El local de la sesión es uno de los del falso: la ficha del panel lo lee de la tabla.
const BIZ = NEGOCIOS[0].id;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: U, role: 'authenticated', aud: 'authenticated', exp: 4102444800, aal: 'aal2', amr: [{ method: 'password', timestamp: 1 }] })}.firma`;
const USER = { id: U, aud: 'authenticated', role: 'authenticated', email: 'a11y.prueba@example.com', app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Ana' }, created_at: '2026-01-01T00:00:00Z' };
const SESION = JSON.stringify({ access_token: JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: USER });
const RPC_SESION = {
  my_consents: { terms_accepted_at: '2026-01-01T00:00:00Z', terms_outdated: false, has_display_name: true },
  my_businesses: [{ id: BIZ, name: NEGOCIOS[0].name, role: 'owner', verification_status: 'verified', is_active: true, time_zone: 'Europe/Madrid', city: 'Málaga' }],
  business_is_organizer: false,
  my_entity_application: { entity_kind: null, can_apply: true, why: null, application: null },
  my_subscription: {
    plan_slug: 'standard', plan_names: { es: 'Klendar', en: 'Klendar' }, status: 'active', period_end: '2027-01-01T00:00:00Z', payment_method: 'transfer',
    price_cents: 1990, active_offers: 0, max_active_offers: null, has_analytics: true, boosts_included: 0, boosts_used: 0,
    billing: { enabled: true, blocked: false, hold: null, block_soon: false },
  },
  business_tools_overview: { ok: true, can_edit: true },
  business_report: { ok: true, totals: {}, daily: [], offers: [], by_hour: [], redemptions: [], loyalty: {} },
  assistant_status: { available: false },
  my_stamp_cards: [], my_redemptions: [],
};
async function conSesion(ctx) {
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-auth-token`, SESION]);
  // Va después de conDatos: lo de la sesión manda y lo demás sigue al falso.
  await ctx.route(`${SUPA}/**`, async (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/token')) return json(JSON.parse(SESION));
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      if (fn in RPC_SESION) return json(RPC_SESION[fn]);
    }
    return route.fallback();
  });
}

/** La sesión de administradora (el admin guarda la suya aparte: `…-admin-auth-token`). */
const RPC_ADMIN = {
  is_admin: true,
  admin_mfa_status: { required: false, enrolled: true },
  admin_kpis: {},
  // Las listas con páginas: vacías, con su forma (si no, «Algo ha fallado»).
  ...Object.fromEntries(['admin_businesses_page', 'admin_offers_page', 'admin_redemptions', 'admin_users', 'admin_text_reviews',
    'admin_reviews', 'admin_posts', 'admin_report_groups', 'admin_feedback', 'admin_subscriptions', 'admin_audit']
    .map((fn) => [fn, { total: 0, rows: [], counts: {}, pending: 0 }])),
};
async function conAdmin(ctx) {
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); localStorage.setItem('klendar_lang', 'es'); } catch { /* */ } }, [`sb-${REF}-admin-auth-token`, SESION]);
  await ctx.route(`${SUPA}/**`, async (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (p.startsWith('/auth/v1/user')) return json(USER);
    if (p.startsWith('/auth/v1/token')) return json(JSON.parse(SESION));
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      if (fn in RPC_ADMIN) return json(RPC_ADMIN[fn]);
    }
    return route.fallback();
  });
}

// ── La pasada ─────────────────────────────────────────────────────────────
const web = await webConDatos({ puerto: Number(process.env.PORT || 8981) });
const nav = await chromium.launch();
const cuenta = new Map(); // regla → veces
let total = 0;
const apunta = (donde, lineas) => {
  if (!lineas.length) return;
  total += lineas.length;
  console.log(`\n${donde}`);
  for (const l of lineas) console.log(`  ${l}`);
};
try {
  for (const [grupo, rutas, sesion] of [['sin sesión', PUBLICAS, false], ['con sesión', CON_SESION, true], ['admin', ADMIN, 'admin']]) {
    for (const tema of ['light', 'dark']) {
      const ctx = await nav.newContext({ viewport: VENTANA, colorScheme: tema, locale: 'es-ES', timezoneId: 'Europe/Madrid', bypassCSP: true });
      await web.conDatos(ctx);
      if (sesion === 'admin') await conAdmin(ctx);
      else if (sesion) await conSesion(ctx);
      const p = await ctx.newPage();
      const errores = [];
      p.on('pageerror', (e) => errores.push(e.message));
      for (const ruta of rutas) {
        if (solo.length && !solo.includes(ruta)) continue;
        await p.goto(enSuHost(web.BASE, ruta), { waitUntil: 'networkidle' }).catch(() => {});
        await p.waitForTimeout(400);
        const donde = `${ruta} · ${grupo} · ${tema}`;
        const lineas = [];
        for (const v of await axe(p)) {
          const nodos = v.nodos.filter((n) => !permitido(ruta, v.regla, n.sel));
          if (!nodos.length) continue;
          cuenta.set(v.regla, (cuenta.get(v.regla) || 0) + nodos.length);
          lineas.push(`axe ${v.regla} (${v.impacto}): ${v.ayuda}`);
          for (const n of nodos.slice(0, 8)) lineas.push(`    ${n.sel}  ${n.por}  ${n.html}`);
          if (nodos.length > 8) lineas.push(`    … y ${nodos.length - 8} más`);
        }
        for (const s of (await p.evaluate(bordes)).filter((s) => !permitido(ruta, 'bordes', s))) {
          cuenta.set('bordes', (cuenta.get('bordes') || 0) + 1);
          lineas.push(`borde de campo por debajo de 3:1: ${s}`);
        }
        // El teclado y el foco, solo en claro (no dependen del tema).
        if (tema === 'light') {
          const f = await foco(p);
          if (process.env.A11Y_VER === '1') {
            const t = await p.evaluate(() => ({ n: document.body.innerText.length, h: document.querySelector('h1')?.innerText.slice(0, 40) || '', url: location.pathname + location.hash }));
            console.log(`· ${ruta} → ${t.url}: ${f.paradas} paradas de Tab, ${t.n} letras, h1 «${t.h}»`);
            await p.screenshot({ path: `${OUT}/ver-${ruta.replace(/[^a-z0-9]+/gi, '_') || 'portada'}-${sesion === 'admin' ? 'admin' : sesion ? 'sesion' : 'publica'}.png` }).catch(() => {});
          }
          for (const s of f.sinFoco.filter((s) => !permitido(ruta, 'foco', s))) {
            cuenta.set('foco', (cuenta.get('foco') || 0) + 1);
            lineas.push(`foco sin verse: ${s}`);
          }
          for (const s of (await p.evaluate(soloRaton)).filter((s) => !permitido(ruta, 'teclado', s))) {
            cuenta.set('teclado', (cuenta.get('teclado') || 0) + 1);
            lineas.push(`solo con ratón: ${s}`);
          }
          await p.setViewportSize({ width: 320, height: 640 });
          await p.waitForTimeout(250);
          for (const s of (await p.evaluate(reflujo)).filter((s) => !permitido(ruta, 'reflujo', s))) {
            cuenta.set('reflujo', (cuenta.get('reflujo') || 0) + 1);
            lineas.push(`reflujo: ${s}`);
          }
          await p.setViewportSize(VENTANA);
        }
        if (lineas.length) await p.screenshot({ path: `${OUT}/${ruta.replace(/[^a-z0-9]+/gi, '_') || 'portada'}-${sesion === 'admin' ? 'admin' : sesion ? 'sesion' : 'publica'}-${tema}.png`, fullPage: true }).catch(() => {});
        apunta(donde, lineas);
      }
      if (errores.length) apunta(`errores JS · ${grupo} · ${tema}`, [...new Set(errores)]);
      await ctx.close();
    }
  }
} finally {
  await nav.close();
  await web.cierra();
}
if (cuenta.size) {
  console.log('\nResumen por regla:');
  for (const [r, n] of [...cuenta].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${r}`);
}
console.log(total ? `\n${total} avisos.` : 'a11y: todo bien.');
process.exit(total && !INFORME ? 1 : 0);
