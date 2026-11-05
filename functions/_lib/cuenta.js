// La dirección de «Tu cuenta»: /cuenta/, /cuenta/favoritos, /cuenta/entrar?siguiente=planes…
// Es una sola página (y un solo sitio para los ocho idiomas, como el panel):
// el idioma va en `?lang=` y solo hace falta decirlo para el inglés, porque
// quien entra desde una ficha inglesa tiene que seguir en inglés.
//
// El `lang` va el primero: `enlaceCuenta('en', 'grupos/pedir?b=')` deja listo
// `…?lang=en&b=` para pegarle detrás los ids.
export function enlaceCuenta(lang, ruta = '') {
  if (lang !== 'en') return `/cuenta/${ruta}`;
  const i = ruta.indexOf('?');
  return i < 0 ? `/cuenta/${ruta}?lang=en` : `/cuenta/${ruta.slice(0, i)}?lang=en&${ruta.slice(i + 1)}`;
}
