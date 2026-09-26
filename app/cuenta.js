/* «Tu cuenta»: lo de la cuenta.
 *
 * Avisos (la bandeja de la campana), «Avísame si…», ajustes (perfil,
 * notificaciones, privacidad, sesión y borrar la cuenta), sugerencias,
 * reseñas y denuncias. Igual que en la app y contra las mismas funciones.
 *
 * Va después de app.js y usa lo suyo: `RUTAS`, `llamar`, `pinta`, `t`,
 * `esc`, `YO`, `sb`, `hecho`…
 */
'use strict';

Object.assign(ERRORES, {
  too_young: 'Para usar Klendar hay que tener 14 años o más.',
  birth_date_required: 'Pon tu fecha de nacimiento.',
  invalid_birth_date: 'Esa fecha de nacimiento no es válida.',
  auth_required: 'Tienes que entrar en tu cuenta.',
  too_many_alerts: 'Has llegado al máximo de 10 avisos. Borra alguno para crear otro.',
  message_too_short: 'Cuéntanos un poco más (5 letras como mínimo).',
  invalid_rating: 'Elige de una a cinco estrellas.',
  'Payload too large': 'La foto pesa demasiado. Prueba con otra más pequeña.',
  'mime type': 'Ese archivo no es una foto. Prueba con una JPG o PNG.',
});

/** Consulta a una tabla con el mismo trato de errores que `llamar`. */
async function tabla(consulta) {
  const { data, error } = await consulta;
  if (error) throw Object.assign(new Error(amable(error.message)), { clave: error.message });
  return data;
}

const distancia = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toLocaleString(LOC, { maximumFractionDigits: 1 })} km`);

let CATEGORIAS = null;
async function categorias() {
  if (!CATEGORIAS) {
    CATEGORIAS = await tabla(sb.from('categories').select('id, slug, names, position').order('position'));
  }
  return CATEGORIAS;
}
const nombreCat = (c) => (c.names && (c.names[EN ? 'en' : 'es'] || c.names.es)) || c.slug;

/** Reduce la foto en el navegador antes de subirla (menos datos, menos
 * espera) y la sube a la carpeta de la persona. Devuelve la URL pública. */
async function subeFoto(carpeta, archivo, lado = 1600) {
  if (!archivo) return null;
  if (archivo.size > 20 * 1024 * 1024) throw new Error(t('La foto pesa demasiado. Prueba con otra más pequeña.'));
  let bmp;
  try { bmp = await createImageBitmap(archivo); } catch {
    throw new Error(t('Esa imagen no se puede abrir. Prueba con una foto JPG o PNG.'));
  }
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(bmp.width * k);
  lienzo.height = Math.round(bmp.height * k);
  lienzo.getContext('2d').drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.85));
  const ruta = `${carpeta}/${YO.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from('business-images').upload(ruta, blob, { contentType: 'image/jpeg' });
  if (error) throw Object.assign(new Error(amable(error.message)), { clave: error.message });
  return sb.storage.from('business-images').getPublicUrl(ruta).data.publicUrl;
}

/** Un botón que se bloquea mientras trabaja, para no mandar dos veces. */
async function ocupado(boton, trabajo) {
  if (boton.disabled) return;
  const antes = boton.textContent;
  boton.disabled = true;
  boton.textContent = t('Un momento…');
  try { await trabajo(); } catch (e) { toast(e.message || amable(''), true); } finally {
    if (boton.isConnected) { boton.disabled = false; boton.textContent = antes; }
  }
}

// ── Avisos ────────────────────────────────────────────────────────────────
/** Las rutas de la app, llevadas a la web. */
function destinoWeb(ruta) {
  const r = String(ruta || '');
  let m;
  if ((m = r.match(/^\/offer\/([0-9a-f-]{36})/i))) return `${pre}/o/${m[1]}`;
  if ((m = r.match(/^\/business\/([0-9a-f-]{36})\?review=1/i))) return `#/opinar/${m[1]}`;
  if ((m = r.match(/^\/business\/([0-9a-f-]{36})/i))) return `${pre}/b/${m[1]}`;
  // «Tu oferta termina en 1 h»: al panel, con la pregunta de ampliarla hecha.
  if ((m = r.match(/^\/my-business\/([0-9a-f-]{36})\?extend=([0-9a-f-]{36})/i))) {
    return `/panel/#/publicaciones?biz=${m[1]}&extend=${m[2]}`;
  }
  if (r.startsWith('/my-business')) return '/panel/';
  if (r.startsWith('/profile')) return '#/ajustes';
  return '';
}

async function sinLeer() {
  if (!YO) return 0;
  const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  return count || 0;
}

