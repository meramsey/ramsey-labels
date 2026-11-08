# Testing and evidence

Run from the repository root; inspect command exit codes, not only progress output.

| Layer | Command | Scope |
|---|---|---|
| JS unit/decoder | `npm test` | model, CSV, geometry, exact SKU, eight independently decoded formats |
| PHP unit | `composer test` | Schema/Data validators; small WP function doubles, not integration proof |
| Integration | `bash bin/integration.sh` | real WP/WC, products, variation, order CRUD, REST denials, settings and handoffs |
| Browser | `npm run test:e2e`, `npm run test:e2e:firefox`, `npm run test:e2e:webkit` | Chromium/Firefox/WebKit Linux against synthetic local WP; axe WCAG 2.1 A/AA, keyboard/RTL, nonce/privacy dialogs, media/SSRF, page jobs and intercepted print |
| JS style | `npm run lint` | ESLint correctness rules and Prettier formatting |
| PHP style | `composer lint` | full WPCS; unresolved findings are blocking |
| Static | `composer analyse` | PHPStan level 5 with WP/WC stubs |
| Package | `python3 bin/build.py` | exact allowlist, metadata, folder and deterministic SHA-256 |
| PDF | `node bin/check-pdf.cjs` | Poppler media/page counts and rasterized QR decode |
| SVG | `python3 bin/check-svg.py <svg> <png> <width-mm> <height-mm> <dpi>` | Python XML safety/geometry and ImageMagick rasterization; browser test also rasterizes SVG and independently decodes symbols |
| Stock geometry | `npm test`, `npm run test:e2e -- --grep 'verified Avery'` | Six Avery A4 Word-template-derived grids, all generic count starters, skip-slot/offset and PDF media geometry |
| GS1-128 | `npm test` | Supported-AI matrix, GTIN normalization, dates/FNC1/separators/errors with independent decoder vector |
| Multisite quarantine | `bash bin/multisite-test.sh` | 29 assertions: redacted owner/job pages, network/site authorization, membership, assignment, partial-write recovery, rollback and cross-site isolation |
| Upgrade | `bash bin/upgrade-test.sh` | authentic archived RC8 and RC9 files write custom libraries; RC11 verifies exact preservation |
| Lifecycle | `bash bin/lifecycle-test.sh` | activation/deactivation preservation and missing WooCommerce notice |
| Multisite | `bash bin/multisite-test.sh` | two-site settings/job isolation, default preservation and explicit network purge |
| Directory migration | `python3 bin/build-public.py` then `bash bin/check-public-migration.sh` | clean public slug, RC9 dual-active guard, deactivation migration, archive hashes, real installed-package integration/E2E and Plugin Check |
| Gettext | `npm run i18n:pot`, `python3 bin/compare-pot.py old.pot languages/ramsey-labels-independent.pot` | generated translator catalog compared with timestamp normalized |

ZXing-C++ normalizes UPC results to EAN-13. Tests assert the exact canonical value and
use a second decoder (ZBar, explicit UPC symbology) to verify unexpanded original UPC payloads.
This is intentionally not hidden by stripping zeros from results.

Browser evidence is generated under build/ with synthetic product/image data only.
`pdfinfo build/labels-e2e.pdf` independently verifies page count and 144 × 72 point media.
The test site refuses fixture writes unless environment=local and the synthetic title matches.

Coverage is not comprehensive: see release-readiness.md for gaps and actual counts.
No code-coverage percentage, all-platform browser compatibility, live POS scanning or physical
hardware compatibility is claimed. Chromium, Firefox and Playwright WebKit are run on Linux;
WebKit is not Safari on Apple operating systems and software decoders are not hardware scanners.
Unit stubs must not be cited as real KSES tests;
malicious markup is also checked using real WordPress in integration/browser suites.
