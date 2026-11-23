// Las celdas de Explorar y Descubre (Iván, 23-11-2026; RUNBOOK §4zzz-explorar).
//
// «Cerca de mí» ya no manda tu punto: la dirección lleva la CELDA en la que
// estás (geohash de 5 letras, unos 4,9 × 3,8 km en la península) y la página
// se pinta con su centro. Así la misma página vale para todos los de esa
// celda y la caché del borde de Cloudflare la sirve en ~0,1 s
// (functions/_lib/cache.js). La distancia exacta, el radio exacto y el orden
// por cercanía los pone el navegador con tu posición (`klendar.cerca`, solo
// en este navegador y como mucho 6 h; /assets/tarjetas.js).
//
// Para que no falte nada a la distancia elegida desde cualquier punto de la
// celda, el servidor pide el radio más la mitad de la diagonal de la celda
// (`margenM`) y el navegador quita lo que, desde tu punto, queda más lejos.
//
// Sirve igual para las páginas (script clásico: deja `KlendarCelda` en
// `window`) y para las Pages Functions (`import KCe from '../../assets/celda.js'`).
(function () {
  'use strict';

  const B32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  const PRECISION = 5;
  const VALIDA = /^[0-9b-hjkmnp-z]{5}$/;

  const ok = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  /** La celda (geohash de 5) de un punto, o '' si no es un punto. */
  function de(lat, lng, precision = PRECISION) {
    const y = Number(lat);
    const x = Number(lng);
    if (!ok(y, x)) return '';
    let la = [-90, 90];
    let lo = [-180, 180];
    let par = true;
    let bit = 0;
    let n = 0;
    let s = '';
    while (s.length < precision) {
      const r = par ? lo : la;
      const v = par ? x : y;
      const m = (r[0] + r[1]) / 2;
      if (v >= m) { n = n * 2 + 1; r[0] = m; } else { n *= 2; r[1] = m; }
      par = !par;
      bit += 1;
      if (bit === 5) { s += B32[n]; bit = 0; n = 0; }
    }
    return s;
  }

  /** ¿Es una celda de las nuestras? (5 letras del alfabeto del geohash). */
  const valida = (c) => typeof c === 'string' && VALIDA.test(c);

  /** Los límites de una celda: { s, n, o, e } (sur, norte, oeste, este), o null. */
  function limites(c) {
    if (!valida(c)) return null;
    const la = [-90, 90];
    const lo = [-180, 180];
    let par = true;
    for (const ch of c) {
      const n = B32.indexOf(ch);
      for (let b = 4; b >= 0; b -= 1) {
        const r = par ? lo : la;
        const m = (r[0] + r[1]) / 2;
        if ((n >> b) & 1) r[0] = m; else r[1] = m;
        par = !par;
      }
    }
    return { s: la[0], n: la[1], o: lo[0], e: lo[1] };
  }

  /** El centro de una celda ({ lat, lng }, 5 decimales), o null. */
  function centro(c) {
    const l = limites(c);
    if (!l) return null;
    const r5 = (v) => Math.round(v * 1e5) / 1e5;
    return { lat: r5((l.s + l.n) / 2), lng: r5((l.o + l.e) / 2) };
  }

  /** Metros entre dos puntos (haversine). */
  function metros(lat1, lng1, lat2, lng2) {
    const r = Math.PI / 180;
    const x = Math.sin(((lat2 - lat1) * r) / 2);
    const y = Math.sin(((lng2 - lng1) * r) / 2);
    const h = x * x + Math.cos(lat1 * r) * Math.cos(lat2 * r) * y * y;
    return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /** Lo que hay que sumar al radio para que, desde cualquier punto de la
   * celda, no falte nada: del centro a la esquina más lejana, redondeado
   * hacia arriba a 100 m (unos 3,1 km en la península). */
  function margenM(c) {
    const l = limites(c);
    if (!l) return 0;
    const m = centro(c);
    const esquinas = [[l.s, l.o], [l.s, l.e], [l.n, l.o], [l.n, l.e]];
    const max = Math.max(...esquinas.map(([a, b]) => metros(m.lat, m.lng, a, b)));
    return Math.ceil(max / 100) * 100;
  }

  /** Cuántos de [puntos] ([[lat, lng, …], …]) quedan a [km] de [aqui] ({ lat, lng }). */
  function cuenta(puntos, aqui, km) {
    if (!Array.isArray(puntos) || !aqui) return null;
    const max = Number(km) * 1000;
    return puntos.filter((p) => Array.isArray(p) && metros(aqui.lat, aqui.lng, Number(p[0]), Number(p[1])) <= max).length;
  }

  /** Lo mismo que `centro`, en una línea, para un <script> en línea o un
   * fichero que no carga este (da [lat, lng] o null). */
   const CENTRO_EN_LINEA = "function(c){var B='0123456789bcdefghjkmnpqrstuvwxyz',la=[-90,90],lo=[-180,180],p=1;if(!/^[0-9b-hjkmnp-z]{5}$/.test(c||''))return null;for(var i=0;i<c.length;i++){var n=B.indexOf(c.charAt(i));for(var b=4;b>=0;b--){var r=p?lo:la,m=(r[0]+r[1])/2;if(n>>b&1)r[0]=m;else r[1]=m;p=!p;}}return[Math.round((la[0]+la[1])*5e4)/1e5,Math.round((lo[0]+lo[1])*5e4)/1e5];}";

  const KlendarCelda = { PRECISION, de, valida, limites, centro, margenM, metros, cuenta, CENTRO_EN_LINEA };
  globalThis.KlendarCelda = KlendarCelda;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarCelda;
})();
