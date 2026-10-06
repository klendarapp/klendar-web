/* «Tu ficha» por apartados y el alta en tres pasos (panel web).

   Lo mismo que la app (`lib/features/business_panel/presentation/profile/`):
   «Tu ficha» es un índice con un resumen de una línea por apartado; cada
   apartado se edita en su propia vista (`#/ficha/fotos`, `#/ficha/basico`…)
   con un solo «Guardar», que manda solo lo suyo a `update_business`. Al
   final, solo para el propietario, la «Zona delicada» (descargar los datos y
   dar de baja el negocio). El alta usa las mismas partes en tres pasos
   (`#/alta/1`, `#/alta/2`, `#/alta/3`) y no pierde nada al ir atrás.

   Script clásico: comparte ámbito con panel.js (PAGES, rpc, BIZ, esc…). */
'use strict';

/** «Cómo es tu local»: los 12 atributos del sitio, en el orden de la app
 * (`place_attribute_slugs()` en la base), con su icono. Se ven en la ficha
 * pública y la gente filtra por ellos («El sitio» y «Con niños»). */
const SITIO_PANEL = [
  ['terrace', 'Terraza', 'deck'], ['indoor', 'Bajo techo', 'roofing'], ['outdoor', 'Al aire libre', 'park'],
  ['kids', 'Apto para niños', 'child_friendly'], ['play_area', 'Zona infantil', 'toys'], ['dogs', 'Admite perros', 'pets'],
  ['wheelchair', 'Accesible en silla de ruedas', 'accessible'], ['wifi', 'Wifi', 'wifi'], ['card', 'Pago con tarjeta', 'credit_card'],
  ['air_conditioning', 'Aire acondicionado', 'ac_unit'], ['parking', 'Aparcamiento', 'local_parking'], ['veggie', 'Opciones vegetarianas', 'eco'],
];

/** Los apartados, en el orden del índice: [ruta, título]. «Carta» lleva a
 * su pantalla de siempre (`#/carta`). */
const PARTES_FICHA = [
  ['fotos', 'Fotos'],
  ['basico', 'Lo básico'],
  ['donde', 'Dónde está'],
  ['horario', 'Horario'],
  ['contacto', 'Contacto y redes'],
  ['carta', 'Carta'],
  ['local', 'Cómo es tu local'],
  ['klendar', 'Datos para Klendar'],
  ['mayores', 'Solo para mayores de 18'],
];
const tituloParte = (k) => (PARTES_FICHA.find((p) => p[0] === k) || [])[1]
  || (k === 'datos' ? 'Descargar los datos del negocio' : 'Tu ficha');

// ── Horario ─────────────────────────────────────────────────────────────────
const SEMANA = [
  [1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'],
  [5, 'Viernes'], [6, 'Sábado'], [7, 'Domingo'],
];
// En inglés, el nombre del día lo da el navegador (2026-09-14 es lunes).
const nombreDia = (d) => (I18N.lang === 'en'
  ? new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date(2026, 8, 13 + d))
  : SEMANA[d - 1][1]);
const aMinutos = (t) => { const [h, m] = String(t).split(':').map(Number); return (h % 24) * 60 + m; };
const deMinutos = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const tramoValido = (t) => Array.isArray(t) && t.length === 2 && /^\d{1,2}:\d{2}$/.test(t[0]) && /^\d{1,2}:\d{2}$/.test(t[1]);
const tramosDe = (horas, d) => ((horas && horas[String(d)]) || []).filter(tramoValido);
const cruzaMedianoche = (t) => aMinutos(t[1]) <= aMinutos(t[0]);
/** Acaba ya en el día siguiente (no a las 00:00 justas): «+1 día». */
const acabaManana = (t) => cruzaMedianoche(t) && aMinutos(t[1]) !== 0;
const hayHorario = (horas) => !!horas && typeof horas === 'object' && Object.keys(horas).length > 0;

/** Días (1..7) con tramos que se pisan o que abren y cierran a la misma
 * hora. Un tramo que cruza la medianoche cuenta hasta las 24:00 de su día.
 * Lo mismo que `OpeningHours.invalidDays` en la app. */
function diasMalHorario(horas) {
  const mal = [];
  for (let d = 1; d <= 7; d++) {
    const tr = tramosDe(horas, d);
    if (tr.some((t) => aMinutos(t[0]) === aMinutos(t[1]))) { mal.push(d); continue; }
    const s = tr.map((t) => [aMinutos(t[0]), cruzaMedianoche(t) ? 1440 : aMinutos(t[1])]).sort((a, b) => a[0] - b[0]);
    if (s.some((x, i) => i > 0 && x[0] < s[i - 1][1])) mal.push(d);
  }
  return mal;
}
const diasMalTexto = (dias) => dias.map((d) => nombreDia(d).toLowerCase()).join(', ');
const avisoHorarioMal = (dias) => bi(`Revisa ${diasMalTexto(dias)}: hay tramos que se pisan o que abren y cierran a la misma hora.`,
  `Check ${diasMalTexto(dias)}: some time slots overlap or open and close at the same time.`);

/** El horario en una línea: «L–V 9–14, 17–21 · S 10–14 · D cerrado» (como
 * `OpeningHours.summary` en la app). */
function resumenHorario(horas) {
  if (!hayHorario(horas)) return I18N.t('Sin horario');
  const ini = I18N.lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const cerrado = I18N.lang === 'en' ? 'closed' : 'cerrado';
  const hora = (t) => { const m = aMinutos(t); return m % 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : String(Math.floor(m / 60)); };
  const dia = (d) => { const tr = tramosDe(horas, d); return tr.length ? tr.map((t) => `${hora(t[0])}–${hora(t[1])}`).join(', ') : cerrado; };
  const partes = [];
  let a = 1;
  while (a <= 7) {
    let b = a;
    while (b < 7 && dia(b + 1) === dia(a)) b++;
    const dias = a === b ? ini[a - 1] : b === a + 1 ? `${ini[a - 1]}, ${ini[b - 1]}` : `${ini[a - 1]}–${ini[b - 1]}`;
    partes.push(`${dias} ${dia(a)}`);
    a = b + 1;
  }
  return partes.join(' · ');
}

/** El editor del horario, el mismo que la app: una tarjeta por día con
 * «Abierto», sus tramos (hasta tres, con las horas a la vista), «+ Tramo» y
 * «Copiar a…» (de lunes a viernes, fin de semana, todos o uno a uno). Un
 * tramo que cierra antes de abrir cruza la medianoche («+1 día»). Devuelve
 * { valor() } con el horario (null = sin horario). */
