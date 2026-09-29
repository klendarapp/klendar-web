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
  birth_date_locked: 'Tu fecha de nacimiento ya está guardada. Para cambiarla, escríbenos a info@klendar.app.',
  auth_required: 'Tienes que entrar en tu cuenta.',
  too_many_alerts: 'Has llegado al máximo de 10 avisos. Borra alguno para crear otro.',
  message_too_short: 'Cuéntanos un poco más: al menos 5 caracteres.',
  invalid_rating: 'Elige de una a cinco estrellas.',
  own_business: 'No puedes valorar un negocio en el que trabajas.',
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

/** Reduce la foto en el navegador antes de subirla, como la app (menos
 * datos, menos espera; `assets/fotos.js`), y la sube a la carpeta de la
 * persona. Devuelve la URL pública. */
async function subeFoto(carpeta, archivo, tam = KFotos.TAM.foto) {
  if (!archivo) return null;
  if (archivo.size > 20 * 1024 * 1024) throw new Error(t('La foto pesa demasiado. Prueba con otra más pequeña.'));
  const blob = await KFotos.reduce(archivo, tam);
  // Si no se ha podido reducir y el navegador tampoco la sabría enseñar
  // (una HEIC en Chrome, por ejemplo), mejor decirlo que subirla rota.
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(blob.type)) {
    throw new Error(t('Esa imagen no se puede abrir. Prueba con una foto JPG o PNG.'));
  }
  const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1];
  const ruta = `${carpeta}/${YO.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('business-images').upload(ruta, blob, { contentType: blob.type });
  if (error) throw Object.assign(new Error(amable(error.message)), { clave: error.message });
  return sb.storage.from('business-images').getPublicUrl(ruta).data.publicUrl;
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
  // «Tu mensaje ya se ha enviado» / «…no se ha enviado»: a «Avisar a mis
  // clientes» de ese negocio en el panel.
  if ((m = r.match(/^\/my-business\/([0-9a-f-]{36})\/message/i))) return `/panel/#/mensajes?biz=${m[1]}`;
  if (r.startsWith('/my-business')) return '/panel/';
  // «¡Feliz cumpleaños!»: el regalo, con su QR.
  if ((m = r.match(/^\/gift\/([0-9a-f-]{36})/i))) return `#/regalo/${m[1]}`;
  // «… se ha cancelado»: la reserva, que sale como «Anulado».
  if (r.startsWith('/my-redemptions')) return '#/codigos';
  if (r.startsWith('/profile')) return '#/ajustes';
  // «Ana está en tus amigos»: tu lista de amigos.
  if (r.startsWith('/friends')) return '#/amigos';
  return '';
}

/** Lo último que se ha mandado marcar como leído: el número de la portada
 * espera a que termine (si no, al volver aún contaba las que acabas de ver). */
let MARCA_LEIDAS = Promise.resolve();
/** El token de la sesión, al día (Supabase lo renueva solo cada hora): al
 * cerrar la página ya no da tiempo a pedirlo. */
let TOKEN_SESION = null;
sb.auth.onAuthStateChange((_ev, s) => { TOKEN_SESION = s?.access_token || null; });

async function sinLeer() {
  if (!YO) return 0;
  await MARCA_LEIDAS;
  const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  return count || 0;
}

/** Marca como leídas `ids`. Al cerrar la pestaña o irse a otra página de la
 * web, `fetch` normal se corta a medias: va con `keepalive` y el token que ya
 * se tenía, directo a la misma función de la base. */
function marcaLeidas(ids, alIrse = false) {
  if (!ids.length) return;
  if (!alIrse) {
    MARCA_LEIDAS = llamar('mark_notifications_read', { p_ids: ids }).then(() => {}, () => {});
    return;
  }
  const token = TOKEN_SESION;
  if (!token) return;
  try {
    fetch(`${window.KLENDAR_ENV.url}/rest/v1/rpc/mark_notifications_read`, {
      method: 'POST',
      keepalive: true,
      headers: { apikey: window.KLENDAR_ENV.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_ids: ids }),
    }).catch(() => {}); // sin red se quedan como nuevas; ya se marcarán otra vez
  } catch { /* navegador sin keepalive: la próxima vez */ }
}

