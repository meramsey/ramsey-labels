#!/usr/bin/env bash
set -euo pipefail
mkdir -p build/rc11-reports
project=${COMPOSE_PROJECT_NAME:-ramsey-labels-multisite-test}
cli(){ COMPOSE_PROJECT_NAME="$project" docker compose -f compose.multisite.yaml run --rm cli wp "$@"; }
COMPOSE_PROJECT_NAME="$project" docker compose -f compose.multisite.yaml up -d --wait wordpress
if ! cli core is-installed >/dev/null 2>&1; then
  cli core multisite-install --url=http://127.0.0.1:18890 --title='Synthetic Ramsey Network' --admin_user=labels_admin --admin_password=local-test-only-password --admin_email=labels@example.test --skip-email
fi
if ! cli site list --field=url | grep '/second/' >/dev/null; then cli site create --slug=second --title='Synthetic Second Site' --email=labels@example.test; fi
if ! cli plugin is-installed woocommerce >/dev/null 2>&1; then cli plugin install woocommerce --version=11.2.2; fi
cli plugin activate woocommerce --network
cli plugin activate ramsey-labels-independent --network
cli eval 'wp_set_current_user(get_user_by("login","labels_admin")->ID);foreach(get_users(["blog_id"=>0,"meta_key"=>RamseyLabels\Store::JOBS,"fields"=>"ids","number"=>10000]) as $old_id){$old_jobs=get_user_meta($old_id,RamseyLabels\Store::JOBS,true);if(is_array($old_jobs)&&isset($old_jobs["legacy-ui-fixture"])){unset($old_jobs["legacy-ui-fixture"]);update_user_meta($old_id,RamseyLabels\Store::JOBS,$old_jobs);}}$nonce=wp_generate_password(10,false);$owner=wp_insert_user(["user_login"=>"rli_quarantine_ui_".$nonce,"user_pass"=>wp_generate_password(32,false),"user_email"=>"rli-quarantine-ui-".$nonce."@example.test","role"=>"subscriber"]);if(is_wp_error($owner))throw new RuntimeException("Could not create quarantined UI test user: ".$owner->get_error_message());$root=(int)get_sites(["fields"=>"ids","number"=>1])[0];add_user_to_blog($root,$owner,"subscriber");update_user_meta($owner,RamseyLabels\Store::JOBS,["legacy-ui-fixture"=>["id"=>"legacy-ui-fixture","name"=>"Sensitive Legacy Order 9999","created"=>gmdate("c"),"profileId"=>"thermal-2x1","records"=>[["key"=>"private","source"=>"manual","values"=>["name"=>"Private customer","billing.email"=>"private-customer@example.test"],"quantity"=>1,"selected"=>true]]]]);update_option("rli_test_quarantine_ui_owner",$owner,false);'
TEST_PORT=18890 npm run test:e2e:multisite > build/rc11-reports/multisite-ui.txt 2>&1
cli eval '$owner=(int)get_option("rli_test_quarantine_ui_owner");if($owner){delete_user_meta($owner,RamseyLabels\Store::JOBS);wp_delete_user($owner);}delete_option("rli_test_quarantine_ui_owner");'
cli eval-file /var/www/html/wp-content/plugins/ramsey-labels-independent/tests/Integration/multisite.php
