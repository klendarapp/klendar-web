// La visita que llega desde una historia o un estado con la imagen
// (`?ref=stories` o `?ref=whatsapp`), desde el QR de la tele del local
// (`?ref=tv`) o desde el del cartel del local (`?ref=local_qr`, lo pone
// `/v/`) cuenta para el negocio (desde la página de un sorteo, para el
// negocio que lo organiza) (`log_ref_visit`, una vez por persona cada 30 min)
// y el origen se quita de la dirección, para que si vuelve a compartir el
// enlace no se cuente como historia. Sin cookies ni nada guardado.
// Supabase público en data-url y data-key. Antes en línea (`desdeHistorias`
// en functions/_lib/public.js); la CSP de scripts no lo deja (RUNBOOK §4zzz-csp).
(function(){try{var s=document.currentScript,D=(s&&s.dataset)||{};var q=new URLSearchParams(location.search);var ref=q.get('ref');if(['stories','whatsapp','tv','local_qr'].indexOf(ref)<0||navigator.webdriver)return;
var p=location.pathname.split('/').filter(Boolean);if(p[0]==='en')p.shift();
var k={o:'offer',b:'business',coleccion:'collection',collection:'collection',sorteo:'business',giveaway:'business'}[p[0]];if(!k||!p[1])return;
if(p[0]==='sorteo'||p[0]==='giveaway'){var n=document.querySelector('[data-ref-negocio]');p[1]=n&&n.getAttribute('data-ref-negocio');if(!p[1]||p.length>2)return;}
var key=D.key;
if(D.url&&key)fetch(D.url+'/rest/v1/rpc/log_ref_visit',{method:'POST',keepalive:true,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_ref:ref,p_kind:k,p_target:decodeURIComponent(p[1])})}).catch(function(){});
q.delete('ref');var r=q.toString();history.replaceState(history.state,'',location.pathname+(r?'?'+r:'')+location.hash);}catch(e){}})();
