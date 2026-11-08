# Rights-holder and release-acceptance checklist

This checklist is deliberately unsigned. The coding agent cannot attest ownership or grant a
license on behalf of Ramsey Resin Art, an author, contractor, client, or prior employer.
An owner preference or approval cannot license proprietary third-party code; any third-party
component needs documented redistribution rights compatible with the selected project license.

## Source, copyright, license and brand

For every file in [`rc8-file-audit.md`](provenance/rc8-file-audit.md), the owner must identify the
author/rights holder and confirm one of the following with records: created by the owner/employee
within assigned work; assigned to the owner; or received under a compatible written license.

- [ ] Confirm the complete RC8 file inventory, its original archive checksum, and the source history predating that archive.
- [ ] If retained, supply the earlier ChatGPT-assisted development transcript/export and identify which files/sections came from that conversation, any human edits, model/service terms applicable at the time, and any sources/pasted reference material. This may support provenance, but is not a substitute for verifying third-party rights or a license.
- [ ] For `assets/barcodes.js` and `assets/symbol-tables.js`, attest authorship/derivation independently of the other plugin files; identify standards versions, code sources, table sources, generator tools and third-party notices.
- [ ] Confirm every shipped `assets/defaults.json` profile/template is owner-created or explicitly licensed for GPL-compatible redistribution.
- [ ] Confirm no contractor, customer, employer, client, co-author or third-party rights remain unassigned.
- [ ] Do not rely on owner consent alone for any identified proprietary third-party code/data; provide compatible written rights or approve its removal and clean replacement.
- [ ] Approve redistribution and modification under GPL-2.0-or-later for both RC11 ZIP identities and public source history; if not, identify exact files that must be replaced/removed before submission.
- [ ] Approve “Ramsey Labels for WooCommerce”, the Ramsey Resin Art attribution, contributor slug `meramsey`, WordPress.org slug/text domain `ramsey-labels`, and the RC11 migration behavior.
- [ ] Approve use of third-party product codes/manufacturer names only to identify source-verified sheet layouts; confirm no manufacturer artwork/template is bundled.
- [ ] Approve monitored security disclosure, support and conduct contacts; review PII/privacy retention language and any author email/name committed in historical Git metadata.
- [ ] Date, sign/name the rights holder, record supporting agreements/source files, and associate the attestation with exact RC11 source commit and artifact checksums.

## Site/data-controller choices

- [ ] Decide whether and how each legacy RC8/RC9 global multisite job belongs to a particular site. Use the RC11 network quarantine dry-run and do not assign until the site's owner/data controller confirms. If uncertain, leave it quarantined.
- [ ] Approve the retention period, privacy export/erasure language, and whether saved customer/order labels should be enabled for each site.
- [ ] Accept the explicit candidate gaps in the competitive matrix: only six named A4 manufacturer presets are verified; additional requested counts are generic; full-label SVG can embed raster images; only the documented GS1-128 subset is supported; no mobile scanner/POS application is included.

## Owner acceptance — hardware and operator tests

Perform in isolated staging with the synthetic `RRA-726474` product; see
[`owner-acceptance.md`](owner-acceptance.md) for the full procedure and sign-off table.

- [ ] 2 × 1 inch thermal print, 50.8 × 25.4 mm physical measurement and feed/offset.
- [ ] QR-left/SKU-below label physically prints and scans as exact `RRA-726474`.
- [ ] Scanned SKU finds the intended synthetic product in the actual WCPOS setup.
- [ ] WooCommerce bulk action, category lookup, product/queue thumbnails, quantity edits and sorting.
- [ ] Full selected-batch vertical preview/segment navigation and complete streamed PDF count.
- [ ] A4 stock code matches the selected verified preset or owner-measured generic geometry; print at actual size and confirm first/last positions and margins.
- [ ] Product SKU/stock and order data remain unchanged.
- [ ] Record OS/browser, printer/scanner models, driver, stock product code, measurements, result and operator/date.

Hardware, WCPOS, macOS Safari, Windows browsers and hands-on assistive-technology acceptance are
pending. No automated result is a substitute for those owner checks.
