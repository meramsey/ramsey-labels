<?php
/** Explicit network-admin workflow for ambiguous pre-site-scope jobs.
 *
 * @package RamseyLabels
 */

namespace RamseyLabels;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Quarantine ambiguous global user jobs until a network admin assigns ownership. */
final class NetworkJobs {
	private const AUDIT_KEY = 'rli_v1_job_site_assignments';
	private const LOCK_KEY  = 'rli_v1_job_site_assignment_lock';
	private const PAGE_SIZE = 5;

	/** Register the network-only interface; site administrators cannot access it. */
	public static function boot() {
		if ( ! is_multisite() ) {
			return;
		}
		add_action( 'network_admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_post_rli_network_job_assignment', array( __CLASS__, 'handle' ) );
	}

	/** Add the quarantine console to Network Admin > Settings. */
	public static function menu() {
		if ( current_user_can( 'manage_network_options' ) ) {
			add_submenu_page( 'settings.php', esc_html__( 'Ramsey Labels job quarantine', 'ramsey-labels-independent' ), esc_html__( 'Ramsey Labels job quarantine', 'ramsey-labels-independent' ), 'manage_network_options', 'rli-network-jobs', array( __CLASS__, 'render' ) );
		}
	}

	/** Validate network-admin authority before inspecting, assigning or rolling back.
	 *
	 * @throws \RuntimeException If the current user is not a network administrator.
	 */
	private static function authorize() {
		if ( ! is_multisite() || ! current_user_can( 'manage_network_options' ) ) {
			throw new \RuntimeException( esc_html__( 'Only a network administrator can manage quarantined legacy jobs.', 'ramsey-labels-independent' ) );
		}
	}

	/** Return the site-scoped metadata key for a target, without switching global state.
	 *
	 * @param int $site_id Site identifier.
	 * @return string User-meta key.
	 */
	private static function site_key( $site_id ) {
		return Store::JOBS . '_site_' . Schema::number( $site_id, 1, PHP_INT_MAX, true );
	}

	/** Compact audit key never contains the private job body.
	 *
	 * @param int    $owner User identifier.
	 * @param string $job_id Saved-job identifier.
	 * @return string Hashed ledger key.
	 */
	private static function assignment_key( $owner, $job_id ) {
		return absint( $owner ) . ':' . hash( 'sha256', (string) $job_id );
	}

	/** Fingerprint a job so rollback never removes a job edited after migration.
	 *
	 * @param array $job Saved job.
	 * @return string Job fingerprint.
	 */
	private static function fingerprint( $job ) {
		return hash( 'sha256', maybe_serialize( $job ) );
	}

	/** Read the private network-wide decision ledger. */
	private static function audit() {
		$ledger = get_site_option( self::AUDIT_KEY, array() );
		return is_array( $ledger ) ? $ledger : array();
	}

	/** Persist a bounded decision ledger and verify it after the WordPress write.
	 *
	 * @param array $ledger Assignment ledger.
	 * @throws \InvalidArgumentException If the audit storage limit is exceeded.
	 * @throws \RuntimeException If the write cannot be verified.
	 */
	private static function save_audit( array $ledger ) {
		if ( count( $ledger ) > 10000 || strlen( wp_json_encode( $ledger ) ) > 1000000 ) {
			throw new \InvalidArgumentException( esc_html__( 'The network assignment audit limit is reached; export/review the ledger before continuing.', 'ramsey-labels-independent' ) );
		}
		update_site_option( self::AUDIT_KEY, $ledger );
		wp_cache_delete( self::AUDIT_KEY, 'site-options' );
		if ( self::audit() !== $ledger ) {
			throw new \RuntimeException( esc_html__( 'Could not verify the network assignment audit write.', 'ramsey-labels-independent' ) );
		}
	}

	/** Clear the network-option value and not-options cache after direct CAS operations. */
	private static function clear_lock_cache() {
		$network_id = get_current_network_id();
		wp_cache_delete( $network_id . ':' . self::LOCK_KEY, 'site-options' );
		wp_cache_delete( $network_id . ':notoptions', 'site-options' );
	}

