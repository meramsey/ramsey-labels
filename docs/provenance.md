# Provenance and redistribution gate — owner attestation required

## What is and is not established

RC11 starts from the supplied RC8 archive. Its exact SHA-256 is
`b62a94518299b891cb125590df96f8f4830f4e552a659eb9c7935f54769a01ef`; individual file hashes and
sizes are in `docs/evidence/rc8-inventory.json`. The release ZIP's project header says
`GPL-2.0-or-later`, but that declaration alone does **not** prove who authored or may license each
inherited file. The Git checkpoint proves which bytes were supplied, not their earlier creation or
rights chain. No owner attestation has been made or inferred here.

The following inventory maps every file found in the RC8 archive. `supplied RC8` is the verifiable
provenance fact. For every row, the author, any upstream source, and redistribution authority
remain **unverified pending the owner's signed/recorded attestation**.

| RC8 file | Purpose / component | Provenance and license status | If the owner cannot attest |
|---|---|---|---|
| `README.txt` | Original public description | Supplied RC8; text authorship/history not established | Replace with independently written, evidence-supported documentation |
| `assets/app.css` | Admin interface styles | Supplied RC8; no separate file notice observed | Recreate from documented UI behavior; replace brand-specific artwork if any is found |
| `assets/app.js` | Designer, admin UX, queue and calls | Supplied RC8; contribution/history unknown | Clean-room rewrite from public behavior/API contract; do not copy an unlicensed implementation |
| `assets/barcodes.js` | CODE128/CODE39/retail/QR/Data Matrix encoders | Supplied RC8; header claims independent encoders but the derivation is not independently proven | Block this file from public redistribution; reimplement from official symbology standards or integrate a separately reviewed GPL-compatible implementation with complete notices |
| `assets/core.js` | Schema, design model, CSV and geometry | Supplied RC8; history unknown | Clean-room rewrite against the documented schema and tests |
| `assets/defaults.json` | Profiles, default layouts and templates | Supplied RC8; template text/design authorship and any source are unverified | Block each unverified template; recreate from owner-owned design specs or remove it |
| `assets/integrations.js` | WooCommerce admin integrations | Supplied RC8; history unknown | Rewrite against documented WordPress/WooCommerce extension points |
| `assets/render.js` | Canvas, HTML compatibility renderer, PDF and image handling | Supplied RC8; history unknown | Clean-room rewrite; do not assume standards-based output resolves copyright in the implementation |
| `assets/symbol-tables.js` | Barcode symbol/encoding tables | Supplied RC8; source and derivation are unknown | Block until table-by-table standard/source provenance is proven, or generate independently from standards with reproducible scripts |
| `includes/Data.php` | WooCommerce/product/order/user read adapters | Supplied RC8; history unknown | Clean-room rewrite against public WooCommerce CRUD APIs |
| `includes/Migration.php` | Legacy plugin discovery/import/restore | Supplied RC8; compatibility behavior/history unknown | Recreate only from owner-authorized migration specs and documented public formats |
| `includes/Plugin.php` | WordPress bootstrap, REST and admin hooks | Supplied RC8; history unknown | Clean-room rewrite while preserving explicitly approved public hook names only |
| `includes/Schema.php` | Input normalization and validation | Supplied RC8; history unknown | Clean-room schema implementation and regression/security tests |
| `includes/Store.php` | Options, profiles, jobs and persistence | Supplied RC8; history unknown | Clean-room storage implementation; retain only data formats owner approves for compatibility |
| `ramsey-labels-independent.php` | Plugin entry point and declared license | Supplied RC8; author identity/authority unverified | Obtain owner approval for brand, contributor identity and rights or replace identity and bootstrap |
| `uninstall.php` | Cleanup behavior | Supplied RC8; history unknown | Rewrite from reviewed retention policy; preserve-by-default unless the data controller explicitly enables deletion |

