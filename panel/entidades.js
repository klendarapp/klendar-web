/* Panel: cuentas de entidad (ayuntamientos, juntas de distrito, asociaciones
   y ONG). Lo mismo que la app (`lib/features/entities/`, migración
   20261219100000 de la app):

   - El alta empieza con «¿Qué vas a dar de alta?» (`#/alta`): un negocio
     (`#/alta/1…3`, en ficha.js) o un ayuntamiento, asociación u ONG
     (`#/alta/entidad/1…3`, aquí): la entidad (tipo, nombre oficial, CIF y
     web oficial), la zona (el punto en el mapa, el municipio y, si quiere,
     el distrito o el barrio) y quién la da de alta (nombre, cargo, el
     documento que lo acredita y la declaración). Sin carta, horario,
     categoría ni nada de venta: `register_entity`.
   - El documento va al Storage privado `business-claims`, como la prueba de
     «¿Es tu negocio?» (`app/cuenta.js`).
   - Hasta que administración compruebe el documento no publica (la base
     tampoco lo deja: `entity_pending`).
   - «Tu ficha › Cuenta de entidad» (`#/ficha/entidad`): un negocio ya dado
     de alta la pide con el mismo documento (`apply_entity`), o la vuelve a
     pedir tras un rechazo; mientras se revisa, cómo va y «Retirar».
   - Su panel no enseña plan ni cuota, Fidelizar, bonos, sorteos, cupones,
     RRPP ni partidos (`esEntidad()` en panel.js y herramientas.js).

   Script clásico: comparte ámbito con panel.js y ficha.js. Los nombres de
   aquí empiezan por `ent`. */
'use strict';

// Iconos que no están en la fuente recortada del panel.
Object.assign(SVG, {
  entidad: 'M4 10h3v7H4zM10.5 10h3v7h-3zM2 19h20v3H2zM17 10h3v7h-3zM12 1 2 6v2h20V6z',
  documento: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  espera: 'M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5-4-4V4h8v3.5l-4 4z',
  deshacer: 'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z',
});

const ENT_TIPOS = [
  ['council', 'Ayuntamiento'], ['district', 'Junta de distrito'], ['merchants', 'Asociación de comerciantes'],
  ['neighbours', 'Asociación vecinal'], ['ngo', 'ONG'], ['other', 'Otra entidad sin ánimo de lucro'],
];
/** Lo que dice el sello (como `EntityKind.label` en la app). */
const ENT_SELLO = {
  council: 'Ayuntamiento', district: 'Junta de distrito', merchants: 'Asociación de comerciantes',
  neighbours: 'Asociación vecinal', ngo: 'ONG', other: 'Entidad', public_agenda: 'Agenda pública',
};
const entSello = (k) => I18N.t(ENT_SELLO[k] || 'Entidad');

/** El CIF como lo guarda la base, y si tiene forma de CIF de entidad. */
const entCif = (v) => String(v || '').toUpperCase().replace(/[\s.-]/g, '');
const entCifOk = (v) => /^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(entCif(v));
/** Una web con pinta de web (con o sin https://), como `entity_website_clean`. */
const entWebOk = (v) => {
  let s = String(v || '').trim();
  if (!s) return false;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s.length <= 300 && /^https?:\/\/[^\s/@]+\.[^\s/@]{2,}(\/\S*)?$/i.test(s);
};

const ENT_ERRORES = {
  invalid_tax_id: 'Revisa el CIF: una letra, siete cifras y un carácter de control (P para ayuntamientos, G para asociaciones).',
  invalid_website: 'Escribe la dirección de la web oficial.',
  proof_required: 'Añade el documento que lo acredite (PDF o foto).',
  invalid_proof: 'Añade el documento que lo acredite (PDF o foto).',
  already_pending: 'Ya hay una solicitud en revisión.',
  already_entity: 'Ya es una entidad verificada.',
  adult_required: 'Para dar de alta una entidad hace falta tener 18 años y la fecha de nacimiento en el perfil.',
  offensive_text: 'Hay palabras que no podemos aceptar. Revisa lo que has escrito.',
  rate_limited: 'Demasiados intentos. Espera un momento.',
  invalid_city: 'Marca en el mapa dónde actuáis.',
  invalid_location: 'Marca en el mapa dónde actuáis.',
  not_allowed: 'La cuenta de entidad la pide quien es propietario o encargado del negocio.',
};
const entError = (code) => I18N.t(ENT_ERRORES[code] || 'Algo ha fallado');

