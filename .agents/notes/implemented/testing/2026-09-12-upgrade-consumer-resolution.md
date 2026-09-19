# Agent Note: Resolve compiler APIs and native tools through their actual consumers

Status: implemented

English | [中文](2026-09-12-upgrade-consumer-resolution.zh.md)

## Problem

A native TypeScript compiler build does not exercise the compiler API imported while loading a Vitest configuration. An installed Codex version likewise does not establish which binary a diagnostic will execute when it embeds a package-manager store path.

## Decision

The shared [decorator transform](../../../../vitest.shared.ts) imports the declared TypeScript 6 compatibility API. Its [behavior tests](../../../../scripts/vitest-shared.spec.ts) execute transformed decorators and check TSX, module suffixes and source maps through the same plugin used by test configurations.

The [native diagnostic](../../../../scripts/p0-b/windows-credentials/codex-sandbox-qualification-native.test.mjs) resolves Codex from the provider's installed dependency and its own platform package. The [resolver](../../../../scripts/p0-b/windows-credentials/codex-installed-tools.mjs) verifies the declaration, installed metadata, repository location and all three release file digests before returning paths. It does not depend on pnpm store directory spelling or use a global executable fallback.

## Alternatives considered

Changing dependency declarations alone leaves consumers on the old API or executable. Replacing one hardcoded store directory with another repeats the problem at the next upgrade. Restoring the old compiler as the default would conceal the native compiler migration rather than preserve the distinct API consumer.

## Consequences

Compiler builds, test-configuration loading and native file verification have separate evidence. Synthetic resolver fixtures do not execute Codex or prove sandbox permissions. Hash checks apply at inspection, so callers retain responsibility for installation integrity until use. Model configuration, production authorization and historical results remain separate from dependency selection.
