Ramsey Labels Independent — test build 1.0.0-rc.1
================================================
Independent WooCommerce label editor and print engine.

Installation
1. Back up your WordPress database.
2. Install on a staging/test site with WooCommerce active.
3. Plugins > Add New > Upload Plugin > select ZIP > Activate.
4. WooCommerce > Ramsey Labels. Choose a print profile.
5. Design: drag elements, edit positions and barcode format; save settings.
6. Products & orders: search products/orders, select rows, or enter direct IDs; import CSV for custom data.
7. Preview / print: generate preview, browser-print or export PDF.
8. On the print dialog, use actual size (100%), zero margins, and no headers/footers. Scan a sample barcode before using it in inventory.

Features
- Products, variations, order items, orders, coupons, users, and post record sources
- Independent CODE128, CODE39, EAN-8, EAN-13, UPC-A, UPC-E, QR, and Data Matrix encoders
- Visual positioning, editable field expressions, images, basic shapes, text, HTML template mode
- Roll and multi-column sheet layouts, margin/spacing calibration, skipped initial sheet slots
- Saved profiles and design templates; JSON import/export, CSV import/export
- Browser printing and raster-embedded PDF export
- Legacy migration preview with backup/restore; no original-plugin writes
- WooCommerce product/order list actions and bulk-action integration

Important limitations
- This is an independent implementation, NOT a binary/API clone of the commercial plugin.
- Existing commercial plugin extensions, internal APIs, and custom scripts may not work.
- The plugin has not been tested against a live WooCommerce install or a physical printer.
- The first browser print may require adjusting driver settings.
- CSV imports are browser-local until printed or exported; customer data should be protected.
- The PDF embeds lossless label rasters; it does not embed vector barcodes.
- Test installation and backups are strongly recommended before any production usage.

Data safety
The plugin does not change product SKUs, inventory, prices, or orders.
It stores its own options and per-user jobs, separate from the vendor plugin.

RC3: Product search/category results show medium-sized thumbnails with variation-parent fallback, name, SKU and price.

RC4: New installs default to a 2x1-inch card-style QR label: QR on the left, SKU centered below, price and name on the right. A named template is included for existing installations. Saved profile designs are not overwritten. The QR continues to encode SKU (fallback product ID) for WCPOS.

RC5: Pressing Enter in the product/order search input (or category selector) executes the same search as clicking Search and resets pagination to page 1. Supports IME composition and error reporting.

RC6: Show every generated page in batch print preview instead of limiting the visible preview to three pages. Print and PDF paths are unchanged.

RC7: Opening Preview / print automatically generates an uncached preview, shows all pages in a vertical stack, and displays WooCommerce product thumbnails, names, SKUs, and prices in the queued print job. Barcode and printing engines unchanged.

RC8: Registers missing built-in QR card template for existing installations without overwriting user profiles. Save settings to persist it.