function editorHorario(caja, inicial, alCambiar = () => {}) {
  let horas = hayHorario(inicial) ? JSON.parse(JSON.stringify(inicial)) : null;
  const cambia = () => alCambiar(horas);
  const pon = (d, tr) => { horas = { ...horas, [String(d)]: tr }; };

  // Lo que cambia al escribir una hora, sin repintar (no se pierde el foco).
  const refresca = () => {
    const mal = diasMalHorario(horas);
    $$('[data-dia]', caja).forEach((el) => el.classList.toggle('mal', mal.includes(+el.dataset.dia)));
    $$('[data-cruza]', caja).forEach((el) => {
      const [d, i] = el.dataset.cruza.split(':').map(Number);
      const t = tramosDe(horas, d)[i];
      el.hidden = !(t && acabaManana(t));
    });
    const aviso = $('[data-h-aviso]', caja);
    if (aviso) { aviso.textContent = mal.length ? avisoHorarioMal(mal) : ''; aviso.hidden = !mal.length; }
  };

  const pinta = () => {
    if (!horas) {
      caja.innerHTML = `<p style="margin:0"><button type="button" class="btn sm" data-h-anadir>${esc(I18N.t('Añadir horario'))}</button></p>`;
      $('[data-h-anadir]', caja).onclick = () => {
        const manana = ['09:00', '14:00'];
        horas = { 1: [manana, ['17:00', '20:00']], 2: [manana, ['17:00', '20:00']], 3: [manana, ['17:00', '20:00']], 4: [manana, ['17:00', '20:00']], 5: [manana, ['17:00', '20:00']], 6: [['10:00', '14:00']], 7: [] };
        pinta(); cambia();
        $('[data-abierto="1"]', caja)?.focus();
      };
      return;
    }
    const mal = diasMalHorario(horas);
    caja.innerHTML = `<p class="hint" style="margin:0 0 10px">${esc(I18N.t('Cambia las horas en cada tramo. Con «Copiar a…» pasas un día a los demás.'))}</p>
      <div class="hdias">${SEMANA.map(([d]) => {
        const nombre = nombreDia(d);
        const tr = tramosDe(horas, d);
        return `<div class="hdia${mal.includes(d) ? ' mal' : ''}" data-dia="${d}" role="group" aria-label="${esc(nombre)}">
          <div class="hdia-cab"><b>${esc(nombre)}</b><span class="spacer"></span>
            <button type="button" class="btn sm ghost" data-copiar="${d}">${esc(I18N.t('Copiar a…'))}</button>
            <label class="hdia-abierto"><input type="checkbox" data-abierto="${d}" ${tr.length ? 'checked' : ''}><span>${esc(I18N.t('Abierto'))}</span></label></div>
          ${tr.length ? `<div class="htramos">${tr.map((t, i) => `<span class="htramo">
              <input type="time" value="${esc(t[0])}" data-t="${d}:${i}:0" aria-label="${esc(bi(`${nombre}, tramo ${i + 1}: abre a las`, `${nombre}, slot ${i + 1}: opens at`))}">
              <span aria-hidden="true">–</span>
              <input type="time" value="${esc(t[1])}" data-t="${d}:${i}:1" aria-label="${esc(bi(`${nombre}, tramo ${i + 1}: cierra a las`, `${nombre}, slot ${i + 1}: closes at`))}">
              <small class="muted" data-cruza="${d}:${i}" ${acabaManana(t) ? '' : 'hidden'}>${esc(I18N.t('+1 día'))}</small>
              ${tr.length > 1 ? `<button type="button" class="btn sm ghost htramo-quitar" data-quitar="${d}:${i}" aria-label="${esc(bi(`Quitar el tramo ${t[0]}–${t[1]}`, `Remove the time slot ${t[0]}–${t[1]}`))}">${ms('cancel')}</button>` : ''}
            </span>`).join('')}
            ${tr.length < 3 ? `<button type="button" class="btn sm ghost" data-tramo="${d}">+ ${esc(I18N.t('Tramo'))}</button>` : ''}</div>`
          : `<p class="muted" style="margin:6px 0 0">${esc(I18N.t('Cerrado'))}</p>`}
        </div>`;
      }).join('')}</div>
      <p class="err" role="alert" data-h-aviso ${mal.length ? '' : 'hidden'}>${mal.length ? esc(avisoHorarioMal(mal)) : ''}</p>
      <p style="margin:6px 0 0"><button type="button" class="btn sm ghost" data-h-quitar>${esc(I18N.t('Quitar horario'))}</button></p>`;

    $$('[data-abierto]', caja).forEach((c) => { c.onchange = () => {
      pon(+c.dataset.abierto, c.checked ? [['09:00', '14:00']] : []);
      pinta(); cambia();
      $(`[data-abierto="${c.dataset.abierto}"]`, caja)?.focus();
    }; });
    $$('[data-t]', caja).forEach((inp) => {
      const al = () => {
        if (!/^\d{1,2}:\d{2}$/.test(inp.value)) return;
        const [d, i, k] = inp.dataset.t.split(':').map(Number);
        const tr = tramosDe(horas, d).map((t) => [...t]);
        tr[i][k] = inp.value.slice(0, 5);
        pon(d, tr); refresca(); cambia();
      };
      inp.oninput = al; inp.onchange = al;
    });
    $$('[data-quitar]', caja).forEach((b) => { b.onclick = () => {
      const [d, i] = b.dataset.quitar.split(':').map(Number);
      pon(d, tramosDe(horas, d).filter((_, j) => j !== i));
      pinta(); cambia();
      $(`[data-tramo="${d}"]`, caja)?.focus();
    }; });
    $$('[data-tramo]', caja).forEach((b) => { b.onclick = () => {
      const d = +b.dataset.tramo;
      const tr = tramosDe(horas, d);
      // Un tramo más: empieza 3 h después de donde acaba el último.
      const fin = tr.length ? aMinutos(tr[tr.length - 1][1]) : 9 * 60 - 180;
      pon(d, [...tr, [deMinutos((fin + 180) % 1440), deMinutos((fin + 420) % 1440)]]);
      pinta(); cambia();
      const nuevos = $$(`[data-t^="${d}:"]`, caja);
      nuevos[nuevos.length - 2]?.focus();
    }; });
    $$('[data-copiar]', caja).forEach((b) => { b.onclick = () => copiarDia(+b.dataset.copiar); });
    $('[data-h-quitar]', caja).onclick = () => { horas = null; pinta(); cambia(); $('[data-h-anadir]', caja)?.focus(); };
  };

  async function copiarDia(desde) {
    const otros = SEMANA.map(([d]) => d).filter((d) => d !== desde);
    const atajos = [['De lunes a viernes', [1, 2, 3, 4, 5]], ['Fin de semana', [6, 7]], ['Todos', [1, 2, 3, 4, 5, 6, 7]]];
    const pendiente = modal({
      title: bi(`Copiar el horario del ${nombreDia(desde).toLowerCase()} a`, `Copy ${nombreDia(desde)} to`),
      html: `<div class="hcopia-atajos">${atajos.map(([t, dias]) => `<button type="button" class="btn sm" data-atajo="${dias.join(',')}">${esc(I18N.t(t))}</button>`).join('')}</div>`,
      fields: otros.map((d) => ({ type: 'checkbox', name: `d${d}`, label: nombreDia(d), value: false })),
      submit: I18N.t('Copiar'),
    });
    const dlg = $('#modal');
    $$('[data-atajo]', dlg).forEach((a) => { a.onclick = () => {
      const dias = a.dataset.atajo.split(',').map(Number);
      otros.forEach((d) => { const c = dlg.querySelector(`[name=d${d}]`); if (c) c.checked = dias.includes(d); });
    }; });
    I18N.translate(dlg);
    const r = await pendiente;
    const b = $(`[data-copiar="${desde}"]`, caja);
    if (!r) { b?.focus(); return; }
    const destino = otros.filter((d) => r[`d${d}`]);
    if (!destino.length) { b?.focus(); return; }
    const tr = tramosDe(horas, desde);
    destino.forEach((d) => pon(d, tr.map((t) => [...t])));
    pinta(); cambia();
    $(`[data-copiar="${desde}"]`, caja)?.focus();
    toast(bi(`Copiado a ${destino.length === 1 ? nombreDia(destino[0]).toLowerCase() : `${destino.length} días`}`,
      `Copied to ${destino.length === 1 ? nombreDia(destino[0]) : `${destino.length} days`}`));
  }

  pinta();
  return { valor: () => (horas ? JSON.parse(JSON.stringify(horas)) : null) };
}

