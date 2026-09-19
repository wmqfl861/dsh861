# r47 logs-r47b: independent implementation/test re-execution (second executor)

Authorship: these files are the record of the r47 **implementation & test
re-execution sub-agent** (fresh session, 2026-09-19 ~12:05-12:20 UTC). They are
new files; nothing under `../logs/` (files 00-16, produced by the earlier
concurrent session) was read-modified, overwritten, or re-attributed. The audit
verdicts on those earlier artifacts are in
[01-start-state-and-audit.md](01-start-state-and-audit.md); the final state is in
[12-final-state.md](12-final-state.md).

Conventions:

- Every `.log` records the **exact command argv** used and the **true exit code**
  as an appended `*_exit=` line. Nothing run via the direct vitest entry is
  claimed as `pnpm exec` and vice versa.
- Vitest/tsc output had ANSI color codes stripped for readability; content is
  otherwise verbatim. Unstripped raw copies, plus the negative-control driver
  (`nc-driver.mjs`), live **outside the repository** at `C:\dsh-r47b-impl-tmp\`.
- Every vitest/tsc invocation redirected `TMP`/`TEMP` to the spaceless ASCII
  `C:\dsh-r47b-impl-tmp\tmp` (r45 finding A convention).
- Toolchain truth for this host: the system pnpm shim is broken
  (`pnpm --version` exit 1, bad command path). The out-of-repo prefix pnpm
  `C:\dsh-r24-upgrade-20260912-01\pnpm-12.4.1\pnpm.exe` works (12.4.1) and was
  used for the `pnpm exec vitest` and `pnpm run typecheck` runs. `node` on PATH
  is v26.4.0 (the prefix's v26.8.2 was not required; each log states which ran).

| File | What it is |
| --- | --- |
| [01-start-state-and-audit.md](01-start-state-and-audit.md) | Start state + line-by-line audit verdicts on the concurrent session's artifacts |
| [02-spec-pnpm-prefix.log](02-spec-pnpm-prefix.log) | Spec run via prefix `pnpm exec vitest run --project thread-safe scripts/prepare-ci-bubblewrap.spec.ts` — exit 0, 13/13 |
| [03-spec-direct-entry-verbose.log](03-spec-direct-entry-verbose.log) | Same spec via `node node_modules/vitest/vitest.mjs run --project thread-safe ... --reporter=verbose` — exit 0, 13/13, all 13 test names listed |
| [04-nc1-old-location.log](04-nc1-old-location.log) | NC-old-location: pre-state verify, mutant apply (SHA `a8cbf098…`), vitest exit 1 (6 failed / 7 passed of 13), restore verified byte-identical |
| [05-nc1-restored-positive.log](05-nc1-restored-positive.log) | Positive after NC1 restore — exit 0, 13/13 |
| [06-nc2-ignore-integrity.log](06-nc2-ignore-integrity.log) | NC-ignore-integrity: mutant apply (SHA `fc8571e6…`), vitest exit 1 (1 failed / 12 passed), digest test failed `expected +0 to be 1`, restore verified |
| [07-nc2-restored-positive.log](07-nc2-restored-positive.log) | Positive after NC2 restore — exit 0, 13/13 |
| [08-bash-syntax.log](08-bash-syntax.log) | `bash -n` exit 0 on the working script and on both mutants |
| [09-oxlint-staged.log](09-oxlint-staged.log) | `node scripts/run-oxlint.ts --config .oxlintrc.staged.json scripts/prepare-ci-bubblewrap.spec.ts` — 0 warnings / 0 errors |
| [10-typecheck.log](10-typecheck.log) | Prefix `pnpm run typecheck` (build:lib:host + tsc -b tsconfig.client.json) — exit 0 |
| [11-translation-pairing.log](11-translation-pairing.log) | Translation-pairing full check — 849 pairs consistent, exit 0 |
| [12-final-state.md](12-final-state.md) | Final identities, gate summary, final git status |
