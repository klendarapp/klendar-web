// «Grupos y empresas»: los nombres, las frases y los formatos, en un solo
// sitio (tanda C; migración 20261208100000_grupos_y_empresas de la app).
//
// Los mismos en la web pública (Pages Functions: `import KG from
// '../../assets/textos-grupos.js'`), en «Tu cuenta» y en el panel del negocio
// (script clásico: deja `KlendarGrupos` en `window`). Son los de la app
// (docs/GLOSARIO.md y la especificación de la tanda C): si cambia uno, cambia
// en todos los sitios a la vez.
(function () {
  'use strict';

  /** Los tipos de plan, en el orden de la base (`group_kinds()`). */
  const KINDS = ['company_dinner', 'afterwork', 'team_activity', 'celebration'];
  const PLURAL = {
    es: { company_dinner: 'Cenas de empresa', afterwork: 'Afterwork', team_activity: 'Actividades de equipo', celebration: 'Celebraciones' },
    en: { company_dinner: 'Company dinners', afterwork: 'Afterwork', team_activity: 'Team activities', celebration: 'Celebrations' },
  };
  const SINGULAR = {
    es: { company_dinner: 'Cena de empresa', afterwork: 'Afterwork', team_activity: 'Actividad de equipo', celebration: 'Celebración' },
    en: { company_dinner: 'Company dinner', afterwork: 'Afterwork', team_activity: 'Team activity', celebration: 'Celebration' },
  };

  const T = {
    es: {
      title: 'Grupos y empresas',
      sub: 'Cenas de empresa, afterwork, celebraciones…',
      lead: 'Negocios que aceptan grupos. Elige hasta 3 y pídeles presupuesto a la vez.',
      all: 'Todos',
      howMany: '¿Cuántas personas?',
      apply: 'Aplicar',
      upTo: (n) => `Hasta ${n} personas`,
      choose: 'Elegir',
      chosen: 'Elegido',
      ask: (n) => `Pedir presupuesto (${n})`,
      askOne: 'Pedir presupuesto',
      max3: 'Como mucho 3 a la vez.',
      yourRequests: 'Tus peticiones',
      emptyTitle: 'Aún no hay negocios que acepten grupos por aquí',
      emptyText: 'Prueba a buscar más lejos o con menos filtros.',
      widen: 'Ampliar a 25 km',
      clear: 'Quitar filtros',
      takes: (n) => `Acepta grupos · hasta ${n} personas`,
      // El formulario
      formTitle: 'Pedir presupuesto',
      to: 'Para',
      addOther: 'Añadir otro',
      remove: (x) => `Quitar ${x}`,
      what: '¿Para qué?',
      date: 'Fecha',
      budget: 'Presupuesto por persona (opcional)',
      note: 'Nota (opcional)',
      noteHelp: 'Horario, menú, alergias, si hace falta un espacio aparte…',
      privacy: 'Hasta que aceptes una propuesta, los negocios no ven quién eres.',
      send: 'Enviar petición',
      sent: 'Petición enviada. Te avisamos cuando contesten (tienen 72 horas).',
      noBusinesses: 'Elige al menos un negocio en «Grupos y empresas».',
      seeRequest: 'Ver la petición',
      // «Tus peticiones»
      requestsEmptyTitle: 'Aún no has pedido presupuesto',
      requestsEmptyText: 'Elige hasta 3 negocios que acepten grupos y pídeles presupuesto a la vez.',
      line: (kind, people, date) => `${kind} · ${people} personas · ${date}`,
      status: { open: 'Abierta', accepted: 'Aceptada', cancelled: 'Retirada', expired: 'Cerrada' },
      waiting: (x) => `Esperando respuesta · hasta el ${x}`,
      proposal: 'Propuesta',
      perPerson: (x) => `${x} por persona`,
      declined: 'No puede',
      noReply: 'Sin respuesta',
      acceptedShared: (que) => `Has aceptado esta propuesta · le has compartido tu ${que === 'phone' ? 'teléfono' : 'correo'}`,
      notChosen: 'No elegida',
      withdrawn: 'Retirada',
      accept: 'Aceptar esta propuesta',
      sheetTitle: (x) => `¿Cómo quieres que te contacte ${x}?`,
      myEmail: (e) => `Mi correo (${e})`,
      aPhone: 'Un teléfono',
      phone: 'Teléfono',
      sheetNote: (x) => `Solo lo verá ${x}. A los demás les diremos que has elegido otra.`,
      acceptShare: 'Aceptar y compartir',
      accepted: 'Propuesta aceptada. El negocio ya tiene tu contacto.',
      withdraw: 'Retirar la petición',
      withdrawQ: '¿Retirar la petición? Avisaremos a los negocios.',
      withdrawn2: 'Petición retirada',
      notFound: 'Esa petición ya no está',
      // El negocio
      weTake: 'Aceptamos grupos',
      maxPeople: 'Hasta cuántas personas',
      forWhat: 'Para qué',
      bizNote: 'Nota (opcional)',
      bizNoteHelp: 'Ej.: menús de grupo desde 25 € por persona, sala privada para 30.',
      requests: 'Peticiones',
      segs: { open: 'Sin cerrar', done: 'Aceptadas', all: 'Todas' },
      about: (x) => `Unos ${x} por persona`,
      replyBy: (x) => `Contesta antes del ${x}`,
      others: (n) => (n === 1 ? 'También se ha pedido a 1 negocio más' : `También se ha pedido a ${n} negocios más`),
      sendProposal: 'Enviar propuesta',
      cannot: 'No podemos',
      cannotQ: '¿No puedes?',
      cannotDone: 'Le hemos dicho que no puedes',
      proposalHelp: 'Qué ofreces: menú, espacio, horario…',
      yourProposal: 'Tu propuesta',
      pricePP: 'Precio por persona orientativo (opcional)',
      conditions: 'Condiciones (opcional)',
      proposalSent: 'Propuesta enviada',
      fix: 'Corregir',
      contact: (n, x) => `Contacto: ${[n, x].filter(Boolean).join(' · ')}`,
      write: 'Escribir',
      call: 'Llamar',
      contactFoot: 'El contacto se borra de Klendar 30 días después de la fecha.',
      bizStatus: { expired: 'Sin contestar a tiempo', not_chosen: 'No elegida', withdrawn: 'Retirada', declined: 'No puedes', accepted: 'Aceptada' },
    },
    en: {
      title: 'Groups and companies',
      sub: 'Company dinners, afterwork, celebrations…',
      lead: 'Places that take groups. Pick up to 3 and ask them all for a quote.',
      all: 'All',
      howMany: 'How many people?',
      apply: 'Apply',
      upTo: (n) => `Up to ${n} people`,
      choose: 'Choose',
      chosen: 'Chosen',
      ask: (n) => `Ask for a quote (${n})`,
      askOne: 'Ask for a quote',
      max3: 'Up to 3 at a time.',
      yourRequests: 'Your requests',
      emptyTitle: 'No places taking groups around here yet',
      emptyText: 'Try searching further away or with fewer filters.',
      widen: 'Widen to 25 km',
      clear: 'Clear filters',
      takes: (n) => `Takes groups · up to ${n} people`,
      formTitle: 'Ask for a quote',
      to: 'To',
      addOther: 'Add another',
      remove: (x) => `Remove ${x}`,
      what: 'What for?',
      date: 'Date',
      budget: 'Budget per person (optional)',
      note: 'Note (optional)',
      noteHelp: 'Time, menu, allergies, whether a separate space is needed…',
      privacy: "Until you accept a proposal, the places can't see who you are.",
      send: 'Send request',
      sent: "Request sent. We'll let you know when they reply (they have 72 hours).",
      noBusinesses: 'Pick at least one place in “Groups and companies”.',
      seeRequest: 'See the request',
      requestsEmptyTitle: "You haven't asked for a quote yet",
      requestsEmptyText: 'Pick up to 3 places that take groups and ask them all for a quote.',
      line: (kind, people, date) => `${kind} · ${people} people · ${date}`,
      status: { open: 'Open', accepted: 'Accepted', cancelled: 'Withdrawn', expired: 'Closed' },
      waiting: (x) => `Waiting for a reply · until ${x}`,
      proposal: 'Proposal',
      perPerson: (x) => `${x} per person`,
      declined: "Can't make it",
      noReply: 'No reply',
      acceptedShared: (que) => `You accepted this proposal · you shared your ${que === 'phone' ? 'phone number' : 'email'}`,
      notChosen: 'Not chosen',
      withdrawn: 'Withdrawn',
      accept: 'Accept this proposal',
      sheetTitle: (x) => `How would you like ${x} to contact you?`,
      myEmail: (e) => `My email (${e})`,
      aPhone: 'A phone number',
      phone: 'Phone number',
      sheetNote: (x) => `Only ${x} will see it. We'll tell the others you chose another one.`,
      acceptShare: 'Accept and share',
      accepted: 'Proposal accepted. The place now has your contact details.',
      withdraw: 'Withdraw the request',
      withdrawQ: "Withdraw the request? We'll let the places know.",
      withdrawn2: 'Request withdrawn',
      notFound: "That request isn't here any more",
      weTake: 'We take groups',
      maxPeople: 'Up to how many people',
      forWhat: 'What for',
      bizNote: 'Note (optional)',
      bizNoteHelp: 'E.g. group menus from €25 per person, private room for 30.',
      requests: 'Requests',
      segs: { open: 'Open', done: 'Accepted', all: 'All' },
      about: (x) => `About ${x} per person`,
      replyBy: (x) => `Reply by ${x}`,
      others: (n) => (n === 1 ? 'Also sent to 1 more place' : `Also sent to ${n} more places`),
      sendProposal: 'Send proposal',
      cannot: "We can't",
      cannotQ: "Can't do it?",
      cannotDone: "We've told them you can't",
      proposalHelp: 'What you offer: menu, space, times…',
      yourProposal: 'Your proposal',
      pricePP: 'Approximate price per person (optional)',
      conditions: 'Conditions (optional)',
      proposalSent: 'Proposal sent',
      fix: 'Edit',
      contact: (n, x) => `Contact: ${[n, x].filter(Boolean).join(' · ')}`,
      write: 'Email',
      call: 'Call',
      contactFoot: 'The contact details are deleted from Klendar 30 days after the date.',
      bizStatus: { expired: 'Not answered in time', not_chosen: 'Not chosen', withdrawn: 'Withdrawn', declined: "You can't", accepted: 'Accepted' },
    },
  };

  /** Lo que dice la base cuando algo no se puede (`{ok:false, error}`), con
   * el nombre del negocio o el máximo si los trae. */
  const ERR = {
    es: {
      auth_required: 'Tienes que entrar en tu cuenta.',
      account_suspended: 'Tu cuenta está suspendida. Si crees que es un error, escribe a info@klendar.app.',
      bad_businesses: 'Elige de 1 a 3 negocios.',
      bad_kind: 'Elige para qué es.',
      bad_date: 'Elige una fecha a partir de mañana.',
      bad_people: 'Entre 2 y 500 personas.',
      bad_budget: 'Revisa el presupuesto por persona.',
      too_long: 'Hay un texto demasiado largo.',
      offensive_text: 'Revisa el texto: hay palabras que no se permiten.',
      business_not_accepting: (d) => `${d.business || 'Ese negocio'} ya no acepta grupos.`,
      own_business: (d) => `Eres del equipo de ${d.business || 'ese negocio'}.`,
      too_many_people: (d) => `${d.business || 'Ese negocio'} acepta grupos de hasta ${d.max_people} personas.`,
      kind_not_accepted: (d) => `${d.business || 'Ese negocio'} no hace ese tipo de plan.`,
      already_requested: (d) => `Ya tienes una petición abierta con ${d.business || 'ese negocio'}.`,
      daily_limit: 'Puedes enviar 3 peticiones cada 24 horas.',
      open_limit: 'Tienes 5 peticiones abiertas: cierra alguna antes.',
      not_found: 'Esa petición ya no está.',
      request_closed: 'Esta petición ya se ha cerrado.',
      no_proposal: 'Este negocio aún no ha enviado su propuesta.',
      no_email: 'Tu cuenta no tiene correo: elige un teléfono.',
      bad_phone: 'Revisa el teléfono.',
      bad_share: 'Elige cómo quieres que te contacten.',
      no_kinds: 'Marca al menos un tipo de plan.',
      bad_text: 'Escribe la propuesta (de 10 a 600 caracteres).',
      bad_price: 'Revisa el precio por persona.',
      too_late: 'Ya ha pasado el plazo para contestar.',
      not_authorized: 'No tienes permiso para esto. Pídeselo a quien lleve el negocio.',
    },
    en: {
      auth_required: 'You need to log in to your account.',
      account_suspended: 'Your account is suspended. If you think this is a mistake, email info@klendar.app.',
      bad_businesses: 'Pick 1 to 3 places.',
      bad_kind: 'Choose what it is for.',
      bad_date: 'Pick a date from tomorrow onwards.',
      bad_people: 'Between 2 and 500 people.',
      bad_budget: 'Check the budget per person.',
      too_long: 'One of the texts is too long.',
      offensive_text: "Check the text: it has words that aren't allowed.",
      business_not_accepting: (d) => `${d.business || 'That place'} no longer takes groups.`,
      own_business: (d) => `You're on ${d.business || 'that place'}'s team.`,
      too_many_people: (d) => `${d.business || 'That place'} takes groups of up to ${d.max_people} people.`,
      kind_not_accepted: (d) => `${d.business || 'That place'} doesn't do that kind of plan.`,
      already_requested: (d) => `You already have an open request with ${d.business || 'that place'}.`,
      daily_limit: 'You can send 3 requests every 24 hours.',
      open_limit: 'You have 5 open requests: close one first.',
      not_found: "That request isn't here any more.",
      request_closed: 'This request has already closed.',
      no_proposal: "This place hasn't sent its proposal yet.",
      no_email: "Your account has no email: choose a phone number.",
      bad_phone: 'Check the phone number.',
      bad_share: 'Choose how you want them to contact you.',
      no_kinds: 'Tick at least one kind of plan.',
      bad_text: 'Write the proposal (10 to 600 characters).',
      bad_price: 'Check the price per person.',
      too_late: 'The time to reply has passed.',
      not_authorized: "You don't have permission for this. Ask whoever runs the business.",
    },
  };

  const L = (lang) => (lang === 'en' ? 'en' : 'es');
  const t = (lang) => T[L(lang)];
  const plural = (k, lang) => PLURAL[L(lang)][k] || k;
  const singular = (k, lang) => SINGULAR[L(lang)][k] || k;
  /** El error en palabras ('' si no es uno de estos). */
  function error(code, lang, datos) {
    const e = ERR[L(lang)][code];
    if (!e) return '';
    return typeof e === 'function' ? e(datos || {}) : e;
  }

  const loc = (lang) => (L(lang) === 'en' ? 'en-GB' : 'es-ES');
  /** «14 de noviembre» de una fecha sin hora («AAAA-MM-DD»). */
  function fecha(d, lang) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    if (!m) return '';
    return new Intl.DateTimeFormat(loc(lang), { timeZone: 'UTC', day: 'numeric', month: 'long' })
      .format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)));
  }
  /** «10 de noviembre, 21:00» de un instante, en la hora del negocio. */
  function cuando(iso, lang, tz) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const zona = tz || 'Europe/Madrid';
    const dia = new Intl.DateTimeFormat(loc(lang), { timeZone: zona, day: 'numeric', month: 'long' }).format(d);
    const hora = new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    return `${dia}, ${hora}`;
  }
  /** «25,00 €» / «€25.00». */
  const dinero = (c, lang) => (c == null ? '' : (Number(c) / 100).toLocaleString(loc(lang), { style: 'currency', currency: 'EUR' }));
  /** «Cena de empresa · 12 personas · 14 de noviembre». */
  const linea = (r, lang) => t(lang).line(singular(r.kind, lang), r.people, fecha(r.event_date, lang));
  /** «350 m», «1,2 km». */
  function distancia(m, lang) {
    const n = Number(m);
    if (m == null || !Number.isFinite(n)) return '';
    if (n < 1000) return `${Math.max(10, Math.round(n / 10) * 10)} m`;
    const km = (n / 1000).toFixed(n < 10000 ? 1 : 0);
    return `${L(lang) === 'en' ? km : km.replace('.', ',')} km`;
  }

  const KlendarGrupos = { KINDS, t, plural, singular, error, fecha, cuando, dinero, linea, distancia };
  globalThis.KlendarGrupos = KlendarGrupos;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarGrupos;
})();
