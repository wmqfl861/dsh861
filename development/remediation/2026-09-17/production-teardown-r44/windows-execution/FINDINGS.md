# r44-B execution findings (2026-09-17, re-dispatched executor)

## Bottom line

Both original production teardown failures are fixed and the full applicable verification matrix is green, except the honestly-declared gaps below. The five previously declared acceptance gaps were completed by the r44b3 dispatch and hard-review round 2 confirmed them with its own independent re-runs; round 2 then FAILed on one manifest-completeness ground (undeclared gate-required regeneration `api-catalog.ts`), which the r44b4 dispatch remediated exactly along the reviewer's disposition path (S3 declaration, `__pycache__` cleared, re-frozen 63-item `candidates/candidate-r44b4.md`, gates green on final bytes). Hard review round 3 returned an explicit **PASS** for that candidate. No commit or push happened; the S3 scope ratification of `api-catalog.ts` is explicitly reserved for the owner-side independent audit before commit/push is restored.

## Original failures → green

| Original failure (r43/baseline run 01) | State after R3+R4 |
|---|---|
| control: `ends a held model gate and releases write ownership through suite teardown` (tool-subagent-control.spec.ts:387) | GREEN — base-40 40/40 (run 08/09 evidence) |
| team: `owns every setup runtime and storage through suite teardown` (tool-team.spec.ts:495) | GREEN — same runs |

Both green runs also prove the three `afterDispose` write-ownership takeovers execute (the assertions inside those tests) and that the r43 observer ledger reports zero teardown failures (otherwise the expectations reject).

## Implementation summary (six production files, blobs in candidate manifest)

1. `dsh-agent`: `AgentTeardownHooks` (`begin(agent, completion)` synchronous handover; `beforeRelease(agent)` domain preparation) + optional `teardown` on Create/Resume options.
2. `dsh-agent-loop` index: `FactoryOwnership.dispose` starts every tracked obligation, waits for ALL to settle, then reports every original failure (aggregate); shared `notActiveError`. `prepare()` publishes the shared completion first, calls `begin` before cancel, runs cancel → whenIdle → beforeRelease → scope release → durable close → detach with independent failure collection; the machine's scope structural disposer is collected ON the factory fiber (`agentLoop.providerOwnership(id)`, removing the sibling registration) with a join wrapper that fuses the factory-level reason first; the owner effect (`agentLoop.lifecycle(id)`) joins the same memoized cleanup; retired-wrapper markers plus `initiatedBy` prevent self-waits.
3. `dsh-agent-loop` agent: `cancel` performs the abort even when the inbox clear fails and rethrows the original error (K05).
4. `continuation-activation.ts`: close-facts (`TeardownRecord`) created before create/resume; hooks threaded through; one shared memoized pre-release preparation `P(x)` per Activation with `parent|owner|natural` entry (natural skips the duplicate flush); `finishDisposal` = preparation → join `H(x)` (`handle.dispose`) → terminal/bookkeeping; constructor effect is an explicit `drainThenReleaseScope` transaction (a drain rejection cannot skip the scope release — the Cordis effect chain skips disposers after a rejected one); `disposeRoots` keeps identity through `cause` aggregates.
5. `subagent/src/index.ts`: the continuation manager's injected child fiber lifetime is collected by the service-side composite effect; the `continuations` slot clears only after that fiber's full drain and structural release, by exact identity.
6. `agent-team/src/index.ts`: the projection lives in a dedicated injected child fiber; the runtime lifecycle effect collects its exact disposer and runs `closeThenReleaseScope` (explicit transaction — a close rejection cannot skip the projection release; this defect was found by T02 during this round); `closeRuntime` is a one-time joinable transaction (synchronously started on ancestor unload through real `internal/status` fiber events); `disposeRuntime` keeps real holds on admitted creations/dispatches and every selected-child drain (`withTimeout` observes the deadline only), resamples members that complete provisioning at the boundary, filters runtime cancellation, and reports all failures.

## Mechanism findings (probe scripts, repo-external `r44b-exec-raw/probe-collect*`)

- The vendored Cordis `DisposableList.clear()` returns disposables in REVERSE registration order; fiber unload runs them concurrently.
- An effect's wrapper is pushed to the fiber's disposable list BEFORE `execute` runs (reentrant unload can find a mid-minting effect).
- Async-iterator effects in this vendored Cordis do NOT collect yielded disposers (collected items are dropped) — the `providerOwnership` design uses a sync generator for this reason.
- `ctx.effect`'s collect deletes the yielded disposer from the effect's own fiber only — same-fiber collection is what removes the scope sibling registration (the root cause of the S03/K11 defect).

## Verification matrix (all runs' raw logs in repo-external `r44b-exec-raw/`; normalized copies + hashes in this directory)

