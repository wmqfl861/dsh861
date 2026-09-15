# Native Codex file-scope qualification

English | [中文](sandbox-qualification.zh.md)

This reference describes an offline diagnostic, not a production sandbox or an approval mechanism. [codex-sandbox-qualification.mjs](codex-sandbox-qualification.mjs) creates only synthetic files; the [native test](codex-sandbox-qualification-native.test.mjs) runs the repository-pinned Codex sandbox command through the existing Windows job owner. No model, API key, provider route, signing identity or certificate is involved.

[codex-installed-tools.mjs](codex-installed-tools.mjs) resolves the CLI from the provider's installed dependency and the Windows platform package from that CLI. The declared exact version, installed metadata and matching checked-in tool manifest must agree; all three executable sizes and digests are verified before use. It does not guess pnpm store paths, search global installations or execute a program. The caller still protects the installation from changes after inspection. Historical native results apply only to their recorded binary, not automatically to the currently resolved release.

## What is measured

The unconfined positive control must first read both fixtures, create both write markers and start a child that reads the outside fixture. Its markers are then removed by exact path. The restricted command must still read the allowed bytes, while outside reads by both parent and child and writes inside and outside the input directory return access-denied errors. Host-side checks independently confirm input bytes, policy bytes and the absence of write markers. Files begin normally readable and writable, so missing files or a read-only attribute cannot supply the denial.

A timeout, signal, startup failure, missing output, wrong nonce, unreadable allowed input, child that never started, or ENOENT cannot become a passing denial. Protocol tests include deliberately simulated successful observations; those test the observer only. The actual unsandboxed Node control must be rejected as isolation evidence.

## Native policy and command

The recipe uses the pinned release's host `sandbox` command, `--permission-profile` and `--include-managed-config`. It does not use a guessed `sandbox windows` subcommand or ignore managed requirements. The custom profile denies filesystem access by default, permits the input, probe and explicit Node runtime plus Codex's minimal system paths, denies the private sentinel directory, and disables network access for the probe. The generated environment contains no ambient credentials. The native test selects the unelevated sandbox; it does not authorize account creation, system-wide ACL changes, firewall changes, UAC escalation or installation.

The command and policy must be checked against the actual pinned binary. Unsupported profiles, missing setup, policy conflicts or native limitations are qualification blockers, not reasons to remove the deny rule, disable managed requirements, upgrade Codex or use unrestricted execution. More privileged setup requires a separate concrete owner decision. Do not point the diagnostic at real private data; only its allocation contains target files.

## Running and interpreting

```sh
node --test scripts/p0-b/windows-credentials/codex-installed-tools.test.mjs
node --test scripts/p0-b/windows-credentials/codex-sandbox-qualification.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/codex-sandbox-qualification-native.test.mjs
```

The resolver suite uses synthetic package files, not Windows programs. The observer suite verifies fixture preparation and observation rules with real Node/file operations and explicit simulated result cases. The native suite requires Windows, the pinned binary and its native sandbox. Non-Windows skips are not a Windows success. It retains the existing job's assignment, termination, zero-active-count and disposal requirements. A passing receipt means only the named synthetic command and child exhibited the measured restrictions. It does not prove that the main CLI, discovery paths, arbitrary plugins, all filesystem objects or eventual model calls are contained. No receipt is accepted by the production admission layer.

The test does not modify the model projection or the production execution path. A successful qualification must still be deliberately connected to an approved invocation; a failed or blocked qualification leaves the existing production isolation requirement unmet. The [preparation record](../../../development/remediation/2026-09-12/native-sandbox-r21/verification.json) holds the Linux observer run; the [Windows execution record](../../../development/remediation/2026-09-12/native-sandbox-r21-win/verification.json) holds the pinned-binary run, whose restricted-read profile is blocked on the unelevated backend. See [the handoff](../../../development/handoffs/WINDOWS_KEYLESS_INTEGRATION.2026-09-10.md) for current local work.
