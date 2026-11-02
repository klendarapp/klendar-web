// La cabecera de todas las páginas: si ya has entrado, «Entrar» pasa a ser tu
// inicial (o tu foto) y lleva a «Tu cuenta».
//
// No llama a nada: mira si el navegador guarda una sesión de Supabase (la
// misma que usan «Tu cuenta» y el panel). Si la sesión ha caducado, al pulsar
// «Tu cuenta» te pedirá entrar, que es lo mismo que haría el botón.
// «Tu cuenta» la vuelve a pintar al entrar o salir (window.KL_CABECERA).
(() => {
  'use strict';

  function sesion() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const clave = localStorage.key(i);
        if (!/^sb-[a-z0-9]+-auth-token$/.test(clave)) continue;
        const s = JSON.parse(localStorage.getItem(clave) || 'null');
        const u = s?.user || s?.currentSession?.user;
        if (u && (!s.expires_at || s.refresh_token)) return u;
      }
    } catch { /* sin almacenamiento: como sin sesión */ }
    return null;
  }

  function pinta() {
    // «Tu cuenta» lleva las cabeceras de los dos idiomas: puede haber dos.
    const botones = [...document.querySelectorAll('.top-entrar')];
    const usuario = sesion();
    // Lo que solo tiene sentido sin cuenta («Crear cuenta gratis»).
    document.querySelectorAll('[data-sin-sesion]').forEach((el) => { el.hidden = Boolean(usuario); });
    const meta = usuario?.user_metadata || {};
    const nombre = meta.display_name || meta.full_name || usuario?.email || '';
    const inicial = (nombre.trim().charAt(0) || '·').toUpperCase();
    const foto = meta.avatar_url || meta.picture;
    for (const boton of botones) {
      if (!boton.dataset.entrar) boton.dataset.entrar = JSON.stringify([boton.textContent, boton.getAttribute('href')]);
      if (!usuario) {
        const [texto, href] = JSON.parse(boton.dataset.entrar);
        boton.classList.remove('top-yo');
        boton.textContent = texto;
        boton.setAttribute('href', href);
        boton.removeAttribute('aria-label');
        boton.removeAttribute('title');
        continue;
      }
      boton.classList.add('top-yo');
      boton.href = boton.dataset.cuenta || '/app/';
      boton.setAttribute('aria-label', boton.dataset.cuentaTxt || 'Tu cuenta');
      boton.title = nombre;
      boton.textContent = '';
      if (foto && /^https:\/\//.test(foto)) {
        const img = document.createElement('img');
        img.src = foto; img.alt = ''; img.referrerPolicy = 'no-referrer';
        img.onerror = () => { img.remove(); boton.textContent = inicial; };
        boton.appendChild(img);
      } else {
        boton.textContent = inicial;
      }
    }
  }

  window.KL_CABECERA = () => { pinta(); campana(); justa(); };
  pinta();

  // La campana de Descubre (como la app): solo con sesión, con los avisos
  // sin leer en un globo en tinta («9+» desde 10) y, al llegar uno nuevo
  // mientras se mira, se balancea y la cifra salta (con «Reducir
  // movimiento», no). Se pregunta al entrar, cada minuto con la pestaña a la
  // vista y al volver a ella. Si la sesión ha caducado, la campana sin
  // cifra: «Tu cuenta» la renueva al entrar.
  const boton = document.querySelector('[data-campana]');
  let antes = null;
  let cuenta = null;
  function token() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const clave = localStorage.key(i);
        if (!/^sb-[a-z0-9]+-auth-token$/.test(clave)) continue;
        const s = JSON.parse(localStorage.getItem(clave) || 'null');
        const t = s?.access_token || s?.currentSession?.access_token;
        const hasta = s?.expires_at || s?.currentSession?.expires_at;
        if (t && (!hasta || hasta * 1000 > Date.now() + 5000)) return t;
      }
    } catch { /* sin almacenamiento */ }
    return null;
  }
  function conf() {
    if (window.KLENDAR_ENV) return Promise.resolve(window.KLENDAR_ENV);
    if (!conf.p) {
      conf.p = new Promise((ok) => {
        const s = document.createElement('script');
        s.src = '/config.js?v=3';
        s.onload = () => ok(window.KLENDAR_ENV || null);
        s.onerror = () => ok(null);
        document.head.appendChild(s);
      });
    }
    return conf.p;
  }
  function globo(n) {
    const g = boton.querySelector('.top-n');
    const titulo = boton.getAttribute('title') || '';
    g.hidden = !(n > 0);
    g.textContent = n > 9 ? '9+' : String(n || '');
    boton.setAttribute('aria-label', n > 0 ? (boton.dataset.n || '{n}').replace('{n}', n) : titulo);
    if (antes != null && n > antes && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      boton.classList.remove('mov-suena');
      void boton.offsetWidth;
      boton.classList.add('mov-suena');
    }
    antes = n;
  }
  function pregunta() {
    const t = token();
    if (!boton || boton.hidden || !t || document.hidden) return;
    conf().then((env) => {
      if (!env) return null;
      const sinSorteos = boton.hasAttribute('data-sin-sorteos') ? '&kind=neq.giveaway' : '';
      return fetch(`${env.url}/rest/v1/notifications?select=id&read_at=is.null${sinSorteos}`, {
        method: 'HEAD',
        headers: { apikey: env.key, Authorization: `Bearer ${t}`, Prefer: 'count=exact' },
      });
    }).then((r) => {
      if (!r || !r.ok) return;
      const n = Number(String(r.headers.get('content-range') || '').split('/')[1]);
      if (Number.isFinite(n)) globo(n);
    }).catch(() => { /* sin red: como estaba */ });
  }
  function campana() {
    if (!boton) return;
    const con = Boolean(sesion());
    boton.hidden = !con;
    if (!con) { clearInterval(cuenta); cuenta = null; antes = null; return; }
    pregunta();
    if (!cuenta) cuenta = setInterval(pregunta, 60000);
  }
  if (boton) {
    boton.addEventListener('animationend', () => boton.classList.remove('mov-suena'));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pregunta(); });
    campana();
  }

  // Si en la cabecera no cabe todo (Descubre en un móvil estrecho, con ✨, la
  // lupa y la campana), el logo se queda en el símbolo, como el nombre que
  // se encoge en la app. El nombre sigue para el lector.
  const cab = document.querySelector('header.top');
  const fila = cab && cab.querySelector('.wrap');
  function justa() {
    if (!fila || !cab.querySelector('.top-iconos')) return;
    cab.classList.remove('top-justa');
    const a = cab.querySelector('.top-acciones');
    const b = cab.querySelector('.brand');
    if (!a || !b) return;
    if (b.getBoundingClientRect().right + 8 > a.getBoundingClientRect().left || fila.scrollWidth > fila.clientWidth + 1) cab.classList.add('top-justa');
  }
  justa();
  let tJusta;
  addEventListener('resize', () => { clearTimeout(tJusta); tJusta = setTimeout(justa, 60); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(justa);

  // La pestaña activa (Descubre, Explorar, Planes, Cuenta), arriba y en la
  // barra de abajo. Las páginas dinámicas ya la traen marcada; aquí se marca
  // en las estáticas y en «Tu cuenta», que cambia de pestaña sin recargar.
  function pestanaActiva() {
    const p = location.pathname;
    if (/^\/(en\/)?(descubre|discover)\//.test(p)) return 'descubre';
    if (/^\/(en\/)?(explorar|explore|agenda|whats-on|hoy|today|coleccion|collection)\//.test(p)) return 'explorar';
    // «Planes» también mientras pide entrar para ir a Planes (#/entrar?siguiente=planes).
    if (/^\/app\//.test(p)) return /^#\/(planes|guardar)(\/|\?|$)|[?&]siguiente=planes\b/.test(location.hash) ? 'planes' : 'cuenta';
    return '';
  }
  function marcaPestana() {
    const yaMarcada = document.querySelector('[data-tab][aria-current="page"]');
    const id = pestanaActiva();
    if (yaMarcada && !/^\/app\//.test(location.pathname)) return;
    document.querySelectorAll('[data-tab]').forEach((a) => {
      if (a.dataset.tab === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  marcaPestana();
  window.addEventListener('hashchange', marcaPestana);

  // Descubre y Explorar comparten los filtros (zona, distancia, tipo,
  // categoría, precio, cuándo, orden…): las pestañas llevan los últimos que
  // se pusieron en cualquiera de las dos, hace menos de 6 h (los guarda la
  // propia página: `guardaFiltros` en functions/_lib/explore.js).
  try {
    const g = JSON.parse(localStorage.getItem('klendar.filtros') || 'null');
    if (g && Date.now() - g.t < 216e5) {
      document.querySelectorAll('a[data-tab="descubre"], a[data-tab="explorar"]').forEach((a) => {
        const href = (a.getAttribute('href') || '').split('?')[0];
        const q = g[/^\/en\//.test(href) ? 'en' : 'es'];
        if (q) a.setAttribute('href', `${href}?${q}`);
      });
    }
  } catch { /* sin almacenamiento: las pestañas, limpias */ }

  // «Saltar al contenido» va a <main id="contenido">; si el <main> de esta
  // página tiene otro nombre (o ninguno), se apunta a él.
  const main = document.querySelector('main');
  if (main) {
    if (!main.id) main.id = 'contenido';
    document.querySelectorAll('a.saltar').forEach((a) => { a.setAttribute('href', `#${main.id}`); });
  }

  // Una tabla de documento más ancha que la pantalla se desliza de lado: que
  // también se pueda con el teclado (WCAG 2.1.1).
  document.querySelectorAll('.doc table').forEach((t) => {
    if (t.scrollWidth > t.clientWidth + 1 && !t.hasAttribute('tabindex')) t.tabIndex = 0;
  });

  // Los botones que llevan a una acción de «Tu cuenta» (guardar, seguir,
  // «Voy», lista de espera, sacar un código) dejan una marca al pulsarlos:
  // así la cuenta la hace sin volver a preguntar. Un enlace que llegue de
  // fuera (un chat, otra web) no la trae y la cuenta pide confirmar antes
  // (`hayIntencion` en app/app.js).
  document.addEventListener('click', (ev) => {
    const a = ev.target instanceof Element ? ev.target.closest('a[href*="#/"]') : null;
    if (!a) return;
    let u;
    try { u = new URL(a.href, location.href); } catch { return; }
    if (u.origin !== location.origin || !/^\/(en\/)?app\/$/.test(u.pathname)) return;
    const ruta = u.hash.replace(/^#\/?/, '');
    if (!/^(guardar|seguir|voy|espera|codigo|reservar)\//.test(ruta)) return;
    try { sessionStorage.setItem('klendar.intencion', JSON.stringify({ r: ruta, t: Date.now() })); } catch { /* sin almacenamiento */ }
  }, true);

  // Movimiento (como el corazón de la app): un botón que se enciende en su
  // sitio («Seguir» → «Siguiendo», aria-pressed) late un instante. Al
  // apagarse, nada; con «Reducir movimiento», nada. Los filtros, aparte.
  if (window.MutationObserver && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    new MutationObserver((cambios) => {
      for (const c of cambios) {
        const b = c.target;
        if (!(b instanceof Element) || !b.classList.contains('pill') || c.oldValue === 'true'
          || b.getAttribute('aria-pressed') !== 'true' || b.closest('.hoja, .donde-modos, .selcat-ops')) continue;
        b.classList.remove('mov-late');
        void b.offsetWidth;
        b.classList.add('mov-late');
      }
    }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'], attributeOldValue: true });
    document.addEventListener('animationend', (e) => {
      if (e.animationName === 'mov-late' && e.target instanceof Element) e.target.classList.remove('mov-late');
    });
  }

  // Movimiento: la primera página de la sesión, el símbolo de la cabecera
  // se dibuja (el anillo se traza y la aguja da un «tic»), como la pantalla
  // de carga de la app. Una vez por sesión; con «Reducir movimiento», no.
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    if (!quieto && !sessionStorage.getItem('klendar.trazo')) {
      sessionStorage.setItem('klendar.trazo', '1');
      const sim = document.querySelector('.brand .simbolo');
      if (sim) {
        sim.classList.add('mov-traza');
        setTimeout(() => sim.classList.remove('mov-traza'), 1200);
      }
    }
  } catch { /* sin almacenamiento: sin trazo */ }

  // Las fotos que se cargan al bajar aparecen con un fundido (no de golpe).
  // Solo las perezosas: las de arriba (la más grande de la página) se pintan
  // en cuanto llegan, sin esperar a nada.
  if (!quieto) {
    document.documentElement.classList.add('mov-fotos');
    const lista = (img) => img.classList.add('mov-cargada');
    document.addEventListener('load', (e) => {
      if (e.target instanceof HTMLImageElement && e.target.loading === 'lazy') lista(e.target);
    }, true);
    document.addEventListener('error', (e) => {
      if (e.target instanceof HTMLImageElement) lista(e.target);
    }, true);
    const yaEstan = () => document.querySelectorAll('img[loading="lazy"]').forEach((i) => { if (i.complete) lista(i); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', yaEstan); else yaEstan();
  }

  // El menú del móvil se cierra con Escape y el foco vuelve a su botón.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('input#menu:checked').forEach((casilla) => {
      casilla.checked = false;
      casilla.focus();
    });
  });
})();
