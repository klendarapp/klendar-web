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
    // Todas las columnas: `category_group` (el grupo del selector) solo existe
    // con la migración 20261114100000; sin ella, el grupo sale del slug.
    CATEGORIAS = await tabla(sb.from('categories').select('*').order('position'));
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
  // «… ya es RRPP de …», «Un RRPP lo deja»: a «RRPP» de ese negocio.
  if ((m = r.match(/^\/my-business\/([0-9a-f-]{36})\/promoters/i))) return `/panel/#/rrpp?biz=${m[1]}`;
  // «¿Te ha sobrado algo hoy?»: a «Antes de cerrar» de ese negocio.
  if ((m = r.match(/^\/my-business\/([0-9a-f-]{36})\?before_closing=1/i))) return `/panel/#/antes-de-cerrar?biz=${m[1]}`;
  // Grupos y Sorteos (tanda C): la bandeja de peticiones y los sorteos del
  // negocio, en el panel.
  if ((m = r.match(/^\/my-business\/([0-9a-f-]{36})\/groups/i))) return `/panel/#/grupos?biz=${m[1]}`;
  if ((m = r.match(/^\/my-business\/([0-9a-f-]{36})\/giveaways/i))) return `/panel/#/sorteos?biz=${m[1]}`;
  if (r.startsWith('/my-business')) return '/panel/';
  // «X te ha enviado una propuesta»: la petición. «¡Has ganado…!»: la página
  // del sorteo, que con tu sesión enseña lo tuyo.
  if ((m = r.match(/^\/groups\/requests\/([0-9a-f-]{36})/i))) return `#/grupos/${m[1]}`;
  if (r.startsWith('/groups/requests')) return '#/grupos';
  if (r.startsWith('/groups')) return EN ? '/en/groups/' : '/grupos/';
  if ((m = r.match(/^\/giveaways\/([0-9a-f-]{36})/i))) return `${EN ? '/en/giveaway/' : '/sorteo/'}${m[1]}`;
  if (r.startsWith('/giveaways')) return EN ? '/en/giveaways/' : '/sorteos/';
  // «¡Feliz cumpleaños!»: el regalo, con su QR.
  if ((m = r.match(/^\/gift\/([0-9a-f-]{36})/i))) return `#/regalo/${m[1]}`;
  // «… se ha cancelado»: la reserva, que sale como «Anulado».
  // Con `?offer=<id>`, ese código a la vista y resaltado.
  if ((m = r.match(/^\/my-redemptions\?offer=([0-9a-f-]{36})/i))) return `#/codigos?offer=${m[1]}`;
  if (r.startsWith('/my-redemptions')) return '#/codigos';
  // Bonos: «Bono cargado», pocos usos, caduca pronto… → ese bono.
  if ((m = r.match(/^\/passes\/([0-9a-f-]{36})/i))) return `#/bono/${m[1]}`;
  if (r.startsWith('/profile')) return '#/ajustes';
  // «Ana está en tus amigos»: tu lista de amigos.
  if (r.startsWith('/friends')) return '#/amigos';
  // «Te invitan a un equipo»: aceptarla o rechazarla.
  if (r.startsWith('/team-invites')) return '#/invitaciones';
  // «Te han pausado como RRPP», «Vuelves a ser RRPP»: tu lista de ese local.
  if ((m = r.match(/^\/promoter\/([0-9a-f-]{36})/i))) return `#/rrpp/${m[1]}`;
  // «Real Madrid – Barça, hoy a las 21:00»: la página pública del partido,
  // con los bares que lo ponen. «Equipos que sigues», a la suya.
  if (r.startsWith('/partidos/equipos')) return '#/equipos';
  if ((m = r.match(/^\/partidos\/([0-9a-f-]{36})/i))) return `${EN ? '/en/matches/' : '/partidos/'}${m[1]}`;
  if (r.startsWith('/partidos')) return EN ? '/en/matches/' : '/partidos/';
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

/** El botón de una notificación con `data.action`: «Ver mi código» (cambio de
 * fecha, pausa o +18 de algo que tienes reservado: el código, con «Ya no voy»)
 * o «Crear a partir de esta» (caducó mientras la revisábamos: al formulario
 * del panel, copiándola, en su negocio). Sin acción conocida, null. */
function accionAviso(d) {
  const uuid = /^[0-9a-f-]{36}$/i;
  if (d?.action === 'view_code' && uuid.test(d.offer_id || '')) {
    return { href: `#/codigo/${d.offer_id}`, txt: t('Ver mi código') };
  }
  if (d?.action === 'duplicate' && uuid.test(d.offer_id || '') && uuid.test(d.business_id || '')) {
    const nueva = d.offer_kind === 'future_event' ? 'nuevo-evento' : 'nueva-flash';
    return { href: `/panel/#/publicaciones/${nueva}?biz=${d.business_id}&from=${d.offer_id}`, txt: t('Crear a partir de esta') };
  }
  return null;
}

RUTAS.notificaciones = async () => {
  if (!exigeSesion('notificaciones')) return;
  await MARCA_LEIDAS; // las que se acaban de dar por vistas ya no salen como nuevas
  const lista = await tabla(sb.from('notifications')
    .select('id, kind, title, body, route, data, read_at, created_at')
    .order('created_at', { ascending: false }).limit(50));
  const nuevos = lista.filter((n) => !n.read_at).length;
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Notificaciones'))}</h1>
    ${lista.length ? `<p class="acciones">
      ${nuevos ? `<button class="pill" id="leidos">${esc(t('Marcar todo como leído'))}</button>` : ''}
      <a class="pill ghost" href="#/ajustes">${esc(t('Qué notificaciones recibo'))}</a>
    </p>` : ''}
    ${lista.length ? `<div class="avisos">${lista.map((n) => {
      // Con acción, toda la notificación lleva a ella y el botón lo dice.
      const accion = accionAviso(n.data);
      // Las de antes de que la ruta llevara `?offer=`: se completa con los datos.
      const ruta = n.route === '/my-redemptions' && /^[0-9a-f-]{36}$/i.test(n.data?.offer_id || '')
        ? `${n.route}?offer=${n.data.offer_id}` : n.route;
      const destino = accion?.href || destinoWeb(ruta);
      return `<a class="aviso${n.read_at ? '' : ' nuevo'}" href="${esc(destino || '#/notificaciones')}" data-id="${esc(n.id)}">
        <b>${esc(n.title)}</b>
        ${n.body ? `<span>${esc(n.body)}</span>` : ''}
        <small class="muted">${esc(fecha(n.created_at))}</small>
        ${accion ? `<span class="acciones"><span class="pill">${esc(accion.txt)}</span></span>` : ''}
      </a>`;
    }).join('')}</div>`
    : pantallaVacia({
      icono: 'notifications',
      titulo: t('Nada por aquí todavía'),
      texto: t('Añade negocios a favoritos y crea un «Avísame si…» para no perderte nada.'),
      botones: `<a class="pill" href="#/ajustes">${esc(t('Qué notificaciones recibo'))}</a>`,
    })}`);

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
    // «Ver mi código» viene de aquí, no de un enlace de fuera: el código se
    // enseña sin la pantalla de confirmar (`confirmaEnlace`).
    const ir = a.getAttribute('href') || '';
    if (ir.startsWith('#/codigo/')) marcaIntencion(ir.slice(2));
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
      <div class="aviso alerta alerta-fila${a.active ? '' : ' pausada'}">
        <a class="alerta-t" href="#/alerta/${esc(a.id)}"><b>${esc(a.label || t('Aviso'))}</b>
          <span>${esc(resumenAlerta(a, cats))}</span></a>
        <input type="checkbox" class="interruptor" role="switch" data-activo="${esc(a.id)}"${a.active ? ' checked' : ''}
          aria-label="${esc(EN ? `On: ${a.label || 'Alert'}` : `Activo: ${a.label || 'Aviso'}`)}">
        ${menuMas([
    { texto: t('Editar'), attrs: `data-edita="${esc(a.id)}"` },
    { texto: t('Borrar'), attrs: `data-borra="${esc(a.id)}"`, peligro: true },
  ], EN ? `More options: ${a.label || 'Alert'}` : `Más opciones: ${a.label || 'Aviso'}`)}
      </div>`).join('')}</div>`
    : `<p class="empty">${esc(t('Todavía no tienes avisos. Crea uno y te escribimos cuando salga algo que encaje: «sushi a menos de 1 km», «conciertos el finde».'))}</p>`}`);

  // Como la app: un interruptor para pausarlo; editar y borrar, en ⋮.
  $$('[data-activo]').forEach((caja) => caja.addEventListener('change', async () => {
    const a = lista.find((x) => x.id === caja.dataset.activo);
    caja.disabled = true;
    try {
      await llamar('save_offer_alert', paramsAlerta({ ...a, active: caja.checked }));
      a.active = caja.checked;
      caja.closest('.alerta')?.classList.toggle('pausada', !a.active);
      toast(a.active ? t('Aviso activado') : t('Aviso en pausa'));
    } catch (e) { caja.checked = !caja.checked; toast(e.message, true); } finally { caja.disabled = false; }
  }));
  $$('[data-edita]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/alerta/${b.dataset.edita}`; }));
  $$('[data-borra]').forEach((b) => b.addEventListener('click', async () => {
    // Como en la app: con su nombre y la salida de pausarlo.
    const nombre = lista.find((x) => x.id === b.dataset.borra)?.label || t('Aviso');
    if (!(await confirma({
      titulo: EN ? `Delete “${nombre}”?` : `¿Borrar «${nombre}»?`,
      texto: t('Dejaremos de avisarte de lo que encaje con él. Si solo quieres un descanso, páusalo.'),
      aceptar: t('Borrar'),
      peligro: true,
    }))) return;
    ocupado(b, async () => {
      await tabla(sb.from('offer_alerts').delete().eq('id', b.dataset.borra));
      toast(t('Aviso borrado'));
      navegar();
    });
  }));
};

/** Un aviso nuevo ya rellenado desde el final de Explorar
 * (`#/alerta/nueva?tipo=&cat=&precio=&descuento=&radio=&lat=&lng=`): los
 * filtros que se estaban mirando. Solo rellena el formulario; guardar sigue
 * siendo cosa de la persona. */
function alertaDesdeParams(params, cats) {
  const a = { radius_m: 1500, categories: [], active: true };
  if (!params || !params.has('origen')) return a;
  const tipo = params.get('tipo');
  if (tipo === 'flash_offer' || tipo === 'future_event') a.kind = tipo;
  const cat = cats.find((c) => c.slug === params.get('cat'));
  if (cat) a.categories = [cat.id];
  const precio = Number.parseInt(params.get('precio') || '', 10);
  if (Number.isFinite(precio) && precio >= 0) a.max_price_cents = precio;
  if (params.get('descuento') === '1') a.discount_only = true;
  const radio = Number.parseInt(params.get('radio') || '', 10);
  if (Number.isFinite(radio) && radio >= 500 && radio <= 25000) a.radius_m = radio;
  // La posición llega con 3 decimales (unos 100 m); un enlace de antes con más se redondea.
  const lat = Math.round(Number.parseFloat(params.get('lat') || '') * 1000) / 1000;
  const lng = Math.round(Number.parseFloat(params.get('lng') || '') * 1000) / 1000;
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    a.lat = lat; a.lng = lng; a.place_label = t('Aquí');
  }
  return a;
}

/** Dos avisos que piden lo mismo (la misma comparación que la app). Los de
 * zona fija valen iguales si el punto está a menos de ~200 m. */
const mismoAviso = (x, y) => {
  const cx = [...new Set(x.categories || [])].sort().join();
  const cy = [...new Set(y.categories || [])].sort().join();
  const fijo = (v) => v.lat != null && v.lng != null;
  const cerca = fijo(x) === fijo(y)
    && (!fijo(x) || (Math.abs(x.lat - y.lat) < 0.002 && Math.abs(x.lng - y.lng) < 0.002));
  return cx === cy && (x.kind || null) === (y.kind || null)
    && (x.max_price_cents ?? null) === (y.max_price_cents ?? null)
    && !!x.discount_only === !!y.discount_only && x.radius_m === y.radius_m && cerca;
};

