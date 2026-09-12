# Agent Note: Owner model declarations independent of CLI upgrades

Status: implemented

English | [中文](2026-09-09-owner-model-config-lock.zh.md)

## Problem

CLI installation defaults and application model policy have different owners. Reconstructing model choices from a new CLI version can silently change routes or effort. Redacted credential text is not a reusable authentication value.

## Decision

The [configuration reference](../../../../config/agents/README.md) owns one versioned, secret-free declaration for four product harnesses. Stable credential references identify external secrets without storing their values or value-derived hashes. The offline checker validates public fields and their lock, and rejects drift in a CLI-only upgrade proposal. Its report never certifies native execution or credential provisioning.

Owner requests remain exact even when native compatibility is unverified. An unsupported setting is not rewritten. Built-in OpenCode routing has no invented endpoint override. Product defaults do not change the separately designated development planner or hard reviewer.

## Alternatives considered

Inline keys, recoverable obfuscation and co-located encryption keys expose authentication material with source. Reading global harness settings violates the isolated credential boundary. Automatically regenerating a lock during upgrade would accept the very drift the comparison is intended to detect.

## Consequences

The declaration is portable across CLI versions and its comparison is deterministic. The lock is not a signature or an authorization service. It must be compared with a trusted baseline. Runtime adapter wiring, secure secret provisioning, effective configuration observation and native compatibility remain separate required integrations. Formatting-normalized model hashes do not redefine historical exact-byte candidate hashes.

## Verification

Focused offline tests cover exact requested values, reference-only credentials, unsafe URLs, policy relaxation, mismatched locks, changed upgrade proposals, CLI error redaction and non-activation reports. These checks use no real key or model endpoint and do not replace supported-engine tests or independent node review.
