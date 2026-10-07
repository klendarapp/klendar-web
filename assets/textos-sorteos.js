// «Sorteos»: las frases, los formatos y la comprobación del sorteo
// verificable, en un solo sitio (tanda C; migración 20261208100001_sorteos de
// la app).
//
// Los mismos en la web pública (Pages Functions: `import KS from
// '../../assets/textos-sorteos.js'`), en la página del sorteo en el navegador
// (/assets/sorteo.js), en «Tu cuenta» y en el panel del negocio (script
// clásico: deja `KlendarSorteos` en `window`). Son los de la app
// (docs/GLOSARIO.md y la especificación de la tanda C).
//
// Comprobar el resultado (igual que la app y que la base, `giveaway_pick`):
// para j = 0, 1, 2…, h = SHA-256 en hexadecimal del texto UTF-8
// «<semilla>:<j>»; n = (las 15 primeras cifras de h como entero) mod N + 1,
// con N = `entries_total`. Los anulados o ya salidos se saltan, hasta tener
// tantos como `picked_numbers`. Y además sha256(semilla) = `seed_hash`.
(function () {
  'use strict';

  const T = {
    es: {
      title: 'Sorteos',
      sub: 'Participa gratis en los sorteos de los negocios',
      lead: 'Participa gratis en los sorteos de los negocios',
      eyebrow: 'SORTEO',
      word: 'Sorteo',
      cardLine: (premio, fecha) => `Sorteo: ${premio} · termina el ${fecha}`,
      endsOn: (x) => `Termina el ${x}`,
      entrants: (n) => (n === 1 ? '1 participa' : `${n} participan`),
      youreIn: (n) => `Participas · nº ${n}`,
      segNear: 'Cerca',
      segMine: 'En los que participas',
      empty: 'Ahora no hay sorteos por aquí',
      emptyText: 'Los negocios los publican de vez en cuando. Mira en otra zona o vuelve otro día.',
      emptyMine: 'Aún no participas en ningún sorteo',
      emptyMineText: 'Cuando participes en uno, lo verás aquí con tu número.',
      loginMine: 'Entra en tu cuenta para ver los sorteos en los que participas.',
      login: 'Entrar',
      seeNear: 'Ver los de cerca',
      seeAll: 'Ver todas las ciudades',
      by: 'de',
      value: (x) => `Valor aproximado: ${x}`,
      winners: (w, b) => `${w === 1 ? '1 ganador' : `${w} ganadores`} · ${b === 1 ? '1 suplente' : `${b} suplentes`}`,
      requirement: (x) => `Requisito: tener ${x} en favoritos`,
      adults: '+18',
      terms: 'Condiciones',
      about: 'Qué incluye',
      enter: 'Participar',
      enterFav: 'Añadir a favoritos y participar',
      free: 'Gratis y sin compra. Mayores de 18.',
      inNumber: (n) => `Participas · tu número es el ${n}`,
      leave: 'Dejar el sorteo',
      left: 'Has dejado el sorteo.',
      noAge: 'Hace falta tener 18 años y la fecha de nacimiento en tu perfil.',
      addBirth: 'Añadir mi fecha de nacimiento',
      team: 'Eres del equipo de este negocio: no puedes participar.',
      drawing: 'Se está sorteando…',
      ended: 'Ha terminado',
      won: '¡Has ganado!',
      acceptBy: (x) => `Acéptalo antes del ${x}`,
      claim: 'Aceptar el premio',
      decline: 'Renunciar',
      declineQ: '¿Renunciar al premio? Pasará al siguiente.',
      cancel: 'Cancelar',
      claimed: (x) => `Premio aceptado. ${x} te lo entregará: enséñale esta pantalla.`,
      delivered: 'Premio entregado',
      expired: 'No lo aceptaste a tiempo',
      declined: 'Renunciaste al premio',
      noLuck: 'Esta vez no te ha tocado.',
      cancelled: (r) => (r ? `Sorteo cancelado: ${r}` : 'Sorteo cancelado'),
      verTitle: 'Sorteo verificable',
      verText: 'Antes de empezar publicamos el resumen de una semilla secreta. Al terminar publicamos la semilla: con ella cualquiera puede repetir el sorteo y ver que sale lo mismo.',
      hash: 'Resumen (SHA-256)',
      seed: 'Semilla',
      entries: (n) => `Participaciones: ${n}`,
      voids: (l) => `Números anulados: ${l}`,
      none: 'Ninguno',
      picked: (g, s) => `Han salido: ${g}${g ? ` (${s.ganadores > 1 ? 'ganadores' : 'ganador'})` : ''}${s.suplentes ? ` · ${s.suplentes} (suplentes)` : ''}`,
      check: 'Comprobar el resultado',
      checking: 'Comprobando…',
      ok: 'Comprobado: sale lo mismo.',
      bad: 'No coincide: escríbenos.',
      noCrypto: 'Este navegador no puede hacer la comprobación. Prueba con otro.',
      how: '¿Cómo se calcula?',
      howText: 'Para cada vuelta j = 0, 1, 2…, se calcula el SHA-256 del texto «semilla:j», se toman sus 15 primeras cifras hexadecimales y se dividen entre el número de participaciones: el resto más 1 es el número que sale. Los números anulados o repetidos se saltan; los primeros que salen son los ganadores y los siguientes, los suplentes, por orden.',
      rules: 'Bases legales',
      share: 'Compartir',
      copied: 'Enlace copiado',
      shareStories: 'Compartir en historias',
      report: 'Denunciar',
      reportDetail: (p) => `Sorteo: ${p}`,
      more: 'Más opciones',
      oops: 'Algo no ha ido bien. Si vuelve a pasar, escríbenos a info@klendar.app.',
      notHere: 'Este sorteo no está',
      notHereText: 'Puede que lo hayan quitado o que el enlace esté mal.',
      rulesTitle: 'Bases del sorteo',
      rulesNote: 'Estas bases las genera Klendar con los datos que ha puesto el organizador.',
      updated: (x) => `Última actualización: ${x}`,
      back: 'Volver al sorteo',
      enteredOk: (n) => `Participas · tu número es el ${n}`,
      favAdded: (x) => `Hemos añadido ${x} a tus favoritos.`,
    },
    en: {
      title: 'Giveaways',
      sub: "Enter local businesses' giveaways for free",
      lead: "Enter local businesses' giveaways for free",
      eyebrow: 'GIVEAWAY',
      word: 'Giveaway',
      cardLine: (premio, fecha) => `Giveaway: ${premio} · ends on ${fecha}`,
      endsOn: (x) => `Ends on ${x}`,
      entrants: (n) => `${n} taking part`,
      youreIn: (n) => `You're in · no. ${n}`,
      segNear: 'Nearby',
      segMine: "You've entered",
      empty: 'No giveaways around here right now',
      emptyText: 'Businesses post them from time to time. Look in another area or come back another day.',
      emptyMine: "You haven't entered any giveaways yet",
      emptyMineText: "When you enter one, you'll see it here with your number.",
      loginMine: "Log in to see the giveaways you've entered.",
      login: 'Log in',
      seeNear: 'See the ones nearby',
      seeAll: 'See every city',
      by: 'by',
      value: (x) => `Approximate value: ${x}`,
      winners: (w, b) => `${w === 1 ? '1 winner' : `${w} winners`} · ${b === 1 ? '1 reserve' : `${b} reserves`}`,
      requirement: (x) => `Requirement: have ${x} in your favourites`,
      adults: '18+',
      terms: 'Conditions',
      about: "What's included",
      enter: 'Enter',
      enterFav: 'Add to favourites and enter',
      free: 'Free, no purchase needed. 18+ only.',
      inNumber: (n) => `You're in · your number is ${n}`,
      leave: 'Leave the giveaway',
      left: "You've left the giveaway.",
      noAge: 'You need to be 18 and have your date of birth in your profile.',
      addBirth: 'Add my date of birth',
      team: "You're on this business's team: you can't enter.",
      drawing: 'The draw is happening…',
      ended: 'It has ended',
      won: "You've won!",
      acceptBy: (x) => `Accept it before ${x}`,
      claim: 'Accept the prize',
      decline: 'Decline',
      declineQ: 'Decline the prize? It will go to the next person.',
      cancel: 'Cancel',
      claimed: (x) => `Prize accepted. ${x} will hand it over: show them this screen.`,
      delivered: 'Prize handed over',
      expired: "You didn't accept it in time",
      declined: 'You declined the prize',
      noLuck: 'No luck this time.',
      cancelled: (r) => (r ? `Giveaway cancelled: ${r}` : 'Giveaway cancelled'),
      verTitle: 'Verifiable draw',
      verText: 'Before it starts we publish the hash of a secret seed. When it ends we publish the seed: with it anyone can repeat the draw and see that it comes out the same.',
      hash: 'Hash (SHA-256)',
      seed: 'Seed',
      entries: (n) => `Entries: ${n}`,
      voids: (l) => `Void numbers: ${l}`,
      none: 'None',
      picked: (g, s) => `Drawn: ${g}${g ? ` (${s.ganadores > 1 ? 'winners' : 'winner'})` : ''}${s.suplentes ? ` · ${s.suplentes} (reserves)` : ''}`,
      check: 'Check the result',
      checking: 'Checking…',
      ok: 'Checked: same result.',
      bad: "It doesn't match: write to us.",
      noCrypto: "This browser can't run the check. Try another one.",
      how: 'How is it calculated?',
      howText: 'For each round j = 0, 1, 2…, we take the SHA-256 of the text “seed:j”, keep its first 15 hexadecimal digits and divide by the number of entries: the remainder plus 1 is the number drawn. Void or repeated numbers are skipped; the first numbers drawn are the winners and the next ones the reserves, in order.',
      rules: 'Rules',
      share: 'Share',
      copied: 'Link copied',
      shareStories: 'Share to stories',
      report: 'Report',
      reportDetail: (p) => `Giveaway: ${p}`,
      more: 'More options',
      oops: 'Something went wrong. If it happens again, email info@klendar.app.',
      notHere: "This giveaway isn't here",
      notHereText: 'It may have been removed or the link may be wrong.',
      rulesTitle: 'Giveaway rules',
      rulesNote: 'Klendar generates these rules from the details the organiser has entered.',
      updated: (x) => `Last updated: ${x}`,
      back: 'Back to the giveaway',
      enteredOk: (n) => `You're in · your number is ${n}`,
      favAdded: (x) => `We've added ${x} to your favourites.`,
    },
  };

  /** Lo que dice la base cuando algo no se puede. */
  const ERR = {
    es: {
      auth_required: 'Tienes que entrar en tu cuenta.',
      account_suspended: 'Tu cuenta está suspendida. Si crees que es un error, escribe a info@klendar.app.',
      not_found: 'Este sorteo ya no está.',
      ended: 'Este sorteo ya ha terminado.',
      team_member: 'Eres del equipo de este negocio: no puedes participar.',
      adult_required: 'Hace falta tener 18 años y la fecha de nacimiento en tu perfil.',
      rate_limited: 'Vas muy rápido. Espera un momento y vuelve a probar.',
      too_late: 'Ya ha pasado el plazo para aceptarlo.',
    },
    en: {
      auth_required: 'You need to log in to your account.',
      account_suspended: 'Your account is suspended. If you think this is a mistake, email info@klendar.app.',
      not_found: "This giveaway isn't here any more.",
      ended: 'This giveaway has already ended.',
      team_member: "You're on this business's team: you can't enter.",
      adult_required: 'You need to be 18 and have your date of birth in your profile.',
      rate_limited: "You're going very fast. Wait a moment and try again.",
      too_late: 'The time to accept it has passed.',
    },
  };

  const L = (lang) => (lang === 'en' ? 'en' : 'es');
  const t = (lang) => T[L(lang)];
  const error = (code, lang) => ERR[L(lang)][code] || '';
  const loc = (lang) => (L(lang) === 'en' ? 'en-GB' : 'es-ES');

  /** «14 de octubre, 21:00» (o con el año: «14 de octubre de 2026, 21:00»),
   * en la hora del negocio. */
  function cuando(iso, lang, tz, conAno = false) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const zona = tz || 'Europe/Madrid';
    const dia = new Intl.DateTimeFormat(loc(lang), { timeZone: zona, day: 'numeric', month: 'long', ...(conAno ? { year: 'numeric' } : {}) }).format(d);
    const hora = new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    return `${dia}, ${hora}`;
  }
  /** «14 de octubre» (sin hora). */
  function dia(iso, lang, tz) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(loc(lang), { timeZone: tz || 'Europe/Madrid', day: 'numeric', month: 'long' }).format(d);
  }
  /** «50,00 €» / «€50.00». */
  const dinero = (c, lang) => (c == null ? '' : (Number(c) / 100).toLocaleString(loc(lang), { style: 'currency', currency: 'EUR' }));
  const nf = (n, lang) => Number(n || 0).toLocaleString(loc(lang));

  /** El sorteo terminó (la hora pasó), aunque aún no se haya sorteado. */
  const terminado = (g, ahora = Date.now()) => g.status !== 'active' || new Date(g.ends_at).getTime() <= ahora;

  /** «Han salido: 37 (ganador) · 12, 99 (suplentes)». */
  function salidos(g, lang) {
    const p = Array.isArray(g.picked_numbers) ? g.picked_numbers : [];
    const w = Math.max(0, Number(g.winners) || 0);
    const gan = p.slice(0, w);
    const sup = p.slice(w);
    return t(lang).picked(gan.join(', '), { ganadores: gan.length, suplentes: sup.join(', ') });
  }
  const anulados = (g, lang) => {
    const v = Array.isArray(g.void_numbers) ? g.void_numbers : [];
    return t(lang).voids(v.length ? v.join(', ') : t(lang).none);
  };

  // ── La comprobación (solo en el navegador) ────────────────────────────────
  async function sha256(texto) {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  /** Los números que salen con esta semilla (los mismos pasos que la base). */
  async function sortea(seed, n, anuladosL, cuantos) {
    const fuera = new Set((anuladosL || []).map(Number));
    const out = [];
    if (!(n > 0)) return out;
    const N = BigInt(n);
    for (let j = 0; out.length < cuantos && j < 200000; j++) {
      const h = await sha256(`${seed}:${j}`);
      const num = Number((BigInt(`0x${h.slice(0, 15)}`) % N) + 1n);
      if (!fuera.has(num) && !out.includes(num)) out.push(num);
    }
    return out;
  }
  /** true si la semilla da su resumen y los números que se publicaron. */
  async function verifica(g) {
    if (!g || !g.seed) return false;
    if ((await sha256(g.seed)) !== String(g.seed_hash || '').toLowerCase()) return false;
    const pub = Array.isArray(g.picked_numbers) ? g.picked_numbers.map(Number) : [];
    const sale = await sortea(g.seed, Number(g.entries_total) || 0, g.void_numbers, pub.length);
    return sale.length === pub.length && sale.every((x, i) => x === pub[i]);
  }

  const KlendarSorteos = { t, error, cuando, dia, dinero, nf, terminado, salidos, anulados, sha256, sortea, verifica };
  globalThis.KlendarSorteos = KlendarSorteos;
  if (typeof module === 'object' && module && module.exports) module.exports = KlendarSorteos;
})();
