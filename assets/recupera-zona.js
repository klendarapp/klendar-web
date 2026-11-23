// Partidos, grupos y sorteos: con la zona guardada en este navegador (la de
// Explorar y Descubre, menos de 6 h) y sin zona en la dirección, se vuelve a
// la misma página con ella, como en Explorar. Los enlaces de la propia página
// dejan una marca para no pisarse (`klendar.filtros.sin`, /assets/tarjetas.js).
// Sin `defer`: se va antes de pintar. Antes en línea (`recuperaZona` en
// functions/_lib/partidos.js); la CSP de scripts no lo deja (RUNBOOK §4zzz-csp).
// `centro` es el de assets/celda.js (`CENTRO_EN_LINEA`), que aquí aún no ha cargado.
(function(){try{var q=new URLSearchParams(location.search);
if(q.has('lat')||q.has('ciudad')||q.has('city'))return;var s=sessionStorage;var sin=s.getItem('klendar.filtros.sin');s.removeItem('klendar.filtros.sin');if(sin)return;
var n=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0])||{};if(n.type==='back_forward')return;
var g=JSON.parse(localStorage.getItem('klendar.filtros')||'null');if(!g||Date.now()-g.t>216e5)return;
var a=new URLSearchParams(g[/^\/en(\/|$)/.test(location.pathname)?'en':'es']||'');var z=new URLSearchParams();
var centro=function(c){var B='0123456789bcdefghjkmnpqrstuvwxyz',la=[-90,90],lo=[-180,180],p=1;if(!/^[0-9b-hjkmnp-z]{5}$/.test(c||''))return null;for(var i=0;i<c.length;i++){var n=B.indexOf(c.charAt(i));for(var b=4;b>=0;b--){var r=p?lo:la,m=(r[0]+r[1])/2;if(n>>b&1)r[0]=m;else r[1]=m;p=!p;}}return[Math.round((la[0]+la[1])*5e4)/1e5,Math.round((lo[0]+lo[1])*5e4)/1e5];};
var cc=centro(a.get('celda')||a.get('cell'));if(cc){z.set('lat',cc[0].toFixed(3));z.set('lng',cc[1].toFixed(3));if(a.get('km'))z.set('km',a.get('km'));}else if(a.get('lat')&&a.get('lng')){z.set('lat',a.get('lat'));z.set('lng',a.get('lng'));if(a.get('km'))z.set('km',a.get('km'));}else{var c=a.get('ciudad')||a.get('city');if(c)z.set(/^\/en\//.test(location.pathname)?'city':'ciudad',c);}
if(!z.toString())return;q.forEach(function(v,k){z.set(k,v);});location.replace(location.pathname+'?'+z.toString()+location.hash);}catch(x){}})();