| Stage | Result |
|---|---|
| Baseline reproduction (run 01) | 38/2, exit 1 — matches r43 (04-baseline-repro-r44b.log) |
| R1 first failure (run 02) | K09/K10/K11 all fail at the target assertions on the old implementation (05/06 evidence) |
| R2 core (runs 03–07) | K09–K11 green; K01–K08 added; agent-loop+agent 30 files green (510+1 pre-existing skip) |
| R3+R4 base-40 (runs 08–09) | 40/40 green |
| New owner-local suites | K 11/11, S 13/13, T 8/8 (final re-verification run 31: 32/32) |
| Adjacency §11.2 | subagent suites + core suites green (runs 10–11, 19) |
| agent-team suite incl. two revised timeout cases | 75/75 (run 25) |
| Combined §11.1+§11.2 (run 19) | 1097 passed (one T05 instability later fixed by context cleanup + deterministic gate) |
| Negative controls (on final bytes) | Team: negative exit 1, restore SHA equal, positive exit 0. Subagent: same three. (07-negative-controls.summary.md) |
| build | exit 0 |
| typecheck / lint / duplication / test:docs / doc-sync | exit 0 each |
| hygiene | 14/16 pass; FAIL node-next types (silent non-zero tsc subprocess, cause not localized; CI owns this signal) and FAIL vendored links (`pnpm-lock.yaml` has two YAML documents; git-clean file, pre-existing condition; vendor/scripts are outside scope) |
| test:snapshot lane (this Windows host) | BLOCKED by a pre-existing host defect — see Gaps #6 |
| teardown.snapshot.ts adapter (built + DSH_EXAMPLE_MODE=lib) | 2/2 pass in both modes (36/37 evidence) |
| golden determinism | 12/12 consecutive independent validations match after the ordering-race fix (37 evidence) |
| corpus gate | 3/3 pass |
| Python PY-B01/B02 (incl. space-path) | pass; PY-B03..B07 9/9 rejections at argparse with clear diagnostics |

## r44b3 completion of the five declared gaps

1. S4.3 TS teardown scenarios — implemented and run for real: `teardown.snapshot.ts` green in built and lib modes; goldens regenerated from real runs through the lane's own refresh normalization and validated by repeated independent real runs (12/12 after the ordering-race fix; see 37).
2. S4.4 Python — implemented and run: PY-B01 (plain + space-containing path), PY-B02, and the 9-case rejection matrix all pass; the built CLI is launched through the SDK test-private `_launch_args` with the script owning the complete environment.
3. §10.4 docs — written and gated: the bilingual Agent Note trio, four package README pairs, the `docs/architecture.md` teardown paragraph, and regenerated catalogs; test:docs 16/16, doc-sync 34/34.
4. Built smoke — the same two scenarios replayed under `DSH_EXAMPLE_MODE=lib` (2/2) and the full gate chain re-run on final bytes.
5. hygiene — both failures diagnosed and evidenced (35): node-next is an EPERM directory-symlink throw swallowed by a stdout/stderr-only catch (host privilege condition, not tsc, not the candidate); vendored links is the pre-existing two-document lockfile.

## Remaining declared gaps (environment-conditional, not candidate-caused)

6. The shared `sdk.snapshot.ts` replay lane cannot run on this Windows host: `hydrateReplayFixtures` replaces `{{cwd}}` with a raw backslash path inside JSONL text, producing invalid JSON escapes; llm-replay then fails to load and the first prompt reports `cannot create effect on inactive context`. Control evidence: the pre-existing `subagent-continuable` and `subagent-continuable-inheritance` scenarios fail identically on this host. The lane is owned by macOS/Linux CI (`snapshots/AGENTS.md`); `sdk.snapshot.ts` is outside the approved writable list (S3 report-first). The two new scenarios' real-run equivalence on this host is covered by the golden validation (37), the corpus gate, and the teardown adapter.
7. `uv run --offline --project python/sdk` cannot resolve on this host (no cached tomli/cp312 pydantic wheels; the r24 uv cache is macOS-flavored). No new software was installed: the SDK ran from an existing-machine-cache venv plus `PYTHONPATH` to `python/sdk/src`, which resolves the same source the project environment would.

## Hard review (round 1) and the mid-review repair

The designated OpenCode hard review (zhipuai-coding-plan/glm-5.3, run 2026-09-17T08:20–08:37Z, exit 0, stdout SHA e0a36011…, archived at `review/r44b-hard-review-round1.md`, raw repo-external `r44b-opencode-review/`) verified the frozen candidate's integrity (all 11 SHA-256 matched the manifest) and returned an explicit **FAIL** with two grounds:

