# RC11 release readiness — READY FOR OWNER REVIEW, NOT APPROVED OR PUBLISHED

RC11 is a locally verified engineering candidate. The verified repository head is
`aa2c836489543a1489ee7eb0df1f76dec06d66d0`; the runtime source commit is
`9f901b2c475ef206582bf600f11628fe6b6bce7f` (later commits on this checkpoint contain evidence
and documentation only). It is not approved for public redistribution,
WordPress.org submission, a GitHub release, or production installation. No push, merge, tag,
submission or deployment was made. The repository remains on the dedicated engineering branch.
Both RC10 checkpoints remain available as local branches, and RC10's original ZIP is pinned as
`tests/Fixtures/rc10.zip` for upgrade tests.

## Verified RC11 functionality

- Full-label SVG export: vector text, shapes and multiple barcode elements; bounded product images
  embedded as raster PNG/data raster; XML escaping, clip/rotation behavior and physical mm units.
  Python XML safety checks, ImageMagick rasterization, Chromium SVG rasterization, independent
  Code 128/QR/Data Matrix decode and browser-preview/PDF geometry comparisons pass. It is a mixed
  vector/raster document when imagery is present, not an all-vector export. HTML designs remain
  available as PNG/PDF, not full-label SVG.
- Sheet geometry: source-verified Avery A4 L7164 (12-up), L7163 (14), L7162 (16), L7160 (21),
  L7159 (24), L7651 (65). Official manufacturer product pages and blank Word grid files are
  cited and hashed in `docs/evidence/rc11-sheet-source-inventory.json`. Requested counts 40/44/56/
  120/189/230/324 and generic alternatives remain unbranded configurable row/column starters;
  count alone does not imply stock compatibility. Calibration SVG includes page/label geometry,
  margins, offsets, pitches and skipped slots.
- Queue sorting: stable Unicode-aware product name ascending/descending and SKU ascending/descending;
  selection-order restore; quantity, IDs and selected state remain attached; browser tests confirm
  preview order matches queue order.
- GS1: the implemented GS1-128 AI subset and exact limits are in `docs/gs1-support-matrix.md`.
  It does not claim complete GS1 or GS1 Data Matrix/QR compatibility.
- Multisite: old global jobs remain quarantined. The network-admin-only workflow displays redacted
  metadata, dry-runs, requires explicit destination/member/profile access, records decisions,
  retains the source, blocks conflicting/partial assignment and fingerprint-checks rollback.

## RC11 local verification results

| Gate | Result |
|---|---|
| JavaScript unit/barcode/GS1/preset suite | 29 passed, 0 failed |
| WPCS / PHPCS | Pass, zero errors/warnings |
| PHPStan | Level 5 pass, zero errors |
| PHP syntax / PHPUnit | PHP 7.4.33, 8.3.35 and 8.5.12 syntax checks pass; PHPUnit 16 tests / 23 assertions pass on each |
| Current-stack WooCommerce integration | WordPress 7.1.4 / WooCommerce 11.2.2: 99 assertions each for legacy and HPOS via PHP CLI 7.4.33, 8.3.35 and 8.5.12; PHP 8.3.35 web stack also tested |
| Oldest declared stack | WordPress 6.0.3 / WooCommerce 7.0.1 / PHP 7.4.33: 98 integration assertions and 27 Chromium scenarios, legacy storage |
| Installed public-directory package integration | 99 assertions pass; 27 Chromium scenarios; RC9 public folder transition and option/job/SKU retention pass |
| Browser | Current PHP 8.3.35 stack: 27 scenarios each on Chromium/Firefox/WebKit; PHP 8.5.12 web stack: 27 Chromium; oldest PHP 7.4.33 stack: 27 Chromium |
| Installed legacy ZIP | All installed file hashes match manifest; 99 integration assertions, 27 Chromium E2E, streamed PDF checks; Plugin Check 2.1.0: 0 errors / 0 warnings |
| Installed public ZIP | Guarded legacy-to-public directory transition, 99 integration assertions, 27 Chromium E2E, streamed PDF checks; Plugin Check 2.1.0: 0 errors / 0 warnings |
| Multisite | 29 isolated integration assertions plus network-admin browser dry-run/assign/rollback |
| Upgrade | Genuine RC8, RC9 and RC10 saved-library equality passes under PHP 7.4.33 (oldest stack), 8.3.35 and 8.5.12 CLI environments |
| Queue/catalog | 301 product records across 11 bounded pages; all 301 selected IDs transferred with no duplicates |
| Calibration/PDF | Six A4 manufacturer layouts, generic requested counts, all-label counts, first/last positions, offsets/start slots, PDF physical media checked |
| PDF/resource stress | 100,000-label arithmetic unit fixture; 4,500-page streamed PDF Poppler/page count and final-page barcode decode; cancellation and retry E2E pass |
| JavaScript quality | ESLint and Prettier pass; WordPress POT regenerated without extraction warnings and matches a second deterministic generation |
| Dependencies | npm/Composer lockfile audits and package license metadata checks recorded; development dependencies are not bundled |
| Secret scan/workflow | Gitleaks 8.30.0 scanned all locally reachable commits and both ZIP extractions: no findings; actionlint 1.7.7 passed both workflow files; no hosted CI run |
| Hardware/manual | Not tested; see `docs/owner-acceptance.md` |

