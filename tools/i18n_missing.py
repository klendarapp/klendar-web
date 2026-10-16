"""Textos de «Tu cuenta», del panel y del admin que se ven en español y no tienen traducción.

«Tu cuenta», el panel y el admin se traducen «por lo que se ve»
(assets/i18n.js): después de pintar, cada texto se cambia por su entrada del
diccionario si la hay.

Inglés (lo de siempre): busca en el código los textos que se pintan (entre
etiquetas, en atributos que se traducen y en cadenas entre comillas) y lista
los que no están en el diccionario inglés de cada herramienta.

Idiomas nuevos (`--lang ca|gl|eu|fr|de|it|all`, solo «Tu cuenta» y el panel):
lista los textos en español que se pintan y faltan en su diccionario
(`app/i18n/<lang>.js`, `panel/i18n/<lang>.js`). Los textos salen de:
  - las claves del diccionario inglés del área (APP_EN, el del panel);
  - el lado español de `EN ? … : …`, `en ? …`, `… === 'en' ? … : …` y
    `bi(español, inglés)`, con los `${x}` convertidos en huecos `{x}` (y un
    `${n === 1 ? 'plaza' : 'plazas'}` dentro, en las dos variantes);
  - lo que se pasa a `t('…')` / `I18N.t('…')`;
  - las tablas `{ es: {…}, en: {…} }` de los módulos de /assets que se usan
    ahí (tarjeta, emisiones, artistas, categorías…) y las ideas del panel;
  - la cabecera y el pie de «Tu cuenta» (el bloque español de app/index.html).
Al lado de cada uno, el inglés si se sabe (para los traductores).

Uso:
  python tools/i18n_missing.py panel              # inglés, lista
  python tools/i18n_missing.py admin --json       # inglés, para rellenar a mano
  python tools/i18n_missing.py cuenta --lang ca   # catalán de «Tu cuenta»
  python tools/i18n_missing.py --lang all         # «Tu cuenta» y panel, los seis idiomas nuevos
  python tools/i18n_missing.py panel --lang all --json   # {español: inglés o null} de lo que falta

Sale con 1 si falta algo (para el pre-push).
"""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent

AREAS = {
    # ideas.js ya trae cada idea en los dos idiomas.
    'panel': (['panel/panel.js', 'panel/rrpp.js', 'panel/ficha.js', 'panel/partidos.js', 'panel/bonos.js', 'panel/momento.js', 'panel/grupos.js', 'panel/sorteos.js', 'panel/cola.js', 'panel/artistas.js', 'panel/fidelizar.js', 'panel/herramientas.js', 'panel/entidades.js', 'panel/plan.js', 'panel/index.html'], 'panel/i18n.js'),
    'admin': (['admin/admin.js', 'admin/emisiones.js', 'admin/artistas.js', 'admin/condiciones.js', 'admin/crecer.js', 'admin/index.html'], 'admin/i18n.js'),
    'cuenta': (['app/app.js', 'app/cuenta.js', 'app/amigos.js', 'app/correo.js', 'app/rrpp.js', 'app/partidos.js', 'app/artistas.js', 'app/bonos.js', 'app/momento.js', 'app/grupos.js', 'app/sorteos.js', 'app/cola.js', 'app/ahorro.js', 'app/crecer.js'], 'app/i18n.js'),
}

# Palabras que delatan una frase en español.
ES = re.compile(r"[áéíóúñ¿¡]|\b(el|la|los|las|de|del|que|con|para|por|una?|sin|más|esta?|este|hay|tu|tus|se|ya|en|al|y|o|lo|es|son)\b", re.I)
# …y en inglés (los textos ya en inglés no se cuentan).
EN = re.compile(r"\b(the|and|to|of|your|you|is|are|with|for|in|on|this|it|at|an?|or|be|no|not|can|will|from|by)\b", re.I)
BILINGUE = re.compile(r"\b(en|EN)\s*\?|I18N\.lang === 'en'|lang === 'en'|\bbi(Trozos)?\(|^\s*[?:] [`'\"\[(]")
# Nombres propios y palabras que son iguales en inglés.
MARCAS = {'Klendar', 'Supabase', 'Google', 'Apple', 'Stripe', 'Mapbox', 'Resend', 'Cloudflare', 'Madrid', 'Barcelona',
          'Pro', 'Error', 'Email', 'Web', 'Premium', 'Instagram', 'Facebook', 'Twitter', 'Android', 'Total', 'Normal',
          'Material', 'Local', 'General', 'Final', 'Hola', 'Enter', 'Escape', 'Tab', 'Backspace'}
