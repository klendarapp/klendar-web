// Los textos del cartel de una publicación y de la pegatina de escaparate,
// en los ocho idiomas de la app y del panel (§4zzz-cartel, 23-11).
//
// Las páginas públicas de klendar.app solo están en español e inglés
// (`idioma.js`), pero lo que se imprime lo lee la gente de la calle: el
// cartel sale en el idioma del negocio o en el que elija (`?lang=ca`…). El
// QR lleva a la ficha en español o en inglés (`esOEn`), que es lo que hay.
// Lo que escribe el negocio (el título, el nombre) va tal cual.

import KZ from '../../assets/zona.js';
import { esOEn } from './idioma.js';

export const IDIOMAS = ['es', 'en', 'ca', 'gl', 'eu', 'fr', 'de', 'it'];

/** El nombre de cada idioma en su idioma (el selector del cartel). */
export const NOMBRE_IDIOMA = {
  es: 'Español', en: 'English', ca: 'Català', gl: 'Galego', eu: 'Euskara', fr: 'Français', de: 'Deutsch', it: 'Italiano',
};

const LOCALE = { es: 'es-ES', en: 'en-GB', ca: 'ca-ES', gl: 'gl-ES', eu: 'eu-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT' };

/** El idioma del cartel: el de `?lang=` si es uno de los ocho; si no, el de
 * la dirección (`/cartel/…` español, `/en/poster/…` inglés). */
export function idiomaCartel(pedido, deRuta) {
  const l = String(pedido || '').toLowerCase().split(/[-_]/)[0];
  return IDIOMAS.includes(l) ? l : deRuta === 'en' ? 'en' : 'es';
}

/** La versión de la web a la que lleva el QR (y la dirección del cartel). */
export const webDe = (lang) => esOEn(lang);

const mayus = (s) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);