RUTAS.notificaciones = async () => {
  if (!exigeSesion('notificaciones')) return;
  const lista = await tabla(sb.from('notifications')
    .select('id, kind, title, body, route, read_at, created_at')
    .order('created_at', { ascending: false }).limit(50));
  const nuevos = lista.filter((n) => !n.read_at).length;
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Notificaciones'))}</h1>
    <p class="acciones">
      ${nuevos ? `<button class="pill" id="leidos">${esc(t('Marcar todo como leído'))}</button>` : ''}
      <a class="pill ghost" href="#/ajustes">${esc(t('Qué notificaciones recibo'))}</a>
    </p>
    ${lista.length ? `<div class="avisos">${lista.map((n) => {
      const destino = destinoWeb(n.route);
      return `<a class="aviso${n.read_at ? '' : ' nuevo'}" href="${esc(destino || '#/notificaciones')}" data-id="${esc(n.id)}">
        <b>${esc(n.title)}</b>
        ${n.body ? `<span>${esc(n.body)}</span>` : ''}
        <small class="muted">${esc(fecha(n.created_at))}</small>
      </a>`;
    }).join('')}</div>`
    : `<p class="empty">${esc(t('Nada por aquí todavía. Añade negocios a favoritos y crea un «Avísame si…» para no perderte nada.'))}</p>`}`);

  $('#leidos')?.addEventListener('click', (ev) => ocupado(ev.currentTarget, async () => {
    await llamar('mark_notifications_read', {});
    navegar();
  }));
  // Al abrir uno se marca como leído; si no lleva a ningún sitio, se queda.
  $$('.aviso').forEach((a) => a.addEventListener('click', async (ev) => {
    if (a.classList.contains('nuevo')) {
      ev.preventDefault();
      a.classList.remove('nuevo');
      try { await llamar('mark_notifications_read', { p_ids: [a.dataset.id] }); } catch { /* no bloquea */ }
      const href = a.getAttribute('href');
      if (href === '#/notificaciones') return;
      if (href.startsWith('#')) location.hash = href; else location.href = href;
    }
  }));
};

// ── Avísame si… ───────────────────────────────────────────────────────────
function resumenAlerta(a, cats) {
  const que = (a.categories || []).length
    ? a.categories.map((id) => cats.find((c) => c.id === id)).filter(Boolean).map(nombreCat).join(', ')
    : t('Todo');
  const donde = a.lat != null ? (a.place_label || t('Zona guardada')) : t('Donde esté');
  const bits = [que, `${donde} · ${distancia(a.radius_m)}`];
  if (a.kind === 'flash_offer') bits.push(t('Ofertas flash'));
  if (a.kind === 'future_event') bits.push(t('Eventos'));
  if (a.discount_only) bits.push(t('Solo con descuento'));
  if (a.max_price_cents != null) bits.push(`${t('hasta')} ${money(a.max_price_cents)}`);
  return bits.join(' · ');
}

const paramsAlerta = (a) => ({
  p_id: a.id || null,
  p_label: a.label || null,
  p_categories: (a.categories || []).length ? a.categories : null,
  p_kind: a.kind || null,
  p_max_price_cents: a.max_price_cents ?? null,
  p_discount_only: !!a.discount_only,
  p_radius_m: a.radius_m || 1500,
  p_lat: a.lat ?? null,
  p_lng: a.lng ?? null,
  p_place_label: a.place_label || null,
  p_active: a.active !== false,
});

RUTAS.alertas = async () => {
  if (!exigeSesion('alertas')) return;
  const [lista, cats] = await Promise.all([llamar('my_offer_alerts', {}), categorias()]);
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Avísame si…'))}</h1>
    <p class="muted">${esc(t('Te avisamos cuando se publique algo que encaje. Como mucho tres avisos al día, y puedes apagarlos de uno en uno.'))}</p>
    <p><a class="pill accent" href="#/alerta/nueva">+ ${esc(t('Nuevo aviso'))}</a></p>
    ${(lista || []).length ? `<div class="avisos">${lista.map((a) => `
      <div class="aviso alerta${a.active ? '' : ' pausada'}">
        <b>${esc(a.label || t('Aviso'))}${a.active ? '' : ` <span class="tag off">${esc(t('En pausa'))}</span>`}</b>
        <span>${esc(resumenAlerta(a, cats))}</span>
        <span class="acciones">
          <a class="pill" href="#/alerta/${esc(a.id)}">${esc(t('Editar'))}</a>
          <button class="pill" data-pausa="${esc(a.id)}">${esc(a.active ? t('Pausar') : t('Activar'))}</button>
          <button class="pill ghost" data-borra="${esc(a.id)}">${esc(t('Borrar'))}</button>
        </span>
      </div>`).join('')}</div>`
    : `<p class="empty">${esc(t('Todavía no tienes avisos. Crea uno y te escribimos cuando salga algo que encaje: «sushi a menos de 1 km», «conciertos el finde».'))}</p>`}`);

  $$('[data-pausa]').forEach((b) => b.addEventListener('click', () => ocupado(b, async () => {
    const a = lista.find((x) => x.id === b.dataset.pausa);
    await llamar('save_offer_alert', paramsAlerta({ ...a, active: !a.active }));
    toast(a.active ? t('Aviso en pausa') : t('Aviso activado'));
    navegar();
  })));
  $$('[data-borra]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm(t('¿Borrar este aviso?'))) return;
    ocupado(b, async () => {
      await tabla(sb.from('offer_alerts').delete().eq('id', b.dataset.borra));
      toast(t('Aviso borrado'));
      navegar();
    });
  }));
};

