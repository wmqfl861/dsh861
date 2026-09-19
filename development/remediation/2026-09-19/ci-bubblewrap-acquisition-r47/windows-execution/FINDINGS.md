# r47 windows-execution findings: same-byte bubblewrap acquisition restored from Ubuntu's pinned-time snapshot

Round: r47 (CI bubblewrap acquisition). Base HEAD `f20ca4b97f9c3babb05b95e96a04e09031f92806` on `chore/latest-stable-upgrade-20260912`; PR #13 stays draft, base `feat/multi-agent-company-nodes` unchanged, P0-B blocked. Local toolchain: Node v26.8.2 + pnpm 12.4.1 from the dual-directory prefix `C:\dsh-r24-upgrade-20260912-01` (CI runs Node 26.9.0/pnpm 12.4.1; difference recorded, not upgraded). Local OS: Windows 10.0.26200 x64, Git Bash as the POSIX shell. All times UTC. Start state verified in [00-start-state.md](00-start-state.md) before any edit.

## Scope actually changed

| File | Start blob | End blob | Change |
| --- | --- | --- | --- |
| `scripts/prepare-ci-bubblewrap.sh` | `1efaee200a1bd338ac8d2fe9e32dc7df98dc5884` (1544 B, SHA-256 `fbc80fc6d125c494cbf1b6159718acce024e81517c22e9fc34e81b9bed7966f8`) | `b191445819ffdcab1d0edf698f999b564b6ebb2e` (1795 B, SHA-256 `37a96d504e589ec40f66b657d8af347898013c5e5ee0cca4df0ef6df10bf371a`) | URL switched from the dead rolling pool to the pinned-time official snapshot + 3-line source note (`git diff`: 4 insertions, 1 deletion) |
| `scripts/prepare-ci-bubblewrap.spec.ts` | new | (see [mutations/MANIFEST.md](mutations/MANIFEST.md) discipline; final bytes verified by the runs below) | direct regression: 13 tests, real script, stubbed external effects |
| `.agents/notes/implemented/bug-fix/2026-09-19-ci-bubblewrap-acquisition-r47.md` + `.zh.md` + `.i18n.yaml` | new | — | paired bilingual Agent Note |
| `development/remediation/2026-09-19/ci-bubblewrap-acquisition-r47/**` | new | — | this evidence tree |

Version `0.9.0-1ubuntu0.1` and SHA-256 `1b506492…db562a` are byte-identical to the start state; curl flags, checksum-before-extraction order, platform/environment gates, tolerated-sysctl behavior, functional probe, and all failure exits are unchanged. Nothing in `packages/`, workflows, lockfiles, golden/replay/Session data, the r43 observer, r44-r46 fixes, or historical evidence was touched; the three r44 preserved originals remain untracked and in place.

## Real acquisition (before any URL edit; full record in [logs/00-acquisition-record.md](logs/00-acquisition-record.md))

