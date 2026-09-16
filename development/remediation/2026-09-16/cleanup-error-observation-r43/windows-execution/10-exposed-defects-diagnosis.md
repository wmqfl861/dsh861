# r43 exposed pre-existing defects: log-only teardown failures in the r42 teardown positive-controls

The new dispose-error observation is active for every fixture with no per-test probe. On its first fixed-candidate run it exposed two real, pre-existing, error-level teardown failures that the r42 helper resolved over silently. Both reproduce deterministically in single-test isolation. They are NOT introduced by r43: run `02-first-failure` (old helper, same fixtures) shows both tests passing because nothing observed the logger — the identical physical teardown behavior, unobserved. Fixing either requires production changes (Cordis concurrency semantics, agent-team/subagent runtime implementations), which this round's scope forbids; the two r42 tests now fail honestly and their assertions were not modified.

## Defect 1 — tool-subagent-control teardown test (`tool-subagent-control.spec.ts:387`)

Test: `dsh-tool-subagent-control > ends a held model gate and releases write ownership through suite teardown`. Fixture keeps a child's model call held at the manual gate; suite teardown aborts it and disposes the runtime.

Logged failure (one child-fiber error in the fixture's dispose window):

```
SubagentError: continuable subagent teardown failed for 1 activation(s): agent "<uuid>" cannot read inbox state: its projection registration is not active
    at ContinuableActivationRegistry.disposeRoots (packages/subagent/subagent/src/continuation-activation.ts:530)
    at ContinuableActivationRegistry.drain (packages/subagent/subagent/src/continuation-activation.ts:335)
    at RegistryService.plugin wrapper (scripts/test-invariants.ts:76)
    at Proxy.inject (vendor/cordis/src/registry.ts:301)
    at new SubagentRuntime (packages/subagent/subagent/src/index.ts:201)
    at Fiber.execute / Fiber._execute / Fiber._reload (vendor/cordis/src/fiber.ts)
```

Mechanism: during the fixture's disposal a subagent-runtime fiber (re)loads and its startup path drains the still-resident continuable activations; the held activation's inbox close transaction then reads inbox state through a projection registration that is no longer active, so `disposeRoots` throws `ACTIVATION_TEARDOWN_FAILED`, Cordis logs it (`Fiber` catches and reports through `ctx.logger.error`), and `fiber.dispose()` still resolves. The new helper skips `afterDispose` when errors are captured, so this test's takeover probe does not run in fixed-candidate runs; the kernel lock was still proven released by the same test's full probe path passing under the old helper (r43 run 02, identical fixtures) and in r42 CI on both platforms — the failure is teardown-completeness, not a lock leak.

Isolation: `diagnostic-control-isolated.normalized.log` — `vitest run -t "ends a held model gate"` alone: exit 1, 1 failed / 17 skipped. Intra-fixture; not cross-test pollution.

## Defect 2 — tool-agent-team teardown test (`tool-team.spec.ts:495`)

Test: `dsh-tool-team > owns every setup runtime and storage through suite teardown`. One test creates two setups; the active teammate hangs; suite teardown must close both.

Logged failures (two child-fiber errors on one fixture):

```
Error: Agent Teams projection is not registered
    at TeamJournal.state (packages/experimental/agent-team/src/journal.ts:31)
    at TeamRoster.liveChildrenByRoot (packages/experimental/agent-team/src/roster.ts:228)
    at TeamService.disposeRuntime (packages/experimental/agent-team/src/index.ts:313)
```
plus the same `SubagentError: continuable subagent teardown failed ...` as Defect 1.

Mechanism: the `agentTeams.runtimeLifecycle()` effect (`agent-team/src/index.ts:116-124`) registers the team projection via `ctx.root.sessionProjections.register(...)` — a root-fiber-owned registration — and its disposer deliberately runs `disposeRuntime()` before calling `disposeProjection()` in a `finally`. But under root-fiber unload every disposer runs concurrently (`Fiber._unload`: `Promise.all` over the reversed registration list), and the root-owned projection deregistration (registered after the team plugin's own wrapper) runs before `disposeRuntime` reaches its projection read, so `journal.state()` sees the projection gone. The author-intended try/finally ordering only holds for manual disposal, not for root-fiber unload. The subagent error follows the same shape as Defect 1 for the hanging teammate's activation. As with Defect 1, the takeover probes do not run in fixed-candidate runs (`afterDispose` is skipped when errors are captured); their full path passed for this same test under the old helper (r43 run 02) and in r42 CI on both platforms.

Isolation: `diagnostic-team-isolated.normalized.log` — `vitest run -t "owns every setup runtime"` alone: exit 1, 1 failed / 11 skipped.

## Consequences for the run matrix

Every fixed-candidate run of the three suites reports **2 failed / 38 passed (40), exit 1**: 10/10 owned-contexts regressions (five r42 + four new vetoes + the new early-failure finally regression) and 28/30 main-suite tests pass; the two failures above are the honest outcome of the mandated protection ("清理失败不可吞掉、未证明静止不得删目录"). Under both negative-control mutations these two tests pass again — additional confirmation that the only delta is the veto judgment/observation window, not fixture behavior. Out of scope this round per the task: Linux/POSIX validation, coverage, Python, Windows idle-watchdog/Inspector/browser-asset failures, and any production fix for the two defects above (candidate for a follow-up round; the exact code sites are listed so a production round can plan the fix).
