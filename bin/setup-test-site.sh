#!/usr/bin/env bash
set -euo pipefail
if ! docker compose run --rm cli wp core is-installed; then
    docker compose run --rm cli wp core install --url="http://127.0.0.1:${TEST_PORT:-18885}" --title='Synthetic Labels Test' --admin_user=labels_admin --admin_password=local-test-only-password --admin_email=labels@example.test --skip-email
fi
docker compose run --rm cli wp eval 'if(wp_get_environment_type()!=="local" || get_bloginfo("name")!=="Synthetic Labels Test")throw new RuntimeException("Isolated fixture site required");'
docker compose run --rm cli wp plugin install woocommerce --version="${WC_VERSION:-11.2.2}" --force --activate
docker compose run --rm cli wp plugin activate ramsey-labels-independent
docker compose run --rm cli wp plugin install plugin-check --version=2.1.0 --activate
