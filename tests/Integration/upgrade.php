<?php
/** Two fresh WP processes: genuine archived RC8 code saves; new code verifies. */
if (!defined('WP_CLI') || !WP_CLI || wp_get_environment_type() !== 'local' || get_bloginfo('name') !== 'Synthetic Labels Test') {
    throw new RuntimeException('Isolated test site required.');
}
if ($args[0] === 'seed') {
    require dirname(__DIR__,2).'/build/rc8/ramsey-labels-independent/ramsey-labels-independent.php';
    wp_set_current_user(get_user_by('login','labels_admin')->ID);
    update_option('rli_test_upgrade_backup',get_option('rli_v1_library',null),false);
    $library=RamseyLabels\Store::read();
    $library['profiles'][0]['name']='Synthetic RC8 saved QR profile';
    $library['profiles'][0]['page']['dpi']=203;
    $library['profiles'][0]['design']['elements'][1]['content']='CUSTOM {{price}}';
    $custom=$library['profiles'][0];$custom['id']='synthetic-rc8-custom';$custom['name']='Synthetic custom RC8 print profile';
    $custom['design']['width']=53;$custom['design']['height']=27;
    $custom['page']['width']=53;$custom['page']['height']=27;
    $library['profiles'][]=$custom;$library['defaultProfile']=$custom['id'];
    $library['templates'][]=['id'=>'synthetic-rc8-template','name'=>'Synthetic saved RC8 template','design'=>$library['profiles'][0]['design']];
    RamseyLabels\Store::save($library);
    update_option('rli_test_upgrade_expected',RamseyLabels\Store::read(),false);
    echo 'PASS: genuine '.RLI_VERSION." saved custom QR layout, template and DPI\n";
} else {
    $expected=get_option('rli_test_upgrade_expected');
    if(!is_array($expected) || RamseyLabels\Store::read()!==$expected || RLI_VERSION!=='1.0.0-rc.9')throw new RuntimeException('RC8 upgrade changed saved library');
    echo "PASS: RC8-to-RC9 full saved library exact equality\n";
    $backup=get_option('rli_test_upgrade_backup');
    if($backup===null)delete_option('rli_v1_library');else update_option('rli_v1_library',$backup,false);
    delete_option('rli_test_upgrade_expected');delete_option('rli_test_upgrade_backup');
}
