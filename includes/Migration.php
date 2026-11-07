<?php
/**
 * Read-only settings discovery and explicit, reversible configuration migration.
 *
 * @package RamseyLabels
 */

namespace RamseyLabels;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Copies configuration data only; never copies vendor implementation or artwork. */
final class Migration {

	/**
	 * Discover a legacy table from a fixed suffix allowlist.
	 *
	 * @param string $suffix Known legacy table suffix.
	 * @return string|null Existing safe identifier.
	 * @throws \InvalidArgumentException On a non-allowlisted table suffix.
	 */
	private static function table( $suffix ) {
		global $wpdb;
		$allowed = array( 'profiles', 'profilemeta', 'paper_formats', 'label_sheets', 'templates' );
		if ( ! in_array( $suffix, $allowed, true ) ) {
			throw new \InvalidArgumentException( esc_html__( 'Invalid legacy table.', 'ramsey-labels-independent' ) );
		}
		$name = $wpdb->prefix . 'barcode_v4_' . $suffix;
		if ( ! preg_match( '/^[A-Za-z0-9_]+$/D', $name ) ) {
			throw new \InvalidArgumentException( esc_html__( 'Invalid legacy table identifier.', 'ramsey-labels-independent' ) );
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- Fresh migration discovery, prepared LIKE value; caching would invalidate preview source hashes.
		return $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $name ) ) ) === $name ? $name : null;
	}

	/**
	 * Read a bounded legacy configuration table without modifying it.
	 *
	 * @param string $suffix Allowlisted table suffix.
	 * @return array Legacy rows.
	 */
	private static function rows( $suffix ) {
		global $wpdb;
		$table = self::table( $suffix );
		// Table names are generated exclusively from a fixed allowlist and WP's prefix.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared,PluginCheck.Security.DirectDB.UnescapedDBParameter -- Identifier is fixed-suffix allowlisted and strictly alphanumeric/underscore validated above; WP 6.0 lacks %i. Fresh bounded migration preview must not use stale cache.
		return $table ? $wpdb->get_results( "SELECT * FROM `{$table}` LIMIT 1000", ARRAY_A ) : array();
	}

	/**
	 * Report discoverable settings without returning private source values.
	 *
	 * @return array Source and backup availability.
	 */
	public static function inspect() {
		$result = array(
			'previous_settings'  => is_array( get_option( 'rli_settings', null ) ),
			'previous_templates' => count( (array) get_option( 'rli_templates', array() ) ),
			'tables'             => array(),
			'backup_available'   => is_array( get_option( Store::BACKUP, null ) ),
		);
		foreach ( array( 'profiles', 'profilemeta', 'paper_formats', 'label_sheets', 'templates' ) as $name ) {
			$result['tables'][ $name ] = null !== self::table( $name );
		}
		return $result;
	}

	/**
	 * Decode legacy scalar/array settings without constructing PHP objects.
	 *
	 * @param mixed $value Legacy database value.
	 * @return mixed Non-executable configuration value.
	 * @throws \InvalidArgumentException On malformed or object-containing serialized input.
	 */
	private static function decoded( $value ) {
		if ( ! is_string( $value ) || strlen( $value ) > 2000000 ) {
			return $value;
		}
		if ( is_serialized( $value ) ) {
			$failed = false;
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_set_error_handler -- Scoped validation of malformed legacy data, not debugging; the previous handler is restored in finally and no values are logged.
			set_error_handler(
				static function () use ( &$failed ) {
					$failed = true;
					return true;
				}
			);
			try {
				// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.serialize_unserialize -- Required read-only legacy interoperability: no classes/autoload, 2 MB source bound, depth 32 and node validation; never accepts a REST serialized payload.
				$decoded = unserialize(
					$value,
					array(
						'allowed_classes' => false,
						'max_depth'       => 32,
					)
				);
			} finally {
				restore_error_handler();
			}
			if ( $failed ) {
				throw new \InvalidArgumentException( esc_html__( 'Malformed legacy serialized settings.', 'ramsey-labels-independent' ) );
			}
			$nodes = 0;
			self::validate_legacy_value( $decoded, 0, $nodes );
			return $decoded;
		}
		$json = json_decode( $value, true );
		return JSON_ERROR_NONE === json_last_error() ? $json : $value;
	}

	/**
	 * Reject objects and cyclic or disproportionate legacy data graphs.
	 *
	 * @param mixed $value Decoded value, with PHP class construction disabled.
	 * @param int   $depth Current traversal depth.
	 * @param int   $nodes Visited nodes, updated by reference.
	 * @throws \InvalidArgumentException On unsafe or excessive graph structure.
	 */
	private static function validate_legacy_value( $value, $depth, &$nodes ) {
		++$nodes;
		if ( is_object( $value ) || $depth > 32 || $nodes > 10000 ) {
			throw new \InvalidArgumentException( esc_html__( 'Unsafe or excessive legacy settings graph.', 'ramsey-labels-independent' ) );
		}
		if ( is_array( $value ) ) {
			foreach ( $value as $child ) {
				self::validate_legacy_value( $child, $depth + 1, $nodes );
			}
		}
	}

	/**
	 * Map documented legacy format names to independent encoders.
	 *
	 * @param string $value Legacy format name.
	 * @return string Supported format.
	 */
	private static function format( $value ) {
		$mapping = array(
			'C128'       => 'code128',
			'C39'        => 'code39',
			'QRCODE'     => 'qrcode',
			'DATAMATRIX' => 'datamatrix',
			'EAN13'      => 'ean13',
			'EAN8'       => 'ean8',
			'UPCA'       => 'upca',
			'UPCE'       => 'upce',
		);
		return isset( $mapping[ strtoupper( $value ) ] ) ? $mapping[ strtoupper( $value ) ] : ( in_array( $value, Schema::FORMATS, true ) ? $value : 'code128' );
	}

	/**
	 * Independently arrange imported field bindings inside a new layout.
	 *
	 * @param float  $width Label width in millimeters.
	 * @param float  $height Label height in millimeters.
	 * @param array  $fields Imported data bindings, not vendor markup.
	 * @param string $format Supported barcode format.
	 * @param float  $font Text size in points.
	 * @return array New visual design.
	 */
	private static function arranged( $width, $height, array $fields, $format, $font = 9 ) {
		$d             = Schema::defaults()['profiles'][0]['design'];
		$d['width']    = $width;
		$d['height']   = $height;
		$d['elements'] = array();
		$base          = Schema::defaults()['profiles'][0]['design']['elements'][0];
		$padding       = min( 1, $height / 20, $width / 20 );
		$weight        = 0;
		foreach ( $fields as $field ) {
			$weight += 'barcode' === $field['type'] ? 3 : ( 'image' === $field['type'] ? 3 : 1 );
		}
		$unit = ( $height - 2 * $padding ) / max( 1, $weight );
		$y    = $padding;
		foreach ( $fields as $i => $field ) {
			$h               = $unit * ( in_array( $field['type'], array( 'barcode', 'image' ), true ) ? 3 : 1 );
			$d['elements'][] = array_merge(
				$base,
				array(
					'id'          => 'migrated-' . $i,
					'type'        => $field['type'],
					'content'     => $field['content'],
					'x'           => $padding,
					'y'           => $y,
					'w'           => $width - 2 * $padding,
					'h'           => $h,
					'format'      => $format,
					'fontSize'    => $font,
					'minFontSize' => min( 5, $font ),
					'bold'        => false,
				)
			);
			$y              += $h;
		}
		return $d;
	}

	/**
	 * Convert pre-schema Ramsey settings into a separate schema-1 profile.
	 *
	 * @param array  $settings Legacy scalar settings.
	 * @param string $name New profile name.
	 * @param string $id New profile identifier.
	 * @return array New profile.
	 */
	public static function previous( array $settings, $name, $id ) {
		$p         = Schema::defaults()['profiles'][0];
		$p['id']   = $id;
		$p['name'] = $name;
		$width     = isset( $settings['width'] ) ? (float) $settings['width'] : 50.8;
		$height    = isset( $settings['height'] ) ? (float) $settings['height'] : 25.4;
		$source    = isset( $settings['barcode_source'] ) ? $settings['barcode_source'] : 'sku';
		$code      = 'id' === $source ? '{{id}}' : ( 'custom' === $source ? '{{meta:' . ( isset( $settings['custom_key'] ) ? $settings['custom_key'] : '' ) . '}}' : '{{sku|id}}' );
		$map       = array(
			'name'         => '{{name}}',
			'price'        => '{{price}}',
			'sku'          => 'SKU: {{sku}}',
			'barcode'      => $code,
			'barcode_text' => $code,
			'custom'       => '{{meta:' . ( isset( $settings['custom_key'] ) ? $settings['custom_key'] : '' ) . '}}',
			'stock'        => 'Stock: {{stock|stock_status}}',
			'image'        => '{{image}}',
			'custom_text'  => isset( $settings['custom_text'] ) ? $settings['custom_text'] : '',
		);
		$order     = isset( $settings['field_order'] ) ? explode( ',', $settings['field_order'] ) : array_keys( $map );
		$fields    = array();
		foreach ( array_unique( array_merge( $order, array_keys( $map ) ) ) as $key ) {
			if ( ! isset( $map[ $key ] ) ) {
				continue;
			}
			$enabled = 'barcode_text' === $key ? ! empty( $settings['show_barcode_text'] ) : ! empty( $settings[ $key ] );
			if ( $enabled ) {
				$fields[] = array(
					'type'    => in_array( $key, array( 'barcode', 'image' ), true ) ? $key : 'text',
					'content' => $map[ $key ],
				);
			}
		}
		if ( ! $fields ) {
			$fields[] = array(
				'type'    => 'text',
				'content' => '{{name}}',
			);
		}
		$p['design'] = self::arranged( $width, $height, $fields, self::format( isset( $settings['symbology'] ) ? $settings['symbology'] : 'code128' ), max( 1, ( isset( $settings['font'] ) ? (float) $settings['font'] : 12 ) * 0.75 ) );
		if ( isset( $settings['mode'] ) && 'sheet' === $settings['mode'] ) {
			$letter            = isset( $settings['paper'] ) && 'Letter' === $settings['paper'];
			$margin            = isset( $settings['margin'] ) ? (float) $settings['margin'] : 5;
			$gap               = isset( $settings['gap'] ) ? (float) $settings['gap'] : 2;
			$p['page']         = array_merge(
				$p['page'],
				array(
					'mode'         => 'sheet',
					'width'        => $letter ? 215.9 : 210,
					'height'       => $letter ? 279.4 : 297,
					'marginLeft'   => $margin,
					'marginRight'  => $margin,
					'marginTop'    => $margin,
					'marginBottom' => $margin,
					'gapX'         => $gap,
					'gapY'         => $gap,
					'columns'      => isset( $settings['columns'] ) ? (int) $settings['columns'] : 3,
				)
			);
			$p['page']['rows'] = max( 1, (int) floor( ( $p['page']['height'] - 2 * $margin + $gap ) / ( $height + $gap ) ) );
		}
		return $p;
	}

	/**
	 * Translate documented field expressions without executing template code.
	 *
	 * @param string $text Legacy expression.
	 * @param array  $warnings Unmapped-field notices, appended by reference.
	 * @return string New expression.
	 */
	private static function binding( $text, array &$warnings ) {
		$aliases = array(
			'product-sku'                 => 'sku',
			'product-id'                  => 'id',
			'product-name-variation'      => 'name',
			'product-name-main'           => 'parent_name',
			'actual-price'                => 'price',
			'regular-price'               => 'regular_price',
			'sale-price'                  => 'sale_price',
			'actual-price-with-tax'       => 'price_incl_tax',
			'product-global-unique-id'    => 'gtin',
			'product-description'         => 'description',
			'product-short-description'   => 'short_description',
			'wc-category'                 => 'categories',
			'product-all-attr'            => 'attributes',
			'product-all-attr-with-names' => 'attributes',
			'main-product-image-url'      => 'image',
			'product-image-url'           => 'image',
			'order-id'                    => 'order.id',
			'order-total'                 => 'order.total',
			'order-item-name'             => 'item.name',
			'order-item-qty'              => 'item.quantity',
			'permalink'                   => 'product_url',
		);
		return preg_replace_callback(
			'/\[([\w-]+)([^\]]*)\]/',
			function ( $m ) use ( $aliases, &$warnings ) {
				$name  = $m[1];
				$args  = $m[2];
				$field = isset( $aliases[ $name ] ) ? $aliases[ $name ] : null;
				if ( ! $field && preg_match( '/^order-(billing|shipping)-(.+)$/', $name, $address ) ) {
					$field = $address[1] . '.' . str_replace( '-', '_', $address[2] );
					if ( 'full_name' === substr( $field, -9 ) ) {
						$field = substr( $field, 0, -9 ) . 'name';
					}
				}
				if ( ! $field && in_array( $name, array( 'cf', 'attr', 'order-custom-field', 'order-item-meta-field' ), true ) && preg_match( '/(?:value|name)\s*=\s*(?:"([^"]+)"|\x27([^\x27]+)\x27|([^\s]+))/', $args, $key ) ) {
					$value    = ! empty( $key[1] ) ? $key[1] : ( ! empty( $key[2] ) ? $key[2] : $key[3] );
					$prefixes = array(
						'cf'                    => 'meta:',
						'attr'                  => 'attr:',
						'order-custom-field'    => 'order_meta:',
						'order-item-meta-field' => 'item_meta:',
					);
					$field    = $prefixes[ $name ] . $value;
				}
				if ( ! $field ) {
					/* translators: %s: legacy field name. */
					$warnings[] = sprintf( __( 'Unmapped legacy field: %s. It remains visible for manual correction.', 'ramsey-labels-independent' ), $name );
					return $m[0];
				}
				$before = '';
				$after  = '';
				if ( preg_match( '/before=[\x27"]([^\x27"]*)[\x27"]/', $args, $prefix ) ) {
					$before = $prefix[1];
				}
				if ( preg_match( '/after=[\x27"]([^\x27"]*)[\x27"]/', $args, $suffix ) ) {
					$after = $suffix[1];
				}
				return $before . '{{' . $field . '}}' . $after;
			},
			(string) $text
		);
	}

	/**
	 * Build a reversible, hash-bound preview without any database write.
	 *
	 * @return array Proposed library, notices and source hash.
	 */
	public static function plan() {
		$library  = Store::read();
		$existing = array_column( $library['profiles'], 'id' );
		$added    = array();
		$warnings = array();
		$append   = function ( $profile ) use ( &$library, &$existing, &$added, &$warnings ) {
			if ( in_array( $profile['id'], $existing, true ) ) {
				return;
			}
			try {
				$profile['design']     = Schema::design( $profile['design'] );
				$profile['page']       = Schema::page( $profile['page'], $profile['design'] );
				$library['profiles'][] = $profile;
				$existing[]            = $profile['id'];
				$added[]               = $profile['name'];
			} catch ( \Throwable $error ) {
				/* translators: 1: profile name, 2: validation error. */
				$warnings[] = sprintf( __( '%1$s was not imported: %2$s', 'ramsey-labels-independent' ), $profile['name'], $error->getMessage() );
			}
		};
		$previous = get_option( 'rli_settings', null );
		if ( is_array( $previous ) ) {
			$append( self::previous( $previous, __( 'Previous Ramsey configuration', 'ramsey-labels-independent' ), 'legacy-rli-current' ) );
		}
		foreach ( (array) get_option( 'rli_templates', array() ) as $name => $settings ) {
			if ( is_array( $settings ) ) {
				/* translators: %s: imported profile name. */
				$append( self::previous( $settings, sprintf( __( 'Previous: %s', 'ramsey-labels-independent' ), $name ), 'legacy-rli-' . substr( hash( 'sha256', $name ), 0, 16 ) ) );
			}
		}
		$meta = array();
		foreach ( self::rows( 'profilemeta' ) as $row ) {
			$pid                              = (int) $row['barcode_v4_profile_id'];
			$meta[ $pid ][ $row['meta_key'] ] = self::decoded( $row['meta_value'] );
		}
		$papers = array();
		foreach ( self::rows( 'paper_formats' ) as $row ) {
			$papers[ (int) $row['id'] ] = $row;
		}
		$sheets = array();
		foreach ( self::rows( 'label_sheets' ) as $row ) {
			$sheets[ (int) $row['id'] ] = $row;
		}
		foreach ( self::rows( 'profiles' ) as $row ) {
			$raw     = array_merge( $row, isset( $meta[ (int) $row['id'] ] ) ? $meta[ (int) $row['id'] ] : array() );
			$p       = Schema::defaults()['profiles'][0];
			$p['id'] = 'legacy-business-' . (int) $row['id'];
			/* translators: %s: imported profile name. */
			$p['name'] = sprintf( __( 'Imported: %s', 'ramsey-labels-independent' ), $row['name'] );
			$paper     = isset( $papers[ (int) ( $raw['paperId'] ?? 0 ) ] ) ? $papers[ (int) $raw['paperId'] ] : null;
			$sheet     = isset( $sheets[ (int) ( $raw['sheetId'] ?? 0 ) ] ) ? $sheets[ (int) $raw['sheetId'] ] : null;
			$factor    = $paper && isset( $paper['units'] ) && 'in' === $paper['units'] ? 25.4 : 1;
			$width     = $sheet ? (float) $sheet['width'] * $factor : (float) ( $raw['labelWidth'] ?? 50.8 );
			$height    = $sheet ? (float) $sheet['height'] * $factor : (float) ( $raw['labelHeight'] ?? 25.4 );
			$fields    = array();
			$format    = 'code128';
			$matching  = isset( $raw['matching'] ) && is_array( $raw['matching'] ) ? $raw['matching'] : array();
			foreach ( $matching as $slot => $value ) {
				if ( ! is_scalar( $value ) || '' === $value ) {
					continue;
				}
				if ( false !== strpos( $slot, 'barcode' ) ) {
					if ( preg_match( '/barcode-image-url=[\x27"]?([\w-]+)/', $value, $match ) ) {
						$format = self::format( $match[1] );
					}
					$fields[] = array(
						'type'    => 'barcode',
						'content' => self::binding( $value, $warnings ),
					);
				} else {
					$fields[] = array(
						'type'    => false !== strpos( $value, 'image-url' ) ? 'image' : 'text',
						'content' => self::binding( $value, $warnings ),
					);
				}
			}
			if ( ! $fields ) {
				$fields = array(
					array(
						'type'    => 'text',
						'content' => '{{name}}',
					),
					array(
						'type'    => 'barcode',
						'content' => '{{sku|id}}',
					),
					array(
						'type'    => 'text',
						'content' => '{{price}}',
					),
				);
			}
			$p['design'] = self::arranged( $width, $height, $fields, $format );
			if ( $paper && empty( $paper['is_roll'] ) && $sheet ) {
				$p['page'] = array_merge(
					$p['page'],
					array(
						'mode'    => 'sheet',
						'width'   => (float) $paper['width'] * $factor,
						'height'  => (float) $paper['height'] * $factor,
						'columns' => (int) $sheet['acrossCount'],
						'rows'    => (int) $sheet['aroundCount'],
						'gapX'    => (float) $sheet['across'] * $factor,
						'gapY'    => (float) $sheet['around'] * $factor,
					)
				);
				foreach ( array( 'marginLeft', 'marginRight', 'marginTop', 'marginBottom' ) as $key ) {
					$p['page'][ $key ] = (float) $sheet[ $key ] * $factor;
				}
			}
			$append( $p );
		}
		if ( self::table( 'templates' ) ) {
			$warnings[] = __( 'Legacy HTML/CSS/JavaScript templates and bundled artwork are not copied. Imported field bindings use an independently constructed layout; verify dimensions and positions.', 'ramsey-labels-independent' );
		}
		if ( $added ) {
			$warnings[] = __( 'Imported profiles are new copies. The original plugin and its database tables are unchanged. Check every imported profile before printing.', 'ramsey-labels-independent' );
		}
		$payload         = array(
			'library'  => $library,
			'added'    => $added,
			'warnings' => array_values( array_unique( $warnings ) ),
		);
		$payload['hash'] = hash( 'sha256', wp_json_encode( $payload ) );
		return $payload;
	}

	/**
	 * Apply exactly the administrator's previewed plan with a local backup.
	 *
	 * @param string $hash Previously previewed source hash.
	 * @return array Saved library and notices.
	 * @throws \DomainException If the preview hash no longer matches.
	 * @throws \InvalidArgumentException When no new valid profiles exist.
	 */
	public static function apply( $hash ) {
		return Store::with_lock(
			'migration',
			static function () use ( $hash ) {
				return self::apply_plan( $hash );
			}
		);
	}

	/**
	 * Apply a hash-bound plan while holding the migration lease.
	 *
	 * @param string $hash Preview hash.
	 * @return array Saved library and notices.
	 * @throws \DomainException On changed sources or concurrent library edits.
	 * @throws \InvalidArgumentException If no new valid profiles exist.
	 */
	private static function apply_plan( $hash ) {
		$plan = self::plan();
		if ( ! is_string( $hash ) || ! hash_equals( $plan['hash'], $hash ) ) {
			throw new \DomainException( esc_html__( 'Migration sources changed. Preview migration again before applying it.', 'ramsey-labels-independent' ) );
		}
		if ( ! $plan['added'] ) {
			throw new \InvalidArgumentException( esc_html__( 'There are no new valid profiles to import.', 'ramsey-labels-independent' ) );
		}
		$before = Store::read();
		$saved  = Store::save( $plan['library'], true );
		update_option(
			Store::BACKUP,
			array(
				'created' => gmdate( 'c' ),
				'library' => $before,
			),
			false
		);
		return array(
			'library'  => $saved,
			'warnings' => $plan['warnings'],
			'added'    => $plan['added'],
		);
	}

	/**
	 * Restore the independent library backup, retaining revision protection.
	 *
	 * @return array Restored library.
	 * @throws \InvalidArgumentException If there is no independent backup.
	 * @throws \DomainException If another migration owns the lease.
	 */
	public static function restore() {
		return Store::with_lock(
			'migration',
			static function () {
				return self::restore_backup();
			}
		);
	}

	/**
	 * Restore the backup while holding the migration lease.
	 *
	 * @return array Restored library.
	 * @throws \InvalidArgumentException If no backup exists.
	 */
	private static function restore_backup() {
		$backup = get_option( Store::BACKUP, null );
		if ( ! is_array( $backup ) || ! isset( $backup['library'] ) ) {
			throw new \InvalidArgumentException( esc_html__( 'No migration backup exists.', 'ramsey-labels-independent' ) );
		}
		$library             = $backup['library'];
		$library['revision'] = Store::read()['revision'];
		return Store::save( $library, true );
	}
}