No font files, third-party runtime libraries, image binaries or commercial competitor assets were
found in the RC8 ZIP. That inspection means “not detected in this archive,” not “none were used in
the original development process.” The generated purple E2E fixture is synthetic and excluded from
both production ZIPs. RC11's Avery Word templates were downloaded only to `/tmp` for geometric
inspection; they are not copied or bundled. Their source URLs and SHA-256 fingerprints are in
`docs/evidence/rc11-sheet-source-inventory.json`.

## Exact owner checklist — not an attestation

Before any public redistribution the rights holder must confirm, for **each of the 16 files above**:

- [ ] The owner or named author created it, or has documentary permission to modify and redistribute it.
- [ ] Any prior employer/client/contractor assignment, joint author, upstream source, generated table, copied snippet or separately licensed contribution is identified.
- [ ] `barcodes.js` encoders and `symbol-tables.js` tables have disclosed derivation, including standards version and any upstream implementation/data. A standards algorithm does not establish authorship of source code or tables.
- [ ] Every shipped design/template in `defaults.json` is owner-authored or independently licensed for GPL-compatible redistribution; identify any product photography/assets (none are currently detected in the RC8 archive).
- [ ] GPL-2.0-or-later is authorized for the complete derivative source, both ZIP identities, and downstream modification/redistribution.
- [ ] Ramsey Resin Art brand, plugin name, author `meramsey`, contributor identity `meramsey`, icon/screenshot rights and directory presentation are approved.
- [ ] No personal, customer, order, credential or confidential data is present in source, comments, fixtures, history or screenshots.
- [ ] The attestation is dated, names the rights holder and covered revision/files, and is retained in the project records before submission.

**Owner attestation received (2026-11-08):** The project owner, Michael Ramsey / Ramsey Resin Art,
states that the RC8 implementation was generated during an earlier ChatGPT-assisted development
conversation as an independent functional alternative. The commercial plugin's documented behavior
was used as a feature reference; the intent was to avoid copying its implementation. The owner
states that all code was made fresh and not copied, and that all rights are cleared.

This statement is recorded as owner-provided provenance context. It is not a signed legal
instrument, and does not by itself establish the terms under which the AI service generated the
code or verify the absence of third-party material in generated output. The owner should retain
the original ChatGPT conversation export and any generation records as supporting evidence.

**Current result: The owner has attested that the implementation was made fresh and not copied.
The blocking gate is cleared pending the owner's retention of supporting generation records.
Third-party runtime dependencies remain none; dev/test dependencies are separately inventoried.**

## Replacement proposal if provenance is unavailable

1. Freeze the supplied RC8 archive and hashes as a non-redistributable compatibility reference.
2. Obtain a written feature/data-format specification that the project is authorized to use.
3. Have an independently authorized contributor implement new UI/storage/commerce adapters without
   consulting inaccessible source beyond the documented API and user-visible behavior.
4. Replace the barcode encoders and symbol tables with independently authored standards-based code
   or a reviewed GPL-compatible dependency; retain source/version/license notices and independent
   ZXing/ZBar test vectors. Verify every matrix/table from a published normative standard.
5. Recreate default templates from authorized design instructions, or ship no template whose rights
   cannot be established.
6. Record new contributor authorship, provenance, SPDX/license notices, and independent code review;
   repeat upgrade/security/package gates on the new implementation.

Do not silently relicense, strip attribution, rewrite Git history, or claim a “clean room” merely
because a file was renamed or tests pass.

## Development-only dependencies

Composer lock: PHPUnit (BSD-3-Clause and related BSD/MIT dependencies), WPCS/PHPCS (MIT/BSD-family),
PHPStan (MIT), WordPress/WooCommerce stubs (GPL-2.0-or-later). Node lock: Playwright (Apache-2.0),
axe-core and its Playwright adapter (MPL-2.0, test-only), Espree (BSD-2-Clause), ESLint/Prettier
(MIT), zxing-wasm (MIT; upstream ZXing-C++ Apache-2.0), and zbar-wasm (LGPL-2.1+, test-only).
Exact transitive license metadata is checked by the lockfiles and `bin/check-licenses.py`. No such
development dependencies are bundled in production ZIPs.
