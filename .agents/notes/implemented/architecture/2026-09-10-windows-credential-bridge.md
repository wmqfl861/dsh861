# Agent Note: Dedicated Windows credentials with a sealed reader pipe

Status: implemented

English | [中文](2026-09-10-windows-credential-bridge.zh.md)

## Problem

Stable credential references need an actual OS-backed reader. Putting a key in command arguments exposes it to additional command and process observation paths. A native reader that prints plaintext also exposes it to accidental diagnostic capture.

## Decision

The [dedicated Windows component](../../../../scripts/p0-b/windows-credentials/README.md) uses four fixed generic Credential Manager targets. Interactive provisioning accepts SecureString input, not a key-valued argument. The trusted reader requires explicit reference grants and integrates with the existing one-use lease instead of discovering global accounts or configuration.

Native stdout carries an RSA-OAEP-SHA256 envelope for a fresh parent-owned RSA-4096 key. Built-in cryptographic implementations handle encryption; Windows owns at-rest protection. Credentials are bounded to 384 printable ASCII bytes and rejected rather than truncated. The transport has explicit executable/source hashes, environment, deadline and output bounds; failures discard native diagnostic content.

## Alternatives considered

Plaintext files and command-line password arguments expand disclosure paths. Plaintext reader stdout makes accidental process logging unsafe. A full platform secret service and public management UI require authorization and deployment contracts beyond this support component; the component does not claim to deliver them.

## Consequences

The OS account is the security boundary, not a credential-name prefix or encrypted pipe. Product agents sharing that account still need effective OS isolation. There is no automatic model activation, key-rotation attestation, HTTPS authorization or planning-call authorization. The [verification receipt](../../../../development/remediation/2026-09-10/credential-store-r07/verification.json) distinguishes synthetic protocol tests from native Windows validation and records remaining integration limits.
