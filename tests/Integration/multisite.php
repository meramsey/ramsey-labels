<?php
/** Executed with WP-CLI only against the separately named disposable network. */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI || ! is_multisite() || get_bloginfo( 'name' ) !== 'Synthetic Ramsey Network' ) {
	throw new RuntimeException( 'Isolated synthetic multisite required.' );
}
function network_check( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( 'FAIL: ' . $message );
	}++$GLOBALS['network_assertions'];
	echo 'PASS: ' . $message . "\n";}
$GLOBALS['network_assertions'] = 0;
$admin                         = get_user_by( 'login', 'labels_admin' );
wp_set_current_user( $admin->ID );
foreach ( get_users(
	array(
		'blog_id' => 0,
		'fields'  => 'all',
		'number'  => 10000,
	)
) as $old_user ) {
	if ( 0 === strpos( $old_user->user_login, 'rli_legacy_owner_' ) || 0 === strpos( $old_user->user_login, 'rli_nonmember_' ) || 0 === strpos( $old_user->user_login, 'rli_bulk_owner_' ) ) {
		wp_delete_user( (int) $old_user->ID );
	}
}
$network_ids = get_sites(
	array(
		'fields' => 'ids',
		'number' => 0,
	)
);
foreach ( $network_ids as $old_site_id ) {
	$old_site = get_site( $old_site_id );
	if ( $old_site && ( 0 === strpos( $old_site->path, '/rli-legacy-job-orphan-' ) || '/quarantine-orphan/' === $old_site->path ) ) {
		wp_delete_site( (int) $old_site_id );
	}
}
$sites = get_sites(
	array(
		'fields' => 'ids',
		'number' => 0,
	)
);
if ( count( $sites ) < 2 ) {
	throw new RuntimeException( 'Expected root and second test sites.' );
}$first = (int) $sites[0];
$second = (int) $sites[1];
switch_to_blog( $first );
$first_key                            = RamseyLabels\Store::jobs_key();
$first_library                        = RamseyLabels\Store::read();
$first_library['profiles'][0]['name'] = 'Site one synthetic profile';
RamseyLabels\Store::save( $first_library );
$record = array(
	'key'      => 'network-one',
	'source'   => 'manual',
	'values'   => array(
		'name' => 'Site one only',
		'sku'  => 'RRA-726474',
	),
	'quantity' => 1,
	'selected' => true,
);
RamseyLabels\Store::updateJob(
	array(
		'id'                   => 'network-site-one',
		'name'                 => 'Site one job',
		'profileId'            => $first_library['defaultProfile'],
		'records'              => array( $record ),
		'privacy_acknowledged' => true,
	)
);
network_check( $first_key === 'rli_v1_jobs_site_' . $first && isset( RamseyLabels\Store::jobs()['network-site-one'] ), 'first site persists jobs under stable site-scoped user metadata' );
restore_current_blog();
switch_to_blog( $second );
$second_key                            = RamseyLabels\Store::jobs_key();
$second_library                        = RamseyLabels\Store::read();
$second_library['profiles'][0]['name'] = 'Site two synthetic profile';
RamseyLabels\Store::save( $second_library );
network_check( $second_key === 'rli_v1_jobs_site_' . $second && ! isset( RamseyLabels\Store::jobs()['network-site-one'] ), 'second site cannot read the first site job' );
network_check( RamseyLabels\Store::read()['profiles'][0]['name'] === 'Site two synthetic profile', 'per-site label settings remain independent' );
RamseyLabels\Store::updateJob(
	array(
		'id'                   => 'network-site-two',
		'name'                 => 'Site two job',
		'profileId'            => $second_library['defaultProfile'],
		'records'              => array( $record ),
		'privacy_acknowledged' => true,
	)
);
restore_current_blog();
$legacy_nonce = wp_generate_password( 8, false );
$legacy_owner = wp_insert_user(
	array(
		'user_login' => 'rli_legacy_owner_' . $legacy_nonce,
		'user_pass'  => wp_generate_password( 32, false ),
		'user_email' => 'legacy-owner-' . $legacy_nonce . '@example.test',
		'role'       => 'subscriber',
	)
);
if ( is_wp_error( $legacy_owner ) ) {
	throw new RuntimeException( 'Could not create the synthetic legacy owner.' );
}
add_user_to_blog( $first, $legacy_owner, 'subscriber' );
add_user_to_blog( $second, $legacy_owner, 'subscriber' );
$legacy_job = array(
	'id'        => 'legacy-opaque-1',
	'name'      => 'Sensitive Order 98765',
	'created'   => gmdate( 'c' ),
	'profileId' => $first_library['defaultProfile'],
	'records'   => array(
		array(
			'key'      => 'customer-1',
			'source'   => 'manual',
			'values'   => array(
				'name'          => 'Private Person',
				'billing.email' => 'private@example.test',
			),
			'quantity' => 2,
			'selected' => true,
		),
	),
);
update_user_meta( $legacy_owner, RamseyLabels\Store::JOBS, array( 'legacy-opaque-1' => $legacy_job ) );
$inventory_owner_rows = array();
$inventory_page       = 1;
$inventory_more       = true;
while ( $inventory_more && $inventory_page < 100 ) {
	$inventory = RamseyLabels\NetworkJobs::inventory( $inventory_page );
	foreach ( $inventory['rows'] as $inventory_row ) {
		if ( $inventory_row['owner_id'] === $legacy_owner ) {
			$inventory_owner_rows[] = $inventory_row;
		}
	}$inventory_more = $inventory['has_more'];
	++$inventory_page;}