RUTAS.alerta = async ([id]) => {
  if (!exigeSesion(`alerta/${id || 'nueva'}`)) return;
  const [lista, cats] = await Promise.all([llamar('my_offer_alerts', {}), categorias()]);
  const a = (id && id !== 'nueva' && (lista || []).find((x) => x.id === id))
    || { radius_m: 1500, categories: [], active: true };
  pinta(`
    <p class="crumbs"><a href="#/alertas">${esc(t('Avísame si…'))}</a></p>
    <h1>${esc(a.id ? t('Editar aviso') : t('Nuevo aviso'))}</h1>
    <form class="formu" id="f" novalidate>
      <label>${esc(t('Nombre'))} <small>${esc(t('(opcional, p. ej. «sushi cerca de casa»)'))}</small>
        <input name="label" maxlength="60" value="${esc(a.label || '')}"></label>
      <fieldset class="chips"><legend>${esc(t('¿De qué?'))} <small>${esc(t('Sin elegir ninguna, de todo.'))}</small></legend>
        ${cats.map((c) => `<label><input type="checkbox" name="cat" value="${esc(c.id)}"${(a.categories || []).includes(c.id) ? ' checked' : ''}> ${esc(nombreCat(c))}</label>`).join('')}
      </fieldset>
      <fieldset class="chips"><legend>${esc(t('¿Ofertas o eventos?'))}</legend>
        ${[['', t('Todo')], ['flash_offer', t('Ofertas flash')], ['future_event', t('Eventos')]].map(([v, l]) =>
          `<label><input type="radio" name="kind" value="${v}"${(a.kind || '') === v ? ' checked' : ''}> ${esc(l)}</label>`).join('')}
      </fieldset>
      <label>${esc(t('¿A cuánta distancia?'))} <output id="radio-txt">${esc(distancia(a.radius_m))}</output>
        <input type="range" name="radius" min="500" max="10000" step="500" value="${esc(a.radius_m)}"></label>
      <label class="check"><input type="checkbox" name="fija"${a.lat != null ? ' checked' : ''}>
        <span><b>${esc(t('Vigilar una zona fija'))}</b><br><small id="fija-txt"></small></span></label>
      <div id="zona" ${a.lat != null ? '' : 'hidden'}>
        <p class="acciones"><button type="button" class="pill" id="aqui">${ic('my_location')}${esc(t('Usar dónde estoy ahora'))}</button></p>
        <p class="muted" id="zona-txt">${a.lat != null ? esc(`${t('Zona guardada')}: ${a.place_label || `${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}`}`) : ''}</p>
        <label>${esc(t('Nombre de la zona'))} <small>${esc(t('(opcional, p. ej. «casa» o «el trabajo»)'))}</small>
          <input name="place" maxlength="60" value="${esc(a.place_label || '')}"></label>
      </div>
      <label class="check"><input type="checkbox" name="descuento"${a.discount_only ? ' checked' : ''}> ${esc(t('Solo con descuento'))}</label>
      <label>${esc(t('Precio máximo'))} <small>${esc(t('(opcional, en euros)'))}</small>
        <input name="precio" inputmode="decimal" value="${a.max_price_cents != null ? esc((a.max_price_cents / 100).toLocaleString(LOC, { minimumFractionDigits: 2 })) : ''}"></label>
      <p class="err" id="err" role="alert"></p>
      <button class="pill accent big" id="guardar">${esc(t('Guardar'))}</button>
    </form>`);

  const f = $('#f');
  let lat = a.lat;
  let lng = a.lng;
  const pintaFija = () => {
    const fija = f.fija.checked;
    $('#zona').hidden = !fija;
    $('#fija-txt').textContent = fija
      ? t('Se queda mirando esa zona aunque tú estés en otra parte.')
      : t('El aviso te sigue: usa la última ubicación que compartiste en la app.');
  };
  pintaFija();
  f.fija.addEventListener('change', pintaFija);
  f.radius.addEventListener('input', () => { $('#radio-txt').textContent = distancia(Number(f.radius.value)); });
  $('#aqui').addEventListener('click', (ev) => {
    const b = ev.currentTarget;
    if (!navigator.geolocation) { toast(t('Este navegador no deja saber dónde estás.'), true); return; }
    b.disabled = true;
    navigator.geolocation.getCurrentPosition((pos) => {
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      $('#zona-txt').textContent = `${t('Zona guardada')}: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      if (!f.place.value) f.place.value = t('Aquí');
      b.disabled = false;
    }, () => {
      toast(t('No hemos podido saber dónde estás. Revisa el permiso de ubicación del navegador.'), true);
      b.disabled = false;
    }, { enableHighAccuracy: true, timeout: 12000 });
  });

  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const err = $('#err');
    err.textContent = '';
    const fija = f.fija.checked;
    if (fija && lat == null) { err.textContent = t('Para vigilar una zona fija, pulsa «Usar dónde estoy ahora».'); return; }
    const precioTxt = f.precio.value.trim().replace(',', '.');
    const precio = precioTxt ? Number(precioTxt) : null;
    if (precioTxt && (!Number.isFinite(precio) || precio < 0)) { err.textContent = t('El precio máximo tiene que ser un número.'); return; }
    ocupado($('#guardar'), async () => {
      await llamar('save_offer_alert', paramsAlerta({
        id: a.id,
        label: f.label.value.trim(),
        categories: $$('input[name=cat]:checked', f).map((x) => x.value),
        kind: f.kind.value || null,
        max_price_cents: precio == null ? null : Math.round(precio * 100),
        discount_only: f.descuento.checked,
        radius_m: Number(f.radius.value),
        lat: fija ? lat : null,
        lng: fija ? lng : null,
        place_label: fija ? f.place.value.trim() : null,
        active: a.active !== false,
      }));
      toast(t('Aviso guardado'));
      location.hash = '#/alertas';
    });
  });
};

// ── Ajustes ───────────────────────────────────────────────────────────────
RUTAS.ajustes = async () => {
  if (!exigeSesion('ajustes')) return;
  const [perfil, prefs, cons, cats, negocios] = await Promise.all([
    tabla(sb.from('profiles').select('display_name, avatar_url, locale').eq('id', YO.id).maybeSingle()),
    llamar('my_notification_preferences', {}),
    llamar('my_consents', {}),
    categorias(),
    llamar('my_businesses', {}).catch(() => []),
  ]);
  // El resumen del negocio solo le llega a quien lo lleva (dueño o encargado).
  const llevaNegocio = Array.isArray(negocios) && negocios.some((b) => ['owner', 'manager'].includes(b.role));
  const p = perfil || {};
  const hora = (v) => (v ? String(v).slice(0, 5) : '');
  const dia = (iso) => fecha(iso, { day: 'numeric', month: 'long', year: 'numeric' });
  const inicial = (p.display_name || YO.email || '?').trim().charAt(0).toUpperCase();

  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Ajustes'))}</h1>

    <section class="bloque">
      <h2>${esc(t('Tu perfil'))}</h2>
      <form class="formu" id="f-perfil" novalidate>
        <div class="avatar-fila">
          <span class="avatar" id="avatar">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="">` : esc(inicial)}</span>
          <label class="pill">${esc(t('Cambiar foto'))}<input type="file" name="foto" accept="image/*" hidden></label>
        </div>
        <label>${esc(t('Nombre'))} <small>${esc(t('Cómo te ven en las reseñas'))}</small>
          <input name="nombre" maxlength="40" required value="${esc(p.display_name || '')}"></label>
        <label>${esc(t('Idioma'))} <small>${esc(t('De la web, la app y los avisos que te mandamos'))}</small>
          <select name="idioma">
            <option value=""${!p.locale ? ' selected' : ''}>${esc(t('El del móvil o el navegador'))}</option>
            <option value="es"${p.locale === 'es' ? ' selected' : ''}>Español</option>
            <option value="en"${p.locale === 'en' ? ' selected' : ''}>English</option>
          </select></label>
        <p class="muted">${esc(t('Correo'))}: <b>${esc(YO.email || '')}</b></p>
        <p class="err" id="err-perfil" role="alert"></p>
        <button class="pill accent" id="g-perfil">${esc(t('Guardar'))}</button>
      </form>
    </section>

    <section class="bloque">
      <h2>${esc(t('Notificaciones'))}</h2>
      <form class="formu" id="f-avisos" novalidate>
        <label class="check"><input type="checkbox" name="fav"${prefs.notify_favorites ? ' checked' : ''}>
          <span><b>${esc(t('Mis favoritos'))}</b><br><small>${esc(t('Cuando uno de tus favoritos publica una oferta o un evento'))}</small></span></label>
        <label class="check"><input type="checkbox" name="cerca"${prefs.notify_nearby ? ' checked' : ''}>
          <span><b>${esc(t('Cerca de ti'))}</b><br><small>${esc(t('Ofertas flash a tu alrededor (como mucho 3 al día)'))}</small></span></label>
        <div id="cerca-mas" ${prefs.notify_nearby ? '' : 'hidden'}>
          <label>${esc(t('¿A cuánta distancia?'))}
            <select name="radio">${[500, 1000, 2000, 5000].map((r) => `<option value="${r}"${prefs.nearby_radius_m === r ? ' selected' : ''}>${esc(distancia(r))}</option>`).join('')}</select></label>
          <fieldset class="chips"><legend>${esc(t('¿De qué?'))} <small>${esc(t('Sin elegir ninguna, de todo.'))}</small></legend>
            ${cats.map((c) => `<label><input type="checkbox" name="cat" value="${esc(c.id)}"${(prefs.nearby_categories || []).includes(c.id) ? ' checked' : ''}> ${esc(nombreCat(c))}</label>`).join('')}
          </fieldset>
        </div>
        <fieldset class="horas"><legend>${esc(t('Horas de silencio'))} <small>${esc(t('Lo que llegue en ese tramo te lo mandamos al terminar. Déjalo vacío para no usarlas.'))}</small></legend>
          <label>${esc(t('Desde'))} <input type="time" name="desde" value="${esc(hora(prefs.quiet_hours_start))}"></label>
          <label>${esc(t('Hasta'))} <input type="time" name="hasta" value="${esc(hora(prefs.quiet_hours_end))}"></label>
        </fieldset>
        <label class="check"><input type="checkbox" name="semanal"${prefs.weekly_email ? ' checked' : ''}>
          <span><b>${esc(t('Correo semanal'))}</b><br><small>${esc(t('Los jueves, lo que hay estos días en tu ciudad. Uno a la semana y se apaga cuando quieras.'))}</small></span></label>
        ${llevaNegocio ? `<label class="check"><input type="checkbox" name="negocio"${prefs.business_email !== false ? ' checked' : ''}>
          <span><b>${esc(t('Resumen semanal de tu negocio'))}</b><br><small>${esc(t('Los lunes, por correo: vistas, canjes, favoritos y reseñas de la semana pasada.'))}</small></span></label>` : ''}
        <p class="muted">${esc(t('Las notificaciones te llegan al móvil si tienes la app, y siempre las tienes aquí, en «Notificaciones».'))}</p>
        <p class="err" id="err-avisos" role="alert"></p>
        <button class="pill accent" id="g-avisos">${esc(t('Guardar'))}</button>
      </form>
    </section>

    <section class="bloque">
      <h2>${esc(t('Privacidad y datos'))}</h2>
      <p class="muted">${esc(t('Qué has consentido y cuándo. Puedes retirar cada permiso por separado y descargar todo lo que guardamos de ti.'))}</p>
      <dl class="consen">
        <dt>${esc(t('Términos y privacidad'))}</dt>
        <dd>${cons?.terms_accepted_at ? esc(`${t('Aceptados el')} ${dia(cons.terms_accepted_at)}${cons.terms_version ? ` (${t('versión')} ${cons.terms_version})` : ''}`) : esc(t('Sin registro'))}
          · <a href="${pre}/${EN ? 'terms' : 'terminos'}/" target="_blank">${esc(t('Leer'))}</a></dd>
        <dt>${esc(t('Comunicaciones comerciales'))}</dt>
        <dd><label class="check"><input type="checkbox" id="marketing"${cons?.marketing_consent ? ' checked' : ''}>
          <span>${esc(cons?.marketing_consent ? `${t('Sí, desde el')} ${dia(cons.marketing_consent_at)}` : t('No recibes novedades ni promociones por correo'))}</span></label></dd>
        <dt>${esc(t('Ubicación'))}</dt>
        <dd>${cons?.location_consent_at ? `${esc(`${t('Compartida desde el')} ${dia(cons.location_consent_at)}`)}
          <button class="linkbtn" id="sin-ubicacion">${esc(t('Dejar de compartir'))}</button>` : esc(t('No guardamos tu posición'))}</dd>
        <dt>${esc(t('Notificaciones en el móvil'))}</dt>
        <dd>${cons?.push_devices ? `${esc(`${cons.push_devices} ${cons.push_devices === 1 ? t('dispositivo') : t('dispositivos')}`)}
          <button class="linkbtn" id="sin-push">${esc(t('Desactivarlas'))}</button>` : esc(t('Sin dispositivos registrados'))}</dd>
      </dl>
      <p><button class="pill" id="descargar">⤓ ${esc(t('Descargar mis datos'))}</button></p>
      <p class="muted">${esc(t('Un archivo JSON con todo lo que Klendar guarda de ti (derecho de acceso y portabilidad).'))}</p>
    </section>

    <section class="bloque">
      <h2>${esc(t('Sesión y cuenta'))}</h2>
      <p class="acciones">
        <a class="pill" href="#/nueva-clave">${esc(t('Cambiar la contraseña'))}</a>
        <button class="pill" id="salir-todo">${esc(t('Cerrar sesión en todos los dispositivos'))}</button>
      </p>
      <p class="muted">${esc(t('Si entraste desde un móvil o un ordenador que no es tuyo, esto cierra la sesión también allí.'))}</p>
      <h3>${esc(t('Eliminar mi cuenta'))}</h3>
      <p class="muted">${esc(t('Se borran para siempre tus datos, tus favoritos, tus planes y tus canjes. Si eres dueño de un negocio, también su ficha, sus publicaciones y su equipo. No se puede deshacer.'))}</p>
      <p><button class="pill peligro" id="borrar">${esc(t('Eliminar mi cuenta'))}</button></p>
    </section>`);

  // Perfil
  const fp = $('#f-perfil');
  let foto = null;
  fp.foto.addEventListener('change', () => {
    foto = fp.foto.files[0] || null;
    if (foto) $('#avatar').innerHTML = `<img src="${URL.createObjectURL(foto)}" alt="">`;
  });
  fp.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const nombre = fp.nombre.value.trim();
    if (!nombre) { $('#err-perfil').textContent = t('Pon tu nombre.'); return; }
    $('#err-perfil').textContent = '';
    ocupado($('#g-perfil'), async () => {
      const avatar = foto ? await subeFoto('avatars', foto, 512) : undefined;
      const idioma = fp.idioma.value || null;
      const cambio = { display_name: nombre, locale: idioma };
      if (avatar) cambio.avatar_url = avatar;
      await tabla(sb.from('profiles').update(cambio).eq('id', YO.id));
      // El idioma viaja también en la cuenta: los correos lo leen de ahí.
      await sb.auth.updateUser({ data: cambio });
      foto = null;
      toast(t('Perfil guardado'));
      if (idioma && idioma !== (EN ? 'en' : 'es')) {
        try { localStorage.setItem('klendar_lang', idioma); } catch { /* sin permisos */ }
        location.reload();
      }
    });
  });

  // Avisos
  const fa = $('#f-avisos');
  fa.cerca.addEventListener('change', () => { $('#cerca-mas').hidden = !fa.cerca.checked; });
  fa.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const desde = fa.desde.value;
    const hasta = fa.hasta.value;
    if (!!desde !== !!hasta) { $('#err-avisos').textContent = t('Pon las dos horas de silencio, o ninguna.'); return; }
    $('#err-avisos').textContent = '';
    ocupado($('#g-avisos'), async () => {
      const elegidas = $$('input[name=cat]:checked', fa).map((x) => x.value);
      await llamar('update_notification_preferences', { p: {
        notify_favorites: fa.fav.checked,
        notify_nearby: fa.cerca.checked,
        nearby_radius_m: Number(fa.radio.value),
        nearby_categories: elegidas.length ? elegidas : null,
        quiet_hours_start: desde || null,
        quiet_hours_end: hasta || null,
        weekly_email: fa.semanal.checked,
        ...(fa.negocio ? { business_email: fa.negocio.checked } : {}),
      } });
      toast(t('Notificaciones guardadas'));
    });
  });

  // Privacidad
  $('#marketing').addEventListener('change', async (ev) => {
    const caja = ev.currentTarget;
    try {
      await llamar('set_marketing_consent', { p_value: caja.checked });
      toast(caja.checked ? t('Te mandaremos novedades de vez en cuando') : t('No te mandaremos más novedades'));
      navegar();
    } catch (e) { caja.checked = !caja.checked; toast(e.message, true); }
  });
  $('#sin-ubicacion')?.addEventListener('click', (ev) => {
    if (!confirm(t('Borramos tu última posición y apagamos los avisos de «cerca de ti». ¿Seguimos?'))) return;
    ocupado(ev.currentTarget, async () => { await llamar('revoke_location_consent', {}); toast(t('Ya no guardamos tu posición')); navegar(); });
  });
  $('#sin-push')?.addEventListener('click', (ev) => {
    if (!confirm(t('Dejarán de llegarte notificaciones a todos tus móviles. Podrás volver a activarlas desde la app. ¿Seguimos?'))) return;
    ocupado(ev.currentTarget, async () => { await llamar('revoke_push', {}); toast(t('Notificaciones del móvil desactivadas')); navegar(); });
  });
  $('#descargar').addEventListener('click', (ev) => ocupado(ev.currentTarget, async () => {
    const datos = await llamar('export_my_data', {});
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `klendar-${EN ? 'my-data' : 'mis-datos'}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }));

  // Sesión y cuenta
  $('#salir-todo').addEventListener('click', (ev) => {
    if (!confirm(t('Tendrás que volver a entrar en cada dispositivo, también en este. ¿Cerrar todas?'))) return;
    ocupado(ev.currentTarget, async () => {
      await sb.auth.signOut({ scope: 'global' });
      toast(t('Has cerrado sesión en todos los dispositivos'));
      vuelve('');
    });
  });
  $('#borrar').addEventListener('click', (ev) => {
    const palabra = t('ELIMINAR');
    const escrito = prompt(t('Esto borra tu cuenta para siempre. Para confirmarlo, escribe ELIMINAR:'));
    if (escrito == null) return;
    if (escrito.trim().toUpperCase() !== palabra) { toast(t('No coincide: la cuenta sigue como estaba.'), true); return; }
    ocupado(ev.currentTarget, async () => {
      await llamar('delete_my_account', {});
      try { await sb.auth.signOut(); } catch { /* la sesión ya no existe */ }
      pinta(`<div class="ticket"><p class="hecho-ic" aria-hidden="true">✓</p>
        <h1>${esc(t('Tu cuenta se ha eliminado'))}</h1>
        <p class="muted">${esc(t('Gracias por haber usado Klendar. Si algún día vuelves, aquí estaremos.'))}</p>
        <p><a class="pill accent" href="${pre}/">${esc(t('Ir al inicio'))}</a></p></div>`);
      I18N.translate(view);
    });
  });
};
RUTAS.perfil = RUTAS.ajustes;

