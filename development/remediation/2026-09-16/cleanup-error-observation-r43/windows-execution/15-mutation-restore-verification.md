# r43 mutation / restore verification (both negative controls)

Driver: `C:/dsh-r43-work/nc-run.mjs` (repo-external). Each phase verifies the anchor occurs exactly once, writes the mutated helper bytes, runs the full three-suite vitest command, restores the original bytes in a reliable `finally` regardless of the run outcome, verifies restore byte-identity, then runs the post-restore positive. Both driver processes awaited every spawned child to exit; exit codes below are the actual child exit codes captured by the driver.

Fixed candidate helper bytes for both phases: `packages/subagent/tool-subagent-control/tests/owned-contexts.ts` — 9013 bytes, SHA-256 `a2fb51df267c5d350a7d4cb7265f5e02f2af4e3bc7ddf4536d241c850b53f36a`, git blob `7713e57d18adab01b5ed4ceb59c08ebb66e3bfd5`.

## NC-ignore-logged-failure

Unique modification point: in `OwnedTestContexts.cleanup`, the captured-error judgment block (`if (captured.length > 0) { failures.push(new AggregateError(...)) }` plus the `|| captured.length > 0` term of the skip-deletion `continue`) is replaced by `if (disposeFailed) continue`. Observation still installs and detaches; the dispose await, real logger, and all positive behavior stay.

- Mutated helper: 8689 bytes, SHA-256 `c0f15aeac1072db71da7279f29f1500cfa8d93cb70ea090471c78c583dff4ec1`, git blob `d17fa74fe21e75a4decc69080504e4dd4b1d2c3a`. Mutated copy: `04-nc-ignore-logged-failure.mutated-owned-contexts.ts` is repo-external (`C:/dsh-r43-work/raw/nc-ignore-logged-failure.mutated-owned-contexts.ts`).
- Mutated run (`04-nc-ignore-logged-failure.normalized.log`): exit 1, **4 failed / 36 passed (40)**. Exactly the four new regressions fail, each at `expect(failure).toBeInstanceOf(AggregateError)` — `AssertionError: expected undefined to be an instance of AggregateError` — because the logged-only failures were accepted and the faulty directories were deleted. No syntax, import, timeout, or zero-test failure.
- Restore (driver finally): byte-identical `true`; restored 9013 bytes, SHA-256 `a2fb51df267c5d350a7d4cb7265f5e02f2af4e3bc7ddf4536d241c850b53f36a`, git blob `7713e57d18adab01b5ed4ceb59c08ebb66e3bfd5` — equal to the fixed candidate on all three measures.
- Post-restore positive (`05-nc-ignore-restore-positive.normalized.log`): exit 1, **2 failed / 38 passed (40)** — the four regressions pass again; the two remaining failures are the pre-existing defects documented in `10-exposed-defects-diagnosis.md`, unchanged by the mutation cycle.

## NC-observer-too-short

Unique modification point: in `OwnedTestContexts.cleanup`, `observer.detach()` is moved to immediately after `fixture.ctx.fiber.dispose()` is invoked (before any `await`), so observation stops before the asynchronous disposal runs; the captured-error veto judgment stays intact.

- Mutated helper: 8896 bytes, SHA-256 `77f22c9d5e22724289c3d16f4c67bac32254284869f33bf0f394df211afc8c2e`, git blob `467f664bab6d9e548014d4d709d2dffe03e50569`. Mutated copy: repo-external `C:/dsh-r43-work/raw/nc-observer-too-short.mutated-owned-contexts.ts`.
- Mutated run (`06-nc-observer-too-short.normalized.log`): exit 1, **4 failed / 36 passed (40)**. The same four regressions fail with the same first assertion — the child-fiber and deferred-release regressions demonstrably reject the under-reporting (their logged errors arrive only after the real asynchronous disposal begins, which the mutation no longer observes). No syntax, import, timeout, or zero-test failure.
- Restore (driver finally): byte-identical `true`; restored 9013 bytes, SHA-256 `a2fb51df267c5d350a7d4cb7265f5e02f2af4e3bc7ddf4536d241c850b53f36a`, git blob `7713e57d18adab01b5ed4ceb59c08ebb66e3bfd5`.
- Post-restore positive (`07-nc-observer-restore-positive.normalized.log`): exit 1, **2 failed / 38 passed (40)** — identical shape to the NC-ignore restore positive.

## Sequencing note (honest disclosure)

Both negative controls were first executed against the pre-lint-fix spec bytes (spec git blob `64c7689fbaa426867fdc90d5f3ff4e693fe744e0`) and re-executed after the lint fixes (final spec git blob `56a60a2f9c8cc753522ae53ae4bdb9d5dc886291`); the helper mutations and their bytes are identical in both passes and the outcomes were identical (4 failed / 36 passed mutated; 2 failed / 38 passed restored). The logs checked in here are the definitive final-bytes runs (vitest `Start at` 23:35:06, 23:35:15, 23:35:50, 23:35:58 — all after the lint-fix bytes were final). The first-pass raw logs were overwritten by these same-name final runs and are no longer recoverable; only the final-pass raws exist repo-external. That gap is recorded here rather than papered over. No log copy is presented as two runs; every row above is one physical child process.
