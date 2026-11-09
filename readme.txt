=== Ramsey Labels for WooCommerce ===
Contributors: meramsey
Tags: woocommerce, barcode, product labels, qr code, label printing
Requires at least: 6.0.3
Tested up to: 7.1
Requires PHP: 7.4.32
Requires Plugins: woocommerce
Stable tag: 1.0.0-rc.11
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html

Free, open-source WooCommerce barcode and QR label printing with visual design, bulk queues, thermal/A4 sheets, and PDF/SVG export.

== Description ==

Ramsey Labels is a free WooCommerce label designer for product, variation, order, and custom-data
workflows. Search by name or SKU, filter categories, select products from WooCommerce bulk actions,
check real product thumbnails in a print queue, and print or export complete batches.

There are no license keys, premium feature gates, telemetry, remote barcode services, or artificial
total-print quotas. Resource bounds protect browsers and servers; large jobs use paged lookups,
bounded rendering segments, and streamed PDF output.

Features include:

* Visual designer with text, images, barcode elements, shapes, alignment, rotation, conditions, saved profiles, and templates.
* Product/variation SKU search, category filtering, product bulk actions, queue quantities, sorting, and image fallback from variations to parents.
* Default 50.8 × 25.4 mm / 2 × 1 inch QR-left/SKU-below card. The default QR payload is the exact SKU, falling back to product ID—not a permalink.
* Thermal, A4, Letter, P4, custom sheet, verified Avery A4 presets, start slots, offsets, and calibration SVG.
* CODE128, CODE39, EAN-13, EAN-8, UPC-A, UPC-E, QR Code, and Data Matrix ECC200.
* PDF, PNG, barcode SVG, and full-label SVG export. Full-label SVG uses vector text/shapes/barcodes and may embed raster product imagery.
* CSV queues, JSON library import/export, order items, orders, coupons, users, posts, and permitted custom fields/attributes.

GS1-128 support is limited to the documented application-identifier subset. It is not full GS1
compliance or scanner certification. Manufacturer sheet preset support is limited to the documented
source-backed layouts; generic grids are not manufacturer compatibility claims.

== Installation ==

1. Back up an existing test/staging site and activate WooCommerce.
2. Install the appropriate Ramsey Labels ZIP through Plugins > Add New.
3. For RC8/RC9/RC10 in-place updates, use the `ramsey-labels-independent` package.
4. The separate `ramsey-labels` directory candidate is a guarded migration path. Never activate both copies at once.
5. Open WooCommerce > Ramsey Labels, choose a profile, add products, preview, and test-print at actual size.

== Frequently Asked Questions ==

= Is Ramsey Labels free? =

Yes. It is GPL-2.0-or-later with no license keys, paid tiers, or artificial total-print quota.

= Does the QR code contain a product URL? =

No by default. The QR card encodes the exact SKU, including hyphens, or the product ID when the SKU
is empty. Custom expressions can deliberately encode other data.

= Are printers, scanners, or WCPOS certified? =

No. Barcode payloads are software-tested with independent decoders. Scanner configuration, WCPOS
lookup, printer drivers, feed alignment, and physical media require acceptance testing.

= What are the batch limits? =

Resource budgets include a 2.2 MB library, 8 MB live browser queue, 2 MB saved jobs per user,
4,096 elements/design, 16 megapixels/label, and 2,000 labels per in-memory render segment. Complete
PDF/print batches are not capped; they are paged and segmented safely.

= Which sheet presets are verified? =

Avery L7159, L7160, L7162, L7163, L7164, and L7651 A4 geometries are source-backed. Other counts
are generic configurable grids; enter dimensions, margins, pitch, and orientation from your stock.

= Will uninstall delete settings? =

No. Settings and private jobs are retained unless an administrator explicitly sets
`RLI_PURGE_ON_UNINSTALL` to true before uninstall.

== Screenshots ==

1. Ramsey Labels main visual designer using synthetic data.
2. Product SKU search with a loaded WooCommerce attachment thumbnail.
3. Print queue with product image, SKU, price, quantity, and sorting.
4. Vertically stacked thermal preview and PDF controls.
5. A4 sheet preset and calibration controls.
6. Full-label SVG export controls.

== Changelog ==

= 1.0.0-rc.11 =

* Full-label SVG export, source-backed sheet presets, calibration SVG, queue sorting, multisite job quarantine, and GS1-128 subset documentation.
* WooCommerce attachment thumbnail regression coverage for simple products, variations, parent fallback, bulk selection, queue sorting, saved jobs, and missing-image placeholders.
* Release supply-chain preparation, SBOM generation, security scanning policy, and reproducible artifact verification.

= 1.0.0-rc.10 =

* Streamed PDF batches, category pagination, privacy controls, multisite isolation, GS1 subset, and public-directory migration candidate.

== Upgrade Notice ==

= 1.0.0-rc.11 =

Release candidate only. Back up settings before installing. Do not activate the public-directory
candidate alongside the legacy copy. Hardware/POS acceptance and owner publication approval remain
required.
