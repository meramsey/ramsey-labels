<?php
/**
 * WordPress lifecycle, authenticated API and admin workflow integration.
 *
 * @package RamseyLabels
 */

namespace RamseyLabels;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Registers authenticated workflows without modifying commerce data. */
final class Plugin {

	/**
	 * Check entry permission; data adapters enforce additional source rights.
	 *
	 * @return bool Whether the current user may enter the label workflow.
	 */
	public static function allowed() {
		return current_user_can( 'manage_woocommerce' ) || current_user_can( 'manage_options' );
	}

	/** Register lifecycle and list-table hooks without activation writes. */
	public static function boot() {
		add_filter( 'rest_pre_dispatch', array( __CLASS__, 'request_budget' ), 1, 3 );
		add_filter( 'rest_post_dispatch', array( __CLASS__, 'private_response' ), 10, 3 );
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

	/**
	 * Reject unauthorized or oversized requests before core JSON decoding.
	 *
	 * @param mixed            $result Earlier pre-dispatch response.
	 * @param \WP_REST_Server  $server REST server.
	 * @param \WP_REST_Request $request Incoming request.
	 * @return mixed Response or unchanged dispatch result.
	 */
	public static function request_budget( $result, $server, $request ) {
		if ( 0 !== strpos( $request->get_route(), '/ramsey-labels/v1/' ) ) {
			return $result;
		}
		if ( ! self::allowed() ) {
			return new \WP_Error( 'rli_forbidden', __( 'You do not have permission for this action.', 'ramsey-labels-independent' ), array( 'status' => 403 ) );
		}
		if ( strlen( $request->get_body() ) > 2200000 ) {
			return new \WP_Error( 'rli_too_large', __( 'Request exceeds the 2.2 MB limit.', 'ramsey-labels-independent' ), array( 'status' => 413 ) );
		}
		return $result;
	}

	/**
	 * Keep authorized product/customer payloads out of shared HTTP caches.
	 *
	 * @param \WP_REST_Response $response REST response.
	 * @param \WP_REST_Server   $server REST server.
	 * @param \WP_REST_Request  $request Current request.
	 * @return \WP_REST_Response Private response.
	 */
	public static function private_response( $response, $server, $request ) {
		if ( 0 === strpos( $request->get_route(), '/ramsey-labels/v1/' ) ) {
			$response->header( 'Cache-Control', 'private, no-store, max-age=0' );
			$response->header( 'Vary', 'Cookie, Authorization, X-WP-Nonce' );
		}
		return $response;
	}

	/** Add the authorized label-design administration page. */
	public static function menu() {
		$parent = class_exists( 'WooCommerce' ) ? 'woocommerce' : 'tools.php';
		add_submenu_page( $parent, __( 'Ramsey Labels', 'ramsey-labels-independent' ), __( 'Ramsey Labels', 'ramsey-labels-independent' ), class_exists( 'WooCommerce' ) ? 'manage_woocommerce' : 'manage_options', 'ramsey-labels', array( __CLASS__, 'page' ) );
	}

	/**
	 * Build a read-only workflow link, never a commerce mutation URL.
	 *
	 * @param string $source Optional data source.
	 * @param array  $ids Selected IDs.
	 * @param array  $extra Additional preselection arguments.
	 * @return string Administration URL.
	 */
	public static function url( $source = '', array $ids = array(), array $extra = array() ) {
		$query = array( 'page' => 'ramsey-labels' );
		if ( $source ) {
			$query['rli_source'] = $source;
		}
		if ( $ids ) {
			$query['rli_ids'] = implode( ',', array_map( 'absint', $ids ) );
		}
		return add_query_arg( array_merge( $query, $extra ), admin_url( 'admin.php' ) );
	}

	/**
	 * Add the plugin-list workflow link.
	 *
	 * @param array $links Existing action links.
	 * @return array Action links.
	 */
	public static function links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( self::url() ) . '">' . esc_html__( 'Design / Print', 'ramsey-labels-independent' ) . '</a>' );
		return $links;
	}

	/** Render the authorized application mounting point. */
	public static function page() {
		if ( ! self::allowed() ) {
			wp_die( esc_html__( 'Permission denied.', 'ramsey-labels-independent' ) );
		}
		echo '<div class="wrap"><div id="rli-app"><p>' . esc_html__( 'Loading Ramsey Labels…', 'ramsey-labels-independent' ) . '</p></div><noscript><p>' . esc_html__( 'Enable JavaScript to use the visual designer and print engine.', 'ramsey-labels-independent' ) . '</p></noscript></div>';
	}

	/** Report missing WooCommerce only on this plugin's own page. */
	public static function notices() {
		if ( ! self::allowed() || 'ramsey-labels' !== self::query_text( 'page' ) ) {
			return;
		}
		if ( ! function_exists( 'wc_get_product' ) ) {
			echo '<div class="notice notice-error"><p>' . esc_html__( 'WooCommerce is inactive. Product and order integrations require WooCommerce.', 'ramsey-labels-independent' ) . '</p></div>';
		}
	}

	/**
	 * Validate read-only preselection; every source fetch rechecks permissions.
	 *
	 * @return array Validated IDs or a non-sensitive error.
	 */
	private static function preselection() {
		$out = array();
		try {
			$token = sanitize_key( self::query_text( 'rli_job' ) );
			if ( $token ) {
				if ( preg_match( '/^[a-f0-9]{32}$/D', $token ) ) {
					$handoff = get_transient( 'rli_handoff_' . get_current_user_id() . '_' . $token );
					if ( is_array( $handoff ) ) {
						return $handoff;
					}
				}
			}
			$ids = self::query_text( 'rli_ids' );
			$ids = '' !== $ids ? $ids : self::query_text( 'rli_id' );
			if ( '' !== $ids ) {
				$out['ids']    = Data::ids( $ids, Schema::MAX_RECORDS );
				$source        = sanitize_key( self::query_text( 'rli_source' ) );
				$out['source'] = Schema::choice( '' !== $source ? $source : 'products', array( 'products', 'order_items', 'orders', 'coupons', 'users', 'posts' ) );
			}
			if ( '' !== self::query_text( 'rli_item_ids' ) ) {
				$out['item_ids'] = Data::ids( self::query_text( 'rli_item_ids' ), Schema::MAX_RECORDS );
			}
			if ( '' !== self::query_text( 'rli_categories' ) ) {
				$out['categories'] = Data::ids( self::query_text( 'rli_categories' ), 50 );
			}
		} catch ( \Throwable $error ) {
			$out = array( 'error' => $error->getMessage() );
		}
		return $out;
	}

	/**
	 * Read scalar navigation arguments; this helper never performs a write.
	 *
	 * @param string $name Internal navigation argument name.
	 * @return string Sanitized text; object permissions are checked on every fetch.
	 */
	private static function query_text( $name ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only navigation, not a mutation; REST cookie nonces and source capabilities guard all data operations.
		return isset( $_GET[ $name ] ) && is_string( $_GET[ $name ] ) ? sanitize_text_field( wp_unslash( $_GET[ $name ] ) ) : '';
	}

	/**
	 * Build authorized browser configuration and a core REST nonce.
	 *
	 * @return array Browser bootstrap data.
	 */
	public static function bootstrap() {
		$roles = array();
		foreach ( wp_roles()->roles as $key => $role ) {
			$roles[] = array(
				'id'   => $key,
				'name' => $role['name'],
			);
		}
		return array(
			'version'      => RLI_VERSION,
			'rest'         => esc_url_raw( rest_url( 'ramsey-labels/v1/' ) ),
			'nonce'        => wp_create_nonce( 'wp_rest' ),
			'library'      => Store::visible( Store::read() ),
			'categories'   => array(),
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

	/** Enqueue versioned local assets on the appropriate admin screen. */
	public static function assets() {
		if ( ! self::allowed() ) {
			return;
		}
		$base = plugin_dir_url( RLI_FILE );
		wp_enqueue_script( 'rli-integrations', $base . 'assets/integrations.js', array( 'wp-i18n' ), RLI_VERSION, true );
		wp_set_script_translations( 'rli-integrations', 'ramsey-labels-independent', dirname( RLI_FILE ) . '/languages' );
		if ( 'ramsey-labels' !== self::query_text( 'page' ) ) {
			return;
		}
		wp_enqueue_media();
		wp_enqueue_style( 'rli-app', $base . 'assets/app.css', array(), RLI_VERSION );
		wp_enqueue_script( 'rli-symbols', $base . 'assets/symbol-tables.js', array(), RLI_VERSION, true );
		wp_enqueue_script( 'rli-barcodes', $base . 'assets/barcodes.js', array( 'rli-symbols', 'wp-i18n' ), RLI_VERSION, true );
		wp_enqueue_script( 'rli-core', $base . 'assets/core.js', array( 'wp-i18n' ), RLI_VERSION, true );
		wp_enqueue_script( 'rli-render', $base . 'assets/render.js', array( 'rli-core', 'rli-barcodes' ), RLI_VERSION, true );
		wp_enqueue_script( 'rli-batches', $base . 'assets/batches.js', array( 'rli-core', 'wp-i18n' ), RLI_VERSION, true );
		wp_enqueue_script( 'rli-app', $base . 'assets/app.js', array( 'rli-render', 'rli-batches' ), RLI_VERSION, true );
		foreach ( array( 'rli-core', 'rli-barcodes', 'rli-render', 'rli-batches', 'rli-app' ) as $handle ) {
			wp_set_script_translations( $handle, 'ramsey-labels-independent', dirname( RLI_FILE ) . '/languages' );
		}
		wp_localize_script( 'rli-app', 'RLI_BOOT', self::bootstrap() );
	}

	/**
	 * Wrap a REST handler with capability, size and error boundaries.
	 *
	 * @param callable $callback Authorized data operation.
	 * @param bool     $admin Require site administrator rights.
	 * @return \Closure REST callback.
	 */
	private static function endpoint( $callback, $admin = false ) {
		return function ( $request ) use ( $callback, $admin ) {
			if ( ! self::allowed() || ( $admin && ! current_user_can( 'manage_options' ) ) ) {
				return new \WP_Error( 'rli_forbidden', __( 'You do not have permission for this action.', 'ramsey-labels-independent' ), array( 'status' => 403 ) );
			}
			if ( strlen( $request->get_body() ) > 2200000 ) {
				return new \WP_Error( 'rli_too_large', __( 'Request exceeds the 2.2 MB limit.', 'ramsey-labels-independent' ), array( 'status' => 413 ) );
			}
			try {
				return rest_ensure_response( call_user_func( $callback, $request ) );
			} catch ( \DomainException $error ) {
				return new \WP_Error( 'rli_conflict', $error->getMessage(), array( 'status' => 409 ) );
			} catch ( \InvalidArgumentException $error ) {
				return new \WP_Error( 'rli_invalid', $error->getMessage(), array( 'status' => 400 ) );
			} catch ( \RuntimeException $error ) {
				return new \WP_Error( 'rli_unavailable', $error->getMessage(), array( 'status' => 403 ) );
			} catch ( \Throwable $error ) {
							do_action( 'ramsey_labels_request_error', get_class( $error ) );
							return new \WP_Error( 'rli_internal', __( 'The request failed. No product or order was changed. Contact your administrator.', 'ramsey-labels-independent' ), array( 'status' => 500 ) );
			}
		};
	}

	/** Register only authenticated REST methods with permission callbacks. */
	public static function routes() {
		$definitions = array(
			array(
				'/bootstrap',
				'GET',
				function () {
					return self::bootstrap();
				},
				false,
			),
			array(
				'/categories',
				'GET',
				static function ( $request ) {
					return Data::categories( $request->get_params() ); },
				false,
			),
			array(
				'/products',
				'GET',
				function ( $r ) {
					return Data::searchProducts( $r->get_params() );
				},
				false,
			),
			array(
				'/orders',
				'GET',
				function ( $r ) {
					return Data::searchOrders( $r->get_params() );
				},
				false,
			),
			array(
				'/order-items/(?P<id>\d+)',
				'GET',
				function ( $r ) {
					return Data::orderItems( $r['id'] );
				},
				false,
			),
			array(
				'/records',
				'POST',
				function ( $r ) {
					return Data::records( (array) $r->get_json_params() );
				},
				false,
			),
			array(
				'/image/(?P<id>\d+)',
				'GET',
				function ( $r ) {
					return Data::image( $r['id'] );
				},
				false,
			),
			array(
				'/library',
				'POST',
				function ( $r ) {
					return Store::save( (array) $r->get_json_params() );
				},
				false,
			),
			array(
				'/jobs',
				'GET',
				function () {
					return Store::jobs();
				},
				false,
			),
			array(
				'/jobs',
				'POST',
				function ( $r ) {
					return Store::updateJob( (array) $r->get_json_params() );
				},
				false,
			),
			array(
				'/migration',
				'GET',
				function () {
					return Migration::inspect();
				},
				true,
			),
			array(
				'/migration',
				'POST',
				function ( $r ) {
					$data = (array) $r->get_json_params();
					$action = isset( $data['action'] ) ? $data['action'] : 'preview';
					if ( 'preview' === $action ) {
						return Migration::plan();
					}
					if ( 'apply' === $action ) {
						return Migration::apply( isset( $data['hash'] ) ? $data['hash'] : '' );
					}
					if ( 'restore' === $action && ! empty( $data['confirmed'] ) ) {
						return array( 'library' => Migration::restore() );
					}
					throw new \InvalidArgumentException( esc_html__( 'Invalid migration action.', 'ramsey-labels-independent' ) );
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

	/**
	 * Add product, coupon and legacy order list links.
	 *
	 * @param array    $actions Existing row links.
	 * @param \WP_Post $post Current row object.
	 * @return array Row links.
	 */
	public static function rowActions( $actions, $post ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- RC8 public callable compatibility.
		if ( ! self::allowed() ) {
			return $actions;
		}
		$source = 'product' === $post->post_type ? 'products' : ( 'shop_coupon' === $post->post_type ? 'coupons' : ( 'shop_order' === $post->post_type ? 'order_items' : '' ) );
		if ( $source ) {
			$actions['rli_labels'] = '<a href="' . esc_url( self::url( $source, array( $post->ID ) ) ) . '">' . esc_html__( 'Print labels', 'ramsey-labels-independent' ) . '</a>';
		}
		return $actions;
	}

	/**
	 * Add a user-label link only for users with list permission.
	 *
	 * @param array    $actions Existing row links.
	 * @param \WP_User $user Current row user.
	 * @return array Row links.
	 */
	public static function userActions( $actions, $user ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- RC8 public callable compatibility.
		if ( self::allowed() && current_user_can( 'list_users' ) ) {
			$actions['rli_labels'] = '<a href="' . esc_url( self::url( 'users', array( $user->ID ) ) ) . '">' . esc_html__( 'Print user label', 'ramsey-labels-independent' ) . '</a>';
		}
		return $actions;
	}

	/**
	 * Add product-category preselection links.
	 *
	 * @param array    $actions Existing term links.
	 * @param \WP_Term $term Current term.
	 * @return array Term links.
	 */
	public static function categoryActions( $actions, $term ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- RC8 public callable compatibility.
		if ( self::allowed() && 'product_cat' === $term->taxonomy ) {
			$actions['rli_labels'] = '<a href="' . esc_url( self::url( '', array(), array( 'rli_categories' => $term->term_id ) ) ) . '">' . esc_html__( 'Product labels', 'ramsey-labels-independent' ) . '</a>';
		}
		return $actions;
	}

	/**
	 * Add a CRUD-backed order-label action for either order store.
	 *
	 * @param array     $actions Existing order actions.
	 * @param \WC_Order $order Current order.
	 * @return array Order actions.
	 */
	public static function orderActions( $actions, $order ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- RC8 public callable compatibility.
		if ( self::allowed() && current_user_can( 'edit_shop_orders' ) ) {
			$actions['rli_labels'] = array(
				'url'    => self::url( 'order_items', array( $order->get_id() ) ),
				'name'   => __( 'Print product labels', 'ramsey-labels-independent' ),
				'action' => 'rli-labels',
			);
		}
		return $actions;
	}

	/**
	 * Render a product-edit workflow link.
	 *
	 * @param \WP_Post $post Current product post.
	 */
	public static function productButton( $post ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- RC8 public callable compatibility.
		if ( self::allowed() && 'product' === $post->post_type ) {
			echo '<p><a class="button" href="' . esc_url( self::url( 'products', array( $post->ID ) ) ) . '">' . esc_html__( 'Ramsey Labels: print product label', 'ramsey-labels-independent' ) . '</a></p>';
		}
	}

	/**
	 * Render a variation-edit workflow link.
	 *
	 * @param int      $loop WooCommerce row index.
	 * @param array    $data WooCommerce row data.
	 * @param \WP_Post $variation Variation post.
	 */
	public static function variationButton( $loop, $data, $variation ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- RC8 public callable compatibility.
		if ( self::allowed() ) {
			echo '<p><a class="button" href="' . esc_url( self::url( 'products', array( $variation->ID ) ) ) . '">' . esc_html__( 'Print variation label', 'ramsey-labels-independent' ) . '</a></p>';
		}
	}

	/** Register legacy and HPOS order sidebars for authorized staff. */
	public static function orderBoxes() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- RC8 public callable compatibility.
		if ( ! self::allowed() || ! current_user_can( 'edit_shop_orders' ) ) {
			return;
		}
		foreach ( array( 'shop_order', 'woocommerce_page_wc-orders' ) as $screen ) {
			add_meta_box( 'rli-order-labels', __( 'Ramsey Labels', 'ramsey-labels-independent' ), array( __CLASS__, 'orderBox' ), $screen, 'side', 'default' );
		}
	}

	/**
	 * Render order/product label links from either editor's object.
	 *
	 * @param \WC_Order|\WP_Post $order_object Current editor object.
	 */
	public static function orderBox( $order_object ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- RC8 public callable compatibility.
		$id = is_object( $order_object ) && method_exists( $order_object, 'get_id' ) ? $order_object->get_id() : ( isset( $order_object->ID ) ? $order_object->ID : 0 );
		if ( ! $id ) {
			return;
		}
		echo '<p><a class="button" href="' . esc_url( self::url( 'order_items', array( $id ) ) ) . '">' . esc_html__( 'Purchased product labels', 'ramsey-labels-independent' ) . '</a></p><p><a class="button" href="' . esc_url( self::url( 'orders', array( $id ) ) ) . '">' . esc_html__( 'Order / shipping label', 'ramsey-labels-independent' ) . '</a></p>';
	}

	/** Render the authorized order-item label-selection column heading. */
	public static function itemHeader() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- RC8 public callable compatibility.
		if ( self::allowed() && current_user_can( 'edit_shop_orders' ) ) {
			echo '<th class="rli-order-item-column">' . esc_html__( 'Label', 'ramsey-labels-independent' ) . '</th>';
		}
	}

	/**
	 * Render a selectable purchased-item checkbox, not an order mutation.
	 *
	 * @param \WC_Product|false $product Associated product.
	 * @param \WC_Order_Item    $item Current item.
	 * @param int               $item_id Current item ID.
	 */
	public static function itemCell( $product, $item, $item_id ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- RC8 public callable compatibility.
		if ( ! self::allowed() || ! current_user_can( 'edit_shop_orders' ) ) {
			return;
		}
		echo '<td class="rli-order-item-column">';
		if ( is_object( $item ) && method_exists( $item, 'get_type' ) && 'line_item' === $item->get_type() ) {
			echo '<input type="checkbox" class="rli-order-item-select" value="' . esc_attr( (string) $item_id ) . '" aria-label="' . esc_attr__( 'Select item for label printing', 'ramsey-labels-independent' ) . '">';
		}
		echo '</td>';
	}

	/**
	 * Render the selected-order-items workflow button.
	 *
	 * @param \WC_Order $order Current order.
	 */
	public static function itemButton( $order ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- RC8 public callable compatibility.
		if ( self::allowed() && current_user_can( 'edit_shop_orders' ) ) {
			echo '<button type="button" class="button rli-print-order-items" data-url="' . esc_url( self::url( 'order_items', array( $order->get_id() ) ) ) . '">' . esc_html__( 'Print selected product labels', 'ramsey-labels-independent' ) . '</button>';
		}
	}

	/**
	 * Register source-specific list-table bulk actions.
	 *
	 * @param array  $actions Existing actions.
	 * @param string $screen List-table screen ID.
	 * @return array Bulk actions.
	 */
	public static function bulkActions( $actions, $screen ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- RC8 public callable compatibility.
		if ( ! self::allowed() ) {
			return $actions;
		}
		if ( 'edit-product' === $screen ) {
			$actions['rli_products'] = __( 'Ramsey: print product labels', 'ramsey-labels-independent' );
		} elseif ( 'edit-shop_coupon' === $screen ) {
			$actions['rli_coupons'] = __( 'Ramsey: print coupon labels', 'ramsey-labels-independent' );
		} elseif ( 'users' === $screen && current_user_can( 'list_users' ) ) {
			$actions['rli_users'] = __( 'Ramsey: print user labels', 'ramsey-labels-independent' );
		} else {
			$actions['rli_order_items'] = __( 'Ramsey: purchased product labels', 'ramsey-labels-independent' );
			$actions['rli_orders']      = __( 'Ramsey: order / shipping labels', 'ramsey-labels-independent' );
		}
		return $actions;
	}

	/**
	 * Hand off selected IDs after WordPress verifies the list-table bulk nonce.
	 *
	 * @param string $redirect Default redirect URL.
	 * @param string $action Core-validated action name.
	 * @param array  $ids Selected object IDs, validated again here.
	 * @return string Current-user-scoped workflow URL.
	 */
	public static function bulkRedirect( $redirect, $action, $ids ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- RC8 public callable compatibility.
		$map = array(
			'rli_products'    => 'products',
			'rli_order_items' => 'order_items',
			'rli_orders'      => 'orders',
			'rli_coupons'     => 'coupons',
			'rli_users'       => 'users',
		);
		if ( ! isset( $map[ $action ] ) || ! self::allowed() ) {
			return $redirect;
		}
		try {
			$ids = Data::ids( $ids, Schema::MAX_RECORDS );
			if ( strlen( wp_json_encode( $ids ) ) > 2000000 ) {
				wp_die( esc_html__( 'This bulk selection exceeds the safe handoff size. Split the selection into smaller pages.', 'ramsey-labels-independent' ) );
			}
		} catch ( \Throwable $error ) {
			wp_die( esc_html( $error->getMessage() ) );
		}
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
