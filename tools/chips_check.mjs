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
//  3. Grupos y empresas: los tipos sin «Todos», varios a la vez (uno por tipo
//     a la base y juntos; todos o ninguno, todo).
//  4. Dónde verlo: deportes y competiciones sin «Todo»/«Todas», varios a la
//     vez (cada deporte con sus competiciones pulsadas, o entero).
// (Las guías, en tools/guias_check.mjs.)
//
//   node tools/chips_check.mjs
import { DATOS, webConDatos } from './_web_con_datos.mjs';

let fallos = 0;
const ok = (c, m, extra = '') => { if (c) console.log(`ok: ${m}`); else { fallos += 1; console.log(`FALLO: ${m} ${extra}`); } };

// Grupos: cuatro sitios, cada uno de un tipo; la base filtra por uno.
const GRUPOS = [
  { id: 'g1', name: 'Asador Uno', kinds: ['company_dinner'], distance_m: 400, max_people: 40 },
  { id: 'g2', name: 'Bar Dos', kinds: ['afterwork'], distance_m: 100, max_people: 20 },
  { id: 'g3', name: 'Escape Tres', kinds: ['team_activity'], distance_m: 900, max_people: 12 },
  { id: 'g4', name: 'Salón Cuatro', kinds: ['celebration', 'company_dinner'], distance_m: 200, max_people: 80 },
];
// Dónde verlo: fútbol (LaLiga y Champions) y baloncesto (NBA).
const enHoras = (h) => new Date(Date.now() + h * 36e5).toISOString();
const PARTIDOS = [
  { id: 'p1', sport: 'football', competition_code: 'laliga', competition: 'LaLiga', title: 'Betis – Sevilla', starts_at: enHoras(5), bars: 1 },
  { id: 'p2', sport: 'football', competition_code: 'champions', competition: 'Champions League', title: 'Madrid – Milan', starts_at: enHoras(6), bars: 0 },
  { id: 'p3', sport: 'basketball', competition_code: 'nba', competition: 'NBA', title: 'Lakers – Celtics', starts_at: enHoras(7), bars: 0 },
];
const web = await webConDatos({
  puerto: Number(process.env.PORT || 8951),
  rpc: {
    group_venues: (a) => GRUPOS.filter((g) => !a.p_kind || g.kinds.includes(a.p_kind)),
    where_to_watch: (a) => PARTIDOS.filter((x) => (!a.p_sport || x.sport === a.p_sport) && (!a.p_competition || x.competition_code === a.p_competition)),
    business_verified_review_count: () => 2,
    business_reviews: (a) => [{ id: 'r1', rating: 5, comment: a.p_verified_only ? 'Reseña verificada' : 'Reseña cualquiera', created_at: enHoras(-30), verified: Boolean(a.p_verified_only) }],
    broadcast_competitions: () => [
      { key: 'laliga', name: 'LaLiga', sport: 'football' }, { key: 'champions', name: 'Champions League', sport: 'football' },
      { key: 'nba', name: 'NBA', sport: 'basketball' }, { key: 'acb', name: 'Liga Endesa', sport: 'basketball' },
    ],
  },
});
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

  // ── 3. Grupos y empresas ───────────────────────────────────────────────
  {
    let { h } = await pagina('/grupos');
    ok(!/>Todos<\/a>/.test(h) && (h.match(/role="button" aria-pressed="false"/g) || []).length === 4, 'Grupos: cuatro tipos sin «Todos», con aria-pressed');
    ({ h } = await pagina('/grupos?tipo=afterwork'));
    ok(ultima('group_venues')?.p_kind === 'afterwork' && h.includes('Bar Dos') && !h.includes('Asador Uno'), 'Grupos: con uno, ese');
    ({ h } = await pagina('/grupos?tipo=celebration&tipo=afterwork'));
    const pedidos = web.llamadas.filter((l) => l.fn === 'group_venues').map((l) => l.args.p_kind);
    ok(JSON.stringify(pedidos) === JSON.stringify(['afterwork', 'celebration']) && h.includes('Bar Dos') && h.includes('Salón Cuatro') && !h.includes('Escape Tres'),
      'Grupos: con dos, uno por tipo y juntos', JSON.stringify(pedidos));
    ok(h.indexOf('Bar Dos') < h.indexOf('Salón Cuatro'), 'Grupos: juntos, por cercanía');
    ok(/tipo=afterwork&amp;tipo=celebration/.test(h) && (h.match(/aria-pressed="true"/g) || []).length === 2, 'Grupos: los dos pulsados y en orden fijo en los enlaces');
    ({ h } = await pagina('/grupos?tipo=company_dinner&tipo=afterwork&tipo=team_activity&tipo=celebration'));
    ok(ultima('group_venues')?.p_kind === null && ['Asador Uno', 'Bar Dos', 'Escape Tres', 'Salón Cuatro'].every((n) => h.includes(n)), 'Grupos: con todos, todo (una petición)');
    ({ h } = await pagina('/grupos?tipo=todos'));
    ok(ultima('group_venues')?.p_kind === null && !/aria-pressed="true"/.test(h), 'Grupos: el ?tipo=todos de antes = todo');
  }

  // ── 4. Dónde verlo ─────────────────────────────────────────────────────
  {
    let { h } = await pagina('/partidos');
    ok(!/>Todo<\/a>/.test(h) && /role="button" aria-pressed="false">Fútbol</.test(h), 'Dónde verlo: deportes sin «Todo», con aria-pressed');
    ({ h } = await pagina('/partidos?deporte=basketball&deporte=football&competicion=champions'));
    ok(h.includes('Madrid – Milan') && h.includes('Lakers – Celtics') && !h.includes('Betis – Sevilla'), 'Dónde verlo: fútbol solo la Champions y el baloncesto entero');
    ok(!/>Todas<\/a>/.test(h) && /aria-pressed="true">Champions League</.test(h) && /aria-pressed="false">Liga Endesa</.test(h), 'Dónde verlo: competiciones de los dos deportes, sin «Todas»');
    ok(/deporte=football&amp;deporte=basketball/.test(h), 'Dónde verlo: deportes en orden fijo en los enlaces');
  }

  // ── 5. Reseñas de la ficha: un chip «Verificadas», sin «Todas» ─────────
  {
    const ficha = `/b/${DATOS.NEGOCIOS[0].slug}`;
    let { h } = await pagina(`${ficha}?ver=resenas`);
    const nav = (/<nav class="filtro-resenas"[^]*?<\/nav>/.exec(h) || [''])[0];
    ok(nav && !/>Todas</.test(nav) && /role="button" aria-pressed="false"/.test(nav) && /resenas=verificadas/.test(nav), 'Reseñas: un chip sin «Todas», sin pulsar', nav.slice(0, 200));
    ({ h } = await pagina(`${ficha}?ver=resenas&resenas=verificadas`));
    const nav2 = (/<nav class="filtro-resenas"[^]*?<\/nav>/.exec(h) || [''])[0];
    ok(ultima('business_reviews')?.p_verified_only === true && /aria-pressed="true"/.test(nav2) && !/resenas=verificadas/.test(nav2), 'Reseñas: pulsado, solo verificadas; al soltarlo, todas');
  }
} finally {
  await web.cierra();
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nchips: todo bien');
process.exit(fallos ? 1 : 0);
