"""El único indicador de carga es la aguja de Klendar (Iván, 2026-10-28).

Falla si en el CSS, el JavaScript o el HTML de la web aparece otro:
  - una animación sin fin que no sea de las permitidas (la aguja, el brillo
    de los esqueletos, el punto «en vivo» que respira);
  - una rueda hecha con bordes (`border-right-color: transparent` girando);
  - una barra `<progress>` sin valor (con valor es progreso real y vale);
  - (§4zzz-cargas, 26-11) también: la animación sin fin escrita por partes
    (`animation-name` + `animation-iteration-count: infinite`) o con
    `infinite` delante del nombre; una animación sin fin desde JavaScript
    (`.animate(…, { iterations: Infinity })`) que no sea la aguja (lo dice un
    comentario con «aguja» justo encima); un SVG animado (SMIL,
    `repeatCount="indefinite"`); un GIF; y `.mov-cargando` en algo que no es
    el SVG de la aguja (se veía una caja vacía: panel/foto.js).

Lo que tiene forma conocida carga con esqueleto (`.loading`, `.esq`) y lo
instantáneo, sin nada (GLOSARIO, «Movimiento»).

Uso: python tools/indicadores_check.py   (va en el pre-push)
     python tools/indicadores_check.py --prueba   (se prueba a sí mismo)
"""
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SALTAR = {'node_modules', '.git', '.wrangler', 'vendor', 'fonts'}

PERMITIDAS = {
    'mov-gira',        # la aguja: botón ocupado, foto que se sube
    'mov-aguja-gira',  # la aguja suelta («Cargando…» de «Tu cuenta»)
    'mov-brillo',      # el brillo de los esqueletos
    'mov-respira',     # «Abierto» / en vivo: no es carga
}
# (Fuera el 26-11: `pulse`, de un `.sk` del admin que ya no usaba nadie, y
# `float`, que no es una animación sin fin.)

# Lo que no es un nombre en el atajo `animation:` (tiempos, curvas, cuántas
# veces, sentido, relleno, estado).
NO_NOMBRE = re.compile(
    r'^(-?[\d.]+m?s|[\d.]+|infinite|linear|ease(-in|-out|-in-out)?|step-start|step-end|'
    r'steps\(.*|cubic-bezier\(.*|var\(.*|normal|reverse|alternate(-reverse)?|none|'
    r'forwards|backwards|both|running|paused|initial|inherit|unset|!important)$')
ATAJO = re.compile(r'animation:\s*([^;}"`]+)')
POR_PARTES = re.compile(r'\{([^{}]*animation-iteration-count:\s*infinite[^{}]*)\}')
NOMBRE = re.compile(r'animation-name:\s*([\w-]+)')
JS_SIN_FIN = re.compile(r'\.animate\([^;]*iterations:\s*Infinity')
SMIL = re.compile(r'repeatCount=["\']indefinite')
GIF = re.compile(r'["\'(/][\w./-]*\.gif\b', re.I)
CARGANDO_SIN_SVG = re.compile(r'<(?!svg\b)[a-z]+\b[^>]*class="[^"]*\bmov-cargando\b')
RUEDA = re.compile(r'border-right-color:\s*transparent[^}]*animation|animation[^}]*border-right-color:\s*transparent')
PROGRESO = re.compile(r'<progress(?![^>]*\bvalue=)[^>]*>')


def nombres_sin_fin(valor):
    """Los nombres de las animaciones sin fin de un atajo `animation:`."""
    for parte in re.split(r',(?![^(]*\))', valor):
        fichas = re.findall(r'[\w.!-]+\([^)]*\)|\S+', parte.strip())
        if 'infinite' not in fichas:
            continue
        for f in fichas:
            if not NO_NOMBRE.match(f):
                yield f
                break


