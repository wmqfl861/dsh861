# R1 old-interface forensics verdict (2026-09-17)

Run: `05-r1-first-failure.normalized.log` (raw repo-external `r44b-exec-raw/02-r1-first-failure.*`; exit 1; 3/3 failed at target assertions; spec `packages/core/agent-loop/tests/teardown-ownership.spec.ts`, old interfaces only, production sources at baseline blobs).

## Trajectory facts (old implementation)

- **R44-K09** (factory multi-handle wait, handle path): failed at the pending assertion (`packages/core/agent-loop/tests/teardown-ownership.spec.ts:157`) — with handle A's real durable close rejecting (sentinel A, injected at the fixture's own persistence handle around the real close) and handle B's real durable close gated, the `agentLoop.transactions()` effect settled immediately (`FactoryOwnership.dispose()` awaits `Promise.all` over started `liveAgents`/`startupTasks`, which rejects on the first rejection). B's cleanup entered (`b:close-entered`) and was still gated at that moment. Trajectory: factory transaction settled BEFORE B's real cleanup; provider fiber completion not yet reached.
- **R44-K10** (startup path): failed at the same pending assertion (line 215) — with an admitted-but-unpublished `agents.create` whose real rollback recovery (its durable handle close) was gated and handle A failing fast, the factory transaction again settled early on A's sentinel alone. The unpublished object never entered the registry (`ctx.agents.get` undefined), and the public call retained its own error, separate from the factory result.
- **R44-K11** (scope/inbox ownership): failed at the scope-retention assertion (line 287) — track `['k11:stream-entered', 'k11:cancel-legal-inbox-use-ok', 'k11:scope-registration-revoked']`: legal inbox use at cancel time succeeded (projection active), then during provider unload the agent's scoped registration was revoked while the driver's real cleanup was still gated by the held model stream. Confirms the cross-fiber sibling path: `createScope(loopCtx, …)` registers the scope child fiber's disposer on the loop fiber, and `prepare()`'s owner-side `yield machine.scope.rawDispose` cannot remove it (`Fiber.effect` collect deletes only from the effect's own fiber, `vendor/cordis/src/fiber.ts:449-451`), so provider unload releases the scope concurrently with the handle teardown instead of inside it.
- **S03 trajectory** (factory vs continuation drain, production path): the baseline reproduction `04-baseline-repro-r44b.log` (2 failed / 38 passed, exit 1) shows the real production failure — `ContinuableActivationRegistry.disposeRoots` (`continuation-activation.ts:530` ← `drain:335` ← SubagentRuntime inject-fiber teardown) reaching `finishDisposal`'s `cancel({kind:'parent'})` after the inbox projection was already revoked by the concurrent AgentLoop-fiber scope unload; the same fixture also logged the Team-side projection error. Same mechanism as K11, observed end-to-end in the real domain suites.

## Verdict per path (supplement S1 R1-c)

| Path | Verdict |
|---|---|
| Factory multi-handle/startup wait (`FactoryOwnership.dispose()` Promise.all early settle) | 缺口成立 (K09, K10) |
| Scope/inbox premature revocation on provider unload (cross-fiber sibling release) | 缺口成立 (K11 + production S03 trajectory) |
| Cancel ordering (clear failure skips abort) — K05 basis | 源码事实 `agent.ts:149-155`（clear 先于 abort，clear 抛错即跳过 abort）；K11 轨迹中取消时尚未卸载故 clear 成功，生产 S03 轨迹中该缺陷直接可见 |
| Structural wait already covering the gap elsewhere | 未发现：provider fiber `_unload` 确会等待被收集 disposer（`fiber.ts:692-702`），但工厂事务本身提前 settle 且漏报其余错误（K09/K10 直接观察）|

## Conclusion

The §5.3 protection-surface extension basis (typed teardown participation in `dsh-agent`, ordered scope ownership and factory wait in `dsh-agent-loop`, cancel exception safety) is SUPPORTED by real old-interface trajectories. No reduction of scope is warranted. Proceed to R2.
