# Agent Note: Pin upgraded SDK and manifest identities through real installed evidence

Status: implemented

English | [中文](2026-09-16-sdk-manifest-contracts-r39.zh.md)

## Problem

The latest-stable upgrade (see [the upgrade note](../process/2026-09-12-r24-latest-stable-upgrade.md)) moved `@anthropic-ai/claude-agent-sdk` from 0.3.263 to 0.3.269 (bundled Claude Code 2.1.263 to 2.1.269), `@modelcontextprotocol/sdk` from `^1.29.0` to `^1.30.0`, `zod` from `^4.4.3` to `^4.6.2`, and js-yaml to 5.4.2, but three specs still pinned the old identities. The provider bundle test failed on the first SDK dependency assertion, which masked the stale MCP and Zod expectations behind it. The snapshot manifest spec kept one row, `['', 'manifest must be a mapping']`, that described the pre-upgrade layering: js-yaml 5 rejects an empty document inside `yaml.load`, so `parseSnapshotManifest` throws the wrapped `session-snapshot: <path>: invalid YAML: …` before `record()` ever classifies the value, and the spec asserted a category the parser can no longer produce for that input. The same `record()` mapping rejection for parsed null, scalars, and sequences had no valid-YAML coverage at all — every existing non-mapping path went through parse errors or field validation.

## Decision

The three specs pin the installed identities as explicit literals, each verified from the thing it names rather than from the SDK version number: the SDK `package.json` (version 0.3.269, `claudeCodeVersion` 2.1.269, all eight platform `optionalDependencies` at 0.3.269), the provider `package.json` declarations (`^1.30.0`, `^4.6.2`), the current platform binary's `--version` output (`2.1.269 (Claude Code)`), and the SDK init message's `claude_code_version` (2.1.269). The SDK version constant and the Claude Code version constant stay separate product fields; the real-product sentinel string `REAL_CLAUDE_CODE_SENTINEL_2_1_237` is fixture text and keeps its bytes. The manifest spec now separates the two failure causes: the empty-document row expects the repository-owned wrapper prefix with its diagnostic path (`session-snapshot: case/snapshot.yml: invalid YAML`), asserting the category and path the parser owns without locking js-yaml's verbatim exception text, and three new rows (`null\n`, `42\n`, `- item\n`) feed valid YAML through the real `yaml.load` and expect `manifest must be a mapping` from `record()`. The parser, `JSON_SCHEMA`, the lockfile, the provider manifest, and every other assertion in the three files keep their bytes.

## Alternatives considered

**Deriving the expected versions from the manifest under test.** Reading the installed version and asserting equality with itself makes the pin self-certifying — any future version, including an unintended downgrade, passes. The assertions exist to fail when the upgrade lands or reverts, so they carry explicit literals.

**Accepting any well-formed version string.** A regex or non-empty check removes the pin entirely and cannot distinguish 0.3.269 from a stale install; the CI failure this round fixed was exactly a version-value mismatch that only an equality pin can catch.

**Dropping the empty-input row or replacing it with `null`.** Empty and non-mapping are different failure causes at different layers; removing the empty row would leave the js-yaml empty-document rejection unobserved, and `null` alone cannot stand in for it.

**A bare `toThrow()` or full-message equality for the empty input.** A bare throw accepts any classification, including a future regression that drops the wrapper; verbatim equality would lock js-yaml's exception text, which the repository does not own. The prefix with path pins exactly the wrapper's category and the diagnostic path.

**Fixing the parser to pre-trim or tolerate empty documents.** The layering is intended: `yaml.load` owns document parsing, `record()` owns shape classification. Changing shipped parser behavior to make an old expectation true is outside a test-alignment change and would silently accept previously rejected input.

## Consequences

The focused three-file baseline exited 1 with exactly the three first failures (3 failed / 88 passed of 91): the real-product SDK version assertion, the bundle SDK dependency assertion, and the empty-document row — with the MCP, Zod, CLI, and platform assertions unexecuted behind them. On the fixed bytes the same three files pass 94 / 94 (91 prior tests plus the three new non-mapping rows), which is also the first run that exercises the previously masked MCP `^1.30.0`, Zod `^4.6.2`, bundled-CLI `--version`, and init-message assertions on the upgraded install. Four negative controls, each reverting one expectation at a time, produced the corresponding real assertion failure — SDK constant, MCP range, Zod range (each `1 failed | 41 skipped` in the focused bundle case) and the old empty-input mapping expectation (`1 failed | 37 passed | 6 skipped`, failing because the thrown classification is `invalid YAML`) — and every restore was verified byte-exact against the saved candidate blobs before the final positive run. Typecheck, lint, duplication, and the quick documentation gates pass on the final bytes. This alignment does not resolve the other failures retained from [run 35047469159](https://github.com/wmqfl861/dsh861/actions/runs/35047469159) (context/inject and client-helper cases, Linux-only timeout and prompt cases, FileHandle exceptions, the Windows worker exit, coverage thresholds, and the Web React #185 pageError), which remain out of scope. Evidence: [windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-16/sdk-manifest-contracts-r39/windows-execution/FINDINGS.md).
