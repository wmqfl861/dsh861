# r40 negative-control source mutation and restore verification

Subject file: `packages/context/session-reference/src/index.ts`
Task-stated starting git blob: `2ac9980a90c89a77fbebd8a5b6e9a1eb274be49c`

All runs recorded here executed against the final fixed candidate bytes of the four spec files (after the typecheck narrowing guards and the lint-safe proxy trap annotation). Earlier development runs on intermediate bytes produced the same single targeted failures and the same restore verification; the recorded logs and line numbers below are the final-candidate runs.

## Pre-mutation state (2026-09-16, local execution)

- Working tree clean for the file before any mutation (`git status` clean; no concurrent modification).
- Original bytes saved outside the repository before the first mutation:
  `C:\Users\Joyce Gu\AppData\Local\Temp\r40-negctl-src-original.ts`
  (20760 bytes).
- Saved-original SHA-256:
  `84f274f3963cd6d8892fbd029b54cb59c587b4ed39ba16bdd4e02a03076c9d41`
- Git blob of the file before and after every restore:
  `2ac9980a90c89a77fbebd8a5b6e9a1eb274be49c` (matches the task-stated blob).

## Mutation A — assemble listener root-owned

- Exact change: the single occurrence of
  `ctx.on('system-prompt/assemble'` became
  `ctx.root.on('system-prompt/assemble'`
  (uniqueness verified programmatically before replacing; no other logic touched).
- Mutated state (recomputed in memory from the saved original):
  20765 bytes, SHA-256
  `0cecfaaec3b85b6b50d4044f207785f82d114aacf68dd88b33a62a37fd1627d7`.
- Focused run of the fixed spec
  (`pnpm exec vitest run --project thread-safe packages/context/session-reference/tests/session-reference.spec.ts`):
  exit 1, 1 failed / 46 passed (47). The only failure is the fixed test
  `model-relative reference budgets > removes both listeners when the resolver fiber is disposed`,
  at the post-dispose assemble observation `expect(routeReads).toBe(0)`
  (session-reference.spec.ts:656) — received 2 because the destroyed resolver's
  assemble callback still read the route variables through the leaked
  root-owned registration.
- Restore: original bytes written back; `Buffer.compare` byte-identical to the
  saved original; 20760 bytes; SHA-256
  `84f274f3963cd6d8892fbd029b54cb59c587b4ed39ba16bdd4e02a03076c9d41` (match);
  git hash-object `2ac9980a90c89a77fbebd8a5b6e9a1eb274be49c`; `git diff` for the
  file empty.

## Mutation B — pre-step listener root-owned

- Exact change: the single occurrence of
  `ctx.on('agent/pre-step'` became
  `ctx.root.on('agent/pre-step'`
  (uniqueness verified programmatically; no other logic touched).
- Mutated state (recomputed in memory from the saved original):
  20765 bytes, SHA-256
  `e3ac4d9eabf3e0d7d33aeb53ff805a55de7f0cfd2372c87cc89b92c34ae6a921`.
- Same focused run: exit 1, 1 failed / 46 passed (47). The only failure is the
  same fixed test, this time at the post-dispose pre-step dispatch
  (session-reference.spec.ts:659): the waterfall rejected with
  `SessionReferenceError ... SESSION_REFERENCE_READ_FAILED`, cause
  `cannot get required service "sessionQuery" in inactive context`, stack
  `SessionReferenceResolver.ctx.root.on.prepend -> prepareDirectMessages ->
  prepare` — the leaked root-owned pre-step listener executed the destroyed
  resolver instead of passing the seed decision through.
- Restore: original bytes written back; byte-identical to the saved original;
  20760 bytes; SHA-256
  `84f274f3963cd6d8892fbd029b54cb59c587b4ed39ba16bdd4e02a03076c9d41` (match);
  git blob `2ac9980a90c89a77fbebd8a5b6e9a1eb274be49c`; `git diff` empty.

## Post-restore state

