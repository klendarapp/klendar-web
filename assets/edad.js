// La pregunta «¿Tienes 18 años o más?» (`[data-edad]`, con `[data-edad-si]` y
// `[data-edad-no]`): se guarda en una cookie de un año (`klendar_18`) y, con
// «18 o más», se vuelve a pedir la página. Con «No»:
//  - en la ficha +18 (`data-edad-salir="<dirección>"`, functions/_lib/views.js), a Explorar;
//  - en Explorar y Descubre (functions/_lib/explore.js), se quita el aviso y
//    se enseña lo que esperaba detrás (`[data-tras-edad]` y, si toca, la franja
//    de la ubicación: `KL_AVISO_UBIC.tras()` de /assets/filtros-guarda.js).
// Antes en línea; la CSP de scripts no lo deja (RUNBOOK §4zzz-csp).
(function(){var b=document.querySelector('[data-edad]');if(!b)return;var salir=b.getAttribute('data-edad-salir');
function f(v){document.cookie='klendar_18='+v+'; Max-Age=31536000; Path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
if(v==='1')location.reload();else if(salir)location.href=salir;else{b.remove();document.querySelectorAll('[data-tras-edad]').forEach(function(a){if(a.hasAttribute('data-cerca-aviso')&&!navigator.geolocation)return;a.hidden=false;});if(window.KL_AVISO_UBIC)window.KL_AVISO_UBIC.tras();}}
var si=b.querySelector('[data-edad-si]'),no=b.querySelector('[data-edad-no]');
if(si)si.addEventListener('click',function(){f('1');});if(no)no.addEventListener('click',function(){f('0');});})();
