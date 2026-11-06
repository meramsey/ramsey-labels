<?php
/** WordPress lifecycle, authenticated API and admin workflow integration. */
namespace RamseyLabels;

if ( ! defined( 'ABSPATH' ) ) {
	exit; }

final class Plugin {

	public static function allowed() {
		return current_user_can( 'manage_woocommerce' ) || current_user_can( 'manage_options' );
	}

	public static function boot() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'admin_notices', array( __CLASS__, 'notices' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( RLI_FILE ), array( __CLASS__, 'links' ) );
		add_filter( 'post_row_actions', array( __CLASS__, 'rowActions' ), 10, 2 );
		add_filter( 'user_row_actions', array( __CLASS__, 'userActions' ), 10, 2 );
		add_filter( 'tag_row_actions', array( __CLASS__, 'categoryActions' ), 10, 2 );
		add_filter( 'woocommerce_admin_order_actions', array( __CLASS__, 'orderActions' ), 10, 2 );
		add_action( 'edit_form_after_title', array( __CLASS__, 'productButton' ) );
		add_action( 'woocommerce_product_after_variable_attributes', array( __CLASS__, 'variationButton' ), 10, 3 );
		add_action( 'add_meta_boxes', array( __CLASS__, 'orderBoxes' ) );
		add_action( 'woocommerce_admin_order_item_headers', array( __CLASS__, 'itemHeader' ) );
		add_action( 'woocommerce_admin_order_item_values', array( __CLASS__, 'itemCell' ), 10, 3 );
		add_action( 'woocommerce_order_item_add_action_buttons', array( __CLASS__, 'itemButton' ) );
		foreach ( array( 'edit-product', 'edit-shop_coupon', 'edit-shop_order', 'woocommerce_page_wc-orders', 'users' ) as $screen ) {
			add_filter(
				'bulk_actions-' . $screen,
				function ( $actions ) use ( $screen ) {
					return Plugin::bulkActions( $actions, $screen );
				}
			);
			add_filter( 'handle_bulk_actions-' . $screen, array( __CLASS__, 'bulkRedirect' ), 10, 3 );
		}
	}

	public static function menu() {
		$parent = class_exists( 'WooCommerce' ) ? 'woocommerce' : 'tools.php';
		add_submenu_page( $parent, __( 'Ramsey Labels', 'ramsey-labels-independent' ), __( 'Ramsey Labels', 'ramsey-labels-independent' ), class_exists( 'WooCommerce' ) ? 'manage_woocommerce' : 'manage_options', 'ramsey-labels', array( __CLASS__, 'page' ) );
	}

	public static function url( $source = '', array $ids = array(), array $extra = array() ) {
		$query = array( 'page' => 'ramsey-labels' );
		if ( $source ) {
			$query['rli_source'] = $source; }
		if ( $ids ) {
			$query['rli_ids'] = implode( ',', array_map( 'absint', $ids ) ); }
		return add_query_arg( array_merge( $query, $extra ), admin_url( 'admin.php' ) );
	}

	public static function links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( self::url() ) . '">' . esc_html__( 'Design / Print', 'ramsey-labels-independent' ) . '</a>' );
		return $links;
	}

	public static function page() {
		if ( ! self::allowed() ) {
			wp_die( esc_html__( 'Permission denied.', 'ramsey-labels-independent' ) ); }
		echo '<div class="wrap"><div id="rli-app"><p>Loading Ramsey Labels…</p></div><noscript><p>Enable JavaScript to use the visual designer and print engine.</p></noscript></div>';
	}

	public static function notices() {
		if ( ! self::allowed() || ! isset( $_GET['page'] ) || $_GET['page'] !== 'ramsey-labels' ) {
			return; }
		if ( ! function_exists( 'wc_get_product' ) ) {
			echo '<div class="notice notice-error"><p>WooCommerce is inactive. Product and order integrations require WooCommerce.</p></div>'; }
	}

	private static function preselection() {
		$out = array();
		try {
			if ( ! empty( $_GET['rli_job'] ) ) {
				$token = sanitize_key( wp_unslash( $_GET['rli_job'] ) );
				if ( preg_match( '/^[a-f0-9]{32}$/D', $token ) ) {
					$handoff = get_transient( 'rli_handoff_' . get_current_user_id() . '_' . $token );
					if ( is_array( $handoff ) ) {
						return $handoff; }
				}
			}
			if ( ! empty( $_GET['rli_ids'] ) || ! empty( $_GET['rli_id'] ) ) {
				$out['ids']    = Data::ids( wp_unslash( isset( $_GET['rli_ids'] ) ? $_GET['rli_ids'] : $_GET['rli_id'] ), 1000 );
				$out['source'] = Schema::choice( isset( $_GET['rli_source'] ) ? sanitize_key( wp_unslash( $_GET['rli_source'] ) ) : 'products', array( 'products', 'order_items', 'orders', 'coupons', 'users', 'posts' ) );
			}
			if ( ! empty( $_GET['rli_item_ids'] ) ) {
				$out['item_ids'] = Data::ids( wp_unslash( $_GET['rli_item_ids'] ), 1000 ); }
			if ( ! empty( $_GET['rli_categories'] ) ) {
				$out['categories'] = Data::ids( wp_unslash( $_GET['rli_categories'] ), 50 ); }
		} catch ( \Throwable $error ) {
			$out = array( 'error' => $error->getMessage() ); }
		return $out;
	}

	public static function bootstrap() {
		$categories = taxonomy_exists( 'product_cat' ) ? get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'hide_empty' => false,
				'number'     => 1000,
			)
		) : array();
		$roles      = array();
		foreach ( wp_roles()->roles as $key => $role ) {
			$roles[] = array(
				'id'   => $key,
				'name' => $role['name'],
			); }
		$cats = array();
		if ( ! is_wp_error( $categories ) ) {
			foreach ( $categories as $term ) {
				$cats[] = array(
					'id'   => (int) $term->term_id,
					'name' => $term->name,
				); }
		}
		return array(
			'version'      => RLI_VERSION,
			'rest'         => esc_url_raw( rest_url( 'ramsey-labels/v1/' ) ),
			'nonce'        => wp_create_nonce( 'wp_rest' ),
			'library'      => Store::visible( Store::read() ),
			'categories'   => $cats,
			'roles'        => $roles,
			'permissions'  => array(
				'admin'    => current_user_can( 'manage_options' ),
				'products' => current_user_can( 'edit_products' ),
				'orders'   => current_user_can( 'edit_shop_orders' ),
				'coupons'  => current_user_can( 'edit_shop_coupons' ),
				'users'    => current_user_can( 'list_users' ),
			),
			'preselection' => self::preselection(),
			'user'         => get_current_user_id(),
			'demo'         => false,
		);
	}

	public static function assets( $hook ) {
		if ( ! self::allowed() ) {
			return; }
		$base = plugin_dir_url( RLI_FILE );
		wp_enqueue_script( 'rli-integrations', $base . 'assets/integrations.js', array(), RLI_VERSION, true );
		if ( ! isset( $_GET['page'] ) || $_GET['page'] !== 'ramsey-labels' ) {
			return; }
		wp_enqueue_media();
		wp_enqueue_style( 'rli-app', $base . 'assets/app.css', array(), RLI_VERSION );
		wp_enqueue_script( 'rli-symbols', $base . 'assets/symbol-tables.js', array(), RLI_VERSION, true );
		wp_enqueue_script( 'rli-barcodes', $base . 'assets/barcodes.js', array( 'rli-symbols' ), RLI_VERSION, true );
		wp_enqueue_script( 'rli-core', $base . 'assets/core.js', array(), RLI_VERSION, true );
		wp_enqueue_script( 'rli-render', $base . 'assets/render.js', array( 'rli-core', 'rli-barcodes' ), RLI_VERSION, true );
		wp_enqueue_script( 'rli-app', $base . 'assets/app.js', array( 'rli-render' ), RLI_VERSION, true );
		wp_localize_script( 'rli-app', 'RLI_BOOT', self::bootstrap() );
	}

	private static function endpoint( $callback, $admin = false ) {
		return function ( $request ) use ( $callback, $admin ) {
			if ( ! self::allowed() || ( $admin && ! current_user_can( 'manage_options' ) ) ) {
				return new \WP_Error( 'rli_forbidden', 'You do not have permission for this action.', array( 'status' => 403 ) ); }
			if ( strlen( $request->get_body() ) > 2200000 ) {
				return new \WP_Error( 'rli_too_large', 'Request exceeds the 2.2 MB limit.', array( 'status' => 413 ) ); }
			try {
				return rest_ensure_response( call_user_func( $callback, $request ) ); } catch ( \DomainException $error ) {
				return new \WP_Error( 'rli_conflict', $error->getMessage(), array( 'status' => 409 ) ); } catch ( \InvalidArgumentException $error ) {
					return new \WP_Error( 'rli_invalid', $error->getMessage(), array( 'status' => 400 ) ); } catch ( \RuntimeException $error ) {
					return new \WP_Error( 'rli_unavailable', $error->getMessage(), array( 'status' => 403 ) ); } catch ( \Throwable $error ) {
							error_log( 'Ramsey Labels: ' . get_class( $error ) . ': ' . $error->getMessage() );
							return new \WP_Error( 'rli_internal', 'The request failed. Check the WordPress error log; no product or order was changed.', array( 'status' => 500 ) );
					}
		};
	}

	public static function routes() {
		$definitions = array(
			array(
				'/bootstrap',
				'GET',
				function ( $r ) {
										return self::bootstrap(); },
				false,
			),
			array(
				'/products',
				'GET',
				function ( $r ) {
										return Data::searchProducts( $r->get_params() ); },
				false,
			),
			array(
				'/orders',
				'GET',
				function ( $r ) {
										return Data::searchOrders( $r->get_params() ); },
				false,
			),
			array(
				'/order-items/(?P<id>\d+)',
				'GET',
				function ( $r ) {
										return Data::orderItems( $r['id'] ); },
				false,
			),
			array(
				'/records',
				'POST',
				function ( $r ) {
										return Data::records( (array) $r->get_json_params() ); },
				false,
			),
			array(
				'/image/(?P<id>\d+)',
				'GET',
				function ( $r ) {
										return Data::image( $r['id'] ); },
				false,
			),
			array(
				'/library',
				'POST',
				function ( $r ) {
										return Store::save( (array) $r->get_json_params() ); },
				false,
			),
			array(
				'/jobs',
				'GET',
				function ( $r ) {
										return Store::jobs(); },
				false,
			),
			array(
				'/jobs',
				'POST',
				function ( $r ) {
										return Store::updateJob( (array) $r->get_json_params() ); },
				false,
			),
			array(
				'/migration',
				'GET',
				function ( $r ) {
										return Migration::inspect(); },
				true,
			),
			array(
				'/migration',
				'POST',
				function ( $r ) {
					$data = (array) $r->get_json_params();
					$action = isset( $data['action'] ) ? $data['action'] : 'preview';
					if ( $action === 'preview' ) {
						return Migration::plan(); }
					if ( $action === 'apply' ) {
						return Migration::apply( isset( $data['hash'] ) ? $data['hash'] : '' ); }
					if ( $action === 'restore' && ! empty( $data['confirmed'] ) ) {
						return array( 'library' => Migration::restore() ); }
					throw new \InvalidArgumentException( 'Invalid migration action.' );
				},
				true,
			),
		);
		foreach ( $definitions as $definition ) {
			register_rest_route(
				'ramsey-labels/v1',
				$definition[0],
				array(
					'methods'             => $definition[1],
					'permission_callback' => function () use ( $definition ) {
						return Plugin::allowed() && ( ! $definition[3] || current_user_can( 'manage_options' ) );
					},
					'callback'            => self::endpoint( $definition[2], $definition[3] ),
				)
			);
		}
	}

	public static function rowActions( $actions, $post ) {
		if ( ! self::allowed() ) {
			return $actions; }
		$source = $post->post_type === 'product' ? 'products' : ( $post->post_type === 'shop_coupon' ? 'coupons' : ( $post->post_type === 'shop_order' ? 'order_items' : '' ) );
		if ( $source ) {
			$actions['rli_labels'] = '<a href="' . esc_url( self::url( $source, array( $post->ID ) ) ) . '">Print labels</a>'; }
		return $actions;
	}

	public static function userActions( $actions, $user ) {
		if ( self::allowed() && current_user_can( 'list_users' ) ) {
			$actions['rli_labels'] = '<a href="' . esc_url( self::url( 'users', array( $user->ID ) ) ) . '">Print user label</a>'; }
		return $actions;
	}

	public static function categoryActions( $actions, $term ) {
		if ( self::allowed() && $term->taxonomy === 'product_cat' ) {
			$actions['rli_labels'] = '<a href="' . esc_url( self::url( '', array(), array( 'rli_categories' => $term->term_id ) ) ) . '">Product labels</a>'; }
		return $actions;
	}

	public static function orderActions( $actions, $order ) {
		if ( self::allowed() && current_user_can( 'edit_shop_orders' ) ) {
			$actions['rli_labels'] = array(
				'url'    => self::url( 'order_items', array( $order->get_id() ) ),
				'name'   => 'Print product labels',
				'action' => 'rli-labels',
			); }
		return $actions;
	}

	public static function productButton( $post ) {
		if ( self::allowed() && $post->post_type === 'product' ) {
			echo '<p><a class="button" href="' . esc_url( self::url( 'products', array( $post->ID ) ) ) . '">Ramsey Labels: print product label</a></p>'; }
	}

	public static function variationButton( $loop, $data, $variation ) {
		if ( self::allowed() ) {
			echo '<p><a class="button" href="' . esc_url( self::url( 'products', array( $variation->ID ) ) ) . '">Print variation label</a></p>'; }
	}

	public static function orderBoxes() {
		if ( ! self::allowed() || ! current_user_can( 'edit_shop_orders' ) ) {
			return; }
		foreach ( array( 'shop_order', 'woocommerce_page_wc-orders' ) as $screen ) {
			add_meta_box( 'rli-order-labels', 'Ramsey Labels', array( __CLASS__, 'orderBox' ), $screen, 'side', 'default' ); }
	}

	public static function orderBox( $object ) {
		$id = is_object( $object ) && method_exists( $object, 'get_id' ) ? $object->get_id() : ( isset( $object->ID ) ? $object->ID : 0 );
		if ( ! $id ) {
			return; }
		echo '<p><a class="button" href="' . esc_url( self::url( 'order_items', array( $id ) ) ) . '">Purchased product labels</a></p><p><a class="button" href="' . esc_url( self::url( 'orders', array( $id ) ) ) . '">Order / shipping label</a></p>';
	}

	public static function itemHeader() {
		if ( self::allowed() && current_user_can( 'edit_shop_orders' ) ) {
			echo '<th class="rli-order-item-column">Label</th>'; }
	}

	public static function itemCell( $product, $item, $item_id ) {
		if ( ! self::allowed() || ! current_user_can( 'edit_shop_orders' ) ) {
			return; }
		echo '<td class="rli-order-item-column">';
		if ( is_object( $item ) && method_exists( $item, 'get_type' ) && $item->get_type() === 'line_item' ) {
			echo '<input type="checkbox" class="rli-order-item-select" value="' . esc_attr( (string) $item_id ) . '" aria-label="Select item for label printing">'; }
		echo '</td>';
	}

	public static function itemButton( $order ) {
		if ( self::allowed() && current_user_can( 'edit_shop_orders' ) ) {
			echo '<button type="button" class="button rli-print-order-items" data-url="' . esc_url( self::url( 'order_items', array( $order->get_id() ) ) ) . '">Print selected product labels</button>'; }
	}

	public static function bulkActions( $actions, $screen ) {
		if ( ! self::allowed() ) {
			return $actions; }
		if ( $screen === 'edit-product' ) {
			$actions['rli_products'] = 'Ramsey: print product labels'; } elseif ( $screen === 'edit-shop_coupon' ) {
			$actions['rli_coupons'] = 'Ramsey: print coupon labels'; } elseif ( $screen === 'users' && current_user_can( 'list_users' ) ) {
				$actions['rli_users'] = 'Ramsey: print user labels'; } else {
				$actions['rli_order_items'] = 'Ramsey: purchased product labels';
				$actions['rli_orders']      = 'Ramsey: order / shipping labels'; }
				return $actions;
	}

	public static function bulkRedirect( $redirect, $action, $ids ) {
		$map = array(
			'rli_products'    => 'products',
			'rli_order_items' => 'order_items',
			'rli_orders'      => 'orders',
			'rli_coupons'     => 'coupons',
			'rli_users'       => 'users',
		);
		if ( ! isset( $map[ $action ] ) || ! self::allowed() ) {
			return $redirect; }
		try {
			$ids = Data::ids( $ids, 1000 ); } catch ( \Throwable $error ) {
			wp_die( esc_html( $error->getMessage() ) ); }
			$token = bin2hex( random_bytes( 16 ) );
			set_transient(
				'rli_handoff_' . get_current_user_id() . '_' . $token,
				array(
					'source' => $map[ $action ],
					'ids'    => $ids,
				),
				10 * MINUTE_IN_SECONDS
			);
		return self::url( '', array(), array( 'rli_job' => $token ) );
	}
}
