# Agent Note: Stop Vitest 5 inline projects from inheriting the root config

Status: implemented

English | [中文](2026-09-15-vitest-project-inheritance.zh.md)

## Problem

Since Vitest 5 an inline project extends the config file that declares it by default, and the inherited values merge through Vite's `mergeConfig`, which concatenates arrays. Both projects in [vitest.config.ts](../../../../vitest.config.ts) therefore inherited the root `test.include` next to their own, so `vitest list --filesOnly` claimed 1229 of 1236 files for `thread-safe` and `process-bound` alike and every plain suite ran twice per invocation; the r34 Chokidar record shows one spec reported as 2 files with 28 tests. The root plugins also registered beside each project's own copies, which Vitest reports as duplicate-plugin warnings. The coverage inventory parser in [coverage-partitions.ts](../../../../scripts/coverage-partitions.ts) kept the last claim for a file owned by two projects, so the partition coordinator could hand a file to the wrong project without failing.

## Decision

Both inline projects set top-level `extends: false` (never `test.extends`, and never `extends: true`, which hides the warning but keeps the merged include) and declare `test.setupFiles` from a shared `testSetupFiles` constant that the root test config also uses; project plugins, esbuild, execArgv, the forks pool, per-project include/exclude, platform rules, and the root coverage include/exclude, thresholds, reporters, and partition mode are unchanged. No per-project coverage copies are needed: Vitest resolves every project's coverage from the root config. `parseListOutput` expands the exempt selectors before parsing, normalizes backslashes, keeps same-project repeats idempotent, and throws naming the file and both projects when one non-exempt file is claimed by two projects; exempt files neither enter the inventory nor fail that check. The new [vitest-project-inheritance.spec.ts](../../../../scripts/vitest-project-inheritance.spec.ts) resolves the repository's projects through the real installed Vitest, asserting each project resolves the two setup scripts exactly once and registers each target plugin exactly once, lists itself under exactly one project, and enumerates a coordinator-generated partition config with the real Vitest CLI, proving a narrowed partition does not re-inherit the root's broad include and an empty project side runs nothing.

## Alternatives considered

Setting `extends: true` explicitly would silence the duplicate-plugin warning while keeping the include overlap. Dropping the per-project plugins and esbuild instead would leave `setupFiles` and `include` arriving through implicit inheritance, so the projects would keep depending on root-config merging. Keeping the last claim in `parseListOutput` and deduplicating downstream would hide which project actually runs a file instead of rejecting the overlap.

## Consequences

Verified on Windows with the installed Vitest 5.0.0 in [both list modes](../../../../development/remediation/2026-09-15/vitest-project-inheritance-r35/windows-execution/FINDINGS.md): the unique file union is unchanged (1236 normal and 1191 exempt, none lost or gained), the two projects share no file, `process-bound` holds exactly its seven win32-allowed manifest files, the duplicate-plugin warnings are gone, and each project resolves both setup scripts and one copy of each target plugin. Negative controls executed for real: reverting to implicit inheritance makes `parseListOutput` throw on the actual list output and fails the new regression (duplicated plugins, doubled setup scripts, the spec double-listed), and removing only the project `setupFiles` leaves the projects with no resolved setup scripts and fails the wiring regression. Partition configs inherit the fix because `partitionConfigSource` spreads the project entries. Full instrumented coverage and the Linux lanes did not run in this round.
