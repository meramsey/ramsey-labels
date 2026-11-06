<?php
/** Read-only WooCommerce/WordPress adapters. Orders always use the WooCommerce CRUD API. */
namespace RamseyLabels;

if (!defined('ABSPATH')) { exit; }

final class Data
{
    private static function can($capability)
    {
        if (!current_user_can($capability) && !current_user_can('manage_options')) { throw new \RuntimeException('You do not have permission to read this data source.'); }
    }

    public static function ids($raw, $limit = 100)
    {
        if (is_string($raw)) { $raw = preg_split('/[\s,;]+/', trim($raw), -1, PREG_SPLIT_NO_EMPTY); }
        if (!is_array($raw) || count($raw) > $limit) { throw new \InvalidArgumentException('Supply at most ' . $limit . ' IDs per request.'); }
        $out = array();
        foreach ($raw as $id) { $out[] = Schema::number($id, 1, PHP_INT_MAX, true); }
        return array_values(array_unique($out));
    }

    public static function fieldKeys($raw)
    {
        if (!is_array($raw) || count($raw) > 300) { throw new \InvalidArgumentException('Invalid field list.'); }
        $out = array();
        foreach ($raw as $field) {
            $field = Schema::text($field, 150);
            if (!preg_match('/^[\w.:-]+$/D', $field) || in_array($field, array('__proto__', 'prototype', 'constructor'), true)) { throw new \InvalidArgumentException('Invalid requested field.'); }
            $out[] = $field;
        }
        return array_values(array_unique($out));
    }