def revisa(rel, texto):
    """Los fallos de un fichero (su ruta relativa y su texto)."""
    fallos = []

    def linea(i):
        return texto.count('\n', 0, i) + 1

    for m in ATAJO.finditer(texto):
        for nombre in nombres_sin_fin(m.group(1)):
            if nombre not in PERMITIDAS:
                fallos.append(f'{rel}:{linea(m.start())} animación sin fin «{nombre}» (¿un indicador de carga?)')
    for m in POR_PARTES.finditer(texto):
        for nombre in NOMBRE.findall(m.group(1)):
            if nombre not in PERMITIDAS:
                fallos.append(f'{rel}:{linea(m.start())} animación sin fin «{nombre}» por partes (¿un indicador de carga?)')
    for m in JS_SIN_FIN.finditer(texto):
        # Lo de justo encima (unas líneas): ahí dice si es la aguja.
        encima = texto[max(0, m.start() - 600):m.start()]
        if 'aguja' not in encima:
            fallos.append(f'{rel}:{linea(m.start())} animación sin fin desde JavaScript (si es la aguja, dilo en un comentario encima)')
    for m in SMIL.finditer(texto):
        fallos.append(f'{rel}:{linea(m.start())} SVG animado sin fin (SMIL)')
    for m in GIF.finditer(texto):
        fallos.append(f'{rel}:{linea(m.start())} GIF (¿una rueda de carga?)')
    for m in CARGANDO_SIN_SVG.finditer(texto):
        fallos.append(f'{rel}:{linea(m.start())} .mov-cargando sin el SVG de la aguja (se ve una caja vacía)')
    for m in RUEDA.finditer(texto):
        fallos.append(f'{rel}:{linea(m.start())} rueda de carga con bordes')
    for m in PROGRESO.finditer(texto):
        fallos.append(f'{rel}:{linea(m.start())} <progress> sin valor')
    return fallos


def prueba():
    """Lo que debe fallar falla y lo permitido pasa (por si se rompe una regex)."""
    malos = {
        'atajo': '.x { animation: gira 1s linear infinite; }',
        'infinite delante': '.x { animation: infinite 1s gira; }',
        'por partes': '.x { animation-name: gira; animation-iteration-count: infinite; }',
        'js': 'el.animate([{ transform: "rotate(1turn)" }], { duration: 1000, iterations: Infinity });',
        'smil': '<animateTransform attributeName="transform" repeatCount="indefinite"/>',
        'gif': '<img src="/assets/cargando.gif">',
        'caja vacía': '<div class="mov-cargando foto-aguja" aria-hidden="true"></div>',
        'rueda': '.r { border-right-color: transparent; animation: mov-gira 1s linear infinite; }',
        'progress': '<progress></progress>',
    }
    buenos = {
        'aguja': '.a::after { animation: mov-gira 1s linear infinite; }',
        'brillo': '.e::after { animation: mov-brillo 1.4s ease-in-out infinite; }',
        'una vez': '.f { animation: mov-funde 200ms ease 200ms backwards; }',
        'js aguja': '// La aguja del logo gira mientras recarga\nag.animate([], { iterations: Infinity });',
        'svg aguja': '<svg class="mov-cargando" viewBox="0 0 64 64"></svg>',
        'progreso real': '<progress value="3" max="10"></progress>',
    }
    mal = [k for k, t in malos.items() if not revisa('x', t)] + [k for k, t in buenos.items() if revisa('x', t)]
    if mal:
        print('indicadores_check: la prueba falla en: ' + ', '.join(mal))
        sys.exit(1)


prueba()
if '--prueba' in sys.argv:
    print('indicadores_check: la prueba pasa.')
    sys.exit(0)

fallos = []
for raiz, dirs, archivos in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in SALTAR]
    for a in archivos:
        if not a.endswith(('.css', '.js', '.html', '.mjs')) or a.endswith('.min.js'):
            continue
        ruta = os.path.join(raiz, a)
        rel = os.path.relpath(ruta, ROOT).replace('\\', '/')
        if rel.startswith('tools/'):
            continue
        with open(ruta, encoding='utf-8', errors='replace') as f:
            fallos += revisa(rel, f.read())

if fallos:
    print('Indicadores de carga que no son la aguja de Klendar:')
    for f in fallos:
        print('  ' + f)
    sys.exit(1)
print('Indicadores de carga: solo la aguja de Klendar y los esqueletos.')
