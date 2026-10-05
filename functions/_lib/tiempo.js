// «Según el tiempo»: el tiempo de hoy para ordenar Descubre y Explorar.
//
// Lo pide la Pages Function (no el navegador) a la Edge Function pública
// `weather` de Supabase, que a su vez pregunta a MET Norway desde su servidor
// y guarda cada celda un rato. Aquí solo sale una posición redondeada a 0,1°
// (unos 11 × 8 km): con «Cerca de mí», la de la persona redondeada; con una
// ciudad elegida, la de la ciudad (la tabla de abajo). Si no se sabe, o la
// función no contesta a tiempo, no hay tiempo y no se reordena nada.
//
// Solo cuenta «rain» y «sun»: con «neutral» (o un fallo) la página sale como
// siempre. Los datos son de MET Norway (api.met.no, CC BY 4.0; gratis también
// para uso comercial): quien los enseña pone «Datos del tiempo: MET Norway»
// con su enlace (FUENTE_TIEMPO).

import { supabasePublic } from './page.js';

/** La atribución de los datos del tiempo (la Edge Function usa MET Norway). */
export const FUENTE_TIEMPO = { nombre: 'MET Norway', url: 'https://www.met.no/en' };

/** El centro de las ciudades más grandes y de las capitales de provincia,
 * redondeado a 0,1° (no hace falta más: la previsión va por celdas de 0,1°).
 * Una ciudad que no esté aquí sale sin tiempo. */
const CIUDADES = {
  madrid: [40.4, -3.7], barcelona: [41.4, 2.2], valencia: [39.5, -0.4], sevilla: [37.4, -6.0], zaragoza: [41.6, -0.9],
  malaga: [36.7, -4.4], murcia: [38.0, -1.1], palma: [39.6, 2.7], 'palma de mallorca': [39.6, 2.7],
  'las palmas de gran canaria': [28.1, -15.4], 'las palmas': [28.1, -15.4], bilbao: [43.3, -2.9], alicante: [38.3, -0.5],
  cordoba: [37.9, -4.8], valladolid: [41.7, -4.7], vigo: [42.2, -8.7], gijon: [43.5, -5.7], "l'hospitalet de llobregat": [41.4, 2.1],
  'a coruna': [43.4, -8.4], 'la coruna': [43.4, -8.4], 'vitoria-gasteiz': [42.8, -2.7], vitoria: [42.8, -2.7], granada: [37.2, -3.6],
  elche: [38.3, -0.7], oviedo: [43.4, -5.8], 'santa cruz de tenerife': [28.5, -16.3], pamplona: [42.8, -1.6], almeria: [36.8, -2.5],
  'san sebastian': [43.3, -2.0], donostia: [43.3, -2.0], santander: [43.5, -3.8], burgos: [42.3, -3.7],
  'castellon de la plana': [40.0, 0.0], castellon: [40.0, 0.0], albacete: [39.0, -1.9], logrono: [42.5, -2.4], badajoz: [38.9, -7.0],
  salamanca: [41.0, -5.7], huelva: [37.3, -6.9], lleida: [41.6, 0.6], tarragona: [41.1, 1.2], leon: [42.6, -5.6], cadiz: [36.5, -6.3],
  jaen: [37.8, -3.8], ourense: [42.3, -7.9], girona: [42.0, 2.8], lugo: [43.0, -7.6], caceres: [39.5, -6.4], guadalajara: [40.6, -3.2],
  toledo: [39.9, -4.0], pontevedra: [42.4, -8.6], palencia: [42.0, -4.5], 'ciudad real': [39.0, -3.9], zamora: [41.5, -5.7],
  avila: [40.7, -4.7], cuenca: [40.1, -2.1], huesca: [42.1, -0.4], segovia: [40.9, -4.1], soria: [41.8, -2.5], teruel: [40.3, -1.1],
  'santiago de compostela': [42.9, -8.5], marbella: [36.5, -4.9], 'jerez de la frontera': [36.7, -6.1], cartagena: [37.6, -1.0],
  'alcala de henares': [40.5, -3.4], mostoles: [40.3, -3.9], getafe: [40.3, -3.7], leganes: [40.3, -3.8], alcorcon: [40.3, -3.8],
  fuenlabrada: [40.3, -3.8], sabadell: [41.5, 2.1], terrassa: [41.6, 2.0], badalona: [41.5, 2.2], mataro: [41.5, 2.4], reus: [41.2, 1.1],
  ceuta: [35.9, -5.3], melilla: [35.3, -2.9], ibiza: [38.9, 1.4], eivissa: [38.9, 1.4], benidorm: [38.5, -0.1], torrevieja: [38.0, -0.7],
  'san cristobal de la laguna': [28.5, -16.3], 'la laguna': [28.5, -16.3], arona: [28.1, -16.7], 'puerto de la cruz': [28.4, -16.5],
};

const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

/** Dónde mirar el tiempo: con «Cerca de mí», la posición redondeada; con
 * una ciudad, su centro si lo sabemos; si no, null. */
export function dondeTiempo({ cerca, lat, lng, city }) {
  if (cerca && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10 };
  }
  const c = CIUDADES[plano(city)];
  return c ? { lat: c[0], lng: c[1] } : null;
}

/** 'rain' | 'sun' | null. Nunca falla: sin respuesta (o tarde), null. */
export async function tiempoDeHoy(pos) {
  if (!pos) return null;
  const { url, key } = supabasePublic();
  const q = `lat=${pos.lat.toFixed(1)}&lng=${pos.lng.toFixed(1)}`;
  try {
    const r = await fetch(`${url}/functions/v1/weather?${q}`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(2500),
      // En Cloudflare, la misma celda se reutiliza 15 min sin preguntar.
      cf: { cacheTtl: 900, cacheEverything: true },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && (d.condition === 'rain' || d.condition === 'sun') ? d.condition : null;
  } catch {
    return null;
  }
}