1. **F1 (production defect, since fixed)**: the continuation binding composite effect's yield order meant, under Cordis reverse unload, the `continuations` slot cleared BEFORE the manager's drain — the opposite of plan §6.4. Fixed during the review: `settleManagerLifetime` now settles the child fiber's complete lifetime first and clears by exact identity after, with the explicit-transaction shape (no chain short-circuit); pinned by new case `R44-S14` (a drain call racing the runtime unload stays pending on the real activation close while the child's model gate holds, then both settle; suite 14/14). Affected suites re-verified green (run 34: 17 files, 387+1 skip; runs 36–41 for the S suite itself; typecheck 0; lint 0).
2. **Declared gaps**: the S4.3/S4.4 snapshot scenarios, PY-B01..B07, built smoke, §10.4 docs, and the two hygiene failures — plan §14.3 items 9–10 unmet (see Gaps).

Because the binding fix plus S14 form a NEW candidate (re-frozen; manifest SHA-256 `f88eaa47…`), round 1's FAIL stands for the pre-fix candidate.

## Hard review round 2 (FAIL, single blocking finding) and the r44b4 remediation

Round 2 (2026-09-17T15:16:50–15:31Z+, archived at `review/r44b-hard-review-round2.md`; invocation record `review/r44b-hard-review-round2-invocation.md`; exit code NOT captured — the wrapper died with the previous agent's session before opencode exited, honestly recorded, not fabricated) verified all 62 manifest entries, independently re-ran the substantive acceptance (S-suite 33/33 incl. S14, teardown adapter 2/2 built + 2/2 lib mode, corpus 3/3, §11.1 first command 62/62, gen-cordis-catalog --check), judged both honest declarations acceptable as "environment-conditional blocking + equivalent execution", and returned **FAIL** on exactly one blocking ground: `packages/extensions/tool-cordis/src/api-catalog.ts` (+6/−2) — a gate-required mechanical projection of the candidate's approved public-type changes (`AgentTeardownHooks` entry; `teardown?` field on Create/ResumeAgentOptions) left out of the 62-item manifest and undeclared, violating §12.1/§13/§14.3 item 10. Non-blocking: `scripts/__pycache__` residue; the round-1 `TeardownRecord.completion` write-only minor issue (standing, non-blocking).

Remediation per the reviewer's own disposition path (round-2 section 5): S3 declaration filed (`windows-execution/38-s3-declaration-api-catalog.md` — facts, honest after-the-fact report, authorization judgment with no-in-list-alternative analysis, owner-ratification boundary); `scripts/__pycache__` deleted; candidate re-frozen as `candidates/candidate-r44b4.md` (63 items = the 62 rows byte-identical + one api-catalog.ts row; manifest SHA-256 `74cc5349…`); gates re-run on final bytes (`windows-execution/39-r44b4-gate-rerun.md`): manifest 63/63 triples, gen-cordis-catalog --check 0, git diff --check 0, base-40 40/40, owner-local 33/33, doc-sync 34/34 exit 0; git-status reconciliation: all 32 modified tracked files inside the manifest, no strays.

## Hard review round 3: PASS

Round 3 attempt 1 (15:48:23Z) aborted mid-review without a verdict when a Write to an external temp directory was auto-rejected in headless mode (archived `review/r44b-hard-review-round3-attempt1-aborted.md`). Attempt 2 (prompt amended with an inline-bash operational constraint; 15:52:23–16:05:55Z, exit_code=0 properly captured; invocation record `review/r44b-hard-review-round3-invocation.md`) independently re-verified the delta — 62 rows byte-identical between manifests, api-catalog.ts triple and +6/−2 line-by-line as pure projection of `agent/src/index.ts:66/:143/:182`, 63/63 triples, status reconciliation, `git diff --check` 0, `gen-cordis-catalog --check` 0, and a full independent doc-sync re-run with the executor's toolchain (34/34 in 205.74s, exit 0) — confirmed its own run left the worktree undisturbed, and returned an explicit **PASS** for the 63-item candidate (`review/r44b-hard-review-round3.md`, final line). Raw repo-external `r44b4-opencode-review-r3{,b}/`.

## Integrity facts

- Branch `chore/latest-stable-upgrade-20260912`, HEAD `e8d1858ca6a65710c346007e48809580f6064beb` unchanged; no reset/rebase/amend/stash/clean/force-push; PR untouched.
- The three retained r44-A originals untouched; frozen plan/inputs byte-identical.
- All raw run logs repo-external with per-run invocation records (argv, exit codes, byte counts, SHA-256); normalized copies under `windows-execution/` with account-name scrubbing.
- Codex supplement invocation evidence: `supplement-planning/supplement-invocation.md` (attempt 1 abnormal termination without fabricated exit code; attempt 2 exit 0).
- OpenCode hard review: running/complete per `review/` artifacts (`r44b-hard-review-prompt.md` + repo-external `r44b-opencode-review/`).
