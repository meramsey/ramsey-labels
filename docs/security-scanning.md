# Security scanning

Ramsey Labels uses layered automated checks. Findings are evidence for review, not proof that the
plugin is free of vulnerabilities. Production WordPress, WCPOS, printers, and customer data are
never scan targets.

| Tool | License / scope | Output | Release policy |
|---|---|---|---|
| Semgrep OSS | LGPL-2.1-or-later; PHP and JavaScript static patterns | SARIF/JSON | Confirmed HIGH/CRITICAL findings block release |
| CodeQL | GitHub code scanning; JavaScript/TypeScript supported; PHP is not a CodeQL language | GitHub code scanning/SARIF | Security-extended JavaScript analysis on PRs, pushes and schedule |
| OSV-Scanner | Apache-2.0; lockfile/transitive vulnerability scan | JSON | Runtime-impacting HIGH/CRITICAL findings block pending triage |
| Trivy | Apache-2.0; filesystem, dependency, secret and config scan | JSON/SARIF | HIGH/CRITICAL findings require triage |
| Gitleaks | MIT; history and release artifact secret scan | JSON/log | Any credible secret blocks release and requires rotation/removal |
| Checkov | Apache-2.0; GitHub Actions/Compose configuration checks | JSON | Confirmed security findings require remediation or narrow review |
| OWASP ZAP | Apache-2.0; isolated baseline web scan | HTML/JSON | Manual, isolated-only; never scans production |
| OpenSSF Scorecard | Apache-2.0; repository practice assessment | GitHub workflow artifact | Weekly visibility and remediation tracking |

## Local commands

```bash
npm audit --audit-level=low
docker run --rm -v "$PWD:/repo:ro" ghcr.io/gitleaks/gitleaks:v8.30.0 git /repo --redact --no-banner
bin/release-supply-chain.sh
```

Security workflow reports are retained as CI artifacts. Tool images and binaries are version/digest
pinned in workflow files. Semgrep/Trivy/Checkov findings are not blanket-suppressed; see
[security triage](security-triage.md).

## ZAP boundary

`zap.yml` is manual and starts only the repository’s disposable Compose WordPress fixture. It runs a
non-destructive baseline scan against that isolated site. Authenticated admin/API scans require a
reviewed synthetic-only session script and are intentionally not enabled until maintained by an
owner. No ZAP workflow may target a production URL.
