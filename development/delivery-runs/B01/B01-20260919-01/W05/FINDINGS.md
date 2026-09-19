# W05 findings — Windows expected/cwd closure

Run: B01-20260919-01 / W05. Machine: win32 10.0.26200 x64, Node v26.8.2, pnpm 12.4.1 (dual-dir PATH prefix). Raw logs: `C:\dsh-b01-w05\logs\` (00–16, mirrored in `W05/logs/`); probes in `C:\dsh-b01-w05\capture\`; NC presave in `C:\dsh-b01-w05\mutations\`. All runs used the direct `node node_modules/vitest/vitest.mjs` entry (r45 finding A vehicle), own TMP roots, and `DSH_SNAPSHOT` unset (replay).

## F1. Shared-lane hydration defect — root cause proven, fixed, negative-controlled

- **Producer/consumer chain, proven by bytes.** Both frozen parent fixtures (`subagent-teardown/session.v3.jsonl`, `agent-team-teardown/session.v3.jsonl`) carry exactly one `{{cwd}}` each — inside the line-1 session header's `"cwd"` JSON string value at index 84 (probe log 00). Raw `replaceAll('{{cwd}}', cwd)` with a backseparator cwd makes line 1 fail `JSON.parse` with `Bad escaped character in JSON at position 87` — the exact stderr W04 captured (W04 log 13); position 87 is the second character of the hydrated value, where `\d` is an illegal JSON escape. Consumer: `DSH_SNAPSHOT_FILE` → `packages/test-support/llm-replay/src/index.ts` `parseSessionFixture` (`JSON.parse` per line, lines 222–224) fails at plugin load; the surfaced symptom is `JsonRpcResponseError: cannot create effect on inactive context`.
- **Fix** (`snapshots/sdk/sdk.snapshot.ts` `hydrateReplayFixtures`): the replacement is now `JSON.stringify(cwd).slice(1, -1)` — the same JSON-escaped hydration the dedicated teardown adapter already used (teardown.snapshot.ts:362 pattern). Hydrated bytes go only to the run's `<cwd>/.replay-fixtures/` temp files; committed fixtures untouched (hashes below).
- **Boundary advance, honestly staged.** With the hydration fix alone (log 02), both scenarios moved past plugin load, the whole-Session comparison, and the parent schema sidecar comparison, and first failed at the parent system prompt (`verifyHeaders` line 819) — exactly the boundary W04 recorded: the win32 parent prompt carries the pwsh Windows-kill exit-code section (plus, for agent-team, the Agent-Teams block and `Team role is lead` line) while the shared `session/text-turn` source carries the bash section.
- **Negative control NC-hydration** (log 11): hydration reverted to a raw `cwd` replacement → both scenarios fail with the exact baseline signature (`cannot create effect on inactive context`, EXIT=1); restore verified byte-exact (blob back to `dbc5a20c…`); post-restore lane green again (log 12).

## F2. Prompt sidecars registered; parent prompt comparison now platform-selected

- Registered `snapshots/sdk/subagent-teardown/system-prompt.win32.expected.md` and `snapshots/sdk/agent-team-teardown/system-prompt.win32.expected.md` verbatim from the reviewed W04 capture candidates. Origin and review (re-verified independently in W05, not just cited): the subagent candidate is byte-identical (SHA-256 `30580d96…`) to the committed `system-prompt.1.expected.md`; the agent-team candidate differs from its child sidecar only in the Team role line (`lead; your Team name is lead` vs `teammate; your Team name is worker`); both carry the Windows-kill exit-code section and no bash exit-code section, while the shared `session/text-turn` parent carries the bash one. The candidates were produced by W04 from real keyless production-teardown runs via the lane's own formatting (W04 FINDINGS F2/F4.1) — no bytes hand-written in either round.
- Selection in `sdk.snapshot.ts`: W04's registry is generalized to `WIN32_PARENT_HEADER_SIDECARS` (same two keys) with a new `parentSystemPromptSidecar(scenario, promptOwner)` mirroring `parentToolSchemasSidecar`; `verifyHeaders` and the refresh-write path in `writeHeaderSidecars` both resolve the platform-named file, so a future win32 refresh writes `.win32` names and cannot clobber the platform-neutral defaults. Unlisted scenarios and non-win32 platforms keep the shared sources; a missing sidecar fails loud through `readFile`.
- Result: shared lane 2/2 green (log 04, EXIT=0) — full Session compare, parent header schema sidecars, and parent prompts all pass on win32. Also green under the space+Unicode TMP root (log 08) and after the NC restore (log 12).

## F3. Expected-lane cwd tokenization — producer pinned, alias fix, no normalizer change

- **Producer pinned.** `packages/sandbox/sandbox-policy/src/index.ts:46` embeds the workspace root as `JSON.stringify(policy.workspaceRoot)` in the runtime-context text; its own spec pins that (`sandbox-policy/tests/policy.spec.ts:165,204`). On win32 the diagnostic parent's policy text therefore carries the cwd with doubled backslashes inside quotes, while the test's `NormalizeContext.cwd` is the single-backslash mkdtemp path. `cwdSpellings` covers `ctx.cwd`, `cwdAliases`, and macOS `/private` prefixes only — no JSON-serialized variant — so the token never landed and the POSIX-recorded golden (`session workspace: "{{cwd}}"`) diverged. Baseline reproduced in W05 (log 05): inheritance PASSED (read-only policy text lists no workspace), diagnostic failed at `expectSession` on exactly the two policy-text occurrences (`\"C:\\\\dsh-b01-w05\\\\tmp\\\\dsh-subagent-diag-7JSpMQ\"` vs `\"{{cwd}}\"`).
- **Fix** (`apps/cli/tests/profiles/headless/tests/subagent-diagnostic.expected.e2e.ts`): the context now passes `cwdAliases: [JSON.stringify(cwd).slice(1, -1)]` — the public `NormalizeContext.cwdAliases` field ("other filesystem spellings of the same cwd"), so no public normalizer or production API changed. On POSIX the alias is character-identical to `cwd` and dedupes to a no-op, so CI behavior is unchanged. `cwdSpellings` sorts longest-first, so the doubled spelling tokenizes before the plain one. Result: both expected suites green (log 06, 2/2, EXIT=0).
- **Controls.** Alias-off equals the baseline bytes (log 05 is the recorded control: failure at the exact assertion). Identity selection: `session-log-identity.spec.ts` 15/15 (log 10) — the deterministic battery covering enumeration-order, duplicate, malformed, and wrong-parent rejections; helper and spec bytes unchanged this round (blobs `efb67536…`/`1c213fd7…`), so r45's mutation NCs remain valid.

