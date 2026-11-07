<?php
/**
 * Validates persisted documents before any write; no executable template payloads.
 *
 * @package RamseyLabels
 */

namespace RamseyLabels;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Validation boundary for untrusted library and record documents. */
final class Schema {

	public const MAX_RECORDS = 100000;
	public const MAX_LABELS  = 2000;
	public const FORMATS     = array( 'code128', 'code39', 'ean13', 'ean8', 'upca', 'upce', 'qrcode', 'datamatrix' );

	/**
	 * Read the bundled, independently maintained factory library.
	 *
	 * @return array Factory library.
	 * @throws \RuntimeException If the installed defaults are corrupt.
	 */
	public static function defaults() {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Fixed bundled local file, not a URL or user-supplied path.
		$value = json_decode( file_get_contents( dirname( __DIR__ ) . '/assets/defaults.json' ), true );
		if ( ! is_array( $value ) ) {
			throw new \RuntimeException( esc_html__( 'The installed defaults document is invalid.', 'ramsey-labels-independent' ) );
		}
		return $value;
	}

	/**
	 * Validate scalar text without interpreting markup or field expressions.
	 *
	 * @param mixed $value Input value.
	 * @param int   $max Maximum byte length.
	 * @return string Validated text.
	 * @throws \InvalidArgumentException On non-scalar, oversized or NUL-containing text.
	 */
	public static function text( $value, $max = 1000 ) {
		if ( ! is_scalar( $value ) && null !== $value ) {
			throw new \InvalidArgumentException( esc_html__( 'Expected a text value.', 'ramsey-labels-independent' ) );
		}
		$text = (string) $value;
		if ( strlen( $text ) > $max ) {
			/* translators: %s: maximum byte length. */
			throw new \InvalidArgumentException( esc_html( sprintf( __( 'Text exceeds the allowed length (%s bytes).', 'ramsey-labels-independent' ), $max ) ) );
		}
		if ( false !== strpos( $text, "\0" ) ) {
			throw new \InvalidArgumentException( esc_html__( 'NUL bytes are not allowed.', 'ramsey-labels-independent' ) );
		}
		return $text;
	}

	/**
	 * Validate a finite, representable number within inclusive bounds.
	 *
	 * @param mixed     $value Input value.
	 * @param int|float $min Lower bound.
	 * @param int|float $max Upper bound.
	 * @param bool      $integer Require a whole number.
	 * @return int|float Validated number.
	 * @phpstan-return ($integer is true ? int : float)
	 * @throws \InvalidArgumentException On invalid, overflowing or out-of-bounds numbers.
	 */
	public static function number( $value, $min, $max, $integer = false ) {
		if ( $integer && is_int( $value ) && $value >= $min && $value <= $max ) {
			return $value;
		}
		if ( ! is_numeric( $value ) || ! is_finite( (float) $value ) ) {
			throw new \InvalidArgumentException( esc_html__( 'Expected a finite number.', 'ramsey-labels-independent' ) );
		}
		$number = (float) $value;
		if ( $number < $min || $number > $max || ( $integer && floor( $number ) !== $number ) ) {
			/* translators: 1: lower numeric bound, 2: upper numeric bound. */
			$format = $integer ? __( 'Number must be %1$s–%2$s (whole numbers only).', 'ramsey-labels-independent' ) : __( 'Number must be %1$s–%2$s.', 'ramsey-labels-independent' );
			throw new \InvalidArgumentException( esc_html( sprintf( $format, $min, $max ) ) );
		}
		if ( $integer && ( $number >= - (float) PHP_INT_MIN || $number < (float) PHP_INT_MIN ) ) {
			throw new \InvalidArgumentException( esc_html__( 'Integer is outside the safely representable range.', 'ramsey-labels-independent' ) );
		}
		return $integer ? (int) $number : $number;
	}

	/**
	 * Require strict membership in an explicit allowlist.
	 *
	 * @param mixed $value Input value.
	 * @param array $choices Allowed values.
	 * @return mixed Validated choice.
	 * @throws \InvalidArgumentException On a choice outside the allowlist.
	 */
	public static function choice( $value, array $choices ) {
		if ( ! in_array( $value, $choices, true ) ) {
			throw new \InvalidArgumentException( esc_html__( 'Unsupported setting value.', 'ramsey-labels-independent' ) );
		}
		return $value;
	}

