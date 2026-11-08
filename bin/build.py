#!/usr/bin/env python3
"""Deterministic, allowlisted WordPress RC builder; no network/publish operations."""
import hashlib
import json
import pathlib
import re
import subprocess
import zipfile
import hashlib as _hashlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SLUG = 'ramsey-labels-independent'  # Retain the RC8 installation basename.
MANIFEST = [
    'ramsey-labels-independent.php', 'uninstall.php', 'readme.txt', 'LICENSE',
    'includes/Data.php', 'includes/Migration.php', 'includes/NetworkJobs.php', 'includes/Plugin.php',
    'includes/Schema.php', 'includes/Store.php', 'includes/class-privacy.php',
    'assets/app.js', 'assets/core.js', 'assets/render.js', 'assets/barcodes.js',
    'assets/symbol-tables.js', 'assets/integrations.js', 'assets/defaults.json',
    'assets/app.css', 'assets/batches.js',
    'languages/ramsey-labels-independent.pot',
]


def main():
    header = (ROOT / MANIFEST[0]).read_text()
    version = re.search(r'\* Version:\s*(\S+)', header).group(1)
    assert re.fullmatch(r'[\w.-]+', version)
    with zipfile.ZipFile(ROOT/'tests/Fixtures/rc9.zip') as archive:
        assert archive.testzip() is None
        assert 'ramsey-labels-independent/ramsey-labels-independent.php' in archive.namelist()
        main_file=archive.read('ramsey-labels-independent/ramsey-labels-independent.php').decode()
        assert re.search(r'\* Version:\s*1\.0\.0-rc\.9',main_file)
        assert _hashlib.sha256((ROOT/'tests/Fixtures/rc9.zip').read_bytes()).hexdigest()=='8c369220c6a15286ae38ac1b4f5f3097a3f44b70562169b822d7beef7ae7afdd'
    with zipfile.ZipFile(ROOT/'tests/Fixtures/rc10.zip') as archive:
        assert archive.testzip() is None
        assert 'ramsey-labels-independent/ramsey-labels-independent.php' in archive.namelist()
        assert re.search(r'\* Version:\s*1\.0\.0-rc\.10',archive.read('ramsey-labels-independent/ramsey-labels-independent.php').decode())
        assert _hashlib.sha256((ROOT/'tests/Fixtures/rc10.zip').read_bytes()).hexdigest()=='cd2aa1ebc95c54a972421ae1ce19746d26a52a60374cb6b6a1a04126014c849a'
    assert f"define( 'RLI_VERSION', '{version}' )" in header
    assert json.loads((ROOT / 'package.json').read_text())['version'] == version
    assert f'Stable tag: {version}' in (ROOT / 'readme.txt').read_text()
    tested = re.search(r'^Tested up to: (.+)$', (ROOT / 'readme.txt').read_text(), re.M).group(1)
    assert re.fullmatch(r'\d+\.\d+', tested), 'WordPress.org Tested up to must use the major release, not patch level'
    out = ROOT / 'build'
    out.mkdir(exist_ok=True)
    target = out / f'{SLUG}-{version}.zip'
    files = {}
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in sorted(MANIFEST):
            data = (ROOT / name).read_bytes()
            assert not any(s in data for s in [b'/home/', b'localhost.localdomain', b'BEGIN PRIVATE KEY'])
            info = zipfile.ZipInfo(f'{SLUG}/{name}', (2020, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)
            files[name] = hashlib.sha256(data).hexdigest()
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        assert sorted(archive.namelist()) == sorted(f'{SLUG}/{n}' for n in MANIFEST)
        assert all('..' not in pathlib.PurePosixPath(n).parts for n in archive.namelist())
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    target.with_suffix('.zip.sha256').write_text(f'{digest}  {target.name}\n')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    (out / 'artifact-manifest.json').write_text(json.dumps({'version': version, 'commit': commit, 'archive': target.name, 'sha256': digest, 'files': files}, indent=2) + '\n')
    print(f'{target.relative_to(ROOT)}\nSHA-256 {digest}\n{len(files)} allowlisted files; runtime dependencies: none')


if __name__ == '__main__':
    main()
