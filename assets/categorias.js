// El selector de categorías: uno solo para toda la web, igual que en la app
// (`lib/features/categories/presentation/category_picker.dart`).
//
// Buscador y las 31 categorías en cinco grupos (Comer y beber · Noche,
// música y cultura · Ocio, deporte y familia · Belleza y salud · Tiendas y
// servicios), de una (alta y «Tu ficha» del panel; la hoja de filtros de
// Explorar y Descubre) o de varias («Avísame si…» y «Cerca de ti» en «Tu
// cuenta»). El grupo de cada categoría lo guarda la base
// (`categories.category_group`, migración 20261114100000); si una fila no lo
// trae, vale el de su slug (el mismo reparto que la migración y la app).
//
// Sirve igual para las páginas del navegador (script clásico: deja
// `KlendarCategorias` en `window`) y para las Pages Functions (`import KC from
// '../../assets/categorias.js'`), que solo usan los grupos y los nombres.
(function () {
  'use strict';

  const GRUPOS = [
    { id: 'food', es: 'Comer y beber', en: 'Food and drink' },
    { id: 'night', es: 'Noche, música y cultura', en: 'Nightlife, music and culture' },
    { id: 'leisure', es: 'Ocio, deporte y familia', en: 'Leisure, sport and family' },
    { id: 'care', es: 'Belleza y salud', en: 'Beauty and health' },
    { id: 'services', es: 'Tiendas y servicios', en: 'Shops and services' },
  ];

  /** El reparto de las migraciones 20261114100000 y 20261125100000 (si
   * cambia, cambiar los tres sitios). */
  const POR_SLUG = {
    bar: 'food', restaurant: 'food', cafe: 'food', bakery: 'food', icecream: 'food', gourmet: 'food', market: 'food',
    nightclub: 'night', music: 'night', stage: 'night', culture: 'night', art: 'night',
    games: 'leisure', experiences: 'leisure', family: 'leisure', sport: 'leisure', gym: 'leisure', learning: 'leisure', lodging: 'leisure',
    wellness: 'care', beauty: 'care', hairdresser: 'care', tattoo: 'care', health: 'care',
    books: 'services', shop: 'services', pets: 'services', workshop: 'services', home: 'services', civic: 'services', other: 'services',
  };

  /** Palabras con las que se busca lo que no está en el nombre («uñas»,
   * «copas»), en los dos idiomas y sin tildes. Las mismas que la app. */
  const PALABRAS = {
    bar: ['tapas', 'cerveza', 'cana', 'vermut', 'pub', 'beer', 'pint'],
    restaurant: ['comer', 'cena', 'comida', 'menu', 'dinner', 'lunch', 'food'],
    cafe: ['cafe', 'desayuno', 'brunch', 'merienda', 'coffee', 'breakfast'],
    bakery: ['pan', 'panaderia', 'pasteleria', 'bolleria', 'tartas', 'croissant', 'dulces', 'obrador', 'horno', 'bakery', 'bread', 'cake', 'pastry'],
    icecream: ['helado', 'heladeria', 'horchata', 'granizado', 'gelato', 'ice cream', 'frozen yogurt'],
    gourmet: ['vino', 'cata', 'bodega', 'vinoteca', 'wine', 'tasting', 'delicatessen'],
    market: ['mercadillo', 'feria', 'rastro', 'flea'],
    nightclub: ['copas', 'fiesta', 'discoteca', 'club', 'party', 'cocktail'],
    music: ['concierto', 'jazz', 'dj', 'gig', 'concert'],
    stage: ['cine', 'teatro', 'monologo', 'comedia', 'film', 'comedy'],
    culture: ['museo', 'exposicion', 'visita', 'museum', 'exhibition'],
    art: ['galeria', 'pintura', 'arte', 'gallery'],
    games: ['escape', 'bolos', 'bolera', 'karts', 'videojuegos', 'bowling'],
    experiences: ['tour', 'ruta', 'excursion', 'turismo', 'trip'],
    family: ['ninos', 'infantil', 'familia', 'kids', 'children'],
    sport: ['futbol', 'padel', 'tenis', 'running', 'deporte', 'football'],
    gym: ['gimnasio', 'crossfit', 'fitness', 'pesas'],
    wellness: ['spa', 'masaje', 'yoga', 'pilates', 'massage', 'relax'],
    beauty: ['unas', 'manicura', 'pedicura', 'estetica', 'nails', 'makeup'],
    hairdresser: ['peluqueria', 'barberia', 'barber', 'corte', 'haircut'],
    tattoo: ['tatuaje', 'tatuador', 'tattoo', 'piercing', 'perforacion'],
    health: ['fisio', 'fisioterapia', 'dentista', 'clinica', 'optica', 'dentist', 'physio'],
    learning: ['clase', 'curso', 'taller', 'academia', 'idiomas', 'course'],
    books: ['libros', 'libreria', 'books', 'comic'],
    shop: ['ropa', 'moda', 'complementos', 'regalos', 'zapatos', 'flores', 'floristeria', 'clothes', 'fashion', 'flowers'],
    pets: ['perro', 'gato', 'veterinario', 'dog', 'cat', 'vet'],
    workshop: ['coche', 'moto', 'mecanico', 'taller', 'car', 'garage'],
    home: ['fontanero', 'electricista', 'limpieza', 'reformas', 'plumber'],
    lodging: ['hotel', 'hostal', 'apartamento', 'alojamiento', 'stay'],
    civic: ['ayuntamiento', 'asociacion', 'vecinos', 'council'],
  };

  const TEXTOS = {
    es: {
      titulo: 'Categoría', buscar: 'Buscar: bar, peluquería, teatro…', buscarSr: 'Buscar una categoría',
      quitar: 'Quitar todas', listo: 'Listo', cerrar: 'Cerrar', elegir: 'Elige una categoría', todas: 'Todas',
      ninguna: 'Ninguna elegida', ningunaTodas: 'Sin elegir ninguna: todas',
      n: (n) => (n === 1 ? '1 elegida' : `${n} elegidas`),
      mas: (n) => `${n} más`, masSr: (n, g) => `Ver ${n} más de ${g}`,
      nada: (q) => `Ninguna categoría encaja con «${q}».`,
      max: (n) => `Como mucho ${n}: quita una para elegir otra.`,
    },
    en: {
      titulo: 'Category', buscar: 'Search: bar, hairdresser, theatre…', buscarSr: 'Search for a category',
      quitar: 'Clear all', listo: 'Done', cerrar: 'Close', elegir: 'Choose a category', todas: 'All',
      ninguna: 'None picked', ningunaTodas: 'None picked: all of them',
      n: (n) => `${n} selected`,
      mas: (n) => `${n} more`, masSr: (n, g) => `Show ${n} more in ${g}`,
      nada: (q) => `No category matches “${q}”.`,
      max: (n) => `${n} at most: remove one to pick another.`,
    },
  };
  const textos = (lang) => TEXTOS[lang === 'en' ? 'en' : 'es'];

  /** El grupo de una categoría: el de la base o, si no lo trae, el de su slug. */
  function grupoDe(c) {
    const g = c && c.category_group;
    if (GRUPOS.some((x) => x.id === g)) return g;
    return POR_SLUG[c && c.slug] || 'services';
  }
  const nombreGrupo = (id, lang) => {
    const g = GRUPOS.find((x) => x.id === id) || GRUPOS[GRUPOS.length - 1];
    return lang === 'en' ? g.en : g.es;
  };
  const nombre = (c, lang) => (c && c.names && ((lang === 'en' ? c.names.en : c.names.es) || c.names.es)) || (c && c.slug) || '';

  /** En minúsculas y sin tildes. */
  const pliega = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  /** ¿Encaja `c` con lo escrito? Nombre en los dos idiomas y sus palabras. */
  function encaja(c, q) {
    const p = pliega(q);
    if (!p) return true;
    const palabras = [...Object.values((c && c.names) || {}).map(pliega), ...(PALABRAS[c && c.slug] || [])];
    return palabras.some((w) => w.startsWith(p) || w.split(/[\s,]+/).some((x) => x.startsWith(p)) || (p.length >= 3 && w.includes(p)));
  }

  /** Las categorías por grupo, en el orden de los grupos y de `position`. */
  function agrupa(cats, q) {
    return GRUPOS.map((g) => ({ id: g.id, cats: (cats || []).filter((c) => grupoDe(c) === g.id && encaja(c, q)) }));
  }

  const KlendarCategorias = { GRUPOS, POR_SLUG, grupoDe, nombreGrupo, nombre, pliega, encaja, agrupa };

  // ── Lo del navegador ─────────────────────────────────────────────────────
  if (typeof document !== 'undefined') {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    // Los estilos van con el componente: se usa en páginas con hojas de estilo
    // distintas (Explorar, «Tu cuenta», el panel).
    const ESTILO = `
.selcat { width: min(560px, calc(100vw - 24px)); max-height: min(86vh, 760px); padding: 0; border: 1px solid var(--glass-border, rgba(127,127,127,.25));
  border-radius: 28px; background: var(--elevated, var(--surface, #fff)); color: var(--ink, inherit); box-shadow: 0 30px 80px -20px rgba(0,0,0,.5); }
.selcat::backdrop { background: rgba(0,0,0,.45); }
@media (max-width: 640px) { .selcat { width: 100vw; max-width: 100vw; margin: auto 0 0; border-radius: 28px 28px 0 0; border-bottom: 0; max-height: 88vh; } }
.selcat-c { display: flex; flex-direction: column; max-height: inherit; margin: 0; }
.selcat-cab { display: flex; align-items: center; gap: 8px; padding: 18px 20px 0; }
.selcat-cab h2 { flex: 1; margin: 0; font-size: 22px; }
.selcat-txt { border: 0; background: none; color: inherit; font: inherit; font-weight: 700; font-size: 14px; padding: 10px 8px; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.selcat-x { width: 44px; height: 44px; border-radius: 50%; border: 0; display: grid; place-items: center; background: var(--soft, rgba(127,127,127,.15)); color: inherit; font-size: 22px; cursor: pointer; }
.selcat-n { margin: 2px 20px 0; font-size: 13px; color: var(--ink-2, inherit); min-height: 1em; }
.selcat-buscar { display: block; margin: 12px 20px 4px; }
.selcat-buscar input { width: 100%; box-sizing: border-box; min-height: 48px; padding: 10px 14px; border-radius: 16px; border: 1px solid var(--glass-border, rgba(127,127,127,.35));
  background: var(--glass, transparent); color: inherit; font: inherit; font-size: 16px; }
.selcat-grupos { overflow-y: auto; padding: 4px 20px 12px; overscroll-behavior: contain; }
.selcat-grupos section { display: block; margin: 0; padding: 0; min-height: 0; border: 0; background: none; }
.selcat-grupos h3 { margin: 16px 0 8px; padding: 0; font-size: 14px; line-height: 1.3; font-weight: 700; letter-spacing: 0; text-transform: none; color: var(--ink-2, inherit); }
.selcat-ops { display: flex; flex-wrap: wrap; gap: 8px; }
.selcat-ops button { min-height: 40px; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--glass-border, rgba(127,127,127,.35));
  background: var(--glass, transparent); color: inherit; font: inherit; font-weight: 600; font-size: 14px; cursor: pointer; }
.selcat-ops button[aria-pressed=true] { background: var(--ink, #111); color: var(--surface, #fff); border-color: var(--ink, #111); font-weight: 700; }
.selcat-ops button.selcat-mas { color: var(--ink-2, inherit); font-weight: 500; }
.selcat-ops button:focus-visible, .selcat-campo:focus-visible { outline: 2px solid var(--ink, #111); outline-offset: 2px; }
.selcat-nada { margin: 16px 0; color: var(--ink-2, inherit); }
.selcat-pie { padding: 12px 20px calc(16px + env(safe-area-inset-bottom)); border-top: 1px solid var(--glass-border, rgba(127,127,127,.25)); }
.selcat-pie .pill { width: 100%; justify-content: center; }
.selcat-campo { display: flex; align-items: center; gap: 12px; width: 100%; box-sizing: border-box; min-height: 52px; padding: 12px 14px; text-align: left;
  border-radius: 16px; border: 1px solid var(--glass-border, rgba(127,127,127,.35)); background: var(--glass, transparent); color: inherit; font: inherit; font-size: 16px; cursor: pointer; }
.selcat-campo .selcat-v { flex: 1; font-weight: 600; }
.selcat-campo .selcat-v.sin-elegir { font-weight: 400; color: var(--ink-2, inherit); }
.selcat-campo .selcat-f { color: var(--ink-2, inherit); }
.selcat-campo[disabled] { opacity: .6; cursor: default; }
.campo-cat { margin: 0 0 14px; }
.campo-cat .etq { margin: 0 0 6px; font-weight: 600; }
.campo-cat .etq small { font-weight: 400; color: var(--ink-2, inherit); }`;
    let estiloPuesto = false;
    const ponEstilo = () => {
      if (estiloPuesto) return;
      estiloPuesto = true;
      const s = document.createElement('style');
      s.textContent = ESTILO;
      document.head.appendChild(s);
    };

    /**
     * Abre el selector. `opciones`: { cats, elegidas (ids), multiple, lang,
     * titulo, vacioEsTodas, id (qué campo es el id: 'id' o 'slug'), max (de
     * varias, cuántas como mucho: «Tus gustos», 5) }.
     * Devuelve los ids elegidos; de varias, también al cerrarlo (no se pierde
     * lo marcado); de una, al tocarla, o null si se cierra sin elegir.
     */
    KlendarCategorias.abrir = function abrir(opciones) {
      ponEstilo();
      const o = Object.assign({ multiple: true, lang: 'es', vacioEsTodas: true, id: 'id', elegidas: [] }, opciones);
      const T = textos(o.lang);
      const clave = (c) => String(c[o.id]);
      const elegidas = new Set([...(o.elegidas || [])].map(String));
      const abiertos = new Set();
      let busqueda = '';
      let elegida = null;

      const d = document.createElement('dialog');
      d.className = 'selcat';
      const tid = `selcat-t-${Math.random().toString(36).slice(2, 8)}`;
      d.setAttribute('aria-labelledby', tid);
      d.innerHTML = `<form method="dialog" class="selcat-c">
        <div class="selcat-cab"><h2 id="${tid}">${esc(o.titulo || T.titulo)}</h2>
          ${o.multiple ? `<button type="button" class="selcat-txt" data-quitar hidden>${esc(T.quitar)}</button>` : ''}
          <button type="submit" value="x" class="selcat-x" aria-label="${esc(T.cerrar)}">×</button></div>
        ${o.multiple ? '<p class="selcat-n" aria-live="polite"></p>' : ''}
        <label class="selcat-buscar"><span class="sr">${esc(T.buscarSr)}</span>
          <input type="search" placeholder="${esc(T.buscar)}" autocomplete="off" enterkeyhint="search"></label>
        <div class="selcat-grupos"></div>
        ${o.multiple ? `<div class="selcat-pie"><button type="submit" value="ok" class="pill accent">${esc(T.listo)}</button></div>` : ''}
      </form>`;
      const caja = d.querySelector('.selcat-grupos');
      const contador = d.querySelector('.selcat-n');
      const quitar = d.querySelector('[data-quitar]');

      function pinta() {
        const q = pliega(busqueda);
        const grupos = agrupa(o.cats, busqueda).filter((g) => g.cats.length);
        if (contador) {
          contador.textContent = elegidas.size ? T.n(elegidas.size) : o.vacioEsTodas ? T.ningunaTodas : T.ninguna;
          quitar.hidden = !elegidas.size;
        }
        if (!grupos.length) { caja.innerHTML = `<p class="selcat-nada" role="status">${esc(T.nada(busqueda.trim()))}</p>`; return; }
        caja.innerHTML = grupos.map((g, i) => {
          const abierto = q || i < 2 || abiertos.has(g.id);
          const vis = abierto ? g.cats : g.cats.filter((c) => elegidas.has(clave(c)));
          const ocultas = g.cats.length - vis.length;
          const ng = nombreGrupo(g.id, o.lang);
          return `<section data-g="${esc(g.id)}"><h3>${esc(ng)}</h3><div class="selcat-ops">
            ${vis.map((c) => `<button type="button" data-cat="${esc(clave(c))}" aria-pressed="${elegidas.has(clave(c))}">${esc(nombre(c, o.lang))}</button>`).join('')}
            ${!abierto && ocultas ? `<button type="button" class="selcat-mas" data-grupo="${esc(g.id)}" aria-label="${esc(T.masSr(ocultas, ng))}">${esc(T.mas(ocultas))} ›</button>` : ''}
          </div></section>`;
        }).join('');
      }

      caja.addEventListener('click', (e) => {
        const b = e.target instanceof Element ? e.target.closest('button') : null;
        if (!b) return;
        if (b.dataset.grupo) {
          abiertos.add(b.dataset.grupo);
          pinta();
          const primero = caja.querySelector(`section[data-g="${b.dataset.grupo}"] button`);
          if (primero) primero.focus();
          return;
        }
        const id = b.dataset.cat;
        if (!id) return;
        if (!o.multiple) { elegida = id; d.close('ok'); return; }
        if (elegidas.has(id)) elegidas.delete(id);
        else if (o.max && elegidas.size >= o.max) {
          pinta();
          if (contador) contador.textContent = T.max(o.max);
          return;
        } else elegidas.add(id);
        pinta();
        const otra = caja.querySelector(`[data-cat="${CSS.escape(id)}"]`);
        if (otra) otra.focus();
      });
      if (quitar) quitar.addEventListener('click', () => { elegidas.clear(); pinta(); });
      const campo = d.querySelector('input[type=search]');
      campo.addEventListener('input', () => { busqueda = campo.value; pinta(); });
      // Intro en el buscador no cierra el diálogo (es un formulario «dialog»).
      campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

      pinta();
      document.body.appendChild(d);
      return new Promise((resolver) => {
        d.addEventListener('close', () => {
          d.remove();
          if (o.multiple) resolver([...elegidas]);
          else resolver(elegida);
        }, { once: true });
        d.showModal();
        // En el móvil, el teclado taparía la lista: el foco va al título.
        if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) campo.focus();
      });
    };

    /**
     * Un campo de formulario con lo elegido («Bares, Cafeterías +1») que abre
     * el selector. Escribe un `<input type=hidden name=…>` por cada id, así
     * `FormData` lo lee como siempre. `opciones`: { cats, elegidas, multiple,
     * lang, nombre (del input), titulo, vacio (texto sin nada), disabled,
     * alCambiar, max, id ('id' o 'slug') }. Devuelve { valor(): [ids] }.
     */
    KlendarCategorias.campo = function campo(contenedor, opciones) {
      ponEstilo();
      const o = Object.assign({ multiple: true, lang: 'es', elegidas: [] }, opciones);
      const T = textos(o.lang);
      let valor = [...(o.elegidas || [])].filter(Boolean).map(String);
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'selcat-campo';
      if (o.nombre) boton.id = `selcat-${o.nombre}`;
      if (o.disabled) boton.disabled = true;
      const ocultos = document.createElement('span');
      contenedor.replaceChildren(boton, ocultos);
      function pinta() {
        const nombres = (o.cats || []).filter((c) => valor.includes(String(c[o.id || 'id']))).map((c) => nombre(c, o.lang));
        const vacio = !nombres.length;
        const texto = vacio ? (o.vacio || T.elegir)
          : nombres.length <= 2 ? nombres.join(', ') : `${nombres.slice(0, 2).join(', ')} +${nombres.length - 2}`;
        boton.innerHTML = `<span class="selcat-v${vacio ? ' sin-elegir' : ''}">${esc(texto)}</span><span class="selcat-f" aria-hidden="true">›</span>`;
        boton.setAttribute('aria-label', `${o.titulo || T.titulo}: ${texto}`);
        ocultos.innerHTML = o.nombre ? valor.map((v) => `<input type="hidden" name="${esc(o.nombre)}" value="${esc(v)}">`).join('') : '';
      }
      boton.addEventListener('click', async () => {
        const r = await KlendarCategorias.abrir({
          cats: o.cats, elegidas: valor, multiple: o.multiple, lang: o.lang, titulo: o.titulo, vacioEsTodas: Boolean(o.vacio),
          max: o.max, id: o.id || 'id',
        });
        if (r == null) { boton.focus(); return; }
        valor = o.multiple ? r : [r];
        pinta();
        boton.focus();
        if (o.alCambiar) o.alCambiar(valor);
      });
      pinta();
      return { valor: () => [...valor] };
    };

    /**
     * La hoja de filtros de Explorar y Descubre (pintada en el servidor, va
     * sin JavaScript): las categorías que no son de las 8 más usadas se
     * pliegan y «Ver todas (31)» abre el selector con todas. Elegir una marca
     * su radio (y la deja a la vista).
     */
    KlendarCategorias.mejoraHoja = function mejoraHoja(fs) {
      const boton = fs.querySelector('[data-ver-todas]');
      const mas = fs.querySelector('[data-cat-mas]');
      const visibles = fs.querySelector('[data-cat-visibles]');
      if (!boton || !mas || !visibles) return;
      const lang = document.documentElement.lang === 'en' ? 'en' : 'es';
      const radios = [...fs.querySelectorAll('input[type=radio]')].filter((r) => r.value);
      const pos = (r, i) => Number(r.closest('[data-pos]')?.getAttribute('data-pos') ?? i);
      const cats = radios.map((r, i) => ({
        id: r.value, slug: r.value, position: pos(r, i), category_group: r.closest('[data-grupo]')?.getAttribute('data-grupo') || r.getAttribute('data-grupo'),
        names: { es: r.nextElementSibling?.textContent || r.value, en: r.nextElementSibling?.textContent || r.value },
      })).sort((a, b) => a.position - b.position);
      mas.hidden = true;
      boton.hidden = false;
      boton.addEventListener('click', async () => {
        const actual = radios.find((r) => r.checked);
        const r = await KlendarCategorias.abrir({
          cats, elegidas: actual ? [actual.value] : [], multiple: false, lang, titulo: boton.getAttribute('data-titulo') || undefined,
        });
        if (r == null) { boton.focus(); return; }
        const radio = radios.find((x) => x.value === r);
        if (!radio) return;
        radio.checked = true;
        const etiqueta = radio.closest('label');
        if (etiqueta && mas.contains(etiqueta)) visibles.insertBefore(etiqueta, boton.parentElement === visibles ? boton : null);
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        radio.focus();
      });
    };

    // La hoja de filtros pintada en el servidor se mejora sola al cargar.
    const mejoraTodas = () => document.querySelectorAll('[data-selcat-hoja]').forEach((fs) => KlendarCategorias.mejoraHoja(fs));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mejoraTodas);
    else mejoraTodas();
  }

  globalThis.KlendarCategorias = KlendarCategorias;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarCategorias;
})();
