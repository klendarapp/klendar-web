// Lo de la cabecera que depende de si has entrado, ANTES del primer pintado
// (Iván, 2026-11-04: «a veces mete un pequeño saltito» al pasar entre
// Descubre, Explorar, Planes y Cuenta).
//
// Va justo detrás de </header>, sin `defer` (es pequeño y se guarda en
// caché): «Entrar» pasa a ser tu inicial (o tu foto), la campana sale si hay
// sesión y, si no cabe todo, el logo se queda en el símbolo. Antes lo hacía
// cabecera.js con `defer`, y en «Tu cuenta» (con sus scripts al final) la
// cabecera se pintaba primero con «Entrar» y luego se movía: «Para
// negocios» y el idioma saltaban 42 px a la derecha.
//
// No llama a nada: mira si el navegador guarda una sesión de Supabase (la
// misma que usan «Tu cuenta» y el panel). cabecera.js lo vuelve a usar al
// entrar o salir y al cambiar el ancho (`window.KL_YO`).
(function () {
  'use strict';

  function sesion() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var clave = localStorage.key(i);
        if (!/^sb-[a-z0-9]+-auth-token$/.test(clave)) continue;
        var s = JSON.parse(localStorage.getItem(clave) || 'null');
        var u = s && (s.user || (s.currentSession && s.currentSession.user));
        if (u && (!s.expires_at || s.refresh_token)) return u;
      }
    } catch (e) { /* sin almacenamiento: como sin sesión */ }
    return null;
  }

  function pinta() {
    // «Tu cuenta» lleva las cabeceras de los dos idiomas: puede haber dos.
    var botones = document.querySelectorAll('.top-entrar');
    var usuario = sesion();
    // Lo que solo tiene sentido sin cuenta («Crear cuenta gratis»).
    document.querySelectorAll('[data-sin-sesion]').forEach(function (el) { el.hidden = Boolean(usuario); });
    // La campana, solo con sesión (la cifra la pone cabecera.js).
    document.querySelectorAll('[data-campana]').forEach(function (b) { b.hidden = !usuario; });
    var meta = (usuario && usuario.user_metadata) || {};
    var nombre = meta.display_name || meta.full_name || (usuario && usuario.email) || '';
    var inicial = (nombre.trim().charAt(0) || '·').toUpperCase();
    var foto = meta.avatar_url || meta.picture;
    Array.prototype.forEach.call(botones, function (boton) {
      if (!boton.dataset.entrar) boton.dataset.entrar = JSON.stringify([boton.textContent, boton.getAttribute('href')]);
      if (!usuario) {
        var antes = JSON.parse(boton.dataset.entrar);
        boton.classList.remove('top-yo');
        boton.textContent = antes[0];
        boton.setAttribute('href', antes[1]);
        boton.removeAttribute('aria-label');
        boton.removeAttribute('title');
        return;
      }
      boton.classList.add('top-yo');
      boton.href = boton.dataset.cuenta || '/app/';
      boton.setAttribute('aria-label', boton.dataset.cuentaTxt || 'Tu cuenta');
      boton.title = nombre;
      var ya = boton.querySelector('img');
      if (foto && /^https:\/\//.test(foto)) {
        if (ya && ya.getAttribute('src') === foto) return;
        boton.textContent = '';
        var img = document.createElement('img');
        img.src = foto; img.alt = ''; img.referrerPolicy = 'no-referrer';
        img.onerror = function () { img.remove(); boton.textContent = inicial; };
        boton.appendChild(img);
      } else {
        boton.textContent = inicial;
      }
    });
  }

  // Si en la cabecera no cabe todo (Descubre en un móvil estrecho, con ✨, la
  // lupa y la campana), el logo se queda en el símbolo, como el nombre que
  // se encoge en la app. El nombre sigue para el lector.
  function justa() {
    document.querySelectorAll('header.top').forEach(function (cab) {
      var fila = cab.querySelector('.wrap');
      if (!fila || !cab.querySelector('.top-iconos')) return;
      cab.classList.remove('top-justa');
      var a = cab.querySelector('.top-acciones');
      var b = cab.querySelector('.brand');
      // La cabecera escondida (la del otro idioma en «Tu cuenta») no mide.
      if (!a || !b || !fila.offsetParent) return;
      if (b.getBoundingClientRect().right + 8 > a.getBoundingClientRect().left || fila.scrollWidth > fila.clientWidth + 1) cab.classList.add('top-justa');
    });
  }

  window.KL_YO = { sesion: sesion, pinta: pinta, justa: justa };
  pinta();
  justa();
})();
