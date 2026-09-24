import { offerPage } from '../_lib/views.js';

// Punto de entrada: la página la arma `_lib/views.js`, aquí solo se dice
// cuál y en qué idioma. La versión en el otro idioma vive en la ruta gemela.

export const onRequestGet = ({ params }) => offerPage(params.id, 'es');