// ── Lo que tiene cada apartado ──────────────────────────────────────────────
const obligatorioTxt = () => KL_VALIDA.MSG[I18N.lang === 'en' ? 'en' : 'es'].obligatorio;
const pareceCorreo = (v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

/** Nombre, categoría (el selector de toda la web) y de qué va. */
const htmlBasico = (d) => `
  <label class="f full"><span>Nombre del negocio *</span><input name="name" maxlength="80" required placeholder="Ej. La Taberna del Gato" value="${esc(d.name || '')}"></label>
  <label class="f full"><span>Categoría *</span><span data-campo-cat></span></label>
  <label class="f full"><span>De qué va <small>(¿qué ofrece tu negocio? ¿qué lo hace especial?)</small></span><textarea name="description" maxlength="500" rows="4">${esc(d.description || '')}</textarea></label>`;

/** Dirección, ciudad y el punto en el mapa. */
const htmlDonde = (d) => `
  <label class="f full"><span>Dirección *</span><input name="address" maxlength="120" required placeholder="Calle y número" value="${esc(d.address || '')}"></label>
  <label class="f full"><span>Ciudad *</span><input name="city" maxlength="60" required value="${esc(d.city || '')}"></label>
  <div class="full" data-punto-caja>
    <p class="mapa-botones"><button class="btn sm" type="button" data-buscar>${ms('location_on')}Buscar en el mapa</button>
      <button class="btn sm" type="button" data-aqui>Estoy en el local</button></p>
    <p class="muted" data-punto-txt style="margin:0 0 8px">${d.punto ? 'Ubicación marcada. Si no es exacta, arrastra la chincheta.' : 'Marca dónde está la puerta: la gente te encuentra por la distancia.'}</p>
    <div class="mapa" data-mapa></div>
  </div>`;

/** Teléfono, web, correo de contacto (lo ve la gente) y redes. */
const htmlContacto = (d) => `
  <label class="f"><span>Teléfono</span><input name="phone" maxlength="20" inputmode="tel" placeholder="+34 600 000 000" value="${esc(d.phone || '')}"></label>
  <label class="f"><span>Web</span><input name="website" type="url" placeholder="https://" value="${esc(d.website || '')}"></label>
  <label class="f full"><span>Correo de contacto <small>(lo ven los clientes: mejor uno del negocio que el tuyo personal)</small></span><input name="contact_email" type="email" maxlength="254" placeholder="hola@tunegocio.com" value="${esc(d.contact_email || '')}"></label>
  <label class="f"><span>Instagram</span><input name="instagram" placeholder="@usuario" value="${esc(d.instagram || '')}"></label>
  <label class="f"><span>TikTok</span><input name="tiktok" placeholder="@usuario" value="${esc(d.tiktok || '')}"></label>
  <label class="f"><span>Facebook</span><input name="facebook" value="${esc(d.facebook || '')}"></label>`;

/** El NIF/CIF: para comprobar que el negocio es tuyo; no se publica. */
const htmlKlendar = (d) => `
  <p class="muted full" style="margin:0">Lo usamos para comprobar que el negocio es tuyo. No sale en tu ficha ni lo ve nadie fuera de Klendar.</p>
  <label class="f"><span>NIF / CIF</span><input name="tax_id" maxlength="20" placeholder="B12345678" value="${esc(d.tax_id || '')}"></label>`;

const htmlMayores = (d) => `
  <label class="f full casilla"><input type="checkbox" name="adults_only" ${d.adults_only ? 'checked' : ''}>
    <span>Solo para mayores de 18 <small class="muted">Si lo que publicas menciona alcohol, se marca +18 solo y se revisa antes de salir. La publicidad de tabaco, vapeo o apuestas no está permitida. En un negocio +18, todo el equipo tiene que ser mayor de edad.</small></span></label>`;

/** «Cómo es tu local»: El sitio, el rango de precio y «¿Hay sitio ahora?»
 * (`extra` = { precio, aforo }), como el apartado de la app. */
const htmlSitio = (sitio, extra = {}) => {
  const M = KlendarMarcas.t(I18N.lang);
  const precio = Number(extra.precio) || 0;
  return `
  <p class="muted full" style="margin:0">Marca lo que tenga tu local: sale en tu ficha y la gente lo puede buscar en los filtros.</p>
  <div class="sitio-ops full" role="group" aria-label="${esc(I18N.t('Cómo es tu local'))}">
    ${SITIO_PANEL.map(([k, nombre, icono]) => `<label class="sitio-op"><input type="checkbox" name="sitio" value="${k}" ${sitio.includes(k) ? 'checked' : ''}><span>${ms(icono)}${esc(nombre)}</span></label>`).join('')}
  </div>
  <div class="full"><p class="f-tit">${esc(M.priceTitle)}</p>
    <div class="sitio-ops" role="radiogroup" aria-label="${esc(M.priceTitle)}">
      ${[0, 1, 2, 3, 4].map((n) => `<label class="sitio-op"><input type="radio" name="price_level" value="${n || ''}" ${precio === n ? 'checked' : ''}><span${n ? ` aria-label="${esc(`${KlendarMarcas.simbolo(n)}, ${KlendarMarcas.significado(n, I18N.lang)}`)}"` : ''}>${esc(n ? KlendarMarcas.simbolo(n) : M.priceNone)}</span></label>`).join('')}
    </div>
    <p class="muted" style="margin:6px 0 0">${esc(M.priceHint)}</p></div>
  <label class="f full casilla"><input type="checkbox" name="crowd_enabled" ${extra.aforo ? 'checked' : ''}>
    <span>${esc(M.crowdTitle)} <small class="muted">${esc(M.crowdSettingHint)}</small></span></label>`;
};

/** Logo, portada y las fotos del local. `est` = { logo, portada, galeria }. */
const htmlFotos = (est) => `
  <p class="muted full" style="margin:0">${bi('La <b>portada</b> sale arriba del todo en tu ficha; el <b>logo</b>, redondo y pequeño en Descubre, el mapa y los resultados. Las fotos del local, en tu ficha.',
    'The <b>cover</b> goes at the very top of your page; the <b>logo</b>, small and round in Discover, the map and results. Photos of the place, on your page.')}</p>
  <div class="full fotos-ficha">
    <div class="foto-hueco"><span class="foto-tit">Portada</span>
      ${est.portada ? `<img class="foto-portada" src="${esc(est.portada)}" alt="">` : `<div class="foto-portada vacia">${ms('photo_camera')}</div>`}
      <div class="foto-acc"><button class="btn sm" type="button" data-foto="cover">${est.portada ? 'Cambiar portada' : 'Poner portada'}</button>
        ${est.portada ? '<button class="btn sm ghost" type="button" data-foto-quitar="cover">Quitar</button>' : ''}</div></div>
    <div class="foto-hueco"><span class="foto-tit">Logo</span>
      ${est.logo ? `<img class="foto-logo" src="${esc(est.logo)}" alt="">` : `<div class="foto-logo vacia">${ms('photo_camera')}</div>`}
      <div class="foto-acc"><button class="btn sm" type="button" data-foto="logo">${est.logo ? 'Cambiar logo' : 'Poner logo'}</button>
        ${est.logo ? '<button class="btn sm ghost" type="button" data-foto-quitar="logo">Quitar</button>' : ''}</div></div>
  </div>
  <div class="full"><h3 style="margin:6px 0 4px">Fotos del local</h3>
    <p class="muted" style="margin:0 0 10px">Hasta 12 fotos: el local, el ambiente, lo que haces. Se ven en tu ficha.</p>
    <div class="thumbs">${est.galeria.map((u, i) => `<div class="thumb"><img src="${esc(u)}" alt="">
      <button class="btn sm bad ghost" type="button" data-gal-quitar="${i}">Quitar</button></div>`).join('')}</div>
    ${est.galeria.length < TOPE.galeria
      ? `<p style="margin:10px 0 0"><button class="btn sm" type="button" data-foto="gallery">Añadir fotos</button> <span class="muted small">${esc(topeHasta(TOPE.galeria))}</span></p>`
      : `<p class="muted" style="margin:10px 0 0">${esc(topeLleno(TOPE.galeria))}</p>`}</div>`;

/** Sube fotos y las deja en `est` (no las guarda en la ficha: eso lo hace
 * «Guardar» o el alta). Antes del alta van a la carpeta personal
 * (`avatars/<uid>/<carpeta>/…`), la única en la que Storage deja escribir. */
function activaFotos(caja, est, alCambiar, alta = false) {
  $$('[data-foto]', caja).forEach((btn) => { btn.onclick = () => {
    const que = btn.dataset.foto;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = que === 'gallery';
    input.onchange = async () => {
      const elegidas = que === 'gallery' ? caben(input.files, est.galeria.length, TOPE.galeria) : [...input.files].slice(0, 1);
      if (!elegidas.length) return;
      btn.disabled = true;
      const nuevas = [];
      try {
        for (const elegida of elegidas) {
          const f = await KFotos.reduce(elegida, que === 'logo' ? KFotos.TAM.logo : KFotos.TAM.foto);
          if (f.size > 5 * 1024 * 1024) { toast('Esa foto pesa más de 5 MB.', true); continue; }
          const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
          const path = alta ? `avatars/${ME.id}/${que}/${crypto.randomUUID()}.${ext}` : `${BIZ.id}/${que}-${crypto.randomUUID()}.${ext}`;
          const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type });
          if (error) { toast(friendly(error.message), true); continue; }
          nuevas.push(sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
        }
      } finally { btn.disabled = false; }
      if (!nuevas.length) return;
      if (que === 'logo') est.logo = nuevas[0];
      else if (que === 'cover') est.portada = nuevas[0];
      else est.galeria = [...est.galeria, ...nuevas];
      alCambiar(`[data-foto="${que}"]`);
    };
    input.click();
  }; });
  $$('[data-foto-quitar]', caja).forEach((b) => { b.onclick = () => {
    if (b.dataset.fotoQuitar === 'logo') est.logo = ''; else est.portada = '';
    alCambiar(`[data-foto="${b.dataset.fotoQuitar}"]`);
  }; });
  $$('[data-gal-quitar]', caja).forEach((b) => { b.onclick = () => {
    est.galeria = est.galeria.filter((_, j) => j !== +b.dataset.galQuitar);
    alCambiar('[data-foto="gallery"]');
  }; });
}