RUTAS.alerta = async ([id], params, crudo) => {
  if (!exigeSesion(crudo || `alerta/${id || 'nueva'}`)) return;
  const [lista, cats] = await Promise.all([llamar('my_offer_alerts', {}), categorias()]);
  const a = (id && id !== 'nueva' && (lista || []).find((x) => x.id === id))
    || alertaDesdeParams(params, cats);
  // Desde Explorar: si ya hay uno igual, se dice (y se lleva a él).
  const igual = !a.id && params?.has('origen') ? (lista || []).find((x) => mismoAviso(x, a)) : null;
  // Hasta 10 km; uno que venga de más lejos (Explorar llega a 25) cabe.
  const maxRadio = a.radius_m > 10000 ? 25000 : 10000;
  pinta(`
    <p class="crumbs"><a href="#/alertas">${esc(t('Avísame si…'))}</a></p>
    <h1>${esc(a.id ? t('Editar aviso') : t('Nuevo aviso'))}</h1>
    ${igual ? `<div class="aviso alerta" role="status">
        <b>${esc(igual.active ? t('Ya tienes un aviso igual') : t('Ya tienes un aviso igual, en pausa'))}</b>
        <span>${esc(resumenAlerta(igual, cats))}</span>
        <span class="acciones"><a class="pill" href="#/alerta/${esc(igual.id)}">${esc(t('Ver el aviso'))}</a></span>
      </div>` : ''}
    <form class="formu" id="f" novalidate>
      <label>${esc(t('Nombre'))} <small>${esc(t('(opcional, p. ej. «sushi cerca de casa»)'))}</small>
        <input name="label" maxlength="60" value="${esc(a.label || '')}"></label>
      <div class="campo-cat"><p class="etq" aria-hidden="true">${esc(t('¿De qué?'))} <small>${esc(t('Sin elegir ninguna, de todo.'))}</small></p>
        <div id="cats-aviso"></div></div>
      <fieldset class="chips"><legend>${esc(t('¿Ofertas o eventos?'))}</legend>
        ${[['', t('Todo')], ['flash_offer', t('Ofertas flash')], ['future_event', t('Eventos')]].map(([v, l]) =>
          `<label><input type="radio" name="kind" value="${v}"${(a.kind || '') === v ? ' checked' : ''}> ${esc(l)}</label>`).join('')}
      </fieldset>
      <label>${esc(t('¿A cuánta distancia?'))} <output id="radio-txt">${esc(distancia(a.radius_m))}</output>
        <input type="range" name="radius" min="500" max="${maxRadio}" step="500" value="${esc(a.radius_m)}"></label>
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
  // El selector de categorías de toda la web (/assets/categorias.js).
  KlendarCategorias.campo($('#cats-aviso'), {
    cats, elegidas: a.categories || [], multiple: true, lang: EN ? 'en' : 'es', nombre: 'cat', titulo: t('¿De qué?'), vacio: t('Todo'),
  });
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
        categories: $$('input[name=cat]', f).map((x) => x.value),
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
/** El texto de «Mostrar los planes a los que he ido con cada amigo» según
 * «Que mis amigos vean mis planes» (`comparte`) y el propio interruptor. */
function textoPlanesJuntos(comparte, encendido) {
  if (!comparte) return t('Necesita «Que mis amigos vean mis planes»');
  return encendido
    ? t('En la ficha de cada amigo: «Habéis ido juntos a N planes». Solo el número, sin decir cuáles ni cuándo. Si uno de los dos lo apaga, no lo ve ninguno')
    : t('Nadie ve a cuántos planes habéis ido juntos, y tú tampoco lo ves en la ficha de tus amigos');
}

/** Copia de «Traducir publicaciones a mi idioma» para las fichas públicas
 * (`/assets/traducir.js` la lee sin sesión ni peticiones). */
function guardaTraduccionLocal(encendida) {
  try { localStorage.setItem('klendar.traducir', encendida ? '1' : '0'); } catch { /* sin permisos */ }
}

RUTAS.ajustes = async ([sub]) => {
  if (sub === 'notificaciones') return ajustesNotificaciones();
  if (sub === 'calendario') return ajustesCalendario();
  if (!exigeSesion('ajustes')) return;
  // Traducción automática: la preferencia (en el perfil, como en la app) y si
  // hay proveedor (sin clave en el servidor, «Llega pronto»).
  const traduccion = Promise.all([
    llamar('my_translation_settings', {}).catch(() => null),
    sb.functions.invoke('translate', { body: { op: 'status' } })
      .then(({ data }) => data?.available === true).catch(() => false),
  ]);
  const [perfil, cons, cuenta, metodos, cats, ciudades] = await Promise.all([
    tabla(sb.from('profiles').select('display_name, avatar_url, locale, birth_date').eq('id', YO.id).maybeSingle()),
    llamar('my_consents', {}),
    // Las formas de entrar, recién preguntadas (la sesión guardada puede ser
    // de antes de añadir una contraseña o de enlazar Google).
    sb.auth.getUser().then(({ data }) => data?.user || YO).catch(() => YO),
    // Si hay contraseña lo sabe la base: la identidad «email» existe también
    // en cuentas creadas con un código por correo.
    llamar('my_auth_methods', {}).catch(() => null),
    // «Lo que ves → Tus gustos»: lo de la cuenta, copiado aquí.
    categorias().catch(() => []),
    KlendarGustos.ciudades(),
    gustosDeLaCuenta(),
  ]);
  const vias = new Set((cuenta?.identities || []).map((i) => i.provider));
  const [trad, tradOk] = await traduccion;
  if (trad) guardaTraduccionLocal(trad.translate_content === true);
  const tieneClave = metodos?.has_password ?? vias.has('email');
  const metodo = (icono, texto, activa) => `<div class="fila metodo${activa ? '' : ' off'}">
      ${icono}<span class="fila-t"><b>${esc(texto)}</b></span>
      <span class="estado">${esc(activa ? t('Activa') : t('Sin usar'))}</span></div>`;
  const p = perfil || {};
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

    <div class="lista">
      ${fila({ href: '#/ajustes/notificaciones', icono: 'notifications', titulo: t('Notificaciones'), detalle: t('Qué te llega, cuándo y en el móvil') })}
      ${filaSvg({ href: '#/ajustes/calendario', icono: 'calendario', titulo: t('Tus planes en tu calendario'), detalle: t('Google Calendar, Apple y otros, siempre al día') })}
    </div>

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
          <input name="birth" type="date" ${LIMITES_NACIMIENTO()}></label>`}
        <label>${esc(t('Idioma'))} <small>${esc(t('De la web, la app y las notificaciones y correos que te enviamos'))}</small>
          <select name="idioma">
            <option value=""${!p.locale ? ' selected' : ''}>${esc(t('El del móvil o el navegador'))}</option>
            <option value="es"${p.locale === 'es' ? ' selected' : ''}>Español</option>
            <option value="en"${p.locale === 'en' ? ' selected' : ''}>English</option>
          </select></label>
        <label class="check"><input type="checkbox" name="traducir"${tradOk && trad?.translate_content ? ' checked' : ''}${tradOk ? '' : ' disabled'}>
          <span><b>${esc(t('Traducir publicaciones a mi idioma'))}</b><br><small>${esc(tradOk
    ? t('Lo que escriben los negocios (publicaciones, novedades, su ficha y su carta), traducido automáticamente al idioma de la web. Las reseñas y los nombres no se traducen. Solo se envían esos textos a un servicio de traducción, nunca datos tuyos.')
    : t('Llega pronto: lo que escriben los negocios, traducido automáticamente al idioma de la web.'))}</small></span></label>
        <p class="err" id="err-perfil" role="alert"></p>
        <button class="pill accent" id="g-perfil">${esc(t('Guardar'))}</button>
      </form>
    </section>

    <section class="bloque">
      <h2>${esc(t('Lo que ves'))}</h2>
      <div class="lista">
        ${fila({ href: '#/gustos', icono: 'favorite', titulo: t('Tus gustos'), detalle: resumenGustos(KlendarGustos.lee(), cats, ciudades), id: 'fila-gustos' })}
      </div>
      <p class="muted">${esc(t('Lo de esas categorías sale antes en Descubre, sin esconder lo demás. Tu ciudad sirve para avisarte cuando estés de viaje.'))}</p>
    </section>

    <section class="bloque" id="correo-cuenta"></section>

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
          <br>${[
    // Los tres textos que se aceptan, como en la app.
    [EN ? 'terms' : 'terminos', 'Términos de uso'],
    [EN ? 'privacy' : 'privacidad', 'Política de privacidad'],
    [EN ? 'community-guidelines' : 'normas', 'Normas de la comunidad'],
  ].map(([ruta, txt]) => `<a href="${pre}/${ruta}/" target="_blank" rel="noopener">${esc(t(txt))}</a>`).join(' · ')}</dd>
        <dt>${esc(t('Comunicaciones comerciales'))}</dt>
        <dd><label class="check"><input type="checkbox" id="marketing"${cons?.marketing_consent ? ' checked' : ''}>
          <span>${esc(cons?.marketing_consent ? `${t('Sí, desde el')} ${dia(cons.marketing_consent_at)}` : t('No recibes novedades ni promociones por correo'))}</span></label></dd>
        <dt>${esc(t('Estadísticas de uso de la app'))}</dt>
        <dd><label class="check"><input type="checkbox" id="estadisticas"${cons?.analytics_consent ? ' checked' : ''}>
          <span>${esc(cons?.analytics_consent ? `${t('Sí, desde el')} ${dia(cons.analytics_consent_at)}` : t('No mandamos estadísticas de cómo usas la app'))}</span></label></dd>
        <dt>${esc(t('Que mis amigos vean mis planes'))}</dt>
        <dd><label class="check"><input type="checkbox" id="compartir-planes"${cons?.share_plans !== false ? ' checked' : ''}>
          <span>${esc(t(cons?.share_plans !== false
            ? 'Tus amigos ven a qué vas («Voy», una plaza reservada o un código): en cada plan, en tu ficha de amigo y, si lo piden, con un aviso'
            : 'No sales en el «quién va» de tus amigos'))}</span></label></dd>
        <dt>${esc(t('Mostrar los planes a los que he ido con cada amigo'))}</dt>
        <dd><label class="check"><input type="checkbox" id="planes-juntos"${cons?.share_plans !== false && cons?.share_plans_together !== false ? ' checked' : ''}${cons?.share_plans === false ? ' disabled' : ''}>
          <span id="planes-juntos-texto">${esc(textoPlanesJuntos(cons?.share_plans !== false, cons?.share_plans_together !== false))}</span></label></dd>
        <dt>${esc(t('Ubicación'))}</dt>
        <dd id="dd-ubicacion">${cons?.location_consent_at ? `${esc(`${t('Compartida desde el')} ${dia(cons.location_consent_at)}`)}
          <button class="linkbtn" id="sin-ubicacion">${esc(t('Dejar de compartir'))}</button>` : esc(t('No guardamos tu posición'))}</dd>
        <dt>${esc(t('Personas bloqueadas'))}</dt>
        <dd id="dd-bloqueadas">${esc(t('Un momento…'))}</dd>
      </dl>
      <p><button class="pill" id="descargar">${ic('download')} ${esc(t('Descargar mis datos'))}</button></p>
      <p class="muted">${esc(t('Un archivo JSON con todo lo que Klendar guarda de ti (derecho de acceso y portabilidad).'))}</p>
      <p class="muted">${esc(t('Si no usas Klendar en 24 meses, te avisamos por correo; si sigues sin entrar, la cuenta se borra a los 36 meses. Basta con entrar una vez para conservarla.'))}</p>
    </section>

    <section class="bloque">
      <h2>${esc(t('Sesión y cuenta'))}</h2>
      <p class="acciones">
        <button class="pill" id="salir-todo">${esc(t('Cerrar sesión en todos los dispositivos'))}</button>
      </p>
      <p class="muted">${esc(t('Si entraste desde un móvil o un ordenador que no es tuyo, esto cierra la sesión también allí.'))}</p>
      <h3>${esc(t('Eliminar mi cuenta'))}</h3>
      <p class="muted">${esc(t('Se borran para siempre tus datos, tus favoritos, tus planes y tus canjes. Si eres propietario de un negocio, antes tendrás que darlo de baja o traspasarlo. No se puede deshacer.'))}</p>
      <p><button class="pill peligro" id="borrar">${esc(t('Eliminar mi cuenta'))}</button></p>
    </section>`);

  // Correo: con qué entras, «Cambiar correo» y el aviso si rebota (correo.js).
  correoSeccion($('#correo-cuenta'));

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
      if (!fp.elements.traducir.disabled) {
        const traducir = fp.elements.traducir.checked;
        await llamar('set_translate_content', { p_value: traducir });
        guardaTraduccionLocal(traducir);
      }
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

  // Privacidad
  pintaBloqueadas();
  $('#marketing').addEventListener('change', async (ev) => {
    const caja = ev.currentTarget;
    try {
      await llamar('set_marketing_consent', { p_value: caja.checked });
      toast(caja.checked ? t('Te mandaremos novedades de vez en cuando') : t('No te mandaremos más novedades'));
      // Solo cambia su texto: repintar Ajustes entero borraba lo que se
      // estuviera editando en el perfil.
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
  // nadie (ni por «Voy» ni por una plaza o un código). Y sin él tampoco vale
  // «Mostrar los planes a los que he ido con cada amigo» (sale apagado y
  // quieto, como en la app).
  let juntosEncendido = cons?.share_plans_together !== false;
  const pintaJuntos = (comparte) => {
    const caja = $('#planes-juntos');
    if (!caja) return;
    caja.checked = comparte && juntosEncendido;
    caja.disabled = !comparte;
    $('#planes-juntos-texto').textContent = textoPlanesJuntos(comparte, juntosEncendido);
  };
  $('#compartir-planes').addEventListener('change', async (ev) => {
    const caja = ev.currentTarget;
    caja.disabled = true;
    try {
      await llamar('set_share_plans', { p_value: caja.checked });
      const texto = caja.closest('label')?.querySelector('span');
      if (texto) {
        texto.textContent = caja.checked
          ? t('Tus amigos ven a qué vas («Voy», una plaza reservada o un código): en cada plan, en tu ficha de amigo y, si lo piden, con un aviso')
          : t('No sales en el «quién va» de tus amigos');
      }
      pintaJuntos(caja.checked);
    } catch (e) { caja.checked = !caja.checked; toast(e.message, true); } finally { caja.disabled = false; }
  });
  // «Habéis ido juntos a N planes» en la ficha de cada amigo: si uno de los
  // dos lo apaga, no lo ve ninguno.
  $('#planes-juntos').addEventListener('change', async (ev) => {
    const caja = ev.currentTarget;
    caja.disabled = true;
    try {
      await llamar('set_share_plans_together', { p_value: caja.checked });
      juntosEncendido = caja.checked;
      $('#planes-juntos-texto').textContent = textoPlanesJuntos(true, juntosEncendido);
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
    // estuviera escribiendo en el perfil.
    ocupado(boton, async () => {
      await llamar('revoke_location_consent', {});
      toast(t('Ya no guardamos tu posición'));
      const dd = $('#dd-ubicacion');
      if (dd) dd.textContent = t('No guardamos tu posición');
      // La base apaga también «Cerca de ti» (Ajustes → Notificaciones).
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
    // Dueño de un negocio: antes se borraba en cascada sin avisar a nadie. La
    // base ya no lo deja (`owns_business`); aquí se explica y se lleva allí.
    const propios = ((await llamar('my_businesses', {}).catch(() => [])) || []).filter((b) => b.role === 'owner');
    if (propios.length) {
      const nombres = propios.map((b) => b.name).join(', ');
      if (await confirma({
        titulo: t('Primero, tu negocio'),
        texto: EN ? `You own ${nombres}. Before deleting your account, take the business off Klendar or hand it over to someone on your team, under “Leave Klendar” in the dashboard.`
          : `Eres propietario de ${nombres}. Antes de eliminar tu cuenta, da de baja el negocio o traspásalo a alguien de tu equipo, en «Dar de baja el negocio» del panel.`,
        aceptar: t('Ir a mi negocio'),
      })) location.href = `/panel/${propios.length === 1 ? `#/baja?biz=${propios[0].id}` : ''}`;
      return;
    }
    // Lo que sigue vivo y se pierde (reservas, códigos, premios, sellos): se
    // dice antes. Al eliminar, la base anula las reservas y avisa a la lista
    // de espera (correo.js).
    const vivo = await cuentaVivaLineas();
    if (!(await confirma({
      ...(vivo.length ? { lista: [`${t('Ahora mismo tienes')}:`, ...vivo], pie: t(PIE_VIVO) } : {}),
      titulo: t('¿Eliminar tu cuenta?'),
      texto: t('Se borran para siempre tus datos, tus favoritos, tus planes y tus canjes. Si eres propietario de un negocio, antes tendrás que darlo de baja o traspasarlo. No se puede deshacer.'),
      aceptar: t('Eliminar'),
      peligro: true,
    }))) return;
    // La base no elimina sin «Confirma que eres tú» reciente.
    const id = await confirmaIdentidad();
    if (!id) return;
    await id.cerrar();
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

// ── Ajustes → Notificaciones ─────────────────────────────────────────────
/** Lo mismo y en el mismo orden que la app (Ajustes → Notificaciones): en el
 * móvil, de tus favoritos, de tus amigos, para ti, por correo y cuándo. Una
 * línea por fila y cada cambio se guarda solo (como el resto de Ajustes). */
async function ajustesNotificaciones() {
  if (!exigeSesion('ajustes/notificaciones')) return;
  const [prefs, cons, cats, negocios] = await Promise.all([
    llamar('my_notification_preferences', {}),
    llamar('my_consents', {}).catch(() => null),
    categorias(),
    llamar('my_businesses', {}).catch(() => []),
  ]);
  // El resumen del negocio solo le llega a quien lo lleva (dueño o encargado).
  const llevaNegocio = Array.isArray(negocios) && negocios.some((b) => ['owner', 'manager'].includes(b.role));
  const hora = (v) => (v ? String(v).slice(0, 5) : '');
  const sw = (nombre, titulo, encendido, detalle = '') => `
    <label class="fila fila-sw">
      <span class="fila-t"><b>${esc(t(titulo))}</b><small id="det-${nombre}"${detalle ? '' : ' hidden'}>${esc(detalle ? t(detalle) : '')}</small></span>
      <input type="checkbox" class="interruptor" role="switch" name="${nombre}"${encendido ? ' checked' : ''}>
    </label>`;
  const grupo = (titulo, filas) => `<h2 class="seccion-t">${esc(t(titulo))}</h2><div class="lista">${filas}</div>`;
  const dispositivos = cons?.push_devices || 0;
  const silencio = !!prefs.quiet_hours_start;
  const estadoMovil = (n) => (n
    ? `${t('Activadas')} · ${n} ${n === 1 ? t('dispositivo') : t('dispositivos')}`
    : t('Desactivadas: se activan desde la app'));

  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a> › <a href="#/ajustes">${esc(t('Ajustes'))}</a></p>
    <h1>${esc(t('Notificaciones'))}</h1>

    <div class="lista">
      <div class="fila fila-dato">
        <span class="fila-t"><b>${esc(t('En el móvil'))}</b><small id="push-estado">${esc(estadoMovil(dispositivos))}</small></span>
        ${dispositivos ? `<button type="button" class="pill" id="sin-push">${esc(t('Desactivar en todos'))}</button>` : ''}
      </div>
    </div>

    <form id="f-avisos" class="avisos" novalidate>
      ${grupo('De tus favoritos', [
    sw('fav', 'Publican algo nuevo', prefs.notify_favorites),
    sw('mensajes', 'Mensajes de los negocios', prefs.notify_business_messages !== false),
    sw('cumple', 'Regalo de cumpleaños', prefs.notify_birthday !== false),
    sw('sellos', 'Sellos y premios', prefs.notify_stamps !== false),
    sw('bonos', 'Tus bonos', prefs.notify_passes !== false, 'Pocos usos, caducidad y usos a mano'),
  ].join(''))}
      ${grupo('De tus amigos', [
    sw('amigos', 'Te invitan a un plan', prefs.notify_friend_invites !== false, prefs.notify_friend_invites === false ? 'Apagado, no te pueden invitar' : ''),
    sw('planesAmigos', 'Se apuntan a un evento', prefs.notify_friend_plans, 'Como mucho uno al día'),
  ].join(''))}
      ${grupo('Para ti', `${[
    sw('series', 'Series que sigues', prefs.notify_series !== false),
    // «Partidos de tus equipos» (encendido de serie), justo debajo, como la app.
    sw('equipos', KlendarEmisiones.t(EN ? 'en' : 'es').prefTeams, prefs.notify_teams !== false),
    // Grupos y empresas y Sorteos (tanda C), detrás de los partidos, como la app.
    sw('grupos', 'Grupos y empresas', prefs.notify_groups !== false, 'Respuestas a tus peticiones y, si tienes un negocio, peticiones nuevas'),
    sw('sorteos', 'Sorteos', prefs.notify_giveaways !== false, 'Resultados de los sorteos en los que participas. Si ganas, te avisamos siempre.'),
    sw('cerca', 'Ofertas flash cerca de ti', prefs.notify_nearby, 'Como mucho 3 al día'),
  ].join('')}
        <div id="cerca-mas"${prefs.notify_nearby ? '' : ' hidden'}>
          <fieldset class="fila radios-distancia"><legend class="sr">${esc(t('Distancia'))}</legend>
            ${[500, 1000, 2000, 5000].map((r) => `<label class="chip-radio"><input type="radio" name="radio" value="${r}"${(prefs.nearby_radius_m || 1000) === r ? ' checked' : ''}><span>${esc(distancia(r))}</span></label>`).join('')}
          </fieldset>
          <div class="fila fila-cats"><span class="fila-t"><b>${esc(t('Categorías'))}</b></span><span id="cats-cerca"></span></div>
        </div>`)}
      ${grupo('Por correo', [
    sw('semanal', 'Correo semanal (jueves)', prefs.weekly_email),
    llevaNegocio ? sw('negocio', 'Resumen de tu negocio (lunes)', prefs.business_email !== false) : '',
  ].join(''))}
      ${grupo('Cuándo', `${sw('silencio', 'Horas de silencio', silencio)}
        <div id="silencio-mas"${silencio ? '' : ' hidden'}>
          <label class="fila fila-hora"><span class="fila-t"><b>${esc(t('Desde'))}</b></span><input type="time" name="desde" value="${esc(hora(prefs.quiet_hours_start) || '23:00')}"></label>
          <label class="fila fila-hora"><span class="fila-t"><b>${esc(t('Hasta'))}</b></span><input type="time" name="hasta" value="${esc(hora(prefs.quiet_hours_end) || '08:00')}"></label>
        </div>`)}
      <p class="muted nota">${esc(t('Lo que llegue en ese tramo te lo mandamos al terminar.'))}</p>
      <p class="muted nota">${esc(t('Las notificaciones te llegan al móvil si tienes la app, y siempre las tienes aquí, en «Notificaciones».'))}</p>
    </form>`);

  const fa = $('#f-avisos');
  let elegidas = prefs.nearby_categories || [];

  // Se guarda solo, medio segundo después del último cambio (como la app).
  let espera = null;
  let pendiente = false;
  const enviar = async () => {
    pendiente = false;
    const el = fa.elements;
    const conSilencio = el.silencio.checked && el.desde.value && el.hasta.value;
    try {
      await llamar('update_notification_preferences', { p: {
        notify_favorites: el.fav.checked,
        notify_business_messages: el.mensajes.checked,
        notify_birthday: el.cumple.checked,
        notify_stamps: el.sellos.checked,
        notify_passes: el.bonos.checked,
        notify_friend_invites: el.amigos.checked,
        notify_friend_plans: el.planesAmigos.checked,
        notify_series: el.series.checked,
        notify_teams: el.equipos.checked,
        notify_groups: el.grupos.checked,
        notify_giveaways: el.sorteos.checked,
        notify_nearby: el.cerca.checked,
        nearby_radius_m: Number(fa.querySelector('input[name=radio]:checked')?.value || 1000),
        nearby_categories: elegidas.length ? elegidas : null,
        weekly_email: el.semanal.checked,
        ...(el.negocio ? { business_email: el.negocio.checked } : {}),
        quiet_hours_start: conSilencio ? el.desde.value : null,
        quiet_hours_end: conSilencio ? el.hasta.value : null,
      } });
      toast(t('Guardado'));
    } catch (e) { toast(e.message, true); }
  };
  const guarda = () => {
    clearTimeout(espera);
    pendiente = true;
    espera = setTimeout(enviar, 500);
  };
  // Irse justo después de tocar algo no lo pierde.
  alSalir(() => { clearTimeout(espera); if (pendiente) enviar(); });

  // «Cerca de ti»: el selector de categorías de toda la web.
  KlendarCategorias.campo($('#cats-cerca'), {
    cats, elegidas, multiple: true, lang: EN ? 'en' : 'es', titulo: t('Categorías'), vacio: t('Todas'),
    alCambiar: (v) => { elegidas = v; guarda(); },
  });

  fa.addEventListener('change', (ev) => {
    const el = fa.elements;
    if (ev.target === el.cerca) $('#cerca-mas').hidden = !el.cerca.checked;
    if (ev.target === el.silencio) $('#silencio-mas').hidden = !el.silencio.checked;
    if (ev.target === el.amigos) {
      const det = $('#det-amigos');
      det.textContent = el.amigos.checked ? '' : t('Apagado, no te pueden invitar');
      det.hidden = el.amigos.checked;
    }
    guarda();
  });
  fa.addEventListener('submit', (ev) => ev.preventDefault());

  $('#sin-push')?.addEventListener('click', async (ev) => {
    const boton = ev.currentTarget;
    if (!(await confirma({
      titulo: t('¿Desactivar en todos tus dispositivos?'),
      texto: t('Dejarán de llegar a todos los móviles y tabletas donde tengas Klendar. Las seguirás teniendo en «Notificaciones», y puedes volver a activarlas desde la app en cada uno.'),
      aceptar: t('Desactivar en todos'),
    }))) return;
    ocupado(boton, async () => {
      await llamar('revoke_push', {});
      toast(t('Notificaciones del móvil desactivadas'));
      $('#push-estado').textContent = estadoMovil(0);
      boton.remove();
    });
  });
}

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

