/* Las barras de filtro: la distancia de «¿Dónde?» (1 a 100 km) y el «Precio
 * del plan» de ☰ (Gratis a «Sin límite»). El HTML lo pinta
 * functions/_lib/barra.js (`barraFiltro`), con los pasos en `data-barra`; lo
 * mismo que la app (`FilterSlider`).
 *
 * - La barra (un `<input type=range>` de huecos): al arrastrar va de paso en
 *   paso (de 1 en 1 y de 5 en 5; en el hueco de «Sin límite», salta) y arriba
 *   dice a cuál; al soltar, se aplica. Con el teclado, cada flecha es un paso.
 * - Las marcas: tocar una salta a ella.
 * - La casilla: cualquier entero del rango; la barra se coloca sola. Fuera de
 *   rango, el error (y `aria-invalid`), que se quita al corregirlo.
 * - Aplicar: en «¿Dónde?» (`data-ir`), ir a la dirección con la distancia
 *   nueva (sin ubicación, pedirla con el botón de `data-cerca-boton`); en la
 *   hoja de Filtros, avisar al formulario (`change`) para «Ver N resultados».
 */
(function () {
  'use strict';

  function maxSlot(e) { return e.slots[e.slots.length - 1]; }

  function slotDe(e, v) {
    if (v == null) return maxSlot(e);
    var vals = e.stops.filter(function (s) { return s != null; });
    if (v <= vals[0]) return 0;
    for (var i = 1; i < vals.length; i++) {
      if (v <= vals[i]) return e.slots[i - 1] + (v - vals[i - 1]) / (vals[i] - vals[i - 1]) * (e.slots[i] - e.slots[i - 1]);
    }
    return e.slots[vals.length - 1];
  }

  function valorEnSlot(e, slot, desde) {
    var s = Math.min(Math.max(slot, 0), maxSlot(e));
    var i;
    for (i = 0; i < e.slots.length; i++) if (Math.abs(e.slots[i] - s) < 0.001) return e.stops[i];
    for (i = 1; i < e.slots.length; i++) if (s < e.slots[i]) return s >= desde ? e.stops[i] : e.stops[i - 1];
    return e.stops[e.stops.length - 1];
  }

  function leeEscrito(e, txt) {
    var t = String(txt || '').trim();
    if (!t) return e.sin ? { ok: true, valor: null } : { ok: false, vacio: true };
    if (!/^\d{1,3}$/.test(t)) return { ok: false };
    var n = Number(t);
    return n >= e.min && n <= e.max ? { ok: true, valor: n } : { ok: false };
  }

  // Si dos marcas se pisan (letra grande, «100» junto a «Sin límite»), se
  // separan lo justo sin salirse por los lados.
  function separa(caja) {
    var ms = Array.prototype.filter.call(caja.children, function (m) { return !m.hidden; });
    if (ms.length < 2) return;
    ms.forEach(function (m) { m.style.translate = ''; });
    var ancho = caja.getBoundingClientRect();
    var r = ms.map(function (m) { return m.getBoundingClientRect(); });
    var izq = r.map(function (x) { return x.left - ancho.left; });
    var i;
    for (i = 1; i < ms.length; i++) izq[i] = Math.max(izq[i], izq[i - 1] + r[i - 1].width + 4);
    for (i = ms.length - 1; i >= 0; i--) {
      var max = i === ms.length - 1 ? ancho.width - r[i].width : izq[i + 1] - r[i].width - 4;
      izq[i] = Math.max(0, Math.min(izq[i], max));
    }
    ms.forEach(function (m, k) {
      var d = izq[k] - (r[k].left - ancho.left);
      if (Math.abs(d) > 0.5) m.style.translate = d + 'px 0';
    });
  }

  document.querySelectorAll('.barra[data-barra]').forEach(function (b) {
    var e, T;
    try {
      e = JSON.parse(b.getAttribute('data-barra'));
      T = JSON.parse(b.getAttribute('data-textos'));
    } catch (x) { return; }
    var r = b.querySelector('.barra-r');
    var campo = b.querySelector('.barra-in input');
    var arriba = b.querySelector('.barra-valor');
    var err = b.querySelector('.barra-err');
    var caja = b.querySelector('.barra-marcas');
    var marcas = b.querySelectorAll('.barra-m');
    if (!r || !campo) return;
    r.hidden = false;
    Array.prototype.forEach.call(marcas, function (m) { m.hidden = false; });

    var leido = leeEscrito(e, campo.value);
    var valor = leido.ok ? leido.valor : (e.sin ? null : e.min);
    var raw = Number(r.value);
    var espera = null;

    function texto(v) {
      if (v == null) return T.sin;
      if (v === 0 && T.cero) return T.cero;
      return T.n.replace('{n}', v);
    }
    function pinta(v, desdeCampo) {
      valor = v;
      r.value = String(slotDe(e, v));
      r.style.setProperty('--p', String(slotDe(e, v) / maxSlot(e)));
      r.setAttribute('aria-valuetext', T.titulo + ': ' + texto(v));
      arriba.textContent = texto(v);
      Array.prototype.forEach.call(marcas, function (m) {
        var mv = m.getAttribute('data-v');
        var on = (mv === '' ? null : Number(mv)) === v;
        m.classList.toggle('on', on);
        if (on) m.setAttribute('aria-current', 'true'); else m.removeAttribute('aria-current');
      });
      if (!desdeCampo) campo.value = v == null ? '' : String(v);
      err.hidden = true;
      campo.removeAttribute('aria-invalid');
    }
    // Aplicar el valor (soltar, marca, casilla).
    function aplica(v) {
      clearTimeout(espera);
      var ir = b.getAttribute('data-ir');
      if (ir) {
        var boton = b.getAttribute('data-cerca-boton');
        var bc = boton ? document.getElementById(boton) : null;
        if (bc) {
          bc.setAttribute('data-mas', 'km=' + v);
          bc.click();
          return;
        }
        location.href = ir.replace('__V__', encodeURIComponent(v == null ? '' : String(v)));
        return;
      }
      campo.dispatchEvent(new Event('change', { bubbles: true }));
    }

    r.addEventListener('pointerdown', function () { raw = Number(r.value); });
    r.addEventListener('focus', function () { raw = Number(r.value); });
    r.addEventListener('input', function () {
      var v = Number(r.value);
      var paso = valorEnSlot(e, v, raw);
      raw = v;
      pinta(paso);
    });
    r.addEventListener('change', function () {
      raw = Number(r.value);
      aplica(valor);
    });
    Array.prototype.forEach.call(marcas, function (m) {
      m.addEventListener('click', function (ev) {
        var mv = m.getAttribute('data-v');
        var v = mv === '' ? null : Number(mv);
        // Un enlace sin la ubicación: la pide (como los botones de antes).
        if (m.tagName === 'A' && !b.getAttribute('data-cerca-boton')) { pinta(v); return; }
        ev.preventDefault();
        pinta(v);
        aplica(v);
      });
    });
    campo.addEventListener('input', function (ev) {
      // Solo cifras (lo demás ni entra).
      var limpio = campo.value.replace(/\D+/g, '').slice(0, 3);
      if (limpio !== campo.value) campo.value = limpio;
      var l = leeEscrito(e, limpio);
      clearTimeout(espera);
      if (l.ok) {
        pinta(l.valor, true);
        espera = setTimeout(function () { aplica(l.valor); }, 700);
      } else if (!l.vacio) {
        err.hidden = false;
        campo.setAttribute('aria-invalid', 'true');
      } else {
        err.hidden = true;
        campo.removeAttribute('aria-invalid');
      }
      // El formulario de la hoja no cuenta hasta que el valor vale.
      ev.stopPropagation();
    });
    campo.addEventListener('change', function (ev) {
      // El `change` del propio navegador (al salir de la casilla): solo si
      // vale; el nuestro (`aplica`) pasa siempre.
      if (ev.isTrusted && !leeEscrito(e, campo.value).ok) ev.stopPropagation();
    }, true);
    campo.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      var l = leeEscrito(e, campo.value);
      if (b.getAttribute('data-ir')) {
        ev.preventDefault();
        if (l.ok) aplica(l.valor);
      } else if (!l.ok) {
        ev.preventDefault();
      }
    });
    if (caja) {
      separa(caja);
      if (window.ResizeObserver) new ResizeObserver(function () { separa(caja); }).observe(caja);
    }
  });
})();
