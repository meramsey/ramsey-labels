# Compatibility

On 2026-11-06/07 the authoritative WordPress core API reported 7.1.4; the WordPress.org
WooCommerce plugin API reported 11.2.2. PHP releases API reported 8.5.12 current stable.
The Plugin Information API returned 404 for the proposed `ramsey-labels` slug at that check.
These are point-in-time facts, not a reservation or a perpetual compatibility claim.

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

RC10 explicitly exercises both current order stores, then retains the HPOS compatibility declaration.
WooCommerce absence boots without a fatal and displays the admin notice. Single-site RC9 upgrade and
network activation/site-isolation/purge run on the 7.1.4 / 8.3.36 stack; RC8/RC9 custom libraries
round-trip on all PHP matrix entries.

Chromium, Firefox and Playwright WebKit Linux engines pass the current browser suite on the current
8.3 test site. Playwright WebKit is not a substitute for Safari on macOS/iOS. Canvas, Blob,
TextEncoder, file-stream PDF fallback and `showSaveFilePicker` paths are used; modern browser APIs
are required. Axe WCAG 2.1 A/AA reports no violations in design, product search, print preview,
and saved-job dialogs; keyboard/RTL scenarios are automated. Manual screen-reader and assistive-
technology testing is still needed. Real WCPOS, POS, scanner and printer acceptance require hardware.
Physical printer/driver/media/scanner combinations are unverified.