- Final `git status --porcelain` for the file: absent (not modified).
- Post-restore positive run over all four r40 files on the final candidate:
  exit 0, 135 passed / 0 failed — see
  `06-post-restore-positive-4files.normalized.log`.
- No root-owned listener registration remains in the shipped source; no leaked
  listener, spy, or probe persists (each negative-control run used its own
  process; the committed test disposes its probe, spy, and reinstalled fiber in
  `finally`).

## Log hash record (raw kept outside the repository, diagnostics verbatim)

- `01-baseline-4files-first-failure.normalized.log`: raw 22530 bytes SHA-256
  `cf5d4a587eb873cb60b7a4cee3ab002d1e77d86fbd8bb0ed45574ca2f001383d`;
  normalized 16542 bytes SHA-256
  `29184c9bb8e937559d12d069b2d6e564ee5c29ee4b2a331d0eea8d5c15713971`.
  (Baseline ran on the four start blobs, which are unchanged.)
- `02-postfix-4files-all-pass.normalized.log`: raw 2657 bytes SHA-256
  `0137649cbab8b948212fe0373ca1dd4610e7f1db0cf62c0ca28383f11924caa2`;
  normalized 1992 bytes SHA-256
  `dc9dadc49dd1e4f4abac763ad2a959f7566829fa4fbe3080570832c9d44f4432`.
- `03-negctl-A-assemble-root-owned.normalized.log`: raw 8513 bytes SHA-256
  `7b5f4488576ecce6b851e57f6152797ce43d1a44fdabde4cff518a2260c0cf88`;
  normalized 6402 bytes SHA-256
  `10218be01635f11762f005d7d1e1a52c829d8a094e9ad4df07bf6be6ad363f83`.
- `04-negctl-B-prestep-root-owned.normalized.log`: raw 9726 bytes SHA-256
  `be484d7a1040c7d6486f02269c5e27c70a0f5364a3835c125d43205ddb56e13f`;
  normalized 7356 bytes SHA-256
  `1224e1f42ef11a0db4e0a0a5397bc3e00f9e0eae3b59cbf32e3f799985c69396`.
- `06-post-restore-positive-4files.normalized.log`: raw 2657 bytes SHA-256
  `69dd45b374bdf01e54eccd065bf44cc098bad4de01fcc6df2a58b61634ccc481`;
  normalized 1992 bytes SHA-256
  `e94daa0aae9608744aa2459fc155be394a8c8d373186ba54e6dad4c4fc3bc97c`.
- `07-gate-typecheck.normalized.log`: raw 181759 bytes SHA-256
  `e04ffb6df44443fc1df980216727b773f49b5a2f596207cd2a37eab2def0cac5`;
  normalized 180083 bytes SHA-256
  `ffc467b814d17b557e925c6a847833ff83d796bcd0466dcf7ed3f5987ae34434`.
- `08-gate-lint.normalized.log`: raw 194798 bytes SHA-256
  `96dc4e59274381b984ee3c800889d09ae582bcd850b5e571dd27a901fbc90632`;
  normalized 192889 bytes SHA-256
  `08a0e6d05dcb758c3465afa12a06ec6045de8f5097611c2facff8360bc4a55f9`.
- `09-gate-duplication.normalized.log`: raw 2322 bytes SHA-256
  `925436412cc58b3f2b15aebac2522fa3bba185a4f7d953f23c9b393afc56e1ce`;
  normalized 2322 bytes SHA-256
  `925436412cc58b3f2b15aebac2522fa3bba185a4f7d953f23c9b393afc56e1ce`.
- `10-gate-docsync.normalized.log`: raw 2879 bytes SHA-256
  `54e81e56e3a3e6335a3580b576b0ce42e9a57acd54ce0b6c8cbf5b952754a9b5`;
  normalized 2879 bytes SHA-256
  `54e81e56e3a3e6335a3580b576b0ce42e9a57acd54ce0b6c8cbf5b952754a9b5`.

Gate-log rows added after the independent review: the raw scratch files were
still present, and each stored normalized file was re-derived from its raw
bytes and compared byte-identical before hashing, so both hashes name the exact
bytes of the recorded pair.
