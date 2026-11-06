# WordPress.org submission and assets checklist

Authoritative guidance reviewed during engineering:
- https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/
- https://wordpress.org/plugins/plugin-check/
- https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/
- https://developer.wordpress.org/plugins/wordpress-org/plugin-assets/

## Blocking before submission

- [ ] Owner confirms authorship/GPL rights for all RC8 code, symbol tables and assets.
- [ ] Approve author credit, meramsey contributor identity and public display name.
- [ ] Resolve `ramsey-labels` slug versus preserved RC8 installation basename and text domain.
- [x] Test oldest/current combinations and both current order stores; derive minimum headers from passing tests.
- [ ] Clear WPCS and packaged Plugin Check blockers; review remaining warnings individually.
- [ ] Complete internationalization, accessibility/RTL and supported-feature test coverage.
- [x] Verify genuine RC8 upgrade, custom templates/DPI preservation, synthetic legacy migration backup/restore and clean ZIP installation/activation.
- [ ] Expand malformed legacy migration and multisite/upgrade/rollback coverage.
- [ ] Establish private security contact, support expectations and conduct enforcement contact.
- [ ] Review privacy/export/erasure implications for per-user saved jobs.
- [ ] Obtain hardware and real WCPOS acceptance; remove any unverified advertised claims.
- [ ] Owner explicitly approves repository publication and WordPress.org submission.

## Assets plan (not included in plugin runtime ZIP)

- Screenshot 1: synthetic product search/queue with generated purple product image.
- Screenshot 2: 50.8 × 25.4 mm QR card design with exact synthetic SKU.
- Screenshot 3: complete vertically stacked five-label preview and sheet profile settings.
- Optional banner: original neutral Ramsey Labels artwork, 772 × 250 and 1544 × 500 PNG.
- Optional icons: original 128 × 128 and 256 × 256 PNG. No commercial logos, printer brands
  or copyrighted product photos without explicit compatible rights.
- Place approved directory artwork in WordPress.org SVN assets, not production plugin files.
- Replace planned screenshot descriptions with actual captions/files before submission.

No fees, tracking, upsells, remote code or commercial compatibility claims are needed.
Passing Plugin Check is necessary evidence, not automatic directory approval.