Full outputs are retained locally under `build/rc11-reports/` and `build/reports/`; summaries and
exact artifact manifests are in `docs/evidence/`. Tests use synthetic isolated sites and loopback
ports. Current-stack PHP 7.4/8.5 integration uses WP-CLI PHP runtimes against the current
WordPress/WooCommerce test database; it does **not** claim Apache/web execution on those PHP
versions. Apache/browser execution passed on PHP 7.4 at the oldest declared stack, PHP 8.3 current
stack, and PHP 8.5 current stack (Chromium only). HPOS runtime assertions passed on all three PHP
CLI versions. Hosted GitHub Actions were not run against this exact commit; actionlint is local
workflow lint only.

## Candidate artifacts

- Legacy in-place update: `build/ramsey-labels-independent-1.0.0-rc.11.zip`
- Public-directory candidate: `build/public/ramsey-labels-1.0.0-rc.11.zip`
- Exact SHA-256 values and sorted runtime file manifests: `docs/evidence/rc11-verification.json`
- Manufacturer source references/checksums: `docs/evidence/rc11-sheet-source-inventory.json`

Both ZIPs are built from deterministic fixed-timestamp allowlists, install separately, exclude
tests/development dependencies/archives, and pass installed-package checks. WordPress.org slug
lookup/reservation is not approval, and no WordPress.org acceptance is claimed.

The exact source/artifact checksums and both complete runtime file manifests are committed under
`docs/evidence/rc11-verification.json`, `docs/evidence/rc11-legacy-manifest.json`,
`docs/evidence/rc11-public-manifest.json`, and `docs/evidence/rc11-checksums.sha256`.

## Blocking owner gates and residual limits

- **Provenance blocks public redistribution.** Every inherited RC8 source component—including
  barcode encoders/tables and default templates—needs rights-holder attestation; see
  `docs/provenance/rc8-file-audit.md` and `docs/owner-attestation-checklist.md`. No attestation is
  fabricated or inferred from a GPL header/test pass.
- Owner approval is required for brand, author credit, GPL distribution, public slug, support and
  security contacts, directory art/screenshots, migration policy and any actual submission.
- Physical thermal printing (2 × 1 inch), QR/SKU scan into WCPOS, scanners/POS, A4 stock alignment,
  printer scaling/feed, screen-reader operator acceptance, macOS Safari and Windows remain untested.
- Generic sheet counts have no manufacturer fit claim; only the six named Avery geometries are
  source-backed. Manufacturer/feed calibration still requires a physical plain-paper test.
- GS1 support is a documented subset, not complete standards conformance or verifier certification.
- Full-label SVG can contain raster images; HTML-template designs are not exported as full-label SVG.
- Production-scale database/load, long-duration browser memory, and live cross-plugin adoption are
  not certified by the synthetic local fixtures.

**Recommendation: READY FOR OWNER REVIEW, NOT APPROVED/PUBLISHED.** Acceptance, licensing
attestation, hardware checks, publication and deployment remain owner decisions.
