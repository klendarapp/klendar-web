// La dirección de «Tu cuenta»: /cuenta, /cuenta/favoritos, /cuenta/entrar?siguiente=planes…
// Es una sola página (y un solo sitio para los ocho idiomas, como el panel):
// el idioma va en `?lang=` y solo hace falta decirlo para el inglés, porque
// quien entra desde una ficha inglesa tiene que seguir en inglés.
//
// El `lang` va el primero: `enlaceCuenta('en', 'grupos/pedir?b=')` deja listo
// `…?lang=en&b=` para pegarle detrás los ids.
export function enlaceCuenta(lang, ruta = '') {
  const i = ruta.indexOf('?');
  const camino = i < 0 ? ruta : ruta.slice(0, i);
  const qs = i < 0 ? '' : ruta.slice(i + 1);
  // Sin barra al final (11-11): «Tu cuenta» a secas es `/cuenta`.
  const base = camino ? `/cuenta/${camino}` : '/cuenta';
  if (lang !== 'en') return qs ? `${base}?${qs}` : base;
  return qs ? `${base}?lang=en&${qs}` : `${base}?lang=en`;
}
