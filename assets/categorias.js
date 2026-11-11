// El selector de categorías: uno solo para toda la web, igual que en la app
// (`lib/features/categories/presentation/category_picker.dart`).
//
// Buscador y las categorías (tipos de negocio) en sus grupos (Comer y beber ·
// Noche, música y cultura · Ocio, familia y clases · Deporte · Belleza y
// bienestar · Salud · Eventos y celebraciones · Alojamiento · Tiendas ·
// Servicios), de una (alta y «Tu ficha» del panel; la hoja de filtros de
// Explorar y Descubre) o de varias («Avísame si…» y «Cerca de ti» en «Tu
// cuenta»). El grupo de cada categoría lo guarda la base
// (`categories.category_group`); si una fila no lo trae, o trae uno que esta
// versión no conoce, vale el de su slug. Los grupos, el reparto y las palabras
// salen de `tool/categorias.json` de la app (`tool/export_categorias.py`), lo
// mismo que la app y la migración 20261275100000.
//
// Sirve igual para las páginas del navegador (script clásico: deja
// `KlendarCategorias` en `window`) y para las Pages Functions (`import KC from
// '../../assets/categorias.js'`), que solo usan los grupos y los nombres.
(function () {
  'use strict';
  // «Tu cuenta» y el panel, en un idioma sin tabla propia (catalán, francés…):
  // la española, pasada por el diccionario que ha cargado /assets/i18n.js.
  const klBi = (x, lang) => (lang === 'en' ? x.en : globalThis.KL_TABLA ? globalThis.KL_TABLA(x.es, lang) : x.es);
  const klLoc = (lang) => (globalThis.KL_LOCALE ? globalThis.KL_LOCALE(lang) : lang === 'en' ? 'en-GB' : 'es-ES');

  // <generado:categorias> Lo escribe klendar/tool/export_categorias.py a partir de
  // tool/categorias.json (lo mismo que la app y la base): no se edita a mano.
  const GRUPOS = [
    {"id": "food", "es": "Comer y beber", "en": "Food and drink", "ca": "Menjar i beure", "gl": "Comer e beber", "eu": "Jan eta edan", "fr": "Manger et boire", "de": "Essen und Trinken", "it": "Mangiare e bere"},
    {"id": "night", "es": "Noche, música y cultura", "en": "Nightlife, music and culture", "ca": "Nit, música i cultura", "gl": "Noite, música e cultura", "eu": "Gaua, musika eta kultura", "fr": "Soirées, musique et culture", "de": "Nachtleben, Musik und Kultur", "it": "Notte, musica e cultura"},
    {"id": "leisure", "es": "Ocio, familia y clases", "en": "Leisure, family and classes", "ca": "Oci, família i classes", "gl": "Lecer, familia e clases", "eu": "Aisia, familia eta klaseak", "fr": "Loisirs, famille et cours", "de": "Freizeit, Familie und Kurse", "it": "Svago, famiglia e corsi"},
    {"id": "sports", "es": "Deporte", "en": "Sport", "ca": "Esport", "gl": "Deporte", "eu": "Kirola", "fr": "Sport", "de": "Sport", "it": "Sport"},
    {"id": "care", "es": "Belleza y bienestar", "en": "Beauty and wellbeing", "ca": "Bellesa i benestar", "gl": "Beleza e benestar", "eu": "Edertasuna eta ongizatea", "fr": "Beauté et bien-être", "de": "Schönheit und Wohlbefinden", "it": "Bellezza e benessere"},
    {"id": "health", "es": "Salud", "en": "Health", "ca": "Salut", "gl": "Saúde", "eu": "Osasuna", "fr": "Santé", "de": "Gesundheit", "it": "Salute"},
    {"id": "events", "es": "Eventos y celebraciones", "en": "Events and celebrations", "ca": "Esdeveniments i celebracions", "gl": "Eventos e celebracións", "eu": "Ekitaldiak eta ospakizunak", "fr": "Événements et fêtes", "de": "Events und Feiern", "it": "Eventi e feste"},
    {"id": "stay", "es": "Alojamiento", "en": "Places to stay", "ca": "Allotjament", "gl": "Aloxamento", "eu": "Ostatuak", "fr": "Hébergement", "de": "Unterkünfte", "it": "Alloggi"},
    {"id": "shops", "es": "Tiendas", "en": "Shops", "ca": "Botigues", "gl": "Tendas", "eu": "Dendak", "fr": "Boutiques", "de": "Läden", "it": "Negozi"},
    {"id": "services", "es": "Servicios", "en": "Services", "ca": "Serveis", "gl": "Servizos", "eu": "Zerbitzuak", "fr": "Services", "de": "Dienstleistungen", "it": "Servizi"},
  ];

  /** El grupo de cada categoría por su slug, por si una fila no lo trae. */
  const POR_SLUG = {
    bar: 'food', restaurant: 'food', cafe: 'food', brewery: 'food', wine: 'food', bakery: 'food', churros: 'food', icecream: 'food', takeaway: 'food', foodtruck: 'food', gourmet: 'food', grocery: 'food', market: 'food',
    cocktail: 'night', nightclub: 'night', karaoke: 'night', music: 'night', stage: 'night', cinema: 'night', culture: 'night', art: 'night',
    games: 'leisure', escape_room: 'leisure', bowling: 'leisure', karting: 'leisure', theme_park: 'leisure', kids_play: 'leisure', family: 'leisure', experiences: 'leisure', learning: 'leisure', language_school: 'leisure', music_school: 'leisure', dance: 'leisure',
    sport: 'sports', gym: 'sports', yoga: 'sports', padel: 'sports', climbing: 'sports', pool: 'sports', martial_arts: 'sports', adventure: 'sports', golf: 'sports',
    wellness: 'care', beauty: 'care', hairdresser: 'care', barber: 'care', nails: 'care', tattoo: 'care',
    pharmacy: 'health', optician: 'health', hearing: 'health', dentist: 'health', physio: 'health', podiatry: 'health', psychology: 'health', nutrition: 'health', aesthetic_clinic: 'health', medical: 'health', health: 'health', vet: 'health',
    event_venue: 'events', event_estate: 'events', catering: 'events', event_planner: 'events', photo: 'events',
    lodging: 'stay', hostel: 'stay', apartments: 'stay', rural: 'stay', camping: 'stay',
    fashion: 'shops', jewelry: 'shops', florist: 'shops', gifts: 'shops', books: 'shops', stationery: 'shops', kiosk: 'shops', toys: 'shops', sports_shop: 'shops', electronics: 'shops', home_decor: 'shops', hardware: 'shops', cosmetics: 'shops', secondhand: 'shops', shop: 'shops',
    workshop: 'services', driving_school: 'services', home: 'services', repairs: 'services', laundry: 'services', pets: 'services', coworking: 'services', print: 'services', travel: 'services', civic: 'services', other: 'services',
  };

  /** Palabras con las que se busca lo que no está en el nombre («uñas»,
   * «copas»), en minúsculas y sin tildes. Las mismas que la app. */
  const PALABRAS = {
    bar: ["tapas", "cerveza", "cana", "vermut", "pub", "beer", "pint"],
    restaurant: ["comer", "cena", "comida", "menu", "pizzeria", "asador", "marisqueria", "dinner", "lunch", "food"],
    cafe: ["cafe", "desayuno", "brunch", "merienda", "coffee", "breakfast"],
    brewery: ["cerveza", "cerveceria", "artesana", "craft beer", "brewery", "taproom", "beer"],
    wine: ["vino", "vinoteca", "bodega", "enoteca", "wine", "winery"],
    bakery: ["pan", "panaderia", "pasteleria", "bolleria", "tartas", "croissant", "dulces", "obrador", "horno", "confiteria", "bakery", "bread", "cake", "pastry"],
    churros: ["churros", "porras", "chocolate", "churreria", "chocolateria", "bunuelos"],
    icecream: ["helado", "heladeria", "horchata", "granizado", "gelato", "ice cream", "frozen yogurt"],
    takeaway: ["llevar", "domicilio", "pizza", "kebab", "pollos asados", "asador", "comida rapida", "hamburguesa", "takeaway", "delivery", "fast food"],
    foodtruck: ["food truck", "furgoneta", "camion", "street food", "comida callejera"],
    gourmet: ["cata", "degustacion", "delicatessen", "gourmet", "tasting"],
    grocery: ["fruteria", "carniceria", "pescaderia", "charcuteria", "ultramarinos", "supermercado", "alimentacion", "queseria", "grocery", "butcher", "greengrocer"],
    market: ["mercadillo", "feria", "rastro", "mercado de abastos", "flea"],
    cocktail: ["copas", "coctel", "cocteleria", "pub", "gin tonic", "cocktail", "drinks"],
    nightclub: ["copas", "fiesta", "discoteca", "club", "sala de fiestas", "party"],
    karaoke: ["karaoke", "cantar", "sing"],
    music: ["concierto", "sala de conciertos", "jazz", "flamenco", "tablao", "dj", "gig", "concert", "venue"],
    stage: ["teatro", "monologo", "comedia", "danza", "auditorio", "circo", "magia", "theatre", "theater", "comedy", "show"],
    cinema: ["cine", "pelicula", "estreno", "autocine", "film", "movie"],
    culture: ["museo", "exposicion", "visita", "centro cultural", "biblioteca", "museum", "exhibition"],
    art: ["galeria", "pintura", "arte", "gallery"],
    games: ["videojuegos", "juegos de mesa", "laser tag", "realidad virtual", "billar", "dardos", "games"],
    escape_room: ["escape", "escape room", "enigmas", "sala de escape"],
    bowling: ["bolos", "bolera", "billar", "bowling", "pool", "snooker"],
    karting: ["karts", "karting", "circuito", "go kart"],
    theme_park: ["atracciones", "parque acuatico", "zoo", "acuario", "feria", "theme park", "water park", "aquarium"],
    kids_play: ["parque de bolas", "ludoteca", "cumpleanos", "infantil", "chiqui park", "play centre", "soft play"],
    family: ["ninos", "infantil", "familia", "cuentacuentos", "kids", "children"],
    experiences: ["tour", "ruta", "excursion", "turismo", "visita guiada", "barco", "trip"],
    learning: ["clase", "curso", "taller", "academia", "refuerzo", "cocina", "manualidades", "course"],
    language_school: ["idiomas", "ingles", "frances", "aleman", "language", "english"],
    music_school: ["musica", "guitarra", "piano", "canto", "conservatorio", "music lessons"],
    dance: ["baile", "danza", "salsa", "bachata", "flamenco", "sevillanas", "zumba", "dance"],
    sport: ["futbol", "running", "deporte", "carrera", "polideportivo", "club", "football"],
    gym: ["gimnasio", "crossfit", "fitness", "pesas", "entrenador personal", "gym"],
    yoga: ["yoga", "pilates", "meditacion", "barre", "meditation"],
    padel: ["padel", "tenis", "pista", "pickleball", "squash", "tennis"],
    climbing: ["escalada", "rocodromo", "boulder", "bloque", "climbing"],
    pool: ["piscina", "natacion", "nadar", "pool", "swimming"],
    martial_arts: ["karate", "judo", "taekwondo", "boxeo", "kick boxing", "jiu jitsu", "defensa personal", "boxing"],
    adventure: ["multiaventura", "kayak", "surf", "buceo", "paddle surf", "barranquismo", "tirolina", "vela", "diving"],
    golf: ["golf", "pitch and putt", "campo de golf", "minigolf"],
    wellness: ["spa", "masaje", "balneario", "termas", "relax", "massage"],
    beauty: ["estetica", "depilacion", "maquillaje", "pestanas", "cejas", "makeup"],
    hairdresser: ["peluqueria", "corte", "tinte", "mechas", "haircut"],
    barber: ["barberia", "barbero", "barba", "afeitado", "barber"],
    nails: ["unas", "manicura", "pedicura", "gel", "semipermanente", "nails"],
    tattoo: ["tatuaje", "tatuador", "tattoo", "piercing", "perforacion"],
    pharmacy: ["farmacia", "parafarmacia", "de guardia", "pharmacy", "chemist"],
    optician: ["optica", "gafas", "lentillas", "graduacion", "optician", "glasses"],
    hearing: ["audifonos", "audicion", "hearing aids"],
    dentist: ["dentista", "ortodoncia", "implantes", "blanqueamiento", "dentist"],
    physio: ["fisio", "fisioterapia", "fisioterapeuta", "osteopatia", "rehabilitacion", "physio"],
    podiatry: ["podologo", "pies", "plantillas", "podiatrist"],
    psychology: ["psicologo", "terapia", "logopeda", "psychologist", "therapy"],
    nutrition: ["nutricionista", "dietista", "dieta", "nutritionist"],
    aesthetic_clinic: ["clinica estetica", "botox", "laser", "acido hialuronico", "aesthetic"],
    medical: ["medico", "clinica", "consulta", "analisis", "doctor", "clinic"],
    health: ["salud", "terapias", "health"],
    vet: ["veterinario", "clinica veterinaria", "mascota", "perro", "gato", "vet"],
    event_venue: ["salon", "bodas", "banquetes", "comuniones", "bautizos", "cumpleanos", "eventos", "wedding", "venue"],
    event_estate: ["finca", "masia", "cortijo", "hacienda", "bodas", "jardin", "estate"],
    catering: ["catering", "banquete", "comida para eventos", "caterer"],
    event_planner: ["wedding planner", "animacion", "dj", "hinchables", "decoracion", "magos", "payasos", "planner"],
    photo: ["fotografo", "fotos", "estudio", "video", "reportaje", "photographer"],
    lodging: ["hotel", "alojamiento", "dormir", "habitacion", "stay"],
    hostel: ["hostal", "albergue", "pension", "hostel", "guesthouse"],
    apartments: ["apartamento", "vivienda turistica", "alquiler vacacional", "apartment"],
    rural: ["casa rural", "agroturismo", "turismo rural", "cottage"],
    camping: ["camping", "acampada", "bungalow", "glamping", "caravana", "campsite"],
    fashion: ["ropa", "moda", "zapatos", "zapateria", "bolsos", "complementos", "boutique", "clothes", "fashion", "shoes"],
    jewelry: ["joyeria", "relojeria", "anillos", "plata", "oro", "jewellery", "watches"],
    florist: ["flores", "floristeria", "ramos", "plantas", "flowers"],
    gifts: ["regalos", "bazar", "souvenirs", "detalles", "todo a 100", "gifts"],
    books: ["libros", "libreria", "comic", "books"],
    stationery: ["papeleria", "material escolar", "libros de texto", "stationery"],
    kiosk: ["quiosco", "kiosco", "prensa", "periodicos", "revistas", "chuches", "loteria", "newsagent"],
    toys: ["juguetes", "jugueteria", "juegos", "toys"],
    sports_shop: ["deporte", "bicicletas", "bici", "running", "material deportivo", "sports shop", "bike"],
    electronics: ["movil", "informatica", "ordenador", "reparacion de moviles", "electronica", "phone", "computer"],
    home_decor: ["muebles", "decoracion", "menaje", "colchones", "textil hogar", "furniture", "decor"],
    hardware: ["ferreteria", "bricolaje", "herramientas", "pintura", "llaves", "hardware", "diy"],
    cosmetics: ["perfume", "perfumeria", "cosmetica", "drogueria", "maquillaje", "perfume shop"],
    secondhand: ["segunda mano", "vintage", "antiguedades", "compraventa", "solidaria", "thrift"],
    shop: ["tienda", "comercio", "regalos", "shop", "store"],
    workshop: ["coche", "moto", "mecanico", "taller", "neumaticos", "itv", "lavado", "car", "garage"],
    driving_school: ["autoescuela", "carnet", "permiso de conducir", "driving"],
    home: ["fontanero", "electricista", "limpieza", "reformas", "cerrajero", "jardineria", "mudanzas", "plumber"],
    repairs: ["arreglos", "costura", "zapatero", "copia de llaves", "reparacion", "electrodomesticos", "repair", "tailor"],
    laundry: ["lavanderia", "tintoreria", "autoservicio", "planchado", "laundry", "dry cleaning"],
    pets: ["perro", "gato", "peluqueria canina", "tienda de animales", "guarderia canina", "adiestramiento", "dog", "cat", "grooming"],
    coworking: ["coworking", "oficina", "sala de reuniones", "puesto", "office", "desk"],
    print: ["copisteria", "imprenta", "fotocopias", "impresion", "rotulos", "print"],
    travel: ["viajes", "agencia", "vacaciones", "travel"],
    civic: ["ayuntamiento", "asociacion", "vecinos", "ong", "council"],
  };
  // </generado:categorias>

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
  const textos = (lang) => klBi(TEXTOS, lang);

  /** El grupo de una categoría: el de la base o, si no lo trae, el de su slug. */
  function grupoDe(c) {
    const g = c && c.category_group;
    if (GRUPOS.some((x) => x.id === g)) return g;
    return POR_SLUG[c && c.slug] || 'services';
  }
  // Los grupos traen su nombre en los 8 idiomas; en otro, el inglés o el
  // español como los nombres de las categorías.
  const nombreGrupo = (id, lang) => {
    const g = GRUPOS.find((x) => x.id === id) || GRUPOS[GRUPOS.length - 1];
    return g[lang] || g[/^(en|fr|de|it)$/.test(lang) ? 'en' : 'es'] || g.es;
  };
  // La base trae el nombre en cada idioma ({es, en, ca, gl, eu, fr, de, it});
  // si falta el suyo, el de la versión pública que le toca y, si no, el español.
  const nombre = (c, lang) => (c && c.names && (c.names[lang] || c.names[/^(en|fr|de|it)$/.test(lang) ? 'en' : 'es'] || c.names.es)) || (c && c.slug) || '';

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
      // Varias (casillas, ¿Qué? de Explorar y Descubre desde 2026-10-26) o una
      // (radios, como antes).
      const campos = [...fs.querySelectorAll('input[type=radio], input[type=checkbox]')].filter((r) => r.value);
      const varias = campos.some((r) => r.type === 'checkbox');
      const pos = (r, i) => Number(r.closest('[data-pos]')?.getAttribute('data-pos') ?? i);
      const cats = campos.map((r, i) => ({
        id: r.value, slug: r.value, position: pos(r, i), category_group: r.closest('[data-grupo]')?.getAttribute('data-grupo') || r.getAttribute('data-grupo'),
        names: { es: r.nextElementSibling?.textContent || r.value, en: r.nextElementSibling?.textContent || r.value },
      })).sort((a, b) => a.position - b.position);
      mas.hidden = true;
      boton.hidden = false;
      const aLaVista = (campo) => {
        const etiqueta = campo.closest('label');
        if (etiqueta && mas.contains(etiqueta)) visibles.insertBefore(etiqueta, boton.parentElement === visibles ? boton : null);
      };
      boton.addEventListener('click', async () => {
        const elegidas = campos.filter((r) => r.checked).map((r) => r.value);
        const r = await KlendarCategorias.abrir({
          cats, elegidas, multiple: varias, lang, titulo: boton.getAttribute('data-titulo') || undefined,
        });
        if (r == null) { boton.focus(); return; }
        if (varias) {
          const set = new Set(r);
          campos.forEach((c) => { c.checked = set.has(c.value); if (c.checked) aLaVista(c); });
          fs.dispatchEvent(new Event('change', { bubbles: true }));
          boton.focus();
          return;
        }
        const radio = campos.find((x) => x.value === r);
        if (!radio) return;
        radio.checked = true;
        aLaVista(radio);
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
