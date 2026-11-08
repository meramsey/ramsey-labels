#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
import hashlib, pathlib, zipfile
p=pathlib.Path('ramsey-labels-independent-1.0.0-rc8.zip')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='b62a94518299b891cb125590df96f8f4830f4e552a659eb9c7935f54769a01ef'
with zipfile.ZipFile(p) as z:
    for name in z.namelist():
        assert '..' not in pathlib.PurePosixPath(name).parts and not name.startswith('/')
    z.extractall('build/rc8')
PY
docker compose run --rm cli wp --skip-plugins=ramsey-labels-independent eval-file wp-content/plugins/ramsey-labels-independent/tests/Integration/upgrade.php seed
docker compose run --rm cli wp eval-file wp-content/plugins/ramsey-labels-independent/tests/Integration/upgrade.php verify
python3 - <<'PY'
import hashlib,pathlib,zipfile
p=pathlib.Path('tests/Fixtures/rc9.zip');assert hashlib.sha256(p.read_bytes()).hexdigest()=='8c369220c6a15286ae38ac1b4f5f3097a3f44b70562169b822d7beef7ae7afdd'
with zipfile.ZipFile(p) as z:
    for name in z.namelist():assert '..' not in pathlib.PurePosixPath(name).parts and not name.startswith('/')
    z.extractall('build/rc9')
PY
docker compose run --rm cli wp --skip-plugins=ramsey-labels-independent eval-file wp-content/plugins/ramsey-labels-independent/tests/Integration/upgrade.php seed-rc9
docker compose run --rm cli wp eval-file wp-content/plugins/ramsey-labels-independent/tests/Integration/upgrade.php verify
python3 - <<'PY'
import hashlib,pathlib,zipfile
p=pathlib.Path('tests/Fixtures/rc10.zip');assert hashlib.sha256(p.read_bytes()).hexdigest()=='cd2aa1ebc95c54a972421ae1ce19746d26a52a60374cb6b6a1a04126014c849a'
with zipfile.ZipFile(p) as z:
    for name in z.namelist():assert '..' not in pathlib.PurePosixPath(name).parts and not name.startswith('/')
    z.extractall('build/rc10')
PY
docker compose run --rm cli wp --skip-plugins=ramsey-labels-independent eval-file wp-content/plugins/ramsey-labels-independent/tests/Integration/upgrade.php seed-rc10
docker compose run --rm cli wp eval-file wp-content/plugins/ramsey-labels-independent/tests/Integration/upgrade.php verify
