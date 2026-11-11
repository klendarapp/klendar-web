/* «Rellenar desde una foto» en el panel, igual que en la app (GLOSARIO; RUNBOOK §4zg de la app).
 *
 * El dueño hace una foto a su cartel, pizarra o carta y se rellena el formulario o una lista para revisar.
 * Nunca publica ni guarda sola. La foto se reduce aquí, se manda a la Edge Function `photo-fill` y se olvida;
 * solo se sube si el dueño la usa como imagen de la publicación. Si falla, un mensaje y todo como estaba.
 *
 * Va después de panel.js y usa lo suyo (`rpc`, `sb`, `BIZ`, `modal`, `esc`, `ms`, `toast`, `I18N`, `KFotos`…).
 * Solo sale si la base dice `available`: apagado (`app_config.ai.uses.photo_fill.enabled`), nada.
 */
'use strict';

window.KFotoRellena = (() => {
  const t = (s) => I18N.t(s);
  const TAM_OFERTA = { lado: 1600, calidad: 0.8 };
  const TAM_CARTA = { lado: 2000, calidad: 0.8 };
  const PARAN = new Set(['off', 'forbidden', 'cap', 'daily', 'person', 'offline', 'no_consent']);

  class ErrorFoto extends Error {
    constructor(code) { super(code); this.code = code; }
  }

  const MENSAJES = {
    nothing: 'No vemos ningún cartel ni oferta en esta foto. Prueba con otra más cerca o escríbelo a mano.',
    offline: 'Sin conexión no se puede leer la foto. Escríbelo a mano: lo que tenías sigue aquí.',
    cap: 'Este mes no se pueden leer más fotos. Escríbelo a mano: lo que tenías sigue aquí.',
    daily: 'Hoy ya se han leído todas las fotos que se puede. Mañana, más. Mientras, a mano: lo que tenías sigue aquí.',
    off: 'Ahora no se pueden leer fotos. Escríbelo a mano: lo que tenías sigue aquí.',
    bad_image: 'No hemos podido abrir esa foto. Prueba con otra o escríbelo a mano.',
    failed: 'No hemos podido leer la foto. Prueba otra vez o escríbelo a mano: lo que tenías sigue aquí.',
  };
  MENSAJES.person = MENSAJES.daily;
  MENSAJES.forbidden = MENSAJES.off;
  MENSAJES.no_consent = MENSAJES.off;
  const mensaje = (code) => t(MENSAJES[code] || MENSAJES.failed);

  const estado = async () => {
    try { return await rpc('photo_fill_status', { p_business: BIZ.id }); } catch { return null; }
  };

  // El permiso, antes de mandar nada: una casilla clara, sin marcar. Sin ella, a mano como siempre.
  const permiso = async (st) => {
    if (st.consent) return true;
    const r = await modal({
      title: t('¿Leemos tu foto con IA?'),
      intro: `${esc(t('Para rellenarlo, la foto que elijas se envía a Claude, la IA de Anthropic, una empresa de Estados Unidos, que lee lo que pone y nos lo devuelve. Klendar no guarda la foto ni lo leído, salvo que la uses como imagen de tu publicación. Anthropic no lo usa para entrenar su IA y lo borra en 30 días; lo que sus sistemas marquen como grave puede guardarlo hasta 2 años. Procura que no salgan personas ni datos personales. Sin esto, escribes a mano como siempre, y puedes cambiarlo en Ajustes.'))}
        <a class="link" href="/privacidad" target="_blank" rel="noopener">${esc(t('Más información'))}</a>`,
      html: `<label class="f foto-permiso"><input type="checkbox" name="foto_permiso" required><span>${esc(t('Acepto que mis fotos se envíen a Claude (Anthropic, Estados Unidos) para leerlas'))}</span></label>`,
      submit: t('Continuar'),
      cancel: t('Ahora no, lo escribo a mano'),
    });
    if (!r) return false;
    try {
      await rpc('set_ai_consent', { p_granted: true, p_use: 'photo_fill' });
      st.consent = true;
      return true;
    } catch (e) {
      toast(friendly(e.message), true);
      return false;
    }
  };

  // Reducir aquí: JPEG sin metadatos. Lo que el navegador no sabe abrir (un HEIC en Chrome) se queda como está y no vale.
  const reducir = async (file, tam) => {
    const f = await KFotos.reduce(file, tam);
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 5 * 1024 * 1024) throw new ErrorFoto('bad_image');
    return f;
  };
  const aB64 = (blob) => new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => ko(new ErrorFoto('bad_image'));
    r.readAsDataURL(blob);
  });
  const leer = async (tipo, file) => {
    if (navigator.onLine === false) throw new ErrorFoto('offline');
    const image = await aB64(file);
    let res;
    try {
      res = await sb.functions.invoke('photo-fill', { body: { business_id: BIZ.id, kind: tipo, image, mime: file.type } });
    } catch { throw new ErrorFoto('offline'); }
    if (res.error) throw new ErrorFoto(res.error.name === 'FunctionsFetchError' ? 'offline' : 'failed');
    if (!res.data?.ok || !res.data.read) throw new ErrorFoto(res.data?.why || 'failed');
    return res.data.read;
  };

  const dinero = (c) => (c / 100).toFixed(2).replace('.', ',');
  const DUDA = () => t('Míralo bien: no se leía del todo.');
  // El ojo de «míralo», aquí mismo: la fuente de iconos del panel solo lleva los que usa.
  const OJO = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

  // ── La publicación ──────────────────────────────────────────────────────
  let reglaActual = null;

  /** La repetición que hay que crear al publicar, si la foto dice que se repite y el dueño no la ha quitado. */
  const regla = () => reglaActual;

  const horario = (r) => {
    const loc = I18N.lang === 'es' ? 'es-ES' : I18N.lang;
    const dias = [1, 2, 3, 4, 5, 6, 0].filter((d) => r.weekdays.includes(d))
      // 2024-09-01 fue domingo.
      .map((d) => new Intl.DateTimeFormat(loc, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 8, 1 + d))));
    const [h, m] = r.start_time.split(':').map(Number);
    const fin = (h * 60 + m + r.minutes) % 1440;
    return `${dias.join(', ')} · ${r.start_time}–${String(Math.floor(fin / 60)).padStart(2, '0')}:${String(fin % 60).padStart(2, '0')}`;
  };

  /**
   * La tarjeta del formulario. `api` trae lo del formulario (panel.js): campo, pon, val, tipo, ponTipo, categoria,
   * refresca, usarImagen, hayHueco.
   */
  const oferta = async (caja, api) => {
    reglaActual = null;
    if (!caja) return;
    const st = await estado();
    if (!st?.available || !caja.isConnected) return;

    const pintaTarjeta = (abierta = false) => {
      caja.innerHTML = `<div class="foto-caja">
        <button type="button" class="foto-cta" id="fotoCta"><span class="ms" aria-hidden="true">photo_camera</span>
          <span><b>${esc(t('Rellenar desde una foto'))}</b><small>${esc(t('Hazle una foto a tu cartel o pizarra y lo escribimos por ti. Tú lo revisas y publicas.'))}</small></span></button>
        <div class="foto-fuentes" id="fotoFuentes" ${abierta ? '' : 'hidden'}>
          <label class="btn sm">${esc(t('Hacer una foto'))}<input type="file" accept="image/*" capture="environment" hidden></label>
          <label class="btn sm">${esc(t('Elegir de la galería'))}<input type="file" accept="image/*" hidden></label>
        </div></div>`;
      $('#fotoCta', caja).onclick = async () => {
        if (await permiso(st)) pintaTarjeta(true);
      };
      $$('input[type=file]', caja).forEach((i) => { i.onchange = () => { if (i.files?.[0]) ejecuta(i.files[0]); }; });
    };

    const ejecuta = async (original) => {
      const cta = $('#fotoCta', caja);
      cta.disabled = true;
      cta.classList.add('mov-ocupado');
      caja.setAttribute('aria-busy', 'true');
      try {
        const file = await reducir(original, TAM_OFERTA);
        const r = await leer('offer', file);
        if (!caja.isConnected) return;
        aplica(r, file);
      } catch (e) {
        if (!caja.isConnected) return;
        // Lo escrito no se ha tocado.
        toast(mensaje(e.code), true);
        pintaTarjeta(true);
      } finally {
        caja.removeAttribute('aria-busy');
      }
    };

    const aplica = (r, file) => {
      const { campo, pon, val } = api;
      const NOMBRES = ['title', 'description', 'price', 'discount_type', 'discount_value', 'prior_price', 'start', 'end'];
      const antes = Object.fromEntries(NOMBRES.map((n) => [n, val(n)]));
      const tipoAntes = api.tipo();
      const catAntes = campo('category_id')?.value || null;
      const tituloVacio = !String(val('title')).trim();

      if (tituloVacio) {
        api.ponTipo(r.kind);
        pon('title', r.title);
      }
      if (!String(val('description')).trim()) pon('description', r.description);
      if (!String(val('price')).trim() && r.price_cents != null) pon('price', dinero(r.price_cents));
      if (!val('discount_type') && r.discount) {
        pon('discount_type', r.discount.type);
        pon('discount_value', r.discount.value);
        if (r.prior_price_cents != null) pon('prior_price', dinero(r.prior_price_cents));
      }
      if (r.start) {
        pon('start', r.start);
        if (r.end) pon('end', r.end);
        else if (api.tipo() === 'flash_offer') pon('end', toLocalInput(new Date(new Date(fromLocalInput(r.start)).getTime() + 3 * 36e5).toISOString()));
        else pon('end', '');
      }
      if (!catAntes && r.category_id) api.categoria(r.category_id);
      reglaActual = r.repeat || null;

      // Lo dudoso, debajo de su campo.
      const marcas = [];
      const marca = (el, texto) => {
        if (!el) return;
        const p = document.createElement('p');
        p.className = 'foto-duda';
        p.innerHTML = `${OJO}<span>${esc(texto)}</span>`;
        el.after(p);
        marcas.push(p);
      };
      const d = new Set(r.doubts || []);
      if (d.has('title')) marca(campo('title')?.closest('label'), DUDA());
      if (d.has('description')) marca(campo('description')?.closest('label'), DUDA());
      if (d.has('when')) marca($('#cuando'), t('Mira cuándo es: en la foto no estaba claro o no lo pone.'));
      if (d.has('discount')) marca($('#descuento'), DUDA());
      if (d.has('prior_price')) {
        const rebaja = ['percent', 'fixed'].includes(val('discount_type'));
        marca($('#descuento'), rebaja && !String(val('prior_price')).trim()
          ? t('En la foto no sale el precio anterior. Si es una rebaja, la ley pide que lo pongas tú.')
          : t('El precio anterior de la foto no cuadraba y no lo hemos puesto: míralo.'));
      }
      if (d.has('price')) marca(campo('price')?.closest('label'), DUDA());
      api.refresca();

      let foto = file;
      const pintaAviso = () => {
        caja.innerHTML = `<div class="foto-caja foto-hecho" role="status">
          <p class="foto-tit">${esc(t('Rellenado desde tu foto'))}</p>
          <p class="hint">${esc(t(d.size ? 'Revísalo antes de publicar y mira bien lo marcado: no se publica nada sin ti.' : 'Revísalo antes de publicar: no se publica nada sin ti.'))}</p>
          ${r.injection ? `<p class="foto-duda">${OJO}<span>${esc(t('La foto llevaba instrucciones para una IA. No les hemos hecho caso: míralo todo bien.'))}</span></p>` : ''}
          ${r.category_name ? `<p class="hint">${esc(I18N.t(`Categoría propuesta: ${r.category_name}. Se cambia en «Más opciones».`))}</p>` : ''}
          ${r.repeat ? `<label class="opcion foto-repite"><input type="checkbox" id="fotoRepite" ${reglaActual ? 'checked' : ''}><span>${esc(t('Se repite cada semana'))}<small>${esc(horario(r.repeat))}</small></span></label>` : ''}
          <p class="foto-acciones"><button type="button" class="linkbtn" id="fotoDeshacer">${esc(t('Deshacer'))}</button>
            ${foto === null ? `<span class="hint">${esc(t('Foto añadida a la publicación'))}</span>` : (api.hayHueco() ? `<button type="button" class="linkbtn" id="fotoImagen">${esc(t('Usar la foto como imagen'))}</button>` : '')}</p></div>`;
        const repite = $('#fotoRepite', caja);
        if (repite) repite.onchange = () => { reglaActual = repite.checked ? r.repeat : null; };
        $('#fotoDeshacer', caja).onclick = () => {
          NOMBRES.forEach((n) => pon(n, antes[n]));
          api.ponTipo(tipoAntes);
          NOMBRES.forEach((n) => pon(n, antes[n]));
          api.categoria(catAntes);
          marcas.forEach((m) => m.remove());
          reglaActual = null;
          api.refresca();
          pintaTarjeta();
        };
        const imagen = $('#fotoImagen', caja);
        if (imagen) {
          imagen.onclick = async () => {
            imagen.classList.add('mov-ocupado');
            imagen.disabled = true;
            if (await api.usarImagen(foto)) foto = null;
            pintaAviso();
          };
        }
      };
      pintaAviso();
    };

    pintaTarjeta();
  };

  // ── La carta ────────────────────────────────────────────────────────────
  const clave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

  /** Añade lo leído sin quitar nada: lo de una sección que ya hay va a esa sección, y un plato que ya está no se repite. */
  const mezcla = (carta, leida) => {
    const out = (carta || []).map((s) => ({ ...s, items: [...(s.items || [])] }));
    for (const s of leida) {
      const hay = out.find((x) => clave(x.name) === clave(s.name));
      if (!hay) { out.push({ name: s.name, items: [...s.items] }); continue; }
      const nombres = new Set(hay.items.map((i) => clave(i.name)));
      hay.items.push(...s.items.filter((i) => !nombres.has(clave(i.name))));
    }
    return out;
  };

  /**
   * «Carta desde fotos»: se queda con la pantalla (`v`) hasta acabar. `alTerminar(secciones | null)`: lo revisado, para
   * añadirlo a la carta sin guardar, o null si sale sin añadir.
   */
  const carta = async (v, { st, tc, alTerminar }) => {
    if (!await permiso(st)) return;
    const maxFotos = st.max_menu_photos || 6;
    const fotos = [];
    const secs = [];
    let error = null;
    let fallidas = 0;
    let inyeccion = false;
    let comprobados = false;
    const hayAlergenos = () => secs.some((s) => s.items.some((i) => i.allergens.length));
    GUARDA = { sucia: () => v.isConnected && (fotos.length > 0 || secs.length > 0) };
    const sal = (x) => {
      GUARDA = null;
      fotos.forEach((f) => URL.revokeObjectURL(f.url));
      alTerminar(x);
    };

    const cabecera = () => `<div class="page-head"><button type="button" class="btn sm ghost" id="fotoVolver">${esc(t('← Volver'))}</button><h1>${esc(t('Carta desde fotos'))}</h1></div>`;
    const duda = (txt) => `<p class="foto-duda">${OJO}<span>${esc(txt)}</span></p>`;
    const volver = async () => {
      if (fotos.length || secs.length) {
        if (!await confirmDlg(t('¿Salir sin guardar?'), esc(t('Lo leído no se ha añadido a tu carta. Si sales, se pierde.')), { submit: t('Salir sin guardar'), danger: true })) return;
      }
      sal(null);
    };

    const pintaFotos = () => {
      v.innerHTML = `${cabecera()}
        <div class="card"><p class="muted" style="margin:0 0 10px">${esc(t('Haz una foto a cada página de tu carta. Leemos las secciones, los nombres y los precios, y tú lo revisas antes de guardar. Las fotos no se guardan.'))}</p>
          ${error ? duda(mensaje(error)) : ''}
          <div class="photos foto-fotos">${fotos.map((f, i) => `<div class="ph-item"><img src="${esc(f.url)}" alt=""><button class="rm" type="button" data-q="${i}" title="${esc(t('Quitar'))}">×</button></div>`).join('')}</div>
          ${fotos.length < maxFotos ? `<p class="foto-fuentes">
            <label class="btn sm">${esc(t('Hacer una foto'))}<input type="file" accept="image/*" capture="environment" hidden></label>
            <label class="btn sm">${esc(t('Elegir de la galería'))}<input type="file" accept="image/*" multiple hidden></label></p>` : ''}
          ${fotos.length ? `<p style="margin:12px 0 0"><button type="button" class="btn primary" id="fotoLeer">${esc(fotos.length === 1 ? t('Leer la foto') : I18N.t(`Leer ${fotos.length} fotos`))}</button></p>` : ''}
        </div>`;
      $('#fotoVolver', v).onclick = volver;
      $$('[data-q]', v).forEach((b) => { b.onclick = () => { URL.revokeObjectURL(fotos[+b.dataset.q].url); fotos.splice(+b.dataset.q, 1); pintaFotos(); }; });
      $$('input[type=file]', v).forEach((i) => {
        i.onchange = async () => {
          error = null;
          for (const elegido of [...i.files].slice(0, maxFotos - fotos.length)) {
            try {
              const file = await reducir(elegido, TAM_CARTA);
              fotos.push({ file, url: URL.createObjectURL(file) });
            } catch (e) { error = e.code || 'bad_image'; }
          }
          pintaFotos();
        };
      });
      const leerB = $('#fotoLeer', v);
      if (leerB) leerB.onclick = leerTodas;
      I18N.translate?.(v);
    };

    const anade = (leida) => {
      for (const s of leida.sections || []) {
        const nombre = s.name || t('Carta');
        let hay = secs.find((x) => clave(x.name) === clave(nombre));
        if (!hay) { hay = { name: nombre, items: [] }; secs.push(hay); }
        const nombres = new Set(hay.items.map((i) => clave(i.name)));
        for (const i of s.items || []) {
          if (nombres.has(clave(i.name))) continue;
          nombres.add(clave(i.name));
          hay.items.push({ name: i.name, description: i.description || '', price: i.price_cents == null ? '' : dinero(i.price_cents), allergens: [...(i.allergens || [])], doubt: !!i.doubt });
        }
      }
    };

    // Una a una: si una falla, las demás se leen. Con lo que para (sin red, sin tope) se revisa lo que haya.
    const leerTodas = async () => {
      fallidas = 0;
      error = null;
      let ultimo = null;
      for (let i = 0; i < fotos.length; i++) {
        v.innerHTML = `${cabecera()}<div class="card foto-leyendo" role="status"><div class="mov-cargando foto-aguja" aria-hidden="true"></div><p>${esc(I18N.t(`Leyendo la foto ${i + 1} de ${fotos.length}…`))}</p></div>`;
        I18N.translate?.(v);
        try {
          const r = await leer('menu', fotos[i].file);
          if (!v.isConnected) return;
          inyeccion = inyeccion || r.injection === true;
          anade(r);
        } catch (e) {
          if (!v.isConnected) return;
          ultimo = e.code || 'failed';
          if (PARAN.has(ultimo)) { error = ultimo; fallidas = fotos.length - i; break; }
          fallidas++;
        }
      }
      if (!secs.length) {
        error = error || ultimo || 'nothing';
        pintaFotos();
        return;
      }
      pintaRevision();
    };

    const pintaRevision = () => {
      const avisos = [];
      if (fallidas) avisos.push(duda(fallidas === 1 ? t('Una foto no se ha podido leer: lo suyo tendrás que escribirlo a mano.') : I18N.t(`${fallidas} fotos no se han podido leer: lo suyo tendrás que escribirlo a mano.`)));
      if (error) avisos.push(duda(mensaje(error)));
      if (inyeccion) avisos.push(duda(t('La foto llevaba instrucciones para una IA. No les hemos hecho caso: míralo todo bien.')));
      if (hayAlergenos()) avisos.push(duda(t('Los alérgenos son los que salen en la foto, nada más. Compruébalos con tu cocina: aquí equivocarse no es una errata.')));
      v.innerHTML = `${cabecera()}
        <p class="muted" style="margin:0 0 6px">${esc(t('Revísalo y corrige lo que haga falta. Se añade a tu carta, sin quitar lo que ya tienes, y se publica al guardarla.'))}</p>
        ${avisos.join('')}
        ${secs.map((s, si) => `<div class="card foto-sec">
          <div class="foto-fila"><label class="f"><span>${esc(t('Nombre de la sección'))}</span><input data-sec="${si}" value="${esc(s.name)}" maxlength="60"></label>
            <button type="button" class="btn sm bad ghost" data-sec-q="${si}">${esc(t('Borrar'))}</button></div>
          ${s.items.map((i, ii) => `<div class="foto-plato">
            <div class="foto-fila"><label class="f"><span>${esc(t('Nombre'))}</span><input data-i="${si}:${ii}:name" value="${esc(i.name)}" maxlength="80"></label>
              <label class="f foto-precio"><span>${esc(t('Precio (€)'))}</span><input data-i="${si}:${ii}:price" inputmode="decimal" value="${esc(i.price)}"></label>
              <button type="button" class="btn sm bad ghost" data-q-plato="${si}:${ii}">${esc(t('Borrar'))}</button></div>
            <label class="f"><span>${esc(t('Descripción (opcional)'))}</span><input data-i="${si}:${ii}:description" value="${esc(i.description)}" maxlength="200"></label>
            ${i.doubt ? duda(DUDA()) : ''}
            ${i.bad ? `<p class="err-txt">${esc(t('Revisa este precio.'))}</p>` : ''}
            ${i.allergens.length ? `<p class="foto-alergenos">${i.allergens.map((a) => `<button type="button" class="tag" data-al="${si}:${ii}:${esc(a)}" title="${esc(t('Quitar'))}">${esc(nombreAlergeno(a))} ×</button>`).join(' ')}</p>` : ''}
          </div>`).join('')}
          <p style="margin:10px 0 0"><button type="button" class="btn sm" data-mas="${si}">${esc(t(tc.add))}</button></p>
        </div>`).join('')}
        <div class="foto-fin">
          ${hayAlergenos() ? `<label class="opcion"><input type="checkbox" id="fotoAl" ${comprobados ? 'checked' : ''}><span>${esc(t('He comprobado los alérgenos'))}</span></label>` : ''}
          <button type="button" class="btn primary" id="fotoAnadir" ${(hayAlergenos() && !comprobados) || !secs.length ? 'disabled' : ''}>${esc(t('Añadir a la carta'))}</button>
        </div>`;
      $('#fotoVolver', v).onclick = volver;
      $$('[data-sec]', v).forEach((el) => { el.oninput = () => { secs[+el.dataset.sec].name = el.value; }; });
      $$('[data-i]', v).forEach((el) => {
        el.oninput = () => {
          const [si, ii, k] = el.dataset.i.split(':');
          secs[+si].items[+ii][k] = el.value;
        };
      });
      $$('[data-sec-q]', v).forEach((b) => { b.onclick = () => { secs.splice(+b.dataset.secQ, 1); pintaRevision(); }; });
      $$('[data-q-plato]', v).forEach((b) => {
        b.onclick = () => {
          const [si, ii] = b.dataset.qPlato.split(':').map(Number);
          secs[si].items.splice(ii, 1);
          pintaRevision();
        };
      });
      $$('[data-al]', v).forEach((b) => {
        b.onclick = () => {
          const [si, ii, a] = b.dataset.al.split(':');
          const it = secs[+si].items[+ii];
          it.allergens = it.allergens.filter((x) => x !== a);
          pintaRevision();
        };
      });
      $$('[data-mas]', v).forEach((b) => {
        b.onclick = () => {
          secs[+b.dataset.mas].items.push({ name: '', description: '', price: '', allergens: [], doubt: false });
          pintaRevision();
        };
      });
      const al = $('#fotoAl', v);
      if (al) al.onchange = () => { comprobados = al.checked; $('#fotoAnadir', v).disabled = !comprobados; };
      $('#fotoAnadir', v).onclick = () => {
        let mal = false;
        const salida = [];
        for (const s of secs) {
          const items = [];
          for (const i of s.items) {
            const name = i.name.trim();
            if (!name) continue;
            const crudo = String(i.price || '').trim().replace(',', '.');
            const precio = crudo === '' ? null : Number(crudo);
            i.bad = crudo !== '' && !(precio >= 0);
            mal = mal || i.bad;
            items.push({ name, description: String(i.description || '').trim() || null, price_cents: precio == null || i.bad ? null : Math.round(precio * 100), allergens: ALERGENOS.map((a) => a[0]).filter((a) => i.allergens.includes(a)), image_url: null, is_available: true });
          }
          if (items.length) salida.push({ name: s.name.trim() || t('Carta'), items });
        }
        if (mal) { pintaRevision(); return; }
        sal(salida);
      };
      I18N.translate?.(v);
    };

    pintaFotos();
  };

  return { estado, oferta, regla, carta, mezcla };
})();