# Lo que no se enseña o ya va en los dos idiomas.
IGNORAR = {'sin configuración', 'Idioma / Language', 'Español', 'English', 'Invalid login credentials',
           'User already registered', 'Payload too large', 'Klendar · Panel del negocio', 'Klendar · Administración',
           # Código, no texto: idiomas y errores de Supabase que se comparan.
           'es', 'en', 'es-ES', 'already registered', 'token has expired'}
CODIGO = re.compile(r"^[\w.-]+$|[{}=;()\[\]]|=>|\.(js|css|png|svg)\b|^#|^/|https?:|^\$|^[a-z_]+:|--|\\n")


def candidatos(texto: str):
    abiertos = 0  # paréntesis de un `bi(` que sigue en las líneas de abajo
    for linea in texto.splitlines():
        # Las líneas que ya eligen idioma a mano (`en ? '…' : '…'`, `bi(…)`).
        if abiertos > 0 or 'bi(' in linea:
            # Nunca por debajo de 0: una línea que cierra más de lo que abre
            # (`], { label: bi('…', '…') });`) no debe dejar de vigilar las de abajo.
            abiertos = max(0, abiertos + linea.count('(') - linea.count(')'))
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


def main_ingles(area: str) -> int:
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
    return 1 if faltan else 0


# ════════════════════════════════════════════════════════════════════════════
# Idiomas nuevos
# ════════════════════════════════════════════════════════════════════════════

NUEVOS = ['ca', 'gl', 'eu', 'fr', 'de', 'it']
# Módulos de /assets con tabla {es, en} que pintan en «Tu cuenta» y el panel.
MODULOS_COMUNES = ['assets/auth-errors.js', 'assets/acceso.js', 'assets/marcas.js', 'assets/categorias.js',
                   'assets/emisiones.js', 'assets/artistas.js', 'assets/textos-grupos.js', 'assets/textos-sorteos.js']
NUEVAS_AREAS = {
    # área: (fuentes propias, módulos, diccionario inglés, carpeta de los diccionarios nuevos)
    'cuenta': ('app', MODULOS_COMUNES, 'app/i18n.js', 'app/i18n'),
    'panel': ('panel', MODULOS_COMUNES + ['assets/tarjeta.js', 'assets/enlaces.js'], 'panel/i18n.js', 'panel/i18n'),
}


# ── Un lector de JavaScript muy pequeño ─────────────────────────────────────
# Lo justo para encontrar cadenas (con sus `${…}`), paréntesis, ternarios y
# llamadas: sabe saltarse comentarios y expresiones regulares.

class Tok:
    __slots__ = ('k', 'v', 'partes', 'linea')

    def __init__(self, k, v, partes=None, linea=0):
        self.k = k            # 'str', 'id', 'num', 'p' (puntuación)
        self.v = v
        self.partes = partes  # en 'str': [texto | [Tok…] (lo de dentro de ${})]
        self.linea = linea

    def __repr__(self):
        return f'{self.k}:{self.v!r}'


PUNTOS = ['===', '!==', '...', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '+=', '-=']
ANTES_DE_REGEX = set('(,=:[!&|?{};+-*%<>~^') | {'=>', '==', '===', '!=', '!==', '&&', '||', '??', 'return', 'typeof',
                                                   'case', 'in', 'of', 'else', 'void', 'delete', 'new', 'throw'}
ESCAPES = {'n': '\n', 't': '\t', 'r': '', '\\': '\\', "'": "'", '"': '"', '`': '`', '0': '\0', 'b': '', 'v': '', 'f': ''}


