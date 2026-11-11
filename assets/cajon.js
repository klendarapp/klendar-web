// El menú lateral del admin y del panel en el móvil: un cajón que sale de la
// izquierda (Iván, 2026-11-11: en el iPhone el del admin no se podía cerrar).
//
// Se cierra con su X, tocando el fondo oscurecido, con Escape, al elegir una
// opción y deslizándolo hacia la izquierda. Al cerrarse, el foco vuelve al
// botón que lo abrió. Mientras está abierto, lo de detrás no se mueve ni se
// alcanza con el tabulador; al cerrarse (o al pasar al escritorio, donde el
// menú es una columna fija) todo vuelve a como estaba.
//
//   const menu = KL_CAJON({ cajon, velo, cerrar, botones: () => [...], detras: () => [...] });
//   menu.abre(); menu.cierra(); menu.abierto();
(function () {
  'use strict';
  window.KL_CAJON = function (o) {
    const cajon = o.cajon;
    const velo = o.velo;
    const movil = window.matchMedia('(max-width: 900px)');
    const botones = () => (o.botones ? o.botones() : []).filter(Boolean);
    const detras = () => (o.detras ? o.detras() : []).filter(Boolean);
    let vuelta = null;

    const abierto = () => cajon.classList.contains('open');
    const visible = (el) => el && el.isConnected && el.getClientRects().length > 0;

    function marca(abrir) {
      botones().forEach((b) => b.setAttribute('aria-expanded', String(abrir)));
    }
    function abre() {
      if (abierto()) return;
      const a = document.activeElement;
      vuelta = a && a !== document.body && !cajon.contains(a) ? a : null;
      cajon.style.transform = '';
      cajon.classList.add('open');
      if (velo) velo.classList.add('on');
      if (movil.matches) {
        document.body.classList.add('con-menu');
        detras().forEach((el) => el.setAttribute('inert', ''));
      }
      marca(true);
      const primero = (o.primero && o.primero()) || cajon.querySelector('a.nav.on') || cajon.querySelector('a.nav, a[href], button');
      if (primero) primero.focus({ preventScroll: true });
    }
    /** `sinFoco`: al pasar al escritorio o al cambiar de pantalla sin tocar el menú. */
    function cierra(sinFoco) {
      const estaba = abierto();
      cajon.classList.remove('open');
      cajon.style.transform = '';
      cajon.style.transition = '';
      if (velo) { velo.classList.remove('on'); velo.style.opacity = ''; }
      document.body.classList.remove('con-menu');
      detras().forEach((el) => el.removeAttribute('inert'));
      marca(false);
      if (!estaba) return;
      const foco = vuelta;
      vuelta = null;
      if (sinFoco) return;
      const destino = visible(foco) ? foco : botones().find(visible);
      if (destino) destino.focus({ preventScroll: true });
    }

    if (o.cerrar) o.cerrar.addEventListener('click', () => cierra());
    if (velo) velo.addEventListener('click', () => cierra());
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !abierto()) return;
      // Un diálogo abierto encima se cierra primero (lo hace el navegador).
      if (document.querySelector('dialog[open]')) return;
      cierra();
    });
    // Elegir una opción (también la pantalla en la que ya se está, que no
    // cambia la dirección y no repintaría nada): el menú se va.
    cajon.addEventListener('click', (e) => {
      const a = e.target instanceof Element && e.target.closest('a[href]');
      if (a && abierto() && movil.matches) cierra();
    });
    const alCambiar = () => { if (!movil.matches && abierto()) cierra(true); };
    if (movil.addEventListener) movil.addEventListener('change', alCambiar);
    else if (movil.addListener) movil.addListener(alCambiar);

    // Deslizar hacia la izquierda: el cajón sigue al dedo y, pasado un tercio
    // (o con un gesto rápido), se cierra; si no, vuelve a su sitio. Si el
    // gesto empieza en vertical, es el scroll de la lista y no se toca.
    let x0 = 0; let y0 = 0; let t0 = 0; let eje = null; let dx = 0;
    cajon.addEventListener('touchstart', (e) => {
      if (!abierto() || !movil.matches || e.touches.length !== 1) { eje = 'no'; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); eje = null; dx = 0;
    }, { passive: true });
    cajon.addEventListener('touchmove', (e) => {
      if (eje === 'no' || !abierto()) return;
      const mx = e.touches[0].clientX - x0;
      const my = e.touches[0].clientY - y0;
      if (eje === null) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        eje = Math.abs(mx) > Math.abs(my) ? 'x' : 'no';
        if (eje !== 'x') return;
        cajon.style.transition = 'none';
      }
      dx = Math.min(0, mx);
      cajon.style.transform = `translateX(${dx}px)`;
      if (velo) velo.style.opacity = String(Math.max(0, 1 + dx / cajon.offsetWidth));
    }, { passive: true });
    const suelta = () => {
      if (eje !== 'x') { eje = null; return; }
      eje = null;
      const rapido = dx < -30 && Date.now() - t0 < 250;
      cajon.style.transition = '';
      if (velo) velo.style.opacity = '';
      if (dx < -cajon.offsetWidth / 3 || rapido) cierra();
      else cajon.style.transform = '';
    };
    cajon.addEventListener('touchend', suelta);
    cajon.addEventListener('touchcancel', suelta);

    return { abre, cierra, abierto, alterna: () => (abierto() ? cierra() : abre()) };
  };
}());
