#!/usr/bin/env bash
set -euo pipefail
mkdir -p build/reports
docker compose -f compose.package.yaml up -d --wait wordpress
if ! docker compose -f compose.package.yaml run --rm cli wp core is-installed; then
    docker compose -f compose.package.yaml run --rm cli wp core install --url=http://127.0.0.1:18887 --title='Synthetic Labels Package Test' --admin_user=labels_admin --admin_password=local-test-only-password --admin_email=labels@example.test --skip-email
fi
docker compose -f compose.package.yaml run --rm cli wp plugin install woocommerce --version=11.2.2 --activate
docker compose -f compose.package.yaml run --rm cli wp plugin install /evidence/build/ramsey-labels-independent-1.0.0-rc.9.zip --force --activate
docker compose -f compose.package.yaml run --rm cli wp plugin install plugin-check --version=2.1.0 --activate
docker compose -f compose.package.yaml run --rm cli wp plugin is-active ramsey-labels-independent
docker compose -f compose.package.yaml run --rm cli wp plugin check ramsey-labels-independent --format=json > build/reports/package-plugin-check.txt
python3 bin/assert-plugin-check.py build/reports/package-plugin-check.txt
