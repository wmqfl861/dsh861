# Agent Note: Observing log-only dispose failures in owned test contexts

Status: implemented

English | [中文](2026-09-16-cleanup-error-observation-r43.zh.md)

## Problem

Cordis catches disposer failures inside fiber unload, reports them through `ctx.logger.error`, and still settles `fiber.dispose()`. The r42 `OwnedTestContexts.cleanup` treated a settled disposal as a proven-clean teardown, so a fixture whose disposer failed only through the logger — the r42 Note's carried-forward caveat — resolved cleanup and deleted its root even though quiescence was never proven. Most fixtures have no `afterDispose` probe, so nothing else stood between the logged failure and `rmSync`. The r42 held-disposer regression had the same weakness as a test: its gate release and cleanup wait sat after the assertions, so an assertion failing early would strand the held disposer and the already-started cleanup.

## Decision

`OwnedTestContexts.cleanup` now installs a `DisposeFailureObserver` on each fixture's structured logger outlet before starting its disposal and removes it only after that disposal settled. The observer registers directly in the fixture app's exporter map rather than through `ctx.logger.exporter()`, because that public registration is fiber-owned and is removed by the very disposal under observation — before late child-fiber errors are logged; every fixture gets the observer automatically, with no per-test probe. Error-level records captured across the whole window — the original reason objects, each labeled with its reporting fiber — veto that fixture's deletion and reject cleanup as a per-fixture AggregateError naming the kept directory, while remaining fixtures still clean and dispose rejections and `afterDispose` vetoes keep their r42 semantics. The held-disposer regression moved its gate release and cleanup wait into a `finally` that runs unconditionally from before cleanup starts, capturing the cleanup settlement beside — not instead of — a failed assertion's error; a new early-failure regression throws a unique sentinel at the original observation position and proves the finally released the gate, awaited the real cleanup to completion, and kept the sentinel visible.

## Alternatives considered

**Registering the observer through `ctx.logger.exporter()`.** The returned disposer is owned by the root fiber and runs during the same disposal, concurrently with every other disposer; an async child-fiber failure logged after that removal would be missed, which is exactly the blind spot the observer exists to close.

**Reading the logger's built-in buffer after disposal.** The buffer exporter is itself fiber-owned and is removed during unload, and the buffer is bounded at 1000 records, so both its lifetime and its tail cannot prove the absence of failures.

**Filtering errors by the logging fiber's lifecycle state.** Errors surface from both unloading and reloading fibers during teardown; suppressing the latter would swallow real teardown failures — including the continuable-activation drain failure described below — to keep two suites green.

**Spying the logger prototype or console.** Uncontrolled global modification with the same child-logger coverage gap; the structured exporter outlet already delivers every message with its reporting fiber.

## Consequences

Four new regressions (root sync throw, child plugin async rejection, child disposer failing only after a deferred release, two faulty fixtures beside a healthy one) failed deterministically on the old helper — cleanup resolved and deleted the faulty roots — and pass on the fixed one; the deferred regression doubles as the proof that observation outlives the whole asynchronous disposal. Two negative controls on the final helper bytes keep their discriminating power: removing only the captured-error veto, and stopping observation immediately after `dispose()` is invoked, each fails exactly the four regressions; both mutations restored byte-identically (SHA-256 and git blob re-verified) and the suites returned to their fixed state. The protection immediately exposed two real, pre-existing log-only teardown failures that r42's 35/35 could not see: the agent-team `agentTeams.runtimeLifecycle()` disposer's `disposeRuntime()` reads the team projection after the root-owned projection deregistration already ran, and the subagent `ContinuableActivationRegistry.drain()` cannot read a held activation's inbox state once its projection registration is inactive; both reproduce in single-test isolation, both keep failing under the new helper, and fixing them needs production changes that this round's scope forbids, so the two r42 teardown tests now fail honestly and are reported as the gap they always were. The new helper skips their `afterDispose` takeover probes when errors are captured, so the probes did not run in the fixed-candidate runs; the kernel locks were still proven released by the same tests' full probe paths passing under the old helper (r43 first-failure run, identical fixtures) and in r42 CI on both platforms — teardown-completeness defects, not lock leaks. Production Cordis, AgentLoop, persistence, locks, vendor, and the two main suites' assertions are untouched. Evidence: [windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-16/cleanup-error-observation-r43/windows-execution/FINDINGS.md).
