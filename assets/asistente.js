/* Klendar — el asistente de ayuda en la web: /preguntas/, /en/faq/ y «Sugerencias y mejoras» de «Tu cuenta». RUNBOOK §4zi (app).
 *
 * Lo mismo que la app (lib/features/help/presentation/assistant_screen.dart), con los mismos textos. Apagado, con el tope
 * acabado, sin red o contra una base sin la migración: `assistant_status` no dice `available` y no sale nada; queda la Ayuda
 * de siempre. Antes de la primera pregunta dice que es una IA y pide el permiso (art. 50 del Reglamento de IA). La conversación
 * solo vive en esta página: no se guarda en ningún sitio y no sale en ningún registro. Solo con `textContent`: lo que contesta
 * nunca se pinta como HTML.
 *
 * Uso: un `<div data-asistente hidden></div>` y este fichero; en una página que pinta después, `KL_ASISTENTE.monta()`.
 */
(function () {
  'use strict';
  // REVISAR-TRADUCCION: en `introEmergency`, la frase del 024 y el 016 es la de los textos fijos de lo grave (`_shared/asistente.ts`
  // de la app), traducida sin que la haya mirado nadie que hable cada idioma. Mismo texto en la app (`assistantIntroEmergency`).
  var T = {
 "es": {
  "close": "Cerrar",
  "title": "Asistente de ayuda",
  "entry": "Pregúntale al asistente",
  "entryHint": "Una IA que responde con lo publicado en la Ayuda y las Normas",
  "introTitle": "Antes de empezar: esto es una IA",
  "introBody": "Este asistente es una inteligencia artificial, no una persona. Es Claude, de Anthropic, una empresa de Estados Unidos. Responde solo con lo publicado en la Ayuda y las Normas de Klendar, y puede equivocarse. Lo que dice no obliga a Klendar: lo que vale es lo publicado y lo que te contestemos por correo.",
  "introPrivacy": "No pongas datos personales. Lo que escribas va a Anthropic para responderte, sin tu nombre ni tu cuenta, y quitamos los correos, teléfonos y DNI que veamos. Anthropic no lo usa para entrenar su IA y lo borra en 30 días; lo que sus sistemas marquen como grave puede guardarlo hasta 2 años. Klendar no guarda la conversación: solo cuenta las preguntas.",
  "introEmergency": "Si hay una emergencia, llama al 112. En España también están, gratis, el 024 (conducta suicida) y el 016 (violencia de género). El asistente no sirve para eso.",
  "accept": "Entendido, empezar",
  "notNow": "Ahora no",
  "more": "Más información",
  "note": "Es una IA y puede equivocarse. Lo que dice no obliga a Klendar. No pongas datos personales.",
  "empty": "Pregunta lo que quieras sobre Klendar, en tu idioma.",
  "hint": "Tu pregunta",
  "send": "Preguntar",
  "thinking": "Buscando en lo publicado…",
  "you": "Tú",
  "redacted": "Hemos quitado de tu mensaje lo que parecía un dato personal.",
  "subject": "Pregunta sobre Klendar",
  "attach": "Adjuntar esta conversación",
  "seeHelp": "Ver la Ayuda",
  "newChat": "Empezar otra conversación",
  "errOffline": "Sin conexión no puedo responder. Tienes la Ayuda y el correo.",
  "errFailed": "Ahora no puedo responder. Tienes la Ayuda y el correo.",
  "errClosed": "El asistente no está disponible ahora. Tienes la Ayuda, con su buscador, y el correo.",
  "errDaily": "Has llegado al máximo de preguntas de hoy. Tienes la Ayuda y el correo.",
  "errTurns": "Has llegado al máximo de preguntas de esta conversación.",
  "errTooLong": "Es demasiado largo. Pregúntalo en menos palabras.",
  "errShort": "No lo entiendo. ¿Puedes escribirlo con algo más de detalle?",
  "source": "Sacado de: {title}",
  "goTo": "Ir a {screen}",
  "email": "Escribir a {email}",
  "s_ajustes": "Ajustes",
  "s_notificaciones": "Ajustes de notificaciones",
  "s_sugerencias": "Sugerencias y mejoras",
  "s_tus_planes": "Tus planes",
  "s_mi_negocio": "Mi negocio",
  "s_alta_negocio": "Dar de alta un negocio",
  "s_eliminar_cuenta": "Eliminar mi cuenta",
  "s_denunciar": "Denunciar"
 },
 "en": {
  "close": "Close",
  "title": "Help assistant",
  "entry": "Ask the assistant",
  "entryHint": "An AI that answers from what is published in Help and the Community Guidelines",
  "introTitle": "Before you start: this is an AI",
  "introBody": "This assistant is an artificial intelligence, not a person. It is Claude, by Anthropic, a US company. It only answers from what is published in Klendar’s Help and Community Guidelines, and it can get things wrong. What it says does not bind Klendar: what counts is what is published and what we tell you by email.",
  "introPrivacy": "Don’t include personal data. What you write goes to Anthropic so it can answer, without your name or account, and we remove any emails, phone numbers and ID numbers we spot. Anthropic does not use it to train its AI and deletes it within 30 days; anything its systems flag as serious may be kept for up to 2 years. Klendar does not keep the conversation: it only counts the questions.",
  "introEmergency": "In an emergency, call 112. In Spain you can also call, free of charge, 024 (suicidal behaviour) and 016 (gender-based violence). The assistant is not for that.",
  "accept": "Got it, start",
  "notNow": "Not now",
  "more": "More information",
  "note": "This is an AI and it can get things wrong. What it says does not bind Klendar. Don’t include personal data.",
  "empty": "Ask anything about Klendar, in your own language.",
  "hint": "Your question",
  "send": "Ask",
  "thinking": "Looking through what’s published…",
  "you": "You",
  "redacted": "We removed what looked like personal data from your message.",
  "subject": "Question about Klendar",
  "attach": "Attach this conversation",
  "seeHelp": "See Help",
  "newChat": "Start another conversation",
  "errOffline": "I can’t answer without a connection. You still have Help and email.",
  "errFailed": "I can’t answer right now. You still have Help and email.",
  "errClosed": "The assistant isn’t available right now. You still have Help, with its search, and email.",
  "errDaily": "You’ve reached today’s limit of questions. You still have Help and email.",
  "errTurns": "You’ve reached the question limit for this conversation.",
  "errTooLong": "That’s too long. Try asking in fewer words.",
  "errShort": "I don’t understand. Could you write it with a bit more detail?",
  "source": "From: {title}",
  "goTo": "Go to {screen}",
  "email": "Write to {email}",
  "s_ajustes": "Settings",
  "s_notificaciones": "Notification settings",
  "s_sugerencias": "Ideas and feedback",
  "s_tus_planes": "Your plans",
  "s_mi_negocio": "My business",
  "s_alta_negocio": "Register a business",
  "s_eliminar_cuenta": "Delete my account",
  "s_denunciar": "Report"
 },
 "ca": {
  "close": "Tanca",
  "title": "Assistent d'ajuda",
  "entry": "Pregunta-ho a l'assistent",
  "entryHint": "Una IA que respon amb el que hi ha publicat a l'Ajuda i les Normes",
  "introTitle": "Abans de començar: això és una IA",
  "introBody": "Aquest assistent és una intel·ligència artificial, no una persona. És Claude, d'Anthropic, una empresa dels Estats Units. Respon només amb el que hi ha publicat a l'Ajuda i les Normes de Klendar, i es pot equivocar. El que diu no obliga Klendar: el que val és el que hi ha publicat i el que et responguem per correu.",
  "introPrivacy": "No hi posis dades personals. El que escriguis va a Anthropic per respondre't, sense el teu nom ni el teu compte, i traiem els correus, telèfons i DNI que veiem. Anthropic no ho fa servir per entrenar la seva IA i ho esborra en 30 dies; el que els seus sistemes marquin com a greu ho pot guardar fins a 2 anys. Klendar no guarda la conversa: només compta les preguntes.",
  "introEmergency": "Si hi ha una emergència, truca al 112. A Espanya també tens, gratis, el 024 (conducta suïcida) i el 016 (violència de gènere). L'assistent no serveix per a això.",
  "accept": "D'acord, comença",
  "notNow": "Ara no",
  "more": "Més informació",
  "note": "És una IA i es pot equivocar. El que diu no obliga Klendar. No hi posis dades personals.",
  "empty": "Pregunta el que vulguis sobre Klendar, en el teu idioma.",
  "hint": "La teva pregunta",
  "send": "Preguntar",
  "thinking": "Buscant en el que hi ha publicat…",
  "you": "Tu",
  "redacted": "Hem tret del teu missatge el que semblava una dada personal.",
  "subject": "Pregunta sobre Klendar",
  "attach": "Adjuntar aquesta conversa",
  "seeHelp": "Veure l'Ajuda",
  "newChat": "Començar una altra conversa",
  "errOffline": "Sense connexió no puc respondre. Tens l'Ajuda i el correu.",
  "errFailed": "Ara no puc respondre. Tens l'Ajuda i el correu.",
  "errClosed": "L'assistent no està disponible ara. Tens l'Ajuda, amb el seu cercador, i el correu.",
  "errDaily": "Has arribat al màxim de preguntes d'avui. Tens l'Ajuda i el correu.",
  "errTurns": "Has arribat al màxim de preguntes d'aquesta conversa.",
  "errTooLong": "És massa llarg. Pregunta-ho en menys paraules.",
  "errShort": "No ho entenc. Pots escriure-ho amb una mica més de detall?",
  "source": "Tret de: {title}",
  "goTo": "Anar a {screen}",
  "email": "Escriure a {email}",
  "s_ajustes": "Configuració",
  "s_notificaciones": "Configuració de notificacions",
  "s_sugerencias": "Suggeriments i millores",
  "s_tus_planes": "Els teus plans",
  "s_mi_negocio": "El meu negoci",
  "s_alta_negocio": "Dona d'alta un negoci",
  "s_eliminar_cuenta": "Elimina el meu compte",
  "s_denunciar": "Denunciar"
 },
 "gl": {
  "close": "Pechar",
  "title": "Asistente de axuda",
  "entry": "Pregúntalle ao asistente",
  "entryHint": "Unha IA que responde co publicado na Axuda e nas Normas",
  "introTitle": "Antes de comezar: isto é unha IA",
  "introBody": "Este asistente é unha intelixencia artificial, non unha persoa. É Claude, de Anthropic, unha empresa dos Estados Unidos. Responde só co publicado na Axuda e nas Normas de Klendar, e pode equivocarse. O que di non obriga a Klendar: o que vale é o publicado e o que che contestemos por correo.",
  "introPrivacy": "Non poñas datos persoais. O que escribas vai a Anthropic para responderche, sen o teu nome nin a túa conta, e quitamos os correos, teléfonos e DNI que vexamos. Anthropic non o usa para adestrar a súa IA e bórrao en 30 días; o que os seus sistemas marquen como grave pode gardalo ata 2 anos. Klendar non garda a conversa: só conta as preguntas.",
  "introEmergency": "Se hai unha emerxencia, chama ao 112. En España tamén tes, de balde, o 024 (conduta suicida) e o 016 (violencia de xénero). O asistente non serve para iso.",
  "accept": "Entendido, comezar",
  "notNow": "Agora non",
  "more": "Máis información",
  "note": "É unha IA e pode equivocarse. O que di non obriga a Klendar. Non poñas datos persoais.",
  "empty": "Pregunta o que queiras sobre Klendar, no teu idioma.",
  "hint": "A túa pregunta",
  "send": "Preguntar",
  "thinking": "Buscando no publicado…",
  "you": "Ti",
  "redacted": "Quitamos da túa mensaxe o que parecía un dato persoal.",
  "subject": "Pregunta sobre Klendar",
  "attach": "Xuntar esta conversa",
  "seeHelp": "Ver a Axuda",
  "newChat": "Comezar outra conversa",
  "errOffline": "Sen conexión non podo responder. Tes a Axuda e o correo.",
  "errFailed": "Agora non podo responder. Tes a Axuda e o correo.",
  "errClosed": "O asistente non está dispoñible agora. Tes a Axuda, co seu buscador, e o correo.",
  "errDaily": "Chegaches ao máximo de preguntas de hoxe. Tes a Axuda e o correo.",
  "errTurns": "Chegaches ao máximo de preguntas desta conversa.",
  "errTooLong": "É demasiado longo. Pregúntao en menos palabras.",
  "errShort": "Non o entendo. Podes escribilo con algo máis de detalle?",
  "source": "Sacado de: {title}",
  "goTo": "Ir a {screen}",
  "email": "Escribir a {email}",
  "s_ajustes": "Axustes",
  "s_notificaciones": "Axustes de notificacións",
  "s_sugerencias": "Suxestións e melloras",
  "s_tus_planes": "Os teus plans",
  "s_mi_negocio": "O meu negocio",
  "s_alta_negocio": "Dar de alta un negocio",
  "s_eliminar_cuenta": "Eliminar a miña conta",
  "s_denunciar": "Denunciar"
 },
 "eu": {
  "close": "Itxi",
  "title": "Laguntza-laguntzailea",
  "entry": "Galdetu laguntzaileari",
  "entryHint": "Laguntzan eta Arauetan argitaratutakoarekin erantzuten duen AA bat",
  "introTitle": "Hasi aurretik: hau AA bat da",
  "introBody": "Laguntzaile hau adimen artifiziala da, ez pertsona bat. Claude da, Anthropic-ena, Estatu Batuetako enpresa batena. Klendarren Laguntzan eta Arauetan argitaratutakoarekin bakarrik erantzuten du, eta oker dezake. Esaten duenak ez du Klendar behartzen: argitaratutakoak eta posta bidez erantzuten dizugunak balio du.",
  "introPrivacy": "Ez jarri datu pertsonalik. Idazten duzuna Anthropic-era doa erantzun ahal izateko, zure izenik eta konturik gabe, eta ikusten ditugun posta elektronikoak, telefonoak eta NANak kentzen ditugu. Anthropic-ek ez du erabiltzen bere AA entrenatzeko eta 30 egunetan ezabatzen du; bere sistemek larritzat markatzen dutena 2 urtez gorde dezake. Klendarrek ez du elkarrizketa gordetzen: galderak zenbatzen ditu soilik.",
  "introEmergency": "Larrialdi bat badago, deitu 112ra. Espainian, doan, 024 (suizidio-jokabidea) eta 016 (genero-indarkeria) ere badituzu. Laguntzailea ez da horretarako.",
  "accept": "Ulertuta, hasi",
  "notNow": "Orain ez",
  "more": "Informazio gehiago",
  "note": "AA bat da eta oker dezake. Esaten duenak ez du Klendar behartzen. Ez jarri datu pertsonalik.",
  "empty": "Galdetu nahi duzuna Klendarri buruz, zure hizkuntzan.",
  "hint": "Zure galdera",
  "send": "Galdetu",
  "thinking": "Argitaratutakoan bilatzen…",
  "you": "Zu",
  "redacted": "Datu pertsonala zirudiena kendu dugu zure mezutik.",
  "subject": "Klendarri buruzko galdera",
  "attach": "Erantsi elkarrizketa hau",
  "seeHelp": "Ikusi Laguntza",
  "newChat": "Hasi beste elkarrizketa bat",
  "errOffline": "Konexiorik gabe ezin dut erantzun. Laguntza eta posta dituzu.",
  "errFailed": "Orain ezin dut erantzun. Laguntza eta posta dituzu.",
  "errClosed": "Laguntzailea ez dago erabilgarri orain. Laguntza duzu, bilatzailearekin, eta posta.",
  "errDaily": "Gaurko galdera kopuru handienera iritsi zara. Laguntza eta posta dituzu.",
  "errTurns": "Elkarrizketa honetako galdera kopuru handienera iritsi zara.",
  "errTooLong": "Luzeegia da. Galdetu hitz gutxiagotan.",
  "errShort": "Ez dut ulertzen. Xehetasun gehiagorekin idatz dezakezu?",
  "source": "Iturria: {title}",
  "goTo": "Joan hona: {screen}",
  "email": "Idatzi hona: {email}",
  "s_ajustes": "Ezarpenak",
  "s_notificaciones": "Jakinarazpenen ezarpenak",
  "s_sugerencias": "Iradokizunak eta hobekuntzak",
  "s_tus_planes": "Zure planak",
  "s_mi_negocio": "Nire negozioa",
  "s_alta_negocio": "Eman alta negozio bati",
  "s_eliminar_cuenta": "Ezabatu nire kontua",
  "s_denunciar": "Salatu"
 },
 "fr": {
  "close": "Fermer",
  "title": "Assistant d'aide",
  "entry": "Demande à l'assistant",
  "entryHint": "Une IA qui répond à partir de ce qui est publié dans l'Aide et les Règles",
  "introTitle": "Avant de commencer : ceci est une IA",
  "introBody": "Cet assistant est une intelligence artificielle, pas une personne. C'est Claude, d'Anthropic, une entreprise américaine. Il répond uniquement à partir de ce qui est publié dans l'Aide et les Règles de Klendar, et il peut se tromper. Ce qu'il dit n'engage pas Klendar : ce qui compte, c'est ce qui est publié et ce que nous te répondons par e-mail.",
  "introPrivacy": "Ne mets pas de données personnelles. Ce que tu écris va à Anthropic pour te répondre, sans ton nom ni ton compte, et nous retirons les e-mails, téléphones et numéros d'identité que nous repérons. Anthropic ne l'utilise pas pour entraîner son IA et le supprime sous 30 jours ; ce que ses systèmes signalent comme grave peut être conservé jusqu'à 2 ans. Klendar ne garde pas la conversation : il compte seulement les questions.",
  "introEmergency": "En cas d'urgence, appelle le 112. En Espagne, tu peux aussi appeler gratuitement le 024 (conduites suicidaires) et le 016 (violences de genre). L'assistant n'est pas fait pour ça.",
  "accept": "Compris, commencer",
  "notNow": "Pas maintenant",
  "more": "En savoir plus",
  "note": "C'est une IA et elle peut se tromper. Ce qu'elle dit n'engage pas Klendar. Ne mets pas de données personnelles.",
  "empty": "Pose ta question sur Klendar, dans ta langue.",
  "hint": "Ta question",
  "send": "Demander",
  "thinking": "Recherche dans ce qui est publié…",
  "you": "Toi",
  "redacted": "Nous avons retiré de ton message ce qui ressemblait à une donnée personnelle.",
  "subject": "Question sur Klendar",
  "attach": "Joindre cette conversation",
  "seeHelp": "Voir l'Aide",
  "newChat": "Commencer une autre conversation",
  "errOffline": "Sans connexion, je ne peux pas répondre. Il te reste l'Aide et l'e-mail.",
  "errFailed": "Je ne peux pas répondre pour l'instant. Il te reste l'Aide et l'e-mail.",
  "errClosed": "L'assistant n'est pas disponible pour l'instant. Il te reste l'Aide, avec sa recherche, et l'e-mail.",
  "errDaily": "Tu as atteint le maximum de questions pour aujourd'hui. Il te reste l'Aide et l'e-mail.",
  "errTurns": "Tu as atteint le maximum de questions pour cette conversation.",
  "errTooLong": "C’est trop long. Pose ta question en moins de mots.",
  "errShort": "Je ne comprends pas. Peux-tu donner un peu plus de détails ?",
  "source": "Source : {title}",
  "goTo": "Aller à {screen}",
  "email": "Écrire à {email}",
  "s_ajustes": "Réglages",
  "s_notificaciones": "Réglages des notifications",
  "s_sugerencias": "Idées et suggestions",
  "s_tus_planes": "Tes plans",
  "s_mi_negocio": "Mon établissement",
  "s_alta_negocio": "Inscrire un établissement",
  "s_eliminar_cuenta": "Supprimer mon compte",
  "s_denunciar": "Signaler"
 },
 "de": {
  "close": "Schließen",
  "title": "Hilfe-Assistent",
  "entry": "Frag den Assistenten",
  "entryHint": "Eine KI, die mit dem antwortet, was in der Hilfe und den Regeln veröffentlicht ist",
  "introTitle": "Bevor du anfängst: Das ist eine KI",
  "introBody": "Dieser Assistent ist eine künstliche Intelligenz, kein Mensch. Es ist Claude von Anthropic, einem US-Unternehmen. Er antwortet nur mit dem, was in der Hilfe und den Regeln von Klendar veröffentlicht ist, und kann sich irren. Was er sagt, verpflichtet Klendar zu nichts: Es gilt, was veröffentlicht ist und was wir dir per E-Mail antworten.",
  "introPrivacy": "Gib keine personenbezogenen Daten an. Was du schreibst, geht an Anthropic, damit du eine Antwort bekommst, ohne deinen Namen und dein Konto, und wir entfernen E-Mail-Adressen, Telefon- und Ausweisnummern, die wir erkennen. Anthropic nutzt es nicht zum Trainieren seiner KI und löscht es innerhalb von 30 Tagen; was seine Systeme als schwerwiegend markieren, kann bis zu 2 Jahre gespeichert werden. Klendar speichert das Gespräch nicht: Es zählt nur die Fragen.",
  "introEmergency": "Im Notfall ruf die 112 an. In Spanien gibt es außerdem kostenlos die 024 (Suizidgefährdung) und die 016 (geschlechtsspezifische Gewalt). Dafür ist der Assistent nicht gedacht.",
  "accept": "Verstanden, loslegen",
  "notNow": "Jetzt nicht",
  "more": "Mehr erfahren",
  "note": "Das ist eine KI und sie kann sich irren. Was sie sagt, verpflichtet Klendar zu nichts. Gib keine personenbezogenen Daten an.",
  "empty": "Frag, was du über Klendar wissen möchtest, in deiner Sprache.",
  "hint": "Deine Frage",
  "send": "Fragen",
  "thinking": "Suche im Veröffentlichten…",
  "you": "Du",
  "redacted": "Wir haben entfernt, was in deiner Nachricht nach personenbezogenen Daten aussah.",
  "subject": "Frage zu Klendar",
  "attach": "Dieses Gespräch anhängen",
  "seeHelp": "Zur Hilfe",
  "newChat": "Neues Gespräch beginnen",
  "errOffline": "Ohne Verbindung kann ich nicht antworten. Dir bleiben die Hilfe und die E-Mail.",
  "errFailed": "Gerade kann ich nicht antworten. Dir bleiben die Hilfe und die E-Mail.",
  "errClosed": "Der Assistent ist gerade nicht verfügbar. Dir bleiben die Hilfe mit ihrer Suche und die E-Mail.",
  "errDaily": "Du hast das Fragenlimit für heute erreicht. Dir bleiben die Hilfe und die E-Mail.",
  "errTurns": "Du hast das Fragenlimit für dieses Gespräch erreicht.",
  "errTooLong": "Das ist zu lang. Frag es mit weniger Worten.",
  "errShort": "Das verstehe ich nicht. Kannst du es etwas genauer schreiben?",
  "source": "Quelle: {title}",
  "goTo": "Zu {screen}",
  "email": "An {email} schreiben",
  "s_ajustes": "Einstellungen",
  "s_notificaciones": "Mitteilungseinstellungen",
  "s_sugerencias": "Ideen und Feedback",
  "s_tus_planes": "Deine Pläne",
  "s_mi_negocio": "Mein Geschäft",
  "s_alta_negocio": "Geschäft eintragen",
  "s_eliminar_cuenta": "Mein Konto löschen",
  "s_denunciar": "Melden"
 },
 "it": {
  "close": "Chiudi",
  "title": "Assistente di aiuto",
  "entry": "Chiedi all'assistente",
  "entryHint": "Un'IA che risponde con ciò che è pubblicato nell'Aiuto e nelle Regole",
  "introTitle": "Prima di iniziare: questa è un'IA",
  "introBody": "Questo assistente è un'intelligenza artificiale, non una persona. È Claude, di Anthropic, un'azienda statunitense. Risponde solo con ciò che è pubblicato nell'Aiuto e nelle Regole di Klendar e può sbagliare. Ciò che dice non vincola Klendar: vale ciò che è pubblicato e ciò che ti rispondiamo via e-mail.",
  "introPrivacy": "Non inserire dati personali. Ciò che scrivi va ad Anthropic per risponderti, senza il tuo nome né il tuo account, e togliamo le e-mail, i telefoni e i documenti d'identità che vediamo. Anthropic non lo usa per addestrare la sua IA e lo cancella entro 30 giorni; ciò che i suoi sistemi segnalano come grave può conservarlo fino a 2 anni. Klendar non conserva la conversazione: conta solo le domande.",
  "introEmergency": "In caso di emergenza, chiama il 112. In Spagna ci sono anche, gratis, il 024 (comportamento suicidario) e il 016 (violenza di genere). L'assistente non serve a questo.",
  "accept": "Ho capito, inizia",
  "notNow": "Non ora",
  "more": "Maggiori informazioni",
  "note": "È un'IA e può sbagliare. Ciò che dice non vincola Klendar. Non inserire dati personali.",
  "empty": "Chiedi quello che vuoi su Klendar, nella tua lingua.",
  "hint": "La tua domanda",
  "send": "Chiedi",
  "thinking": "Cerco in ciò che è pubblicato…",
  "you": "Tu",
  "redacted": "Abbiamo tolto dal tuo messaggio ciò che sembrava un dato personale.",
  "subject": "Domanda su Klendar",
  "attach": "Allega questa conversazione",
  "seeHelp": "Vedi l'Aiuto",
  "newChat": "Inizia un'altra conversazione",
  "errOffline": "Senza connessione non posso rispondere. Hai l'Aiuto e l'e-mail.",
  "errFailed": "Ora non posso rispondere. Hai l'Aiuto e l'e-mail.",
  "errClosed": "L'assistente non è disponibile ora. Hai l'Aiuto, con la sua ricerca, e l'e-mail.",
  "errDaily": "Hai raggiunto il massimo di domande di oggi. Hai l'Aiuto e l'e-mail.",
  "errTurns": "Hai raggiunto il massimo di domande di questa conversazione.",
  "errTooLong": "È troppo lungo. Chiedilo con meno parole.",
  "errShort": "Non capisco. Puoi scriverlo con un po’ più di dettagli?",
  "source": "Fonte: {title}",
  "goTo": "Vai a {screen}",
  "email": "Scrivi a {email}",
  "s_ajustes": "Impostazioni",
  "s_notificaciones": "Impostazioni delle notifiche",
  "s_sugerencias": "Idee e suggerimenti",
  "s_tus_planes": "I tuoi piani",
  "s_mi_negocio": "La mia attività",
  "s_alta_negocio": "Registra un’attività",
  "s_eliminar_cuenta": "Elimina il mio account",
  "s_denunciar": "Segnala"
 }
};
  var IDIOMAS = ['es', 'en', 'ca', 'gl', 'eu', 'fr', 'de', 'it'];
  var PANTALLAS = {
    ajustes: '/cuenta/ajustes', notificaciones: '/cuenta/ajustes/notificaciones', sugerencias: '/cuenta/sugerencias', tus_planes: '/cuenta/planes',
    mi_negocio: '/panel/', alta_negocio: '/alta/', eliminar_cuenta: '/eliminar-cuenta/', denunciar: '/cuenta/denunciar',
  };
  var CORREO = 'info@klendar.app';
  var PERMISO = 'klendar.asistente.permiso';

  function idioma() {
    var l = '';
    try { l = localStorage.getItem('klendar_lang') || ''; } catch (e) { /* sin permisos */ }
    l = (l || document.documentElement.lang || 'es').slice(0, 2).toLowerCase();
    return IDIOMAS.indexOf(l) >= 0 ? l : 'es';
  }
  var t = function (k, x) {
    var s = (T[idioma()] || T.es)[k] || T.es[k] || '';
    return x == null ? s : s.replace(/\{[a-z]+\}/, x);
  };

  // La misma config que el resto de la web, y solo si hace falta: las páginas públicas no la cargan.
  var configurando = null;
  function config() {
    if (window.KLENDAR_ENV && window.KLENDAR_ENV.url) return Promise.resolve(window.KLENDAR_ENV);
    if (configurando) return configurando;
    configurando = new Promise(function (bien, mal) {
      var s = document.createElement('script');
      s.src = '/config.js?v=4';
      s.onload = function () { return window.KLENDAR_ENV ? bien(window.KLENDAR_ENV) : mal(new Error('sin config')); };
      s.onerror = mal;
      document.head.appendChild(s);
    });
    return configurando;
  }

  /** El token de la sesión, si hay y no ha caducado. Sin él, como sin cuenta. */
  function token(env) {
    try {
      var ref = new URL(env.url).hostname.split('.')[0];
      var s = JSON.parse(localStorage.getItem('sb-' + ref + '-auth-token') || 'null');
      var tk = s && (s.access_token || (s.currentSession && s.currentSession.access_token));
      var fin = s && (s.expires_at || (s.currentSession && s.currentSession.expires_at));
      return tk && (!fin || fin > Date.now() / 1000 + 30) ? tk : null;
    } catch (e) { return null; }
  }

  function pide(ruta, cuerpo) {
    return config().then(function (env) {
      var h = { 'content-type': 'application/json', apikey: env.key };
      var tk = token(env);
      if (tk) h.authorization = 'Bearer ' + tk;
      return fetch(env.url + ruta, { method: 'POST', headers: h, body: JSON.stringify(cuerpo || {}) });
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  var estado = null;
  var estadoPedido = null;
  function miraEstado() {
    if (!estadoPedido) {
      estadoPedido = pide('/rest/v1/rpc/assistant_status').then(function (s) {
        estado = s && typeof s === 'object' ? s : { available: false };
        return estado;
      }).catch(function () {
        estado = { available: false };
        return estado;
      });
    }
    return estadoPedido;
  }

  function permisoLocal() {
    try { return localStorage.getItem(PERMISO) === '1'; } catch (e) { return memoria; }
  }
  var memoria = false;
  function daPermisoLocal() {
    memoria = true;
    try { localStorage.setItem(PERMISO, '1'); } catch (e) { /* solo esta visita */ }
  }
  var tienePermiso = function (s) { return s.signed_in ? s.consent === true : permisoLocal(); };

  // Pequeños ayudantes: todo con textContent.
  function el(tag, attrs, hijos) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'texto') n.textContent = attrs[k];
      else if (k === 'clic') n.addEventListener('click', attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (hijos || []).forEach(function (h) { if (h) n.appendChild(h); });
    return n;
  }

  var turnos = [];
  var dialogo = null;
  var aceptado = false;

  function cierra() { if (dialogo && dialogo.open) dialogo.close(); }

  // Las páginas publicadas están en dos idiomas: igual que `esOrEn` de la app.
  var enIngles = function () { return ['en', 'fr', 'de', 'it'].indexOf(idioma()) >= 0; };
  function ayudaUrl() { return enIngles() ? '/en/faq/' : '/preguntas/'; }

  /** El correo, con la conversación solo si la persona ha marcado la casilla. */
  function mailto(adjunta) {
    var p = 'subject=' + encodeURIComponent(t('subject'));
    if (adjunta && turnos.length) {
      var b = turnos.map(function (x) { return t('you') + ': ' + x.q + '\n' + t('title') + ': ' + x.a; }).join('\n\n');
      p += '&body=' + encodeURIComponent(b.slice(0, 1500));
    }
    return 'mailto:' + CORREO + '?' + p;
  }

  /** Lo que queda siempre: el correo y la Ayuda. */
  function salidas(conCasilla) {
    var correo = el('a', { class: 'asis-enlace', href: mailto(false), texto: t('email', CORREO) });
    var hijos = [];
    if (conCasilla && turnos.length) {
      var caja = el('input', { type: 'checkbox' });
      caja.addEventListener('change', function () { correo.href = mailto(caja.checked); });
      hijos.push(el('label', { class: 'asis-casilla' }, [caja, el('span', { texto: t('attach') })]));
    }
    hijos.push(correo);
    hijos.push(el('a', { class: 'asis-enlace', href: ayudaUrl(), texto: t('seeHelp') }));
    return el('div', { class: 'asis-salidas' }, hijos);
  }

  function pintaAviso(cuerpo) {
    cuerpo.textContent = '';
    var titulo = el('h2', { id: 'asis-titulo-aviso', texto: t('introTitle') });
    var entra = el('button', {
      type: 'button', class: 'pill accent', texto: t('accept'),
      clic: function () {
        entra.disabled = true;
        (estado.signed_in
          ? pide('/rest/v1/rpc/set_ai_consent', { p_granted: true, p_use: 'help_assistant' }).then(function () { estado.consent = true; estado.asked = true; })
          : Promise.resolve(daPermisoLocal()))
          .then(function () {
            aceptado = true;
            pintaChat(cuerpo);
          })
          .catch(function () {
            entra.disabled = false;
            pintaCerrado(cuerpo, 'failed');
          });
      },
    });
    cuerpo.append(
      titulo,
      el('p', { texto: t('introBody') }),
      el('p', { texto: t('introPrivacy') }),
      el('p', { texto: t('introEmergency') }),
      el('p', {}, [el('a', { href: enIngles() ? '/en/privacy/' : '/privacidad/', target: '_blank', rel: 'noopener', texto: t('more') })]),
      el('div', { class: 'asis-botones' }, [entra, el('button', { type: 'button', class: 'pill', texto: t('notNow'), clic: cierra })])
    );
    entra.focus();
  }

  function textoError(code) {
    return t({ offline: 'errOffline', daily: 'errDaily', turns: 'errTurns', too_long: 'errTooLong', short: 'errShort', off: 'errClosed', cap: 'errClosed' }[code] || 'errFailed');
  }

  function pintaCerrado(cuerpo, code) {
    cuerpo.textContent = '';
    cuerpo.append(el('p', { role: 'status', texto: textoError(code) }), salidas(false));
  }

  function pintaChat(cuerpo) {
    cuerpo.textContent = '';
    var max = estado.max_turns || 6;
    var log = el('div', { class: 'asis-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', tabindex: '0' });
    var campo = el('textarea', { id: 'asis-q', rows: '2', maxlength: String(estado.max_chars || 500), autocomplete: 'off' });
    var manda = el('button', { type: 'submit', class: 'pill accent', texto: t('send') });
    var form = el('form', { class: 'asis-form' }, [el('label', { for: 'asis-q', texto: t('hint') }), campo, manda]);
    cuerpo.append(el('p', { class: 'asis-nota', texto: t('note') }), log, form);
    if (!turnos.length) log.append(el('p', { class: 'asis-vacio', texto: t('empty') }));
    turnos.forEach(function (x) { pintaTurno(log, x); });

    var limite = function () {
      if (turnos.length < max) return false;
      form.hidden = true;
      log.append(el('p', { role: 'status', texto: t('errTurns') }), el('button', {
        type: 'button', class: 'pill', texto: t('newChat'),
        clic: function () { turnos = []; pintaChat(cuerpo); },
      }), salidas(true));
      return true;
    };
    limite();

    campo.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = campo.value.trim();
      if (!q || manda.disabled) return;
      var vacio = log.querySelector('.asis-vacio');
      if (vacio) vacio.remove();
      log.querySelectorAll('.asis-salidas').forEach(function (x) { x.remove(); });
      log.append(el('p', { class: 'asis-q', texto: q }));
      var espera = el('p', { class: 'asis-espera' }, [el('span', { class: 'mov-ocupado asis-aguja', 'aria-hidden': 'true' }), el('span', { class: 'asis-lector', texto: t('thinking') })]);
      log.append(espera);
      log.scrollTop = log.scrollHeight;
      manda.disabled = true;
      manda.classList.add('mov-ocupado');
      campo.disabled = true;
      pide('/functions/v1/help-assistant', {
        question: q, platform: 'web', lang: idioma(), consent: estado.signed_in ? undefined : permisoLocal(),
        history: turnos.map(function (x) { return { q: x.q, a: x.a }; }),
      }).then(function (r) {
        espera.remove();
        if (!r || r.ok !== true) throw Object.assign(new Error('no'), { code: (r && r.why) || 'failed' });
        var x = { q: q, a: r.text || '', r: r };
        turnos.push(x);
        pintaRespuesta(log, r);
        campo.value = '';
        if (!limite() && r.email) log.append(salidas(true));
      }).catch(function (e) {
        espera.remove();
        var code = e && e.code ? e.code : (navigator.onLine === false ? 'offline' : 'failed');
        log.append(el('p', { role: 'status', class: 'asis-error', texto: textoError(code) }), salidas(true));
      }).then(function () {
        manda.disabled = false;
        manda.classList.remove('mov-ocupado');
        campo.disabled = false;
        log.scrollTop = log.scrollHeight;
        if (!form.hidden) campo.focus();
      });
    });
    if (!form.hidden) campo.focus();
  }

  function pintaTurno(log, x) {
    log.append(el('p', { class: 'asis-q', texto: x.q }));
    pintaRespuesta(log, x.r);
  }

  function pintaRespuesta(log, r) {
    var hijos = [el('p', { texto: r.text || '' })];
    if (r.redacted) hijos.push(el('p', { class: 'asis-nota', texto: t('redacted') }));
    (r.sources || []).forEach(function (s) {
      // Solo direcciones de la casa, por muy comprobado que venga.
      if (s.url && /^\/[a-z]/.test(s.url)) hijos.push(el('a', { class: 'asis-enlace', href: s.url, target: '_blank', rel: 'noopener', texto: t('source', s.title) }));
    });
    if (r.screen && PANTALLAS[r.screen]) {
      var dir = r.screen === 'eliminar_cuenta' && enIngles() ? '/en/delete-account/' : PANTALLAS[r.screen];
      hijos.push(el('a', { class: 'asis-enlace', href: dir, target: '_blank', rel: 'noopener', texto: t('goTo', t('s_' + r.screen)) }));
    }
    log.append(el('div', { class: 'asis-a' }, hijos));
  }

  function abre() {
    if (!dialogo) {
      var cuerpo = el('div', { class: 'asis-cuerpo' });
      var x = el('button', { type: 'button', class: 'asis-x', 'aria-label': t('close'), texto: '×', clic: cierra });
      dialogo = el('dialog', { class: 'asis', 'aria-labelledby': 'asis-titulo' }, [
        el('div', { class: 'asis-cabeza' }, [el('h1', { id: 'asis-titulo', texto: t('title') }), x]),
        cuerpo,
      ]);
      document.body.appendChild(dialogo);
    }
    var c = dialogo.querySelector('.asis-cuerpo');
    dialogo.showModal();
    // Se mira otra vez: puede haberse acabado el tope o haber cerrado sesión.
    estadoPedido = null;
    miraEstado().then(function (s) {
      if (!s.available && !turnos.length) return pintaCerrado(c, 'off');
      if (!aceptado && !tienePermiso(s)) return pintaAviso(c);
      return pintaChat(c);
    });
  }

  function monta() {
    var huecos = document.querySelectorAll('[data-asistente]');
    if (!huecos.length) return;
    miraEstado().then(function (s) {
      if (!s.available) return;
      huecos.forEach(function (h) {
        if (h.firstChild) { h.hidden = false; return; }
        h.append(el('button', { type: 'button', class: 'asis-entrada', clic: abre }, [
          el('b', { texto: t('entry') }),
          el('span', { texto: t('entryHint') }),
        ]));
        h.hidden = false;
      });
    });
  }

  window.KL_ASISTENTE = { monta: monta };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta);
  else monta();
})();
