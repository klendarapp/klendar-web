// Chips sin «Todo» y de varios a la vez (Iván, 23-11-2026; RUNBOOK
// §4zzz-chips). Sin navegador: las Functions de verdad contra el Supabase
// falso (tools/_web_con_datos.mjs).
//
//  1. Explorar y Descubre › ¿Qué? › Tipo: casillas Ofertas y Eventos (sin
//     «Todo»); con una, la base la recibe; con las dos o ninguna, todo
//     (`p_kind` null). `?tipo=ofertas&tipo=eventos` y `?tipo=ofertas,eventos`
//     valen igual; el `?tipo=todos` de antes es todo. Los enlaces de la
//     página llevan los tipos en orden fijo (ofertas, eventos), aunque la
//     dirección los traiga al revés, y la página sigue en la caché del borde.
//  2. «Descuentos para»: casillas por carné (sin «Todos»), varios a la vez
//     (`card_student` y `card_senior` a la base, en orden fijo); el
//     `?descuento-para=estudiantes` de antes vale igual.
//  3. Guías, Grupos, Dónde ver el partido y las reseñas de la ficha: sin
//     chip «Todo», de varios a la vez, con `aria-pressed` o casillas.
//
//   node tools/chips_check.mjs
import { webConDatos } from './_web_con_datos.mjs';

let fallos = 0;
const ok = (c, m, extra = '') => { if (c) console.log(`ok: ${m}`); else { fallos += 1; console.log(`FALLO: ${m} ${extra}`); } };

const web = await webConDatos({ puerto: Number(process.env.PORT || 8951) });
const ultima = (fn) => [...web.llamadas].reverse().find((l) => l.fn === fn)?.args;
const pagina = async (ruta) => {
  web.llamadas.length = 0;
  const r = await fetch(`${web.BASE}${ruta}`);
  return { r, h: await r.text() };
};
/** Las casillas de un nombre: [[valor, marcada]]. */
const casillas = (h, nombre) => [...h.matchAll(new RegExp(`<input type="checkbox" name="${nombre}" value="([^"]*)"[^>]*?( checked)?>`, 'g'))].map((m) => [m[1], Boolean(m[2])]);
try {
  // ── 1. Tipo ────────────────────────────────────────────────────────────
  for (const [base, nombre] of [['/explorar?vista=lista', 'Explorar'], ['/descubre', 'Descubre']]) {
    const sep = base.includes('?') ? '&' : '?';
    let { r, h } = await pagina(base);
    const pe0 = ultima('public_explore');
    ok(r.status === 200 && pe0 && pe0.p_kind == null, `${nombre}: sin tipo, todo`, JSON.stringify(pe0?.p_kind));
    ok(!/<input type="radio" name="tipo"/.test(h), `${nombre}: el tipo ya no es de una opción (sin «Todo»)`);
    ok(JSON.stringify(casillas(h, 'tipo')) === JSON.stringify([['ofertas', false], ['eventos', false]]), `${nombre}: casillas Ofertas y Eventos, sin marcar`, JSON.stringify(casillas(h, 'tipo')));

    ({ h } = await pagina(`${base}${sep}tipo=ofertas`));
    ok(ultima('public_explore')?.p_kind === 'flash_offer', `${nombre}: con Ofertas, la base pide ofertas`);
    ok(JSON.stringify(casillas(h, 'tipo')) === JSON.stringify([['ofertas', true], ['eventos', false]]), `${nombre}: Ofertas marcada`);

    for (const q of ['tipo=eventos&tipo=ofertas', 'tipo=ofertas,eventos']) {
      ({ r, h } = await pagina(`${base}${sep}${q}`));
      ok(ultima('public_explore')?.p_kind == null, `${nombre}: con las dos (${q}), todo`, JSON.stringify(ultima('public_explore')?.p_kind));
      ok(JSON.stringify(casillas(h, 'tipo')) === JSON.stringify([['ofertas', true], ['eventos', true]]), `${nombre}: las dos marcadas (${q})`);
      const enlaces = [...h.matchAll(/href="([^"]*(?:explorar|descubre)\?[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
      ok(enlaces.some((u) => /tipo=ofertas&tipo=eventos/.test(u)) && !enlaces.some((u) => /tipo=eventos&tipo=ofertas/.test(u)),
        `${nombre}: los enlaces, en orden fijo (ofertas, eventos)`, enlaces.find((u) => /tipo=eventos/.test(u)) || '');
      ok(/public/.test(r.headers.get('cache-control') || '') || r.headers.get('x-klendar-borde'), `${nombre}: con los dos tipos sigue en la caché`, r.headers.get('cache-control'));
    }
    ({ r, h } = await pagina(`${base}${sep}tipo=todos`));
    ok(r.status === 200 && ultima('public_explore')?.p_kind == null && casillas(h, 'tipo').every(([, on]) => !on), `${nombre}: el ?tipo=todos de antes = todo`);
  }
  {
    const { h } = await pagina('/en/explore?view=list&type=events');
    ok(ultima('public_explore')?.p_kind === 'future_event' && JSON.stringify(casillas(h, 'type')) === JSON.stringify([['offers', false], ['events', true]]), 'en inglés, `type=events`');
  }
  {
    const { h } = await pagina('/explorar?tipo=negocios');
    ok(/class="[^"]*\bon\b[^"]*"[^>]*>[^<]*Sitios|Sitios/.test(h) && casillas(h, 'tipo').length === 0, 'el ?tipo=negocios de antes lleva a Sitios');
  }

  // ── 2. Descuentos para ─────────────────────────────────────────────────
  {
    let { h } = await pagina('/explorar?vista=lista');
    ok(JSON.stringify(casillas(h, 'descuento-para').map(([v]) => v)) === JSON.stringify(['estudiantes', 'jovenes', 'mayores']), 'Descuentos para: una casilla por carné (sin «Todos»)', JSON.stringify(casillas(h, 'descuento-para')));
    ok(!/<input type="radio" name="descuento-para"/.test(h), 'Descuentos para: ya no es de una opción');
    ({ h } = await pagina('/explorar?vista=lista&descuento-para=mayores&descuento-para=estudiantes'));
    const tr = ultima('public_explore')?.p_filters?.traits || [];
    ok(tr.includes('card_student') && tr.includes('card_senior') && !tr.includes('card_youth') && tr.indexOf('card_student') < tr.indexOf('card_senior'),
      'Descuentos para: varios a la base, en orden fijo', JSON.stringify(tr));
    ok(JSON.stringify(casillas(h, 'descuento-para')) === JSON.stringify([['estudiantes', true], ['jovenes', false], ['mayores', true]]), 'Descuentos para: los dos marcados');
    ok(/descuento-para=estudiantes&(?:amp;)?descuento-para=mayores/.test(h), 'Descuentos para: en la dirección, en orden fijo');
    ({ h } = await pagina('/explorar?vista=lista&descuento-para=jovenes'));
    ok(JSON.stringify(ultima('public_explore')?.p_filters?.traits) === JSON.stringify(['card_youth']), 'Descuentos para: el de antes (uno) vale igual');
    ({ h } = await pagina('/explorar?vista=lista&descuento-para=estudiantes,jovenes'));
    ok((ultima('public_explore')?.p_filters?.traits || []).length === 2, 'Descuentos para: también con comas');
  }
} finally {
  await web.cierra();
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nchips: todo bien');
process.exit(fallos ? 1 : 0);
