/* Unos pocos fotogramas de un vídeo, sacados en el navegador al subirlo, para el
 * filtro de fotos y vídeos (klendar/docs/FILTRO_MEDIOS.md §4). No cuesta servidor y
 * cada fotograma gasta una imagen del tope del mes, por eso solo se suben si el
 * filtro está encendido para esta cuenta (`media_filter_on`).
 *
 *   KFotogramas.saca(archivo, n = 3)  → [Blob JPEG], al 20 %, 50 % y 80 % del vídeo;
 *                                        [] si el navegador no lo sabe abrir.
 *   KFotogramas.sube(sb, base, archivo, subir)
 *        Si el filtro está encendido, sube `<base>-frame1.jpg`, `-frame2.jpg`…
 *        con `subir(ruta, blob)`. ANTES que el vídeo: la base mira qué fotogramas
 *        tiene al llegar el vídeo y, sin ninguno, lo retiene para revisión.
 *        Nunca lanza: si falla, el vídeo queda en revisión, no se pierde.
 */
'use strict';

(function () {
  function saca(archivo, n = 3) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(archivo);
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      const blobs = [];
      let hecho = false;
      let i = 0;
      const fin = () => {
        if (hecho) return;
        hecho = true;
        clearTimeout(reloj);
        v.removeAttribute('src');
        v.load();
        URL.revokeObjectURL(url);
        resolve(blobs);
      };
      const reloj = setTimeout(fin, 20000);
      const momentos = () => Array.from({ length: n }, (_, k) => v.duration * (n === 1 ? 0.5 : 0.2 + (0.6 * k) / (n - 1)));
      v.onerror = fin;
      v.onloadedmetadata = () => {
        if (!Number.isFinite(v.duration) || v.duration <= 0) { fin(); return; }
        v.currentTime = momentos()[0];
      };
      v.onseeked = () => {
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (!w || !h) { fin(); return; }
        const k = Math.min(1, 1080 / Math.max(w, h));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(w * k);
        lienzo.height = Math.round(h * k);
        try {
          lienzo.getContext('2d').drawImage(v, 0, 0, lienzo.width, lienzo.height);
          lienzo.toBlob((b) => {
            if (b && b.size) blobs.push(b);
            i += 1;
            if (i >= n) fin();
            else v.currentTime = momentos()[i];
          }, 'image/jpeg', 0.85);
        } catch { fin(); }
      };
      v.src = url;
    });
  }

  async function sube(sb, base, archivo, subir) {
    try {
      const { data, error } = await sb.rpc('media_filter_on');
      if (error || !data) return 0;
      const fotos = await saca(archivo);
      let n = 0;
      for (const [i, blob] of fotos.entries()) {
        await subir(`${base}-frame${i + 1}.jpg`, blob);
        n += 1;
      }
      return n;
    } catch {
      return 0;
    }
  }

  globalThis.KFotogramas = { saca, sube };
})();