def tokeniza(src: str, i: int = 0, fin: str | None = None, linea: int = 1):
    """Devuelve (tokens, posición final, línea). Con `fin='}'`, para en la llave
    que cierra un `${`."""
    toks: list[Tok] = []
    n = len(src)
    llaves = 0
    while i < n:
        c = src[i]
        if c == '\n':
            linea += 1
            i += 1
            continue
        if c in ' \t\r':
            i += 1
            continue
        if src.startswith('//', i):
            j = src.find('\n', i)
            i = n if j < 0 else j
            continue
        if src.startswith('/*', i):
            j = src.find('*/', i + 2)
            linea += src.count('\n', i, n if j < 0 else j)
            i = n if j < 0 else j + 2
            continue
        if c in '\'"':
            j = i + 1
            buf = []
            while j < n and src[j] != c:
                if src[j] == '\\' and j + 1 < n:
                    e = src[j + 1]
                    if e == 'u' and src[j + 2:j + 3] == '{':
                        k = src.index('}', j)
                        buf.append(chr(int(src[j + 3:k], 16)))
                        j = k + 1
                        continue
                    if e == 'u':
                        buf.append(chr(int(src[j + 2:j + 6], 16)))
                        j += 6
                        continue
                    if e == '\n':
                        linea += 1
                    buf.append(ESCAPES.get(e, e))
                    j += 2
                    continue
                if src[j] == '\n':
                    break
                buf.append(src[j])
                j += 1
            toks.append(Tok('str', ''.join(buf), [''.join(buf)], linea))
            i = j + 1
            continue
        if c == '`':
            j = i + 1
            partes: list = []
            buf = []
            while j < n and src[j] != '`':
                if src[j] == '\\' and j + 1 < n:
                    e = src[j + 1]
                    if e == 'u' and src[j + 2:j + 3] == '{':
                        k = src.index('}', j)
                        buf.append(chr(int(src[j + 3:k], 16)))
                        j = k + 1
                        continue
                    if e == 'u':
                        buf.append(chr(int(src[j + 2:j + 6], 16)))
                        j += 6
                        continue
                    buf.append(ESCAPES.get(e, e))
                    j += 2
                    continue
                if src.startswith('${', j):
                    if buf:
                        partes.append(''.join(buf))
                        buf = []
                    dentro, j, linea = tokeniza(src, j + 2, '}', linea)
                    partes.append(dentro)
                    continue
                if src[j] == '\n':
                    linea += 1
                buf.append(src[j])
                j += 1
            if buf:
                partes.append(''.join(buf))
            toks.append(Tok('str', None, partes, linea))
            i = j + 1
            continue
        if c == '/':
            prev = toks[-1] if toks else None
            es_regex = prev is None or (prev.k == 'p' and prev.v in ANTES_DE_REGEX) or (prev.k == 'id' and prev.v in ANTES_DE_REGEX)
            if es_regex:
                j = i + 1
                clase = False
                while j < n:
                    d = src[j]
                    if d == '\\':
                        j += 2
                        continue
                    if d == '[':
                        clase = True
                    elif d == ']':
                        clase = False
                    elif d == '/' and not clase:
                        break
                    elif d == '\n':
                        break
                    j += 1
                j += 1
                while j < n and src[j].isalpha():
                    j += 1
                toks.append(Tok('re', src[i:j], None, linea))
                i = j
                continue
        if c.isalpha() or c in '_$':
            j = i + 1
            while j < n and (src[j].isalnum() or src[j] in '_$'):
                j += 1
            toks.append(Tok('id', src[i:j], None, linea))
            i = j
            continue
        if c.isdigit():
            j = i + 1
            while j < n and (src[j].isalnum() or src[j] in '._'):
                j += 1
            toks.append(Tok('num', src[i:j], None, linea))
            i = j
            continue
        if fin and c == '{':
            llaves += 1
        if fin and c == '}':
            if llaves == 0:
                return toks, i + 1, linea
            llaves -= 1
        for p in PUNTOS:
            if src.startswith(p, i):
                toks.append(Tok('p', p, None, linea))
                i += len(p)
                break
        else:
            toks.append(Tok('p', c, None, linea))
            i += 1
    return toks, i, linea


ABRE = {'(': ')', '[': ']', '{': '}'}
CIERRA = set(ABRE.values())


def cierre(toks, i):
    """Índice del que cierra el paréntesis/corchete/llave abierto en `i`."""
    prof = 0
    for j in range(i, len(toks)):
        t = toks[j]
        if t.k == 'p' and t.v in ABRE:
            prof += 1
        elif t.k == 'p' and t.v in CIERRA:
            prof -= 1
            if prof == 0:
                return j
    return len(toks) - 1


