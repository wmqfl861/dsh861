# Agent Note: Private native stderr at the Codex Provider boundary

Status: implemented

English | [中文](2026-09-09-codex-private-stderr.zh.md)

## Problem

A native CLI can load credentials that the Host does not know. Matching only registered secret values cannot establish that arbitrary native diagnostic output is safe to forward. The internal Codex one-shot runner accepts a subprocess handle and forwards any supplied stderr pipe to the Host, so a registered Provider must not hand it an untrusted native pipe.

## Decision

The [registered Codex Provider](../../../../packages/subagent/subagent-codex/src/index.ts) wraps each newly acquired child with [withPrivateCodexStderr](../../../../packages/subagent/subagent-codex/src/private-stderr.ts) before the internal runner receives it. The wrapper drains raw stderr without decoding, retaining, forwarding, hashing, or classifying its contents and exposes no stderr pipe. Raw stream errors are consumed without copying their messages. The drain remains until actual stream close, including after failed teardown, and removes only its own listeners.

The wrapper delegates the original child receiver's terminate and wait methods and preserves live pid, stdin, stdout, collected-reader and outcome access. It does not own process termination, change a result to success, reinterpret cancellation, change model settings, or create a new credential source. The subprocess service continues to own the process tree. This policy applies to the registered Provider entry; direct internal-runner test calls remain test seams with caller-owned stream policy.

## Alternatives considered

Selective matching of configured API keys preserves more logs but cannot cover credentials discovered only by the native CLI. Raw forwarding before redaction leaves an irreversible disclosure path. Stopping reads without draining can block a child writing a full stderr pipe. Replacing the shared subprocess lifecycle adds a second process owner. Full diagnostic suppression trades troubleshooting detail for a small, explicit confidentiality boundary without those behaviors.

## Consequences

Native stderr is unavailable through this Provider, and suppression is not evidence that no secret was emitted. Protocol/process diagnostic facts remain available through the existing result path. Full safe diagnostic collection, stdout/final-answer protection, native file storage, error cause chains, and the other product providers require separate policies and verification. No product AC or node approval follows from this change.

## Verification

The [shared regression cases](../../../../packages/subagent/subagent-codex/tests/private-stderr.cases.ts) cover raw data and errors, identity and receiver preservation, concurrent children, failed teardown, large real Node-child output, cancellation and listener cleanup. The [provider-wiring fixture](../../../../packages/subagent/subagent-codex/tests/private-stderr-provider.fixture.mjs) executes the actual Provider source with explicit schema/registry/run stubs and synthetic Node children; it is not a Loader or native Codex test. The [verification record](../../../../development/remediation/2026-09-09/codex-stderr-r04/verification.json) separates these checks from unexecuted repository and native-product acceptance.
