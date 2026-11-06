# Compatibility

Current authoritative APIs were checked during this run: WordPress 7.1.4 and WooCommerce
11.2.2 and PHP 8.5.12 were reported as current stable. Actual local execution results belong in
release-readiness.md; do not infer support solely from metadata or stubs.

RC8 declared WordPress 6.0 and PHP 7.4. The candidate raises the WordPress floor to the
actually tested 6.0.3 and adds WooCommerce 7.0.1 minimum metadata. The PHP floor is
7.4.32 (Apache), with CLI integration on 7.4.33. Older patch versions, PHP 8.0/8.1/8.2/8.4 and intermediate
WordPress/WooCommerce combinations were not exercised. EOL software is tested only
for regression/migration coverage, not recommended for new production installations.
PHPStan uses WordPress/WooCommerce stubs, which are not runtime compatibility tests.

| WordPress | PHP | WooCommerce | Order storage | Evidence |
|---|---|---|---|---|
| 6.0.3 | 7.4.33 CLI / 7.4.32 Apache | 7.0.1 | Legacy | Integration, Chrome E2E and genuine RC8 upgrade |
| 7.1.4 | 8.3.35 CLI / 8.3.36 Apache | 11.2.2 | Legacy | Integration and browser suite |
| 7.1.4 | 8.3.35 CLI / 8.3.36 Apache | 11.2.2 | HPOS | Integration validates actual datastore mode |
| 7.1.4 | 8.5.12 CLI and Apache | 11.2.2 | Legacy and HPOS | Integration, Chrome E2E and genuine RC8 upgrade |

The HPOS declaration inherited from RC8 is retained after exercising both current order stores.
Missing WooCommerce boots without a fatal and displays the admin notice in the lifecycle test.
Modern browser Canvas, Promise, TextEncoder, Blob and optional CompressionStream are used.
Firefox, Safari, comprehensive RTL/accessibility, translations and real WCPOS acceptance require further evidence.
Physical printer/driver/media/scanner combinations are unverified.
