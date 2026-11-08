# RC8/RC9 and public slug migration

## Preserved identifiers

- Legacy RC8/RC9 basename: `ramsey-labels-independent/ramsey-labels-independent.php`.
- Proposed directory basename: `ramsey-labels/ramsey-labels.php` (a separate archive).
- Namespace `RamseyLabels`; `RLI_FILE`, `RLI_VERSION`, `RLI_PURGE_ON_UNINSTALL`.
- Options `rli_v1_library`, `rli_v1_migration_backup`; user meta `rli_v1_jobs`.
- REST namespace `ramsey-labels/v1`; admin page `ramsey-labels`.
- `rli_field_value`, `rli_records`, list-action keys and user-scoped handoff keys.
- Library schema 1 and optimistic revision semantics.

The legacy in-place candidate preserves the RC8 text domain. A separate directory build uses
the public display name, `ramsey-labels` domain and its generated POT. Existing external RC8/RC9
translation files need a domain/filename rename or PO/POT merge. Both builds preserve the
`RamseyLabels` namespace, library schema/options, REST namespace and integration hooks; the
public build uses the new main-file path and `plugin_basename()`.

The official WordPress.org Plugin Information API returned 404 / “Plugin not found” for
`ramsey-labels` on 2026-11-06. This is evidence it was unlisted then, not a reservation or
guarantee of future approval. WordPress.org's current rules require GPL-compatible licensing,
secure/complete code, accurate readmes, and respect for trademarks; the plugin team makes
the final approval decision.

The directory archive has its own `ramsey-labels/ramsey-labels.php` entrypoint. A two-copy
guard was tested: while the old plugin remains active, the public copy loads no runtime classes,
constants or hooks and shows an administrator notice. After deactivating the old plugin, the
public copy starts automatically and reads the same options, backup and single-site job key.
No product/SKU/order data is modified. Rollback is file-level: deactivate public and reactivate
the retained legacy folder. Back up first. Do not keep both runtimes active.

## Data preservation

Export the library before updating. Replace files only, retaining the plugin folder and database.
The new Store guard no longer treats a partially customized original layout as factory defaults.
The earlier exact QR permalink expression repair is retained; intentionally customized other
URL expressions remain intact. Role restrictions and per-user job privacy remain enforced.

RC8/RC9 stored one global user-meta jobs key on multisite without a site-owner ID. RC10/RC11
scope new jobs to `rli_v1_jobs_site_<blog-id>` to prevent cross-site customer/order-data disclosure.
Ambiguous old network jobs stay under the legacy `rli_v1_jobs` key and do not appear in any site
queue. A network administrator can use **Network Admin → Settings → Ramsey Labels job quarantine**
to inspect redacted owner/token/date/count metadata, dry-run a target, explicitly assign a copy,
and roll back an unchanged copy. The source is never deleted. The owner/controller—not code—must
confirm ownership; site membership, current profile/source permissions, target-site existence and
2 MB storage limits are checked. Conflicts, partial writes and stale edited copies fail closed.
Every assignment/rollback is recorded in a network-only redacted ledger. Invalid legacy job IDs
remain visible as quarantined tokens and require manual review. See
`docs/wordpress-org-submission.md` for owner decisions still required.

Legacy external settings migration is separate from an RC8 upgrade: only administrators
may inspect/preview/apply/restore. The preview hash must still match sources. It creates
new profile copies and never writes vendor tables or copies executable vendor templates.
Malformed/oversized source rows, incompatible fields and uncertain legacy schema versions
need explicit negative fixtures before this adapter can be advertised as universally compatible.
