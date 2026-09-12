# Agent Note: Qualify the native Codex sandbox before adding another isolation mechanism

Status: implemented

English | [中文](2026-09-12-native-codex-scope-qualification.zh.md)

## Problem

The Windows planner path needs file-scope permissions that hold at execution time: approved inputs readable, private directories and unapproved writes denied for the command and its descendants. Earlier P0-B rounds measured committed input snapshots, TLS and credential reads, but none executed the pinned Codex sandbox, so no recorded result says whether its native Windows sandbox can enforce those permissions. Writing another token, ACL or process launcher before that measurement would duplicate or contradict maintained isolation.

## Decision

The [offline scope diagnostic](../../../../scripts/p0-b/windows-credentials/sandbox-qualification.md) measures the pinned Codex sandbox using synthetic files and the existing Windows job owner. It leaves production projection and admission unchanged. The native result, rather than a CLI banner or directory layout, determines whether this implementation can enforce the proposed file permissions.

A successful positive control precedes denied-operation checks. Process failure, absent files and child startup failure cannot substitute for access denial; host observations independently check untouched bytes and missing write effects. The diagnostic is not an adversarial attestation service and never grants execution authority.

## Alternatives considered

**Re-run the r20 input-snapshot or TLS suites.** They verify committed bytes, transport and credential reads, not runtime filesystem denial, so they cannot answer the file-scope question.

**Add a second sandbox runner or reuse the older packaged runner.** A parallel implementation would add its own token and ACL surface to maintain while the pinned Codex sandbox stays unmeasured.

**Trust the CLI help text or release notes.** The pinned binary's executed behavior decides; documentation cannot substitute for an observed denial.

**Relax the profile to full disk read.** The unelevated backend runs such profiles, but read denial outside approved roots is the capability under measurement, so a relaxed run would prove nothing about the required permissions.

## Consequences

Existing maintained isolation is evaluated before writing another token, ACL or process launcher. Unsupported native policy remains blocked; the test cannot install a stronger sandbox or weaken host policy on the owner's behalf. Even a successful command-level observation does not certify the main model process or all configuration-discovery paths. Those scopes retain separate integration and authorization requirements.

## Testing

The Windows run executed both suites against the pinned Codex 0.149.1 binary: 18 observer checks passed, and the native case was refused by the sandbox itself with `windows sandbox failed: Restricted read-only access requires the elevated Windows sandbox backend`. The pinned source bails out of the unelevated backend whenever a profile lacks full disk read access, and the elevated backend requires a dedicated sandbox logon account, capability SIDs and local ACL changes under an administrator context. Qualification stays blocked under this round's unelevated constraint; the [r21-win receipt](../../../../development/remediation/2026-09-12/native-sandbox-r21-win/verification.json) records the exact evidence and the minimal additional authorization.
