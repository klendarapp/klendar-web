// Las barras de filtro (Iván, 11–12-11-2026): la distancia de «¿Dónde?» (1 a
// 100 km) y el «Precio del plan» de ☰ (Gratis a «Sin límite»), con marcas,
// lo elegido encima y una casilla para escribirlo. Un solo componente, igual
// que la app (`FilterSlider` y `StepScale`, lib/shared/widgets/filter_slider.dart):
// los mismos pasos, las mismas marcas y el mismo reparto de la barra.
//
// El HTML sale de aquí y /assets/barra-filtro.js le da vida (arrastrar,
// teclado, marcas, la casilla con su error). Sin JavaScript: la casilla (un
// campo de formulario normal) y, en «¿Dónde?», las marcas como enlaces.

import { esc } from './page.js';

/** Construye una escala: un hueco por cada paso de 1, dos por cada paso de 5
 * y dieciséis para el salto a «Sin límite» (como `_scale` de la app). */
function escala(valores, { marcas, min, max, sinLimite = false }) {
  const slots = [0];
  for (let i = 1; i < valores.length; i++) slots.push(slots[slots.length - 1] + (valores[i] - valores[i - 1] === 1 ? 1 : 2));
  if (sinLimite) slots.push(slots[slots.length - 1] + 16);
  return { stops: [...valores, ...(sinLimite ? [null] : [])], slots, marcas, min, max, sinLimite };
}

const rango = (a, b, paso = 1) => Array.from({ length: Math.floor((b - a) / paso) + 1 }, (_, i) => a + i * paso);

/** La distancia: 1 a 25 km de 1 en 1, 30 a 100 de 5 en 5; marcas 5, 10, 25, 50, 100. */
export const ESCALA_KM = escala([...rango(1, 25), ...rango(30, 100, 5)], { marcas: [5, 10, 25, 50, 100], min: 1, max: 100 });

/** El precio: Gratis (0), 1 a 25 € de 1 en 1, 30 a 100 de 5 en 5 y «Sin límite» (null). */
export const ESCALA_PRECIO = escala([...rango(0, 25), ...rango(30, 100, 5)], { marcas: [0, 10, 25, 50, 100, null], min: 0, max: 100, sinLimite: true });

/** Las marcas de la distancia: «Ampliar a N km» va a la siguiente. */
export const MARCAS_KM = ESCALA_KM.marcas;

const maxSlot = (e) => e.slots[e.slots.length - 1];

/** Dónde cae un valor en la barra (en huecos). Uno escrito a mano que no es
 * un paso (63 km) va entre los dos de al lado, en proporción. */
export function slotDe(e, v) {
  if (v == null) return maxSlot(e);
  const vals = e.stops.filter((s) => s != null);
  if (v <= vals[0]) return 0;
  for (let i = 1; i < vals.length; i++) {
    if (v <= vals[i]) return e.slots[i - 1] + (v - vals[i - 1]) / (vals[i] - vals[i - 1]) * (e.slots[i] - e.slots[i - 1]);
  }
  return e.slots[vals.length - 1];
}

/** El paso al que lleva mover la barra a `slot` viniendo de `desde` (en un
 * hueco entre pasos, el siguiente en la dirección del movimiento). */
export function valorEnSlot(e, slot, desde) {
  const s = Math.min(Math.max(slot, 0), maxSlot(e));
  for (let i = 0; i < e.slots.length; i++) if (Math.abs(e.slots[i] - s) < 0.001) return e.stops[i];
  for (let i = 1; i < e.slots.length; i++) if (s < e.slots[i]) return s >= desde ? e.stops[i] : e.stops[i - 1];
  return e.stops[e.stops.length - 1];
}

/** Lo escrito: `{ ok, valor }`. Un entero de min a max; vacío es «Sin límite»
 * si lo hay (si no, `{ ok: false, vacio: true }`, que no es un error). */
export function leeEscrito(e, txt) {
  const t = String(txt ?? '').trim();
  if (!t) return e.sinLimite ? { ok: true, valor: null } : { ok: false, vacio: true };
  if (!/^\d{1,3}$/.test(t)) return { ok: false };
  const n = Number(t);
  return n >= e.min && n <= e.max ? { ok: true, valor: n } : { ok: false };
}

/** La distancia de una dirección (`?km=`): cualquier entero de 1 a 100 (los
 * de antes, 1, 3, 5, 10 y 25, también); lo de fuera, al extremo; sin número,
 * `porDefecto`. */
