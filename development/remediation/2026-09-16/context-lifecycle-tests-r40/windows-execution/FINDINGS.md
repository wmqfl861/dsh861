# r40 windows-execution findings — four context/lifecycle test fixes

Round: r40 (context-lifecycle-tests-r40). Host: Windows, Node 26.8.2 / pnpm 12.4.1 from `C:\dsh-r24-upgrade-20260912-01` (PATH-prefixed for every command). Start commit `a228b8c84d40b648eea3fc3a37220470c0e3d6c4`, branch `chore/latest-stable-upgrade-20260912`, clean tree, remote ref identical at start. Scope: this round fixes test semantics/fixtures/observation only; all runtime implementation, vendor sources, the lockfile, workflows, and the r29–r39 frozen evidence keep their original bytes.

## Files modified (start blob -> end state)

| File | Start blob | Change |
|---|---|---|
| `packages/api/session-controller/tests/session-fork.host.spec.ts` | `1661f505bcb0f38723bdf5876614f5126c6e9761` | C1: injecting test observer plugin fiber under `child.ctx` reads the real `systemPrompt.assemble(assembleContextFor(child))`; observer execution counted and asserted (exactly one, assembly obtained); routing waterfall assertions unchanged; observer fiber + ctx disposed in `finally`. |
| `packages/api/gateway/tests/gateway.host.spec.ts` | `edbd83dc56de64c2499a9350ee1301de7fa29c6f` | C2: recovery invocation goes through `ctx.extend({ fixtureScope: undefined })`; result now asserts `scope: 'root'` with `toEqual`; lookup-failed/cause, lookup-not-found, provider unbind, and restore path unchanged; no production gateway change. |
| `packages/goal/goal/tests/goal.spec.ts` | `ac32cd37659cc2ff394c2db11f6a9b48ecb278cb` | C3: stale-instance rejection pinned to `cannot get required service "agents" in inactive context`; live-root `ctx.get('goals')`/projection removal kept; reinstalled instance identity + disarmed restore kept; own ctx disposed in `finally`. |
| `packages/context/session-reference/tests/session-reference.spec.ts` | `dc2caa506737d0c33f27645aa8a4cdc804118b31` | C4: both listeners proven removed — assemble counting probe (2 reads per execution before dispose, 0 after, 2 after reinstall), real pre-step dispatch (context appended before, seed passed through by identity with no source read after, exactly one context after reinstall), stale `prepare` rejection (`SESSION_REFERENCE_READ_FAILED`, cause = inactive `sessionQuery`) as a separate assertion; probe/spy/reinstalled fiber disposed in `finally`. |

`packages/context/session-reference/src/index.ts` was mutated twice for negative controls and restored byte-identically each time; its final git blob is `2ac9980a90c89a77fbebd8a5b6e9a1eb274be49c` and it does not appear in the working-tree diff. End blobs of the four specs are recorded in `00-start-state.md` (net diff 4 files, +152/-34).

## Evidence directory contents

- `00-start-state.md` — start and end state, start/end blobs, task sources.
- `01-baseline-4files-first-failure.normalized.log` — unfixed baseline (4 failed / 131 passed).
- `02-postfix-4files-all-pass.normalized.log` — fixed candidate (135/135).
- `03-negctl-A-assemble-root-owned.normalized.log` — assemble leak negative control (1 failed / 46 passed).
- `04-negctl-B-prestep-root-owned.normalized.log` — pre-step leak negative control (1 failed / 46 passed).
- `05-negctl-mutation-restore-verification.md` — mutation scope, restore byte/blob/SHA-256 record, log hash table.
- `06-post-restore-positive-4files.normalized.log` — post-restore positive (135/135).
- `07-gate-typecheck.normalized.log`, `08-gate-lint.normalized.log`, `09-gate-duplication.normalized.log`, `10-gate-docsync.normalized.log` — gates.
- `FINDINGS.md` — this file.

## Command log (each log independently named; first failures never overwritten)

All vitest runs used the repository's own configuration: `pnpm exec vitest run --project thread-safe <files>` with the project toolchain PATH prefix. Runs 2–6 executed against the final fixed candidate bytes (after the typecheck narrowing guards and the lint-safe proxy trap annotation); run 1 executed against the four unchanged start blobs.

