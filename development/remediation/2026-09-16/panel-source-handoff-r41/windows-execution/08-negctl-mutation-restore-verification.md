# r41 negative-control mutations and byte-verified restoration

Both negative controls temporarily modified ONLY packages/test-support/client-runtime/tests/helpers.client.spec.tsx. No checkout/reset/stash was used at any point; restoration copied the saved candidate bytes back through Node fs and re-verified length, SHA-256, and git blob before each post-restore positive run.

## Candidate identity saved before any mutation

- Saved copy (outside the repository): C:\dsh-r41-raw-logs\candidate-original.tsx
- Length: 9678 bytes
- SHA-256: 1665c6368ee6f8b22d6a62753e9386e81d33c26e089ec89df7690800eb50502a
- Git blob (git hash-object): 4de2fd6eb2440ae9c6a310fecacff0caee1db322

## NC-gap: restore the old release-then-await-mount order with an explicit flush

Mutation (only lines inside the 'drives panel hooks' test): the candidate's synchronous apply body

```ts
apply(ctx) {
  runtime.releasePanelInfoSource()
  ctx.slots.provideRoot({ hooks: { panelInfo: replacement } })
},
```

was replaced by the old gap order with a deterministic stimulus (release, explicit `await runtime.flush()`, then mount the replacement without releasing inside apply):

```ts
runtime.releasePanelInfoSource()
await runtime.flush()
await runtime.mount({
  inject: ['slots'],
  apply(ctx) { ctx.slots.provideRoot({ hooks: { panelInfo: replacement } }) },
})
```

Run: `pnpm exec vitest run --project thread-safe packages/test-support/client-runtime/tests/helpers.client.spec.tsx -t "drives panel hooks"` — exit 1, 1 failed / 9 skipped (10), filter matched exactly the target test (not zero tests, not a syntax/import/timeout failure).

Observed target failure (04-ncgap-negative-control.normalized.log):
- Component crash: `TypeError: usePanelInfo is not a function` at helpers.client.spec.tsx:88:26 (the mutated file's probe component), React error boundary SlotErrorBoundary, then `slot entry crashed in 'trt.panel-info'` through the real onEntryError/reportEntryError chain (console error preserved, not swallowed).
- Assertion failure: `AssertionError: expected '' to be 'next:conversation'` at helpers.client.spec.tsx:109:42 — the empty-output first failure, identical in shape to the unfixed baseline (01) and to the CI failure.

Restoration: Node fs copy of the saved candidate bytes back over the spec. Verified output (05-post-ncgap-restore evidence phase):

- restored bytes=9678
- restored sha256=1665c6368ee6f8b22d6a62753e9386e81d33c26e089ec89df7690800eb50502a
- expected sha256=1665c6368ee6f8b22d6a62753e9386e81d33c26e089ec89df7690800eb50502a (match)
- git hash-object after restore: 4de2fd6eb2440ae9c6a310fecacff0caee1db322 (equals the candidate blob)
- git status --porcelain: only ` M packages/test-support/client-runtime/tests/helpers.client.spec.tsx`

Post-restore positive run (05-post-ncgap-restore-positive.normalized.log): exit 0, 10 passed / 10.

## NC-duplicate: omit only the old source release in the synchronous apply

Mutation (only the same apply body): the `runtime.releasePanelInfoSource()` line was removed; `ctx.slots.provideRoot({ hooks: { panelInfo: replacement } })` stayed, so the default panelInfo contribution was still present and the real registry duplicate detection had to reject.

Run: same focused command — exit 1, 1 failed / 9 skipped (10). The failing error is the REAL duplicate root standard hook rejection, thrown from production code and propagating through the real mount path (06-ncduplicate-negative-control.normalized.log):

- `Error: duplicate root standard hook 'panelInfo' at prop 'usePanelInfo'`
- copyUnique packages/client/ui-renderer/src/client/registry.ts:595 -> rebuildRootBinding registry.ts:500 -> provideRoot effect registry.ts:279 -> plugin apply spec (line 106) -> Fiber -> SlotTestRuntime.mount packages/test-support/client-runtime/src/index.ts:295 -> test.
- Vitest additionally reported the same duplicate error once as an unhandled rejection (the runtime's parallel rejection path); no environment fault, no timeout, no zero-test run.

Restoration: same Node fs copy of the saved candidate bytes. Verified output (07-post-ncduplicate-restore evidence phase):

- restored bytes=9678
- restored sha256=1665c6368ee6f8b22d6a62753e9386e81d33c26e089ec89df7690800eb50502a
- match=true against the saved candidate hash
- git hash-object after restore: 4de2fd6eb2440ae9c6a310fecacff0caee1db322 (equals the candidate blob)
- git status --porcelain: only the spec file modified

Post-restore positive run (07-post-ncduplicate-restore-positive.normalized.log): exit 0, 10 passed / 10.

## Interpretation

- NC-gap proves the synchronous-apply pairing is load-bearing: with the release/mount gap restored (and made deterministic by an explicit flush), the real registry/renderer crash the mounted entry through the missing `usePanelInfo` and the retained assertions fail on the empty output — the fix is not passing by luck of scheduling.
- NC-duplicate proves the fix still relies on genuine ownership handoff: without releasing the default source first, the real `provideRoot` duplicate-contribution rejection fails the test; no double-provider or silent overwrite was introduced.
- Both mutations were restored byte-identically (length + SHA-256 + git blob) and the full file returned to 10/10 after each restoration.
