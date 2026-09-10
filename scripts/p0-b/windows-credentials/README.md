# Windows dedicated credential bridge

English | [中文](README.zh.md)

This P0-B support component provisions four dedicated Windows Credential Manager targets and supplies the existing [credential lease](../credential-ref.ts) with an explicitly granted reader. The management commands do not launch a model or activate [model configuration](../../../config/agents/README.md). The separately invoked planner function can spawn a supplied CLI after its preconditions pass; it is not a rotation attestation, public settings UI, or multi-tenant secret service.

## Owner-facing operations

Use [manage.ps1](manage.ps1) in a trusted local interactive PowerShell console, as the Windows account that will run the trusted planning service. `Set` prompts twice using `Read-Host -AsSecureString`; it has no key-valued argument. Never put a real key in `cmdkey /pass:...`, a script, an agent message, a transcript, or an ordinary `.key` file. Do not disable host security policy to run the script.

```powershell
Set-Location -LiteralPath 'C:\Albert\project\dsh861'
.\scripts\p0-b\windows-credentials\manage.ps1 -Action Status -Provider codex
.\scripts\p0-b\windows-credentials\manage.ps1 -Action Set -Provider codex
```

Run native keyless tests before entering a real key. `Set` asks for confirmation before mutation; existing entries require the explicit `-Replace` switch. `Remove` deletes only the selected dedicated entry after confirmation. Provisioning is single-writer: Windows `CredWrite` is an upsert, not an atomic compare-and-swap. Status reports only a fixed target and presence/format state, never the value, a suffix, its length, or a key-derived hash.

| Provider argument | Stable reference | Windows target |
|---|---|---|
| `codex` | `secret-reference:providers/codex` | `dsh861/providers/codex` |
| `claude-code` | `secret-reference:providers/claude-code` | `dsh861/providers/claude-code` |
| `grok` | `secret-reference:providers/grok` | `dsh861/providers/grok` |
| `opencode` | `secret-reference:providers/opencode` | `dsh861/providers/opencode` |

The backend uses application-defined generic credentials, a format marker, and local-machine persistence for the current Windows user. The same account on this machine can read the value across later logons; another service account or machine does not automatically inherit it. An entry created by `cmdkey` has a different format and is not silently imported. Provider changes, rotation attestations, and run authorization remain separate from storage.

Keys must contain 1–384 printable non-space ASCII bytes. Unsupported lengths or characters fail instead of being truncated. This is a bounded API-key component, not an arbitrary-password or large-token vault. SecureString and temporary-buffer clearing reduce retained copies; they do not erase all OS/runtime memory or protect against administrators, credential-stealing code, or a compromised process running as the same user.

## Trusted reader integration

[reader.ts](reader.ts) composes `createWindowsBridge(spec)` with `createSealedCredentialReaders(invoke, allowedIds)`. Pass the resulting readers to `resolveCredentialReferences(requests, grants, readers)`; both source-to-target grants and the allowed reference set remain enforced. No environment or file fallback exists. The trusted caller supplies an absolute PowerShell executable, helper directory, approved SHA-256 values for that executable and both helper sources, owned temporary paths, and a deadline. Do not derive production approval from files that an untrusted task can rewrite.

[bridge.ps1](bridge.ps1) invokes [native-credential.cs](native-credential.cs). A fresh RSA-4096 key pair is generated in the Node parent for each read. Only public parameters cross stdin; the native process seals the credential with RSA-OAEP-SHA256, and the parent decrypts it in memory. Plaintext keys never intentionally cross helper stdout. Response identity, size, format and encrypted-block length are checked; missing values remain missing, and errors omit raw process output and causes. Captured response and plaintext buffers are cleared after use. No custom encryption is used at rest: Windows Credential Manager owns storage.

The private transport uses `-NoProfile`, `-NonInteractive`, `shell: false`, exact helper hashes, and an explicit environment containing only `SystemRoot`, `TEMP`, and `TMP`. It does not inherit global provider keys, load a PowerShell profile, bypass execution policy, enumerate credentials, or expose a plaintext export command. The peer files and temporary directory must be controlled by the trusted owner throughout execution; pre-launch hashes do not remove modification races.

The encrypted envelope prevents incidental pipe capture from disclosing the key; it is not authorization against the same Windows user, who can call Credential Manager directly. Untrusted product agents therefore still require separate execution identities or verified OS isolation. Only the trusted service receives the reader and leases. Do not expose this API as a general agent tool or write decrypted results to a diagnostic channel.

## Planner invocation wiring

