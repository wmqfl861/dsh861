# P0-B B0: credential references and output-safety components

English | [中文](README.zh.md)

Baseline: `a31d59210790e0e1d35c3d9405d76743f1cc6b60`, the owner-requested merge of PR #1. Implementation actor: ChatGPT in this round, continuing the undisputed safety components in existing P0-B v3 B0 under the owner's instruction to merge and continue development. This record is not a new Codex plan, ZCode invocation, or OpenCode hard-review receipt.

## Implementation

`credential-ref.ts` parses only `env:NAME` and `secret-reference:id`. Every source-to-target environment mapping must match grants supplied by a trusted caller; no source is read before all mappings pass. The module does not read process.env, disk, chat history, or global configuration, and missing values have no automatic fallback. Grants must come from platform authorization, never the model's self-declared permission.

A credential lease permits one-shot access. Default JSON and inspect expose only source and target variable names and nonempty status, not values or derived hashes. Completing the callback closes the lease and attempts to release temporary container references. JavaScript does not guarantee physical memory erasure or revoke copies retained by a malicious callback. Platform/GBrain accounts and actual credential rotation are not implemented here.

`redaction.ts` handles UTF-8 byte streams independently per output channel, retaining undecided prefixes for cross-chunk and overlapping matches. Supported representations are raw values, standard JSON string escapes, canonical URL percent encoding with upper/lowercase hex digits, form encoding, and base64/base64url. Matches become the fixed `[SECRET_REDACTED]` marker and detection remains latched. This is not protection against arbitrary encoding, unknown secrets, or side channels, and is not operating-system isolation. Callers explicitly configure maxSecrets and maxSecretBytes; exceeding them rejects rather than truncating secrets and continuing.

`collectors/redacted-stream.ts` redacts before any file write and uses stream-pipeline backpressure, fixed stdout/stderr filenames, exclusive creation, and POSIX 0600 mode. It neither overwrites existing files nor follows existing log-file symlinks. The output limit is fixed when the call starts and counts redacted UTF-8 bytes only; only redacted-stream hashes are retained. Errors discard undecided raw suffixes, preserve safely written prefixes, and produce no success receipt. A trusted run owner must control runRoot and its parents; this helper is not a sandbox against hostile concurrent directory replacement, and Windows ACLs are unverified.

`security-gates.ts` checks each original argv item for known credentials before startup, without first JSON-encoding and potentially obscuring existing escapes. The output check requires complete records for two distinct channels. Leaks are FAIL; missing or contradictory records are BLOCKED. Safe capture returns only OUTPUT_CAPTURED and always productAccepted=false. This file is not yet the repository-wide syntax-aware security scanner required by v3, nor can it authenticate fabricated external evidence.

## Verification performed

This round used Linux, Node v22.16.0, and TypeScript 5.8.3 for focused strict compilation of four new TypeScript files followed by Node tests. The final result is **55/55 passed, 0 failed, 0 skipped**. Cases include per-byte boundaries for every supported representation, 200 seeded fragmentation/overlap controls, fixed limits, output failures, symlink/overwrite rejection, and stdout/stderr integration using real Node child processes. All credentials and child behavior are synthetic fixtures, not real calls to the four products.

The first run failed 1 of 52 cases: JSON re-encoding obscured an already escaped credential in argv. Checking original arguments individually yielded 52/52; additional lease cleanup, configuration-freezing, and fragmentation controls yielded 55/55. All three original TAP logs are preserved byte-for-byte in [test-logs.tar.xz](test-logs.tar.xz); commands, hashes, and limitations are in the [verification receipt](verification.json).

Node v22.16.0 is outside the supported repository range. This round did not install repository dependencies or verify the repository tsx source path, built composition, full typecheck/lint, documentation checks, Windows, or actual CLIs. New tests are not automatically integrated into all CI. Focused results do not replace supported-environment checks.

## Repository verification entrypoint

With dependencies installed in a supported repository environment, run from source:

```sh
node --import tsx/esm --test scripts/p0-b/__tests__/security.test.mjs
```

P0B_SECURITY_MODULE_ROOT selects focused compiled output explicitly for offline testing; it is not a product-build directory declaration. Leave it unset for normal repository verification. Credentials reach the child environment through a trusted reader and lease callback. Never place real credentials in arguments, examples, commits, or test fixtures.

## Remaining work and next steps

This round does not change raw stderr forwarding in `packages/subagent/subagent-codex/src/run.ts`. The new collector is not wired into the existing provider/runner, so this product leak channel is not claimed closed. Integration must precede host forwarding and all persistence, not redact after forwarding. Real CLIs separately require evidence for configuration isolation, tool permissions, cancellation protocols, and resource quiescence.

Credential revocation/rotation is unverified; affected credentials are not used for real tasks. Designated real Codex successor planning, designated OpenCode hard review, AST-level source checks, a real secret service, four-product adapters/external collectors, and artifact handoff remain outstanding. P0-B stays BLOCKED; no new node or product AC PASS is created, and no old plan, candidate, or review is rewritten.

Include these sources and tests in the next fixed candidate. Complete runtime integration and supported-environment verification within the formal successor plan's scope. Source integration, offline safety tests, and node hard review are separate outcomes.
