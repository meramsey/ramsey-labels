# Git identity policy

Maintainer-owned Ramsey Labels commits must use the verified identity configured on the host:

```text
Michael Ramsey <mike@hackerdise.me>
```

The historical identities `mike@pop-os.localdomain` and `engineering@example.invalid` are retired
and rejected by the repository guard. Legitimate external contributors—including Dependabot—are
allowed; the guard only rejects known retired identities and a mismatched name using the maintainer
email.

## Install in a worktree

From a regular owner shell whose global Git identity has already been verified:

```bash
bin/install-git-identity-guards.sh
```

The installer records the expected identity in local Git config and sets a relative
`core.hooksPath=.githooks`, which works in linked worktrees. It refuses to bypass an existing active
hook path or non-sample `.git/hooks/pre-commit` / `pre-push` hook. Compose additional local checks
as executable scripts under `.githooks/pre-commit.d/` or `.githooks/pre-push.d/`.

The pre-commit hook checks the effective author/committer and rejects `GIT_AUTHOR_*` /
`GIT_COMMITTER_*` overrides. The pre-push hook examines commits being sent and rejects known retired
identities. CI runs the range check for repository history. API-created commits and deliberately
bypassed hooks require separate GitHub/organization policy enforcement.

## 2026-11-08 attribution correction

The owner authorized an attribution-only rewrite of the Ramsey Labels engineering history. Twenty
owner/project commits that used the retired local-domain or generic engineering identities were
rewritten to the identity above. The old-to-new mapping, preserved source-tree/date checks, and the
verified external recovery bundle checksum are recorded in
`docs/evidence/identity-rewrite-20261108.json`. Dependabot commits and refs were not rewritten.

History rewrites produce new commit IDs. Existing cryptographic signatures cannot survive an
attribution rewrite unchanged; no owner-authored commit in the rewritten lineage had a valid
signature. The recovery bundle is stored outside this repository and is not included in runtime
artifacts.
