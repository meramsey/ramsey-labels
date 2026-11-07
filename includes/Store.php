<?php
/**
 * Independent option storage with optimistic concurrency; never writes vendor settings.
 *
 * @package RamseyLabels
 */

namespace RamseyLabels;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Own-option storage and per-user print-job persistence. */
final class Store {

	public const OPTION = 'rli_v1_library';
	public const JOBS   = 'rli_v1_jobs';
	public const BACKUP = 'rli_v1_migration_backup';

	/**
	 * Read settings, applying only non-destructive factory repairs in memory.
	 *
	 * @return array Current library.
	 */
	public static function read() {
		$raw     = get_option( self::OPTION, null );
		$library = is_array( $raw ) ? $raw : Schema::defaults();
		// Upgrade only the untouched original 2x1 thermal design to the new
		// QR-card default. Custom designs, profiles and saved print settings stay intact.
		if ( isset( $library['profiles'] ) && is_array( $library['profiles'] ) ) {
			foreach ( $library['profiles'] as &$profile ) {
				if ( ( $profile['id'] ?? '' ) !== 'thermal-2x1' || ! isset( $profile['design']['elements'] ) ) {
					continue;
				}
				$elements = $profile['design']['elements'];
				if ( 4 !== count( $elements ) ) {
					continue;
				}
				$ids = array_column( $elements, 'id' );
				if ( array( 'title', 'barcode', 'sku', 'price' ) !== $ids ) {
					continue;
				}
				// Only the exact factory design may be replaced; partial matching
				// silently discarded custom title, price and SKU edits in RC8.
				$factory = Schema::defaults()['templates'][0]['design'];
				if ( Schema::design( $profile['design'] ) === Schema::design( $factory ) ) {
					$profile['design'] = Schema::defaults()['profiles'][0]['design'];
				}
			}
			unset( $profile );
		}
		// RC1 shipped a QR preset that encoded the permalink, which WCPOS cannot
		// look up as a SKU. Repair only that exact factory expression; preserve
		// intentionally configured URL QR codes and all other custom layouts.
		foreach ( array( 'templates', 'profiles' ) as $group ) {
			if ( empty( $library[ $group ] ) || ! is_array( $library[ $group ] ) ) {
				continue;
			}
			foreach ( $library[ $group ] as &$entry ) {
				if ( ! isset( $entry['design']['elements'] ) || ! is_array( $entry['design']['elements'] ) ) {
					continue;
				}
				foreach ( $entry['design']['elements'] as &$element ) {
					if ( isset( $element['type'], $element['content'] ) && 'barcode' === $element['type']
						&& '{{product_url|sku|id}}' === $element['content'] ) {
						$element['content'] = '{{sku|id}}';
					}
				}
				unset( $element );
			}
			unset( $entry );
		}
		return $library;
	}

	/**
	 * Check the current account against a profile's workflow restrictions.
	 *
	 * @param array $profile Profile with optional role restrictions.
	 * @return bool Whether the profile may be used.
	 */
	public static function accessible( array $profile ) {
		if ( current_user_can( 'manage_options' ) || empty( $profile['roles'] ) ) {
			return true;
		}
		return (bool) array_intersect( (array) wp_get_current_user()->roles, $profile['roles'] );
	}

	/**
	 * Filter inaccessible profiles without altering stored data.
	 *
	 * @param array $library Full library.
	 * @return array User-visible library.
	 */
	public static function visible( array $library ) {
		$library['profiles'] = array_values( array_filter( $library['profiles'], array( __CLASS__, 'accessible' ) ) );
		if ( ! $library['profiles'] ) {
			$profile               = Schema::defaults()['profiles'][0];
			$profile['id']         = 'personal-' . get_current_user_id();
			$profile['name']       = __( 'Personal print profile', 'ramsey-labels-independent' );
			$library['profiles'][] = $profile;
		}
		if ( ! in_array( $library['defaultProfile'], array_column( $library['profiles'], 'id' ), true ) ) {
			$library['defaultProfile'] = $library['profiles'][0]['id'];
		}
		return $library;
	}

