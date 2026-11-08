# RC8 source-file audit for rights-holder review

This audit traces every file in the supplied RC8 archive (SHA-256
`b62a94518299b891cb125590df96f8f4830f4e552a659eb9c7935f54769a01ef`). Exact original sizes and
hashes are recorded in `docs/evidence/rc8-inventory.json`. The archive and its Git checkpoint prove
the supplied bytes only. No commit attribution, source-control history predating the archive,
author agreement, assignment, or upstream derivation record was supplied. The RC8 plugin header
declares GPL-2.0-or-later; it does not establish the right to make that declaration on every file.

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

## Redistribution decision

**All 16 inherited RC8 source files remain blocked for public redistribution until the owner
attests the rights and derivation checklist in `docs/owner-attestation-checklist.md`.** This is a
conservative gate, not an accusation of infringement. Plugin Check, GPL headers, clean-room intent,
source availability, passing tests, or the fact that competitors were not copied do not replace
the rights holder's evidence.

If the owner cannot attest all files, remove the disputed files from the public candidate and
replace them with independently authored code based only on approved behavior/API specifications
and normative standards. Barcode/symbol-table provenance is a separate blocking subgate because
encoder algorithms and symbol tables may have distinct origins from the rest of the plugin.
