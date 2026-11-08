#!/usr/bin/env bash
# Install repository-local, composable hooks without overwriting existing active hooks.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
cd "$root"
name=$(git config --global --get user.name || true)
email=$(git config --global --get user.email || true)
if [[ -z "$name" || -z "$email" ]]; then
    printf '%s\n' 'Cannot install identity guards: configure and verify global user.name and user.email first.' >&2
    exit 1
fi
current=$(git config --get core.hooksPath || true)
if [[ -n "$current" && "$current" != .githooks ]]; then
    printf 'Cannot install identity guards: active core.hooksPath is %s. Compose or migrate it explicitly; nothing changed.\n' "$current" >&2
    exit 1
fi
for hook in .git/hooks/pre-commit .git/hooks/pre-push; do
    [[ -e "$hook" && ! -f "$hook.sample" ]] && {
        printf 'Cannot install identity guards: existing hook %s would be bypassed. Move it into .githooks/*.d explicitly; nothing changed.\n' "$hook" >&2
        exit 1
    }
done
mkdir -p .githooks/pre-commit.d .githooks/pre-push.d
git config --local ramseyLabelsIdentity.name "$name"
git config --local ramseyLabelsIdentity.email "$email"
git config --local core.hooksPath .githooks
printf 'Installed composable identity hooks for %s <%s>.\n' "$name" "$email"
