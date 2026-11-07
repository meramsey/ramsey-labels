<?php
/** Execute only with wp eval-file in the disposable Compose installation. */
use RamseyLabels\Data;
use RamseyLabels\Schema;
use RamseyLabels\Store;
use RamseyLabels\Plugin;
if (wp_get_environment_type() !== 'local' || get_bloginfo('name') !== 'Synthetic Labels Test') {
    throw new RuntimeException('Refusing to run destructive fixtures outside isolated test site.');
}
$GLOBALS['rli_test_count'] = 0;
echo 'ENV WordPress='.get_bloginfo('version').' PHP='.PHP_VERSION.' WooCommerce='.WC_VERSION.' HPOS='.(get_option('woocommerce_custom_orders_table_enabled')==='yes'?'yes':'no')."\n";
function check($ok, $message) {
    if (!$ok) { throw new RuntimeException('FAIL: ' . $message); }
    ++$GLOBALS['rli_test_count']; echo "PASS: $message\n";
}
function rejects($fn, $message) {
    try { $fn(); } catch (InvalidArgumentException | RuntimeException | DomainException $e) { check(true, $message); return; }
    check(false, $message);
}
function rest_status($response) { if(is_wp_error($response)){$data=$response->get_error_data();return isset($data['status'])?(int)$data['status']:401;}return $response->get_status(); }
$admin = get_user_by('login', 'labels_admin');
wp_set_current_user($admin->ID);
require_once ABSPATH.'wp-admin/includes/plugin.php';
$discovered_plugins=get_plugins();
check(isset($discovered_plugins['ramsey-labels-independent/ramsey-labels-independent.php'])&&!isset($discovered_plugins['ramsey-labels-independent/public/src/ramsey-labels.php']),'legacy test mount discovers only the legacy plugin entrypoint');
$id = wc_get_product_id_by_sku('RRA-726474');
if (!$id) {
    $product = new WC_Product_Simple();
    $product->set_name('Twinkle Light Earrings'); $product->set_sku('RRA-726474');
    $product->set_regular_price('12.00'); $product->set_status('publish');
    $id = $product->save();
} else { $product = wc_get_product($id); }
$term = term_exists('Synthetic Earrings', 'product_cat');
if (!$term) { $term = wp_insert_term('Synthetic Earrings', 'product_cat'); }
$term_id = (int) $term['term_id'];
wp_set_object_terms($id, [$term_id], 'product_cat');
if (!$product->get_image_id()) {
    $uploads=wp_upload_dir();
    $path=$uploads['path'].'/synthetic-label.png';
    $image=imagecreatetruecolor(64,64); imagefill($image,0,0,imagecolorallocate($image,90,40,160)); imagepng($image,$path); imagedestroy($image);
    $attachment=wp_insert_attachment(['post_title'=>'Synthetic purple fixture', 'post_mime_type'=>'image/png', 'post_status'=>'inherit'],$path);
    require_once ABSPATH.'wp-admin/includes/image.php';
    wp_update_attachment_metadata($attachment,wp_generate_attachment_metadata($attachment,$path));
    $product->set_image_id($attachment); $product->save();
}
$result=Data::searchProducts(['search'=>'RRA-726474']);
check(count($result['items'])===1 && $result['items'][0]['id']===$id,'exact SKU search');
check($result['items'][0]['image_url']!=='','product thumbnail');
check(Data::searchProducts(['search'=>'Twinkle Light'])['total']>=1,'name search');
check(Data::searchProducts(['categories'=>[$term_id], 'per_page'=>1])['pages']>=1,'category pagination');
for($i=1;$i<=101;$i++){ $slug='synthetic-category-'.str_pad((string)$i,3,'0',STR_PAD_LEFT);if(!term_exists($slug,'product_cat'))wp_insert_term($slug,'product_cat'); }
$category_page=Data::categories(['page'=>1,'per_page'=>100]);$category_last=Data::categories(['page'=>2,'per_page'=>100]);
check(count($category_page['items'])===100 && $category_page['has_more'] && count($category_last['items'])>=1 && !$category_last['has_more'],'large category list paginates without truncation');
$selected_category=Data::categories(['include'=>[$term_id]]);check(count($selected_category['items'])===1 && $selected_category['items'][0]['id']===$term_id,'deep-linked category lookup resolves by ID');
$batch_term=term_exists('Synthetic Batch Fixture','product_cat');if(!$batch_term)$batch_term=wp_insert_term('Synthetic Batch Fixture','product_cat');
$batch_ids=[];
for($i=1;$i<=101;$i++){
    $sku='SYNTHETIC-BATCH-'.str_pad((string)$i,3,'0',STR_PAD_LEFT);$batch_id=wc_get_product_id_by_sku($sku);
    if(!$batch_id){$batch_product=new WC_Product_Simple();$batch_product->set_name('Synthetic batch '.str_pad((string)$i,3,'0',STR_PAD_LEFT));$batch_product->set_sku($sku);$batch_product->set_regular_price('1');$batch_product->set_status('publish');$batch_id=$batch_product->save();wp_set_object_terms($batch_id,[(int)$batch_term['term_id']],'product_cat');}
    $batch_ids[]=$batch_id;
}
$first=Data::searchProducts(['categories'=>[(int)$batch_term['term_id']],'per_page'=>30,'page'=>1]);
$second=Data::searchProducts(['categories'=>[(int)$batch_term['term_id']],'per_page'=>30,'page'=>2]);
check($first['total']===101 && $first['pages']===4 && count($first['items'])===30 && count($second['items'])===30,'101-product category has four complete paginated result sets');
check(array_intersect(array_column($first['items'],'id'),array_column($second['items'],'id'))===[],'category pages contain no duplicate IDs');
$batch_records=Data::records(['ids'=>$batch_ids])['records'];
check(count($batch_records)===101 && array_map(function($record){return (int)$record['values']['id'];},$batch_records)===$batch_ids,'more than 100 selected product IDs transfer without truncation');
$records=Data::records(['ids'=>[$id], 'fields'=>['sku','price']])['records'];
check($records[0]['values']['sku']==='RRA-726474','SKU payload unchanged');
check($records[0]['values']['price_raw']==='12.00','WooCommerce price CRUD');
check($records[0]['values']['currency_symbol']===html_entity_decode(get_woocommerce_currency_symbol(),ENT_QUOTES|ENT_HTML5,'UTF-8'),'currency symbol from WooCommerce settings');
add_filter('rli_field_value',function($value,$field){return 'test.extension'===$field?'Independent extension field':$value;},10,2);
$extension_record=Data::records(['ids'=>[$id],'fields'=>['test.extension']])['records'][0];
check($extension_record['values']['test.extension']==='Independent extension field','documented PHP field extension hook');
remove_all_filters('rli_field_value');
check(strpos(Data::image($product->get_image_id())['src'],'data:image/png;base64,')===0,'bounded local image');
rejects(function(){Data::records(['ids'=>['1 OR 1=1']]);},'SQL-like forged ID rejected');
rejects(function(){Data::records(['ids'=>[PHP_INT_MAX]]);},'missing product rejected');
rejects(function(){Data::image(PHP_INT_MAX);},'missing attachment rejected');
rejects(function(){Data::fieldKeys(['__proto__']);},'prototype field rejected');
rejects(function(){Schema::library(['schema'=>999]);},'unknown import schema rejected');
check(Schema::css('p{background:u/**/rl(https://example.test)}')==='','CSS comment URL bypass rejected');
check(Schema::css('p{background:\\75rl(https://example.test)}')==='','CSS escape URL bypass rejected');
$html=Schema::html('<img src="javascript:alert(1)" onerror="alert(1)"><script>alert(1)</script><p>safe</p>');
check(strpos($html,'onerror')===false && strpos($html,'javascript:')===false && strpos($html,'<script')===false,'WordPress KSES malicious template');
global $wpdb;
$legacy_table=$wpdb->prefix.'barcode_v4_profilemeta';
$wpdb->query("DROP TABLE IF EXISTS `{$legacy_table}`");
$wpdb->query("CREATE TABLE `{$legacy_table}` (barcode_v4_profile_id BIGINT, meta_key VARCHAR(191), meta_value LONGTEXT)");
$wpdb->insert($legacy_table,['barcode_v4_profile_id'=>1,'meta_key'=>'settings','meta_value'=>'O:13:"SyntheticEvil":0:{}']);
try{rejects(function(){RamseyLabels\Migration::plan();},'serialized legacy PHP objects rejected with classes disabled');}finally{$wpdb->query("DROP TABLE `{$legacy_table}`");}

