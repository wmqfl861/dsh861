# r41 re-verification after re-dispatch (2026-09-16, Windows)

## Scene finding

The r41 re-dispatch instruction stated the previous dispatch "terminated at startup
due to usage limits and did no work". The workspace told a different story: on
arrival the branch was already at the expected start HEAD with the target spec
already modified to the candidate and a complete r41 evidence set (00-13, FINDINGS,
bilingual Agent Note triplet) already present as untracked files. Remote
chore/latest-stable-upgrade-20260912 was still 0f4b487c2b48f6502507c3173acedfc491a74674
(local HEAD unchanged, no remote movement, PR base feat/multi-agent-company-nodes
unchanged at 5434305c5dcf7ddc3ebf939226647b7b608335e6).

Per the task rules the scene was preserved: no reset, rebase, amend, stash, clean,
force-push, or overwrite of any prior file. The existing candidate was treated as
an unverified frozen candidate and the ENTIRE verification pipeline (baseline
first failure, candidate positives, both negative controls with byte-verified
restoration, static gates, final confirmation) was independently re-executed.
All runs below are this re-verification; logs are rv-* files, independently named,
no prior 01-13 log overwritten. Raw bytes: C:\dsh-r41-reverify-raw-logs\ (ASCII
path, Node native fs, read-back verified); raw/normalized SHA-256 in
normalize-manifest-rv.json there.

## Re-verified identities

- Start spec blob (HEAD): 389c1a0d90f23f0b41c530b387d489067d40c246 (matches task B).
- Frozen candidate in the working tree: 9678 bytes,
  SHA-256 1665c6368ee6f8b22d6a62753e9386e81d33c26e089ec89df7690800eb50502a,
  git blob 4de2fd6eb2440ae9c6a310fecacff0caee1db322 (identical to the identity the
  prior attempt recorded for its frozen candidate).
- Fixed runtime/renderer blobs re-verified unchanged via git hash-object:
  8472514901da323fe3812fa9ef50be6de037b461 (client-runtime/src/index.ts),
  728cbdcb21d128ca3fa05d8067bdd4f6a4f3fe60 (registry.ts),
  fde55a366cd5e7826214e16f132cd1d2d95ba1ff (bindings.tsx),
  3a5ecb8373ac4f856102e9c1cd37bb430cdaf295 (scoped-slots.tsx).
- Toolchain: Node v26.8.2 + pnpm 12.4.1 from C:\dsh-r24-upgrade-20260912-01
  (node dir + sibling pnpm-12.4.1 dir on PATH; the system pnpm shim is broken and
  was never used).

## Runs (all with the pinned toolchain PATH, repo root)

| # | Command | Exit | Result |
| --- | --- | ---: | --- |
| rv-01 | pnpm exec vitest run --project thread-safe packages/test-support/client-runtime/tests/helpers.client.spec.tsx (original blob 389c1a0d placed temporarily) | 1 | 1 failed / 9 passed (10). Real first failure reproduced: TypeError: usePanelInfo is not a function at spec 84:26, SlotErrorBoundary catch, entry abdicated; AssertionError: expected '' to be 'next:conversation' at 100:42. Matches CI run 35066915772. |
| rv-02 | same command, frozen candidate | 0 | 10 passed / 10. No TypeError, no data-slot-error anywhere in the log. |
| rv-03 | same + -t "drives panel hooks" | 0 | 1 passed / 9 skipped (10) — filter matched exactly the target test. |
| rv-04 | NC-gap mutation (old release -> await runtime.flush() -> mount; no release inside apply), focused | 1 | 1 failed / 9 skipped (10). Target failure: real TypeError: usePanelInfo is not a function at mutated 88:26 through the real SlotErrorBoundary/onEntryError chain (slot entry crashed in 'trt.panel-info'), then AssertionError: expected '' to be 'next:conversation' at mutated 107:42. Not a syntax/import/timeout/zero-test failure. |
| rv-05 | full file after NC-gap restore | 0 | 10 passed / 10. Restore pre-verified byte-identical (see rv-13). |
| rv-06 | NC-duplicate mutation (apply omits only the old-source release), focused | 1 | 1 failed / 9 skipped (10). Real production rejection: Error: duplicate root standard hook 'panelInfo' at prop 'usePanelInfo' from copyUnique registry.ts:595 -> rebuildRootBinding registry.ts:500 -> provideRoot registry.ts:276 -> mutated spec apply 105 -> SlotTestRuntime.mount index.ts:295. Same error once more as unhandled rejection (parallel rejection path). No environment fault. |
| rv-07 | full file after NC-duplicate restore | 0 | 10 passed / 10. Restore pre-verified byte-identical (see rv-13). |
| rv-08 | pnpm run typecheck | 0 | pass |
| rv-09 | pnpm run lint | 0 | 0 warnings, 0 errors (3595 files) |
| rv-10 | ./node_modules/.bin/jscpd --config .jscpd.json packages scripts (direct bin; .cmd shim broken) | 0 | 0 clones |
| rv-11 | pnpm run doc-sync (after rv evidence and FINDINGS update in place) | 0 | pass (34 passed, 0 failed; see normalized log) |
| rv-12 | final confirmation, full file, frozen candidate untouched since rv-07 restore | 0 | 10 passed / 10 |
| rv-14 | pnpm run doc-sync again on the final content (00-start-state append included) | 0 | pass (34 passed, 0 failed) |

## Behavior assertions re-confirmed by rv-02/rv-03 (single test exercises all)

- Original chain preserved: first:conversation -> first:custom -> next:custom ->
  next:conversation (spec lines 91/93/95/109).
- No entry crash: public runtime.slots.onEntryError observer records this slot's
  errors; asserted empty after the handoff and again after dispose; no
  [data-slot-error] element; observer records only (no console suppression, no
  error-handler replacement), unsubscribed in finally.
- No remount: the span captured before the handoff is asserted toBe the same
  instance and isConnected after it; key 'probe' and owner-label update behavior
  retained.
- Old vs new source distinguishable: replacement set to custom drives the UI
  (next:custom); updating the released old runtime.panelInfo to legacy does not
  move it; replacement back to null yields next:conversation; owner label update
  composes (final:conversation).
- Repeat release does not retract: a second runtime.releasePanelInfoSource()
  leaves the UI intact and the replacement still drives it (final:custom); the
  pre-existing duplicate-provide rejection and double-release tests untouched.
- Cleanup: runtime.dispose only (unmount views first, then fibers/sources);
  observer unsubscribed and runtime disposed in finally.

## NOT_RUN in this re-verification

- No commit, no push, no CI interaction (stage gate; independent fresh-context
  review of the frozen candidate comes first).
- No full coverage, Web, Gateway212, Loader122, exe-wheel, or six old Windows
  golden rehearsals; no Actions artifact download (remote forensics already
  verified both ZIPs; not required this round).
- Linux Python wide-completion, FileHandle exceptions, coverage thresholds, and
  historical intermittent issues remain out of scope, unchanged.
- The prior attempt's 01-13 logs were not re-derived; they are preserved as-is
  alongside this rv- set. Cross-checked: the baseline pair (01/rv-01) differs
  only in per-test millisecond durations; the negative-control pairs also
  differ in the mutated files' failing line numbers (04 assertion 109:42 vs
  rv-04 107:42; 06 apply frame 106:21 vs rv-06 105:21) because the two
  generations' mutation texts differ slightly in shape; each generation's
  records state their own line numbers.