network_check( count( $inventory_owner_rows ) === 1 && $inventory_owner_rows[0]['record_count'] === 1, 'legacy-job inventory is paged and contains only opaque IDs and counts' );
network_check( ! isset( $inventory_owner_rows[0]['name'] ) && ! isset( $inventory_owner_rows[0]['records'] ), 'quarantine inventory does not disclose job names or customer/order fields' );
$bulk_owner = wp_insert_user(
	array(
		'user_login' => 'rli_bulk_owner_' . wp_generate_password( 8, false ),
		'user_pass'  => wp_generate_password( 32, false ),
		'user_email' => 'rli-bulk-owner-' . wp_generate_password( 8, false ) . '@example.test',
		'role'       => 'subscriber',
	)
);
$many_jobs  = array();for ( $i = 0;$i < 55;$i++ ) {
	$id               = 'legacy-bulk-' . $i;
	$many_jobs[ $id ] = array(
		'id'      => $id,
		'name'    => 'not shown',
		'records' => array(),
		'created' => gmdate( 'c' ),
	);
}update_user_meta( $bulk_owner, RamseyLabels\Store::JOBS, $many_jobs );
$bulk_first = RamseyLabels\NetworkJobs::inventory( 1, $bulk_owner, 0 );
$bulk_last  = RamseyLabels\NetworkJobs::inventory( 1, $bulk_owner, 50 );
network_check( count( $bulk_first['rows'] ) === 50 && $bulk_first['has_more_jobs'] && count( $bulk_last['rows'] ) === 5 && ! $bulk_last['has_more_jobs'], 'large per-owner quarantine inventories page through every job with a fixed display bound' );
wp_delete_user( $bulk_owner );
$dry = RamseyLabels\NetworkJobs::preview( $legacy_owner, 'legacy-opaque-1', $first );
network_check( $dry['status'] === 'quarantined' && $dry['target_id'] === $first && is_string( $dry['fingerprint'] ), 'network-admin dry run validates a proposed site without writing' );
network_check( empty( get_user_meta( $legacy_owner, RamseyLabels\Store::jobs_key(), true ) ), 'dry run does not expose or migrate global jobs' );
$bad = wp_insert_user(
	array(
		'user_login' => 'rli_nonmember_' . wp_generate_password( 8, false ),
		'user_pass'  => wp_generate_password( 32 ),
		'role'       => 'subscriber',
	)
);
update_user_meta( $bad, RamseyLabels\Store::JOBS, array( 'bad-job' => $legacy_job ) );
try {
	RamseyLabels\NetworkJobs::preview( $bad, 'bad-job', $second );
	network_check( false, 'non-member owner cannot be assigned to a site' );
} catch ( InvalidArgumentException $error ) {
	network_check( true, 'non-member owner cannot be assigned to a site' );}
try {
	RamseyLabels\NetworkJobs::preview( $legacy_owner, 'legacy-opaque-1', 99999999 );
	network_check( false, 'invalid site ID rejected' );
} catch ( InvalidArgumentException $error ) {
	network_check( true, 'invalid site ID rejected' );}
wp_set_current_user( $legacy_owner );
try {
	RamseyLabels\NetworkJobs::preview( $legacy_owner, 'legacy-opaque-1', $first );
	network_check( false, 'site owner cannot run network quarantine workflow' );
} catch ( RuntimeException $error ) {
	network_check( true, 'site owner cannot run network quarantine workflow' );}
