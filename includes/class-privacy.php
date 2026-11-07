<?php
/**
 * Paged personal-data export and erasure for saved print records.
 *
 * @package RamseyLabels
 */

namespace RamseyLabels;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Core's privacy controller verifies and authorizes requests; no new HTTP endpoint. */
final class Privacy {
	private const PAGE_SIZE = 10;
	/** Register core's verified privacy-request callbacks. */
	public static function boot() {
		add_filter( 'wp_privacy_personal_data_exporters', array( __CLASS__, 'exporters' ) );
		add_filter( 'wp_privacy_personal_data_erasers', array( __CLASS__, 'erasers' ) );
	}

	/**
	 * Register this site's saved-record exporter.
	 *
	 * @param array $exporters Existing exporters.
	 * @return array Exporters.
	 */
	public static function exporters( $exporters ) {
		$exporters['ramsey_labels_jobs'] = array(
			'exporter_friendly_name' => __( 'Saved label jobs', 'ramsey-labels-independent' ),
			'callback'               => array( __CLASS__, 'export_data' ),
		);
		return $exporters;
	}

	/**
	 * Register this site's saved-record eraser.
	 *
	 * @param array $erasers Existing erasers.
	 * @return array Erasers.
	 */
	public static function erasers( $erasers ) {
		$erasers['ramsey_labels_jobs'] = array(
			'eraser_friendly_name' => __( 'Saved label jobs', 'ramsey-labels-independent' ),
			'callback'             => array( __CLASS__, 'erase_data' ),
		);
		return $erasers;
	}

	/**
	 * Fetch only a small page of owner IDs, not all job bodies.
	 *
	 * @param int $page Core page number, starting at one.
	 * @return array Owner IDs.
	 */
	private static function owners( $page ) {
		return get_users(
			array(
				'blog_id'       => 0,
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Core privacy workflow, exact indexed key, only ten IDs per page.
				'meta_key'      => Store::jobs_key(),
				'number'        => self::PAGE_SIZE,
				'offset'        => ( max( 1, absint( $page ) ) - 1 ) * self::PAGE_SIZE,
				'orderby'       => 'ID',
				'order'         => 'ASC',
				'fields'        => 'ID',
				'cache_results' => false,
			)
		);
	}

	/**
	 * Lock one bounded owner page; retained empty metadata keeps core offsets stable.
	 *
	 * @param int      $page Core page number.
	 * @param callable $callback Processes one stable owner page.
	 * @return mixed Page result or a WP_Error for a retryable conflict.
	 */
	private static function with_page_locks( $page, callable $callback ) {
		try {
			$index_lock = Store::acquire_lock( 'jobs_index' );
		} catch ( \DomainException $error ) {
			return new \WP_Error( 'ramsey_labels_privacy_conflict', __( 'Saved jobs are being updated. Retry the privacy operation.', 'ramsey-labels-independent' ) );}
		$locks = array();
		try {
			$first = array_map( 'intval', self::owners( $page ) );
			foreach ( $first as $owner ) {
				try {
					$locks[] = Store::acquire_lock( 'jobs_' . $owner );
				} catch ( \DomainException $error ) {
					return new \WP_Error( 'ramsey_labels_privacy_conflict', __( 'Saved jobs are being edited. Retry the privacy operation; no owners will be skipped.', 'ramsey-labels-independent' ) );}
			}
			$second = array_map( 'intval', self::owners( $page ) );
			if ( $first !== $second ) {
				return new \WP_Error( 'ramsey_labels_privacy_conflict', __( 'Saved-job ownership changed during the privacy operation. Retry it.', 'ramsey-labels-independent' ) );
			}
			return call_user_func( $callback, $first );
		} finally {
			foreach ( array_reverse( $locks ) as $lock ) {
				Store::release_lock( $lock );
			}
			Store::release_lock( $index_lock );
		}
	}

