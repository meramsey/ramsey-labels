<?php
/** Preserve designs by default. Opt-in cleanup never touches original-plugin data. */
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit; }
if ( ! defined( 'RLI_PURGE_ON_UNINSTALL' ) || RLI_PURGE_ON_UNINSTALL !== true ) {
	return; }
$cleanup = function () {
	delete_option( 'rli_v1_library' );
	delete_option( 'rli_v1_migration_backup' );
	delete_metadata( 'user', 0, 'rli_v1_jobs', '', true );
};
if ( is_multisite() ) {
	foreach ( get_sites(
		array(
			'fields' => 'ids',
			'number' => 0,
		)
	) as $site_id ) {
		switch_to_blog( $site_id );
		$cleanup();
		restore_current_blog(); }
} else {
	$cleanup(); }