RUTAS.sugerencias = async (_p, params, crudo) => {
  // Con el texto ya empezado (`?texto=`, p. ej. «Recomiéndanos un negocio»
  // desde Explorar), también después de entrar.
  if (!exigeSesion(crudo || 'sugerencias')) return;
  const empezado = (params?.get('texto') || '').slice(0, 300);
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
        <textarea name="msg" rows="6" maxlength="2000" placeholder="${esc(t(TIPOS_SUGERENCIA[0][2]))}">${esc(empezado)}</textarea></label>
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
        p_app_version: 'web', p_locale: EN ? 'en' : 'es', p_route: document.referrer
          // Solo la ruta, y sin el código de un enlace personal (/amigo/…).
          ? new URL(document.referrer).pathname.replace(/(\/(en\/)?(amigo|friend|r|baja|unsubscribe|v|cartel\/local|poster\/venue))\/[\w-]{6,}/g, '$1/*')
          : null,
      });
      toast(t('¡Gracias! Lo hemos recibido. Si necesitamos más detalles, te escribimos.'));
      navegar();
    });
  });
};

// ── Tu nombre público ─────────────────────────────────────────────────────
// Sin nombre, en las reseñas y para tus amigos sales como «Usuario de
// Klendar» (antes salía lo de antes de la @ de tu correo). Al escribir una
// reseña o compartir tu enlace de amigo se sugiere ponerlo.

/** El nombre que ven los demás; `null` si aún no tiene; `undefined` si no se
 * ha podido mirar (entonces no se sugiere nada). */
async function nombrePublico() {
  try {
    const fila = await tabla(sb.from('profiles').select('display_name').eq('id', YO.id).maybeSingle());
    return String(fila?.display_name || '').trim() || null;
  } catch { return undefined; }
}

