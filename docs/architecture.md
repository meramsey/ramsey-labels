# Architecture

The legacy bootstrap `ramsey-labels-independent.php` defines RLI constants and loads five
namespaced PHP classes. There are no activation-time product mutations or SKU hooks.

- `Plugin`: menu, assets, REST routes, list actions and current-user bulk handoffs.
- `Data`: read-only WooCommerce/WordPress adapters, capability gates and bounded image reads.
  Orders use WooCommerce CRUD, not direct order post/meta access.
- `Schema`: typed document validation, limits, inert markup and print geometry validation.
- `Store`: `rli_v1_library`, optimistic revision compare-and-swap, role-filtered profiles,
  per-user `rli_v1_jobs` and migration backups.
- `Migration`: bounded read-only legacy table discovery, explicit preview hash, copy and restore.

Browser layers: standardized symbol tables → encoders → pure model → Canvas/PDF renderer → UI.
The renderer creates each unique label once per job and reuses raster images across pages.
PDF 1.4 is written locally with RGB/Flate image streams. Browser printing uses a same-origin
iframe with exact mm dimensions and no remote print service.

The complete production manifest is an allowlist in bin/build.py. Tests and tool dependencies
are deliberately outside that boundary. Runtime code has no PHP autoloader dependency.
