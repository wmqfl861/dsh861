# Windows dedicated credential bridge

English | [中文](README.zh.md)

This P0-B support component provisions four dedicated Windows Credential Manager targets and supplies the existing [credential lease](../credential-ref.ts) with an explicitly granted reader. It does not launch a model, activate [model configuration](../../../config/agents/README.md), confirm key rotation, implement the public web settings UI, or provide a multi-tenant secret service. Native Windows execution remains a required validation step.

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

[planner-invocation.ts](planner-invocation.ts) is the minimal single-call wiring between the sealed reader and a planner CLI. Before any credential read it validates the owner approval record (never self-issued), the exact subject against the lock-verified route, an HTTPS-only transport gate, the pinned prompt and executable hashes, and the deadline and channel bounds. The current approved `codex` route is plaintext HTTP, so the wiring refuses it until an owner-approved protected route exists. The credential then reaches only the child environment through the existing one-use lease, and every returned channel is redacted with the lease's values first; one CLI process may issue several model requests, so these bounds are not a per-request cost ceiling. Keyless synthetic-process verification is in `planner-invocation.test.mjs`; no real planner call is made by this wiring.

## Verification

From the repository with its pinned dependencies:

```sh
node --import tsx/esm --test scripts/p0-b/windows-credentials/reader.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/native.test.mjs
```

The first suite exercises the protocol with explicitly simulated native transport, real RSA operations, reference restrictions and the existing lease. An optional `P0B_WINDOWS_CREDENTIAL_MODULE_ROOT` selects isolated compiled JavaScript for offline verification only; normal repository runs must leave it unset.

The second suite runs only on Windows. It parses both PowerShell scripts under the in-box Windows PowerShell, verifies helper integrity rejection, walks one unique `dsh861/selftest/` target through implicit-overwrite refusal, explicit replacement, sealing, and verified deletion, refuses a synthetic hidden-input confirmation mismatch through the real store path and then stores the matching synthetic pair, and checks that `Set` refuses redirected input while `Remove -WhatIf` declines without operating. No production reference or real model is used. The exact synthetic targets are printed without their values. Process termination or a host crash can prevent cleanup; inspect only the recorded targets and report any residue. The deadline kills the direct helper, not a proven Windows descendant tree. Interactive masked entry of a real key, persistent-account behavior, ACL isolation and full planner integration still need separate local checks; a non-Windows skip does not prove them.

The remote verification boundary and exact tested-file hashes are in the [r07 receipt](../../../development/remediation/2026-09-10/credential-store-r07/verification.json); local Windows native results, the repaired parser-compatible line layout, and this round's file hashes are recorded in the [r08 receipt](../../../development/remediation/2026-09-10/credential-store-r08/verification.json). No hidden-input or native-store success is claimed from Linux tests.

## Planning prerequisites

Key binding includes implementation and native verification work; it is not solely an owner task. A CLI banner that also echoes a bogus effort value proves configuration-layer acceptance only, not the actual request or gateway behavior. The existing `WRAPPER_READY` label is not evidence that a planning wrapper enforced permissions, full-stream redaction, cancellation or cost limits.

Only the owner can confirm provider-side revocation and approve a changed HTTPS route. Written acceptance of HTTP risk is not proof of protected transport and is not supplied by this change. Keep the approved configuration and lock untouched while awaiting that decision. Use only the Codex credential for the first authorized planning call; other providers can be provisioned later. Never demand all four keys to unblock one planner, and do not read a real key until the invocation prerequisites are actually satisfied.

## References

Windows persistence and generic credential semantics: [CREDENTIALW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw), [CredWriteW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credwritew), and [CredReadW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credreadw). Masked input: [Read-Host](https://github.com/MicrosoftDocs/PowerShell-Docs/blob/main/reference/7.5/Microsoft.PowerShell.Utility/Read-Host.md). Design rationale: [credential bridge decision](../../../.agents/notes/implemented/architecture/2026-09-10-windows-credential-bridge.md).
