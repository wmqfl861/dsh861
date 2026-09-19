# W04 platform contract — shared SDK snapshot tool-schema expectations

Deliverable per formal plan v1 §2 W04. Companion evidence: [FINDINGS.md](FINDINGS.md), [00-start.md](00-start.md), [logs/](logs/), [capture/](capture/), [mutations/](mutations/).

## 1. Contract

The two shared automatic scenarios (`subagent-teardown`, `agent-team-teardown`) run under the production platform shell selection (`packages/bundle/base/cordis.patch.yml`: `tool-bash` off on win32, `tool-pwsh` off elsewhere; unchanged by W04). Their model-facing tool schemas are therefore a per-platform expectation:

| Expectation | win32 | default (non-win32) |
|---|---|---|
| Parent (class-pin) schemas | `<scenario>/tool-schemas.win32.expected.json` (new) | `session/text-turn/tool-schemas.expected.json` (frozen, bash) |
| Child N schemas | `<scenario>/tool-schemas.<N>.win32.expected.json` (new) | `<scenario>/tool-schemas.<N>.expected.json` (frozen, r46 bytes — win32 captures; see §4) |

`sdk.snapshot.ts` resolves the sidecar through the closed registry `WIN32_TOOL_SCHEMA_SIDECARS` before any header comparison. A missing selected sidecar, an unreadable file, or an unregistered-but-divergent scenario fails loud (registry misses fail the full-header equality itself). Record/refresh write-back uses the same platform-resolved names, so a win32 refresh can no longer overwrite the platform-neutral defaults. No name-only substitution, no shell-entry deletion, no tolerance of either platform's set, no comparison-time field filtering.

## 2. Sidecar inventory (all blobs at start HEAD; NEW files created this task)

| File | Blob (SHA-1) | SHA-256 |
|---|---|---|
| `snapshots/sdk/subagent-teardown/tool-schemas.win32.expected.json` | `3b51e3002f91bc2d5820a386d79aec8120d20457` | `bb3b0d0a6d213953e88db2fd39318e1ae166f8ea021b0023fed084f049ca9559` |
| `snapshots/sdk/subagent-teardown/tool-schemas.1.win32.expected.json` | `3b51e3002f91bc2d5820a386d79aec8120d20457` | `bb3b0d0a…` (same content) |
| `snapshots/sdk/agent-team-teardown/tool-schemas.win32.expected.json` | `e55ca1d010350dcd288839b0967761ee932c24e3` | `22edc948119a07d61d7c6eba7d10de8063b26978d2ae4f0e1fe38d1a8965d36e` |
| `snapshots/sdk/agent-team-teardown/tool-schemas.1.win32.expected.json` | `e55ca1d010350dcd288839b2697761ee932c24e3` | `22edc948…` (same content) |

Content: subagent 25 tools per session (24 shared with text-turn byte-identical + `pwsh` replacing `bash`); agent-team 31 tools (24 shared + `pwsh` + 6 team tools + 3 team-scoped redefinitions matching the frozen r46 capture). One schema set per session, `changes: []`. Within each scenario the parent and child assemble the same tool set — taken from the real runs, and the child files are byte-identical to the frozen r46 defaults, which independent real-run verification already covered in r46.

## 3. Capture provenance

Real keyless runs of the dedicated adapter (`teardown.snapshot.ts`, 2/2, log 07) with `DSH_TEARDOWN_DUMP`, lib-built runtime `apps/cli/lib/bin.js` (built 2026-09-19 18:08, newer than all runtime source inputs). Extraction through the lane's own `normalizedToolSchemas` + `formatToolSchemasSnapshot` (log 08); raw captured session logs and normalized headers archived under [capture/](capture/) naming `*.normalized-header.json`. No repo-wide record/refresh; committed Session JSONL and replay inputs untouched (verified by hash and `git status`).

## 4. Known-open platform items (not closed by W04)

1. **win32 parent system prompt** — platform-flavored via the shell tool's prompt section; needs registered `system-prompt.win32.expected.md` paths + prompt-side selection. Reviewed candidates: `capture/*.system-prompt.win32.candidate.md` (subagent candidate byte-identical to the committed child prompt; agent-team candidate differs only in the Team role line).
2. **agent-team parent on every platform** — the team composition's 6 extra tools, 3 redefinitions, and guidance block are absent from the shared text-turn sources, so the agent-team parent schema/prompt comparisons cannot pass on Linux either until a default-platform parent sidecar or re-pointed source exists.
3. **Frozen child sidecars are win32 captures** — Linux child comparisons require regeneration from a real Linux run (post-W03); C-protected change outside W04.
4. **win32 lane reachability** — final candidate still fails at the raw `{{cwd}}` hydration (W05's fix; primary stderr in `capture/final-candidate-hydration-stderr.log`); with hydration scaffolded the same runs pass the whole-Session comparison and the parent schema comparison against the new sidecars (log 14) and fail at the parent prompt (item 1).

## 5. Verification summary (final candidate bytes)

| Check | Result | Log |
|---|---|---|
| `teardown.snapshot.ts` dedicated adapter | 2/2 pass (r46 delivery/cancel/takeover chain intact) | 07, 20 |
| Shared lane `-t` two scenarios | 2 selected, 18 skipped; fails at hydration plugin-load (win32 boundary) | 09, 19, 13, 24 |
| `session-snapshot-corpus.corpus.ts` | 3/3 pass | 21, 23 |
| `agent-team-teardown-trigger.spec.ts` (thread-safe) | 10/10 pass | 22 |
| NC1 description mutation | rejected at `session 0 header 1` | 15 |
| NC2 input-schema mutation (`required`) | rejected at `session 0 header 1` | 16 |
| NC3 delivered-event deletion (frozen fixture) | rejected at `sessions` comparison | 17 |
| Post-restore baseline | both scenarios return to the prompt-assertion failure (schemas pass) | 18 |

Logs 23/24 re-ran the corpus check and the shared lane on the exact final bytes (write-path symmetry refactor after log 22; output-identical, replay-unreachable). Final candidate blobs: `sdk.snapshot.ts` → `2f66035e9620f1a7965450eeb31c438bfe12ed41` (SHA-256 `541b5d7a93be9384d2d80963ebad12268b693beef2d2e8bc976964e524a19dc9`), `teardown.snapshot.ts` → `911fc5fc092ccd93d33c797b8d8c655d48b76de0`.

Restoration receipts: `agent-team/session.v3.jsonl` SHA-256 `196e2c05…` (unmodified in `git status`); both mutated sidecars restored to inventory hashes; `sdk.snapshot.ts` reverted from the temporary verification scaffold to SHA-256 `2ff4eee9…` (raw `{{cwd}}` replacement preserved for W05).

## Erratum (W13 hard-review note 2)

Line 23 carries a 2-character transcription slip in one blob value (same class as the B2 doc erratum). The authoritative sidecar identities are the W04/round-2.md table (corrected in CP1) and the git blobs themselves; this line is retained as historical text per freeze discipline.
