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

  // El menú del móvil se cierra con Escape y el foco vuelve a su botón.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('input#menu:checked').forEach((casilla) => {
      casilla.checked = false;
      casilla.focus();
    });
  });
})();
