# GitHub release draft — Ramsey Labels for WooCommerce 1.0.0-rc.11

**State: draft only. Do not publish until the owner explicitly approves public release.**

## Candidate commit and checks

- Engineering branch: `engineering/wordpress-org-readiness`
- Candidate source commit: `5a69195492786a6b763d7cb5ba3aa4348e84f192`
- Hosted required workflow: Quality and release gates run `42508133867` (verify final status before creating any release).
- Local evidence and checksums: `docs/evidence/rc11-verification.json` and
  `docs/evidence/rc11-checksums.sha256`.

## Artifacts

| Asset | SHA-256 | Intended use |
|---|---|---|
| `ramsey-labels-independent-1.0.0-rc.11.zip` | `096666d908b494c4aa7310e3fe9cc348fa59e49521417535a08117c440edb6b2` | In-place upgrade from RC8/RC9/RC10 legacy directory |
| `ramsey-labels-1.0.0-rc.11.zip` | `e48c93667efb23e8705a17b7465253881ee159bb59410a657c17f6155ea0d0df` | Separate public-directory candidate; do not activate alongside legacy copy |

Both artifacts contain only 21 fixed-timestamp allowlisted runtime files. Tests, development
packages, original archives, CI files, screenshots and private data are excluded. Verify the
published asset hash before attaching it to a release.

## Release notes

### Added

- Full-label SVG export with vector text/shapes/barcodes and bounded raster product-image embedding.
- Source-backed Avery A4 layouts: L7164 (12), L7163 (14), L7162 (16), L7160 (21), L7159 (24), and
  L7651 (65), plus generic count-only grid starters and calibration-sheet SVG.
- Stable Unicode-aware product-name and SKU sorting with original selection-order restore.
- Explicit network-admin multisite legacy-job quarantine, dry-run, assignment audit and
  fingerprint-checked rollback.
- Documented GS1-128 AI subset, GTIN input normalization, FNC1/date/check-digit validation and
  independently decoded vectors.
- Managed-stock/backorder quantity policy tests.

### Compatibility and verification

- Genuine RC8, RC9 and RC10 saved libraries upgrade without loss in synthetic fixtures.
- Legacy and public-directory packages pass installed-file manifest checks and WordPress Plugin Check.
- Current and oldest supported WordPress/WooCommerce matrices, HPOS/legacy storage, Chromium,
  Firefox and WebKit were tested as documented in release readiness.

### Important limits

- This is an RC candidate, not a stable release.
- Hardware printers, scanners, WCPOS, manual assistive-technology operation, Windows and macOS
  Safari remain owner acceptance items.
- GS1 support is limited to the documented GS1-128 subset; this is not GS1 certification.
- Named sheet compatibility is limited to the documented source-backed Avery layouts; generic grids
  require owner-measured stock geometry.
- The public-directory ZIP is not WordPress.org approval or slug reservation.

## Preconditions before any release action

- [ ] Required hosted workflow completed successfully for the exact candidate source commit.
- [ ] Owner approves publication, GPL distribution, branding, author identity, release notes and assets.
- [ ] Owner has retained the ChatGPT-assisted development provenance records and completed the
      attestation checklist.
- [ ] Owner has completed or explicitly accepted outstanding hardware/platform tests.
- [ ] Owner approves separate legacy/public directory ZIP distribution and WordPress.org submission status.
- [ ] A release tag/version is explicitly authorized. Do not infer tag authorization from this draft.
