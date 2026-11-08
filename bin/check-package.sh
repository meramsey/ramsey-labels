#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${CHROME_PATH:-}" ]]; then
    playwright_chrome="$(node -e 'process.stdout.write(require("@playwright/test").chromium.executablePath())')"
    if [[ -x "$playwright_chrome" ]]; then export CHROME_PATH="$playwright_chrome";
    elif [[ -x /usr/bin/google-chrome ]]; then export CHROME_PATH=/usr/bin/google-chrome;
    else npx playwright install chromium; export CHROME_PATH="$playwright_chrome"; fi
fi
mkdir -p build/reports
port=${PACKAGE_PORT:-18887}
docker compose -f compose.package.yaml up -d --wait wordpress
if ! docker compose -f compose.package.yaml run --rm cli wp core is-installed; then
    docker compose -f compose.package.yaml run --rm cli wp core install --url="http://127.0.0.1:${port}" --title='Synthetic Labels Package Test' --admin_user=labels_admin --admin_password=local-test-only-password --admin_email=labels@example.test --skip-email
fi
docker compose -f compose.package.yaml run --rm cli wp plugin install woocommerce --version=11.2.2 --activate
docker compose -f compose.package.yaml run --rm cli wp option update blogname 'Synthetic Labels Test'
docker compose -f compose.package.yaml run --rm cli wp option update home "http://127.0.0.1:${port}"
docker compose -f compose.package.yaml run --rm cli wp option update siteurl "http://127.0.0.1:${port}"
version=$(python3 -c "import json;print(json.load(open('package.json'))['version'])")
docker compose -f compose.package.yaml run --rm cli wp plugin install "/evidence/build/ramsey-labels-independent-${version}.zip" --force --activate
docker compose -f compose.package.yaml run --rm cli wp plugin install plugin-check --version=2.1.0 --activate
docker compose -f compose.package.yaml run --rm cli wp plugin is-active ramsey-labels-independent
docker compose -f compose.package.yaml run --rm cli wp eval '$m=json_decode(file_get_contents("/evidence/build/artifact-manifest.json"),true);foreach($m["files"] as $f=>$h)if(hash_file("sha256",WP_PLUGIN_DIR."/ramsey-labels-independent/".$f)!==$h)throw new RuntimeException("Installed candidate differs from manifest: ".$f);echo "PASS: every installed runtime file matches the checked candidate manifest\n";'
docker compose -f compose.package.yaml run --rm cli wp eval-file /evidence/tests/Integration/run.php
TEST_PORT="$port" npm run test:e2e
node bin/check-pdf.cjs
docker compose -f compose.package.yaml run --rm cli wp plugin check ramsey-labels-independent --format=json > build/reports/package-plugin-check.txt
python3 bin/assert-plugin-check.py build/reports/package-plugin-check.txt