// ── Sugerencias y mejoras ─────────────────────────────────────────────────
const TIPOS_SUGERENCIA = [
  ['suggestion', 'Sugerencia', 'Ej.: me gustaría poder filtrar por precio en el mapa.'],
  ['bug', 'Algo falla', 'Ej.: al pedir el código se queda cargando. Desde el portátil, ayer por la tarde.'],
  ['business', 'Soy un negocio', 'Ej.: tengo una peluquería y quiero saber cómo empezar.'],
  ['other', 'Otra cosa', ''],
];
const ESTADO_SUGERENCIA = {
  new: 'Recibida', reviewing: 'La estamos viendo', planned: 'La vamos a hacer', done: 'Hecho', declined: 'De momento no',
};

RUTAS.sugerencias = async () => {
  if (!exigeSesion('sugerencias')) return;
  const mias = await tabla(sb.from('feedback')
    .select('id, kind, message, status, created_at, replied_at')
    .order('created_at', { ascending: false }).limit(20));
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Sugerencias y mejoras'))}</h1>
    <p class="muted">${esc(t('Klendar la hacemos con lo que nos cuentas. Escribe lo que mejorarías, lo que echas de menos o lo que no funciona: lo leemos todo y te respondemos si hace falta.'))}</p>
    <form class="formu" id="f" novalidate>
      <fieldset class="chips"><legend>${esc(t('¿De qué se trata?'))}</legend>
        ${TIPOS_SUGERENCIA.map(([v, l], i) => `<label><input type="radio" name="tipo" value="${v}"${i === 0 ? ' checked' : ''}> ${esc(t(l))}</label>`).join('')}
      </fieldset>
      <label>${esc(t('Tu mensaje'))}
        <textarea name="msg" rows="6" maxlength="2000" placeholder="${esc(t(TIPOS_SUGERENCIA[0][2]))}"></textarea></label>
      <p class="muted">${esc(t('Mandamos también que escribes desde la web y tu idioma, para entender mejor los fallos. Nada más.'))}</p>
      <p class="err" id="err" role="alert"></p>
      <button class="pill accent" id="enviar">${esc(t('Enviar'))}</button>
    </form>
    ${mias.length ? `<h2>${esc(t('Lo que has enviado'))}</h2>
      <div class="avisos">${mias.map((m) => `<div class="aviso">
        <b>${esc(t(ESTADO_SUGERENCIA[m.status] || 'Recibida'))}</b>
        <span>${esc(m.message.length > 220 ? `${m.message.slice(0, 220)}…` : m.message)}</span>
        <small class="muted">${esc(fecha(m.created_at))}${m.replied_at ? ` · ${esc(t('Te hemos respondido: míralo en tus notificaciones'))}` : ''}</small>
      </div>`).join('')}</div>` : ''}`);

  const f = $('#f');
  $$('input[name=tipo]', f).forEach((r) => r.addEventListener('change', () => {
    const tipo = TIPOS_SUGERENCIA.find(([v]) => v === f.tipo.value);
    f.msg.placeholder = tipo && tipo[2] ? t(tipo[2]) : '';
  }));
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const msg = f.msg.value.trim();
    if (msg.length < 5) { $('#err').textContent = t('Cuéntanos un poco más (5 letras como mínimo).'); return; }
    $('#err').textContent = '';
    ocupado($('#enviar'), async () => {
      await llamar('send_feedback', {
        p_message: msg, p_kind: f.tipo.value, p_platform: 'web',
        p_app_version: 'web', p_locale: EN ? 'en' : 'es', p_route: document.referrer ? new URL(document.referrer).pathname : null,
      });
      toast(t('¡Gracias! Lo hemos recibido. Si necesitamos más detalles, te escribimos.'));
      navegar();
    });
  });
};

// ── Reseñas ───────────────────────────────────────────────────────────────
RUTAS.opinar = async ([id]) => {
  if (!exigeSesion(`opinar/${id}`)) return;
  const [fila, resenas] = await Promise.all([
    llamar('business_profile', { p_id: id }),
    llamar('business_reviews', { p_id: id, p_limit: 50 }),
  ]);
  const b = Array.isArray(fila) ? fila[0] : fila;
  if (!b) { pinta(`<p class="empty">${esc(t('Ese sitio ya no está en Klendar.'))}</p>`); return; }
  const mia = (resenas || []).find((r) => r.is_mine) || {};
  pinta(`
    <p class="crumbs"><a href="${pre}/b/${esc(id)}">${esc(b.name)}</a></p>
    <h1>${esc(mia.id ? t('Editar mi reseña') : t('Escribir una reseña'))}</h1>
    <p class="muted">${esc(t('Una reseña por persona y sitio. Puedes cambiarla cuando quieras.'))}</p>
    <form class="formu" id="f" novalidate>
      <fieldset class="estrellas"><legend>${esc(t('¿Qué nota le pones?'))}</legend>
        ${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="nota" id="n${n}" value="${n}"${mia.rating === n ? ' checked' : ''}><label for="n${n}" title="${n}/5"><span class="sr">${n} ${esc(t('de 5'))}</span>★</label>`).join('')}
      </fieldset>
      <label>${esc(t('¿Qué tal fue?'))} <small>${esc(t('(opcional)'))}</small>
        <textarea name="texto" rows="5" maxlength="500">${esc(mia.comment || '')}</textarea></label>
      <div class="foto-fila">
        ${mia.photo_url ? `<img id="prev" src="${esc(mia.photo_url)}" alt="">` : '<img id="prev" alt="" hidden>'}
        <label class="pill">${esc(mia.photo_url ? t('Cambiar la foto') : t('Añadir una foto'))}<input type="file" name="foto" accept="image/*" hidden></label>
        ${mia.photo_url ? `<button type="button" class="linkbtn" id="quitaFoto">${esc(t('Quitar la foto'))}</button>` : ''}
      </div>
      <p class="muted">${esc(t('Tu nombre y tu foto de perfil salen junto a la reseña. Sigue las normas de la comunidad: sin insultos ni datos de nadie.'))}</p>
      <p class="err" id="err" role="alert"></p>
      <button class="pill accent" id="publicar">${esc(t('Publicar'))}</button>
    </form>`);
  const f = $('#f');
  f.foto.addEventListener('change', () => {
    const img = $('#prev');
    const archivo = f.foto.files[0];
    if (archivo) { img.src = URL.createObjectURL(archivo); img.hidden = false; }
  });
  // Quitar la foto que tenía: se manda vacía (sin nada, la base la conserva).
  let quitar = false;
  const quita = $('#quitaFoto');
  if (quita) {
    quita.onclick = () => { quitar = true; f.foto.value = ''; $('#prev').hidden = true; quita.hidden = true; };
  }
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const nota = Number(f.nota.value);
    if (!nota) { $('#err').textContent = t('Elige de una a cinco estrellas.'); return; }
    $('#err').textContent = '';
    ocupado($('#publicar'), async () => {
      const foto = f.foto.files[0] ? await subeFoto('reviews', f.foto.files[0]) : (quitar ? '' : null);
      await llamar('upsert_review', {
        p_business_id: id, p_rating: nota, p_comment: f.texto.value.trim() || null, p_photo_url: foto,
      });
      hecho({
        titulo: t('Reseña publicada. ¡Gracias!'),
        texto: t('Ayuda a otros a decidirse y al sitio a mejorar.'),
        volver: `${pre}/b/${encodeURIComponent(id)}#resenas`, volverTxt: t('Volver al sitio'),
        lista: '#/', listaTxt: t('Tu cuenta'),
      });
    });
  });
};

