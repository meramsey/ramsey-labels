# Changelog

## 1.0.0-rc.9 — engineering candidate

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
