<?php
/**
 * Plugin Name: Ramsey Labels for WooCommerce
 * Description: Independent WooCommerce label designer, barcodes, order/product batches, thermal/sheet printing and PDF export.
 * Version: 1.0.0-rc.10
 * Requires at least: 6.0.3
 * Requires PHP: 7.4.32
 * Requires Plugins: woocommerce
 * WC requires at least: 7.0.1
 * WC tested up to: 11.2.2
 * Author: Ramsey Resin Art
 * License: GPL-2.0-or-later
 * Text Domain: ramsey-labels-independent
 *
 * @package RamseyLabels
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; }

define( 'RLI_VERSION', '1.0.0-rc.10' );
define( 'RLI_FILE', __FILE__ );
foreach ( array( 'Schema', 'Store', 'Data', 'Migration', 'Plugin' ) as $ramsey_labels_class ) {
	require_once __DIR__ . '/includes/' . $ramsey_labels_class . '.php';
}
unset( $ramsey_labels_class );
require_once __DIR__ . '/includes/class-privacy.php';
\RamseyLabels\Privacy::boot();

add_action(
	'before_woocommerce_init',
	function () {
		if ( class_exists( 'Automattic\\WooCommerce\\Utilities\\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
		}
	}
);
\RamseyLabels\Plugin::boot();
