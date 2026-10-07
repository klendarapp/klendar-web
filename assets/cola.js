// La página pública de la cola virtual: klendar.app/cola/<código> (y
// /en/queue/<código>), la dirección que va en el QR del «Cartel para la
// puerta». Enseña el local y cómo está la cola (`queue_info`, sin sesión):
// cuánta gente espera y la espera aproximada, o que hoy no hay cola, que está
// cerrada o llena, o que el cartel ya no funciona.
//
// El turno en vivo (coger número, tu número, cuántos tienes delante, «¡Te
// toca!» con sonido y vibración) vive en «Tu cuenta» (`#/cola/<código>`,
// app/cola.js), que necesita la sesión. Por eso:
//
// - con una sesión de «Tu cuenta» guardada en este navegador, la página
//   lleva directamente allí (lo hace la etiqueta del <head>, antes de pintar);
// - sin ella, el botón es «Entrar para coger número», que entra y vuelve a
//   «Tu cuenta» con el turno.
//
// Sirve igual para las Pages Functions (`functions/_lib/cola.js` pinta la
// página en el servidor) y para el navegador (script clásico, `KlendarCola`
// en `window`), que la vuelve a pedir cada 10 s mientras está a la vista.
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  /** El código del cartel: 16 letras, números, guiones o guiones bajos. */
  const codigoValido = (c) => (/^[A-Za-z0-9_-]{16}$/.test(String(c || '')) ? String(c) : '');

  const T = {
    es: {
      kicker: 'Cola virtual',
      waiting: (n) => (n === 0 ? 'No hay nadie esperando' : n === 1 ? '1 persona esperando' : `${n} personas esperando`),
      wait: (m) => `Espera aproximada: unos ${m} min`,
      noPace: 'La espera aproximada sale cuando avancen los primeros',
      login: 'Entrar para coger número',
      help: (x) => `Te avisamos en el móvil cuando te toque. Tendrás ${x} minutos para presentarte.`,
      none: 'Hoy no hay cola virtual',
      noneBody: (b) => `${b} no ha abierto la cola. Pregunta en la puerta.`,
      closed: 'La cola está cerrada',
      closedBody: 'Hoy ya no se apunta nadie más.',
      full: 'La cola está llena',
      fullBody: 'Prueba dentro de un rato.',
      bad: 'Este cartel ya no funciona',
      badBody: 'Puede que el local lo haya cambiado. Pide el nuevo en la puerta.',
      venue: 'Ver el local',
      explore: 'Ver qué hay cerca',
      adults: 'Solo para mayores de 18 años.',
    },
    en: {
      kicker: 'Virtual queue',
      waiting: (n) => (n === 0 ? 'Nobody is waiting' : n === 1 ? '1 person waiting' : `${n} people waiting`),
      wait: (m) => `Estimated wait: about ${m} min`,
      noPace: 'The estimated wait appears once the first people have been seen',
      login: 'Log in to get a number',
      help: (x) => `We'll let you know on your phone when it's your turn. You'll have ${x} minutes to get there.`,
      none: 'No virtual queue today',
      noneBody: (b) => `${b} hasn't opened the queue. Ask at the door.`,
      closed: 'The queue is closed',
      closedBody: 'Nobody else can join today.',
      full: 'The queue is full',
      fullBody: 'Try again in a while.',
      bad: 'This poster no longer works',
      badBody: 'The venue may have changed it. Ask for the new one at the door.',
      venue: 'See the venue',
      explore: "See what's nearby",
      adults: 'Over-18s only.',
    },
  };

  /** «Tu cuenta» en el idioma de la página. */
  const cuenta = (lang) => (lang === 'en' ? '/app/?lang=en' : '/app/');
  /** Entrar y volver a la cola en «Tu cuenta». */
  const entrar = (lang, code) => `${cuenta(lang)}#/entrar?siguiente=${encodeURIComponent(`cola/${code}`)}`;
  /** La ficha del negocio. */
  const ficha = (lang, b) => `${lang === 'en' ? '/en' : ''}/b/${encodeURIComponent(b?.slug || b?.id || '')}`;

  /** «Calle Mayor 12, Madrid» (lo mismo que el cartel). */
  function direccionCorta(address, city) {
    const calle = String(address || '').split(',')[0].trim();
    const c = String(city || '').trim();
    if (!calle) return c;
    if (!c || calle.toLowerCase().includes(c.toLowerCase())) return calle;
    return `${calle}, ${c}`;
  }

  /** Pantalla vacía centrada (`.vacio` de site.css): título, texto y botón. */
  const vacio = (S, titulo, texto, botones) => `<section class="vacio cola-vacio">
      <p class="cola-kicker">${esc(S.kicker)}</p>
      <h1>${esc(titulo)}</h1>
      ${texto ? `<p>${esc(texto)}</p>` : ''}
      <div class="vacio-botones">${botones}</div>
    </section>`;

  /**
   * Lo que se ve, según lo que devuelve `queue_info` (`null` o `{ok:false}`
   * = el código no vale).
   */
  function cuerpo(info, lang, code) {
    const en = lang === 'en';
    const S = T[en ? 'en' : 'es'];
    if (!info || info.ok !== true || !info.business) {
      return vacio(S, S.bad, S.badBody,
        `<a class="pill accent" href="${en ? '/en/explore/' : '/explorar/'}">${esc(S.explore)}</a>`);
    }
    const b = info.business;
    const q = info.queue;
    const verLocal = (cls) => `<a class="pill${cls ? ` ${cls}` : ''}" href="${esc(ficha(lang, b))}">${esc(S.venue)}</a>`;
    if (!q) return vacio(S, S.none, S.noneBody(b.name || ''), verLocal('accent'));
    const dir = direccionCorta(b.address, b.city);
    const cab = `<header class="cola-cab">
        ${b.logo_url && /^https:\/\//.test(b.logo_url) ? `<img class="cola-logo" src="${esc(b.logo_url)}" alt="" width="56" height="56">` : ''}
        <div><p class="cola-kicker">${esc(S.kicker)}</p>
          <h1>${esc(b.name || '')}</h1>
          ${dir ? `<p class="muted">${esc(dir)}</p>` : ''}</div>
      </header>`;
    const n = Number(q.waiting) || 0;
    const espera = n === 0 ? ''
      : `<p class="muted">${esc(q.wait_minutes != null ? S.wait(q.wait_minutes) : S.noPace)}</p>`;
    if (q.status !== 'open' || q.full) {
      const cerrada = q.status !== 'open';
      return `${cab}
        <section class="cola-estado">
          <h2>${esc(cerrada ? S.closed : S.full)}</h2>
          <p>${esc(cerrada ? S.closedBody : S.fullBody)}</p>
          <p class="muted">${esc(S.waiting(n))}</p>
          <div class="vacio-botones">${verLocal('')}</div>
        </section>`;
    }
    return `${cab}
      <section class="cola-estado">
        <p class="cola-cuantos">${esc(S.waiting(n))}</p>
        ${espera}
        <div class="vacio-botones">
          <a class="pill accent" href="${esc(entrar(lang, code))}" rel="nofollow">${esc(S.login)}</a>
          ${verLocal('')}
        </div>
        <p class="muted cola-ayuda">${esc(S.help(q.call_minutes || 5))}</p>
        ${b.adults_only ? `<p class="muted cola-ayuda">${esc(S.adults)}</p>` : ''}
      </section>`;
  }

  /** El título de la pestaña. */
  function titulo(info, lang) {
    const S = T[lang === 'en' ? 'en' : 'es'];
    if (!info || info.ok !== true || !info.business) return S.bad;
    return `${S.kicker} · ${info.business.name || ''}`;
  }

  /** La etiqueta del <head> que lleva a «Tu cuenta» si hay sesión guardada
   * (la misma clave que usa supabase-js: `sb-<proyecto>-auth-token`). */
  function saltoConSesion(lang, code) {
    const destino = JSON.stringify(`${cuenta(lang)}#/cola/${code}`);
    return `<script>(function(){try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!/^sb-[a-z0-9]+-auth-token$/.test(k||''))continue;var s=JSON.parse(localStorage.getItem(k)||'null');if(s&&(s.access_token||s.currentSession)){location.replace(${destino});return;}}}catch(e){}})();</script>`;
  }

  const KlendarCola = { T, esc, codigoValido, cuerpo, titulo, saltoConSesion, direccionCorta };

  // ── En el navegador: volver a mirar cada 10 s ─────────────────────────────
  if (typeof document !== 'undefined' && document.currentScript) {
    const yo = document.currentScript;
    const url = yo.dataset.url;
    const key = yo.dataset.key;
    const lang = yo.dataset.lang === 'en' ? 'en' : 'es';
    const caja = () => document.getElementById('cola-pub');
    const code = codigoValido(caja()?.dataset.code);
    let ultima = '';
    const mira = async () => {
      if (document.visibilityState === 'hidden' || !caja()) return;
      try {
        const r = await fetch(`${url}/rest/v1/rpc/queue_info`, {
          method: 'POST',
          headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_code: code }),
        });
        if (!r.ok) return;
        const info = await r.json();
        const html = cuerpo(info, lang, code);
        if (html === ultima) return;
        ultima = html;
        caja().innerHTML = html;
        document.title = `${titulo(info, lang)} · Klendar`;
      } catch { /* sin red: se queda lo que había */ }
    };
    if (code && url && key && caja()?.dataset.estado !== 'bad') {
      ultima = cuerpo(null, lang, code); // distinto de lo pintado: la primera vuelta repinta si cambia
      setInterval(mira, 10000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') mira(); });
    }
  }

  globalThis.KlendarCola = KlendarCola;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarCola;
})();
