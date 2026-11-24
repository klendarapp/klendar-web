// Los filtros de Explorar y Descubre que se recuerdan en este navegador
// (`guardaFiltros` en functions/_lib/explore.js, con todo lo que hace). Los datos
// de la página van en `<script type="application/json" id="klFiltros">`, justo
// antes. Sin `defer`: puede volver a pedir la página con lo guardado antes de
// pintarla. Antes en línea; la CSP de scripts no lo deja (RUNBOOK §4zzz-csp).
(function(d){try{var K='klendar.filtros',X='klendar.explorar',s=sessionStorage,ls=localStorage;
var sin=s.getItem('klendar.filtros.sin');s.removeItem('klendar.filtros.sin');
var n=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0])||{};
var g=JSON.parse(ls.getItem(K)||'null');
var gu=JSON.parse(ls.getItem('klendar.gustos')||'null'),gq=gu&&Array.isArray(gu.c)?gu.c.filter(function(x){return /^[a-z0-9-]{1,40}$/.test(x);}).slice(0,5).join(','):'';
var conG=function(u){var q=new URL(u,location.href);if(gq)q.searchParams.set('gustos',gq);else q.searchParams.delete('gustos');return q.pathname+q.search+q.hash;};
var libre=!sin&&n.type!=='back_forward',vx=d.ex?JSON.parse(ls.getItem(X)||'null'):null,ex=d.ex&&libre&&!location.search&&vx&&vx[d.L]?vx[d.L]:'';
var seis=new Date();if(seis.getHours()<6)seis.setDate(seis.getDate()-1);seis.setHours(6,0,0,0);
var viejo=function(s,t){var u=new URLSearchParams(s||'');if(!(t>=seis.getTime())){var w=u.get('cuando')||u.get('when');if((w==='ahora'||w==='now')&&u.get('km')==='1'&&/^(cerca|nearest)$/.test(u.get('orden')||u.get('sort')||'')){u.delete('km');u.delete('orden');u.delete('sort');}['cuando','when','abierto','open','comer-ahora','food-now','momento','moment'].forEach(function(k){u.delete(k);});}if(!(Date.now()-t<216e5)){['lat','lng','celda','cell'].forEach(function(k){u.delete(k);});}return u.toString();};
var gq0=g&&g[d.L]?viejo(g[d.L],g.t):'';
if(d.v&&libre&&gq0){window.KLENDAR_VA=1;location.replace(conG(d.b+'?'+gq0+(d.r?'&'+d.r:'')+(ex?'&'+ex:'')+location.hash));return;}
if(ex){window.KLENDAR_VA=1;location.replace(conG(d.b+'?'+ex+location.hash));return;}
if(d.x)ls.setItem(X,JSON.stringify(d.x));
var A=d.A,t=Date.now();
if(d.vi){var Z=['ciudad','city','lat','lng','celda','cell','km','todas'],P=/^(lat|lng|celda|cell)$/,o=g||{},vp=Date.now()-(o.t||0)<216e5,f=function(L){var u=new URLSearchParams(A[L]||''),w=new URLSearchParams(o[L]||'');Z.forEach(function(k){u.delete(k);});Z.forEach(function(k){if(!vp&&P.test(k))return;w.getAll(k).forEach(function(v){u.append(k,v);});});return u.toString();};A={es:f('es'),en:f('en')};if(vp&&o.t&&/(^|&)(lat|celda|cell)=/.test(o[d.L]||''))t=o.t;}
ls.setItem(K,JSON.stringify({t:t,es:A.es,en:A.en}));
if(gq!==d.g){window.KLENDAR_VA=1;location.replace(conG(location.href));return;}
// «Cerca de mí» sola (Iván, 24-11; RUNBOOK §4zzz-ubicacion-web): en Explorar y Descubre sin zona en la dirección
// (ni ciudad, celda, punto, «Todas las ciudades», la visita de «Más planes en …» ni página), sin venir de un enlace
// de la propia página ni con «Atrás», ni a punto de ir al otro idioma (assets/cabecera.js), y solo si el navegador YA
// deja usar la ubicación (nunca se pide al cargar), se busca la posición desde ya y /assets/tarjetas.js vuelve a pedir
// la página con su celda (una vez, sin entrada nueva en el historial). Si antes se toca algo (¿Dónde?, la edad, pasar), nada.
var qz=new URLSearchParams(location.search),li=ls.getItem('klendar_lang'),dl=(document.documentElement.lang||'es').slice(0,2);
if(libre&&/^\/(en\/)?(explorar|explore|descubre|discover)$/.test(location.pathname)&&!['celda','cell','lat','lng','ciudad','city','todas','visita','visit','p'].some(function(k){return qz.has(k);})
&&!(li&&/^(es|en|ca|gl|eu|fr|de|it)$/.test(li)&&(/^(en|fr|de|it)$/.test(li)?'en':'es')!==dl)&&navigator.geolocation&&navigator.permissions&&navigator.permissions.query){
var toc=false,fu=function(){toc=true;};['pointerdown','keydown','wheel','touchmove'].forEach(function(e){addEventListener(e,fu,{capture:true,passive:true});});
window.KLENDAR_CERCA_SOLA={tocado:function(){return toc;},pos:navigator.permissions.query({name:'geolocation'}).then(function(p){if(p.state!=='granted'||toc)return null;
return new Promise(function(ok){navigator.geolocation.getCurrentPosition(function(x){ok({lat:x.coords.latitude,lng:x.coords.longitude});},function(){ok(null);},{maximumAge:3e5,timeout:1e4});});}).catch(function(){return null;})};}
}catch(x){}})((function(){try{return JSON.parse(document.getElementById('klFiltros').textContent);}catch(e){return null;}})()||{A:{es:'',en:''}});
