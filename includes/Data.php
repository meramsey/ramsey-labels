<?php
/**
 * Read-only WooCommerce/WordPress adapters using WooCommerce order CRUD.
 *
 * @package RamseyLabels
 */

namespace RamseyLabels;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Authorized read-only adapters; never generates or changes product SKUs. */
final class Data {
	public const MAX_RECORDS_PER_REQUEST = 1000;

	/**
	 * Require source-specific read permissions in addition to API access.
	 *
	 * @param string $capability WooCommerce or WordPress capability.
	 * @return void
	 * @throws \RuntimeException When source permission is absent.
	 */
	private static function can( $capability ) {
		if ( ! current_user_can( $capability ) && ! current_user_can( 'manage_options' ) ) {
			throw new \RuntimeException( esc_html__( 'You do not have permission to read this data source.', 'ramsey-labels-independent' ) );
		}
	}

	/**
	 * Validate and deduplicate IDs without coercing invalid strings to IDs.
	 *
	 * @param mixed $raw Array or separated numeric IDs.
	 * @param int   $limit Maximum IDs in this request.
	 * @return array Positive integer IDs.
	 * @throws \InvalidArgumentException On an invalid ID or request limit.
	 */
	public static function ids( $raw, $limit = 100 ) {
		if ( is_string( $raw ) ) {
			$raw = preg_split( '/[\s,;]+/', trim( $raw ), -1, PREG_SPLIT_NO_EMPTY );
		}
		if ( ! is_array( $raw ) || count( $raw ) > $limit ) {
			/* translators: %s: IDs per transport request. */
			throw new \InvalidArgumentException( esc_html( sprintf( __( 'Supply at most %s IDs per request.', 'ramsey-labels-independent' ), $limit ) ) );
		}
		$out = array();
		foreach ( $raw as $id ) {
			$out[] = Schema::number( $id, 1, PHP_INT_MAX, true );
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * Validate requested literal field names and reject credential bindings.
	 *
	 * @param mixed $raw Requested field list.
	 * @return array Unique field names.
	 * @throws \InvalidArgumentException On invalid or sensitive field names.
	 */
	public static function fieldKeys( $raw ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Preserve the RC8 public callable API.
		if ( ! is_array( $raw ) || count( $raw ) > 10000 ) {
			throw new \InvalidArgumentException( esc_html__( 'Invalid field list.', 'ramsey-labels-independent' ) );
		}
		$out = array();
		foreach ( $raw as $field ) {
			$field = Schema::text( $field, 150 );
			if ( preg_match( '/^(?:parent_meta|meta|order_meta|item_meta|user_meta):.*(?:pass|secret|token|session|capabilit|application|api.?key|auth)/i', $field ) ) {
				throw new \InvalidArgumentException( esc_html__( 'Sensitive metadata cannot be printed.', 'ramsey-labels-independent' ) );
			}
			if ( ! preg_match( '/^[\w.:-]+$/D', $field ) || in_array( $field, array( '__proto__', 'prototype', 'constructor' ), true ) ) {
				throw new \InvalidArgumentException( esc_html__( 'Invalid requested field.', 'ramsey-labels-independent' ) );
			}
			$out[] = $field;
		}
		return array_values( array_unique( $out ) );
	}

	/**
	 * Convert display markup into printable plain text.
	 *
	 * @param mixed $text Input text.
	 * @return string Decoded plain text.
	 */
	private static function plain( $text ) {
		return html_entity_decode( wp_strip_all_tags( (string) $text ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
	}

	/**
	 * Flatten printable values without serializing executable objects.
	 *
	 * @param mixed $value Field value.
	 * @return string Printable representation.
	 */
	private static function scalar( $value ) {
		if ( null === $value ) {
			return '';
		}
		if ( is_scalar( $value ) ) {
			return (string) $value;
		}
		if ( is_array( $value ) ) {
			$flat = array_filter( $value, 'is_scalar' );
			if ( count( $flat ) === count( $value ) ) {
				return implode( ', ', $flat );
			}
			return wp_json_encode( $value );
		}
		return '';
	}

	/**
	 * Format prices through WooCommerce, then remove HTML.
	 *
	 * @param mixed  $amount Numeric amount or an empty value.
	 * @param string $currency Optional currency override.
	 * @return string Printable price.
	 */
	private static function money( $amount, $currency = '' ) {
		if ( '' === $amount || null === $amount ) {
			return '';
		}
		return self::plain( wc_price( (float) $amount, $currency ? array( 'currency' => $currency ) : array() ) );
	}

	/**
	 * Provide non-customer store and date fields.
	 *
	 * @return array Common printable values.
	 */
	private static function common() {
		$address = array_filter( array( get_option( 'woocommerce_store_address' ), get_option( 'woocommerce_store_address_2' ), get_option( 'woocommerce_store_city' ), get_option( 'woocommerce_store_postcode' ), get_option( 'woocommerce_default_country' ) ) );
		return array(
			'shop.name'    => self::plain( get_bloginfo( 'name' ) ),
			'shop.address' => implode( "\n", $address ),
			'date'         => wp_date( 'Y-m-d' ),
			'time'         => wp_date( 'H:i' ),
		);
	}

	/**
	 * Resolve a non-deleted product with an object-specific permission check.
	 *
	 * @param int $id Product ID.
	 * @return \WC_Product Readable product.
	 * @throws \InvalidArgumentException If the product does not exist.
	 * @throws \RuntimeException If the user cannot read this product.
	 */
	private static function readableProduct( $id ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Retained internal RC8 adapter name.
		$product = wc_get_product( $id );
		if ( ! $product || in_array( $product->get_status(), array( 'trash', 'auto-draft' ), true ) ) {
			/* translators: %s: product ID. */
			throw new \InvalidArgumentException( esc_html( sprintf( __( 'Product %s is missing or deleted.', 'ramsey-labels-independent' ), $id ) ) );
		}
		if ( ! current_user_can( 'read_post', $id ) && ! current_user_can( 'edit_post', $id ) ) {
			/* translators: %s: product ID. */
			throw new \RuntimeException( esc_html( sprintf( __( 'Product %s is not readable by this account.', 'ramsey-labels-independent' ), $id ) ) );
		}
		return $product;
	}

	/**
	 * Resolve a thumbnail with variation-parent fallback.
	 *
	 * @param \WC_Product $product Product or variation.
	 * @return string Thumbnail URL or empty text.
	 */
	private static function searchThumbnail( $product ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Retained internal RC8 adapter name.
		$image_id = (int) $product->get_image_id();
		if ( ! $image_id && $product->get_parent_id() ) {
			$parent = wc_get_product( $product->get_parent_id() );
			if ( $parent ) {
				$image_id = (int) $parent->get_image_id();
			}
		}
		return $image_id ? (string) wp_get_attachment_image_url( $image_id, 'medium' ) : '';
	}

	/**
	 * Search authorized products and variations by name, SKU and categories.
	 *
	 * @param array $request Validated search and pagination parameters.
	 * @return array Items and pagination metadata.
	 * @throws \InvalidArgumentException If search exceeds the response budget.
	 */
	public static function searchProducts( array $request ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Preserve the RC8 public callable API.
		self::can( 'edit_products' );
		$page       = Schema::number( isset( $request['page'] ) ? $request['page'] : 1, 1, 100000, true );
		$per        = Schema::number( isset( $request['per_page'] ) ? $request['per_page'] : 30, 1, 100, true );
		$search     = isset( $request['search'] ) ? sanitize_text_field( Schema::text( $request['search'], 150 ) ) : '';
		$categories = ! empty( $request['categories'] ) ? self::ids( $request['categories'], 50 ) : array();
		$args       = array(
			'post_type'      => array( 'product' ),
			'post_status'    => array( 'publish', 'private', 'draft', 'pending' ),
			'posts_per_page' => $per,
			'paged'          => $page,
			'orderby'        => 'title',
			'order'          => 'ASC',
			'fields'         => 'ids',
		);
		if ( '' !== $search ) {
			/**
			 * WooCommerce dispatches data-store methods through __call.
			 *
			 * @var \WC_Product_Data_Store_CPT $store
			 */
			$store = \WC_Data_Store::load( 'product' );
			$found = $store->search_products( $search, '', true, true, 2001 );
			if ( count( $found ) > 2000 ) {
				throw new \InvalidArgumentException( esc_html__( 'More than 2,000 matches. Refine the product search.', 'ramsey-labels-independent' ) );
			}
			$exact = wc_get_product_id_by_sku( $search );
			if ( $exact ) {
				$found[] = $exact;
			}
			$found = array_values( array_unique( array_map( 'absint', $found ) ) );
			if ( $categories ) {
				$found = array_values(
					array_filter(
						$found,
						function ( $id ) use ( $categories ) {
							$p = wc_get_product( $id );
							if ( ! $p ) {
								return false;
							}
							return has_term( $categories, 'product_cat', $p->get_parent_id() ? $p->get_parent_id() : $id );
						}
					)
				);
			}
			if ( ! $found ) {
				return array(
					'items' => array(),
					'total' => 0,
					'pages' => 0,
					'page'  => $page,
				);
			}
			$args['post__in']  = $found;
			$args['post_type'] = array( 'product', 'product_variation' );
		} elseif ( $categories ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- Required category filtering; bounded result pages, measured with category fixtures.
			$args['tax_query'] = array(
				array(
					'taxonomy'         => 'product_cat',
					'field'            => 'term_id',
					'terms'            => $categories,
					'include_children' => true,
				),
			);
		}
		if ( ! empty( $request['stock_status'] ) ) {
			$stock = Schema::choice( $request['stock_status'], array( 'instock', 'outofstock', 'onbackorder' ) );
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- WooCommerce CPT stock filtering; request is paginated and restricted to authorized staff.
			$args['meta_query'] = array(
				array(
					'key'   => '_stock_status',
					'value' => $stock,
				),
			);
		}
		$query = new \WP_Query( $args );
		$items = array();
		foreach ( $query->posts as $id ) {
			if ( ! current_user_can( 'read_post', $id ) && ! current_user_can( 'edit_post', $id ) ) {
				continue;
			}
			$p = wc_get_product( $id );
			if ( ! $p ) {
				continue;
			}
			$items[] = array(
				'id'        => $p->get_id(),
				'name'      => self::plain( $p->get_name() ),
				'sku'       => $p->get_sku(),
				'price'     => '' === $p->get_price() ? '' : self::money( wc_get_price_to_display( $p ) ),
				'stock'     => $p->get_stock_quantity(),
				'kind'      => $p->get_type(),
				'parent_id' => $p->get_parent_id(),
				'image_url' => self::searchThumbnail( $p ),
			);
		}
		return array(
			'items' => $items,
			'total' => (int) $query->found_posts,
			'pages' => (int) $query->max_num_pages,
			'page'  => $page,
		);
	}

	/**
	 * Fetch one resource-bounded page of product categories or explicit preselection IDs.
	 *
	 * @param array $request Page, page size, or a bounded list of selected term IDs.
	 * @return array Category items and forward-pagination state.
	 * @throws \RuntimeException If the caller cannot manage products.
	 * @throws \InvalidArgumentException If the taxonomy parameters are invalid.
	 */
	public static function categories( array $request ) {
		self::can( 'edit_products' );
		if ( ! taxonomy_exists( 'product_cat' ) ) {
			return array(
				'items'    => array(),
				'page'     => 1,
				'has_more' => false,
			);
		}
		if ( ! empty( $request['include'] ) ) {
			$ids      = self::ids( $request['include'], 50 );
			$terms    = get_terms(
				array(
					'taxonomy'   => 'product_cat',
					'hide_empty' => false,
					'include'    => $ids,
					'number'     => 50,
					'orderby'    => 'include',
				)
			);
			$page     = 1;
			$per_page = 50;
		} else {
			$page     = Schema::number( isset( $request['page'] ) ? $request['page'] : 1, 1, 1000000, true );
			$per_page = Schema::number( isset( $request['per_page'] ) ? $request['per_page'] : 100, 1, 100, true );
			$terms    = get_terms(
				array(
					'taxonomy'   => 'product_cat',
					'hide_empty' => false,
					'number'     => $per_page + 1,
					'offset'     => ( $page - 1 ) * $per_page,
					'orderby'    => 'name',
					'order'      => 'ASC',
				)
			);
		}
		if ( is_wp_error( $terms ) ) {
			return array(
				'items'    => array(),
				'page'     => $page,
				'has_more' => false,
			);
		}
		$items = array();
		foreach ( $terms as $term ) {
			$items[] = array(
				'id'     => (int) $term->term_id,
				'name'   => sanitize_text_field( $term->name ),
				'parent' => (int) $term->parent,
			);
		}
		$has_more = ! empty( $request['include'] ) ? false : count( $items ) > $per_page;
		if ( $has_more ) {
			$items = array_slice( $items, 0, $per_page );
		}
		return array(
			'items'    => $items,
			'page'     => $page,
			'has_more' => $has_more,
		);
	}

	/**
	 * Search orders through WooCommerce CRUD for either storage engine.
	 *
	 * @param array $request Search and pagination parameters.
	 * @return array Order summaries and pagination metadata.
	 * @throws \InvalidArgumentException On unsupported order search parameters.
	 */
	public static function searchOrders( array $request ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Preserve the RC8 public callable API.
		self::can( 'edit_shop_orders' );
		$page   = Schema::number( isset( $request['page'] ) ? $request['page'] : 1, 1, 100000, true );
		$per    = Schema::number( isset( $request['per_page'] ) ? $request['per_page'] : 20, 1, 100, true );
		$search = isset( $request['search'] ) ? sanitize_text_field( Schema::text( $request['search'], 150 ) ) : '';
		$args   = array(
			'limit'    => $per,
			'paged'    => $page,
			'paginate' => true,
			'orderby'  => 'date',
			'order'    => 'DESC',
			'type'     => 'shop_order',
		);
		if ( ! empty( $request['status'] ) ) {
			$status = str_replace( 'wc-', '', sanitize_key( $request['status'] ) );
			if ( ! array_key_exists( 'wc-' . $status, wc_get_order_statuses() ) ) {
				throw new \InvalidArgumentException( esc_html__( 'Unknown order status.', 'ramsey-labels-independent' ) );
			}
			$args['status'] = $status;
		}
		if ( '' !== $search ) {
			if ( ctype_digit( ltrim( $search, '#' ) ) ) {
				$args['include'] = array( (int) ltrim( $search, '#' ) );
			} elseif ( is_email( $search ) ) {
				$args['billing_email'] = $search;
			} elseif ( function_exists( 'wc_order_search' ) ) {
				$ids = wc_order_search( $search );
				if ( count( $ids ) > self::MAX_RECORDS_PER_REQUEST ) {
					throw new \InvalidArgumentException( esc_html__( 'More than 1,000 orders matched. Refine the search before loading records.', 'ramsey-labels-independent' ) );
				}
				if ( ! $ids ) {
					return array(
						'items' => array(),
						'total' => 0,
						'pages' => 0,
						'page'  => $page,
					);
				}
				$args['include'] = $ids;
			} else {
				throw new \InvalidArgumentException( esc_html__( 'Search orders by numeric ID or billing email on this WooCommerce version.', 'ramsey-labels-independent' ) );
			}
		}
		$result = wc_get_orders( $args );
		$items  = array();
		foreach ( $result->orders as $order ) {
			$items[] = array(
				'id'    => $order->get_id(),
				'name'  => '#' . $order->get_order_number() . ' — ' . self::plain( $order->get_formatted_billing_full_name() ),
				'sku'   => $order->get_status(),
				'price' => self::money( $order->get_total(), $order->get_currency() ),
				'kind'  => 'order',
				'stock' => $order->get_item_count(),
				'date'  => $order->get_date_created() ? $order->get_date_created()->date_i18n( 'Y-m-d' ) : '',
			);
		}
		return array(
			'items' => $items,
			'total' => (int) $result->total,
			'pages' => (int) $result->max_num_pages,
			'page'  => $page,
		);
	}

	/**
	 * Read purchased line-item summaries for an authorized order source.
	 *
	 * @param mixed $id Order ID.
	 * @return array Order ID and item summaries.
	 * @throws \InvalidArgumentException If the order is missing.
	 */
	public static function orderItems( $id ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Preserve the RC8 public callable API.
		self::can( 'edit_shop_orders' );
		$order = wc_get_order( Schema::number( $id, 1, PHP_INT_MAX, true ) );
		if ( ! $order || 'shop_order' !== $order->get_type() ) {
			throw new \InvalidArgumentException( esc_html__( 'Order was not found.', 'ramsey-labels-independent' ) );
		}
		$items = array();
		foreach ( $order->get_items( 'line_item' ) as $item ) {
			if ( ! $item instanceof \WC_Order_Item_Product ) {
				continue;
			}
			$items[] = array(
				'id'         => $item->get_id(),
				'name'       => self::plain( $item->get_name() ),
				'quantity'   => $item->get_quantity(),
				'product_id' => $item->get_variation_id() ? $item->get_variation_id() : $item->get_product_id(),
			);
		}
		return array(
			'order_id' => $order->get_id(),
			'items'    => $items,
		);
	}

	/**
	 * Resolve taxonomy and local attributes through the product API.
	 *
	 * @param \WC_Product $product Product or variation.
	 * @return string Printable attribute summary.
	 */
	private static function attributes( $product ) {
		$parts = array();
		foreach ( $product->get_attributes() as $key => $attribute ) {
			if ( is_object( $attribute ) && method_exists( $attribute, 'get_name' ) ) {
				$key   = $attribute->get_name();
				$value = $product->get_attribute( $key );
			} else {
				$value = $product->get_attribute( $key );
			}
			if ( '' !== $value ) {
				$parts[] = self::plain( wc_attribute_label( $key, $product ) ) . ': ' . self::plain( $value );
			}
		}
		return implode( ', ', $parts );
	}

	/**
	 * Resolve product, price, image and explicitly requested custom fields.
	 *
	 * @param \WC_Product $product Authorized product.
	 * @param array       $fields Requested field names.
	 * @return array Printable product values.
	 */
	public static function productValues( $product, array $fields ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Preserve the RC8 public callable API.
		$id          = $product->get_id();
		$parent      = $product->get_parent_id() ? wc_get_product( $product->get_parent_id() ) : null;
		$taxonomy_id = $parent ? $parent->get_id() : $id;
		$categories  = wc_get_product_terms( $taxonomy_id, 'product_cat', array( 'fields' => 'names' ) );
		$price       = $product->get_price();
		$regular     = $product->get_regular_price();
		$sale        = $product->get_sale_price();
		$image_id    = (int) $product->get_image_id();
		if ( ! $image_id && $parent ) {
			$image_id = (int) $parent->get_image_id();
		}
		$values = array_merge(
			self::common(),
			array(
				'id'                => (string) $id,
				'name'              => self::plain( $product->get_name() ),
				'parent_name'       => self::plain( $parent ? $parent->get_name() : $product->get_name() ),
				'sku'               => (string) $product->get_sku(),
				'barcode'           => (string) $product->get_sku(),
				'gtin'              => method_exists( $product, 'get_global_unique_id' ) ? (string) $product->get_global_unique_id() : (string) $product->get_meta( '_global_unique_id', true ),
				'price'             => '' === $price ? '' : self::money( wc_get_price_to_display( $product ) ),
				'price_raw'         => (string) $price,
				'regular_price'     => '' === $regular ? '' : self::money( wc_get_price_to_display( $product, array( 'price' => $regular ) ) ),
				'sale_price'        => '' === $sale ? '' : self::money( wc_get_price_to_display( $product, array( 'price' => $sale ) ) ),
				'price_incl_tax'    => '' === $price ? '' : self::money( wc_get_price_including_tax( $product ) ),
				'price_excl_tax'    => '' === $price ? '' : self::money( wc_get_price_excluding_tax( $product ) ),
				'currency'          => get_woocommerce_currency(),
				'currency_symbol'   => self::plain( get_woocommerce_currency_symbol() ),
				'stock'             => null === $product->get_stock_quantity() ? '' : (string) $product->get_stock_quantity(),
				'stock_status'      => $product->get_stock_status(),
				'categories'        => is_wp_error( $categories ) ? '' : implode( ', ', $categories ),
				'attributes'        => self::attributes( $product ),
				'weight'            => (string) $product->get_weight(),
				'length'            => (string) $product->get_length(),
				'width'             => (string) $product->get_width(),
				'height'            => (string) $product->get_height(),
				'description'       => self::plain( $product->get_description() ),
				'short_description' => self::plain( $product->get_short_description() ),
				'product_url'       => $product->get_permalink(),
				'image'             => $image_id ? 'wp-image:' . $image_id : '',
				'image_url'         => $image_id ? (string) wp_get_attachment_image_url( $image_id, 'medium' ) : '',
				'created_date'      => $product->get_date_created() ? $product->get_date_created()->date_i18n( 'Y-m-d' ) : '',
			)
		);
		foreach ( $fields as $field ) {
			if ( 0 === strpos( $field, 'meta:' ) ) {
				$values[ $field ] = self::scalar( $product->get_meta( substr( $field, 5 ), true ) );
			} elseif ( 0 === strpos( $field, 'parent_meta:' ) ) {
				$values[ $field ] = self::scalar( ( $parent ? $parent : $product )->get_meta( substr( $field, 12 ), true ) );
			} elseif ( 0 === strpos( $field, 'attr:' ) ) {
				$values[ $field ] = self::plain( $product->get_attribute( substr( $field, 5 ) ) );
			} elseif ( 0 === strpos( $field, 'tax:' ) ) {
				$taxonomy         = substr( $field, 4 );
				$terms            = taxonomy_exists( $taxonomy ) ? wc_get_product_terms( $taxonomy_id, $taxonomy, array( 'fields' => 'names' ) ) : array();
				$values[ $field ] = is_wp_error( $terms ) ? '' : implode( ', ', $terms );
			}
			// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Preserve the documented RC8 extension hook; changing it would break integrations.
			$values[ $field ] = self::scalar( apply_filters( 'rli_field_value', isset( $values[ $field ] ) ? $values[ $field ] : '', $field, $product, null, null ) );
		}
		return $values;
	}

	/**
	 * Resolve explicitly prefixed order and address fields through CRUD.
	 *
	 * @param \WC_Order $order Authorized order.
	 * @param array     $fields Requested field names.
	 * @return array Printable order values.
	 */
	private static function orderValues( $order, array $fields ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Retained internal RC8 adapter name.
		$currency = $order->get_currency();
		$values   = array_merge(
			self::common(),
			array(
				'id'                   => (string) $order->get_id(),
				'name'                 => 'Order #' . $order->get_order_number(),
				'sku'                  => (string) $order->get_order_number(),
				'barcode'              => (string) $order->get_order_number(),
				'price'                => self::money( $order->get_total(), $currency ),
				'currency'             => $currency,
				'currency_symbol'      => self::plain( get_woocommerce_currency_symbol( $currency ) ),
				'order.id'             => (string) $order->get_id(),
				'order.number'         => (string) $order->get_order_number(),
				'order.date'           => $order->get_date_created() ? $order->get_date_created()->date_i18n( 'Y-m-d H:i' ) : '',
				'order.completed_date' => $order->get_date_completed() ? $order->get_date_completed()->date_i18n( 'Y-m-d H:i' ) : '',
				'order.total'          => self::money( $order->get_total(), $currency ),
				'order.subtotal'       => self::money( $order->get_subtotal(), $currency ),
				'order.shipping'       => self::money( $order->get_shipping_total(), $currency ),
				'order.tax'            => self::money( $order->get_total_tax(), $currency ),
				'order.discount'       => self::money( $order->get_discount_total(), $currency ),
				'order.status'         => $order->get_status(),
				'order.currency'       => $currency,
				'order.customer_note'  => self::plain( $order->get_customer_note() ),
				'order.total_items'    => (string) $order->get_item_count(),
			)
		);
		foreach ( array( 'billing', 'shipping' ) as $kind ) {
			$address = $order->get_address( $kind );
			foreach ( array( 'first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country', 'email', 'phone' ) as $key ) {
				$values[ $kind . '.' . $key ] = isset( $address[ $key ] ) ? self::plain( $address[ $key ] ) : '';
			}
			$values[ $kind . '.name' ] = trim( $values[ $kind . '.first_name' ] . ' ' . $values[ $kind . '.last_name' ] );
		}
		foreach ( $fields as $field ) {
			if ( 0 === strpos( $field, 'order_meta:' ) ) {
				$values[ $field ] = self::scalar( $order->get_meta( substr( $field, 11 ), true ) );
			}
			// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Preserve the documented RC8 extension hook.
			$values[ $field ] = self::scalar( apply_filters( 'rli_field_value', isset( $values[ $field ] ) ? $values[ $field ] : '', $field, null, $order, null ) );
		}
		return $values;
	}

	/**
	 * Require a nonnegative whole stock or purchased quantity.
	 *
	 * @param mixed $value Stock or line-item quantity.
	 * @param bool  $segmented Permit large counts without expanding label objects.
	 * @return int Whole quantity.
	 * @throws \InvalidArgumentException On fractional, negative or oversized quantities.
	 */
	private static function quantity( $value, $segmented = false ) {
		if ( ! is_numeric( $value ) || (float) $value < 0 || floor( (float) $value ) !== (float) $value ) {
			throw new \InvalidArgumentException( esc_html__( 'A quantity is fractional or negative. Choose one label per item or set an explicit whole quantity.', 'ramsey-labels-independent' ) );
		}
		return Schema::number( $value, 0, $segmented ? min( PHP_INT_MAX, 9007199254740991 ) : Schema::MAX_LABELS, true );
	}

	/**
	 * Resolve authorized sources into validated print records without writes.
	 *
	 * @param array $request Source, IDs, fields and quantity policy.
	 * @return array Records and warnings.
	 * @throws \InvalidArgumentException On missing records or invalid quantity policies.
	 * @throws \RuntimeException On an unauthorized source or object.
	 */
	public static function records( array $request ) {
		$source = Schema::choice( isset( $request['source'] ) ? $request['source'] : 'products', array( 'products', 'order_items', 'orders', 'coupons', 'posts', 'users' ) );
		$ids    = self::ids( isset( $request['ids'] ) ? $request['ids'] : array(), self::MAX_RECORDS_PER_REQUEST );
		if ( ! $ids ) {
			throw new \InvalidArgumentException( esc_html__( 'Select at least one record.', 'ramsey-labels-independent' ) );
		}
		$fields    = self::fieldKeys( isset( $request['fields'] ) ? $request['fields'] : array() );
		$mode      = Schema::choice( isset( $request['quantity_mode'] ) ? $request['quantity_mode'] : 'one', array( 'one', 'stock', 'order' ) );
		$segmented = Schema::boolean( isset( $request['segmented'] ) ? $request['segmented'] : false );
		$copies    = Schema::number( isset( $request['copies'] ) ? $request['copies'] : 1, 1, $segmented ? min( PHP_INT_MAX, 9007199254740991 ) : Schema::MAX_LABELS, true );
		$bytes     = 0;
		$labels    = 0;
		$records   = array();
		$warnings  = array();
		if ( 'products' === $source ) {
			self::can( 'edit_products' );
			$expanded   = array();
			$variations = Schema::choice( isset( $request['variations'] ) ? $request['variations'] : 'parent', array( 'parent', 'variations', 'both' ) );
			foreach ( $ids as $id ) {
				$product = self::readableProduct( $id );
				if ( $product->is_type( 'variable' ) && 'parent' !== $variations ) {
					if ( 'both' === $variations ) {
						$expanded[] = $id;
					}
					$expanded = array_merge( $expanded, $product->get_children() );
				} else {
					$expanded[] = $id;
				}
			}
			$expanded = array_values( array_unique( $expanded ) );
			if ( count( $expanded ) > self::MAX_RECORDS_PER_REQUEST ) {
				throw new \InvalidArgumentException( esc_html__( 'Variation expansion exceeds the 1,000-record limit. Select a smaller batch.', 'ramsey-labels-independent' ) );
			}
			foreach ( $expanded as $id ) {
				$product  = self::readableProduct( $id );
				$quantity = $copies;
				if ( 'stock' === $mode ) {
					$stock = $product->get_stock_quantity();
					if ( null === $stock ) {
						/* translators: %s: product name. */
						$warnings[] = sprintf( __( '%s: stock is not managed; using one label × copies.', 'ramsey-labels-independent' ), $product->get_name() );
					} else {
						$quantity *= self::quantity( $stock, $segmented );
					}
				}
				if ( 0 === $quantity ) {
					/* translators: %s: product name. */
					$warnings[] = sprintf( __( '%s: zero stock, skipped.', 'ramsey-labels-independent' ), $product->get_name() );
					continue;
				}
				$records[] = array(
					'key'      => 'product-' . $id,
					'source'   => 'products',
					'values'   => self::productValues( $product, $fields ),
					'quantity' => $quantity,
					'selected' => true,
				);
				self::record_budget( $records, $bytes, $labels, $segmented );
			}
		} elseif ( 'order_items' === $source || 'orders' === $source ) {
			self::can( 'edit_shop_orders' );
			$selected_items = ! empty( $request['item_ids'] ) ? self::ids( $request['item_ids'], self::MAX_RECORDS_PER_REQUEST ) : array();
			foreach ( $ids as $id ) {
				$order = wc_get_order( $id );
				if ( ! $order || 'shop_order' !== $order->get_type() ) {
					/* translators: %s: order ID. */
					throw new \InvalidArgumentException( esc_html( sprintf( __( 'Order %s was not found.', 'ramsey-labels-independent' ), $id ) ) );
				}
				$order_values = self::orderValues( $order, $fields );
				if ( 'orders' === $source ) {
					$records[] = array(
						'key'      => 'order-' . $id,
						'source'   => 'orders',
						'values'   => $order_values,
						'quantity' => $copies,
						'selected' => true,
					);
					self::record_budget( $records, $bytes, $labels, $segmented );
					continue;
				}
				foreach ( $order->get_items( 'line_item' ) as $item ) {
					if ( ! $item instanceof \WC_Order_Item_Product ) {
						continue;
					}
					if ( $selected_items && ! in_array( (int) $item->get_id(), $selected_items, true ) ) {
						continue;
					}
					$quantity = (float) $item->get_quantity();
					if ( ! empty( $request['exclude_refunded'] ) ) {
						$quantity += (float) $order->get_qty_refunded_for_item( $item->get_id() );
					}
					$print_quantity = 'order' === $mode ? self::quantity( max( 0, $quantity ), $segmented ) * $copies : $copies;
					if ( ! $print_quantity ) {
						continue;
					}
					$product = $item->get_product();
					$values  = $product ? self::productValues( $product, $fields ) : array(
						'id'      => (string) $item->get_product_id(),
						'name'    => self::plain( $item->get_name() ),
						'sku'     => '',
						'barcode' => '',
						'price'   => '',
					);
					// Preserve product fields; order fields remain explicitly prefixed.
					foreach ( $order_values as $key => $value ) {
						if ( false !== strpos( $key, '.' ) || 0 === strpos( $key, 'order_meta:' ) ) {
							$values[ $key ] = $value;
						}
					}
					$values['item.id']         = (string) $item->get_id();
					$values['item.name']       = self::plain( $item->get_name() );
					$values['item.quantity']   = (string) $item->get_quantity();
					$values['item.total']      = self::money( $item->get_total(), $order->get_currency() );
					$values['item.subtotal']   = self::money( $item->get_subtotal(), $order->get_currency() );
					$values['item.unit_price'] = $item->get_quantity() ? self::money( (float) $item->get_total() / $item->get_quantity(), $order->get_currency() ) : '';
					foreach ( $fields as $field ) {
						if ( 0 === strpos( $field, 'item_meta:' ) ) {
							$values[ $field ] = self::scalar( $item->get_meta( substr( $field, 10 ), true ) );
						}
						// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Preserve the documented RC8 extension hook.
						$values[ $field ] = self::scalar( apply_filters( 'rli_field_value', isset( $values[ $field ] ) ? $values[ $field ] : '', $field, $product ? $product : null, $order, $item ) );
					}
					if ( ! $product ) {
						/* translators: %s: order item ID. */
						$warnings[] = sprintf( __( 'Order item %s: original product is deleted; only historical order data is available.', 'ramsey-labels-independent' ), $item->get_id() );
					}
					$records[] = array(
						'key'      => 'order-' . $id . '-item-' . $item->get_id(),
						'source'   => 'order_items',
						'values'   => $values,
						'quantity' => $print_quantity,
						'selected' => true,
					);
					self::record_budget( $records, $bytes, $labels, $segmented );
				}
			}
		} elseif ( 'coupons' === $source ) {
			self::can( 'edit_shop_coupons' );
			foreach ( $ids as $id ) {
				$coupon = new \WC_Coupon( $id );
				if ( ! $coupon->get_id() ) {
					/* translators: %s: coupon ID. */
					throw new \InvalidArgumentException( esc_html( sprintf( __( 'Coupon %s was not found.', 'ramsey-labels-independent' ), $id ) ) );
				}
				$code   = $coupon->get_code();
				$values = array_merge(
					self::common(),
					array(
						'id'                 => (string) $id,
						'name'               => $code,
						'sku'                => $code,
						'barcode'            => $code,
						'price'              => 'percent' === $coupon->get_discount_type() ? $coupon->get_amount() . '%' : self::money( $coupon->get_amount() ),
						'coupon.code'        => $code,
						'coupon.amount'      => (string) $coupon->get_amount(),
						'currency_symbol'    => self::plain( get_woocommerce_currency_symbol() ),
						'coupon.type'        => $coupon->get_discount_type(),
						'coupon.expiry'      => $coupon->get_date_expires() ? $coupon->get_date_expires()->date_i18n( 'Y-m-d' ) : '',
						'coupon.description' => self::plain( $coupon->get_description() ),
					)
				);
				foreach ( $fields as $field ) {
					if ( 0 === strpos( $field, 'meta:' ) ) {
						$values[ $field ] = self::scalar( $coupon->get_meta( substr( $field, 5 ), true ) );
					}
				}
				$records[] = array(
					'key'      => 'coupon-' . $id,
					'source'   => 'coupons',
					'values'   => $values,
					'quantity' => $copies,
					'selected' => true,
				);
				self::record_budget( $records, $bytes, $labels, $segmented );
			}
		} elseif ( 'users' === $source ) {
			self::can( 'list_users' );
			foreach ( $ids as $id ) {
				$user = get_userdata( $id );
				if ( ! $user ) {
					/* translators: %s: user ID. */
					throw new \InvalidArgumentException( esc_html( sprintf( __( 'User %s was not found.', 'ramsey-labels-independent' ), $id ) ) );
				}
				$values = array_merge(
					self::common(),
					array(
						'id'              => (string) $id,
						'name'            => $user->display_name,
						'sku'             => $user->user_login,
						'barcode'         => (string) $id,
						'user.email'      => $user->user_email,
						'user.first_name' => $user->first_name,
						'user.last_name'  => $user->last_name,
						'user.login'      => $user->user_login,
					)
				);
				foreach ( $fields as $field ) {
					if ( 0 !== strpos( $field, 'user_meta:' ) ) {
						continue;
					}
					$key = substr( $field, 10 );
					if ( ! current_user_can( 'edit_user', $id ) ) {
						throw new \RuntimeException( esc_html__( 'Custom user metadata requires permission to edit that user.', 'ramsey-labels-independent' ) );
					}
					if ( preg_match( '/pass|secret|token|session|capabilit|application|api.?key|auth/i', $key ) ) {
						throw new \InvalidArgumentException( esc_html__( 'Sensitive user metadata cannot be printed.', 'ramsey-labels-independent' ) );
					}
					$values[ $field ] = self::scalar( get_user_meta( $id, $key, true ) );
				}
				$records[] = array(
					'key'      => 'user-' . $id,
					'source'   => 'users',
					'values'   => $values,
					'quantity' => $copies,
					'selected' => true,
				);
				self::record_budget( $records, $bytes, $labels, $segmented );
			}
		} else {
			foreach ( $ids as $id ) {
				$post = get_post( $id );
				if ( ! $post || ! current_user_can( 'edit_post', $id ) ) {
					/* translators: %s: post ID. */
					throw new \RuntimeException( esc_html( sprintf( __( 'Post %s cannot be read.', 'ramsey-labels-independent' ), $id ) ) );
				}
				if ( in_array( $post->post_type, array( 'shop_order', 'shop_order_refund', 'product', 'product_variation' ), true ) ) {
					throw new \InvalidArgumentException( esc_html__( 'Use the dedicated product/order source for this record.', 'ramsey-labels-independent' ) );
				}
				$values = array_merge(
					self::common(),
					array(
						'id'                => (string) $id,
						'name'              => self::plain( $post->post_title ),
						'sku'               => (string) $id,
						'barcode'           => (string) $id,
						'description'       => self::plain( $post->post_content ),
						'short_description' => self::plain( $post->post_excerpt ),
						'product_url'       => get_permalink( $id ),
						'image'             => get_post_thumbnail_id( $id ) ? 'wp-image:' . get_post_thumbnail_id( $id ) : '',
					)
				);
				foreach ( $fields as $field ) {
					if ( 0 === strpos( $field, 'meta:' ) ) {
						$values[ $field ] = self::scalar( get_post_meta( $id, substr( $field, 5 ), true ) );
					}
				}
				$records[] = array(
					'key'      => 'post-' . $id,
					'source'   => 'posts',
					'values'   => $values,
					'quantity' => $copies,
					'selected' => true,
				);
				self::record_budget( $records, $bytes, $labels, $segmented );
			}
		}
		// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Preserve the documented RC8 extension hook.
		$records = apply_filters( 'rli_records', $records, $request );
		$records = Schema::records( $records, $segmented );
		if ( strlen( wp_json_encode( $records ) ) > 2000000 ) {
			throw new \InvalidArgumentException( esc_html__( 'Developer API records exceed the 2 MB response budget. Return fewer records per request.', 'ramsey-labels-independent' ) );
		}
		return array(
			'records'  => $records,
			'warnings' => $warnings,
		);
	}

	/**
	 * Stop expansion before accumulating excessive record bodies or label counts.
	 *
	 * @param array $records Accumulated records, newest last.
	 * @param int   $bytes Tracked response bytes.
	 * @param int   $labels Tracked label count.
	 * @param bool  $segmented Permit large quantities without expanding them.
	 * @throws \InvalidArgumentException On a response outside the transport budget.
	 */
	private static function record_budget( array $records, &$bytes, &$labels, $segmented ) {
		$last   = $records[ count( $records ) - 1 ];
		$clean  = Schema::records( array( $last ), $segmented );
		$bytes += strlen( wp_json_encode( $clean[0] ) );
		if ( $clean[0]['quantity'] > 9007199254740991 - $labels ) {
			throw new \InvalidArgumentException( esc_html__( 'The selected label total exceeds the exact browser integer range; split or refine the selection.', 'ramsey-labels-independent' ) );
		}
		$labels += $clean[0]['quantity'];
		if ( count( $records ) > Schema::MAX_RECORDS || $bytes > 2000000 || ( ! $segmented && $labels > Schema::MAX_LABELS ) ) {
			throw new \InvalidArgumentException( esc_html__( 'Response exceeds its rendering or byte budget. Use paginated requests and segmented printing.', 'ramsey-labels-independent' ) );
		}
	}

	/**
	 * Read a bounded raster attachment strictly inside the upload root.
	 *
	 * @param mixed $id Attachment ID, never a URL or path.
	 * @return array Data-image source.
	 * @throws \InvalidArgumentException On unsafe, missing or oversized attachments.
	 * @throws \RuntimeException On unreadable attachments.
	 */
	public static function image( $id ) {
		$id = Schema::number( $id, 1, PHP_INT_MAX, true );
		if ( ! current_user_can( 'read_post', $id ) && ! current_user_can( 'edit_post', $id ) ) {
			throw new \RuntimeException( esc_html__( 'This attachment is not readable.', 'ramsey-labels-independent' ) );
		}
		$file         = get_attached_file( $id );
		$uploads      = wp_upload_dir();
		$intermediate = image_get_intermediate_size( $id, 'medium' );
		if ( is_array( $intermediate ) && ! empty( $intermediate['path'] ) ) {
			$file = $uploads['basedir'] . '/' . $intermediate['path'];
		}
		$root = realpath( $uploads['basedir'] );
		$path = $file ? realpath( $file ) : false;
		if ( ! $root || ! $path || 0 !== strpos( $path, $root . DIRECTORY_SEPARATOR ) || ! is_file( $path ) || ! is_readable( $path ) ) {
			throw new \InvalidArgumentException( esc_html__( 'Attachment must be a readable image inside the local uploads directory.', 'ramsey-labels-independent' ) );
		}
		if ( filesize( $path ) > 8000000 ) {
			throw new \InvalidArgumentException( esc_html__( 'Attachment exceeds the 8 MB image limit.', 'ramsey-labels-independent' ) );
		}
		$mime = wp_get_image_mime( $path );
		if ( ! in_array( $mime, array( 'image/png', 'image/jpeg', 'image/gif', 'image/webp' ), true ) ) {
			throw new \InvalidArgumentException( esc_html__( 'Select a PNG, JPEG, GIF, or WebP image.', 'ramsey-labels-independent' ) );
		}
		$size = wp_getimagesize( $path );
		if ( ! $size || $size[0] * $size[1] > 16000000 ) {
			throw new \InvalidArgumentException( esc_html__( 'Attachment exceeds the 16-megapixel image budget.', 'ramsey-labels-independent' ) );
		}
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode,WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- MIME-checked local raster, realpath-confined to uploads and byte/pixel bounded; never executable code or a remote fetch.
		return array( 'src' => 'data:' . $mime . ';base64,' . base64_encode( file_get_contents( $path ) ) );
	}
}
