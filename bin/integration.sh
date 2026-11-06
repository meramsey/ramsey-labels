#!/usr/bin/env bash
set -euo pipefail
docker compose run --rm cli wp eval-file wp-content/plugins/ramsey-labels-independent/tests/Integration/run.php