[planner-invocation.ts](planner-invocation.ts) connects the sealed reader to a supplied executable. Its trusted caller must authenticate the owner decision, verify the model lock, project the approved route into the actual CLI arguments/configuration, and supply effective sandbox and isolated-home settings. A nonempty approval or transport record name is only a reference, not proof that the record is genuine, TLS was verified, or the CLI used the route. This function is not an untrusted JSON endpoint, an approval service, or a complete Codex adapter.

Before reading a credential it takes private copies of the invocation inputs, compares the supplied subject and route, parses an HTTPS URL without user information or fragments, verifies prompt/executable hashes, and validates explicit process bounds. The currently approved HTTP route remains refused. The existing lease supplies the child environment; the existing argument scanner rejects a known leased value in argv before spawn. Files and the native bridge must remain controlled by the trusted owner; the snapshot does not protect mutable deployment files or a compromised bridge.

`maxChannelBytes` bounds retained UTF-8 bytes independently for stdout and stderr, including delayed redactor output at EOF. A fragment that would exceed the limit is discarded before retention and cancels the invocation; later input is drained without accumulating text. Prompt-delivery errors cancel instead of reporting a completed input. `capturedBytes` reports retained bytes; `captureComplete=false` distinguishes truncated or interrupted output. Leak detection stays latched even when its redacted fragment does not fit.

`deadlineMs` covers the spawned process phase, not pre-launch hashing or credential resolution. Cancellation requests termination of the direct child and waits at most the explicit `terminationGraceMs` for process/stdio closure. If pipes remain open, the wrapper closes its own pipe ends and returns a cancelled result. It does not signal a PID after observing that child's exit. `cleanup` separately records direct-child exit, stdio close, forced pipe closure and `descendantState=NOT_VERIFIED`; a kill request or a bounded return never certifies a quiet descendant tree. A trusted execution owner must separately verify resource ownership and quiescence before treating the run as safely cleaned up.

One CLI can issue several model requests; these bounds are not a monetary or per-request limit. Process completion, even with exit zero, is not a usable plan, verified model identity, or product acceptance. The caller must check termination/capture status, exit/signal, leakage, native events, the returned plan and the required external evidence. No real model call is part of the synthetic tests.

## Non-secret Codex launch projection

[codex-launch-projection.mjs](codex-launch-projection.mjs) calls the actual model-lock verifier and projects the approved Codex route into fixed argv, a TOML configuration and an explicit isolated-path environment. It rejects HTTP, mismatched locks, unknown input fields, workspace/run-root overlap and unsafe paths. Provider, model, reasoning effort and credential reference come only from the approved declaration; generated configuration contains the environment-variable name, never its value. The shell environment excludes keys and does not inherit the model process environment.

The result is `CODEX_LAUNCH_PROJECTED_NOT_AUTHORIZED`. The function does not read credentials, write configuration, create directories, authorize a request or spawn a process. A trusted caller must provision the owned directories and verify the pinned CLI's configuration discovery, native settings and OS-enforced read-only scope before executing. An approval reference, HTTPS spelling, generated `CODEX_HOME` or a successful projection is not proof of authorization, certificate validation, isolation, monetary budget enforcement or descendant quiescence. The production caller and those runtime controls remain required; synthetic HTTPS fixtures do not alter the owner's current HTTP route.

## Owned planner entry

[planner-entry.ts](planner-entry.ts) is the minimal actual caller entry: the projection alone supplies the argv, TOML, `CODEX_HOME` and environment, the existing lease supplies the credential, and `invokePlannerOnce` runs the process — there is no second parameter set. The entry materializes the run tree itself and writes the generated `config.toml` exclusively (`wx`, so a reused run root refuses instead of diverging). Fixed refusal codes cover HTTP declarations, approval subject mismatch, non-Windows hosts, unusable run roots and helper integrity failures, each before any credential read.

Containment is an explicitly owned job, not the spawning Node process: measured on Node 26.4.0, libuv jobs allow silent breakaway, so a wrapper's own exit never reaches CLI descendants. [job-owner.ps1](job-owner.ps1), integrity-checked through [windows-job-owner.ts](windows-job-owner.ts), holds one Windows job object per invocation without breakaway flags; detached descendants and explicit `CREATE_BREAKAWAY_FROM_JOB` attempts were measured to stay members. `terminate`, `dispose` and owner death (helper stdin EOF) each call `TerminateJobObject` before closing the handle, with `KILL_ON_JOB_CLOSE` as the backstop layer; the flag is applied by whole-struct assignment because nested value-type field mutation is a silent no-op in PowerShell. The optional `ownership` seam assigns the spawned PID, cancels with `OWNERSHIP_FAILED` when a live process cannot be joined, and reports facts only: `descendantState` stays `NOT_VERIFIED`, the fixed input is delivered after assignment settles, and CLI startup work that spawns before assignment completes may still never join.

