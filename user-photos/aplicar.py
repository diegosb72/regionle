#!/usr/bin/env python3
"""Copia la entrega acumulada sin sobrescribir fichas o fotos divergentes."""
import argparse, hashlib, json, pathlib, shutil
parser=argparse.ArgumentParser();parser.add_argument('proyecto',type=pathlib.Path);args=parser.parse_args()
root=args.proyecto.resolve();src=pathlib.Path(__file__).resolve().parent
if not (root/'src/lib/profiles.ts').exists():parser.error('No parece un clon de Regionle')
m=json.loads((src/'MANIFIESTO.json').read_text());problems=[]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for code,info in m['paises'].items():
 target=root/'public/data/profiles'/f'{code}.json'
 accepted={info['original_sha256'],info['final_sha256']}
 if info.get('anterior07_sha256'):accepted.add(info['anterior07_sha256'])
 if info.get('anterior06_sha256'):accepted.add(info['anterior06_sha256'])
 if info.get('anterior04_sha256'):accepted.add(info['anterior04_sha256'])
 if info.get('tanda1_sha256'):accepted.add(info['tanda1_sha256'])
 if info.get('tanda2_sha256'):accepted.add(info['tanda2_sha256'])
 if not target.is_file() or sha(target) not in accepted:problems.append(str(target))
for file in (src/'public/photos').iterdir():
 target=root/'public/photos'/file.name
 if target.exists() and (not target.is_file() or sha(target)!=sha(file)):problems.append(str(target))
if problems:
 print('No se ha copiado nada: hay diferencias que revisar:');print('\n'.join(' - '+v for v in problems));raise SystemExit(1)
count=0
for sub in ('data/profiles','photos'):
 for file in (src/'public'/sub).iterdir():
  target=root/'public'/sub/file.name;target.parent.mkdir(parents=True,exist_ok=True)
  if not target.exists() or sha(target)!=sha(file):shutil.copy2(file,target);count+=1
print(f'Aplicados {len(m["paises"])} perfiles; {count} archivos copiados.')
