# Agent Note: Qualify the native Codex sandbox before adding another isolation mechanism

Status: implemented

English | [中文](2026-09-12-native-codex-scope-qualification.zh.md)

## Decision

The [offline scope diagnostic](../../../../scripts/p0-b/windows-credentials/sandbox-qualification.md) measures the pinned Codex sandbox using synthetic files and the existing Windows job owner. It leaves production projection and admission unchanged. The native result, rather than a CLI banner or directory layout, determines whether this implementation can enforce the proposed file permissions.

A successful positive control precedes denied-operation checks. Process failure, absent files and child startup failure cannot substitute for access denial; host observations independently check untouched bytes and missing write effects. The diagnostic is not an adversarial attestation service and never grants execution authority.

## Consequences

Existing maintained isolation is evaluated before writing another token, ACL or process launcher. Unsupported native policy remains blocked; the test cannot install a stronger sandbox or weaken host policy on the owner's behalf. Even a successful command-level observation does not certify the main model process or all configuration-discovery paths. Those scopes retain separate integration and authorization requirements.
