# Windows dedicated credential bridge

English | [中文](README.zh.md)

This P0-B support component stores dedicated Windows credentials and connects an explicitly authorized reader, Codex configuration projection and owned process launcher. It is not a public settings UI, multi-tenant vault, user authentication service or product acceptance mechanism. [Model configuration](../../../config/agents/README.md) remains independently versioned.

## Owner operations

Use [manage.ps1](manage.ps1) in a trusted interactive PowerShell console as the Windows account that will run the trusted planning service. `Set` uses two `Read-Host -AsSecureString` prompts and accepts no key-valued argument. Do not put keys in chat, scripts, transcripts, `cmdkey /pass:...` or ordinary `.key` files. Do not bypass host security policy.

```powershell
Set-Location -LiteralPath 'C:\Albert\project\dsh861'
.\scripts\p0-b\windows-credentials\manage.ps1 -Action Status -Provider codex
.\scripts\p0-b\windows-credentials\manage.ps1 -Action Set -Provider codex
```

Complete native keyless validation before real provisioning. Writes require confirmation; replacing an existing entry requires `-Replace`. `Remove` confirms deletion of only the selected target. Provisioning is single-writer: Windows CredWrite is an upsert, not compare-and-swap. Status contains only target and presence/format state, not values, suffixes, lengths or key-derived hashes.

| Provider | Stable reference | Windows target |
|---|---|---|
| `codex` | `secret-reference:providers/codex` | `dsh861/providers/codex` |
| `claude-code` | `secret-reference:providers/claude-code` | `dsh861/providers/claude-code` |
| `grok` | `secret-reference:providers/grok` | `dsh861/providers/grok` |
| `opencode` | `secret-reference:providers/opencode` | `dsh861/providers/opencode` |

The application-defined generic credential format persists for the same user on the same machine across logons. Other machines and service accounts do not inherit it; cmdkey entries have a different format and are not imported implicitly. Keys must contain 1–384 printable non-space ASCII bytes. Unsupported values fail rather than being truncated. SecureString and buffer clearing do not guarantee complete memory erasure or protection from administrators or compromised same-user code.

## Trusted reading

[reader.ts](reader.ts) composes `createWindowsBridge` and `createSealedCredentialReaders` with the existing [one-use lease](../credential-ref.ts). Both reference and source-to-environment grants are explicit. There is no global credential enumeration, ambient environment fallback, plaintext export command or general agent-facing secret reader.

The trusted deployment pins the absolute PowerShell executable, [bridge.ps1](bridge.ps1), [native-credential.cs](native-credential.cs) and their hashes. The bridge uses `-NoProfile`, `-NonInteractive`, `shell: false`, a private pipe and only `SystemRoot`, `TEMP` and `TMP`. It enforces response size and time limits and discards raw diagnostics. Each read uses a fresh Node-owned RSA-4096 key pair: public parameters cross stdin, native stdout carries an RSA-OAEP-SHA256 envelope, and decryption occurs in parent memory. Windows owns at-rest storage; the envelope prevents incidental plaintext pipe capture, not same-user credential theft.

Keep deployment files and temporary parents protected throughout execution. Pre-launch hashes do not remove concurrent modification races, and path isolation or POSIX mode bits do not establish Windows ACLs. Untrusted agents need separate identities or verified OS isolation. Rotation, storage, transport approval and run authorization are independent facts.

## Codex projection and invocation

[codex-launch-projection.mjs](codex-launch-projection.mjs) validates the actual model lock and generates one fixed argv/TOML/environment set. It rejects HTTP, lock mismatch, unsafe paths, unknown input fields and workspace/run-root overlap. The result is `CODEX_LAUNCH_PROJECTED_NOT_AUTHORIZED`: projection reads no key, creates no directories and starts no process. The configuration contains the credential variable name, never its value; the tool-shell environment excludes model credentials.

[planner-entry.ts](planner-entry.ts) reserves a new run root exclusively, creates isolated directories and writes configuration with `wx`. Existing roots, including pre-positioned links, are refused; protecting parent directories remains the caller's responsibility. The entry supplies projection-derived inputs to [planner-invocation.ts](planner-invocation.ts) and the existing credential lease. Empty approval references and subject mismatches are refused, but nonempty references do not authenticate the underlying owner decision or transport evidence.

The wrapper privately snapshots inputs, checks prompt/executable hashes and explicit bounds before credential reading, and scans known leased secrets out of argv before spawn. Both returned channels are redacted first. `maxChannelBytes` bounds retained UTF-8 bytes including delayed EOF fragments and replacement expansion; a violating fragment is discarded before retention. Input-delivery failures cancel, leakage stays latched, and incomplete capture remains explicit.

`deadlineMs` covers the spawned phase, not hashing or credential resolution; `terminationGraceMs` bounds cancellation waiting. Forced pipe closure is not process-tree exit. Results distinguish direct-child exit, pipe closure, retained bytes and `descendantState=NOT_VERIFIED`. One CLI can make multiple model requests: these limits are not a monetary ceiling. Exit zero is not a usable plan or product acceptance.

