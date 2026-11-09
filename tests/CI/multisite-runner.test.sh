#!/usr/bin/env bash
set -euo pipefail
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat > "$tmp/bin/docker" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' 'http://127.0.0.1/second/'
MOCK
cat > "$tmp/bin/npm" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' 'synthetic browser assertion failure'
exit 23
MOCK
chmod +x "$tmp/bin/"*
cd "$tmp"
status=0
PATH="$tmp/bin:$PATH" bash "$root/bin/multisite-test.sh" > console.txt 2>&1 || status=$?
[[ $status == 23 ]]
grep -q 'synthetic browser assertion failure' console.txt
grep -q 'synthetic browser assertion failure' build/rc11-reports/multisite-ui.txt
echo 'PASS: multisite failure remains nonzero and is retained in console and artifact log.'
