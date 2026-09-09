# Native Codex stderr: repository runtime repair and verification

English | [中文](README.zh.md)

Baseline: `38ed381accc8549886de65e482d99c66506e714e`. The actor is ChatGPT in this round, authorized by the owner to stop local-device work and continue in the repository. No local device or Remote Desktop Commander was accessed; no real credential was read, imported, used, or committed. This is not a new designated Codex plan or OpenCode hard review.

## Changes in this round

After obtaining a subprocess handle, the [registered provider](../../../../packages/subagent/subagent-codex/src/index.ts) immediately suppresses native stderr through [private-stderr.ts](../../../../packages/subagent/subagent-codex/src/private-stderr.ts) before passing the handle to the internal one-shot runner. The boundary continuously drains the raw pipe without retaining, forwarding, or hashing its contents, then removes its listeners when the stream closes. stdout, stdin, actual exit facts, termination, and waiting still delegate to the original owner.

This uses full suppression rather than applying selective redaction to unknown native logs: native login state can contain secrets not registered with the platform, so matching known keys is insufficient. The round therefore sacrifices native diagnostic prose while retaining existing structured protocol/process diagnostics. Complete collectors, all four harnesses' outputs, and native-file protection are not delivered. Suppression cannot be described as full auditing, detection of an actual leak, or four-product safety acceptance.

Internal [run.ts](../../../../packages/subagent/subagent-codex/src/run.ts) and its existing tests are unchanged. Direct callers of that internal test interface must still provide a safe process boundary. This round closes the native stderr forwarding path reached through the registered Codex Provider, not every internal call that bypasses the provider.

## Verification completed

All [15 shared regression cases](../../../../packages/subagent/subagent-codex/tests/private-stderr.cases.ts) pass on Linux / Node 22.16.0, with 0 failures and 0 skips. They cover unknown raw text, chunking, Unicode, binary data, error events, concurrent isolation, method receivers, failed exits, continued draining after cleanup failure, high-volume real Node child output, and cancellation. They do not invoke real Codex.

The [provider-wiring fixture](../../../../packages/subagent/subagent-codex/tests/private-stderr-provider.fixture.mjs) executes actual index.ts with explicitly substituted schema/registry/run services to obtain its real spawn closure, then starts synthetic Node children. For both normal and failed exits, the original version exposes 560000 stderr bytes to the internal runner; the fixed version exposes 0, preserving stdout and exit codes. This is not full Cordis Loader, native Codex protocol, or Windows verification. Original results are in [baseline-provider.json](baseline-provider.json), [fixed-provider.json](fixed-provider.json), and the [TAP log](tests.r01.tap).

TypeScript 5.8.3 transpileModule checks syntax transformation only, not a full or dependency-complete typecheck. Full cloning failed with DNS errors in this environment; repository dependencies were not installed. Node 22.16.0 is below the supported minimum, so these results do not replace supported-engine checks, production builds, lint, documentation checks, or native tests. See [verification.json](verification.json) for limits and file hashes.

## Manual local verification

Use a development-branch worktree with repository dependencies installed and Node meeting root [AGENTS.md](../../../../AGENTS.md). Do not submit keys in chat or change global agent configuration. These commands require no key and omit credentialed real-deepseek tests.

```sh
pnpm exec vitest run packages/subagent/subagent-codex/tests/private-stderr.spec.ts packages/subagent/subagent-codex/tests/private-stderr-provider.spec.ts packages/subagent/subagent-codex/tests/subagent-codex.spec.ts
pnpm run typecheck
pnpm run lint
pnpm run test:docs
node scripts/p0-b/sync-node-status.mjs --check
```

Preserve failure output before repair; do not increase timeouts or remove assertions to obtain a pass. Windows/native-product tests, full Loader composition, and designated review still need completion within an effective successor plan. P0-B remains blocked, no product AC PASS or P0-C admission is added, and master is not merged. The four owner-locked model declarations, providers, Base URLs, effort levels, credential references, historical plans, and candidates remain unchanged.