// ── Denunciar ─────────────────────────────────────────────────────────────
const MOTIVOS = [
  ['spam', 'Spam o publicidad engañosa'],
  ['inappropriate', 'Contenido inapropiado u ofensivo'],
  ['misleading', 'La oferta no es como se anuncia'],
  ['closed', 'El negocio ya no existe o está cerrado'],
  ['other', 'Otro motivo'],
];
const QUE_SE_DENUNCIA = {
  offer: 'Denunciar una publicación', business: 'Denunciar un negocio',
  review: 'Denunciar una reseña', post: 'Denunciar una novedad',
};

RUTAS.denunciar = async ([tipo, id]) => {
  if (!QUE_SE_DENUNCIA[tipo] || !/^[0-9a-f-]{36}$/i.test(id || '')) {
    pinta(`<p class="empty">${esc(t('Ese enlace no está completo.'))}</p>`);
    return;
  }
  if (!exigeSesion(`denunciar/${tipo}/${id}`)) return;
  const volver = document.referrer && new URL(document.referrer).origin === location.origin
    ? document.referrer : `${pre}/`;
  pinta(`
    <h1>${esc(t(QUE_SE_DENUNCIA[tipo]))}</h1>
    <p class="muted">${esc(t('Cuéntanos qué pasa. Lo revisamos lo antes posible y nadie sabrá que has sido tú.'))}</p>
    <form class="formu" id="f" novalidate>
      <fieldset class="motivos"><legend>${esc(t('Motivo'))}</legend>
        ${MOTIVOS.filter(([v]) => tipo !== 'review' || v !== 'closed').map(([v, l]) =>
          `<label class="check"><input type="radio" name="motivo" value="${v}"> ${esc(t(l))}</label>`).join('')}
      </fieldset>
      <label>${esc(t('Detalles'))} <small>${esc(t('(opcional)'))}</small>
        <textarea name="det" rows="4" maxlength="500"></textarea></label>
      <p class="err" id="err" role="alert"></p>
      <button class="pill accent" id="enviar">${esc(t('Enviar denuncia'))}</button>
    </form>`);
  const f = $('#f');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!f.motivo.value) { $('#err').textContent = t('Elige un motivo.'); return; }
    $('#err').textContent = '';
    ocupado($('#enviar'), async () => {
      await llamar('report_target', {
        p_type: tipo, p_id: id, p_reason: f.motivo.value, p_details: f.det.value.trim() || null,
      });
      hecho({
        titulo: t('Denuncia enviada'),
        texto: t('Gracias por avisar. Si hace falta, lo quitamos y hablamos con quien lo publicó.'),
        volver, volverTxt: t('Volver'),
        lista: '#/', listaTxt: t('Tu cuenta'),
      });
    });
  });
};

