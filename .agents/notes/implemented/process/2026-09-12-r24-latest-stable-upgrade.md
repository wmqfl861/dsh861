# Agent Note: Migrate the r24 toolchain, source and dependency batch to latest stable

Status: implemented

English | [中文](2026-09-12-r24-latest-stable-upgrade.zh.md)

## Problem

The r23 baseline pinned an older toolchain (Node 26.4.0, pnpm 11.7.0, TypeScript 6.0.3) and pre-merge upstream sources, while the four subagent CLIs and every workspace dependency had newer stable releases. The start commit declared a fixed batch but no lock regeneration, installation or migration had run.

## Decision

Resolve one fixed batch from publisher registries on 2026-09-12 and execute it end to end: project-local Node 26.8.2 and pnpm 12.4.1 in a fresh numbered tools directory (checksums verified against nodejs.org and the pnpm release), a real merge-forward of upstream deepseek-harness master c291e796 over merge-base d347e70 (the shallow clone was unshallowed first), lockfile regeneration through pnpm itself, and the TypeScript 7 migration using the publisher's split: `typescript@7.0.2` native compiler for builds, `@typescript/typescript6@6.0.2` for the 39 classic compiler-API import sites, with lsp-stdio aliasing its devDependency so typescript-language-server keeps a tsserver. Grok resolved to 1.0.30 (registry moved past the declared 1.0.25 during the round); its postinstall is denied because it writes to `~/.grok/bin`, while claude-code and opencode postinstalls (in-package bin copies) are allowed after script review.

## Alternatives considered

Running `pnpm outdated` targets at install time would chase floating latest; the batch was frozen first. Forcing every major (react 19, vite 8, vitest 5, jsdom 30, mermaid 12, js-yaml 5) would cross owning ranges the upstream project itself has not migrated; those stay deferred majors. Concluding the merge with `--no-verify` was rejected; the notices gate was satisfied by regenerating it after the real install instead.

## Consequences

TS7's stricter type-only-import checking exposed a real defect in merged code (four Branded ids called as values; now `brandString<T>()`), and fast-check 4.10 deprecated the assert `timeout` option (migrated to the `fc.timeout` plugin). The vendored Cordis set stays at the upstream integration baseline: three of four upstream repositories are not publicly resolvable, and the accessible cordiverse/cordis has 30 commits whose adoption would require re-applying the 19 documented local modifications — recorded as the concrete follow-up, not silently skipped. CI primary validation lanes move to Node 26 while artifact, native-ABI and release lanes stay on the 24 LTS line.