$old=Store::read();$incoming=$old;$incoming['profiles'][0]['name']='Synthetic saved profile';
$saved=Store::save($incoming);check($saved['revision']===$old['revision']+1,'settings revision increments');
check(Store::read()['profiles'][0]['name']==='Synthetic saved profile','settings persistence');
rejects(function()use($old){Store::save($old);},'stale revision conflict');
$old['revision']=$saved['revision'];Store::save($old);
$lock=Store::acquire_lock('synthetic-lock');
rejects(function(){Store::with_lock('synthetic-lock',function(){return true;});},'concurrent option operation rejected while a live lease is held');
Store::release_lock($lock);
$expired=Store::acquire_lock('synthetic-expired');$expired['lease']['expires']=time()-1;update_option($expired['name'],$expired['lease'],false);
$recovered=Store::acquire_lock('synthetic-expired');check($recovered['lease']['token']!==$expired['lease']['token'],'expired lock lease recovers with compare-and-delete');Store::release_lock($recovered);
$large_request=new WP_REST_Request('POST','/ramsey-labels/v1/records');$large_request->set_body(str_repeat('x',2200001));
$large_response=rest_get_server()->dispatch($large_request);check(rest_status($large_response)===413,'oversized REST body rejected before JSON parsing');
$job=['id'=>'synthetic','name'=>'Synthetic job','profileId'=>$old['defaultProfile'],'records'=>$records];
rejects(function()use($job){Store::updateJob($job);},'saved customer data requires acknowledgement');
$job['privacy_acknowledged']=true;Store::updateJob($job);check(isset(Store::jobs()['synthetic']),'per-user job saved');
$actions=Plugin::bulkActions([], 'edit-product');check(isset($actions['rli_products']),'Products bulk action registered');
$redirect=Plugin::bulkRedirect('unchanged','rli_products',$batch_ids);parse_str(parse_url($redirect,PHP_URL_QUERY),$query);
$handoff=get_transient('rli_handoff_'.$admin->ID.'_'.$query['rli_job']);check($handoff['ids']===$batch_ids,'all 101 selected IDs transfer unchanged through the user-scoped bulk handoff');
check(isset(Plugin::rowActions([],get_post($id))['rli_labels']),'product row action');

