<?php
/** Read-only settings discovery and explicit, reversible configuration migration. */
namespace RamseyLabels;
if (!defined('ABSPATH')) { exit; }

final class Migration
{
    private static function table($suffix)
    {
        global $wpdb;
        $allowed = array('profiles', 'profilemeta', 'paper_formats', 'label_sheets', 'templates');
        if (!in_array($suffix, $allowed, true)) { throw new \InvalidArgumentException('Invalid legacy table.'); }
        $name = $wpdb->prefix . 'barcode_v4_' . $suffix;
        return $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($name))) === $name ? $name : null;
    }

    private static function rows($suffix)
    {
        global $wpdb; $table = self::table($suffix);
        // Table names are generated exclusively from a fixed allowlist and WP's prefix.
        return $table ? $wpdb->get_results("SELECT * FROM `{$table}` LIMIT 1000", ARRAY_A) : array();
    }

    public static function inspect()
    {
        $result = array('previous_settings' => is_array(get_option('rli_settings', null)), 'previous_templates' => count((array) get_option('rli_templates', array())), 'tables' => array(), 'backup_available' => is_array(get_option(Store::BACKUP, null)));
        foreach (array('profiles', 'profilemeta', 'paper_formats', 'label_sheets', 'templates') as $name) { $result['tables'][$name] = self::table($name) !== null; }
        return $result;
    }

    private static function decoded($value)
    {
        if (!is_string($value) || strlen($value) > 2000000) { return $value; }
        if (is_serialized($value)) {
            $decoded = @unserialize($value, array('allowed_classes' => false));
            return is_scalar($decoded) || is_array($decoded) || $decoded === null ? $decoded : null;
        }
        $json = json_decode($value, true);
        return json_last_error() === JSON_ERROR_NONE ? $json : $value;
    }

    private static function format($value)
    {
        $mapping = array('C128' => 'code128', 'C39' => 'code39', 'QRCODE' => 'qrcode', 'DATAMATRIX' => 'datamatrix', 'EAN13' => 'ean13', 'EAN8' => 'ean8', 'UPCA' => 'upca', 'UPCE' => 'upce');
        return isset($mapping[strtoupper($value)]) ? $mapping[strtoupper($value)] : (in_array($value, Schema::FORMATS, true) ? $value : 'code128');
    }

    private static function arranged($width, $height, array $fields, $format, $font = 9)
    {
        $d = Schema::defaults()['profiles'][0]['design']; $d['width'] = $width; $d['height'] = $height; $d['elements'] = array();
        $base = Schema::defaults()['profiles'][0]['design']['elements'][0];
        $padding = min(1, $height / 20, $width / 20); $weight = 0;
        foreach ($fields as $field) { $weight += $field['type'] === 'barcode' ? 3 : ($field['type'] === 'image' ? 3 : 1); }
        $unit = ($height - 2 * $padding) / max(1, $weight); $y = $padding;
        foreach ($fields as $i => $field) {
            $h = $unit * (in_array($field['type'], array('barcode', 'image'), true) ? 3 : 1);
            $d['elements'][] = array_merge($base, array('id' => 'migrated-' . $i, 'type' => $field['type'], 'content' => $field['content'], 'x' => $padding, 'y' => $y, 'w' => $width - 2 * $padding, 'h' => $h, 'format' => $format, 'fontSize' => $font, 'minFontSize' => min(5, $font), 'bold' => false));
            $y += $h;
        }
        return $d;
    }

    public static function previous(array $settings, $name, $id)
    {
        $p = Schema::defaults()['profiles'][0]; $p['id'] = $id; $p['name'] = $name;
        $width = isset($settings['width']) ? (float) $settings['width'] : 50.8; $height = isset($settings['height']) ? (float) $settings['height'] : 25.4;
        $source = isset($settings['barcode_source']) ? $settings['barcode_source'] : 'sku';
        $code = $source === 'id' ? '{{id}}' : ($source === 'custom' ? '{{meta:' . (isset($settings['custom_key']) ? $settings['custom_key'] : '') . '}}' : '{{sku|id}}');
        $map = array('name' => '{{name}}', 'price' => '{{price}}', 'sku' => 'SKU: {{sku}}', 'barcode' => $code, 'barcode_text' => $code, 'custom' => '{{meta:' . (isset($settings['custom_key']) ? $settings['custom_key'] : '') . '}}', 'stock' => 'Stock: {{stock|stock_status}}', 'image' => '{{image}}', 'custom_text' => isset($settings['custom_text']) ? $settings['custom_text'] : '');
        $order = isset($settings['field_order']) ? explode(',', $settings['field_order']) : array_keys($map); $fields = array();
        foreach (array_unique(array_merge($order, array_keys($map))) as $key) {
            if (!isset($map[$key])) { continue; }
            $enabled = $key === 'barcode_text' ? !empty($settings['show_barcode_text']) : !empty($settings[$key]);
            if ($enabled) { $fields[] = array('type' => in_array($key, array('barcode', 'image'), true) ? $key : 'text', 'content' => $map[$key]); }
        }
        if (!$fields) { $fields[] = array('type' => 'text', 'content' => '{{name}}'); }
        $p['design'] = self::arranged($width, $height, $fields, self::format(isset($settings['symbology']) ? $settings['symbology'] : 'code128'), max(1, (isset($settings['font']) ? (float) $settings['font'] : 12) * 0.75));
        if (isset($settings['mode']) && $settings['mode'] === 'sheet') {
            $letter = isset($settings['paper']) && $settings['paper'] === 'Letter'; $margin = isset($settings['margin']) ? (float) $settings['margin'] : 5; $gap = isset($settings['gap']) ? (float) $settings['gap'] : 2;
            $p['page'] = array_merge($p['page'], array('mode' => 'sheet', 'width' => $letter ? 215.9 : 210, 'height' => $letter ? 279.4 : 297, 'marginLeft' => $margin, 'marginRight' => $margin, 'marginTop' => $margin, 'marginBottom' => $margin, 'gapX' => $gap, 'gapY' => $gap, 'columns' => isset($settings['columns']) ? (int) $settings['columns'] : 3));
            $p['page']['rows'] = max(1, (int) floor(($p['page']['height'] - 2 * $margin + $gap) / ($height + $gap)));
        }
        return $p;
    }

    private static function binding($text, array &$warnings)
    {
        $aliases = array('product-sku' => 'sku', 'product-id' => 'id', 'product-name-variation' => 'name', 'product-name-main' => 'parent_name', 'actual-price' => 'price', 'regular-price' => 'regular_price', 'sale-price' => 'sale_price', 'actual-price-with-tax' => 'price_incl_tax', 'product-global-unique-id' => 'gtin', 'product-description' => 'description', 'product-short-description' => 'short_description', 'wc-category' => 'categories', 'product-all-attr' => 'attributes', 'product-all-attr-with-names' => 'attributes', 'main-product-image-url' => 'image', 'product-image-url' => 'image', 'order-id' => 'order.id', 'order-total' => 'order.total', 'order-item-name' => 'item.name', 'order-item-qty' => 'item.quantity', 'permalink' => 'product_url');
        return preg_replace_callback('/\[([\w-]+)([^\]]*)\]/', function ($m) use ($aliases, &$warnings) {
            $name = $m[1]; $args = $m[2]; $field = isset($aliases[$name]) ? $aliases[$name] : null;
            if (!$field && preg_match('/^order-(billing|shipping)-(.+)$/', $name, $address)) { $field = $address[1] . '.' . str_replace('-', '_', $address[2]); if (substr($field, -9) === 'full_name') { $field = substr($field, 0, -9) . 'name'; } }
            if (!$field && in_array($name, array('cf', 'attr', 'order-custom-field', 'order-item-meta-field'), true) && preg_match('/(?:value|name)\s*=\s*(?:"([^"]+)"|\x27([^\x27]+)\x27|([^\s]+))/', $args, $key)) {
                $value = !empty($key[1]) ? $key[1] : (!empty($key[2]) ? $key[2] : $key[3]);
                $prefixes = array('cf' => 'meta:', 'attr' => 'attr:', 'order-custom-field' => 'order_meta:', 'order-item-meta-field' => 'item_meta:'); $field = $prefixes[$name] . $value;
            }
            if (!$field) { $warnings[] = 'Unmapped legacy field: ' . $name . '. It remains visible for manual correction.'; return $m[0]; }
            $before = ''; $after = '';
            if (preg_match('/before=[\x27"]([^\x27"]*)[\x27"]/', $args, $prefix)) { $before = $prefix[1]; }
            if (preg_match('/after=[\x27"]([^\x27"]*)[\x27"]/', $args, $suffix)) { $after = $suffix[1]; }
            return $before . '{{' . $field . '}}' . $after;
        }, (string) $text);
    }

    public static function plan()
    {
        $library = Store::read(); $existing = array_column($library['profiles'], 'id'); $added = array(); $warnings = array();
        $append = function ($profile) use (&$library, &$existing, &$added, &$warnings) {
            if (in_array($profile['id'], $existing, true)) { return; }
            try {
                $profile['design'] = Schema::design($profile['design']); $profile['page'] = Schema::page($profile['page'], $profile['design']);
                $library['profiles'][] = $profile; $existing[] = $profile['id']; $added[] = $profile['name'];
            } catch (\Throwable $error) { $warnings[] = $profile['name'] . ' was not imported: ' . $error->getMessage(); }
        };
        $previous = get_option('rli_settings', null);
        if (is_array($previous)) { $append(self::previous($previous, 'Previous Ramsey configuration', 'legacy-rli-current')); }
        foreach ((array) get_option('rli_templates', array()) as $name => $settings) {
            if (is_array($settings)) { $append(self::previous($settings, 'Previous: ' . $name, 'legacy-rli-' . substr(hash('sha256', $name), 0, 16))); }
        }
        $meta = array();
        foreach (self::rows('profilemeta') as $row) {
            $pid = (int) $row['barcode_v4_profile_id']; $meta[$pid][$row['meta_key']] = self::decoded($row['meta_value']);
        }
        $papers = array(); foreach (self::rows('paper_formats') as $row) { $papers[(int) $row['id']] = $row; }
        $sheets = array(); foreach (self::rows('label_sheets') as $row) { $sheets[(int) $row['id']] = $row; }
        foreach (self::rows('profiles') as $row) {
            $raw = array_merge($row, isset($meta[(int) $row['id']]) ? $meta[(int) $row['id']] : array());
            $p = Schema::defaults()['profiles'][0]; $p['id'] = 'legacy-business-' . (int) $row['id']; $p['name'] = 'Imported: ' . $row['name'];
            $paper = isset($papers[(int) ($raw['paperId'] ?? 0)]) ? $papers[(int) $raw['paperId']] : null;
            $sheet = isset($sheets[(int) ($raw['sheetId'] ?? 0)]) ? $sheets[(int) $raw['sheetId']] : null;
            $factor = $paper && isset($paper['units']) && $paper['units'] === 'in' ? 25.4 : 1;
            $width = $sheet ? (float) $sheet['width'] * $factor : (float) ($raw['labelWidth'] ?? 50.8);
            $height = $sheet ? (float) $sheet['height'] * $factor : (float) ($raw['labelHeight'] ?? 25.4);
            $fields = array(); $format = 'code128'; $matching = isset($raw['matching']) && is_array($raw['matching']) ? $raw['matching'] : array();
            foreach ($matching as $slot => $value) {
                if (!is_scalar($value) || $value === '') { continue; }
                if (strpos($slot, 'barcode') !== false) {
                    if (preg_match('/barcode-image-url=[\x27"]?([\w-]+)/', $value, $match)) { $format = self::format($match[1]); }
                    $fields[] = array('type' => 'barcode', 'content' => self::binding($value, $warnings));
                } else { $fields[] = array('type' => strpos($value, 'image-url') !== false ? 'image' : 'text', 'content' => self::binding($value, $warnings)); }
            }
            if (!$fields) { $fields = array(array('type' => 'text', 'content' => '{{name}}'), array('type' => 'barcode', 'content' => '{{sku|id}}'), array('type' => 'text', 'content' => '{{price}}')); }
            $p['design'] = self::arranged($width, $height, $fields, $format);
            if ($paper && empty($paper['is_roll']) && $sheet) {
                $p['page'] = array_merge($p['page'], array('mode' => 'sheet', 'width' => (float) $paper['width'] * $factor, 'height' => (float) $paper['height'] * $factor, 'columns' => (int) $sheet['acrossCount'], 'rows' => (int) $sheet['aroundCount'], 'gapX' => (float) $sheet['across'] * $factor, 'gapY' => (float) $sheet['around'] * $factor));
                foreach (array('marginLeft', 'marginRight', 'marginTop', 'marginBottom') as $key) { $p['page'][$key] = (float) $sheet[$key] * $factor; }
            }
            $append($p);
        }
        if (self::table('templates')) { $warnings[] = 'Legacy HTML/CSS/JavaScript templates and bundled artwork are not copied. Imported field bindings use an independently constructed layout; verify dimensions and positions.'; }
        if ($added) { $warnings[] = 'Imported profiles are new copies. The original plugin and its database tables are unchanged. Check every imported profile before printing.'; }
        $payload = array('library' => $library, 'added' => $added, 'warnings' => array_values(array_unique($warnings)));
        $payload['hash'] = hash('sha256', wp_json_encode($payload));
        return $payload;
    }

    public static function apply($hash)
    {
        $plan = self::plan();
        if (!is_string($hash) || !hash_equals($plan['hash'], $hash)) { throw new \DomainException('Migration sources changed. Preview migration again before applying it.'); }
        if (!$plan['added']) { throw new \InvalidArgumentException('There are no new valid profiles to import.'); }
        update_option(Store::BACKUP, array('created' => gmdate('c'), 'library' => Store::read()), false);
        return array('library' => Store::save($plan['library'], true), 'warnings' => $plan['warnings'], 'added' => $plan['added']);
    }

    public static function restore()
    {
        $backup = get_option(Store::BACKUP, null);
        if (!is_array($backup) || !isset($backup['library'])) { throw new \InvalidArgumentException('No migration backup exists.'); }
        $library = $backup['library']; $library['revision'] = Store::read()['revision'];
        return Store::save($library, true);
    }
}
