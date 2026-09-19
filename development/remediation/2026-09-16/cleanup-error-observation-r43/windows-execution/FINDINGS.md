# r43 FINDINGS — cleanup error observation for owned test contexts (2026-09-16, Windows execution)

Round: r43. Branch `chore/latest-stable-upgrade-20260912`; start local/remote HEAD `c791b40e35580efd63ebc85607a8c898c64177fb` (verified identical, clean tree, no fetch). Task sources: PR #13 comments `5699149348` (A–H) and `5699127990`, read credential-less via api.github.com REST, both HTTP 200. No commit, no push in this round; stage gate reached (report for fresh-context independent review).

## What this round is and is not

This is the Windows-local execution of the two r43 fixes on the test-only ownership ledger: (1) log-only dispose failures now veto directory deletion, and (2) the held-disposer regression cleans itself through a reliable finally. It is NOT a fix for the four new-CI business failures, NOT a production change of any kind (Cordis fiber `44145a02…`, logger `0dc97c16…`, AgentLoop, JSONL lease/persistence, Windows lock implementations, vendor, workflow, and all r29–r42 evidence are byte-identical to c791), NOT Linux/POSIX validation, and NOT coverage/Python/Inspector/browser work.

## Change summary (test-only)

1. MODIFIED `packages/subagent/tool-subagent-control/tests/owned-contexts.ts` (start blob `da23db7d7ba9351c0b6006b2e3a4b1c120f5cc6c` → final blob `7713e57d18adab01b5ed4ceb59c08ebb66e3bfd5`, 9013 bytes, SHA-256 `a2fb51df267c5d350a7d4cb7265f5e02f2af4e3bc7ddf4536d241c850b53f36a`): new module-private `DisposeFailureObserver` (exporter registered directly in the per-fixture-app exporter map under a fixed negative key — never through the fiber-bound `ctx.logger.exporter()`; installed before disposal starts, detached only after `await ctx.fiber.dispose()` settled; `export` cannot throw; records the original reason plus root/child/unknown fiber attribution); `cleanup` now also vetoes per fixture when captured error-level records exist, rejecting with a per-fixture `AggregateError` that names the kept directory and the fiber sources, while dispose rejections and `afterDispose` vetoes keep r42 semantics and every fixture is protected automatically.
2. MODIFIED `packages/subagent/tool-subagent-control/tests/owned-contexts.spec.ts` (start blob `3db9a7732afa2f97c8da51ffcc42e02694154762` → final blob `56a60a2f9c8cc753522ae53ae4bdb9d5dc886291`, 15746 bytes, SHA-256 `e5168046aeb6102359bd38cac11a90a41614c947972b20e43e7e97863143d1e7`): held-disposer test wrapped in try/finally (gate release + captured cleanup await run unconditionally); new early-failure regression with sentinel `owned-contexts sentinel: assertion failed while the disposer was held` proving finally released the gate, awaited the real cleanup, kept the sentinel visible and no secondary failure; four new veto regressions under `describe('disposal failures reported only to the logger')` with unique sentinels (root sync throw, child plugin async rejection, child disposer failing only after a deferred release with happens-before proof, two faulty fixtures + healthy fixture with per-fixture attribution), one carrying an independent witness exporter on the same outlet proving original delivery is not replaced.
3. The two main suites (`tool-subagent-control.spec.ts`, `tool-team.spec.ts`) were NOT modified — the protection reaches their afterEach through the shared helper, which the task's minimal-wiring preference allows.

## Run matrix (every row is one physical child process; exit codes actually captured)

| Stage | Log | Exit | Result |
|---|---|---|---|
| First failure (old helper + new regressions) | 02 | 1 | 4 failed / 36 passed (40) |
| Fixed candidate (first pass, pre-lint-fix spec bytes) | 03 | 1 | 2 failed / 38 passed (40) |
| NC-ignore-logged-failure (mutated) | 04 | 1 | 4 failed / 36 passed (40) |
| NC-ignore restore-positive | 05 | 1 | 2 failed / 38 passed (40) |
| NC-observer-too-short (mutated) | 06 | 1 | 4 failed / 36 passed (40) |
| NC-observer restore-positive | 07 | 1 | 2 failed / 38 passed (40) |
| Final positive (final bytes, end-state) | 14 | 1 | 2 failed / 38 passed (40) |