def hasta(toks, i, paradas=(',', ')', ']', '}', ';'), dos_puntos=True):
    """Desde `i`, hasta antes de una parada a profundidad 0 (o de un `:` que no
    es de un ternario de dentro). Devuelve el índice de la parada."""
    prof = 0
    preguntas = 0
    j = i
    while j < len(toks):
        t = toks[j]
        if t.k == 'p':
            if t.v in ABRE:
                prof += 1
            elif t.v in CIERRA:
                if prof == 0:
                    return j
                prof -= 1
            elif prof == 0:
                if t.v in paradas:
                    return j
                if t.v == '?':
                    preguntas += 1
                elif t.v == ':':
                    if preguntas == 0 and dos_puntos:
                        return j
                    preguntas -= 1
        j += 1
    return j


def partes_prof0(toks, sep):
    """Trocea por `sep` a profundidad 0."""
    trozos, actual, prof = [], [], 0
    for t in toks:
        if t.k == 'p' and t.v in ABRE:
            prof += 1
        elif t.k == 'p' and t.v in CIERRA:
            prof -= 1
        if prof == 0 and t.k == 'p' and t.v == sep:
            trozos.append(actual)
            actual = []
            continue
        actual.append(t)
    trozos.append(actual)
    return trozos


RUIDO = {'esc', 'fmtNum', 'String', 'Number', 'Math', 'I18N', 't', 'encodeURIComponent', 'join', 'map', 'filter',
         'toLocaleString', 'toFixed', 'replace', 'trim', 'length', 'round', 'floor', 'abs', 'toUpperCase', 'toLowerCase',
         'slice', 'esOEn', 'globalThis', 'window', 'this', 'Boolean', 'Intl', 'format', 'S', 'T', 'SA', 'SE', 'KT', 'KZ'}


def nombre_hueco(toks) -> str:
    ids = [t.v for k, t in enumerate(toks) if t.k == 'id'
           and not (k + 1 < len(toks) and toks[k + 1].k == 'p' and toks[k + 1].v == '(')
           and t.v not in RUIDO]
    if not ids:
        ids = [t.v for t in toks if t.k == 'id' and t.v not in RUIDO]
    n = (ids[-1] if ids else 'x')
    n = re.sub(r'\W', '', n) or 'x'
    return n[:20]


class Hueco:
    __slots__ = ('nombre', 'clave')

    def __init__(self, toks):
        self.nombre = nombre_hueco(toks)
        self.clave = ' '.join(f'{t.k}{t.v}' for t in toks)


MAX_VARIANTES = 8


def quita_parentesis(toks):
    while toks and toks[0].k == 'p' and toks[0].v == '(' and cierre(toks, 0) == len(toks) - 1:
        toks = toks[1:-1]
    return toks


