import importlib.util
import json
import pathlib
import tempfile
import unittest
import datetime

spec = importlib.util.spec_from_file_location('coletor', pathlib.Path(__file__).with_name('coletar-armazenamento.py'))
coletor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coletor)

class ColetorTest(unittest.TestCase):
    def test_contagem_real_sem_links_ou_monitoramento(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            (root / 'a.webm').write_bytes(b'12345')
            (root / 'cronograma-fotos').mkdir()
            (root / 'cronograma-fotos/a.PNG').write_bytes(b'123')
            (root / 'nota.txt').write_bytes(b'x')
            (root / 'link.webm').symlink_to(root / 'a.webm')
            (root / 'atalho').symlink_to(root, target_is_directory=True)
            (root / '.monitoramento').mkdir()
            (root / '.monitoramento/ignorar.jpg').write_bytes(b'123')
            d = coletor.coletar(root, [('Mídias', root)])
            self.assertTrue(d['completo'])
            self.assertEqual(d['audios'], {'quantidade': 1, 'bytes': 5})
            self.assertEqual(d['fotos'], {'quantidade': 1, 'bytes': 3})
            self.assertEqual(d['outros'], {'quantidade': 1, 'bytes': 1})
            self.assertGreater(d['discos'][0]['total'], 0)
            destino = root / '.monitoramento/armazenamento.json'
            coletor.publicar(d, destino)
            self.assertEqual(json.loads(destino.read_text()), d)
            self.assertEqual(len(list(destino.parent.iterdir())), 2)
            self.assertEqual((root / 'a.webm').read_bytes(), b'12345')

    def test_historico_agrega_por_hora_sem_inventar_dados_passados(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            d = coletor.coletar(root, [('Disco', root)])
            destino = root / 'historico.json'
            d['coletadoEm'] = '2026-11-05T12:00:00+00:00'
            coletor.atualizar_historico(d, destino)
            d['audios']['quantidade'] = 4
            d['coletadoEm'] = '2026-11-05T12:05:00+00:00'
            coletor.atualizar_historico(d, destino)
            pontos = json.loads(destino.read_text())['pontos']
            self.assertEqual(len(pontos), 1)
            self.assertEqual(pontos[0]['audiosQuantidade'], 4)
            d['coletadoEm'] = '2026-11-05T13:05:00+00:00'
            coletor.atualizar_historico(d, destino)
            self.assertEqual(len(json.loads(destino.read_text())['pontos']), 2)
            d['coletadoEm'] = '2026-12-06T13:05:00+00:00'
            coletor.atualizar_historico(d, destino)
            self.assertEqual(len(json.loads(destino.read_text())['pontos']), 1)
            destino.write_text('{invalido')
            with self.assertRaises(ValueError):
                coletor.atualizar_historico(d, destino)
            self.assertEqual(destino.read_text(), '{invalido')

    def test_falha_nao_passa_por_coleta_completa(self):
        with tempfile.TemporaryDirectory() as temp:
            d = coletor.coletar(pathlib.Path(temp) / 'inexistente', [('Disco', '/caminho-inexistente-fonica')])
            self.assertFalse(d['completo'])
            self.assertGreater(d['falhas'], 0)
            self.assertEqual(d['discos'], [])

if __name__ == '__main__':
    unittest.main()
