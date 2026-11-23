// Primera visita a la portada: si el navegador está en inglés, a /en (recordamos la elección).
// Francés, alemán e italiano también van a la inglesa; catalán, gallego y euskera, a la española
// (la web pública solo está en español e inglés; «Tu cuenta» y el panel, en los ocho idiomas).
// Va en el <head> de la portada española, sin `defer`, para irse antes de pintar
// (antes, en línea; la CSP de scripts ya no lo deja, RUNBOOK §4zzz-csp).
(function(){try{var p=location.pathname;if(p!=='/')return;var s=localStorage.getItem('klendar_lang');
if(s?/^(en|fr|de|it)$/.test(s):/^(en|fr|de|it)\b/i.test(navigator.language||'')){location.replace('/en'+location.hash);}}catch(e){}})();
