# r42 FINDINGS — owned test contexts, subagent-control and tool-team suites (2026-09-16, Windows execution)

Round: r42. Branch `chore/latest-stable-upgrade-20260912`, start and end local/remote HEAD `0bb1eff579a9e823d68fc8870896e9f143996a12` (no commit, no push in this round; stage gate reached). Task source: PR #13 comments 5696351145 (A-G) and 5696337750, read via credential-less api.github.com REST (HTTP 200). Historical r39/r40 Linux artifacts were NOT downloaded this round (not required); historical facts cited below come from those PR comments, marked as history.

## What this round is and is not

This is the Windows-local execution and evidence for making the two suites own and dispose their fixture Contexts. It is NOT a Linux/POSIX flock validation, NOT a claim about the new CI run 35086662535 (still without a final coverage conclusion when last read), NOT a fix for every historical FileHandle (r39/r40 diagnostics attributed control/team-class FileHandle errors on Linux CI; this round removes one verified ownership gap in these two suites), and NOT Python/coverage/intermittent-issue work. Windows evidence cannot substitute POSIX acceptance: on POSIX the lease is a `flock` FileHandle on `session.lock` and DEP0137 GC collection applies to it; on Windows it is a named kernel semaphore (`Local\dsh-session-lock-<sha256>`), which never blocks directory removal and requires no `session.lock` file. The resource regressions therefore observe real write ownership (`open(id,'write')` contention), not file presence.

## Baseline (honest non-failure)

`pnpm exec vitest run --project thread-safe <control spec> <team spec>` on the unchanged blobs (`c1cb00e1...`, `6ae2fddc...`): exit 0, 2 files, 28/28 passed (`01-baseline-unchanged-two-files.normalized.log`). A small suite does not force GC collection, so no GC/FileHandle error appeared; no failure was fabricated. The deterministic signal comes from the new resource regressions instead.

## Change summary (test-only)

1. NEW `packages/subagent/tool-subagent-control/tests/owned-contexts.ts` — `OwnedTestContexts` ledger + `OwnedContextFixture` (ctx, root, afterDispose) + `mountWriteOwnershipProbe` (independent backend over the same root). Cleanup per fixture: `await ctx.fiber.dispose()` → `await afterDispose?()` → `rmSync(root)`; per-fixture failure isolation; collected failures rethrown (AggregateError when >1); second call is a no-op.
2. MODIFIED `tool-subagent-control.spec.ts` — `setupWith` registers the Context at creation and the mkdtemp root immediately; returns `{ ctx, parent, adapter, root, fixture }`; afterEach awaits `owned.cleanup()`; the HMR test's bare second Context is owned; `GatedAdapter`'s gate ends on request-signal abort (listener removed when the gate wins) so a pre-release failure still tears down; new teardown positive-control test (held gate + child write-ownership probe).
3. MODIFIED `tool-team.spec.ts` — same ownership wiring in `setup`; new two-setup teardown positive-control test (settled lead turn + hanging teammate, probes on both roots).
4. NEW `owned-contexts.spec.ts` — 5 direct regressions of the helper contract: materialized-lock release before root deletion; held-disposer happens-before; setup-mid-failure cleanup; veto isolation across two fixtures; rootless context + repeated cleanup.

Production surfaces re-verified untouched: AgentLoop destruction (`packages/core/agent-loop/src/index.ts`), JSONL lease (`.../session-persistence-jsonl/src/lease.ts`), persistence and Windows lock implementations, public `MockAdapter`, shared read-handle helper (`subagent/tests/persistence-helpers.ts`), r41 panel spec. No manifest, lockfile, vendor, workflow, or config byte changed.

## Resource verification details (all on the real implementation)

- Real resources non-zero: a real business turn (followup → whenIdle → flush) materializes the lead session (`stat().sizeBytes > 0`); while the fixture runtime is live, an independent backend's `open(id,'write')` is rejected with `SessionAlreadyOwnedError` — the kernel write lock is genuinely held (Win32 named semaphore). Observed for `owned-lead`, `tool-team-lead`, and spawned/held child session ids.
- Close completes before deletion: the probe takeover runs in `afterDispose`, positioned between `fiber.dispose()` settlement and `rmSync`. The takeover opens the SAME original directory (no delete/recreate anywhere). Under the fixed candidate, every takeover succeeds; failures veto the deletion and keep the directory.
- Async completion, not invocation: the deferred-disposer regression proves cleanup cannot settle (`cleanup-settled` loses the race to `disposer-reached`, then `cleanupSettled` stays `false` and the root exists) while a real effect disposer is held; releasing the gate completes the real disposal, then the root is deleted and the services are gone (`ctx.get('sessionPersistence')` undefined).
- Gate early-failure path: control's teardown test leaves the child's model call held at the manual gate, then runs the suite's real cleanup without the release; the abortable gate ends the call and the probe takeover proves the child's write ownership was released before the root went.
- Same-code wiring: the main suites' afterEach and the regressions all call the same `OwnedTestContexts.cleanup`; the HMR-context and two-setup cases register through the same `own`/`ownRoot`.
- Platform note: on Windows a live lease does NOT block `rmSync`, which is exactly why the probe veto (before rm) is the mandated discriminator; `root deleted` alone is not treated as release evidence.

