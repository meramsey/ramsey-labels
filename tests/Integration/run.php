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
$admin = get_user_by('login', 'labels_admin');
wp_set_current_user($admin->ID);
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

$old=Store::read();$incoming=$old;$incoming['profiles'][0]['name']='Synthetic saved profile';
$saved=Store::save($incoming);check($saved['revision']===$old['revision']+1,'settings revision increments');
check(Store::read()['profiles'][0]['name']==='Synthetic saved profile','settings persistence');
rejects(function()use($old){Store::save($old);},'stale revision conflict');
$old['revision']=$saved['revision'];Store::save($old);
$job=['id'=>'synthetic','name'=>'Synthetic job','profileId'=>$old['defaultProfile'],'records'=>$records];
rejects(function()use($job){Store::updateJob($job);},'saved customer data requires acknowledgement');
$job['privacy_acknowledged']=true;Store::updateJob($job);check(isset(Store::jobs()['synthetic']),'per-user job saved');
$actions=Plugin::bulkActions([], 'edit-product');check(isset($actions['rli_products']),'Products bulk action registered');
$redirect=Plugin::bulkRedirect('unchanged','rli_products',[$id]);parse_str(parse_url($redirect,PHP_URL_QUERY),$query);
$handoff=get_transient('rli_handoff_'.$admin->ID.'_'.$query['rli_job']);check($handoff['ids']===[$id],'selected IDs transferred through user-scoped handoff');
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
                check(in_array($response->get_status(),[401,403],true),'REST denial '.$user_id.' '.$method.' '.$path);
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
check(rest_get_server()->dispatch(new WP_REST_Request('GET','/ramsey-labels/v1/migration'))->get_status()===403,'migration requires administrator even for label operator');
wp_set_current_user($admin->ID);$restricted_library=Store::read();$restricted_library['profiles']=array_values(array_filter($restricted_library['profiles'],function($profile){return $profile['id']!=='synthetic-admin-profile';}));Store::save($restricted_library);
wp_delete_user($operator);remove_role('rli_synthetic_operator');
Store::updateJob(['id'=>'synthetic','action'=>'delete']);
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
