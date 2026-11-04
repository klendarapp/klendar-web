"""El pre-push no deja cambiar de Supabase (dev ↔ prod) por accidente.

Lee del pre-push las líneas `<ref local> <sha local> <ref remota> <sha remota>`
(por la entrada) y, para lo que va a `main`:

1. Si `config.js` apunta a otro proyecto que lo que ya hay en `main`, se
   niega salvo con `KLENDAR_CAMBIO_ENTORNO=1` (el paso a prod y la marcha
   atrás, docs/RUNBOOK.md «Pasar la web a prod»). Así un agente con una rama
   vieja, o un cambio a mano, no publica la web contra otro Supabase.
2. `config.js` y `functions/_lib/page.js` tienen que ir al mismo proyecto
   (si no, las fichas y «Tu cuenta» verían bases distintas).
3. La clave de Turnstile de `config.js` y los textos legales D29–D31
   (`TURNSTILE_DESDE` de build_legal.py) van juntos: con clave, textos; sin
   clave, sin textos.

Sin nada en la entrada (p. ej. `python tools/entorno_check.py < /dev/null`)
comprueba solo 2 y 3 sobre HEAD.
"""
import os
import re
import subprocess
import sys

CERO = '0' * 40
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def show(sha, ruta):
    r = subprocess.run(['git', 'show', f'{sha}:{ruta}'], capture_output=True, text=True,
                       encoding='utf-8', errors='replace')
    return r.stdout if r.returncode == 0 else None


def proyecto(texto):
    m = re.search(r"https://([a-z0-9]{20})\.supabase\.co", texto or '')
    return m.group(1) if m else None


def coherente(sha):
    cfg, page, legal = show(sha, 'config.js'), show(sha, 'functions/_lib/page.js'), show(sha, 'build_legal.py')
    fallos = []
    if cfg is None or page is None or legal is None:
        return fallos
    if proyecto(cfg) != proyecto(page):
        fallos.append(f'config.js va a {proyecto(cfg)} y functions/_lib/page.js a {proyecto(page)}: '
                      'tienen que ir al mismo Supabase (python tool/pasar_a_prod.py web en el repo de la app).')
    m = re.search(r"turnstile:\s*'([^']*)'", cfg)
    clave = bool(m and m.group(1).strip())
    t = re.search(r'^TURNSTILE_DESDE\s*=\s*(\S+)', legal, re.M)
    textos = bool(t and t.group(1) != 'None')
    if t and clave != textos:
        fallos.append('config.js ' + ('lleva' if clave else 'no lleva') + ' clave de Turnstile pero '
                      'TURNSTILE_DESDE de build_legal.py ' + ('no tiene fecha' if clave else 'sí')
                      + ': la clave y los textos D29–D31 van juntos (RUNBOOK §0d, paso 7).')
    return fallos


def main():
    lineas = [l.split() for l in sys.stdin.read().splitlines() if l.strip()] if not sys.stdin.isatty() else []
    shas = []
    fallos = []
    for partes in lineas:
        if len(partes) != 4:
            continue
        _, local, remota, sha_remoto = partes
        if remota != 'refs/heads/main' or local == CERO:
            continue
        shas.append(local)
        antes = show(sha_remoto, 'config.js') if sha_remoto != CERO else None
        if antes is None:
            antes = show('origin/main', 'config.js')
        despues = show(local, 'config.js')
        a, d = proyecto(antes), proyecto(despues)
        if a and d and a != d and os.environ.get('KLENDAR_CAMBIO_ENTORNO') != '1':
            fallos.append(f'config.js cambia de Supabase ({a} → {d}). Si es el paso a prod o la marcha '
                          'atrás, repite con KLENDAR_CAMBIO_ENTORNO=1 (docs/RUNBOOK.md, «Pasar la web a '
                          'prod»); si no, quita ese cambio de la rama.')
    for sha in shas or ['HEAD']:
        fallos += coherente(sha)
    for f in fallos:
        print('entorno: ' + f)
    return 1 if fallos else 0


if __name__ == '__main__':
    sys.exit(main())