	/**
	 * Match explicit email fields, never neighboring customers in the same job.
	 *
	 * @param array  $record Saved record.
	 * @param string $email Verified subject email.
	 * @return bool Whether this record belongs to the subject.
	 */
	private static function matches( $record, $email ) {
		foreach ( isset( $record['values'] ) ? $record['values'] : array() as $key => $value ) {
			if ( preg_match( '/(?:^|[._:])email$/i', $key ) && is_string( $value ) && strtolower( $value ) === $email ) {
				return true;
			}
			if ( is_string( $value ) && is_email( $value ) && strtolower( $value ) === $email ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Export matched records without exporting other customers' records.
	 *
	 * @param string $email Verified subject email from core.
	 * @param int    $page Core pagination index.
	 * @return array Core exporter result.
	 */
	public static function export_data( $email, $page = 1 ) {
		$email = strtolower( sanitize_email( $email ) );
		if ( ! is_email( $email ) ) {
			return array(
				'data' => array(),
				'done' => true,
			);
		}
		return self::with_page_locks(
			$page,
			static function ( $owners ) use ( $email ) {
				$data = array();
				foreach ( $owners as $owner ) {
					wp_cache_delete( $owner, 'user_meta' );
					$jobs = get_user_meta( $owner, Store::jobs_key(), true );
					foreach ( is_array( $jobs ) ? $jobs : array() as $id => $job ) {
						$user = get_userdata( $owner );
						if ( $user && strtolower( $user->user_email ) === $email ) {
							$data[] = array(
								'group_id'    => 'ramsey_labels_jobs',
								'group_label' => __( 'Saved label jobs', 'ramsey-labels-independent' ),
								'item_id'     => 'job-' . $owner . '-' . $id . '-owner',
								'data'        => array(
									array(
										'name'  => __( 'Job name', 'ramsey-labels-independent' ),
										'value' => isset( $job['name'] ) ? $job['name'] : $id,
									),
									array(
										'name'  => __( 'Created', 'ramsey-labels-independent' ),
										'value' => isset( $job['created'] ) ? $job['created'] : '',
									),
								),
							);
						}
						foreach ( isset( $job['records'] ) ? $job['records'] : array() as $index => $record ) {
							if ( self::matches( $record, $email ) ) {
								$data[] = array(
									'group_id'    => 'ramsey_labels_jobs',
									'group_label' => __( 'Saved label jobs', 'ramsey-labels-independent' ),
									'item_id'     => 'job-' . $owner . '-' . $id . '-' . $index,
									'data'        => array(
										array(
											'name'  => __( 'Print record', 'ramsey-labels-independent' ),
											'value' => wp_json_encode( $record['values'] ),
										),
									),
								);
							}
						}
					}
				}
				return array(
					'data' => $data,
					'done' => count( $owners ) < self::PAGE_SIZE,
				);
			}
		);
	}

	/**
	 * Erase matching records, or all jobs owned by a withdrawing account.
	 *
	 * @param string $email Verified subject email from core.
	 * @param int    $page Core pagination index.
	 * @return array|\WP_Error Core eraser result or a conflict that must retry this page.
	 */
	public static function erase_data( $email, $page = 1 ) {
		$email = strtolower( sanitize_email( $email ) );
		if ( ! is_email( $email ) ) {
			return array(
				'items_removed'  => false,
				'items_retained' => false,
				'messages'       => array(),
				'done'           => true,
			);
		}
		return self::with_page_locks(
			$page,
			static function ( $owners ) use ( $email ) {
				$removed = false;
				foreach ( $owners as $owner ) {
					$removed = self::erase_owner( $owner, $email ) || $removed;
				}
				return array(
					'items_removed'  => $removed,
					'items_retained' => false,
					'messages'       => array(),
					'done'           => count( $owners ) < self::PAGE_SIZE,
				);
			}
		);
	}

	/**
	 * Re-read and erase one owner's records under the same lease as job writes.
	 *
	 * @param int    $owner Job owner ID, including former site members.
	 * @param string $email Verified subject email.
	 * @return bool Whether any data was removed.
	 */
	private static function erase_owner( $owner, $email ) {
		wp_cache_delete( $owner, 'user_meta' );
		$user    = get_userdata( $owner );
		$jobs    = get_user_meta( $owner, Store::jobs_key(), true );
		$removed = false;
		if ( ! is_array( $jobs ) ) {
			return false;
		}
		if ( $user && strtolower( $user->user_email ) === $email ) {
			$removed = ! empty( $jobs );
			$jobs    = array();
		} else {
			foreach ( $jobs as &$job ) {
				$before         = isset( $job['records'] ) ? $job['records'] : array();
				$job['records'] = array_values(
					array_filter(
						$before,
						static function ( $record ) use ( $email ) {
							return ! self::matches( $record, $email );
						}
					)
				);
				$removed        = $removed || count( $before ) !== count( $job['records'] );
			}
			unset( $job );
		}
			// Keep an empty indexed row so subsequent offset pages cannot skip owners.
			update_user_meta( $owner, Store::jobs_key(), $jobs );
		return $removed;
	}
}
