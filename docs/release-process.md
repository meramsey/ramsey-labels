# Release process — manual approval required

1. Work on engineering branches, never rewrite history or push protected branches.
2. Resolve every gate in release-readiness.md and wordpress-org-submission.md.
3. Run unit, integration, browser, static, standards, Plugin Check, audit and secret/license checks.
4. Verify the oldest supported combination and current stable; test HPOS and legacy storage.
5. Test file replacement from RC8 with saved custom templates and print profiles.
6. Build `python3 bin/build.py` twice; byte-for-byte hashes must match. The archive uses a fixed
   timestamp, sorted manifest, standard permissions and a single legacy top-level folder.
7. Install the built ZIP in a fresh isolated WordPress volume; activate, check the installed
   package (not developer checkout), and repeat critical browser/regression tests.
8. Review archive contents, metadata and checksum. No .git, RC8 archive, tests, dependencies,
   environment files, logs, screenshots, usernames or local paths may be included.
9. Record exact commit, tool versions, test evidence, artifact hash and unresolved manual acceptance.
10. Obtain explicit owner approval for branding, licensing, slug/migration, support contact,
    publication, push/tag/release and directory submission. These are separate approvals.

The first recoverable baseline commit inherited the workstation's auto-configured author
name/email. Review that Git metadata for publication privacy. Preserve it as source history;
do not rewrite the checkpoint to hide the prior identity.

The initial preservation commit used the workstation's automatically configured author
identity. Review that commit metadata for privacy before any public push. This engineering
pass does not rewrite the recoverable baseline history to conceal it.

CI only uploads a candidate artifact after all dependency jobs pass. The manual workflow has
no write token or deployment step; it does not create a GitHub Release or submit to WordPress.org.
Do not call an uploaded Actions artifact a published release. Release assets/checksums must
match the reviewed commit; don't add production configuration to the source tree.
