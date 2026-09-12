# Four-model configuration recording and verification

English | [中文](README.zh.md)

This round records the four non-secret configurations explicitly provided by the owner on 2026-09-09, starting from `f8702fd888292d2cc79cc0297e309b060ac7984b`. The implementation actor is ChatGPT, not a designated Codex plan, ZCode invocation, or OpenCode hard review.

## Recorded configuration

The [approved desired configuration](../../../../config/agents/models.v1.json) preserves Codex `my-gpt / gpt-6-astra / max`, Claude Code `my-claude / claude-opus-5 / max`, Grok `my-grok / grok-4.6 / xhigh`, and OpenCode's built-in `zhipuai-coding-plan / glm-5.3 / max`. Ports, paths, and trailing slashes in the three Base URLs are preserved. No unknown OpenCode endpoint override is invented.

None of the four API keys was sent to tools or copied into local files, logs, Git blobs, tests, or commits. No fragments, encrypted copies, key-derived hashes, or decryption material were stored. The repository holds four fixed `credentialRef` values; the original chat is not a readable credential store. The owner-provided keys were exposed in chat, rotation is unverified, and replacements still need secure provisioning into a private credential store. This round does not perform that provisioning.

A new lockfile and [offline checker](../../../../scripts/p0-b/model-config.mjs) validate the approved non-secret configuration and reject field changes in upgrade proposals. The checker does not access the network, start CLIs, read environment keys, write global configuration, or regenerate locks automatically. It is not a production runtime upgrader.

## Actual verification

The [verification receipt](verification.json), [original compressed TAP log](tests.tap.xz), and [configuration-check result](config-check.json) retain this round's results. All 39 offline tests passed, with 0 failures and 0 skips; Node syntax checks passed. These test configuration and comparison, not native product integration or model calls.

The environment is Linux / Node v22.16.0, below the repository's minimum supported version. No full build, typecheck, lint, documentation checks, supported-version matrix, Windows verification, or real CLI/API tests ran. The 39 cases are not complete CI coverage or production-safety certification. No real credentials were read or changed, and the HTTP gateway addresses were not contacted.

## Remaining limitations

The desired configuration is not wired into the actual startup paths of the four native providers, and real credentials behind its references are not securely provisioned. Actual Codex `max` support, gateway protocols, built-in OpenCode resolution, HTTP transport protection, and effective configuration require isolated validation. Unsupported settings remain blocked rather than changing models or effort. A public configuration lock detects drift but cannot stop an actor able to rewrite both the manifest and lock; the upgrader must trust a separately retained approved baseline.

This round leaves P0-B, matters outside the existing model authorization, historical plans, candidates, receipts, and global CLIs unchanged. It grants no product AC PASS or next-node admission. Credential-storage and native-integration boundaries are in the [configuration reference](../../../../config/agents/README.md).
