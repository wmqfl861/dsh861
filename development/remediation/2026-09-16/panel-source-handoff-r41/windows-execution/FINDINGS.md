# r41 FINDINGS — panel source handoff test fix (2026-09-16, Windows execution)

Scope: packages/test-support/client-runtime/tests/helpers.client.spec.tsx only (test-side timing fix; no runtime/renderer change). Start HEAD = end HEAD = 0f4b487c2b48f6502507c3173acedfc491a74674; no commit, no push in this round (stage gate: independent fresh-context review first).

## Baseline first failure (unmodified file, 01-baseline-first-failure.normalized.log)

Command: `pnpm exec vitest run --project thread-safe packages/test-support/client-runtime/tests/helpers.client.spec.tsx` — exit 1, 1 failed / 9 passed (10). Real first failure, matching CI run 35066915772 (Windows 9 passed / 1 failed):

- Component crash `TypeError: usePanelInfo is not a function` at spec line 84:26, caught by SlotErrorBoundary (`slot entry crashed in 'trt.panel-info'`), entry abdicated, outlet rendered the crash face.
- Assertion failure: `expected '' to be 'next:conversation'` at spec line 100:42.

Diagnosis confirmed locally: the old test released the default panelInfo source, then awaited `runtime.mount`; the release synchronously rebuilds the root binding and notifies root subscribers, and the async stabilization before the replacement plugin's apply let React flush a source-less root binding, so the mounted entry rendered without `usePanelInfo` and crashed.

## Candidate (verified positive)

