// «El sitio»: cómo es el local (terraza, bajo techo, apto para niños…).
//
// Los mismos 17 atributos que la app y la base (`place_attribute_slugs()`),
// en el mismo orden, con su nombre en los dos idiomas y su icono de Material
// Symbols en SVG (las páginas públicas no cargan la fuente de iconos). Los
// trazados salen de la propia fuente (Material Symbols Outlined v374, opsz 24,
// wght 400; Apache 2.0), por eso van en `viewBox="0 -960 960 960"`. Los de
// «Alérgenos y dietas» (migración 20261210100000), de Material Icons (los
// mismos que la app: spa, grain, verified_user, local_drink, restaurant), van
// en `viewBox="0 0 24 24"` (`vb: 24`).
//
// Lo usan la ficha del negocio y la de la publicación (views.js) y la hoja de
// filtros de Descubre y Explorar (explore.js). El panel y el admin tienen su
// lista propia (pintan los iconos con la fuente).

import { esc } from './page.js';

export const SITIO = [
  { id: 'terrace', es: 'Terraza', en: 'Terrace', icon: 'deck',
    d: 'M440 -80V-600H80L480 -880L880 -600H520V-80ZM480 -680H626H334ZM120 -80V-290L88 -466L166 -480L196 -320H360V-80H280V-240H200V-80ZM600 -80V-320H764L794 -480L872 -466L840 -290V-80H760V-240H680V-80ZM334 -680H626L480 -782Z' },
  { id: 'indoor', es: 'Bajo techo', en: 'Indoor', icon: 'roofing',
    d: 'M360 -160V-400H600V-160ZM440 -240H520V-320H440ZM88 -440 40 -504 480 -840 640 -718V-800H760V-626L920 -504L872 -440L480 -739ZM480 -280Z' },
  { id: 'outdoor', es: 'Al aire libre', en: 'Outdoors', icon: 'park',
    d: 'M558 -80H402V-240H120L280 -480H200L480 -880L760 -480H680L840 -240H558ZM270 -320H430H354H480H606H530H690ZM270 -320H690L530 -560H606L480 -740L354 -560H430Z' },
  { id: 'kids', es: 'Apto para niños', en: 'Child-friendly', icon: 'child_friendly',
    d: 'M280 -140Q280 -166 297 -183Q314 -200 340 -200Q366 -200 383 -183Q400 -166 400 -140Q400 -114 383 -97Q366 -80 340 -80Q314 -80 297 -97Q280 -114 280 -140ZM720 -140Q720 -166 737 -183Q754 -200 780 -200Q806 -200 823 -183Q840 -166 840 -140Q840 -114 823 -97Q806 -80 780 -80Q754 -80 737 -97Q720 -114 720 -140ZM540 -656 384 -844Q420 -862 462 -871Q504 -880 552 -880Q603 -880 649.5 -865.5Q696 -851 732 -824ZM480 -240Q397 -240 338.5 -298.5Q280 -357 280 -440V-748L260 -772Q246 -789 236.5 -794.5Q227 -800 216 -800Q192 -800 176 -782Q160 -764 160 -740H80Q80 -797 119.5 -838.5Q159 -880 216 -880Q246 -880 271 -866Q296 -852 322 -822L750 -306Q767 -286 756.5 -263Q746 -240 720 -240ZM480 -320H634L360 -652V-440Q360 -390 395 -355Q430 -320 480 -320ZM497 -486Q497 -486 497 -486Q497 -486 497 -486Z' },
  { id: 'play_area', es: 'Zona infantil', en: 'Play area', icon: 'toys',
    d: 'M280 -160Q235 -160 201.5 -188.5Q168 -217 162 -262Q124 -282 102 -319Q80 -356 80 -400Q80 -453 110.5 -494.5Q141 -536 192 -552L120 -624L108 -612Q97 -601 80 -601Q63 -601 52 -612Q41 -623 41 -640Q41 -657 52 -668L132 -748Q143 -759 160 -759Q177 -759 188 -748Q199 -737 199 -720Q199 -703 188 -692L176 -680L232 -624L264 -718Q276 -755 307.5 -777.5Q339 -800 378 -800H582Q621 -800 652.5 -777.5Q684 -755 696 -718L750 -556Q807 -545 843.5 -501Q880 -457 880 -400Q880 -356 858 -319Q836 -282 798 -262Q792 -217 758.5 -188.5Q725 -160 680 -160Q642 -160 611.5 -182Q581 -204 568 -240H392Q379 -204 348.5 -182Q318 -160 280 -160ZM296 -560H440V-720H378Q365 -720 355 -712.5Q345 -705 340 -692ZM520 -560H664L620 -692Q615 -705 605 -712.5Q595 -720 582 -720H520ZM392 -320H568Q581 -356 611.5 -378Q642 -400 680 -400Q710 -400 736 -386Q762 -372 780 -348Q789 -359 794.5 -372.5Q800 -386 800 -400Q800 -433 776.5 -456.5Q753 -480 720 -480H240Q207 -480 183.5 -456.5Q160 -433 160 -400Q160 -386 165.5 -372.5Q171 -359 180 -348Q198 -372 224 -386Q250 -400 280 -400Q318 -400 348.5 -378Q379 -356 392 -320ZM280 -240Q297 -240 308.5 -251.5Q320 -263 320 -280Q320 -297 308.5 -308.5Q297 -320 280 -320Q263 -320 251.5 -308.5Q240 -297 240 -280Q240 -263 251.5 -251.5Q263 -240 280 -240ZM680 -240Q697 -240 708.5 -251.5Q720 -263 720 -280Q720 -297 708.5 -308.5Q697 -320 680 -320Q663 -320 651.5 -308.5Q640 -297 640 -280Q640 -263 651.5 -251.5Q663 -240 680 -240ZM480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Q480 -400 480 -400Z' },
  { id: 'dogs', es: 'Admite perros', en: 'Dogs welcome', icon: 'pets',
    d: 'M180 -475Q138 -475 109 -504Q80 -533 80 -575Q80 -617 109 -646Q138 -675 180 -675Q222 -675 251 -646Q280 -617 280 -575Q280 -533 251 -504Q222 -475 180 -475ZM360 -835Q402 -835 431 -806Q460 -777 460 -735Q460 -693 431 -664Q402 -635 360 -635Q318 -635 289 -664Q260 -693 260 -735Q260 -777 289 -806Q318 -835 360 -835ZM500 -735Q500 -777 529 -806Q558 -835 600 -835Q642 -835 671 -806Q700 -777 700 -735Q700 -693 671 -664Q642 -635 600 -635Q558 -635 529 -664Q500 -693 500 -735ZM780 -475Q738 -475 709 -504Q680 -533 680 -575Q680 -617 709 -646Q738 -675 780 -675Q822 -675 851 -646Q880 -617 880 -575Q880 -533 851 -504Q822 -475 780 -475ZM266 -75Q221 -75 190.5 -109.5Q160 -144 160 -191Q160 -243 195.5 -282Q231 -321 266 -359Q295 -390 316 -426.5Q337 -463 366 -495Q388 -521 417 -538Q446 -555 480 -555Q514 -555 543 -539Q572 -523 594 -497Q622 -465 643.5 -428Q665 -391 694 -359Q729 -321 764.5 -282Q800 -243 800 -191Q800 -144 769.5 -109.5Q739 -75 694 -75Q640 -75 587 -84Q534 -93 480 -93Q426 -93 373 -84Q320 -75 266 -75Z' },
  { id: 'wheelchair', es: 'Accesible en silla de ruedas', en: 'Wheelchair accessible', icon: 'accessible',
    d: 'M400 -800Q400 -833 423.5 -856.5Q447 -880 480 -880Q513 -880 536.5 -856.5Q560 -833 560 -800Q560 -767 536.5 -743.5Q513 -720 480 -720Q447 -720 423.5 -743.5Q400 -767 400 -800ZM680 -80V-280Q680 -280 680 -280Q680 -280 680 -280H480Q447 -280 423.5 -303.5Q400 -327 400 -360V-600Q400 -633 423.5 -656.5Q447 -680 480 -680Q504 -680 521.5 -669.5Q539 -659 559 -636Q614 -570 658.5 -545.5Q703 -521 760 -520V-440Q707 -440 653 -463Q599 -486 560 -518V-380H680Q713 -380 736.5 -356.5Q760 -333 760 -300V-80ZM400 -80Q317 -80 258.5 -138.5Q200 -197 200 -280Q200 -352 245.5 -407Q291 -462 360 -476V-394Q325 -380 302.5 -349.5Q280 -319 280 -280Q280 -230 315 -195Q350 -160 400 -160Q439 -160 469.5 -182.5Q500 -205 514 -240H596Q582 -171 527 -125.5Q472 -80 400 -80Z' },
  { id: 'wifi', es: 'Wifi', en: 'Wi-Fi', icon: 'wifi',
    d: 'M480 -120Q438 -120 409 -149Q380 -178 380 -220Q380 -262 409 -291Q438 -320 480 -320Q522 -320 551 -291Q580 -262 580 -220Q580 -178 551 -149Q522 -120 480 -120ZM254 -346 170 -432Q229 -491 308.5 -525.5Q388 -560 480 -560Q572 -560 651.5 -525Q731 -490 790 -430L706 -346Q662 -390 604 -415Q546 -440 480 -440Q414 -440 356 -415Q298 -390 254 -346ZM84 -516 0 -600Q92 -694 215 -747Q338 -800 480 -800Q622 -800 745 -747Q868 -694 960 -600L876 -516Q799 -593 697.5 -636.5Q596 -680 480 -680Q364 -680 262.5 -636.5Q161 -593 84 -516Z' },
  { id: 'card', es: 'Pago con tarjeta', en: 'Card payments', icon: 'credit_card',
    d: 'M880 -720V-240Q880 -207 856.5 -183.5Q833 -160 800 -160H160Q127 -160 103.5 -183.5Q80 -207 80 -240V-720Q80 -753 103.5 -776.5Q127 -800 160 -800H800Q833 -800 856.5 -776.5Q880 -753 880 -720ZM160 -640H800V-720Q800 -720 800 -720Q800 -720 800 -720H160Q160 -720 160 -720Q160 -720 160 -720ZM160 -480V-240Q160 -240 160 -240Q160 -240 160 -240H800Q800 -240 800 -240Q800 -240 800 -240V-480ZM160 -240Q160 -240 160 -240Q160 -240 160 -240V-720Q160 -720 160 -720Q160 -720 160 -720Q160 -720 160 -720Q160 -720 160 -720V-240Q160 -240 160 -240Q160 -240 160 -240Z' },
  { id: 'air_conditioning', es: 'Aire acondicionado', en: 'Air conditioning', icon: 'ac_unit',
    d: 'M440 -80V-246L310 -118L254 -174L440 -360V-440H360L174 -254L118 -310L246 -440H80V-520H246L118 -650L174 -706L360 -520H440V-600L254 -786L310 -842L440 -714V-880H520V-714L650 -842L706 -786L520 -600V-520H600L786 -706L842 -650L714 -520H880V-440H714L842 -310L786 -254L600 -440H520V-360L706 -174L650 -118L520 -246V-80Z' },
  { id: 'parking', es: 'Aparcamiento', en: 'Parking', icon: 'local_parking',
    d: 'M240 -120V-840H520Q620 -840 690 -770Q760 -700 760 -600Q760 -500 690 -430Q620 -360 520 -360H400V-120ZM400 -520H528Q561 -520 584.5 -543.5Q608 -567 608 -600Q608 -633 584.5 -656.5Q561 -680 528 -680H400Z' },
  { id: 'veggie', es: 'Opciones vegetarianas', en: 'Vegetarian options', icon: 'eco',
    d: 'M216 -176Q171 -221 145.5 -280Q120 -339 120 -402Q120 -465 144 -526.5Q168 -588 222 -642Q257 -677 308.5 -702Q360 -727 430.5 -741.5Q501 -756 591.5 -759Q682 -762 794 -752Q802 -646 799 -557Q796 -468 782.5 -396.5Q769 -325 744.5 -271.5Q720 -218 684 -182Q631 -129 571.5 -104.5Q512 -80 450 -80Q385 -80 323 -105.5Q261 -131 216 -176ZM328 -192Q357 -175 387.5 -167.5Q418 -160 450 -160Q496 -160 541 -178.5Q586 -197 627 -238Q645 -256 663.5 -288.5Q682 -321 695.5 -373.5Q709 -426 716 -500.5Q723 -575 718 -678Q669 -680 607.5 -679.5Q546 -679 485 -670Q424 -661 369 -641Q314 -621 279 -586Q234 -541 217 -497Q200 -453 200 -412Q200 -353 222.5 -308.5Q245 -264 262 -246Q304 -326 373 -399.5Q442 -473 534 -520Q462 -457 408.5 -377.5Q355 -298 328 -192ZM328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192ZM328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Q328 -192 328 -192Z' },
  // Alérgenos y dietas: lo declara el negocio (van aparte, con su nota).
  { id: 'vegan', es: 'Opciones veganas', en: 'Vegan options', icon: 'spa', vb: 24,
    d: 'M15.47 9.61C15.33 6.84 14.2 4.12 12.05 2.02C9.94 4.12 8.72 6.84 8.53 9.61C9.8 10.31 10.97 11.2 12 12.28C13.03 11.2 14.2 10.31 15.47 9.61ZM12.05 5.2C12.7 6.23 13.12 7.36 13.36 8.58C12.89 8.86 12.42 9.19 12 9.56C11.58 9.19 11.16 8.86 10.69 8.58C10.92 7.36 11.39 6.23 12.05 5.2ZM12 15.47C11.2 14.2 10.12 13.12 8.95 12.23C8.81 12.14 8.67 12.09 8.53 12C8.67 12.09 8.81 12.14 8.95 12.23C6.98 10.83 4.59 9.98 2.02 9.98C2.02 15.33 5.34 19.83 10.03 21.47C10.64 21.7 11.3 21.89 12 21.98C12.7 21.89 13.31 21.7 13.97 21.47C18.66 19.83 21.98 15.33 21.98 9.98C17.81 9.98 14.16 12.19 12 15.47ZM13.31 19.59C12.89 19.73 12.42 19.88 12 19.97C11.53 19.88 11.11 19.78 10.69 19.59C7.41 18.42 5.02 15.61 4.27 12.28C5.34 12.52 6.42 12.98 7.36 13.59C7.5 13.69 7.64 13.78 7.73 13.83L7.83 13.88C8.81 14.62 9.66 15.52 10.31 16.55L12 19.08L13.69 16.55C14.34 15.52 15.23 14.58 16.22 13.88L16.27 13.83C16.36 13.78 16.45 13.73 16.55 13.69V13.64C17.53 12.98 18.61 12.52 19.73 12.23C18.98 15.61 16.59 18.42 13.31 19.59ZM9 12.28C8.95 12.28 8.95 12.23 8.95 12.23C8.95 12.28 8.95 12.28 9 12.28Z' },
  { id: 'gluten_free', es: 'Opciones sin gluten', en: 'Gluten-free options', icon: 'grain', vb: 24,
    d: 'M9.98 12C8.91 12 8.02 12.89 8.02 14.02C8.02 15.09 8.91 15.98 9.98 15.98C11.11 15.98 12 15.09 12 14.02C12 12.89 11.11 12 9.98 12ZM6 8.02C4.92 8.02 3.98 8.91 3.98 9.98C3.98 11.11 4.92 12 6 12C7.08 12 8.02 11.11 8.02 9.98C8.02 8.91 7.08 8.02 6 8.02ZM6 15.98C4.92 15.98 3.98 16.92 3.98 18C3.98 19.08 4.92 20.02 6 20.02C7.08 20.02 8.02 19.08 8.02 18C8.02 16.92 7.08 15.98 6 15.98ZM18 8.02C19.08 8.02 20.02 7.08 20.02 6C20.02 4.92 19.08 3.98 18 3.98C16.92 3.98 15.98 4.92 15.98 6C15.98 7.08 16.92 8.02 18 8.02ZM14.02 15.98C12.89 15.98 12 16.92 12 18C12 19.08 12.89 20.02 14.02 20.02C15.09 20.02 15.98 19.08 15.98 18C15.98 16.92 15.09 15.98 14.02 15.98ZM18 12C16.92 12 15.98 12.89 15.98 14.02C15.98 15.09 16.92 15.98 18 15.98C19.08 15.98 20.02 15.09 20.02 14.02C20.02 12.89 19.08 12 18 12ZM14.02 8.02C12.89 8.02 12 8.91 12 9.98C12 11.11 12.89 12 14.02 12C15.09 12 15.98 11.11 15.98 9.98C15.98 8.91 15.09 8.02 14.02 8.02ZM9.98 3.98C8.91 3.98 8.02 4.92 8.02 6C8.02 7.08 8.91 8.02 9.98 8.02C11.11 8.02 12 7.08 12 6C12 4.92 11.11 3.98 9.98 3.98Z' },
  { id: 'celiac', es: 'Apto para celíacos', en: 'Coeliac-friendly', icon: 'verified_user', vb: 24,
    d: 'M12 0.98 3 5.02V11.02C3 16.55 6.84 21.75 12 23.02C17.16 21.75 21 16.55 21 11.02V5.02L12 0.98ZM18.98 11.02C18.98 15.52 16.03 19.69 12 20.95C7.97 19.69 5.02 15.52 5.02 11.02V6.28L12 3.19L18.98 6.28V11.02ZM7.41 11.58 6 12.98 9.98 17.02 18 9 16.59 7.59 9.98 14.16 7.41 11.58Z' },
  { id: 'lactose_free', es: 'Opciones sin lactosa', en: 'Lactose-free options', icon: 'local_drink', vb: 24,
    d: 'M3 2.02 5.02 20.25C5.11 21.23 5.95 21.98 6.98 21.98H17.02C18.05 21.98 18.89 21.23 18.98 20.25L21 2.02H3ZM17.02 20.02H6.98L5.91 9.98H18.09L17.02 20.02ZM18.33 8.02H5.67L5.25 3.98H18.75L18.33 8.02ZM12 18.98C13.64 18.98 15 17.67 15 15.98C15 14.02 12 10.59 12 10.59C12 10.59 9 14.02 9 15.98C9 17.67 10.36 18.98 12 18.98ZM12 13.92C12.61 14.81 12.98 15.66 12.98 15.98C12.98 16.55 12.56 17.02 12 17.02C11.44 17.02 11.02 16.55 11.02 15.98C11.02 15.61 11.39 14.81 12 13.92Z' },
  { id: 'halal', es: 'Halal', en: 'Halal', icon: 'restaurant', vb: 24,
    d: 'M15.98 6V14.02H18.98V21.98H21V2.02C18.23 2.02 15.98 4.22 15.98 6ZM11.02 9H9V2.02H6.98V9H5.02V2.02H3V9C3 11.2 4.78 12.98 6.98 12.98V21.98H9V12.98C11.2 12.98 12.98 11.2 12.98 9V2.02H11.02V9Z' },
];

