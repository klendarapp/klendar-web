// «Avísame cuando abran las plazas» (Iván, 2026-11-17): lo que la web tiene
// que hacer igual que la app. Sin navegador ni red: lee el código y prueba
// los textos con datos de mentira. Lo de la base, en la app
// (tool/aperturas_smoke.py, migración 20261284200000).
//
//   1. La ficha pública: cuándo abren, «Avísame» en vez de «Reservar plaza»,
//      la cuenta atrás con menos de 24 h y, al llegar la hora, «Reservar».
//   2. Con sesión, «Ya te aviso» (y tocarlo lo quita).
//   3. «Tu cuenta»: la ruta `avisame/` (apuntarse y quitarse), «hoy» /
//      «mañana» / el día, y reservar antes de abrir dice cuándo abren.
//   4. El panel: «Abrir reservas el…» solo con el interruptor, cuántos lo
//      han pedido, abierta ya no se cambia, y los errores de la base.
//
//   node tools/aperturas_check.mjs
import { readFileSync } from 'node:fs';

const raiz = new URL('..', import.meta.url);
const lee = (f) => readFileSync(new URL(f, raiz), 'utf8');
const vistas = lee('functions/_lib/views.js');
const amigos = lee('assets/amigos.js');
const cabecera = lee('assets/cabecera.js');
const cuenta = lee('assets/cuenta/app.js');
const panel = lee('panel/panel.js');
const enCuenta = lee('assets/cuenta/i18n.js');
const enPanel = lee('panel/i18n.js');
let fallos = 0;
const ok = (nombre, cond) => {
  console.log(`${cond ? '  ok  ' : '  FALLA  '}${nombre}`);
  if (!cond) fallos++;
};

// 1. La ficha pública
ok('1. pide la apertura solo en eventos con reserva', /const aperturaP = o\.kind === 'future_event' && o\.reservations_enabled\s*\n\s*\? rpc\('reservation_opening_info', \{ p_offer: id \}, H\)\.catch\(\(\) => null\)/.test(vistas));
ok('1. pendiente = encendido, con hora y sin abrir', vistas.includes("apertura.enabled && apertura.opens_at && apertura.open === false"));
ok('1. «Avísame» como botón principal (en coral) y «Reservar plaza» escondido',
  vistas.includes('data-principal="avisame" href="${cuenta(lang, `avisame/${id}`)}"')
  && vistas.includes('id="abren-reservar" hidden href="${cuenta(lang, `reservar/${id}${rpQ}`)}"'));
ok('1. los textos, como la app', vistas.includes('`Las reservas abren el ${d} a las ${h}`')
  && vistas.includes('`Las reservas abren hoy a las ${h}`') && vistas.includes('`Las reservas abren mañana a las ${h}`')
  && vistas.includes("notify: 'Avísame', notifyHint: 'Te avisamos una vez, cuando abran.'")
  && vistas.includes("notify: 'Tell me'"));
// La cuenta atrás, con un reloj de mentira.
{
  const ini = vistas.indexOf("const abren = porAbrir ? `<script>");
  const js = vistas.slice(vistas.indexOf('(function(){', ini), vistas.indexOf('</script>', ini))
    .replace('${JSON.stringify(S.opensIn)}', JSON.stringify('Abren en '));
  const els = {};
  const el = (id, extra = {}) => (els[id] = { id, hidden: false, textContent: '', dataset: {}, removed: false,
    remove() { this.removed = true; }, setAttribute(k, v) { this[k] = v; }, ...extra });
  const corre = (ahora, abre) => {
    el('abren', { dataset: { abre } }); el('abren-cuenta', { hidden: true }); el('abren-reservar', { hidden: true });
    el('avisame-nota'); el('avisame');
    const document = { getElementById: (i) => els[i] || null, querySelector: () => els.avisame };
    new Function('document', 'Date', 'setTimeout', js)(document, { now: () => ahora, parse: Date.parse }, () => {});
  };
  const t = Date.parse('2026-11-21T09:00:00Z');
  corre(t - 3 * 864e5, '2026-11-21T09:00:00Z');
  ok('1. a más de 24 h, sin cuenta atrás', els['abren-cuenta'].hidden === true && els['abren-reservar'].hidden === true);
  corre(t - (3 * 60 + 20) * 6e4, '2026-11-21T09:00:00Z');
  ok('1. con menos de 24 h, «Abren en 3 h 20 min»', els['abren-cuenta'].hidden === false
    && els['abren-cuenta'].textContent === ' · Abren en 3 h 20 min');
  corre(t + 1000, '2026-11-21T09:00:00Z');
  ok('1. a la hora: fuera «Avísame», «Reservar plaza» como principal', els.avisame.removed
    && els['abren-reservar'].hidden === false && els['abren-reservar']['data-principal'] === 'codigo'
    && els.abren.hidden === true && els['avisame-nota'].hidden === true);
}

