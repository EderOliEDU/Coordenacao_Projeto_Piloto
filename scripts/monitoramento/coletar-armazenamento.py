#!/usr/bin/env python3
"""Coleta local, sem consultar conteúdos, seguir links ou alterar mídias."""
import argparse
import datetime
import json
import os
import pathlib
import tempfile

AUDIO = {'.webm', '.weba', '.wav', '.ogg', '.oga', '.mp3', '.m4a', '.mp4', '.aac', '.flac', '.opus'}
FOTO = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}

def coletar(raiz, pontos):
    raiz = pathlib.Path(raiz)
    grupos = {nome: {'quantidade': 0, 'bytes': 0} for nome in ('audios', 'fotos', 'outros')}
    erros = 0
    pastas = [raiz]
    while pastas:
        pasta = pastas.pop()
        try:
            with os.scandir(pasta) as entries:
                for entry in entries:
                    if entry.name == '.monitoramento':
                        continue
                    try:
                        if entry.is_symlink():
                            continue
                        if entry.is_dir(follow_symlinks=False):
                            pastas.append(pathlib.Path(entry.path))
                        elif entry.is_file(follow_symlinks=False):
                            stat = entry.stat(follow_symlinks=False)
                            ext = pathlib.Path(entry.name).suffix.lower()
                            grupo = 'audios' if ext in AUDIO else 'fotos' if ext in FOTO else 'outros'
                            grupos[grupo]['quantidade'] += 1
                            grupos[grupo]['bytes'] += stat.st_size
                    except OSError:
                        erros += 1
        except OSError:
            erros += 1
    discos = []
    for nome, caminho in pontos:
        try:
            stat = os.statvfs(caminho)
            total = stat.f_blocks * stat.f_frsize
            disponivel = stat.f_bavail * stat.f_frsize
            discos.append({'nome': nome, 'caminho': str(caminho), 'total': total,
                           'disponivel': disponivel, 'ocupado': total - disponivel,
                           'inodesTotal': stat.f_files, 'inodesLivres': stat.f_favail})
        except OSError:
            erros += 1
    return {'versao': 1, 'ambiente': 'producao', 'servidor': '192.168.0.121',
            'coletadoEm': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'completo': erros == 0, 'falhas': erros, **grupos, 'discos': discos}

def publicar(dados, destino):
    destino = pathlib.Path(destino)
    destino.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
    temp = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=destino.parent, delete=False) as arquivo:
            temp = arquivo.name
            json.dump(dados, arquivo, ensure_ascii=False)
            arquivo.flush()
            os.fsync(arquivo.fileno())
        os.chmod(temp, 0o644)
        os.replace(temp, destino)
    finally:
        if temp and os.path.exists(temp):
            os.unlink(temp)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--raiz', default='/opt/projeto_piloto_app/data/audios')
    parser.add_argument('--saida')
    args = parser.parse_args()
    raiz = pathlib.Path(args.raiz)
    dados = coletar(raiz, [('Armazenamento de áudios e fotos', raiz), ('Sistema do servidor', '/'), ('PostgreSQL', '/var/lib/postgresql')])
    publicar(dados, args.saida or raiz / '.monitoramento/armazenamento.json')
