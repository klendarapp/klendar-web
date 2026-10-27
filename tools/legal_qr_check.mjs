// Prueba de lo publicado el 2026-10-27 (QR1–QR9 y AP1–AP3, aprobados por
// Iván ese día), en la web local:
//
//  1. Términos (ES y EN): «Dar en el momento» (3 sexies / 3e) con el QR de
//     un minuto, la cercanía si ya hay permiso y el tope de personas (QR1),
//     y el apartado nuevo «3 septies. Entradas nominativas» / «3f. Named
//     tickets» (QR2), con sus líneas en el historial.
//  2. Condiciones para negocios (ES y EN): el punto nuevo de las ayudas en
//     3 septies / 3f (QR3), el apartado nuevo «3 duodecies. Entradas
//     nominativas» / «3k. Named tickets» (QR4), el punto de los datos del 3
//     (QR5), el aviso de arriba con «los del 27 de octubre de 2026 (apartados
//     3, 3 sexies, 3 septies y 3 duodecies), desde el 11 de noviembre de
//     2026» y su línea en el historial.
//  3. Privacidad (ES y EN): filas «Favoritos, reseñas, canjes y sellos»,
//     «Bonos y QR de cliente», «Dar en el momento» y «Ubicación» (QR6–QR7);
//     la fila «Inicio de sesión con Google / Apple» y el párrafo de Apple
//     (AP1–AP2); sus líneas en el historial.
//  4. Eliminar cuenta (ES y EN): el punto de Apple al final de «Qué se
//     elimina» (AP3) y su línea en el historial.
//  5. Fecha nueva y sin desplazamiento horizontal.
//
// Chromium y WebKit, móvil (390 × 844) y escritorio (1280 × 800). Sin
// Supabase (páginas estáticas).
//
//   PORT=8871 node tools/serve_dev.mjs &
//   BASE=http://localhost:8871 PW=<ruta a playwright> node tools/legal_qr_check.mjs
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PW || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8871';
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log('FALLO:', m); } else console.log('ok:', m); };

