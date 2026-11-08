# Security review

Scope: every supplied PHP file and browser asset, plus newly added runtime changes.
This is source review plus specified local tests, not a penetration-test certification.

## Fixed in this candidate

- Regex-only CSS cleaning allowed comment/escape obfuscation. Reject escaped/at-rule or
  URL-bearing CSS after comment removal, tested in PHP and the browser.
- Imported external images could load before explicit consent in detached DOM elements.
  Parse in inert templates and request per-origin session consent in the image loader.
- Remote URLs with embedded credentials are rejected by the renderer.
- Pixel budgets are checked before resizing the render canvas.
- Credential-like metadata bindings are rejected across supported metadata sources.
- RC8 partial factory matching could discard saved custom title/price/SKU changes.
- Stale previews could print previously removed records; invalidate caches on affected edits.

## Reviewed controls

All twelve REST method/path combinations have permission callbacks and defensive callback
checks. Anonymous/subscriber denial tests cover each; browser tests cover missing/forged REST
nonces. Source-specific capability checks prevent products/orders/users crossover.
IDs, field names, quantities, enums and collections are validated. UI text uses textContent;
URLs and PHP links use context escaping. SQL writes use wpdb update placeholders; migration
table names come from fixed suffixes plus identifier validation. Both installed candidate ZIPs
have zero current Plugin Check findings and the full WPCS gate has zero findings. Narrow inline
sniff exceptions are explained next to atomic CAS, fixed legacy SQL identifiers and read-only
legacy serialization; there is no whole-file suppression baseline.

No server-side remote HTTP/image fetches, file uploads, archive extraction, PHP template evaluation or
telemetry occur in production runtime. The browser can fetch an external raster URL only after
session consent, with credentials/referrer omitted, redirects rejected, response MIME/bytes/pixels
bounded and private literal IP/host names blocked. DNS rebinding and adversarial browser/network
policies are residual risks; remote-store image origins should be trusted. Legacy unserialize is
only for read-only legacy settings, disables classes, limits bytes/depth/nodes and restores the
previous error handler; malformed/excessive payload tests pass. Image realpaths reject traversal.
CSV exporter handles formula prefixes; there is no server-side CSV execution.

## Residual / pending

- Both in-place and public-slug packages are checked separately: each currently has zero
  Plugin Check errors/warnings. Full WPCS has zero errors/warnings with no blanket suppression;
  narrowly scoped ignores retain a fixed local image read and atomic
  compare-and-swap/table-name queries that WordPress exposes no equivalent API for.
- Generic custom metadata can contain sensitive business data not caught by credential-name
  heuristics. Stronger source allowlists/per-field authorization require a compatibility decision.
- Role-restricted profiles are workflow restrictions, not an encrypted data boundary; templates
  are shared library content. Restricted-operator/source/profile/migration negative tests pass;
  shop-manager and more custom-role combinations still need expansion.
- Core privacy export/erasure now pages 10 owners, excludes other customers' records in the same
  job, locks per-user writes and preserves stable owner rows between pages. 26-owner integration
  tests prove no skipped records. Deeper concurrent user-deletion/realtime privacy-request races
  and formal legal/retention policy review remain.
- RC11 multisite quarantine uses a network lease plus the same per-site jobs-index and owner locks
  as normal writes. It never displays job contents; it requires network-admin capability and owner
  membership, retains the global source, logs only mapping/fingerprint/status metadata, and refuses
  rollback if a copied job changed. Pending assignments from partial writes can be rolled back.
  Hard-deleted-site cleanup is serialized by the network lease because that site has no runtime.
- Full-label SVG uses escaped XML primitives. It emits no scripts, event-handler attributes,
  stylesheets, foreign objects or external resource URLs. Product imagery is bounded and embedded
  as raster PNG; external image load reuses preview consent and network-host safeguards. Python's
  XML parser, ImageMagick rasterizer, Chromium's SVG renderer and independent barcode decoders
  exercise the artifact. Renderer/font substitution differences remain possible.
- Legacy migration backups are now written only after the CAS profile save succeeds. Serialized
  input is class-disabled, depth/node/byte bounded and malformed input rejected.
- Literal private-net hosts, credential URLs, response redirects and non-raster content are blocked.
  DNS rebinding, hostile local browser extensions and full CSS/URI fuzzing are not proven absent.
- Segmented 4,500-page streaming PDF, 100,000-label arithmetic partitioning, cancellation,
  queue/saved-job lock races, cross-browser browser budgets and two-site multisite purge pass.
  Multi-hour/stress hardware load and fleets of WordPress sites need further operator-scale testing.
- Public vulnerability contact and monitored disclosure process await owner approval.

Do not treat these as accepted production risks. Publication remains blocked until triaged.
