# r47 second-executor final state (2026-09-19 ~12:15 UTC)

## Gate summary (all re-executed by this session; argv + exits in the paired logs)

| Gate | Command (exact) | Exit | Result |
| --- | --- | --- | --- |
| Spec, canonical-equivalent | `C:\dsh-r24-upgrade-20260912-01\pnpm-12.4.1\pnpm.exe exec vitest run --project thread-safe scripts/prepare-ci-bubblewrap.spec.ts` | 0 | 13 passed (13) |
| Spec, direct entry + verbose | `node node_modules/vitest/vitest.mjs run --project thread-safe scripts/prepare-ci-bubblewrap.spec.ts --reporter=verbose` | 0 | 13 passed (13), all 13 test names listed |
| NC-old-location | driver `nc-driver.mjs` (pre-state check → mutant apply → vitest → restore in finally) | 0 (driver) / 1 (vitest) | 6 failed \| 7 passed (13); mutant SHA `a8cbf0986a813afe6d0178a954b552689de85cdb4889bf7b4101f3430e0f18f3`; restore byte-identical |
| NC restored positive (after NC1) | `node node_modules/vitest/vitest.mjs run --project thread-safe scripts/prepare-ci-bubblewrap.spec.ts` | 0 | 13 passed (13) |
| NC-ignore-integrity | same driver contract | 0 (driver) / 1 (vitest) | 1 failed \| 12 passed (13); digest test `expected +0 to be 1` (mutant crossed the check into extraction); mutant SHA `fc8571e6a2ff4e0857bbe326e7aaf7807700ce43998145b9ab93a05b89901046`; restore byte-identical |
| NC restored positive (after NC2) | same direct entry | 0 | 13 passed (13) |
| Bash syntax | `bash -n` on working script, NC1 mutant, NC2 mutant (GNU bash 5.3.15) | 0 / 0 / 0 | all syntactically valid — NC failures are behavioral |
| Staged lint | `node scripts/run-oxlint.ts --config .oxlintrc.staged.json scripts/prepare-ci-bubblewrap.spec.ts` | 0 | 0 warnings / 0 errors (49 rules) |
| Typecheck | prefix `pnpm.exe run typecheck` → `npm run build:lib:host && npm run typecheck:contracts-ready` | 0 | build (tsc -b tsconfig.host.json + tsdown) then `tsc -b tsconfig.client.json` clean |
| Translation pairing | `node node_modules/tsx/dist/cli.mjs scripts/verify-translation-pairing.ts` | 0 | 849 pairs checked, all consistent |

## Final identities

- `scripts/prepare-ci-bubblewrap.sh`: SHA-256 `37a96d504e589ec40f66b657d8af347898013c5e5ee0cca4df0ef6df10bf371a`, git blob `b191445819ffdcab1d0edf698f999b564b6ebb2e`, 1795 B — identical to the fixed candidate after both mutations were applied and restored (verified by SHA + byte-compare after each NC and again now).
- `scripts/prepare-ci-bubblewrap.spec.ts`: SHA-256 `2ea9ae86e4f055011f5fd2ed4b640165deec8a5ff7c652691f786c44c66d7c86`, 15594 B — unchanged from the concurrent session's final bytes.
- `git diff --stat`: `scripts/prepare-ci-bubblewrap.sh | 5 ++++- — 1 file changed, 4 insertions(+), 1 deletion(-)` — the only tracked change.

## Final `git status --porcelain` (verbatim)

```
 M scripts/prepare-ci-bubblewrap.sh
?? .agents/notes/implemented/bug-fix/2026-09-19-ci-bubblewrap-acquisition-r47.i18n.yaml
?? .agents/notes/implemented/bug-fix/2026-09-19-ci-bubblewrap-acquisition-r47.md
?? .agents/notes/implemented/bug-fix/2026-09-19-ci-bubblewrap-acquisition-r47.zh.md
?? development/remediation/2026-09-17/production-teardown-r44/planning/cli-availability-probe.md
?? development/remediation/2026-09-17/production-teardown-r44/review/BLOCKED-opencode-hard-review.md
?? development/remediation/2026-09-17/production-teardown-r44/windows-execution/01-first-failure.normalized.log
?? development/remediation/2026-09-19/ci-bubblewrap-acquisition-r47/
?? scripts/prepare-ci-bubblewrap.spec.ts
```

Same shape as the hand-off start state plus this session's `logs-r47b/` inside
the r47 evidence tree; the three r44 preserved artifacts remain untouched.

## Out-of-repo artifacts

`C:\dsh-r47b-impl-tmp\` (temp + raw unstripped logs + `nc-driver.mjs`) and the
r44-era prefix `C:\dsh-r24-upgrade-20260912-01\` (read-only use of its pnpm
12.4.1) — both outside the repository; nothing there is required by the delivery
and the temp dir may be discarded. No commit, push, reset, rebase, amend, stash,
clean, CI trigger, or credential read happened in this session; the prepare
script was never run bare; no real sudo/sysctl/bwrap/dpkg-deb/curl/network call
ever executed on this host (all external effects were PATH-confined test stubs).
