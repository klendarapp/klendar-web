// «¿Hay sitio ahora?» en las páginas públicas (ficha del negocio y tarjeta
// del mapa de Explorar): «Casi lleno · hace 20 min».
//
// La página sale de la caché unos minutos y lo marcado caduca a las 2 h y
// solo vale con el local abierto: lo pide el navegador a la base
// (`business_marks`, sin sesión) y lo pinta. Si no hay nada, no sale nada.
//
// Debajo, «Avísame cuando haya sitio» (migración 20261234100000): solo con
// la sesión de «Tu cuenta» guardada en este navegador (como «Estaba
// cerrado»), con el local «Casi lleno» o «Lleno» y si no eres de su equipo
// (la base dice `team` y se esconde). Pedido: «Te avisaremos cuando haya
// sitio · Quitar». Con los avisos «Cuando haya sitio» apagados, se pregunta
// antes de encenderlos.
//
// Uso: `<p data-sitio-ahora="<id del negocio>" hidden></p>`, si se quiere
// `<div data-hay-sitio="<id>" hidden></div>` para el botón, y este script con
// `data-url`, `data-key` y `data-lang` (necesita /assets/marcas.js antes).
// El mapa llama a `KlendarSitioAhora.pide(ids)` y pinta lo que vuelve (y
// `KlendarSitioAhora.avisame(caja, id, marca)` para el botón).
(function () {
  'use strict';
  const KM = window.KlendarMarcas;
  const yo = document.currentScript;
  if (!KM || !yo) return;
  const url = yo.getAttribute('data-url');
  const key = yo.getAttribute('data-key');
  const lang = yo.getAttribute('data-lang') === 'en' ? 'en' : 'es';
  const ICONOS = {
    // event_seat, groups y do_not_disturb_on (Material), como la app.
    quiet: 'M4 18v3h3v-3h10v3h3v-6H4v3zm15-8h3v3h-3v-3zM2 10h3v3H2v-3zm15 3H7V5c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v8z',
    lively: 'M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58A2.01 2.01 0 0 0 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85A6.95 6.95 0 0 0 20 14c-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z',
    full: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z',
  };

  async function pide(ids) {
    const lista = [...new Set(ids.filter(Boolean))].slice(0, 200);
    if (!url || !key || !lista.length) return {};
    try {
      const r = await fetch(`${url}/rest/v1/rpc/business_marks`, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_ids: lista }),
      });
      if (!r.ok) return {};
      const filas = await r.json();
      return Object.fromEntries((Array.isArray(filas) ? filas : []).map((f) => [f.business_id, f]));
    } catch { return {}; }
  }

  /** «Casi lleno · hace 20 min» con su icono, o '' si no hay nada que decir. */
  function texto(m) {
    if (!m || !m.crowd || !m.crowd_at) return '';
    return `${KM.nivel(m.crowd, lang)} · ${KM.hace(m.crowd_at, lang)}`;
  }
  function pinta(el, m) {
    const t = texto(m);
    if (!t) { el.hidden = true; return; }
    el.innerHTML = `<svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="${ICONOS[m.crowd] || ''}"/></svg><span></span>`;
    el.querySelector('span').textContent = t;
    el.setAttribute('aria-label', (lang === 'en' ? KM.t('en') : KM.t('es')).crowdNowA11y(KM.nivel(m.crowd, lang), KM.hace(m.crowd_at, lang)));
    el.hidden = false;
  }

  async function refresca() {
    const els = [...document.querySelectorAll('[data-sitio-ahora]')];
    if (!els.length) return;
    const datos = await pide(els.map((e) => e.getAttribute('data-sitio-ahora')));
    for (const el of els) pinta(el, datos[el.getAttribute('data-sitio-ahora')]);
    for (const caja of document.querySelectorAll('[data-hay-sitio]')) {
      const id = caja.getAttribute('data-hay-sitio');
      avisame(caja, id, datos[id]);
    }
  }

  // ── «Avísame cuando haya sitio» ───────────────────────────────────────────
  const T = lang === 'en' ? {
    pedir: 'Tell me when there’s room', pedido: 'We’ll tell you when there’s room', quitar: 'Remove',
    nota: (h) => `We’ll tell you once, until ${h}.`,
    apagados: 'You’ve turned off “When there’s room” notifications.',
    activar: 'Turn on and tell me', ahoraNo: 'Not now',
    tope: 'You’re already waiting to hear from 5 places. Remove one to ask for another.',
    hay: 'There’s room already: no need to tell you.',
    rapido: 'Slow down a little. Wait a moment and try again.',
    error: 'Something went wrong. Try again in a moment.',
  } : {
    pedir: 'Avísame cuando haya sitio', pedido: 'Te avisaremos cuando haya sitio', quitar: 'Quitar',
    nota: (h) => `Te avisaremos una vez, hasta las ${h}.`,
    apagados: 'Tienes apagados los avisos «Cuando haya sitio».',
    activar: 'Activar y avisarme', ahoraNo: 'Ahora no',
    tope: 'Ya esperas aviso de 5 sitios. Quita alguno para pedir otro.',
    hay: 'Ya hay sitio: no hace falta avisarte.',
    rapido: 'Vas muy rápido. Espera un momento y vuelve a probar.',
    error: 'Algo no ha ido bien. Prueba otra vez en un momento.',
  };
  // notifications (Material), como la app.
  const CAMPANA = 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z';
  const campana = `<svg class="ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="${CAMPANA}"/></svg>`;
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** ¿Hay una sesión de «Tu cuenta» guardada? (sin cargar nada). */
  function conSesion() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!/^sb-[a-z0-9]+-auth-token$/.test(k || '')) continue;
        const v = JSON.parse(localStorage.getItem(k) || 'null');
        if (v && (v.refresh_token || v.access_token)) return true;
      }
    } catch { /* sin almacenamiento */ }
    return false;
  }
  function carga(src, integrity) {
    return new Promise((ok, ko) => {
      const sc = document.createElement('script');
      if (integrity) { sc.integrity = integrity; sc.crossOrigin = 'anonymous'; }
      sc.src = src; sc.onload = ok; sc.onerror = ko;
      document.head.appendChild(sc);
    });
  }
  let clienteP = null;
  /** El mismo cliente que amigos.js, visita.js y cerrado.js (uno por página). */
  function cliente() {
    if (!clienteP) {
      clienteP = (window.KLENDAR_ENV ? Promise.resolve() : carga('/config.js?v=3'))
        .then(() => (window.supabase ? null : carga('/assets/vendor/supabase-js-2.117.2.js',
          'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok')))
        .then(() => {
          const env = window.KLENDAR_ENV;
          if (!env || !window.supabase) return null;
          return window.klendarSb || (window.klendarSb = window.supabase.createClient(env.url, env.key,
            { auth: { flowType: 'pkce', detectSessionInUrl: false } }));
        })
        .catch(() => null);
    }
    return clienteP;
  }
  // Lo pedido por quien mira (`my_room_alerts`), un minuto en memoria.
  let misP = null;
  let misAt = 0;
  function misAvisos(otraVez = false) {
    if (!misP || otraVez || Date.now() - misAt > 60000) {
      misAt = Date.now();
      misP = cliente().then((sb) => (sb ? sb.rpc('my_room_alerts') : null))
        .then((r) => (r && !r.error && Array.isArray(r.data) ? new Map(r.data.map((a) => [a.business_id, a])) : null))
        .catch(() => null);
    }
    return misP;
  }
  /** `sb.rpc` no es una promesa de verdad (no tiene `.catch`). */
  const llama = (sb, fn, args) => Promise.resolve().then(() => sb.rpc(fn, args)).catch(() => null);
  const equipo = new Set();
  const zona = () => document.querySelector('[data-tz]')?.getAttribute('data-tz') || undefined;
  const hora = (iso) => {
    try { return new Date(iso).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'es-ES', { hour: 'numeric', minute: '2-digit', timeZone: zona() }); } catch { return ''; }
  };
  function estilos() {
    if (document.getElementById('hay-sitio-css')) return;
    const st = document.createElement('style');
    st.id = 'hay-sitio-css';
    st.textContent = `[data-hay-sitio][hidden], .hs-caja[hidden] { display: none !important; }
.hs-caja { margin: 8px 0 12px; display: grid; gap: 6px; justify-items: start; }
.hs-caja .pill { padding: 10px 16px; font-size: 14px; font-family: inherit; cursor: pointer; }
.hs-caja .pill:disabled { opacity: .6; cursor: progress; }
.hs-on { margin: 0; font-weight: 700; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
.hs-on .ic { vertical-align: -3px; }
.hs-quitar { background: none; border: 0; padding: 0; font: inherit; font-weight: 700; color: var(--ink); text-decoration: underline; cursor: pointer; }
.hs-msg { margin: 0; font-size: 14px; color: var(--ink-2); }
.pop-caja .hs-caja { margin: 8px 0 0; }
.pop-caja .hs-caja .pill { padding: 8px 12px; font-size: 13px; }
.pop-caja .hs-on, .pop-caja .hs-msg { font-size: 13px; }
.hs-dialogo { border: 0; border-radius: 22px; padding: 22px; width: min(420px, calc(100vw - 32px)); box-sizing: border-box; background: var(--elevated, #fff); color: var(--ink); }
.hs-dialogo::backdrop { background: rgba(0,0,0,.45); }
.hs-dialogo p { margin: 0 0 16px; font-weight: 700; font-size: 17px; line-height: 1.35; }
.hs-botones { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.hs-botones .pill { justify-content: center; text-align: center; margin: 0; font-family: inherit; cursor: pointer; padding: 12px 10px; }`;
    document.head.appendChild(st);
  }
  /** «Tienes apagados los avisos…»: true si quiere encenderlos. */
  function preguntaEncender() {
    estilos();
    return new Promise((ok) => {
      const d = document.createElement('dialog');
      d.className = 'hs-dialogo';
      d.innerHTML = `<p>${esc(T.apagados)}</p><div class="hs-botones">
        <button type="button" class="pill" data-no>${esc(T.ahoraNo)}</button>
        <button type="button" class="pill accent" data-si>${esc(T.activar)}</button></div>`;
      const fin = (v) => { if (d.open) d.close(); d.remove(); ok(v); };
      d.querySelector('[data-si]').onclick = () => fin(true);
      d.querySelector('[data-no]').onclick = () => fin(false);
      d.addEventListener('cancel', (e) => { e.preventDefault(); fin(false); });
      document.body.appendChild(d);
      if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    });
  }

  /** El botón (o «Te avisaremos…») de un negocio en `caja`, según cómo está
   * (`m`, la fila de `business_marks`). Sin sesión, del equipo o con sitio
   * (y sin nada pedido), no sale nada. */
  async function avisame(caja, id, m, mensaje = '') {
    if (!caja || !id) return;
    const nivel = m && m.crowd;
    const lleno = nivel === 'lively' || nivel === 'full';
    if (!conSesion() || equipo.has(id) || document.body.classList.contains('es-equipo')) { caja.hidden = true; return; }
    const antes = caja.getAttribute('data-hs') || '';
    const mios = lleno || antes === 'pedido' ? await misAvisos() : null;
    const estado = mios && mios.has(id) ? 'pedido' : mios && lleno ? 'pedir' : '';
    if (!estado) { caja.hidden = true; caja.removeAttribute('data-hs'); return; }
    if (antes === estado && !mensaje) return; // nada nuevo: no se repinta
    estilos();
    caja.classList.add('hs-caja');
    caja.setAttribute('data-hs', estado);
    const msg = mensaje ? `<p class="hs-msg" role="status">${esc(mensaje)}</p>` : '';
    caja.innerHTML = estado === 'pedido'
      ? `<p class="hs-on"><span>${campana} ${esc(T.pedido)}</span><button type="button" class="hs-quitar" data-hs-quitar>${esc(T.quitar)}</button></p>${msg}`
      : `<button type="button" class="pill" data-hs-pedir>${campana}<span>${esc(T.pedir)}</span></button>${msg}`;
    caja.hidden = false;
    const repinta = (txt) => { caja.removeAttribute('data-hs'); return avisame(caja, id, m, txt); };
    const pedir = caja.querySelector('[data-hs-pedir]');
    if (pedir) {
      pedir.onclick = async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (pedir.disabled) return;
        pedir.disabled = true;
        const sb = await cliente();
        if (!sb) { repinta(T.error); return; }
        let r = await llama(sb, 'request_room_alert', { p_business: id, p_enable: false });
        let err = String(r?.error?.message || '');
        if (err.includes('alerts_off')) {
          if (!(await preguntaEncender())) { pedir.disabled = false; return; }
          r = await llama(sb, 'request_room_alert', { p_business: id, p_enable: true });
          err = String(r?.error?.message || '');
        }
        if (r && !r.error && r.data && r.data.ok) {
          await misAvisos(true);
          repinta(r.data.expires_at ? T.nota(hora(r.data.expires_at)) : '');
          return;
        }
        if (/team|not_authenticated|not_found/.test(err)) {
          if (err.includes('team')) equipo.add(id);
          caja.hidden = true;
          return;
        }
        repinta(err.includes('too_many') ? T.tope : err.includes('not_full') ? T.hay
          : err.includes('rate_limited') ? T.rapido : T.error);
      };
    }
    const quitar = caja.querySelector('[data-hs-quitar]');
    if (quitar) {
      quitar.onclick = async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        if (quitar.disabled) return;
        quitar.disabled = true;
        const sb = await cliente();
        const r = sb ? await llama(sb, 'cancel_room_alert', { p_business: id }) : null;
        if (!r || r.error) { repinta(T.error); return; }
        await misAvisos(true);
        repinta('');
      };
    }
  }

  window.KlendarSitioAhora = { pide, texto, ICONOS, lang, avisame };
  refresca();
  // «hace 20 min» sigue la hora, y a las 2 h desaparece solo.
  setInterval(refresca, 60000);
})();
