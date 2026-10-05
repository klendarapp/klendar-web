// La página del enlace de un RRPP (klendar.app/rp/<código>): «Lista de Marta»,
// el negocio, el aviso «Te apuntas a la lista de…», «Ofertas de su lista» y
// «Más de <negocio>». Cada publicación lleva a su ficha con `?rp=<código>`,
// que pasa el código a «Tu cuenta» al conseguirlo (`start_redemption`).
//
// Sirve igual para las Pages Functions (`functions/_lib/rrpp.js` la importa
// y pinta la página en el servidor, con `promoter_link_open` sin sesión) y
// para el navegador (script clásico, `KlendarRrpp` en `window`):
//
// - Con una sesión de «Tu cuenta» guardada, vuelve a abrir el enlace con
//   ella: así la persona queda apuntada con ese RRPP esta noche (como en la
//   app) y, si es el propio RRPP o alguien del equipo, se le dice.
// - Si el servidor no ha podido abrirlo (`rate_limited`: el tope por
//   conexión, y desde el servidor todas las visitas salen por la misma), lo
//   abre el navegador con su propia conexión y pinta la página aquí.
//
// Necesita `assets/zona.js` y `assets/tarjeta.js` cargados antes para pintar
// (en el servidor los importa `functions/_lib/rrpp.js`).
(function () {
  'use strict';

  const KT = () => globalThis.KlendarTarjeta;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  /** El código de un enlace: 8–16 letras y números, en minúsculas. */
  const codigoValido = (c) => {
    const x = String(c || '').trim().toLowerCase();
    return /^[a-z0-9]{8,16}$/.test(x) ? x : '';
  };

  const T = {
    es: {
      user: 'Usuario de Klendar',
      list: (n) => `Lista de ${n}`,
      notice: (n, b) => `Te apuntas a la lista de ${n} (${b}). ${n} verá tu nombre y si has entrado.`,
      theirs: 'Ofertas de su lista',
      more: (b) => `Más de ${b}`,
      none: 'Ahora mismo no hay nada publicado. Suele cambiar: échale un ojo en la app.',
      promoterOffer: 'Oferta de RRPP',
      left: (n, nombre) => (n === 1 ? `Queda 1 plaza en la lista de ${nombre}` : `Quedan ${n} plazas en la lista de ${nombre}`),
      until: (h) => `El código vale ${hastaLa(h, 'es')}`,
      hours: (n) => (n === 1 ? 'El código vale 1 hora desde que lo consigues' : `El código vale ${n} horas desde que lo consigues`),
      self: 'Este es tu enlace: quien entre por él se apunta a tu lista.',
      team: (b) => `Eres del equipo de ${b}: lo que hagas con este enlace no cuenta.`,
      notFound: 'Este enlace no existe.',
      paused: 'Este enlace está en pausa.',
      expired: 'Este enlace ha caducado.',
      inactive: 'Este enlace ya no funciona.',
      see: (b) => `Ver ${b}`,
      explore: 'Ver qué hay ahora',
      loading: 'Cargando…',
      oops: 'No hemos podido abrir el enlace. Vuelve a probar en un momento.',
      retry: 'Reintentar',
    },
    en: {
      user: 'Klendar user',
      list: (n) => `${n}'s list`,
      notice: (n, b) => `You're joining ${n}'s list (${b}). ${n} will see your name and whether you got in.`,
      theirs: 'Offers on their list',
      more: (b) => `More from ${b}`,
      none: 'Nothing published right now. It changes often — take a look in the app.',
      promoterOffer: 'Promoter offer',
      left: (n, nombre) => (n === 1 ? `1 place left on ${nombre}'s list` : `${n} places left on ${nombre}'s list`),
      until: (h) => `The code is valid ${hastaLa(h, 'en')}`,
      hours: (n) => (n === 1 ? 'The code is valid for 1 hour after you get it' : `The code is valid for ${n} hours after you get it`),
      self: 'This is your link: people who use it join your list.',
      team: (b) => `You're on the ${b} team: nothing you do through this link counts.`,
      notFound: "This link doesn't exist.",
      paused: 'This link is paused.',
      expired: 'This link has expired.',
      inactive: 'This link no longer works.',
      see: (b) => `See ${b}`,
      explore: "See what's on now",
      loading: 'Loading…',
      oops: "We couldn't open the link. Please try again in a moment.",
      retry: 'Try again',
    },
  };
  const S = (lang) => T[lang === 'en' ? 'en' : 'es'];

  /** «hasta la 1:00», «hasta las 2:30» / «until 01:00». */
  function hastaLa(hhmm, lang) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
    if (!m) return String(hhmm || '');
    const h = Number(m[1]);
    if (lang === 'en') return `until ${String(h).padStart(2, '0')}:${m[2]}`;
    return `${h === 1 ? 'hasta la' : 'hasta las'} ${h}:${m[2]}`;
  }

  /** «Usuario de Klendar» si el RRPP no tiene nombre (nunca su correo). */
  const nombreDe = (p, lang) => (p && String(p.name || '').trim()) || S(lang).user;

  /** Lo que dice una publicación de RRPP: plazas que quedan y hasta cuándo
   * vale el código. `o`: una fila de `promoter_link_open` (quota_left,
   * code_until, code_hours) o el `promoter` de `offer_detail`. */
  function lineas(o, nombre, lang) {
    const s = S(lang);
    const out = [];
    if (o && o.quota_left != null) out.push(s.left(Number(o.quota_left), nombre));
    if (o && o.code_until) out.push(s.until(o.code_until));
    else if (o && o.code_hours) out.push(s.hours(Number(o.code_hours)));
    return out;
  }

  const ICONO_AVISO = '<svg class="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 10H5V7H3v3H0v2h3v3h2v-3h3v-2zm10 1c1.66 0 2.99-1.34 2.99-3S19.66 5 18 5c-.32 0-.63.05-.91.14.57.81.9 1.79.9 2.86s-.34 2.04-.9 2.86c.28.09.59.14.91.14zm-5 0c1.66 0 2.99-1.34 2.99-3S14.66 5 13 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm6.62 2.16c.83.73 1.38 1.66 1.38 2.84v2h3v-2c0-1.54-2.37-2.49-4.38-2.84zM13 13c-2 0-6 1-6 3v2h12v-2c0-2-4-3-6-3z"/></svg>';

  /** El aviso de siempre al entrar por el enlace (también junto al botón de
   * la ficha de una publicación). */
  const aviso = (nombre, negocio, lang) => `<p class="exclusiva rp-aviso">${ICONO_AVISO}<span>${esc(S(lang).notice(nombre, negocio))}</span></p>`;

  /** La dirección de la ficha del negocio (por su dirección con nombre). */
  const fichaNegocio = (b, lang) => `${lang === 'en' ? '/en' : ''}/b/${encodeURIComponent((b && (b.slug || b.id)) || '')}`;
  /** La ficha de una publicación con el código del enlace. */
  const fichaOferta = (id, code, lang) => `${lang === 'en' ? '/en' : ''}/o/${encodeURIComponent(id)}?rp=${encodeURIComponent(code)}`;

  /**
   * El contenido de la página con el enlace válido: `d` es la respuesta de
   * `promoter_link_open` y `normales`, la de `business_offers` (lo demás del
   * local). `tz`: la zona del negocio (si no, Madrid).
   */
  function cuerpo(d, normales, lang, tz) {
    const s = S(lang);
    const b = d.business || {};
    const nombre = nombreDe(d.promoter, lang);
    const negocio = b.name || '';
    const foto = d.promoter && /^https:\/\//.test(d.promoter.avatar || '') ? d.promoter.avatar : '';
    const kt = KT();
    const tarjeta = (o, extra) => `<div class="rp-oferta">${kt.tarjeta({ ...o, business_name: o.business_name || negocio }, lang, {
      tz, sinNegocio: true, href: fichaOferta(o.id, d.code, lang),
    })}${extra || ''}</div>`;
    // Sin estilos nuevos en public.css (lo cargan todas las páginas estáticas
    // con su versión): lo poco que hace falta va aquí.
    const suyas = (d.offers || []).map((o) => tarjeta(o, `<p class="rp-linea" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:10px 4px 0;font-size:14px"><span class="badge">${esc(s.promoterOffer)}</span>${lineas(o, nombre, lang).map((l) => `<span>${esc(l)}</span>`).join('')}</p>`));
    const resto = (normales || []).filter((o) => o && o.id && o.audience !== 'promoters').map((o) => tarjeta(o, ''));
    return `
  <div class="neg-id rp-cab">
    ${foto ? `<img class="neg-logo" src="${esc(foto)}" alt="" width="88" height="88" referrerpolicy="no-referrer">` : `<span class="neg-logo" aria-hidden="true">${esc(nombre.trim().charAt(0).toUpperCase() || '·')}</span>`}
    <div><h1>${esc(s.list(nombre))}</h1>
      <p class="muted"><a href="${esc(fichaNegocio(b, lang))}">${esc(negocio)}</a>${b.city ? ` · ${esc(b.city)}` : ''}${b.adults_only ? ' · +18' : ''}</p></div>
  </div>
  ${aviso(nombre, negocio, lang)}
  <p class="exclusiva rp-nota" id="rp-nota" hidden></p>
  ${suyas.length ? `<h2>${esc(s.theirs)}</h2><div class="tjs">${suyas.join('')}</div>` : ''}
  <h2>${esc(s.more(negocio))}</h2>
  ${resto.length ? `<div class="tjs">${resto.join('')}</div>` : `<p class="muted">${esc(s.none)}</p>`}`;
  }

  /** Un enlace que no vale: el motivo y, si se sabe, «Ver <negocio>». */
  function noVale(error, b, lang) {
    const s = S(lang);
    const txt = error === 'link_paused' ? s.paused : error === 'link_expired' ? s.expired
      : error === 'link_inactive' ? s.inactive : s.notFound;
    const explorar = lang === 'en' ? '/en/explore/' : '/explorar/';
    return `
  <section class="vacio">
    <h1>${esc(txt)}</h1>
    <div class="vacio-botones">${b && b.name ? `<a class="pill accent" href="${esc(fichaNegocio(b, lang))}">${esc(s.see(b.name))}</a>
      <a class="pill" href="${explorar}">${esc(s.explore)}</a>` : `<a class="pill accent" href="${explorar}">${esc(s.explore)}</a>`}</div>
  </section>`;
  }

  const KlendarRrpp = { T, codigoValido, hastaLa, nombreDe, lineas, aviso, cuerpo, noVale, fichaOferta };
  globalThis.KlendarRrpp = KlendarRrpp;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarRrpp;

  // ── En el navegador ──────────────────────────────────────────────────────
  if (typeof document === 'undefined') return;
  const yo = document.currentScript;
  const caja = document.getElementById('rp-lista');
  if (!yo || !caja) return;
  const lang = yo.dataset.lang === 'en' ? 'en' : 'es';
  const code = codigoValido(caja.dataset.code);
  const pendiente = caja.dataset.estado === 'pendiente';
  const url = yo.dataset.url;
  const key = yo.dataset.key;
  if (!code || !url || !key) return;

  function sesionGuardada(ref) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const clave = localStorage.key(i);
        if (!/^sb-[a-z0-9]+-auth-token$/.test(clave)) continue;
        if (ref && clave !== `sb-${ref}-auth-token`) continue;
        const s = JSON.parse(localStorage.getItem(clave) || 'null');
        if (s && (s.refresh_token || s.access_token)) return true;
      }
    } catch (e) { /* sin almacenamiento: como sin sesión */ }
    return false;
  }
  function carga(src, integrity) {
    return new Promise((ok, ko) => {
      const s = document.createElement('script');
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.src = src; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
  }
  /** Una función de la base sin sesión (la clave pública). */
  const sinSesion = (fn, args) => fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  }).then((r) => (r.ok ? r.json() : null));

  /** Lo que la base dice del enlace, pintado aquí (solo si el servidor no
   * pudo). */
  function pinta(d, normales) {
    if (!d || d.ok === false) {
      if (d && d.error === 'rate_limited') { error(); return; }
      caja.innerHTML = noVale(d && d.error, d && d.business, lang);
      return;
    }
    if (!KT()) { error(); return; }
    caja.innerHTML = cuerpo(d, normales || [], lang);
    caja.dataset.estado = 'ok';
  }
  function error() {
    const s = S(lang);
    caja.innerHTML = `<section class="vacio"><h1>${esc(s.oops)}</h1><div class="vacio-botones"><a class="pill accent" href="${esc(location.pathname + location.search)}">${esc(s.retry)}</a></div></section>`;
  }
  /** «Es tu enlace» / «Eres del equipo»: solo se sabe con sesión. */
  function nota(d) {
    const el = document.getElementById('rp-nota');
    if (!el || !d || d.ok !== true) return;
    const txt = d.self ? S(lang).self : d.team ? S(lang).team((d.business && d.business.name) || '') : '';
    if (!txt) return;
    el.innerHTML = `${ICONO_AVISO}<span>${esc(txt)}</span>`;
    el.hidden = false;
  }

  function sinCuenta() {
    if (!pendiente) return;
    sinSesion('promoter_link_open', { p_code: code }).then((d) => {
      if (!d || d.ok !== true) { pinta(d); return null; }
      return sinSesion('business_offers', { p_id: d.business.id }).catch(() => [])
        .then((normales) => pinta(d, Array.isArray(normales) ? normales : []));
    }).catch(error);
  }

  const env = window.KLENDAR_ENV;
  const ref = (url.match(/^https:\/\/([a-z0-9]+)\./) || [])[1];
  if (!sesionGuardada(ref)) { sinCuenta(); return; }
  // Con sesión: el mismo cliente de Supabase que el resto de la web (solo
  // ahora, que hace falta).
  (env ? Promise.resolve() : carga('/config.js?v=3'))
    .then(() => (window.supabase ? null : carga('/assets/vendor/supabase-js-2.117.2.js',
      'sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok')))
    .then(() => {
      const e = window.KLENDAR_ENV || { url, key };
      const sb = window.klendarSb || (window.klendarSb = window.supabase.createClient(e.url, e.key,
        { auth: { flowType: 'pkce', detectSessionInUrl: false } }));
      return sb.auth.getSession().then((r) => {
        if (!r.data || !r.data.session) { sinCuenta(); return null; }
        return sb.rpc('promoter_link_open', { p_code: code }).then((res) => {
          const d = res && res.data;
          if (res.error || !d) { if (pendiente) error(); return null; }
          if (pendiente) {
            if (d.ok !== true) { pinta(d); return null; }
            return sb.rpc('business_offers', { p_id: d.business.id })
              .then((x) => { pinta(d, (x && x.data) || []); nota(d); });
          }
          nota(d);
          return null;
        });
      });
    })
    .catch(() => { if (pendiente) error(); });
})();
