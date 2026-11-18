// La zona aproximada de la conexión (Iván, 2026-10-28; privacidad,
// «Ubicación aproximada por la conexión», UA1). La usan Descubre y Explorar
// (`explore.js`), las guías (`guias.js`) y la caché del borde (`cache.js`,
// para no servir a nadie una página pintada con la zona de otro). En su
// propio fichero para no importarse en círculo.

/** Sin posición ni ciudad en la dirección, la ciudad y el punto que
 * Cloudflare deduce de la IP (`request.cf`), redondeado a 0,1° (unos 10 km).
 * Sin pedir permiso, sin guardarlo (ni en la dirección, ni en el navegador,
 * ni en la base) y la página que sale con él va en caché privada. Solo en
 * España (donde está Klendar) y nunca para los robots (Google debe ver la
 * página de siempre). Sin dato, `null`: «Todas las ciudades». */
export function zonaDeConexion(request) {
  const cf = request?.cf;
  if (!cf) return null;
  const ua = request.headers?.get?.('user-agent') || '';
  if (/bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram/i.test(ua)) return null;
  if (String(cf.country || '').toUpperCase() !== 'ES') return null;
  const lat = Number.parseFloat(cf.latitude);
  const lng = Number.parseFloat(cf.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const r = (x) => Math.round(x * 10) / 10;
  return { lat: r(lat), lng: r(lng) };
}
