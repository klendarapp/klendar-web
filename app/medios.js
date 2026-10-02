/* Los vídeos que se suben desde «Tu cuenta» (fotos y vídeos de una reseña,
 * klendar/docs/RESENAS_MEDIOS.md), preparados en el navegador como en la app:
 *
 *   KMedios.datos(archivo)   → { duracion (s), ancho, alto, portada (Blob JPEG
 *                              o null) } o null si el navegador no lo abre.
 *                              La portada es el fotograma de las 0,1 s, a
 *                              1080 px de lado como mucho (calidad 85).
 *   KMedios.limpia(archivo)  → { blob, limpio }: el mismo vídeo sin dónde se
 *                              grabó ni con qué móvil. Sin recomprimir: las
 *                              cajas de ubicación y de modelo del MP4/MOV
 *                              (`©xyz`, `loci`, `©mak`, `©mod`, `©swr`) pasan
 *                              a ser `free` (los reproductores las saltan) y
 *                              los valores de Apple (`com.apple.quicktime.
 *                              location…`, `make`, `model`, `software`) se
 *                              borran con ceros. `limpio: false` si no se ha
 *                              podido leer el fichero (entonces se avisa).
 *
 * Las fotos van por `assets/fotos.js` (KFotos), que ya quita el EXIF.
 */
'use strict';

(function () {
  // ── Lo que dice el vídeo de sí mismo ─────────────────────────────────────
  function datos(archivo) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(archivo);
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      let hecho = false;
      const fin = (r) => {
        if (hecho) return;
        hecho = true;
        clearTimeout(reloj);
        v.removeAttribute('src');
        v.load();
        URL.revokeObjectURL(url);
        resolve(r);
      };
      const reloj = setTimeout(() => fin(v.duration > 0 ? base() : null), 15000);
      const base = () => ({
        duracion: Number.isFinite(v.duration) ? v.duration : 0,
        ancho: v.videoWidth || null,
        alto: v.videoHeight || null,
        portada: null,
      });
      v.onerror = () => fin(null);
      v.onloadedmetadata = () => {
        // Algunos MOV dicen «Infinity» hasta que se recorren: entonces, al final.
        if (!Number.isFinite(v.duration)) { v.currentTime = 1e7; return; }
        v.currentTime = Math.min(0.1, v.duration / 2);
      };
      v.onseeked = () => {
        if (!Number.isFinite(v.duration)) return;
        // Venía del final (duración desconocida): ahora, al fotograma.
        if (v.currentTime > 1) { v.currentTime = Math.min(0.1, v.duration / 2); return; }
        const r = base();
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (!w || !h) { fin(r); return; }
        const k = Math.min(1, 1080 / Math.max(w, h));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(w * k);
        lienzo.height = Math.round(h * k);
        try {
          lienzo.getContext('2d').drawImage(v, 0, 0, lienzo.width, lienzo.height);
          lienzo.toBlob((b) => { r.portada = b && b.size ? b : null; fin(r); }, 'image/jpeg', 0.85);
        } catch { fin(r); }
      };
      v.src = url;
    });
  }

  // ── Quitar dónde se grabó ────────────────────────────────────────────────
  const PRIVADAS = new Set(['©xyz', 'loci', '©mak', '©mod', '©swr']);
  // Cajas que solo contienen otras cajas (y donde puede haber metadatos).
  const CONTENEDORES = new Set(['moov', 'trak', 'mdia', 'minf', 'udta', 'edts']);
  const CLAVES_APPLE = /location|\.make$|\.model$|\.software$/i;

  const tipoDe = (u8, i) => String.fromCharCode(u8[i], u8[i + 1], u8[i + 2], u8[i + 3]);
  const libre = (u8, i) => { u8[i] = 0x66; u8[i + 1] = 0x72; u8[i + 2] = 0x65; u8[i + 3] = 0x65; }; // 'free'

  /** Las cajas entre `ini` y `fin`: [{ tipo, ini, cab, fin }]. */
  function cajas(dv, u8, ini, fin) {
    const lista = [];
    let i = ini;
    while (i + 8 <= fin) {
      let tam = dv.getUint32(i);
      let cab = 8;
      if (tam === 1) {
        if (i + 16 > fin) break;
        tam = Number(dv.getBigUint64(i + 8));
        cab = 16;
      } else if (tam === 0) {
        tam = fin - i;
      }
      if (tam < cab || i + tam > fin) break;
      lista.push({ tipo: tipoDe(u8, i + 4), ini: i, cab, fin: i + tam });
      i += tam;
    }
    return lista;
  }

  /** `meta` de QuickTime (sin versión) o de ISO (con 4 bytes de versión). */
  function limpiaMeta(dv, u8, c) {
    let ini = c.ini + c.cab;
    if (tipoDe(u8, ini + 4) !== 'hdlr' && tipoDe(u8, ini + 8) === 'hdlr') ini += 4;
    const hijos = cajas(dv, u8, ini, c.fin);
    // Las claves de Apple (mdta): qué número lleva cada una de las privadas.
    const malas = new Set();
    const keys = hijos.find((h) => h.tipo === 'keys');
    if (keys) {
      let i = keys.ini + keys.cab + 8; // versión y banderas (4) + número de claves (4)
      let n = 1;
      while (i + 8 <= keys.fin) {
        const tam = dv.getUint32(i);
        if (tam < 8 || i + tam > keys.fin) break;
        const nombre = new TextDecoder().decode(u8.subarray(i + 8, i + tam));
        if (CLAVES_APPLE.test(nombre)) malas.add(n);
        i += tam;
        n += 1;
      }
    }
    hijos.forEach((h) => {
      if (PRIVADAS.has(h.tipo)) { libre(u8, h.ini + 4); return; }
      if (h.tipo !== 'ilst') return;
      cajas(dv, u8, h.ini + h.cab, h.fin).forEach((item) => {
        if (PRIVADAS.has(item.tipo)) { libre(u8, item.ini + 4); return; }
        if (!malas.has(dv.getUint32(item.ini + 4))) return;
        cajas(dv, u8, item.ini + item.cab, item.fin).forEach((d) => {
          // 'data': tipo (4) + idioma (4) + el valor, que se borra.
          if (d.tipo === 'data') u8.fill(0, Math.min(d.fin, d.ini + d.cab + 8), d.fin);
        });
      });
    });
  }

  function recorre(dv, u8, ini, fin) {
    cajas(dv, u8, ini, fin).forEach((c) => {
      if (PRIVADAS.has(c.tipo)) libre(u8, c.ini + 4);
      else if (c.tipo === 'meta') limpiaMeta(dv, u8, c);
      else if (CONTENEDORES.has(c.tipo)) recorre(dv, u8, c.ini + c.cab, c.fin);
    });
  }

  async function limpia(archivo, tipo = archivo.type) {
    try {
      const u8 = new Uint8Array(await archivo.arrayBuffer());
      const dv = new DataView(u8.buffer);
      const arriba = cajas(dv, u8, 0, u8.length);
      if (!arriba.some((c) => c.tipo === 'moov')) return { blob: archivo, limpio: false };
      recorre(dv, u8, 0, u8.length);
      return { blob: new Blob([u8], { type: tipo }), limpio: true };
    } catch {
      return { blob: archivo, limpio: false };
    }
  }

  window.KMedios = { datos, limpia };
})();
