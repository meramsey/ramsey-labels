<?php
/**
 * Preserve designs by default. Opt-in cleanup never touches original-plugin data.
 *
 * @package RamseyLabels
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit; }
if ( ! defined( 'RLI_PURGE_ON_UNINSTALL' ) || RLI_PURGE_ON_UNINSTALL !== true ) {
	return; }
$ramsey_labels_cleanup = function () {
	delete_option( 'rli_v1_library' );
	delete_option( 'rli_v1_migration_backup' );
	$ramsey_labels_jobs_key = is_multisite() ? 'rli_v1_jobs_site_' . get_current_blog_id() : 'rli_v1_jobs';
	delete_metadata( 'user', 0, $ramsey_labels_jobs_key, '', true );
};
if ( is_multisite() ) {
	$ramsey_labels_offset = 0;
	do {
		$ramsey_labels_sites = get_sites(
			array(
				'fields' => 'ids',
				'number' => 100,
				'offset' => $ramsey_labels_offset,
			)
		);
		foreach ( $ramsey_labels_sites as $ramsey_labels_site_id ) {
			switch_to_blog( $ramsey_labels_site_id );
			try {
				$ramsey_labels_cleanup();
			} finally {
				restore_current_blog();
			}
		}
		$ramsey_labels_offset += count( $ramsey_labels_sites );
		$ramsey_labels_count   = count( $ramsey_labels_sites );
	} while ( 100 === $ramsey_labels_count );
	delete_metadata( 'user', 0, 'rli_v1_jobs', '', true );
} else {
	$ramsey_labels_cleanup();
}
