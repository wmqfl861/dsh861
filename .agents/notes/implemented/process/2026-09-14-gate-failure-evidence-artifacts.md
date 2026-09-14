# Agent Note: Gate failure-evidence artifacts for the red CI lanes

Status: implemented

English | [中文](2026-09-14-gate-failure-evidence-artifacts.zh.md)

## Problem

PR CI has three red lanes — Linux coverage (`node-24-coverage`), Windows coverage (`windows-coverage`), and consumers (`node-24-consumers`) — whose failures could not be attributed: the complete run-log download through the remote connector returned empty text, job identities differed between reads, and consumer-log excerpts referenced test paths absent from the fixed-HEAD subtree (r30 remediation record `development/remediation/2026-09-14/ci-evidence-r30/`). Without a downloadable, hash-anchored record of each lane's own output, no repair can cite its failure.

## Decision

- `run-gates.ts` gains an opt-in evidence export: `DSH_GATE_EVIDENCE_DIR` names the output directory. Unset or empty means no files and no behavior change; scheduling, gate commands, `GateResult`, and stdout/stderr ownership are untouched.
- The export writes `identity.json`, `gate-results.json` (every gate's id, label, display command, status, aborted flag, duration, exit code, signal, sanitized error, matched path blobs, explicitly unmatched path arguments), one log per non-passing gate that retained output, the mirrored aggregate stdout and stderr, and `manifest.json` with SHA-256 over the exact written bytes.
- `mirrorProcessOutput` wraps `process.stdout.write`/`process.stderr.write` for the run's duration so gates with `streamOutput: true` (partitioned coverage, web snapshot) leave evidence; it observes writes without blocking, reordering, or owning them.
- Sanitization runs before any byte is written or hashed: credential headers, token shapes, cookies, secret-named assignments, and non-runner user-directory segments are masked with fixed placeholders. Truncation keeps a head (first-failure region) and tail under a 1 MiB ceiling per log, with an in-file notice stating omitted, original, and retained bytes; manifest entries carry the same facts.
- The export directory must be absent or empty, and the final recursive listing must equal the written set, so planted files and symlinks cannot ride the upload; gate-log filenames are restricted to `[A-Za-z0-9._-]`. An export error prints one stderr line and never changes the aggregate's exit code.
- `identity.json` records repository, PR number, run id, run attempt, job, aggregate, PR head/base, checkout `github.sha`/`github.ref`, the actual Git HEAD and its parent, and Node/pnpm/platform; the PR head, the checkout merge SHA, and the real HEAD stay separate fields. Only an allowlist of non-sensitive CI variables is read — no environment dump, event payload, or credential store.
- `ci.yml` passes the evidence directory plus PR number/head/base to each red lane's existing gate step and adds an `actions/upload-artifact@v7` step conditioned on `failure() && steps.<id>.outcome == 'failure'`, named `gate-evidence-<job>-run<run>-attempt<attempt>`; needs, runners, timeouts, concurrency budgets, partitions, and test selection are unchanged.

## Consequences

A failed red lane produces an artifact whose identities, statuses, and logs can be re-verified byte-for-byte: statuses are copied verbatim from `GateResult` (fail-fast-skipped stays skipped, aborted stays failed), and the upload runs only after the gate step itself failed, so a missing artifact on a failed lane is itself a finding. `scripts/gate-evidence.spec.ts` owns the export behaviors (switch disabled, status fidelity, exit-code preservation, sanitization reverse assertions, truncation visibility, non-empty-directory refusal, traversal-safe names, manifest recomputation, run/attempt/job separation); `ci-workflow.spec.ts` pins the three lanes' wiring.

## Alternatives considered

| Rejected | One-line reason |
|---|---|
| Complete run-log archive download | The connector's run-log endpoint returns empty text; artifact upload is the supported channel |
| A pnpm/PowerShell tee wrapper around the gate command | Replaces the project entry and alters exit-code semantics; mirroring inside run-gates observes without owning |
| Retaining streamed gate output in `GateResult` | Changes the scheduler's stdout ownership and memory posture, which this change must not touch |
| Dumping the runner environment into identity | Reads beyond the non-sensitive allowlist; identity needs named fields, not an env archive |
