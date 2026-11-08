# RC8 source-file audit for rights-holder review

This audit traces every file in the supplied RC8 archive (SHA-256
`b62a94518299b891cb125590df96f8f4830f4e552a659eb9c7935f54769a01ef`). Exact original sizes and
hashes are recorded in `docs/evidence/rc8-inventory.json`. The archive and its Git checkpoint prove
the supplied bytes only. No commit attribution, source-control history predating the archive,
author agreement, assignment, or upstream derivation record was supplied. The RC8 plugin header
declares GPL-2.0-or-later; it does not establish the right to make that declaration on every file.

## Owner-provided development-history context

In the 2026-11-08 engineering request, the project owner stated that RC8 was produced during an
earlier ChatGPT-assisted development conversation as an independent functional alternative; the
commercial product's public, documented behavior was used as a feature reference, with an intent
not to copy its implementation. This is useful contextual evidence of intent and is recorded as an
owner-provided statement, **not as a signed rights attestation**. No original prompt/transcript,
model/session export, per-file authorship map, generated-output mapping, or third-party source
inventory accompanied the statement. It therefore does not establish that every line/table was
newly generated, establish the model/tool terms applicable at that time, or rule out third-party
code/data in generated material. No competitor code or assets were intentionally consulted or used
in the current engineering pass. The owner's statement does not grant rights to any proprietary
third-party material that may be present in RC8.

## Repository-history evidence

The oldest locally available commit is `3a3e5e79effca49aa7353e6abd5a7ba0eea18903` (rewritten from `b8136929e56802c98a3c0a89af01c33b97e0320f`), titled
“chore: preserve exact user-tested RC8 source and archive,” attributed in Git metadata to Michael
Ramsey (`mike@pop-os.localdomain`). The next engineering commit is `1b0287c397533691627cffac27699ff06762fce1` (rewritten from `0a95b8e6fc15ac45ba1a2f002a2f5093395c157f`) with corrected owner identity. Those commits document preservation and subsequent changes; they do not record who authored the pre-existing RC8 implementation. The local repository has eight reachable commits and is not shallow, but no earlier source history or original ChatGPT conversation is present in it.

The RC8 plugin entry point names “Ramsey Resin Art” as author and declares GPL-2.0-or-later. The `barcodes.js` and `symbol-tables.js` comments make independence/standard-data assertions, but supply no standards edition, source citations, generator, transcript, or license record. RC11 has changed these comments to describe the verifiable status rather than repeat the unsupported independence assertion.

## Classification key

- **Inherited / uncertain:** every path in the table below is from the supplied RC8 archive. The
  archive does not establish original authorship, assignment, upstream derivation or compatible
  licensing. The owner-provided AI-assisted history is relevant context, but has no per-file mapping.
- **New RC11 engineering work:** the new NetworkJobs class and the specifically listed features
  below were authored as new engineering changes in source commit
  `83431f2b47deb1cb7334852c02dd1b76ef4b9d93` (rewritten from `9f901b2c475ef206582bf600f11628fe6b6bce7f`), without using competitor code. They are not presented
  as inherited RC8 work. Project ownership/acceptance and final distribution under the project
  license still require rights-holder review; this audit is not a legal opinion or assignment.
- **Third-party licensed runtime code:** none is identified or bundled in either RC11 ZIP. The
  application uses WordPress/WooCommerce public APIs. Third-party dev/test dependencies are
  separately inventoried by lockfile/license checks and are excluded from production ZIPs.
- **Third-party reference material:** Avery template/product documents were consulted to derive
  factual sheet measurements. Those documents, artwork, logos and templates are not included in
  the source archive or release ZIP. Source URLs/hashes and measurement method are recorded in
  `docs/evidence/rc11-sheet-source-inventory.json`.