	/**
	 * Validate a portable library identifier.
	 *
	 * @param mixed $value Input value.
	 * @return string Identifier.
	 * @throws \InvalidArgumentException On invalid characters or length.
	 */
	public static function identifier( $value ) {
		$value = self::text( $value, 100 );
		if ( ! preg_match( '/^[A-Za-z0-9_-]+$/D', $value ) ) {
			throw new \InvalidArgumentException( esc_html__( 'Invalid identifier.', 'ramsey-labels-independent' ) );
		}
		return $value;
	}

	/**
	 * Accept booleans and their JSON-compatible integer representations.
	 *
	 * @param mixed $value Input value.
	 * @return bool Validated boolean.
	 * @throws \InvalidArgumentException On coercive non-boolean inputs.
	 */
	public static function boolean( $value ) {
		if ( ! in_array( $value, array( true, false, 0, 1 ), true ) ) {
			throw new \InvalidArgumentException( esc_html__( 'Expected a boolean.', 'ramsey-labels-independent' ) );
		}
		return (bool) $value;
	}

	/**
	 * Validate a hexadecimal color without allowing CSS expressions.
	 *
	 * @param mixed $value Input color.
	 * @param bool  $transparent Allow the transparent keyword.
	 * @return string Validated color.
	 * @throws \InvalidArgumentException On unsupported CSS color syntax.
	 */
	public static function color( $value, $transparent = false ) {
		if ( $transparent && 'transparent' === $value ) {
			return $value;
		}
		if ( ! is_string( $value ) || ! preg_match( '/^#[0-9a-f]{6}$/iD', $value ) ) {
			throw new \InvalidArgumentException( esc_html__( 'Invalid color.', 'ramsey-labels-independent' ) );
		}
		return $value;
	}

