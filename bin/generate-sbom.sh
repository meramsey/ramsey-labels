#!/usr/bin/env bash
# Generate release-runtime SBOMs from an exact installable ZIP, never from dev dependencies.
set -euo pipefail
zip_path=${1:?Usage: generate-sbom.sh <plugin.zip> <output-dir> [artifact-manifest.json]}
out_dir=${2:?Usage: generate-sbom.sh <plugin.zip> <output-dir> [artifact-manifest.json]}
manifest=${3:-}
syft_image='anchore/syft@sha256:3c70e6d5979364cefdc22b51617a78fd264574d3bd6b4f84a351204147025e2a'
[[ -f "$zip_path" ]] || { printf 'Missing ZIP: %s\n' "$zip_path" >&2; exit 1; }
mkdir -p "$out_dir"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
unzip -q "$zip_path" -d "$tmp/extract"
root=$(find "$tmp/extract" -mindepth 1 -maxdepth 1 -type d | head -n 1)
[[ -n "$root" ]] || { printf '%s\n' 'ZIP must contain one plugin directory.' >&2; exit 1; }
base=$(basename "$zip_path" .zip)
version=${base##*-}
docker run --rm -v "$tmp/extract:/input:ro" -v "$(realpath "$out_dir"):/out" "$syft_image" "dir:/input/$(basename "$root")" --source-name "$base" --source-version "$version" -o "cyclonedx-json=/out/${base}.cdx.json" -o "spdx-json=/out/${base}.spdx.json" >/dev/null
jq -e '.bomFormat == "CycloneDX" and .specVersion' "$out_dir/${base}.cdx.json" >/dev/null
jq -e '.spdxVersion and .packages' "$out_dir/${base}.spdx.json" >/dev/null
python3 - "$zip_path" "$root" "$manifest" "$out_dir/${base}.provenance.json" <<'PY'
import hashlib,json,pathlib,subprocess,sys
zip_path,root,manifest,out=map(pathlib.Path,sys.argv[1:])
files=[]
for path in sorted(root.rglob('*')):
    if path.is_file():
        files.append({'path':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
data={'artifact':zip_path.name,'artifact_sha256':hashlib.sha256(zip_path.read_bytes()).hexdigest(),'runtime_file_inventory':files,'runtime_dependency_policy':'No npm, Composer, or third-party runtime packages are shipped in the installable ZIP.','sbom_tool':'anchore/syft v1.57.0','sbom_image':'anchore/syft@sha256:3c70e6d5979364cefdc22b51617a78fd264574d3bd6b4f84a351204147025e2a'}
if manifest:
    supplied=json.loads(manifest.read_text())
    data['release_manifest']=manifest.name
    data['source_commit']=supplied.get('commit')
    data['manifest_file_count']=len(supplied.get('files',{}))
    if {entry['path']:entry['sha256'] for entry in files} != supplied.get('files',{}):
        raise SystemExit('Extracted ZIP file inventory does not match release manifest')
pathlib.Path(out).write_text(json.dumps(data,indent=2)+'\n')
PY
sha256sum "$out_dir/${base}.cdx.json" "$out_dir/${base}.spdx.json" "$out_dir/${base}.provenance.json" > "$out_dir/${base}.sbom.sha256"
printf 'PASS: %s runtime SBOMs and manifest inventory verified in %s\n' "$base" "$out_dir"
