#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${CHROME_PATH:-}" ]]; then
  playwright_chrome="$(node -e 'process.stdout.write(require("@playwright/test").chromium.executablePath())')"
  if [[ -x "$playwright_chrome" ]]; then export CHROME_PATH="$playwright_chrome";
  elif [[ -x /usr/bin/google-chrome ]]; then export CHROME_PATH=/usr/bin/google-chrome;
  else npx playwright install chromium; export CHROME_PATH="$playwright_chrome"; fi
fi
project=${COMPOSE_PROJECT_NAME:-ramsey-labels-public-migration}
port=${PACKAGE_PORT:-18888}
export PACKAGE_PORT="$port"
export COMPOSE_PROJECT_NAME="$project"
legacy_slug='ramsey-labels-independent'
public_slug='ramsey-labels'
version=$(node -p "require('./package.json').version")
archive="/evidence/build/public/${public_slug}-${version}.zip"
cli() { COMPOSE_PROJECT_NAME="$project" docker compose -f compose.package.yaml run --rm cli wp "$@"; }

docker compose -f compose.package.yaml up -d --wait wordpress
if ! cli core is-installed >/dev/null 2>&1; then
  cli core install --url="http://127.0.0.1:$port" --title='Synthetic Labels Package Test' --admin_user=labels_admin --admin_password=local-test-only-password --admin_email=labels@example.test --skip-email
  cli plugin install woocommerce --version=11.2.2 --activate
  cli option update blogname 'Synthetic Labels Test'
fi
if cli plugin is-active "$public_slug" >/dev/null 2>&1; then
  cli plugin deactivate "$public_slug"
fi
cli plugin install "$archive" --force
cli plugin activate "$public_slug"
cli eval '$m=json_decode(file_get_contents("/evidence/build/public/artifact-manifest.json"),true);foreach($m["files"] as $f=>$h)if(hash_file("sha256",WP_PLUGIN_DIR."/ramsey-labels/".$f)!==$h)throw new RuntimeException("Public installed file does not match candidate manifest: ".$f);echo "PASS: all public-slug installed files match the checked archive\n";'
cli --user=labels_admin eval 'if(RLI_FILE!==WP_PLUGIN_DIR."/ramsey-labels/ramsey-labels.php"||"ramsey-labels"!=="ramsey-labels")throw new RuntimeException("Fresh public slug entry did not boot with public identity");if(!function_exists("wc_get_product"))throw new RuntimeException("WooCommerce fixture is missing");echo "PASS: clean public-slug installation boots independently\n";'
cli plugin deactivate "$public_slug"
cli plugin install "/evidence/tests/Fixtures/rc9.zip" --force --activate
cli eval 'wp_set_current_user(get_user_by("login","labels_admin")->ID);$before=RamseyLabels\Store::read();$before["profiles"][0]["name"]="Synthetic RC9 public migration profile";RamseyLabels\Store::save($before);update_option("rli_test_public_sku_id",wc_get_product_id_by_sku("RRA-726474"),false);$saved=RamseyLabels\Store::updateJob(["id"=>"public-migration-fixture","name"=>"Synthetic RC9 saved print job","profileId"=>$before["defaultProfile"],"records"=>[["key"=>"product-1","source"=>"manual","values"=>["name"=>"Twinkle Light Earrings","sku"=>"RRA-726474","id"=>"42"],"quantity"=>3,"selected"=>true]],"privacy_acknowledged"=>true]);if(!isset($saved["public-migration-fixture"]))throw new RuntimeException("RC9 synthetic job did not persist");'
cli plugin install "$archive" --force
cli plugin activate "$public_slug"
cli eval '$active=(array)get_option("active_plugins",[]);if(!in_array("ramsey-labels-independent/ramsey-labels-independent.php",$active,true)||!in_array("ramsey-labels/ramsey-labels.php",$active,true))throw new RuntimeException("Expected both directory entries during guarded transition");if(!class_exists("RamseyLabels\\Plugin"))throw new RuntimeException("Legacy runtime missing during guarded transition");if(defined("RLI_PUBLIC_ENTRY"))throw new RuntimeException("New runtime booted beside legacy runtime");echo "PASS: both plugin entries coexist without a duplicate runtime\n";'
cli plugin deactivate "$legacy_slug"
cli --user=labels_admin eval '$m=json_decode(file_get_contents("/evidence/build/public/artifact-manifest.json"),true);if(!class_exists("RamseyLabels\\Plugin")||RLI_FILE!==WP_PLUGIN_DIR."/ramsey-labels/ramsey-labels.php"||RLI_VERSION!==$m["version"])throw new RuntimeException("Public runtime failed after legacy deactivation");if("Synthetic RC9 public migration profile"!==RamseyLabels\Store::read()["profiles"][0]["name"])throw new RuntimeException("Public slug migration lost RC9 profile");$jobs=RamseyLabels\Store::jobs();if(!isset($jobs["public-migration-fixture"])||$jobs["public-migration-fixture"]["records"][0]["values"]["sku"]!=="RRA-726474")throw new RuntimeException("Public slug migration lost user job");if(wc_get_product_id_by_sku("RRA-726474")!==(int)get_option("rli_test_public_sku_id"))throw new RuntimeException("Migration changed the synthetic product SKU association");echo "PASS: legacy option keys, user jobs and product/SKU association survive folder/domain migration\n";'
cli eval-file /evidence/tests/Integration/run.php > build/rc11-reports/public-integration.txt
TEST_PORT="$port" npm run test:e2e > build/rc11-reports/public-e2e.txt 2>&1
node bin/check-pdf.cjs > build/rc11-reports/public-pdf.txt 2>&1
if ! cli plugin is-active plugin-check >/dev/null 2>&1; then
  cli plugin install plugin-check --version=2.1.0 --activate
fi
cli plugin check "$public_slug" --format=json > build/rc11-reports/public-plugin-check.txt
python3 bin/assert-plugin-check.py build/rc11-reports/public-plugin-check.txt