The receipt returns `terminated`, `activeProcessesRemaining` and `disposed`; any false or unknown value reports a containment failure, never success. [planner-entry.test.mjs](planner-entry.test.mjs) exercises cancellation, completion-time survivors, breakaway attempts, owner death, disposal failures and concurrent unrelated invocations with real PowerShell and real synthetic processes on Windows.

## Verification

From the repository with its pinned dependencies:

```sh
node --import tsx/esm --test scripts/p0-b/windows-credentials/reader.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/native.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/planner-invocation.test.mjs scripts/p0-b/windows-credentials/planner-invocation-bounds.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/planner-entry.test.mjs
node --test scripts/p0-b/windows-credentials/codex-launch-projection.test.mjs
```

The first suite exercises the protocol with explicitly simulated native transport, real RSA operations, reference restrictions and the existing lease. An optional `P0B_WINDOWS_CREDENTIAL_MODULE_ROOT` selects isolated compiled JavaScript for offline verification only; normal repository runs must leave it unset.

The second suite runs only on Windows. It parses both PowerShell scripts under the in-box Windows PowerShell, verifies helper integrity rejection, walks one unique `dsh861/selftest/` target through implicit-overwrite refusal, explicit replacement, sealing, and verified deletion, refuses a synthetic hidden-input confirmation mismatch through the real store path and then stores the matching synthetic pair, and checks that `Set` refuses redirected input while `Remove -WhatIf` declines without operating. No production reference or real model is used. The exact synthetic targets are printed without their values. Process termination or a host crash can prevent cleanup; inspect only the recorded targets and report any residue. The deadline kills the direct helper, not a proven Windows descendant tree. Interactive masked entry of a real key, persistent-account behavior, ACL isolation and full planner integration still need separate local checks; a non-Windows skip does not prove them.

The remote verification boundary and exact tested-file hashes are in the [r07 receipt](../../../development/remediation/2026-09-10/credential-store-r07/verification.json); local Windows native results, the repaired parser-compatible line layout, and this round's file hashes are recorded in the [r08 receipt](../../../development/remediation/2026-09-10/credential-store-r08/verification.json). No hidden-input or native-store success is claimed from Linux tests.

The planner suites use synthetic Node processes and a simulated sealed peer. POSIX retains the inherited-pipe assertion, including `forcedPipeClosure`; a detached descendant exercises survival after the direct child exits. Readiness follows creation of the heartbeat, and the observer requires it to advance. Missing, unreadable or frozen heartbeats cannot prove termination. Cleanup requires the test-owned stop acknowledgement, not a stale timestamp. The wrapper retains `descendantState=NOT_VERIFIED`; cooperative fixture cleanup is not product process-tree containment. The [r11 receipt](../../../development/remediation/2026-09-10/planner-observer-r11/verification.json) qualifies the lifecycle claims in the unchanged [r10 receipt](../../../development/remediation/2026-09-10/planner-windows-r10/verification.json).

The entry suite also runs only on Windows: it drives the projected entry with real Windows PowerShell and real synthetic processes and proves the owned job contains detached descendants, breakaway attempts and survivors of both cancellation and completion, while an unrelated concurrent invocation stays intact. Its result and the r12 keyless pinned-CLI projection verification are recorded in the [r12 receipt](../../../development/remediation/2026-09-10/planner-entry-r12/verification.json).

## Planning prerequisites

Key binding includes implementation and native verification work; it is not solely an owner task. A CLI banner that also echoes a bogus effort value proves configuration-layer acceptance only, not the actual request or gateway behavior. The existing `WRAPPER_READY` label is not evidence that a planning wrapper enforced permissions, full-stream redaction, cancellation or cost limits.

Only the owner can confirm provider-side revocation and approve a changed HTTPS route. Written acceptance of HTTP risk is not proof of protected transport and is not supplied by this change. Keep the approved configuration and lock untouched while awaiting that decision. Use only the Codex credential for the first authorized planning call; other providers can be provisioned later. Never demand all four keys to unblock one planner, and do not read a real key until the invocation prerequisites are actually satisfied.

## References

Windows persistence and generic credential semantics: [CREDENTIALW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw), [CredWriteW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credwritew), and [CredReadW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credreadw). Masked input: [Read-Host](https://github.com/MicrosoftDocs/PowerShell-Docs/blob/main/reference/7.5/Microsoft.PowerShell.Utility/Read-Host.md). Design rationale: [credential bridge decision](../../../.agents/notes/implemented/architecture/2026-09-10-windows-credential-bridge.md).