$site_admin_nonce = wp_generate_password( 8, false );
$site_admin       = wp_insert_user(
	array(
		'user_login' => 'rli_site_admin_' . $site_admin_nonce,
		'user_pass'  => wp_generate_password( 32 ),
		'user_email' => 'site-admin-' . $site_admin_nonce . '@example.test',
		'role'       => 'subscriber',
	)
);
add_user_to_blog( $first, $site_admin, 'administrator' );
wp_set_current_user( $site_admin );
try {
	RamseyLabels\NetworkJobs::preview( $legacy_owner, 'legacy-opaque-1', $first );
	network_check( false, 'site administrator cannot administer network quarantine' );
} catch ( RuntimeException $error ) {
	network_check( true, 'site administrator cannot administer network quarantine' );}
wp_set_current_user( $admin->ID );
$assigned = RamseyLabels\NetworkJobs::assign( $legacy_owner, 'legacy-opaque-1', $first );
network_check( $assigned['status'] === 'assigned', 'explicit dry-run-confirmed assignment creates a site-scoped copy' );
switch_to_blog( $first );
wp_set_current_user( $legacy_owner );
network_check( isset( RamseyLabels\Store::jobs()['legacy-opaque-1'] ), 'owner sees the job only on explicitly assigned site' );
restore_current_blog();
switch_to_blog( $second );
$site_two_jobs = get_user_meta( $legacy_owner, RamseyLabels\Store::jobs_key(), true );
network_check( ! is_array( $site_two_jobs ) || ! isset( $site_two_jobs['legacy-opaque-1'] ), 'second site cannot see first-site assigned job' );
restore_current_blog();
wp_set_current_user( $admin->ID );
try {
	RamseyLabels\NetworkJobs::assign( $legacy_owner, 'legacy-opaque-1', $second );
	network_check( false, 'conflicting site assignment rejected' );
} catch ( DomainException $error ) {
	network_check( true, 'conflicting site assignment rejected' );}
$assignment_key    = $legacy_owner . ':' . hash( 'sha256', 'legacy-opaque-1' );
$assignment_ledger = get_site_option( 'rli_v1_job_site_assignments', array() );
network_check( isset( $assignment_ledger[ $assignment_key ] ) && $assignment_ledger[ $assignment_key ]['status'] === 'assigned' && isset( get_user_meta( $legacy_owner, RamseyLabels\Store::JOBS, true )['legacy-opaque-1'] ), 'network ledger records the explicit mapping while retaining the global quarantine source' );
$first_rollback = RamseyLabels\NetworkJobs::rollback( $legacy_owner, 'legacy-opaque-1' );
network_check( $first_rollback['status'] === 'rolled-back' && ! isset( get_user_meta( $legacy_owner, 'rli_v1_jobs_site_' . $first, true )['legacy-opaque-1'] ) && isset( get_user_meta( $legacy_owner, RamseyLabels\Store::JOBS, true )['legacy-opaque-1'] ), 'rollback removes only the unchanged assigned copy and leaves the original quarantined' );
$orphan_path    = '/rli-legacy-job-orphan-' . strtolower( wp_generate_password( 8, false ) ) . '/';
$orphan_site_id = wp_insert_site(
	array(
		'domain'  => parse_url( network_home_url(), PHP_URL_HOST ),
		'path'    => $orphan_path,
		'title'   => 'Quarantine orphan fixture',
		'user_id' => $admin->ID,
	)
);
if ( is_wp_error( $orphan_site_id ) ) {
	throw new RuntimeException( 'Could not create isolated synthetic orphan site.' );
}
$orphan_site_id = (int) $orphan_site_id;
add_user_to_blog( $orphan_site_id, $legacy_owner, 'subscriber' );
update_user_meta(
	$legacy_owner,
	RamseyLabels\Store::JOBS,
	array(
		'legacy-opaque-1' => $legacy_job,
		'orphan-job'      => $legacy_job,
	)
);
RamseyLabels\NetworkJobs::assign( $legacy_owner, 'orphan-job', $orphan_site_id );
update_blog_status( $orphan_site_id, 'deleted', 1 );
try {
	RamseyLabels\NetworkJobs::preview( $legacy_owner, 'orphan-job', $orphan_site_id );
	network_check( false, 'deleted destination site cannot be assigned' );
} catch ( InvalidArgumentException $error ) {
	network_check( true, 'deleted destination site cannot be assigned' );}
$orphan_rollback = RamseyLabels\NetworkJobs::rollback( $legacy_owner, 'orphan-job' );
network_check( $orphan_rollback['status'] === 'rolled-back', 'deleted-site orphan copy can be safely rolled back by its fingerprint' );
$collision_key = 'rli_v1_jobs_site_' . $second;
update_user_meta(
	$legacy_owner,
	$collision_key,
	array(
		'collision-job' => array(
			'id'      => 'collision-job',
			'records' => array(),
		),
	)
);
update_user_meta( $legacy_owner, RamseyLabels\Store::JOBS, array( 'collision-job' => $legacy_job ) );
try {
	RamseyLabels\NetworkJobs::assign( $legacy_owner, 'collision-job', $second );
	network_check( false, 'pre-existing destination ID collision is rejected' );
} catch ( DomainException $error ) {
	network_check( true, 'pre-existing destination ID collision is rejected' );}