## F4. Coverage actually run (final bytes)

| Surface | Result | Log |
|---|---|---|
| Shared SDK lane, 2 scenarios / 18 skipped | 2/2 green, EXIT=0 | 04 |
| Shared SDK lane, space+Unicode TMP root | 2/2 green, EXIT=0 | 08 |
| Shared SDK lane, post-NC-restore rerun | 2/2 green, EXIT=0 | 12 |
| Expected diagnostic + inheritance | 2/2 green, EXIT=0 | 06 |
| Expected suites, space+Unicode TMP root | 2/2 green, EXIT=0 | 07 |
| Expected suites, consecutive rerun | 2/2 green, EXIT=0 | 14 |
| Dedicated teardown adapter (read-only reuse) | 2/2 green, EXIT=0 | 09 |
| session-log-identity spec | 15/15, EXIT=0 | 10 |
| NC raw hydration (mutant → restore) | 2 failed EXIT=1 → green | 11, 12 |

- Space/Unicode/backslash coverage: the space+Unicode root (`C:\dsh-b01-w05\tmp-W05 ünïcode 空格`) exercises spaces, non-ASCII, and backslash separators through both the JSON-escaped hydration path and the cwdAliases golden-compare path; backslash-only ASCII coverage comes from every other run. Log identity remained header-identity selection throughout.
- Consecutive invocations waited for real exit (each run's `EXIT=` recorded before the next started) and stayed green; the process census after all runs (log 15) found zero node/pnpm processes from W05's surfaces (the 3 matches belong to the concurrent W06 desktop stream: `C:\dsh-b01-w06\` paths). No `sdk-snapshot-*` or `dsh-subagent-*` run dir survived — every run cwd was removed after its harness closed. Residue inside the own TMP roots was attributed and cleaned: per-invocation Vite SSR caches, one empty runtime `dsh-spill-*` root, and the tsx cache — tool/runtime-owned, no locks, cleaned with the raw workspace.
- Same-home sequential reopen: structurally not exercised — both lanes create and remove a fresh `$DSH_HOME` under a per-run mkdtemp cwd by design, so no cross-run home reuse exists in these surfaces. The lock-release property it guards is evidenced by the consecutive green reruns plus the zero-match census. Recorded as interpretation, not as a run.
- pnpm-exec (r45 finding A): one final-state trial (`pnpm exec vitest … subagent-diagnostic`, log 16) completed green in 6.4 s — the r45 30 s zero-output hang did NOT reproduce in that single trial. No code change targeted it and it is NOT claimed fixed; r45's probe chain (starvation of the grandchild profile install under a pnpm-parented worker) stands as the recorded cause, evidently load/cache dependent. Direct-Node remains the sanctioned entry.
- Log 13 (`13-census-between-runs.txt`) is invalid — a shell interpolation corrupted the PowerShell `$_`; superseded by the script-based census (log 15). Log 03 records a transient mid-staging `ReferenceError` (one missed predicate rename during the sidecar edit), caught and fixed before the green run; kept as an honest intermediate.

## F5. Three problem classes kept separate

1. pnpm parent/profile-lock starvation (r45 finding A) — environmental; direct-Node entry is the applicable local vehicle; not claimed fixed (F4).
2. Test-subprocess lifecycle — the suites close their harness before removing the run cwd; verified by consecutive clean reruns and census (F4), not by code change.
3. Windows path serialization + JSON escaping — the two real code defects fixed here (F1 hydration, F3 alias), both at test-fixture/-call level. The public normalizer (`packages/test-support/session-snapshot`), loader/profile implementations, persistence, and lease were NOT modified; no minimal-expansion request was needed.

## F6. W04 supplementary-verification checklist (for the controller, post-W05)

1. Shared lane rerun at final bytes under W04's lock (W05 already ran it green three times: logs 04/08/12).
2. Dedicated teardown adapter at final bytes (W05 log 09 green; r46 assertions intact).
3. W04's negative controls NC1/NC2/NC3 rerun at final bytes under W04's lock (my changes do not touch the schema sidecars or session fixtures — hashes below — but W04 owns that verification).
4. Frozen-input restoration checks: `agent-team-teardown/session.v3.jsonl` SHA-256 still `196e2c05…` (untouched), both `session.v3.jsonl` git blobs unchanged; the W04 hydration scaffold is superseded by the real fix.
5. W04 F4.1 (prompt sidecar registration) — closed by W05 F2. W04 F4.2 (default-platform agent-team parent expectation for Linux) and F4.3 (Linux regeneration of committed child sidecars) remain open for the Linux stream (post-W03), outside W05.

## Final identities

- `snapshots/sdk/sdk.snapshot.ts`: handoff `2f66035e9620f1a7965450eeb31c438bfe12ed41` → final `dbc5a20c94e8d9687bed8db0054c186dab921a3d` (hydration escape; registry generalization + `parentSystemPromptSidecar` and its two call sites; child predicate rename).
- `apps/cli/tests/profiles/headless/tests/subagent-diagnostic.expected.e2e.ts`: `6ea72244b0acc322c29a27824702f3da224450e9` → `0e1e6ffa218393f9e92654836e14705c36b1d9a9` (cwdAliases only).
- New: `snapshots/sdk/subagent-teardown/system-prompt.win32.expected.md` (SHA-256 `30580d961de47e5ab0a6ddaf242eb63550ad41e7471de00cca8034f3886784be`), `snapshots/sdk/agent-team-teardown/system-prompt.win32.expected.md` (SHA-256 `cbf4d28eeab6b4857eea9646f99d5f550a1dc5bf1afdc27e53c0ba4884104e90`).
- Read-only verified byte-identical: `teardown.snapshot.ts` (`911fc5fc…`), `session-log-identity.ts` (`efb67536…`) and its spec (`1c213fd7…`), `subagent-inheritance.expected.e2e.ts` (`e83a60a9…` — passed unmodified), both parent fixtures (`75d90991…`/`9c5e5551…`), all four win32 tool-schema sidecars (`3b51e300…`/`e55ca1d0…`).

## NOT_RUN / limits

- Full `pnpm run typecheck`, `lint`, `duplication`, `test`, coverage — per W05 task constraint; the touched files compiled and executed under vitest's transform, but no static type check ran.
- Record/refresh modes: never set; no golden, fixture, or expected output was rewritten.
- Linux lane, W03-dependent regenerations, default-platform agent-team parent sidecar (C-protected), CI matrices — not W05's surface.
- `check:windows-wine`, Web/Desktop/other profiles — untouched.
- No commit, no push, no CI interaction, no external agents, no credentials read; user profile contents and global pnpm caches were not read or cleared.
