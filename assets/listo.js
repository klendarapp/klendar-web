// La página pública de «Te aviso cuando esté listo»: klendar.app/listo/<código>
// (y /en/ready/<código>), la dirección del QR del «Cartel para el mostrador».
// Enseña el local y si se puede pedir el aviso (`orders_info`, sin sesión), o
// que el local no lo usa, que está en pausa, que ha terminado por hoy o que el
// cartel ya no funciona.
//
// El pedido en vivo («Avísame cuando esté listo», tu número, «Preparando…» y
// «¡Listo! Pasa a recogerlo» con sonido y vibración) vive en «Tu cuenta»
// (`#/listo/<código>`, app/listo.js), que necesita la sesión: con una sesión
// guardada en este navegador la página lleva allí antes de pintar; sin ella,
// «Entrar para que te avisemos» entra y vuelve.
//
// Lo usan las Pages Functions (`functions/_lib/listo.js`) y, si hiciera falta,
// el navegador (`KlendarListo` en `window`).
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  /** El código del cartel: 16 letras, números, guiones o guiones bajos. */
  const codigoValido = (c) => (/^[A-Za-z0-9_-]{16}$/.test(String(c || '')) ? String(c) : '');

  const T = {
    es: {
      kicker: 'Te aviso cuando esté listo',
      intro: '¿Has pedido en el mostrador? Te avisamos en el móvil cuando esté listo.',
      login: 'Entrar para que te avisemos',
      hint: 'Te daremos un número: es el que dicen en el mostrador.',
      off: 'Este local no avisa de pedidos ahora',
      offBody: 'Pregunta en el mostrador.',
      paused: 'Ahora no se pueden pedir avisos aquí',
      pausedBody: (b) => `${b} no está atendiendo en Klendar en este momento. Pregunta en el mostrador.`,
      ended: 'Los avisos han terminado por hoy',
      endedBody: (b) => `${b} ya no avisa de más pedidos hoy. Pregunta en el mostrador.`,
      bad: 'Este cartel ya no funciona',
      badBody: 'Puede que el local lo haya cambiado. Pregunta en el mostrador.',
      venue: 'Ver el local',
      explore: 'Ver qué hay cerca',
      adults: 'Solo para mayores de 18 años.',
    },
    en: {
      kicker: 'Ready alert',
      intro: 'Ordered at the counter? We’ll let you know on your phone when it’s ready.',
      login: 'Log in so we can tell you',
      hint: 'You’ll get a number: it’s the one they’ll call at the counter.',
      off: 'This venue isn’t sending order alerts right now',
      offBody: 'Ask at the counter.',
      paused: 'You can’t ask for alerts here right now',
      pausedBody: (b) => `${b} isn’t serving on Klendar right now. Ask at the counter.`,
      ended: 'Alerts have finished for today',
      endedBody: (b) => `${b} isn’t sending any more order alerts today. Ask at the counter.`,
      bad: 'This poster no longer works',
      badBody: 'The venue may have changed it. Ask at the counter.',
      venue: 'See the venue',
      explore: "See what's nearby",
      adults: 'Over-18s only.',
    },
  };

  /** «Tu cuenta» en el idioma de la página. */
  const cuenta = (lang) => (lang === 'en' ? '/app/?lang=en' : '/app/');
  /** Entrar y volver al pedido en «Tu cuenta». */
  const entrar = (lang, code) => `${cuenta(lang)}#/entrar?siguiente=${encodeURIComponent(`listo/${code}`)}`;
  const ficha = (lang, b) => `${lang === 'en' ? '/en' : ''}/b/${encodeURIComponent(b?.slug || b?.id || '')}`;

  function direccionCorta(address, city) {
    const calle = String(address || '').split(',')[0].trim();
    const c = String(city || '').trim();
    if (!calle) return c;
    if (!c || calle.toLowerCase().includes(c.toLowerCase())) return calle;
    return `${calle}, ${c}`;
  }

  const vacio = (S, titulo, texto, botones) => `<section class="vacio cola-vacio">
      <p class="cola-kicker">${esc(S.kicker)}</p>
      <h1>${esc(titulo)}</h1>
      ${texto ? `<p>${esc(texto)}</p>` : ''}
      <div class="vacio-botones">${botones}</div>
    </section>`;

  /** Lo que se ve, según `orders_info` (`null` o `{ok:false}` = no vale). */
  function cuerpo(info, lang, code) {
    const en = lang === 'en';
    const S = T[en ? 'en' : 'es'];
    if (!info || info.ok !== true || !info.business) {
      return vacio(S, S.bad, S.badBody,
        `<a class="pill accent" href="${en ? '/en/discover/' : '/descubre/'}">${esc(S.explore)}</a>`);
    }
    const b = info.business;
    const verLocal = (cls) => `<a class="pill${cls ? ` ${cls}` : ''}" href="${esc(ficha(lang, b))}">${esc(S.venue)}</a>`;
    if (info.state === 'off') return vacio(S, S.off, S.offBody, verLocal('accent'));
    if (info.state === 'paused') return vacio(S, S.paused, S.pausedBody(b.name || ''), verLocal('accent'));
    if (info.state === 'ended') return vacio(S, S.ended, S.endedBody(b.name || ''), verLocal('accent'));
    const dir = direccionCorta(b.address, b.city);
    return `<header class="cola-cab">
        ${b.logo_url && /^https:\/\//.test(b.logo_url) ? `<img class="cola-logo" src="${esc(b.logo_url)}" alt="" width="56" height="56">` : ''}
        <div><p class="cola-kicker">${esc(S.kicker)}</p>
          <h1>${esc(b.name || '')}</h1>
          ${dir ? `<p class="muted">${esc(dir)}</p>` : ''}</div>
      </header>
      <section class="cola-estado">
        <p class="cola-cuantos listo-intro">${esc(S.intro)}</p>
        <div class="vacio-botones">
          <a class="pill accent" href="${esc(entrar(lang, code))}" rel="nofollow">${esc(S.login)}</a>
          ${verLocal('')}
        </div>
        <p class="muted cola-ayuda">${esc(S.hint)}</p>
        ${b.adults_only ? `<p class="muted cola-ayuda">${esc(S.adults)}</p>` : ''}
      </section>`;
  }

  function titulo(info, lang) {
    const S = T[lang === 'en' ? 'en' : 'es'];
    if (!info || info.ok !== true || !info.business) return S.bad;
    return `${S.kicker} · ${info.business.name || ''}`;
  }

  /** La etiqueta del <head> que lleva a «Tu cuenta» si hay sesión guardada. */
  function saltoConSesion(lang, code) {
    const destino = JSON.stringify(`${cuenta(lang)}#/listo/${code}`);
    return `<script>(function(){try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!/^sb-[a-z0-9]+-auth-token$/.test(k||''))continue;var s=JSON.parse(localStorage.getItem(k)||'null');if(s&&(s.access_token||s.currentSession)){location.replace(${destino});return;}}}catch(e){}})();</script>`;
  }

  const KlendarListo = { T, esc, codigoValido, cuerpo, titulo, saltoConSesion };
  globalThis.KlendarListo = KlendarListo;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarListo;
})();
