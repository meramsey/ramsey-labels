# Competitive feature matrix

**Research checked 2026-11-06 UTC.** No competitor source, binaries, templates or images were
used. This is a behavior comparison based only on official public descriptions. The two supplied
URLs refer to the same UKR Solution plugin/product family, not independent competitors. The
WordPress.org listing is 4.0.3; the vendor landing page mixes Basic/Business/Premium tiers and
older/free-versus-premium wording. Where statements conflict, both are noted; purchase-specific
entitlements are not inferred.

Sources:
- A4 Barcode Generator listing/FAQ: https://wordpress.org/plugins/a4-barcode-generator/
- UKR Solution product FAQ/API: https://www.ukrsolution.com/Wordpress/Print-Barcode-Labels-for-WooCommerce-Products#faq
- Product's public development API reference: same vendor page, “PHP API”, “JavaScript API”, and “afterRender” sections.

“Verified here” means the named local automated test passed. It does not claim hardware,
third-party POS, or undocumented competitor interoperability. The complete RC11 command evidence
is generated in `docs/evidence/rc11-verification.json` after final RC11 artifact verification.

| Competitor claim / tier | Ramsey implementation / gap | Required independent implementation | Automated evidence | Status |
|---|---|---|---|---|
| Multiple text, image, shape and barcode elements; competitor PRO tiering differs by page | Unlimited templates within one 2.2 MB validated library; 4,096 bounded elements/design; multiple local text/image/shape/barcode elements | Keep all design functions free; byte/pixel budgets protect site resources | Schema bounds, template validation, multi-barcode independent decode, malicious markup E2E | Implemented within documented byte/pixel budgets |
| Unlimited saved custom label templates (vendor Business/Premium; WP listing mentions PRO) | No template-count quota; 2.2 MB validated library budget, 2 MB per-user job budget | No paid gates or license checks | Save/import/export tests; JSON replacement E2E; schema/byte-budget tests | Implemented within explicit resource budgets |
| WooCommerce custom fields and attributes | Explicit product/parent/order/item/user/post meta, taxonomy and attribute expressions; credential-like keys rejected; user-meta access requires edit_user | Document field grammar and privacy safeguards | Integration CRUD and malicious metadata tests | Implemented; unusual extension field behavior varies |
| Product variations, single or all variations | Parent/variations/both expansion; exact variation SKU/image fallback | Large variation sets remain bounded by request/document budgets | Variation SKU/CRUD integration; search E2E | Implemented |
| Inventory-driven quantities | One/copies, managed stock or order quantity; unmanaged stock defaults to one-per-product × copies; negative backordered on-hand stock yields zero stock labels with warning; negative managed stock without backorders fails closed | Keep physical on-hand counts distinct from allowed backorders; do not mutate stock | 99-assertion WooCommerce integration fixtures cover managed/unmanaged/negative-backorder cases | Implemented with the documented physical on-hand policy |
| Order and shipping labels, all/specific order items | WooCommerce CRUD order, address, item and purchased-quantity fields; item selection | Avoid direct HPOS/legacy post assumptions | Both order stores, selected items and browser tests | Implemented |
| User/customer and coupon labels | Capability-gated sources, custom user fields require edit_user; privacy export/eraser | Data minimization, consent and PII handling | Least-privilege integration; core privacy export/erase tests | Implemented; policy/manual workflow review pending |
| A4, Letter, P4, custom sheet, thermal/roll | Roll geometry, A4/Letter/P4, arbitrary dimensions, rows/columns/gaps/margins/offsets/flow | Device-independent CSS/PDF, no brand compatibility claims | A4 65-label sheet, 131 labels/3-page PDF, roll 5-page media test | Implemented; physical alignment untested |
| Presets for 12/14/16/21/24/40/44/56/65/120/189/230/324 labels | Source-verified Avery A4 L7164 (12), L7163 (14), L7162 (16), L7160 (21), L7159 (24), L7651 (65); generic count-only grid starters for all requested counts; Letter, P4 and custom paper options | Manufacturer alignment asserted only for the six source-linked products; generic grids require actual dimensions, pitch and margins from the user's stock manufacturer | Manufacturer Word templates inspected; six preset geometry/PDF tests; unit vectors cover every requested generic count | Six manufacturer presets verified; 40/44/56/120/189/230/324 are generic layouts with no stock compatibility claim |
| Calibration and margins/offsets | X/Y offsets, skip slots, independent margins/gaps/pitches, row/column flow; downloadable actual-size calibration SVG with centers and skipped positions | Test actual media, driver and feed on target printer | Unit geometry, exact source preset positions, SVG parser/rasterizer, PDF media sizes and calibration SVG tests | Software geometry verified; physical feed/alignment needs owner hardware acceptance |
| CODE128, CODE39, UPC-A/E, EAN-13/8, GTIN, GS1 family, Data Matrix, QR | CODE128/CODE39/EAN/UPC/QR/Data Matrix encoders; GS1-128 AIs 00/01/02/10/11/15/17/21/30/37; normalized parenthesized GTIN input; other GS1 families not claimed | Add AIs only from normative GS1 specifications and checked vectors | Independent ZXing/ZBar; GS1 FNC1/variable separators, AI/date/GTIN normalization and rejection vectors | Exact supported/partial/unsupported list in `docs/gs1-support-matrix.md`; no GS1 certification |
| SVG vector and PDF; competitor says high-quality SVG labels | Full-label SVG uses vector text/barcode/shape geometry and embeds product imagery as PNG; individual barcode SVG remains; multi-page raster PDF, streamed PDF | Keep all barcode/data elements vector, embed only bounded raster images; no external resource references | Independent XML parse, ImageMagick rasterization, geometry/PNG comparison and ZXing/ZBar decode | Implemented as mixed vector/raster SVG; it is not an all-vector asset when product images are present |
| Hide barcode and print price tags | Element visibility/conditions allow text-only profiles | Accessible state and print verification | Designer/schema and E2E tests | Implemented |
| Label sorting, manual/alphabetical | Stable Unicode-aware product-name A–Z/Z–A and SKU ascending/descending; keyboard Move up/down; original-selection-order restore | Preserve variation IDs, quantities, selected state and duplicate count | Stable/fallback unit vectors; E2E confirms queue and preview order match | Implemented; PDF consumes the same ordered queue |
| Currency symbol toggle/format | WooCommerce wc_price and display tax behavior; per-profile Show currency symbol switch changes rendered currency-bearing price fields only | Preserve raw Woo price and store currency | Synthetic `$12.00` symbol present/hidden canvas E2E and CRUD integration | Implemented; disabled removes the configured store symbol, never reformats numeric amount |
| Multiple barcodes on one label (competitor PRO) | Designer supports independent barcodes per label | Independent element renderer and density diagnostics | Browser renders side-by-side CODE128 and QR and independently decodes both payloads | Implemented |
| Manual arbitrary/custom labels | CSV, user-controlled manual records and public JS queue API | Validate all external records as scalar, bounded data | Unit external-object rejection; PHP `rli_field_value` hook and JS queue API tests; CSV formula round trip | Implemented |
| Logo/product image and parent-image fallback | Local attachment and product images; external image transfer consent, byte/pixel limits | Raster-only imports, path confinement, avoid automatic private-network requests | Attachment and declined-remote browser tests | Implemented |
| GTIN, order IDs, SKU and custom barcode payloads | SKU exact payload/fallback ID default QR; field expressions support GTIN and order identifiers | Do not silently encode permalink in default POS QR | Exact RRA-726474 independent QR/PDF decode | Implemented |
| Developer PHP/JS APIs, afterRender, third-party data sources | RC8-compatible `rli_field_value`/`rli_records`; `window.RamseyLabels` queue/export/sort/preset/segment methods; `ramsey-labels:after-render` | Maintain capability boundary and scalar/byte budgets | PHP hook integration, JS queue/sort/export API and render-event tests | Implemented; independent third-party adopter validation remains |
| Bulk operations/categories | WP product bulk actions, row action, category search and paginated category/product lookups | Nonce-verified WP bulk handoff, REST capability checks | 301-product catalog across 11 pages; all 301 IDs transferred; 101-category/two-page lookup | Implemented; very large production catalogs still depend on server/database resources |
| Browser/POS compatibility claims | No broad POS or all-scanner claim; exact SKU payloads for lookup | Decoder evidence plus real scanner/POS acceptance before compatibility badge | Eight format independent decoder tests and rendered SKU round trip | Software verified; physical WCPOS/POS pending |
| High-volume performance | Paged DB/category results and queue UI; 100k-label arithmetic segmentation; decoded-image, encoded-byte and symbol-cache budgets; writable-stream PDF | Stress-test slow DB, browser memory, cancellation and retry | 100k-label arithmetic segment unit; 4,500-page streamed PDF Poppler page-tree and final-page barcode decode; image and stale-render/cancel tests | Software stress fixture passed; multi-hour and production-scale database runs remain pending |
| Legacy multisite job ownership | Network-admin quarantine inventory, dry-run, explicit site/member assignment, audit and fingerprint-checked rollback; original global data retained | Network/data owner must make the site mapping; the plugin never guesses | Two-site suite includes 55-job paging, site/subscriber authorization, deleted/invalid sites, conflicting assignment, concurrent writer, partial write, and modified-copy rollback | Implemented for human-confirmed mapping; unresolved jobs remain quarantined |
| Saved settings/templates survive upgrade | Same old options, namespace, hooks and single-site job key; separately branded public directory/bootstrap | Explicit folder swap, dual-active refusal, downgrade and legacy network-job site mapping | Genuine RC8 and archive RC9 exact-library upgrades; clean public activation plus double-active guard and RC9 profile/job preservation E2E | RC8, RC9 and single-site public-slug transition verified; ambiguous RC8/RC9 global multisite jobs require network-owner site assignment |
| Competitor scanner/mobile/inventory ecosystem | Ramsey Labels does not change SKU/stock or provide a scanner app | Clear independent scope; don't imply ecosystem parity | Assert product SKU and stock untouched | Explicit non-feature, no compatibility claim |

## No feature gates

Every Ramsey Labels feature is intended to be freely available. There are no licence keys,
subscriptions, telemetry, paid add-ons, artificial trial restrictions, or cloned competitor
templates/assets. Resource limits apply to memory/transport safety, not monetization.

## Current verified-source facts versus sales claims

The WordPress listing explicitly says free template text fields are restricted and brands “99%”
printer support. The product landing page advertises paid tiers, remote configuration, unlimited
custom fields, APIs and custom templates while other paragraphs present varying basic-plan field
counts. These are the competitor's claims, not independently verified behavior. Ramsey Labels
does not repeat the universal printer/scanner/POS compatibility or performance claims.
