/* klendar.app/admin → admin.klendar.app/admin (RUNBOOK §4zzz-admindom).
   Lo carga admin/puente.html, que functions/_middleware.js sirve en la
   dirección de antes. Dos cosas:
   1. Borra lo que dejó en este origen la sesión del admin de antes
      (`sb-<ref>-admin-auth-token` y lo suyo, `klendar.admin.*`,
      `kl_admin_*`): aquí ya no pinta nada y era lo que se quería apartar de
      las páginas públicas. La sesión de «Tu cuenta» y el panel (otra clave)
      no se toca.
   2. Salta al admin nuevo con la misma ruta, `?…` y `#/…` (el `#` no viaja
      al servidor: un 301 no lo vería). En local (tools/serve_dev.mjs),
      `admin.localhost` con el mismo puerto. */
'use strict';
(function () {
  var h = location.hostname;
  if (/^admin\./i.test(h)) return; // ya en el admin: nada que borrar
  var local = /^(localhost|127\.0\.0\.1)$/i.test(h);
  var origen = local ? location.protocol + '//admin.localhost' + (location.port ? ':' + location.port : '') : 'https://admin.klendar.app';
  var destino = origen + '/admin' + location.search + location.hash;
  var VIEJO = /^(sb-[a-z0-9]+-admin-auth-token|klendar\.admin\.|kl_admin_)/;
  [function () { return localStorage; }, function () { return sessionStorage; }].forEach(function (cual) {
    try {
      var s = cual();
      for (var i = s.length - 1; i >= 0; i--) { var k = s.key(i); if (k && VIEJO.test(k)) s.removeItem(k); }
    } catch (e) { /* sin almacenamiento */ }
  });
  var a = document.getElementById('destino');
  if (a) a.href = destino;
  location.replace(destino);
})();