	/** Serialize assignment/rollback operations across the multisite network.
	 *
	 * @param callable $callback Operation executed while holding the lock.
	 * @return mixed Callback result.
	 * @throws \DomainException If another operation owns the lock.
	 */
	private static function with_lock( callable $callback ) {
		global $wpdb;
		$lease = array(
			'token'   => wp_generate_uuid4(),
			'expires' => time() + 120,
		);
		self::clear_lock_cache();
		if ( ! add_site_option( self::LOCK_KEY, $lease ) ) {
			self::clear_lock_cache();
			$old = get_site_option( self::LOCK_KEY );
			if ( is_array( $old ) && isset( $old['expires'] ) && $old['expires'] < time() ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Exact lease CAS; cache is cleared below.
				$wpdb->delete(
					$wpdb->sitemeta,
					array(
						'site_id'    => get_current_network_id(),
						// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Exact lock key for a lease CAS.
						'meta_key'   => self::LOCK_KEY,
						// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- Exact serialized lease CAS.
						'meta_value' => maybe_serialize( $old ),
					),
					array( '%d', '%s', '%s' )
				);
				self::clear_lock_cache();
			}
			if ( ! add_site_option( self::LOCK_KEY, $lease ) ) {
				throw new \DomainException( esc_html__( 'Another network job assignment is in progress; retry shortly.', 'ramsey-labels-independent' ) );
			}
		}
		try {
			return call_user_func( $callback );
		} finally {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Release only this token; cache is cleared below.
			$wpdb->delete(
				$wpdb->sitemeta,
				array(
					'site_id'    => get_current_network_id(),
					// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Exact lock key for this lease.
					'meta_key'   => self::LOCK_KEY,
					// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- Exact serialized lease token.
					'meta_value' => maybe_serialize( $lease ),
				),
				array( '%d', '%s', '%s' )
			);
			self::clear_lock_cache();
		}
	}

	/** Hold the exact site/user leases used by ordinary saved-job writes.
	 *
	 * @param int      $site_id Target site.
	 * @param int      $owner User identifier.
	 * @param callable $callback Operation executed while holding the locks.
	 * @return mixed Callback result.
	 */
	private static function with_owner_site_lock( $site_id, $owner, callable $callback ) {
		if ( ! get_site( (int) $site_id ) ) {
			// A hard-deleted site cannot execute saved-job writes; only the network assignment lock remains.
			wp_cache_delete( (int) $owner, 'user_meta' );
			return call_user_func( $callback, self::site_key( $site_id ) );
		}
		switch_to_blog( (int) $site_id );
		$index_lock = null;
		$owner_lock = null;
		try {
			$index_lock = Store::acquire_lock( 'jobs_index' );
			$owner_lock = Store::acquire_lock( 'jobs_' . (int) $owner );
			wp_cache_delete( (int) $owner, 'user_meta' );
			return call_user_func( $callback, self::site_key( $site_id ) );
		} finally {
			if ( $owner_lock ) {
				Store::release_lock( $owner_lock );
			}
			if ( $index_lock ) {
				Store::release_lock( $index_lock );
			}
			restore_current_blog();
		}
	}

	/** Refuse non-existent, archived, spammed or deleted destination sites.
	 *
	 * @param mixed $site_id Requested site identifier.
	 * @return \WP_Site Active destination.
	 * @throws \InvalidArgumentException If the target site is invalid or inactive.
	 */
	private static function target_site( $site_id ) {
		$site_id = Schema::number( $site_id, 1, PHP_INT_MAX, true );
		$site    = get_site( $site_id );
		if ( ! $site || $site->archived || $site->spam || $site->deleted ) {
			throw new \InvalidArgumentException( esc_html__( 'Choose an active, existing network site.', 'ramsey-labels-independent' ) );
		}
		return $site;
	}

	/** Refuse assignment if the destination lacks the profile or source rights this owner needs.
	 *
	 * @param int   $owner User identifier.
	 * @param array $job Saved job.
	 * @param int   $site_id Destination site.
	 * @throws \InvalidArgumentException If the job cannot be accessed on the destination.
	 */
	private static function validate_site_access( $owner, array $job, $site_id ) {
		switch_to_blog( (int) $site_id );
		$previous_user = get_current_user_id();
		try {
			$library = Store::read();
			wp_set_current_user( (int) $owner );
			if ( ! Store::job_accessible( $job, $library ) ) {
				throw new \InvalidArgumentException( esc_html__( 'The owner cannot access this saved job profile or its product/order sources on the destination site. The job remains quarantined.', 'ramsey-labels-independent' ) );
			}
		} finally {
			wp_set_current_user( $previous_user );
			restore_current_blog();
		}
	}

