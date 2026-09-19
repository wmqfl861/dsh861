# r45 windows-execution findings: expected suites select session logs by header identity

Round: r45 (session-log identity selection). Base HEAD `9f27326b07ace200c1f1447b191f67d8827e8b64` on `chore/latest-stable-upgrade-20260912`; PR #13 stays draft. Local toolchain: Node v26.8.2 + pnpm 12.4.1 from `C:\dsh-r24-upgrade-20260912-01` (CI ran Node 26.9.0/pnpm 12.4.1; local difference recorded, not upgraded). Local OS: Windows 10.0.26200 x64. All times UTC.

## Start state (verified before any edit)

- `git rev-parse HEAD` = `9f27326b07ace200c1f1447b191f67d8827e8b64`; branch `chore/latest-stable-upgrade-20260912`.
- `git ls-remote origin refs/heads/chore/latest-stable-upgrade-20260912` = same SHA (no remote drift; no fetch performed).
- Working tree: only the three declared r44 preserved artifacts untracked (planning/cli-availability-probe.md, review/BLOCKED-opencode-hard-review.md, windows-execution/01-first-failure.normalized.log); kept, not uploaded, not cleaned.
- Starting blobs verified against the r45 task comment: diagnostic `7cdb9a2e366fe527ec53d1bfe85adf67d10f6840`, inheritance `5317b3f347c6a0904d1ef33061f36afb09ffce42`, `vitest.expected.config.ts` `f81c25fc78e51796632f527f164c6c72c26a2a61`.
- Authoritative task comments read in full via credential-less `api.github.com` REST (HTTP 200): issue comments `5732095921` (A-H tasks) and `5732083557` (CI forensics).

## Baseline (before modifying the two target files)

Canonical command, physical run 1 (`01-baseline.stdout.log`, exit 1): both suites failed `did not exit within 30s` with completely empty stdout and stderr; killed at the loader-smoke default process timeout.

Canonical command, physical run 2 (`02-baseline-run2.stdout.log`, exit 1): identical failure mode; not a cold-cache effect.

Single-file control (`03-diag-only.stdout.log`, exit 1): same 30s zero-output timeout with no parallel suite, ruling out worker contention.

Badge control (`04-badge-control.stdout.log`, exit 1): `dsh-badge.expected.e2e.ts` booted and ran to a real assertion diff in 12.9s (unescaped Windows asset path in its golden — pre-existing, out of scope), proving small assembled apps boot under the same worker.

## Local environment diagnosis (temporary in-repo diagnostic spec, used then deleted)

A throwaway `r45-diag.expected.e2e.ts` (created under `apps/cli/tests/profiles/headless/tests/`, run, and deleted; final `git status` proves absence) ran staged probes inside the real Vitest worker. Findings, logs `05` through `13`:

