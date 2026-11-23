// La cola virtual y «Te aviso cuando esté listo» (`/cola/<código>`, `/listo/<código>`):
// con una sesión guardada en este navegador (la clave de supabase-js del
// proyecto, `data-clave`), a la misma pantalla en «Tu cuenta» (`data-destino`).
// En el <head> y sin `defer`, para irse antes de pintar. Antes en línea
// (`saltoConSesion` en assets/cola.js y assets/listo.js); la CSP de scripts no
// lo deja (RUNBOOK §4zzz-csp).
(function(){try{var e=document.currentScript,k=e&&e.getAttribute('data-clave'),d=e&&e.getAttribute('data-destino');if(!k||!d)return;
var s=JSON.parse(localStorage.getItem(k)||'null');if(s&&(s.access_token||s.currentSession)){location.replace(d);}}catch(x){}})();
