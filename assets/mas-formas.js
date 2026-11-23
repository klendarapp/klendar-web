// «Más formas de explorar» (functions/_lib/explore.js): con «Tu ciudad» guardada
// en este navegador (`klendar.gustos`), cada fila de ciudades por cercanía a
// ella, y de la `data-max`-ésima en adelante ocultas. Antes en línea; la CSP
// de scripts no lo deja (RUNBOOK §4zzz-csp).
(function(){try{var e=document.currentScript,max=+(e&&e.getAttribute('data-max'))||6;var g=JSON.parse(localStorage.getItem('klendar.gustos')||'null'),h=g&&g.home;if(!h||!isFinite(+h.lat)||!isFinite(+h.lng))return;
var r=function(d){return d*Math.PI/180;},km=function(a){var la=+a.getAttribute('data-lat'),ln=+a.getAttribute('data-lng');if(!a.hasAttribute('data-lat'))return 1e9;var x=Math.sin(r(la-h.lat)/2),y=Math.sin(r(ln-h.lng)/2);return 12742*Math.asin(Math.min(1,Math.sqrt(x*x+Math.cos(r(h.lat))*Math.cos(r(la))*y*y)));};
document.querySelectorAll('[data-mf] p').forEach(function(p){var l=Array.prototype.slice.call(p.children);l.map(function(a,i){return{a:a,i:i,d:km(a)};}).sort(function(a,b){return a.d-b.d||a.i-b.i;}).forEach(function(x,i){x.a.hidden=i>=max;p.appendChild(x.a);});});}catch(x){}})();
