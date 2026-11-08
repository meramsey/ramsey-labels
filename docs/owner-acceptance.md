# RC11 owner acceptance checklist — pending physical/manual execution

Use an isolated staging/test WooCommerce site, not production. Make one synthetic published
product with **SKU `RRA-726474`** and an owner-controlled test WCPOS account. Record plugin/theme,
WordPress/WooCommerce/PHP versions, operating system, browser, printer make/model/driver, stock
manufacturer/code, scale settings, and photographs of the first test sheets. Do not change product
SKU, stock, order data or printer defaults as part of acceptance.

## 2 × 1 inch thermal workflow

- [ ] Select or create an exact 50.8 × 25.4 mm thermal/roll profile; confirm the profile and PDF media metadata show 144 × 72 pt.
- [ ] Apply the QR-left / product-name-and-price / SKU-below design; verify the QR and printed human-readable SKU both show `RRA-726474`.
- [ ] Use Products & orders to search by exact SKU; check the product name, SKU, price and thumbnail.
- [ ] Select the synthetic product through the row checkbox and WooCommerce Products bulk action. Confirm one queue entry appears per source selection and no catalog fields change.
- [ ] Select the product category; confirm category filtering and returned product thumbnail.
- [ ] Confirm the print-queue row has the same thumbnail/name/SKU as the search result.
- [ ] Confirm on-screen preview is generated automatically and displays all active-segment pages. For a segmented queue, navigate every segment; **Export full PDF** should contain all selected labels, while browser Print prints the currently previewed segment.
- [ ] Set quantity to 3. Verify exactly three copies in the full PDF and three scans (or the chosen duplicate policy) from a hardware print.
- [ ] Download full-label SVG and PDF. Independently scan a label and use the exact SKU in WCPOS product lookup; confirm the correct synthetic product opens and that stock/order data remains unchanged.
- [ ] Print one label at 100% / actual size, no fit-to-page scaling, and record measured label dimensions and feed/offset error. Adjust calibration offsets; reprint and record the result.

## A4 sheet workflow

- [ ] Select an exact sheet product/code matching one of the source-backed Avery layouts in `docs/sheet-presets.md` (or configure a generic layout from that manufacturer's specification). Record the paper/label code; do not choose by count alone.
- [ ] Check the preset's A4 page size, label width/height, rows/columns, pitch, margins, orientation and first/last position in the admin geometry.
- [ ] Download the calibration SVG. Print at 100% with no browser or driver scaling, borders, headers or footers. Measure top/left margins, horizontal/vertical pitch and first/last label coordinates against the stock template.
- [ ] Queue the synthetic SKU from search and from bulk selection; verify matching product and queue thumbnails.
- [ ] Confirm automatic preview pages, complete vertical segment navigation, and full-batch PDF page count. Use a batch crossing a page boundary and a nonzero start slot.
- [ ] Print one sheet on plain paper, overlay it on the blank stock, inspect label alignment and feed. Only after alignment is confirmed, print adhesive stock.
- [ ] Scan the QR/barcode from a physical label into WCPOS and verify exact SKU lookup. Check multi-quantity rows and verify the expected count.

## Sign-off

| Field | Owner entry |
|---|---|
| Test site / date / operator | Pending |
| Browser / OS / versions | Pending |
| WCPOS / scanner model and result | Pending |
| Thermal printer, label code, measured alignment | Pending |
| A4 printer, stock code, measured pitch/margins | Pending |
| Complete-PDF page/label counts | Pending |
| Product SKU/stock unchanged | Pending |
| Outstanding defects / explicit acceptance | Pending |

No printer, scanner, WCPOS, screen-reader operator, macOS Safari or Windows physical acceptance is
claimed until this checklist is completed and signed by the owner.