	/**
	 * Validate and atomically replace a library at the expected revision.
	 *
	 * @param array $incoming Submitted library.
	 * @param bool  $trusted Allow the administrator-only migration workflow.
	 * @return array Saved user-visible library.
	 * @throws \DomainException On concurrent or rejected writes.
	 * @throws \RuntimeException On attempts to modify a restricted profile.
	 */
	public static function save( array $incoming, $trusted = false ) {
		global $wpdb;
		$stored = get_option( self::OPTION, null );
		$old    = is_array( $stored ) ? $stored : Schema::defaults();
		$clean  = Schema::library( $incoming );
		if ( (int) $clean['revision'] !== (int) $old['revision'] ) {
			throw new \DomainException( esc_html__( 'Settings changed in another browser tab. Export your edits, reload, then reapply them.', 'ramsey-labels-independent' ) );
		}
		if ( ! $trusted && ! current_user_can( 'manage_options' ) ) {
			$old_profiles = array();
			foreach ( $old['profiles'] as $p ) {
				$old_profiles[ $p['id'] ] = $p;
			}
			foreach ( $clean['profiles'] as &$p ) {
				if ( isset( $old_profiles[ $p['id'] ] ) && ! self::accessible( $old_profiles[ $p['id'] ] ) ) {
					throw new \RuntimeException( esc_html__( 'A restricted profile cannot be edited.', 'ramsey-labels-independent' ) );
				}
				$p['roles'] = isset( $old_profiles[ $p['id'] ] ) ? $old_profiles[ $p['id'] ]['roles'] : array();
			}
			unset( $p );
			foreach ( $old['profiles'] as $p ) {
				if ( ! self::accessible( $p ) ) {
					$clean['profiles'][] = $p;
				}
			}
			$clean = Schema::library( $clean );
		}
		$clean['revision'] = (int) $old['revision'] + 1;
		if ( null === $stored ) {
			$success = add_option( self::OPTION, $clean, '', false );
		} else {
			// Compare-and-swap prevents silent loss of edits from simultaneous requests.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Atomic compare-and-swap cannot be expressed with update_option(); bound parameters and explicit option-cache invalidation follow.
			$success = $wpdb->update(
				$wpdb->options,
				array( 'option_value' => maybe_serialize( $clean ) ),
				array(
					'option_name'  => self::OPTION,
					'option_value' => maybe_serialize( $stored ),
				),
				array( '%s' ),
				array( '%s', '%s' )
			);
			wp_cache_delete( self::OPTION, 'options' );
		}
		if ( ! $success ) {
			throw new \DomainException( esc_html__( 'The save conflicted with another update or the database rejected it. Reload before saving again.', 'ramsey-labels-independent' ) );
		}
		return self::visible( $clean );
	}

	/**
	 * Read only the current user's saved jobs.
	 *
	 * @return array Saved jobs indexed by identifier.
	 */
	public static function jobs() {
		$jobs = get_user_meta( get_current_user_id(), self::jobs_key(), true );
		if ( ! is_array( $jobs ) ) {
			return array();
		}
		$library = self::read();
		return array_filter(
			$jobs,
			static function ( $job ) use ( $library ) {
				return self::job_accessible( $job, $library );
			}
		);
	}

	/**
	 * Keep single-site keys stable and isolate jobs on multisite.
	 *
	 * @return string Site-scoped metadata key; ambiguous legacy network jobs are not auto-assigned.
	 */
	public static function jobs_key() {
		return is_multisite() ? self::JOBS . '_site_' . get_current_blog_id() : self::JOBS;
	}

	/**
	 * Recheck source rights before returning cached customer or order values.
	 *
	 * @param array      $job Saved job.
	 * @param array|null $library Preloaded library, to avoid re-reading for each job.
	 * @return bool Whether every source remains accessible.
	 */
	public static function job_accessible( $job, $library = null ) {
		$profile = null;
		$library = is_array( $library ) ? $library : self::read();
		foreach ( $library['profiles'] as $saved_profile ) {
			if ( isset( $job['profileId'] ) && $saved_profile['id'] === $job['profileId'] ) {
				$profile = $saved_profile;
				break;}
		}
		if ( ! $profile || ! self::accessible( $profile ) ) {
			return false;
		}
		$capabilities = array(
			'products'    => 'edit_products',
			'orders'      => 'edit_shop_orders',
			'order_items' => 'edit_shop_orders',
			'coupons'     => 'edit_shop_coupons',
			'users'       => 'list_users',
			'posts'       => 'edit_posts',
		);
		foreach ( isset( $job['records'] ) ? $job['records'] : array() as $record ) {
			$source = isset( $record['source'] ) ? $record['source'] : 'manual';
			if ( isset( $capabilities[ $source ] ) && ! current_user_can( $capabilities[ $source ] ) && ! current_user_can( 'manage_options' ) ) {
				return false;
			}
			if ( ! current_user_can( 'manage_options' ) && isset( $record['values']['id'] ) ) {
				$id = (int) $record['values']['id'];
				if ( ( 'posts' === $source && ! current_user_can( 'edit_post', $id ) ) || ( 'products' === $source && ! current_user_can( 'read_post', $id ) && ! current_user_can( 'edit_post', $id ) ) ) {
					return false;
				}
			}
		}
		return true;
	}

	/**
	 * Save or remove a privacy-acknowledged current-user job.
	 *
	 * @param array $request Validated operation and job data.
	 * @return array Remaining current-user jobs.
	 * @throws \InvalidArgumentException On missing consent or exceeded storage budgets.
	 * @throws \RuntimeException On unauthorized saved data sources.
	 * @throws \DomainException On a concurrent saved-job operation.
	 */
	public static function updateJob( array $request ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Preserve the RC8 public callable API.
		return self::with_lock(
			'jobs_index',
			static function () use ( $request ) {
				return self::with_lock(
					'jobs_' . get_current_user_id(),
					static function () use ( $request ) {
						return self::write_job( $request );
					}
				);
			}
		);
	}

