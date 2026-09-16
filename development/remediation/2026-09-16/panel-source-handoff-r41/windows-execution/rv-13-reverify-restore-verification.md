# r41 re-verification: mutation identities and byte-verified restoration

Every mutation below touched ONLY packages/test-support/client-runtime/tests/helpers.client.spec.tsx.
No checkout/reset/stash was used; the frozen candidate was saved first to
C:\dsh-r41-reverify-raw-logs\candidate-rv.tsx (read-back verified byte-identical at
save time) and each restoration copied those bytes back through Node native fs,
then re-verified length, SHA-256, git blob, and byte equality before the
post-restore positive run.

## Frozen candidate identity (saved before any mutation)

- Bytes: 9678
- SHA-256: 1665c6368ee6f8b22d6a62753e9386e81d33c26e089ec89df7690800eb50502a
- Git blob: 4de2fd6eb2440ae9c6a310fecacff0caee1db322
- Saved-copy readback: byteIdenticalToSaved=true

## Baseline placement (rv-01)

- Original blob 389c1a0d90f23f0b41c530b387d489067d40c246 materialized via
  git cat-file into the working spec: 8094 bytes,
  SHA-256 43c473551b8435e380ce14d6604b06b88c409ff667062d873490ff10e0c47eef,
  git blob matched 389c1a0d... exactly before the run.
- Restoration after the baseline run (rv-01-restore-after-baseline.json):
  restoredBytes=9678, match=true, gitBlobAfterRestore=4de2fd6e..., byteIdenticalToSaved=true.

## NC-gap mutation (rv-04)

- Mutation: replaced the candidate's comment + synchronous-apply mount block with
  release -> await runtime.flush() -> mount (apply provides the replacement
  without releasing). Exactly 1 replacement site.
- Mutated identity: 9469 bytes,
  SHA-256 8861b6d530f85ab3d5bfefaf93c1d8c9d3199d70586980f5c2d43ec037066662,
  git blob 5e368e6d98b3dab6cca7f65167d7feed2538775a.
- Run: focused -t "drives panel hooks" exit 1, 1 failed / 9 skipped; real
  TypeError: usePanelInfo is not a function (mutated 88:26) through the real
  SlotErrorBoundary/onEntryError chain, then AssertionError: expected '' to be
  'next:conversation' (mutated 107:42).
- Restoration (rv-05-ncgap-restore.json): restoredBytes=9678,
  restoredSha256=1665c6368ee6f8b22d6a62753e9386e81d33c26e089ec89df7690800eb50502a,
  match=true, gitBlobAfterRestore=4de2fd6eb2440ae9c6a310fecacff0caee1db322,
  gitBlobMatchesCandidate=true, byteIdenticalToSaved=true.
- Post-restore full run: exit 0, 10 passed / 10 (rv-05).

## NC-duplicate mutation (rv-06)

- Mutation: removed ONLY the runtime.releasePanelInfoSource() line inside the
  synchronous apply (provideRoot kept). Exactly 1 replacement site.
- Mutated identity: 9635 bytes,
  SHA-256 a6c56886a4aa4a2c28d30b4a5b4f0f0f257256525e9fdbdf0e1ba40f763c535a,
  git blob 49d400e7302f017d41d4bf689821d809d99495c5.
- Run: focused exit 1, 1 failed / 9 skipped; the real production rejection
  duplicate root standard hook 'panelInfo' at prop 'usePanelInfo' thrown from
  copyUnique (registry.ts:595) through rebuildRootBinding (500) -> provideRoot
  (276) -> mutated apply (spec 105) -> SlotTestRuntime.mount (index.ts:295);
  reported once more as an unhandled rejection via the parallel rejection path.
- Restoration (rv-07-ncduplicate-restore.json): restoredBytes=9678, match=true,
  gitBlobAfterRestore=4de2fd6e..., byteIdenticalToSaved=true.
- Post-restore full run: exit 0, 10 passed / 10 (rv-07).

## Working-tree condition at end

git status --porcelain showed only: M packages/test-support/client-runtime/tests/helpers.client.spec.tsx
plus the untracked r41 Agent Note triplet and this evidence directory. The spec's
final identity after the last restore equals the frozen candidate:
9678 bytes / SHA-256 1665c636...50502a / git blob 4de2fd6e... (re-checked after
the final confirmation run; see rv-12 and FINDINGS).

Raw bytes of every rv- run live outside the repository at
C:\dsh-r41-reverify-raw-logs\ with the mutation/restore JSON outputs listed above;
normalize-manifest-rv.json there records raw and normalized SHA-256 for each log.