delete_user_meta( $legacy_owner, $collision_key );
update_user_meta( $legacy_owner, RamseyLabels\Store::JOBS, array( 'partial-job' => $legacy_job ) );
$blocked_key = 'rli_v1_jobs_site_' . $first;
$blocker     = function ( $check, $user_id, $meta_key ) use ( $legacy_owner, $blocked_key ) {
	return (int) $user_id === (int) $legacy_owner && $meta_key === $blocked_key ? false : $check;
};
add_filter( 'update_user_metadata', $blocker, 10, 5 );
try {
	RamseyLabels\NetworkJobs::assign( $legacy_owner, 'partial-job', $first );
	network_check( false, 'partial site-meta write is surfaced as a recoverable pending migration' );
} catch ( RuntimeException $error ) {
	network_check( true, 'partial site-meta write is surfaced as a recoverable pending migration' );
} finally {
	remove_filter( 'update_user_metadata', $blocker, 10 );}
$pending = RamseyLabels\NetworkJobs::rollback( $legacy_owner, 'partial-job' );
network_check( $pending['status'] === 'rolled-back' && isset( get_user_meta( $legacy_owner, RamseyLabels\Store::JOBS, true )['partial-job'] ), 'partial write rollback clears pending decision and retains quarantined source' );
update_user_meta( $legacy_owner, RamseyLabels\Store::JOBS, array( 'locked-job' => $legacy_job ) );
switch_to_blog( $first );
$saved_job_lock = RamseyLabels\Store::acquire_lock( 'jobs_index' );
restore_current_blog();
try {
	RamseyLabels\NetworkJobs::assign( $legacy_owner, 'locked-job', $first );
	network_check( false, 'network migration respects a concurrent normal job writer' );
} catch ( DomainException $error ) {
	network_check( true, 'network migration respects a concurrent normal job writer' );}
switch_to_blog( $first );
RamseyLabels\Store::release_lock( $saved_job_lock );
restore_current_blog();
$lock_recovery = RamseyLabels\NetworkJobs::rollback( $legacy_owner, 'locked-job' );
network_check( $lock_recovery['status'] === 'rolled-back' && ! isset( get_user_meta( $legacy_owner, 'rli_v1_jobs_site_' . $first, true )['locked-job'] ), 'failed concurrent migration remains quarantined and has a recoverable rollback' );
update_user_meta( $legacy_owner, RamseyLabels\Store::JOBS, array( 'edited-job' => $legacy_job ) );
RamseyLabels\NetworkJobs::assign( $legacy_owner, 'edited-job', $first );
$edited                       = get_user_meta( $legacy_owner, $blocked_key, true );
$edited['edited-job']['name'] = 'Owner changed after assignment';
update_user_meta( $legacy_owner, $blocked_key, $edited );
try {
	RamseyLabels\NetworkJobs::rollback( $legacy_owner, 'edited-job' );
	network_check( false, 'rollback refuses to delete a site copy edited after migration' );
} catch ( DomainException $error ) {
	network_check( true, 'rollback refuses to delete a site copy edited after migration' );}
wp_delete_user( $legacy_owner );
wp_delete_user( $bad );
wp_delete_user( $site_admin );
wp_delete_site( $orphan_site_id );
define( 'WP_UNINSTALL_PLUGIN', 'ramsey-labels-independent/ramsey-labels-independent.php' );
require dirname( __DIR__, 2 ) . '/uninstall.php';
switch_to_blog( $first );
network_check( get_option( 'rli_v1_library' ) !== null && get_user_meta( $admin->ID, $first_key, true ) !== array(), 'network uninstall preserves both sites by default' );
restore_current_blog();
define( 'RLI_PURGE_ON_UNINSTALL', true );
require dirname( __DIR__, 2 ) . '/uninstall.php';
switch_to_blog( $first );
network_check( get_option( 'rli_v1_library', null ) === null && empty( get_user_meta( $admin->ID, $first_key, true ) ), 'explicit network purge removes site one options/jobs' );
restore_current_blog();
switch_to_blog( $second );
network_check( get_option( 'rli_v1_library', null ) === null && empty( get_user_meta( $admin->ID, $second_key, true ) ), 'explicit network purge removes site two options/jobs' );
restore_current_blog();
echo 'Multisite lifecycle assertions: ' . $GLOBALS['network_assertions'] . "\n";