/** ¿Es una entidad, o se dio de alta como entidad y aún no la hemos
 * comprobado? (`BIZ.entity`, lo pone `entCarga`). */
const esEntidad = () => !!(BIZ?.entity?.kind || BIZ?.entity?.pending);
/** Lo que un panel de entidad no enseña (el menú y las rutas). */
const SIN_ENTIDAD = ['fidelizar', 'rrpp', 'partidos', 'antes-de-cerrar', 'cartel-local', 'cerrados', 'cola', 'grupos',
  'sellos', 'bonos', 'cumpleanos', 'mensajes', 'sorteos', 'cupon', 'habituales'];

/** Cómo va lo de la entidad del negocio de ahora (para el menú, el resumen y
 * «Tu ficha»). Sin la función (o sin permiso), como un negocio más. */
async function entCarga() {
  const negocio = BIZ?.id;
  if (!negocio) return;
  const r = await rpc('my_entity_application', { p_business: negocio }).catch(() => null);
  if (BIZ?.id !== negocio) return;
  const a = r?.application || null;
  BIZ.entity = {
    kind: r?.entity_kind || null,
    pending: !!a && a.status === 'pending' && a.origin === 'signup',
    application: a,
    canApply: r?.can_apply === true,
    why: r?.why || null,
  };
}

// ── El documento ────────────────────────────────────────────────────────────
/** Sube el documento al Storage privado y devuelve su ruta: una foto se
 * reduce (y pierde los datos de la cámara); un PDF, como mucho 10 MB. */