/** El mapa de «Dónde está»: «Buscar en el mapa», «Estoy en el local» y la
 * chincheta. Lo que se rellena solo desde el mapa se vuelve a rellenar si se
 * mueve; lo escrito a mano no se toca. `est.punto` = { lat, lng } o null. */
async function activaDonde(caja, f, est, alCambiar = () => {}) {
  const txt = $('[data-punto-txt]', caja);
  const autoRellena = (campo, valor) => {
    const el = f.elements[campo];
    if (!valor || !el) return;
    if (!el.value.trim() || el.dataset.auto === el.value) {
      el.value = valor;
      el.dataset.auto = valor;
      KL_CAMPO(el, null);
    }
  };
  const marca = async (p, rellenar) => {
    est.punto = { lat: p.lat, lng: p.lng };
    txt.textContent = I18N.t('Ubicación marcada. Si no es exacta, arrastra la chincheta.');
    txt.classList.remove('err');
    if (rellenar) {
      const d = await direccionDe(p.lat, p.lng);
      if (d) { autoRellena('address', d.address); autoRellena('city', d.city); }
    }
    alCambiar();
  };
  const mapa = await mapaPunto($('[data-mapa]', caja), est.punto, (p) => marca(p, true));
  $('[data-buscar]', caja).onclick = async () => {
    const q = [f.elements.address.value, f.elements.city.value].map((x) => x.trim()).filter(Boolean).join(', ');
    if (!q) { toast('Escribe primero la dirección y la ciudad.', true); return; }
    const d = await buscaDireccion(q);
    if (!d) { toast('No encontramos esa dirección. Prueba a escribirla de otra forma o marca el punto en el mapa.', true); return; }
    autoRellena('city', d.city);
    mapa?.mueve(d);
    marca(d, false);
  };
  $('[data-aqui]', caja).onclick = () => {
    if (!navigator.geolocation) { toast('Este navegador no deja saber dónde estás.', true); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      mapa?.mueve(p);
      marca(p, true);
    }, () => toast('No hemos podido saber dónde estás. Revisa el permiso de ubicación del navegador.', true),
    { enableHighAccuracy: true, timeout: 12000 });
  };
}

