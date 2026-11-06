# License and provenance inventory

No commercial source/package was opened, copied or used as an implementation reference in
this engineering pass. The sole starting source is the supplied RC8 archive, preserved in Git.
Archive checksum: b62a94518299b891cb125590df96f8f4830f4e552a659eb9c7935f54769a01ef.

| Distributed files | Observed origin / license |
|---|---|
| bootstrap, uninstall.php, includes/*.php | supplied RC8; header GPL-2.0-or-later; owner authorship attestation pending |
| assets/app.js, core.js, render.js, integrations.js, app.css, defaults.json | supplied RC8; covered by project license claim, prior authorship not independently provable |
| assets/barcodes.js, symbol-tables.js | supplied RC8; describes independent encoders and standardized symbol data; algorithm/table derivation needs owner evidence |
| readme.txt | new engineering documentation, GPL-2.0-or-later |
| LICENSE | standard GNU GPL v2 text; project permits later versions |

No bundled fonts, stock icons, third-party image files, vendor barcode libraries or commercial
UI assets were found. Unicode symbols are text; visual rendering uses system fonts, not font files.
Synthetic purple test artwork is programmatically generated and never shipped in the ZIP.

The inspection supports **no detected copied library**, not a claim that prior authorship is
proven. Owner must confirm rights to the entire RC8 source and any earlier derivation before
publication. Uncertain provenance is a release blocker; a local engineering artifact is not a
public redistribution approval.

## Development-only dependencies

Composer lock: PHPUnit (BSD-3-Clause and related BSD/MIT dependencies), WPCS/PHPCS
(MIT/BSD-family), PHPStan (MIT), WordPress/WooCommerce stubs (GPL-2.0-or-later).
Exact transitive licenses can be regenerated with `composer licenses --format=json`.
Node lock: Playwright (Apache-2.0), ESLint (MIT), Prettier (MIT), globals (MIT),
zxing-wasm (MIT; upstream ZXing-C++ Apache-2.0), and zbar-wasm (LGPL-2.1+,
including its upstream decoder). They are test tools only, not linked into distributed runtime assets.
See lockfiles and installed package LICENSE/NOTICE files for exact notices and versions.
Do not bundle node_modules or vendor in a future release without a new compatibility review.

GitHub repositories need a clearly licensed source tree; WordPress.org requires every submitted
file to be GPL-compatible. The builder's allowlist prevents test/dependency licenses and private
artifacts accidentally entering production archives. This does not substitute for provenance consent.