RUTAS.notificaciones = async () => {
  if (!exigeSesion('notificaciones')) return;
  await MARCA_LEIDAS; // las que se acaban de dar por vistas ya no salen como nuevas
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

  // Como en la app: las que no habías leído se marcan como leídas al salir
  // de aquí, solo las que han llegado a verse en pantalla. Mientras estás
  // dentro siguen resaltadas, para saber qué es nuevo.
  const vistas = new Set();
  let vigia = null;
  const nuevas = $$('.aviso.nuevo');
  if (nuevas.length && 'IntersectionObserver' in window) {
    vigia = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        vistas.add(e.target.dataset.id);
        vigia.unobserve(e.target);
      }
    }, { threshold: 0.5 });
    nuevas.forEach((a) => vigia.observe(a));
  } else {
    nuevas.forEach((a) => vistas.add(a.dataset.id));
  }
  let marcadas = false;
  const alIrse = (cerrando) => {
    if (marcadas) return;
    marcadas = true;
    vigia?.disconnect();
    removeEventListener('pagehide', alCerrar);
    marcaLeidas([...vistas], cerrando);
  };
  // Cambiar de pantalla dentro de «Tu cuenta», o salir de la página.
  const alCerrar = () => alIrse(true);
  addEventListener('pagehide', alCerrar);
  alSalir(() => alIrse(false));

  $('#leidos')?.addEventListener('click', (ev) => ocupado(ev.currentTarget, async () => {
    await llamar('mark_notifications_read', {});
    vistas.clear(); // ya están todas
    navegar();
  }));
  // Tocar una es haberla leído: se marca ya, sin esperar a salir. Si no lleva
  // a ningún sitio, se queda aquí.
  $$('.aviso').forEach((a) => a.addEventListener('click', async (ev) => {
    if (a.classList.contains('nuevo')) {
      ev.preventDefault();
      a.classList.remove('nuevo');
      vistas.delete(a.dataset.id);
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
    <p class="muted">${esc(t('Te avisamos cuando se publique algo que encaje. Como mucho tres notificaciones al día, y puedes apagar cada aviso por separado.'))}</p>
    <p><a class="pill accent" href="#/alerta/nueva">${ic('add')} ${esc(t('Nuevo aviso'))}</a></p>
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
  $$('[data-borra]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirma({ titulo: t('¿Borrar este aviso?'), aceptar: t('Borrar'), peligro: true }))) return;
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
  const [perfil, prefs, cons, cats, negocios, cuenta, metodos] = await Promise.all([
    tabla(sb.from('profiles').select('display_name, avatar_url, locale, birth_date').eq('id', YO.id).maybeSingle()),
    llamar('my_notification_preferences', {}),
    llamar('my_consents', {}),
    categorias(),
    llamar('my_businesses', {}).catch(() => []),
    // Las formas de entrar, recién preguntadas (la sesión guardada puede ser
    // de antes de añadir una contraseña o de enlazar Google).
    sb.auth.getUser().then(({ data }) => data?.user || YO).catch(() => YO),
    // Si hay contraseña lo sabe la base: la identidad «email» existe también
    // en cuentas creadas con un código por correo.
    llamar('my_auth_methods', {}).catch(() => null),
  ]);
  const vias = new Set((cuenta?.identities || []).map((i) => i.provider));
  const tieneClave = metodos?.has_password ?? vias.has('email');
  const metodo = (icono, texto, activa) => `<div class="fila metodo${activa ? '' : ' off'}">
      ${icono}<span class="fila-t"><b>${esc(texto)}</b></span>
      <span class="estado">${esc(activa ? t('Activa') : t('Sin usar'))}</span></div>`;
  // El resumen del negocio solo le llega a quien lo lleva (dueño o encargado).
  const llevaNegocio = Array.isArray(negocios) && negocios.some((b) => ['owner', 'manager'].includes(b.role));
  const p = perfil || {};
  const hora = (v) => (v ? String(v).slice(0, 5) : '');
  const dia = (iso) => fecha(iso, { day: 'numeric', month: 'long', year: 'numeric' });
  const inicial = (p.display_name || YO.email || '?').trim().charAt(0).toUpperCase();
  // La fecha de nacimiento, una vez puesta, no se cambia (como en la app):
  // se ve y se dice cómo pedir que la corrijan. Quien entró con Google o
  // Apple y no la tiene la pone aquí, una vez.
  const nacimiento = p.birth_date
    ? new Intl.DateTimeFormat(LOC, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${p.birth_date}T00:00:00Z`))
    : null;

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
        ${nacimiento
    ? `<label>${esc(t('Fecha de nacimiento'))} <small>${esc(t('Para cambiarla, escríbenos a info@klendar.app.'))}</small>
          <span class="candado"><input value="${esc(nacimiento)}" readonly aria-readonly="true"><span class="ms" aria-hidden="true">lock</span></span></label>`
    : `<label>${esc(t('Fecha de nacimiento'))} <small>${esc(t('Solo para mostrarte ofertas adecuadas a tu edad. Revísala bien: una vez guardada, no se puede cambiar.'))}</small>
          <input name="birth" type="date" max="${new Date().toISOString().slice(0, 10)}"></label>`}
        <label>${esc(t('Idioma'))} <small>${esc(t('De la web, la app y las notificaciones y correos que te enviamos'))}</small>
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
        <label class="check"><input type="checkbox" name="mensajes"${prefs.notify_business_messages !== false ? ' checked' : ''}>
          <span><b>${esc(t('Mensajes de mis negocios favoritos'))}</b><br><small>${esc(t('Lo que te cuentan tus favoritos: como mucho uno por semana de cada uno.'))}</small></span></label>
        <label class="check"><input type="checkbox" name="cumple"${prefs.notify_birthday !== false ? ' checked' : ''}>
          <span><b>${esc(t('Regalos de cumpleaños'))}</b><br><small>${esc(t('Si uno de tus favoritos hace un regalo por tu cumpleaños, te llega ese día con su código.'))}</small></span></label>
        <label class="check"><input type="checkbox" name="amigos"${prefs.notify_friend_invites !== false ? ' checked' : ''}>
          <span><b>${esc(t('Invitaciones de amigos'))}</b><br><small>${esc(t('Cuando un amigo te invita a un plan o dice que va al tuyo. Apagado, no te pueden invitar.'))}</small></span></label>
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
      <h2>${esc(t('Formas de entrar'))}</h2>
      <div class="lista">
        ${metodo(ic('password'), t('Correo y contraseña'), tieneClave)}
        ${metodo(`<span class="logo-via">${LOGO_GOOGLE}</span>`, t('Cuenta de Google'), vias.has('google'))}
        ${vias.has('apple') ? metodo(`<span class="logo-via">${LOGO_APPLE}</span>`, t('Cuenta de Apple'), true) : ''}
        ${vias.has('phone') ? metodo(ic('smartphone'), t('Teléfono'), true) : ''}
      </div>
      <p class="muted">${esc(t('Con el mismo correo entras siempre a la misma cuenta, da igual por dónde. Tener contraseña además de Google evita quedarte fuera si pierdes el acceso a una.'))}</p>
      <p><a class="pill" href="#/nueva-clave?siguiente=ajustes">${ic('key')} ${esc(t(tieneClave ? 'Cambiar la contraseña' : 'Crear una contraseña'))}</a></p>
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
        <dt>${esc(t('Estadísticas de uso de la app'))}</dt>
        <dd><label class="check"><input type="checkbox" id="estadisticas"${cons?.analytics_consent ? ' checked' : ''}>
          <span>${esc(cons?.analytics_consent ? `${t('Sí, desde el')} ${dia(cons.analytics_consent_at)}` : t('No mandamos estadísticas de cómo usas la app'))}</span></label></dd>
        <dt>${esc(t('Que mis amigos vean mis planes'))}</dt>
        <dd><label class="check"><input type="checkbox" id="compartir-planes"${cons?.share_plans !== false ? ' checked' : ''}>
          <span>${esc(t(cons?.share_plans !== false
            ? 'Tus amigos ven a qué vas («Voy», una plaza reservada o un código)'
            : 'No sales en el «quién va» de tus amigos'))}</span></label></dd>
        <dt>${esc(t('Ubicación'))}</dt>
        <dd id="dd-ubicacion">${cons?.location_consent_at ? `${esc(`${t('Compartida desde el')} ${dia(cons.location_consent_at)}`)}
          <button class="linkbtn" id="sin-ubicacion">${esc(t('Dejar de compartir'))}</button>` : esc(t('No guardamos tu posición'))}</dd>
        <dt>${esc(t('Notificaciones en el móvil'))}</dt>
        <dd id="dd-push">${cons?.push_devices ? `${esc(`${cons.push_devices} ${cons.push_devices === 1 ? t('dispositivo') : t('dispositivos')}`)}
          <button class="linkbtn" id="sin-push">${esc(t('Desactivarlas'))}</button>` : esc(t('Sin dispositivos registrados'))}</dd>
      </dl>
      <p><button class="pill" id="descargar">${ic('download')} ${esc(t('Descargar mis datos'))}</button></p>
      <p class="muted">${esc(t('Un archivo JSON con todo lo que Klendar guarda de ti (derecho de acceso y portabilidad).'))}</p>
    </section>

    <section class="bloque">
      <h2>${esc(t('Sesión y cuenta'))}</h2>
      <p class="acciones">
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
    const nac = fp.birth?.value || '';
    if (!validaForm(fp, { nombre: VALIDA.requerido, ...(nac ? { birth: VALIDA.nacimiento } : {}) })) return;
    $('#err-perfil').textContent = '';
    ocupado($('#g-perfil'), async () => {
      if (nac) await llamar('set_my_birth_date', { p_birth_date: nac });
      const avatar = foto ? await subeFoto('avatars', foto, KFotos.TAM.avatar) : undefined;
      const idioma = fp.idioma.value || null;
      const cambio = { display_name: nombre, locale: idioma };
      if (avatar) cambio.avatar_url = avatar;
      await tabla(sb.from('profiles').update(cambio).eq('id', YO.id));
      // El idioma viaja también en la cuenta: los correos lo leen de ahí.
      const { error: eCuenta } = await sb.auth.updateUser({ data: cambio });
      if (eCuenta) throw new Error(errAuth(eCuenta));
      foto = null;
      toast(t('Perfil guardado'));
      if (idioma && idioma !== (EN ? 'en' : 'es')) {
        try { localStorage.setItem('klendar_lang', idioma); } catch { /* sin permisos */ }
        location.reload();
      } else if (nac) {
        // Ya puesta: se vuelve a pintar, ahora de solo lectura.
        RUTAS.ajustes();
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
        notify_business_messages: fa.elements.mensajes.checked,
        notify_birthday: fa.elements.cumple.checked,
        notify_friend_invites: fa.elements.amigos.checked,
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
      // Solo cambia su texto: repintar Ajustes entero borraba lo que se
      // estuviera editando en el perfil o en las notificaciones.
      const texto = caja.closest('label')?.querySelector('span');
      if (texto) texto.textContent = caja.checked ? `${t('Sí, desde el')} ${dia(new Date().toISOString())}` : t('No recibes novedades ni promociones por correo');
    } catch (e) { caja.checked = !caja.checked; toast(e.message, true); }
  });
  // Lo que manda la app a Firebase (la web no usa estadísticas que necesiten
  // permiso): aquí se da o se quita igual que en la app, y la app lo recoge
  // la próxima vez que se abra.
  $('#estadisticas').addEventListener('change', async (ev) => {
    const caja = ev.currentTarget;
    try {
      await llamar('set_analytics_consent', { p_value: caja.checked });
      toast(caja.checked ? t('Gracias: nos ayudas a mejorar Klendar') : t('La app ya no mandará estadísticas de uso'));
      const texto = caja.closest('label')?.querySelector('span');
      if (texto) texto.textContent = caja.checked ? `${t('Sí, desde el')} ${dia(new Date().toISOString())}` : t('No mandamos estadísticas de cómo usas la app');
    } catch (e) { caja.checked = !caja.checked; toast(e.message, true); }
  });
  // «Que mis amigos vean mis planes»: apagado, no sales en el «quién va» de
  // nadie (ni por «Voy» ni por una plaza o un código).
  $('#compartir-planes').addEventListener('change', async (ev) => {
    const caja = ev.currentTarget;
    caja.disabled = true;
    try {
      await llamar('set_share_plans', { p_value: caja.checked });
      const texto = caja.closest('label')?.querySelector('span');
      if (texto) {
        texto.textContent = caja.checked
          ? t('Tus amigos ven a qué vas («Voy», una plaza reservada o un código)')
          : t('No sales en el «quién va» de tus amigos');
      }
    } catch (e) { caja.checked = !caja.checked; toast(e.message, true); } finally { caja.disabled = false; }
  });
  $('#sin-ubicacion')?.addEventListener('click', async (ev) => {
    const boton = ev.currentTarget;
    if (!(await confirma({
      titulo: t('Dejar de compartir'),
      texto: t('Borramos tu última posición y desactivamos las notificaciones de «Cerca de ti».'),
      aceptar: t('Dejar de compartir'),
    }))) return;
    // Solo cambia lo suyo: repintar Ajustes entero borraba lo que se
    // estuviera escribiendo en el perfil o en las notificaciones.
    ocupado(boton, async () => {
      await llamar('revoke_location_consent', {});
      toast(t('Ya no guardamos tu posición'));
      const dd = $('#dd-ubicacion');
      if (dd) dd.textContent = t('No guardamos tu posición');
      // La base apaga también «Cerca de ti»: el formulario lo refleja.
      if (fa.elements.cerca.checked) {
        fa.elements.cerca.checked = false;
        $('#cerca-mas').hidden = true;
      }
    });
  });
  $('#sin-push')?.addEventListener('click', async (ev) => {
    const boton = ev.currentTarget;
    if (!(await confirma({
      titulo: t('Desactivar push'),
      texto: t('Dejarán de llegarte notificaciones a todos tus dispositivos. Podrás volver a activarlas desde la app.'),
      aceptar: t('Desactivar push'),
    }))) return;
    ocupado(boton, async () => {
      await llamar('revoke_push', {});
      toast(t('Notificaciones del móvil desactivadas'));
      const dd = $('#dd-push');
      if (dd) dd.textContent = t('Sin dispositivos registrados');
    });
  });
  $('#descargar').addEventListener('click', (ev) => ocupado(ev.currentTarget, async () => {
    const datos = await llamar('export_my_data', {});
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    // El día de Madrid (en UTC, entre las 0 y las 2 aún sería ayer).
    a.download = `klendar-${EN ? 'my-data' : 'mis-datos'}-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }));

  // Sesión y cuenta
  $('#salir-todo').addEventListener('click', async (ev) => {
    const boton = ev.currentTarget;
    if (!(await confirma({
      titulo: t('¿Cerrar sesión en todos los dispositivos?'),
      texto: t('Tendrás que volver a entrar en cada uno, incluido este.'),
      aceptar: t('Cerrar todas'),
    }))) return;
    ocupado(boton, async () => {
      await sb.auth.signOut({ scope: 'global' });
      toast(t('Has cerrado sesión en todos los dispositivos'));
      vuelve('');
    });
  });
  $('#borrar').addEventListener('click', async (ev) => {
    const boton = ev.currentTarget;
    if (!(await confirma({
      titulo: t('¿Eliminar tu cuenta?'),
      texto: t('Se borran para siempre tus datos, tus favoritos, tus planes y tus canjes. Si eres dueño de un negocio, también su ficha, sus publicaciones y su equipo. No se puede deshacer.'),
      aceptar: t('Eliminar'),
      peligro: true,
    }))) return;
    ocupado(boton, async () => {
      await llamar('delete_my_account', {});
      try { await sb.auth.signOut({ scope: 'local' }); } catch { /* la sesión ya no existe */ }
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
    if (msg.length < 5) { $('#err').textContent = t('Cuéntanos un poco más: al menos 5 caracteres.'); return; }
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
  // La tuya, aunque no esté entre las 50 últimas: la ficha trae tu nota, tu
  // texto y tu foto (si no, editar una reseña antigua empezaba en blanco).
  const mia = (resenas || []).find((r) => r.is_mine)
    || (b.my_rating ? { id: true, rating: b.my_rating, comment: b.my_comment, photo_url: b.my_photo_url } : {});
  pinta(`
    <p class="crumbs"><a href="${pre}/b/${esc(id)}">${esc(b.name)}</a></p>
    <h1>${esc(mia.id ? t('Editar mi reseña') : t('Escribir una reseña'))}</h1>
    <p class="muted">${esc(t('Una reseña por persona y negocio. Puedes editarla cuando quieras.'))}</p>
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
      const foto = f.foto.files[0] ? await subeFoto('reviews', f.foto.files[0], KFotos.TAM.resena) : (quitar ? '' : null);
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
// Los motivos que tienen sentido en cada cosa, como en la app (report_sheet).
const MOTIVOS_DE = {
  offer: ['spam', 'inappropriate', 'misleading', 'closed', 'other'],
  business: ['spam', 'inappropriate', 'closed', 'other'],
};
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
        ${MOTIVOS.filter(([v]) => (MOTIVOS_DE[tipo] || ['spam', 'inappropriate', 'other']).includes(v)).map(([v, l]) =>
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
  const salir = async () => {
    await sb.auth.signOut({ scope: 'local' });
    CONSENTIMIENTO = { id: null, ok: true, fecha: true, nueva: false, vigente: null };
    location.href = `${pre}/`;
  };
  // Ya los aceptó, pero una versión anterior (y sabemos su fecha, que
  // `accept_terms` necesita): solo aceptar la nueva, salir o eliminar la cuenta.
  if (CONSENTIMIENTO.nueva && CONSENTIMIENTO.fecha) {
    const doc = (ruta, texto) => `<li><a href="${pre}/${ruta}/" target="_blank" rel="noopener">${esc(t(texto))}</a></li>`;
    pinta(`
      <div class="ticket" style="text-align:left">
        <h1>${esc(t('Hemos actualizado los términos y la privacidad'))}</h1>
        <p class="muted">${esc(t('Hemos cambiado los términos de uso y la política de privacidad. Léelos y, si estás de acuerdo, acéptalos para seguir usando Klendar.'))}</p>
        <ul>
          ${doc(EN ? 'terms' : 'terminos', 'Términos de uso')}
          ${doc(EN ? 'privacy' : 'privacidad', 'Política de privacidad')}
          ${volverSeguro.startsWith('/panel/') ? doc(EN ? 'business-terms' : 'negocios', 'Condiciones para negocios') : ''}
        </ul>
        <p id="err" class="err" role="alert"></p>
        <p><button class="pill accent" id="seguir">${esc(t('Aceptar y seguir'))}</button></p>
        <p class="muted">${esc(t('Si no estás de acuerdo, puedes cerrar sesión o eliminar tu cuenta.'))}</p>
        <p class="acciones"><button class="pill" id="salir">${esc(t('Cerrar sesión'))}</button>
          <button class="pill peligro" id="borrar">${esc(t('Eliminar mi cuenta'))}</button></p>
      </div>`);
    $('#seguir').addEventListener('click', (ev) => {
      ocupado(ev.currentTarget, async () => {
        await llamar('accept_terms', { p_version: CONSENTIMIENTO.vigente || TERMINOS_VERSION, p_birth_date: null });
        CONSENTIMIENTO = { ...CONSENTIMIENTO, ok: true, nueva: false };
        toast(t('¡Listo! Ya puedes usar Klendar.'));
        if (volverSeguro) { location.href = volverSeguro; return; }
        vuelve(siguiente === 'ultimo-paso' ? '' : siguiente);
      });
    });
    $('#salir').onclick = salir;
    $('#borrar').addEventListener('click', async (ev) => {
      const boton = ev.currentTarget;
      if (!(await confirma({
        titulo: t('¿Eliminar tu cuenta?'),
        texto: t('Se borran para siempre tus datos, tus favoritos, tus planes y tus canjes. Si eres dueño de un negocio, también su ficha, sus publicaciones y su equipo. No se puede deshacer.'),
        aceptar: t('Eliminar'),
        peligro: true,
      }))) return;
      ocupado(boton, async () => {
        await llamar('delete_my_account', {});
        try { await sb.auth.signOut({ scope: 'local' }); } catch { /* la sesión ya no existe */ }
        CONSENTIMIENTO = { id: null, ok: true, fecha: true, nueva: false, vigente: null };
        pinta(`<div class="ticket"><p class="hecho-ic" aria-hidden="true">✓</p>
          <h1>${esc(t('Tu cuenta se ha eliminado'))}</h1>
          <p class="muted">${esc(t('Gracias por haber usado Klendar. Si algún día vuelves, aquí estaremos.'))}</p>
          <p><a class="pill accent" href="${pre}/">${esc(t('Ir al inicio'))}</a></p></div>`);
        I18N.translate(view);
      });
    });
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
        ${casillaTerminos()}
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
    if (!validaForm(f, { ...(pideFecha ? { birth: VALIDA.nacimiento } : {}), terms: VALIDA.terminos })) return;
    const nac = pideFecha ? f.birth.value : null;
    ocupado($('#seguir'), async () => {
      await llamar('accept_terms', { p_version: CONSENTIMIENTO.vigente || TERMINOS_VERSION, p_birth_date: nac });
      if (f.marketing.checked) await llamar('set_marketing_consent', { p_value: true });
      CONSENTIMIENTO = { ...CONSENTIMIENTO, id: YO.id, ok: true, fecha: true, nueva: false };
      toast(t('¡Listo! Ya puedes usar Klendar.'));
      if (volverSeguro) { location.href = volverSeguro; return; }
      vuelve(siguiente === 'ultimo-paso' ? '' : siguiente);
    });
  });
  $('#salir').onclick = salir;
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