	/**
	 * Serialize local operations using a token-bound, recoverable lease.
	 *
	 * @param string   $scope Internal scope, never an HTTP parameter.
	 * @param callable $callback Bounded local operation without remote requests.
	 * @return mixed Operation result.
	 * @throws \DomainException If another operation owns the lease.
	 * @throws \InvalidArgumentException On an invalid scope or callback data.
	 * @throws \RuntimeException If the guarded operation rejects a restricted source.
	 */
	public static function with_lock( $scope, callable $callback ) {
		global $wpdb;
		$lock = self::acquire_lock( $scope );
		try {
			wp_cache_delete( get_current_user_id(), 'user_meta' );
			return call_user_func( $callback );
		} finally {
			self::release_lock( $lock );
		}
	}

	/**
	 * Acquire an owner or workflow lease; privacy tools lock in sorted owner order.
	 *
	 * @param string $scope Internal bounded operation scope.
	 * @return array Exact token and name required to release the lease.
	 * @throws \DomainException If another operation holds a non-expired lease.
	 */
	public static function acquire_lock( $scope ) {
		global $wpdb;
		$key   = 'rli_lock_' . get_current_blog_id() . '_' . Schema::identifier( $scope );
		$lease = array(
			'token'   => wp_generate_uuid4(),
			'expires' => time() + 900,
		);
		if ( ! add_option( $key, $lease, '', false ) ) {
			wp_cache_delete( $key, 'options' );
			wp_cache_delete( 'notoptions', 'options' );
			$old = get_option( $key );
			if ( is_array( $old ) && isset( $old['expires'] ) && $old['expires'] < time() ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Atomic expired-lease deletion; exact serialized value cannot remove a replacement owner's lock.
				$wpdb->delete(
					$wpdb->options,
					array(
						'option_name'  => $key,
						'option_value' => maybe_serialize( $old ),
					),
					array( '%s', '%s' )
				);
				wp_cache_delete( $key, 'options' );
			}
			if ( ! add_option( $key, $lease, '', false ) ) {
				throw new \DomainException( esc_html__( 'Another saved-data operation is in progress. Retry after it completes.', 'ramsey-labels-independent' ) );
			}
		}
		return array(
			'name'  => $key,
			'lease' => $lease,
		);
	}

	/**
	 * Release only a lease whose opaque token this process created.
	 *
	 * @param array $lock Token returned by acquire_lock().
	 * @return void
	 */
	public static function release_lock( array $lock ) {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Compare-and-delete this token only.
		$wpdb->delete(
			$wpdb->options,
			array(
				'option_name'  => $lock['name'],
				'option_value' => maybe_serialize( $lock['lease'] ),
			),
			array( '%s', '%s' )
		);
		wp_cache_delete( $lock['name'], 'options' );
	}

	/**
	 * Mutate the current site's dictionary while holding the owner's lease.
	 *
	 * @param array $request Validated operation.
	 * @return array Visible jobs.
	 * @throws \InvalidArgumentException On invalid data or absent consent.
	 * @throws \RuntimeException On unauthorized sources.
	 */
	private static function write_job( array $request ) {
		$jobs   = get_user_meta( get_current_user_id(), self::jobs_key(), true );
		$jobs   = is_array( $jobs ) ? $jobs : array();
		$action = Schema::choice( isset( $request['action'] ) ? $request['action'] : 'save', array( 'save', 'delete', 'clear' ) );
		if ( 'clear' === $action ) {
			update_user_meta( get_current_user_id(), self::jobs_key(), array() );
			return array();
		}
		$id = Schema::identifier( $request['id'] );
		if ( 'delete' === $action ) {
			unset( $jobs[ $id ] );
		} else {
			if ( ! Schema::boolean( isset( $request['privacy_acknowledged'] ) ? $request['privacy_acknowledged'] : false ) ) {
				throw new \InvalidArgumentException( esc_html__( 'Acknowledge that saved jobs may contain customer data.', 'ramsey-labels-independent' ) );
			}
			$jobs[ $id ] = array(
				'id'        => $id,
				'name'      => sanitize_text_field( Schema::text( $request['name'], 150 ) ),
				'created'   => gmdate( 'c' ),
				'profileId' => Schema::identifier( $request['profileId'] ),
				'records'   => Schema::records( $request['records'], true ),
			);
			if ( ! self::job_accessible( $jobs[ $id ] ) ) {
				throw new \RuntimeException( esc_html__( 'You cannot save a data source you cannot read.', 'ramsey-labels-independent' ) );
			}
		}
		if ( strlen( wp_json_encode( $jobs ) ) > 2000000 ) {
			throw new \InvalidArgumentException( esc_html__( 'Saved jobs exceed the 2 MB per-user limit. Export CSV locally instead.', 'ramsey-labels-independent' ) );
		}
		update_user_meta( get_current_user_id(), self::jobs_key(), $jobs );
		return self::jobs();
	}
}
