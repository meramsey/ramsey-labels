# Security vulnerability triage

## Severity and release handling

| Severity | Release handling |
|---|---|
| CRITICAL | Block release. Contain, fix, retest, and coordinate disclosure privately. |
| HIGH | Block release unless the owner documents a time-bounded exception with impact and compensating controls. |
| MEDIUM | Triage before release; fix or record owner-reviewed rationale and target date. |
| LOW | Track and prioritize in normal maintenance. |
| INFORMATIONAL | Record only if it improves hardening or documentation. |

## Triage record

Every suppressed/accepted finding must record tool/rule/version, exact affected path/component,
severity, exploitability in the shipped ZIP, evidence, reviewer, expiry/review date, and remediation
issue. Put narrow reviewed exclusions beside the workflow/rule—not in a blanket ignore file. Never
put secrets, customer data, or unpatched exploit instructions in public reports.

Dependency findings distinguish shipped runtime ZIP contents from developer/test tooling. A
vulnerability only reachable through a development-only dependency is still tracked, but must not be
presented as a shipped plugin runtime vulnerability.

Private vulnerability reports stay private until a fix/advisory and owner-approved disclosure plan
exist. See `SECURITY.md` for reporting boundaries.

## Initial scanner triage — 2026-11-08

| Tool/rule | Status | Evidence |
|---|---|---|
| Semgrep `php.lang.security.injection.echoed-request` in `includes/NetworkJobs.php` | Reviewed false positive | Each reported pagination URL is constructed from bounded numeric values/allowlisted routes and passed to `esc_url()` before output. Inline rule-specific comments identify the precise output sites. Re-review if route construction changes. |
| Checkov `CKV_GHA_7` in `zap.yml` and `wordpress-org-deploy.yml` | Narrow reviewed suppression | `workflow_dispatch` confirmation inputs are intentional safety gates. Inline `#checkov:skip` comments identify only these two manual workflows; automated push/PR workflows have no user-controlled deployment inputs. |
| Semgrep Python XML/urllib heuristics | Not in scoped PHP/JavaScript SAST job | These are build/test utility scripts, not shipped plugin runtime. They remain covered by explicit DTD/entity/url validation and code review; broaden scanner scope only with a maintained Python triage policy. |

Local initial scans found no OSV lockfile vulnerabilities and no Trivy findings. Scanner JSON/SARIF files are CI artifacts; do not commit raw reports unless redacted and owner-approved.

| OWASP ZAP baseline warnings on synthetic fixture | Recorded, not a release claim | Local baseline found no FAIL alerts and 22 WARN alerts, primarily WordPress/WooCommerce fixture headers, cookie attributes, timestamp/version disclosure, and unauthenticated public endpoints. The scan uses `--network host` only against `127.0.0.1:18885` disposable fixture. Authenticated admin/API ZAP coverage remains BLOCKED pending maintained synthetic-only authentication automation. |
