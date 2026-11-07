#!/usr/bin/env python3
"""Check locked developer package licenses; never ship these dependencies."""
import json
import pathlib

root=pathlib.Path(__file__).resolve().parent.parent
approved={'MIT','ISC','BSD-2-Clause','BSD-3-Clause','Apache-2.0','CC0-1.0',
          'GPL-2.0-or-later','GPL-3.0-or-later','LGPL-2.1-or-later',
          'LGPL-2.1','LGPL-2.1+','LGPL-3.0-or-later','MPL-2.0','Python-2.0','CC-BY-3.0','BlueOak-1.0.0',
          '(MIT OR CC0-1.0)','(MIT AND Zlib)','(MIT AND BSD-3-Clause)'}
findings=[]
node=json.loads((root/'package-lock.json').read_text())
for name,package in node['packages'].items():
    if not name: continue
    metadata=root/name/'package.json'
    license=package.get('license') or (json.loads(metadata.read_text()).get('license','UNKNOWN') if metadata.exists() else 'UNKNOWN')
    if name=='node_modules/fsevents' and not metadata.exists():
        # Optional macOS-only package; verify the locked version's registry metadata.
        import urllib.request
        with urllib.request.urlopen('https://registry.npmjs.org/fsevents/'+package['version'],timeout=20) as response:
            license=json.load(response).get('license','UNKNOWN')
    if license not in approved: findings.append(f'{name}: {license}')
composer=json.loads((root/'composer.lock').read_text())
for package in composer['packages']+composer['packages-dev']:
    for license in package.get('license',['UNKNOWN']):
        if license not in approved: findings.append(f"{package['name']}: {license}")
if findings: raise SystemExit('\n'.join(findings))
print(f"PASS: license metadata allowlist for {len(node['packages'])-1} npm and {len(composer['packages'])+len(composer['packages-dev'])} Composer development packages")
print('Runtime dependencies: none; RC8 provenance still requires owner attestation (docs/provenance.md).')
