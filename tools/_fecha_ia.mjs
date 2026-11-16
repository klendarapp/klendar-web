// La fecha de los textos de las funciones con IA (legal_ia.py, IA_DESDE) para
// las pruebas legales. Las pruebas de antes (legal_*_check.mjs) comprueban la
// cabecera «Última actualización» de lo que se publicó en su día; con los
// textos de IA puestos, las páginas que cambian llevan la fecha de IA_DESDE (y
// /negocios, su versión). Así no hay que tocar cada prueba al cambiar la fecha.
//
//   fechaLegal('/privacidad', 'Última actualización: 12 de noviembre de 2026')
//     → con IA_DESDE = '2026-11-13': 'Última actualización: 13 de noviembre de 2026'
//     → con IA_DESDE = None: lo mismo que se le pasa
import fs from 'node:fs';

const fuente = fs.readFileSync(new URL('../legal_ia.py', import.meta.url), 'utf8');
const m = fuente.match(/^IA_DESDE = (None|'(\d{4})-(\d{2})-(\d{2})')/m);
if (!m) throw new Error('_fecha_ia.mjs: no encuentro IA_DESDE en legal_ia.py');
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const IA = m[1] === 'None' ? null : {
  iso: `${m[2]}-${m[3]}-${m[4]}`,
  es: `${Number(m[4])} de ${MESES_ES[Number(m[3]) - 1]} de ${m[2]}`,
  en: `${Number(m[4])} ${MESES_EN[Number(m[3]) - 1]} ${m[2]}`,
  // Desde cuándo se aplica la versión nueva de las condiciones para negocios (15 días).
  aplica: (() => {
    const d = new Date(Date.UTC(Number(m[2]), Number(m[3]) - 1, Number(m[4]) + 15));
    return { es: `${d.getUTCDate()} de ${MESES_ES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`, en: `${d.getUTCDate()} ${MESES_EN[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  })(),
};

// Las páginas que cambian con los textos de IA.
export const PAGINAS_IA = new Set(['/privacidad', '/en/privacy', '/terminos', '/en/terms', '/negocios', '/en/business-terms',
  '/normas', '/en/community-guidelines', '/cookies', '/en/cookies', '/soporte', '/en/support']);

// Retoques publicados después de los textos de IA (la fecha más nueva manda):
// RA1, la fila «Avisos sobre respuestas de la IA» (13-11-2026), «Contacto de
// quien reserva» (legal_contacto.py, CONTACTO_DESDE: la privacidad y las
// condiciones para negocios, con su versión, 16-11-2026) y «Encargos» (abajo).
const fc = fs.readFileSync(new URL('../legal_contacto.py', import.meta.url), 'utf8').match(/^CONTACTO_DESDE = (None|'(\d{4})-(\d{2})-(\d{2})')/m);
if (!fc) throw new Error('_fecha_ia.mjs: no encuentro CONTACTO_DESDE en legal_contacto.py');
export const CONTACTO = fc[1] === 'None' ? null : {
  iso: `${fc[2]}-${fc[3]}-${fc[4]}`,
  es: `${Number(fc[4])} de ${MESES_ES[Number(fc[3]) - 1]} de ${fc[2]}`,
  en: `${Number(fc[4])} ${MESES_EN[Number(fc[3]) - 1]} ${fc[2]}`,
};
// «Encargos» (legal_encargos.py, ENCARGOS_DESDE: la privacidad, los términos y las condiciones para negocios, con su
// versión; «-b» si es el mismo día que el contacto, 16-11-2026).
const fe = fs.readFileSync(new URL('../legal_encargos.py', import.meta.url), 'utf8').match(/^ENCARGOS_DESDE = (None|'(\d{4})-(\d{2})-(\d{2})')/m);
if (!fe) throw new Error('_fecha_ia.mjs: no encuentro ENCARGOS_DESDE en legal_encargos.py');
export const ENCARGOS = fe[1] === 'None' ? null : (() => {
  const iso = `${fe[2]}-${fe[3]}-${fe[4]}`;
  return {
    iso,
    version: CONTACTO && CONTACTO.iso === iso ? `${iso}-b` : iso,
    es: `${Number(fe[4])} de ${MESES_ES[Number(fe[3]) - 1]} de ${fe[2]}`,
    en: `${Number(fe[4])} ${MESES_EN[Number(fe[3]) - 1]} ${fe[2]}`,
  };
})();
const NEGOCIOS = ENCARGOS ? { ...ENCARGOS } : CONTACTO ? { ...CONTACTO, version: CONTACTO.iso } : null;
export const POSTERIOR = {
  // Sin `version`: la cabecera de la privacidad dice la de los términos (VERSION), que no cambia.
  '/privacidad': ENCARGOS ? { es: ENCARGOS.es, en: ENCARGOS.en } : CONTACTO || { es: '13 de noviembre de 2026', en: '13 November 2026' },
  '/en/privacy': ENCARGOS ? { es: ENCARGOS.es, en: ENCARGOS.en } : CONTACTO || { es: '13 de noviembre de 2026', en: '13 November 2026' },
  ...(NEGOCIOS ? { '/negocios': NEGOCIOS, '/en/business-terms': NEGOCIOS } : {}),
  ...(ENCARGOS ? { '/terminos': { es: ENCARGOS.es, en: ENCARGOS.en }, '/en/terms': { es: ENCARGOS.es, en: ENCARGOS.en } } : {}),
};

// La versión de las condiciones para negocios que dice la cabecera de /negocios (la más nueva).
export const VERSION_NEGOCIOS = ENCARGOS?.version || CONTACTO?.iso || IA?.iso || '2026-11-05';

export function fechaLegal(ruta, cabecera) {
  const p = POSTERIOR[ruta];
  if (p) {
    const c = cabecera
      .replace(/(Última actualización: )\d{1,2} de \p{L}+ de \d{4}/u, `$1${p.es}`)
      .replace(/(Last updated: )\d{1,2} \p{L}+ \d{4}/u, `$1${p.en}`);
    return p.version ? c.replace(/(Versi[óo]n )\d{4}-\d{2}-\d{2}(-[a-z])?/, `$1${p.version}`) : c;
  }
  if (!IA || !PAGINAS_IA.has(ruta)) return cabecera;
  let c = cabecera
    .replace(/(Última actualización: )\d{1,2} de \p{L}+ de \d{4}/u, `$1${IA.es}`)
    .replace(/(Last updated: )\d{1,2} \p{L}+ \d{4}/u, `$1${IA.en}`);
  if (ruta === '/negocios' || ruta === '/en/business-terms') c = c.replace(/(Versi[óo]n )\d{4}-\d{2}-\d{2}(-[a-z])?/, `$1${IA.iso}`);
  return c;
}

// Lo que los textos de IA sustituyen (p. ej. «la hace Google Translate»): con IA_DESDE puesto, esa
// comprobación de antes no se espera (una expresión que siempre casa); lo nuevo lo mira legal_ia_check.mjs.
export const soloSinIA = (re) => (IA ? /(?:)/ : re);