/** «Sábado, 28 de noviembre» en la hora del negocio. */
export const diaLargo = (iso, lang, tz) => mayus(KZ.fmt(iso, tz, LOCALE[lang] || 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
/** «28 nov.» */
export const diaCorto = (iso, lang, tz) => KZ.fmt(iso, tz, LOCALE[lang] || 'es-ES', { day: 'numeric', month: 'short' });
/** «18:30» (en inglés también a 24 h: así se lee en España). */
export const hora = (iso, lang, tz) => KZ.fmt(iso, tz, LOCALE[lang] || 'es-ES', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** «12 €», «12,50 €» («€12.50» en inglés). Sin «,00»: en un cartel sobra. */
export function dinero(cents, currency = 'EUR', lang = 'es') {
  if (cents == null || !Number.isFinite(Number(cents))) return '';
  const n = Number(cents) / 100;
  const entero = Number(cents) % 100 === 0;
  try {
    return new Intl.NumberFormat(lang === 'en' ? 'en-IE' : LOCALE[lang] || 'es-ES', {
      style: 'currency', currency: currency || 'EUR', minimumFractionDigits: entero ? 0 : 2, maximumFractionDigits: 2,
    }).format(n);
  } catch { return `${n} ${currency || 'EUR'}`; }
}

/** Los textos del cartel de una publicación. */
export const TP = {
  es: {
    title: 'Cartel', print: 'Imprimir', size: 'Tamaño', language: 'Idioma del cartel', change: 'Cambiar',
    help: 'Para la puerta, la barra o el escaparate. Se imprime igual en blanco y negro.',
    hint: 'En el cuadro de imprimir: tamaño de papel {size}, márgenes «Ninguno» y escala 100 %.',
    offer: 'Oferta', event: 'Evento', free: 'Gratis', before: 'Antes',
    code: 'Escanea y consigue tu código', seat: 'Escanea y reserva tu plaza',
    ticket: 'Escanea y consigue tu entrada', info: 'Escanea y mira todos los detalles',
    point: 'Apunta con la cámara del móvil',
    noTitle: 'Esta publicación no tiene cartel',
    noExclusive: 'Es una exclusiva: solo la ven quienes tienen el local en favoritos o son clientes, así que un cartel para todo el mundo no tiene sentido. Avísales con «Avisar a mis clientes».',
  },
  en: {
    title: 'Poster', print: 'Print', size: 'Size', language: 'Poster language', change: 'Change',
    help: 'For the door, the bar or the window. It prints fine in black and white.',
    hint: 'In the print dialog: paper size {size}, margins “None” and scale 100%.',
    offer: 'Offer', event: 'Event', free: 'Free', before: 'Was',
    code: 'Scan and get your code', seat: 'Scan and book your place',
    ticket: 'Scan and get your ticket', info: 'Scan to see all the details',
    point: 'Point your phone camera here',
    noTitle: 'This publication has no poster',
    noExclusive: 'It’s an exclusive: only people who have you in their favourites or are customers can see it, so a poster for everyone makes no sense. Tell them with “Message my customers”.',
  },
  ca: {
    title: 'Cartell', print: 'Imprimeix', size: 'Mida', language: 'Idioma del cartell', change: 'Canvia',
    help: 'Per a la porta, la barra o l’aparador. S’imprimeix igual en blanc i negre.',
    hint: 'Al quadre d’imprimir: mida de paper {size}, marges «Cap» i escala 100 %.',
    offer: 'Oferta', event: 'Esdeveniment', free: 'Gratis', before: 'Abans',
    code: 'Escaneja i aconsegueix el teu codi', seat: 'Escaneja i reserva la teva plaça',
    ticket: 'Escaneja i aconsegueix la teva entrada', info: 'Escaneja i mira’n tots els detalls',
    point: 'Apunta amb la càmera del mòbil',
    noTitle: 'Aquesta publicació no té cartell',
    noExclusive: 'És una exclusiva: només la veuen els qui tenen el local a preferits o en són clients, així que un cartell per a tothom no té sentit. Avisa’ls amb «Avisa els meus clients».',
  },
  gl: {
    title: 'Cartel', print: 'Imprimir', size: 'Tamaño', language: 'Idioma do cartel', change: 'Cambiar',
    help: 'Para a porta, a barra ou o escaparate. Imprímese igual en branco e negro.',
    hint: 'No cadro de imprimir: tamaño de papel {size}, marxes «Ningunha» e escala 100 %.',
    offer: 'Oferta', event: 'Evento', free: 'De balde', before: 'Antes',
    code: 'Escanea e consegue o teu código', seat: 'Escanea e reserva a túa praza',
    ticket: 'Escanea e consegue a túa entrada', info: 'Escanea e mira todos os detalles',
    point: 'Apunta coa cámara do móbil',
    noTitle: 'Esta publicación non ten cartel',
    noExclusive: 'É unha exclusiva: só a ven quen ten o local en favoritos ou é cliente, así que un cartel para todo o mundo non ten sentido. Avísaos con «Avisar os meus clientes».',
  },
  eu: {
    title: 'Kartela', print: 'Inprimatu', size: 'Tamaina', language: 'Kartelaren hizkuntza', change: 'Aldatu',
    help: 'Aterako, barrarako edo erakusleihorako. Zuri-beltzean ere ondo inprimatzen da.',
    hint: 'Inprimatzeko leihoan: paper-tamaina {size}, marjinak «Bat ere ez» eta eskala % 100.',
    offer: 'Eskaintza', event: 'Ekitaldia', free: 'Doan', before: 'Lehen',
    code: 'Eskaneatu eta lortu zure kodea', seat: 'Eskaneatu eta erreserbatu zure tokia',
    ticket: 'Eskaneatu eta lortu zure sarrera', info: 'Eskaneatu eta ikusi xehetasun guztiak',
    point: 'Enfokatu mugikorraren kamerarekin',
    noTitle: 'Argitalpen honek ez du kartelik',
    noExclusive: 'Esklusiba bat da: lokala gogokoetan dutenek edo bezeroek bakarrik ikusten dute; beraz, guztientzako kartel batek ez du zentzurik. Jakinarazi «Abisatu nire bezeroei» erabiliz.',
  },
  fr: {
    title: 'Affiche', print: 'Imprimer', size: 'Format', language: 'Langue de l’affiche', change: 'Changer',
    help: 'Pour la porte, le comptoir ou la vitrine. S’imprime aussi bien en noir et blanc.',
    hint: 'Dans la fenêtre d’impression : format {size}, marges « Aucune » et échelle 100 %.',
    offer: 'Offre', event: 'Événement', free: 'Gratuit', before: 'Avant',
    code: 'Scannez et obtenez votre code', seat: 'Scannez et réservez votre place',
    ticket: 'Scannez et obtenez votre billet', info: 'Scannez pour voir tous les détails',
    point: 'Visez avec l’appareil photo du téléphone',
    noTitle: 'Cette publication n’a pas d’affiche',
    noExclusive: 'C’est une exclusivité : seuls ceux qui ont l’établissement en favori ou sont clients la voient, une affiche pour tout le monde n’a donc pas de sens. Prévenez-les avec « Prévenir mes clients ».',
  },
  de: {
    title: 'Plakat', print: 'Drucken', size: 'Größe', language: 'Sprache des Plakats', change: 'Ändern',
    help: 'Für die Tür, die Theke oder das Schaufenster. Druckt auch in Schwarz-Weiß gut.',
    hint: 'Im Druckfenster: Papierformat {size}, Ränder „Keine“ und Skalierung 100 %.',
    offer: 'Angebot', event: 'Veranstaltung', free: 'Gratis', before: 'Vorher',
    code: 'Scannen und Code holen', seat: 'Scannen und Platz reservieren',
    ticket: 'Scannen und Ticket holen', info: 'Scannen und alle Details sehen',
    point: 'Richte die Handykamera hierauf',
    noTitle: 'Diese Veröffentlichung hat kein Plakat',
    noExclusive: 'Es ist ein Exklusivangebot: Nur wer das Lokal in den Favoriten hat oder Kunde ist, sieht es – ein Plakat für alle ergibt also keinen Sinn. Sag es ihnen mit „Meine Kunden benachrichtigen“.',
  },
  it: {
    title: 'Locandina', print: 'Stampa', size: 'Formato', language: 'Lingua della locandina', change: 'Cambia',
    help: 'Per la porta, il bancone o la vetrina. Si stampa bene anche in bianco e nero.',
    hint: 'Nella finestra di stampa: formato {size}, margini «Nessuno» e scala 100%.',
    offer: 'Offerta', event: 'Evento', free: 'Gratis', before: 'Prima',
    code: 'Scansiona e ottieni il tuo codice', seat: 'Scansiona e prenota il tuo posto',
    ticket: 'Scansiona e ottieni il tuo biglietto', info: 'Scansiona per vedere tutti i dettagli',
    point: 'Inquadra con la fotocamera del telefono',
    noTitle: 'Questa pubblicazione non ha una locandina',
    noExclusive: 'È un’esclusiva: la vede solo chi ha il locale tra i preferiti o è cliente, quindi una locandina per tutti non ha senso. Avvisali con «Avvisa i miei clienti».',
  },
};

/** Los textos de la pegatina de escaparate. */
export const TS = {
  es: {
    title: 'Pegatina de escaparate', print: 'Imprimir', language: 'Idioma', change: 'Cambiar', how: 'Cómo imprimirla', bg: 'Fondo',
    sheet: '4 por folio · 9,5 cm', big: '1 grande · 14 cm', pro: 'Imprenta · 10 cm',
    dark: 'Oscuro', light: 'Claro',
    helpSheet: 'Cuatro por folio A4, en papel adhesivo (mejor mate). Recórtalas por el borde y pégalas en el cristal de la puerta o en el escaparate.',
    helpBig: 'Una de 14 cm por folio A4, en papel adhesivo. Recórtala por el borde.',
    helpPro: 'Para la imprenta: «Guardar como PDF» saca una hoja de 106 × 106 mm (10 cm de corte redondo y 3 mm de sangrado). Pide vinilo blanco con laminado mate; si va por dentro del cristal, «adhesivo frontal».',
    hint: 'En el cuadro de imprimir: márgenes «Ninguno» y escala 100 %.',
    findUs: 'Encuéntranos en Klendar', weAre: 'Estamos en Klendar', sub: 'Ofertas y planes cerca de ti',
    scan: 'Escanea y mira nuestras ofertas de hoy',
  },
  en: {
    title: 'Window sticker', print: 'Print', language: 'Language', change: 'Change', how: 'How to print it', bg: 'Background',
    sheet: '4 per sheet · 9.5 cm', big: '1 large · 14 cm', pro: 'Print shop · 10 cm',
    dark: 'Dark', light: 'Light',
    helpSheet: 'Four per A4 sheet, on sticker paper (matte is best). Cut them out along the edge and stick them on the door glass or the window.',
    helpBig: 'One 14 cm sticker per A4 sheet, on sticker paper. Cut it out along the edge.',
    helpPro: 'For a print shop: “Save as PDF” gives a 106 × 106 mm page (10 cm round cut and 3 mm bleed). Ask for white vinyl with a matte laminate; if it goes inside the glass, “face-adhesive”.',
    hint: 'In the print dialog: margins “None” and scale 100%.',
    findUs: 'Find us on Klendar', weAre: 'We’re on Klendar', sub: 'Offers and plans near you',
    scan: 'Scan to see our offers today',
  },
  ca: {
    title: 'Adhesiu d’aparador', print: 'Imprimeix', language: 'Idioma', change: 'Canvia', how: 'Com imprimir-lo', bg: 'Fons',
    sheet: '4 per foli · 9,5 cm', big: '1 de gran · 14 cm', pro: 'Impremta · 10 cm',
    dark: 'Fosc', light: 'Clar',
    helpSheet: 'Quatre per foli A4, en paper adhesiu (millor mat). Retalla’ls per la vora i enganxa’ls al vidre de la porta o a l’aparador.',
    helpBig: 'Un de 14 cm per foli A4, en paper adhesiu. Retalla’l per la vora.',
    helpPro: 'Per a la impremta: «Desa com a PDF» treu un full de 106 × 106 mm (10 cm de tall rodó i 3 mm de sagnat). Demana vinil blanc amb laminat mat; si va per dins del vidre, «adhesiu frontal».',
    hint: 'Al quadre d’imprimir: marges «Cap» i escala 100 %.',
    findUs: 'Troba’ns a Klendar', weAre: 'Som a Klendar', sub: 'Ofertes i plans a prop teu',
    scan: 'Escaneja i mira les nostres ofertes d’avui',
  },
  gl: {
    title: 'Adhesivo de escaparate', print: 'Imprimir', language: 'Idioma', change: 'Cambiar', how: 'Como imprimilo', bg: 'Fondo',
    sheet: '4 por folio · 9,5 cm', big: '1 grande · 14 cm', pro: 'Imprenta · 10 cm',
    dark: 'Escuro', light: 'Claro',
    helpSheet: 'Catro por folio A4, en papel adhesivo (mellor mate). Recórtaos polo bordo e pégaos no cristal da porta ou no escaparate.',
    helpBig: 'Un de 14 cm por folio A4, en papel adhesivo. Recórtao polo bordo.',
    helpPro: 'Para a imprenta: «Gardar como PDF» saca unha folla de 106 × 106 mm (10 cm de corte redondo e 3 mm de sangrado). Pide vinilo branco con laminado mate; se vai por dentro do cristal, «adhesivo frontal».',
    hint: 'No cadro de imprimir: marxes «Ningunha» e escala 100 %.',
    findUs: 'Atópanos en Klendar', weAre: 'Estamos en Klendar', sub: 'Ofertas e plans preto de ti',
    scan: 'Escanea e mira as nosas ofertas de hoxe',
  },
  eu: {
    title: 'Erakusleihoko pegatina', print: 'Inprimatu', language: 'Hizkuntza', change: 'Aldatu', how: 'Nola inprimatu', bg: 'Hondoa',
    sheet: '4 orriko · 9,5 cm', big: 'Handi bat · 14 cm', pro: 'Inprimategia · 10 cm',
    dark: 'Iluna', light: 'Argia',
    helpSheet: 'Lau A4 orri bakoitzeko, paper itsasgarrian (hobe matea). Moztu ertzetik eta itsatsi atearen kristalean edo erakusleihoan.',
    helpBig: '14 cm-ko bat A4 orri bakoitzeko, paper itsasgarrian. Moztu ertzetik.',
    helpPro: 'Inprimategirako: «Gorde PDF gisa» aukerak 106 × 106 mm-ko orri bat ateratzen du (10 cm-ko ebaki biribila eta 3 mm-ko odoltzea). Eskatu binilo zuria laminatu mateaz; kristalaren barrutik badoa, «aurreko itsasgarria».',
    hint: 'Inprimatzeko leihoan: marjinak «Bat ere ez» eta eskala % 100.',
    findUs: 'Aurki gaitzazu Klendarren', weAre: 'Klendarren gaude', sub: 'Eskaintzak eta planak zure ondoan',
    scan: 'Eskaneatu eta ikusi gaurko gure eskaintzak',
  },
  fr: {
    title: 'Autocollant de vitrine', print: 'Imprimer', language: 'Langue', change: 'Changer', how: 'Comment l’imprimer', bg: 'Fond',
    sheet: '4 par feuille · 9,5 cm', big: '1 grand · 14 cm', pro: 'Imprimeur · 10 cm',
    dark: 'Foncé', light: 'Clair',
    helpSheet: 'Quatre par feuille A4, sur papier adhésif (mat de préférence). Découpez-les le long du bord et collez-les sur la vitre de la porte ou la vitrine.',
    helpBig: 'Un de 14 cm par feuille A4, sur papier adhésif. Découpez-le le long du bord.',
    helpPro: 'Pour un imprimeur : « Enregistrer au format PDF » donne une page de 106 × 106 mm (découpe ronde de 10 cm et 3 mm de fond perdu). Demandez du vinyle blanc avec pelliculage mat ; s’il se colle à l’intérieur de la vitre, « adhésif face avant ».',
    hint: 'Dans la fenêtre d’impression : marges « Aucune » et échelle 100 %.',
    findUs: 'Retrouvez-nous sur Klendar', weAre: 'Nous sommes sur Klendar', sub: 'Offres et sorties près de chez vous',
    scan: 'Scannez pour voir nos offres du jour',
  },
  de: {
    title: 'Schaufenster-Aufkleber', print: 'Drucken', language: 'Sprache', change: 'Ändern', how: 'So druckst du ihn', bg: 'Hintergrund',
    sheet: '4 pro Blatt · 9,5 cm', big: '1 großer · 14 cm', pro: 'Druckerei · 10 cm',
    dark: 'Dunkel', light: 'Hell',
    helpSheet: 'Vier pro A4-Blatt, auf Klebepapier (am besten matt). Am Rand ausschneiden und an die Türscheibe oder ins Schaufenster kleben.',
    helpBig: 'Einer mit 14 cm pro A4-Blatt, auf Klebepapier. Am Rand ausschneiden.',
    helpPro: 'Für eine Druckerei: „Als PDF speichern“ ergibt eine Seite mit 106 × 106 mm (10 cm runder Schnitt und 3 mm Beschnitt). Weißes Vinyl mit matter Laminierung bestellen; innen an der Scheibe „Frontklebend“.',
    hint: 'Im Druckfenster: Ränder „Keine“ und Skalierung 100 %.',
    findUs: 'Finde uns auf Klendar', weAre: 'Wir sind auf Klendar', sub: 'Angebote und Pläne in deiner Nähe',
    scan: 'Scannen und unsere Angebote von heute sehen',
  },
  it: {
    title: 'Adesivo da vetrina', print: 'Stampa', language: 'Lingua', change: 'Cambia', how: 'Come stamparlo', bg: 'Sfondo',
    sheet: '4 per foglio · 9,5 cm', big: '1 grande · 14 cm', pro: 'Tipografia · 10 cm',
    dark: 'Scuro', light: 'Chiaro',
    helpSheet: 'Quattro per foglio A4, su carta adesiva (meglio opaca). Ritagliali lungo il bordo e attaccali al vetro della porta o alla vetrina.',
    helpBig: 'Uno da 14 cm per foglio A4, su carta adesiva. Ritaglialo lungo il bordo.',
    helpPro: 'Per una tipografia: «Salva come PDF» crea una pagina di 106 × 106 mm (taglio rotondo di 10 cm e 3 mm di abbondanza). Chiedi vinile bianco con laminazione opaca; se va all’interno del vetro, «adesivo frontale».',
    hint: 'Nella finestra di stampa: margini «Nessuno» e scala 100%.',
    findUs: 'Trovaci su Klendar', weAre: 'Siamo su Klendar', sub: 'Offerte e cose da fare vicino a te',
    scan: 'Scansiona e scopri le nostre offerte di oggi',
  },
};
