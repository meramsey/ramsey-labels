<?php
/** Validates persisted documents before any write; no executable template payloads. */
namespace RamseyLabels;

if ( ! defined( 'ABSPATH' ) ) {
	exit; }

final class Schema {

	const MAX_RECORDS = 1000;
	const MAX_LABELS  = 2000;
	const FORMATS     = array( 'code128', 'code39', 'ean13', 'ean8', 'upca', 'upce', 'qrcode', 'datamatrix' );

	public static function defaults() {
		$value = json_decode( file_get_contents( dirname( __DIR__ ) . '/assets/defaults.json' ), true );
		if ( ! is_array( $value ) ) {
			throw new \RuntimeException( 'The installed defaults document is invalid.' ); }
		return $value;
	}

	public static function text( $value, $max = 1000 ) {
		if ( ! is_scalar( $value ) && $value !== null ) {
			throw new \InvalidArgumentException( 'Expected a text value.' ); }
		$text = (string) $value;
		if ( strlen( $text ) > $max ) {
			throw new \InvalidArgumentException( esc_html( 'Text exceeds the allowed length (' . $max . ' bytes).' ) ); }
		if ( strpos( $text, "\0" ) !== false ) {
			throw new \InvalidArgumentException( 'NUL bytes are not allowed.' ); }
		return $text;
	}

	public static function number( $value, $min, $max, $integer = false ) {
		if ( $integer && is_int( $value ) && $value >= $min && $value <= $max ) {
			return $value; }
		if ( ! is_numeric( $value ) || ! is_finite( (float) $value ) ) {
			throw new \InvalidArgumentException( 'Expected a finite number.' ); }
		$number = (float) $value;
		if ( $number < $min || $number > $max || ( $integer && floor( $number ) !== $number ) ) {
			throw new \InvalidArgumentException( esc_html( 'Number must be ' . $min . '–' . $max . ( $integer ? ' (whole numbers only).' : '.' ) ) );
		}
		if ( $integer && ( $number >= - (float) PHP_INT_MIN || $number < (float) PHP_INT_MIN ) ) {
			throw new \InvalidArgumentException( 'Integer is outside the safely representable range.' );
		}
		return $integer ? (int) $number : $number;
	}

	public static function choice( $value, array $choices ) {
		if ( ! in_array( $value, $choices, true ) ) {
			throw new \InvalidArgumentException( 'Unsupported setting value.' ); }
		return $value;
	}

	public static function identifier( $value ) {
		$value = self::text( $value, 100 );
		if ( ! preg_match( '/^[A-Za-z0-9_-]+$/D', $value ) ) {
			throw new \InvalidArgumentException( 'Invalid identifier.' ); }
		return $value;
	}

	public static function boolean( $value ) {
		if ( ! in_array( $value, array( true, false, 0, 1 ), true ) ) {
			throw new \InvalidArgumentException( 'Expected a boolean.' ); }
		return (bool) $value;
	}

