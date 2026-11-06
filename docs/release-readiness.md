# Release readiness — PARTIAL, publication blocked

This is a locally engineered RC9 candidate, not a completed WordPress.org submission.
No remote push, GitHub release, directory submission, production database access or
physical print operation was performed. All fixtures are synthetic and all WordPress
instances use separately named local Docker networks/volumes and loopback ports.

## Verified locally

- Exact RC8 source/archive preserved in baseline commit `b813692` on the engineering branch.
- PHP unit tests, JS model/independent barcode decoder tests and Chrome browser suites pass.
- Current WordPress 7.1.4 / WooCommerce 11.2.2, PHP 8.3 and current PHP 8.5.12; oldest
  WordPress 6.0.3 / WooCommerce 7.0.1, PHP 7.4.32 Apache / 7.4.33 CLI.
  HPOS and legacy order storage both exercised on PHP 8.3 and 8.5.
- Product name/SKU and variation search, 101-product category pagination, all 101 IDs
  transferred without truncation, queue thumbnails, row/bulk actions and complete preview.
- QR and printed-PDF QR decode exact `RRA-726474`; all eight advertised formats decode
  with independent software. UPC normalization is separately verified with ZBar.
- 5-page thermal PDF is 144 × 72 pt; 131 sheet labels produce 3 A4 pages (65/65/1).
- Genuine archived RC8 saves custom profile/template/DPI; fresh RC9 process reads the
  entire library unchanged on PHP 7.4, 8.3 and 8.5.
- Synthetic prior settings migration preview/apply/backup/restore; stale revisions,
  forged migration hashes, malicious CSS/HTML, unauthorized routes and role boundaries.
- Activation/deactivation preserves library; absent WooCommerce displays an actionable notice.
  Default uninstall retains data and explicit single-site purge removes only plugin storage.
- Allowlisted 17-file runtime ZIP installs and activates in a clean, separate test site.
- Packaged Plugin Check has no errors; warnings are not silently waived.
- ESLint/Prettier, PHPStan level 5, dependency audit and license metadata checks run locally.
- GitHub workflows are SHA-pinned, read-only, validated locally and not executed remotely.

## Final local results (2026-11-06 UTC)

| Gate | Actual result |
|---|---|
| PHP unit | 15 tests / 20 assertions pass on PHP 7.4.32, 8.3.36 and 8.5.12 |
| JS unit / independent decoder | 18 tests pass; all 8 advertised formats independently decoded |
| WordPress integration | 80 + 80 assertions on PHP 8.3 legacy/HPOS; 79 on oldest; 80 + 80 on PHP 8.5 legacy/HPOS |
| Installed final ZIP integration | Another 80 assertions pass in a fresh independent WordPress installation |
| Browser E2E | 10 scenarios pass in each of 4 environments (40 executions, no retries/skips) |
| Genuine RC8 upgrade | Full custom library/profile/default/template/DPI equality on PHP 7.4, 8.3 and 8.5 |
| PDF | Exact thermal media, 5-page count, independently rasterized SKU QR; 131 sheet labels / 3 A4 pages |
| PHP syntax / static | All 7 runtime PHP files pass syntax; PHPStan level 5 has 0 errors |
| JavaScript standards | ESLint / Prettier pass |
| Packaged Plugin Check 2.1.0 | 0 errors, 38 warnings requiring review |
| Full WPCS | **FAIL: 191 errors and 50 warnings**; release remains blocked |
| Dependency / secret scans | npm: 0; Composer advisories: 0; full-history Gitleaks: no leaks found |
| Development licenses | Approved metadata for 88 npm and 36 Composer packages; RC8 owner attestation still pending |
| CI definitions | Actionlint passes locally; GitHub execution not authorized/performed |

The final ZIP contains 17 allowlisted files and no tests, developer packages, CI scripts,
original archive, Git metadata, private paths or test artifacts. Two builds were byte-identical.
All installed files were independently hash-compared to the archive manifest before the
installed-package integration and browser suites were run.

Artifact: `build/ramsey-labels-independent-1.0.0-rc.9.zip`

SHA-256: `8c369220c6a15286ae38ac1b4f5f3097a3f44b70562169b822d7beef7ae7afdd`

Exact counts, file hashes, scanner results and remaining standard diagnostics are recorded in
`docs/evidence/verification.json`. Raw local outputs,
PDFs, rasters and screenshots remain in `build/`; they are excluded from the release ZIP.
The recorded source checkpoint identifies the frozen runtime files. The subsequent audit
commit adds reporting/evidence only; rebuilding it produces the same ZIP bytes.

## Blocking / incomplete

1. **Full WordPress Coding Standards still fails.** Missing API docs, inherited naming/Yoda
   conventions and SQL/nonce/input warnings remain. The unmodified full gate stays blocking
   in CI; there is no suppression baseline or claim that standards passed.
2. **Directory slug/basename/text-domain reconciliation:** the existing installation path
   is retained for RC8 safety. A new `ramsey-labels` basename migration is not implemented.
3. **Provenance:** owner must attest rights/derivation of all inherited RC8 code and symbol
   tables, and approve GPL/public authorship. No commercial code was consulted in this pass.
4. **Internationalization/accessibility:** PHP/JS UI is not fully extracted/translatable;
   keyboard and live status improvements are not a comprehensive WCAG/RTL audit.
5. **Coverage:** no exhaustive large-resource/race/fuzz testing, multisite uninstall/purge,
   privacy erasure/export integration, cross-browser or actual printer/scanner/POS acceptance.
6. **Publication operations:** owner-confirmed private security/support/conduct contacts,
   actual directory screenshots/artwork, branding and explicit publish/push approval pending.

No accepted production security exception is implied by this candidate. See security-audit.md
and wordpress-org-submission.md. The only next release should be a reviewed candidate after
these gates are closed, not an automatic promotion to stable 1.0.0.
