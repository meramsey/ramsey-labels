<?php
/**
 * Plugin Name: Ramsey Labels Independent
 * Description: Independent WooCommerce label designer, barcodes, order/product batches, thermal/sheet printing and PDF export.
 * Version: 1.0.0-rc.8
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Requires Plugins: woocommerce
 * Author: Ramsey Resin Art
 * License: GPL-2.0-or-later
 * Text Domain: ramsey-labels-independent
 */
if (!defined('ABSPATH')) { exit; }

define('RLI_VERSION', '1.0.0-rc.8');
define('RLI_FILE', __FILE__);
foreach (array('Schema', 'Store', 'Data', 'Migration', 'Plugin') as $rli_class) { require_once __DIR__ . '/includes/' . $rli_class . '.php'; }
unset($rli_class);

add_action('before_woocommerce_init', function () {
    if (class_exists('Automattic\\WooCommerce\\Utilities\\FeaturesUtil')) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
    }
});
\RamseyLabels\Plugin::boot();