// ── Un último paso ────────────────────────────────────────────────────────
RUTAS['ultimo-paso'] = async (_p, params) => {
  if (!exigeSesion('ultimo-paso')) return;
  const siguiente = params.get('siguiente') || '';
  // Solo se vuelve a sitios de esta misma web (nunca a una dirección de fuera).
  const volver = new URLSearchParams(location.search).get('volver');
  const volverSeguro = volver && /^\/(panel|app)\//.test(volver) ? volver : '';
  if (!(await faltaConsentimiento())) {
    if (volverSeguro) { location.href = volverSeguro; return; }
    vuelve(siguiente === 'ultimo-paso' ? '' : siguiente);
    return;
  }
  const pideFecha = !CONSENTIMIENTO.fecha;
  pinta(`
    <div class="ticket" style="text-align:left">
      <h1>${esc(t('Un último paso'))}</h1>
      <p class="muted">${esc(t(pideFecha
        ? 'Para usar Klendar hay que tener 14 años o más y aceptar los términos. Solo te lo preguntamos una vez.'
        : 'Para seguir usando Klendar, acepta los términos y la política de privacidad. Solo te lo preguntamos una vez.'))}</p>
      <form id="f" class="formu" novalidate>
        ${pideFecha ? `<label>${esc(t('Fecha de nacimiento'))}<input name="birth" type="date" required></label>` : ''}
        <label class="check"><input type="checkbox" name="terms" required>
          <span>${t('He leído y acepto los <a href="/terminos/" target="_blank">términos</a> y la <a href="/privacidad/" target="_blank">privacidad</a>.')}</span></label>
        <label class="check"><input type="checkbox" name="marketing">
          <span>${esc(t('Quiero recibir novedades de Klendar (opcional).'))}</span></label>
        <p id="err" class="err" role="alert"></p>
        <button class="pill accent" id="seguir">${esc(t('Continuar'))}</button>
      </form>
      <p><button class="linkbtn" id="salir">${esc(t('Cerrar sesión'))}</button></p>
    </div>`);
  const f = $('#f');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const err = $('#err');
    err.textContent = '';
    let nac = null;
    if (pideFecha) {
      nac = f.birth.value;
      if (!nac) { err.textContent = t('Pon tu fecha de nacimiento.'); return; }
      const d = new Date(`${nac}T12:00:00`);
      const hoy = new Date();
      let edad = hoy.getFullYear() - d.getFullYear();
      if (hoy.getMonth() < d.getMonth() || (hoy.getMonth() === d.getMonth() && hoy.getDate() < d.getDate())) edad -= 1;
      if (edad < 14) { err.textContent = t('Para usar Klendar hay que tener 14 años o más.'); return; }
    }
    if (!f.terms.checked) { err.textContent = t('Tienes que aceptar los términos y la privacidad.'); return; }
    ocupado($('#seguir'), async () => {
      await llamar('accept_terms', { p_version: '2026-09', p_birth_date: nac });
      if (f.marketing.checked) await llamar('set_marketing_consent', { p_value: true });
      CONSENTIMIENTO = { id: YO.id, ok: true, fecha: true };
      toast(t('¡Listo! Ya puedes usar Klendar.'));
      if (volverSeguro) { location.href = volverSeguro; return; }
      vuelve(siguiente === 'ultimo-paso' ? '' : siguiente);
    });
  });
  $('#salir').onclick = async () => {
    await sb.auth.signOut();
    CONSENTIMIENTO = { id: null, ok: true, fecha: true };
    location.href = `${pre}/`;
  };
};

RUTAS.avisos = (...a) => RUTAS.notificaciones(...a); // enlaces antiguos

// El número de notificaciones sin leer, en la tarjeta de la portada.
async function pintaSinLeer() {
  const el = $('#sin-leer');
  if (!el) return;
  try {
    const n = await sinLeer();
    if (n) { el.textContent = n > 99 ? '99+' : String(n); el.hidden = false; }
  } catch { /* sin número, sin más */ }
}
