# Agent Note: Execute the r25 repairs and the deferred dependency and vendor migrations

Status: implemented

English | [中文](2026-09-13-upgrade-consumers-r25-execution.zh.md)

## Problem

The r25-received repairs carried authoring-environment results only: five plugin-body tests had never run under an installed TypeScript 6 and Vitest, and the Codex resolver had never read a real Windows installation. The r24 round also left deferred dependency majors and a resolved-but-unapplied cordiverse/cordis vendor sync, and its classic compiler API migration had missed consumers beyond the counted 39 sites.

## Decision

The [shared-config behavior tests](../../../../scripts/vitest-shared.spec.ts) and the [Codex resolver](../../../../scripts/p0-b/windows-credentials/codex-installed-tools.mjs) now run against the installed tree. The resolver reads the platform package's own `codex-package.json` layout (`entrypoint`, `resourcesDir`) instead of assuming a flat `bin/` directory, and its [controls](../../../../scripts/p0-b/windows-credentials/codex-installed-tools.test.mjs) cover realpath path forms, misplaced helpers, and layout-metadata mismatches. Two missed classic-API consumers ([headless snapshot](../../../../snapshots/session/headless.snapshot.ts), [provider fixture](../../../../packages/subagent/subagent-codex/tests/private-stderr-provider.fixture.mjs)) moved to `@typescript/typescript6`. The deferred majors landed with their owning consumers migrated: React 19 (refs, timers, re-render invariants, fourteen type fixes), js-yaml 5 (dialect tag via `defineScalarTag`, namespace imports, bundled types), Lexical 0.50 unified to one instance, Zustand 5, Immer 11, jsdom 30, Mermaid 12, `typescript-language-server` 6, Vite 8, plugin-react 6, Vitest 5 (root-config inheritance, `expect.poll` callbacks, `Assertion` generics, a shared automatic-JSX preset for face-split packages), and the `@yao-pkg/pkg` 6.22.0 patch replayed through `pnpm patch`. The [vendor sync](../../../../vendor/README.md) replayed cordis 56b3d4f→f8ea3cd as a three-way merge: upstream's journal and symbol events are adopted, local lazy config resolution, transactional rollback, and awaited disposal are preserved, `Fiber.restart` stays on the instance because repository callers invoke fibers directly, the failed-fiber guard retries only on service recovery, and upstream's loader classification retired local mod 19 verbatim.

## Alternatives considered

Running the received repairs only in an authoring harness repeats the r24 gap the round exists to close. Keeping the deferred majors on range-compatible updates leaves the repository on superseded majors the owner explicitly authorized migrating. Replacing the vendored fork wholesale would discard the nineteen documented local modifications; retiring them wholesale would drop tested loader behavior the harness depends on.

## Consequences

Real-tooling results replace environment assumptions: 5/5 shared-config tests, 11/11 resolver controls, all three provider suites 71/71, and the full Loader composition verified through the direct harness because Node 26 on Windows hangs or aborts Vitest-pool grandchildren (documented, not worked around). Client suites pass 5269/5270 with the single failure being this machine's missing symlink privilege; the web suite runs 102 files against real built artifacts in a real browser; build, typecheck, lint, and frozen-lockfile verification exit 0. app-boot passes 225/225; one directory-picker containment test fails deterministically under the new teardown ordering and is recorded with its diagnostic chain as the open vendor item. js-yaml 5 behavioral differences (empty documents, empty `!!js` bodies) are classified as validation failures to keep the v4 contract. The three deepseek-harness forks remain unreachable and their vendored packages stay at the fork baseline except the include's js-yaml range.