/** Sin chincheta: se intenta con la dirección escrita. Si tampoco, se dice
 * qué falta junto al mapa (`panelFormMissingLocation` en la app). */
async function aseguraPunto(caja, f, est) {
  if (est.punto) return true;
  const q = `${f.elements.address.value.trim()}, ${f.elements.city.value.trim()}`;
  const b = await buscaDireccion(q).catch(() => null);
  if (b) { est.punto = { lat: b.lat, lng: b.lng }; return true; }
  const txt = $('[data-punto-txt]', caja);
  txt.textContent = I18N.t('Marca en el mapa dónde está el local (o pulsa «Buscar en el mapa»).');
  txt.classList.add('err');
  $('[data-buscar]', caja).focus();
  txt.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return false;
}

/** Marca «Obligatorio» en lo que falta y lleva al primero. `faltan` =
 * [[elemento, mensaje|null]]. Devuelve true si no falta nada. */
function marcaFaltan(faltan) {
  for (const [el, msg] of faltan) if (el) KL_CAMPO(el, msg);
  const primero = faltan.find(([el, msg]) => el && msg);
  if (primero) { primero[0].focus(); return false; }
  return true;
}

const socialDe = (d) => Object.fromEntries(['instagram', 'tiktok', 'facebook']
  .map((k) => [k, String(d[k] || '').trim()]).filter(([, x]) => x));

/** Lo que falta para estar completa, en las mismas ocho cosas que la app
 * (`profileCompleteness`). */
function fichaCompleta(b, { sitio, carta }) {
  const checks = [
    !!b.logo_url, !!b.cover_image_url, (b.gallery || []).length > 0, !!String(b.description || '').trim(),
    hayHorario(b.opening_hours),
    !!(b.phone || b.website || b.contact_email || Object.values(b.social_links || {}).some((x) => String(x || '').trim())),
    sitio.length > 0,
    !!(b.menu_url || (b.menu_images || []).length || (carta || []).length),
  ];
  return Math.round(checks.filter(Boolean).length * 100 / checks.length);
}

// ── «Tu ficha»: el índice y cada apartado ───────────────────────────────────
async function datosFicha() {
  const [{ data: b }, cats, privado, carta] = await Promise.all([
    sb.from('businesses').select('id, name, description, category_id, address, city, phone, website, contact_email, social_links, logo_url, cover_image_url, gallery, opening_hours, adults_only, amenities, price_level, crowd_enabled, menu_url, menu_images').eq('id', BIZ.id).maybeSingle(),
    CATS.length ? CATS : sb.from('categories').select('*').order('position', { ascending: true }).then(({ data }) => data || []),
    // El NIF no se puede leer de la tabla (no es público): lo da
    // `business_private` a quien gestiona.
    rpc('business_private', { p_id: BIZ.id }).catch(() => null),
    rpc('business_menu', { p_business: BIZ.id }).catch(() => null),
  ]);
  if (b) {
    b.tax_id = privado?.tax_id || '';
    b.tax_known = !!privado;
    b.amenities = Array.isArray(b.amenities) ? b.amenities : [];
  }
  return { b, cats, carta };
}

PAGES.ficha = async (v, parte) => {
  if (!gestiona()) { location.hash = '#/resumen'; return; }
  // Un apartado que no existe (un enlace viejo o mal escrito): el índice.
  if (parte === 'carta') { location.hash = '#/carta'; return; }
  if (parte && !PARTES_FICHA.some((p) => p[0] === parte) && parte !== 'datos') { location.hash = '#/ficha'; return; }
  if (parte === 'datos' && !esPropietario()) { location.hash = '#/ficha'; return; }
  const { b, cats, carta } = await datosFicha();
  if (!b) {
    v.innerHTML = `<section class="vacio"><h2>${esc(I18N.t('No hemos podido cargar tu ficha.'))}</h2><div class="vacio-botones"><button class="btn primary" type="button" data-reintentar>${esc(I18N.t('Reintentar'))}</button></div></section>`;
    $('[data-reintentar]', v).onclick = () => route();
    return;
  }
  if (!parte) return indiceFicha(v, b, cats, carta);
  return parteFicha(v, parte, b, cats);
};