1. Baseline (unfixed four files, raw log `01-baseline-4files-first-failure.normalized.log`): exit 1, 4 failed / 131 passed (135), 0 skipped. First failures: session-fork:289 `cannot get property "systemPrompt" without inject`; gateway:645 (fixture line 70) `cannot get property "fixtureScope" without inject`; goal:273 expected `'goal projection is not registered'`, got `cannot get required service "agents" in inactive context`; session-reference:606 `SESSION_REFERENCE_READ_FAILED` caused by `cannot get required service "sessionQuery" in inactive context`. Local counts were measured, not pre-filled from the remote report.
2. Fixed run (`02-postfix-4files-all-pass.normalized.log`): exit 0, 135 passed / 0 failed / 0 skipped (4 files).
3. Negative control A (`03-negctl-A-assemble-root-owned.normalized.log`): single-line mutation `ctx.on('system-prompt/assemble'` -> `ctx.root.on('system-prompt/assemble'` (one occurrence, programmatically verified). Exit 1, 1 failed / 46 passed (47). Only failure: the fixed test at the post-dispose assemble assertion `expect(routeReads).toBe(0)` (session-reference.spec.ts:656) — received 2: the destroyed resolver's assemble callback still executed through the leaked root-owned registration.
4. Negative control B (`04-negctl-B-prestep-root-owned.normalized.log`): single-line mutation `ctx.on('agent/pre-step'` -> `ctx.root.on('agent/pre-step'`. Exit 1, 1 failed / 46 passed (47). Only failure: the fixed test at the post-dispose pre-step dispatch (session-reference.spec.ts:659) — the waterfall rejected with `SESSION_REFERENCE_READ_FAILED` (cause `cannot get required service "sessionQuery" in inactive context`), stack `ctx.root.on.prepend -> prepareDirectMessages -> prepare`: the destroyed resolver's pre-step callback still executed instead of passing the seed through.
5. Post-restore positive (`06-post-restore-positive-4files.normalized.log`): exit 0, 135 passed / 0 failed / 0 skipped.

Mutation/restore byte, blob, and SHA-256 verification: `05-negctl-mutation-restore-verification.md` (original 20760 bytes, SHA-256 `84f274f3…c9d41`; every restore byte-identical, blob `2ac9980a90c89a77fbebd8a5b6e9a1eb274be49c`, working-tree diff empty).

## Acceptance detail per requirement

- C1: the observer callback demonstrably executed — `expect(observations).toBe(1)` plus the obtained assembly asserted (`provider`/`model`), then the real `agent/request` waterfall still checked for inherited route + `reasoningEffort: 'high'`. No root read, no self-constructed assembly, no production inject change.
- C2: default-root fallback verified (`scope: 'root'`); the file's existing `direct-caller`/`agent-scope`/`direct-src`/`agent-src` marker cases untouched; no fixtureScope service registered; lookup-failed cause, lookup-not-found, and provider-unbind-then-recovery all preserved.
- C3: three independent results — live-root service/projection removal observed directly (`ctx.get('goals')` undefined, projection stateOf undefined), stale instance rejected at the exact dependency layer, reinstall yields a different instance with the original goal restored disarmed; no arbitrary toThrow; no bypass of the disarm.
- C4: both events each have a pre-dispose positive control, a post-dispose real-path observation (assemble probe zero reads; pre-step seed identity + no `readSurface` call), and a post-reinstall recovery with no duplicate callbacks (exactly 2 route reads = one callback execution; exactly one appended context message). Stale-prepare rejection kept as a separate assertion with its cause layering.

## Temporary-resource cleanup

Each negative-control run lived in its own process; the committed session-reference test disposes its reinstalled fiber, probe listener, and spy in `finally`, and the goal/fork tests dispose their own contexts/fibers. The budgets describe's shared `afterEach` still disposes every harness context. No leaked listener, spy, probe, or root-owned registration remains.

## Gates (all on the final candidate bytes)

- `pnpm run typecheck` (`07-gate-typecheck.normalized.log`): exit 0, 0 errors. An intermediate run failed with six errors in the new session-reference test (unused probe parameter, `.messages` on the `reject` variant, indexed access under `exactOptionalPropertyTypes`); fixed by an underscore parameter name, `kind`-narrowing guards, and an indexed-access guard before rerunning.
- `pnpm run lint` (`08-gate-lint.normalized.log`): exit 0, 0 warnings, 0 errors on 3595 files. An intermediate run failed with one `typescript(no-unsafe-return)` in the probe's proxy trap; fixed with an explicit `string | undefined` return annotation and rerun.
- `pnpm run duplication` via `node_modules/.bin/jscpd` direct invocation (`09-gate-duplication.normalized.log`): exit 0, 0 clones (1747 files, 1,945,810 lines).
- `pnpm run doc-sync` (`10-gate-docsync.normalized.log`): exit 0 — 34 passed, 0 failed, 0 skipped (includes the new bilingual Agent Note's format and translation-pairing checks).

Every code-touching change between runs was followed by a rerun of the affected evidence (the healthy four-file suite and both negative controls were re-executed on the final bytes; recorded logs 02–06 are those final runs).

## NOT_RUN (out of scope this round)

- Full coverage run (`test:coverage`), Web (`test:web`), Gateway212, Loader122, exe-wheel, and the six legacy Windows golden scenarios — per round instructions not run by default.
- r39 three files, r38 guard/runner suites, and other previously verified rounds — not re-run; their recorded results stand.
- Real-model API / E2B — never invoked; no credentials read.
- Full-suite `pnpm run test` — CI owns exhaustive coverage; the four-file focused suite plus gates is this round's local evidence.
- Independent fresh-context review, commit, and push — deferred to the next stage by the round's stage gate.
- No separate "current handoff" file was updated this round: the r39-established pattern keeps `00-start-state.md` as the round's start/end handoff record (confirmed consistent by the independent review; recorded here for completeness).