	public static function color( $value, $transparent = false ) {
		if ( $transparent && $value === 'transparent' ) {
			return $value; }
		if ( ! is_string( $value ) || ! preg_match( '/^#[0-9a-f]{6}$/iD', $value ) ) {
			throw new \InvalidArgumentException( 'Invalid color.' ); }
		return $value;
	}

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
			$out[ $key ] = self::boolean( $e[ $key ] ); }
		return $out;
	}

	public static function css( $raw ) {
		$css = self::text( $raw, 100000 );
		$css = preg_replace( '~/\*[\s\S]*?\*/~', '', $css );
		if ( strpbrk( $css, '\\@<>' ) !== false || preg_match( '/(?:url|image-set|expression|behavior|-moz-binding)\s*[:(]/i', $css ) ) {
			return ''; }
		return $css;
	}

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
			$allowed[ $tag ] = $attributes; }
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

	public static function design( array $raw ) {
		$defaults = self::defaults()['profiles'][0]['design'];
		$d        = array_merge( $defaults, $raw );
		$out      = array(
			'width'             => self::number( $d['width'], 5, 500 ),
			'height'            => self::number( $d['height'], 5, 500 ),
			'mode'              => self::choice( $d['mode'], array( 'visual', 'html' ) ),
			'html'              => self::html( $d['html'] ),
			'css'               => self::css( $d['css'] ),
			'htmlBarcodeFormat' => self::choice( $d['htmlBarcodeFormat'], self::FORMATS ),
			'htmlBarcodeSource' => self::text( $d['htmlBarcodeSource'], 1000 ),
			'elements'          => array(),
		);
		if ( ! is_array( $d['elements'] ) || count( $d['elements'] ) > 80 ) {
			throw new \InvalidArgumentException( 'A design may contain at most 80 elements.' ); }
		$ids = array();
		foreach ( $d['elements'] as $element ) {
			if ( ! is_array( $element ) ) {
				throw new \InvalidArgumentException( 'Invalid design element.' ); }
			$e = self::element( $element );
			if ( isset( $ids[ $e['id'] ] ) ) {
				throw new \InvalidArgumentException( 'Duplicate element identifier.' ); }
			$ids[ $e['id'] ] = true;
			if ( $e['x'] + $e['w'] > $out['width'] + 0.02 || $e['y'] + $e['h'] > $out['height'] + 0.02 ) {
				throw new \InvalidArgumentException( esc_html( 'Element ' . $e['id'] . ' is outside the label.' ) ); }
			$out['elements'][] = $e;
		}
		return $out;
	}

	public static function page( array $raw, array $design ) {
		$p   = array_merge( self::defaults()['profiles'][0]['page'], $raw );
		$out = array(
			'mode'     => self::choice( $p['mode'], array( 'roll', 'sheet' ) ),
			'flow'     => self::choice( $p['flow'], array( 'row', 'column' ) ),
			'outlines' => self::boolean( $p['outlines'] ),
		);
		foreach ( array( 'width', 'height' ) as $key ) {
			$out[ $key ] = self::number( $p[ $key ], 5, 1000 ); }
		foreach ( array( 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'gapX', 'gapY' ) as $key ) {
			$out[ $key ] = self::number( $p[ $key ], 0, 500 ); }
		foreach ( array( 'offsetX', 'offsetY' ) as $key ) {
			$out[ $key ] = self::number( $p[ $key ], -100, 100 ); }
		foreach ( array( 'rows', 'columns' ) as $key ) {
			$out[ $key ] = self::number( $p[ $key ], 1, 100, true ); }
		$out['dpi']   = self::number( $p['dpi'], 72, 600, true );
		$out['start'] = self::number( $p['start'], 0, 999, true );
		if ( $out['mode'] === 'roll' ) {
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
			throw new \InvalidArgumentException( 'Invalid sheet capacity or skipped slots.' ); }
		if ( $out['columns'] * $design['width'] + ( $out['columns'] - 1 ) * $out['gapX'] + $out['marginLeft'] + $out['marginRight'] > $out['width'] + 0.02 ) {
			throw new \InvalidArgumentException( 'Labels do not fit the page width.' ); }
		if ( $out['rows'] * $design['height'] + ( $out['rows'] - 1 ) * $out['gapY'] + $out['marginTop'] + $out['marginBottom'] > $out['height'] + 0.02 ) {
			throw new \InvalidArgumentException( 'Labels do not fit the page height.' ); }
		return $out;
	}

	public static function library( array $raw ) {
		if ( ! isset( $raw['schema'] ) || (int) $raw['schema'] !== 1 ) {
			throw new \InvalidArgumentException( 'Unsupported library schema.' ); }
		foreach ( array( 'profiles', 'templates', 'papers' ) as $key ) {
			if ( ! isset( $raw[ $key ] ) || ! is_array( $raw[ $key ] ) || count( $raw[ $key ] ) > 100 ) {
				throw new \InvalidArgumentException( esc_html( 'Invalid ' . $key . ' collection.' ) ); }
		}
		if ( ! $raw['profiles'] ) {
			throw new \InvalidArgumentException( 'At least one profile is required.' ); }
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
				throw new \InvalidArgumentException( 'Invalid profile.' ); }
			$id = self::identifier( $p['id'] );
			if ( isset( $ids[ $id ] ) ) {
				throw new \InvalidArgumentException( 'Duplicate profile identifier.' );
			} $ids[ $id ] = true;
			$design       = self::design( $p['design'] );
			$roles        = isset( $p['roles'] ) ? $p['roles'] : array();
			if ( ! is_array( $roles ) || count( $roles ) > 50 ) {
				throw new \InvalidArgumentException( 'Invalid role restrictions.' ); }
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
			throw new \InvalidArgumentException( 'Default profile does not exist.' ); }
		$ids = array();
		foreach ( $raw['templates'] as $t ) {
			$id = self::identifier( $t['id'] );
			if ( isset( $ids[ $id ] ) ) {
				throw new \InvalidArgumentException( 'Duplicate template identifier.' );
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
				throw new \InvalidArgumentException( 'Duplicate paper identifier.' );
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

	public static function records( $records ) {
		if ( ! is_array( $records ) || count( $records ) > self::MAX_RECORDS ) {
			throw new \InvalidArgumentException( 'Too many records in the saved job.' ); }
		$out   = array();
		$total = 0;
		foreach ( $records as $record ) {
			if ( ! is_array( $record ) || ! isset( $record['values'] ) || ! is_array( $record['values'] ) || count( $record['values'] ) > 300 ) {
				throw new \InvalidArgumentException( 'Invalid job record.' ); }
			$values = array();
			foreach ( $record['values'] as $key => $value ) {
				if ( ! preg_match( '/^[\w.:-]{1,150}$/D', $key ) || in_array( $key, array( '__proto__', 'prototype', 'constructor' ), true ) ) {
					throw new \InvalidArgumentException( 'Invalid field key.' ); }
				$values[ $key ] = self::text( $value, 20000 );
			}
			$quantity = self::number( isset( $record['quantity'] ) ? $record['quantity'] : 1, 1, self::MAX_LABELS, true );
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
		if ( $total > self::MAX_LABELS ) {
			throw new \InvalidArgumentException( esc_html( 'The job exceeds ' . self::MAX_LABELS . ' labels.' ) ); }
		return $out;
	}
}