`https://snapshot.ubuntu.com/ubuntu/20260901T000000Z/pool/main/b/bubblewrap/bubblewrap_0.9.0-1ubuntu0.1_amd64.deb` returned HTTP 200 with zero redirects (nginx/1.18.0 Ubuntu, `content-type: application/x-debian-package`), 50178 bytes on disk matching `content-length`, curl exit 0. Git Bash `sha256sum` and PowerShell `Get-FileHash` both produced `1b506492bd9c7fd0cdb4f02ac822f1d3e336b0aead5113c1239baf8db5db562a`, exactly the pinned value; no hash was written back to manufacture a match. A read-only member listing (Windows bsdtar) confirmed a well-formed deb whose control member carries `Package: bubblewrap` / `Version: 0.9.0-1ubuntu0.1` / `Architecture: amd64`. The package was not installed or executed; `data.tar.zst` was never extracted; the artifact stays outside the repository at `C:\dsh-r47-9f3k2m7q\`.

## Policy conclusion

Conclusion (c) — not covered: no repository policy text addresses acquiring a CVE-listed pinned CI payload. Search scope, citations, and the conservative handling (working-tree output only, nothing committed or pushed, owner decides after independent review) are recorded in [policy-conclusion.md](policy-conclusion.md).

## First failure, fix, regression, and negative controls

All Vitest runs used the direct entry `node node_modules/vitest/vitest.mjs run --project thread-safe scripts/prepare-ci-bubblewrap.spec.ts` with `TMP`/`TEMP` = `C:\dsh-r47-9f3k2m7q\tmp` (r45 finding A: the `pnpm exec` wrapper is not used; the canonical command is NOT claimed as passed). The suite self-skips where no POSIX/Git Bash exists, matching the repo's bash-requiring suite convention; on this host it executed.

- First failure on the unmodified script: [logs/01-first-failure-original-bytes.log](logs/01-first-failure-original-bytes.log) — vitest exit 1, 6 failed / 7 passed of 13. Every `curl ok` scenario observed the script request the dead `archive.ubuntu.com` URL and got the controlled 404/22 refusal, exactly the CI first-failure shape (run 35413575204, step exit 22), offline and deterministic; the source-level pin assertion failed on the URL literal.
- Positive on fixed bytes: [logs/02-positive-fixed-bytes.log](logs/02-positive-fixed-bytes.log) exit 0 (13/13), re-confirmed on final spec bytes in [logs/15-spec-final.log](logs/15-spec-final.log).
- Thirteen registered tests cover the eight required behavior classes: end-to-end success from the verified source (call order `uname,uname,curl,sha256sum,dpkg-deb,sudo,bwrap,bwrap`, single success line, `GITHUB_PATH` publication, digest input containing the pinned SHA and archive name), tolerated absent sysctl knob, 404 stop (22) and connection-failure stop (7) with no later phase invoked, digest-mismatch rejection (1) before any extraction or publication, extraction failure (2) before privilege/probe, fatal probe failure (17) with no success line — while asserting the pre-probe `GITHUB_PATH` write happened and is not probe success, non-Linux and non-x86_64 refusal (1) before any download, and missing `RUNNER_TEMP` / `GITHUB_PATH` failing loud (1) before any download.
- NC-old-location: [logs/03-nc1-old-location-mutant.log](logs/03-nc1-old-location-mutant.log) exit 1 (6 failed / 7 passed) with the mutant syntax-valid (`bash -n` 0) — the provenance regression rejects the dead source, not a syntax error. Restored byte-identically (`cmp` 0, blob/SHA re-verified); [logs/04-nc1-restored-positive.log](logs/04-nc1-restored-positive.log) exit 0 (13/13).
- NC-ignore-integrity: [logs/05-nc2-ignore-integrity-mutant.log](logs/05-nc2-ignore-integrity-mutant.log) exit 1 with exactly the digest-mismatch test failing — expected exit 1, received 0 because the `|| true` mutant crossed the checksum into extraction (detected via the stub-observed `dpkg-deb` invocation, not a source string search); syntax-valid. Restored byte-identically; [logs/06-nc2-restored-positive.log](logs/06-nc2-restored-positive.log) exit 0 (13/13).
- Full byte/blob/SHA-256 record for every state: [mutations/MANIFEST.md](mutations/MANIFEST.md); mutant and fixed-candidate byte copies committed under `mutations/`. Mutations ran only inside the fully stubbed environment; the real download was never re-verified with checks skipped.

A stub "hash match" proves control flow only; the real payload identity is the acquisition record's dual-tool SHA-256 match. All writes stayed in per-run random temporary directories removed in `afterAll`; no real sudo/sysctl/bwrap/dpkg-deb/curl ever ran on this host and the prepare script was never run bare.

## Gates (final bytes)

- `bash -n scripts/prepare-ci-bubblewrap.sh`: exit 0 on the fixed candidate (and on both mutants).
- `pnpm run typecheck`: exit 0 ([logs/07-typecheck.log](logs/07-typecheck.log)).
- `pnpm run lint`: first attempt [logs/08-lint.log](logs/08-lint.log) exit 1 caught six `@stylistic(arrow-parens)` violations in the new spec (single-argument arrows with redundant parentheses); fixed, [logs/13-lint-r2.log](logs/13-lint-r2.log) exit 0 with 0 warnings / 0 errors.
- Duplication: `node node_modules/jscpd/run-jscpd.js --config .jscpd.json packages scripts` exit 0, 0 clones ([logs/14-duplication.log](logs/14-duplication.log)).
- Bilingual pairing: `pnpm run verify-translation-pairing --write .agents/notes/implemented/bug-fix/2026-09-19-ci-bubblewrap-acquisition-r47.md` recorded the pair ([logs/11-translation-pairing-write-r2.log](logs/11-translation-pairing-write-r2.log)); the first check attempt ([logs/10-translation-pairing-check.log](logs/10-translation-pairing-check.log)) caught the zh language-switcher line in the wrong order (`中文 | [English]` instead of `[English] | 中文`), fixed, full check [logs/12-translation-pairing-check-r2.log](logs/12-translation-pairing-check-r2.log) exit 0 — 849 pairs consistent.
- Documentation gates: `pnpm run test:docs` (doc-quick aggregate) — [logs/16-doc-quick.log](logs/16-doc-quick.log).
- Commit-time hooks: not exercised (the round stops before commit by instruction and by the (c) policy conclusion).

## NOT_RUN / explicit limits

- The real Linux unpack, sysctl behavior, and bwrap functional probe: NOT_RUN locally; they remain owned by the original CI on its ephemeral runners. Local stubs prove control flow only, and acquisition restoration does not promise the whole CI turns green — the schema/snapshot/coverage findings remain owned by the new runs.
- UBUNTU-CVE-2026-87766 is NOT closed: 0.9.0-1ubuntu0.1 is still a CVE-listed pin; this round is an acquisition restoration, not a security upgrade; the upgrade stage and P0-B stay blocked. Minimal version-migration proposal (for a future round): pin a verified fixed Noble build with its own official source and SHA-256, check `libc6`/`libcap2`/`libselinux1` compatibility on the runner image, re-run the functional probe under CI, then remove the CVE caveat.
- Preserved out of scope, untouched: subagent pwsh/bash tool-schema platform difference, the two Windows CI failures (gen-client-catalog timeout, adapter EPERM), r45 A/B, coverage shortfalls, old Chinese line-number findings.
- No commit, no push, no CI rerun/cancel, no external agents, no credentials/keys/user `.env` read, no real model API or E2B invoked, no software installed, no reset/rebase/amend/stash/clean.
