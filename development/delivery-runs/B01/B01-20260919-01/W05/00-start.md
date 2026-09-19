# W05 start record — 2026-09-19

## Identity

- Task: W05 Windows expected/cwd closure (formal plan v1, §2 W05; D06; WORK_PACKAGES.md W05 card).
- Repo: `C:\Albert\project\dsh861`, branch `chore/latest-stable-upgrade-20260912`.
- HEAD at start: `6528141bc9f435f8a2361f4a0c56eb9393092c02` (same as W04 start; no commits by design).
- Platform: win32 10.0.26200 x64. Node `v26.8.2` (`C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64\node.exe`), pnpm `12.4.1` (`C:\dsh-r24-upgrade-20260912-01\pnpm-12.4.1\pnpm.exe`), both PATH-prefixed for task subprocesses. Direct `node node_modules/vitest/vitest.mjs` entry per r45 finding A (pnpm-exec parentage starves grandchild profile installs; that environmental limit is listed, not claimed fixed).
- Raw run workspace (repo-external): `C:\dsh-b01-w05\` (`tmp\`, `logs\`, `capture\`, `mutations\`).

## Owned / frozen inputs (FILE_OWNERSHIP §3.3 + W05 task grant)

- W (handoff): `snapshots/sdk/sdk.snapshot.ts` — start blob (working tree) `2f66035e9620f1a7965450eeb31c438bfe12ed41`; hydration position `hydrateReplayFixtures` (raw `replaceAll('{{cwd}}', cwd)` at line 379) plus the W05-announced prompt-sidecar registration position.
- Read-only reuse: `snapshots/sdk/teardown.snapshot.ts` (blob `911fc5fc092ccd93d33c797b8d8c655d48b76de0`), the 4 registered win32 tool-schema sidecars, both scenarios' frozen session fixtures/entry/trigger/override files, shared `session/text-turn` sources.
- N (W05-announced registration, from W04 capture/ candidates): `snapshots/sdk/subagent-teardown/system-prompt.win32.expected.md`, `snapshots/sdk/agent-team-teardown/system-prompt.win32.expected.md`.
- W? per FILE_OWNERSHIP: `apps/cli/tests/profiles/headless/tests/subagent-diagnostic.expected.e2e.ts` (`6ea72244b0acc322c29a27824702f3da224450e9`), `subagent-inheritance.expected.e2e.ts` (`e83a60a96849e52a3b90339a6995bb7f7190a852`), `session-log-identity.ts` (`efb67536b82b664551614ab9d173ecc4c7cf4f19`, selection must not be weakened), `session-log-identity.spec.ts` (`1c213fd770a8ef23431f7662fb1a3519f823ceaa`).
- R/F frozen (C-protected): the expected goldens, replay fixtures, `subagent-*-snapshot.patch.yml`, `packages/test-support/session-snapshot/src/normalize.ts`, `packages/test-support/loader-smoke/src/index.ts`.

## Start-state facts established before any edit

1. Frozen shared-lane parent fixtures carry exactly one `{{cwd}}` each — inside the line-1 session header `"cwd"` JSON string value (index 84; probe `C:\dsh-b01-w05\logs\00-probe-fixture-tokens.log`). Raw backslash hydration makes line 1 fail `JSON.parse` with `Bad escaped character in JSON at position 87` — the exact runtime stderr W04 captured (log 13); `JSON.stringify(cwd).slice(1,-1)` hydration parses clean. Child fixtures carry one header token each; expected-lane replay inputs carry none.
2. Hydration consumer chain: `sdk.snapshot.ts` `hydrateReplayFixtures` → hydrated file under run tmp → `DSH_SNAPSHOT_FILE` env → `packages/test-support/llm-replay/src/index.ts` `parseSessionFixture` (`JSON.parse` per line, error text `session snapshot line 1 contains invalid JSON`, lines 222–224). Producer and consumer both proven by bytes, not inference.
3. Expected-lane (r45 finding B) producer: `packages/sandbox/sandbox-policy/src/index.ts:46` embeds the workspace root as `JSON.stringify(policy.workspaceRoot)` — on win32 the runtime-context text therefore carries the cwd with escaped (doubled) backslashes and quote wrapping, while the diagnostic test's `NormalizeContext.cwd` is the single-backslash mkdtemp path. `cwdSpellings` (`normalize.ts`) covers `ctx.cwd` + `cwdAliases` + macOS `/private` prefixes only, so the JSON-serialized spelling is never tokenized and the POSIX-recorded golden (`session workspace: "{{cwd}}"`) cannot match. The public `NormalizeContext.cwdAliases` field ("Other filesystem spellings of the same cwd") is the sanctioned test-side seam — no normalizer or production change required.
4. Three problem classes kept separate (per task): (A) pnpm parent/profile lock starvation — r45 finding A, environmental, direct-Node entry is the applicable local vehicle; (B) test-subprocess lifecycle — harness close before rm, verified by consecutive-run cleanliness; (C) Windows path serialization + JSON escaping — findings 1–3 above, the actual code defects fixed here.
5. W04 candidates for the parent system prompts exist and are reviewed (`W04/capture/*.system-prompt.win32.candidate.md`); registration into the two scenario dirs plus prompt-side selection in `sdk.snapshot.ts` is the announced W05 file surface.

## Planned execution order

baseline shared lane (pre-fix, expect hydration failure) → hydration fix → shared lane (expect prompt boundary) → register prompt sidecars + selection → shared lane full → headless expected baseline (inheritance pass / diagnostic cwd diff) → diagnostic cwdAliases fix → expected suites green (own TMP; space+Unicode TMP evidence run) → consecutive-run + no-lingering-process census → negative control (raw hydration must fail again) → FINDINGS/report.
