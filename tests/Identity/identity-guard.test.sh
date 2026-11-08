#!/usr/bin/env bash
set -euo pipefail
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/repo"
cd "$tmp/repo"
git init -q
git config user.name 'Michael Ramsey'
git config user.email 'mike@hackerdise.me'
git config ramseyLabelsIdentity.name 'Michael Ramsey'
git config ramseyLabelsIdentity.email 'mike@hackerdise.me'
printf 'fixture\n' > fixture.txt
git add fixture.txt
git commit -qm permitted
RLI_EXPECTED_GIT_NAME='Michael Ramsey' RLI_EXPECTED_GIT_EMAIL='mike@hackerdise.me' "$root/bin/check-git-identity.sh"
RLI_EXPECTED_GIT_NAME='Michael Ramsey' RLI_EXPECTED_GIT_EMAIL='mike@hackerdise.me' "$root/bin/check-git-identity.sh" --commit-range --all
if GIT_AUTHOR_NAME='Wrong Person' GIT_AUTHOR_EMAIL='wrong@example.invalid' RLI_EXPECTED_GIT_NAME='Michael Ramsey' RLI_EXPECTED_GIT_EMAIL='mike@hackerdise.me' "$root/bin/check-git-identity.sh"; then
    printf '%s\n' 'Expected author override rejection did not occur.' >&2
    exit 1
fi
git -c user.name='Michael Ramsey' -c user.email='mike@pop-os.localdomain' commit --allow-empty -qm retired-identity
if RLI_EXPECTED_GIT_NAME='Michael Ramsey' RLI_EXPECTED_GIT_EMAIL='mike@hackerdise.me' "$root/bin/check-git-identity.sh" --commit-range --all; then
    printf '%s\n' 'Expected retired identity rejection did not occur.' >&2
    exit 1
fi
echo 'PASS: identity guard accepts owner identity and rejects overrides/retired identity.'
