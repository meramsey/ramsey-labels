# WordPress.org submission and assets checklist

Authoritative guidance reviewed during engineering:
- https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/
- https://wordpress.org/plugins/plugin-check/
- https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/
- https://developer.wordpress.org/plugins/wordpress-org/plugin-assets/

## Blocking before submission

- [ ] Owner confirms authorship/GPL rights for all RC8 code, symbol tables and assets.
- [ ] Approve author credit, meramsey contributor identity and public display name.
- [x] Prepare and verify a separate `ramsey-labels` directory/text-domain candidate with RC9 dual-active guard; API slug lookup was 404 (not reserved).
- [x] Test oldest/current combinations and both current order stores; derive minimum headers from passing tests.
- [x] Full WPCS, installed legacy Plugin Check and installed public-slug Plugin Check pass with zero findings.
- [x] Generate POT/JS catalogs, check translations extraction, automated axe WCAG 2.1 A/AA, keyboard alternatives and RTL layout.
- [ ] Owner/translator review actual localized `.po/.mo/.json` catalogs; no language-specific translator is assigned.
- [x] Verify genuine RC8 upgrade, custom templates/DPI preservation, synthetic legacy migration backup/restore and clean ZIP installation/activation.
- [x] Add malformed serialized object, hash/CAS and two-site purge tests; genuine RC8/RC9 single-site and clean/public-dir migration passes.
- [ ] Network-global RC8/RC9 saved jobs have no site owner; network administrator must decide and perform explicit per-site assignment before those jobs become visible.
- [ ] Establish private security contact, support expectations and conduct enforcement contact.
- [x] Add core paged personal-data export/erasure and verify 26-owner paging; approve retention wording/privacy notice with the owner.
- [ ] Obtain hardware and real WCPOS acceptance; remove any unverified advertised claims.
- [ ] Owner explicitly approves repository publication and WordPress.org submission.

## Directory artwork (not included in plugin runtime ZIP)

- [x] Browser-rendered WooCommerce attachment thumbnails: `docs/assets/synthetic-product-search.png`, `synthetic-product-queue.png`, `synthetic-category-selection.png`, and `synthetic-thumbnail-queue.png` (own variation image, parent fallback, and explicit missing-image placeholder).
- [x] 50.8 × 25.4 mm QR card design with exact synthetic SKU: `docs/assets/qr-label.png`, `synthetic-designer.png`.
- [x] Complete vertically stacked synthetic batch preview: `docs/assets/synthetic-batch-preview.png`.
- [ ] Owner reviews screenshots, transfers approved `screenshot-1.png`, `screenshot-2.png`, etc. to WordPress.org SVN assets, and confirms readme indices.
- Optional banner: original neutral Ramsey Labels artwork, 772 × 250 and 1544 × 500 PNG.
- Optional icons: original 128 × 128 and 256 × 256 PNG. No commercial logos, printer brands
  or copyrighted product photos without explicit compatible rights.
- Place approved directory artwork in WordPress.org SVN assets, not production plugin files.

No fees, tracking, upsells, remote code or commercial compatibility claims are needed.
Passing Plugin Check is necessary evidence, not automatic directory approval.
