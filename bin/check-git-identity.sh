#!/usr/bin/env bash
# Validate the configured maintainer identity without rejecting legitimate external contributors.
set -euo pipefail

repo=$(git rev-parse --show-toplevel)
cd "$repo"
expected_name=${RLI_EXPECTED_GIT_NAME:-$(git config --local --get ramseyLabelsIdentity.name || true)}
expected_email=${RLI_EXPECTED_GIT_EMAIL:-$(git config --local --get ramseyLabelsIdentity.email || true)}

if [[ -z "$expected_name" || -z "$expected_email" ]]; then
    printf '%s\n' 'Identity guard: expected maintainer identity is not configured.' >&2
    printf '%s\n' 'Run bin/install-git-identity-guards.sh from a shell with the verified global Git identity.' >&2
    exit 1
fi

parse_ident() {
    local ident=$1
    local email=${ident##*<}
    email=${email%%>*}
    local name=${ident%% <*}
    printf '%s\t%s\n' "$name" "$email"
}

reject_known_bad() {
    local role=$1 name=$2 email=$3 commit=${4:-working tree}
    case "$email" in
        mike@pop-os.localdomain|engineering@example.invalid)
            printf 'Identity guard: %s on %s uses retired identity %s <%s>.\n' "$role" "$commit" "$name" "$email" >&2
            exit 1
            ;;
    esac
    if [[ "$email" == "$expected_email" && "$name" != "$expected_name" ]]; then
        printf 'Identity guard: %s on %s uses owner email with unexpected name %s.\n' "$role" "$commit" "$name" >&2
        exit 1
    fi
}

check_current() {
    for variable in GIT_AUTHOR_NAME GIT_COMMITTER_NAME; do
        if [[ -n ${!variable:-} && ${!variable} != "$expected_name" ]]; then
            printf 'Identity guard: %s override is %s; expected %s.\n' "$variable" "${!variable}" "$expected_name" >&2
            exit 1
        fi
    done
    for variable in GIT_AUTHOR_EMAIL GIT_COMMITTER_EMAIL; do
        if [[ -n ${!variable:-} && ${!variable} != "$expected_email" ]]; then
            printf 'Identity guard: %s override does not match the verified owner email.\n' "$variable" >&2
            exit 1
        fi
    done
    IFS=$'\t' read -r author_name author_email < <(parse_ident "$(git var GIT_AUTHOR_IDENT)")
    IFS=$'\t' read -r committer_name committer_email < <(parse_ident "$(git var GIT_COMMITTER_IDENT)")
    [[ "$author_name" == "$expected_name" && "$author_email" == "$expected_email" ]] || {
        printf 'Identity guard: effective author is %s <%s>; expected %s <%s>.\n' "$author_name" "$author_email" "$expected_name" "$expected_email" >&2
        exit 1
    }
    [[ "$committer_name" == "$expected_name" && "$committer_email" == "$expected_email" ]] || {
        printf 'Identity guard: effective committer is %s <%s>; expected %s <%s>.\n' "$committer_name" "$committer_email" "$expected_name" "$expected_email" >&2
        exit 1
    }
}

check_range() {
    local range=$1 commit author_name author_email committer_name committer_email
    while IFS= read -r commit; do
        IFS=$'\t' read -r author_name author_email < <(parse_ident "$(git show -s --format='%an <%ae>' "$commit")")
        IFS=$'\t' read -r committer_name committer_email < <(parse_ident "$(git show -s --format='%cn <%ce>' "$commit")")
        reject_known_bad author "$author_name" "$author_email" "$commit"
        reject_known_bad committer "$committer_name" "$committer_email" "$commit"
    done < <(git rev-list "$range")
}

case ${1:-} in
    '') check_current ;;
    --commit-range)
        [[ $# -eq 2 ]] || { printf '%s\n' 'Usage: check-git-identity.sh --commit-range <range>' >&2; exit 2; }
        check_range "$2"
        ;;
    *) printf '%s\n' 'Usage: check-git-identity.sh [--commit-range <range>]' >&2; exit 2 ;;
esac
