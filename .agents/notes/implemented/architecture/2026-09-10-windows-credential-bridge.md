# Agent Note: Dedicated Windows credentials with a sealed reader pipe

Status: implemented

English | [中文](2026-09-10-windows-credential-bridge.zh.md)

## Problem

Stable credential references need an actual OS-backed reader. Putting a key in command arguments exposes it to additional command and process observation paths. A native reader that prints plaintext also exposes it to accidental diagnostic capture.

## Decision

The [dedicated Windows component](../../../../scripts/p0-b/windows-credentials/README.md) uses four fixed generic Credential Manager targets. Interactive provisioning accepts SecureString input, not a key-valued argument. The trusted reader requires explicit reference grants and integrates with the existing one-use lease instead of discovering global accounts or configuration.

Native stdout carries an RSA-OAEP-SHA256 envelope for a fresh parent-owned RSA-4096 key. Built-in cryptographic implementations handle encryption; Windows owns at-rest protection. Credentials are bounded to 384 printable ASCII bytes and rejected rather than truncated. The transport has explicit executable/source hashes, environment, deadline and output bounds; failures discard native diagnostic content.

The planner process wrapper copies trusted invocation inputs before awaiting external work, limits retained redacted UTF-8 bytes including EOF, and cancels on failed input delivery. A separate termination grace bounds waiting for inherited pipes. Beyond that grace it returns explicit unverified cleanup instead of claiming that all descendants exited. A missing or frozen heartbeat cannot establish exit. The lifecycle fixture creates the heartbeat before readiness, observes progress and uses detached survivors; test cleanup remains distinct from wrapper-owned termination.

The non-secret Codex launch projection verifies the actual configuration lock and produces fixed native argv/configuration. It neither issues authorization nor reads a credential; native enforcement and the trusted production caller remain separate responsibilities.

The minimal caller entry uses the projection's single parameter set and an explicit Windows job owner. The CLI itself starts through a hash-pinned gate launcher whose PID joins the job before the launcher creates it, so the CLI's first code runs already inside the job. Prompt release still requires confirmed assignment on a live, uncancelled invocation; denied or late assignment cannot release input or start the CLI. The helper protocol rejects oversized or inconsistent replies. Disposal requires both acknowledgement and observed clean close, with failures retained through subsequent calls. The entry exposes incomplete cleanup as a blocked result and preserves cleanup facts when invocation fails.

The entry reserves a fresh run root rather than relying only on exclusive creation of its configuration file. This is not Windows ACL enforcement. Direct post-spawn assignment would leave target startup outside the job, and delaying stdin cannot prevent startup code from creating descendants, so the gated launcher is what establishes membership before the CLI's first code runs. Empty membership after termination certifies neither atomic launch nor a complete process tree.

Release authority belongs to the exact live launcher and is lost on abort or owner failure. The owner explicitly stops an unassigned launcher because no job can contain it yet; disposal waits for that launcher's close as well as the helper's acknowledgement and close. An expired wait cannot be revived by a late go marker. The launcher's native failure tests remain separate from the simulated protocol controls.

The entry requires a complete `PlannerProcessOwnership` adapter and explicitly maps the job owner's differently named gated methods. Structural typing accepts a raw owner when launch methods are optional; requiring the adapter and exercising the real entry prevents helper-only tests from certifying an unused launch path.

The owner-admission consumer verifies a signed, exact-request decision and consumes a protected single-attempt marker before reservation or credential use. A separate trusted service supplies the owner key and live enforcement adapter; request files cannot appoint their own signer or substitute matching record strings for runtime controls. Signature, file and active-control checks recur at the reader boundary, and failed control cleanup blocks the result. Native key custody, ledger ACL, immutable snapshots and the actual financial/transport/isolation implementation remain distinct deployment obligations. This preserves one existing process launcher while making owner consent independently verifiable.

A credential-free TLS verifier checks one exact deployment route with explicit trust, hostname validation and bounded socket cleanup at the owner-admission reader. The signed record selects the configured route; invalid consent never opens a connection. TLS completion is followed by fresh consent and live-control checks. A receipt certifies only the probe, not the subsequent CLI connection, gateway behavior or monetary enforcement. Loopback tests use a synthetic public CA and test-only server key; no trust is installed globally.

Planning preparation exports an explicit read set from immutable Git object identities instead of copying the mutable checkout. Raw blob reads omit checkout filters and replacement references, while a separately owned directory prevents ordinary worktree edits from changing the prepared input. The request and native working directory both name that directory before owner signing. Whole-tree verification rejects additional or changed files; filesystem permissions and process isolation remain independent requirements. This separates content selection from OS enforcement without replacing the existing approval or invocation services.

## Alternatives considered

Plaintext files and command-line password arguments expand disclosure paths. Plaintext reader stdout makes accidental process logging unsafe. A full platform secret service and public management UI require authorization and deployment contracts beyond this support component; the component does not claim to deliver them.

Measuring string length misses multibyte output; checking only data callbacks misses delayed EOF output. Retaining an oversized fragment before killing does not enforce a memory bound. Waiting only for stdio close can hang after the direct child exits. The bounded alternative deliberately gives up post-cancellation diagnostics and full descendant cleanup claims.

## Consequences

The OS account is the security boundary, not a credential-name prefix or encrypted pipe. Product agents sharing that account still need effective OS isolation. There is no automatic model activation, key-rotation attestation, HTTPS authorization or planning-call authorization. The [remote r07 receipt](../../../../development/remediation/2026-09-10/credential-store-r07/verification.json) distinguishes synthetic protocol tests from native Windows validation; the [local r08 receipt](../../../../development/remediation/2026-09-10/credential-store-r08/verification.json) records the executed Windows native results, the parser-compatibility repair, and the remaining integration limits; the [r10 receipt](../../../../development/remediation/2026-09-10/planner-windows-r10/verification.json) retains the original Windows observations. The [r11 correction](../../../../development/remediation/2026-09-10/planner-observer-r11/verification.json) records the missing-heartbeat defect and limits those lifecycle claims; the [r12 receipt](../../../../development/remediation/2026-09-10/planner-entry-r12/verification.json) records the pinned-CLI keyless projection verification, the owned-job process-tree measurements and the PowerShell flag defect. The [r13 review](../../../../development/remediation/2026-09-10/ownership-failure-r13/verification.json) records failure-state controls and their explicitly simulated OS boundaries; the [r13 Windows successor receipt](../../../../development/remediation/2026-09-10/planner-gate-r13/verification.json) records the gated-launcher native runs, the deterministic delayed-assignment control and the completed process-information layout probe.
