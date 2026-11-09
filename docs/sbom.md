# Software bill of materials

`bin/generate-sbom.sh` generates two runtime SBOM formats from an exact installable plugin ZIP:

- CycloneDX JSON (`*.cdx.json`)
- SPDX JSON (`*.spdx.json`)

It extracts the ZIP, verifies its file hashes against the build manifest, and records the artifact
SHA-256, source commit, Syft version/image digest, and runtime file inventory. It intentionally does
not claim npm/Composer development dependencies are runtime dependencies because neither is shipped
in the WordPress ZIP.

```bash
bin/release-supply-chain.sh
jq -e '.bomFormat == "CycloneDX"' build/release/*.cdx.json
jq -e '.spdxVersion' build/release/*.spdx.json
sha256sum -c build/release/*.sbom.sha256
```

Release workflows scan the exact ZIP and its SBOM before any approved publication. Users do not need
Syft, Trivy, or Cosign to install the plugin.