The two persistent failures in 03/05/07/14 are the same two pre-existing, log-only teardown failures exposed by the protection — see `10-exposed-defects-diagnosis.md` (agent-team projection deregistration races `disposeRuntime`; continuable-activation inbox close reads inactive projection registrations). They pass under both NC mutations and in run 02 (old helper), proving the only behavioral delta is observation, and their assertions were left unchanged per scope. Diagnostic single-test isolations for both are checked in (`diagnostic-control-isolated`, `diagnostic-team-isolated`).

First-failure detail (run 02, old helper): all four regressions fail at `expect(failure).toBeInstanceOf(AggregateError)` — `AssertionError: expected undefined to be an instance of AggregateError` (`owned-contexts.spec.ts:237`, `:258`, `:293`, `:316` at those bytes) — cleanup resolved, accepted the logged-only failures, and deleted the faulty directories. Negative-control failing assertions are the same four first assertions (`15-mutation-restore-verification.md` records both mutation points, mutated bytes/SHA-256/git blobs, and byte-identical restores re-verified on all three measures).

## Gates

- `pnpm run typecheck` exit 0 on final bytes (`08-gate-typecheck.normalized.log`; an earlier exit-0 run on pre-lint-fix bytes exists repo-external only).
- `pnpm run lint` — first attempt exit 1 with 17 errors in the new spec code (six untyped then-rejection callbacks → `use-unknown-in-catch-callback-variable`/`no-unsafe-return`/`no-unsafe-assignment`, one `@stylistic/arrow-parens`); fixed by explicit `(error: unknown)` annotations and arrow parens; final run exit 0, 0 warnings 0 errors (`09-gate-lint.normalized.log`; the failing attempt log stays repo-external per r42 precedent).
- `node_modules/.bin/jscpd --config .jscpd.json packages scripts` exit 0, 0 clones (`11-gate-duplication.normalized.log`).
- `pnpm run verify-translation-pairing --write <r43 note>.md` exit 0; `.i18n.yaml` records blobs `5b7f2e90d164c9bed48ecef7a63e8602aa7804cb` (en) / `ce6e9bb7c6f6b95e1f8e35dc75b27a1fc44c34ad` (zh) at first pairing (`12-gate-pairing.normalized.log`). After the review-driven Note correction (probe-attribution wording), pairing re-ran exit 0 and re-recorded blobs `1bf052c42195e47ebfe0946785ea19789067a962` (en) / `b632a6d01b87a84b7d3e1a947e3e78dbf904e456` (zh) (`16-gate-pairing-post-review.normalized.log`), and `pnpm run doc-sync` re-ran exit 0 on the corrected tree (`17-gate-docsync-post-review.normalized.log`).
- `pnpm run doc-sync` — result in `13-gate-docsync.normalized.log` (run last, after this evidence tree and the Note pair existed).
- No commit/push hooks ran (nothing committed in this round).

## Bilingual Agent Note

`.agents/notes/implemented/testing/2026-09-16-cleanup-error-observation-r43.md` + `.zh.md` + `.i18n.yaml`. The Note documents closing the r42 carried-forward caveat and explicitly records the two exposed production teardown defects with their code sites as follow-up work. Historical r42 Note/FINDINGS untouched.

## Residue note

Each fixed-helper execution of the two defect tests leaves its veto-kept fixture root in the OS temp directory: their r42-era `finally` blocks predate the veto and were not modified this round. The 14 directories accumulated across this round's runs were removed after their diagnosis was captured in the checked-in logs; the production-fix round should give those two tests kept-directory handling alongside the actual fix. The fresh-context review's verification re-runs left four more veto-kept directories (`dsh-tool-subagent-control-{UYx1G9,zVN3WO}`, `dsh-tool-team-{4t53wb,g3NCkn}`); they were removed at the commit stage and are recorded here like the round's own residue above.

## NOT_RUN / boundaries

- No commit, no push, no CI trigger/cancel; PR #13 remains draft, base unchanged, P0-B blocked, no P0-C.
- No Linux/POSIX execution; no full coverage, Web/Gateway212/Loader122/exe-wheel, six old Windows goldens, real-model API, E2B, or CI artifact downloads (remote forensics per task comment section G already complete).
- No fix for the two exposed production teardown defects (production out of scope this round); r42's old no-dispose/no-await mutations were not re-run (task section E).
- No gh install; no keys/global credentials/user .env read; no external agent invoked; no model/auth/system changes.
- Round-local results do not imply the new CI, the 62-file coverage shortfall, the Linux Python wide-completion failure, the Windows idle-watchdog/Inspector/browser failures, or the upgrade stages pass.
