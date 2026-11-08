<?php
/**
 * Plugin Name: Ramsey Labels for WooCommerce
 * Description: Independent free WooCommerce label design, barcodes, batch printing and PDF export.
 * Version: 1.0.0-rc.11
 * Requires at least: 6.0.3
 * Requires PHP: 7.4.32
 * Requires Plugins: woocommerce
 * WC requires at least: 7.0.1
 * WC tested up to: 11.2.2
 * Author: Ramsey Resin Art
 * License: GPL-2.0-or-later
 * Text Domain: ramsey-labels
 * Domain Path: /languages
 *
 * @package RamseyLabels
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// A directory-slug install and an RC8/RC9 install share public hooks and option keys.
// Never load two copies of the shared runtime. Keep the directory copy inert until the
// administrator deactivates the old plugin; configuration remains in the existing keys.
$ramsey_labels_legacy  = 'ramsey-labels-independent/ramsey-labels-independent.php';
$ramsey_labels_active  = (array) get_option( 'active_plugins', array() );
$ramsey_labels_network = is_multisite() ? (array) get_site_option( 'active_sitewide_plugins', array() ) : array();
if ( in_array( $ramsey_labels_legacy, $ramsey_labels_active, true ) || isset( $ramsey_labels_network[ $ramsey_labels_legacy ] ) ) {
	add_action(
		'admin_notices',
		static function () {
			if ( current_user_can( 'activate_plugins' ) ) {
				echo '<div class="notice notice-warning"><p>' . esc_html__( 'Ramsey Labels is paused because the legacy Ramsey Labels Independent folder is still active. Saved settings are preserved. Deactivate the legacy folder; the directory installation will then start automatically.', 'ramsey-labels' ) . '</p></div>';
			}
		}
	);
	return;
}

if ( defined( 'RLI_PUBLIC_ENTRY' ) ) {
	return;
}
define( 'RLI_PUBLIC_ENTRY', __FILE__ );
define( 'RLI_VERSION', '1.0.0-rc.11' );
define( 'RLI_FILE', __FILE__ );
foreach ( array( 'Schema', 'Store', 'Data', 'Migration', 'Plugin', 'NetworkJobs' ) as $ramsey_labels_class ) {
	require_once __DIR__ . '/includes/' . $ramsey_labels_class . '.php';
}
unset( $ramsey_labels_class );
require_once __DIR__ . '/includes/class-privacy.php';

add_action(
	'before_woocommerce_init',
	static function () {
		if ( class_exists( 'Automattic\\WooCommerce\\Utilities\\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
		}
	}
);

\RamseyLabels\Privacy::boot();
\RamseyLabels\NetworkJobs::boot();
\RamseyLabels\Plugin::boot();