	/** Inspect one ambiguous job with non-sensitive metadata only.
	 *
	 * @param mixed $owner User identifier.
	 * @param mixed $job_id Saved-job identifier.
	 * @param mixed $site_id Proposed destination site.
	 * @return array Redacted dry-run summary.
	 * @throws \InvalidArgumentException If the source, user, or target is invalid.
	 * @throws \DomainException If the proposed mapping conflicts with an existing decision.
	 */
	public static function preview( $owner, $job_id, $site_id ) {
		self::authorize();
		$owner  = Schema::number( $owner, 1, PHP_INT_MAX, true );
		$job_id = Schema::identifier( $job_id );
		$site   = self::target_site( $site_id );
		if ( ! get_userdata( $owner ) || ! is_user_member_of_blog( $owner, (int) $site->blog_id ) ) {
			throw new \InvalidArgumentException( esc_html__( 'The job owner must be an active member of the destination site.', 'ramsey-labels-independent' ) );
		}
		$legacy = get_user_meta( $owner, Store::JOBS, true );
		if ( ! is_array( $legacy ) || ! isset( $legacy[ $job_id ] ) || ! is_array( $legacy[ $job_id ] ) ) {
			throw new \InvalidArgumentException( esc_html__( 'The quarantined job no longer exists.', 'ramsey-labels-independent' ) );
		}
		$job = $legacy[ $job_id ];
		if ( empty( $job['records'] ) || ! is_array( $job['records'] ) || count( $job['records'] ) > Schema::MAX_RECORDS ) {
			throw new \InvalidArgumentException( esc_html__( 'This legacy job does not meet current bounded record requirements; it remains quarantined.', 'ramsey-labels-independent' ) );
		}
		Schema::records( $job['records'], true );
		self::validate_site_access( $owner, $job, (int) $site->blog_id );
		$ledger_key = self::assignment_key( $owner, $job_id );
		$ledger     = self::audit();
		$decision   = isset( $ledger[ $ledger_key ] ) ? $ledger[ $ledger_key ] : null;
		if ( $decision && in_array( $decision['status'], array( 'pending', 'assigned', 'rollback-pending' ), true ) && (int) $decision['site_id'] !== (int) $site->blog_id ) {
			throw new \DomainException( esc_html__( 'This job already has an active or pending assignment to another site.', 'ramsey-labels-independent' ) );
		}
		if ( $decision && 'rollback-pending' === $decision['status'] ) {
			throw new \DomainException( esc_html__( 'This job has a pending rollback; finish that recovery before assigning it again.', 'ramsey-labels-independent' ) );
		}
		$site_jobs = get_user_meta( $owner, self::site_key( (int) $site->blog_id ), true );
		if ( is_array( $site_jobs ) && isset( $site_jobs[ $job_id ] ) && ( ! $decision || 'assigned' !== $decision['status'] ) ) {
			throw new \DomainException( esc_html__( 'A different site-scoped job with this ID already exists; it will not be overwritten.', 'ramsey-labels-independent' ) );
		}
		return array(
			'owner_id'     => $owner,
			'job_token'    => substr( hash( 'sha256', $job_id ), 0, 12 ),
			'record_count' => count( $job['records'] ),
			'created'      => isset( $job['created'] ) && is_string( $job['created'] ) && 1 === preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/', $job['created'] ) ? $job['created'] : '',
			'target_id'    => (int) $site->blog_id,
			'target_url'   => esc_url_raw( get_home_url( (int) $site->blog_id ) ),
			'status'       => $decision ? $decision['status'] : 'quarantined',
			'fingerprint'  => self::fingerprint( $job ),
		);
	}

