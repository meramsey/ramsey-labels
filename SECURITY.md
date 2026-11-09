# Security policy

Ramsey Labels is currently a release candidate. Do not post vulnerabilities, credentials,
order/customer exports, media URLs, or private site details in public issues.

## Reporting

After the owner enables GitHub private vulnerability reporting, use the repository’s **Report a
vulnerability** flow. Until then, request a private reporting channel without sending exploit
payloads or customer data through public GitHub discussions.

Include the affected version, WordPress/WooCommerce/PHP versions, required role/capability,
synthetic-only reproduction, impact, and whether private customer/order data is involved.

## Response and disclosure

The owner must approve an operational security contact and response expectations before public
release. Maintainers will reproduce reports in an isolated synthetic environment, prepare a patch,
coordinate an advisory, and agree disclosure timing. No acknowledgement or remediation SLA is
promised until the owner establishes one.

Automated security scans, SBOMs, Plugin Check, and tests support review but do not prove absence of
vulnerabilities. See [security scanning](docs/security-scanning.md),
[security triage](docs/security-triage.md), and [security audit](docs/security-audit.md).
