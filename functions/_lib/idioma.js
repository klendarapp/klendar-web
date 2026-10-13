// El idioma de las páginas públicas: solo hay español e inglés.
//
// «Tu cuenta» y el panel están en ocho idiomas, pero las páginas públicas
// (landing, legales, fichas, agenda…) solo en dos. Quien navega en francés,
// alemán o italiano entiende mejor el inglés; en catalán, gallego o euskera,
// el español. La misma regla que `esOEn` de /assets/i18n.js.

const NUESTROS = ['es', 'en', 'ca', 'gl', 'eu', 'fr', 'de', 'it'];

/** 'en' para inglés, francés, alemán e italiano; 'es' para lo demás. */
export const esOEn = (lang) => (/^(en|fr|de|it)$/.test(String(lang || '').toLowerCase()) ? 'en' : 'es');

/**
 * La versión ('es' | 'en') para una cabecera Accept-Language: la del primero
 * de sus idiomas (por orden de preferencia) que sea uno de los nuestros
 * («pt-BR, en;q=0.8» → inglés; «ca, en;q=0.5» → español); sin ninguno,
 * español.
 */
export function idiomaDeCabecera(al) {
  const lista = String(al || '').split(',').map((x, i) => {
    const [tag, ...ps] = x.trim().split(';');
    const q = ps.map((p) => p.trim()).find((p) => p.startsWith('q='));
    return { l: tag.trim().toLowerCase().split(/[-_]/)[0], q: q ? Number(q.slice(2)) || 0 : 1, i };
  }).filter((x) => x.l && x.q > 0).sort((a, b) => b.q - a.q || a.i - b.i);
  const nuestro = lista.find((x) => NUESTROS.includes(x.l));
  return nuestro ? esOEn(nuestro.l) : 'es';
}
