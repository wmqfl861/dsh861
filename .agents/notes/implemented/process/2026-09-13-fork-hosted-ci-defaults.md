# Agent Note: Standard hosted runners as the fork's CI default

Status: implemented

English | [中文](2026-09-13-fork-hosted-ci-defaults.zh.md)

## Problem

`ci.yml`'s seven worker jobs (`node-24`, `node-24-coverage`, `node-24-consumers`, `windows-build`, `windows-coverage`, `windows-native-tests`, `windows-observational`) fell through their failover expressions to `dsh-ubuntu-24-04-16core` / `dsh-windows-2025-16core` — upstream's dedicated 16-vCPU pools. This fork has no such pools, so every one of those jobs queued indefinitely and the run was cancelled around them (run 34754759281: seven cancelled queued jobs; only jobs on standard images and the reusable packaging workflow completed). The `dsh-*` labels are provisioning facts of the upstream repository, not defaults a fork can assume.

## Decision

- The seven jobs' fallback label becomes the standard GitHub-hosted image of the same platform generation the pools emulate: `ubuntu-24.04` for the Linux workers and `windows-2025` for the Windows workers — the exact labels this repository used before the pools existed. The `all-checks-passed` verdict falls back to `ubuntu-24.04` for one uniform hosted-Linux default.
- The upstream dedicated pools stay reachable only through the explicit opt-in value `DSH_CI_FAILOVER_LINUX` / `DSH_CI_FAILOVER_WINDOWS` = `'enterprise'`, joining `'blacksmith'` and `'selfhosted'` in the same selector. No unconfigured fork path can reach a pool label again; the verdict job deliberately has no `'enterprise'` branch so a misconfiguration can never strand the branch-protection verdict on a missing pool.
- Concurrency budgets sized for the 16-vCPU pools (`DSH_GATE_CONCURRENCY` 8/3/10, `DSH_COVERAGE_MAX_WORKERS` 6, `DSH_OXLINT_THREADS` 8, `DSH_PUBLINT_CONCURRENCY` 8, `DSH_WEB_SNAPSHOT_WORKERS` 6, `DSH_SNAPSHOT_MAX_CONCURRENCY` 32) are injected only when a pool is explicitly selected. On the hosted default they are empty, which unsets them: `run-gates`, oxlint, publint, Vitest coverage, and the snapshot config each size themselves to the runner's `availableParallelism` (4 on the standard images). Two budgets keep explicit hosted values because an empty string changes behavior rather than the degree: `DSH_WEB_SNAPSHOT_WORKERS` (empty switches run-gates to the single-built-suite path) becomes 2, and the consumers' `DSH_GATE_CONCURRENCY` (the ci-consumers aggregate defaults to running every gate in parallel) becomes 4.
- Coverage partitioning (`DSH_COVERAGE_PARTITIONS: '4'`) and the 90000 ms coverage test timeout stay constant across paths: partitions bound memory serially, and the timeout was measured as required on standard hosted images (run 34449848541). No `needs` entry, blocking command, platform, or timeout was loosened; `windows-observational` stays `continue-on-error` by design.

## Consequences

Required jobs, check commands, platform coverage, and the final `needs` aggregation are unchanged; `ci-workflow.spec.ts` evaluates the full selectors (hosted default, `enterprise`, `blacksmith`, `selfhosted`, dependabot fallback), the concurrency expressions, and the verdict's failure propagation over every non-successful result, so a regression to a pool default or an all-parallel consumers lane fails tests before CI queues on it.

## Alternatives considered

| Rejected | One-line reason |
|---|---|
| Self-hosting runners in the fork | Deployment and credential posture the fork must not take on |
| Keeping `dsh-*` as default with `vars` opt-out | An unconfigured fork still queues; defaults must work without repository state |
| Lowering the pool budgets for every path | Untuned guesses for machines that exist and were measured; only the hosted path changes |
