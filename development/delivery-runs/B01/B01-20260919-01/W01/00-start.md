# W01 00-start — implementation start state

Date: 2026-09-19. Implementer: ZCode (W01, B01-20260919-01).

## Identity
- Branch: chore/latest-stable-upgrade-20260912
- HEAD: 6528141bc9f435f8a2361f4a0c56eb9393092c02 (not moved by W01; no commit/push)
- scripts/prepare-ci-bubblewrap.sh blob: 7d2428e2fa84b7fda9aeec24fa1de661cb90cb46 (matches plan 3.2)
- scripts/prepare-ci-bubblewrap.spec.ts blob: 91bcd7fa4833b8687ebf66e8a136a65fe0c78e66 (matches plan 3.2)
- scripts/prepare-ci-bubblewrap-test-support.ts: NEW (pre-registered in plan 3.2, N, direct-launch/fixture support only)

## Pre-existing worktree state (not touched by W01)
M development/delivery-runs/B01/B01-20260919-01/STATUS.run.json
M development/remediation/2026-09-19/private-bubblewrap-build-r48/comment-draft.md
?? development/delivery-runs/B01/B01-20260919-01/W08/  ?? plan/
?? development/remediation/2026-09-17/production-teardown-r44/planning/cli-availability-probe.md
?? development/remediation/2026-09-17/production-teardown-r44/review/BLOCKED-opencode-hard-review.md
?? development/remediation/2026-09-17/production-teardown-r44/windows-execution/01-first-failure.normalized.log
?? development/remediation/2026-09-19/ci-bubblewrap-acquisition-r47/windows-execution/r47s/

## Toolchain (per dispatch)
- Node: C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64\node.exe — v26.8.2
- pnpm: C:\dsh-r24-upgrade-20260912-01\pnpm-12.4.1 (pnpm.exe; not needed: vitest entered directly)
- vitest direct entry: node node_modules/vitest/vitest.mjs
- TMP/TEMP redirected to C:\dsh-b01-w01\tmp (repo-external own dir)
- Raw outputs: C:\dsh-b01-w01\raw\

## Proven first failure (BASELINE.md S2 — not re-verified per dispatch)
CI run35436610274 Linux jobs: dpkg-deb multi-field request returns labeled output
(Package: libcap-dev); pre-W01 script compares bare values and exits 1; additionally
mapfile < <(...) loses the subcommand exit status. Both defects fixed in W01 per D03.

## Plan for this run
1. Rewrite the libcap control-field block to per-field dpkg-deb --field reads with
   direct exit+stderr capture (D03: no lenient multi-field parsing branch).
2. Add scripts/prepare-ci-bubblewrap-test-support.ts holding the CI-evidence contract
   fixtures (labeled control block shapes).
3. Extend the spec: stub dpkg-deb implements the real argv protocol (single field ->
   bare value; multiple fields -> labeled control-file-order lines); 12 new contract
   regressions; existing 36 kept, with the exact-argv sequence assertion updated for
   the new 6-call dpkg-deb protocol (documented, not weakened).
4. bash -n; full direct vitest run; NC-A (restore old multi-field block) and NC-B
   (swallow field-read exit) mutations with byte-preserved backups, SHA-256 checks,
   restore, and post-restore positive runs.
