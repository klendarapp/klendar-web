// «Abrir en la app» (`#open`, el enlace `intent://` de Android). Va justo
// detrás del botón y sin `defer`, para que no se vea ni un momento donde no
// sirve. Antes en línea; la CSP de scripts no lo deja (RUNBOOK §4zzz-csp).
//  - Las fichas (`openInApp` en functions/_lib/public.js): fuera del botón si
//    no es Android.
//  - La página «abrir» (`data-modo="salta"`, functions/_lib/page.js): fuera de
//    Android, el botón lleva a la web (`data-web`); en el móvil, se abre solo
//    a los 400 ms.
(function () {
  var s = document.currentScript, modo = s && s.getAttribute('data-modo');
  var a = document.getElementById('open'); if (!a) return;
  var ua = navigator.userAgent || '';
  if (modo === 'salta') {
    if (!/Android/i.test(ua)) a.href = a.getAttribute('data-web');
    setTimeout(function () { if (/Android|iPhone|iPad/i.test(ua)) location.href = a.href; }, 400);
    return;
  }
  if (!/Android/i.test(ua)) a.remove();
})();