- The same execa spawn that hangs in-worker completes in ~8s from a plain shell; the entire worker environment applied from a plain shell also completes in ~8s; an IPC-forked parent spawning the child also completes. Environment and fork context are exonerated.
- In-worker, `node -e`, ESM `node -e`, and `node --import tsx -e` children all print and exit in <0.3s, and importing the headless driver without config args exits with the driver's expected argv error in 0.8s. The hang appears only when the driver receives config args and boots the profile.
- Probes without a temp `DSH_HOME` fail fast with `atomic-write: timed out waiting for the writer lock at C:\Users\Joyce Gu\.dsh\profiles\node_modules.lock`; the equivalent probe with a fresh temp `DSH_HOME` (the real tests' shape) hangs silently past 35s. The boot's profile node_modules installation blocks under a `pnpm exec`-parented worker.
- Discriminating run: invoking Vitest directly (`node node_modules/vitest/vitest.mjs run --config vitest.expected.config.ts ...`) executes both suites to completion in ~8s each. The canonical `pnpm exec vitest` wrapper is what starves the grandchild's profile install. Post-fix canonical rerun (`16-fixed-canonical.log`, exit 1) reproduces the same two 30s zero-output timeouts, confirming the hang is independent of the selector change. The independent review accepted this finding on the strength of the recorded log chain without reproducing it live — a reproduction requires waiting out a >60s hang.
- With the direct invocation on the default (spaced) TMP, the diagnostic suite's golden compare fails on `{{cwd}}` tokenization of the Windows backslash temp path (`12-no-pnpm-exec.log`, `13-baseline-direct-spaceless.log`); redirecting TMP/TEMP to the spaceless ASCII `C:\dsh-r45-tmp` does not change that gap, so it is not a spaces problem. Inheritance passed fully under the old selector in that vehicle because the fixture holds exactly one child and `readdir` happened to list the parent first — the selector defect stayed unproven by the real suites locally and is instead proven deterministically by the new spec.

Both findings (pnpm-exec-parented profile-install hang; Windows-path `{{cwd}}` non-tokenization inside the workspace-write policy text) are preserved as local first failures. They are not addressed in r45: the fix scope is the two tests' selection logic plus test-only helpers. Whether CI (POSIX temp paths, no pnpm-exec parent) hits either after the selector fix is for the new CI run to show; the r44-B receipt comment already notes the corrected set passing was never guaranteed.

`logs/` holds 42 normalized run logs in total — each physical run its own file, the manual-spawn diagnostics (`diag-spawn.log`, `diag-spawn2.log`, `diag-spawn3-noproxy.log`, `diag2-exec-a.log`) included. Recording-strength gap, recorded as such: the Vitest cycle logs (`logs/17`-`20`, `27`-`30`, `31`-`34`) carry no inline exit-code or hash stamp inside the log file itself; their exit codes are read from each log's Vitest summary lines and the surrounding shell transcripts, weaker evidence than the gate logs' explicit `*_EXIT:` markers. The byte/blob/SHA-256 record of every mutation cycle lives in `mutations/MANIFEST.md` instead.

## Fixed candidate

Files changed (blobs at start -> at end):

- `apps/cli/tests/profiles/headless/tests/subagent-diagnostic.expected.e2e.ts`: `7cdb9a2e366fe527ec53d1bfe85adf67d10f6840` -> blob `6ea72244b0acc322c29a27824702f3da224450e9` (SHA-256 `f43fa15bc3dae1b1effe2ce3108333a085f3e0047dcff649538e199f0fac3eb8`); diff +24/-16 lines of the pair.
- `apps/cli/tests/profiles/headless/tests/subagent-inheritance.expected.e2e.ts`: `5317b3f347c6a0904d1ef33061f36afb09ffce42` -> blob `e83a60a96849e52a3b90339a6995bb7f7190a852` (SHA-256 `51bc4c3632eeb7201ddd674b566ee3ba17d59fa5d8d6288e67bf6ec411e8afa5`).
- New `apps/cli/tests/profiles/headless/tests/session-log-identity.ts` (test-only selector module), final SHA-256 `7f8d3bd017156700a09f20344b4c3c02bc9216556116c9dcc25d915dbc8805f9`, git blob `efb67536b82b664551614ab9d173ecc4c7cf4f19`, LF, single trailing newline. (An earlier byte state `3c1a58cd...` failed strict typecheck on indexed access; the final bytes add explicit narrowing and destructure — see `logs/21-typecheck.log` vs `logs/21b-typecheck-r2.log`.)
- New `apps/cli/tests/profiles/headless/tests/session-log-identity.spec.ts` (deterministic regressions), final SHA-256 `3461471a06993d4464be7fbb8d31161331339f229d1970b7807fe74918158e38`, git blob `1c213fd770a8ef23431f7662fb1a3519f823ceaa`. (An earlier line exceeded the 140-column lint cap; `logs/22-lint.log` vs `logs/22b-lint-r2.log` record the fix.)

Selection is by the first JSONL record's durable identity: valid JSON object, `type: 'session'`, string `id` (malformed first records are rejected by source name and never skipped); the parent is the unique log asserting the target id (zero and duplicate are explicit failures naming sources); the child is the unique direct subagent candidate asserting the exact `parentSession`, its own id, and `origin: 'subagent'` (the diagnostic's pinned `childId` is asserted too). Both suites call the same selectors the spec exercises and consume the returned original bytes; the child's file and id are asserted distinct from the parent's.

## Physical runs after the fix (final bytes)

- `logs/31-spec-final2.log` (exit 0): spec via root `vitest.config.ts` (project `thread-safe`; non-zero discovery proven — the runner lists the file under the project): 15/15 passed.
- `logs/26-expected-final.log` (exit 1): both expected suites via direct Vitest invocation with `TMP=C:\dsh-r45-tmp` against the final helper bytes (`7f8d3bd0...`). Inheritance: PASSED fully (9.9s) — physical ENOENT, read-only delegation first record, exactly two policy contexts with all positive/negative text assertions, parent and child goldens, real write denial, final parent result, stderr empty. Diagnostic: the new identity assertions and the `[diagnostic: corrupt]` containment passed (parent correctly selected; seeded child correspondence verified through the pinned id), then the pre-existing local `{{cwd}}` tokenization gap failed the parent golden compare (first failure preserved at `expectSession`).
- `logs/16-fixed-canonical.log` (exit 1): canonical `pnpm exec` command post-fix — both suites time out at 30s with zero output (environmental hang, unchanged by the fix).

## Negative controls and restores (final bytes; full manifest in `mutations/MANIFEST.md`)

