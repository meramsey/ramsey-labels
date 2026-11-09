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

# Work on clean fixture history so retired identities cannot mask these assertions.
git checkout -q --orphan web-merge-fixture
git -c user.name='Michael Ramsey' -c user.email='mike@hackerdise.me' commit -qm base
base=$(git rev-parse HEAD)
git checkout -qb topic
git -c user.name='Michael Ramsey' -c user.email='mike@hackerdise.me' commit --allow-empty -qm topic
git checkout -q web-merge-fixture
GIT_AUTHOR_NAME='Mik Ram' GIT_AUTHOR_EMAIL='mike@hackerdise.me' GIT_COMMITTER_NAME='GitHub' GIT_COMMITTER_EMAIL='noreply@github.com' git merge --no-ff -qm web-merge topic
mkdir "$tmp/bin"
cat > "$tmp/bin/gh" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "${MOCK_VERIFIED:-false}"
MOCK
chmod +x "$tmp/bin/gh"
export PATH="$tmp/bin:$PATH"
export RLI_GITHUB_REPOSITORY=meramsey/ramsey-labels
if MOCK_VERIFIED=false "$root/bin/check-git-identity.sh" --commit-range "$base..HEAD"; then
    echo 'Unverified web merge was accepted.' >&2; exit 1
fi
MOCK_VERIFIED=true "$root/bin/check-git-identity.sh" --commit-range "$base..HEAD"
if MOCK_VERIFIED=true RLI_GITHUB_REPOSITORY=attacker/repo "$root/bin/check-git-identity.sh" --commit-range "$base..HEAD"; then
    echo 'Untrusted repository was accepted.' >&2; exit 1
fi
GIT_AUTHOR_NAME='Mik Ram' GIT_AUTHOR_EMAIL='mike@hackerdise.me' GIT_COMMITTER_NAME='GitHub' GIT_COMMITTER_EMAIL='noreply@github.com' git commit --allow-empty -qm forged-nonmerge
if MOCK_VERIFIED=true "$root/bin/check-git-identity.sh" --commit-range HEAD^..HEAD; then
    echo 'Nonmerge display-name exception was accepted.' >&2; exit 1
fi
if "$root/bin/check-git-identity.sh" --commit-range missing-ref; then
    echo 'Invalid commit range was accepted.' >&2; exit 1
fi
echo 'PASS: web merge exception requires verified provenance and does not relax local identity.'
