# Contributing

Work on an isolated local WordPress/WooCommerce site with synthetic data only.
Never connect tests to a production database, printer, POS or SKU automation.
Follow docs/development.md and docs/testing.md; submit focused patches with regression tests.
Preserve persisted keys and public hooks. Explain migrations and backward compatibility.

Use WordPress Coding Standards, explicit validation and context-specific escaping.
Do not add remote scripts, telemetry, runtime package dependencies or copied commercial code.
Every added source/asset needs a known origin and GPL-compatible license.
Contributions are offered under GPL-2.0-or-later; retain required upstream notices.

Run all gates locally. Report failures honestly; do not suppress diagnostics merely to turn CI green.
Reviewers must distinguish software simulation from hardware/POS acceptance.
No push, release or directory submission occurs without owner approval.

Public issue support is best effort after publication; include versions, redacted reproduction
steps, expected/actual behavior and a synthetic fixture. Never upload customer exports or credentials.