- NC-parent-text-match (`logs/32-nc1-final2-mutant.log`, exit 1): helper's parent selection mutated back to full-text `includes` first-find (mutant SHA-256 `68657d944a6ca5530adb0f684e1ad518d3b451179b8ce5106669dc6f1d0e0b6b`, blob `7737256b166f4d50d6d3e88bcb368e8ab1c57c34`). 6 of 15 spec tests failed on real assertions, including the required rejections: `selects the parent and its child under every enumeration order` failed with `order child.jsonl,parent.jsonl,...: expected 'child.jsonl' to be 'parent.jsonl'`, and `rejects a parent id that only event bodies reference` failed with `expected [Function] to throw an error`. Restore verified byte-identical (SHA-256 `7f8d3bd0...`, blob `efb67536...`).
- NC-child-any-parent (`logs/33-nc2-final2-mutant.log`, exit 1): child selection mutated back to any-`parentSession`-string first-find (mutant SHA-256 `601e4663af17f0b8d118f7f27d233857e42a39012b4359d17931650e632a286e`, blob `f8ace1d1dcda4f55e5010d5c06a63f303c78200b`); parent selection left correct. 8 of 15 spec tests failed on real assertions, including the required rejection: `does not select another parent's child even when it enumerates first` failed with `expected 'other-child.jsonl' to be 'child.jsonl'` (also the permutation order `parent.jsonl,reference.jsonl,other-child.jsonl,child.jsonl`). Restore verified byte-identical; post-restore positive `logs/34-final-restored-positive.log` exit 0, 15/15.
- Mutations were applied by exact single-occurrence block replacement and restores copied the saved original bytes back (both mutant files and the original are committed under `mutations/`); no checkout/reset/stash was used at any point. Earlier cycles against superseded byte states are kept in `logs/17`-`20` and `27`-`30` for provenance.

## Gates

- `pnpm run typecheck`: exit 0 (`logs/21b-typecheck-r2.log`; first attempt `logs/21-typecheck.log` exit 1 caught six strict indexed-access errors in the first byte state, fixed before final).
- `pnpm run lint`: exit 0, 0 warnings, 0 errors (`logs/22b-lint-r2.log`; first attempt `logs/22-lint.log` exit 1 was one 149-column line in the spec, fixed before final).
- `pnpm run test:docs`: 16 passed / 0 failed / 0 skipped, exit 0 (`logs/23-docs.log`) — covers agent-note format and classification and translation pairing for the new note triplet.
- Duplication: `node node_modules/jscpd/run-jscpd.js --config .jscpd.json packages scripts` — 0 clones, exit 0 (`logs/24b-duplication-r2.log`; `logs/24-duplication.log` records the discarded wrong-entry attempt). The gate's scan roots do not include `apps/`; the round's runtime changes live only there, and the record run confirms no regression.
- Commit-time hooks: not exercised in this round (the round stops before commit by instruction).

## Protection surfaces verified unchanged

- `git status --porcelain` after all work: exactly the two modified target tests, the two new test-only files, the three preserved r44 artifacts, and this round's evidence/notes. No package under `packages/`, no golden under `apps/cli/tests/profiles/headless/tests/expected/`, no `vitest.expected.config.ts`, no workflow/lockfile/vendor changes.
- Both suites' business assertions are preserved verbatim except the selection lines: descriptor-less cold child seeding, corrupt diagnostic containment, parent golden, final parent result and empty stderr (diagnostic); physical file absence, first-record read-only delegation, two policy contexts with positive/negative text checks, parent and child goldens, write denial, final parent result and stderr (inheritance). `DSH_SNAPSHOT=refresh` was never set; no golden was rewritten.

## NOT_RUN / out of scope

- The five pre-existing Chinese line-number issues, other Windows failures (watchdog, Inspector, cache, HTML asset paths, pwsh), both platforms' 67-file coverage shortfalls: listed, not touched.
- Full r44 matrices (40+33), full coverage, Web, Gateway 212, Loader 122, exe-wheel, old Windows goldens, both SDK surfaces: not rerun; the new CI owns them.
- GitHub artifact ZIP (`10554198151`, SHA-256 `4cf5ee3dcb3291adafec17f65fccdc8da6e58987d8dca27554e7c5667b9b2aff`): not downloaded — remote forensics already completed it; this round needed no new first-failure bytes.
- No commit, no push, no CI interaction, no external agents, no credentials read.

## Post-review corrections (applied pre-commit, before any git add)

- `logs/diag2-execа.log` (the `а` before `.log` was Cyrillic U+0430, not ASCII `a`) was renamed to `logs/diag2-exec-a.log` via Node fs on explicit ASCII paths with a read-back byte check (548 bytes intact); no text in this round's documents referenced the old name, and a full codepoint audit of the evidence tree now finds zero non-ASCII file names.
- `mutations/MANIFEST.md` gained an appended correction section (historical lines untouched): logs 27–30 ran with the final helper bytes and were superseded by the spec's lint fix, not by the typecheck fix; only logs 17–20 used the pre-typecheck-fix helper.
- This file gained the accurate log count (42), the recording-strength disclosure for the Vitest cycle logs, and the review-trust note on Finding A recorded above.
