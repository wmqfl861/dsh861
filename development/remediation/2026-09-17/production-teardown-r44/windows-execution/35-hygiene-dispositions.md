# r44-B hygiene gate dispositions (r44b3 executor, 2026-09-17)

Both hygiene failures from the prior dispatch were diagnosed on this host with
physical runs. Neither is caused by this round's candidate bytes, and neither is
fixed here because both owning surfaces are outside the approved writable scope
(hygiene scripts and the lockfile are excluded; per S3 the findings are recorded
for a scope decision instead of being patched).

## node-next types — silent failure localized: EPERM directory symlink, not tsc

- Symptom (prior dispatch): `verify-node-next-types` exits 1 printing only
  "NodeNext consumer typecheck failed." with no diagnostics.
- Reproduction this round: `pnpm exec tsx scripts/verify-node-next-types.ts`
  exits 1 with the same empty diagnostics
  (raw: `C:\dsh-r24-upgrade-20260912-01\r44b3-exec-raw\hygiene-node-next-run1.log`).
- Localization: a manual replica of the script's consumer-project setup
  (`r44b3-exec-raw\node-next-probe.mjs`) shows `symlinkSync(target, link, 'dir')`
  at the script's `linkPackage()` throws
  `EPERM: operation not permitted, symlink ...` (errno -4048) on this host: the
  process lacks `SeCreateSymbolicLinkPrivilege` (Windows Developer Mode off).
  The script's `catch` prints only the thrown child-process error's
  `stdout`/`stderr` properties, which a `symlinkSync` throw does not carry, so
  the real cause is swallowed and the failure renders "silent".
- When the links are created as junctions instead, the replica proceeds to tsc
  and tsc runs to completion (errors reported in that run are replica artifacts
  of its simplified specifier list, not the script's own list).
- Classification: host-privilege environment condition, pre-existing and
  unchanged by this round; the gate is green in CI on Linux where directory
  symlinks need no privilege. A minimal in-scope fix would be junction links on
  win32 in `scripts/verify-node-next-types.ts` plus surfacing non-child errors;
  not applied here (out of approved scope, report-first rule).

## vendored links — pre-existing two-document lockfile

- Reproduction: `pnpm exec tsx scripts/verify-vendored-links.ts` exits 1 with
  js-yaml `reason: 'expected a single document in the stream, but found more'`
  thrown at `scripts/verify-vendored-links.ts:37`
  (raw: `r44b3-exec-raw\hygiene-vendored-run1.log`).
- Evidence of the pre-existing condition: `pnpm-lock.yaml` contains 2 YAML
  documents (`grep -c '^---' pnpm-lock.yaml` = 2) and the file is git-clean in
  this round (`git status --porcelain pnpm-lock.yaml` is empty), so the
  multi-document lockfile predates this work.
- Classification: pre-existing lockfile/tooling condition outside the writable
  scope (lockfile and vendor tooling are excluded); the gate is owned by CI.
