# Security and privacy design

REST permissions require manage_woocommerce or manage_options, then source-specific rights
(edit_products, edit_shop_orders, edit_shop_coupons, list_users, or edit_post).
Cookie authentication relies on WordPress REST nonce verification; non-cookie application
password authentication is handled by core. Migration additionally requires manage_options.
No anonymous administrative endpoint is intended.

Bulk links carry no write action. WordPress validates the list-table bulk nonce; the plugin
stores only selected IDs in a cryptographic current-user-scoped transient for ten minutes.
Direct query preselection is untrusted and revalidated; it cannot change product/order data.

JSON is schema-validated with bounded collections. No template PHP or JavaScript is executed.
HTML uses a tag/attribute allowlist and KSES; client sanitization is defense in depth.
CSS escapes, at-rules and URL-bearing functions are rejected. External image URLs may
disclose IP address; renderer consent is session-scoped. Imported markup stays inert until
images have been consented to and converted to local rasters. Store-configured product
thumbnail URLs retain normal WooCommerce behavior and may be externally hosted.

Server image reads require readable attachments inside realpath(uploads), bounded size and
recognized raster MIME. They do not fetch image URLs server-side. CSV formula prefixes are
escaped on export and restored only using the plugin's explicit round-trip marker.
Saved jobs require privacy acknowledgement and are user-meta scoped; they are not encrypted.
Admins, database operators and backups may access them. Downloads remain the user's responsibility.

Uninstall keeps data unless an administrator explicitly enables purge. The current network
purge path is inherited and not yet tested at multisite scale. No telemetry or remote runtime
libraries are included. See security-audit.md for controls, findings and unverified cases.