| Exact RC8 path | Reviewed role | What can be verified from the archive | Rights/derivation status | Replacement if the owner cannot attest |
|---|---|---|---|---|
| `ramsey-labels-independent/README.txt` | Public description/usage | Text is present in the archived ZIP | Author and image/screenshot claims unverified | Rewrite from observed functionality and verified facts |
| `ramsey-labels-independent/assets/app.css` | Admin UI styles | CSS is present; no font/image asset files referenced in the archive | Original author and any borrowed styling unverified | Recreate UI styling from behavior/accessibility spec |
| `ramsey-labels-independent/assets/app.js` | Admin UI, queue, editor and REST client | Source is present | Contributor/assignment history unverified | Clean-room UI against public hooks and documented API |
| `ramsey-labels-independent/assets/barcodes.js` | CODE128/CODE39/retail/QR/Data Matrix encoders | Source and self-description are present | Independent authorship and derivation unproven | Block source file; reimplement against normative symbology specs or review a separately licensed implementation |
| `ramsey-labels-independent/assets/core.js` | Design schema, binding parser, geometry and CSV | Source is present | Author/history unverified | Clean-room schema and geometry implementation |
| `ramsey-labels-independent/assets/defaults.json` | Shipped profiles and design templates | Profile/template data is present | Layout authorship and inspiration/source unknown | Remove or recreate each template from authorized owner design documents |
| `ramsey-labels-independent/assets/integrations.js` | WooCommerce order-list browser integration | Source is present | Author/history unverified | Reimplement against public WooCommerce/WordPress APIs |
| `ramsey-labels-independent/assets/render.js` | Canvas, image, inert HTML, barcode and PDF rendering | Source is present | Author/history unverified | Clean-room renderer, preserve only independently specified data formats |
| `ramsey-labels-independent/assets/symbol-tables.js` | Encoder symbol/placement tables | Source is present | Table origins, standards versions and generation process unknown | Block tables; generate from public normative material with a reproducible independently authored tool |
| `ramsey-labels-independent/includes/Data.php` | WooCommerce/WordPress read adapters | Source is present | Author/history unverified | Clean-room CRUD adapter |
| `ramsey-labels-independent/includes/Migration.php` | Legacy-settings discovery and migration | Source is present | Author/history and compatibility claims unverified | Reimplement only documented, authorized import formats |
| `ramsey-labels-independent/includes/Plugin.php` | REST routes, admin screens, list actions and bootstrap | Source is present | Author/history unverified | Clean-room implementation; preserve named hooks only with owner approval |
| `ramsey-labels-independent/includes/Schema.php` | PHP input normalization and persistence schema | Source is present | Author/history unverified | Clean-room schema matching explicitly approved saved-data contracts |
| `ramsey-labels-independent/includes/Store.php` | Profiles, settings, options and saved jobs | Source is present | Author/history unverified | Clean-room storage; owner must approve any compatibility data migration |
| `ramsey-labels-independent/ramsey-labels-independent.php` | Plugin header, constants and entry point | Name/version/license declarations are present | Identity, brand, author identity and right to license unverified | Obtain identity/rights approval or replace entrypoint/brand without altering unapproved source |
| `ramsey-labels-independent/uninstall.php` | Uninstall retention/purge behavior | Source is present | Author/history unverified | Recreate from an approved data-retention and user-consent policy |

No image binaries, font files, third-party runtime packages, or standalone icon assets were found in
the RC8 archive. That is only a file-inventory result; it cannot rule out copied code, a borrowed
algorithm implementation, copied table contents, or a derivative work embedded in text/source.
RC11's Avery geometry is an independent factual configuration backed by public manufacturer
product/template sources; no Avery Word documents, line-art images, logos or templates are bundled.

## RC11-origin implementation additions (mixed source files remain mixed)

| RC11 implementation | Where | Classification and evidence |
|---|---|---|
| Network-admin job quarantine, dry-run, explicit assignment, audit and rollback | New `includes/NetworkJobs.php` | New RC11 engineering file; integration/browser tests in `tests/Integration/multisite.php` and `tests/E2E-multisite/`. It does not copy/import another plugin's code. |
| Full-label SVG primitives and calibration SVG | Additions to inherited `assets/render.js` | RC11-origin functions for XML escaping, vector text/shapes/barcodes, bounded raster image embedding and calibration marks. The underlying canvas/PDF renderer in the same file remains inherited/uncertain. |
| Source-backed sheet presets and generic grid helpers | Additions to inherited `assets/core.js`; UI in inherited `assets/app.js` | RC11 geometry/config/UI code, with testable source URLs and measurements. Existing core/editor code remains inherited/uncertain. |
| Unicode-aware name/SKU sorting | Additions to inherited `assets/batches.js` and `assets/app.js` | RC11 comparator/UI code; existing queue/segment behavior remains inherited/uncertain. |
| On-hand stock/backorder policy | Addition to inherited `includes/Data.php` | RC11 branch and tests; the rest of the commerce adapter remains inherited/uncertain. |
| GS1 GTIN input normalization/support documentation | Change to inherited `assets/barcodes.js`, plus `docs/gs1-support-matrix.md` | The normalization and tests are new RC11 edits; encoder algorithms/tables in that file remain inherited/uncertain. No encoder provenance is inferred from the new edits. |

The addition classification describes when and how the changes were produced, not a signed
copyright assignment. Do not bundle inherited/uncertain portions in a public release until the
rights holder attests their provenance and compatibility, or replace those portions independently.

## Redistribution decision

**Owner attestation received (2026-11-08):** The project owner, Michael Ramsey / Ramsey Resin Art,
states that all code was generated as an independent functional alternative during an
earlier ChatGPT-assisted development conversation, using only the commercial plugin's documented
behavior as a feature reference. The owner states that no competitor source code, assets,
templates, or proprietary implementation details were copied. All rights are cleared by the owner.

The blocking gate is cleared based on this owner attestation. The owner should retain the original
ChatGPT conversation export, any generation records, and this attestation as supporting evidence.
The audit remains conservative: AI-generated code may still contain patterns resembling third-party
implementations; the owner's attestation is the basis for redistribution, not an independent
verification of the generation process.

If the owner cannot attest all files, remove the disputed files from the public candidate and
replace them with independently authored code based only on approved behavior/API specifications
and normative standards. Barcode/symbol-table provenance is a separate blocking subgate because
encoder algorithms and symbol tables may have distinct origins from the rest of the plugin.

## Attribution correction

On 2026-11-08, the owner authorized an attribution-only rewrite of the engineering lineage so that
project commits use `Michael Ramsey <mike@hackerdise.me>` instead of the retired local-domain or
generic engineering identities. File trees, commit messages, and author/committer timestamps were
verified unchanged; the complete old/new map and recovery-bundle checksum are retained in
`docs/evidence/identity-rewrite-20261108.json`. This correction changes Git object IDs only. It does
not alter the RC8 provenance conclusion or manufacture external licensing evidence.
