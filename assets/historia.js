// «Compartir en historias»: pinta la imagen vertical (1080 × 1920) en un
// <canvas> y la deja lista para descargar o compartir (Web Share con el
// archivo, en el móvil).
//
// Es la misma imagen que hace la app (`StoryImage`, lib/features/stories):
// 360 × 640 puntos a ×3, los cinco diseños de publicación con su color, la
// marca arriba, el QR con el enlace abajo y las franjas de arriba y de abajo
// libres para la barra y la caja de respuesta de las historias. Especificación
// común: docs/DISENOS_PUBLICACION.md §7 (repo de la app).
//
// Los datos los deja la página en #historia-datos (functions/_lib/historia.js).
// Necesita /assets/zona.js (el cuándo en la hora del sitio) y
// /assets/vendor/qrcode.js.
(function () {
  'use strict';

  const W = 360;
  const H = 640;
  const ESCALA = 3;
  const ARRIBA = 76; // la marca empieza aquí (debajo de la barra de la historia)
  const ABAJO = 92; // el texto acaba aquí (encima de la caja de respuesta)
  const TINTA = '#0A0A0A';
  const TINTA2 = '#636363';

  const datosEl = document.getElementById('historia-datos');
  const canvas = document.getElementById('historia');
  if (!datosEl || !canvas) return;
  const D = JSON.parse(datosEl.textContent);
  if (!/^#[0-9a-f]{6}$/i.test(D.accent || '')) D.accent = '#FF4D6D';
  const estado = document.getElementById('historia-estado');
  const aviso = document.getElementById('historia-aviso');
  const descargar = document.getElementById('historia-descargar');
  const compartir = document.getElementById('historia-compartir');
  const copiar = document.getElementById('historia-copiar');

  // ── Color (lo mismo que OfferStyle en la app) ─────────────────────────────
  const rgb = (hex) => {
    const h = String(hex || '#FF4D6D').replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const lum = (c) => {
    const l = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const [r, g, b] = rgb(c);
    return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b);
  };
  const contraste = (a, b) => {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const sobre = (c) => (contraste(c, TINTA) >= contraste(c, '#FFFFFF') ? TINTA : '#FFFFFF');
  const alfa = (hex, a) => {
    const [r, g, b] = rgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };

  function paleta(t, acento) {
    const on = sobre(acento);
    if (t === 'glass' || t === 'minimal') {
      return {
        panel: t === 'glass' ? 'rgba(255,255,255,0.85)' : null,
        fg: TINTA, fg2: TINTA2, pill: acento, pillFg: on,
        pillBorde: contraste(acento, '#FFFFFF') < 1.6 ? alfa(on, 0.24) : null,
        divisor: 'rgba(10,10,10,0.08)', qrBorde: 'rgba(10,10,10,0.12)', sombra: false,
      };
    }
    if (t === 'bold') {
      return {
        panel: acento, fg: on, fg2: alfa(on, 0.78), pill: on, pillFg: acento,
        divisor: alfa(on, 0.18), qrBorde: null, sombra: false,
      };
    }
    return { panel: null, fg: '#FFFFFF', fg2: 'rgba(255,255,255,0.85)', pill: acento, pillFg: on, divisor: null, qrBorde: null, sombra: true };
  }

  // ── El cuándo, en la hora del sitio («Hoy · 18:00–20:00») ─────────────────
  function cuando() {
    if (!D.start) return '';
    const KZ = window.KlendarZona;
    const loc = D.lang === 'en' ? 'en-GB' : 'es-ES';
    const tz = D.tz;
    const hm = (iso) => KZ.fmt(iso, tz, loc, { hour: '2-digit', minute: '2-digit' });
    const dia = KZ.dia(D.start, tz);
    let d;
    if (dia === KZ.hoy(tz)) d = D.t.today;
    else if (dia === KZ.hoy(tz, 1)) d = D.t.tomorrow;
    else d = KZ.fmt(D.start, tz, loc, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[.,]/g, '');
    d = d.charAt(0).toUpperCase() + d.slice(1);
    return `${d} · ${hm(D.start)}${D.end ? `–${hm(D.end)}` : ''}`;
  }

  // ── Cargar fotos (con CORS: si no, el canvas no se puede guardar) ─────────
  const esVideo = (u) => /\.(mp4|mov|webm)(\?|#|$)/i.test(u || '');
  function foto(url) {
    return new Promise((ok) => {
      if (!url) return ok(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => ok(img);
      img.onerror = () => ok(null);
      img.src = url;
    });
  }
  /** El primer fotograma de un vídeo (a medio segundo, como la app). */
  function fotograma(url) {
    return new Promise((ok) => {
      const v = document.createElement('video');
      let hecho = false;
      const fin = (x) => { if (!hecho) { hecho = true; ok(x); } };
      v.crossOrigin = 'anonymous';
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.onloadeddata = () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); } catch (e) { fin(null); } };
      v.onseeked = () => fin(v.videoWidth ? v : null);
      v.onerror = () => fin(null);
      setTimeout(() => fin(null), 8000);
      v.src = url;
    });
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────
  const ctx = canvas.getContext('2d');
  const conEspaciado = 'letterSpacing' in ctx;
  function letra(peso, tam, familia, espaciado = 0) {
    ctx.font = `${peso} ${tam}px ${familia === 'sora' ? 'Sora' : 'Manrope'}, system-ui, sans-serif`;
    if (conEspaciado) ctx.letterSpacing = `${espaciado}px`;
  }
  const ancho = (t) => ctx.measureText(t).width;

  /** Parte [texto] en líneas de como mucho [max] de ancho; la última con «…»
   * si no cabe. [cortes]: dónde más se puede partir (el enlace, tras / y -). */
  function lineas(texto, max, maxLineas, cortes) {
    const trozos = cortes
      ? String(texto).split(/(?<=[/-])/)
      : String(texto).split(/(?<= )/);
    const out = [];
    let linea = '';
    for (const t of trozos) {
      if (ancho(linea + t) <= max || !linea) {
        linea += t;
        // Una palabra que sola ya no cabe: a trozos de letras.
        while (ancho(linea.trimEnd()) > max && linea.length > 1) {
          let i = linea.length - 1;
          while (i > 1 && ancho(linea.slice(0, i)) > max) i--;
          out.push(linea.slice(0, i));
          linea = linea.slice(i);
        }
      } else {
        out.push(linea.trimEnd());
        linea = t;
      }
    }
    if (linea.trim()) out.push(linea.trimEnd());
    if (out.length > maxLineas) {
      const cortadas = out.slice(0, maxLineas);
      let u = cortadas[maxLineas - 1];
      while (u && ancho(`${u}…`) > max) u = u.slice(0, -1);
      cortadas[maxLineas - 1] = `${u.trimEnd()}…`;
      return cortadas;
    }
    return out;
  }

  function redondo(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  function cubrir(img, x, y, w, h) {
    const iw = img.videoWidth || img.naturalWidth || img.width;
    const ih = img.videoHeight || img.naturalHeight || img.height;
    const s = Math.max(w / iw, h / ih);
    const sw = w / s;
    const sh = h / s;
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
  }

  function fondo(img, acento, x = 0, y = 0, w = W, h = H) {
    if (img) return cubrir(img, x, y, w, h);
    // Sin foto: oscuro con un resplandor del color (como la app).
    const g = ctx.createRadialGradient(72, 96, 0, 72, 96, 468);
    g.addColorStop(0, alfa(acento, 0.55));
    g.addColorStop(1, '#0A0A0A');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }

  function sombraTexto(p, si) {
    if (si && p.sombra) {
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 3 * ESCALA;
      ctx.shadowOffsetY = 1 * ESCALA;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
  }

  function texto(t, x, y, color, p) {
    ctx.fillStyle = color;
    sombraTexto(p, true);
    ctx.fillText(t, x, y);
    sombraTexto(p, false);
  }

  function logo(img, nombre, x, y, d, anillo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    const b = anillo ? 3 : 1.5;
    ctx.beginPath();
    ctx.arc(x + d / 2, y + d / 2, d / 2 - b, 0, Math.PI * 2);
    ctx.fillStyle = '#F0F0F0';
    ctx.fill();
    ctx.clip();
    if (img) cubrir(img, x + b, y + b, d - 2 * b, d - 2 * b);
    else {
      letra(800, d * 0.42, 'sora');
      ctx.fillStyle = TINTA;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((nombre || '·').trim().charAt(0).toUpperCase(), x + d / 2, y + d / 2 + 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  }

  /** La marca: el símbolo de Klendar y su nombre (sobre foto, en cápsula). */
  function marca(simbolo, sobreBlanco) {
    letra(700, 16, 'sora', -0.2);
    const tw = ancho('Klendar');
    const x = 24;
    const y = ARRIBA;
    if (!sobreBlanco) {
      redondo(x, y, 6 + 22 + 8 + tw + 14, 32, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fill();
    }
    const sx = sobreBlanco ? x : x + 6;
    if (simbolo) ctx.drawImage(simbolo, sx, y + 5, 22, 22);
    ctx.fillStyle = sobreBlanco ? TINTA : '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText('Klendar', sx + 22 + 8, y + 16 + 1);
    ctx.textBaseline = 'alphabetic';
  }

  function qr(x, y, p) {
    redondo(x, y, 96, 96, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    if (p.qrBorde) {
      ctx.strokeStyle = p.qrBorde;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const q = window.qrcode(0, 'M');
    q.addData(D.link);
    q.make();
    const n = q.getModuleCount();
    const m = 80 / n;
    ctx.fillStyle = TINTA;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        // Un pelo más grande: sin rayas blancas entre módulos al escalar.
        if (q.isDark(r, c)) ctx.fillRect(x + 8 + c * m, y + 8 + r * m, m + 0.05, m + 0.05);
      }
    }
  }

  /** Lo de abajo: devuelve su alto y, con [y], lo pinta ahí. */
  function cuerpo(x, w, p, t, imgs, y) {
    const pinta = y != null;
    let cy = y || 0;
    const poster = t === 'poster';
    const negocio = D.kind === 'business';
    const quien = !!D.business && !negocio;
    const when = cuando();
    const kicker = D.eyebrow || (poster && when ? when.toUpperCase() : '');

    function filaQuien(organiza) {
      // Un sorteo: el negocio, tal cual (sin «Organiza:»).
      const principal = D.kind === 'giveaway' ? D.business
        : organiza
          ? (D.venue || D.t.organisedBy.replace('{x}', D.business))
          : (D.venue || D.business);
      const h = D.venue ? 36 : 30;
      if (pinta) {
        logo(imgs.logo, D.business, x, cy + (h - 30) / 2, 30, false);
        letra(700, 15, 'manrope');
        const l1 = lineas(principal, w - 40, 1)[0] || '';
        if (D.venue) {
          texto(l1, x + 40, cy + 15, p.fg, p);
          letra(600, 12.5, 'manrope');
          texto(lineas(D.t.organisedBy.replace('{x}', D.business), w - 40, 1)[0] || '', x + 40, cy + 31, p.fg2, p);
        } else {
          texto(l1, x + 40, cy + 20, p.fg, p);
        }
      }
      cy += h;
    }

    if (negocio) {
      if (pinta) logo(imgs.logo, D.title, x, cy, 64, true);
      cy += 64 + 14;
    } else if (quien && !poster) {
      filaQuien(false);
      cy += 12;
    }
    if (poster && kicker) {
      letra(800, 14, 'manrope', 0.6);
      const k = lineas(kicker, w - 20, 1)[0];
      const kw = ancho(k) + 20;
      if (pinta) {
        redondo(x, cy, kw, 29.5, 6);
        ctx.fillStyle = D.accent;
        ctx.fill();
        ctx.fillStyle = sobre(D.accent);
        ctx.fillText(k, x + 10, cy + 20.5);
      }
      cy += 29.5 + 12;
    }
    // Título
    const tam = poster ? 40 : t === 'photo' ? (negocio ? 32 : 30) : 26;
    const alto = tam * (poster ? 1.04 : 1.12);
    letra(t === 'minimal' ? 700 : 800, tam, 'sora', poster ? -1.2 : -0.5);
    const tl = lineas(D.title, w, poster ? 4 : 3);
    if (pinta) tl.forEach((l, i) => texto(l, x, cy + i * alto + tam * 0.86, p.fg, p));
    cy += tl.length * alto;
    if (D.subtitle) {
      cy += 8;
      letra(600, 15, 'manrope');
      const sl = lineas(D.subtitle, w, 3);
      if (pinta) sl.forEach((l, i) => texto(l, x, cy + i * 18.75 + 14, p.fg2, p));
      cy += sl.length * 18.75;
    }
    if (D.rating) {
      cy += 6;
      if (pinta) {
        letra(700, 18, 'manrope');
        texto('★', x, cy + 16, p.fg2, p);
        letra(700, 14, 'manrope');
        texto(D.rating, x + 22, cy + 15, p.fg2, p);
      }
      cy += 18;
    }
    if (poster && quien) {
      cy += 12;
      filaQuien(true);
    }
    const conCuando = !poster && when;
    if (D.benefit || conCuando) {
      cy += 14;
      letra(800, 16, 'manrope');
      const pw = D.benefit ? ancho(D.benefit) + 24 : 0;
      letra(600, 14, 'manrope');
      const ww = conCuando ? ancho(when) : 0;
      const juntos = !D.benefit || !conCuando || pw + 10 + ww <= w;
      if (pinta) {
        if (D.benefit) {
          redondo(x, cy, pw, 32, 16);
          ctx.fillStyle = p.pill;
          ctx.fill();
          if (p.pillBorde) {
            ctx.strokeStyle = p.pillBorde;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          letra(800, 16, 'manrope');
          ctx.fillStyle = p.pillFg;
          ctx.fillText(D.benefit, x + 12, cy + 21.5);
        }
        if (conCuando) {
          letra(600, 14, 'manrope');
          const wx = D.benefit && juntos ? x + pw + 10 : x;
          const wy = D.benefit && !juntos ? cy + 32 + 8 : cy;
          texto(lineas(when, w, 1)[0], wx, wy + (D.benefit ? 21 : 13), p.fg2, p);
        }
      }
      cy += D.benefit ? (juntos ? 32 : 32 + 8 + 17.5) : 17.5;
    }
    cy += 18;
    if (p.divisor) {
      if (pinta) {
        ctx.fillStyle = p.divisor;
        ctx.fillRect(x, cy, w, 1);
      }
      cy += 1 + 16;
    }
    // QR y enlace
    if (pinta) {
      qr(x, cy, p);
      letra(600, 11.5, 'manrope');
      const ll = lineas(D.display, w - 110, 3, true);
      const bloque = 20 + 4 + ll.length * 14.4;
      let ty = cy + (96 - bloque) / 2;
      letra(700, 16, 'sora');
      texto(D.t.see, x + 110, ty + 15, p.fg, p);
      ty += 24;
      letra(600, 11.5, 'manrope');
      ll.forEach((l, i) => texto(l, x + 110, ty + i * 14.4 + 11, p.fg2, p));
    }
    cy += 96;
    return cy - (y || 0);
  }

  function pinta(imgs) {
    const t = D.template;
    const p = paleta(t, D.accent);
    ctx.setTransform(ESCALA, 0, 0, ESCALA, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (t === 'minimal') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);
      marca(imgs.simbolo, true);
      const x = 24;
      const w = W - 48;
      const h = cuerpo(x, w, p, t, imgs, null);
      const y = H - ABAJO - h;
      const fotoAlto = y - 20 - 124;
      if (imgs.foto && fotoAlto > 40) {
        ctx.save();
        redondo(20, 124, W - 40, fotoAlto, 22);
        ctx.clip();
        cubrir(imgs.foto, 20, 124, W - 40, fotoAlto);
        ctx.restore();
      }
      cuerpo(x, w, p, t, imgs, y);
      return;
    }

    fondo(imgs.foto, D.accent);
    // Velo arriba, para la marca.
    let g = ctx.createLinearGradient(0, 0, 0, 180);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 180);
    if (t === 'photo' || t === 'poster') {
      const alto = H * (t === 'poster' ? 0.7 : 0.6);
      g = ctx.createLinearGradient(0, H - alto, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.45, t === 'poster' ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.5)');
      g.addColorStop(1, t === 'poster' ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.8)');
      ctx.fillStyle = g;
      ctx.fillRect(0, H - alto, W, alto);
    }
    marca(imgs.simbolo, false);

    if (!p.panel) {
      const x = 24;
      const w = W - 48;
      const h = cuerpo(x, w, p, t, imgs, null);
      cuerpo(x, w, p, t, imgs, H - ABAJO - h);
      return;
    }
    // Panel (Clásica: cristal esmerilado; Color: macizo del acento).
    const px = 16;
    const pw = W - 32;
    const h = cuerpo(px + 20, pw - 40, p, t, imgs, null) + 40;
    const py = H - ABAJO - h;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 30 * ESCALA;
    ctx.shadowOffsetY = 12 * ESCALA;
    redondo(px, py, pw, h, 28);
    ctx.fillStyle = t === 'glass' ? '#FFFFFF' : p.panel;
    ctx.fill();
    ctx.restore();
    if (t === 'glass' && imgs.foto && 'filter' in ctx) {
      ctx.save();
      redondo(px, py, pw, h, 28);
      ctx.clip();
      ctx.filter = `blur(${20 * ESCALA}px)`;
      fondo(imgs.foto, D.accent);
      ctx.filter = 'none';
      ctx.restore();
    }
    redondo(px, py, pw, h, 28);
    ctx.fillStyle = p.panel;
    ctx.fill();
    cuerpo(px + 20, pw - 40, p, t, imgs, py + 20);
  }

  // ── Arranque ──────────────────────────────────────────────────────────────
  let blob = null;
  const archivo = descargar ? descargar.getAttribute('download') : 'klendar.png';

  async function prepara() {
    try {
      await Promise.all([
        '800 40px Sora', '700 16px Sora', '600 14px Manrope', '700 15px Manrope', '800 16px Manrope',
      ].map((f) => (document.fonts ? document.fonts.load(f) : null)));
    } catch (e) { /* con la letra del sistema */ }
    const [principal, logoImg, simbolo] = await Promise.all([
      D.media ? (esVideo(D.media) ? fotograma(D.media) : foto(D.media)) : null,
      foto(D.logo),
      foto('/assets/symbol.png'),
    ]);
    let fotoImg = principal;
    if (!fotoImg && D.fallback && D.fallback !== D.media) fotoImg = await foto(D.fallback);
    pinta({ foto: fotoImg, logo: logoImg, simbolo });
    canvas.toBlob((b) => {
      if (!b) {
        if (estado) estado.textContent = D.t.failed;
        return;
      }
      blob = b;
      if (estado) estado.textContent = '';
      if (descargar) {
        descargar.href = URL.createObjectURL(b);
        descargar.removeAttribute('aria-disabled');
      }
      if (compartir && navigator.canShare) {
        const f = new File([b], archivo, { type: 'image/png' });
        if (navigator.canShare({ files: [f] })) {
          compartir.hidden = false;
          compartir.disabled = false;
        }
      }
    }, 'image/png');
  }

  async function copia() {
    try {
      await navigator.clipboard.writeText(D.link);
      if (aviso) aviso.textContent = D.t.copied;
      return true;
    } catch (e) {
      return false;
    }
  }

  if (compartir) {
    compartir.addEventListener('click', async () => {
      if (!blob) return;
      // El enlace, copiado: en Instagram se pega con el sticker «Enlace».
      await copia();
      try {
        await navigator.share({ files: [new File([blob], archivo, { type: 'image/png' })], title: D.title, text: D.link });
      } catch (e) { /* cancelado */ }
    });
  }
  if (descargar) descargar.addEventListener('click', () => { copia(); });
  if (copiar) copiar.addEventListener('click', () => { copia(); });

  prepara().catch(() => { if (estado) estado.textContent = D.t.failed; });
})();