	/** Copy one explicitly mapped legacy job; the global source stays quarantined.
	 *
	 * @param mixed $owner User identifier.
	 * @param mixed $job_id Saved-job identifier.
	 * @param mixed $site_id Explicit destination site.
	 * @return array Assignment result.
	 * @throws \Throwable If validation, persistence, or verification fails.
	 */
	public static function assign( $owner, $job_id, $site_id ) {
		self::authorize();
		return self::with_lock(
			static function () use ( $owner, $job_id, $site_id ) {
				$preview = self::preview( $owner, $job_id, $site_id );
				$key     = self::assignment_key( $owner, $job_id );
				$ledger  = self::audit();
				if ( isset( $ledger[ $key ] ) && 'assigned' === $ledger[ $key ]['status'] ) {
					return $preview;
				}
				$ledger[ $key ] = array(
					'owner_id'    => (int) $preview['owner_id'],
					'job_id'      => Schema::identifier( $job_id ),
					'site_id'     => (int) $preview['target_id'],
					'fingerprint' => $preview['fingerprint'],
					'status'      => 'pending',
					'actor_id'    => get_current_user_id(),
					'assigned_at' => gmdate( 'c' ),
				);
				self::save_audit( $ledger );
				return self::with_owner_site_lock(
					$preview['target_id'],
					$preview['owner_id'],
					static function ( $meta_key ) use ( $owner, $job_id, $key, $preview ) {
						$site = get_site( $preview['target_id'] );
						if ( ! $site || $site->archived || $site->spam || $site->deleted || ! is_user_member_of_blog( $owner, $preview['target_id'] ) ) {
							throw new \DomainException( esc_html__( 'Destination site status or owner membership changed during assignment; the legacy job remains quarantined.', 'ramsey-labels-independent' ) );
						}
						$legacy = get_user_meta( $owner, Store::JOBS, true );
						if ( ! is_array( $legacy ) || ! isset( $legacy[ $job_id ] ) || self::fingerprint( $legacy[ $job_id ] ) !== $preview['fingerprint'] ) {
							throw new \DomainException( esc_html__( 'The quarantined source changed after the dry run. Inspect it again before assigning.', 'ramsey-labels-independent' ) );
						}
						$site_jobs = get_user_meta( $owner, $meta_key, true );
						$site_jobs = is_array( $site_jobs ) ? $site_jobs : array();
						if ( isset( $site_jobs[ $job_id ] ) ) {
							throw new \DomainException( esc_html__( 'A site-scoped job appeared during assignment; the legacy job remains quarantined.', 'ramsey-labels-independent' ) );
						}
						$site_jobs[ $job_id ] = $legacy[ $job_id ];
						if ( strlen( wp_json_encode( $site_jobs ) ) > 2000000 ) {
							throw new \InvalidArgumentException( esc_html__( 'The destination account has no room under the saved-job storage budget.', 'ramsey-labels-independent' ) );
						}
						update_user_meta( $owner, $meta_key, $site_jobs );
						wp_cache_delete( $owner, 'user_meta' );
						$written = get_user_meta( $owner, $meta_key, true );
						if ( ! is_array( $written ) || ! isset( $written[ $job_id ] ) || self::fingerprint( $written[ $job_id ] ) !== $preview['fingerprint'] ) {
							throw new \RuntimeException( esc_html__( 'The destination copy could not be verified. The legacy source remains quarantined; use rollback if a partial copy exists.', 'ramsey-labels-independent' ) );
						}
						$ledger                   = self::audit();
						$ledger[ $key ]['status'] = 'assigned';
						self::save_audit( $ledger );
						$result           = $preview;
						$result['status'] = 'assigned';
						return $result;
					}
				);
			}
		);
	}

	/** Roll back only the exact copy made by this workflow, never later user edits.
	 *
	 * @param mixed $owner User identifier.
	 * @param mixed $job_id Saved-job identifier.
	 * @return array Rollback result.
	 * @throws \Throwable If the copy changed or removal cannot be verified.
	 */
	public static function rollback( $owner, $job_id ) {
		self::authorize();
		return self::with_lock(
			static function () use ( $owner, $job_id ) {
				$owner  = Schema::number( $owner, 1, PHP_INT_MAX, true );
				$job_id = Schema::identifier( $job_id );
				$key    = self::assignment_key( $owner, $job_id );
				$ledger = self::audit();
				if ( ! isset( $ledger[ $key ] ) || ! in_array( $ledger[ $key ]['status'], array( 'pending', 'assigned', 'rollback-pending' ), true ) ) {
					throw new \InvalidArgumentException( esc_html__( 'No active assignment exists to roll back.', 'ramsey-labels-independent' ) );
				}
				$decision = $ledger[ $key ];
				return self::with_owner_site_lock(
					$decision['site_id'],
					$owner,
					static function ( $meta_key ) use ( $owner, $job_id, $key, $decision ) {
						$site_jobs = get_user_meta( $owner, $meta_key, true );
						if ( is_array( $site_jobs ) && isset( $site_jobs[ $job_id ] ) ) {
							if ( self::fingerprint( $site_jobs[ $job_id ] ) !== $decision['fingerprint'] ) {
								throw new \DomainException( esc_html__( 'The site copy changed after assignment. Rollback refused to avoid deleting edits; manually review the two copies.', 'ramsey-labels-independent' ) );
							}
							$ledger                   = self::audit();
							$ledger[ $key ]['status'] = 'rollback-pending';
							self::save_audit( $ledger );
							unset( $site_jobs[ $job_id ] );
							update_user_meta( $owner, $meta_key, $site_jobs );
							wp_cache_delete( $owner, 'user_meta' );
							$verify = get_user_meta( $owner, $meta_key, true );
							if ( is_array( $verify ) && isset( $verify[ $job_id ] ) ) {
								throw new \RuntimeException( esc_html__( 'Could not verify removal of the site copy; the legacy source remains quarantined.', 'ramsey-labels-independent' ) );
							}
						}
						$ledger                           = self::audit();
						$ledger[ $key ]['status']         = 'rolled-back';
						$ledger[ $key ]['rolled_back_by'] = get_current_user_id();
						$ledger[ $key ]['rolled_back_at'] = gmdate( 'c' );
						self::save_audit( $ledger );
						return array(
							'owner_id'  => $owner,
							'job_token' => substr( hash( 'sha256', $job_id ), 0, 12 ),
							'site_id'   => (int) $decision['site_id'],
							'status'    => 'rolled-back',
						);
					}
				);
			}
		);
	}