const PAGINAS = [
  ['/terminos/', 'Última actualización: 27 de octubre de 2026', [
    /El QR cambia cada 30 segundos y vale un minuto: una foto vieja o reenviada no sirve, y desde que lo escaneas tienes un minuto para aceptarlo\. Si tu móvil o tu navegador ya permiten a Klendar usar tu ubicación, al leerlo y al aceptarlo comprobamos que estás cerca del local \(unos 150 metros\); no te pedimos permiso para ello, no guardamos dónde estás y, si no hay permiso, se acepta igual\. El negocio puede decidir para cuántas personas es: cuando lo han recibido todas, el QR deja de valer\./,
    /3 septies\. Entradas nominativas\s+Al publicar un evento con reserva, el negocio puede elegir que sus entradas sean nominativas;[\s\S]*?no se puede pasar a otra persona, regalar, vender ni revender\.[\s\S]*?Para no ir, anula la reserva y la plaza queda libre para otra persona\./,
    /27 de octubre de 2026: Entradas nominativas \(apartado 3 septies nuevo\)/,
    /27 de octubre de 2026: Dar en el momento: el QR vale un minuto/,
  ], [/El QR cambia cada 30 segundos y una foto vieja no sirve;/]],
  ['/en/terms/', 'Last updated: 27 October 2026', [
    /The QR code changes every 30 seconds and is valid for one minute: an old or forwarded photo won't work, and once you scan it you have one minute to accept it\. If your phone or browser already lets Klendar use your location, when you scan it and when you accept it we check that you're near the venue \(about 150 metres\);[\s\S]*?once they've all received it, the QR code stops working\./,
    /3f\. Named tickets\s+When publishing an event with booking, the business can choose for its tickets to be named;[\s\S]*?If you can't go, cancel the booking and the place becomes free for someone else\./,
    /27 October 2026: Named tickets \(new section 3f\)/,
    /27 October 2026: Give on the spot: the QR code is valid for one minute/,
  ], [/The QR code changes every 30 seconds and an old photo won't work;/]],
  ['/negocios/', 'Última actualización: 28 de octubre de 2026', [
    /Para ayudarte, el QR vale un minuto, se cierra solo tras 10 minutos sin que nadie lo use y puedes elegir para cuántas personas es \(de 1 a 20\): al llegar a ese número, se cierra\.[\s\S]*?Son ayudas: no te eximen de lo de arriba\./,
    /3 duodecies\. Entradas nominativas\s+En un evento con reserva puedes elegir «Entradas: Normales»[\s\S]*?no niegues la entrada por motivos discriminatorios[\s\S]*?Klendar no lo valida con el código suelto\.[\s\S]*?no cobres por cambiar el nombre ni permitas ni fomentes su reventa\./,
    /\(nombre, foto si la tiene y cuántas veces ha canjeado en el Negocio al validar un código o reservar, la lista de asistentes y la de sus RRPP\)/,
    /los del 27 de octubre de 2026 \(apartados 2 bis, 3, 3 sexies, 3 septies y 3 duodecies\), desde el 11 de noviembre de 2026, y los del 28 de octubre de 2026 \(apartado 4 bis\), desde el 12 de noviembre de 2026: 15 días/,
    /27 de octubre de 2026: Dar en el momento \(apartado 3 septies\)[\s\S]*?Entradas nominativas \(apartado 3 duodecies nuevo\)[\s\S]*?Se aplica desde el 11 de noviembre de 2026\./,
  ], [/nombre y foto al conseguir un código o reservar/]],
  ['/en/business-terms/', 'Last updated: 28 October 2026', [
    /To help you, the QR code is valid for one minute, closes by itself after 10 minutes without anyone using it and you can choose how many people it's for \(1 to 20\)[\s\S]*?These are aids: they don't release you from the above\./,
    /3k\. Named tickets\s+For an event with booking you can choose “Tickets: Standard”[\s\S]*?don't refuse entry on discriminatory grounds[\s\S]*?Klendar doesn't validate it with the bare code\.[\s\S]*?don't allow or encourage reselling them\./,
    /\(name, photo if they have one and how many times they've redeemed at the Business when validating a code or booking, the attendee list and its promoters' lists\)/,
    /those of 27 October 2026 \(sections 2a, 3, 3e, 3f and 3k\) from 11 November 2026, and those of 28 October 2026 \(section 4a\) from 12 November 2026: 15 days/,
    /27 October 2026: Give on the spot \(section 3f\)[\s\S]*?Named tickets \(new section 3k\)[\s\S]*?It applies from 11 November 2026\./,
  ], [/name and photo when they get a code or book/]],
  ['/privacidad/', 'Última actualización: 28 de octubre de 2026', [
    /Al validar un código tuyo \(también en la puerta de una lista de RRPP\), el negocio ve tu nombre visible, tu foto de perfil solo si la tienes puesta y cuántas veces has canjeado algo en ese negocio, contando esta \(«5\.ª vez aquí»\)/,
    /reservas de plaza \(con cuántas plazas\) y si la entrada es nominativa/,
    /la clave de tu QR de cliente \(con la que tu móvil firma también el QR de tus entradas nominativas\)/,
    /tu nombre visible, tu foto si la tienes, cuántas veces has canjeado algo allí y tus bonos de ese negocio/,
    /que vale un minuto y se cierra solo tras 10 minutos sin uso o al llegar al número de personas que elige el negocio[\s\S]*?comprobar que estás cerca del local\)/,
    /Tu ubicación, si ya nos permites usarla: solo para comparar en ese momento con la del local; no se guarda/,
    /La ubicación, no se guarda/,
    /si ya la has permitido, también al aceptar algo que un negocio te da con «Dar en el momento», para comprobar que estás en el local \(no te la pedimos para eso ni la guardamos\)/,
    /Con Apple, además, un código de Apple \(token\) que solo sirve para retirar el acceso de Klendar a tu cuenta de Apple/,
    /El código de Apple se borra al eliminar la cuenta, en cuanto Apple confirma la retirada \(si no contesta, como mucho en un par de días\)/,
    /\(más abajo\)\. Si eliminas tu cuenta, le pedimos a Apple que retire el acceso de Klendar a tu cuenta de Apple; para eso solo le mandamos el código de Apple/,
    /27 de octubre de 2026: Inicio de sesión con Apple:/,
    /27 de octubre de 2026: Al validar, el negocio ve tu foto si la tienes/,
  ], []],
  ['/en/privacy/', 'Last updated: 28 October 2026', [
    /When it validates one of your codes \(also at the door for a promoter's list\), the business sees your public name, your profile photo only if you have one and how many times you've redeemed something at that business, including this one \(“5th time here”\)/,
    /place reservations \(with how many places\) and whether the ticket is named/,
    /the key of your customer QR code \(which your phone also uses to sign the QR code of your named tickets\)/,
    /your public name, your photo if you have one, how many times you've redeemed something there and your passes from that business/,
    /which is valid for one minute and closes by itself after 10 minutes without use[\s\S]*?checking that you're near the venue\)/,
    /Your location, if you already let us use it: only to compare it at that moment with the venue's; it isn't stored/,
    /Your location isn't stored/,
    /if you've already allowed it, also when accepting something a business gives you with “Give on the spot”, to check that you're at the venue \(we don't ask for it for this or store it\)/,
    /With Apple, also an Apple code \(token\) that can only be used to remove Klendar's access to your Apple account/,
    /The Apple code is deleted when you delete your account, as soon as Apple confirms the removal/,
    /\(see below\)\. If you delete your account, we ask Apple to remove Klendar's access to your Apple account; to do that we only send Apple the Apple code/,
    /27 October 2026: Sign in with Apple:/,
    /27 October 2026: When validating, the business sees your photo if you have one/,
  ], []],
  ['/eliminar-cuenta/', 'Última actualización: 27 de octubre de 2026', [
    /Si entraste con Apple, pedimos a Apple que retire el acceso de Klendar a tu cuenta de Apple \(lo verás desaparecer en Ajustes → tu nombre → Inicio de sesión y seguridad → Iniciar sesión con Apple\)\.\s+Qué se conserva y por qué/,
    /27 de octubre de 2026: Lista al día: si entraste con Apple/,
  ], []],
  ['/en/delete-account/', 'Last updated: 27 October 2026', [
    /If you logged in with Apple, we ask Apple to remove Klendar's access to your Apple account \(you'll see it disappear in Settings → your name → Sign-In & Security → Sign in with Apple\)\.\s+What is kept and why/,
    /27 October 2026: Up-to-date list: if you logged in with Apple/,
  ], []],
];

async function legales(nav, nombre, t, vp) {
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  for (const [ruta, fecha, esperas, nunca] of PAGINAS) {
    const r = await p.goto(`${BASE}${ruta}`);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const txt = `${await p.locator('body').innerText()}
${await p.locator('body').textContent()}`.replace(/ /g, ' ');
    ok(r.status() === 200, `${nombre}/${t} ${ruta}: 200`);
    ok(txt.includes(fecha), `${nombre}/${t} ${ruta}: «${fecha}»`);
    for (const re of esperas) ok(re.test(txt), `${nombre}/${t} ${ruta}: ${re.source.slice(0, 70)}`);
    for (const re of nunca) ok(!re.test(txt), `${nombre}/${t} ${ruta}: sin ${re.source}`);
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