def variantes(toks, profundidad=0):
    """Los textos que puede dar una expresión: lista de variantes, cada una una
    lista de trozos (texto o Hueco). [] si no hay texto."""
    toks = quita_parentesis(toks)
    if not toks or profundidad > 6:
        return []
    # Ternario a profundidad 0: las dos ramas.
    q = hasta(toks, 0, paradas=('?',), dos_puntos=False)
    if q < len(toks) and toks[q].v == '?':
        dp = hasta(toks, q + 1, paradas=(), dos_puntos=True)
        if dp < len(toks):
            a = variantes(toks[q + 1:dp], profundidad + 1)
            b = variantes(toks[dp + 1:], profundidad + 1)
            return (a + b)[:MAX_VARIANTES]
        return []
    # `x || 'texto'`: la parte con texto.
    # (`${nombre || ''}` dentro de una plantilla: el dato es un hueco, no '').
    for op in ('||', '??'):
        trozos = partes_prof0(toks, op)
        if len(trozos) > 1:
            out = []
            alguno = False
            for tr in trozos:
                v = [x for x in variantes(tr, profundidad + 1) if any(isinstance(y, Hueco) or y for y in x)]
                if v:
                    alguno = True
                    out += v
                else:
                    out.append([Hueco(tr)])
            return out[:MAX_VARIANTES] if alguno else []
    # Sumas: el producto de las partes.
    trozos = partes_prof0(toks, '+')
    if len(trozos) > 1:
        acum = [[]]
        alguno = False
        for tr in trozos:
            v = variantes(tr, profundidad + 1)
            if v and any(any(isinstance(x, str) for x in vv) for vv in v):
                alguno = True
            else:
                v = [[Hueco(tr)]]
            acum = [a + b for a in acum for b in v][:MAX_VARIANTES]
        return acum if alguno else []
    # Una cadena (o plantilla).
    if len(toks) == 1 and toks[0].k == 'str':
        acum = [[]]
        for p in toks[0].partes:
            if isinstance(p, str):
                acum = [a + [p] for a in acum]
            else:
                v = variantes(p, profundidad + 1)
                if v and len(v) <= 3:
                    acum = [a + b for a in acum for b in v][:MAX_VARIANTES]
                else:
                    acum = [a + [Hueco(p)] for a in acum]
        return acum
    # esc(…), t(…), I18N.t(…), String(…): lo de dentro.
    if (len(toks) >= 3 and toks[-1].v == ')' and toks[1].v == '(' and toks[0].k == 'id'
            and toks[0].v in ('esc', 't', 'String') and cierre(toks, 1) == len(toks) - 1):
        return variantes(toks[2:-1], profundidad + 1)
    if (len(toks) >= 5 and toks[0].v == 'I18N' and toks[1].v == '.' and toks[2].v == 't' and toks[3].v == '('
            and cierre(toks, 3) == len(toks) - 1):
        return variantes(toks[4:-1], profundidad + 1)
    # Una función flecha: su cuerpo. Con los parámetros entre paréntesis
    # (`(n) => …`, lo normal en las tablas {es, en} de /assets) también.
    if toks[0].k == 'p' and toks[0].v == '(':
        k = cierre(toks, 0)
        if k + 1 < len(toks) and toks[k + 1].k == 'p' and toks[k + 1].v == '=>':
            cuerpo = toks[k + 2:]
            if cuerpo and cuerpo[0].v == '{':
                return []
            return variantes(cuerpo, profundidad + 1)
    for k, t in enumerate(toks):
        if t.k == 'p' and t.v == '=>':
            cuerpo = toks[k + 1:]
            if cuerpo and cuerpo[0].v == '{':
                return []
            return variantes(cuerpo, profundidad + 1)
        if t.k == 'p' and t.v in ABRE:
            break
    return []


def a_texto(variante) -> str:
    """Los trozos de una variante con los huecos como `{nombre}` (sin repetir
    nombre para cosas distintas)."""
    vistos: dict[str, str] = {}
    out = []
    for x in variante:
        if isinstance(x, str):
            # Un `{fecha}` escrito tal cual (`t('… {fecha}').replace('{fecha}', …)`)
            # ya es un hueco: se deja.
            out.append(x)
            continue
        n = x.nombre
        k = 2
        while n in vistos and vistos[n] != x.clave:
            n = f'{x.nombre}{k}'
            k += 1
        vistos[n] = x.clave
        out.append('{' + n + '}')
    return ''.join(out)


ATRIBUTOS = re.compile(r'\b(?:placeholder|title|aria-label|alt)="([^"]*)"')
LETRA = re.compile(r'[^\W\d_]', re.U)


def trocea(s: str) -> list[str]:
    """Lo que se ve de un texto con HTML: los trozos entre etiquetas y los
    atributos que se traducen."""
    if '<' not in s:
        return [s]
    # Los iconos (Material Symbols: `<span class="ms">menu</span>`) no se leen.
    s = re.sub(r'<span class="ms"[^>]*>[^<]*</span>', ' ', s)
    out = [m.group(1) for m in ATRIBUTOS.finditer(s)]
    out += re.split(r'<[^>]*>', s)
    return out


def util(s: str) -> str | None:
    """Un texto que merece traducción (o None)."""
    s = re.sub(r'\s+', ' ', s).strip()
    if not s:
        return None
    fijo = re.sub(r'\{\w+\}', '', s)
    letras = LETRA.findall(fijo)
    if len(letras) < 2:
        return None
    # Con huecos, al menos una palabra de 3 letras fuera de ellos: si no, la
    # plantilla encajaría con cualquier cosa.
    if '{' in s and not re.search(r'[^\W\d_]{3}', fijo):
        return None
    if re.search(r'https?:|://|=>|\.(js|css|png|svg|webp)\b|^[#/]|^\w+\(|[;=]\s*$', s):
        return None
    if re.fullmatch(r'[a-z0-9]+(?:[-_][a-z0-9]+)+', s):  # «mis-datos», «business_terms»
        return None
    if re.fullmatch(r'[A-Z0-9_]{2,}', s) or re.fullmatch(r'[a-z]+[A-Z]\w*', s):  # constantes, camelCase
        return None
    if s in IGNORAR or s in MARCAS:
        return None
    return s


