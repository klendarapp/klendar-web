// El menú ⋮ de las fichas (`masMenu` en functions/_lib/views.js): un
// `<details>` que funciona sin JavaScript; con él, se cierra al tocar fuera o
// con Escape, y el enlace a «¿Por qué ves esto?» (#…) abre su `details.por-que`.
// Antes en línea (`MENU_JS`); la CSP de scripts no lo deja (RUNBOOK §4zzz-csp).
(function(){var c=function(x){document.querySelectorAll('details.mas-menu[open]').forEach(function(d){if(!x||!d.contains(x))d.open=false;});};
document.addEventListener('click',function(e){c(e.target);});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){var d=document.querySelector('details.mas-menu[open]');c(null);if(d)d.querySelector('summary').focus();}});
document.querySelectorAll('.mas-lista a').forEach(function(a){a.addEventListener('click',function(){c(null);});});
function pq(){var d=document.getElementById(location.hash.slice(1));if(d&&d.tagName==='DETAILS'&&d.classList.contains('por-que'))d.open=true;}addEventListener('hashchange',pq);pq();})();
