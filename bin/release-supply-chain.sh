#!/usr/bin/env bash
# Build deterministic candidates and release-side metadata. This never tags or publishes.
set -euo pipefail
python3 bin/build.py
python3 bin/build-public.py
mkdir -p build/release
bin/generate-sbom.sh build/ramsey-labels-independent-1.0.0-rc.11.zip build/release build/artifact-manifest.json
bin/generate-sbom.sh build/public/ramsey-labels-1.0.0-rc.11.zip build/release build/public/artifact-manifest.json
sha256sum build/ramsey-labels-independent-1.0.0-rc.11.zip build/public/ramsey-labels-1.0.0-rc.11.zip > build/release/SHA256SUMS
printf '%s\n' 'PASS: deterministic ZIPs, manifests, runtime SBOMs, and checksums prepared; no tag or release created.'
