"""Textos del panel y del admin que se ven en español y no tienen inglés.

El panel y el admin se traducen «por lo que se ve» (assets/i18n.js): después
de pintar, cada texto se cambia por su entrada del diccionario si la hay. Este
script busca en el código los textos que se pintan (entre etiquetas, en
atributos que se traducen y en cadenas entre comillas) y lista los que no
están en el diccionario.

Uso:
  python tools/i18n_missing.py panel        # lista
  python tools/i18n_missing.py admin --json # para rellenar a mano
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent

AREAS = {
    # ideas.js ya trae cada idea en los dos idiomas.
    'panel': (['panel/panel.js', 'panel/index.html'], 'panel/i18n.js'),
    'admin': (['admin/admin.js', 'admin/index.html'], 'admin/i18n.js'),
    'cuenta': (['app/app.js', 'app/cuenta.js'], 'app/i18n.js'),
}

# Palabras que delatan una frase en español.
ES = re.compile(r"[áéíóúñ¿¡]|\b(el|la|los|las|de|del|que|con|para|por|una?|sin|más|esta?|este|hay|tu|tus|se|ya|en|al|y|o|lo|es|son)\b", re.I)
# …y en inglés (los textos ya en inglés no se cuentan).
EN = re.compile(r"\b(the|and|to|of|your|you|is|are|with|for|in|on|this|it|at|an?|or|be|no|not|can|will|from|by)\b", re.I)
BILINGUE = re.compile(r"\b(en|EN)\s*\?|I18N\.lang === 'en'|lang === 'en'|\bbi\(|^\s*[?:] [`'\"\[(]")
# Nombres propios y palabras que son iguales en inglés.
MARCAS = {'Klendar', 'Supabase', 'Google', 'Apple', 'Stripe', 'Mapbox', 'Resend', 'Cloudflare', 'Madrid', 'Barcelona',
          'Pro', 'Error', 'Email', 'Web', 'Premium', 'Instagram', 'Facebook', 'Twitter', 'Android', 'Total', 'Normal',
          'Material', 'Local', 'General', 'Final', 'Hola', 'Enter', 'Escape', 'Tab'}
# Lo que no se enseña o ya va en los dos idiomas.
IGNORAR = {'sin configuración', 'Idioma / Language', 'Español', 'English', 'Invalid login credentials',
           'User already registered', 'Payload too large', 'Klendar · Panel del negocio', 'Klendar · Administración'}
CODIGO = re.compile(r"^[\w.-]+$|[{}=;()\[\]]|=>|\.(js|css|png|svg)\b|^#|^/|https?:|^\$|^[a-z_]+:|--|\\n")


def candidatos(texto: str):
    abiertos = 0  # paréntesis de un `bi(` que sigue en las líneas de abajo
    for linea in texto.splitlines():
        # Las líneas que ya eligen idioma a mano (`en ? '…' : '…'`, `bi(…)`).
        if abiertos > 0 or 'bi(' in linea:
            abiertos += linea.count('(') - linea.count(')')
            continue
        if BILINGUE.search(linea):
            continue
        # 1. Texto entre etiquetas (también dentro de plantillas `...`).
        for m in re.finditer(r">([^<>`]+?)<", linea):
            yield m.group(1)
        # 2. Trozos de plantilla pegados a una interpolación.
        for m in re.finditer(r">([^<>`$]+?)\$\{", linea):
            yield m.group(1)
        for m in re.finditer(r"\}([^<>`${]+?)<", linea):
            yield m.group(1)
        # 3. Atributos que se traducen.
        for m in re.finditer(r"(?:placeholder|title|aria-label|alt)=\"([^\"$]+)\"", linea):
            yield m.group(1)
        # 4. Cadenas entre comillas simples o dobles.
        for m in re.finditer(r"'((?:[^'\\]|\\.){2,})'", linea):
            yield m.group(1).replace("\\'", "'")
        for m in re.finditer(r"\"((?:[^\"\\]|\\.){2,})\"", linea):
            yield m.group(1)


def limpia(s: str) -> str | None:
    s = re.sub(r"\s+", " ", s).strip()
    s = s.strip('·—–:|,').strip()
    if len(s) < 2 or not re.search(r"[A-Za-zÁÉÍÓÚáéíóúñÑ]{2}", s):
        return None
    # Una sola palabra: botones y etiquetas («Guardar», «Borrar», «dentro»).
    # Con mayúscula, o en minúscula con tilde; el resto suele ser código.
    if re.fullmatch(r"[A-ZÁÉÍÓÚ][a-záéíóúñü]+|[a-záéíóúñü]*[áéíóúñ][a-záéíóúñü]*", s):
        return None if s in MARCAS else s
    if CODIGO.search(s) or '<' in s:
        return None
    es, en = len(ES.findall(s)), len(EN.findall(s))
    if en > es:
        return None
    if not es and not re.match(r"^[A-ZÁÉÍÓÚ¿¡][a-záéíóúñ]+(\s|$)", s):
        return None
    return s


def dic(path: Path) -> set[str]:
    t = path.read_text(encoding='utf-8')
    return {m[1] for m in re.findall(r"^\s*(['\"])(.+?)\1\s*:", t, re.M)}


def main():
    area = sys.argv[1] if len(sys.argv) > 1 else 'panel'
    fuentes, dpath = AREAS[area]
    ya = dic(ROOT / dpath)
    faltan: dict[str, str] = {}
    for f in fuentes:
        txt = (ROOT / f).read_text(encoding='utf-8')
        for c in candidatos(txt):
            s = limpia(c)
            if s and s not in ya and s not in faltan and s not in IGNORAR:
                faltan[s] = f
    if '--json' in sys.argv:
        print(json.dumps({k: '' for k in faltan}, ensure_ascii=False, indent=2))
    else:
        for k, f in faltan.items():
            print(f'{f}: {k}')
        print(f'\n{len(faltan)} texto(s) sin inglés en {area}.')


if __name__ == '__main__':
    main()