$variable_id=wc_get_product_id_by_sku('SYNTHETIC-PARENT');
if(!$variable_id){$parent=new WC_Product_Variable();$parent->set_name('Synthetic variable');$parent->set_sku('SYNTHETIC-PARENT');$variable_id=$parent->save();$variation=new WC_Product_Variation();$variation->set_parent_id($variable_id);$variation->set_sku('SYNTHETIC-VAR-1');$variation->set_regular_price('12');$variation->set_status('publish');$variation->save();WC_Product_Variable::sync($variable_id);}
$variation_results=Data::searchProducts(['search'=>'SYNTHETIC-VAR-1']);
check(in_array(wc_get_product_id_by_sku('SYNTHETIC-VAR-1'),array_column($variation_results['items'],'id'),true),'variation SKU search includes exact variation');
check(count(Data::records(['ids'=>[$variable_id],'variations'=>'variations'])['records'])>=1,'variation expansion');
$order=wc_create_order();$order->add_product($product,2);$order->set_billing_first_name('Synthetic');$order->set_billing_last_name('Customer');$order->calculate_totals();$order->save();
if(version_compare(WC_VERSION,'8.2','>='))check(Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled()===(get_option('woocommerce_custom_orders_table_enabled')==='yes'),'actual order datastore mode matches requested mode');
check(count(Data::orderItems($order->get_id())['items'])===1,'order CRUD items');
$items=Data::records(['source'=>'order_items','ids'=>[$order->get_id()],'quantity_mode'=>'order'])['records'];
check($items[0]['quantity']===2,'order quantity');
check($items[0]['values']['sku']==='RRA-726474','order item product SKU');
check(Data::records(['source'=>'orders','ids'=>[$order->get_id()]])['records'][0]['values']['billing.name']==='Synthetic Customer','order address CRUD');
$order->delete(true);

