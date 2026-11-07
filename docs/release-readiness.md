# RC10 release readiness — READY FOR OWNER REVIEW, NOT PUBLISHED

This RC10 code candidate has passed the local release gates below. It is not a stable release,
WordPress.org submission, public GitHub release, or production deployment. Nothing was pushed,
submitted, tagged or installed on a production site. Physical printer/scanner/POS behavior was
not tested. Synthetic WordPress/WooCommerce instances use isolated Docker volumes and loopback ports.

## Verified compatibility matrix

Exact core/plugin versions were confirmed against the WordPress Core Version Check and Plugin
Information APIs on 2026-11-06/07. Current stable at that check: WordPress 7.1.4, WooCommerce
11.2.2 and PHP 8.5.12. These values may age; check upstream again at submission time.

| WP | PHP | WooCommerce | Store | Integration assertions | Browser tests | Upgrade |
|---|---|---|---|---:|---:|---|
| 6.0.3 | 7.4.33 CLI / 7.4.32 Apache | 7.0.1 | Legacy | 94 | 21 Chromium | RC8 + RC9 |
| 7.1.4 | 8.3.35 | 11.2.2 | Legacy | 95 | 21 Chromium, 21 Firefox, 21 Playwright WebKit | RC8 + RC9 |
| 7.1.4 | 8.3.35 | 11.2.2 | HPOS | 95 | same browser run | RC8 + RC9 |
| 7.1.4 | 8.5.12 | 11.2.2 | Legacy | 95 | 21 Chromium | RC8 + RC9 |
| 7.1.4 | 8.5.12 | 11.2.2 | HPOS | 95 | same browser run | RC8 + RC9 |
| 7.1.4 | 8.3.35 | 11.2.2 | Legacy, installed legacy ZIP | 95 | 21 Chromium | Public slug package tested separately |
| 7.1.4 | 8.3.35 | 11.2.2 | Legacy, public-slug ZIP | 95 | 21 Chromium | RC9 public-folder transition |
| 7.1.4 | 8.3.35 | 11.2.2 | Two-site multisite | 6 lifecycle/isolation checks | Not claimed | Site settings and jobs isolated |

Minimum headers reflect tested values: WordPress 6.0.3, PHP 7.4.32, WooCommerce 7.0.1.
PHP 7.4 is end-of-life and is tested for inherited compatibility only; new installations should
use a supported PHP release. PHP 8.0/8.1/8.2/8.4 and intermediate WooCommerce versions were not
exercised. Firefox/WebKit were tested on Linux; Safari/macOS/Windows are not claimed.

## Final gates and evidence

| Gate | Verified result |
|---|---|
| PHPUnit | 16 tests / 23 assertions pass on PHP 7.4.32, 8.3.36 and 8.5.12 |
| JS unit/barcode | 26 tests pass; all 8 advertised formats independently decoded; GS1-128 subset round-trips with group separator |
| WooCommerce integration | 95 assertions per current order-store configuration, 94 on the oldest stack, plus 95 each against both installed ZIPs |
| Multisite | 6 assertions: per-site option/job isolation, retain-by-default and paginated explicit network purge |
| Browser | 21 scenarios each on Chromium, Firefox, Playwright WebKit on current stack, oldest Chromium, PHP 8.5 Chromium, installed legacy ZIP and installed public ZIP |
| Accessibility | Axe WCAG 2.1 A/AA has zero violations in designer/data/preview and saved-job native dialogs; keyboard element editing, reorder and RTL automated checks pass |
| RC upgrades | Archived RC8 and RC9 full custom library/profile/template/DPI equality on PHP 7.4/8.3/8.5; public directory folder transition additionally preserves single-site RC9 jobs |
| Large batches/PDF | Arithmetic planning for 100,000 labels; streamed 4,500-page PDF verified by Poppler; final page independently decodes exact RRA-726474 |
| Print geometry | Thermal media 144 × 72 pt (50.8 × 25.4 mm); 131 labels occupy three A4 sheets; printer calibration is not hardware validation |
| PHP style/static | PHPCS/WPCS zero errors and warnings, no baseline; PHPStan level 5 zero errors; PHP syntax verified on 7.4, 8.3 and 8.5 containers |
| JS style/i18n | ESLint and Prettier pass; `wp i18n make-pot` has zero extraction warnings; committed POT matches regenerated catalog (timestamp normalized); public domain transformed to `ramsey-labels` |
| Plugin Check 2.1.0 | 0 errors / 0 warnings on the installed legacy ZIP and public-slug ZIP |
| Dependencies/provenance | npm 0, Composer 0 advisories/abandoned packages; 90 npm and 36 Composer dev dependency license metadata entries accepted; inherited RC8 ownership still needs owner attestation |
| Secret scan / workflows | Gitleaks scans full committed history; actionlint validates workflows locally; GitHub Actions were not run and no push was made |

Integration evidence includes 101-product category pagination, category-list pagination, 101 selected
IDs without truncation, variation CRUD/search, orders through legacy and HPOS CRUD, coupons/users,
bulk handoff, customer privacy paging over 26 owners, unauthorized route/nonce denials, oversized
body rejection, lock recovery, hostile templates, PHP serialized-object rejection, and extension hooks.

Both packages use sorted, fixed-timestamp allowlists and were built twice byte-identically. Each
ZIP's installed files were SHA-256 checked against its manifest before its integration/browser suite.
Tests, `vendor`, `node_modules`, original archives and local reports are not shipped.

## Candidate artifacts

Legacy in-place RC8/RC9 update package:

`build/ramsey-labels-independent-1.0.0-rc.10.zip`

The prospective directory candidate is a separate package and is not a directory reservation:

`build/public/ramsey-labels-1.0.0-rc.10.zip`

Exact checksums are in the adjacent `.zip.sha256` files and committed verification JSON. Rebuild
from the recorded source commit to verify checksums. The public slug lookup returned 404 at the
recorded check; WordPress.org can grant the slug to another submitter at any time.

## Audits and remaining decisions

Security implementation/tests are in `docs/security-audit.md`; licensing/source provenance in
`docs/provenance.md`; competitor-source comparison and honest feature gaps in
`docs/competitive-feature-matrix.md`. Known competitive gaps are explicitly acknowledged:
not all competitor sheet-stock presets, not every GS1 application-identifier family, no full-label
vector SVG (barcode SVG is vector; label PNG and lossless raster PDF are provided), no one-click
alphabetic sorting, and no scanner/mobile inventory application. The manual queue can be reordered.

Owner decisions still required:
- Attest rights/authorship/derivation for every inherited RC8 file, encoder and symbol table; approve GPL distribution and author credit.
- Approve the public name, contributor account, directory slug/domain, release version and that the separate public package is appropriate.
- Approve conversion of legacy global multisite jobs only after assigning each job to the intended site; automatic reassignment would risk cross-site PII disclosure.
- Provide monitored private vulnerability, support and conduct-enforcement contacts; review privacy/retention language and file author metadata before publishing history.
- Approve directory screenshots/artwork and actual submission/publishing.

Manual acceptance still pending: real label stocks, printer drivers, offsets/feed, barcode scanner,
live WCPOS/POS lookup, screen reader/assistive technology, macOS Safari and Windows browsers.
No vendor printer or POS compatibility is claimed.

**Status recommendation:** READY FOR OWNER REVIEW, NOT PUBLISHED. Owner may accept these documented
competitive gaps or authorize another engineering iteration before approving release. Do not
promote RC10 to stable 1.0.0 merely by changing metadata.
