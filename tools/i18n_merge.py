"""Mete traducciones en el diccionario de un idioma nuevo de «Tu cuenta» o del panel.

Los idiomas que no son español ni inglés (ca, gl, eu, fr, de, it) tienen su
diccionario en un fichero aparte que solo se descarga si es el que toca:
`app/i18n/<lang>.js` («Tu cuenta») y `panel/i18n/<lang>.js` (panel). Su forma:

    // comentario
    KL_DIC('ca', {
      "Guardar": "Desa",
      "Quedan {n} plazas": "Queden {n} places"
    });

Lo de dentro de las llaves es JSON (español → traducción): este script lo lee,
mezcla lo nuevo y lo vuelve a escribir ordenado. Las claves pueden llevar
huecos (`{n}`, `{nombre}`…) que la traducción tiene que conservar con el mismo
nombre; si falta o sobra alguno, la entrada no se mete y se avisa.

Al cambiar un diccionario sube su `data-dic-v` en el `index.html` del área
(para saltar la caché).

Uso:
  python tools/i18n_merge.py cuenta ca traducciones_ca.json
  python tools/i18n_merge.py panel fr fr.json [--reemplaza]   # sin --reemplaza no pisa lo que ya hay
  python tools/i18n_merge.py panel fr --vacio                  # crea (o deja) el diccionario vacío

El JSON de entrada es {español: traducción}; las traducciones vacías o null se
saltan. Sale con 1 si alguna entrada no se ha podido meter.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent

IDIOMAS = {'ca': 'català', 'gl': 'galego', 'eu': 'euskara', 'fr': 'français', 'de': 'Deutsch', 'it': 'italiano'}
# área → (carpeta del diccionario, index.html con el data-dic-v, nombre)
AREAS = {
    'cuenta': ('app/i18n', 'app/index.html', '«Tu cuenta»'),
    'panel': ('panel/i18n', 'panel/index.html', 'El panel del negocio'),
}
AREAS['app'] = AREAS['cuenta']

CABECERA = """// {nombre} en {idioma}: español → {idioma}. Lo que no esté aquí se queda en
// español. Las claves con huecos ({{n}}, {{nombre}}…) traducen frases con datos
// dentro. Lo carga /assets/i18n.js solo si es el idioma elegido.
// No se edita a mano: python tools/i18n_merge.py {area} {lang} <fichero.json>
"""

HUECO = re.compile(r'\{(\w+)\}')


def ruta(area: str, lang: str) -> Path:
    return ROOT / AREAS[area][0] / f'{lang}.js'


def lee(path: Path) -> dict[str, str]:
    """El diccionario de un fichero `KL_DIC('xx', {...});` (vacío si no existe)."""
    if not path.exists():
        return {}
    t = path.read_text(encoding='utf-8')
    m = re.search(r"KL_DIC\(\s*'(\w+)'\s*,\s*(\{.*\})\s*\);\s*$", t, re.S)
    if not m:
        raise SystemExit(f'{path}: no tiene la forma KL_DIC(\'xx\', {{…}});')
    return json.loads(m.group(2))


def escribe(area: str, lang: str, dic: dict[str, str]) -> Path:
    path = ruta(area, lang)
    path.parent.mkdir(parents=True, exist_ok=True)
    nombre = AREAS[area][2]
    cuerpo = json.dumps(dict(sorted(dic.items(), key=lambda kv: kv[0].casefold())), ensure_ascii=False, indent=2)
    texto = CABECERA.format(nombre=nombre, idioma=IDIOMAS[lang], area=area, lang=lang) + f"KL_DIC('{lang}', {cuerpo});\n"
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(texto)
    return path


def sube_version(area: str) -> None:
    """Sube el `data-dic-v` del index.html del área."""
    html = ROOT / AREAS[area][1]
    t = html.read_text(encoding='utf-8')
    nuevo, n = re.subn(r'data-dic-v="(\d+)"', lambda m: f'data-dic-v="{int(m.group(1)) + 1}"', t, count=1)
    if n:
        with open(html, 'w', encoding='utf-8', newline='\n') as f:
            f.write(nuevo)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2 or args[0] not in AREAS or args[1] not in IDIOMAS:
        raise SystemExit(__doc__)
    area, lang = args[0], args[1]
    if '--vacio' in sys.argv:
        if not ruta(area, lang).exists():
            print(escribe(area, lang, {}))
        return
    if len(args) < 3:
        raise SystemExit(__doc__)
    entrada = json.loads(Path(args[2]).read_text(encoding='utf-8'))
    if not isinstance(entrada, dict):
        raise SystemExit('El JSON tiene que ser un objeto {español: traducción}.')
    dic = lee(ruta(area, lang))
    reemplaza = '--reemplaza' in sys.argv
    nuevas = cambiadas = 0
    malas: list[str] = []
    for es, tr in entrada.items():
        if not isinstance(tr, str) or not tr.strip():
            continue
        if sorted(HUECO.findall(es)) != sorted(HUECO.findall(tr)):
            malas.append(f'  huecos distintos: {es!r} → {tr!r}')
            continue
        if es in dic and dic[es] != tr and not reemplaza:
            continue
        if es not in dic:
            nuevas += 1
        elif dic[es] != tr:
            cambiadas += 1
        dic[es] = tr
    path = escribe(area, lang, dic)
    if nuevas or cambiadas:
        sube_version(area)
    print(f'{path.relative_to(ROOT)}: {nuevas} nuevas, {cambiadas} cambiadas, {len(dic)} en total.')
    if malas:
        print(f'{len(malas)} sin meter:')
        print('\n'.join(malas))
        sys.exit(1)


if __name__ == '__main__':
    main()