$coupon_id=wc_get_coupon_id_by_code('synthetic-label-code');
$coupon=$coupon_id?new WC_Coupon($coupon_id):new WC_Coupon();$coupon->set_code('synthetic-label-code');$coupon->set_amount('10');$coupon->set_discount_type('percent');$coupon_id=$coupon->save();
check(Data::records(['source'=>'coupons','ids'=>[$coupon_id]])['records'][0]['values']['coupon.code']==='synthetic-label-code','coupon source CRUD');
check(Data::records(['source'=>'users','ids'=>[$admin->ID]])['records'][0]['values']['user.login']==='labels_admin','authorized user source');
$post_id=wp_insert_post(['post_title'=>'Synthetic printable post','post_content'=>'<b>Synthetic text</b>','post_status'=>'publish']);
check(Data::records(['source'=>'posts','ids'=>[$post_id]])['records'][0]['values']['description']==='Synthetic text','post source strips HTML');wp_delete_post($post_id,true);
rejects(function(){Data::fieldKeys(['order_meta:_access_token']);},'credential metadata binding rejected');
$library_before=Store::read();$legacy_before=get_option('rli_settings',null);$backup_before=get_option(Store::BACKUP,null);
update_option('rli_settings',['width'=>50.8,'height'=>25.4,'name'=>true,'barcode'=>true,'sku'=>true,'price'=>true]);
$plan=RamseyLabels\Migration::plan();check(in_array('Previous Ramsey configuration',$plan['added'],true),'legacy migration preview');
rejects(function(){RamseyLabels\Migration::apply('forged');},'forged migration hash rejected');
RamseyLabels\Migration::apply($plan['hash']);check(count(Store::read()['profiles'])===count($library_before['profiles'])+1,'migration adds independent profile');
$restored=RamseyLabels\Migration::restore();$expected=$library_before;$expected['revision']=$restored['revision'];check($restored===$expected,'migration restores all profile/template data');
if($legacy_before===null)delete_option('rli_settings');else update_option('rli_settings',$legacy_before,false);
if($backup_before===null)delete_option(Store::BACKUP);else update_option(Store::BACKUP,$backup_before,false);
define('WP_UNINSTALL_PLUGIN','ramsey-labels-independent/ramsey-labels-independent.php');
include dirname(__DIR__,2).'/uninstall.php';check(Store::read()===$restored,'default uninstall preserves data');
$custom_library=$restored;$custom_library['profiles'][0]['design']=Schema::defaults()['templates'][0]['design'];
$custom_library['profiles'][0]['design']['elements'][0]['content']='Custom title survives';
update_option(Store::OPTION,$custom_library,false);
check(Store::read()['profiles'][0]['design']===$custom_library['profiles'][0]['design'],'partially customized original factory layout is not overwritten');
update_option(Store::OPTION,$restored,false);
$factory_library=$restored;$factory_library['profiles'][0]['design']=Schema::design(Schema::defaults()['templates'][0]['design']);
update_option(Store::OPTION,$factory_library,false);
check(Store::read()['profiles'][0]['design']===Schema::defaults()['profiles'][0]['design'],'untouched normalized factory layout still upgrades to QR card');
update_option(Store::OPTION,$restored,false);