## Owned launch and failure lifecycle

[job-owner.ps1](job-owner.ps1) holds one explicit Windows job without breakaway flags. [windows-job-owner.ts](windows-job-owner.ts) verifies executable/helper/launcher hashes and bounded, operation-matched JSON responses. The pinned [launch-gate.mjs](launch-gate.mjs) joins the job before creating the target CLI. The standard entry uses this gate; an optional ownership implementation without gated launch still has the post-spawn assignment gap.

The owner tracks one launcher and permits exactly one release after its exact live PID receives a successful assignment response. Wrong-PID, failed or late assignment, abort, helper exit, protocol failure and disposal cannot authorize release. Failure writes an abort marker and requests direct termination even while the gate is unassigned; no process-name scan is used. The helper uses monotonic waiting, abort precedes release, and a go marker first observed after expiry cannot start the target. Malformed or oversized launch records yield fixed exit codes without exposing their contents. Target stdio is not used for control messages.

Disposal requires a valid clean helper close and an observed launcher close. Timeout remains failure; marker files remain while launcher closure is unknown. A replaced directory link is unlinked rather than recursively traversed. The entry records assignment, termination acknowledgement, active count and disposal. Missing assignment, failed termination/disposal, or nonzero/unknown count returns `PROJECTED_PLANNER_CLEANUP_BLOCKED`; invocation failures retain cleanup facts. None of these facts establishes ACLs, authenticates a user or certifies an unobserved descendant.

The entry explicitly maps the job owner's `launchGated`, `releaseGated` and `abortGated` methods to the invocation's `launch`, `release` and `abort` methods. Its adapter requires every `PlannerProcessOwnership` method, so optional wrapper support cannot silently omit gating at this entry. Assignment and termination use the same owner instance. The entry-path regressions in [planner-entry-gate.test.mjs](planner-entry-gate.test.mjs) observe this composition instead of constructing a different adapter inside a test.

## Verification

Run from the repository with pinned dependencies; leave module-override variables unset for normal verification.

```sh
node --import tsx/esm --test scripts/p0-b/windows-credentials/reader.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/native.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/planner-invocation.test.mjs scripts/p0-b/windows-credentials/planner-invocation-bounds.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/planner-entry.test.mjs
node --test scripts/p0-b/windows-credentials/codex-launch-projection.test.mjs
node --experimental-vm-modules --test scripts/p0-b/windows-credentials/ownership-failures.test.mjs
node --experimental-vm-modules --test scripts/p0-b/windows-credentials/planner-entry-gate.test.mjs
node --experimental-vm-modules --test scripts/p0-b/windows-credentials/gate-owner-failures.test.mjs scripts/p0-b/windows-credentials/launch-gate.test.mjs
node --experimental-vm-modules --test scripts/p0-b/windows-credentials/gate-owner-native.test.mjs
```

Reader tests use an explicit synthetic peer and real RSA/lease code. The optional `P0B_WINDOWS_CREDENTIAL_MODULE_ROOT` is only for documented offline compiled copies. Native credential tests use unique `dsh861/selftest/` targets, never production keys; crashes can leave residue, so inspect only the recorded targets. They do not certify interactive real-key entry, service-account persistence or ACLs.

Planner tests distinguish real Node fixtures from simulated OS interfaces. Missing or frozen heartbeats are not exit proof; readiness requires creation and progress, and fixture-owned cleanup is not product containment. [gate-owner-failures.test.mjs](gate-owner-failures.test.mjs) uses actual owner source, simulated children and real marker files. [launch-gate.test.mjs](launch-gate.test.mjs) combines real Node runs with deterministic clock controls. [gate-owner-native.test.mjs](gate-owner-native.test.mjs) observes exact real Windows child handles for helper death before and after assignment. Non-Windows skips are not native acceptance.

The [r13 Windows receipt](../../../development/remediation/2026-09-10/planner-gate-r13/verification.json) preserves prior native results; the [r14 receipt](../../../development/remediation/2026-09-10/gate-abort-r14/verification.json) records current controls and unexecuted checks. The [decision note](../../../.agents/notes/implemented/architecture/2026-09-10-windows-credential-bridge.md) links earlier evidence and qualifications. Reuse passing evidence only for the unchanged inputs it actually covers.

## Production prerequisites

Only the owner can confirm provider-side revocation, privately provision a replacement and approve the real protected route and spending limits. First planning needs only the Codex credential, not all four. HTTP risk acceptance is not encryption evidence. Keep model declarations and locks unchanged until a specific configuration change is authorized.

The implementation must authenticate authorization records and enforce effective sandbox, output, lifecycle and budget constraints; these are not supplied by a user's confirmation alone. A CLI banner, HTTPS spelling or isolated CODEX_HOME path does not prove gateway behavior, certificate validation or OS enforcement. Do not read production credentials or call a model until the real invocation conditions are met. This component does not issue the designated Codex plan or OpenCode review.
