# W04 round 2 — non-win32 platform-default sidecars (run 42 evidence)

Tasking: second-round dispatch after CI run 42 (id 35450138445) executed the sdk snapshot lane on Linux for the first time; both shared scenarios failed with real mismatches, confirming round-1 findings F4.2/F4.3 verbatim. Raw scripts/logs: `C:\dsh-b01-w04\round2\` (extractor `extract-run42.mts`, derivation `derive-sidecars.mts`, probe generator `gen-selection-probe.mjs`, NC rehearsal `nc-rehearsal.mts`, logs 01–11). Source log: `C:\dsh-b01-w03\gate-evidence-run42\logs\snapshot.log` (contains raw ANSI escapes; stripped in-extractor).

## 1. Selection design (default + win32 override; win32 path zero-change)

Extends W05's `WIN32_PARENT_HEADER_SIDECARS` + three selection functions with two registries and a fourth selector:

- `DEFAULT_PARENT_HEADER_SIDECARS = { sdk/agent-team-teardown }` — non-win32 parent sidecars. `sdk/subagent-teardown` is deliberately absent: run 42 compared its parent schemas and parent prompt against the shared `session/text-turn` sources and PASSED (its failure was session 1, after session 0 passed).
- `DEFAULT_CHILD_HEADER_SIDECARS = { sdk/subagent-teardown, sdk/agent-team-teardown }` — non-win32 child sidecars (schema + prompt).
- New `childSystemPromptSidecar(scenario, index)`: non-win32 registered → `system-prompt.<n>.default.expected.md`; else the plain name (win32 keeps reading the unsuffixed r46 child sidecars, whose bytes are win32 captures — zero-change).

Full matrix after round 2:

| Expectation | win32 (zero-change vs W05) | non-win32 (Linux CI) |
|---|---|---|
| subagent parent schemas | scenario `tool-schemas.win32.expected.json` | shared `session/text-turn` (run-42-passed) |
| subagent parent prompt | scenario `system-prompt.win32.expected.md` | shared `session/text-turn` (run-42-passed) |
| subagent child schemas | `tool-schemas.1.win32.expected.json` | **NEW** `tool-schemas.1.default.expected.json` |
| subagent child prompt | plain `system-prompt.1.expected.md` (r46 bytes) | **NEW** `system-prompt.1.default.expected.md` |
| agent-team parent schemas | `tool-schemas.win32.expected.json` | **NEW** `tool-schemas.default.expected.json` |
| agent-team parent prompt | `system-prompt.win32.expected.md` | **NEW** `system-prompt.default.expected.md` |
| agent-team child schemas | `tool-schemas.1.win32.expected.json` | **NEW** `tool-schemas.1.default.expected.json` |
| agent-team child prompt | plain `system-prompt.1.expected.md` (r46 bytes) | **NEW** `system-prompt.1.default.expected.md` |

Fail-loud unchanged: a selected-but-missing `.default` file rejects through `readFile`; unregistered scenarios keep the shared sources everywhere; record/refresh write-back uses the same selectors (`childSystemPromptSidecar` added to the write path for symmetry).

## 2. New-file inventory (blobs/SHA-256 at creation)

| File | Git blob | SHA-256 |
|---|---|---|
| `snapshots/sdk/subagent-teardown/tool-schemas.1.default.expected.json` | `81ceebfa43c0cc4cb14a779e653fac514eea6181` | `a9ed161c17cd99d0f84b81a703b345b104eb4f77675324b08bad4bf701541fac` |
| `snapshots/sdk/subagent-teardown/system-prompt.1.default.expected.md` | `b3c8e3db4b83cd62c6bc35f9b97f086153606e59` | `bf857a24bfcd060cd5efe8e1ae4bb93143754de215477554d02eaa952f5a4caa` |
| `snapshots/sdk/agent-team-teardown/tool-schemas.default.expected.json` | `d62814db6f3c9198e4473268e53619609d97d16f` | `9a1d744987847e121eb8862e131a46c77bede8e9c40d76f5fcb05ae4373742f2` |
| `snapshots/sdk/agent-team-teardown/system-prompt.default.expected.md` | `a5bdc9ab953f0a7376285724e4180ab9467a6e65` | `99e2b100cd02863d28be8e1224da82ac3afce438fa210eb243204d8111eecc6a` |
| `snapshots/sdk/agent-team-teardown/tool-schemas.1.default.expected.json` | `d62814db6f3c9198e4473268e53619609d97d16f` | `9a1d7449…` (same as parent — identity basis) |
| `snapshots/sdk/agent-team-teardown/system-prompt.1.default.expected.md` | `d2eefffdf31046541bdf948c74d324e2a59a2f6a` | `cf588897b377747ca5d79cbed350379043f957b9ae9086f8640c2d964fc54d0f` |

The subagent child prompt blob (`b3c8e3db…`) is byte-identical to the shared `session/text-turn/system-prompt.expected.md` blob — git-level confirmation of the derivation cross-check.

## 3. Extraction method (no hand assembly)

`extract-run42.mts` (log 03): strip ANSI → parse the two FAIL blocks' unified hunks (1-space margin; diff region ends at stack frames) → rebuild the EXPECTED side exactly as the lane does (scenario pin-fixture header config + the expectation sidecar the lane read: text-turn schemas for agent-team parent; frozen r46 child sidecar for subagent child) rendered in the printer's format (sorted keys, 2-space, trailing comma on every member line) → **verify every hunk anchor, context, and deletion line against it (line-exact; abort on any mismatch)** → apply hunks → strip display trailing commas line-wise → `JSON.parse` → format through the lane's own `formatToolSchemasSnapshot`. No diff line was trusted without matching the reconstructed expected text.

Cross-validations (all passed):
1. subagent child received (25 tools) **structurally equals the shared text-turn set** — predicted by composition, independently reconstructed from the diff.
2. agent-team parent received (31 tools) vs the round-1 win32 capture: differ **only** in `bash`↔`pwsh`; the other 30 tools structurally identical.
3. Every set contains bash and no pwsh; all 6 team tools present in the agent-team set.

Derivations (documented basis, CP1 to review fidelity):
- agent-team child default schema = agent-team parent default schema. Basis: parent/child toolset identity within one runtime composition, byte-proven on win32 in round 1 and re-verified against the committed win32 parent/child pair before deriving.
- Linux prompts: mechanical section swap on the win32 prompt sidecars — the Windows-kill exit-code section (exactly one occurrence per file, asserted) replaced by the shared text-turn bash section. Basis beyond the dispatch's instruction: run 42 itself — the subagent PARENT prompt comparison passed on Linux against text-turn, proving the Linux shell section is exactly the text-turn bash section. Strongest check: the derived subagent child prompt equals the text-turn prompt **byte-for-byte** (also at the git-blob level), exactly as the parent==child prompt identity predicts.

## 4. Local verification (win32 machine; Linux content not runnable locally)

- Selection unit probe (log 05): the registry/selection block is extracted **verbatim from the live `sdk.snapshot.ts`** into a generated module run under tsx with a shadowed `process.platform`. win32 run: 12 checks — every selected path equals the W05-era behavior (the zero-change proof, including the plain child-prompt name). linux run: 12 checks — the `.default` branches for both scenarios and the shared/plain fallback for unregistered scenarios. Existence audit: all 16 selectable sidecars present.
- Negative controls (logs 06, 07): NC-R2a/b/c per new `.default` schema sidecar — through the lane's own `parseToolSchemasSnapshot` and deep-equality against the real run-42 received set: positive round-trip passes; a description mutation and an input-schema (`required`) mutation are each rejected. NC-R2d: subagent derived child prompt is byte-equal to the text-turn reference and a one-word mutation is rejected against it. NC-R2e: agent-team prompt exact-equality non-vacuity (no independent Linux received text exists pre-CI; CI is authoritative). NC-R2f live-lane anchor: mutated the win32 agent-team parent sidecar (presave `22edc948…`) → real lane rejected at `agent-team-teardown: session 0 header 1` → restored (hash re-verified `22edc948…`).
- Regressions: baseline before changes (logs 01–02) and final after changes (logs 08–11) — see report for the table.

## 5. CI final-verification statement

Authoritative acceptance is the CI snapshot gate after CP-A4 pushes this batch (with W11-F's pi-ai fix in the same batch): the expectation is that run 42's two failures turn green — agent-team `session 0 header 1` now reads `tool-schemas.default.expected.json` (31-tool bash+team set), subagent `session 1 header 1` now reads `tool-schemas.1.default.expected.json` (25-tool bash set), and the previously unreached comparisons (subagent session 1 prompt against `system-prompt.1.default.expected.md`; agent-team session 0 prompt against `system-prompt.default.expected.md`; agent-team session 1 header+prompt against the derived child sidecars) pass on the derivation bases above. If any derived sidecar is wrong, the gate stays red with a new assertion diff naming the exact field — the fail-loud property of the unchanged comparison.
