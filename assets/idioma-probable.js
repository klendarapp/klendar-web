// El idioma probable de un texto, sin llamar a nadie (traducción a petición,
// Iván 2026-10-28): decide si debajo de lo que escribe un negocio sale
// «Traducir». Solo los 8 idiomas de Klendar; null si no está claro.
//
// Cuenta palabras muy frecuentes que son de un solo idioma (las que comparten
// varios, como «de», «la» o «que», no cuentan) y unas pocas letras que delatan
// uno («¿», «ß», «l·l»…). Es lo mismo que la app
// (`lib/features/translation/domain/language_guess.dart`, mismas listas):
// si se cambia una, las dos; `tools/traducir_check.mjs` y
// `test/language_guess_test.dart` prueban los mismos textos.
//
// Sin dependencias: `globalThis.KIdioma = { adivina, hayQueTraducir }`.
(() => {
  'use strict';

  const PALABRAS = {
    es: 'y los las por para sus más muy también hoy mañana noche cuando '
      + 'donde hay solo sólo precio plazas cerveza ración menú hasta desde '
      + 'ya cena viernes descuento nuestro nuestra nuestros nuestras '
      + 'ven vente aquí todo toda gran nuevo nueva nuevos nuevas cerca '
      + 'vino copa llega puedes tienes pide ahora así fiesta clases con tu '
      + 'tus libre puertas apertura socios otoño entero entera',
    ca: 'i amb els dels per és són més molt també avui demà nit quan on '
      + 'però vine aquesta aquest aquests hi només gratuït gratuïta preu '
      + 'places cervesa sopar dinar setmana dissabte diumenge divendres '
      + 'copes tapes descompte nostre nostra nostres tots totes fins des '
      + 'ara així festa nou nova vi dels pots tens',
    gl: 'e os as do da dos das cun cunha unha é ao máis moi tamén hoxe '
      + 'mañá noite cando onde hai só prezo prazas cervexa nosa noso nosos '
      + 'ata dende xa cea venres desconto aquí agora xente viño festa '
      + 'novo nova podes tes túa teu pola polo coas cos dun dunha mellor '
      + 'mellores balde',
    eu: 'eta da dira ez bat du dute dugu duzu ere baina gaur bihar gaua '
      + 'gauean arratsaldean non noiz zure gure guztiak bakoitza arte doan '
      + 'prezioa sarrera garagardoa edaria erreserba eguna asteburua '
      + 'larunbata igandea ostirala musika zuzenean izango dago daude gara '
      + 'zara hemen orain beste oso egin etorri talde taldea baino lehen '
      + 'honetan bi zuzeneko doako',
    fr: 'le les des du et une est sont au aux avec pour sur dans pas plus '
      + 'ce cette ces nous vous notre nos votre vos tous toutes chaque '
      + 'soir demain aujourd hui gratuit gratuite prix entrée bière '
      + 'boisson réservation il elle mais où quand très aussi samedi '
      + 'dimanche vendredi musique venez',
    de: 'der die das und ist ein eine einen mit für auf im den dem nicht '
      + 'zu von bei heute morgen abend jeden jede alle unser unsere euer '
      + 'kostenlos eintritt preis bier getränk reservierung wir auch nur '
      + 'oder aber wann sehr samstag sonntag freitag wochenende musik gibt '
      + 'bis uhr kommt',
    it: 'il gli della dello delle degli di è nel nella non più alla anche '
      + 'oggi domani ogni tutti tutte nostro nostra nostri vostro ingresso '
      + 'prezzo posti birra bevanda prenotazione siamo vieni ci sono ma '
      + 'dove quando molto sabato domenica venerdì settimana musica ed '
      + 'cena e',
    en: 'the and of to in for with on at is are an our your from by every '
      + 'all free today tonight night only get off this that these come '
      + 'join book now just more you we it be will drink drinks beer '
      + 'ticket tickets price weekend happy live',
  };

  // Cada palabra, con el único idioma que la usa (las de varios, fuera).
  const vistos = new Map();
  for (const [idioma, lista] of Object.entries(PALABRAS)) {
    for (const w of lista.split(' ')) {
      if (!w) continue;
      if (!vistos.has(w)) vistos.set(w, new Set());
      vistos.get(w).add(idioma);
    }
  }
  const DUENO = new Map([...vistos].filter(([, s]) => s.size === 1).map(([w, s]) => [w, [...s][0]]));

  // Letras o terminaciones que delatan un idioma (cada una, un punto).
  const MARCAS = [
    [/[¿¡]/gu, 'es'],
    [/\p{L}+ción(?!\p{L})/gu, 'es'],
    [/l·l/gu, 'ca'],
    [/\p{L}+ció(?!\p{L})/gu, 'ca'],
    [/[ßäö]/gu, 'de'],
    [/\p{L}+ung(?!\p{L})/gu, 'de'],
    [/\p{L}+zione(?!\p{L})/gu, 'it'],
    [/(?<!\p{L})(c|j|n|qu)'/gu, 'fr'],
    [/\p{L}tx\p{L}/gu, 'eu'],
    [/\p{L}{2,}(ekin|etan|eko|ako|tzera|tzeko)(?!\p{L})/gu, 'eu'],
    [/\p{L}n't(?!\p{L})|\p{L}'(s|re|ll|ve)(?!\p{L})/gu, 'en'],
  ];

  const palabras = (t) => t.toLowerCase().match(/\p{L}+/gu) || [];

  /** 'es', 'en', 'ca'… o null si no está claro: hacen falta al menos dos
   *  pistas y el doble que el siguiente. */
  function adivina(texto) {
    const bajo = String(texto || '').toLowerCase();
    const puntos = {};
    for (const w of palabras(bajo)) {
      const l = DUENO.get(w);
      if (l) puntos[l] = (puntos[l] || 0) + 1;
    }
    for (const [re, l] of MARCAS) {
      const n = (bajo.match(re) || []).length;
      if (n) puntos[l] = (puntos[l] || 0) + Math.min(n, 2);
    }
    const orden = Object.entries(puntos).sort((a, b) => b[1] - a[1]);
    if (!orden.length) return null;
    const [mejor, n] = orden[0];
    const segundo = orden.length > 1 ? orden[1][1] : 0;
    return n < 2 || n < segundo * 2 ? null : mejor;
  }

  /** Si debajo de `texto` sale «Traducir» con la página en `idioma`. Se sabe
   *  el idioma: solo si es otro. No se sabe: solo con 4 palabras o más y la
   *  página no en castellano, catalán ni gallego (casi todo se publica en
   *  castellano, que quien usa esos tres lee; con la página en otro idioma,
   *  es más probable que no lo entienda). */
  function hayQueTraducir(texto, idioma) {
    if (!String(texto || '').trim()) return false;
    const l = adivina(texto);
    if (l) return l !== idioma;
    if (['es', 'ca', 'gl'].includes(idioma)) return false;
    return palabras(String(texto)).length >= 4;
  }

  globalThis.KIdioma = { adivina, hayQueTraducir };
})();
