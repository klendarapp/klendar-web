/* Reducir las fotos en el navegador antes de subirlas, como la app.
 *
 * La app las reduce al elegirlas (image_picker + flutter_image_compress):
 * JPEG, sin agrandar nunca, con estos tamaños y calidades. Aquí se hace lo
 * mismo con un lienzo, para que una foto del móvil de 8 MB no se suba tal
 * cual desde la web:
 *
 *   KFotos.TAM.foto    lado largo 1600, calidad 82 (portada, galería,
 *                      publicaciones, novedades, fotos de la carta)
 *   KFotos.TAM.logo    lado largo 600, calidad 82
 *   KFotos.TAM.plato   lado largo 1200, calidad 82 (foto de un plato)
 *   KFotos.TAM.avatar  lado largo 800 y corto 512, calidad 85 (foto de perfil)
 *   KFotos.TAM.resena  lado largo 1600, calidad 85 (foto de una reseña)
 *
 * Respeta la orientación de la cámara (EXIF) y no copia los metadatos (GPS,
 * móvil). Deja tal cual lo que no es una foto (vídeos, PDF), los GIF y SVG, lo
 * que el navegador no sabe abrir y lo que al reducirlo pesaría más que el
 * original (menos las fotos de cámara, JPEG/HEIC, por el EXIF).
 *
 *   const f = await KFotos.reduce(archivo, KFotos.TAM.logo);  // File
 *
 * Y la miniatura de cada foto (400 px, `<id>-thumb.jpg`), antes de subirla:
 *
 *   await KFotos.subeMiniatura(ruta, f, (r, b) => sb.storage.from(BUCKET)
 *     .upload(r, b, { contentType: 'image/jpeg' }));
 */
'use strict';

(function () {
  const TAM = Object.freeze({
    foto: Object.freeze({ lado: 1600, calidad: 0.82 }),
    logo: Object.freeze({ lado: 600, calidad: 0.82 }),
    plato: Object.freeze({ lado: 1200, calidad: 0.82 }),
    avatar: Object.freeze({ lado: 800, corto: 512, calidad: 0.85 }),
    resena: Object.freeze({ lado: 1600, calidad: 0.85 }),
  });

  // Lo que se puede pasar por el lienzo sin perder nada que importe (un GIF
  // perdería la animación y un SVG dejaría de ser vectorial).
  const REDUCIBLE = /^image\/(jpe?g|png|webp|heic|heif|avif|bmp)$/i;

  /** La imagen ya girada según su EXIF, o null si no se puede abrir. */
  async function abre(archivo) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(archivo, { imageOrientation: 'from-image' }); } catch { /* sigue */ }
      try { return await createImageBitmap(archivo); } catch { /* sigue */ }
    }
    // Navegadores sin createImageBitmap para archivos: un <img> (que ya
    // aplica la orientación del EXIF).
    const url = URL.createObjectURL(archivo);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } catch { return null; } finally { URL.revokeObjectURL(url); }
  }

  async function reduce(archivo, tam = TAM.foto) {
    if (!archivo || !REDUCIBLE.test(archivo.type || '')) return archivo;
    const img = await abre(archivo);
    if (!img) return archivo;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return archivo;
    // Nunca se agranda: como mucho, el tamaño que ya tiene.
    const k = Math.min(1, tam.lado / Math.max(w, h), tam.corto ? tam.corto / Math.min(w, h) : 1);
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(w * k));
    lienzo.height = Math.max(1, Math.round(h * k));
    const ctx = lienzo.getContext('2d');
    // JPEG no tiene transparencia: lo transparente de un PNG, en blanco (si
    // no, saldría negro).
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    if (typeof img.close === 'function') img.close();
    const blob = await new Promise((ok) => {
      try { lienzo.toBlob(ok, 'image/jpeg', tam.calidad); } catch { ok(null); }
    });
    if (!blob) return archivo;
    // Reducida pesaría más (una foto ya pequeña y muy comprimida): la
    // original, salvo que sea de cámara (JPEG/HEIC), que puede llevar en el
    // EXIF dónde se hizo (GPS) y el móvil: esa pasa siempre por el lienzo,
    // que no copia los metadatos (las fotos son públicas).
    if (blob.size >= archivo.size && !/^image\/(jpe?g|heic|heif)$/i.test(archivo.type || '')) return archivo;
    const nombre = (archivo.name || 'foto').replace(/\.[^.]*$/, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg', lastModified: Date.now() });
  }

  // ── Miniaturas ────────────────────────────────────────────────────────
  // Junto a `<carpeta>/<id>.<ext>` va `<carpeta>/<id>-thumb.jpg` (400 px,
  // calidad 75), hecha aquí al subir la foto, como en la app
  // (klendar/lib/core/media/thumbnails.dart). El mapa la usa en vez de pedir
  // la miniatura a la transformación de imágenes de Supabase, que se paga
  // por foto (klendar/docs/SERVICIOS_Y_COSTES.md §12.6).
  const MINI = Object.freeze({ lado: 400, calidad: 0.75 });

  /** `b/offers/x.jpg` → `b/offers/x-thumb.jpg` (también con la URL entera). */
  function rutaMiniatura(ruta) {
    const limpia = String(ruta || '').replace(/[?#].*$/, '');
    const barra = limpia.lastIndexOf('/');
    const punto = limpia.lastIndexOf('.');
    return `${punto > barra ? limpia.slice(0, punto) : limpia}-thumb.jpg`;
  }

  /** La miniatura de una foto (Blob JPEG) o null si no es una foto que se
   *  pueda abrir aquí (vídeos, PDF, GIF, SVG…). */
  async function miniatura(archivo) {
    if (!archivo || !REDUCIBLE.test(archivo.type || '')) return null;
    const hecha = await reduce(archivo, MINI);
    return hecha && hecha !== archivo && hecha.type === 'image/jpeg' ? hecha : null;
  }

  /** Sube la miniatura de `archivo` junto a `ruta` (ANTES que la foto: el
   *  filtro de fotos la mira con ella) con `subir(ruta, blob)`. Nunca lanza:
   *  sin miniatura, quien enseña la foto usa la original. */
  async function subeMiniatura(ruta, archivo, subir) {
    try {
      const mini = await miniatura(archivo);
      if (!mini) return;
      const r = await subir(rutaMiniatura(ruta), mini);
      if (r && r.error) console.warn('miniatura:', r.error.message || r.error);
    } catch (e) {
      console.warn('miniatura:', e);
    }
  }

  window.KFotos = Object.freeze({ TAM, reduce, MINI, rutaMiniatura, miniatura, subeMiniatura });
}());
