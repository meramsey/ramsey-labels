# Testing and evidence

Run from the repository root; inspect command exit codes, not only progress output.

| Layer | Command | Scope |
|---|---|---|
| JS unit/decoder | `npm test` | model, CSV, geometry, exact SKU, eight independently decoded formats |
| PHP unit | `composer test` | Schema/Data validators; small WP function doubles, not integration proof |
| Integration | `bash bin/integration.sh` | real WP/WC, products, variation, order CRUD, REST denials, settings and handoffs |
| Browser | `npm run test:e2e` | Chrome against local WP, UI, nonce failures, inert imports, PDF and intercepted print |
| JS style | `npm run lint` | ESLint correctness rules and Prettier formatting |
| PHP style | `composer lint` | full WPCS; unresolved findings are blocking |
| Static | `composer analyse` | PHPStan level 5 with WP/WC stubs |
| Package | `python3 bin/build.py` | exact allowlist, metadata, folder and deterministic SHA-256 |
| PDF | `node bin/check-pdf.cjs` | Poppler media/page counts and rasterized QR decode |
| Upgrade | `bash bin/upgrade-test.sh` | archived RC8 process writes custom library, RC9 verifies exact preservation |
| Lifecycle | `bash bin/lifecycle-test.sh` | activation/deactivation preservation and missing WooCommerce notice |

ZXing-C++ normalizes UPC results to EAN-13. Tests assert the exact canonical value and
use a second decoder (ZBar, explicit UPC symbology) to verify unexpanded original UPC payloads.
This is intentionally not hidden by stripping zeros from results.

Browser evidence is generated under build/ with synthetic product/image data only.
`pdfinfo build/labels-e2e.pdf` independently verifies page count and 144 × 72 point media.
The test site refuses fixture writes unless environment=local and the synthetic title matches.

Coverage is not comprehensive: see release-readiness.md for gaps and actual counts.
No code coverage percentage, cross-browser support, live POS scanning or physical hardware
compatibility is claimed without evidence. Unit stubs must not be cited as real KSES tests;
malicious markup is also checked using real WordPress in integration/browser suites.