	/** Return bounded, redacted inventory rows; never display names or record values.
	 *
	 * @param int   $owner Owner ID.
	 * @param array $jobs Owner's legacy jobs.
	 * @param int   $offset First job index.
	 * @param int   $limit Maximum number of jobs.
	 * @param array $ledger Assignment audit.
	 * @return array Redacted inventory page.
	 */
	private static function metadata_rows( $owner, array $jobs, $offset, $limit, array $ledger ) {
		ksort( $jobs, SORT_STRING );
		$all_ids  = array_keys( $jobs );
		$selected = array_slice( $all_ids, $offset, $limit );
		$rows     = array();
		foreach ( $selected as $job_id ) {
			$job = $jobs[ $job_id ];
			if ( ! is_array( $job ) ) {
				continue;
			}
			$key      = self::assignment_key( $owner, $job_id );
			$decision = isset( $ledger[ $key ] ) ? $ledger[ $key ] : array();
			$rows[]   = array(
				'owner_id'     => (int) $owner,
				'job_id'       => (string) $job_id,
				'job_token'    => substr( hash( 'sha256', (string) $job_id ), 0, 12 ),
				'record_count' => isset( $job['records'] ) && is_array( $job['records'] ) ? count( $job['records'] ) : 0,
				'created'      => isset( $job['created'] ) && is_string( $job['created'] ) && 1 === preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/', $job['created'] ) ? $job['created'] : '',
				'status'       => isset( $decision['status'] ) ? $decision['status'] : 'quarantined',
				'site_id'      => isset( $decision['site_id'] ) ? (int) $decision['site_id'] : 0,
				'valid_id'     => is_string( $job_id ) && 1 === preg_match( '/^[A-Za-z0-9_-]{1,80}$/', $job_id ),
			);
		}
		return array(
			'rows'          => $rows,
			'total'         => count( $all_ids ),
			'has_more_jobs' => $offset + count( $selected ) < count( $all_ids ),
		);
	}

	/** Return a bounded page of quarantined legacy job metadata.
	 *
	 * @param int $page Owner page.
	 * @param int $focus_owner Optional owner whose job list is being paged.
	 * @param int $job_offset Job offset for focused owner.
	 * @return array Redacted inventory.
	 * @throws \RuntimeException If the current user is not a network administrator.
	 */
	public static function inventory( $page = 1, $focus_owner = 0, $job_offset = 0 ) {
		self::authorize();
		$page        = Schema::number( $page, 1, 100000, true );
		$focus_owner = $focus_owner ? Schema::number( $focus_owner, 1, PHP_INT_MAX, true ) : 0;
		$job_offset  = Schema::number( $job_offset, 0, 10000000, true );
		$ledger      = self::audit();
		if ( $focus_owner ) {
			$jobs = get_user_meta( $focus_owner, Store::JOBS, true );
			if ( ! is_array( $jobs ) ) {
				$jobs = array();
			}
			$result = self::metadata_rows( $focus_owner, $jobs, $job_offset, 50, $ledger );
			return array(
				'page'          => $page,
				'has_more'      => false,
				'focus_owner'   => $focus_owner,
				'job_offset'    => $job_offset,
				'has_more_jobs' => $result['has_more_jobs'],
				'rows'          => $result['rows'],
			);
		}
		// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- exact legacy meta key, 6 user IDs per network-admin page.
		$owners = get_users(
			array(
				'blog_id'       => 0,
				'meta_key'      => Store::JOBS, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key,WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- Exact key and bounded owner page.
				'number'        => self::PAGE_SIZE + 1,
				'offset'        => ( $page - 1 ) * self::PAGE_SIZE,
				'orderby'       => 'ID',
				'order'         => 'ASC',
				'fields'        => 'ID',
				'cache_results' => false,
			)
		);
		$more   = count( $owners ) > self::PAGE_SIZE;
		$owners = array_slice( $owners, 0, self::PAGE_SIZE );
		$rows   = array();
		foreach ( $owners as $owner ) {
			$jobs = get_user_meta( $owner, Store::JOBS, true );
			if ( ! is_array( $jobs ) ) {
				continue;
			}
			$partial    = self::metadata_rows( $owner, $jobs, 0, 50, $ledger );
			$last_index = count( $partial['rows'] ) - 1;
			foreach ( $partial['rows'] as $index => $row ) {
				$rows[] = $row + array( 'has_more_jobs' => $partial['has_more_jobs'] && $index === $last_index );
			}
		}
		return array(
			'page'     => $page,
			'has_more' => $more,
			'rows'     => $rows,
		);
	}