async function entSubeDocumento(archivo) {
  const pdf = archivo.type === 'application/pdf';
  let blob = archivo;
  if (!pdf) {
    if (!/^image\//.test(archivo.type)) throw new Error(I18N.t('Solo fotos (JPG, PNG, WebP o HEIC) y PDF.'));
    if (archivo.size > 20 * 1024 * 1024) throw new Error(I18N.t('Cada archivo puede pesar como mucho 10 MB.'));
    blob = await KFotos.reduce(archivo, KFotos.TAM.foto);
  } else if (archivo.size > 10 * 1024 * 1024) {
    throw new Error(I18N.t('Cada archivo puede pesar como mucho 10 MB.'));
  }
  const ext = pdf ? 'pdf' : blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1];
  const ruta = `${ME.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('business-claims').upload(ruta, blob, { contentType: blob.type });
  if (error) throw new Error(friendly(error.message));
  return ruta;
}
const entQuitaDocumento = (ruta) => { if (ruta) sb.storage.from('business-claims').remove([ruta]).catch(() => {}); };

// ── Los campos ──────────────────────────────────────────────────────────────
const entHtmlSobre = (d) => `
  <label class="f full"><span>Tipo de entidad *</span><select name="ent_kind">
    ${ENT_TIPOS.map(([k, n]) => `<option value="${k}" ${(d.kind || 'council') === k ? 'selected' : ''}>${esc(I18N.t(n))}</option>`).join('')}</select></label>
  <label class="f full"><span>Nombre oficial *</span><input name="official_name" maxlength="150" required placeholder="Por ejemplo: Ayuntamiento de Getafe" value="${esc(d.official_name || '')}"></label>
  <label class="f"><span>CIF de la entidad *</span><input name="ent_tax_id" maxlength="12" required placeholder="P2806500B" autocapitalize="characters" value="${esc(d.tax_id || '')}"></label>
  <label class="f"><span>Web oficial *</span><input name="ent_website" maxlength="300" required inputmode="url" placeholder="Por ejemplo: getafe.es" value="${esc(d.website || '')}"></label>
  <p class="muted full" style="margin:0">El nombre y la web salen en tu ficha; el CIF no se publica.</p>`;

/** La zona del alta: el punto (como «Sin local fijo»: el municipio, no un
 * portal), el municipio y, si quiere, el distrito o el barrio. */
const entHtmlZona = (d) => `
  <input type="checkbox" name="no_fixed_venue" checked hidden>
  <label class="f"><span>Municipio *</span><input name="city" maxlength="60" required placeholder="Por ejemplo: Getafe" value="${esc(d.city || '')}"></label>
  <label class="f"><span>Distrito o barrio (opcional)</span><input name="ent_area" maxlength="120" placeholder="Por ejemplo: Distrito Centro" value="${esc(d.area || '')}"></label>
  <div class="full" data-punto-caja>
    <p class="zona-t" data-zona-t><b>Dónde actuáis *</b></p>
    <p class="mapa-botones"><button class="btn sm" type="button" data-buscar>${ms('location_on')}Buscar en el mapa</button>
      <button class="btn sm" type="button" data-aqui hidden>Estoy en el local</button></p>
    <p class="muted" data-punto-txt style="margin:0 0 8px">Es el punto de tu ficha. Cada evento lleva luego su propio sitio.</p>
    <div class="mapa" data-mapa></div>
  </div>`;

/** La zona desde «Tu ficha» (el negocio ya tiene su punto). */
const entHtmlZonaTexto = (d) => `
  <label class="f full"><span>Municipio, distrito o barrio donde actuáis *</span><input name="ent_area" maxlength="120" required placeholder="Por ejemplo: Distrito Centro" value="${esc(d.area || '')}"></label>`;

const entHtmlPersona = (d) => `
  <label class="f"><span>Tu nombre y apellidos *</span><input name="contact_name" maxlength="100" required autocomplete="name" value="${esc(d.contact_name || '')}"></label>
  <label class="f"><span>Tu cargo *</span><input name="contact_role" maxlength="80" required placeholder="Por ejemplo: técnica de Cultura, presidente, secretaria" value="${esc(d.contact_role || '')}"></label>
  <div class="f full" data-doc-caja>
    <span class="f-tit"><b>Documento que lo acredite *</b></span>
    <p class="muted" style="margin:0 0 8px">Un PDF o una foto: tu nombramiento, un certificado de la secretaría, el acta de la junta o la inscripción en el registro de asociaciones. Solo lo ve el equipo de Klendar y se borra a los 6 meses de decidir.</p>
    <p data-doc-estado style="margin:0 0 8px"${d.proof_path ? '' : ' hidden'}>${icono('documento')} <span data-doc-nombre>${esc(d.proof_name || I18N.t('Documento añadido'))}</span>
      <button class="btn sm ghost" type="button" data-doc-quitar>Quitar el documento</button></p>
    <label class="btn sm" data-doc-elegir${d.proof_path ? ' hidden' : ''}>${icono('documento')}<span>Añadir PDF o foto</span>
      <input type="file" name="ent_doc" accept="application/pdf,image/*" hidden></label>
  </div>
  <label class="f full casilla"><input type="checkbox" name="ent_declaration" ${d.declaration ? 'checked' : ''}>
    <span>Declaro que los datos son ciertos y que puedo representar a esta entidad.</span></label>`;

/** El botón del documento: sube al elegir, enseña el nombre y deja quitarlo. */
function entActivaDocumento(caja, d) {
  const input = $('[name=ent_doc]', caja);
  const estado = $('[data-doc-estado]', caja);
  const elegir = $('[data-doc-elegir]', caja);
  const pinta = () => {
    estado.hidden = !d.proof_path;
    elegir.hidden = !!d.proof_path;
    $('[data-doc-nombre]', caja).textContent = d.proof_name || I18N.t('Documento añadido');
  };
  input.onchange = async () => {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    const texto = $('span', elegir);
    texto.textContent = I18N.t('Subiendo el documento…');
    try {
      const ruta = await entSubeDocumento(archivo);
      entQuitaDocumento(d.proof_path);
      d.proof_path = ruta;
      d.proof_name = archivo.name.slice(0, 120);
      // Lo que decía que faltaba el documento ya no vale.
      const err = $('#err', caja);
      if (err) err.textContent = '';
    } catch (e) {
      toast(e.message, true);
    } finally {
      texto.textContent = I18N.t('Añadir PDF o foto');
      pinta();
    }
  };
  $('[data-doc-quitar]', caja).onclick = () => {
    entQuitaDocumento(d.proof_path);
    d.proof_path = null;
    d.proof_name = '';
    pinta();
    elegir.focus();
  };
}

/** Lee del formulario lo que haya (para no perder nada al ir y venir). */
function entLee(f, d) {
  const val = (n) => (f.elements[n] ? String(f.elements[n].value || '') : null);
  const pon = (campo, n) => { const x = val(n); if (x !== null) d[campo] = x; };
  pon('kind', 'ent_kind'); pon('official_name', 'official_name'); pon('tax_id', 'ent_tax_id'); pon('website', 'ent_website');
  pon('city', 'city'); pon('area', 'ent_area'); pon('contact_name', 'contact_name'); pon('contact_role', 'contact_role');
  if (f.elements.ent_declaration) d.declaration = f.elements.ent_declaration.checked;
  if (f.elements.terms) d.terms = f.elements.terms.checked;
}

/** Comprueba los campos de texto que haya en el formulario. */
function entFaltan(f, d) {
  const faltan = [];
  const largo = (n, min) => f.elements[n] && String(f.elements[n].value || '').trim().length < min;
  if (f.elements.official_name) faltan.push([f.elements.official_name, largo('official_name', 2) ? obligatorioTxt() : null]);
  if (f.elements.ent_tax_id) faltan.push([f.elements.ent_tax_id, entCifOk(d.tax_id) ? null : I18N.t(ENT_ERRORES.invalid_tax_id)]);
  if (f.elements.ent_website) faltan.push([f.elements.ent_website, entWebOk(d.website) ? null : I18N.t(ENT_ERRORES.invalid_website)]);
  if (f.elements.city) faltan.push([f.elements.city, largo('city', 2) ? obligatorioTxt() : null]);
  if (f.elements.ent_area && f.elements.ent_area.required) faltan.push([f.elements.ent_area, largo('ent_area', 2) ? obligatorioTxt() : null]);
  if (f.elements.contact_name) faltan.push([f.elements.contact_name, largo('contact_name', 2) ? obligatorioTxt() : null]);
  if (f.elements.contact_role) faltan.push([f.elements.contact_role, largo('contact_role', 2) ? obligatorioTxt() : null]);
  return marcaFaltan(faltan);
}

/** Lo que se manda a la base (`register_entity` / `apply_entity`). */
const entParams = (d, areaPorDefecto = '') => ({
  p_kind: d.kind || 'council',
  p_official_name: d.official_name.trim(),
  p_tax_id: entCif(d.tax_id),
  p_contact_name: d.contact_name.trim(),
  p_contact_role: d.contact_role.trim(),
  p_proof_path: d.proof_path,
  p_website: d.website.trim(),
  p_area: (d.area || '').trim() || areaPorDefecto,
});

// ── «¿Qué vas a dar de alta?» ───────────────────────────────────────────────
function entElegir(v) {
  const otro = BIZZES.length > 0;
  const op = (href, icon, titulo, frase) => `<a class="crear-op" href="${href}">${icono(icon)}
    <span><b>${esc(I18N.t(titulo))}</b><small>${esc(I18N.t(frase))}</small></span>${ms('chevron_right')}</a>`;
  v.innerHTML = `
    <div class="page-head"><h1>¿Qué vas a dar de alta?</h1></div>
    <p class="muted" style="max-width:640px">Elige lo que eres: el alta cambia para pedirte solo lo que hace falta.</p>
    ${otro ? '' : `<p class="muted" style="max-width:640px">${esc(I18N.t('¿Te han invitado al equipo de un negocio? Entonces no hace falta: entra con el mismo correo con el que te invitaron y aparecerá solo.'))}</p>`}
    <div class="crear-ops alta-elegir" style="max-width:640px">
      ${op('#/alta/1', 'storefront', 'Un negocio', 'Un bar, un restaurante, una tienda, una sala… o fiestas y eventos sin local fijo.')}
      ${op('#/alta/entidad/1', 'entidad', 'Un ayuntamiento, asociación u ONG', 'Ayuntamiento, junta de distrito, asociación de comerciantes o de vecinos, ONG u otra entidad sin ánimo de lucro. Publicáis eventos y campañas; antes comprobamos quiénes sois.')}
    </div>`;
}

// ── El alta de una entidad (`#/alta/entidad/1…3`) ────────────────────────────
let ALTA_ENT = null;
const entAltaNueva = () => ({
  kind: 'council', official_name: '', tax_id: '', website: '', city: '', area: '', punto: null,
  contact_name: '', contact_role: '', proof_path: null, proof_name: '', declaration: false, terms: false,
});
const PASOS_ENT = ['La entidad', 'Zona', 'Quién la da de alta'];
function entPasoIncompleto(n) {
  const A = ALTA_ENT;
  if (n === 1) return A.official_name.trim().length < 2 || !entCifOk(A.tax_id) || !entWebOk(A.website);
  if (n === 2) return A.city.trim().length < 2 || !A.punto;
  return false;
}

async function entAlta(v, param) {
  if (!ALTA_ENT) ALTA_ENT = entAltaNueva();
  const A = ALTA_ENT;
  const paso = Math.min(3, Math.max(1, parseInt(param, 10) || 1));
  for (let n = 1; n < paso; n++) if (entPasoIncompleto(n)) { location.hash = `#/alta/entidad/${n}`; return; }

  const cuerpo = {
    1: () => `<div class="help full">Comprobamos que representas a la entidad antes de hacerla pública (normalmente en 24–48 h); hasta entonces no se puede publicar. Hace falta tener 18 años. De momento, las entidades no pagan cuota.</div>
      ${entHtmlSobre(A)}`,
    2: () => entHtmlZona(A),
    3: () => `${entHtmlPersona(A)}
      <label class="f full casilla"><input type="checkbox" name="terms" ${A.terms ? 'checked' : ''}>
        <span>Acepto las <a href="${APP_URL}/negocios/" target="_blank" rel="noopener">condiciones para negocios</a> *</span></label>`,
  }[paso];

  v.innerHTML = `
    <div class="page-head"><h1>Dar de alta una entidad</h1></div>
    <div class="alta-progreso">
      <p><b>${esc(`${bi('Paso {n} de 3', 'Step {n} of 3').replace('{n}', paso)} · ${I18N.t(PASOS_ENT[paso - 1])}`)}</b></p>
      <div class="alta-barra" role="progressbar" aria-label="${esc(bi('Progreso del alta', 'Sign-up progress'))}" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${paso}"><span style="width:${Math.round(paso * 100 / 3)}%"></span></div>
    </div>
    <form id="altaEnt" class="form ficha-form" novalidate>${cuerpo()}
      <div class="full alta-botones">
        <button class="btn" type="button" data-atras>Atrás</button>
        <button class="btn primary" type="submit" id="enviar">${paso < 3 ? 'Siguiente' : 'Enviar solicitud'}</button></div>
      <p id="err" class="err full" role="alert"></p>
    </form>`;
  I18N.translate(v);
  const f = $('#altaEnt', v);
  f.oninput = () => entLee(f, A);
  f.onchange = () => entLee(f, A);
  if (paso === 2) activaDonde($('[data-punto-caja]', v), f, A);
  if (paso === 3) entActivaDocumento(v, A);
  // Del primer paso, otra vez a «¿Qué vas a dar de alta?» (sin perder nada).
  $('[data-atras]', v).onclick = () => { entLee(f, A); location.hash = paso > 1 ? `#/alta/entidad/${paso - 1}` : '#/alta'; };
  f.onsubmit = async (e) => {
    e.preventDefault();
    entLee(f, A);
    $('#err', v).textContent = '';
    if (!entFaltan(f, A)) return;
    if (paso === 2 && !(await aseguraPunto($('[data-punto-caja]', v), f, A))) return;
    if (paso < 3) { location.hash = `#/alta/entidad/${paso + 1}`; return; }
    if (!A.proof_path) { $('#err', v).textContent = I18N.t(ENT_ERRORES.proof_required); $('[data-doc-elegir]', v)?.focus(); return; }
    if (!marcaFaltan([
      [f.elements.ent_declaration, A.declaration ? null : I18N.t('Marca la declaración para enviarla.')],
      [f.elements.terms, A.terms ? null : I18N.t('Tienes que aceptar las condiciones para negocios.')],
    ])) return;
    const boton = $('#enviar', v);
    boton.disabled = true;
    try {
      const r = await rpc('register_entity', {
        ...entParams(A, A.city.trim()), p_lat: A.punto.lat, p_lng: A.punto.lng, p_city: A.city.trim(),
      });
      if (!r?.ok) throw Object.assign(new Error(entError(r?.error)), { yaDicho: true });
      const id = r.business_id;
      const punto = A.punto;
      ALTA_ENT = null;
      GUARDA = null;
      BIZZES = await rpc('my_businesses');
      BIZ = BIZZES.find((b) => b.id === id) || BIZZES[0];
      localStorage.setItem('klendar.biz', BIZ.id);
      if (BIZ.id === id) BIZ.time_zone = KZ.porCoordenadas(punto.lat, punto.lng);
      await preparaNegocio();
      $('.bizpick').hidden = false;
      renderBizPicker();
      toast('Solicitud enviada. Te avisamos cuando la revisemos.');
      if (location.hash === '#/resumen') route(); else location.hash = '#/resumen';
    } catch (e2) {
      $('#err', v).textContent = e2.yaDicho ? e2.message : I18N.t(friendly(e2.message));
      boton.disabled = false;
    }
  };
  sinDobleEnvio(v);
  GUARDA = {
    sucia: () => !!ALTA_ENT && JSON.stringify({ ...ALTA_ENT, punto: null }) !== JSON.stringify(entAltaNueva()),
    dentro: (h) => h.startsWith('#/alta'),
  };
}

// ── «Tu ficha › Cuenta de entidad» (`#/ficha/entidad`) ─────────────────────
async function entFicha(v, b) {
  await entCarga();
  const e = BIZ.entity || {};
  const a = e.application;
  const cab = `<p class="crumbs"><a href="#/ficha">← ${esc(I18N.t('Tu ficha'))}</a></p>
    <div class="page-head"><h1>${esc(I18N.t('Cuenta de entidad'))}</h1></div>`;
  const nota = (icon, titulo, texto, extra = '') => `<div class="card" style="max-width:680px"><h2 style="display:flex;gap:8px;align-items:center;margin:0 0 6px">${icono(icon)}<span>${esc(I18N.t(titulo))}</span></h2>
    <p class="muted" style="margin:0">${esc(texto)}</p>${extra}</div>`;
  if (e.kind) {
    v.innerHTML = `${cab}${nota('check_circle', 'Entidad verificada', I18N.t('Tu ficha y lo que publiques llevan este sello. Si los datos dejan de ser ciertos, escríbenos a info@klendar.app.'),
      `<p style="margin:10px 0 0"><span class="tag badge-entidad">${icono('entidad')} ${esc(entSello(e.kind))}</span></p>`)}`;
    return;
  }
  if (a && a.status === 'pending') {
    const fecha = new Date(a.created_at).toLocaleDateString(I18N.locale, { day: 'numeric', month: 'short', year: 'numeric' });
    v.innerHTML = `${cab}${nota('espera', 'Comprobando la entidad',
      bi('Solicitud enviada el {fecha}. Te avisamos cuando la revisemos.', "Request sent on {fecha}. We'll let you know once we've reviewed it.").replace('{fecha}', fecha),
      `<p style="margin:12px 0 0"><button class="btn" type="button" id="retirar">${icono('deshacer')}${esc(I18N.t('Retirar la solicitud'))}</button></p>`)}`;
    $('#retirar', v).onclick = async () => {
      if (!await confirmDlg(I18N.t('¿Retirar la solicitud?'), esc(I18N.t('Dejaremos de revisarla y el documento se borrará. Podrás volver a pedirla cuando quieras.')), { submit: I18N.t('Retirar la solicitud'), danger: true })) return;
      const r = await rpc('withdraw_entity_application', { p_id: a.id }).catch((x) => ({ ok: false, error: x.message }));
      if (!r?.ok) { toast(entError(r?.error), true); return; }
      await entCarga();
      route();
    };
    return;
  }
  if (!e.canApply) {
    v.innerHTML = `${cab}${nota('help_outline', 'Cuenta de entidad', entError(e.why === 'adult_required' ? 'adult_required' : 'not_allowed'))}`;
    return;
  }
  const d = a && a.status === 'rejected'
    ? { kind: a.kind, official_name: a.official_name || '', tax_id: a.tax_id || '', website: a.website || '', area: a.area || '', contact_name: a.contact_name || '', contact_role: a.contact_role || '' }
    : { kind: 'council', official_name: b?.name || '', tax_id: '', website: b?.website || '', area: b?.city || '', contact_name: '', contact_role: '' };
  Object.assign(d, { proof_path: null, proof_name: '', declaration: false });
  v.innerHTML = `${cab}
    ${a && a.status === 'rejected' ? `<div class="help" style="max-width:680px"><b>${esc(I18N.t('No hemos podido verificar la entidad'))}</b> ${esc(a.reason || I18N.t('Puedes volver a pedirlo con otro documento o escribirnos a info@klendar.app.'))}</div>` : ''}
    <p class="muted" style="max-width:680px">Si este perfil es de un ayuntamiento, una junta de distrito, una asociación o una ONG, pide la cuenta de entidad: lleva su sello en la ficha y en lo que publique y, de momento, no paga cuota. Comprobamos el documento antes de ponerla; mientras, todo sigue igual.</p>
    <form id="fichaEnt" class="form ficha-form" novalidate>
      ${entHtmlSobre(d)}${entHtmlZonaTexto(d)}${entHtmlPersona(d)}
      <div class="full alta-botones uno"><button class="btn primary" type="submit" id="enviar">Enviar solicitud</button></div>
      <p id="err" class="err full" role="alert"></p>
    </form>`;
  I18N.translate(v);
  const f = $('#fichaEnt', v);
  f.oninput = () => entLee(f, d);
  f.onchange = () => entLee(f, d);
  entActivaDocumento(v, d);
  GUARDA = { sucia: () => !!d.proof_path || !!d.contact_name.trim() };
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    entLee(f, d);
    $('#err', v).textContent = '';
    if (!entFaltan(f, d)) return;
    if (!d.proof_path) { $('#err', v).textContent = I18N.t(ENT_ERRORES.proof_required); $('[data-doc-elegir]', v)?.focus(); return; }
    if (!marcaFaltan([[f.elements.ent_declaration, d.declaration ? null : I18N.t('Marca la declaración para enviarla.')]])) return;
    const boton = $('#enviar', v);
    boton.disabled = true;
    const r = await rpc('apply_entity', { p_business: BIZ.id, ...entParams(d) }).catch((x) => ({ ok: false, error: x.message }));
    if (!r?.ok) { $('#err', v).textContent = entError(r?.error); boton.disabled = false; return; }
    d.proof_path = null;
    GUARDA = null;
    toast('Solicitud enviada. Te avisamos cuando la revisemos.');
    await entCarga();
    route();
  };
}

// ── En el resumen ───────────────────────────────────────────────────────────
/** Se dio de alta como entidad y aún no la hemos comprobado. */
function entAvisoPendiente() {
  return `<div class="help"><b>${esc(I18N.t('Comprobando la entidad'))}</b>
    ${esc(I18N.t('Estamos mirando el documento; normalmente tardamos 24–48 h. Hasta que lo verifiquemos no se puede publicar, pero ya puedes completar la ficha.'))}
    <p style="margin:8px 0 0"><a class="btn sm" href="#/ficha/entidad">${icono('documento')}${esc(I18N.t('Ver la solicitud'))}</a></p></div>`;
}