// Real REST server permissions: every plugin route must reject anonymous and subscribers.
$server=rest_get_server();$routes=$server->get_routes();
foreach([0, wp_create_user('labels_subscriber_'.wp_generate_password(8,false),'synthetic-test-only','subscriber-'.wp_generate_password(8,false).'@example.test')] as $user_id){
    wp_set_current_user($user_id);
    foreach($routes as $route=>$handlers){if(strpos($route,'/ramsey-labels/v1/')!==0)continue;
        $path=str_replace('(?P<id>\d+)',(string)$id,$route);
        foreach($handlers as $handler){if(!isset($handler['methods']))continue;
            foreach(array_keys($handler['methods']) as $method){
                $response=$server->dispatch(new WP_REST_Request($method,$path));
                check(in_array(rest_status($response),[401,403],true),'REST denial '.$user_id.' '.$method.' '.$path);
            }
        }
    }
    rejects(function()use($id){Data::records(['ids'=>[$id]]);},'product source capability boundary');
    check(Store::jobs()===[],'saved jobs isolated from other users');
    if($user_id)wp_delete_user($user_id);
}
wp_set_current_user($admin->ID);
add_role('rli_synthetic_operator','Synthetic label operator',['read'=>true,'manage_woocommerce'=>true]);
$operator=wp_insert_user(['user_login'=>'labels_operator_'.wp_generate_password(8,false),'user_pass'=>wp_generate_password(32),'role'=>'rli_synthetic_operator']);
$restricted_library=Store::read();$restricted_profile=$restricted_library['profiles'][0];$restricted_profile['id']='synthetic-admin-profile';$restricted_profile['roles']=['administrator'];$restricted_library['profiles'][]=$restricted_profile;
Store::save($restricted_library);
wp_set_current_user($operator);
check(Plugin::allowed(),'least-privilege label operator may enter workflow');
rejects(function()use($id){Data::records(['ids'=>[$id]]);},'label capability alone does not grant product access');
rejects(function()use($id){Data::records(['source'=>'orders','ids'=>[$id]]);},'label capability alone does not grant order access');
rejects(function()use($admin){Data::records(['source'=>'users','ids'=>[$admin->ID]]);},'label capability alone does not grant user access');
check(!in_array('synthetic-admin-profile',array_column(Store::visible(Store::read())['profiles'],'id'),true),'role-restricted profile hidden from operator');
rejects(function(){Store::save(Store::read());},'operator cannot overwrite restricted profile');
$migration_response=rest_get_server()->dispatch(new WP_REST_Request('GET','/ramsey-labels/v1/migration'));check(rest_status($migration_response)===403,'migration requires administrator even for label operator');
wp_set_current_user($admin->ID);$restricted_library=Store::read();$restricted_library['profiles']=array_values(array_filter($restricted_library['profiles'],function($profile){return $profile['id']!=='synthetic-admin-profile';}));Store::save($restricted_library);
wp_delete_user($operator);remove_role('rli_synthetic_operator');
Store::updateJob(['id'=>'synthetic','action'=>'delete']);
update_user_meta($admin->ID,Store::jobs_key(),[]);
$privacy_users=[];
for($i=0;$i<26;$i++){
    $user=wp_insert_user(['user_login'=>'rli_privacy_'.wp_generate_password(8,false),'user_pass'=>wp_generate_password(32),'user_email'=>'rli-privacy-'.$i.'@example.test','role'=>'customer']);
    $privacy_users[]=$user;
    update_user_meta($user,Store::jobs_key(),['job-'.$i=>['id'=>'job-'.$i,'name'=>'Synthetic privacy job '.$i,'created'=>gmdate('c'),'profileId'=>Store::read()['defaultProfile'],'records'=>[['key'=>'record-'.$i,'source'=>'manual','values'=>['id'=>(string)$i,'billing.email'=>'privacy-subject@example.test','other.email'=>'private-other@example.test'],'quantity'=>1,'selected'=>true]]]]);
}
$export_count=0;$export_page=1;$export_done=false;
do{$page_data=RamseyLabels\Privacy::export_data('privacy-subject@example.test',$export_page);if(is_wp_error($page_data))throw new RuntimeException('Privacy export conflict');$export_count+=count($page_data['data']);if(1===$export_page)check(count($page_data['data'])>0&&!$page_data['done'],'paged privacy export first page is incomplete');$export_done=$page_data['done'];++$export_page;}while(!$export_done && $export_page<10);
check($export_done && $export_count===26,'paged privacy export covers 26 owners exactly once');
$erase_page=1;$erase_done=false;
do{$page_data=RamseyLabels\Privacy::erase_data('privacy-subject@example.test',$erase_page);if(is_wp_error($page_data))throw new RuntimeException('Privacy erasure conflict');$erase_done=$page_data['done'];++$erase_page;}while(!$erase_done && $erase_page<10);
check($erase_done,'paged privacy erasure completes without skipping pages');
$remaining=0;foreach($privacy_users as $user){$jobs=get_user_meta($user,Store::jobs_key(),true);foreach($jobs as $job)$remaining+=count($job['records']);}
check($remaining===0,'privacy erasure removes matched customer records from every page');
foreach($privacy_users as $user)wp_delete_user($user);
delete_user_meta($admin->ID,Store::jobs_key());
$purge_library=get_option(Store::OPTION,null);$purge_backup=get_option(Store::BACKUP,null);$purge_jobs=Store::jobs();
update_option(Store::BACKUP,['synthetic'=>true],false);
Store::updateJob(['id'=>'synthetic-purge','name'=>'Synthetic purge fixture','profileId'=>Store::read()['defaultProfile'],'records'=>$records,'privacy_acknowledged'=>true]);
define('RLI_PURGE_ON_UNINSTALL',true);include dirname(__DIR__,2).'/uninstall.php';
check(get_option(Store::OPTION,null)===null && get_option(Store::BACKUP,null)===null && Store::jobs()===[],'explicit single-site uninstall purge removes only plugin storage');
if($purge_library!==null)update_option(Store::OPTION,$purge_library,false);
if($purge_backup!==null)update_option(Store::BACKUP,$purge_backup,false);
update_user_meta($admin->ID,Store::JOBS,$purge_jobs);
check(get_option(Store::OPTION,null)===$purge_library,'test restoration preserves exact pre-purge library');
check(wc_get_product($id)->get_sku()==='RRA-726474','product SKU unchanged after entire suite');
echo 'Integration assertions: '.$GLOBALS['rli_test_count']."\n";