	/** Handle nonce-protected network admin forms and redirect with a simple outcome.
	 *
	 * @throws \InvalidArgumentException If an action is invalid.
	 */
	public static function handle() {
		try {
			self::authorize();
			check_admin_referer( 'rli_network_job_assignment' );
			$action  = isset( $_POST['rli_action'] ) ? sanitize_key( wp_unslash( $_POST['rli_action'] ) ) : '';
			$owner   = isset( $_POST['owner_id'] ) ? absint( $_POST['owner_id'] ) : 0;
			$job_id  = isset( $_POST['job_id'] ) && is_string( $_POST['job_id'] ) ? sanitize_text_field( wp_unslash( $_POST['job_id'] ) ) : '';
			$site_id = isset( $_POST['site_id'] ) ? absint( wp_unslash( $_POST['site_id'] ) ) : 0;
			if ( 'preview' === $action ) {
				$result = self::preview( $owner, $job_id, $site_id );
				/* translators: 1: user ID, 2: opaque job token, 3: record count, 4: site ID, 5: site URL. */
				$notice = sprintf( esc_html__( 'Dry run passed: owner %1$d, job token %2$s, %3$d records, destination site %4$d (%5$s). No data was changed.', 'ramsey-labels-independent' ), $result['owner_id'], $result['job_token'], $result['record_count'], $result['target_id'], $result['target_url'] );
			} elseif ( 'assign' === $action ) {
				$result = self::assign( $owner, $job_id, $site_id );
				/* translators: 1: opaque job token, 2: site ID. */
				$notice = sprintf( esc_html__( 'Job token %1$s assigned to site %2$d. The legacy source remains in quarantine.', 'ramsey-labels-independent' ), $result['job_token'], $result['target_id'] );
			} elseif ( 'rollback' === $action ) {
				$result = self::rollback( $owner, $job_id );
				/* translators: %s: opaque job token. */
				$notice = sprintf( esc_html__( 'Assignment for job token %1$s was rolled back. The legacy source remains quarantined.', 'ramsey-labels-independent' ), $result['job_token'] );
			} else {
				throw new \InvalidArgumentException( esc_html__( 'Choose a valid quarantine action.', 'ramsey-labels-independent' ) );
			}
			set_transient(
				'rli_network_jobs_notice_' . get_current_user_id(),
				array(
					'type' => 'success',
					'text' => $notice,
				),
				60
			);
		} catch ( \Throwable $error ) {
			set_transient(
				'rli_network_jobs_notice_' . get_current_user_id(),
				array(
					'type' => 'error',
					'text' => $error->getMessage(),
				),
				60
			);
		}
		$page     = isset( $_POST['page'] ) ? absint( $_POST['page'] ) : 1;
		$redirect = array(
			'page'          => 'rli-network-jobs',
			'rli_jobs_page' => max( 1, $page ),
		);
		if ( isset( $_POST['owner_filter'] ) && absint( $_POST['owner_filter'] ) ) {
			$redirect['rli_jobs_owner']  = absint( wp_unslash( $_POST['owner_filter'] ) );
			$redirect['rli_jobs_offset'] = isset( $_POST['job_offset'] ) ? absint( wp_unslash( $_POST['job_offset'] ) ) : 0;
		}
		wp_safe_redirect( add_query_arg( $redirect, network_admin_url( 'settings.php' ) ) );
		exit;
	}