async function guardaNombrePublico(nombre) {
  const n = String(nombre || '').trim().slice(0, 40);
  if (!n) return;
  await tabla(sb.from('profiles').update({ display_name: n }).eq('id', YO.id));
  // Como «Editar perfil»: también en la cuenta (lo que lee la cabecera).
  await sb.auth.updateUser({ data: { display_name: n } }).catch(() => {});
}

/** El nombre que traen los datos de la cuenta (el de Google o Apple), para
 * rellenar «¿Cómo te llamas?». Nunca el correo. */
function nombreSugerido(meta) {
  const limpio = (v) => { const x = typeof v === 'string' ? v.trim() : ''; return x.includes('@') ? '' : x; };
  const m = meta || {};
  const n = limpio(m.display_name) || limpio(m.full_name) || limpio(m.name)
    || limpio([limpio(m.given_name), limpio(m.family_name)].join(' '));
  return n.slice(0, 40).trim();
}

const campoNombrePublico = () => `
      <label>${esc(t('Tu nombre'))} <small>${esc(t('(opcional) Sin nombre, sales como «Usuario de Klendar». Nunca enseñamos tu correo.'))}</small>
        <input name="nombre" maxlength="40" autocomplete="name"></label>`;

// ── Reseñas ───────────────────────────────────────────────────────────────
// Con hasta 6 fotos y vídeos (klendar/docs/RESENAS_MEDIOS.md, migración
// 20261104100000): se suben al elegirlos (`reviews/<tu id>/`), se quitan y se
// reordenan, y al publicar se manda la lista entera y en orden (`p_media`).
// Las fotos, reducidas y sin EXIF (assets/fotos.js); los vídeos, sin dónde se
// grabaron (app/medios.js), con su duración y su fotograma.
Object.assign(ERRORES, {
  too_many_media: 'Como mucho 6 fotos y vídeos.',
  video_too_long: 'El vídeo dura más de 30 segundos.',
  media_too_big: 'El archivo pesa demasiado (foto 10 MB, vídeo 60 MB).',
  media_type_mismatch: 'Ese archivo no es una foto o un vídeo que podamos usar.',
  media_not_found: 'No se ha terminado de subir: vuelve a intentarlo.',
  video_duration_required: 'No hemos podido medir el vídeo. Prueba con otro.',
  media_invalid: 'Algo no ha ido bien con las fotos y vídeos. Vuelve a probar.',
});

/** Los límites (los da la base; estos, si no contesta). */
const LIM_MEDIOS = { max: 6, videoSeg: 30, videoBytes: 60 * 1024 * 1024, fotoBytes: 10 * 1024 * 1024 };
async function limitesMedios() {
  try {
    const l = await llamar('review_media_limits');
    if (l && l.max_items) {
      Object.assign(LIM_MEDIOS, {
        max: Number(l.max_items), videoSeg: Number(l.video_max_seconds),
        videoBytes: Number(l.video_max_bytes), fotoBytes: Number(l.photo_max_bytes),
      });
    }
  } catch { /* los de arriba */ }
  return LIM_MEDIOS;
}

/** Sube un fichero a tu carpeta de reseñas y devuelve su dirección pública. */
async function subeAResenas(nombre, blob, tipo) {
  const ruta = `reviews/${YO.id}/${nombre}`;
  const { error } = await sb.storage.from('business-images').upload(ruta, blob, { contentType: tipo });
  if (error) throw Object.assign(new Error(amable(error.message)), { clave: error.message });
  return sb.storage.from('business-images').getPublicUrl(ruta).data.publicUrl;
}

/** Una foto o un vídeo elegido, listo para la reseña: `{ url, kind, … }`. */
async function preparaMedio(archivo) {
  const id = crypto.randomUUID();
  const esVideo = /^video\//.test(archivo.type) || /\.(mp4|mov|m4v)$/i.test(archivo.name || '');
  if (esVideo) {
    const tipo = /quicktime/.test(archivo.type) || /\.mov$/i.test(archivo.name || '') ? 'video/quicktime' : 'video/mp4';
    if (archivo.type && !/^video\/(mp4|quicktime)$/.test(archivo.type)) throw new Error(t(ERRORES.media_type_mismatch));
    if (archivo.size > LIM_MEDIOS.videoBytes) throw new Error(t('El vídeo pesa más de 60 MB.'));
    const d = await KMedios.datos(archivo);
    if (!d || !d.duracion) throw new Error(t('Ese vídeo no se puede abrir. Prueba con un MP4.'));
    if (d.duracion > LIM_MEDIOS.videoSeg + 0.5) throw new Error(t(ERRORES.video_too_long));
    const { blob, limpio } = await KMedios.limpia(archivo, tipo);
    const url = await subeAResenas(`${id}.${tipo === 'video/quicktime' ? 'mov' : 'mp4'}`, blob, tipo);
    const poster = d.portada ? await subeAResenas(`${id}-poster.jpg`, d.portada, 'image/jpeg').catch(() => null) : null;
    return {
      url, kind: 'video', poster_url: poster, width: d.ancho, height: d.alto,
      duration_ms: Math.round(d.duracion * 1000), limpio,
    };
  }
  if (archivo.size > 20 * 1024 * 1024) throw new Error(t('La foto pesa demasiado. Prueba con otra más pequeña.'));
  const blob = await KFotos.reduce(archivo, KFotos.TAM.resena);
  if (!/^image\/(jpeg|png|webp)$/.test(blob.type)) throw new Error(t('Esa imagen no se puede abrir. Prueba con una foto JPG o PNG.'));
  if (blob.size > LIM_MEDIOS.fotoBytes) throw new Error(t('La foto pesa demasiado. Prueba con otra más pequeña.'));
  const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1];
  return { url: await subeAResenas(`${id}.${ext}`, blob, blob.type), kind: 'photo' };
}

/** «0:12»: lo que dura un vídeo. */
const duracionMedio = (ms) => {
  const sg = Math.max(1, Math.round(ms / 1000));
  return `${Math.floor(sg / 60)}:${String(sg % 60).padStart(2, '0')}`;
};

/** «Foto 2 de 3» / «Vídeo 1 de 3». */
const nombreMedio = (m, i, n) => (EN
  ? `${m.kind === 'video' ? 'Video' : 'Photo'} ${i + 1} of ${n}`
  : `${m.kind === 'video' ? 'Vídeo' : 'Foto'} ${i + 1} de ${n}`);

// Iconos de la lista (en SVG: la fuente de iconos de «Tu cuenta» va recortada).
const IC_MEDIO = {
  izq: 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  der: 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z',
  quitar: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  play: 'M8 5v14l11-7z',
};
const icMedio = (n, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="${IC_MEDIO[n]}"/></svg>`;

RUTAS.opinar = async ([id]) => {
  if (!exigeSesion(`opinar/${id}`)) return;
  const [fila, propia, miNombre] = await Promise.all([
    llamar('business_profile', { p_id: id }),
    // La tuya con sus fotos y vídeos; sin `my_review` (base anterior), de la lista.
    llamar('my_review', { p_business: id }).catch(() => undefined),
    nombrePublico(),
    limitesMedios(),
  ]);
  const b = Array.isArray(fila) ? fila[0] : fila;
  if (!b) { pinta(pantallaVacia({ icono: 'storefront', titulo: t('Ese sitio ya no está en Klendar.'), h: 'h1', botones: botonTuCuenta() })); return; }
  let mia = propia || {};
  if (propia === undefined) {
    const resenas = await llamar('business_reviews', { p_id: id, p_limit: 50 }).catch(() => []);
    mia = (resenas || []).find((r) => r.is_mine)
      || (b.my_rating ? { id: true, rating: b.my_rating, comment: b.my_comment, photo_url: b.my_photo_url } : {});
  }
  // Lo que ya tenía: `media` o, en una reseña de antes, su foto.
  let medios = Array.isArray(mia.media)
    ? mia.media.map((m) => ({ url: m.url, kind: m.kind, poster_url: m.poster_url, width: m.width, height: m.height, duration_ms: m.duration_ms, in_review: m.in_review }))
    : (mia.photo_url ? [{ url: mia.photo_url, kind: 'photo' }] : []);
  const tactil = window.matchMedia('(pointer: coarse)').matches;
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
      <fieldset class="medios-resena"><legend>${esc(t('Fotos y vídeos'))} <small class="muted" id="mCuenta"></small></legend>
        <ul class="medios-lista" id="mLista"></ul>
        <p class="medios-add" id="mAdd">
          <button type="button" class="pill" data-elige="mElige">${esc(t('Añadir fotos o vídeos'))}</button>
          ${tactil ? `<button type="button" class="pill" data-elige="mFoto">${esc(t('Hacer una foto'))}</button>
          <button type="button" class="pill" data-elige="mVideo">${esc(t('Grabar un vídeo'))}</button>` : ''}
        </p>
        <input type="file" id="mElige" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime" multiple hidden>
        <input type="file" id="mFoto" accept="image/*" capture="environment" hidden>
        <input type="file" id="mVideo" accept="video/*" capture="environment" hidden>
        <p class="muted pie-form">${esc(t('Hasta 6 fotos y vídeos; cada vídeo, de 30 segundos como mucho. Les quitamos dónde se hicieron y con qué móvil.'))}</p>
        <p class="sr" id="mVivo" aria-live="polite"></p>
      </fieldset>
      ${miNombre === null ? campoNombrePublico() : ''}
      <p class="muted">${esc(t('Tu nombre y tu foto de perfil salen junto a la reseña. Sigue las normas de la comunidad: sin insultos ni datos de nadie.'))}</p>
      <p class="err" id="err" role="alert"></p>
      <button class="pill accent" id="publicar">${esc(t('Publicar'))}</button>
    </form>`);
  const f = $('#f');
  const subiendo = () => medios.some((m) => m.subiendo);
  const vivo = (txt) => { $('#mVivo').textContent = txt; };

  const pintaMedios = (foco) => {
    const n = medios.length;
    $('#mCuenta').textContent = EN ? `${n} of ${LIM_MEDIOS.max}` : `${n} de ${LIM_MEDIOS.max}`;
    $('#mLista').innerHTML = medios.map((m, i) => {
      const nombre = nombreMedio(m, i, n);
      const vista = m.subiendo
        ? `<span class="medio-sube">${esc(t('Subiendo…'))}</span>`
        : m.kind === 'video'
          ? `${m.poster_url ? `<img src="${esc(m.poster_url)}" alt="">` : `<video src="${esc(m.url)}#t=0.1" muted playsinline preload="metadata" aria-hidden="true"></video>`}
            <span class="medio-play">${icMedio('play', 16)}</span>${m.duration_ms ? `<span class="medio-dur">${esc(duracionMedio(m.duration_ms))}</span>` : ''}`
          : `<img src="${esc(m.local || m.url)}" alt="">`;
      return `<li class="medio${m.subiendo ? ' subiendo' : ''}" data-i="${i}"${m.subiendo ? '' : ' draggable="true"'}>
        <span class="medio-vista" role="img" aria-label="${esc(nombre)}">${vista}${m.in_review ? `<span class="medio-rev">${esc(t('En revisión'))}</span>` : ''}</span>
        <span class="medio-botones">
          <button type="button" data-mv="-1" aria-label="${esc(`${t('Mover antes')}: ${nombre}`)}" title="${esc(t('Mover antes'))}"${i === 0 || m.subiendo ? ' disabled' : ''}>${icMedio('izq')}</button>
          <button type="button" data-mv="1" aria-label="${esc(`${t('Mover después')}: ${nombre}`)}" title="${esc(t('Mover después'))}"${i === n - 1 || m.subiendo ? ' disabled' : ''}>${icMedio('der')}</button>
          <button type="button" data-quita aria-label="${esc(`${t('Quitar')}: ${nombre}`)}" title="${esc(t('Quitar'))}"${m.subiendo ? ' disabled' : ''}>${icMedio('quitar')}</button>
        </span>
      </li>`;
    }).join('');
    const lleno = n >= LIM_MEDIOS.max;
    $$('#mAdd [data-elige]').forEach((btn) => { btn.disabled = lleno; });
    $('#publicar').disabled = subiendo();
    if (foco) $(foco)?.focus();
  };

  const mueve = (i, d, sel) => {
    const j = i + d;
    if (j < 0 || j >= medios.length) return;
    [medios[i], medios[j]] = [medios[j], medios[i]];
    pintaMedios(`#mLista [data-i="${j}"] ${sel}`);
    vivo(EN ? `Moved: now ${j + 1} of ${medios.length}` : `Movida: ahora es la ${j + 1} de ${medios.length}`);
  };
  $('#mLista').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    const li = btn?.closest('.medio');
    if (!btn || !li) return;
    const i = Number(li.dataset.i);
    if (btn.hasAttribute('data-quita')) {
      const quitada = medios.splice(i, 1)[0];
      if (quitada?.local) URL.revokeObjectURL(quitada.local);
      pintaMedios(medios.length ? `#mLista [data-i="${Math.min(i, medios.length - 1)}"] [data-quita]` : '#mAdd [data-elige]');
      vivo(t('Quitada'));
      return;
    }
    if (btn.dataset.mv) mueve(i, Number(btn.dataset.mv), `[data-mv="${btn.dataset.mv}"]`);
  });
  // Arrastrar para ordenar (con ratón; en el móvil y con el teclado, las flechas).
  let arrastrada = null;
  $('#mLista').addEventListener('dragstart', (e) => {
    const li = e.target.closest('.medio');
    if (!li) return;
    arrastrada = Number(li.dataset.i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(arrastrada));
  });
  $('#mLista').addEventListener('dragover', (e) => { if (arrastrada != null) e.preventDefault(); });
  $('#mLista').addEventListener('drop', (e) => {
    const li = e.target.closest('.medio');
    if (arrastrada == null || !li) return;
    e.preventDefault();
    const destino = Number(li.dataset.i);
    const [m] = medios.splice(arrastrada, 1);
    medios.splice(destino, 0, m);
    arrastrada = null;
    pintaMedios();
  });
  $('#mLista').addEventListener('dragend', () => { arrastrada = null; });

  $$('#mAdd [data-elige]').forEach((btn) => { btn.onclick = () => $(`#${btn.dataset.elige}`).click(); });
  const alElegir = async (input) => {
    const libres = LIM_MEDIOS.max - medios.length;
    const elegidos = [...input.files];
    input.value = '';
    if (!elegidos.length) return;
    if (elegidos.length > libres) toast(t('Como mucho 6 fotos y vídeos.'), true);
    const tanda = elegidos.slice(0, Math.max(0, libres)).map((archivo) => {
      const m = { kind: /^video\//.test(archivo.type) ? 'video' : 'photo', subiendo: true };
      medios.push(m);
      return [m, archivo];
    });
    pintaMedios();
    let sinLimpiar = false;
    await Promise.all(tanda.map(async ([m, archivo]) => {
      try {
        const listo = await preparaMedio(archivo);
        if (listo.limpio === false) sinLimpiar = true;
        delete listo.limpio;
        Object.assign(m, listo, { subiendo: false });
        if (m.kind === 'photo') m.local = URL.createObjectURL(archivo);
      } catch (e) {
        medios = medios.filter((x) => x !== m);
        toast(`${archivo.name ? `${archivo.name}: ` : ''}${e.message || amable('')}`, true);
      }
      if (f.isConnected) pintaMedios();
    }));
    if (sinLimpiar) toast(t('No hemos podido quitar del vídeo dónde se grabó. Si no quieres que se sepa, súbelo desde la app.'), true);
    if (f.isConnected) vivo(EN ? `${medios.length} of ${LIM_MEDIOS.max}` : `${medios.length} de ${LIM_MEDIOS.max}`);
  };
  ['#mElige', '#mFoto', '#mVideo'].forEach((s) => { $(s).addEventListener('change', (e) => alElegir(e.target)); });
  pintaMedios();

  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const nota = Number(f.nota.value);
    if (!nota) { $('#err').textContent = t('Elige de una a cinco estrellas.'); return; }
    if (subiendo()) { $('#err').textContent = t('Espera a que terminen de subirse las fotos y vídeos.'); return; }
    $('#err').textContent = '';
    ocupado($('#publicar'), async () => {
      if (f.nombre?.value.trim()) await guardaNombrePublico(f.nombre.value);
      const res = await llamar('upsert_review', {
        p_business_id: id, p_rating: nota, p_comment: f.texto.value.trim() || null,
        p_media: medios.map((m) => {
          const x = { url: m.url, kind: m.kind };
          if (m.kind === 'video') {
            if (m.poster_url) x.poster_url = m.poster_url;
            if (m.duration_ms) x.duration_ms = m.duration_ms;
          }
          if (m.width) x.width = m.width;
          if (m.height) x.height = m.height;
          return x;
        }),
      });
      medios.forEach((m) => { if (m.local) URL.revokeObjectURL(m.local); });
      // Con lenguaje ofensivo queda en revisión: hasta entonces solo la ves tú.
      const enRevision = res && typeof res === 'object' && 'in_review' in res ? Boolean(res.in_review)
        : (await tabla(sb.from('reviews').select('moderation_status')
          .eq('business_id', id).eq('user_id', YO.id).maybeSingle()).catch(() => null))?.moderation_status === 'pending';
      hecho({
        titulo: enRevision ? t('Tu reseña está en revisión') : t('Reseña publicada. ¡Gracias!'),
        texto: enRevision
          ? t('Se publicará cuando la revisemos: puede contener lenguaje ofensivo. Normalmente en menos de 24 h.')
          : t('Ayuda a otros a decidirse y al sitio a mejorar.'),
        volver: `${pre}/b/${encodeURIComponent(id)}#resenas`, volverTxt: t('Volver al sitio'),
        lista: '#/', listaTxt: t('Tu cuenta'),
      });
    });
  });
};

