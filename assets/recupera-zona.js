// Partidos, grupos, sorteos y las guías (sin municipio): la zona como en
// Explorar y Descubre (Iván, 25-11; RUNBOOK §4zzz-ubicacion-web2).
//
//  1. Sin zona en la dirección, la guardada en este navegador (la de Explorar
//     y Descubre, `klendar.filtros`): su celda de «Cerca de mí» (`?celda=` /
//     `?cell=`, unos 5 km; menos de 6 h) o su ciudad. Se vuelve a la misma
//     página con ella, sin entrada nueva en el historial.
//  2. Si no hay nada guardado (ni «Todas las ciudades») y el navegador YA deja
//     usar la ubicación (nunca se pide al cargar), la celda en la que estás,
//     como «Cerca de mí»: una vez y con `location.replace`. Tu punto no sale
//     del navegador ni se guarda aquí (solo la celda va en la dirección).
//     Nada si se ha tocado la página antes de tener la posición, al volver
//     con «Atrás», al recargar, si se va a pasar al otro idioma
//     (assets/cabecera.js) ni justo después de un enlace de la propia página
//     (`klendar.filtros.sin`, /assets/tarjetas.js: «Todas las ciudades»).
//
// Sin `defer`: lo guardado se recupera antes de pintar. Antes en línea
// (`recuperaZona` en functions/_lib/partidos.js); la CSP de scripts no lo
// deja (RUNBOOK §4zzz-csp). La celda es la de assets/celda.js (`de`), que
// aquí aún no ha cargado.
(function () {
  try {
    var q = new URLSearchParams(location.search);
    var P = location.pathname;
    var EN = /^\/en(\/|$)/.test(P);
    var KC = EN ? 'cell' : 'celda';
    var s = sessionStorage;
    var sin = s.getItem('klendar.filtros.sin');
    s.removeItem('klendar.filtros.sin');
    // La zona de la dirección manda (y lo que se acaba de elegir aquí).
    if (['celda', 'cell', 'lat', 'lng', 'ciudad', 'city'].some(function (k) { return q.has(k); }) || sin) return;
    var n = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
    if (n.type === 'back_forward') return;
    var VALIDA = /^[0-9b-hjkmnp-z]{5}$/;
    var de = function (y, x) {
      if (!(Math.abs(y) <= 90 && Math.abs(x) <= 180)) return '';
      var B = '0123456789bcdefghjkmnpqrstuvwxyz', la = [-90, 90], lo = [-180, 180], par = 1, b = 0, v = 0, c = '';
      while (c.length < 5) {
        var r = par ? lo : la, w = par ? x : y, m = (r[0] + r[1]) / 2;
        if (w >= m) { v = v * 2 + 1; r[0] = m; } else { v *= 2; r[1] = m; }
        par = !par;
        if (++b === 5) { c += B.charAt(v); b = 0; v = 0; }
      }
      return c;
    };
    var irA = function (z) {
      q.forEach(function (v, k) { if (!z.has(k)) z.set(k, v); });
      location.replace(P + '?' + z.toString() + location.hash);
    };

    // 1. Lo guardado: la celda (6 h, como Explorar) o la ciudad.
    var g = JSON.parse(localStorage.getItem('klendar.filtros') || 'null');
    var a = new URLSearchParams((g && g[EN ? 'en' : 'es']) || '');
    var fresco = g && Date.now() - g.t < 216e5;
    var z = new URLSearchParams();
    var cg = String(a.get('celda') || a.get('cell') || '').toLowerCase();
    var cv = de(parseFloat(a.get('lat')), parseFloat(a.get('lng')));
    var ciudad = a.get('ciudad') || a.get('city');
    if (fresco && (VALIDA.test(cg) || cv)) z.set(KC, VALIDA.test(cg) ? cg : cv);
    else if (ciudad) z.set(EN ? 'city' : 'ciudad', ciudad);
    if (z.toString()) {
      if (a.get('km') && z.has(KC)) z.set('km', a.get('km'));
      irA(z);
      return;
    }
    // «Todas las ciudades» (o una zona que ya no vale): lo elegido, sin tocar.
    if (a.has('todas') || n.type === 'reload') return;

    // 2. Con el permiso ya dado, tu celda.
    var li = localStorage.getItem('klendar_lang');
    var dl = EN ? 'en' : 'es';
    if (li && /^(es|en|ca|gl|eu|fr|de|it)$/.test(li) && (/^(en|fr|de|it)$/.test(li) ? 'en' : 'es') !== dl) return;
    if (!navigator.geolocation || !navigator.permissions || !navigator.permissions.query) return;
    var tocado = false;
    var toca = function () { tocado = true; };
    ['pointerdown', 'keydown', 'wheel', 'touchmove'].forEach(function (e) { addEventListener(e, toca, { capture: true, passive: true }); });
    navigator.permissions.query({ name: 'geolocation' }).then(function (p) {
      if (p.state !== 'granted' || tocado) return;
      navigator.geolocation.getCurrentPosition(function (x) {
        var c = de(x.coords.latitude, x.coords.longitude);
        if (!c || tocado) return;
        var u = new URLSearchParams(location.search);
        ['lat', 'lng', 'celda', 'cell', 'ciudad', 'city', 'p'].forEach(function (k) { u.delete(k); });
        u.set(KC, c);
        // Sin entrada nueva en el historial: la dirección se cambia y se
        // vuelve a pedir (con `location.replace` desde aquí, WebKit se caía),
        // con la página ya leída.
        var ve = function () {
          if (tocado) return;
          history.replaceState(history.state, '', P + '?' + u.toString() + location.hash);
          location.reload();
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(ve, 0); });
        else setTimeout(ve, 0);
      }, function () { /* sin posición: como está */ }, { maximumAge: 3e5, timeout: 1e4 });
    }).catch(function () { /* nada */ });
  } catch (x) { /* sin almacenamiento: como está */ }
})();