const POR_ID = Object.fromEntries(SITIO.map((s) => [s.id, s]));
export const SITIO_IDS = SITIO.map((s) => s.id);

/** El nombre de un atributo en el idioma de la página. */
export const nombreSitio = (id, en) => (POR_ID[id] ? POR_ID[id][en ? 'en' : 'es'] : '');

/** En la dirección, en el idioma de la página (`?sitio=terraza`). */
export const SITIO_ES = {
  terrace: 'terraza', indoor: 'bajo-techo', outdoor: 'aire-libre', kids: 'ninos', play_area: 'zona-infantil',
  dogs: 'perros', wheelchair: 'silla-de-ruedas', wifi: 'wifi', card: 'tarjeta', air_conditioning: 'aire-acondicionado',
  parking: 'aparcamiento', veggie: 'vegetariano', vegan: 'vegano', gluten_free: 'sin-gluten', celiac: 'celiacos',
  lactose_free: 'sin-lactosa', halal: 'halal',
};
const DESDE_ES = Object.fromEntries(Object.entries(SITIO_ES).map(([k, v]) => [v, k]));
/** Un valor de la dirección (en cualquiera de los dos idiomas) → identificador, o ''. */
export const sitioDeUrl = (v) => {
  const s = String(v || '').trim().toLowerCase();
  return POR_ID[s] ? s : DESDE_ES[s] || '';
};
export const sitioAUrl = (id, en) => (en ? id : SITIO_ES[id] || id);