Move the default-source release and the replacement `provideRoot` into ONE synchronous plugin apply callback through the existing `runtime.mount` (no await/flush/extra tick between the two operations; stabilization rides mount's own act wrapper). Preserved assertion chain: `first:conversation -> first:custom -> next:custom -> next:conversation`. Added behavior verification in the same test:

1. No entry crash: a public `runtime.slots.onEntryError` observer records this test's slot errors (records only; no console suppression, no error-handler replacement); asserted empty after the handoff and again after dispose; no `[data-slot-error]` element rendered.
2. No view rebuild: the rendered span is captured before the handoff and asserted identical (`toBe`) plus `isConnected` after it — same rendering instance and DOM identity, no unmount/remount, no entry re-registration, no key change, no extra render after an error.
3. Old vs new source are distinguishable: replacement `custom` drives the UI (`next:custom`); updating the released old `runtime.panelInfo` to `legacy` does not move it; replacement back to null yields `next:conversation`; owner label update still composes (`final:conversation`).
4. Repeat release does not retract the replacement: a second `runtime.releasePanelInfoSource()` leaves the UI intact and the replacement still drives it (`final:custom`). The pre-existing duplicate-provide rejection and double-release tests are untouched and still pass.
5. Cleanup order: `runtime.dispose` only (unmount views first, then fibers/sources); the observer is unsubscribed and the runtime disposed in `finally` regardless of assertion outcomes.

Runs: full file exit 0, 10 passed / 10 (02); focused `-t "drives panel hooks"` exit 0, 1 passed / 9 skipped (03) — filter valid (not zero tests). No `TypeError` or `data-slot-error` anywhere in the positive logs. After all evidence and gates, a final confirmation run of the unmodified-since-restore candidate passed 10/10 again (13-final-candidate-confirmation.normalized.log), and the spec's identity was re-verified (bytes/SHA-256/git blob below unchanged).

Candidate identity: 9678 bytes, SHA-256 1665c6368ee6f8b22d6a62753e9386e81d33c26e089ec89df7690800eb50502a, git blob 4de2fd6eb2440ae9c6a310fecacff0caee1db322 (start blob 389c1a0d90f23f0b41c530b387d489067d40c246).

## Negative controls (both valid, both restored byte-identically; details in 08)

- NC-gap (04): old release -> explicit `await runtime.flush()` -> mount order restored. Exit 1, 1 failed / 9 skipped. Target failure observed: real `TypeError: usePanelInfo is not a function` at 88:26 through the real entry-error chain, and `expected '' to be 'next:conversation'` at 109:42 (empty output). Not a syntax/import/timeout/zero-test failure.
- NC-duplicate (06): synchronous apply without the old release. Exit 1, 1 failed / 9 skipped. Failure is the real production rejection `duplicate root standard hook 'panelInfo' at prop 'usePanelInfo'` from registry.ts copyUnique:595 through provideRoot -> apply -> mount.
- Restoration (05, 07): saved candidate bytes copied back via Node fs; length 9678, SHA-256 match=true, git blob 4de2fd6e... re-verified after each control; full file 10/10 after each restoration.

## Gates

- typecheck (09): `pnpm run typecheck` — exit 0.
- lint (10): `pnpm run lint` — exit 0 (0 warnings, 0 errors).
- duplication (11): `./node_modules/.bin/jscpd --config .jscpd.json packages scripts` — exit 0, 0 clones (direct bin call; the jscpd .cmd shim stays broken, consistent with prior rounds).
- doc-sync (12): `pnpm run doc-sync` — exit 0 (34 passed, 0 failed) after the bilingual Agent Note triplet and this evidence directory were in place.
- final confirmation (13): full-file rerun of the frozen candidate — exit 0, 10 passed / 10.

Log normalization per r34-r40 precedent: raw bytes kept outside the repository at C:\dsh-r41-raw-logs\, normalized copies here (ANSI stripped, CRLF->LF, trailing whitespace removed, single trailing newline); raw and normalized SHA-256 for every file are recorded in 08 and the run manifest (C:\dsh-r41-raw-logs\normalize-manifest.json). Diagnostic content preserved verbatim.

## Re-verification after re-dispatch (rv- set, same day)

The re-dispatch instruction claimed the prior dispatch did no work, but the workspace already held the frozen candidate plus the 01-13 evidence above. The scene was preserved (no reset/clean/overwrite) and the entire pipeline was independently re-executed: baseline first failure reproduced on the original blob (exit 1, 1 failed / 9 passed, same TypeError at 84:26 and empty-output assertion at 100:42), candidate full 10/10 and focused 1 passed / 9 skipped, both negative controls reproduced their target failures (NC-gap: real usePanelInfo TypeError at 88:26 plus expected '' to be 'next:conversation' at 107:42; NC-duplicate: real duplicate root standard hook 'panelInfo' rejection through copyUnique registry.ts:595), each restoration byte-verified, and typecheck / lint (0 warnings, 0 errors) / duplication (0 clones) / doc-sync / final confirmation re-run green. The frozen candidate's identity (9678 bytes, SHA-256 1665c636..., git blob 4de2fd6e...) was byte-stable across all restorations. Full detail, run table, and NOT_RUN boundaries: [rv-00-reverification-scene.md](rv-00-reverification-scene.md) and [rv-13-reverify-restore-verification.md](rv-13-reverify-restore-verification.md); rv-01..rv-12 normalized logs sit alongside 01-13. Cross-check: the baseline pair (01/rv-01) differs only in per-test millisecond durations; the negative-control pairs additionally differ in the mutated files' failing line numbers (04 records the assertion at 109:42 where rv-04 records 107:42, and 06 shows the apply frame at 106:21 where rv-06 shows 105:21) because the two generations' mutation texts differ slightly in shape — each generation's run record states its own line numbers.

## NOT_RUN / out of scope this round

- No commit, no push, no CI interaction (stage gate — independent fresh-context review of the frozen candidate comes first).
- No full coverage run, no full Web/Gateway212/Loader122/exe-wheel/six old Windows golden rehearsals (not defaulted per round rules).
- Linux Python wide-completion failure, 3 FileHandle exceptions, the two-platform 62-file coverage shortfall, and historical intermittent observations remain unsolved and out of scope.
- No Actions artifacts downloaded (remote forensics already verified them; not required this round).
- Runtime implementation (test runtime, registry, bindings, scoped-slots) byte-identical to start; model config, P0-B state, locks, pkg patches, vendor, workflows, and r29-r40 evidence untouched.

Raw logs (external, not in repo): C:\dsh-r41-raw-logs\ — per-run files 01-baseline-raw.log, 02-candidate-full-raw.log, 03-candidate-focused-raw.log, 04-ncgap-raw.log, 05-post-ncgap-restore-raw.log, 06-ncduplicate-raw.log, 07-post-ncduplicate-restore-raw.log, 08-gate-typecheck-raw.log, 09-gate-lint-raw.log, 10-gate-duplication-raw.log, 11-gate-docsync-raw.log (first doc-sync pass, pre final FINDINGS edits), 13-gate-docsync-final-raw.log (final-content doc-sync, mirrored as normalized 12), 12-final-candidate-confirmation-raw.log (mirrored as normalized 13); plus candidate-original.tsx (saved candidate bytes) and normalize-manifest.json (raw/normalized hashes for 01-11).