// 2. Con sesión
ok('2. con sesión mira si ya lo ha pedido', amigos.includes("tipo === 'avisame' ? sb.rpc('reservation_opening_info', { p_offer: id })"));
ok('2. «Ya te aviso» en tinta y tocarlo lo quita', amigos.includes("principal.textContent = T.notifyOn;")
  && amigos.includes("cuenta('avisame/' + id + '?quitar=1')") && amigos.includes("notifyOn: 'Ya te aviso'"));
ok('2. el botón de la ficha va directo (sin preguntar otra vez)', cabecera.includes('espera|avisame|codigo|reservar'));

// 3. «Tu cuenta»
ok('3. la ruta avisame/', cuenta.includes('RUTAS.avisame = async ([id], params, crudo) =>')
  && cuenta.includes("llamar('toggle_opening_alert', { p_offer: id })"));
ok('3. ya abiertas: a reservar', cuenta.includes("irA(`reservar/${encodeURIComponent(id)}`, { reemplaza: true });"));
ok('3. reservar antes de abrir: cuándo abren y «Avísame»',
  cuenta.includes("e.clave === 'not_started' && e.datos?.reason === 'reservations_not_open'")
  && cuenta.includes('href="/cuenta/avisame/${esc(id)}"'));
ok('3. los errores de la base, con su frase', /opening_team: '[^']+'/.test(cuenta) && /opening_alerts_limit: '[^']+'/.test(cuenta));
{
  const ini = cuenta.indexOf('function abrenTexto(iso) {');
  const fin = cuenta.indexOf('\n}\n', ini) + 2;
  const abrenTexto = new Function('t', 'LOC', `${cuenta.slice(ini, fin)}; return abrenTexto;`)((s) => s, 'es-ES');
  const ahora = new Date();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 30);
  const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 10, 0);
  const luego = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 5, 10, 0);
  ok('3. «hoy»', abrenTexto(hoy.toISOString()) === 'Las reservas abren hoy a las 23:30');
  ok('3. «mañana»', abrenTexto(manana.toISOString()) === 'Las reservas abren mañana a las 10:00');
  ok('3. el día con su nombre', /^Las reservas abren el \p{L}+ \d{1,2} de \p{L}+ a las 10:00$/u.test(abrenTexto(luego.toISOString())));
}
ok('3. en inglés', enCuenta.includes('"Las reservas abren el {dia} a las {hora}": "Reservations open on {dia} at {hora}"')
  && enCuenta.includes('"Ya te aviso": "You’ll be notified"'));

// 4. El panel
ok('4. el interruptor manda (sin él, ni sale ni se manda)', panel.includes("const aperturaOn = apertura.enabled === true;")
  && panel.includes('${aperturaOn ? `<div id="aperturaRow" class="bl-fila">')
  && panel.includes('...(aperturaOn && !aperturaAbierta ? { reservations_open_at: reservas ? abreF : null } : {}),'));
ok('4. solo con «Reserva de plaza»', panel.includes("if ($('#aperturaRow', v)) $('#aperturaRow', v).hidden = !conReserva;"));
ok('4. abierta: se dice cuándo abrió, sin campo', panel.includes('Las reservas abrieron el ${aperturaFmt(apertura.opens_at)}.'));
ok('4. cuántos lo han pedido', panel.includes("'1 persona ha pedido aviso' : `${Number(apertura.alerts)} personas han pedido aviso`"));
ok('4. antes del evento y no en el pasado (antes de mandar)', panel.includes("I18N.t('Las reservas tienen que abrir antes del evento.')")
  && panel.includes("I18N.t('Esa hora ya ha pasado: elige una que esté por venir.')"));
ok('4. los errores de la base, en su campo', /opening_has_reservations: '[^']+'/.test(panel)
  && panel.includes("/opening_(in_past|after_event|has_reservations|already_open)/.test(msg)"));
ok('4. en inglés', enPanel.includes('"Abrir reservas el…": "Open reservations on…"'));

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
