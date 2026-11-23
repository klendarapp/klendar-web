// La fila de las tres preguntas de Explorar y Descubre mide si le caben enteras
// (como la app, `FilterSummaryRow`): si no, el «dónde» corto («5 km», «Todas») y,
// si aún no, sin iconos; lo largo se corta con «…» solo después. Justo detrás
// de la fila y sin `defer`, para que se vea ya bien; otra vez al cambiar el
// ancho y cuando llegan las letras. Mide antes del primer pintado
// (`requestAnimationFrame`), no mientras se lee la página: medir a mitad de la
// lectura tumbaba WebKit. Antes en línea (`FILA_MIDE` en functions/_lib/explore.js,
// donde se explica cada paso); la CSP de scripts no lo deja (RUNBOOK §4zzz-csp).
(function(){var b=document.getElementById('barra');if(!b)return;function corta(){return Array.prototype.some.call(b.querySelectorAll('.barra-preg .chip-t'),function(t){return t.offsetParent&&t.scrollWidth>t.clientWidth+1;});}function largos(){Array.prototype.forEach.call(b.querySelectorAll('.chip-t[data-corto]'),function(t){t.textContent=t.getAttribute('data-largo');});}function cortos(){Array.prototype.forEach.call(b.querySelectorAll('.chip-t[data-corto]'),function(t){if(t.scrollWidth>t.clientWidth+1)t.textContent=t.getAttribute('data-corto');});}function mide(){largos();b.classList.remove('fila-corta','fila-sin-iconos');var e=innerWidth<400;if(e)b.classList.add('fila-corta');if(!corta())return;b.classList.add('fila-sin-iconos');if(!e&&corta())b.classList.add('fila-corta');if(corta())cortos();}(window.requestAnimationFrame||setTimeout)(mide);window.KL_FILA=mide;var t;addEventListener('resize',function(){clearTimeout(t);t=setTimeout(mide,60);});if(document.fonts&&document.fonts.ready)document.fonts.ready.then(mide);})();
