# Release process — explicit owner approval required

This process prepares verifiable artifacts; it does not grant authority to tag, publish, create a
GitHub Release, or submit to WordPress.org.

## Before a release

1. Work on an engineering branch and verify author/committer identity with `git var`.
2. Pass hosted quality, security, browser, oldest-supported, current storage, package, migration,
   and identity-history checks for the exact candidate commit.
3. Review provenance, license inventory, SBOMs, vulnerability triage, WordPress.org metadata, and
   owner hardware acceptance.
4. Confirm the legacy and public-directory candidates remain separate packages and are not installed
   together.
5. Obtain explicit owner approval for version, tag, publication, GitHub release assets, contacts,
   screenshots, WordPress.org listing, and SVN deployment.

## Build and verify

```bash
bin/release-supply-chain.sh
sha256sum -c build/release/SHA256SUMS
jq -e '.bomFormat == "CycloneDX"' build/release/*.cdx.json
jq -e '.spdxVersion' build/release/*.spdx.json
```

The process builds both fixed-timestamp allowlisted ZIPs, verifies their manifests, generates
CycloneDX/SPDX runtime SBOMs from ZIP extraction, records file hashes/provenance, and scans release
artifacts. Development dependencies are not runtime dependencies and are not shipped in either ZIP.

## Approved publication only

The manual `release.yml` workflow is environment-gated and prepares artifacts/provenance only when
its approval input and GitHub Environment approval are supplied. A separate owner-approved action
must create an annotated/signed tag and GitHub Release. Verify downloaded asset hashes and
attestation/provenance before announcing a release.

## Rollback

Do not delete a published release to roll back a bad plugin build. Publish a corrected higher version
or explicitly mark the bad release as pre-release/withdrawn after owner review. For a site rollback,
deactivate the candidate, restore the backed-up settings if needed, and reactivate the previously
approved package. Never activate legacy and public-directory copies together.

## WordPress.org

WordPress.org SVN deployment is separately manual and environment-gated. It requires an accepted
listing, official slug, approved credentials, approved screenshots/assets, a matching release tag,
and owner approval. GitHub remains canonical development source. The workflow must never print SVN
credentials or deploy ordinary PR commits.