function indiceFicha(v, b, cats, carta) {
  const cat = cats.find((c) => c.id === b.category_id);
  const nombreCat = cat ? ((cat.names || {})[I18N.lang] || (cat.names || {}).es || cat.slug) : '';
  const pct = fichaCompleta(b, { sitio: b.amenities, carta });
  const une = (partes, vacio) => (partes.length ? partes.join(' · ') : I18N.t(vacio));
  const foto = (n) => bi(n === 1 ? '1 foto' : `${n} fotos`, n === 1 ? '1 photo' : `${n} photos`);
  const desc = String(b.description || '').trim().replace(/\s+/g, ' ');
  const redes = Object.entries(b.social_links || {}).filter(([k, x]) => k !== 'web' && String(x || '').trim())
    .map(([k]) => ({ instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' }[k] || k));
  const sitioNombres = [KlendarMarcas.simbolo(Number(b.price_level)),
    ...SITIO_PANEL.filter(([k]) => b.amenities.includes(k)).map(([, n]) => I18N.t(n))].filter(Boolean);
  const resumen = {
    fotos: une([b.cover_image_url && I18N.t('Portada'), b.logo_url && I18N.t('Logo'), (b.gallery || []).length && foto(b.gallery.length)].filter(Boolean), 'Sin fotos todavía'),
    basico: [nombreCat || (b.category_id ? '' : I18N.t('Sin categoría')), desc || I18N.t('sin descripción')].filter(Boolean).join(' · '),
    donde: [[b.address, b.city].filter(Boolean).join(', '), I18N.t('en el mapa')].filter(Boolean).join(' · '),
    horario: resumenHorario(b.opening_hours),
    contacto: une([b.phone && I18N.t('Teléfono'), b.website && I18N.t('Web'), b.contact_email && I18N.t('Correo'), ...redes].filter(Boolean), 'Sin teléfono, web ni redes'),
    carta: une([(carta || []).length && bi(carta.length === 1 ? '1 sección' : `${carta.length} secciones`, carta.length === 1 ? '1 section' : `${carta.length} sections`),
      (b.menu_images || []).length && foto(b.menu_images.length), b.menu_url && I18N.t('Enlace')].filter(Boolean), 'Nada todavía'),
    local: sitioNombres.length ? [...sitioNombres.slice(0, 3), sitioNombres.length > 3 ? `+${sitioNombres.length - 3}` : ''].filter(Boolean).join(', ') : I18N.t('Sin marcar'),
    klendar: !b.tax_known || b.tax_id ? I18N.t('NIF/CIF · no lo ve la gente') : I18N.t('Falta el NIF/CIF'),
    mayores: b.adults_only ? I18N.t('Sí') : I18N.t('No'),
  };
  const sinCategoria = !b.category_id;
  const sinDireccion = !b.address || !b.city;
  const fila = (k, titulo, texto, { mal = false, peligro = false, href = null } = {}) => `<a class="indice-fila${peligro ? ' peligro' : ''}" href="${href || `#/${k === 'carta' ? 'carta' : `ficha/${k}`}`}">
    <span><b>${esc(I18N.t(titulo))}</b>${texto ? `<small${mal ? ' class="mal"' : ''}>${esc(texto)}</small>` : ''}</span>${ms('chevron_right')}</a>`;

  v.innerHTML = `
    <div class="page-head"><h1>Tu ficha</h1><span class="spacer"></span>
      <a class="btn sm" href="${APP_URL}/b/${esc(BIZ.id)}" target="_blank" rel="noopener">Ver cómo se ve ↗</a></div>
    <div class="ficha-cab">
      ${b.logo_url ? `<img src="${esc(b.logo_url)}" alt="">` : `<span class="ph" aria-hidden="true">${ms('storefront')}</span>`}
      <div><b>${esc(b.name)}</b><span class="muted">${esc([nombreCat, b.city, bi(`ficha completa al ${pct} %`, `page ${pct}% complete`)].filter(Boolean).join(' · '))}</span></div>
    </div>
    ${sinCategoria || sinDireccion ? `<a class="aviso-falta" href="#/ficha/${sinCategoria ? 'basico' : 'donde'}">${ms('cancel')}<span>${esc(I18N.t(sinCategoria ? 'Elige una categoría.' : 'Falta la dirección o la ciudad.'))}</span>${ms('chevron_right')}</a>` : ''}
    <p class="muted" style="margin:0 0 10px">Toca un apartado para cambiarlo. Cada uno se guarda por separado.</p>
    <nav class="card indice" aria-label="${esc(I18N.t('Apartados de la ficha'))}">
      ${PARTES_FICHA.map(([k, titulo]) => fila(k, titulo, resumen[k], { mal: (k === 'basico' && sinCategoria) || (k === 'donde' && sinDireccion) })).join('')}
    </nav>
    ${esPropietario() ? `<section class="card indice zona-delicada" aria-labelledby="zonaFicha">
      <h2 id="zonaFicha">Zona delicada · solo el propietario</h2>
      ${fila('datos', 'Descargar los datos del negocio', '')}
      ${fila('baja', 'Dar de baja el negocio', I18N.t('Cerrar hasta nuevo aviso, cancelar la suscripción, traspasarlo o eliminarlo'), { peligro: true, href: '#/baja' })}
    </section>` : ''}`;
}

async function parteFicha(v, parte, b, cats) {
  const titulo = tituloParte(parte);
  const cab = `<p class="crumbs"><a href="#/ficha">← ${esc(I18N.t('Tu ficha'))}</a></p>
    <div class="page-head"><h1>${esc(I18N.t(titulo))}</h1></div>`;

  if (parte === 'datos') {
    v.innerHTML = `${cab}${tarjetaDescarga()}`;
    activaDescarga(v);
    return;
  }

  const redes = b.social_links || {};
  const d = {
    ...b, instagram: redes.instagram || '', tiktok: redes.tiktok || '', facebook: redes.facebook || '', punto: null,
  };
  const est = { logo: b.logo_url || '', portada: b.cover_image_url || '', galeria: [...(b.gallery || [])] };
  let horario = null;
  if (parte === 'donde') {
    // El punto de ahora (la tabla lo guarda como geografía).
    const perfil = await rpc('business_profile', { p_id: BIZ.id }).catch(() => null);
    const actual = Array.isArray(perfil) ? perfil[0] : perfil;
    if (actual && actual.lat != null) d.punto = { lat: actual.lat, lng: actual.lng };
  }

  const cuerpo = {
    fotos: () => htmlFotos(est),
    basico: () => `${htmlBasico(d)}<p class="hint full">Si cambias el nombre, lo revisamos de nuevo. Tu negocio sigue a la vista mientras tanto.</p>`,
    donde: () => `${htmlDonde(d)}<p class="hint full">Si cambias la ciudad o te mudas a más de 1 km, lo revisamos de nuevo. Tu negocio sigue a la vista mientras tanto y lo que tengas publicado se muda contigo.</p>`,
    horario: () => '<div class="full" data-horario></div>',
    contacto: () => htmlContacto(d),
    local: () => htmlSitio(b.amenities, { precio: b.price_level, aforo: b.crowd_enabled }),
    klendar: () => htmlKlendar(d),
    mayores: () => htmlMayores(d),
  }[parte];

  // Lo que manda cada apartado (solo lo suyo), como `patchFor` en la app.
  const f = () => $('#parte', v);
  const valores = () => Object.fromEntries(new FormData(f()));
  const patch = () => {
    const x = valores();
    return {
      fotos: () => ({ logo_url: est.logo, cover_image_url: est.portada, gallery: est.galeria }),
      basico: () => ({ name: String(x.name || '').trim(), category_id: x.category_id || null, description: String(x.description || '').trim() }),
      donde: () => ({ address: String(x.address || '').trim(), city: String(x.city || '').trim(), ...(d.punto ? { lat: d.punto.lat, lng: d.punto.lng } : {}) }),
      horario: () => ({ opening_hours: horario ? horario.valor() : null }),
      contacto: () => ({ phone: String(x.phone || '').trim(), website: String(x.website || '').trim(), contact_email: String(x.contact_email || '').trim(), social_links: socialDe(x) }),
      local: () => ({ amenities: $$('[name=sitio]:checked', v).map((c) => c.value).sort(),
        price_level: Number(x.price_level) || null, crowd_enabled: !!f().elements.crowd_enabled.checked }),
      klendar: () => ({ tax_id: String(x.tax_id || '').trim() }),
      mayores: () => ({ adults_only: !!f().elements.adults_only.checked }),
    }[parte]();
  };

  let inicial = null;
  const pinta = (foco) => {
    v.innerHTML = `${cab}<form id="parte" class="form ficha-form" novalidate>${cuerpo()}
      <div class="full"><button class="btn primary" type="submit">Guardar</button></div></form>`;
    I18N.translate(v);
    if (parte === 'basico') {
      KlendarCategorias.campo($('[data-campo-cat]', v), {
        cats, elegidas: [d.category_id], multiple: false, lang: I18N.lang, nombre: 'category_id', titulo: I18N.t('Categoría'),
        alCambiar: (ids) => { d.category_id = ids[0]; KL_CAMPO($('.selcat-campo', v), null); },
      });
    }
    if (parte === 'donde') activaDonde($('[data-punto-caja]', v), f(), d);
    if (parte === 'horario') horario = editorHorario($('[data-horario]', v), horario ? horario.valor() : b.opening_hours);
    if (parte === 'fotos') activaFotos(v, est, (sel) => { pinta(sel); });
    f().onsubmit = guardar;
    sinDobleEnvio(v);
    if (foco) $(foco, v)?.focus();
  };

  async function guardar(e) {
    e.preventDefault();
    const form = f();
    const x = valores();
    if (parte === 'basico' && !marcaFaltan([
      [form.elements.name, String(x.name || '').trim().length < 2 ? obligatorioTxt() : null],
      [$('.selcat-campo', v), !x.category_id ? I18N.t('Elige una categoría.') : null],
    ])) return;
    if (parte === 'donde') {
      if (!marcaFaltan([
        [form.elements.address, !String(x.address || '').trim() ? obligatorioTxt() : null],
        [form.elements.city, !String(x.city || '').trim() ? obligatorioTxt() : null],
      ])) return;
      if (!(await aseguraPunto($('[data-punto-caja]', v), form, d))) return;
    }
    if (parte === 'contacto' && !marcaFaltan([
      [form.elements.contact_email, pareceCorreo(String(x.contact_email || '').trim()) ? null : I18N.t('Ese correo no parece válido.')],
    ])) return;
    if (parte === 'horario') {
      const mal = diasMalHorario(horario.valor());
      if (mal.length) { toast(avisoHorarioMal(mal), true); $('.hdia.mal input', v)?.focus(); return; }
    }
    try {
      if (parte === 'local') {
        const p = patch();
        await rpc('set_business_amenities', { p_business: BIZ.id, p_amenities: p.amenities });
        await rpc('set_business_place_extras', { p_business: BIZ.id, p_price_level: p.price_level, p_crowd_enabled: p.crowd_enabled });
      } else {
        const p = patch();
        await rpc('update_business', { p_id: BIZ.id, p_patch: p });
        // El nombre nuevo, ya en el selector de locales; y la zona, si el
        // punto se ha movido (la base la recalcula igual).
        if (p.name) { BIZ.name = p.name; renderBizPicker(); }
        if (p.lat != null) { BIZ.time_zone = KZ.porCoordenadas(p.lat, p.lng); TZ = KZ.de(BIZ); }
      }
      inicial = JSON.stringify(patch());
      GUARDA = null;
      toast('Guardado');
      location.hash = '#/ficha';
    } catch (err) { toast(friendly(err.message), true); }
  }

  pinta();
  inicial = JSON.stringify(patch());
  GUARDA = { sucia: () => !!f() && JSON.stringify(patch()) !== inicial };
}

// ── Alta en tres pasos ──────────────────────────────────────────────────────
let ALTA = null;
const altaNueva = () => ({
  name: '', category_id: null, description: '', address: '', city: '', punto: null, horas: null, sitio: [], precio: 0, aforo: false,
  phone: '', website: '', contact_email: '', instagram: '', tiktok: '', facebook: '', tax_id: '', adults_only: false, terms: false,
  fotos: { logo: '', portada: '', galeria: [] },
});
const altaConAlgo = () => !!ALTA && JSON.stringify(ALTA) !== JSON.stringify(altaNueva());
const PASOS_ALTA = ['Lo básico', 'Dónde y cuándo', 'Fotos y contacto'];

/** Lo que le falta a un paso ya rellenado (para no saltarse ninguno por la
 * dirección). Sin tocar la página. */
function pasoAltaIncompleto(n) {
  if (n === 1) return ALTA.name.trim().length < 2 || !ALTA.category_id;
  if (n === 2) return !ALTA.address.trim() || !ALTA.city.trim() || !ALTA.punto || diasMalHorario(ALTA.horas).length > 0;
  return false;
}

PAGES.alta = async (v, param) => {
  const cats = CATS.length ? CATS
    : ((await sb.from('categories').select('*').order('position', { ascending: true })).data || []);
  if (!ALTA) ALTA = altaNueva();
  let paso = Math.min(3, Math.max(1, parseInt(param, 10) || 1));
  // A un paso solo se llega con los de antes hechos.
  for (let n = 1; n < paso; n++) if (pasoAltaIncompleto(n)) { location.hash = `#/alta/${n}`; return; }
  const otro = BIZZES.length > 0;
  const A = ALTA;

  const cuerpo = {
    1: () => `${otro ? '' : `<div class="help full"><b>Bienvenido/a.</b> Cuéntanos sobre tu negocio: lo revisamos antes de hacerlo público (normalmente en 24-48 h). Mientras, ya puedes preparar publicaciones.
        <br><span class="muted">Para dar de alta un negocio hace falta tener 18 años.</span>
        <br><span class="muted">¿Te han invitado al equipo de un negocio? Entonces no hace falta: entra con el mismo correo con el que te invitaron y aparecerá solo.</span></div>`}
      ${htmlBasico(A)}`,
    2: () => `${htmlDonde(A)}
      <div class="full"><h2 class="alta-sub">Horario</h2><p class="muted" style="margin:0 0 10px">Si aún no lo tienes claro, puedes ponerlo luego.</p><div data-horario></div></div>
      <div class="full"><h2 class="alta-sub">Cómo es tu local</h2></div>${htmlSitio(A.sitio, A)}`,
    3: () => `<div class="full"><h2 class="alta-sub">Fotos</h2><p class="muted" style="margin:0">Opcional: lo puedes completar después desde Tu ficha.</p></div>
      ${htmlFotos(A.fotos)}
      <div class="full"><h2 class="alta-sub">Contacto y redes</h2></div>${htmlContacto(A)}
      <div class="full"><h2 class="alta-sub">Datos para Klendar</h2></div>${htmlKlendar(A)}
      ${htmlMayores(A)}
      <label class="f full casilla"><input type="checkbox" name="terms" ${A.terms ? 'checked' : ''}>
        <span>Acepto las <a href="${APP_URL}/negocios/" target="_blank" rel="noopener">condiciones para negocios</a> *</span></label>`,
  }[paso];

  // Todo lo que se escribe pasa a ALTA al momento: ir atrás (con el botón o
  // con el del navegador) no pierde nada.
  const lee = (f) => {
    const x = Object.fromEntries(new FormData(f));
    for (const k of ['name', 'description', 'address', 'city', 'phone', 'website', 'contact_email', 'instagram', 'tiktok', 'facebook', 'tax_id']) {
      if (f.elements[k]) A[k] = String(x[k] || '');
    }
    if (f.elements.adults_only) A.adults_only = f.elements.adults_only.checked;
    if (f.elements.terms) A.terms = f.elements.terms.checked;
    if (paso === 2) {
      A.sitio = $$('[name=sitio]:checked', f).map((c) => c.value);
      A.precio = Number(x.price_level) || 0;
      A.aforo = !!f.elements.crowd_enabled?.checked;
    }
  };

  const pinta = (foco) => {
    v.innerHTML = `
      <div class="page-head"><h1>${otro ? 'Dar de alta otro local' : 'Da de alta tu negocio'}</h1></div>
      <div class="alta-progreso">
        <p><b>${esc(bi(`Paso ${paso} de 3 · ${PASOS_ALTA[paso - 1]}`, `Step ${paso} of 3 · ${I18N.t(PASOS_ALTA[paso - 1])}`))}</b></p>
        <div class="alta-barra" role="progressbar" aria-label="${esc(bi('Progreso del alta', 'Sign-up progress'))}" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${paso}"><span style="width:${Math.round(paso * 100 / 3)}%"></span></div>
      </div>
      <form id="alta" class="form ficha-form" novalidate>${cuerpo()}
        <div class="full alta-botones${paso > 1 ? '' : ' uno'}">
          ${paso > 1 ? '<button class="btn" type="button" data-atras>Atrás</button>' : ''}
          <button class="btn primary" type="submit" id="enviar">${paso < 3 ? 'Siguiente' : 'Enviar solicitud'}</button></div>
        <p id="err" class="err full" role="alert"></p>
      </form>`;
    I18N.translate(v);
    const f = $('#alta', v);
    f.oninput = () => lee(f);
    f.onchange = () => lee(f);
    if (paso === 1) {
      KlendarCategorias.campo($('[data-campo-cat]', v), {
        cats, elegidas: [A.category_id], multiple: false, lang: I18N.lang, nombre: 'category_id', titulo: I18N.t('Categoría'),
        alCambiar: (ids) => { A.category_id = ids[0]; KL_CAMPO($('.selcat-campo', v), null); },
      });
    }
    if (paso === 2) {
      activaDonde($('[data-punto-caja]', v), f, A);
      editorHorario($('[data-horario]', v), A.horas, (h) => { A.horas = h; });
    }
    if (paso === 3) activaFotos(v, A.fotos, (sel) => { lee(f); pinta(sel); }, true);
    const atras = $('[data-atras]', v);
    if (atras) atras.onclick = () => { lee(f); location.hash = `#/alta/${paso - 1}`; };
    f.onsubmit = siguiente;
    sinDobleEnvio(v);
    if (foco) $(foco, v)?.focus();
  };

  async function siguiente(e) {
    e.preventDefault();
    const f = $('#alta', v);
    lee(f);
    $('#err', v).textContent = '';
    if (paso === 1) {
      if (!marcaFaltan([
        [f.elements.name, A.name.trim().length < 2 ? obligatorioTxt() : null],
        [$('.selcat-campo', v), !A.category_id ? I18N.t('Elige una categoría.') : null],
      ])) return;
    }
    if (paso === 2) {
      if (!marcaFaltan([
        [f.elements.address, !A.address.trim() ? obligatorioTxt() : null],
        [f.elements.city, !A.city.trim() ? obligatorioTxt() : null],
      ])) return;
      if (!(await aseguraPunto($('[data-punto-caja]', v), f, A))) return;
      const mal = diasMalHorario(A.horas);
      if (mal.length) { toast(avisoHorarioMal(mal), true); $('.hdia.mal input', v)?.focus(); return; }
    }
    if (paso === 3) {
      if (!marcaFaltan([
        [f.elements.contact_email, pareceCorreo(A.contact_email.trim()) ? null : I18N.t('Ese correo no parece válido.')],
        [f.elements.terms, A.terms ? null : I18N.t('Tienes que aceptar las condiciones para negocios.')],
      ])) return;
      return enviar();
    }
    location.hash = `#/alta/${paso + 1}`;
  }

  async function enviar() {
    const boton = $('#enviar', v);
    boton.disabled = true;
    try {
      const social = socialDe(A);
      const id = await rpc('register_business', {
        p_name: A.name.trim(), p_category_id: A.category_id,
        p_lat: A.punto.lat, p_lng: A.punto.lng,
        p_address: A.address.trim(), p_city: A.city.trim(),
        p_description: A.description.trim() || null,
        p_phone: A.phone.trim() || null,
        p_website: A.website.trim() || null,
        p_tax_id: A.tax_id.trim() || null,
        p_contact_email: A.contact_email.trim() || null,
        p_adults_only: A.adults_only,
        // Lo que se haya subido en el alta va de una vez (como la app).
        ...(A.fotos.logo ? { p_logo_url: A.fotos.logo } : {}),
        ...(A.fotos.portada ? { p_cover_image_url: A.fotos.portada } : {}),
        ...(A.fotos.galeria.length ? { p_gallery: A.fotos.galeria } : {}),
        p_social_links: social,
        ...(A.horas ? { p_opening_hours: A.horas } : {}),
      });
      // El negocio ya existe: si esto falla, se marca luego en la ficha.
      if (A.sitio.length) await rpc('set_business_amenities', { p_business: id, p_amenities: A.sitio }).catch(() => null);
      if (A.precio || A.aforo) {
        await rpc('set_business_place_extras', { p_business: id, p_price_level: A.precio || null, p_crowd_enabled: A.aforo }).catch(() => null);
      }
      const punto = A.punto;
      ALTA = null;
      GUARDA = null;
      BIZZES = await rpc('my_businesses');
      BIZ = BIZZES.find((b) => b.id === id) || BIZZES[0];
      localStorage.setItem('klendar.biz', BIZ.id);
      // Recién dado de alta: su zona sale del punto marcado en el mapa.
      if (BIZ.id === id) BIZ.time_zone = KZ.porCoordenadas(punto.lat, punto.lng);
      await preparaNegocio();
      $('.bizpick').hidden = false;
      renderBizPicker();
      if (!CATS.length) CATS = cats;
      toast('Solicitud enviada. Te avisamos cuando la revisemos.');
      // Como la app: al panel del negocio nuevo.
      if (location.hash === '#/resumen') route(); else location.hash = '#/resumen';
    } catch (e2) {
      $('#err', v).textContent = I18N.t(friendly(e2.message));
      boton.disabled = false;
    }
  }

  pinta();
  GUARDA = { sucia: altaConAlgo, dentro: (h) => h.startsWith('#/alta') };
};
