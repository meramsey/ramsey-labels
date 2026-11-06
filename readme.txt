=== Ramsey Labels for WooCommerce ===
Contributors: meramsey
Tags: woocommerce, labels, barcode, qr code, printing
Requires at least: 6.0.3
Tested up to: 7.1
Requires PHP: 7.4.32
Requires Plugins: woocommerce
Stable tag: 1.0.0-rc.9
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html

Design product labels with SKU barcodes and QR codes. Preview thermal or sheet batches, print in your browser, or download a PDF.

== Description ==

An independent, free label designer for WooCommerce. Search products by name or SKU, select a category, add products to a print queue, and preview the complete batch.

The default 50.8 x 25.4 mm card places a QR code on the left, SKU below, and price and name on the right. QR payloads use the SKU, with product ID as fallback, not the product permalink.

Visual designs support text, images, barcodes and shapes. Save print profiles, export/import JSON libraries, and use CSV for synthetic or alternate data. Eight barcode encoders are included: CODE128, CODE39, EAN-13, EAN-8, UPC-A, UPC-E, QR and Data Matrix. Retail formats require numeric values and valid checksums.

This is a release candidate, not a WordPress.org-approved release. Tested combinations include WordPress 6.0.3 / PHP 7.4 / WooCommerce 7.0.1 and WordPress 7.1.4 / PHP 8.3 or 8.5 / WooCommerce 11.2.2. See the repository test report for exact patch versions and outstanding release gates. Hardware and live WCPOS acceptance are pending. No commercial-plugin API equivalence is promised.

Privacy: no telemetry, external scripts, fonts or barcode services. Product thumbnails use your store's configured media URLs. External label images require session consent before being requested by the renderer. Customer/order data is accessed only by authorized staff. Saved jobs are per-user; downloaded labels and CSV/PDF files may contain personal data. Uninstall preserves configuration and jobs by default.

== Installation ==

1. Install and activate WooCommerce on an isolated test site.
2. Upload the RC ZIP through Plugins > Add New and activate it.
3. Open WooCommerce > Ramsey Labels and choose a profile.
4. Open Products & orders, search, select results, and add them to the job.
5. Open Preview / print. Use 100% scale, no margins or headers/footers.

For RC8 upgrades, retain ramsey-labels-independent/ramsey-labels-independent.php. Do not install a second copy under a new folder. Saved option names and hooks are unchanged. Read docs/migration.md before changing the public slug.

== Frequently Asked Questions ==

= Does the QR code contain a product URL? =
The default QR card encodes the exact SKU, including hyphens, or the product ID when the SKU is empty. Custom expressions may deliberately encode other data.

= Is this certified for WCPOS or my printer? =
No. Exact SKU payloads are tested with independent software decoders. Scanner configuration, WCPOS lookup and physical media alignment still require acceptance testing. UPC readers may expand or prefix retail codes.

= What are the batch limits? =
At most 1,000 records and 2,000 selected labels per rendered job, 80 elements per design, 16 megapixels per label and 120 MB of encoded preview images. Split larger jobs.

= Can I download PDFs? =
Yes. PDFs embed lossless raster labels at the profile DPI; they are not vector labels. Browser export needs modern Canvas, Blob and TextEncoder APIs.

= Will uninstall delete settings? =
No. An administrator must explicitly set RLI_PURGE_ON_UNINSTALL to true before uninstall to remove this plugin's stored library, migration backup and saved jobs. Other plugin settings, products and orders are never removed.

== Screenshots ==

1. Planned: synthetic Twinkle Light Earrings batch with SKU RRA-726474. Directory artwork is not yet submitted.

== Changelog ==

= 1.0.0-rc.9 =
* Add isolated automated tests, deterministic packaging and release documentation.
* Repair plain-permalink REST search, attachment image resolution and stale previews.
* Harden imported CSS and external image consent.
* Preserve internal RC8 installation identifiers and saved settings.

== Upgrade Notice ==

= 1.0.0-rc.9 =
Release candidate for isolated testing only. Back up settings, retain the existing plugin folder, and review the outstanding publication gates.