    private static function plain($text)
    {
        return html_entity_decode(wp_strip_all_tags((string) $text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    private static function scalar($value)
    {
        if ($value === null) { return ''; }
        if (is_scalar($value)) { return (string) $value; }
        if (is_array($value)) {
            $flat = array_filter($value, 'is_scalar');
            if (count($flat) === count($value)) { return implode(', ', $flat); }
            return wp_json_encode($value);
        }
        return '';
    }

    private static function money($amount, $currency = '')
    {
        if ($amount === '' || $amount === null) { return ''; }
        return self::plain(wc_price((float) $amount, $currency ? array('currency' => $currency) : array()));
    }

    private static function common()
    {
        $address = array_filter(array(get_option('woocommerce_store_address'), get_option('woocommerce_store_address_2'), get_option('woocommerce_store_city'), get_option('woocommerce_store_postcode'), get_option('woocommerce_default_country')));
        return array('shop.name' => self::plain(get_bloginfo('name')), 'shop.address' => implode("\n", $address), 'date' => wp_date('Y-m-d'), 'time' => wp_date('H:i'));
    }

    private static function readableProduct($id)
    {
        $product = wc_get_product($id);
        if (!$product || in_array($product->get_status(), array('trash', 'auto-draft'), true)) { throw new \InvalidArgumentException('Product ' . $id . ' is missing or deleted.'); }
        if (!current_user_can('read_post', $id) && !current_user_can('edit_post', $id)) { throw new \RuntimeException('Product ' . $id . ' is not readable by this account.'); }
        return $product;
    }

    /** Medium thumbnail for identification; variations fall back to their parent image. */
    private static function searchThumbnail($product)
    {
        $image_id = (int) $product->get_image_id();
        if (!$image_id && $product->get_parent_id()) {
            $parent = wc_get_product($product->get_parent_id());
            if ($parent) { $image_id = (int) $parent->get_image_id(); }
        }
        return $image_id ? (string) wp_get_attachment_image_url($image_id, 'medium') : '';
    }

    public static function searchProducts(array $request)
    {
        self::can('edit_products');
        $page = Schema::number(isset($request['page']) ? $request['page'] : 1, 1, 100000, true);
        $per = Schema::number(isset($request['per_page']) ? $request['per_page'] : 30, 1, 100, true);
        $search = isset($request['search']) ? sanitize_text_field(Schema::text($request['search'], 150)) : '';
        $categories = !empty($request['categories']) ? self::ids($request['categories'], 50) : array();
        $args = array('post_type' => array('product'), 'post_status' => array('publish', 'private', 'draft', 'pending'), 'posts_per_page' => $per, 'paged' => $page, 'orderby' => 'title', 'order' => 'ASC', 'fields' => 'ids');
        if ($search !== '') {
            $store = \WC_Data_Store::load('product');
            $found = $store->search_products($search, '', true, true, 2001);
            if (count($found) > 2000) { throw new \InvalidArgumentException('More than 2,000 matches. Refine the product search.'); }
            $exact = wc_get_product_id_by_sku($search); if ($exact) { $found[] = $exact; }
            $found = array_values(array_unique(array_map('absint', $found)));
            if ($categories) {
                $found = array_values(array_filter($found, function ($id) use ($categories) {
                    $p = wc_get_product($id); if (!$p) { return false; }
                    return has_term($categories, 'product_cat', $p->get_parent_id() ?: $id);
                }));
            }
            if (!$found) { return array('items' => array(), 'total' => 0, 'pages' => 0, 'page' => $page); }
            $args['post__in'] = $found; $args['post_type'] = array('product', 'product_variation');
        } elseif ($categories) {
            $args['tax_query'] = array(array('taxonomy' => 'product_cat', 'field' => 'term_id', 'terms' => $categories, 'include_children' => true));
        }
        if (!empty($request['stock_status'])) {
            $stock = Schema::choice($request['stock_status'], array('instock', 'outofstock', 'onbackorder'));
            $args['meta_query'] = array(array('key' => '_stock_status', 'value' => $stock));
        }
        $query = new \WP_Query($args); $items = array();
        foreach ($query->posts as $id) {
            if (!current_user_can('read_post', $id) && !current_user_can('edit_post', $id)) { continue; }
            $p = wc_get_product($id); if (!$p) { continue; }
            $items[] = array('id' => $p->get_id(), 'name' => self::plain($p->get_name()), 'sku' => $p->get_sku(), 'price' => $p->get_price() === '' ? '' : self::money(wc_get_price_to_display($p)), 'stock' => $p->get_stock_quantity(), 'kind' => $p->get_type(), 'parent_id' => $p->get_parent_id(), 'image_url' => self::searchThumbnail($p));
        }
        return array('items' => $items, 'total' => (int) $query->found_posts, 'pages' => (int) $query->max_num_pages, 'page' => $page);
    }

    public static function searchOrders(array $request)
    {
        self::can('edit_shop_orders');
        $page = Schema::number(isset($request['page']) ? $request['page'] : 1, 1, 100000, true);
        $per = Schema::number(isset($request['per_page']) ? $request['per_page'] : 20, 1, 100, true);
        $search = isset($request['search']) ? sanitize_text_field(Schema::text($request['search'], 150)) : '';
        $args = array('limit' => $per, 'paged' => $page, 'paginate' => true, 'orderby' => 'date', 'order' => 'DESC', 'type' => 'shop_order');
        if (!empty($request['status'])) {
            $status = str_replace('wc-', '', sanitize_key($request['status']));
            if (!array_key_exists('wc-' . $status, wc_get_order_statuses())) { throw new \InvalidArgumentException('Unknown order status.'); }
            $args['status'] = $status;
        }
        if ($search !== '') {
            if (ctype_digit(ltrim($search, '#'))) { $args['include'] = array((int) ltrim($search, '#')); }
            elseif (is_email($search)) { $args['billing_email'] = $search; }
            elseif (function_exists('wc_order_search')) {
                $ids = wc_order_search($search);
                if (!$ids) { return array('items' => array(), 'total' => 0, 'pages' => 0, 'page' => $page); }
                $args['include'] = $ids;
            } else { throw new \InvalidArgumentException('Search orders by numeric ID or billing email on this WooCommerce version.'); }
        }
        $result = wc_get_orders($args); $items = array();
        foreach ($result->orders as $order) {
            $items[] = array('id' => $order->get_id(), 'name' => '#' . $order->get_order_number() . ' — ' . self::plain($order->get_formatted_billing_full_name()), 'sku' => $order->get_status(), 'price' => self::money($order->get_total(), $order->get_currency()), 'kind' => 'order', 'stock' => $order->get_item_count(), 'date' => $order->get_date_created() ? $order->get_date_created()->date_i18n('Y-m-d') : '');
        }
        return array('items' => $items, 'total' => (int) $result->total, 'pages' => (int) $result->max_num_pages, 'page' => $page);
    }

    public static function orderItems($id)
    {
        self::can('edit_shop_orders'); $order = wc_get_order(Schema::number($id, 1, PHP_INT_MAX, true));
        if (!$order || $order->get_type() !== 'shop_order') { throw new \InvalidArgumentException('Order was not found.'); }
        $items = array();
        foreach ($order->get_items('line_item') as $item) { $items[] = array('id' => $item->get_id(), 'name' => self::plain($item->get_name()), 'quantity' => $item->get_quantity(), 'product_id' => $item->get_variation_id() ?: $item->get_product_id()); }
        return array('order_id' => $order->get_id(), 'items' => $items);
    }

    private static function attributes($product)
    {
        $parts = array();
        foreach ($product->get_attributes() as $key => $attribute) {
            if (is_object($attribute) && method_exists($attribute, 'get_name')) {
                $key = $attribute->get_name();
                $value = $product->get_attribute($key);
            } else { $value = $product->get_attribute($key); }
            if ($value !== '') { $parts[] = self::plain(wc_attribute_label($key, $product)) . ': ' . self::plain($value); }
        }
        return implode(', ', $parts);
    }

    public static function productValues($product, array $fields)
    {
        $id = $product->get_id(); $parent = $product->get_parent_id() ? wc_get_product($product->get_parent_id()) : null;
        $taxonomy_id = $parent ? $parent->get_id() : $id;
        $categories = wc_get_product_terms($taxonomy_id, 'product_cat', array('fields' => 'names'));
        $price = $product->get_price(); $regular = $product->get_regular_price(); $sale = $product->get_sale_price();
        $image_id = $product->get_image_id(); if (!$image_id && $parent) { $image_id = $parent->get_image_id(); }
        $values = array_merge(self::common(), array(
            'id' => (string) $id, 'name' => self::plain($product->get_name()), 'parent_name' => self::plain($parent ? $parent->get_name() : $product->get_name()),
            'sku' => (string) $product->get_sku(), 'barcode' => (string) $product->get_sku(),
            'gtin' => method_exists($product, 'get_global_unique_id') ? (string) $product->get_global_unique_id() : (string) $product->get_meta('_global_unique_id', true),
            'price' => $price === '' ? '' : self::money(wc_get_price_to_display($product)), 'price_raw' => (string) $price,
            'regular_price' => $regular === '' ? '' : self::money(wc_get_price_to_display($product, array('price' => $regular))),
            'sale_price' => $sale === '' ? '' : self::money(wc_get_price_to_display($product, array('price' => $sale))),
            'price_incl_tax' => $price === '' ? '' : self::money(wc_get_price_including_tax($product)),
            'price_excl_tax' => $price === '' ? '' : self::money(wc_get_price_excluding_tax($product)),
            'currency' => get_woocommerce_currency(), 'stock' => $product->get_stock_quantity() === null ? '' : (string) $product->get_stock_quantity(),
            'stock_status' => $product->get_stock_status(), 'categories' => is_wp_error($categories) ? '' : implode(', ', $categories),
            'attributes' => self::attributes($product), 'weight' => (string) $product->get_weight(), 'length' => (string) $product->get_length(), 'width' => (string) $product->get_width(), 'height' => (string) $product->get_height(),
            'description' => self::plain($product->get_description()), 'short_description' => self::plain($product->get_short_description()),
            'product_url' => $product->get_permalink(), 'image' => $image_id ? 'wp-image:' . $image_id : '',
            'image_url' => $image_id ? (string) wp_get_attachment_image_url($image_id, 'medium') : '',
            'created_date' => $product->get_date_created() ? $product->get_date_created()->date_i18n('Y-m-d') : '',
        ));
        foreach ($fields as $field) {
            if (strpos($field, 'meta:') === 0) { $values[$field] = self::scalar($product->get_meta(substr($field, 5), true)); }
            elseif (strpos($field, 'parent_meta:') === 0) { $values[$field] = self::scalar(($parent ?: $product)->get_meta(substr($field, 12), true)); }
            elseif (strpos($field, 'attr:') === 0) { $values[$field] = self::plain($product->get_attribute(substr($field, 5))); }
            elseif (strpos($field, 'tax:') === 0) {
                $taxonomy = substr($field, 4); $terms = taxonomy_exists($taxonomy) ? wc_get_product_terms($taxonomy_id, $taxonomy, array('fields' => 'names')) : array();
                $values[$field] = is_wp_error($terms) ? '' : implode(', ', $terms);
            }
            $values[$field] = self::scalar(apply_filters('rli_field_value', isset($values[$field]) ? $values[$field] : '', $field, $product, null, null));
        }
        return $values;
    }

    private static function orderValues($order, array $fields)
    {
        $currency = $order->get_currency();
        $values = array_merge(self::common(), array(
            'id' => (string) $order->get_id(), 'name' => 'Order #' . $order->get_order_number(), 'sku' => (string) $order->get_order_number(), 'barcode' => (string) $order->get_order_number(),
            'price' => self::money($order->get_total(), $currency), 'currency' => $currency,
            'order.id' => (string) $order->get_id(), 'order.number' => (string) $order->get_order_number(),
            'order.date' => $order->get_date_created() ? $order->get_date_created()->date_i18n('Y-m-d H:i') : '',
            'order.completed_date' => $order->get_date_completed() ? $order->get_date_completed()->date_i18n('Y-m-d H:i') : '',
            'order.total' => self::money($order->get_total(), $currency), 'order.subtotal' => self::money($order->get_subtotal(), $currency), 'order.shipping' => self::money($order->get_shipping_total(), $currency),
            'order.tax' => self::money($order->get_total_tax(), $currency), 'order.discount' => self::money($order->get_discount_total(), $currency),
            'order.status' => $order->get_status(), 'order.currency' => $currency, 'order.customer_note' => self::plain($order->get_customer_note()), 'order.total_items' => (string) $order->get_item_count(),
        ));
        foreach (array('billing', 'shipping') as $kind) {
            $address = $order->get_address($kind);
            foreach (array('first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country', 'email', 'phone') as $key) { $values[$kind . '.' . $key] = isset($address[$key]) ? self::plain($address[$key]) : ''; }
            $values[$kind . '.name'] = trim($values[$kind . '.first_name'] . ' ' . $values[$kind . '.last_name']);
        }
        foreach ($fields as $field) {
            if (strpos($field, 'order_meta:') === 0) { $values[$field] = self::scalar($order->get_meta(substr($field, 11), true)); }
            $values[$field] = self::scalar(apply_filters('rli_field_value', isset($values[$field]) ? $values[$field] : '', $field, null, $order, null));
        }
        return $values;
    }

    private static function quantity($value)
    {
        if (!is_numeric($value) || (float) $value < 0 || floor((float) $value) !== (float) $value) { throw new \InvalidArgumentException('A quantity is fractional or negative. Choose one label per item or set an explicit whole quantity.'); }
        return Schema::number($value, 0, Schema::MAX_LABELS, true);
    }

    public static function records(array $request)
    {
        $source = Schema::choice(isset($request['source']) ? $request['source'] : 'products', array('products', 'order_items', 'orders', 'coupons', 'posts', 'users'));
        $ids = self::ids(isset($request['ids']) ? $request['ids'] : array());
        if (!$ids) { throw new \InvalidArgumentException('Select at least one record.'); }
        $fields = self::fieldKeys(isset($request['fields']) ? $request['fields'] : array());
        $mode = Schema::choice(isset($request['quantity_mode']) ? $request['quantity_mode'] : 'one', array('one', 'stock', 'order'));
        $copies = Schema::number(isset($request['copies']) ? $request['copies'] : 1, 1, Schema::MAX_LABELS, true);
        $records = array(); $warnings = array();
        if ($source === 'products') {
            self::can('edit_products'); $expanded = array();
            $variations = Schema::choice(isset($request['variations']) ? $request['variations'] : 'parent', array('parent', 'variations', 'both'));
            foreach ($ids as $id) {
                $product = self::readableProduct($id);
                if ($product->is_type('variable') && $variations !== 'parent') {
                    if ($variations === 'both') { $expanded[] = $id; }
                    $expanded = array_merge($expanded, $product->get_children());
                } else { $expanded[] = $id; }
            }
            $expanded = array_values(array_unique($expanded));
            if (count($expanded) > Schema::MAX_RECORDS) { throw new \InvalidArgumentException('Variation expansion exceeds the 1,000-record limit. Select a smaller batch.'); }
            foreach ($expanded as $id) {
                $product = self::readableProduct($id); $quantity = $copies;
                if ($mode === 'stock') {
                    $stock = $product->get_stock_quantity();
                    if ($stock === null) { $warnings[] = $product->get_name() . ': stock is not managed; using one label × copies.'; }
                    else { $quantity *= self::quantity($stock); }
                }
                if ($quantity === 0) { $warnings[] = $product->get_name() . ': zero stock, skipped.'; continue; }
                $records[] = array('key' => 'product-' . $id, 'source' => 'products', 'values' => self::productValues($product, $fields), 'quantity' => $quantity, 'selected' => true);
            }
        } elseif ($source === 'order_items' || $source === 'orders') {
            self::can('edit_shop_orders');
            $selected_items = !empty($request['item_ids']) ? self::ids($request['item_ids'], 1000) : array();
            foreach ($ids as $id) {
                $order = wc_get_order($id);
                if (!$order || $order->get_type() !== 'shop_order') { throw new \InvalidArgumentException('Order ' . $id . ' was not found.'); }
                $order_values = self::orderValues($order, $fields);
                if ($source === 'orders') { $records[] = array('key' => 'order-' . $id, 'source' => 'orders', 'values' => $order_values, 'quantity' => $copies, 'selected' => true); continue; }
                foreach ($order->get_items('line_item') as $item) {
                    if ($selected_items && !in_array((int) $item->get_id(), $selected_items, true)) { continue; }
                    $quantity = (float) $item->get_quantity();
                    if (!empty($request['exclude_refunded'])) { $quantity += (float) $order->get_qty_refunded_for_item($item->get_id()); }
                    $print_quantity = $mode === 'order' ? self::quantity(max(0, $quantity)) * $copies : $copies;
                    if (!$print_quantity) { continue; }
                    $product = $item->get_product();
                    $values = $product ? self::productValues($product, $fields) : array('id' => (string) $item->get_product_id(), 'name' => self::plain($item->get_name()), 'sku' => '', 'barcode' => '', 'price' => '');
                    // Preserve product fields; order fields remain explicitly prefixed.
                    foreach ($order_values as $key => $value) { if (strpos($key, '.') !== false || strpos($key, 'order_meta:') === 0) { $values[$key] = $value; } }
                    $values['item.id'] = (string) $item->get_id(); $values['item.name'] = self::plain($item->get_name()); $values['item.quantity'] = (string) $item->get_quantity();
                    $values['item.total'] = self::money($item->get_total(), $order->get_currency()); $values['item.subtotal'] = self::money($item->get_subtotal(), $order->get_currency());
                    $values['item.unit_price'] = $item->get_quantity() ? self::money($item->get_total() / $item->get_quantity(), $order->get_currency()) : '';
                    foreach ($fields as $field) {
                        if (strpos($field, 'item_meta:') === 0) { $values[$field] = self::scalar($item->get_meta(substr($field, 10), true)); }
                        $values[$field] = self::scalar(apply_filters('rli_field_value', isset($values[$field]) ? $values[$field] : '', $field, $product ?: null, $order, $item));
                    }
                    if (!$product) { $warnings[] = 'Order item ' . $item->get_id() . ': original product is deleted; only historical order data is available.'; }
                    $records[] = array('key' => 'order-' . $id . '-item-' . $item->get_id(), 'source' => 'order_items', 'values' => $values, 'quantity' => $print_quantity, 'selected' => true);
                }
            }
        } elseif ($source === 'coupons') {
            self::can('edit_shop_coupons');
            foreach ($ids as $id) {
                $coupon = new \WC_Coupon($id); if (!$coupon->get_id()) { throw new \InvalidArgumentException('Coupon ' . $id . ' was not found.'); }
                $code = $coupon->get_code();
                $values = array_merge(self::common(), array('id' => (string) $id, 'name' => $code, 'sku' => $code, 'barcode' => $code, 'price' => $coupon->get_discount_type() === 'percent' ? $coupon->get_amount() . '%' : self::money($coupon->get_amount()), 'coupon.code' => $code, 'coupon.amount' => (string) $coupon->get_amount(), 'coupon.type' => $coupon->get_discount_type(), 'coupon.expiry' => $coupon->get_date_expires() ? $coupon->get_date_expires()->date_i18n('Y-m-d') : '', 'coupon.description' => self::plain($coupon->get_description())));
                foreach ($fields as $field) { if (strpos($field, 'meta:') === 0) { $values[$field] = self::scalar($coupon->get_meta(substr($field, 5), true)); } }
                $records[] = array('key' => 'coupon-' . $id, 'source' => 'coupons', 'values' => $values, 'quantity' => $copies, 'selected' => true);
            }
        } elseif ($source === 'users') {
            self::can('list_users');
            foreach ($ids as $id) {
                $user = get_userdata($id); if (!$user) { throw new \InvalidArgumentException('User ' . $id . ' was not found.'); }
                $values = array_merge(self::common(), array('id' => (string) $id, 'name' => $user->display_name, 'sku' => $user->user_login, 'barcode' => (string) $id, 'user.email' => $user->user_email, 'user.first_name' => $user->first_name, 'user.last_name' => $user->last_name, 'user.login' => $user->user_login));
                foreach ($fields as $field) {
                    if (strpos($field, 'user_meta:') !== 0) { continue; }
                    $key = substr($field, 10);
                    if (preg_match('/pass|secret|token|session|capabilit|application|api.?key|auth/i', $key)) { throw new \InvalidArgumentException('Sensitive user metadata cannot be printed.'); }
                    $values[$field] = self::scalar(get_user_meta($id, $key, true));
                }
                $records[] = array('key' => 'user-' . $id, 'source' => 'users', 'values' => $values, 'quantity' => $copies, 'selected' => true);
            }
        } else {
            foreach ($ids as $id) {
                $post = get_post($id);
                if (!$post || !current_user_can('edit_post', $id)) { throw new \RuntimeException('Post ' . $id . ' cannot be read.'); }
                if (in_array($post->post_type, array('shop_order', 'shop_order_refund', 'product', 'product_variation'), true)) { throw new \InvalidArgumentException('Use the dedicated product/order source for this record.'); }
                $values = array_merge(self::common(), array('id' => (string) $id, 'name' => self::plain($post->post_title), 'sku' => (string) $id, 'barcode' => (string) $id, 'description' => self::plain($post->post_content), 'short_description' => self::plain($post->post_excerpt), 'product_url' => get_permalink($id), 'image' => get_post_thumbnail_id($id) ? 'wp-image:' . get_post_thumbnail_id($id) : ''));
                foreach ($fields as $field) { if (strpos($field, 'meta:') === 0) { $values[$field] = self::scalar(get_post_meta($id, substr($field, 5), true)); } }
                $records[] = array('key' => 'post-' . $id, 'source' => 'posts', 'values' => $values, 'quantity' => $copies, 'selected' => true);
            }
        }
        $records = apply_filters('rli_records', $records, $request);
        return array('records' => Schema::records($records), 'warnings' => $warnings);
    }

    public static function image($id)
    {
        $id = Schema::number($id, 1, PHP_INT_MAX, true);
        if (!current_user_can('read_post', $id) && !current_user_can('edit_post', $id)) { throw new \RuntimeException('This attachment is not readable.'); }
        $file = get_attached_file($id); $uploads = wp_upload_dir();
        $intermediate = image_get_intermediate_size($id, 'medium');
        if (is_array($intermediate) && !empty($intermediate['path'])) { $file = $uploads['basedir'] . '/' . $intermediate['path']; }
        $root = realpath($uploads['basedir']); $path = $file ? realpath($file) : false;
        if (!$root || !$path || strpos($path, $root . DIRECTORY_SEPARATOR) !== 0 || !is_file($path) || !is_readable($path)) { throw new \InvalidArgumentException('Attachment must be a readable image inside the local uploads directory.'); }
        if (filesize($path) > 8000000) { throw new \InvalidArgumentException('Attachment exceeds the 8 MB image limit.'); }
        $mime = wp_get_image_mime($path);
        if (!in_array($mime, array('image/png', 'image/jpeg', 'image/gif', 'image/webp'), true)) { throw new \InvalidArgumentException('Select a PNG, JPEG, GIF, or WebP image.'); }
        return array('src' => 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($path)));
    }
}
