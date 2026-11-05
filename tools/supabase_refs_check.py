"""Ninguna prueba de tools/ nombra un proyecto de Supabase (Iván, 2026-11-05).

Desde el 4-11 la web llama a producción. Las pruebas leen el proyecto de
config.js y simulan Supabase con tools/_supabase_simulado.mjs, que además
corta lo que no simulen. Falla si en tools/:
  - un fichero que no sea el helper lleva escrito el ref de dev o el de prod
    (una prueba con el ref a mano simula el proyecto equivocado y lo que no
    intercepta va a la red de verdad);
  - una prueba carga Playwright por su cuenta en vez de con `playwright()`
    del helper (sus contextos no tendrían la red de seguridad).

Sin navegador ni red: solo lee los ficheros. Va en el pre-push.

Uso: python tools/supabase_refs_check.py
"""
import os
import re
import sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
HELPER = '_supabase_simulado.mjs'
YO = os.path.basename(__file__)
REFS = re.compile('dpbbtgwxrlqlplbrtjuq|hcxurneiftwyxuebpndf')
# Playwright cargado a mano: require/import de 'playwright' (o el PW=ruta).
PW_A_MANO = re.compile(r"""(require\(\s*process\.env\.PW|\)\(\s*process\.env\.PW|require\(\s*['"]playwright(-core)?['"]|from\s+['"]playwright(-core)?['"])""")
SALTAR = {'out', 'fonts', 'node_modules', '__pycache__'}

malos = []
for raiz, dirs, ficheros in os.walk(TOOLS):
    dirs[:] = [d for d in dirs if d not in SALTAR]
    for f in ficheros:
        if f in (HELPER, YO):
            continue
        ruta = os.path.join(raiz, f)
        try:
            with open(ruta, encoding='utf-8') as fh:
                texto = fh.read()
        except (UnicodeDecodeError, OSError):
            continue  # binarios (capturas, fuentes)
        rel = os.path.relpath(ruta, os.path.dirname(TOOLS)).replace(os.sep, '/')
        for n, linea in enumerate(texto.splitlines(), 1):
            if REFS.search(linea):
                malos.append(f'{rel}:{n}: ref de Supabase escrito a mano (usa REF/SUPA de tools/{HELPER})')
            if f.endswith(('.mjs', '.js', '.cjs')) and PW_A_MANO.search(linea):
                malos.append(f'{rel}:{n}: Playwright cargado a mano (usa playwright() de tools/{HELPER})')

if malos:
    print('supabase_refs_check: las pruebas no pueden apuntar a mano a un Supabase:')
    for m in malos:
        print('  ' + m)
    sys.exit(1)
print('supabase_refs_check: ok')
