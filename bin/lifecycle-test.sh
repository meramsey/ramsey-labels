#!/usr/bin/env bash
set -euo pipefail
docker compose run --rm cli wp eval 'if(wp_get_environment_type()!=="local" || get_bloginfo("name")!=="Synthetic Labels Test")throw new RuntimeException("Isolated fixture site required");'
before=$(docker compose run --rm cli wp eval 'echo hash("sha256",serialize(get_option("rli_v1_library")));')
docker compose run --rm cli wp plugin deactivate ramsey-labels-independent
docker compose run --rm cli wp plugin activate ramsey-labels-independent
after=$(docker compose run --rm cli wp eval 'echo hash("sha256",serialize(get_option("rli_v1_library")));')
test "$before" = "$after"
echo 'PASS: activation and deactivation preserve exact serialized library'
trap 'docker compose run --rm cli wp plugin activate woocommerce >/dev/null' EXIT
docker compose run --rm cli wp plugin deactivate woocommerce
docker compose run --rm cli wp eval 'wp_set_current_user(get_user_by("login","labels_admin")->ID); $_GET["page"]="ramsey-labels"; ob_start(); RamseyLabels\Plugin::notices(); $notice=ob_get_clean(); if(strpos($notice,"WooCommerce is inactive")===false)throw new RuntimeException("Missing WooCommerce notice not shown"); echo "PASS: missing WooCommerce boots without fatal and displays actionable notice\n";'