/** Lo que tiene sentido en la ficha de una publicación (un plan): si es para
 * niños, dónde es y si se puede ir con el perro o en silla de ruedas. El wifi
 * o el aparcamiento son cosa del local (su ficha). */
export const SITIO_PLAN = ['kids', 'play_area', 'indoor', 'outdoor', 'terrace', 'dogs', 'wheelchair'];

/** Alérgenos y dietas: van en su propio grupo (en «Cómo es tu local», en
 * los filtros y en la ficha, con la nota de que lo declara el negocio). */
export const DIETAS = ['veggie', 'vegan', 'gluten_free', 'celiac', 'lactose_free', 'halal'];
export const esDieta = (id) => DIETAS.includes(id);

/** El icono de un atributo, en SVG. */
export const icSitio = (id, size = 18) => (POR_ID[id]
  ? `<svg class="ic" viewBox="${POR_ID[id].vb === 24 ? '0 0 24 24' : '0 -960 960 960'}" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${POR_ID[id].d}"/></svg>`
  : '');

/** Iconos del tiempo (umbrella y sunny, de la misma fuente). */
const TIEMPO = {
  rain: 'M442 -107 240 -717 380 -683 440 -729V-824Q440 -864 469 -892Q498 -920 540 -920Q582 -920 611 -892Q640 -864 640 -824V-800H560V-824Q560 -832 554 -837.5Q548 -843 540 -843Q532 -843 526 -837.5Q520 -832 520 -824V-729L580 -683L720 -717L518 -108Q513 -94 502.5 -87Q492 -80 480 -80Q468 -80 457.5 -86.5Q447 -93 442 -107ZM520 -368 598 -606 562 -597 520 -628ZM440 -368V-628L398 -596L361 -606Z',
  sun: 'M440 -760V-920H520V-760ZM706 -650 651 -705 763 -820 819 -763ZM760 -440V-520H920V-440ZM440 -40V-200H520V-40ZM254 -652 140 -763 197 -819 310 -706ZM762 -140 651 -255 705 -309 819 -199ZM40 -440V-520H200V-440ZM197 -140 141 -197 253 -309 282 -282 311 -254ZM480 -240Q380 -240 310 -310Q240 -380 240 -480Q240 -580 310 -650Q380 -720 480 -720Q580 -720 650 -650Q720 -580 720 -480Q720 -380 650 -310Q580 -240 480 -240ZM480 -320Q546 -320 593 -367Q640 -414 640 -480Q640 -546 593 -593Q546 -640 480 -640Q414 -640 367 -593Q320 -546 320 -480Q320 -414 367 -367Q414 -320 480 -320ZM480 -480Q480 -480 480 -480Q480 -480 480 -480Q480 -480 480 -480Q480 -480 480 -480Q480 -480 480 -480Q480 -480 480 -480Q480 -480 480 -480Q480 -480 480 -480Z',
};
export const icTiempo = (c, size = 18) => (TIEMPO[c]
  ? `<svg class="ic" viewBox="0 -960 960 960" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="${TIEMPO[c]}"/></svg>`
  : '');

