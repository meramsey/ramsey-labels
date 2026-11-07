<?php
/** Executed with WP-CLI only against the separately named disposable network. */
if(!defined('WP_CLI') || !WP_CLI || !is_multisite() || get_bloginfo('name')!=='Synthetic Ramsey Network')throw new RuntimeException('Isolated synthetic multisite required.');
function network_check($condition,$message){if(!$condition)throw new RuntimeException('FAIL: '.$message);echo 'PASS: '.$message."\n";}
$admin=get_user_by('login','labels_admin');wp_set_current_user($admin->ID);
$sites=get_sites(['fields'=>'ids','number'=>0]);if(count($sites)<2)throw new RuntimeException('Expected root and second test sites.');$first=(int)$sites[0];$second=(int)$sites[1];
switch_to_blog($first);$first_key=RamseyLabels\Store::jobs_key();$first_library=RamseyLabels\Store::read();$first_library['profiles'][0]['name']='Site one synthetic profile';RamseyLabels\Store::save($first_library);
$record=['key'=>'network-one','source'=>'manual','values'=>['name'=>'Site one only','sku'=>'RRA-726474'],'quantity'=>1,'selected'=>true];
RamseyLabels\Store::updateJob(['id'=>'network-site-one','name'=>'Site one job','profileId'=>$first_library['defaultProfile'],'records'=>[$record],'privacy_acknowledged'=>true]);
network_check($first_key==='rli_v1_jobs_site_'.$first && isset(RamseyLabels\Store::jobs()['network-site-one']),'first site persists jobs under stable site-scoped user metadata');
restore_current_blog();
switch_to_blog($second);$second_key=RamseyLabels\Store::jobs_key();$second_library=RamseyLabels\Store::read();$second_library['profiles'][0]['name']='Site two synthetic profile';RamseyLabels\Store::save($second_library);
network_check($second_key==='rli_v1_jobs_site_'.$second && !isset(RamseyLabels\Store::jobs()['network-site-one']),'second site cannot read the first site job');
network_check(RamseyLabels\Store::read()['profiles'][0]['name']==='Site two synthetic profile','per-site label settings remain independent');
RamseyLabels\Store::updateJob(['id'=>'network-site-two','name'=>'Site two job','profileId'=>$second_library['defaultProfile'],'records'=>[$record],'privacy_acknowledged'=>true]);
restore_current_blog();
define('WP_UNINSTALL_PLUGIN','ramsey-labels-independent/ramsey-labels-independent.php');include dirname(__DIR__,2).'/uninstall.php';
switch_to_blog($first);network_check(get_option('rli_v1_library')!==null && get_user_meta($admin->ID,$first_key,true)!==[],'network uninstall preserves both sites by default');restore_current_blog();
define('RLI_PURGE_ON_UNINSTALL',true);include dirname(__DIR__,2).'/uninstall.php';
switch_to_blog($first);network_check(get_option('rli_v1_library',null)===null && empty(get_user_meta($admin->ID,$first_key,true)),'explicit network purge removes site one options/jobs');restore_current_blog();
switch_to_blog($second);network_check(get_option('rli_v1_library',null)===null && empty(get_user_meta($admin->ID,$second_key,true)),'explicit network purge removes site two options/jobs');restore_current_blog();
echo "Multisite lifecycle assertions: 6\n";
