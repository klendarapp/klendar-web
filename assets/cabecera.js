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

  window.KL_CABECERA = pinta;
  pinta();

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

  // El menú del móvil se cierra con Escape y el foco vuelve a su botón.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('input#menu:checked').forEach((casilla) => {
      casilla.checked = false;
      casilla.focus();
    });
  });
})();
