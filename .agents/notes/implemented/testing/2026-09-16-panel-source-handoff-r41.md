# Agent Note: Hand the panel-info root source over inside one synchronous plugin apply

Status: implemented

English | [中文](2026-09-16-panel-source-handoff-r41.zh.md)

## Problem

The client test runtime's panel-hook spec released the default `panelInfo` root source and then awaited `runtime.mount` for the replacement provider. `provideRoot` disposers rebuild the root standard-source binding and notify root subscribers synchronously, so the release scheduled a React re-render while the mounted probe entry was still live; the async stabilization inside `mount` flushed that render before the replacement plugin's `apply` ran. The binding the entry saw had no `panelInfo` hook, `materializeStandardBinding` produced no `usePanelInfo`, the probe component's call threw `TypeError: usePanelInfo is not a function`, the entry boundary caught it and abdicated the entry, and the spec failed on an empty outlet (`expected '' to be 'next:conversation'`; the only shared assertion failure on both platforms in CI run 35066915772). React's own `act` documentation does not promise that intermediate scheduled states stay unrendered across an async boundary.

## Decision

The spec now releases the default source and provides the replacement inside one synchronous plugin `apply` callback through the existing `runtime.mount`, with no `await`, flush, or extra tick between the two operations; `mount`'s own act wrapper provides the stabilization. The registry still publishes two bindings in sequence — this fixes the test's handoff timing, it does not add an atomic source-replacement API. The spec also verifies the handoff through real observations instead of trusting the recovered final text: a public `runtime.slots.onEntryError` observer records this slot's entry errors (records only — no console suppression, no error-handler replacement) and is asserted empty after the handoff and after disposal; no `[data-slot-error]` element is rendered; the span element captured before the handoff is asserted to be the same connected instance after it (no remount, re-registration, key change, or post-error re-render); the replacement drives the UI with one value while an update to the released old source does not move it; a repeated `releasePanelInfoSource` does not retract the replacement; and cleanup uses `runtime.dispose`'s existing order (unmount views, then dispose fibers and sources) with the observer unsubscribed in `finally`.

## Alternatives considered

**Making the registry defer notifications or batch the two operations atomically.** That would change shipped renderer semantics for all subscribers to fix one test's ordering; the gap belongs to the test's handoff choreography, not to the registry contract.

**Optional hook calls (`usePanelInfo?.`), try/catch in the probe, or a hardcoded fallback string.** Each hides the missing-source crash the spec exists to observe; the real entry error must stay observable for the negative controls to mean anything.

**Inferring a clean handoff from the recovered final text alone.** A remounted entry or a boundary reset by a key change also restores the final text; the identity and entry-error assertions are what prove the same rendering instance crossed the handoff without crashing.

## Consequences

The unfixed baseline failed exactly the one target test (1 failed / 9 passed, `usePanelInfo` TypeError at the probe then an empty outlet at the `next:conversation` assertion), matching CI. The fixed spec passes 10/10 and the focused filter still matches exactly the target test. Two independent negative controls confirmed the fix is load-bearing: restoring the old release-then-flush-then-mount order (with an explicit `await runtime.flush()` as the deterministic stimulus) reproduced the real `usePanelInfo` entry crash and the empty-output assertion failure; omitting only the old-source release inside the synchronous apply failed with the real production rejection `duplicate root standard hook 'panelInfo' at prop 'usePanelInfo'` from `copyUnique`. Both mutations were restored byte-identically (length, SHA-256, git blob re-verified) and the file returned to 10/10 after each. Runtime implementation (test runtime, registry, bindings, scoped-slots renderer), vendor, lockfile, workflows, and r29-r40 evidence keep their bytes; typecheck, lint, duplication, and doc-sync gates pass. Out of scope and unchanged: the Linux Python wide-completion failure, FileHandle exceptions, coverage thresholds, and historical intermittent issues. Evidence: [windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-16/panel-source-handoff-r41/windows-execution/FINDINGS.md).