## Run matrix (actual command includes the new regression spec; three files)

| Stage | Log | Exit | Result |
|---|---|---|---|
| Baseline (unchanged 2 files) | 01 | 0 | 28/28 passed |
| First failure (old cleanup semantics: disposal skipped) | 02 | 1 | 7 failed / 28 passed |
| Candidate full pass | 03 | 0 | 35/35 passed |
| NC-no-dispose | 04 | 1 | 7 failed / 28 passed |
| NC-no-await | 05 | 1 | 2 failed / 33 passed |
| Post-restore positive | 06 | 0 | 35/35 passed |

Matrix notes (post-review corrections): the rows are a logical sequence, not a timestamped one — the 03 and 06 logs are two copies of the SAME physical run (the final-sequence post-NC-restore positive run; the driver's shared `positive.vitest.raw.log` was copied to the post-restore name after that run, as `13-mutation-restore-verification.md` discloses), so the two rows carry identical bytes and hashes. The baseline row's exit 0 is implied by 28/28 passed with no failing/skipped test; that run predates the driver wrapper, so no separate driver log with an explicit exit header exists for it and none was fabricated. The final confirmation run (21:43) and its distinct log are recorded as entry 15.

NC failure locations (exact): NC-no-await — `owned-contexts.spec.ts:103` (`expected true to be false`, cleanup announced completion early) and `tool-subagent-control.spec.ts:387` (cleanup rejected with `SessionAlreadyOwnedError` from `SessionWriteLease.acquire` at `lease.ts:82` via `Proxy.open` at `session-persistence-jsonl/src/index.ts:370` via `fixture.afterDispose`). NC-no-dispose — seven tests fail on probe vetoes (`SessionAlreadyOwnedError ... already owned by an active write handle`), the happens-before race (`expected 'cleanup-settled' to be 'disposer-reached'`), and services-still-present assertions; all observed before any removal. Mutations, byte backups, restore verification, and residue sweeps: `13-mutation-restore-verification.md`.

## Gates

- `pnpm run typecheck` exit 0 (final bytes).
- `pnpm run lint` exit 0 after fixing three oxlint errors in the new test code (`Promise.withResolvers<void>` → `<undefined>` per suite convention; wrap a possible non-Error rejection). An earlier lint exit 1 log exists in temp only; the checked-in `08-gate-lint.normalized.log` is the passing final run.
- `pnpm run duplication` (jscpd via `node_modules/.bin` direct, broken-global-shim workaround) exit 0, 0 clones.
- `pnpm run verify-translation-pairing --write <note>.md` exit 0 (bilingual Note paired; `.i18n.yaml` recorded).
- `pnpm run doc-sync` attempt 1 exit 1 solely because the Note linked this FINDINGS.md before it existed; after writing the evidence tree the gate re-ran — result recorded in `14-gate-docsync-final.normalized.log`.
- No commit/push hooks ran (nothing committed in this round).

## Bilingual Agent Note

`.agents/notes/implemented/testing/2026-09-16-owned-test-contexts-r42.md` + `.zh.md` + `.i18n.yaml` (git blobs `5c9e1f40...` / `86e2bd36...` at pairing time). Carry-forward caveat recorded there: cordis logs (not rethrows) disposer failures, so a handle-close failure inside `fiber.dispose()` surfaces via the logger and — where a probe observes the same fixture — as a cleanup veto; suites without observers can still delete a directory whose handle close failed loudly. No production teardown defect, deadlock, or stuck lock was exposed by the corrected cleanup in any run of this round.

## NOT_RUN / boundaries

- No Linux/POSIX execution; flock semantics and Node 26 GC history remain CI's to validate (historical r39/r40 Linux runs 35057856906 / 35066915772 are the prior evidence; new CI run 35086662535 still lacked a final coverage conclusion when last read — no new artifact IDs invented).
- No full coverage, Web/Gateway212/Loader122/exe-wheel, six old Windows goldens, real-model API, E2B, or CI manipulation.
- No `gh` install; no keys, global credentials, or user .env read; no external agent invoked.
- Round-local passing does not imply the new CI, all historical FileHandle causes, or the upgrade stages pass.
- Next stage per the round gate: fresh-context independent review of this candidate; only after review PASS does the delivering session commit with normal hooks, fast-forward-push the unchanged remote chain (non-force), and report — none of which happened in this round.