// ── ¿Es tu negocio? ───────────────────────────────────────────────────────
// Pedir la propiedad de una ficha que creó otra persona (migración
// 20261029100001): cuenta y 18 años, cargo, teléfono o correo del negocio,
// una prueba (foto o PDF al Storage privado `business-claims`, o un texto) y
// la declaración. Lo revisa administración; igual que en la app.

Object.assign(ERRORES, {
  invalid_role: 'Escribe tu cargo (de 2 a 60 caracteres).',
  contact_required: 'Pon el teléfono o el correo del negocio.',
  invalid_phone: 'Ese teléfono no parece válido.',
  invalid_email: 'Ese correo no parece válido.',
  proof_required: 'Añade una foto o cuéntanos cómo comprobarlo (20 caracteres o más).',
  invalid_proof: 'Añade una foto o cuéntanos cómo comprobarlo (20 caracteres o más).',
  declaration_required: 'Marca la declaración para enviarla.',
  adult_required: 'Para reclamar un negocio hace falta tener 18 años o más (y la fecha de nacimiento en tu perfil).',
  too_many_pending: 'Ya tienes 3 reclamaciones en revisión. Espera a que las resolvamos.',
  business_busy: 'Este negocio ya tiene varias reclamaciones en revisión. Escríbenos a info@klendar.app.',
  already_pending: 'Ya tienes una reclamación de este negocio en revisión.',
  already_owner: 'Ya eres el propietario de este negocio.',
});

const TEL_RECLAMAR = /^\+?[0-9][0-9 ().-]{5,23}$/;

/** Sube la prueba a tu carpeta privada y devuelve su ruta en el bucket. Las
 * fotos se reducen como las demás (sin GPS ni datos del móvil); un PDF va tal
 * cual, como mucho 10 MB. */
async function subePrueba(archivo) {
  if (!archivo) return null;
  const pdf = archivo.type === 'application/pdf';
  let blob = archivo;
  if (!pdf) {
    if (archivo.size > 20 * 1024 * 1024) throw new Error(t('La foto pesa demasiado. Prueba con otra más pequeña.'));
    blob = await KFotos.reduce(archivo, KFotos.TAM.resena);
    if (!/^image\/(jpeg|png|webp)$/.test(blob.type)) {
      throw new Error(t('Esa imagen no se puede abrir. Prueba con una foto JPG o PNG.'));
    }
  } else if (archivo.size > 10 * 1024 * 1024) {
    throw new Error(t('El PDF pesa demasiado: como mucho 10 MB.'));
  }
  const ext = pdf ? 'pdf' : blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1];
  const ruta = `${YO.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('business-claims').upload(ruta, blob, { contentType: blob.type });
  if (error) throw Object.assign(new Error(amable(error.message)), { clave: error.message });
  return ruta;
}

RUTAS.reclamar = async ([id]) => {
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) { pinta(pantallaVacia({ icono: 'storefront', titulo: t('Ese sitio ya no está en Klendar.'), h: 'h1', botones: botonTuCuenta() })); return; }
  if (!exigeSesion(`reclamar/${id}`)) return;
  const [fila, estado] = await Promise.all([
    llamar('business_profile', { p_id: id }),
    llamar('my_business_claim', { p_business: id }),
  ]);
  const b = Array.isArray(fila) ? fila[0] : fila;
  if (!b) { pinta(pantallaVacia({ icono: 'storefront', titulo: t('Ese sitio ya no está en Klendar.'), h: 'h1', botones: botonTuCuenta() })); return; }
  const ficha = `${pre}/b/${encodeURIComponent(id)}`;
  const cabeza = `
    <p class="crumbs"><a href="${ficha}">${esc(b.name)}</a></p>
    <h1>${esc(t('¿Es tu negocio?'))}</h1>`;
  const dia = (iso) => fecha(iso, { day: 'numeric', month: 'long', year: 'numeric' });

  if (!estado.can_claim) {
    const c = estado.claim || {};
    let titulo = t('¿Es tu negocio?');
    let texto = t('Algo no ha ido bien. Si vuelve a pasar, escríbenos a info@klendar.app.');
    if (estado.why === 'already_pending') {
      titulo = t('Reclamación en revisión');
      texto = t('La enviaste el {fecha}. La revisamos a mano, normalmente en unos días, y te avisaremos con lo que decidamos.').replace('{fecha}', dia(c.created_at));
    } else if (estado.why === 'recently_rejected') {
      titulo = t('No hemos podido confirmarlo');
      texto = [c.reason ? `${t('Motivo:')} ${c.reason}` : '',
        estado.retry_after ? t('Puedes volver a intentarlo con más pruebas a partir del {fecha}.').replace('{fecha}', dia(estado.retry_after)) : '']
        .filter(Boolean).join(' ');
    } else if (estado.why === 'already_owner') {
      titulo = t('Ya eres el propietario de este negocio.');
      texto = '';
    } else if (estado.why === 'adult_required') {
      texto = t('Para reclamar un negocio hace falta tener 18 años o más (y la fecha de nacimiento en tu perfil).');
    } else if (estado.why === 'not_found') {
      texto = t('Ese sitio ya no está en Klendar.');
    }
    pinta(`${cabeza}
      <h2>${esc(titulo)}</h2>${texto ? `<p class="muted">${esc(texto)}</p>` : ''}
      ${estado.why === 'already_pending' && c.id ? `<p><button class="pill" id="retirar">${esc(t('Retirar la reclamación'))}</button></p>` : ''}
      <p><a class="pill" href="${ficha}">${esc(t('Volver al sitio'))}</a></p>`);
    const r = $('#retirar');
    if (r) {
      r.onclick = () => ocupado(r, async () => {
        if (!await confirma({ titulo: t('¿Retirar la reclamación?'), texto: t('Dejaremos de revisarla. Podrás volver a enviarla cuando quieras.'), aceptar: t('Retirar la reclamación') })) return;
        await llamar('withdraw_business_claim', { p_id: c.id });
        toast(t('Reclamación retirada'));
        navegar();
      });
    }
    return;
  }

  pinta(`${cabeza}
    <p class="muted">${esc(t('¿Lo llevas tú y la ficha la creó otra persona? Pide su propiedad: lo comprobamos a mano y te avisamos.'))}</p>
    <form class="formu" id="f" novalidate>
      <label>${esc(t('Tu cargo'))}
        <input name="rol" maxlength="60" required autocomplete="organization-title" placeholder="${esc(t('Propietaria, gerente, encargado…'))}"></label>
      <label>${esc(t('Teléfono del negocio'))}
        <input name="tel" type="tel" maxlength="25" autocomplete="tel"></label>
      <label>${esc(t('Correo del negocio'))}
        <input name="mail" type="email" maxlength="254" autocomplete="email"></label>
      <p class="muted">${esc(t('Al menos uno. Puede que lo usemos para comprobarlo.'))}</p>
      <fieldset><legend>${esc(t('Prueba'))}</legend>
        <p class="muted">${esc(t('Una foto o un PDF (licencia de apertura, factura a nombre del negocio, alta en Hacienda…) o cómo podemos comprobarlo. Basta con una.'))}</p>
        <div class="foto-fila">
          <img id="prev" alt="" hidden>
          <span id="pdf" class="muted" hidden></span>
          <label class="pill">${esc(t('Añadir una foto o un PDF'))}<input type="file" name="prueba" accept="image/*,application/pdf" hidden></label>
          <button type="button" class="linkbtn" id="quita" hidden>${esc(t('Quitar'))}</button>
        </div>
        <label>${esc(t('Cómo podemos comprobarlo'))} <small>${esc(t('(opcional si añades una foto)'))}</small>
          <textarea name="texto" rows="4" maxlength="1000" placeholder="${esc(t('Por ejemplo: «Soy la titular y el teléfono de la ficha es el mío».'))}"></textarea></label>
      </fieldset>
      <label class="check"><input type="checkbox" name="decl"> ${esc(t('Declaro que los datos son ciertos y que puedo representar a este negocio.'))}</label>
      <p class="err" id="err" role="alert"></p>
      <button class="pill accent" id="enviar">${esc(t('Enviar la reclamación'))}</button>
      <p class="muted">${esc(t('Solo lo ve el equipo de Klendar. La prueba se borra 6 meses después de resolver la reclamación.'))}
        <a href="${EN ? '/en/privacy/' : '/privacidad/'}">${esc(t('Política de privacidad'))}</a></p>
    </form>`);

  const f = $('#f');
  const err = $('#err');
  const quita = $('#quita');
  f.prueba.addEventListener('change', () => {
    const a = f.prueba.files[0];
    const img = $('#prev');
    const pdf = $('#pdf');
    img.hidden = true; pdf.hidden = true;
    if (!a) { quita.hidden = true; return; }
    if (a.type === 'application/pdf') { pdf.textContent = a.name; pdf.hidden = false; } else { img.src = URL.createObjectURL(a); img.hidden = false; }
    quita.hidden = false;
  });
  quita.onclick = () => { f.prueba.value = ''; $('#prev').hidden = true; $('#pdf').hidden = true; quita.hidden = true; };

  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const rol = f.rol.value.trim();
    const tel = f.tel.value.trim();
    const mail = f.mail.value.trim();
    const texto = f.texto.value.trim();
    const archivo = f.prueba.files[0];
    const mal = rol.length < 2 ? 'invalid_role'
      : !tel && !mail ? 'contact_required'
        : tel && !TEL_RECLAMAR.test(tel) ? 'invalid_phone'
          : mail && !CORREO_OK.test(mail) ? 'invalid_email'
            : !archivo && texto.length < 20 ? 'proof_required'
              : texto && texto.length < 20 ? 'invalid_proof'
                : !f.decl.checked ? 'declaration_required' : null;
    if (mal) { err.textContent = amable(mal); return; }
    err.textContent = '';
    ocupado($('#enviar'), async () => {
      let ruta = null;
      try {
        ruta = await subePrueba(archivo);
        await llamar('claim_business', {
          p_business: id, p_role: rol, p_phone: tel || null, p_email: mail || null,
          p_proof_text: texto || null, p_proof_path: ruta, p_declaration: true,
        });
      } catch (e) {
        // La subida que no ha llegado a ir en una reclamación, fuera.
        if (ruta) sb.storage.from('business-claims').remove([ruta]).catch(() => {});
        throw e;
      }
      hecho({
        titulo: t('Reclamación enviada'),
        texto: t('La revisamos a mano, normalmente en unos días. Te avisaremos con lo que decidamos.'),
        volver: ficha, volverTxt: t('Volver al sitio'),
        lista: '#/', listaTxt: t('Tu cuenta'),
      });
    });
  });
};

// ── Denunciar ─────────────────────────────────────────────────────────────
// Con cuenta, `report_target` (como la app). Sin cuenta también se puede
// (DSA, art. 16): nombre y correo (salvo abuso sexual infantil), una
// explicación y la declaración de buena fe; va a la Edge Function
// `report-public`, que comprueba Turnstile si el entorno tiene clave. Desde
// el pie («Denunciar contenido ilegal») se llega sin contenido: se pide su
// dirección en Klendar.
const MOTIVOS = [
  ['spam', 'Spam o publicidad engañosa'],
  ['inappropriate', 'Contenido inapropiado u ofensivo'],
  ['misleading', 'La oferta no es como se anuncia'],
  ['closed', 'El negocio ya no existe o está cerrado'],
  ['illegal', 'Contenido ilegal'],
  ['child_abuse', 'Abuso sexual infantil'],
  ['other', 'Otro motivo'],
];
// Los motivos que tienen sentido en cada cosa, como en la app (report_sheet).
const MOTIVOS_DE = {
  offer: ['spam', 'inappropriate', 'misleading', 'closed', 'illegal', 'child_abuse', 'other'],
  business: ['spam', 'inappropriate', 'closed', 'illegal', 'child_abuse', 'other'],
  review: ['spam', 'inappropriate', 'illegal', 'child_abuse', 'other'],
  post: ['spam', 'inappropriate', 'illegal', 'child_abuse', 'other'],
  review_media: ['spam', 'inappropriate', 'illegal', 'child_abuse', 'other'],
};
const QUE_SE_DENUNCIA = {
  offer: 'Denunciar una publicación', business: 'Denunciar un negocio',
  review: 'Denunciar una reseña', post: 'Denunciar una novedad',
  // Una sola foto o un solo vídeo de una reseña (el «Denunciar» del visor).
  review_media: 'Denunciar una foto o un vídeo',
};
// Lo que contesta `report-public` (y `report_public`), dicho para personas.
const ERR_DENUNCIA = {
  bad_target: 'Esa dirección no es de una publicación, un negocio, una reseña o una novedad de Klendar.',
  not_found: 'Ese contenido ya no existe (puede que ya lo hayan quitado).',
  bad_reason: 'Elige un motivo.',
  details_required: 'Explica por qué lo denuncias (al menos 10 caracteres).',
  details_too_long: 'La explicación es demasiado larga (máximo 2000 caracteres).',
  good_faith_required: 'Marca la declaración de buena fe para enviarla.',
  name_required: 'Escribe tu nombre.',
  name_too_long: 'El nombre es demasiado largo.',
  email_required: 'Escribe tu correo: es para contestarte.',
  email_invalid: 'Ese correo no parece válido',
  rate_limited: 'Has enviado varias denuncias seguidas. Espera un rato y vuelve a probar.',
  already_reported: 'Ya nos has denunciado este contenido hoy. Lo estamos revisando.',
  busy: 'Ahora mismo estamos recibiendo muchas denuncias. Prueba dentro de un rato o escríbenos a info@klendar.app.',
  captcha_failed: 'No hemos podido comprobar que no eres un robot. Vuelve a probar.',
};
const UUID_DENUNCIA = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Qué contenido es una dirección de Klendar: /o/<id>, /cartel/<id>
 * (publicación), /b/<nombre-o-id> (negocio; con #resena-<id> o
 * #novedad-<id>, esa reseña o novedad) o un enlace de «Denunciar».
 * `null` si no es de Klendar o no se entiende. */
async function contenidoDeUrl(texto) {
  let u;
  try { u = new URL(String(texto || '').trim()); } catch { return null; }
  const propio = u.host === location.host
    || /(^|\.)klendar\.app$|\.klendar-web\.pages\.dev$|^localhost$|^127\.0\.0\.1$/i.test(u.hostname);
  if (!/^https?:$/.test(u.protocol) || !propio) return null;
  const hash = decodeURIComponent(u.hash || '');
  let m = hash.match(new RegExp(`^#/?denunciar/(offer|business|review_media|review|post)/(${UUID_DENUNCIA})`, 'i'));
  if (m) return { tipo: m[1], id: m[2].toLowerCase() };
  const camino = u.pathname.replace(/^\/en(?=\/)/, '');
  m = camino.match(new RegExp(`^/(?:o|cartel|poster|widget)/(${UUID_DENUNCIA})`, 'i'));
  if (m) return { tipo: 'offer', id: m[1].toLowerCase() };
  m = camino.match(/^\/b\/([^/]+)/);
  if (!m) return null;
  const parte = hash.match(new RegExp(`^#(resena|novedad)-(${UUID_DENUNCIA})`, 'i'));
  if (parte) return { tipo: parte[1] === 'resena' ? 'review' : 'post', id: parte[2].toLowerCase() };
  const slug = decodeURIComponent(m[1]);
  if (new RegExp(`^${UUID_DENUNCIA}$`, 'i').test(slug)) return { tipo: 'business', id: slug.toLowerCase() };
  try {
    const fila = await llamar('resolve_business_slug', { p_slug: slug });
    const b = Array.isArray(fila) ? fila[0] : fila;
    return b?.id ? { tipo: 'business', id: b.id } : null;
  } catch { return null; }
}

