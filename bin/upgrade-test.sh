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