export function kmDeUrl(txt, porDefecto) {
  const n = Number.parseInt(String(txt ?? ''), 10);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.min(Math.max(n, ESCALA_KM.min), ESCALA_KM.max);
}

/** El precio de una dirección (`?precio=`): 'free' (gratis, también `0`),
 * '1'…'100' o '' (sin límite). Los de antes (gratis, 10, 25, 50) valen igual;
 * más de 100 €, sin límite. */
export function precioDeUrl(norm) {
  if (norm === 'free') return 'free';
  if (!/^\d{1,3}$/.test(norm || '')) return '';
  const n = Number(norm);
  if (n === 0) return 'free';
  return n <= ESCALA_PRECIO.max ? String(n) : '';
}

/**
 * Una barra de filtro.
 *  - `id`: prefijo único de la página;
 *  - `e`: la escala (`ESCALA_KM`, `ESCALA_PRECIO`);
 *  - `valor`: el elegido (número o null = «Sin límite»);
 *  - `t`: los textos: `titulo` (para el lector), `valor(v)` (lo de arriba:
 *    «A menos de 63 km»), `marca(v)` («25», «Gratis»), `dicho(v)` (cómo se
 *    lee una marca), `campo` («O escribe los km»), `unidad`, `error`,
 *    `vacio` (la casilla vacía: «Sin límite»), y para /assets/barra-filtro.js
 *    las plantillas `n` («A menos de {n} km»), `cero` y `sin`;
 *  - `nombre`: el nombre del campo en el formulario (`km`, `precio`);
 *  - `href(v)`: con él, las marcas son enlaces (van sin JavaScript); sin
 *    él, botones que se ven solo con JavaScript;
 *  - `ir`: la dirección con `__V__` a la que lleva un valor nuevo (en
 *    «¿Dónde?»); `cerca`: el id del botón que pide la ubicación (sin ella);
 *  - `campoValor`: lo que lleva la casilla al abrir (si no, el valor).
 */
export function barraFiltro({ id, e, valor, t, nombre, href = null, ir = '', cerca = '', campoValor = null }) {
  const total = maxSlot(e);
  const pos = (v) => slotDe(e, v) / total;
  const marcas = e.marcas.map((m, i) => {
    const on = m === valor;
    const extremo = i === 0 && m === e.stops[0] ? ' barra-m-ini' : m === e.stops[e.stops.length - 1] ? ' barra-m-fin' : '';
    const attrs = `class="barra-m${on ? ' on' : ''}${extremo}" style="--x:${pos(m).toFixed(4)}" data-v="${m ?? ''}" aria-label="${esc(t.dicho(m))}"${on ? ' aria-current="true"' : ''}`;
    return href
      ? `<a ${attrs} href="${esc(href(m))}">${esc(t.marca(m))}</a>`
      : `<button type="button" ${attrs} hidden>${esc(t.marca(m))}</button>`;
  }).join('');
  const datos = { stops: e.stops, slots: e.slots, min: e.min, max: e.max, sin: e.sinLimite };
  const textos = { titulo: t.titulo, n: t.n, cero: t.cero || '', sin: t.sin || '' };
  const enCampo = campoValor ?? (valor == null ? '' : String(valor));
  return `<div class="barra" id="${esc(id)}" data-barra="${esc(JSON.stringify(datos))}" data-textos="${esc(JSON.stringify(textos))}"${ir ? ` data-ir="${esc(ir)}"` : ''}${cerca ? ` data-cerca-boton="${esc(cerca)}"` : ''}>
      <p class="barra-valor" aria-live="polite">${esc(t.valor(valor))}</p>
      <div class="barra-pista">
        <input type="range" class="barra-r" min="0" max="${total}" step="1" value="${slotDe(e, valor)}" style="--p:${(slotDe(e, valor) / total).toFixed(4)}" aria-label="${esc(t.titulo)}" aria-valuetext="${esc(`${t.titulo}: ${t.valor(valor)}`)}" hidden>
        <div class="barra-marcas">${marcas}</div>
      </div>
      <label class="barra-campo"><span class="barra-campo-t">${esc(t.campo)}</span>
        <span class="buscador-campo barra-in"><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" name="${esc(nombre)}" value="${esc(enCampo)}"${t.vacio ? ` placeholder="${esc(t.vacio)}"` : ''} aria-describedby="${esc(id)}-err" data-cuenta-valor><span class="barra-u" aria-hidden="true">${esc(t.unidad)}</span></span></label>
      <p class="barra-err" id="${esc(id)}-err" role="alert" hidden>${esc(t.error)}</p>
    </div>`;
}
