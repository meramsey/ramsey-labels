# Repository audit — public-release preparation

**Audited against `main` at the documented release-candidate state.** This is an engineering audit,
not an approval to publish.

## GitHub metadata

| Item | Current state | Assessment |
|---|---|---|
| Description | Free, open-source WooCommerce barcode & QR label printer; visual designer, bulk printing, thermal/A4, PDF/SVG; no paid tiers | Accurate and discoverable |
| Topics | 20/20: WooCommerce/WordPress plugins, barcode/label, thermal, QR, PDF/SVG, formats, POS, free/open-source | GitHub topic limit is already occupied; no metadata change required. WordPress.org Plugin Check permits at most five readme tags, so readme.txt uses its five strongest user-search terms. |
| Website | Empty | Do not invent a public website; add only after owner approves a maintained URL |
| Default branch | `main` | Verified after hosted CI passed |
| Branch protection | Not enabled (GitHub API reports `Branch not protected`) | Owner approval is required before changing repository policy. Before merge/release, require pull requests, at least one approval, no force pushes/deletions, and the Quality, CodeQL, and Security scans checks. |
| Releases/tags | None | Correct: RC candidate assets are not a public release |
| Open PRs | None | Historical Dependabot PRs are closed; their branches were not deliberately deleted |

## Documentation and publication findings

- README now needs to lead with practical user value and gallery links; engineering evidence belongs
  under `docs/`.
- `readme.txt` must retain RC status until an owner approves a stable version and WordPress.org
  listing. It must not imply hardware/WCPOS certification or full GS1 compliance.
- `SECURITY.md` deliberately has no published private contact; owner approval remains required before
  enabling private vulnerability reporting or naming a response contact.
- RC11 provenance, hardware acceptance and WordPress.org owner gates remain documented. The owner’s
  recorded fresh-code attestation does not remove the need to retain supporting generation records.
- Screenshot gallery uses isolated synthetic data only. WordPress.org screenshot candidates are
  prepared but not deployed.

## Security and supply-chain findings

- Existing quality gates cover Plugin Check, WPCS, PHPStan, PHPUnit, JavaScript tests, Playwright,
  audits, Gitleaks, license metadata and deterministic ZIPs.
- New workflows add Semgrep, OSV-Scanner, Trivy, Checkov, CodeQL JavaScript security-extended,
  OpenSSF Scorecard, isolated manual ZAP baseline, manual SBOM/release preparation, and manual
  WordPress.org deployment gates.
- CodeQL does not support PHP. Semgrep is the PHP static-analysis security layer.
- ZAP authenticated/admin scanning is intentionally BLOCKED until a maintained synthetic-only login
  script is approved; no workflow may target production.
- Runtime SBOMs are generated from extracted installable ZIPs, not development dependencies.

## Release accuracy

The legacy and public-directory packages are distinct and must never be installed together. Generic
sheet grids are not manufacturer compatibility claims. Full-label SVG can contain embedded raster
product imagery. Hardware scanning/POS compatibility remains owner acceptance work.
