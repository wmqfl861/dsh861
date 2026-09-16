# r42 negative-control mutation and restore verification (2026-09-16, Windows)

All mutations touched only the test helper `packages/subagent/tool-subagent-control/tests/owned-contexts.ts`. No production source, vendor, lockfile, workflow, or configuration byte changed. Candidate bytes were fixed before the sequence; the driver refused to mutate unless the working file's SHA-256 equaled the backup's.

## Fixed candidate (final bytes, after lint conformance)

```
git blob                          sha256                                                            bytes
da23db7d7ba9351c0b6006b2e3a4b1c120f5cc6c  4bf4bd8d6e9e310b848f9dbffb0528515d299c29681710f05aab032f3c99db85  5280   owned-contexts.ts (helper)
3db9a7732afa2f97c8da51ffcc42e02694154762  3934c18adcbb8ddfa6bf18491af62b1461c9456f81c1f96ad8bc96444152e518  7175   owned-contexts.spec.ts (regression)
9d1d92fef1a58cc7e72e4f05ab14e37560768252  6df86407356f419c38168bd616daa3a5994c87812190fe0cb12e3d2696a53200  25583  tool-subagent-control.spec.ts
6f688a15daa7cb237de80c2cae8b1e00e5e2ccde  380c3d98456f548617c0d6a0cc929650e182d09758b3f87a382707fb95053e32  23937  tool-team.spec.ts
```

## Mutation 1 — first failure / NC-no-dispose (identical single-line mutation, run twice as separate evidence items)

Anchor replaced in `OwnedTestContexts.cleanup`:

```diff
-        await fixture.ctx.fiber.dispose()
+        // mutation: Context disposal skipped
```

This reproduces the old cleanup semantics (no Context destruction at all).

- Mutated helper SHA-256: `7ce203ef201af4c336da3f317f0e8b391d8f3e8fb91d2b6e53a2e6eb4d0f10eb`
- Run A (pre-fix first failure, `02-first-failure-old-cleanup.normalized.log`): exit 1, 7 failed / 28 passed.
- Run B (post-fix NC-no-dispose, `04-nc-no-dispose-negative-control.normalized.log`): exit 1, 7 failed / 28 passed.
- Restore after each run: backup copied back; expected `4bf4bd8d...` == actual `4bf4bd8d...` == independent read-back `4bf4bd8d...` (driver output `match=true`, recorded in `%LOCALAPPDATA%\Temp\r42-raw-logs\first-failure.driver.log` and `nc-no-dispose.driver.log`).
- Deterministic failure assertions (before any directory removal): `SessionAlreadyOwnedError: session "owned-lead"/"tool-team-lead"/<child uuid> is already owned by an active write handle` raised from `SessionWriteLease.acquire` through the probe's `open(id, 'write')` inside `fixture.afterDispose`, and `AssertionError: expected 'cleanup-settled' to be 'disposer-reached'` (owned-contexts.spec.ts happens-before race) plus `expected true to be false` services-not-gone assertions.

## Mutation 2 — NC-no-await

Anchor replaced in `OwnedTestContexts.cleanup`:

```diff
-        await fixture.ctx.fiber.dispose()
+        void fixture.ctx.fiber.dispose()
```

- Mutated helper SHA-256: `11ffa7b1acab52cb33dba986dc9248e827ed52372f5cbdd0d5f22c4f7ed83107`
- Run (`05-nc-no-await-negative-control.normalized.log`): exit 1, 2 failed / 33 passed.
- Restore: expected == actual == read-back `4bf4bd8d...` (`match=true`, `nc-no-await.driver.log`).
- Deterministic failure assertions:
  - `packages/subagent/tool-subagent-control/tests/owned-contexts.spec.ts:103` — `expect(cleanupSettled).toBe(false)` failed (`true`): cleanup announced completion while the deferred disposer provably still held disposal open (the `disposer-reached`/`cleanup-settled` race had already been won by `disposer-reached`, so the disposer was demonstrably mid-flight).
  - `packages/subagent/tool-subagent-control/tests/tool-subagent-control.spec.ts:387` — `await expect(owned.cleanup()).resolves.toBeUndefined()` rejected with `SessionAlreadyOwnedError` originating at `SessionWriteLease.acquire` (`lease.ts:82`) via `Proxy.open` (`session-persistence-jsonl/src/index.ts:370`) via `fixture.afterDispose`: the disposal had been started but not awaited, so the held-gate child's write lock was still owned at observation time.

## Post-restore positives

- `03-candidate-full-pass.normalized.log` (mid-sequence positive) and `06-post-nc-restore-positive.normalized.log` (post-NC restore positive): both exit 0, 35/35 passed (3 files). The two raw logs are byte-identical because the final positive run's output was copied to the post-restore name after the run; both driver invocations reported exit 0 (recorded in the sequence's console transcript and `%LOCALAPPDATA%\Temp\r42-raw-logs\post-nc-restore-positive.driver.log`). Working-tree helper SHA-256 after the last run re-verified `4bf4bd8d...`.

## Negative-control residue sweep

The mutated cleanups deliberately keep (no-dispose) or early-delete (no-await) fixture roots, so the runs leak temp directories. After all vitest processes had exited (no open handles remain), the driver operator swept them externally: 62 directories after the first (superseded) sequence, 40 after the final sequence, 0 after the confirmation runs (`dsh-tool-subagent-control-*`, `dsh-tool-team-*`, `dsh-owned-contexts-*` under the OS temp root; count 0 remaining each time).