	/**
	 * Normalize and validate one visual element.
	 *
	 * @param array $raw Untrusted element.
	 * @return array Validated element.
	 */
	public static function element( array $raw ) {
		$base = self::defaults()['profiles'][0]['design']['elements'][0];
		$e    = array_merge( $base, $raw );
		$out  = array(
			'id'         => self::identifier( $e['id'] ),
			'type'       => self::choice( $e['type'], array( 'text', 'barcode', 'image', 'rect', 'line', 'ellipse' ) ),
			'content'    => self::text( $e['content'], 10000 ),
			'format'     => self::choice( $e['format'], self::FORMATS ),
			'ecc'        => self::choice( $e['ecc'], array( 'L', 'M', 'Q', 'H' ) ),
			'fontFamily' => self::choice( $e['fontFamily'], array( 'Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'sans-serif', 'serif', 'monospace' ) ),
			'align'      => self::choice( $e['align'], array( 'left', 'center', 'right' ) ),
			'direction'  => self::choice( isset( $e['direction'] ) ? $e['direction'] : 'inherit', array( 'inherit', 'ltr', 'rtl' ) ),
			'vAlign'     => self::choice( $e['vAlign'], array( 'top', 'middle', 'bottom' ) ),
			'color'      => self::color( $e['color'] ),
			'background' => self::color( $e['background'], true ),
			'prefix'     => self::text( $e['prefix'], 500 ),
			'suffix'     => self::text( $e['suffix'], 500 ),
			'transform'  => self::choice( $e['transform'], array( 'none', 'upper', 'lower', 'title' ) ),
			'condition'  => self::text( $e['condition'], 1000 ),
			'fit'        => self::choice( $e['fit'], array( 'contain', 'cover' ) ),
		);
		foreach ( array(
			'x'           => array( 0, 500 ),
			'y'           => array( 0, 500 ),
			'w'           => array( 0.1, 500 ),
			'h'           => array( 0.1, 500 ),
			'rotation'    => array( -360, 360 ),
			'fontSize'    => array( 1, 200 ),
			'minFontSize' => array( 1, 200 ),
			'strokeWidth' => array( 0.01, 20 ),
		) as $key => $bounds ) {
			$out[ $key ] = self::number( $e[ $key ], $bounds[0], $bounds[1] );
		}
		foreach ( array( 'showText', 'gs1', 'autoFit', 'bold', 'italic', 'underline', 'visible' ) as $key ) {
			$out[ $key ] = self::boolean( $e[ $key ] );
		}
		return $out;
	}

	/**
	 * Reject CSS capable of loading resources or escaping a style context.
	 *
	 * @param mixed $raw Untrusted CSS.
	 * @return string Inert formatting CSS.
	 */
	public static function css( $raw ) {
		$css = self::text( $raw, 100000 );
		$css = preg_replace( '~/\*[\s\S]*?\*/~', '', $css );
		if ( false !== strpbrk( $css, '\\@<>' ) || preg_match( '/(?:url|image-set|expression|behavior|-moz-binding)\s*[:(]/i', $css ) ) {
			return '';
		}
		return $css;
	}

	/**
	 * Keep only inert label-formatting markup using WordPress KSES.
	 *
	 * @param mixed $raw Untrusted HTML.
	 * @return string Sanitized markup.
	 */
	public static function html( $raw ) {
		$html       = self::text( $raw, 200000 );
		$attributes = array(
			'style'  => true,
			'class'  => true,
			'id'     => true,
			'width'  => true,
			'height' => true,
		);
		$allowed    = array();
		foreach ( array( 'div', 'span', 'p', 'br', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'b', 'strong', 'i', 'em', 'u', 's', 'small', 'h1', 'h2', 'h3', 'hr', 'ul', 'ol', 'li' ) as $tag ) {
			$allowed[ $tag ] = $attributes;
		}
		$allowed['td']['colspan'] = true;
		$allowed['td']['rowspan'] = true;
		$allowed['th']['colspan'] = true;
		$allowed['th']['rowspan'] = true;
		$allowed['img']           = array_merge(
			$attributes,
			array(
				'src' => true,
				'alt' => true,
			)
		);
		return wp_kses( $html, $allowed, array( 'http', 'https', 'data', 'wp-image' ) );
	}

	/**
	 * Validate label dimensions, markup and element bounds.
	 *
	 * @param array $raw Untrusted design.
	 * @return array Validated design.
	 * @throws \InvalidArgumentException On invalid or out-of-bounds elements.
	 */
	public static function design( array $raw ) {
		$defaults = self::defaults()['profiles'][0]['design'];
		$d        = array_merge( $defaults, $raw );
		$out      = array(
			'width'             => self::number( $d['width'], 5, 500 ),
			'height'            => self::number( $d['height'], 5, 500 ),
			'mode'              => self::choice( $d['mode'], array( 'visual', 'html' ) ),
			'showCurrency'      => self::boolean( isset( $d['showCurrency'] ) ? $d['showCurrency'] : true ),
			'html'              => self::html( $d['html'] ),
			'css'               => self::css( $d['css'] ),
			'htmlBarcodeFormat' => self::choice( $d['htmlBarcodeFormat'], self::FORMATS ),
			'htmlBarcodeSource' => self::text( $d['htmlBarcodeSource'], 1000 ),
			'elements'          => array(),
		);
		if ( ! is_array( $d['elements'] ) || count( $d['elements'] ) > 4096 ) {
			throw new \InvalidArgumentException( esc_html__( 'A design exceeds its element-count resource budget.', 'ramsey-labels-independent' ) );
		}
		$ids = array();
		foreach ( $d['elements'] as $element ) {
			if ( ! is_array( $element ) ) {
				throw new \InvalidArgumentException( esc_html__( 'Invalid design element.', 'ramsey-labels-independent' ) );
			}
			$e = self::element( $element );
			if ( isset( $ids[ $e['id'] ] ) ) {
				throw new \InvalidArgumentException( esc_html__( 'Duplicate element identifier.', 'ramsey-labels-independent' ) );
			}
			$ids[ $e['id'] ] = true;
			if ( $e['x'] + $e['w'] > $out['width'] + 0.02 || $e['y'] + $e['h'] > $out['height'] + 0.02 ) {
				/* translators: %s: visual element identifier. */
				throw new \InvalidArgumentException( esc_html( sprintf( __( 'Element %s is outside the label.', 'ramsey-labels-independent' ), $e['id'] ) ) );
			}
			$out['elements'][] = $e;
		}
		return $out;
	}

	/**
	 * Validate page geometry against the physical label dimensions.
	 *
	 * @param array $raw Untrusted page settings.
	 * @param array $design Validated label design.
	 * @return array Validated page settings.
	 * @throws \InvalidArgumentException On geometry that cannot fit the labels.
	 */
	public static function page( array $raw, array $design ) {
		$p   = array_merge( self::defaults()['profiles'][0]['page'], $raw );
		$out = array(
			'mode'     => self::choice( $p['mode'], array( 'roll', 'sheet' ) ),
			'flow'     => self::choice( $p['flow'], array( 'row', 'column' ) ),
			'outlines' => self::boolean( $p['outlines'] ),
		);
		foreach ( array( 'width', 'height' ) as $key ) {
			$out[ $key ] = self::number( $p[ $key ], 5, 1000 );
		}
		foreach ( array( 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'gapX', 'gapY' ) as $key ) {
			$out[ $key ] = self::number( $p[ $key ], 0, 500 );
		}
		foreach ( array( 'offsetX', 'offsetY' ) as $key ) {
			$out[ $key ] = self::number( $p[ $key ], -100, 100 );
		}
		foreach ( array( 'rows', 'columns' ) as $key ) {
			$out[ $key ] = self::number( $p[ $key ], 1, 100, true );
		}
		$out['dpi']   = self::number( $p['dpi'], 72, 600, true );
		$out['start'] = self::number( $p['start'], 0, 999, true );
		if ( 'roll' === $out['mode'] ) {
			$out = array_merge(
				$out,
				array(
					'width'        => $design['width'],
					'height'       => $design['height'],
					'rows'         => 1,
					'columns'      => 1,
					'start'        => 0,
					'marginTop'    => 0,
					'marginRight'  => 0,
					'marginBottom' => 0,
					'marginLeft'   => 0,
					'gapX'         => 0,
					'gapY'         => 0,
				)
			);
		}
		if ( $out['rows'] * $out['columns'] > 1000 || $out['start'] >= $out['rows'] * $out['columns'] ) {
			throw new \InvalidArgumentException( esc_html__( 'Invalid sheet capacity or skipped slots.', 'ramsey-labels-independent' ) );
		}
		if ( $out['columns'] * $design['width'] + ( $out['columns'] - 1 ) * $out['gapX'] + $out['marginLeft'] + $out['marginRight'] > $out['width'] + 0.02 ) {
			throw new \InvalidArgumentException( esc_html__( 'Labels do not fit the page width.', 'ramsey-labels-independent' ) );
		}
		if ( $out['rows'] * $design['height'] + ( $out['rows'] - 1 ) * $out['gapY'] + $out['marginTop'] + $out['marginBottom'] > $out['height'] + 0.02 ) {
			throw new \InvalidArgumentException( esc_html__( 'Labels do not fit the page height.', 'ramsey-labels-independent' ) );
		}
		return $out;
	}

	/**
	 * Validate an imported or edited schema-1 library before persistence.
	 *
	 * @param array $raw Untrusted library.
	 * @return array Validated library.
	 * @throws \InvalidArgumentException On unsupported schema or invalid collections.
	 */
	public static function library( array $raw ) {
		if ( ! isset( $raw['schema'] ) || 1 !== (int) $raw['schema'] ) {
			throw new \InvalidArgumentException( esc_html__( 'Unsupported library schema.', 'ramsey-labels-independent' ) );
		}
		foreach ( array( 'profiles', 'templates', 'papers' ) as $key ) {
			if ( ! isset( $raw[ $key ] ) || ! is_array( $raw[ $key ] ) ) {
				/* translators: %s: library collection name. */
				throw new \InvalidArgumentException( esc_html( sprintf( __( 'Invalid %s collection.', 'ramsey-labels-independent' ), $key ) ) );
			}
		}
		if ( strlen( wp_json_encode( $raw ) ) > 2200000 ) {
			throw new \InvalidArgumentException( esc_html__( 'Library exceeds the 2.2 MB document budget. Export or split the document before saving.', 'ramsey-labels-independent' ) );
		}
		if ( ! $raw['profiles'] ) {
			throw new \InvalidArgumentException( esc_html__( 'At least one profile is required.', 'ramsey-labels-independent' ) );
		}
		$out = array(
			'schema'         => 1,
			'revision'       => self::number( isset( $raw['revision'] ) ? $raw['revision'] : 0, 0, PHP_INT_MAX - 1, true ),
			'defaultProfile' => self::identifier( $raw['defaultProfile'] ),
			'profiles'       => array(),
			'templates'      => array(),
			'papers'         => array(),
		);
		$ids = array();
		foreach ( $raw['profiles'] as $p ) {
			if ( ! is_array( $p ) || ! isset( $p['design'], $p['page'] ) ) {
				throw new \InvalidArgumentException( esc_html__( 'Invalid profile.', 'ramsey-labels-independent' ) );
			}
			$id = self::identifier( $p['id'] );
			if ( isset( $ids[ $id ] ) ) {
				throw new \InvalidArgumentException( esc_html__( 'Duplicate profile identifier.', 'ramsey-labels-independent' ) );
			} $ids[ $id ] = true;
			$design       = self::design( $p['design'] );
			$roles        = isset( $p['roles'] ) ? $p['roles'] : array();
			if ( ! is_array( $roles ) || count( $roles ) > 50 ) {
				throw new \InvalidArgumentException( esc_html__( 'Invalid role restrictions.', 'ramsey-labels-independent' ) );
			}
			$out['profiles'][] = array(
				'id'           => $id,
				'name'         => sanitize_text_field( self::text( $p['name'], 150 ) ),
				'design'       => $design,
				'page'         => self::page( $p['page'], $design ),
				'quantityMode' => self::choice( isset( $p['quantityMode'] ) ? $p['quantityMode'] : 'one', array( 'one', 'stock', 'order' ) ),
				'roles'        => array_values( array_unique( array_map( 'sanitize_key', $roles ) ) ),
			);
		}
		if ( ! isset( $ids[ $out['defaultProfile'] ] ) ) {
			throw new \InvalidArgumentException( esc_html__( 'Default profile does not exist.', 'ramsey-labels-independent' ) );
		}
		$ids = array();
		foreach ( $raw['templates'] as $t ) {
			$id = self::identifier( $t['id'] );
			if ( isset( $ids[ $id ] ) ) {
				throw new \InvalidArgumentException( esc_html__( 'Duplicate template identifier.', 'ramsey-labels-independent' ) );
			} $ids[ $id ]       = true;
			$out['templates'][] = array(
				'id'     => $id,
				'name'   => sanitize_text_field( self::text( $t['name'], 150 ) ),
				'design' => self::design( $t['design'] ),
			);
		}
		$ids = array();
		foreach ( $raw['papers'] as $p ) {
			$id = self::identifier( $p['id'] );
			if ( isset( $ids[ $id ] ) ) {
				throw new \InvalidArgumentException( esc_html__( 'Duplicate paper identifier.', 'ramsey-labels-independent' ) );
			} $ids[ $id ]    = true;
			$out['papers'][] = array(
				'id'     => $id,
				'name'   => sanitize_text_field( self::text( $p['name'], 150 ) ),
				'width'  => self::number( $p['width'], 5, 1000 ),
				'height' => self::number( $p['height'], 5, 1000 ),
			);
		}
		return $out;
	}

	/**
	 * Validate printable scalar fields, selection and whole quantities.
	 *
	 * @param mixed $records Untrusted records.
	 * @param bool  $segmented Permit safe whole quantities for segmented processing.
	 * @return array Validated records.
	 * @phpstan-return list<array{key: string, source: string, values: array<array-key, string>, quantity: int, selected: bool}>
	 * @throws \InvalidArgumentException On invalid fields, quantities or resource limits.
	 */
	public static function records( $records, $segmented = false ) {
		if ( ! is_array( $records ) || count( $records ) > self::MAX_RECORDS ) {
			throw new \InvalidArgumentException( esc_html__( 'Too many records in the saved job.', 'ramsey-labels-independent' ) );
		}
		$out   = array();
		$total = 0;
		foreach ( $records as $record ) {
			if ( ! is_array( $record ) || ! isset( $record['values'] ) || ! is_array( $record['values'] ) || count( $record['values'] ) > 300 ) {
				throw new \InvalidArgumentException( esc_html__( 'Invalid job record.', 'ramsey-labels-independent' ) );
			}
			$values = array();
			foreach ( $record['values'] as $key => $value ) {
				if ( ! preg_match( '/^[\w.:-]{1,150}$/D', $key ) || in_array( $key, array( '__proto__', 'prototype', 'constructor' ), true ) ) {
					throw new \InvalidArgumentException( esc_html__( 'Invalid field key.', 'ramsey-labels-independent' ) );
				}
				$values[ $key ] = self::text( $value, 20000 );
			}
			$quantity = self::number( isset( $record['quantity'] ) ? $record['quantity'] : 1, 1, $segmented ? min( PHP_INT_MAX, 9007199254740991 ) : self::MAX_LABELS, true );
			$selected = isset( $record['selected'] ) ? self::boolean( $record['selected'] ) : true;
			$total   += $selected ? $quantity : 0;
			$out[]    = array(
				'key'      => self::identifier( $record['key'] ),
				'source'   => sanitize_key( isset( $record['source'] ) ? $record['source'] : 'manual' ),
				'values'   => $values,
				'quantity' => $quantity,
				'selected' => $selected,
			);
		}
		if ( $total > ( $segmented ? min( PHP_INT_MAX, 9007199254740991 ) : self::MAX_LABELS ) ) {
			/* translators: %s: labels per rendering segment. */
			throw new \InvalidArgumentException( esc_html( sprintf( __( 'The job exceeds %s labels.', 'ramsey-labels-independent' ), self::MAX_LABELS ) ) );
		}
		return $out;
	}
}
