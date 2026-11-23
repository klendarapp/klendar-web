// «Compartir enlace» de las fichas (`[data-compartir]`): el menú de compartir
// del móvil o, sin él, copiar el enlace y decirlo un momento; luego se cierra
// el menú. Antes en línea (`COMPARTIR_JS` en functions/_lib/views.js); la CSP
// de scripts no lo deja (RUNBOOK §4zzz-csp).
(function(){document.querySelectorAll('[data-compartir]').forEach(function(b){b.addEventListener('click',function(){var u=b.getAttribute('data-compartir'),t=b.getAttribute('data-titulo')||document.title,d=b.closest('details');
if(navigator.share){if(d)d.open=false;navigator.share({title:t,url:u}).catch(function(){});return;}
var ok=function(){var s=b.querySelector('span'),antes=s.textContent;s.textContent=b.getAttribute('data-copiado');setTimeout(function(){s.textContent=antes;if(d&&d.open){d.open=false;d.querySelector('summary').focus();}},1600);};
if(navigator.clipboard)navigator.clipboard.writeText(u).then(ok,function(){prompt('',u);});else prompt('',u);});});})();
