# Changelog

## 1.0.0-rc.10 — engineering candidate

- Retain separate legacy and public-slug ZIP manifests; add `ramsey-labels` bootstrap with a tested double-runtime guard and RC9 upgrade path.
- Add generated POT, WordPress JavaScript translations, comprehensive gettext scan, RTL, focus, native privacy dialogs and axe WCAG 2.1 A/AA E2E scans.
- Add paginated category lookup and bounded source-record transfer; support 100,000-label arithmetic planning and 4,500-page streamed PDF stress fixture.
- Add current-user private saved-job UI, multisite site-scoped job metadata, core privacy export/eraser and tokenized per-user/per-site operation leases.
- Add common GS1-128 AI validation/FNC1, queued-label reordering, currency-symbol preference, full-label PNG and barcode SVG export.
- Add cross-browser, multisite lifecycle, privacy pagination, source pagination and full public-basename migration tests.
- PHPCS/WPCS: zero errors/warnings; PHPStan level 5: zero errors; packaged Plugin Check: zero errors/warnings. Narrow inline exceptions and unresolved external security/provenance/hardware decisions remain documented.

## 1.0.0-rc.9 — verified engineering checkpoint

- Preserve exact RC8 source/archive baseline before edits.
- Keep installation basename, namespace, constants, options, REST namespace and hooks.
- Rename public display name; preserve the RC8 text domain until basename/domain migration is approved and tested.
- Fix plain-permalink REST query construction, `wp-image:` resolution and category handoffs.
- Invalidate cached print jobs after profile changes, queue clearing/CSV import and element dragging.
- Fix missing editor re-render function discovered by ESLint.
- Stop partial factory matching from discarding customized label elements.
- Harden CSS imports, inert HTML image handling and external image consent.
- Reject credential-like custom metadata fields; check label pixel budgets before allocation.
- Snapshot asynchronous renders so queue/profile changes cannot publish stale previews.
- Enforce record limits across combined imports and support all 1,000 bounded bulk-action IDs.
- Reject overflowing integer conversions instead of wrapping IDs/revisions negative.
- Add unit, independent decoder, WordPress integration, security and browser tests.
- Add locked developer tools, CI gates, deterministic packaging and release documentation.

## 1.0.0-rc.8 — supplied baseline

User reports this was the latest tested working release. Its archive SHA-256 is
`b62a94518299b891cb125590df96f8f4830f4e552a659eb9c7935f54769a01ef`.
See docs/rc8-source-notes.txt for the original historical notes, not current verification claims.
