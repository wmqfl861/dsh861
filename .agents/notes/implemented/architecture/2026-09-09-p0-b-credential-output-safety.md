# Agent Note: Explicit credential leases and redacted output capture

Status: implemented

English | [中文](2026-09-09-p0-b-credential-output-safety.zh.md)

## Problem

P0-B needs explicit credential sources and evidence that does not leak secrets. Serializing a credential-bearing object, forwarding raw diagnostics, or checking each transport chunk independently can disclose values. A successful child exit must not override a detected leak.

## Decision

The isolated B0 components in `scripts/p0-b/` resolve only explicitly granted source-to-target mappings. Trusted readers are injected; there is no ambient environment, filesystem, or conversation discovery. A one-use lease exposes safe metadata by default and releases owned references after the callback. JavaScript cannot guarantee physical memory erasure or revoke copies retained by a hostile callback.

Each output channel has an incremental UTF-8 redactor that retains unresolved prefixes and covers overlapping matches. Known raw, standard JSON-escaped, canonical URL/form and base64 representations are supported, not arbitrary encodings or unknown secrets. Caller-provided size bounds are validated. A detection is latched and may notify the trusted process owner without independently killing processes.

The collector applies redaction before persistence, observes backpressure, creates fixed filenames exclusively with POSIX private permissions, enforces a per-call output limit and hashes only sanitized bytes. Interrupted raw suffixes are discarded. The run root and its parents remain the trusted owner's responsibility; this does not establish an OS sandbox or Windows ACL policy.

Arguments are checked individually before launch so a second JSON encoding cannot hide escaped credentials. The output gate distinguishes missing evidence, leakage and successful capture. A detected leak produces FAIL even when another channel is missing or malformed, independent of report order; invalid companion evidence cannot erase the leak. It never certifies a product or node PASS. These helpers are not yet wired into the existing Codex provider's raw stderr forwarding and do not implement the planned syntax-level source scanner.

## Alternatives considered

Regex replacement separately on each chunk misses split secrets. Persisting raw bytes and cleaning them later is too late. Treating exit zero or a successful capture as product acceptance conflates independent facts. Automatically reading global configurations would violate the explicit-source boundary.

## Consequences

The [historical verification record](../../../../development/remediation/2026-09-09/security-r02/verification.json) retains focused compilation, synthetic subprocess tests, an initial failing argv regression and its correction. The [source regressions](../../../../scripts/p0-b/__tests__/security.test.mjs) also exercise malformed companion evidence in both orders on Windows. Real product wiring, designated planning/review and product acceptance remain outstanding. Historical plans and receipts are unchanged.
