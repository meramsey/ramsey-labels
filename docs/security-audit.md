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

All eleven REST method/path combinations have permission callbacks and defensive callback
checks. Anonymous/subscriber denial tests cover each; browser tests cover missing/forged REST
nonces. Source-specific capability checks prevent products/orders/users crossover.
IDs, field names, quantities, enums and collection sizes are validated. UI text uses textContent;
URLs and PHP links use context escaping. SQL writes use wpdb update placeholders; migration
table names come from a fixed suffix list. Remaining WPCS/Plugin Check diagnostics are release
gates, not waived merely because a reviewer believes a path is safe.

No remote HTTP/image fetches, file uploads, archive extraction, PHP template evaluation or
telemetry occur in production runtime. Legacy unserialize disables classes but remains an
audit diagnostic requiring deeper malformed/nesting tests. Image realpaths reject traversal.
CSV exporter handles formula prefixes; there is no server-side CSV execution.

## Residual / pending

- Packaged Plugin Check now has zero errors, but remaining warnings (including slug/domain,
  SQL/nonce diagnostics) and the full WPCS failures still require resolution before release.
- Generic custom metadata can contain sensitive business data not caught by credential-name
  heuristics. Stronger source allowlists/per-field authorization require a compatibility decision.
- Role-restricted profiles are workflow restrictions, not an encrypted data boundary; templates
  are shared library content. Restricted-operator/source/profile/migration negative tests pass;
  shop-manager and more custom-role combinations still need expansion.
- Full order/user privacy export/erasure integration and retention policy remain unimplemented.
- Legacy migration backup/apply concurrency, hostile serialized depth and large legacy rows
  require more negative tests; no commercial source package was accessed.
- Comprehensive SSRF/private-network browser URL policy, redirects and CSS grammar fuzzing
  have not been verified. No server URL fetch is used; consent is not a network sandbox.
- Large-batch browser responsiveness, cancellation/race behavior and multisite uninstall need testing.
- Public vulnerability contact and monitored disclosure process await owner approval.

Do not treat these as accepted production risks. Publication remains blocked until triaged.
