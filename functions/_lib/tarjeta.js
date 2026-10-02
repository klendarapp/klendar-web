// La tarjeta de una publicación (oferta flash o evento): UNA para toda la web.
//
// La lógica vive en `assets/tarjeta.js` (script que también carga el panel
// del negocio en el navegador, para que «Tus publicaciones», su calendario y
// la vista previa del formulario sean la misma tarjeta que ve la gente).
// Aquí solo se reexporta para las Pages Functions. Los estilos: `assets/tarjeta.css`.

import '../../assets/zona.js';
import KT from '../../assets/tarjeta.js';

export const {
  PLANTILLAS, tarjeta, rejilla, distancia, colorSeguro, estiloDe, sobreAcento, plataformaEntradas, sitioDe, cuandoCorto,
} = KT;
