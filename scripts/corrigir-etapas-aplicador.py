#!/usr/bin/env python3
"""Publica o filtro de etapas do projeto, preservando dados e configurações."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request


APP = Path('/opt/projeto_piloto_app/app')
SOURCE = APP / 'backend/src/routes/superadmin.ts'
CONTAINER = 'app-backend-prod-1'
FILTER = """'PJINSTFONI'
            AND EXISTS (
              SELECT 1 FROM public.etapas etapa_projeto
              WHERE etapa_projeto.id_etapa = t.id_etapa
                AND etapa_projeto.projeto = 'PJINSTFONI'
            )"""


def run(*args, capture=False):
    return subprocess.run(args, cwd=APP, check=True, text=True,
                          stdout=subprocess.PIPE if capture else None).stdout


def patch(source):
    start = source.index("'/aplicador/escolas'")
    end = source.index("'/aplicador/acompanhamento'", start)
    section = source[start:end]
    if section.count('etapa_projeto.projeto') == 6:
        return source
    if 'etapa_projeto' in section or section.count("'PJINSTFONI'") != 6:
        raise RuntimeError('Código diferente do conferido: nenhuma alteração aplicada.')
    return source[:start] + section.replace("'PJINSTFONI'", FILTER) + source[end:]


def check_health():
    for _ in range(20):
        try:
            urllib.request.urlopen('http://127.0.0.1:5173/api/turmas', timeout=3)
        except urllib.error.HTTPError as exc:
            if exc.code == 401:
                return
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(2)
    raise RuntimeError('A API não respondeu com o status esperado após a publicação.')


def main():
    if os.geteuid() != 0:
        raise SystemExit('Execute com sudo python3 para acessar os arquivos e o Docker.')
    if '192.168.0.122' not in subprocess.check_output(['hostname', '-I'], text=True).split():
        raise SystemExit('Este script só pode ser executado no servidor de produção 192.168.0.122.')
    original = SOURCE.read_text()
    updated = patch(original)
    run('docker', 'compose', '--profile', 'prod', 'config', '--quiet')
    if updated == original:
        deployed = run('docker', 'exec', CONTAINER, 'node', '-e',
                       "const fs=require('fs');const s=fs.readFileSync('dist/routes/superadmin.js','utf8');"
                       r"console.log((s.match(/etapa_projeto\.projeto/g)||[]).length)",
                       capture=True).strip()
        if deployed == '6':
            raise SystemExit('O filtro já está publicado; nenhuma alteração adicional realizada.')
    old_image = run('docker', 'inspect', '--format', '{{.Image}}', CONTAINER, capture=True).strip()
    backup = Path(tempfile.mkdtemp(prefix='fonica-etapas-backup-'))
    shutil.copy2(SOURCE, backup / 'superadmin.ts')
    (backup / 'rollback.json').write_text(json.dumps({'services': {
        'backend-prod': {'image': old_image}}}))
    print('Backup:', backup, flush=True)
    switched = False
    try:
        SOURCE.write_text(updated)
        run('docker', 'compose', '--profile', 'prod', 'build', 'backend-prod')
        run('docker', 'compose', '--profile', 'prod', 'run', '--rm', '--no-deps',
            '--entrypoint', 'node', 'backend-prod', '--check', 'dist/routes/superadmin.js')
        switched = True
        run('docker', 'compose', '--profile', 'prod', 'up', '-d', '--no-deps', 'backend-prod')
        run('docker', 'compose', '--profile', 'prod', 'restart', 'frontend-prod')
        check_health()
        run('docker', 'exec', CONTAINER, 'node', '-e',
            "const fs=require('fs');const s=fs.readFileSync('dist/routes/superadmin.js','utf8');"
            r"if((s.match(/etapa_projeto\.projeto/g)||[]).length!==6)process.exit(1)")
        print('Publicado: atribuição e acompanhamento consideram somente as etapas do projeto.')
    except BaseException:
        shutil.copy2(backup / 'superadmin.ts', SOURCE)
        if switched:
            command = ['docker', 'compose', '-f', 'compose.yml']
            if (APP / 'compose.override.yml').exists():
                command += ['-f', 'compose.override.yml']
            command += ['-f', str(backup / 'rollback.json'), '--profile', 'prod',
                        'up', '-d', '--no-deps', 'backend-prod']
            run(*command)
            run('docker', 'compose', '--profile', 'prod', 'restart', 'frontend-prod')
        print('Publicação interrompida; código anterior restaurado. Backup:', backup)
        raise


if __name__ == '__main__':
    main()