def textos_de(toks):
    out = []
    for v in variantes(toks):
        for trozo in trocea(a_texto(v)):
            s = util(trozo)
            if s:
                out.append(s)
    return out


def emparejados(es_toks, en_toks):
    """[(español, inglés o None)] de dos expresiones paralelas."""
    es_v = [trocea(a_texto(v)) for v in variantes(es_toks)]
    en_v = [trocea(a_texto(v)) for v in variantes(en_toks)] if en_toks is not None else []
    out = []
    for i, trozos in enumerate(es_v):
        otros = en_v[i] if i < len(en_v) and len(en_v[i]) == len(trozos) and len(en_v) == len(es_v) else None
        for j, tr in enumerate(trozos):
            s = util(tr)
            if not s:
                continue
            ingles = re.sub(r'\s+', ' ', otros[j]).strip() if otros else None
            out.append((s, ingles or None))
    return out


def es_marca_ingles(toks, i):
    """¿Empieza en `i` un `EN ?`, `en ?` o `… === 'en' ?`? Devuelve el índice
    del `?` o -1."""
    t = toks[i]
    if t.k == 'id' and t.v in ('EN', 'en') and i + 1 < len(toks) and toks[i + 1].v == '?':
        if i > 0 and toks[i - 1].v == '.':
            return -1
        return i + 1
    if (t.k == 'p' and t.v == '===' and i + 2 < len(toks) and toks[i + 1].k == 'str'
            and toks[i + 1].partes == ['en'] and toks[i + 2].v == '?'):
        return i + 2
    return -1


def objeto(toks, i):
    """Un literal `{ clave: valor, … }` que empieza en `i`: {clave: tokens}."""
    fin = cierre(toks, i)
    dentro = toks[i + 1:fin]
    out = {}
    for tr in partes_prof0(dentro, ','):
        if len(tr) >= 3 and tr[1].v == ':' and tr[0].k in ('id', 'str', 'num'):
            clave = tr[0].v if tr[0].k != 'str' else ''.join(p for p in tr[0].partes if isinstance(p, str))
            out[clave] = tr[2:]
    return out, fin


def tablas(toks, valor_es, valor_en, pares):
    """Recorre dos valores paralelos de una tabla {es, en}."""
    if valor_es and valor_es[0].v == '{' and cierre(valor_es, 0) == len(valor_es) - 1:
        oes, _ = objeto(valor_es, 0)
        oen, _ = objeto(valor_en, 0) if valor_en and valor_en[0].v == '{' else ({}, 0)
        for k, v in oes.items():
            tablas(toks, v, oen.get(k), pares)
        return
    if valor_es and valor_es[0].v == '[' and cierre(valor_es, 0) == len(valor_es) - 1:
        les = partes_prof0(valor_es[1:-1], ',')
        len_ = partes_prof0(valor_en[1:-1], ',') if valor_en and valor_en[0].v == '[' else []
        for k, v in enumerate(les):
            tablas(toks, v, len_[k] if k < len(len_) else None, pares)
        return
    pares += emparejados(valor_es, valor_en)


def extrae_js(src: str):
    """[(español, inglés o None)] de un fichero JavaScript."""
    toks, _, _ = tokeniza(src)
    pares: list[tuple[str, str | None]] = []
    recorre(toks, pares)
    return pares