/** El título de lo que se denuncia, para enseñarlo encima del formulario. */
async function queSeDenuncia(tipo, id) {
  if (tipo === 'offer') return queOferta(id);
  if (tipo === 'business') {
    try {
      const { data } = await sb.from('businesses').select('name, city').eq('id', id).maybeSingle();
      return data ? [data.name, data.city].filter(Boolean).join(' · ') : '';
    } catch { return ''; }
  }
  return '';
}

RUTAS.denunciar = async ([tipo, id], params) => {
  // `?detalle=`: lo que se sabe de qué se denuncia (desde la página de un
  // sorteo, «Sorteo: <premio>»), escrito ya en «Detalles».
  const detalle = String(params?.get('detalle') || '').slice(0, 200);
  const conContenido = Boolean(tipo || id);
  if (conContenido && (!QUE_SE_DENUNCIA[tipo] || !new RegExp(`^${UUID_DENUNCIA}$`, 'i').test(id || ''))) {
    pinta(pantallaVacia({ icono: 'link', titulo: t('Ese enlace no está completo.'), h: 'h1', botones: botonTuCuenta() }));
    return;
  }
  const volver = document.referrer && new URL(document.referrer).origin === location.origin
    && !new URL(document.referrer).pathname.startsWith('/app/')
    ? document.referrer : `${pre}/`;
  const que = conContenido ? await queSeDenuncia(tipo, id) : '';
  const ruta = conContenido ? `denunciar/${tipo}/${id}` : 'denunciar';
  const motivos = (lista) => MOTIVOS.filter(([v]) => lista.includes(v)).map(([v, l]) =>
    `<label class="check"><input type="radio" name="motivo" value="${v}"> ${esc(t(l))}</label>`).join('');
  const listaMotivos = MOTIVOS_DE[tipo] || MOTIVOS.map(([v]) => v);
  const campoUrl = conContenido ? '' : `
      <label>${esc(t('Dirección del contenido en Klendar'))}
        <small>${esc(t('Cópiala de la barra del navegador: klendar.app/o/… es una publicación y klendar.app/b/… un negocio. Para una reseña o una novedad, usa el enlace «Denunciar» que hay debajo de ella.'))}</small>
        <input name="url" type="url" inputmode="url" autocomplete="off" maxlength="500" placeholder="https://klendar.app/o/…"></label>`;
  const cabecera = `
    <h1>${esc(t(conContenido ? QUE_SE_DENUNCIA[tipo] : 'Denunciar contenido'))}</h1>
    ${que ? `<p class="denuncia-que"><b>${esc(que)}</b></p>` : ''}`;

  if (YO) {
    pinta(`${cabecera}
    <p class="muted">${esc(t('Cuéntanos qué pasa. Lo revisamos lo antes posible y nadie sabrá que has sido tú.'))}</p>
    <form class="formu" id="f" novalidate>${campoUrl}
      <fieldset class="motivos"><legend>${esc(t('Motivo'))}</legend>${motivos(listaMotivos)}</fieldset>
      <label>${esc(t('Detalles'))} <small>${esc(t('(opcional)'))}</small>
        <textarea name="det" rows="4" maxlength="2000">${esc(detalle ? `${detalle}
` : '')}</textarea></label>
      <p class="err" id="err" role="alert"></p>
      <button class="pill accent" id="enviar">${esc(t('Enviar denuncia'))}</button>
    </form>`);
    const f = $('#f');
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!f.motivo.value) { $('#err').textContent = t('Elige un motivo.'); return; }
      $('#err').textContent = '';
      ocupado($('#enviar'), async () => {
        const destino = conContenido ? { tipo, id } : await contenidoDeUrl(f.elements.url.value);
        if (!destino) { KL_CAMPO(f.elements.url, t(ERR_DENUNCIA.bad_target)); f.elements.url.focus(); return; }
        await llamar('report_target', {
          p_type: destino.tipo, p_id: destino.id, p_reason: f.motivo.value, p_details: f.det.value.trim() || null,
        });
        hecho({
          titulo: t('Denuncia enviada'),
          texto: t('Gracias por avisar. Si hace falta, lo quitamos y hablamos con quien lo publicó.'),
          volver, volverTxt: t('Volver'),
          lista: '#/', listaTxt: t('Tu cuenta'),
        });
      });
    });
    return;
  }

  // ── Sin cuenta ──
  pinta(`${cabecera}
    <p class="muted">${esc(t('Cualquiera puede avisarnos de algo que crea ilegal o que incumpla las Normas de la comunidad, tenga cuenta o no. Lo revisa una persona del equipo y te contamos qué hemos decidido.'))}</p>
    <p class="muted">${esc(t('¿Tienes cuenta?'))} <a href="#/entrar?siguiente=${encodeURIComponent(ruta)}">${esc(t('Entra y denúncialo con ella'))}</a>.</p>
    <form class="formu" id="f" novalidate>${campoUrl}
      <fieldset class="motivos" id="motivos"><legend>${esc(t('Motivo'))}</legend>${motivos(listaMotivos)}</fieldset>
      <label>${esc(t('Explica por qué lo denuncias'))}
        <small>${esc(t('Qué es exactamente y por qué crees que es ilegal o incumple las normas. Si es ilegal, di qué ley crees que incumple si lo sabes.'))}</small>
        <textarea name="det" rows="5" minlength="10" maxlength="2000" required>${esc(detalle ? `${detalle}
` : '')}</textarea></label>
      <label>${esc(t('Tu nombre'))} <small data-opc hidden>${esc(t('(opcional)'))}</small>
        <input name="nombre" autocomplete="name" maxlength="120"></label>
      <label>${esc(t('Tu correo'))} <small data-opc hidden>${esc(t('(opcional)'))}</small>
        <small>${esc(t('Para confirmarte que la hemos recibido y contarte qué decidimos.'))}</small>
        <input name="correo" type="email" autocomplete="email" maxlength="254"></label>
      <p class="muted pie-form" id="csam" hidden>${esc(t('En una denuncia por abuso sexual infantil, tu nombre y tu correo son opcionales. Si nos dejas el correo, te contaremos qué hemos hecho.'))}</p>
      <label class="check"><input type="checkbox" name="fe"> ${esc(t('Declaro de buena fe que la información y las afirmaciones de esta denuncia son exactas y completas.'))}</label>
      <p class="muted pie-form">${esc(t('Usamos tu nombre y tu correo solo para tramitar la denuncia y contestarte; no se los damos a quien publicó el contenido.'))}
        <a href="${EN ? '/en/privacy/' : '/privacidad/'}" target="_blank">${esc(t('Política de privacidad'))}</a></p>
      <p class="err" id="err" role="alert"></p>
      <button class="pill accent" id="enviar">${esc(t('Enviar denuncia'))}</button>
    </form>
    <p class="muted pie-form">${esc(t('Si alguien está en peligro ahora mismo, llama al 112.'))}</p>`);
  const f = $('#f');
  const el = f.elements;
  // Abuso sexual infantil: nombre y correo pasan a ser opcionales (art. 16.2.c).
  const alCambiarMotivo = () => {
    const opcional = f.motivo.value === 'child_abuse';
    $$('[data-opc]', f).forEach((s) => { s.hidden = !opcional; });
    $('#csam').hidden = !opcional;
    if (opcional) { KL_CAMPO(el.nombre, null); KL_CAMPO(el.correo, null); }
  };
  $('#motivos').addEventListener('change', alCambiarMotivo);

  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    $('#err').textContent = '';
    const opcional = f.motivo.value === 'child_abuse';
    const nombre = el.nombre.value.trim();
    const correo = el.correo.value.trim();
    const det = el.det.value.trim();
    const fallos = [];
    if (el.url) {
      const v = el.url.value.trim();
      KL_CAMPO(el.url, v ? null : t('Obligatorio'));
      if (!v) fallos.push(el.url);
    }
    if (!f.motivo.value) { $('#err').textContent = t('Elige un motivo.'); fallos.push($('#motivos input')); }
    KL_CAMPO(el.det, det.length >= 10 ? null : t(ERR_DENUNCIA.details_required));
    if (det.length < 10) fallos.push(el.det);
    KL_CAMPO(el.nombre, nombre || opcional ? null : t(ERR_DENUNCIA.name_required));
    if (!nombre && !opcional) fallos.push(el.nombre);
    const correoMal = correo ? !CORREO_OK.test(correo) : !opcional;
    KL_CAMPO(el.correo, correoMal ? t(correo ? ERR_DENUNCIA.email_invalid : ERR_DENUNCIA.email_required) : null);
    if (correoMal) fallos.push(el.correo);
    if (!el.fe.checked && !fallos.length) $('#err').textContent = t(ERR_DENUNCIA.good_faith_required);
    if (!el.fe.checked) fallos.push(el.fe);
    if (fallos.length) { fallos[0]?.focus(); return; }

    ocupado($('#enviar'), async () => {
      const destino = conContenido ? { tipo, id } : await contenidoDeUrl(el.url.value);
      if (!destino) { KL_CAMPO(el.url, t(ERR_DENUNCIA.bad_target)); el.url.focus(); return; }
      const robot = await sinRobots();
      if (robot.error) { $('#err').textContent = errAuth(robot.error); return; }
      let res;
      let datos = null;
      try {
        res = await fetch(`${window.KLENDAR_ENV.url}/functions/v1/report-public`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: window.KLENDAR_ENV.key },
          body: JSON.stringify({
            type: destino.tipo, id: destino.id, reason: f.motivo.value, details: det,
            name: nombre || null, email: correo || null, lang: EN ? 'en' : 'es',
            good_faith: el.fe.checked, captcha: robot.token || null,
          }),
        });
        datos = await res.json().catch(() => null);
      } catch (e) {
        throw new Error(amable(e.message));
      }
      if (!res.ok || !datos?.ok) {
        const clave = datos?.error || '';
        const campo = { name_required: el.nombre, name_too_long: el.nombre, email_required: el.correo, email_invalid: el.correo, details_required: el.det, details_too_long: el.det }[clave]
          || (!conContenido && ['bad_target', 'not_found'].includes(clave) ? el.url : null);
        const msg = ERR_DENUNCIA[clave] ? t(ERR_DENUNCIA[clave]) : amable(clave);
        if (campo) { KL_CAMPO(campo, msg); campo.focus(); } else $('#err').textContent = msg;
        return;
      }
      const ref = datos.ref ? (EN ? ` Your reference: ${datos.ref}.` : ` Tu referencia: ${datos.ref}.`) : '';
      hecho({
        titulo: t('Denuncia enviada'),
        texto: (datos.ack
          ? t('Te hemos mandado un correo para confirmarlo (mira también en spam). Te escribiremos con lo que decidamos.')
          : t('La revisaremos lo antes posible. Gracias por avisar.')) + ref,
        volver, volverTxt: t('Volver'),
        lista: '#/denunciar', listaTxt: t('Denunciar otra cosa'),
      });
    });
  });
};

