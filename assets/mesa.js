// El QR de mesa (`/m/<código>`, functions/_lib/mesa.js): «Copiar» la clave
// del wifi y la visita que cuenta para el negocio (`table_qr_scan`; solo un
// navegador de verdad). Supabase público y el código, en data-url, data-key y
// data-token. Antes en línea; la CSP de scripts no lo deja (RUNBOOK §4zzz-csp).
(function(){var s=document.currentScript,D=(s&&s.dataset)||{};var b=document.querySelector('[data-copiar]');if(b)b.addEventListener('click',function(){var t=b.getAttribute('data-copiar'),h=b.getAttribute('data-hecho'),l=b.textContent;
function ok(){b.textContent=h;setTimeout(function(){b.textContent=l;},2500);}
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok,function(){});}else{var r=document.createRange();r.selectNodeContents(document.getElementById('mesa-clave'));var s=getSelection();s.removeAllRanges();s.addRange(r);try{document.execCommand('copy');ok();}catch(e){}}});
if(navigator.webdriver||!D.url||!D.key)return;try{var k=D.key;fetch(D.url+'/rest/v1/rpc/table_qr_scan',{method:'POST',keepalive:true,headers:{apikey:k,Authorization:'Bearer '+k,'Content-Type':'application/json'},body:JSON.stringify({p_token:D.token})}).catch(function(){});}catch(e){}})();