def recorre(toks, pares):
    """Busca en `toks` (y en los `${…}` de sus plantillas) lo que va en dos
    idiomas, lo que pasa por `t()` y las tablas {es, en}."""
    n = len(toks)
    for t in toks:
        if t.k == 'str' and t.partes:
            for p in t.partes:
                if not isinstance(p, str):
                    recorre(p, pares)
    for i, t in enumerate(toks):
        # EN ? inglés : español (y `… === 'en' ? inglés : español`).
        q = es_marca_ingles(toks, i)
        if q >= 0:
            dp = hasta(toks, q + 1, paradas=(), dos_puntos=True)
            if dp < n and toks[dp].v == ':':
                fin = hasta(toks, dp + 1)
                pares += emparejados(toks[dp + 1:fin], toks[q + 1:dp])
            continue
        # bi(español, inglés)
        if t.k == 'id' and t.v in ('bi', 'biTrozos') and i + 1 < n and toks[i + 1].v == '(' and (i == 0 or toks[i - 1].v != '.'):
            fin = cierre(toks, i + 1)
            args = partes_prof0(toks[i + 2:fin], ',')
            if len(args) >= 2:
                pares += emparejados(args[0], args[1])
            continue
        # t('…') / I18N.t('…')
        if t.k == 'id' and t.v == 't' and i + 1 < n and toks[i + 1].v == '(':
            if i > 0 and toks[i - 1].v == '.' and not (i > 1 and toks[i - 2].v == 'I18N'):
                continue
            fin = cierre(toks, i + 1)
            args = partes_prof0(toks[i + 2:fin], ',')
            if args and args[0]:
                pares += [(s, None) for s in textos_de(args[0])]
            continue
        # Parejas ['español', 'inglés'] (las tablas que se pasan a `bi(...x)`).
        # Solo frases (con espacios): `['owner', 'Propietario']` es [clave, nombre].
        if (t.k == 'p' and t.v == '[' and i + 4 < n and toks[i + 1].k == 'str' and toks[i + 2].v == ','
                and toks[i + 3].k == 'str' and toks[i + 4].v == ']'
                and all(' ' in ''.join(x for x in toks[k].partes if isinstance(x, str)).strip() for k in (i + 1, i + 3))):
            pares += emparejados([toks[i + 1]], [toks[i + 3]])
            continue
        # Tablas { es: …, en: … } (también las de una línea: { id, es: '…', en: '…' }).
        if t.k == 'p' and t.v == '{':
            o, _ = objeto(toks, i)
            if 'es' in o and 'en' in o:
                tablas(toks, o['es'], o['en'], pares)


