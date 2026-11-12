// Prueba de los textos de las funciones con IA (legal_ia.py; FF, TF, PA, FO,
// FE, IN y AS de docs/LEGAL_PENDIENTE_2026-10.md del repo de la app, todo
// junto el 12-11-2026), en la web local, con la fecha de IA_DESDE:
//
//  1. Privacidad (ES y EN): el apartado «Funciones con inteligencia
//     artificial» con sus 9 filas; la traducción fuera de la tabla principal;
//     las comprobaciones para verificar (decide una persona) y «¿Es tu
//     negocio?» con un código (la única decisión automática); Anthropic y
//     Google de reserva en los encargados; las decisiones automáticas en
//     «Tus derechos»; la fecha y su línea en el historial.
//  2. Términos: la IA y el asistente (1), Claude en la traducción (3) y la
//     moderación con IA (4).
//  3. Condiciones para negocios: verificar, reclamar con código y leer el
//     documento (1 y 3 bis), la moderación (6), el apartado 6 bis, la versión
//     nueva que se aplica 15 días después, en la cabecera, en el aviso de
//     arriba y en la tabla de versiones.
//  4. Normas: el moderador con IA y las denuncias en las que la IA solo
//     opina; nada de ocultar por denuncias.
//  5. Cookies, Soporte y Preguntas: la clave del asistente y las preguntas.
//  6. Lo que se queda apagado (ocultar por denuncias, que la IA cierre u
//     oculte sola) no sale; sin desplazamiento horizontal ni errores de JS.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800).
//
//   SUPABASE_BLOQUEADO=1 PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_ia_check.mjs
import { playwright, servidorSeguro } from './_supabase_simulado.mjs';
import { IA } from './_fecha_ia.mjs';

if (!IA) {
  console.log('IA_DESDE = None en legal_ia.py: no hay textos de IA que mirar.');
  process.exit(0);
}
const { chromium, webkit } = playwright();
const BASE = process.env.BASE || 'http://localhost:8871';
await servidorSeguro(BASE);
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ES = esc(IA.es);
const EN = esc(IA.en);
const APLICA_ES = esc(IA.aplica.es);
const APLICA_EN = esc(IA.aplica.en);

// Lo apagado no puede salir en ninguna página.
const APAGADO = [
  /varias personas distintas denuncian lo mismo/, /several different people report the same thing/,
  /Verificación automática de negocios/, /Automatic verification of businesses/,
  /cerrarla si no hay nada/, /close it if there is nothing to it/,
  /Más adelante podremos analizar automáticamente/, /In the future we may analyse photos/,
  /Las decisiones las toma una persona, no un sistema automático/, /Decisions are made by a person, not by an automated system/,
];

