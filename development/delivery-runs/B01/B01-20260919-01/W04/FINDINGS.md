# W04 findings — cross-platform shared SDK snapshot contract

Run: B01-20260919-01 / W04. Machine: win32 10.0.26200 x64, Node v26.8.2, pnpm 12.4.1.
Raw logs: `C:\dsh-b01-w04\logs\` (01–22), capture: `C:\dsh-b01-w04\capture\`, mutations: `C:\dsh-b01-w04\mutations\`.

## F1. Platform contract design (D04) — implemented

- `snapshots/sdk/sdk.snapshot.ts` now holds a closed registry `WIN32_TOOL_SCHEMA_SIDECARS = {sdk/subagent-teardown, sdk/agent-team-teardown}`. On win32 those scenarios resolve their parent (class-pin) tool schemas from `<scenario>/tool-schemas.win32.expected.json` and each declared child's from `<scenario>/tool-schemas.<n>.win32.expected.json`; every other platform and every unlisted scenario keeps the previous shared sources (`session/text-turn` class pin; scenario-local child sidecars). A missing selected sidecar fails loud through `readFile` — there is no fallback to the other platform's bytes, no name-only substitution, no shell-entry deletion, and no field filtering at comparison time. `writeHeaderSidecars` writes to the same platform-resolved names, so a future win32 refresh can no longer clobber the platform-neutral defaults.
- The comparison itself is unchanged: full `expect(header).toEqual(expected)` with the complete tool list (names, descriptions, all parameters, required fields) restored into the pinned header.

## F2. The four registered win32 sidecars — origin and review

Generated exclusively from real keyless production-teardown runs: `teardown.snapshot.ts` (2/2 green, log 07) with `DSH_TEARDOWN_DUMP`, lib-built runtime (`apps/cli/lib/bin.js`, built 2026-09-19 18:08 — newer than every runtime source input; spot-checked `tool-pwsh` 2026-08-31, `apps/cli/src` 2026-09-07, worktree changes only in non-runtime files). Extraction used the lane's own `normalizedToolSchemas` + `formatToolSchemasSnapshot` (script `extract-sidecars.mts`, log 08); no schema bytes were hand-written.

Independent review (structural diff against committed sources):

| Sidecar | vs shared/committed source | Result |
|---|---|---|
| `subagent-teardown/tool-schemas.win32.expected.json` | `session/text-turn/tool-schemas.expected.json` | exactly the `bash`→`pwsh` entry swap; the other 24 tools byte-identical |
| `subagent-teardown/tool-schemas.1.win32.expected.json` | frozen `tool-schemas.1.expected.json` (r46) | byte-identical (`3b51e300…`) |
| `agent-team-teardown/tool-schemas.win32.expected.json` | `session/text-turn/tool-schemas.expected.json` | shell swap + 6 team tools (`spawn_teammate`, `team_task_create/get/list/update`, `wait_agent`) + 3 team-scoped redefinitions (`interrupt_agent`, `list_agents`, `send_message`), each byte-identical to the frozen r46 child capture |
| `agent-team-teardown/tool-schemas.1.win32.expected.json` | frozen `tool-schemas.1.expected.json` (r46) | byte-identical (`e55ca1d0…`) |

Every captured set contains `pwsh` and none contains `bash` (25 tools per subagent session, 31 per agent-team session, 1 schema set per session, `changes: []`). Git blobs: subagent both files `3b51e3002f91bc2d5820a386d79aec8120d20457`; agent-team both files `e55ca1d010350dcd288839b0967761ee932c24e3` (parent == child tool set per scenario — verified from the real runs, not assumed).

## F3. Windows shared-lane boundary — three independent blockers, all evidenced

1. **Handshake budget vs cold profile materialization (environmental).** Each test cold-boots a fresh `$DSH_HOME` and `healProfilesModuleFallback` symlinks the whole dependency closure into `$DSH_HOME/profiles/node_modules`; on this machine that takes ~16–21 s (probes 04–06: initialize answered at 20.9 s / 16.4 s) against the 10 s product default `initializeTimeoutMs`. The runtime produced no stderr — it is slow, not broken. Both lane files now pass `initializeTimeoutMs: 60_000` (a test-side wait widening only; no target assertion weakened). For `teardown.snapshot.ts` this is the registered W? modification: reproduced 3× (logs 01–03), root-caused by probes 04–06, and the r46 close/delivery/takeover assertions are untouched.
2. **The r44-documented raw `{{cwd}}` hydration defect — confirmed with the runtime's own stderr (log 13, tee wrapper).** Final candidate bytes fail at plugin load: `llm-replay … session snapshot line 1 contains invalid JSON — Bad escaped character in JSON at position 87`. The forward-slash-own-TMP workaround does NOT reach this lane: `path.win32.join(tmpdir(), …)` normalizes the temp cwd to backslashes before `mkdtemp`, so `hydrateReplayFixtures`' raw `replaceAll` always yields illegal `\d`-style escapes on win32. This is W05's declared fix; W04 leaves the raw replacement in place.
3. **With hydration temporarily scaffolded (JSON-escaped, byte-presaved `2ff4eee9…`, reverted to the same hash after the controls), the win32 lane reaches the full comparison** (log 14): the whole-Session comparison passes for both scenarios, the parent full-header comparison **passes against the new win32 schema sidecars** (headers are compared before prompts per log), and the first failure is the parent **system prompt**: the shell tool's `ctx.systemPrompt.section` registration is platform-flavored (`tool-pwsh/src/index.ts:243-247`), so the win32 parent prompt carries the Windows-kill exit-code section (and, for agent-team, the Agent-Teams guidance block) while the class-pin source `session/text-turn/system-prompt.expected.md` carries the bash section. D04 deliberately registers schema sidecars only, so W04 stops here and freezes.

## F4. Discovered expectation gaps beyond D04's schema scope (for CP1 / 总控)

1. **Parent system-prompt platform expectation.** A win32 green lane needs `system-prompt.win32.expected.md` per scenario (2 new paths) plus the same selection in `sdk.snapshot.ts`. Candidates were captured from the same real runs and reviewed: `capture/derived/*.system-prompt.win32.candidate.md`. The subagent candidate is byte-identical to the committed `system-prompt.1.expected.md`; the agent-team candidate differs from its child sidecar only in the Team role line (`lead` vs `teammate`). Not written into the repo — outside pre-registered NEW paths.
2. **agent-team parent expectations are composition-specific on every platform.** The agent-team parent assembles 6 team tools and team-scoped redefinitions and a team guidance block; the shared class-pin sources (`session/text-turn`) describe the default composition (25 tools, no team block). So on Linux, too, the agent-team parent schema and prompt comparisons cannot pass against text-turn. The win32 sidecar covers Windows; a default-platform parent sidecar (or a re-pointed source) is needed for Linux and is C-protected territory.
3. **Committed child sidecars are win32 captures.** Both frozen `tool-schemas.1.expected.json` files (and both `system-prompt.1.expected.md` files) contain pwsh/Windows text. On Linux the child comparisons will fail against them until they are regenerated from a real Linux run (post-W03). The frozen bytes remain correct for win32 children — the new `.1.win32` files duplicate them explicitly so the win32 lane no longer depends on that accident.

## F5. Verification actually run (final candidate bytes; see report for the full list)

- Dedicated adapter `teardown.snapshot.ts`: 2/2 green with the r46 evidence chain intact (log 07; final-state re-run log 20) — real delivery (`team message … delivered@32 before the close suffix`), cancel handshake, close settlement, takeover.
- Shared lane, 2 scenarios selected / 18 skipped by the `-t` filter (log 09): fails at the hydration plugin-load error — the official Windows boundary of the final candidate.
- Negative controls (all with the temporary hydration scaffold, all restored byte-exact):
  - NC1 mutated pwsh description in `subagent-teardown/tool-schemas.win32.expected.json` → rejected at `subagent-teardown: session 0 header 1` (log 15).
  - NC2 mutated pwsh `parameters.required` (`["command","description"]`→`["command"]`) in `agent-team-teardown/tool-schemas.win32.expected.json` → rejected at `agent-team-teardown: session 0 header 1` (log 16).
  - NC3 deleted both `team/message/delivered` lines from the frozen `agent-team-teardown/session.v3.jsonl` (presaved `196e2c05…`) → rejected at `agent-team-teardown: sessions` (live 42 vs expected 40 records; log 17).
  - Post-restore baseline (log 18): both scenarios back to the prompt-assertion failure — schema assertions pass again; recovery proven for all three controls.
- Frozen input restoration verified by SHA-256 (`agent-team/session.v3.jsonl` → `196e2c05…`, not modified in `git status`); scaffold revert verified by SHA-256 (`sdk.snapshot.ts` → `2ff4eee9…`).

## F6. Generator needs for 总控 (W04 does not run shared generators)

None from W04's own scope. The snapshot lanes write expected outputs only under `DSH_SNAPSHOT=record|refresh`, which W04 did not run; no repo-wide record/refresh, no `gen-doc-graphs`, no pairing writes. If CP1 later registers the two `system-prompt.win32.expected.md` paths, the files can be copied verbatim from the reviewed candidates — no generator run is required (they were produced by the lane's own formatting from real runs).
