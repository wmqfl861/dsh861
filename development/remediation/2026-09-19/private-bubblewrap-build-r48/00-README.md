# private-bubblewrap-build-r48

r48 evidence tree: the task-private source-build candidate replacing the r47 CVE-listed bubblewrap pin (`73263df` base, PR #13 draft). Authoritative inputs: PR #13 issuecomments 5740293063 (execution) and 5740288027 (disposition), read via credential-less api.github.com REST before any edit.

- [inputs-verified.md](inputs-verified.md) — the three-input trust chains (bubblewrap 0.12.0, Meson 1.12.0, libcap-dev 1:2.66-5ubuntu2.4): sources, publisher-recorded digests, signed-index/gpgv chain, member audits, static-library contents, the `libcap.pc` libdir quirk and its handling.
- [windows-execution/00-start-state.md](windows-execution/00-start-state.md) — verified starting state (branch, HEAD, remote, blobs, preserved untracked inputs).
- [windows-execution/FINDINGS.md](windows-execution/FINDINGS.md) — scope changed, candidate behavior, regression iterations, negative controls, gates, NOT_RUN boundaries.
- [windows-execution/logs-r48/](windows-execution/logs-r48/) — raw download/audit/gpgv/spec/NC/gate logs, one file per physical run, exit codes recorded in-file.
- [windows-execution/mutations/](windows-execution/mutations/) — fixed-candidate and mutant byte copies with the blob/SHA-256 manifest.
- [comment-draft.md](comment-draft.md) — the PR comment draft for the main session to publish.

Raw artifacts (tarballs, deb, index files, transient keyring, NC harness) stay outside the repository in `C:\dsh-r48-tqt3s7\`. No package was installed on any host; the libcap deb was never installed or executed, only extracted as data into the round-private tree.
