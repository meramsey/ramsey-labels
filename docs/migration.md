# RC8 and public slug migration

## Preserved identifiers

- Installation basename: `ramsey-labels-independent/ramsey-labels-independent.php`.
- Namespace `RamseyLabels`; `RLI_FILE`, `RLI_VERSION`, `RLI_PURGE_ON_UNINSTALL`.
- Options `rli_v1_library`, `rli_v1_migration_backup`; user meta `rli_v1_jobs`.
- REST namespace `ramsey-labels/v1`; admin page `ramsey-labels`.
- `rli_field_value`, `rli_records`, list-action keys and user-scoped handoff keys.
- Library schema 1 and optimistic revision semantics.

Public display name changes to Ramsey Labels for WooCommerce. The RC8 text domain
`ramsey-labels-independent` remains unchanged, including any external translation overrides.
The proposed public `ramsey-labels` domain is pending the same tested migration as the
installation basename. PHP/JS strings still need a complete internationalization sweep
before publication. The proposed final domain is not claimed as implemented in this candidate.

The proposed WordPress.org slug conflicts with the retained RC8 installation folder.
This candidate prioritizes safe in-place updates. **Do not upload it under a second name.**
Owner must choose either an approved old slug/domain or fund/test an explicit basename
migration (active_plugins, network activation, update transients, duplicate-load protection,
rollback, translation paths). That migration is not implemented or claimed here.

## Data preservation

Export the library before updating. Replace files only, retaining the plugin folder and database.
The new Store guard no longer treats a partially customized original layout as factory defaults.
The earlier exact QR permalink expression repair is retained; intentionally customized other
URL expressions remain intact. Role restrictions and per-user job privacy remain enforced.

Legacy external settings migration is separate from an RC8 upgrade: only administrators
may inspect/preview/apply/restore. The preview hash must still match sources. It creates
new profile copies and never writes vendor tables or copies executable vendor templates.
Malformed/oversized source rows, incompatible fields and uncertain legacy schema versions
need explicit negative fixtures before this adapter can be advertised as universally compatible.