const PAGINAS = [
  ['/privacidad', `Última actualización: ${IA.es}`, [
    /Funciones con inteligencia artificial \(IA\)\s+Algunas funciones usan Claude, la IA de Anthropic, que trata los datos por encargo nuestro \(apartado 3\)/,
    /Lo envía nuestro servidor, no tu móvil\./,
    /Función\s+Datos\s+Finalidad\s+Base jurídica\s+Conservación en Klendar\s+Moderador automático/,
    /Ayuda para revisar denuncias[\s\S]*?La IA no cierra denuncias ni oculta ni retira nada: lo decide siempre esa persona/,
    /Leer documentos con IA[\s\S]*?No aprueba, no verifica ni traspasa nada: lo decide esa persona/,
    /Traducción automática\s+Lo que pides traducir[\s\S]*?Lo traduce nuestro servidor con Claude o, si no está disponible, con Google Cloud Translation/,
    /Rellenar desde una foto, un enlace o un texto \(cuenta de negocio\)/, /Proponer categoría y etiquetas/, /Ideas para tu negocio/,
    /Proponer respuestas a reseñas[\s\S]*?«Que mis reseñas no pasen por una IA»/, /Asistente de ayuda\s+Lo que escribes en el asistente/,
    /Comprobaciones para verificar negocios y entidades[\s\S]*?«Verificado» quiere decir que lo ha revisado una persona de Klendar/,
    /«¿Es tu negocio\?» con un código[\s\S]*?sin que lo mire una persona[\s\S]*?Es una decisión automatizada/,
    /solo si alguien la ha pedido y Claude no está disponible/,
    /Anthropic \(Anthropic Ireland, Limited; lo trata en Estados Unidos y, según la carga, en otros países: Claude/,
    /Decisiones automáticas\. Cuando una decisión la toma un sistema automático \(el traspaso de una ficha con el código de «¿Es tu negocio\?», o que el moderador no publique algo tuyo\)/,
    new RegExp(`Historial de cambios\\s+${ES}: Apartado nuevo «Funciones con inteligencia artificial»`),
  ], 1],
  ['/en/privacy', `Last updated: ${IA.en}`, [
    /Artificial intelligence \(AI\) features\s+Some features use Claude, the AI from Anthropic/,
    /Feature\s+Data\s+Purpose\s+Legal basis\s+Retention at Klendar\s+Automatic moderator/,
    /The AI doesn't close reports or hide or take down anything: that person always decides/,
    /It doesn't approve, verify or hand over anything: that person decides/,
    /Our server translates them with Claude or, if it isn't available, with Google Cloud Translation/,
    /“Verified” means a person at Klendar has reviewed it/,
    /“Is this your business\?” with a code[\s\S]*?It is an automated decision/,
    /only when someone has asked for it and Claude isn't available/,
    /Automated decisions\. When an automated system takes a decision/,
    new RegExp(`Change history\\s+${EN}: New “Artificial intelligence features” part`),
  ], 1],
  ['/terminos', `Última actualización: ${IA.es}`, [
    /Funciones con inteligencia artificial\. Algunas funciones usan una IA, Claude, de Anthropic/,
    /El asistente de ayuda es una herramienta automática[\s\S]*?si no coincide con lo publicado, vale lo publicado/,
    /la traducción es automática, la hace Claude, la IA de Anthropic, o, si no está disponible, Google Translate, y puede tener errores/,
    /THIS SERVICE MAY CONTAIN TRANSLATIONS POWERED BY GOOGLE/,
    /si nos das permiso, la hace Claude, la IA de Anthropic, que puede publicarlo, publicarlo solo para mayores de 18, no publicarlo o dejarlo para que lo mire una persona/,
    new RegExp(`Historial de cambios\\s+${ES}: Funciones con inteligencia artificial y el asistente de ayuda \\(apartado 1\\)`),
  ], 0],
  ['/en/terms', `Last updated: ${IA.en}`, [
    /Artificial intelligence features\. Some features use an AI, Claude, from Anthropic/,
    /it's done by Claude, the AI from Anthropic, or, if it isn't available, Google Translate, and it may contain mistakes/,
    new RegExp(`Change history\\s+${EN}: Artificial intelligence features and the help assistant`),
  ], 0],
  ['/negocios', `Última actualización: ${IA.es} · Versión ${IA.iso}`, [
    /quien verifica es siempre una persona de Klendar\. «Verificado» quiere decir que lo ha revisado una persona de Klendar/,
    /Hay una excepción, lo único que se decide sin una persona: si la ficha tiene un correo publicado/,
    /Lo revisa siempre una persona, también si el correo o la web son de un dominio oficial/,
    /Lo que publica el Negocio \(textos, fotos y vídeos\) pasa por una moderación automática/,
    /Para tramitar antes las denuncias, una IA puede leerlas y dar su opinión a la persona de Klendar que las decide; la IA no oculta ni retira nada\./,
    /6 bis\. Herramientas con inteligencia artificial/, /Rellenar desde una foto, un enlace o un texto\. Lo que lee la IA es una propuesta que el Negocio revisa/,
    /Ayudas de IA\./, /Asistente de ayuda\. Lo que diga el asistente no cambia estas condiciones/,
    new RegExp(`Los cambios del ${ES} \\(apartados 1, 3 bis, 6 y 6 bis\\) se aplican desde el ${APLICA_ES}, también 15 días después\\.`),
    new RegExp(`Versión\\s+Publicada\\s+Se aplica desde\\s+${esc(IA.iso)}`),
    new RegExp(`Historial de cambios\\s+${ES}: Verificar lo hace siempre una persona[\\s\\S]*?Se aplica desde el ${APLICA_ES}, 15 días después de publicarlo y avisarte\\.`),
  ], 0],
  ['/en/business-terms', `Last updated: ${IA.en} · Version ${IA.iso}`, [
    /verification is always done by a person at Klendar/,
    /There is one exception, the only thing decided without a person/,
    /6a\. Artificial intelligence tools/,
    new RegExp(`The changes of ${EN} \\(sections 1, 3a, 6 and 6a\\) apply from ${APLICA_EN}, also 15 days later\\.`),
    new RegExp(`Version\\s+Published\\s+Applies from\\s+${esc(IA.iso)}`),
  ], 0],
  ['/normas', `Última actualización: ${IA.es}`, [
    /Un moderador con IA y personas\. Si nos das permiso/,
    /Denuncias con ayuda de una IA\.[\s\S]*?No cierra, no oculta ni retira nada por su cuenta: decide siempre una persona/,
    /Las decisiones las toma una persona\. Para ir más rápido, una IA puede leer antes la denuncia y dejarle su opinión, pero no cierra ni oculta nada/,
    /Sin el moderador con IA, lo que se marca no se publica hasta que lo revisa una persona de Klendar/,
    new RegExp(`Historial de cambios\\s+${ES}: «Cómo moderamos»`),
  ], 0],
  ['/en/community-guidelines', `Last updated: ${IA.en}`, [
    /An AI moderator and people\./, /It doesn't close, hide or take down anything on its own: a person always decides/,
  ], 0],
  ['/cookies', `Última actualización: ${IA.es}`, [/klendar\.asistente\.permiso\s+El asistente de ayuda \(almacenamiento local\)/], 0],
  ['/en/cookies', `Last updated: ${IA.en}`, [/klendar\.asistente\.permiso\s+The help assistant \(local storage\)/], 0],
  ['/soporte', `Última actualización: ${IA.es}`, [/Las traducciones las hace Claude, la IA de Anthropic, o, si no está disponible, Google Translate/], 0],
  ['/preguntas', '', [/¿Klendar usa inteligencia artificial\?/, /¿Qué es el asistente de ayuda\?/, /¿Puedo rellenar una publicación desde una foto, un enlace o un texto\?/, /¿Qué ayudas de IA hay para mi negocio\?/], 0],
  ['/en/faq', '', [/Does Klendar use artificial intelligence\?/, /What is the help assistant\?/], 0],
];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas, tablaIA] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const txt = `${await p.locator('body').innerText()}
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    if (fecha) ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    for (const re of APAGADO) ok(!re.test(txt), `${nombre}/${t} ${ruta}: no sale ${re.source}`);
    if (tablaIA) {
      ok(await p.locator('main h3#ia + p + ul + table tr').count() === 10, `${nombre}/${t} ${ruta}: la tabla de la IA, 9 filas y la cabecera`);
      // La traducción solo está en la tabla de la IA, no en la principal.
      ok(await p.locator('main table').first().locator('tr', { hasText: /^(Traducción automática|Automatic translation)/ }).count() === 0,
        `${nombre}/${t} ${ruta}: la traducción ya no está en la tabla principal`);
    }
    ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0),
      `${nombre}/${t} ${ruta}: sin desplazamiento horizontal`);
  }
  ok(errores.length === 0, `${nombre}/${t}: sin errores de JavaScript (${errores.join(' | ')})`);
  await ctx.close();
}

for (const [nombre, tipo] of [['chromium', chromium], ['webkit', webkit]]) {
  const nav = await tipo.launch();
  for (const [t, vp] of [['movil', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 800 }]]) {
    await legales(nav, nombre, t, vp);
  }
  await nav.close();
}
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