// ── Bloquear a una persona ────────────────────────────────────────────────
// Desde su reseña (ficha pública), la lista de amigos o una invitación. Deja
// de ver sus reseñas, deja de ser su amigo, no se ven en «quién va» ni
// pueden invitarse. No se le avisa. Se deshace en Ajustes → Privacidad.
/** «¿Bloquear a X?» con lo que pasa. `true` si se confirma. */
function confirmaBloqueo(nombre) {
  return confirma({
    titulo: nombre
      ? (EN ? `Block ${nombre}?` : `¿Bloquear a ${nombre}?`)
      : t('¿Bloquear a esta persona?'),
    texto: t('Dejarás de ver sus reseñas. Si es tu amigo, dejará de serlo: no verás a qué planes va, no podrá invitarte ni volver con tu enlace. No le avisamos. Lo puedes deshacer en Ajustes → Privacidad y datos.'),
    aceptar: t('Bloquear'),
    peligro: true,
  });
}

RUTAS.bloquear = async ([id]) => {
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) {
    pinta(pantallaVacia({ icono: 'link', titulo: t('Ese enlace no está completo.'), h: 'h1', botones: botonTuCuenta() }));
    return;
  }
  if (!exigeSesion(`bloquear/${id}`)) return;
  const volver = document.referrer && new URL(document.referrer).origin === location.origin
    ? document.referrer : `${pre}/`;
  if (id === YO.id) {
    pinta(pantallaVacia({ icono: 'block', titulo: t('No puedes bloquearte a ti.'), h: 'h1', botones: botonTuCuenta() }));
    return;
  }
  pinta(`
    <div class="ticket">
      <p class="hecho-ic" aria-hidden="true">${ic('block')}</p>
      <h1>${esc(t('¿Bloquear a esta persona?'))}</h1>
      <p class="muted">${esc(t('Dejarás de ver sus reseñas. Si es tu amigo, dejará de serlo: no verás a qué planes va, no podrá invitarte ni volver con tu enlace. No le avisamos. Lo puedes deshacer en Ajustes → Privacidad y datos.'))}</p>
      <p class="acciones">
        <button type="button" class="pill peligro-lleno" id="bloquear">${esc(t('Bloquear'))}</button>
        <a class="pill" href="${esc(volver)}">${esc(t('Cancelar'))}</a>
      </p>
    </div>`);
  $('#bloquear').onclick = (ev) => ocupado(ev.currentTarget, async () => {
    await llamar('block_user', { p_user: id });
    hecho({
      titulo: t('Persona bloqueada'),
      texto: t('Ya no verás sus reseñas. Si cambias de idea, desbloquéala en Ajustes → Privacidad y datos.'),
      volver, volverTxt: t('Volver'),
      lista: '#/ajustes', listaTxt: t('Ajustes'),
    });
  });
};

/** Ajustes → Privacidad: las personas bloqueadas, con «Desbloquear». */
async function pintaBloqueadas() {
  const caja = $('#dd-bloqueadas');
  if (!caja) return;
  let lista = [];
  try { lista = (await llamar('my_blocks', {})).blocks || []; } catch { caja.textContent = t('No se ha podido cargar.'); return; }
  if (!caja.isConnected) return;
  if (!lista.length) { caja.textContent = t('No has bloqueado a nadie. Se hace desde una reseña, tu lista de amigos o una invitación.'); return; }
  caja.innerHTML = `<ul class="bloqueadas">${lista.map((p) => `<li>
      <span><b>${esc(p.name || t('Usuario'))}</b> <small class="muted">${esc(`${t('Desde el')} ${fecha(p.since, { day: 'numeric', month: 'long', year: 'numeric' })}`)}</small></span>
      <button type="button" class="linkbtn" data-desbloquear="${esc(p.id)}" data-nombre="${esc(p.name || t('Usuario'))}">${esc(t('Desbloquear'))}</button>
    </li>`).join('')}</ul>`;
  I18N.translate(caja);
  $$('[data-desbloquear]', caja).forEach((b) => b.addEventListener('click', async () => {
    const nombre = b.dataset.nombre;
    if (!(await confirma({
      titulo: EN ? `Unblock ${nombre}?` : `¿Desbloquear a ${nombre}?`,
      texto: t('Volverás a ver sus reseñas. No vuelve a tus amigos: si quieres, abre su enlace de amigo.'),
      aceptar: t('Desbloquear'),
    }))) return;
    b.disabled = true;
    try {
      await llamar('unblock_user', { p_user: b.dataset.desbloquear });
      toast(EN ? `You've unblocked ${nombre}` : `Has desbloqueado a ${nombre}`);
      pintaBloqueadas();
    } catch (e) { toast(e.message, true); if (b.isConnected) b.disabled = false; }
  }));
}

