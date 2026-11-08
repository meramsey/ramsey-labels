=== Ramsey Labels for WooCommerce ===
Contributors: meramsey
Tags: woocommerce, labels, barcode, qr code, printing
Requires at least: 6.0.3
Tested up to: 7.1
Requires PHP: 7.4.32
Requires Plugins: woocommerce
Stable tag: 1.0.0-rc.11
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html

Design product labels with SKU barcodes and QR codes. Preview thermal or sheet batches, print in your browser, or download a PDF.

== Description ==

An independent, free label designer for WooCommerce. Search products by name or SKU, select a category, add products to a print queue, and preview every page in the bounded active segment. Segment navigation covers the complete job; streamed PDF contains every label.

The default 50.8 x 25.4 mm card places a QR code on the left, SKU below, and price and name on the right. QR payloads use the SKU, with product ID as fallback, not the product permalink.

Visual designs support text, images, barcodes and shapes. Save print profiles, export/import JSON libraries, and use CSV for synthetic or alternate data. Eight barcode encoders are included: CODE128, CODE39, EAN-13, EAN-8, UPC-A, UPC-E, QR and Data Matrix. Retail formats require numeric values and valid checksums.

This engineering release candidate is not approved for directory publication or production. Tested combinations include WordPress 6.0.3 / PHP 7.4 / WooCommerce 7.0.1 and WordPress 7.1.4 / PHP 8.3 or 8.5 / WooCommerce 11.2.2. Older PHP 7.4 patch releases were not tested and PHP 7.4 is end-of-life. Exact tested patches and remaining gates are documented in the repository. Hardware and live WCPOS acceptance are pending. No commercial-plugin API equivalence is promised.

Privacy: no telemetry, external scripts, fonts or barcode services. Product thumbnails use your store's configured media URLs. External label images require session consent before being requested by the renderer. Customer/order data is accessed only by authorized staff. Saved jobs are per-user; downloaded labels and CSV/PDF files may contain personal data. Uninstall preserves configuration and jobs by default.

== Installation ==

1. Install and activate WooCommerce on an isolated test site.
2. Upload the RC ZIP through Plugins > Add New and activate it.
3. Open WooCommerce > Ramsey Labels and choose a profile.
4. Open Products & orders, search, select results, and add them to the job.
5. Open Preview / print. Inspect all pages with segment navigation; use Export full PDF for the entire job. Print the active segment at 100% scale, no margins or headers/footers.

The in-place RC11 ZIP retains the RC8/RC9 basename ramsey-labels-independent/ramsey-labels-independent.php and saved option names. A separate prospective ramsey-labels directory ZIP has a tested, guarded migration path; do not keep both copies active. Back up first. On multisite, use Network Admin > Settings > Ramsey Labels job quarantine to explicitly dry-run, assign, and if necessary rollback legacy global jobs. The plugin never guesses a site owner.

== Frequently Asked Questions ==

= Does the QR code contain a product URL? =
The default QR card encodes the exact SKU, including hyphens, or the product ID when the SKU is empty. Custom expressions may deliberately encode other data. GS1-128 validates a documented common AI subset; this does not claim every GS1 identifier family or extension.

= Is this certified for WCPOS or my printer? =
No. Exact SKU payloads are tested with independent software decoders. Scanner configuration, WCPOS lookup and physical media alignment still require acceptance testing. UPC readers may expand or prefix retail codes.

= What are the batch limits? =
Resource budgets are based on a 2.2 MB request, 8 MB live browser queue, 2 MB per-user saved jobs, 4,096 design elements, 16 megapixels per label, and at most 2,000 labels per in-memory rendering segment. Complete print/PDF label counts are not capped; oversized queues use paged lookups and bounded PDF segments.

= Can I migrate from RC9 to the proposed WordPress.org directory slug? =
The source includes a separate candidate archive and automated RC9-to-directory upgrade test. The slug has not been reserved, the package has not been submitted, and owner branding/license approval remains pending. On multisite, assign legacy global jobs to a site before exposing them; the plugin intentionally does not guess.

= Which sheet templates are verified? =
Six named Avery A4 layouts are source-backed (L7159, L7160, L7162, L7163, L7164, L7651). Other requested counts are generic grids only; enter the actual stock dimensions, margins and pitch. See docs/sheet-presets.md and docs/gs1-support-matrix.md in the source repository. No printer model is hardware-certified.

= Can I download PDFs? =
Yes. Full-label SVG keeps text, shapes and barcodes vector and embeds permitted product images as raster PNGs. PDFs embed lossless raster labels at the profile DPI. Browser export needs modern Canvas, Blob and TextEncoder APIs.

= Will uninstall delete settings? =
No. An administrator must explicitly set RLI_PURGE_ON_UNINSTALL to true before uninstall to remove this plugin's stored library, migration backup and saved jobs. Other plugin settings, products and orders are never removed.

== Screenshots ==

1. Designer showing the synthetic 50.8 x 25.4 mm QR card (software preview, not a hardware print).
2. Product search and label queue using synthetic Twinkle Light Earrings (SKU RRA-726474).
3. Vertically stacked synthetic batch preview and full-batch PDF controls.

== Changelog ==

= 1.0.0-rc.11 =
* Add full-label SVG export with vector text, shape and barcode layers; bounded raster image embedding; safe local resource embedding; and independent parser/raster/decoder verification.
* Add source-verified Avery A4 templates for L7159, L7160, L7162, L7163, L7164 and L7651; provide generic count grids for other requested quantities without claiming manufacturer compatibility.
* Add alphabetical name and SKU ascending/descending sorting with original-selection restoration and print/preview order parity.
* Document the exact GS1-128 common-AI subset, FNC1 handling, check digits, dates, GTIN input normalization and unsupported symbologies.
* Add network-administrator-only quarantine inspection, dry-run, explicit site assignment, audit trail and fingerprint-checked rollback for legacy global multisite jobs.
* Clarify stock/on-hand quantity behavior for unmanaged stock, zero inventory and negative backorder inventory.
* Add printable, dimensioned calibration-sheet SVG exports and geometry/browser/PDF regression coverage.

= 1.0.0-rc.10 =
* Stream complete PDF batches in bounded segments, add PNG/full-label and vector-barcode SVG downloads, and remove total batch-label quota.
* Add category pagination, resource-bounded record pages, developer hooks/API docs, queue reordering and private saved-job controls.
* Add privacy export/erasure, concurrent job-operation leases, multisite job isolation and explicit safe purge.
* Add scoped GS1-128 support for documented common AIs; other GS1 families are not claimed.
* Add public directory-slug migration package with dual-runtime guard; legacy RC8/RC9 in-place package remains separate.
* Complete POT extraction, WordPress JavaScript translations, RTL, keyboard alternatives, axe/WPCS/PHPStan and cross-browser test gates.
* Add verified RC9 and genuine RC8 migration tests; report incomplete competitive features transparently.

== Upgrade Notice ==

= 1.0.0-rc.11 =
Engineering candidate only. Back up settings before installing. Do not install the public-slug candidate beside the legacy copy and leave both active. Owner rights, licensing, branding and directory submission approvals are pending.