	/** Render a privacy-minimizing, explicit-owner-assignment console. */
	public static function render() {
		self::authorize();
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only pagination and owner filters.
		$page = isset( $_GET['rli_jobs_page'] ) ? absint( $_GET['rli_jobs_page'] ) : 1;
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only owner filter; mutations require POST nonce.
		$owner_filter = isset( $_GET['rli_jobs_owner'] ) ? absint( $_GET['rli_jobs_owner'] ) : 0;
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only pagination only.
		$job_offset = isset( $_GET['rli_jobs_offset'] ) ? absint( $_GET['rli_jobs_offset'] ) : 0;
		$inventory  = self::inventory( $page, $owner_filter, $job_offset );
		$notice     = get_transient( 'rli_network_jobs_notice_' . get_current_user_id() );
		delete_transient( 'rli_network_jobs_notice_' . get_current_user_id() );
		echo '<div class="wrap"><h1>' . esc_html__( 'Ramsey Labels legacy-job quarantine', 'ramsey-labels-independent' ) . '</h1>';
		echo '<p>' . esc_html__( 'These RC8/RC9 network jobs have no recorded owning site. This page shows only owner IDs, opaque job tokens, timestamps and record counts. Run a dry-run, confirm the site with the data owner, then explicitly assign. The original legacy records are retained; rollback removes only an unchanged site-scoped copy.', 'ramsey-labels-independent' ) . '</p>';
		if ( is_array( $notice ) && isset( $notice['text'] ) ) {
			echo '<div class="notice notice-' . esc_attr( isset( $notice['type'] ) ? $notice['type'] : 'info' ) . '"><p>' . esc_html( $notice['text'] ) . '</p></div>';
		}
		echo '<table class="widefat striped"><thead><tr><th>' . esc_html__( 'Owner ID', 'ramsey-labels-independent' ) . '</th><th>' . esc_html__( 'Opaque job token', 'ramsey-labels-independent' ) . '</th><th>' . esc_html__( 'Created', 'ramsey-labels-independent' ) . '</th><th>' . esc_html__( 'Records', 'ramsey-labels-independent' ) . '</th><th>' . esc_html__( 'Decision', 'ramsey-labels-independent' ) . '</th><th>' . esc_html__( 'Explicit site mapping', 'ramsey-labels-independent' ) . '</th></tr></thead><tbody>';
		foreach ( $inventory['rows'] as $row ) {
			echo '<tr><td>' . esc_html( (string) $row['owner_id'] ) . '</td><td>' . esc_html( $row['job_token'] ) . '</td><td>' . esc_html( $row['created'] ) . '</td><td>' . esc_html( (string) $row['record_count'] ) . '</td><td>' . esc_html( $row['status'] . ( $row['site_id'] ? ' → site ' . $row['site_id'] : '' ) ) . '</td><td>';
			if ( ! $row['valid_id'] ) {
				echo esc_html__( 'Unsupported legacy ID; remains quarantined for manual review.', 'ramsey-labels-independent' );
				echo '</td></tr>';
				continue;
			}
			foreach ( array(
				'preview' => esc_html__( 'Dry run', 'ramsey-labels-independent' ),
				'assign'  => esc_html__( 'Assign this job', 'ramsey-labels-independent' ),
			) as $action => $label ) {
				echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="display:inline-block;margin:2px"';
				if ( 'assign' === $action ) {
					echo ' onsubmit="return confirm(\'' . esc_js( esc_html__( 'Assign only after you have confirmed this owner-to-site mapping with the responsible site owner. The global source will remain quarantined.', 'ramsey-labels-independent' ) ) . '\')"';
				}
				echo '>';
				wp_nonce_field( 'rli_network_job_assignment' );
				echo '<input type="hidden" name="action" value="rli_network_job_assignment"><input type="hidden" name="rli_action" value="' . esc_attr( $action ) . '"><input type="hidden" name="owner_id" value="' . esc_attr( (string) $row['owner_id'] ) . '"><input type="hidden" name="job_id" value="' . esc_attr( $row['job_id'] ) . '"><input type="hidden" name="page" value="' . esc_attr( (string) $page ) . '"><input type="hidden" name="owner_filter" value="' . esc_attr( (string) $owner_filter ) . '"><input type="hidden" name="job_offset" value="' . esc_attr( (string) $job_offset ) . '"><label class="screen-reader-text" for="rli-site-' . esc_attr( $row['job_token'] . '-' . $action ) . '">' . esc_html__( 'Destination site ID', 'ramsey-labels-independent' ) . '</label><input id="rli-site-' . esc_attr( $row['job_token'] . '-' . $action ) . '" type="number" min="1" name="site_id" placeholder="' . esc_attr__( 'Site ID', 'ramsey-labels-independent' ) . '" required><button class="button" type="submit">' . esc_html( $label ) . '</button></form>';
			}
			if ( in_array( $row['status'], array( 'assigned', 'pending', 'rollback-pending' ), true ) ) {
				echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="display:inline-block;margin:2px">';
				wp_nonce_field( 'rli_network_job_assignment' );
				echo '<input type="hidden" name="action" value="rli_network_job_assignment"><input type="hidden" name="rli_action" value="rollback"><input type="hidden" name="owner_id" value="' . esc_attr( (string) $row['owner_id'] ) . '"><input type="hidden" name="job_id" value="' . esc_attr( $row['job_id'] ) . '"><input type="hidden" name="page" value="' . esc_attr( (string) $page ) . '"><button class="button" type="submit">' . esc_html__( 'Rollback unchanged copy', 'ramsey-labels-independent' ) . '</button></form>';
			}
			echo '</td></tr>';
			if ( ! empty( $row['has_more_jobs'] ) ) {
				$next_offset = $owner_filter ? $job_offset + 100 : 50;
				// nosemgrep: php.lang.security.injection.echoed-request.echoed-request -- URL is built from bounded numeric IDs and escaped by esc_url().
				echo '<tr><td colspan="6"><a class="button" href="' . esc_url(
					add_query_arg(
						array(
							'page'            => 'rli-network-jobs',
							'rli_jobs_owner'  => $row['owner_id'],
							'rli_jobs_offset' => $next_offset,
						),
						network_admin_url( 'settings.php' )
					)
				) . '">' . esc_html__( 'Show more quarantined jobs for this owner', 'ramsey-labels-independent' ) . '</a></td></tr>';
			}
		}
		if ( ! $inventory['rows'] ) {
			echo '<tr><td colspan="6">' . esc_html__( 'No quarantined legacy jobs were found on this page.', 'ramsey-labels-independent' ) . '</td></tr>';
		}
		echo '</tbody></table>';
		if ( $owner_filter ) {
			if ( $job_offset > 0 ) {
				// nosemgrep: php.lang.security.injection.echoed-request.echoed-request -- URL is built from bounded pagination values and escaped by esc_url().
				echo '<a class="button" href="' . esc_url(
					add_query_arg(
						array(
							'page'            => 'rli-network-jobs',
							'rli_jobs_owner'  => $owner_filter,
							'rli_jobs_offset' => max( 0, $job_offset - 50 ),
						),
						network_admin_url( 'settings.php' )
					)
				) . '">' . esc_html__( 'Previous jobs for owner', 'ramsey-labels-independent' ) . '</a> ';
			}
			if ( ! empty( $inventory['has_more_jobs'] ) ) {
				// nosemgrep: php.lang.security.injection.echoed-request.echoed-request -- URL is built from bounded pagination values and escaped by esc_url().
				echo '<a class="button" href="' . esc_url(
					add_query_arg(
						array(
							'page'            => 'rli-network-jobs',
							'rli_jobs_owner'  => $owner_filter,
							'rli_jobs_offset' => $job_offset + 50,
						),
						network_admin_url( 'settings.php' )
					)
				) . '">' . esc_html__( 'Next jobs for owner', 'ramsey-labels-independent' ) . '</a>';
			}
		}
		if ( $page > 1 ) {
			echo '<a class="button" href="' . esc_url(
				add_query_arg(
					array(
						'page'          => 'rli-network-jobs',
						'rli_jobs_page' => $page - 1,
					),
					network_admin_url( 'settings.php' )
				)
			) . '">' . esc_html__( 'Previous owner page', 'ramsey-labels-independent' ) . '</a> ';
		}
		if ( $inventory['has_more'] ) {
			echo '<a class="button" href="' . esc_url(
				add_query_arg(
					array(
						'page'          => 'rli-network-jobs',
						'rli_jobs_page' => $page + 1,
					),
					network_admin_url( 'settings.php' )
				)
			) . '">' . esc_html__( 'Next owner page', 'ramsey-labels-independent' ) . '</a>';
		}
		echo '</div>';
	}
}