/** Solo los identificadores buenos, sin repetir y en el orden de siempre. */
export const ordenaSitio = (ids) => {
  const set = new Set((Array.isArray(ids) ? ids : []).map(String));
  return SITIO_IDS.filter((id) => set.has(id));
};

/** La lista con icono y nombre (`<ul class="sitio">`), o '' si no hay nada. */
export function listaSitio(ids, lang, { cls = '' } = {}) {
  const en = lang === 'en';
  const buenos = ordenaSitio(ids);
  if (!buenos.length) return '';
  return `<ul class="sitio${cls ? ` ${cls}` : ''}">${buenos.map((id) => `<li>${icSitio(id, 18)}<span>${esc(nombreSitio(id, en))}</span></li>`).join('')}</ul>`;
}

/** «El sitio» de la ficha del negocio: lo del local y, aparte, «Alérgenos y
 * dietas» con su nota (lo declara el negocio). '' si no hay nada. */
export function sitioFicha(ids, lang) {
  const en = lang === 'en';
  const buenos = ordenaSitio(ids);
  const local = listaSitio(buenos.filter((id) => !esDieta(id)), lang);
  const dietas = listaSitio(buenos.filter(esDieta), lang);
  if (!local && !dietas) return '';
  return `${local}${dietas ? `<h3 class="sitio-dietas-t">${en ? 'Allergens and diets' : 'Alérgenos y dietas'}</h3>${dietas}
    <p class="note sitio-dietas-nota">${en ? 'Allergens and diets: declared by the business. If you have an allergy or coeliac disease, check with the venue.'
    : 'Alérgenos y dietas: lo declara el negocio. Si tienes alergia o celiaquía, confírmalo en el local.'}</p>` : ''}`;
}