class _Bloques(HTMLParser):
    """Los textos (y atributos que se traducen) de cada bloque `data-only`."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.pila: list[str | None] = []
        self.textos: dict[str, list[str]] = {'es': [], 'en': [], None: []}

    def _actual(self):
        for x in reversed(self.pila):
            if x and x != 'icono':
                return x
        return None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in ('img', 'input', 'meta', 'link', 'br', 'source'):
            # Un icono (Material Symbols) se marca para no leer su nombre.
            self.pila.append('icono' if 'ms' in (a.get('class') or '').split() else a.get('data-only'))
        for k in ('placeholder', 'title', 'aria-label', 'alt'):
            if a.get(k):
                self.textos[a.get('data-only') or self._actual()].append(a[k])

    def handle_endtag(self, tag):
        if tag not in ('img', 'input', 'meta', 'link', 'br', 'source') and self.pila:
            self.pila.pop()

    def handle_data(self, data):
        # El <title> lo pone app.js con t('Tu cuenta').
        if data.strip() and self.lasttag != 'title' and (not self.pila or self.pila[-1] != 'icono'):
            self.textos[self._actual()].append(data)


def extrae_html(src: str):
    """[(español, inglés)] de un index.html: el bloque español emparejado con el
    inglés trozo a trozo (si salen los mismos), y lo de fuera de los bloques."""
    p = _Bloques()
    p.feed(re.sub(r'<script\b.*?</script>', '', src, flags=re.S))
    es, en = p.textos['es'], p.textos['en']
    pares = []
    for k, s in enumerate(es):
        s2 = util(s)
        if s2:
            pares.append((s2, re.sub(r'\s+', ' ', en[k]).strip() if len(en) == len(es) else None))
    for s in p.textos[None]:
        s2 = util(s)
        if s2:
            pares.append((s2, None))
    return pares


def extrae_ideas(path: Path):
    t = path.read_text(encoding='utf-8')
    datos = json.loads(t[t.index('{'):t.rindex('}') + 1])
    pares = []
    for lista in [datos.get('general', [])] + list(datos.get('bySlug', {}).values()):
        for x in lista:
            for a, b in (('es', 'en'), ('descEs', 'descEn'), ('termsEs', 'termsEn')):
                if x.get(a):
                    pares.append((x[a], x.get(b)))
    return pares


def dic_ingles(path: Path) -> dict[str, str]:
    """El diccionario inglés de un área ({español: inglés})."""
    toks, _, _ = tokeniza(path.read_text(encoding='utf-8'))
    for i, t in enumerate(toks):
        if t.v == '{':
            o, _ = objeto(toks, i)
            out = {}
            for k, v in o.items():
                vv = variantes(v)
                if vv:
                    out[k] = a_texto(vv[0])
            return out
    return {}


def dic_nuevo(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    t = path.read_text(encoding='utf-8')
    m = re.search(r"KL_DIC\(\s*'(\w+)'\s*,\s*(\{.*\})\s*\);\s*$", t, re.S)
    return json.loads(m.group(2)) if m else {}


def textos_area(area: str) -> dict[str, tuple[str | None, str]]:
    """{español: (inglés o None, de dónde sale)} de todo lo que se pinta en el área."""
    carpeta, modulos, dpath, _ = NUEVAS_AREAS[area]
    ingles = dic_ingles(ROOT / dpath)
    todo: dict[str, tuple[str | None, str]] = {}

    def mete(es, en, f):
        es = es.strip()
        if es in todo:
            if todo[es][0] is None and en:
                todo[es] = (en, todo[es][1])
            return
        todo[es] = (ingles.get(es) or en, f)

    for k, v in ingles.items():
        mete(k, v, dpath)
    # ideas.js va aparte (extrae_ideas): ya trae cada idea en los dos idiomas.
    fuentes = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / carpeta).glob('*.js')
                     if p.name not in ('i18n.js', 'ideas.js'))
    fuentes += modulos
    for f in fuentes:
        src = (ROOT / f).read_text(encoding='utf-8')
        # Lo de siempre (los textos que busca el modo inglés)…
        for c in candidatos(src):
            s = limpia(c)
            if s and s not in IGNORAR and (f.startswith(carpeta) or s in ingles):
                mete(s, None, f)
        # …y lo que va en los dos idiomas a mano.
        for es, en in extrae_js(src):
            mete(es, en, f)
    for es, en in extrae_html((ROOT / carpeta / 'index.html').read_text(encoding='utf-8')):
        mete(es, en, f'{carpeta}/index.html')
    if area == 'panel':
        for es, en in extrae_ideas(ROOT / 'panel/ideas.js'):
            mete(es, en, 'panel/ideas.js')
    # Lo que es el lado inglés de algo (y no es a la vez una clave española
    # del diccionario) no es un texto que traducir.
    ya_ingles = {v for v, _ in todo.values() if v} - set(ingles)
    return {k: v for k, v in todo.items() if k not in ya_ingles}


HUECO = re.compile(r'\{\w+\}')


def main_nuevos(areas: list[str], langs: list[str]) -> int:
    como_json = '--json' in sys.argv
    total = 0
    union: dict[str, str | None] = {}
    for area in areas:
        todo = textos_area(area)
        for lang in langs:
            ya = dic_nuevo(ROOT / NUEVAS_AREAS[area][3] / f'{lang}.js')
            # Los huecos casan por posición, no por nombre (klTraductor en
            # assets/i18n.js): «Hasta {n}» ya vale para «Hasta {s}».
            ya_huecos = {HUECO.sub('{}', k) for k in ya}
            faltan = {k: v for k, v in todo.items() if k not in ya and HUECO.sub('{}', k) not in ya_huecos}
            total += len(faltan)
            for k, (en, _) in faltan.items():
                if union.get(k) is None:
                    union[k] = en
            if not como_json:
                if '--todo' in sys.argv:
                    for k, (_, f) in faltan.items():
                        print(f'{area}/{lang} {f}: {k}')
                print(f'{area}/{lang}: faltan {len(faltan)} de {len(todo)} texto(s).')
    if como_json:
        print(json.dumps(union, ensure_ascii=False, indent=2))
    elif total and '--todo' not in sys.argv:
        print('(con --todo, la lista; con --json, {español: inglés} para los traductores)')
    return 1 if total else 0


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    lang = None
    if '--lang' in sys.argv:
        k = sys.argv.index('--lang')
        lang = sys.argv[k + 1] if k + 1 < len(sys.argv) else 'all'
        args = [a for a in args if a != lang]
    if lang:
        langs = NUEVOS if lang == 'all' else [lang]
        if any(x not in NUEVOS for x in langs):
            raise SystemExit(f'Idiomas nuevos: {", ".join(NUEVOS)} o all.')
        areas = args or list(NUEVAS_AREAS)
        if any(a not in NUEVAS_AREAS for a in areas):
            raise SystemExit('Con --lang, las áreas son cuenta y panel (el admin va solo en español e inglés).')
        sys.exit(main_nuevos(areas, langs))
    sys.exit(main_ingles(args[0] if args else 'panel'))


if __name__ == '__main__':
    main()