// ── Un último paso ────────────────────────────────────────────────────────
RUTAS['ultimo-paso'] = async (_p, params) => {
  if (!exigeSesion('ultimo-paso')) return;
  const siguiente = params.get('siguiente') || '';
  // Solo se vuelve a sitios de esta misma web (nunca a una dirección de fuera).
  const volverSeguro = rutaInterna(new URLSearchParams(location.search).get('volver'));
  if (!(await faltaConsentimiento())) {
    if (volverSeguro) { location.href = volverSeguro; return; }
    vuelve(siguiente === 'ultimo-paso' ? '' : siguiente);
    return;
  }
  const salir = async () => {
    await sb.auth.signOut({ scope: 'local' });
    CONSENTIMIENTO = { ...SIN_PASOS };
    location.href = `${pre}/`;
  };
  // «¿Cómo te llamas?», antes que lo demás (como en la app): la cuenta no
  // tiene nombre (entró con un código por correo, o Apple no lo dio). Al
  // crearla hay que ponerlo; una cuenta de antes lo ve una vez, con «Ahora no».
  if (CONSENTIMIENTO.nombre) {
    const alta = CONSENTIMIENTO.alta;
    pinta(`
      <div class="ticket" style="text-align:left">
        <h1>${esc(t('¿Cómo te llamas?'))}</h1>
        <p class="muted">${esc(t('Es lo que verán tus amigos y quien lea tus reseñas. Nunca enseñamos tu correo.'))}</p>
        <form id="fn" class="formu" novalidate>
          <label>${esc(t('Nombre'))}<input name="name" autocomplete="name" maxlength="40" required value="${esc(nombreSugerido(YO.user_metadata))}"></label>
          <p id="err" class="err" role="alert"></p>
          <button class="pill accent" id="seguir">${esc(t('Continuar'))}</button>
        </form>
        <p>${alta
          ? `<button class="linkbtn" id="salir">${esc(t('Cerrar sesión'))}</button>`
          : `<button class="linkbtn" id="ahora-no">${esc(t('Ahora no'))}</button>`}</p>
      </div>`);
    const fn = $('#fn');
    if (!fn.elements.name.value) fn.elements.name.focus();
    const sigue = () => {
      CONSENTIMIENTO = { ...CONSENTIMIENTO, nombre: false };
      RUTAS['ultimo-paso'](_p, params);
    };
    fn.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const err = $('#err');
      err.textContent = '';
      if (!validaForm(fn, { name: VALIDA.requerido })) return;
      const nombre = fn.elements.name.value.trim();
      ocupado($('#seguir'), async () => {
        // Sin insultos ni palabras malsonantes (la base lo vuelve a mirar).
        let sirve = true;
        try { sirve = (await sb.rpc('display_name_allowed', { p_name: nombre })).data !== false; } catch { /* sin red: lo mira la base */ }
        if (!sirve) { err.textContent = t(ERRORES.offensive_name); return; }
        try { await guardaNombrePublico(nombre); } catch (e) { err.textContent = e.message; return; }
        sigue();
      });
    });
    $('#salir')?.addEventListener('click', salir);
    $('#ahora-no')?.addEventListener('click', (ev) => {
      ocupado(ev.currentTarget, async () => {
        await llamar('skip_name_prompt', {});
        sigue();
      });
    });
    I18N.translate(view);
    return;
  }
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
      const vivo = await cuentaVivaLineas();
      if (!(await confirma({
        ...(vivo.length ? { lista: [`${t('Ahora mismo tienes')}:`, ...vivo], pie: t(PIE_VIVO) } : {}),
        titulo: t('¿Eliminar tu cuenta?'),
        texto: t('Se borran para siempre tus datos, tus favoritos, tus planes y tus canjes. Si eres propietario de un negocio, antes tendrás que darlo de baja o traspasarlo. No se puede deshacer.'),
        aceptar: t('Eliminar'),
        peligro: true,
      }))) return;
      const id = await confirmaIdentidad();
      if (!id) return;
      await id.cerrar();
      ocupado(boton, async () => {
        await llamar('delete_my_account', {});
        try { await sb.auth.signOut({ scope: 'local' }); } catch { /* la sesión ya no existe */ }
        CONSENTIMIENTO = { ...SIN_PASOS };
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
        ${pideFecha ? `<label>${esc(t('Fecha de nacimiento'))}<input name="birth" type="date" ${LIMITES_NACIMIENTO()} required></label>` : ''}
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

// ── Invitaciones ──────────────────────────────────────────────────────────
// Un negocio te invita a su equipo (o a ser su propietario, o su RRPP) y
// decides tú (antes, con cuenta, entrabas sin que se te preguntara). Como
// «Invitaciones» en la app. Las de RRPP las pinta app/rrpp.js.
RUTAS.invitaciones = async () => {
  if (!exigeSesion('invitaciones')) return;
  const [lista, traspasos, deRrpp] = await Promise.all([
    llamar('my_team_invites', {}),
    llamar('my_business_transfers', {}).catch(() => []),
    llamar('my_promoter_invites', {}).catch(() => []),
  ]);
  const papel = (r) => (r === 'manager' ? t('encargado') : t('empleado'));
  const dia = (s) => new Date(s).toLocaleDateString(EN ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  pinta(`
    <p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a></p>
    <h1>${esc(t('Invitaciones'))}</h1>
    ${(deRrpp || []).length ? `<div class="invitaciones-eq">${rrppInvitacionesHtml(deRrpp)}</div>` : ''}
    ${(traspasos || []).length ? `<div class="invitaciones-eq">${traspasos.map((i) => `
      <div class="lista inv-eq">
        <p class="inv-eq-t"><b>${esc(EN ? `You’re offered ownership of ${i.business_name}` : `Te ofrecen ser propietario de ${i.business_name}`)}</b>
          ${i.business_city ? `<small class="muted">${esc(i.business_city)}</small>` : ''}</p>
        ${i.from_name ? `<p>${esc(EN ? `Offered by ${i.from_name}.` : `Te lo propone ${i.from_name}.`)}</p>` : ''}
        <p class="muted">${esc(t('Si lo aceptas, el negocio pasa a ser tuyo: lo gestionas todo, también la suscripción y los datos de facturación.'))}</p>
        ${i.expires_at ? `<p class="muted">${esc(EN ? `Expires on ${dia(i.expires_at)}` : `Caduca el ${dia(i.expires_at)}`)}</p>` : ''}
        <p class="dos-pills">
          <button class="pill" type="button" data-tr-no="${esc(i.id)}">${esc(t('Rechazar'))}</button>
          <button class="pill accent" type="button" data-tr-si="${esc(i.id)}">${esc(t('Aceptar'))}</button>
        </p>
      </div>`).join('')}</div>` : ''}
    ${(lista || []).length ? `<div class="invitaciones-eq">${lista.map((i) => `
      <div class="lista inv-eq">
        <p class="inv-eq-t"><b>${esc(EN ? `You’re invited to the ${i.business_name} team` : `Te invitan al equipo de ${i.business_name}`)}</b>
          ${i.business_city ? `<small class="muted">${esc(i.business_city)}</small>` : ''}</p>
        <p>${esc(i.invited_by_name
          ? (EN ? `As ${papel(i.role)} · invited by ${i.invited_by_name}` : `Como ${papel(i.role)} · te invita ${i.invited_by_name}`)
          : (EN ? `As ${papel(i.role)}` : `Como ${papel(i.role)}`))}</p>
        <p class="muted">${esc(i.role === 'manager'
          ? t('Podrás publicar ofertas y eventos, validar códigos y llevar el equipo.')
          : t('Podrás validar los códigos de los clientes.'))}</p>
        ${i.expires_at ? `<p class="muted">${esc(EN ? `Expires on ${dia(i.expires_at)}` : `Caduca el ${dia(i.expires_at)}`)}</p>` : ''}
        <p class="dos-pills">
          <button class="pill" type="button" data-no="${esc(i.id)}">${esc(t('Rechazar'))}</button>
          <button class="pill accent" type="button" data-si="${esc(i.id)}">${esc(t('Aceptar'))}</button>
        </p>
      </div>`).join('')}</div>`
    : (traspasos || []).length || (deRrpp || []).length ? '' : pantallaVacia({ icono: 'group', titulo: t('No tienes invitaciones pendientes.') })}`);
  rrppEnganchaInvitaciones(deRrpp, () => RUTAS.invitaciones());
  const contesta = async (id, acepta, boton) => {
    boton.disabled = true;
    try {
      const r = await llamar('respond_team_invite', { p_invite: id, p_accept: acepta }).catch((e) => {
        if (e.datos?.ok === false) return e.datos;
        throw e;
      });
      if (!r?.ok) {
        // Edad y suspensión (20261028100000): la invitación sigue ahí.
        const negocio = r?.business_name || (lista || []).find((x) => x.id === id)?.business_name || '';
        const motivo = {
          expired: t('Esta invitación ha caducado.'),
          min_age_16: EN ? `To join the ${negocio} team you need to be 16 and have your date of birth in your profile.`
            : `Para entrar en el equipo de ${negocio} hace falta tener 16 años y la fecha de nacimiento en tu perfil.`,
          adult_required: EN ? `${negocio} is 18+: to join its team you need to be 18 and have your date of birth in your profile.`
            : `${negocio} es +18: para entrar en su equipo hace falta tener 18 años y la fecha de nacimiento en tu perfil.`,
          account_suspended: t('Tu cuenta está suspendida. Si crees que es un error, escribe a info@klendar.app.'),
        }[r?.error];
        toast(motivo || t('No se ha podido. Vuelve a probar.'), true);
      } else if (acepta) {
        toast(EN ? `You’re now part of the ${r.business_name} team.` : `Ya formas parte del equipo de ${r.business_name}.`);
        // Dentro: a su panel, que es lo que viene a hacer.
        location.href = '/panel/';
        return;
      } else {
        toast(t('Invitación rechazada.'));
      }
    } catch (e) {
      toast(e.message, true);
    }
    RUTAS.invitaciones();
  };
  const traspaso = async (id, acepta, boton) => {
    boton.disabled = true;
    try {
      const r = await llamar('respond_business_transfer', { p_transfer: id, p_accept: acepta }).catch((e) => {
        if (e.datos?.ok === false) return e.datos;
        throw e;
      });
      if (!r?.ok) {
        toast(r?.error === 'adult_required'
          ? t('Para ser propietario de un negocio hace falta tener 18 años y la fecha de nacimiento en tu perfil. Ponla en Ajustes y vuelve a aceptarlo.')
          : t('Esta invitación ha caducado.'), true);
      } else if (acepta) {
        toast(EN ? `You’re now the owner of ${r.business_name}.` : `Ahora eres propietario de ${r.business_name}.`);
        location.href = `/panel/#/resumen?biz=${r.business_id}`;
        return;
      } else {
        toast(t('Traspaso rechazado.'));
      }
    } catch (e) {
      toast(e.message, true);
    }
    RUTAS.invitaciones();
  };
  $$('[data-tr-si]').forEach((b) => { b.onclick = () => traspaso(b.dataset.trSi, true, b); });
  $$('[data-tr-no]').forEach((b) => { b.onclick = () => traspaso(b.dataset.trNo, false, b); });
  $$('[data-si]').forEach((b) => { b.onclick = () => contesta(b.dataset.si, true, b); });
  $$('[data-no]').forEach((b) => { b.onclick = () => contesta(b.dataset.no, false, b); });
};

// El número de notificaciones sin leer, en la tarjeta de la portada.
async function pintaSinLeer() {
  const el = $('#sin-leer');
  if (!el) return;
  try {
    const n = await sinLeer();
    if (n) { el.textContent = n > 99 ? '99+' : String(n); el.hidden = false; }
  } catch { /* sin número, sin más */ }
}

// ── Tus gustos (tanda A, como la app) ──────────────────────────────────────
// De 3 a 5 categorías y tu ciudad: Descubre y Explorar dan más peso a esas
// categorías (sin esconder nada) y la ciudad sirve para el aviso de viaje.
// En la cuenta (`user_tastes`) y una copia en este navegador para las
// páginas públicas (`/assets/gustos.js`). La primera vez que entras en «Tu
// cuenta» se pregunta, con «Ahora no».

/** Lo de la cuenta → este navegador. */
function gustosALocal(srv) {
  if (!srv || !window.KlendarGustos) return;
  KlendarGustos.guarda({
    c: srv.category_slugs || [], city: srv.home_city || null, asked: true,
    t: Date.parse(srv.updated_at || '') || Date.now(),
  });
}

/** Al abrir «Tu cuenta»: los gustos de la cuenta, copiados aquí. `true` si
 * nunca se le ha preguntado (toca el paso). Sin red, no se pregunta. */
async function gustosDeLaCuenta() {
  try {
    const srv = await llamar('my_tastes', {});
    if (srv) { gustosALocal(srv); return false; }
    return true;
  } catch { return false; }
}

const resumenGustos = (g, cats, ciudades) => {
  const nombres = (g.c || []).map((s) => cats.find((c) => c.slug === s)).filter(Boolean).map(nombreCat);
  const ciudad = ciudades.find((c) => c.id === g.city);
  const partes = [nombres.join(', '), ciudad ? ciudad.name : ''].filter(Boolean);
  return partes.length ? partes.join(' · ') : t('Elige lo que más te gusta y tu ciudad');
};

RUTAS.gustos = async (_p, params) => {
  if (!exigeSesion('gustos')) return;
  const primera = params.get('primera') === '1';
  const [cats, ciudades, srv] = await Promise.all([
    categorias(),
    KlendarGustos.ciudades(),
    llamar('my_tastes', {}).catch(() => null),
  ]);
  if (srv) gustosALocal(srv);
  const g = KlendarGustos.lee();
  let elegidas = (srv?.category_slugs || g.c || []).filter((s) => cats.some((c) => c.slug === s));
  const tiene = elegidas.length > 0 || Boolean(srv?.home_city || g.city);
  const ciudadActual = srv ? srv.home_city : g.city;
  pinta(`
    ${primera ? '' : `<p class="crumbs"><a href="#/">${esc(t('Tu cuenta'))}</a> › <a href="#/ajustes">${esc(t('Ajustes'))}</a></p>`}
    <div class="ticket" style="text-align:left">
      <h1>${esc(t(primera ? '¿Qué te gusta?' : 'Tus gustos'))}</h1>
      <p class="muted">${esc(t('Elige de 3 a 5 y te lo enseñamos antes en Descubre. Lo demás sigue saliendo.'))}</p>
      <form id="fg" class="formu" novalidate>
        <div class="campo-cat"><p class="etq">${esc(t('Categorías'))} <small id="g-n" aria-live="polite"></small></p><div id="cats-gustos"></div></div>
        <label>${esc(t('Tu ciudad'))} <small>${esc(t('Si abres Klendar lejos de ella, te enseñamos lo mejor de donde estés. No guardamos dónde estás.'))}</small>
          <select name="ciudad">
            <option value="">${esc(t('Sin ciudad'))}</option>
            ${ciudades.map((c) => `<option value="${esc(c.id)}"${c.id === ciudadActual ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select></label>
        <p><button type="button" class="linkbtn" id="g-ubic">${esc(t('Usar mi ubicación'))}</button></p>
        <p class="muted" id="g-nota" role="status"></p>
        <p class="err" id="err" role="alert"></p>
        <button class="pill accent" id="g-guardar">${esc(t('Guardar'))}</button>
      </form>
      <p>${primera
    ? `<button class="linkbtn" id="g-saltar">${esc(t('Ahora no'))}</button>`
    : tiene ? `<button class="linkbtn" id="g-borrar">${esc(t('Borrar mis gustos'))}</button>` : ''}</p>
      ${primera ? `<p class="muted">${esc(t('Puedes cambiarlo cuando quieras en Ajustes → Lo que ves.'))}</p>` : ''}
    </div>`);
  const fg = $('#fg');
  const cuenta = () => {
    const n = elegidas.length;
    $('#g-n').textContent = n < 3 ? `${n} ${EN ? 'of' : 'de'} 5 · ${t('Elige al menos 3')}` : `${n} ${EN ? 'of' : 'de'} 5`;
    $('#g-guardar').disabled = n < 3 || n > 5;
  };
  // El selector de categorías de toda la web, de varias y como mucho 5.
  KlendarCategorias.campo($('#cats-gustos'), {
    cats, elegidas, multiple: true, lang: EN ? 'en' : 'es', titulo: t('¿Qué te gusta?'), vacio: t('Elige de 3 a 5'),
    max: 5, id: 'slug', alCambiar: (v) => { elegidas = v; cuenta(); },
  });
  cuenta();
  // «Usar mi ubicación»: la ciudad de Klendar en la que estás, sin guardar
  // la posición.
  $('#g-ubic').addEventListener('click', () => {
    const nota = $('#g-nota');
    nota.textContent = '';
    if (!navigator.geolocation) { nota.textContent = t('No hemos podido saber dónde estás: elígela de la lista.'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const c = KlendarGustos.ciudadCerca(pos.coords.latitude, pos.coords.longitude, ciudades);
      if (c) fg.ciudad.value = c.id;
      else nota.textContent = t('No estás cerca de ninguna ciudad de Klendar: elígela de la lista.');
    }, () => { nota.textContent = t('No hemos podido saber dónde estás: elígela de la lista.'); },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  });
  const listo = (msg) => {
    if (msg) toast(msg);
    vuelve(primera ? (params.get('siguiente') || '') : 'ajustes');
  };
  const guarda = async (slugs, ciudad) => {
    const ids = slugs.map((s) => cats.find((c) => c.slug === s)?.id).filter(Boolean);
    const r = await llamar('save_tastes', { p_categories: ids, p_home_city: ciudad || null });
    gustosALocal(r);
  };
  fg.addEventListener('submit', (ev) => {
    ev.preventDefault();
    $('#err').textContent = '';
    if (elegidas.length < 3) { $('#err').textContent = t('Elige al menos 3'); return; }
    ocupado($('#g-guardar'), async () => {
      await guarda(elegidas, fg.ciudad.value);
      listo(t('Guardado'));
    });
  });
  $('#g-saltar')?.addEventListener('click', async () => {
    await llamar('mark_tastes_asked', {}).catch(() => {});
    KlendarGustos.guarda({ ...KlendarGustos.lee(), asked: true });
    listo('');
  });
  $('#g-borrar')?.addEventListener('click', () => ocupado($('#g-borrar'), async () => {
    await guarda([], null);
    listo(t('Gustos borrados'));
  }));
};
