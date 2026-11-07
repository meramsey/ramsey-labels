#!/usr/bin/env bash
set -euo pipefail
project=${COMPOSE_PROJECT_NAME:-ramsey-labels-multisite-test}
cli(){ COMPOSE_PROJECT_NAME="$project" docker compose -f compose.multisite.yaml run --rm cli wp "$@"; }
COMPOSE_PROJECT_NAME="$project" docker compose -f compose.multisite.yaml up -d --wait wordpress
if ! cli core is-installed >/dev/null 2>&1; then
  cli core multisite-install --url=http://127.0.0.1:18890 --title='Synthetic Ramsey Network' --admin_user=labels_admin --admin_password=local-test-only-password --admin_email=labels@example.test --skip-email
fi
if ! cli site list --field=url | grep -q '/second/'; then cli site create --slug=second --title='Synthetic Second Site' --email=labels@example.test; fi
if ! cli plugin is-installed woocommerce >/dev/null 2>&1; then cli plugin install woocommerce --version=11.2.2; fi
cli plugin activate woocommerce --network
cli plugin activate ramsey-labels-independent --network
cli eval-file /var/www/html/wp-content/plugins/ramsey-labels-independent/tests/Integration/multisite.php
